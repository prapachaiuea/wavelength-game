import { getState } from "../state.js";
import { revealRound } from "../game.js";
import { dragTo, beginDrag, endDrag, lockGuess, isDragging } from "../pointer.js";
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
    const { roomId } = getState();
    dragTo(roomId, Number(slider.value));
  });
  slider.addEventListener("pointerup", () => {
    const { roomId } = getState();
    endDrag(roomId, Number(slider.value));
  });

  btnLock.addEventListener("click", async () => {
    const { roomId } = getState();
    btnLock.disabled = true;
    try {
      await lockGuess(roomId);
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
  const pointer = pub.pointer || { position: 500, locked: false };
  const isCompetitive = pub.mode === "competitive";
  const myTeam = pub.teams?.[state.uid];
  const isSpectatingTeam = isCompetitive && !isClueGiver && myTeam !== pub.activeTeam;

  const markers = [];
  if (isClueGiver && state.mySecret) {
    markers.push({ position: state.mySecret.targetPosition, className: "marker-target", label: "Target" });
  }
  markers.push({
    position: pointer.position,
    className: pointer.locked ? "marker-pointer marker-locked" : "marker-pointer",
    label: pointer.locked ? "Locked" : null,
  });

  const barEl = document.getElementById("guessing-spectrum-bar");
  renderSpectrumBar(barEl, { left: spectrum.left, right: spectrum.right, markers });

  document.getElementById("guessing-clue-text").textContent = pub.clue || "";

  const slider = document.getElementById("guess-slider");
  const btnLock = document.getElementById("btn-lock-guess");
  const btnReveal = document.getElementById("btn-reveal-round");
  const waitingBlock = document.getElementById("guessing-waiting-block");
  const guesserControls = document.getElementById("guesser-controls");

  if (!isDragging()) {
    slider.value = String(pointer.position);
  }

  if (isClueGiver) {
    guesserControls.hidden = true;
    waitingBlock.hidden = pointer.locked;
    document.getElementById("guessing-waiting-text").textContent =
      "Waiting for the group to lock in a guess...";
  } else if (isSpectatingTeam) {
    guesserControls.hidden = true;
    waitingBlock.hidden = false;
    document.getElementById("guessing-waiting-text").textContent =
      `Team ${pub.activeTeam} is guessing this round — you're up next.`;
  } else {
    guesserControls.hidden = false;
    waitingBlock.hidden = true;
    slider.disabled = pointer.locked;
    btnLock.disabled = pointer.locked;
    btnLock.textContent = pointer.locked ? "Locked In" : "Lock In Guess";
  }

  btnReveal.hidden = !(pointer.locked && (isClueGiver || state.isHost));
}
