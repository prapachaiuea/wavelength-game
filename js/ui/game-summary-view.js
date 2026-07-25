import { getState } from "../state.js";
import { backToLobby } from "../game.js";
import { maxPossibleScore, flavorText } from "../scoring.js";
import { loadSpectrums } from "../utils/spectrums.js";
import { showToast } from "./components.js";

let initialized = false;
let spectrums = [];
loadSpectrums().then((data) => { spectrums = data; });

export function init() {
  if (initialized) return;
  initialized = true;

  document.getElementById("btn-play-again").addEventListener("click", async () => {
    const { roomId } = getState();
    const btn = document.getElementById("btn-play-again");
    btn.disabled = true;
    try {
      await backToLobby(roomId);
    } catch {
      showToast("Could not return to the lobby — check your connection.", true);
    } finally {
      btn.disabled = false;
    }
  });
}

export function render(state) {
  if (state.phase !== "game-summary") return;

  const pub = state.public || {};
  const rounds = state.rounds || {};
  const totalRounds = pub.totalRounds || Object.keys(rounds).length;
  const total = Object.values(rounds).reduce((sum, r) => sum + (r.points || 0), 0);
  const max = maxPossibleScore(totalRounds);

  document.getElementById("summary-total").textContent = `${total} / ${max}`;
  document.getElementById("summary-flavor").textContent = flavorText(total, totalRounds);

  const list = document.getElementById("summary-round-list");
  list.innerHTML = "";
  for (let n = 1; n <= totalRounds; n++) {
    const round = rounds[n];
    const li = document.createElement("li");
    li.className = "summary-round-row";
    if (round) {
      const spectrum = spectrums[round.spectrumId] || ["?", "?"];
      const giverName = state.players?.[round.clueGiverUid]?.name || "someone";
      li.textContent = `Round ${n}: ${spectrum[0]} ↔ ${spectrum[1]} — "${round.clue}" (${giverName}) — +${round.points}`;
    } else {
      li.textContent = `Round ${n}: —`;
    }
    list.appendChild(li);
  }

  const btnPlayAgain = document.getElementById("btn-play-again");
  btnPlayAgain.hidden = !state.isHost;
}
