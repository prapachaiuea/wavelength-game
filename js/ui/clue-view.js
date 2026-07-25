import { getState } from "../state.js";
import { submitClue } from "../game.js";
import { loadSpectrums } from "../utils/spectrums.js";
import { renderSpectrumBar, showToast } from "./components.js";

let initialized = false;
let spectrums = [];
loadSpectrums().then((data) => { spectrums = data; });

export function init() {
  if (initialized) return;
  initialized = true;

  const form = document.getElementById("form-clue");
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const { roomId } = getState();
    const input = document.getElementById("input-clue");
    const text = input.value.trim();
    if (!text) return;
    const btn = document.getElementById("btn-submit-clue");
    btn.disabled = true;
    try {
      await submitClue(roomId, text);
    } catch {
      showToast("Could not submit the clue — check your connection.", true);
    } finally {
      btn.disabled = false;
    }
  });
}

export function render(state) {
  if (state.phase !== "clue-reveal") return;

  const pub = state.public || {};
  const spectrum = spectrums[pub.spectrumId] || ["?", "?"];
  const isClueGiver = state.uid === pub.clueGiverUid;
  const clueGiverName = state.players?.[pub.clueGiverUid]?.name || "someone";

  const barEl = document.getElementById("clue-spectrum-bar");
  const markers = isClueGiver && state.mySecret
    ? [{ position: state.mySecret.targetPosition, className: "marker-target", label: "Target" }]
    : [];
  renderSpectrumBar(barEl, { left: spectrum[0], right: spectrum[1], markers });

  const giverForm = document.getElementById("clue-giver-form");
  const waiting = document.getElementById("clue-waiting");
  const heading = document.getElementById("clue-round-heading");
  heading.textContent = `Round ${pub.roundNumber || 1} of ${pub.totalRounds || 1}`;

  if (isClueGiver) {
    giverForm.hidden = false;
    waiting.hidden = true;
  } else {
    giverForm.hidden = true;
    waiting.hidden = false;
    document.getElementById("clue-waiting-text").textContent =
      `Waiting for ${clueGiverName} to give a clue...`;
  }
}
