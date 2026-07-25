import { getState } from "../state.js";
import { nextRoundOrSummary } from "../game.js";
import { computeScore, maxPossibleScore, sumTeamScores } from "../scoring.js";
import { loadSpectrums } from "../utils/spectrums.js";
import { renderSpectrumBar, showToast } from "./components.js";

let initialized = false;
let spectrums = [];
loadSpectrums().then((data) => { spectrums = data; });

export function init() {
  if (initialized) return;
  initialized = true;

  document.getElementById("btn-continue-round").addEventListener("click", async () => {
    const { roomId } = getState();
    const btn = document.getElementById("btn-continue-round");
    btn.disabled = true;
    try {
      await nextRoundOrSummary(roomId);
    } catch {
      showToast("Could not continue — check your connection.", true);
    } finally {
      btn.disabled = false;
    }
  });
}

export function render(state) {
  if (state.phase !== "round-reveal") return;

  const pub = state.public || {};
  const round = (state.rounds || {})[pub.roundNumber];
  if (!round) return; // rounds/{n} hasn't synced to this tab yet — next render() will pick it up

  const spectrum = spectrums[round.spectrumId] || { left: ["?", "?"], right: ["?", "?"] };
  const clueGiverName = state.players?.[round.clueGiverUid]?.name || "someone";
  const { points, label } = computeScore(round.targetPosition, round.lockedPosition);

  const barEl = document.getElementById("round-reveal-spectrum-bar");
  renderSpectrumBar(barEl, {
    left: spectrum.left,
    right: spectrum.right,
    markers: [
      { position: round.targetPosition, className: "marker-target", label: "Target" },
      { position: round.lockedPosition, className: "marker-pointer marker-locked", label: "Guess" },
    ],
  });

  document.getElementById("round-reveal-clue").textContent = `"${round.clue}" — ${clueGiverName}`;
  const pointsLabel = pub.mode === "competitive" ? `Team ${round.team}: +${points} points — ${label}` : `+${points} points — ${label}`;
  document.getElementById("round-reveal-points").textContent = pointsLabel;

  const totalEl = document.getElementById("round-reveal-total");
  if (pub.mode === "competitive") {
    const { scoreA, scoreB } = sumTeamScores(state.rounds);
    totalEl.textContent = `Team A: ${scoreA}  ·  Team B: ${scoreB}`;
  } else {
    const total = Object.values(state.rounds || {}).reduce((sum, r) => sum + (r.points || 0), 0);
    totalEl.textContent = `Total: ${total} / ${maxPossibleScore(pub.roundNumber)}`;
  }

  const btnContinue = document.getElementById("btn-continue-round");
  btnContinue.hidden = !state.isHost;
  const isLastRound = (pub.roundNumber || 0) >= (pub.totalRounds || 0);
  btnContinue.textContent = isLastRound ? "See Final Score" : "Next Round";
}
