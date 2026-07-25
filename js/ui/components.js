// `left`/`right` are [english, thai] pairs — rendered as a two-line bilingual label.
function buildSpectrumLabel(pair, sideClass) {
  const el = document.createElement("div");
  el.className = `spectrum-label ${sideClass}`;
  const en = document.createElement("span");
  en.className = "spectrum-label-en";
  en.textContent = Array.isArray(pair) ? pair[0] : pair;
  el.appendChild(en);
  const th = Array.isArray(pair) ? pair[1] : null;
  if (th) {
    const thEl = document.createElement("span");
    thEl.className = "spectrum-label-th";
    thEl.textContent = th;
    el.appendChild(thEl);
  }
  return el;
}

// Renders a spectrum bar into `container`: two bilingual end labels plus zero or more
// absolutely positioned markers (target, live pointer, locked pointer). `markers` is
// [{ position /* 0-1000 */, className, label }]. Shared by clue/guessing/round-reveal views
// so the visual language (bar, marker dot, position math) stays identical across phases.
export function renderSpectrumBar(container, { left, right, markers = [] }) {
  container.innerHTML = "";

  const labels = document.createElement("div");
  labels.className = "spectrum-labels";
  const leftLabel = buildSpectrumLabel(left, "spectrum-label-left");
  const rightLabel = buildSpectrumLabel(right, "spectrum-label-right");
  labels.append(leftLabel, rightLabel);

  const track = document.createElement("div");
  track.className = "spectrum-track";
  markers.forEach((m) => {
    const marker = document.createElement("div");
    marker.className = `spectrum-marker ${m.className}`;
    marker.style.left = `${(m.position / 1000) * 100}%`;
    if (m.label) {
      const tag = document.createElement("span");
      tag.className = "spectrum-marker-label";
      tag.textContent = m.label;
      marker.appendChild(tag);
    }
    track.appendChild(marker);
  });

  const scale = document.createElement("div");
  scale.className = "spectrum-scale";
  for (let i = 0; i <= 10; i++) {
    const tick = document.createElement("span");
    tick.className = "spectrum-scale-tick";
    tick.textContent = String(i);
    scale.appendChild(tick);
  }

  container.append(labels, track, scale);
}

let toastTimeout = null;

export function showToast(message, isError = false) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.classList.toggle("toast-error", isError);
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.hidden = true;
  }, 3500);
}
