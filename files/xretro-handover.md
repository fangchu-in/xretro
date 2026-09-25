# xRetro — Project Handover

Last updated: 25 Sep 2026. Read this whole file before touching code. Where this file and the code disagree, **the code wins**. Read `public/games/dirt.js` and `public/shared/core.js` before writing a new game.

---

## 1. What this is and why

**xRetro** is a family arcade: original browser games inspired by 1980s NES classics, rebuilt to look modern and chic, with original music. It started as a plan to run retro emulators on a Raspberry Pi Zero 2W plugged into the TV. We dropped that for **custom browser games hosted on Cloudflare**, because:
- no ROMs and no copyright problems (all art, music, levels and names are original, generated in code)
- plays on any screen with a browser: TV, laptop, phone
- family in different homes and cities can play together online

**Who plays:** the owner (Fangchu), his kids, and extended family, including young kids. Games must be **instant to pick up**: no accounts, no tutorials to read, just a name. Kids Mode where it makes sense.

**Where they play:**
- Sony Bravia / Google TV (browser app on the TV, or a laptop over HDMI), with Xbox/PlayStation controllers over Bluetooth or the TV remote
- Windows laptop (Firefox and Chrome), keyboard or controller
- Android phones (Firefox) and iPhone (Safari), touch controls, held sideways
- Offline from a USB stick (`public/index.html` opened as a file): everything except online rooms works

**Goal for every game:** fun in 10 seconds, great with 2–4 people on one screen, works online across homes, original chiptune music, looks polished on a big TV.

---

## 2. Links and accounts

| Thing | Value |
|---|---|
| Live site | https://xretro.pages.dev |
| GitHub repo | https://github.com/fangchu-in/xretro, branch `main` (the only repo for this project) |
| Owner's local copy | `D:\Dropbox\Hobbies\xretro\` (Windows, uses CMD) |
| Cloudflare Pages project | `xretro`, connected to the GitHub repo, output folder `public`, no build command |
| Cloudflare Worker | `xretro-rooms`, built from the `server/` folder (Workers Builds, root dir `server`, deploy `npx wrangler deploy`). Holds the Durable Object class `Room` |
| Pages → Worker link | `wrangler.toml`: binding `ROOMS` → class `Room` in script `xretro-rooms` |
| Health check | https://xretro.pages.dev/rooms/TEST should return `{"code":"TEST","open":false,"game":null,"players":0}` (confirmed working 25 Sep) |
| Claude project | "xretro Games" |

No other GitHub repos, Workers or Pages projects belong to xRetro.

---

## 3. How code gets to the live site

Push to `main` → Cloudflare Pages deploys the site in about a minute. Changes under `server/` redeploy the Worker. No GitHub Actions and no secrets are needed.

**Pushing from Claude:** earlier sessions could not push. The git proxy said the repo was "not in this session's authorized repository set". The Claude GitHub App is now installed and shows fangchu-in/xretro as available, so a **new session started with the repo attached** may be able to push. **First thing in a new session:** check with `git push --dry-run`. If it works, Claude commits and pushes itself, after testing.

**If Claude can't push**, Claude sends the changed files and the owner runs this in CMD:
```cmd
cd /d D:\Dropbox\Hobbies\xretro
git add .
git commit -m "Add Hop Hero"
git push origin main
```

**Git mistakes we already hit (avoid them):**
- **No more bundles.** They caused merges, editor popups and a bundle file committed by mistake.
- Always use `git commit -m "..."`. A bare `git commit` or a merge opens an editor the owner can't exit. If a merge is stuck: `git commit --no-edit`.
- Never run `git init` again. The repo already exists.
- `git add .` picks up anything sitting in the folder, so keep downloads (zips, bundles) out of it.
- The "LF will be replaced by CRLF" warnings on Windows are harmless.

**Clean-up still to do (2 minutes, in CMD):**
```cmd
cd /d D:\Dropbox\Hobbies\xretro
git rm --cached xretro-update.bundle
del xretro-update.bundle xretro-patch.bundle
echo *.bundle>> .gitignore
echo *.zip>> .gitignore
git add .
git commit -m "Remove stray bundle, ignore bundles and zips"
git push origin main
```

**Current state (25 Sep):** Hop Hero is live. Dirt Dash stuck-at-wall fix + polish added after it. Service worker version `xretro-v5`. Old merge commits have ugly messages; ignore them.

---

## 4. Free-plan limits (Cloudflare free, GitHub free)

- **Pages:** 500 builds a month, unlimited static traffic. Don't push dozens of tiny commits a day; batch them.
- **Workers / Durable Objects (free):** about 100,000 requests a day and a daily compute-time cap. Incoming WebSocket messages are billed at about 20 messages per request. The host sends ~30 snapshots a second and each guest sends up to 30 input packets a second. Rough estimate: **a 4-player online game uses about 20k requests an hour, so about 4 hours of online play a day is within free limits.** Local (same-screen) play costs nothing. (These are estimates. Check Cloudflare's pricing page if limits are hit.)
  - Keep snapshots at 30/s or lower. If limits are hit, drop to 20/s. Interpolation already hides it.
  - Guests only send input when it changes. Keep it that way.
  - The Worker uses the **WebSocket Hibernation API** and an automatic `ping`→`pong` reply, so idle rooms cost nothing.
- **Workspace network:** Claude's cloud workspace can reach GitHub and npm but usually not other sites (curl to xretro.pages.dev may be refused). Test locally with `wrangler dev`, not against production.

---

## 5. Technical rules (don't break these)

- **Plain HTML + JavaScript.** No framework, no build step, no npm packages in `public/`. One file per game: `public/games/<id>.js`, plus a `public/<id>.html` page.
- **Everything is generated in code:** vector/canvas art, chiptune music (Web Audio), sound effects. No image or audio files. Fonts: Silkscreen and Chakra Petch (local, OFL).
- **Logical resolution 384×216** (16:9), scaled by `Display`, which also lowers resolution automatically on slow TV browsers.
- **Controller first, 10-foot UI:** every screen must work with a D-pad and A/B only. No mouse-only buttons. Touch controls appear on phones.
- **Buttons:** `up, down, left, right, fire, back, pause`. There is no second fire button, so design games around **one action button plus the D-pad**. Read `Input` in core.js for how edges and latches work.
- **Original names and characters only.** Say "Mario-style" in descriptions, but never use Nintendo/Capcom/Hudson names, characters, sprites, level layouts or music.
- **Must run offline** (service worker plus file://) apart from online rooms.
- **Split screen:** 1P full screen, 2P split horizontally, 3P 2×2 with a standings panel, 4P 2×2 (see dirt.js). For platformers, a **shared camera** (all players on one screen, camera follows the group) usually works better. Choose per game.

### Engine: `window.Arcade` (public/shared/core.js, 907 lines)
Exports: `Store, Settings, saveSettings, Sound, Music, THEMES, Names, Input, Touch, Menu, Lobby, TextEntry, Display, run, toast, keepAwake, toggleFullscreen, goLandscape, registerOffline, settingsItems, shareInvite, el, esc, dom{menuDom,lobbyDom}, PLAYER_COLORS, QUALITY_LABELS`
- `Sound.play(name)`. Built-in sounds: move select confirm back join online leave pause type shoot brick steel armor explode boom spawn powerAppear powerUp lifeUp freeze bomb stageStart stageClear gameOver win countdown go. Games can add their own (dirt.js has `SX`).
- `Music.play(song)`, `stop()`, `duck(on)`, `intensity(n)`. A song is a data object (bpm, melody, bass, arp, drums). See `THEMES.menu`, `TANK_THEME`, `DIRT_THEME`. Every game gets its **own original theme**.
- `Names`: device name, fun random names, `forSource()`. `TextEntry` is an on-screen keyboard that works with a controller.
- `Lobby.open(cfg)`, `Menu.open(def)` (menus marked `shared:true` show on every online screen), `run(step, render, display)` is the game loop.
- `Store` saves to localStorage under the prefix `arcade.` (best times, settings).

### Online rooms: `public/shared/net.js` + `server/src/index.js`
- The **host's browser runs the whole game.** Guests send inputs (bit flags plus edge counters, so short taps aren't lost). The host broadcasts snapshots about 30 times a second. The server is only a relay and never runs game logic, so **every new game works online with no server changes.**
- Room codes are 4 consonants (no vowels, so they can't spell words). Invite link: `<game>.html?room=CODE`. The home page also has "Join a friend's room".
- `Net.host(game,name,handlers)`, `Net.join(code,game,name,handlers)`, `Net.broadcast`, `Mirror` (guests draw the host's menus locally), `SnapBuffer` (75 ms interpolation), reconnect with backoff (ends after 45 s away), status pill.
- Snapshots are about 460 bytes. Large static data (like Tank's terrain) is sent **once in full, then only the changes**.
- Pattern to copy: `sendSnap()`, `receiveSnap()`, `guestFrame(dt)`, `hostStep()`/`guestStep()` in dirt.js and tank.js.
- Drop-in: a new controller pressing FIRE mid-game joins (Tank).

### Adding a game (checklist)
1. `public/games/<id>.js` + `public/<id>.html` (copy dirt.html, change the title and script)
2. `public/index.html`: make the card playable (`chip play`, `data-href="<id>.html"`)
3. `public/sw.js`: add both files to `CORE`, bump `VERSION` (next: `xretro-v6`)
4. Test (section 7), then commit/push
5. Update the README game list and this file

---

## 6. Games: status and plan

| # | Name | Inspired by | Status |
|---|---|---|---|
| 1 | **Tank** | Battle City | ✅ Live. 1–4 players, co-op + battle, online, drop-in, destructible terrain, power-ups |
| 2 | **Dirt Dash** | Excitebike | ✅ Live. 1–4 riders + CPU rivals, 4 lanes, 5 tracks (Dusty Hills, Canyon Leap, Monsoon Mud, Night Rally, Himalaya Pro), 2 laps, engine heat, PERFECT landings, Kids/Normal/Pro, split screen, online |
| 3 | **Hop Hero** | Super Mario Bros | ✅ Built 25 Sep. 1–4 co-op, shared camera, bubbles, 3 worlds × 3 levels + 3 bosses (Thornback, Crag Crab, Baron Grumble), Kids/Normal/Pro, drop-in, online, ending |
| 4 | **Tiki Trail** | Adventure Island | 🔜 Build next (same session as Hop Hero if possible) |
| 5 | **Big Top** | Circus Charlie | Later |
| 6 | **Strike Force** | Contra | Later (2-player co-op run-and-gun, 1 fire button + aim with D-pad) |
| 7 | **Apex GP** | F1 Race | Later (top-down racing) |

The owner decides the order. Build **one game at a time, fully finished and tested**.

### Hop Hero (brief)
Side-scrolling platformer with an original hero (not a plumber). **1–4 player co-op, shared camera** (like New Super Mario Bros): the camera follows the group, and a player who falls behind floats back in a bubble. Fire = jump (hold for higher). Stomp enemies. Coins, a growth power-up (take one extra hit), a star-style invincibility, checkpoint flag, goal pole with height bonus. 3 worlds (e.g. Meadow, Crystal Caves, Sky Castle) × 3 short levels, plus a simple boss at the end of each world. Lives are shared or a respawn bubble (no game-over frustration for kids). Kids Mode: bottomless pits bounce you back. Original bright, major-key theme per world. Online: same pattern as dirt.js.

### Tiki Trail (brief)
Tropical side-scroller with an original island kid. **1–2 players** (co-op, shared camera). An **energy bar drains over time**; fruit refills it, which pushes you forward. Fire = jump, and the stone axe is thrown with Down+Fire or automatically (see the controls note below). Skateboard power-up: faster, absorbs one hit. Enemies: snails, bees, frogs, rolling rocks, fire. 3 islands (Beach, Jungle, Volcano) × 3–4 short areas + a boss per island. Tropical steel-drum-style chip music.

> **Settled (Hop Hero):** D-pad runs (hold to sprint), **Fire = jump (hold = higher)**, **Down + Fire = throw** (Hop Hero: sparks with the Zap Flower; Tiki Trail: the axe). Use exactly this in Tiki Trail. `hop.js` has the platformer physics (moveBody, coyote time, jump buffer, corner correction), the shared camera, bubbles and a test bot to reuse.

> Controls note: there's only one action button. For platformers use **Fire = jump** and **Up or Down+Fire = throw/special**, or an auto-throw. Settle it early and keep it the same in every platformer.

---

## 7. Testing (do this before every push)

Chromium and Playwright are installed in Claude's workspace (`/opt/pw-browsers`; don't run `playwright install`). Local servers:
```bash
cd server && npm install && npx wrangler dev            # rooms on :8787
cd .. && server/node_modules/.bin/wrangler pages dev    # site + /rooms on :8788
```
What has been tested for each game: solo run to the end, 2P and 3–4P split screen, Kids Mode, phone viewport with touch, online host + guest in two browser contexts, opening from file://, and **zero console errors**. Also check the other games still work.

---

## 8. Lessons and bugs already fixed (don't bring them back)

- **Short taps lost:** a phone tap shorter than one frame registered nothing. Fixed with `touchLatch` (fire/pause stay pressed until the next poll). Remote inputs use edge counters for the same reason.
- `setPointerCapture` throws "No active pointer" on some devices. It's wrapped in try/catch.
- Cloudflare redirects `/tank.html?room=X` to `/tank?room=X` (308). URL checks and tests must accept both forms.
- Service worker: always bump `VERSION` or TVs keep the old game. `/rooms/` is never cached.
- Dirt Dash: races were too short (15 s), so there are now 2 laps with longer flat sections (~40 s). PERFECT fired on tiny bumps, so it now needs ≥0.38 s in the air. Speed clamp bug fixed with separate speed-up/slow-down branches. CPU riders still racing at the time limit show "still riding", not "did not finish". The lobby needs the demo race running behind it (`startDemo()`).
- Dirt Dash: riders who came up short on a gap got stuck forever against the landing ramp's wall (crash, respawn at its foot, crash again). Now a **rescue hop** (`startHop`) carries them over in ~1 s: on hitting a wall, after a crash at the foot of one, and a safety net if a rider sits stalled with the gas on for 1.2 s. Stress-tested: every track × lane × speed finishes. Also added: overtake callouts ("2ND!"), final-lap jingle, turbo/PERFECT speed lines, crash screen shake, finish confetti, long names fitted in the HUD.
- A merge popped up an editor in CMD and the owner got stuck (see section 3).
- A game's HUD should not show keyboard hints ("PAUSE: ESC") on touch devices.
- Long player names need `fitText()` in the HUD.

---

## 9. Working style the owner wants

- **Saving tokens:** the owner uses Sonnet for planning, fixes and git help, and switches to **Opus 5.5 (Medium)** for building. Tell him before starting a big build so he can switch models.
- Claude codes, tests and (if possible) pushes. The owner does as few manual steps as possible. When he must act, give **exact copy-paste CMD commands** (he's new to git on Windows).
- Short, plain replies. No long recaps.
- "Make it amazing": polished look, great music, juicy effects, kid-friendly.
