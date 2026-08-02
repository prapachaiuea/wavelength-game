const state = {
  uid: null,
  name: "",
  roomId: null,
  isHost: false,
  phase: "landing", // landing | lobby | clue-reveal | guessing | round-reveal | game-summary
  public: null,
  players: {},
  mySecret: null,
  myGuess: null,
  locks: {},
  rounds: {},
};

const listeners = new Set();

export function getState() {
  return state;
}

export function setState(patch) {
  Object.assign(state, patch);
  listeners.forEach((fn) => fn(state));
}

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
