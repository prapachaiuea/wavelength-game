import {
  ref, set, get, update, remove, onValue, onDisconnect,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { db } from "./firebase-init.js";
import { getState, setState } from "./state.js";
import { generateRoomCode } from "./utils/id.js";
import { saveLastRoom, saveLastName, clearLastRoom } from "./utils/storage.js";
import { DEFAULT_TOTAL_ROUNDS } from "./game.js";

const MAX_CODE_ATTEMPTS = 5;
let subscribedRoomId = null;
let unsubscribers = [];

export function getRoomIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const room = params.get("room");
  return room ? room.toUpperCase() : null;
}

export function setRoomInUrl(roomId) {
  const url = new URL(window.location.href);
  url.searchParams.set("room", roomId);
  window.history.replaceState({}, "", url);
}

function clearRoomFromUrl() {
  const url = new URL(window.location.href);
  url.searchParams.delete("room");
  window.history.replaceState({}, "", url);
}

export async function createRoom(name) {
  const { uid } = getState();

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt++) {
    const roomId = generateRoomCode();
    try {
      // First-writer-wins per security rules: claims the room code, or fails on collision.
      await set(ref(db, `wavelength/${roomId}/public/host`), uid);
    } catch {
      continue;
    }
    await update(ref(db, `wavelength/${roomId}/public`), {
      createdAt: Date.now(),
      phase: "lobby",
      roundNumber: 0,
      totalRounds: DEFAULT_TOTAL_ROUNDS,
    });
    await joinRoom(roomId, name);
    return roomId;
  }
  throw new Error("COULD_NOT_CREATE_ROOM");
}

export async function joinRoom(roomId, name) {
  const { uid } = getState();
  saveLastName(name);

  const publicSnap = await get(ref(db, `wavelength/${roomId}/public`));
  if (!publicSnap.exists()) {
    throw new Error("ROOM_NOT_FOUND");
  }
  const publicData = publicSnap.val();

  const playerRef = ref(db, `wavelength/${roomId}/players/${uid}`);
  const existingSnap = await get(playerRef);
  if (!existingSnap.exists() && publicData.phase !== "lobby") {
    throw new Error("ROOM_IN_PROGRESS");
  }

  await set(playerRef, {
    name,
    joinedAt: existingSnap.exists() ? existingSnap.val().joinedAt : Date.now(),
    online: true,
  });
  onDisconnect(ref(db, `wavelength/${roomId}/players/${uid}/online`)).set(false);

  saveLastRoom(roomId);
  setRoomInUrl(roomId);
  setState({ roomId, name, isHost: publicData.host === uid });
  subscribeToRoom(roomId);
  return roomId;
}

export async function leaveRoom() {
  const { roomId, uid } = getState();
  if (!roomId) return;

  try {
    await onDisconnect(ref(db, `wavelength/${roomId}/players/${uid}/online`)).cancel();
    await remove(ref(db, `wavelength/${roomId}/players/${uid}`));
  } catch {
    // Best-effort — still reset the local view even if the write fails (e.g. offline).
  }

  unsubscribeFromRoom();
  clearLastRoom();
  clearRoomFromUrl();

  setState({
    roomId: null,
    isHost: false,
    phase: "landing",
    public: null,
    players: {},
    mySecret: null,
    rounds: {},
  });
}

function unsubscribeFromRoom() {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  subscribedRoomId = null;
}

export function subscribeToRoom(roomId) {
  if (subscribedRoomId === roomId) return; // already listening to this room
  if (subscribedRoomId !== null) unsubscribeFromRoom(); // switched rooms in the same tab
  subscribedRoomId = roomId;

  const { uid } = getState();
  const ignoreDenied = () => {};

  unsubscribers.push(onValue(ref(db, `wavelength/${roomId}/public`), (snap) => {
    const publicData = snap.val() || {};
    setState({
      public: publicData,
      phase: publicData.phase || "lobby",
      isHost: publicData.host === uid,
    });
  }));

  unsubscribers.push(onValue(ref(db, `wavelength/${roomId}/players`), (snap) => {
    setState({ players: snap.val() || {} });
  }));

  // Denied by rules unless auth.uid === uid (only ever populated for the current clue-giver) —
  // expected, not an error.
  unsubscribers.push(onValue(ref(db, `wavelength/${roomId}/secrets/${uid}`), (snap) => {
    setState({ mySecret: snap.val() || null });
  }, ignoreDenied));

  unsubscribers.push(onValue(ref(db, `wavelength/${roomId}/rounds`), (snap) => {
    setState({ rounds: snap.val() || {} });
  }, ignoreDenied));
}
