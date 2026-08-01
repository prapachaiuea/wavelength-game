import { initAuth } from "./js/auth.js";
import { getState, setState, subscribe } from "./js/state.js";
import { createRoom, joinRoom, leaveRoom, getRoomIdFromUrl, clearRoomFromUrl } from "./js/room.js";
import { renderRoute } from "./js/router.js";
import { getLastName, getLastRoom, clearLastRoom } from "./js/utils/storage.js";
import { showToast } from "./js/ui/components.js";

import * as lobbyView from "./js/ui/lobby-view.js";
import * as clueView from "./js/ui/clue-view.js";
import * as guessingView from "./js/ui/guessing-view.js";
import * as roundRevealView from "./js/ui/round-reveal-view.js";
import * as gameSummaryView from "./js/ui/game-summary-view.js";

const views = [lobbyView, clueView, guessingView, roundRevealView, gameSummaryView];

async function boot() {
  // Wire up the UI immediately so the landing page renders even if Firebase
  // isn't reachable yet (e.g. firebase-config.js still has placeholder values) —
  // only room creation/joining actually needs a signed-in uid.
  views.forEach((v) => v.init());
  subscribe((state) => {
    renderRoute(state);
    views.forEach((v) => v.render(state));
  });
  setupLandingForm();
  document.getElementById("btn-leave-room").addEventListener("click", async () => {
    try {
      await leaveRoom();
    } catch {
      showToast("Could not leave the room — check your connection.", true);
    }
  });
  renderRoute(getState());
  views.forEach((v) => v.render(getState()));

  try {
    const uid = await initAuth();
    setState({ uid });
    await prefillLanding();
  } catch (err) {
    console.error(err);
    showToast("Failed to connect to Firebase — check firebase-config.js.", true);
  }
}

// Resets the landing form to a clean "Create Room" state — used whenever a stale room
// reference (dead link, finished game) needs to stop pinning the UI in "Join Room" mode.
function resetLandingToCreateMode() {
  clearLastRoom();
  clearRoomFromUrl();
  document.getElementById("btn-primary-action").textContent = "Create Room";
  document.getElementById("landing-join-row").hidden = true;
  document.getElementById("landing-join-alt").hidden = false;
  document.getElementById("input-room-code").value = "";
}

async function prefillLanding() {
  const roomFromUrl = getRoomIdFromUrl();
  const savedRoom = getLastRoom();
  const lastName = getLastName();

  if (lastName) {
    document.getElementById("input-name").value = lastName;
  }

  // Case 1: the URL itself already carries a room code (a share link, or a refresh of a page
  // that had ?room= set). Reflect Join-Room mode immediately, and if it matches the room we
  // were last known to be in, attempt a silent rejoin — this is the normal "network dropped,
  // page reloaded" reconnect path.
  if (roomFromUrl) {
    document.getElementById("btn-primary-action").textContent = "Join Room";
    document.getElementById("landing-join-row").hidden = false;
    document.getElementById("landing-room-code").textContent = roomFromUrl;
    document.getElementById("landing-join-alt").hidden = true;

    if (savedRoom === roomFromUrl && lastName) {
      try {
        await joinRoom(roomFromUrl, lastName);
      } catch {
        // Room may no longer exist (expired/finished) — reset to a clean form instead of
        // leaving the UI stuck pointed at a dead room code.
        resetLandingToCreateMode();
      }
    }
    return;
  }

  // Case 2: no room in the URL at all, but this browser remembers being in one — e.g. the tab
  // was closed (or the app backgrounded and killed) mid-game instead of using Leave Room, then
  // reopened via a plain bookmark/new tab with no ?room= param. Try a silent rejoin using ONLY
  // the remembered room, and NEVER mutate the URL/UI until that attempt has actually succeeded
  // — unlike the old behavior, a dead saved room here leaves no visible trace at all if it
  // fails, so there's nothing to get stuck in.
  if (savedRoom && lastName) {
    try {
      await joinRoom(savedRoom, lastName);
    } catch {
      clearLastRoom();
    }
  }
}

function setupLandingForm() {
  const form = document.getElementById("form-landing");
  const btnJoinAlt = document.getElementById("btn-join-room");
  const errorEl = document.getElementById("landing-error");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("input-name").value.trim();
    if (!name) return;
    errorEl.hidden = true;
    const roomFromUrl = getRoomIdFromUrl();
    try {
      if (roomFromUrl) {
        await joinRoom(roomFromUrl, name);
      } else {
        await createRoom(name);
      }
    } catch (err) {
      showError(err);
      // A dead room reached via ?room= (an old share link, a finished game) has no other way
      // back to "Create Room" — the alt-join section is hidden whenever this mode is active —
      // so clear it and hand the user back a working form instead of leaving them stuck.
      if (roomFromUrl && err.message === "ROOM_NOT_FOUND") {
        resetLandingToCreateMode();
      }
    }
  });

  btnJoinAlt.addEventListener("click", async () => {
    const name = document.getElementById("input-name").value.trim();
    const code = document.getElementById("input-room-code").value.trim().toUpperCase();
    if (!name || !code) return;
    errorEl.hidden = true;
    try {
      await joinRoom(code, name);
    } catch (err) {
      showError(err);
    }
  });

  function showError(err) {
    const messages = {
      ROOM_NOT_FOUND: "That room code doesn't exist.",
      ROOM_IN_PROGRESS: "That game has already started — wait for it to finish.",
      COULD_NOT_CREATE_ROOM: "Could not create a room, please try again.",
    };
    errorEl.textContent = messages[err.message] || "Something went wrong. Please try again.";
    errorEl.hidden = false;
  }
}

boot().catch((err) => {
  console.error(err);
  showToast("Failed to connect. Check your Firebase config and connection.", true);
});
