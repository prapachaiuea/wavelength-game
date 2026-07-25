# Wavelength (web)

A browser version of the cooperative party game **Wavelength** — a hidden target sits on a spectrum (e.g. "Bad Movie ↔ Good Movie"), one rotating player (the Clue-Giver) sees exactly where it is and gives a one-word clue, and everyone else jointly drags a shared dial to guess the spot. Points accumulate across a few rounds into a group score. Static site + Firebase Realtime Database, deployable on GitHub Pages for free.

Sibling project to [insider-game](https://github.com/prapachaiuea/insider-game) — same architecture, same Firebase project (different top-level database path), same host-trust model.

## How it works

1. One player creates a room and shares the link.
2. Everyone else opens the link and joins the lobby. The host picks how many rounds to play (3/5/7/10) and starts the game.
3. Each round, one player rotates into the Clue-Giver seat and privately sees a target position on a spectrum. They give one word or a short phrase as a clue.
4. Everyone else discusses out loud and drags a shared dial to where they think the target is, then locks it in together.
5. The target is revealed. Points are scored by how close the locked guess landed, added to a running group total.
6. After the last round, everyone sees the final score, a flavor-text rating, and a round-by-round recap. The host can start a new game without re-sharing the link.

## Known limitations

**Host trust** (same as Insider): this app runs on Firebase's free plan with no server-side code. Each round, **the Clue-Giver's own browser** picks the spectrum and target, then writes it to a database path that Security Rules restrict to that player (and the host) only. A technically savvy Clue-Giver could inspect their own network traffic to see the target format ahead of time — but since this is a fully cooperative game with no adversarial player, there's no incentive to "cheat," and doing so would only spoil the round for themselves too.

**Pointer thrash**: the shared dial is free-for-all — any non-Clue-Giver player can drag it at any time during the guessing phase, and simultaneous drags from two tabs resolve last-write-wins. In practice, groups naturally take turns holding the dial while talking it through, but if it ever feels chaotic, a quick fix (documented, not built) is to restrict dragging to a single host-assigned "driver" per round — a one-line change to the `pointer` write rule in `firebase-rules.json` (`auth.uid === driverUid` instead of `auth.uid !== clueGiverUid`).

**No host migration**: if the Clue-Giver closes their tab before revealing, the host can always reveal as a fallback — but if the *host* disconnects mid-game, phase transitions that only the host can make (start game, continue to next round, play again) stall until they return.

## Setup

Wavelength reuses the exact same Firebase project as `insider-game` — there's no new Firebase project to create.

### 1. Update the Realtime Database rules

1. Open the [Firebase Console](https://console.firebase.google.com) for the existing project.
2. **Realtime Database → Rules** tab → paste the contents of [`firebase-rules.json`](firebase-rules.json) (this is the *combined* file — it includes Insider's existing `rooms` block, byte-for-byte unchanged, plus a new sibling `wavelength` block) → **Publish**.
3. Double-check the `rooms` block wasn't altered before publishing, so existing Insider games keep working.

No changes needed to Authentication or Authorized Domains — both games share the `prapachaiuea.github.io` origin, which is already authorized.

### 2. Run locally

No build step — just serve the folder statically (opening `index.html` directly via `file://` won't work because ES modules and fetch require an HTTP origin):

```bash
npx serve .
# or: python -m http.server 8080
```

Open it in 3+ browser tabs/incognito windows to simulate a group.

### 3. Deploy to GitHub Pages

1. Push this repo to GitHub.
2. Repo **Settings → Pages** → Source: **Deploy from a branch** → Branch: `main` / `(root)` → Save.
3. Visit `https://<username>.github.io/<repo>/` after a minute or two.

## Project structure

```
index.html            single-page shell, one <section> per game phase
styles.css             all styling
firebase-config.js      Firebase web app config (same project as insider-game)
firebase-rules.json     Realtime Database security rules — rooms (Insider) + wavelength (this game)
spectrums.json          curated spectrum word-pair list
main.js                 entry point
js/
  firebase-init.js       Firebase app/auth/db init
  auth.js                 anonymous sign-in
  room.js                 create/join a room, live sync
  game.js                 round orchestration (host-only): rotate clue-giver, pick spectrum/target, score
  pointer.js              throttled live drag sync for the shared guess dial + lock-in
  scoring.js              pure distance-to-points + flavor-text functions
  state.js                tiny local pub/sub store
  router.js               shows/hides the active phase's <section>
  ui/                      one render module per phase
  utils/                  room code generator, localStorage helpers, spectrum list loader
```

## Limitations / known edge cases

- Min/max player count (3–10) is enforced in the UI only, not by the database rules.
- Duplicate display names are allowed (players are identified by an anonymous auth ID, not their name).
- No per-round timer — rounds are host-paced by "Continue" clicks, not a clock.
