// Renders a spectrum bar into `container`: two end labels plus zero or more absolutely
// positioned markers (target, live pointer, locked pointer). `markers` is
// [{ position /* 0-1000 */, className, label }]. Shared by clue/guessing/round-reveal views
// so the visual language (bar, marker dot, position math) stays identical across phases.
export function renderSpectrumBar(container, { left, right, markers = [] }) {
  container.innerHTML = "";

  const labels = document.createElement("div");
  labels.className = "spectrum-labels";
  const leftLabel = document.createElement("span");
  leftLabel.className = "spectrum-label spectrum-label-left";
  leftLabel.textContent = left;
  const rightLabel = document.createElement("span");
  rightLabel.className = "spectrum-label spectrum-label-right";
  rightLabel.textContent = right;
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

  container.append(labels, track);
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
