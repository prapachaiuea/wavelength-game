// Pure functions, no Firebase dependency — distance/points are on the same 0-1000 scale as
// public/pointer.position and secrets/{uid}.targetPosition.
const BANDS = [
  { maxDistance: 30, points: 4, label: "Bullseye" },
  { maxDistance: 80, points: 3, label: "Great" },
  { maxDistance: 150, points: 2, label: "Good" },
  { maxDistance: 250, points: 1, label: "Close" },
];

export function computeScore(target, locked) {
  const distance = Math.abs(target - locked);
  const band = BANDS.find((b) => distance <= b.maxDistance);
  return { distance, points: band ? band.points : 0, label: band ? band.label : "Miss" };
}

export function maxPossibleScore(totalRounds) {
  return 4 * totalRounds;
}

// Competitive mode: each round record carries a `results: { [uid]: { points, ... } }` map (one
// entry per guesser that round — everyone except that round's clue-giver). Sums each player's
// points across all rounds and returns them sorted highest-first, ready to render as a
// leaderboard. Derived from `rounds/*` the same race-free way as the cooperative running total
// — no mutable score field to fight over.
export function individualLeaderboard(rounds, players) {
  const totals = {};
  Object.values(rounds || {}).forEach((r) => {
    Object.entries(r.results || {}).forEach(([uid, result]) => {
      totals[uid] = (totals[uid] || 0) + (result.points || 0);
    });
  });
  return Object.entries(totals)
    .map(([uid, points]) => ({ uid, name: players?.[uid]?.name || "someone", points }))
    .sort((a, b) => b.points - a.points);
}

const FLAVOR_BANDS = [
  { minPct: 0.9, text: "Telepathic — you're basically one brain." },
  { minPct: 0.75, text: "In Sync — great wavelength connection." },
  { minPct: 0.55, text: "On the Same Page — solid teamwork." },
  { minPct: 0.35, text: "Getting There — communication needs some work." },
  { minPct: 0, text: "Static — time to talk it out more!" },
];

export function flavorText(totalPoints, totalRounds) {
  const max = maxPossibleScore(totalRounds);
  const pct = max > 0 ? totalPoints / max : 0;
  return FLAVOR_BANDS.find((b) => pct >= b.minPct).text;
}
