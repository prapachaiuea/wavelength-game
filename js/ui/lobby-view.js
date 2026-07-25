import { getState } from "../state.js";
import {
  startGame, setTotalRounds, setMode, setTeam,
  MIN_PLAYERS, MIN_PLAYERS_COMPETITIVE, MAX_PLAYERS, DEFAULT_TOTAL_ROUNDS,
} from "../game.js";
import { showToast } from "./components.js";

let initialized = false;

export function init() {
  if (initialized) return;
  initialized = true;

  const btnStart = document.getElementById("btn-start-game");
  const btnCopy = document.getElementById("btn-copy-link");
  const selectRounds = document.getElementById("select-total-rounds");
  const modeToggle = document.getElementById("mode-toggle");
  const teamList = document.getElementById("team-assign-list");

  btnStart.addEventListener("click", async () => {
    const { roomId } = getState();
    btnStart.disabled = true;
    try {
      await startGame(roomId);
    } catch (err) {
      const messages = {
        NOT_ENOUGH_PLAYERS: `Need at least ${MIN_PLAYERS} players to start.`,
        TOO_MANY_PLAYERS: `Max ${MAX_PLAYERS} players per room.`,
        UNASSIGNED_PLAYERS: "Assign every player to Team A or Team B first.",
        TEAM_TOO_SMALL: "Each team needs at least 2 players.",
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

  teamList.addEventListener("click", async (e) => {
    const btn = e.target.closest(".team-btn");
    if (!btn) return;
    const { roomId, isHost } = getState();
    if (!isHost) return;
    try {
      await setTeam(roomId, btn.dataset.uid, btn.dataset.team);
    } catch {
      showToast("Could not update teams.", true);
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
  const isCompetitive = mode === "competitive";

  document.querySelectorAll(".mode-btn").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.mode === mode);
    btn.disabled = !state.isHost;
  });

  const teamAssign = document.getElementById("team-assign");
  teamAssign.hidden = !isCompetitive;
  if (isCompetitive) {
    const teams = state.public?.teams || {};
    const teamList = document.getElementById("team-assign-list");
    teamList.innerHTML = "";
    players.forEach(([uid, p]) => {
      const li = document.createElement("li");
      li.className = "team-assign-row";
      const nameSpan = document.createElement("span");
      nameSpan.className = "team-assign-name";
      nameSpan.textContent = p.name;
      const btnGroup = document.createElement("div");
      btnGroup.className = "team-btn-group";
      ["A", "B"].forEach((team) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = `team-btn team-btn-${team}${teams[uid] === team ? " active" : ""}`;
        btn.textContent = `Team ${team}`;
        btn.dataset.uid = uid;
        btn.dataset.team = team;
        btn.disabled = !state.isHost;
        btnGroup.appendChild(btn);
      });
      li.append(nameSpan, btnGroup);
      teamList.appendChild(li);
    });
  }

  const selectRounds = document.getElementById("select-total-rounds");
  selectRounds.value = String(state.public?.totalRounds || DEFAULT_TOTAL_ROUNDS);
  selectRounds.disabled = !state.isHost;

  const btnStart = document.getElementById("btn-start-game");
  const hint = document.getElementById("lobby-hint");
  const count = players.length;
  const minRequired = isCompetitive ? MIN_PLAYERS_COMPETITIVE : MIN_PLAYERS;

  if (state.isHost) {
    btnStart.hidden = false;
    if (count < minRequired) {
      btnStart.disabled = true;
      hint.textContent = `Waiting for players (${count}/${minRequired} minimum)...`;
    } else if (count > MAX_PLAYERS) {
      btnStart.disabled = true;
      hint.textContent = `Too many players — max ${MAX_PLAYERS}.`;
    } else if (isCompetitive) {
      const teams = state.public?.teams || {};
      const teamA = players.filter(([uid]) => teams[uid] === "A").length;
      const teamB = players.filter(([uid]) => teams[uid] === "B").length;
      if (teamA < 2 || teamB < 2) {
        btnStart.disabled = true;
        hint.textContent = `Team A: ${teamA}, Team B: ${teamB} — each needs at least 2.`;
      } else {
        btnStart.disabled = false;
        hint.textContent = `Ready! Team A: ${teamA}, Team B: ${teamB}.`;
      }
    } else {
      btnStart.disabled = false;
      hint.textContent = `Ready! ${count} players in the room.`;
    }
  } else {
    btnStart.hidden = true;
    hint.textContent = "Waiting for the host to start the game...";
  }
}
