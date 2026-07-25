const VIEW_IDS = {
  landing: "view-landing",
  lobby: "view-lobby",
  "clue-reveal": "view-clue-reveal",
  guessing: "view-guessing",
  "round-reveal": "view-round-reveal",
  "game-summary": "view-game-summary",
};

export function renderRoute(state) {
  const activeView = state.roomId ? state.phase : "landing";

  Object.entries(VIEW_IDS).forEach(([name, id]) => {
    const el = document.getElementById(id);
    if (el) el.hidden = name !== activeView;
  });

  const roomCodeDisplay = document.getElementById("room-code-display");
  const btnLeaveRoom = document.getElementById("btn-leave-room");
  if (roomCodeDisplay) {
    if (state.roomId) {
      roomCodeDisplay.hidden = false;
      roomCodeDisplay.textContent = `Room: ${state.roomId}`;
    } else {
      roomCodeDisplay.hidden = true;
    }
  }
  if (btnLeaveRoom) {
    btnLeaveRoom.hidden = !state.roomId;
  }
}
