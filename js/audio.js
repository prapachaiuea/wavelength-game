// Procedural background music + UI sound effects, generated entirely with the Web Audio
// API — no external audio files to source, license, or host. Volumes are deliberately
// quiet: this plays under real conversation at a game table, never over it.

const MUTE_KEY = "wavelength:musicMuted";

let ctx = null;
let masterGain = null;
let unlocked = false;
let muted = localStorage.getItem(MUTE_KEY) === "1";

let activeScene = null; // { stop(fadeMs) }
let currentSceneKey = null;
let lastPhase = null;

function ensureContext() {
  if (ctx) return;
  ctx = new (window.AudioContext || window.webkitAudioContext)();
  masterGain = ctx.createGain();
  masterGain.gain.value = muted ? 0 : 0.35;
  masterGain.connect(ctx.destination);
}

// Must be called synchronously from inside a real user-gesture handler (click/submit) —
// browsers block audio until one fires. Safe to call repeatedly; only does real work once.
export function unlockAudio() {
  ensureContext();
  if (ctx.state === "suspended") ctx.resume();
  unlocked = true;
}

export function isMuted() {
  return muted;
}

export function setMuted(next) {
  muted = next;
  localStorage.setItem(MUTE_KEY, muted ? "1" : "0");
  if (masterGain) {
    masterGain.gain.cancelScheduledValues(ctx.currentTime);
    masterGain.gain.linearRampToValueAtTime(muted ? 0 : 0.35, ctx.currentTime + 0.3);
  }
}

function noteEnvelope(freq, { start, duration, peak = 0.18, type = "sine", destination }) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(peak, start + duration * 0.15);
  gain.gain.linearRampToValueAtTime(0, start + duration);
  osc.connect(gain);
  gain.connect(destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

// A slow-breathing pad: detuned oscillators under a shared gain that gently swells via an
// LFO — the calm, thinking-it-through mood for lobby/clue-reveal/reveal screens.
function startPad(freqs, { type = "sine", swell = 4 } = {}) {
  const sceneGain = ctx.createGain();
  sceneGain.gain.value = 0;
  sceneGain.connect(masterGain);

  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 1 / swell;
  lfoGain.gain.value = 0.06;
  lfo.connect(lfoGain);
  lfoGain.connect(sceneGain.gain);
  lfo.start();

  const oscs = freqs.map((f) => {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.value = f;
    osc.connect(sceneGain);
    osc.start();
    return osc;
  });

  sceneGain.gain.setTargetAtTime(0.14, ctx.currentTime, 0.6);

  return {
    stop(fadeMs = 800) {
      const t = ctx.currentTime;
      sceneGain.gain.cancelScheduledValues(t);
      sceneGain.gain.setTargetAtTime(0, t, fadeMs / 3000);
      lfo.stop(t + fadeMs / 1000 + 0.5);
      oscs.forEach((o) => o.stop(t + fadeMs / 1000 + 0.5));
    },
  };
}

// A gentle, fixed-tempo pulse cycling through a short arpeggio — used for guessing. There's
// no per-round clock in Wavelength (cooperative discussion is untimed by design), so this
// stays at a steady, unhurried tempo rather than ramping up like a countdown would.
function startPulse(freqs, { bpm = 84, type = "triangle" } = {}) {
  const sceneGain = ctx.createGain();
  sceneGain.gain.value = 0;
  sceneGain.connect(masterGain);
  sceneGain.gain.setTargetAtTime(0.13, ctx.currentTime, 0.4);

  let stopped = false;
  let i = 0;
  let timerId = null;
  function beat() {
    if (stopped) return;
    const noteDur = 60 / bpm;
    noteEnvelope(freqs[i % freqs.length], {
      start: ctx.currentTime,
      duration: noteDur * 0.85,
      peak: 0.18,
      type,
      destination: sceneGain,
    });
    i += 1;
    timerId = setTimeout(beat, noteDur * 1000);
  }
  beat();

  return {
    stop(fadeMs = 500) {
      stopped = true;
      clearTimeout(timerId);
      const t = ctx.currentTime;
      sceneGain.gain.cancelScheduledValues(t);
      sceneGain.gain.setTargetAtTime(0, t, fadeMs / 3000);
    },
  };
}

// A single resolving chord, not looped — for round-reveal and the game summary.
function playSting(freqs, { type = "sine", duration = 1.6 } = {}) {
  const stingGain = ctx.createGain();
  stingGain.connect(masterGain);
  const t = ctx.currentTime;
  freqs.forEach((f, idx) => {
    noteEnvelope(f, { start: t + idx * 0.04, duration, peak: 0.2, type, destination: stingGain });
  });
}

// Short one-shot UI feedback, separate from the looping ambient bed. playClick() is meant
// to be wired to a single delegated listener covering every button in the app.
export function playClick() {
  if (!unlocked) return;
  ensureContext();
  noteEnvelope(720, { start: ctx.currentTime, duration: 0.06, peak: 0.12, type: "square", destination: masterGain });
}

export function playSuccess() {
  if (!unlocked) return;
  ensureContext();
  const t = ctx.currentTime;
  noteEnvelope(523.25, { start: t, duration: 0.12, peak: 0.18, type: "sine", destination: masterGain });
  noteEnvelope(783.99, { start: t + 0.09, duration: 0.18, peak: 0.18, type: "sine", destination: masterGain });
}

const SCENES = {
  // G2 doubled with a partner 0.5Hz off creates a slow natural beating — a signal drifting in
  // and out of tune — under an open D3/B3 on top. Airy and spacious, not "warm" like a pad.
  ambient: () => startPad([98.0, 98.5, 146.83, 246.94], { type: "sine", swell: 7 }), // G2(detuned)-D3-B3
  // An open-fifths arpeggio instead of a driving pulse — there's no clock in this phase, so
  // the mood is floating/telepathic rather than urgent.
  focus: () => startPulse([293.66, 440.0, 587.33, 440.0], { type: "sine", bpm: 70 }), // D4-A4-D5-A4
};

function sceneKeyForPhase(phase) {
  if (phase === "guessing") return "focus";
  return "ambient"; // landing, lobby, clue-reveal, round-reveal, game-summary
}

// Called from the same state-subscription that already drives routing/rendering. Only acts
// on an actual phase change (not every Firebase snapshot) so it never restarts mid-loop.
export function updateForState(state) {
  if (!unlocked) return;
  ensureContext();

  const activePhase = state.roomId ? state.phase : "landing";
  if (activePhase === lastPhase) return;
  lastPhase = activePhase;

  if (activePhase === "round-reveal") playSting([196.0, 246.94, 293.66], { duration: 1.2 }); // G3-B3-D4
  if (activePhase === "game-summary") playSting([98.0, 123.47, 146.83, 196.0], { duration: 2.0 }); // G2-B2-D3-G3

  const sceneKey = sceneKeyForPhase(activePhase);
  if (sceneKey !== currentSceneKey) {
    if (activeScene) activeScene.stop();
    activeScene = SCENES[sceneKey]();
    currentSceneKey = sceneKey;
  }
}
