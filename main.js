import { initAuth } from "./js/auth.js";
import { getState, setState, subscribe } from "./js/state.js";
import { createRoom, joinRoom, leaveRoom, getRoomIdFromUrl, setRoomInUrl } from "./js/room.js";
import { renderRoute } from "./js/router.js";
import { getLastName, getLastRoom } from "./js/utils/storage.js";
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

async function prefillLanding() {
  const roomFromUrlRaw = getRoomIdFromUrl();
  const savedRoom = getLastRoom();
  const lastName = getLastName();

  let roomFromUrl = roomFromUrlRaw;
  if (!roomFromUrl && savedRoom) {
    roomFromUrl = savedRoom;
    setRoomInUrl(roomFromUrl);
  }

  if (lastName) {
    document.getElementById("input-name").value = lastName;
  }

  if (roomFromUrl) {
    document.getElementById("btn-primary-action").textContent = "Join Room";
    document.getElementById("landing-join-row").hidden = false;
    document.getElementById("landing-room-code").textContent = roomFromUrl;
    document.getElementById("landing-join-alt").hidden = true;
  }

  // Only silently rejoin if we're returning to the SAME room we were already in (a refresh) —
  // not whenever this browser happens to have a leftover name/room from a past, different game.
  const isReturningToSameRoom = roomFromUrlRaw && savedRoom === roomFromUrlRaw;
  if (isReturningToSameRoom && lastName) {
    try {
      await joinRoom(roomFromUrl, lastName);
    } catch {
      // Room may no longer exist or the game already started — fall back to the manual form.
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
