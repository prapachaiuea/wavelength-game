import { getState } from "../state.js";
import { submitClue } from "../game.js";
import { loadSpectrums } from "../utils/spectrums.js";
import { renderSpectrumBar, showToast } from "./components.js";
import * as minigame from "./minigame.js";

let initialized = false;
let spectrums = [];
loadSpectrums().then((data) => { spectrums = data; });

// Tracks which round the clue input was last cleared for. The <input> is a single persistent
// DOM node (the view is only ever hidden, never recreated), so whatever text was last typed
// stays in it forever unless something explicitly clears it — previously nothing did, so a
// player who was clue-giver in round 1 would see their old clue still sitting in the box the
// next time they became clue-giver in a later round.
let clearedForRound = null;

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
      input.value = "";
    } catch {
      showToast("Could not submit the clue — check your connection.", true);
    } finally {
      btn.disabled = false;
    }
  });
}

export function render(state) {
  if (state.phase !== "clue-reveal") {
    minigame.unmount();
    return;
  }

  const pub = state.public || {};
  const spectrum = spectrums[pub.spectrumId] || { left: ["?", "?"], right: ["?", "?"] };
  const isClueGiver = state.uid === pub.clueGiverUid;
  const clueGiverName = state.players?.[pub.clueGiverUid]?.name || "someone";

  const barEl = document.getElementById("clue-spectrum-bar");
  const markers = isClueGiver && state.mySecret
    ? [{ position: state.mySecret.targetPosition, className: "marker-target", label: "Target" }]
    : [];
  renderSpectrumBar(barEl, { left: spectrum.left, right: spectrum.right, markers });

  const giverForm = document.getElementById("clue-giver-form");
  const waiting = document.getElementById("clue-waiting");
  const heading = document.getElementById("clue-round-heading");
  heading.textContent = `Round ${pub.roundNumber || 1} of ${pub.totalRounds || 1}`;

  if (isClueGiver) {
    giverForm.hidden = false;
    waiting.hidden = true;
    minigame.unmount();
    // Safety net alongside the post-submit clear in init(): if this player was clue-giver in
    // an earlier round and never actually submitted (closed the tab, refreshed), the box would
    // otherwise still hold that old text now that they're clue-giver again. Only clears once
    // per round (not on every render pass) so it never fights with what they're actively typing.
    if (clearedForRound !== pub.roundNumber) {
      clearedForRound = pub.roundNumber;
      document.getElementById("input-clue").value = "";
    }
  } else {
    giverForm.hidden = true;
    waiting.hidden = false;
    document.getElementById("clue-waiting-text").textContent =
      `Waiting for ${clueGiverName} to give a clue...`;
    minigame.mount(document.getElementById("waiting-minigame"));
  }
}
