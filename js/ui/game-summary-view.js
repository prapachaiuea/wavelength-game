import { getState } from "../state.js";
import { backToLobby } from "../game.js";
import { maxPossibleScore, flavorText, individualLeaderboard } from "../scoring.js";
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
  const isCompetitive = pub.mode === "competitive";

  const leaderboardEl = document.getElementById("summary-leaderboard");

  if (isCompetitive) {
    const ranked = individualLeaderboard(rounds, state.players);
    document.getElementById("summary-total").textContent = ranked.length ? `🏆 ${ranked[0].name}` : "—";
    document.getElementById("summary-flavor").textContent = ranked.length
      ? `${ranked[0].points} points — closest reader of the room!`
      : "No guesses recorded.";

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
      points.textContent = `${r.points} pts`;
      li.append(name, points);
      leaderboardEl.appendChild(li);
    });
  } else {
    leaderboardEl.hidden = true;
    const total = Object.values(rounds).reduce((sum, r) => sum + (r.points || 0), 0);
    const max = maxPossibleScore(totalRounds);
    document.getElementById("summary-total").textContent = `${total} / ${max}`;
    document.getElementById("summary-flavor").textContent = flavorText(total, totalRounds);
  }

  const list = document.getElementById("summary-round-list");
  list.innerHTML = "";
  for (let n = 1; n <= totalRounds; n++) {
    const round = rounds[n];
    const li = document.createElement("li");
    li.className = "summary-round-row";
    if (round) {
      const spectrum = spectrums[round.spectrumId] || { left: ["?", "?"], right: ["?", "?"] };
      const giverName = state.players?.[round.clueGiverUid]?.name || "someone";
      const spectrumText = `${spectrum.left[0]} (${spectrum.left[1]}) ↔ ${spectrum.right[0]} (${spectrum.right[1]})`;
      if (isCompetitive) {
        const top = Object.entries(round.results || {})
          .map(([uid, r]) => ({ name: state.players?.[uid]?.name || "someone", points: r.points }))
          .sort((a, b) => b.points - a.points)[0];
        const topText = top ? `${top.name} led with +${top.points}` : "no guesses";
        li.textContent = `Round ${n}: ${spectrumText} — "${round.clue}" (${giverName}) — ${topText}`;
      } else {
        li.textContent = `Round ${n}: ${spectrumText} — "${round.clue}" (${giverName}) — +${round.points}`;
      }
    } else {
      li.textContent = `Round ${n}: —`;
    }
    list.appendChild(li);
  }

  const btnPlayAgain = document.getElementById("btn-play-again");
  btnPlayAgain.hidden = !state.isHost;
}
