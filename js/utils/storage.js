// Prefixed "wavelength:" (not "insider:") because this site shares the prapachaiuea.github.io
// origin with insider-game, and localStorage is scoped per-origin, not per-path — an unprefixed
// or shared key would let the two games clobber each other's "last room"/"last name".
const ROOM_KEY = "wavelength:lastRoomId";
const NAME_KEY = "wavelength:lastName";

export function saveLastRoom(roomId) {
  localStorage.setItem(ROOM_KEY, roomId);
}

export function getLastRoom() {
  return localStorage.getItem(ROOM_KEY);
}

export function clearLastRoom() {
  localStorage.removeItem(ROOM_KEY);
}

export function saveLastName(name) {
  localStorage.setItem(NAME_KEY, name);
}

export function getLastName() {
  return localStorage.getItem(NAME_KEY) || "";
}
