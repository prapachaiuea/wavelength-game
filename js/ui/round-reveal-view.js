import { getState } from "../state.js";
import { nextRoundOrSummary } from "../game.js";
import { maxPossibleScore, individualLeaderboard } from "../scoring.js";
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
  const isCompetitive = pub.mode === "competitive";

  document.getElementById("round-reveal-clue").textContent = `"${round.clue}" — ${clueGiverName}`;

  const leaderboardEl = document.getElementById("round-reveal-leaderboard");
  const totalEl = document.getElementById("round-reveal-total");
  const pointsEl = document.getElementById("round-reveal-points");
  const barEl = document.getElementById("round-reveal-spectrum-bar");

  if (isCompetitive) {
    const results = round.results || {};
    const ranked = Object.entries(results)
      .map(([uid, r]) => ({ uid, name: state.players?.[uid]?.name || "someone", ...r }))
      .sort((a, b) => b.points - a.points);

    renderSpectrumBar(barEl, {
      left: spectrum.left,
      right: spectrum.right,
      markers: [
        { position: round.targetPosition, className: "marker-target", label: "Target" },
        ...ranked.map((r) => ({ position: r.position, className: "marker-pointer marker-locked", label: r.name })),
      ],
    });

    pointsEl.textContent = "";
    leaderboardEl.hidden = false;
    leaderboardEl.innerHTML = "";
    ranked.forEach((r, i) => {
      const li = document.createElement("li");
      li.className = `leaderboard-row${i === 0 ? " leaderboard-first" : ""}`;
      const name = document.createElement("span");
      name.className = "leaderboard-name";
      name.textContent = r.name;
      const points = document.createElement("span");
      points.className = "leaderboard-points";
      points.textContent = `+${r.points}`;
      li.append(name, points);
      leaderboardEl.appendChild(li);
    });

    const overall = individualLeaderboard(state.rounds, state.players);
    totalEl.textContent = overall.length
      ? `Overall lead: ${overall[0].name} (${overall[0].points} pts)`
      : "";
  } else {
    renderSpectrumBar(barEl, {
      left: spectrum.left,
      right: spectrum.right,
      markers: [
        { position: round.targetPosition, className: "marker-target", label: "Target" },
        { position: round.lockedPosition, className: "marker-pointer marker-locked", label: "Guess" },
      ],
    });

    leaderboardEl.hidden = true;
    pointsEl.textContent = `+${round.points} points — distance ${round.distance}`;

    const total = Object.values(state.rounds || {}).reduce((sum, r) => sum + (r.points || 0), 0);
    totalEl.textContent = `Total: ${total} / ${maxPossibleScore(pub.roundNumber)}`;
  }

  const btnContinue = document.getElementById("btn-continue-round");
  btnContinue.hidden = !state.isHost;
  const isLastRound = (pub.roundNumber || 0) >= (pub.totalRounds || 0);
  btnContinue.textContent = isLastRound ? "See Final Score" : "Next Round";
}
