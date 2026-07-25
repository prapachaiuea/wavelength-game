import { ref, get, update } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { db } from "./firebase-init.js";
import { getState } from "./state.js";
import { computeScore } from "./scoring.js";
import { loadSpectrums } from "./utils/spectrums.js";

export const MIN_PLAYERS = 3;
export const MIN_PLAYERS_COMPETITIVE = 4;
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

export async function setTeam(roomId, uid, team) {
  await update(ref(db, `wavelength/${roomId}/public/teams`), { [uid]: team });
}

// Host-only: rotates the clue-giver and picks a fresh spectrum + secret target entirely
// client-side (no trusted server on the free Firebase plan — same host-trust limitation as
// Insider, documented in README.md). Safe as one atomic multi-path update because every
// field's write rule for the host actor is unconditioned on sibling values (see README /
// firebase-rules.json notes on the two-step-write lesson learned from Insider's votes bug).
async function advanceRound(roomId) {
  const { public: pub } = getState();
  const roundNumber = (pub.roundNumber || 0) + 1;
  const isCompetitive = pub.mode === "competitive";

  let clueGiverUid;
  let activeTeam = null;
  if (isCompetitive) {
    activeTeam = roundNumber % 2 === 1 ? "A" : "B";
    const teamOrder = (activeTeam === "A" ? pub.teamAOrder : pub.teamBOrder) || [];
    const turnIndex = Math.floor((roundNumber - 1) / 2);
    clueGiverUid = teamOrder[turnIndex % teamOrder.length];
  } else {
    const clueGiverOrder = pub.clueGiverOrder || [];
    clueGiverUid = clueGiverOrder[(roundNumber - 1) % clueGiverOrder.length];
  }

  const spectrums = await loadSpectrums();
  const spectrumId = Math.floor(Math.random() * spectrums.length);
  const targetPosition = randomTarget();

  const updates = {};
  updates[`wavelength/${roomId}/secrets/${clueGiverUid}`] = { targetPosition };
  updates[`wavelength/${roomId}/public/roundNumber`] = roundNumber;
  updates[`wavelength/${roomId}/public/clueGiverUid`] = clueGiverUid;
  updates[`wavelength/${roomId}/public/activeTeam`] = activeTeam;
  updates[`wavelength/${roomId}/public/spectrumId`] = spectrumId;
  updates[`wavelength/${roomId}/public/clue`] = null;
  updates[`wavelength/${roomId}/public/pointer`] = {
    position: Math.floor(POSITION_MAX / 2),
    movedBy: null,
    movedAt: null,
    locked: false,
    lockedBy: null,
  };
  updates[`wavelength/${roomId}/public/phase`] = "clue-reveal";
  await update(ref(db), updates);
}

export async function startGame(roomId) {
  const { players, public: pub } = getState();
  const uids = Object.keys(players);
  const isCompetitive = pub?.mode === "competitive";

  if (isCompetitive) {
    const teams = pub?.teams || {};
    const teamA = uids.filter((uid) => teams[uid] === "A");
    const teamB = uids.filter((uid) => teams[uid] === "B");
    if (teamA.length + teamB.length !== uids.length) throw new Error("UNASSIGNED_PLAYERS");
    if (teamA.length < 2 || teamB.length < 2) throw new Error("TEAM_TOO_SMALL");

    const byJoined = (a, b) => (players[a].joinedAt || 0) - (players[b].joinedAt || 0);
    const teamAOrder = [...teamA].sort(byJoined);
    const teamBOrder = [...teamB].sort(byJoined);

    await update(ref(db, `wavelength/${roomId}/public`), {
      teamAOrder,
      teamBOrder,
      totalRounds: pub?.totalRounds || DEFAULT_TOTAL_ROUNDS,
      roundNumber: 0,
    });
  } else {
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
  }

  await advanceRound(roomId);
}

// Clue-giver only: two sequential single-path writes (not one atomic multi-path update) so
// the phase rule's "clue already committed" check sees a clean prior state — the same lesson
// learned from Insider's markWordGuessed.
export async function submitClue(roomId, text) {
  await update(ref(db, `wavelength/${roomId}/public`), { clue: text });
  await update(ref(db, `wavelength/${roomId}/public`), { phase: "guessing" });
}

// Clue-giver only (host fallback if they've disconnected). Reads the target via a one-shot
// get() rather than relying on local state, since a fallback-revealing host is reading a uid
// that isn't their own. Two sequential writes for the same ambiguity reason as submitClue.
export async function revealRound(roomId) {
  const { public: pub } = getState();
  const targetSnap = await get(ref(db, `wavelength/${roomId}/secrets/${pub.clueGiverUid}`));
  const targetPosition = targetSnap.val()?.targetPosition ?? 0;
  const lockedPosition = pub.pointer?.position ?? Math.floor(POSITION_MAX / 2);
  const { distance, points } = computeScore(targetPosition, lockedPosition);

  await update(ref(db, `wavelength/${roomId}/rounds/${pub.roundNumber}`), {
    spectrumId: pub.spectrumId,
    clueGiverUid: pub.clueGiverUid,
    team: pub.mode === "competitive" ? pub.activeTeam : null,
    clue: pub.clue,
    targetPosition,
    lockedPosition,
    distance,
    points,
  });
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
  const { public: pub } = getState();
  const updates = {};
  for (let n = 1; n <= (pub.roundNumber || 0); n++) {
    updates[`wavelength/${roomId}/rounds/${n}`] = null;
  }
  updates[`wavelength/${roomId}/public/clue`] = null;
  updates[`wavelength/${roomId}/public/clueGiverUid`] = null;
  updates[`wavelength/${roomId}/public/clueGiverOrder`] = null;
  updates[`wavelength/${roomId}/public/teamAOrder`] = null;
  updates[`wavelength/${roomId}/public/teamBOrder`] = null;
  updates[`wavelength/${roomId}/public/activeTeam`] = null;
  updates[`wavelength/${roomId}/public/spectrumId`] = null;
  updates[`wavelength/${roomId}/public/pointer`] = null;
  updates[`wavelength/${roomId}/public/roundNumber`] = 0;
  updates[`wavelength/${roomId}/public/phase`] = "lobby";
  await update(ref(db), updates);
}
