let cache = null;

export async function loadSpectrums() {
  if (cache) return cache;
  const res = await fetch(new URL("../../spectrums.json", import.meta.url));
  cache = await res.json();
  return cache;
}
