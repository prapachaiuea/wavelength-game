import { getState } from "../state.js";
import { revealRound } from "../game.js";
import {
  dragTo, endDrag, lockGuess,
  dragMyGuess, endMyGuessDrag, lockMyGuess,
  beginDrag, isDragging,
} from "../pointer.js";
import { loadSpectrums } from "../utils/spectrums.js";
import { renderSpectrumBar, showToast } from "./components.js";

let initialized = false;
let spectrums = [];
loadSpectrums().then((data) => { spectrums = data; });

let revealInFlight = false;

// Guards against a hung Firebase call leaving the button permanently disabled with no
// feedback (the reported "stuck until refresh" symptom) — if the reveal hasn't settled within
// REVEAL_TIMEOUT_MS, treat it as failed so the button becomes clickable again on the next
// render pass, without needing a full page reload.
const REVEAL_TIMEOUT_MS = 10000;
function withTimeout(promise, ms) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error("TIMEOUT")), ms)),
  ]);
}

export function init() {
  if (initialized) return;
  initialized = true;

  const slider = document.getElementById("guess-slider");
  const btnLock = document.getElementById("btn-lock-guess");
  const btnReveal = document.getElementById("btn-reveal-round");

  slider.addEventListener("pointerdown", () => beginDrag());
  slider.addEventListener("input", () => {
    const { roomId, public: pub } = getState();
    const position = Number(slider.value);
    if (pub?.mode === "competitive") dragMyGuess(roomId, position);
    else dragTo(roomId, position);
  });
  slider.addEventListener("pointerup", () => {
    const { roomId, public: pub } = getState();
    const position = Number(slider.value);
    if (pub?.mode === "competitive") endMyGuessDrag(roomId, position);
    else endDrag(roomId, position);
  });

  btnLock.addEventListener("click", async () => {
    const { roomId, public: pub } = getState();
    btnLock.disabled = true;
    try {
      if (pub?.mode === "competitive") await lockMyGuess(roomId);
      else await lockGuess(roomId);
    } catch {
      showToast("Could not lock in the guess — check your connection.", true);
      btnLock.disabled = false;
    }
  });

  btnReveal.addEventListener("click", async () => {
    const { roomId } = getState();
    revealInFlight = true;
    btnReveal.disabled = true;
    btnReveal.textContent = "Revealing...";
    try {
      await withTimeout(revealRound(roomId), REVEAL_TIMEOUT_MS);
    } catch {
      showToast("Could not reveal the round — check your connection.", true);
    } finally {
      revealInFlight = false;
      btnReveal.textContent = "Reveal the Target";
      // Actual re-enabling happens in render() below — it runs on every state change and is
      // the single source of truth for whether this button should currently be clickable.
    }
  });
}

export function render(state) {
  if (state.phase !== "guessing") return;

  const pub = state.public || {};
  const spectrum = spectrums[pub.spectrumId] || { left: ["?", "?"], right: ["?", "?"] };
  const isClueGiver = state.uid === pub.clueGiverUid;
  const isCompetitive = pub.mode === "competitive";

  const slider = document.getElementById("guess-slider");
  const btnLock = document.getElementById("btn-lock-guess");
  const btnReveal = document.getElementById("btn-reveal-round");
  const waitingBlock = document.getElementById("guessing-waiting-block");
  const guesserControls = document.getElementById("guesser-controls");
  const barEl = document.getElementById("guessing-spectrum-bar");

  document.getElementById("guessing-clue-text").textContent = pub.clue || "";

  if (isCompetitive) {
    const myGuess = state.myGuess || { position: 500, locked: false };
    // Computed regardless of viewer role (not just inside the isClueGiver branch below) since
    // the reveal-gating logic further down needs it even when the host is watching but isn't
    // this round's clue-giver. "locked" is readable by any room member (see firebase-rules.json)
    // so this listener never goes stale/permission-denied the way it briefly did before.
    const guesserUids = Object.keys(state.players || {}).filter((uid) => uid !== pub.clueGiverUid);
    const lockedCount = guesserUids.filter((uid) => state.allGuesses?.[uid]?.locked).length;
    const allLocked = guesserUids.length > 0 && lockedCount === guesserUids.length;

    const markers = [];
    if (isClueGiver && state.mySecret) {
      markers.push({ position: state.mySecret.targetPosition, className: "marker-target", label: "Target" });
    } else if (!isClueGiver) {
      markers.push({
        position: myGuess.position,
        className: myGuess.locked ? "marker-pointer marker-locked" : "marker-pointer",
        label: myGuess.locked ? "Locked" : "You",
      });
    }
    renderSpectrumBar(barEl, { left: spectrum.left, right: spectrum.right, markers });

    if (!isDragging()) {
      slider.value = String(myGuess.position);
    }

    if (isClueGiver) {
      guesserControls.hidden = true;
      waitingBlock.hidden = false;
      document.getElementById("guessing-waiting-text").textContent =
        `${lockedCount} of ${guesserUids.length} locked in their guess...`;
    } else {
      guesserControls.hidden = false;
      waitingBlock.hidden = true;
      slider.disabled = myGuess.locked;
      btnLock.disabled = myGuess.locked;
      btnLock.textContent = myGuess.locked ? "Locked In — waiting for others" : "Lock In Guess";
    }

    // Reveal only becomes clickable once every guesser has actually locked in — previously the
    // clue-giver/host could reveal early, which could skip/rush whoever hadn't finished yet.
    // Re-evaluated fresh every render (not just once) unless a reveal click from THIS tab is
    // still in flight — the single source of truth for the button's clickability.
    btnReveal.hidden = !(isClueGiver || state.isHost);
    if (!revealInFlight) btnReveal.disabled = !allLocked;
  } else {
    const pointer = pub.pointer || { position: 500, locked: false };
    const markers = [];
    if (isClueGiver && state.mySecret) {
      markers.push({ position: state.mySecret.targetPosition, className: "marker-target", label: "Target" });
    }
    markers.push({
      position: pointer.position,
      className: pointer.locked ? "marker-pointer marker-locked" : "marker-pointer",
      label: pointer.locked ? "Locked" : null,
    });
    renderSpectrumBar(barEl, { left: spectrum.left, right: spectrum.right, markers });

    if (!isDragging()) {
      slider.value = String(pointer.position);
    }

    if (isClueGiver) {
      guesserControls.hidden = true;
      waitingBlock.hidden = pointer.locked;
      document.getElementById("guessing-waiting-text").textContent =
        "Waiting for the group to lock in a guess...";
    } else {
      guesserControls.hidden = false;
      waitingBlock.hidden = true;
      slider.disabled = pointer.locked;
      btnLock.disabled = pointer.locked;
      btnLock.textContent = pointer.locked ? "Locked In" : "Lock In Guess";
    }

    btnReveal.hidden = !(pointer.locked && (isClueGiver || state.isHost));
    if (!revealInFlight) btnReveal.disabled = false;
  }
}
