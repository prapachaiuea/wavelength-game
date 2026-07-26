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
    btnReveal.disabled = true;
    try {
      await revealRound(roomId);
    } catch {
      showToast("Could not reveal the round — check your connection.", true);
      btnReveal.disabled = false;
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
        "Everyone else is locking in their own private guess...";
    } else {
      guesserControls.hidden = false;
      waitingBlock.hidden = true;
      slider.disabled = myGuess.locked;
      btnLock.disabled = myGuess.locked;
      btnLock.textContent = myGuess.locked ? "Locked In — waiting for others" : "Lock In Guess";
    }

    // No cross-player "everyone locked" check (RTDB rules can't aggregate across children),
    // so the clue-giver/host decides when to reveal — same social convention as the physical
    // game ("is everyone done? revealing now").
    btnReveal.hidden = !(isClueGiver || state.isHost);
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
  }
}
