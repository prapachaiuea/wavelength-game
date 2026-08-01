import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { db } from "./firebase-init.js";
import { getState } from "./state.js";
import { computeScore } from "./scoring.js";
import { loadSpectrums } from "./utils/spectrums.js";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 10;
export const DEFAULT_TOTAL_ROUNDS = 5;
export const POSITION_MAX = 1000;

// Avoids boring near-center targets: picks from the two bands flanking the middle 10%.
function randomTarget() {
  return Math.random() < 0.5
    ? 50 + Math.floor(Math.random() * 400) // 50-449
    : 550 + Math.floor(Math.random() * 400); // 550-949
}

export async function setTotalRounds(roomId, totalRounds) {
  await update(ref(db, `wavelength/${roomId}/public`), { totalRounds });
}

export async function setMode(roomId, mode) {
  await update(ref(db, `wavelength/${roomId}/public`), { mode });
}

// Host-only: rotates the clue-giver and picks a fresh spectrum + secret target entirely
// client-side (no trusted server on the free Firebase plan — same host-trust limitation as
// Insider, documented in README.md). Safe as one atomic multi-path update because every
// field's write rule for the host actor is unconditioned on sibling values (see README /
// firebase-rules.json notes on the two-step-write lesson learned from Insider's votes bug).
//
// Competitive mode has no teams — everyone except the clue-giver guesses independently, so
// the clue-giver rotation is identical between modes; only the per-round "who's guessing what"
// state differs (a single shared public/pointer for cooperative vs. one private guesses/{uid}
// per guesser for competitive).
async function advanceRound(roomId) {
  const { public: pub, players } = getState();
  const clueGiverOrder = pub.clueGiverOrder || [];
  const roundNumber = (pub.roundNumber || 0) + 1;
  const clueGiverUid = clueGiverOrder[(roundNumber - 1) % clueGiverOrder.length];
  const isCompetitive = pub.mode === "competitive";

  const spectrums = await loadSpectrums();
  const spectrumId = Math.floor(Math.random() * spectrums.length);
  const targetPosition = randomTarget();

  const updates = {};
  updates[`wavelength/${roomId}/secrets/${clueGiverUid}`] = { targetPosition };
  updates[`wavelength/${roomId}/public/roundNumber`] = roundNumber;
  updates[`wavelength/${roomId}/public/clueGiverUid`] = clueGiverUid;
  updates[`wavelength/${roomId}/public/spectrumId`] = spectrumId;
  updates[`wavelength/${roomId}/public/clue`] = null;

  // `guesses` only has a per-child write rule (host, or a guesser writing their own uid) — never
  // a parent-level one — so writing null to the `guesses` PARENT directly is denied even for the
  // host, and because this all runs inside one atomic multi-path update(), that single denied
  // sub-write silently rolled back every other field in this same call too (confirmed live
  // against the database: this broke every cooperative-mode round transition, not just this
  // one). Always clear/seed via individual `guesses/{uid}` child paths instead.
  if (isCompetitive) {
    updates[`wavelength/${roomId}/public/pointer`] = null;
    Object.keys(players || {}).forEach((uid) => {
      updates[`wavelength/${roomId}/guesses/${uid}`] = uid === clueGiverUid
        ? null // clears any leftover guess from a round where this player was a guesser
        : { position: Math.floor(POSITION_MAX / 2), locked: false };
    });
  } else {
    Object.keys(players || {}).forEach((uid) => {
      updates[`wavelength/${roomId}/guesses/${uid}`] = null;
    });
    updates[`wavelength/${roomId}/public/pointer`] = {
      position: Math.floor(POSITION_MAX / 2),
      movedBy: null,
      movedAt: null,
      locked: false,
      lockedBy: null,
    };
  }

  updates[`wavelength/${roomId}/public/phase`] = "clue-reveal";
  await update(ref(db), updates);
}

export async function startGame(roomId) {
  const { players, public: pub } = getState();
  const uids = Object.keys(players);
  if (uids.length < MIN_PLAYERS) throw new Error("NOT_ENOUGH_PLAYERS");
  if (uids.length > MAX_PLAYERS) throw new Error("TOO_MANY_PLAYERS");

  const clueGiverOrder = [...uids].sort(
    (a, b) => (players[a].joinedAt || 0) - (players[b].joinedAt || 0)
  );

  await update(ref(db, `wavelength/${roomId}/public`), {
    clueGiverOrder,
    totalRounds: pub?.totalRounds || DEFAULT_TOTAL_ROUNDS,
    roundNumber: 0,
  });

  await advanceRound(roomId);
}

// Clue-giver only: two sequential single-path writes (not one atomic multi-path update) so
// the phase rule's "clue already committed" check sees a clean prior state — the same lesson
// learned from Insider's markWordGuessed.
export async function submitClue(roomId, text) {
  await update(ref(db, `wavelength/${roomId}/public`), { clue: text });
  await update(ref(db, `wavelength/${roomId}/public`), { phase: "guessing" });
}

// Clue-giver only (host fallback if they've disconnected). Reads via one-shot get() calls
// rather than relying on cached local state, since the revealer needs data that isn't
// necessarily their own (the target, and in competitive mode, every other player's private
// guess). Two sequential writes for the same read-then-transition ambiguity reason as
// submitClue.
export async function revealRound(roomId) {
  const { public: pub, players } = getState();
  const isCompetitive = pub.mode === "competitive";
  const targetSnap = await get(ref(db, `wavelength/${roomId}/secrets/${pub.clueGiverUid}`));
  const targetPosition = targetSnap.val()?.targetPosition ?? 0;

  const roundRecord = {
    spectrumId: pub.spectrumId,
    clueGiverUid: pub.clueGiverUid,
    clue: pub.clue,
    targetPosition,
  };

  if (isCompetitive) {
    const guesserUids = Object.keys(players || {}).filter((uid) => uid !== pub.clueGiverUid);
    // Parallelized (was a sequential for-await loop) — with several guessers, awaiting each
    // get() one at a time could add up to a few real seconds on a slow connection, long enough
    // that a reveal click looked stuck even though it was still quietly working.
    const snaps = await Promise.all(
      guesserUids.map((uid) => get(ref(db, `wavelength/${roomId}/guesses/${uid}`)))
    );
    const results = {};
    guesserUids.forEach((uid, i) => {
      const position = snaps[i].val()?.position ?? Math.floor(POSITION_MAX / 2);
      const { distance, points } = computeScore(targetPosition, position);
      results[uid] = { position, distance, points };
    });
    roundRecord.results = results;
  } else {
    const lockedPosition = pub.pointer?.position ?? Math.floor(POSITION_MAX / 2);
    const { distance, points } = computeScore(targetPosition, lockedPosition);
    roundRecord.lockedPosition = lockedPosition;
    roundRecord.distance = distance;
    roundRecord.points = points;
  }

  await update(ref(db, `wavelength/${roomId}/rounds/${pub.roundNumber}`), roundRecord);
  await update(ref(db, `wavelength/${roomId}/public`), { phase: "round-reveal" });
}

export async function nextRoundOrSummary(roomId) {
  const { public: pub } = getState();
  if ((pub.roundNumber || 0) >= (pub.totalRounds || DEFAULT_TOTAL_ROUNDS)) {
    await update(ref(db, `wavelength/${roomId}/public`), { phase: "game-summary" });
  } else {
    await advanceRound(roomId);
  }
}

export async function backToLobby(roomId) {
  const { public: pub, players } = getState();
  const updates = {};
  for (let n = 1; n <= (pub.roundNumber || 0); n++) {
    updates[`wavelength/${roomId}/rounds/${n}`] = null;
  }
  // See the comment in advanceRound() — `guesses` has no parent-level write rule, so it must
  // be cleared per-uid, not by nulling the whole node at once.
  Object.keys(players || {}).forEach((uid) => {
    updates[`wavelength/${roomId}/guesses/${uid}`] = null;
  });
  updates[`wavelength/${roomId}/public/clue`] = null;
  updates[`wavelength/${roomId}/public/clueGiverUid`] = null;
  updates[`wavelength/${roomId}/public/clueGiverOrder`] = null;
  updates[`wavelength/${roomId}/public/spectrumId`] = null;
  updates[`wavelength/${roomId}/public/pointer`] = null;
  updates[`wavelength/${roomId}/public/roundNumber`] = 0;
  updates[`wavelength/${roomId}/public/phase`] = "lobby";
  await update(ref(db), updates);
}
