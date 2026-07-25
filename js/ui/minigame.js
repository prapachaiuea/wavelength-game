// A tiny local-only "bubble pop" time-killer for players waiting on the clue-giver — no
// Firebase sync, no shared state, purely client-side, since it's just there to fill dead time.
let container = null;
let spawnInterval = null;
const despawnTimeouts = new Set();
let score = 0;
let scoreEl = null;
let running = false;

const MAX_BUBBLES = 5;
const SPAWN_EVERY_MS = 700;
const BUBBLE_LIFETIME_MS = 1800;

export function mount(el) {
  if (running) return;
  container = el;
  container.innerHTML = "";
  score = 0;

  const header = document.createElement("div");
  header.className = "minigame-header";
  const label = document.createElement("span");
  label.textContent = "Bored? Pop some bubbles while you wait:";
  scoreEl = document.createElement("span");
  scoreEl.className = "minigame-score";
  scoreEl.textContent = "0";
  header.append(label, scoreEl);

  const field = document.createElement("div");
  field.className = "minigame-field";

  container.append(header, field);
  running = true;
  spawnInterval = setInterval(() => spawnBubble(field), SPAWN_EVERY_MS);
}

export function unmount() {
  if (!running) return;
  clearInterval(spawnInterval);
  spawnInterval = null;
  despawnTimeouts.forEach((t) => clearTimeout(t));
  despawnTimeouts.clear();
  if (container) container.innerHTML = "";
  container = null;
  scoreEl = null;
  running = false;
}

function spawnBubble(field) {
  if (field.children.length >= MAX_BUBBLES) return;
  const bubble = document.createElement("button");
  bubble.type = "button";
  bubble.className = "minigame-bubble";
  const size = 26 + Math.random() * 22;
  bubble.style.width = `${size}px`;
  bubble.style.height = `${size}px`;
  bubble.style.left = `${Math.random() * 85}%`;
  bubble.style.top = `${Math.random() * 70}%`;

  const pop = () => {
    score += 1;
    if (scoreEl) scoreEl.textContent = String(score);
    bubble.remove();
  };
  bubble.addEventListener("click", pop);

  field.appendChild(bubble);
  const timeout = setTimeout(() => {
    bubble.remove();
    despawnTimeouts.delete(timeout);
  }, BUBBLE_LIFETIME_MS);
  despawnTimeouts.add(timeout);
}
