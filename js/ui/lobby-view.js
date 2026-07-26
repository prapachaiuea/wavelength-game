import { getState } from "../state.js";
import { startGame, setTotalRounds, setMode, MIN_PLAYERS, MAX_PLAYERS, DEFAULT_TOTAL_ROUNDS } from "../game.js";
import { showToast } from "./components.js";

let initialized = false;

const MODE_EXPLAINERS = {
  cooperative: "Everyone but the clue-giver agrees on one shared guess together.",
  competitive: "Everyone but the clue-giver guesses on their own — closest guess scores the most.",
};

export function init() {
  if (initialized) return;
  initialized = true;

  const btnStart = document.getElementById("btn-start-game");
  const btnCopy = document.getElementById("btn-copy-link");
  const selectRounds = document.getElementById("select-total-rounds");
  const modeToggle = document.getElementById("mode-toggle");

  btnStart.addEventListener("click", async () => {
    const { roomId } = getState();
    btnStart.disabled = true;
    try {
      await startGame(roomId);
    } catch (err) {
      const messages = {
        NOT_ENOUGH_PLAYERS: `Need at least ${MIN_PLAYERS} players to start.`,
        TOO_MANY_PLAYERS: `Max ${MAX_PLAYERS} players per room.`,
      };
      showToast(messages[err.message] || "Could not start the game.", true);
    } finally {
      btnStart.disabled = false;
    }
  });

  btnCopy.addEventListener("click", async () => {
    const shareLink = document.getElementById("share-link");
    try {
      await navigator.clipboard.writeText(shareLink.value);
      showToast("Link copied!");
    } catch {
      shareLink.select();
      showToast("Select and copy the link.");
    }
  });

  selectRounds.addEventListener("change", async () => {
    const { roomId, isHost } = getState();
    if (!isHost) return;
    try {
      await setTotalRounds(roomId, Number(selectRounds.value));
    } catch {
      showToast("Could not update the round count.", true);
    }
  });

  modeToggle.addEventListener("click", async (e) => {
    const btn = e.target.closest(".mode-btn");
    if (!btn) return;
    const { roomId, isHost } = getState();
    if (!isHost) return;
    try {
      await setMode(roomId, btn.dataset.mode);
    } catch {
      showToast("Could not change the game mode.", true);
    }
  });
}

export function render(state) {
  if (!state.roomId) return;

  const shareLink = document.getElementById("share-link");
  shareLink.value = `${window.location.origin}${window.location.pathname}?room=${state.roomId}`;

  const players = Object.entries(state.players || {});
  const playerList = document.getElementById("player-list");
  playerList.innerHTML = "";
  players.forEach(([uid, p]) => {
    const li = document.createElement("li");
    li.className = `player-chip${p.online === false ? " offline" : ""}`;
    const tags = [uid === state.public?.host ? "host" : null, uid === state.uid ? "you" : null]
      .filter(Boolean)
      .join(", ");
    li.textContent = tags ? `${p.name} (${tags})` : p.name;
    playerList.appendChild(li);
  });

  const mode = state.public?.mode || "cooperative";
  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
    btn.disabled = !state.isHost;
  });
  document.getElementById("mode-explainer").textContent = MODE_EXPLAINERS[mode];

  const selectRounds = document.getElementById("select-total-rounds");
  selectRounds.value = String(state.public?.totalRounds || DEFAULT_TOTAL_ROUNDS);
  selectRounds.disabled = !state.isHost;

  const btnStart = document.getElementById("btn-start-game");
  const hint = document.getElementById("lobby-hint");
  const count = players.length;

  if (state.isHost) {
    btnStart.hidden = false;
    if (count < MIN_PLAYERS) {
      btnStart.disabled = true;
      hint.textContent = `Waiting for players (${count}/${MIN_PLAYERS} minimum)...`;
    } else if (count > MAX_PLAYERS) {
      btnStart.disabled = true;
      hint.textContent = `Too many players — max ${MAX_PLAYERS}.`;
    } else {
      btnStart.disabled = false;
      hint.textContent = `Ready! ${count} players in the room.`;
    }
  } else {
    btnStart.hidden = true;
    hint.textContent = "Waiting for the host to start the game...";
  }
}
