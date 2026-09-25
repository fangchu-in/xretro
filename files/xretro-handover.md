# xRetro — Project Handover

Last updated: 25 Sep 2026 (late night, Tiki Trail added). Read this whole file before touching code. Where this file and the code disagree, **the code wins**. Read `public/games/dirt.js` and `public/shared/core.js` before writing a new game.

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
| GitHub repo | https://github.com/fangchu-in/xretro, branch `main` (the only repo for this project). Being made **public** (see section 4a) |
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

**Claude does not push.** The owner's decision (25 Sep): Claude never pushes to GitHub, and doesn't try, unless the owner shares an access token for that purpose. (Every session so far got the proxy error "not in this session's authorized repository set".) Claude may commit in its own workspace copy; a stop hook will then complain about "unpushed commits". Ignore it and say so in one line.

**Workflow:** Claude tests, then sends a **zip of only the changed files** (paths inside the zip relative to the repo root, e.g. `public/games/dirt.js`). The owner saves it to Downloads and runs:
```cmd
cd /d D:\Dropbox\Hobbies\xretro
git pull origin main --no-edit
tar -xf "%USERPROFILE%\Downloads\<name>.zip" -C D:\Dropbox\Hobbies\xretro
git add .
git commit -m "<short message>"
git push origin main
```
Always start from `git pull origin main --no-edit`: when GitHub has a commit the owner's PC doesn't, the push is rejected ("non-fast-forward"), and `--no-edit` stops the merge from opening an editor. Before building, Claude runs `git fetch` and `git reset --hard origin/main` on its own copy so it works from what's actually live.

**Git mistakes we already hit (avoid them):**
- **No more bundles.** They caused merges, editor popups and a bundle file committed by mistake.
- Always use `git commit -m "..."`. A bare `git commit` or a merge opens an editor the owner can't exit. If a merge is stuck: `git commit --no-edit`.
- Never run `git init` again. The repo already exists.
- `git add .` picks up anything sitting in the folder, so keep downloads (zips, bundles) out of it.
- The "LF will be replaced by CRLF" warnings on Windows are harmless.

**Current state (25 Sep, late night):** GitHub `main` = `feb996c` (Add Blacktop Brawl, `sw.js` v6). Tank, Dirt Dash, Hop Hero and Blacktop Brawl are live. `.gitignore` ignores `*.bundle` and `*.zip`. Old merge commits have ugly messages; ignore them.
Next commit (sent as `tiki-trail.zip`): Tiki Trail (`public/tiki.html`, `public/games/tiki.js`), a small `core.js` music addition (steel-drum lead, calypso bass, bongo/shaker drums), its index card, `sw.js` → **`xretro-v7`**, README row, this file. Tested locally, not yet pushed by the owner.

---

## 4. Free-plan limits (Cloudflare free, GitHub free)

- **Pages:** 500 builds a month, unlimited static traffic. Don't push dozens of tiny commits a day; batch them.
- **Workers / Durable Objects (free):** about 100,000 requests a day and a daily compute-time cap. Incoming WebSocket messages are billed at about 20 messages per request. The host sends ~30 snapshots a second and each guest sends up to 30 input packets a second. Rough estimate: **a 4-player online game uses about 20k requests an hour, so about 4 hours of online play a day is within free limits.** Local (same-screen) play costs nothing. (These are estimates. Check Cloudflare's pricing page if limits are hit.)
  - Keep snapshots at 30/s or lower. If limits are hit, drop to 20/s. Interpolation already hides it.
  - Guests only send input when it changes. Keep it that way.
  - The Worker uses the **WebSocket Hibernation API** and an automatic `ping`→`pong` reply, so idle rooms cost nothing.
- **Workspace network:** Claude's cloud workspace can reach GitHub and npm but usually not other sites (curl to xretro.pages.dev may be refused). Test locally with `wrangler dev`, not against production.

### 4a. Public repo: keep Cloudflare for the family
The repo is going public so anyone can read, fork and enjoy the code. **Nobody else should use the owner's Cloudflare.** What protects it:
- The game connects to rooms on **its own site's address** (`location.host + '/rooms/'` in net.js), so a fork hosted anywhere else uses its own server, never ours.
- **Origin lock:** `functions/rooms/[code].js` and `server/src/index.js` refuse browsers from any other website (`okOrigin`: only `xretro.pages.dev`, its `*.xretro.pages.dev` preview addresses, and localhost). Requests with no Origin (curl, the health check) still work. Tested: evil.example, `xretro.pages.dev.evil.com` and `null` get 403; online play still works. A determined script can fake an Origin header, so this stops other websites, not deliberate abuse.
- No secrets in the repo or its history (checked 25 Sep). Keep it that way: never commit tokens, `.dev.vars` or account IDs.
- **Owner to check once in Cloudflare:** for both the `xretro` Pages project and the `xretro-rooms` Worker, set build/branch control to **production branch `main` only** (no automatic preview builds for other branches or pull requests). A stranger's pull request then can't use up the 500 builds a month. Merge nothing from strangers without reading it.
- Nobody else can push to the repo. Forks and pull requests don't touch the live site until the owner merges them.
- README tells forkers to host on their own free Cloudflare account and edit `okOrigin`.
- Open question for the owner: add a license (e.g. MIT) if he wants others to be *allowed* to reuse the code. Without one, it's readable but "all rights reserved".

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
- `Music.play(song)`, `stop()`, `duck(on)`, `intensity(n)`. A song is a data object (bpm, melody, bass, arp, drums). See `THEMES.menu`, `TANK_THEME`, `DIRT_THEME`. Every game gets its **own original theme**. Optional extras (added for Tiki Trail, ignored by older songs): `steel: true` plays the lead as a steel drum (struck partials, long notes rolled), `bass: 'calypso'`, and drum letters `b` high bongo, `l` low bongo, `c` shaker.
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
3. `public/sw.js`: add both files to `CORE`, bump `VERSION` (next: `xretro-v8`)
4. Test (section 7), then commit/push
5. Update the README game list and this file

---

## 6. Games: status and plan

| # | Name | Inspired by | Status |
|---|---|---|---|
| 1 | **Tank** | Battle City | ✅ Live. 1–4 players, co-op + battle, online, drop-in, destructible terrain, power-ups |
| 2 | **Dirt Dash** | Excitebike | ✅ Live. 1–4 riders + CPU rivals, 4 lanes, 5 tracks (Dusty Hills, Canyon Leap, Monsoon Mud, Night Rally, Himalaya Pro), 2 laps, engine heat, PERFECT landings, rescue hop over walls, overtake callouts, Kids/Normal/Pro, split screen, online |
| 3 | **Hop Hero** | Super Mario Bros | ✅ Live 25 Sep (owner confirmed). 1–4 co-op, shared camera, bubbles, 3 worlds × 3 levels + 3 bosses (Thornback, Crag Crab, Baron Grumble), Kids/Normal/Pro, drop-in, online, ending |
| 3b | **Blacktop Brawl** | Road Rash | ✅ Reviewed, reworked and tested 25 Sep; sent as `blacktop-brawl.zip`, waiting for the owner's push. 1–4 riders + CPU rivals, 4 routes, cartoon bonks, gift-box items, hops/ramps, drop-in, Kids/Normal/Pro, split screen, online |
| 4 | **Tiki Trail** | Adventure Island | ✅ Built and tested 25 Sep; sent as `tiki-trail.zip`, waiting for the owner's push. 1–2 co-op, shared camera, energy bar + fruit, stone axe, skateboard, secret caves, 3 islands × 3 areas + 3 bosses, Kids/Normal/Pro, drop-in, online |
| 5 | **Big Top** | Circus Charlie | Later |
| 6 | **Strike Force** | Contra | Later (2-player co-op run-and-gun, 1 fire button + aim with D-pad) |
| 7 | **Apex GP** | F1 Race | Later (top-down racing) |

The owner decides the order. Build **one game at a time, fully finished and tested**.

### Blacktop Brawl (done)
Started in another chat (Sonnet), then reviewed and largely rewritten here. `public/games/brawl.js` (~1275 lines).
- **Controls:** the bike rides itself. RIGHT = zoom (heats the engine; holding it non-stop overheats and is slower than cruising), LEFT = brake, UP/DOWN = lane. **FIRE = bonk** whoever is alongside (same lane or the next one). **DOWN+FIRE = hop** (potholes, cones, balls, even cars). A quick DOWN tap waits 0.1 s before changing lane so DOWN+FIRE never also moves you down a lane. Touch button says BONK.
- **Tone:** foam glove by default; gift boxes give a **pool noodle** (4 bonks, long reach, scoots the rider over a lane), **squeaky mallet** (3 bonks, big wobble), **rocket** (2.4 s burst, plows through traffic) or **bubble shield** (blocks one bonk or car). Bonks fill a **WOBBLE** meter; full = cartoon tumble with dizzy stars, then "BACK ON!". No blood, no KO, no health bar. Items are weighted by place (last place gets more rockets). Rivals: Ratchet, Noodles, Bronco, Zippy.
- **Kids:** rivals never bonk, bonks never tumble (no wobble bar), hitting a car just boings you over it, gentler potholes/slicks, no finish time limit, slower rivals.
- **Routes** (seeded generator, `buildRoute`): Sunset Coast (ocean, palms), Neon City (night, skyline, lamps), Canyon Run (mesas, cacti, mud, more ramps), Snowy Pass (mountains, pines, ice, snowfall). About 40–50 s. Traffic (cars, trucks, buses, ice-cream vans), potholes, oil/mud/ice slicks, cone rows (fly off when hit), bouncing beach balls/snowballs, ramps ("WHEE!"), blue boost arrows ("ZOOM!"), gift boxes (respawn after 3 s).
- **Online:** traffic moves at a fixed speed per lane (`x0 + vx × simT`), and the route comes from a seed, so guests compute it from the clock; snapshots carry riders, the clock, hit cones and taken gifts (~520 bytes). Effects (stars, dust, confetti, flying cones) are derived from rider state on every device. Tested: host + guest to the results screen, a second guest **dropping in mid-race**, the guest choosing "Next route" from the shared results menu.
- Also: rubber-band rivals (keep the pack together), overtake and FINAL STRETCH callouts, fun awards on the results screen (Bonk Boss, Air Ace, Gift Grabber, Never tumbled), route records per difficulty, comic BONK bursts, a start-of-race tip line (touch wording on phones).

### Hop Hero (brief)
Side-scrolling platformer with an original hero (not a plumber). **1–4 player co-op, shared camera** (like New Super Mario Bros): the camera follows the group, and a player who falls behind floats back in a bubble. Fire = jump (hold for higher). Stomp enemies. Coins, a growth power-up (take one extra hit), a star-style invincibility, checkpoint flag, goal pole with height bonus. 3 worlds (e.g. Meadow, Crystal Caves, Sky Castle) × 3 short levels, plus a simple boss at the end of each world. Lives are shared or a respawn bubble (no game-over frustration for kids). Kids Mode: bottomless pits bounce you back. Original bright, major-key theme per world. Online: same pattern as dirt.js.

### Tiki Trail (done)
`public/games/tiki.js` (~2500 lines), built on hop.js (same tile map, `moveBody`, shared camera, bubbles, snapshot pattern, bot).
- **Hero:** an original island kid (topknot, headband and shorts in the player colour, grass skirt, shell necklace). Demo bots are Koa and Lani. Story: Big Bongo ran off with the island **Sunstone**.
- **Controls:** D-pad runs (hold to sprint), FIRE jumps (hold = higher), **DOWN+FIRE throws the stone axe** (max 2 in the air each). Hold UP on a **vine** to climb, FIRE leaps off. Touch button says JUMP.
- **Energy:** drains over time (Normal 2.1/s, Pro 2.8, Kids 1.0 with a floor so it never runs out). Fruit refills it (apple/banana 4, grapes 6, pineapple 15, melon 45). Empty = faint. Hits cost 30 energy on Normal, 12 on Kids, a life on Pro. No drain in boss arenas. Goal gate gives energy × 20 bonus. **Trip stones** slow you and cost a little energy; **campfires** hurt.
- **Eggs:** crack by touch or axe. Spot colour hints the contents: blue = **skateboard** (fast, rolls on, smashes trip stones, takes one hit), orange = **sun charm** (8 s invincible, own music), green = **melon**.
- **Enemies:** snails, bees (dive at you on Normal/Pro), frogs, rolling rocks (from `R` spawners, jump over or bounce on top, axes clink off), lava blobs hopping out of volcano pits.
- **Owner's extras, all in:** parallax (far/mid/near layers per island plus a fast foreground at the bottom edge), boss one-liners via `A.toast` on host and guests ("Big Bongo rises from the lava!"), **Tiki Tower** (land on a partner who is standing still for a big launch, can reach the treetops), **Fruit Frenzy** (3 fruits in one jump = ×2 score, 6 = ×3; fruit arcs over gaps), **secret shortcuts**: cracked boulders (`O`/`k` in the map) take 2 axe hits and hide a cave that warps everyone to the matching exit (`Y`) about a third of the level ahead (+2000, checkpoint moves there); jungle **canopy** chunks have a vine up to a fruit-filled treetop path above the harder ground route.
- **Levels:** 1 Coconut Cove (Sunny Shore, Tidepool Trail, Coral Cliffs, boss **Captain Kelp**: lagoon octopus lobs coconuts, then flops on the beach to rest), 2 Jungle Drums (Banana Grove, Vine Valley, Waterfall Way, boss **Queen Buzzbelle**: calls bees, dives and gets her stinger stuck), 3 Mount Ember (Ashen Path, Magma Steps, Lava Rapids, boss **Big Bongo**: stone tiki, drums down rocks, spits fireballs, hops, then rests). Bosses take axe hits only while exposed/resting; stomping a resting boss = 2 hits. Kids 6 hits, Normal 9, Pro 12.
- **Music:** steel-drum themes per island + boss, charm and ending themes (all original, in tiki.js).
- **Online:** host runs everything; map changes (fruit eaten, boulders, crumbling rock) go as mods like Hop Hero. Tested host + guest to boss and clear, guest sees the boss toast.
- **Tests (25 Sep):** bot runs of all 12 areas finish in god mode and on Kids (no lives lost); 2P runs; Tiki Tower; bubble and pop-back; phone viewport with touch; file://; online host + guest; other games load with zero errors. The bot is weak on rafts/lifts/Kelp on Normal (it loses lives there); that's the bot, not the levels.

> **Settled (Hop Hero):** D-pad runs (hold to sprint), **Fire = jump (hold = higher)**, **Down + Fire = throw** (Hop Hero: sparks with the Zap Flower; Tiki Trail: the axe). Use exactly this in Tiki Trail. `hop.js` has the platformer physics (moveBody, coyote time, jump buffer, corner correction), the shared camera, bubbles and a test bot to reuse.

> Controls note: there's only one action button. For platformers use **Fire = jump** and **Up or Down+Fire = throw/special**, or an auto-throw. Settle it early and keep it the same in every platformer.

---

## 7. Testing (do this before every push)

Chromium and Playwright are installed in Claude's workspace (`/opt/pw-browsers`; don't run `playwright install`). Local servers:
```bash
cd server && npm install && npx wrangler dev --port 8787 --inspector-port 9331 &   # rooms
sleep 15 && cd .. && server/node_modules/.bin/wrangler pages dev --port 8788 &    # site + /rooms
curl localhost:8788/rooms/TEST                                                    # {"code":"TEST",...}
```
What has been tested for each game: solo run to the end, 2P and 3–4P split screen, Kids Mode, phone viewport with touch, online host + guest in two browser contexts, opening from file://, and **zero console errors**. Also check the other games still work. For quick single-page checks, `python3 -m http.server 8090` in `public/` is enough.

---

## 8. Lessons and bugs already fixed (don't bring them back)

- **Short taps lost:** a phone tap shorter than one frame registered nothing. Fixed with `touchLatch` (fire/pause stay pressed until the next poll). Remote inputs use edge counters for the same reason.
- `setPointerCapture` throws "No active pointer" on some devices. It's wrapped in try/catch.
- Cloudflare redirects `/tank.html?room=X` to `/tank?room=X` (308). URL checks and tests must accept both forms.
- Service worker: always bump `VERSION` or TVs keep the old game. `/rooms/` is never cached.
- Dirt Dash: races were too short (15 s), so there are now 2 laps with longer flat sections (~40 s). PERFECT fired on tiny bumps, so it now needs ≥0.38 s in the air. Speed clamp bug fixed with separate speed-up/slow-down branches. CPU riders still racing at the time limit show "still riding", not "did not finish". The lobby needs the demo race running behind it (`startDemo()`).
- Dirt Dash: riders who came up short on a gap got stuck forever against the landing ramp's wall (crash, respawn at its foot, crash again). Now a **rescue hop** (`startHop`) carries them over in ~1 s: on hitting a wall, after a crash at the foot of one, and a safety net if a rider sits stalled with the gas on for 1.2 s. Stress-tested: every track × lane × speed finishes. Also added: overtake callouts ("2ND!"), final-lap jingle, turbo/PERFECT speed lines, crash screen shake, finish confetti, long names fitted in the HUD.
- A merge popped up an editor in CMD and the owner got stuck (see section 3). A rejected push ("non-fast-forward") means GitHub has a commit the PC doesn't: `git pull origin main --no-edit`, then push again.
- **Local test servers:** starting `wrangler dev` and `wrangler pages dev` at the same moment makes them fight over the inspector port ("Address already in use") and `/rooms` returns "Worker not found". Start the rooms Worker with `--inspector-port 9331`, wait ~15 s, then start Pages. Never `pkill -f wrangler` from Claude's shell (it kills the shell itself); find the PIDs with `ps` and kill those.
- **Test scripts:** in the lobby, FIRE toggles ready on and off, so a test presses it **once** after joining, then waits for the countdown. A guest holding FIRE can't also "press" it: release first, then press. `window.__dirtDebug` / `window.__hopDebug` expose internals for stress tests (e.g. every track × lane × speed must finish).
- Test scripts live in Claude's scratchpad, which is wiped between sessions. Rewrite them from these notes as needed.
- Tiki Trail: `window.__tiki` is the state, `window.__tikiDebug` has `loadLevel`, `newGame`, `sim`, `step`, `hurt`, `crackBoulder`, `reachGoal`… Set `p.bot = true` on players to autopilot, `G.god = true` for no damage, `G.botSecret = true` to make bots axe boulders, `G.log = []` to record hurts/falls. Don't put a trip stone or campfire right before a gap, raft or lift (the jump over it lands in the gap).
- Blacktop Brawl: `window.__brawlDebug` has `newRace`, `sim`, `tumble`, `giveItem`, `finishRace`; setting `window.__brawl.bot = true` makes human riders drive themselves (CPU logic) for stress runs. Stress run 25 Sep: every route × difficulty, 1 and 4 riders, all finish in 37–50 s. Fixed from the original upload: CPU skill speed was never applied (Kids rivals raced at full speed), `Sound.play('finish')` isn't a built-in (now `'win'`), DOWN+FIRE also changed lane, hops had no height, traffic used `Math.random` (guests saw different cars), lane lines were drawn one lane off, near traffic was drawn behind far riders, no drop-in.
- A different chat can't see this repo unless the owner uploads files. Anything built elsewhere gets reviewed here before it goes in.
- A game's HUD should not show keyboard hints ("PAUSE: ESC") on touch devices.
- Long player names need `fitText()` in the HUD.

---

## 9. Working style the owner wants

- **Saving tokens:** the owner uses Sonnet for planning, fixes and git help, and switches to **Opus 5.5 (Medium)** for building. Tell him before starting a big build so he can switch models.
- Claude codes, tests and (if possible) pushes. The owner does as few manual steps as possible. When he must act, give **exact copy-paste CMD commands** (he's new to git on Windows).
- Short, plain replies. No long recaps.
- "Make it amazing": polished look, great music, juicy effects, kid-friendly.
