import { ref, set, update } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-database.js";
import { db } from "./firebase-init.js";
import { getState } from "./state.js";
import { showToast } from "./ui/components.js";

const WRITE_THROTTLE_MS = 100;
let lastWriteAt = 0;
let pendingTimeout = null;
let dragging = false;
let warnedThisDrag = false;

// Consulted by guessing-view.js to suppress re-rendering the slider's DOM value from
// incoming remote snapshots while THIS tab's user has a finger/mouse on it — prevents the
// classic "value jumps under your thumb" fight between local drag state and remote echoes.
export function isDragging() {
  return dragging;
}

export function beginDrag() {
  dragging = true;
  warnedThisDrag = false;
}

// Previously had no error handling at all: a rejected write (e.g. permission denied) failed
// completely silently, so a broken drag looked identical to "nothing happens" with no signal
// to debug from. Now surfaces at most one toast per drag gesture, not one per throttled write.
async function writeAt(path, value) {
  try {
    await update(ref(db, path), value);
  } catch (err) {
    console.error(`Failed to write ${path}:`, err);
    if (!warnedThisDrag) {
      warnedThisDrag = true;
      showToast("Could not update your guess — check your connection.", true);
    }
  }
}

// Throttled to ~WRITE_THROTTLE_MS during active dragging to stay well within Spark-plan
// write limits; always follow with an untuned write on release so the settled value is exact.
function throttledWriteAt(path, value) {
  const now = Date.now();
  clearTimeout(pendingTimeout);
  const elapsed = now - lastWriteAt;
  lastWriteAt = now;
  if (elapsed >= WRITE_THROTTLE_MS) {
    writeAt(path, value);
  } else {
    pendingTimeout = setTimeout(() => writeAt(path, value), WRITE_THROTTLE_MS - elapsed);
  }
}

function stopPending() {
  dragging = false;
  clearTimeout(pendingTimeout);
}

// --- Cooperative: one shared dial for the whole group ---

export function dragTo(roomId, position) {
  const { uid } = getState();
  throttledWriteAt(`wavelength/${roomId}/public/pointer`, { position, movedBy: uid, movedAt: Date.now() });
}

export function endDrag(roomId, position) {
  stopPending();
  const { uid } = getState();
  writeAt(`wavelength/${roomId}/public/pointer`, { position, movedBy: uid, movedAt: Date.now() });
}

export async function lockGuess(roomId) {
  const { uid } = getState();
  await update(ref(db, `wavelength/${roomId}/public/pointer`), { locked: true, lockedBy: uid });
}

// --- Competitive: each non-clue-giver drags their own private guess ---

export function dragMyGuess(roomId, position) {
  const { uid } = getState();
  throttledWriteAt(`wavelength/${roomId}/guesses/${uid}`, { position });
}

export function endMyGuessDrag(roomId, position) {
  stopPending();
  const { uid } = getState();
  writeAt(`wavelength/${roomId}/guesses/${uid}`, { position });
}

export async function lockMyGuess(roomId) {
  const { uid } = getState();
  await set(ref(db, `wavelength/${roomId}/locks/${uid}`), true);
}
