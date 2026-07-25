import { ref, update } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { db } from "./firebase-init.js";
import { getState } from "./state.js";

const WRITE_THROTTLE_MS = 100;
let lastWriteAt = 0;
let pendingTimeout = null;
let dragging = false;

// Consulted by guessing-view.js to suppress re-rendering the slider's DOM value from
// incoming remote snapshots while THIS tab's user has a finger/mouse on it — prevents the
// classic "value jumps under your thumb" fight between local drag state and remote echoes.
export function isDragging() {
  return dragging;
}

export function beginDrag() {
  dragging = true;
}

async function writePointer(roomId, position) {
  const { uid } = getState();
  lastWriteAt = Date.now();
  await update(ref(db, `wavelength/${roomId}/public/pointer`), {
    position,
    movedBy: uid,
    movedAt: Date.now(),
  });
}

// Throttled to ~WRITE_THROTTLE_MS during active dragging to stay well within Spark-plan
// write limits for a small room; always call endDrag() on release for one final exact write.
export function dragTo(roomId, position) {
  const now = Date.now();
  clearTimeout(pendingTimeout);
  const elapsed = now - lastWriteAt;
  if (elapsed >= WRITE_THROTTLE_MS) {
    writePointer(roomId, position);
  } else {
    pendingTimeout = setTimeout(() => writePointer(roomId, position), WRITE_THROTTLE_MS - elapsed);
  }
}

export function endDrag(roomId, position) {
  dragging = false;
  clearTimeout(pendingTimeout);
  writePointer(roomId, position);
}

export async function lockGuess(roomId) {
  const { uid } = getState();
  await update(ref(db, `wavelength/${roomId}/public/pointer`), {
    locked: true,
    lockedBy: uid,
  });
}
