# xRetro — Project Handover

Last updated: 26 Sep 2026 (Fizz Lab added; Big Top, family features + Auto-resolution fix are live). Read this whole file before touching code. Where this file and the code disagree, **the code wins**. Read `public/games/dirt.js` and `public/shared/core.js` before writing a new game.

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

**Current state (26 Sep, later):** GitHub `main` = `6bf7f87` (Add Big Top, family features, Auto-resolution fix; `sw.js` v11). Next push: **Fizz Lab**, sent as `fizz-lab.zip`: `public/fizz.html`, `public/games/fizz.js`, the index card (compact medal counter for games with more than 10 stages), `sw.js` → **`xretro-v12`**, one helper in `core.js` (`Input.holdTouch`), README row, this file. Tested locally, not yet pushed by the owner. Next `VERSION`: **`xretro-v13`**. Before building, `git fetch && git reset --hard origin/main` and check the real hash.
Earlier note (26 Sep): GitHub `main` was `1d9307d` (Add Strike Force, `sw.js` v10); then **Big Top** went out as `big-top.zip`: `public/bigtop.html`, `public/games/bigtop.js`, the shared family features and the Auto-resolution fix in `public/shared/core.js` (+ `core.css`, one line in `net.js`), the index card (+ medal row), `sw.js` → **`xretro-v11`**, README row, this file (now live as `6bf7f87`).
Older note (25 Sep): GitHub `main` was `c69770f` (Add Tiki Trail, `sw.js` v7). Tank, Dirt Dash, Hop Hero, Blacktop Brawl and Tiki Trail are live. `.gitignore` ignores `*.bundle` and `*.zip`. Old merge commits have ugly messages; ignore them.
Next push (sent as `yeti-volt.zip`, which replaces `mighty-yeti.zip`): **Mighty Yeti** (`public/yeti.html`, `public/games/yeti.js`, `core.js` music additions: bansuri flute lead, sitar pluck lead, tanpura drone, tabla/dhol/manjira drums, pitch glide in `Sound.tone`) and **Volt GP** (`public/volt.html`, `public/games/volt.js`), both index cards (the Apex GP 'coming soon' card is replaced by Volt GP), `sw.js` → **`xretro-v9`**, README rows, this file. Tested locally, not yet pushed by the owner.

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
Exports: `Store, Settings, saveSettings, Sound, Music, THEMES, Names, Input, Touch, Menu, Lobby, TextEntry, Display, run, toast, keepAwake, toggleFullscreen, goLandscape, registerOffline, settingsItems, shareInvite, el, esc, dom{menuDom,lobbyDom}, Celebrate, Medals, Awards, PLAYER_COLORS, QUALITY_LABELS`
- `Sound.play(name)`. Built-in sounds: move select confirm back join online leave pause type shoot brick steel armor explode boom spawn powerAppear powerUp lifeUp freeze bomb stageStart stageClear gameOver win countdown go. Games can add their own (dirt.js has `SX`).
- `Music.play(song)`, `stop()`, `duck(on)`, `intensity(n)`. A song is a data object (bpm, melody, bass, arp, drums). See `THEMES.menu`, `TANK_THEME`, `DIRT_THEME`. Every game gets its **own original theme**. Optional extras (ignored by older songs): `steel: true` plays the lead as a steel drum, `bass: 'calypso'`, drum letters `b` high bongo, `l` low bongo, `c` shaker (Tiki Trail). Added for Mighty Yeti: `flute: true` (bansuri: breathy sine that slides into notes), `sitar: true` (buzzy pluck with a bend on long notes), `drone: true` (+ optional `droneRoot`) for a soft tanpura Pa–Sa cycle, drum letters `d` tabla dha, `t` tabla tin, `n` na, `g` dhol boom, `j` manjira bells. `Sound.tone` takes `glide` (seconds) and `glideFrom` (ratio) for slides. Added for Big Top (big-band circus): `brass: true` (trumpet: sawtooth whose filter opens as the note starts, lip bend into long notes), `calliope: true` (steam organ with a fast wobbly vibrato), `bass: 'tuba'` (oom-pah: tuba on beats 1 and 3, soft band chord on 2 and 4), drum letters `r` snare roll and `z` kick + cymbal crash. `Sound.tone` also takes `lp`/`lpFrom` (low-pass, opening over 70 ms), `vibRate`, `vibDepth`. New built-in sounds: `best`, `medal`.
- `Input.tapTouch(btn)` presses an on-screen button for 90 ms; `Input.holdTouch(btn, ms)` (added for Fizz Lab) holds it down for a while. Games use them to turn gestures into ordinary button presses, so they work online too.
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
3. `public/sw.js`: add both files to `CORE`, bump `VERSION` (next: `xretro-v13`)
4. Add the **family features** (section 5a)
5. Test (section 7), then commit/push
6. Update the README game list and this file

### 5a. Family features standard (every new game; add to older games whenever they're upgraded)
Owner's decision (26 Sep): these go into **every new game**, and into each older game **whenever we next touch it**. Build them once as shared helpers in `core.js` (e.g. `Arcade.Celebrate`, `Arcade.Medals`, `Arcade.Awards`) so each game only calls them.
1. **Celebration moments:** confetti burst + a short jingle + a "NEW BEST!" banner when a player beats a personal best (fastest clear, highest score, best lap…). Saved per game, stage and difficulty via `Store`. Shows on host and guests online.
2. **Stage medals:** Gold / Silver / Bronze per stage (per difficulty; the best one counts), from clear time, score or rank thresholds set per game. Saved in `Store` under a shared key (e.g. `arcade.medals.<gameId>`), shown on the game's stage-select/title screen **and on its index card** (small medal row or "7/18 ★" counter drawn by `index.html` reading the same key; works offline and on file://). Kids Mode earns medals too (easier thresholds) so young kids can collect.
3. **End-of-game awards:** a results screen with 3–4 fun, kind awards per player (e.g. Sharpshooter, Untouchable, Most Helpful, Speed Demon) and team stats. Every player should get at least one award.

**Shared helpers (built 26 Sep with Big Top, in core.js; copy Big Top's `results()` / `endingMenu()` as the example):**
- `A.Celebrate.record(game, key, value, lower)` saves a personal best under `arcade.best.<game>.<key>` and returns `{ isNew, prev }` (a first clear counts). `A.Celebrate.show({ title: 'NEW BEST!', sub: 'Act 2 in 1:04.2', colors })` = full-screen confetti canvas + banner + `best` jingle, drawn above menus. On an online host it's broadcast as `{t:'cel'}` and net.js shows it on every guest automatically (no game code needed).
- `A.Medals.pick(value, { gold, silver, bronze? }, lower)` → `'gold'|'silver'|'bronze'|null`; `A.Medals.award(game, stage, diff, medal)` saves under `arcade.medals.<game>` = `{ stage: { diff: medal } }` and returns `{ improved }`; `get(game, stage[, diff])` (best over difficulties), `summary(game, n)`, `html(medal)` (small CSS disc for menus), `draw(ctx, x, y, r, medal)` (for canvas stage boards). **Index card:** add `data-medals="<game>:<stage1>,<stage2>,…"` and an empty `<span class="medal-row" hidden></span>` in the card body; index.html fills in one disc per stage + "n/6" (works offline and on file://). With more than 10 stages (Fizz Lab has 34) it shows a gold/silver/bronze count + "n/34" instead.
- `A.Awards.pick(players, defs, { max: 3 })` with defs `{ title, stat: p => n, min, all, low }` (in priority order); every player gets at least one (their strongest relative stat, or a kind fallback: Team Spirit, Crowd Pleaser, Never Gave Up, Best Bow). `A.Awards.html(result, teamLine)` gives menu HTML (amber award chips).

Status (checked 26 Sep): **Big Top** ✅ has all three (NEW BEST on act times and top score, medals per act on its act board and index card, awards per act and for the whole run). **Fizz Lab** ✅ has all three (NEW BEST for top score, highest level, fastest Lab Puzzle and longest chain; medals per puzzle and per 5 levels on its title-screen medal board, the Level/Puzzle menu items and its index card; awards on every results screen). Awards also exist in **Blacktop Brawl** and **Strike Force** (their own code, not the shared helper yet). **Still missing:**
- **Awards:** Tank, Dirt Dash, Hop Hero, Tiki Trail, Mighty Yeti, Volt GP (Volt has a podium, not awards).
- **Medals + NEW BEST celebration:** Tank, Dirt Dash, Hop Hero, Blacktop Brawl, Tiki Trail, Mighty Yeti, Volt GP, Strike Force (several already save best times, which can feed `Celebrate.record`).
Update this list as games get upgraded.

### 5b. Fixed (26 Sep, with Big Top): TV looked pixelated on "Auto" resolution
Cause: `Display.track` lowered the render scale when the first loading frames were slow, and only raised it again below 13 ms a frame, which a 60 Hz TV (16.7 ms) never reaches. Fix (only `Display` in core.js; every game gets it): the first 3 s after load (1.5 s after a resize) are ignored; slow = average over 22 ms for 1.5 s → scale ×0.8 (floor **0.5**, was 0.35); "keeping up" = under 18.5 ms for 3 s → scale +0.1; a scale that proved too slow isn't retried until a full minute of smooth frames; changing Resolution in Settings resets all of it. Tested in Chromium at 1920×1080: slow first 2.5 s then 60 fps → stays 1920×1080; a page slowed to ~20 fps the whole time → drops to 0.5 (960×540); slow for 8 s then fast → drops to 0.64, climbs back gradually. Big Top and Hop Hero at 1920×1080 stay 1920×1080.

---

## 6. Games: status and plan

| # | Name | Inspired by | Status |
|---|---|---|---|
| 1 | **Tank** | Battle City | ✅ Live. 1–4 players, co-op + battle, online, drop-in, destructible terrain, power-ups |
| 2 | **Dirt Dash** | Excitebike | ✅ Live. 1–4 riders + CPU rivals, 4 lanes, 5 tracks (Dusty Hills, Canyon Leap, Monsoon Mud, Night Rally, Himalaya Pro), 2 laps, engine heat, PERFECT landings, rescue hop over walls, overtake callouts, Kids/Normal/Pro, split screen, online |
| 3 | **Hop Hero** | Super Mario Bros | ✅ Live 25 Sep (owner confirmed). 1–4 co-op, shared camera, bubbles, 3 worlds × 3 levels + 3 bosses (Thornback, Crag Crab, Baron Grumble), Kids/Normal/Pro, drop-in, online, ending |
| 3b | **Blacktop Brawl** | Road Rash | ✅ Reviewed, reworked and tested 25 Sep; sent as `blacktop-brawl.zip`, waiting for the owner's push. 1–4 riders + CPU rivals, 4 routes, cartoon bonks, gift-box items, hops/ramps, drop-in, Kids/Normal/Pro, split screen, online |
| 4 | **Tiki Trail** | Adventure Island | ✅ Live 25 Sep (`c69770f`). 1–2 co-op, shared camera, energy bar + fruit, stone axe, skateboard, secret caves, 3 islands × 3 areas + 3 bosses, Kids/Normal/Pro, drop-in, online |
| 4b | **Mighty Yeti** | Super Mario Bros (Humble Yeti brand game) | ✅ Built and tested 25 Sep; sent as `mighty-yeti.zip`, waiting for the owner's push. 1–4 co-op, shared camera, 6 Indian regions × 2 levels + 3 bosses, Mighty Meter, kindness snowballs, friends who follow and help, Kids/Normal/Pro, drop-in, online |
| 5 | **Big Top** | Circus Charlie | ✅ Live 26 Sep (`6bf7f87`). 1–4 co-op circus platformer, shared camera, 6 acts + 3 bosses, hoops, trampolines, cannons, trapezes, tightropes, balloons, hidden bells + bonus tent, medals/awards/NEW BEST, Kids/Normal/Pro, drop-in, online |
| 6 | **Strike Force** | Contra | ✅ Built and tested 26 Sep; sent as `strike-force.zip`, waiting for the owner's push. 1–4 co-op run-and-gun, 6 stages + 6 bosses, 4 weapons, Stomper mech, SOS revive, Kids/Normal/Pro, drop-in, online |
| 8 | **Fizz Lab** | Dr. Mario | ✅ Built and tested 26 Sep; sent as `fizz-lab.zip`, waiting for the owner's push. Falling-capsule puzzle in a candy lab: 1–4 boards side by side, Versus (best of 3, or vs Fizzbot), Big Beaker co-op, Solo levels 1–20, Daily Lab Puzzle, 30 puzzles with par, rainbow capsules, fizz bombs, hold, 3 songs, Kids Mode, online, drop-in |
| 7 | **Volt GP** (was "Apex GP") | F1 Race | ✅ Built and tested 25 Sep; in `yeti-volt.zip`, waiting for the owner's push. Electric Grand Prix, behind-the-car 3D, 3 lanes, 8 tracks, 1–4 + CPU rivals, quick race or championship, online |

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

### Mighty Yeti: A Wild Quest Across India (done)
A **Humble Yeti** brand game for kids 7–12 (humbleyeti.com, tagline "mighty goodness for little explorers", brand based in Pune; millet pancake mixes, no maida, refined sugar or palm oil). Lives inside xRetro for testing; may move to a Humble Yeti domain later. `public/games/yeti.js` (~3,350 lines), built on tiki.js/hop.js (tile map, `moveBody`, shared camera, bubbles, snapshot pattern, bot).
- **Owner's decisions:** name "Mighty Yeti: A Wild Quest Across India". Mascot **Himu**, a cool explorer yeti (owner's reference: helmet + ski goggles + big white beard). Original drawing: helmet in the player colour with white/gold stripes, big orange goggles with snowy peaks mirrored in the lens, shadowed face with a button nose, huge pointed beard and moustache, trail boots, Humble Yeti green backpack with a bedroll; drawn with a dark outline via `withOutline()` (offscreen canvas). **Every player is a yeti** (helmet colour = player colour). Friends: **Ishu** red panda (catches you once over a pit), **Ganu** monkey (grabs fruit out of reach), **Rudra** rhino (charges through junk blockades); they follow and help in solo and multiplayer. **Durgi** and **Krish** are the demo yetis. English only.
- **No product placement beyond one pancake stall per region**; no ingredient pickups (products still in development). Goodies are fruit, water drops, coconut water, stars. Villains the owner approved: Sugar Blobs, Fizz Bubbles, Maida Phantoms, Palm Oil Slicks, Candy Bots, Sloth Cloud. Yucks are never hurt: a snowball or bop "cheers them up" into happy critters.
- **Kangchenjunga, not Everest** (owner: keep the whole quest in India). Regions in order: Kerala Backwaters, Odisha Coast, Ellora Caves, Rajasthan Forts, Assam Tea Hills, Sikkim · Kangchenjunga. Each has a fun fact on the intro card and its own music (chenda/flute, bansuri, drone, dholak/sitar, dhol, bansuri+bells). No enemies on temples or monuments.
- **Controls** (settled platformer scheme): D-pad runs (hold to sprint), FIRE jumps (hold = higher), **DOWN+FIRE throws a kindness snowball**, UP climbs ropes. Touch button says JUMP.
- **Mighty Meter:** goodies fill it: Tiny → Yeti → Mighty (smashes cracked blocks, opens Mighty routes) → Glide (hold FIRE in the air). A hit drops one stage; Kids never go below Tiny. Kindness badges (free a bird, water a sapling, 2 per level) unlock the Explorer route. Basecamp tents = checkpoints. Three routes per level (ground, Explorer, Mighty) plus secret caves.
- **Levels:** 1-1 Coconut Canals, 1-2 Houseboat Bend, 2-1 Turtle Tides, 2-2 Sun Wheel Shore, 3-1 Carved Caverns, 3-2 Lantern Halls (dark, lantern glow), **3-B Echo Hall: Bat Swarm**, 4-1 Golden Dunes, 4-2 Fort Gate Run (sandstorm wind), **4-B Dust Devil Dunes: Sandstorm Djinn** (maida dust), 5-1 Tea Terraces, 5-2 Rhino River, 6-1 Prayer Flag Pass, 6-2 Eagle Ridge (ice, eagle carry), **6-B Summit of Kangchenjunga: Sugar Cube King** (drums down falling cubes, flings cubes, hops across with a landing shadow, then sits down tired). Bosses take snowballs only while resting; stomping a resting boss = 2 hits.
- **Ending:** Humble Yeti flag at the summit, lines ("Kindness made you mighty", "The biggest hearts stay humble", "Share. Help. Say thank you.", "Give someone a big Yeti hug today!"), then a menu with the message, team stats and a text link to humbleyeti.com for grown-ups. No data collected.
- **Logo:** redrawn in code (`drawLogo`, `miniMark`) from the owner's logo. Brand colours are in `HY` at the top of yeti.js (#242021, #328F42, #F5E20A, #B0C936, #7BB33B, #C5DF8A, #F5981F, #E95824, #FFCC00).
- **Debug:** `window.__yeti` is the state, `window.__yetiDebug` has `loadLevel`, `newGame`, `sim`, `reachGoal`, `drawYeti`, `yetiSprite`… Set `p.bot = true`, `G.god = true`, `G.botSecret = true`, `G.log = []` like Tiki.
- **Tests (25 Sep):** bot runs of all 15 stages finish on Normal (god and no-god), Kids 2P, Pro, and 4P; phone viewport with touch lobby → play; file://; online host + guest (guest moves, both reach the clear screen); other games and the index load with zero errors. The 4P HUD puts names above the meters so nothing overlaps.

### Strike Force (done)
Owner's brief (26 Sep): Contra, 2-player co-op run-and-gun, 1 fire button + aim with the D-pad, "make it fun, exciting, engaging", Kids Mode required. Built for 1–4 players (tuned for 2). `public/games/strike.js` (~3,300 lines). Shared camera that only moves forward (like Contra), tile map + `moveBody` in the Hop Hero style, menus/lobby/online/drop-in copied from hop.js.
- **Story:** General Rustbolt's Scrap Army stole the **Sky Crystal**. All enemies are robots and burst into bolts and springs (no blood); the ending says they're recycled into playground rides. Demo bots: Blaze and Echo.
- **Controls (settled for this game):** LEFT/RIGHT run, **UP = jump** (hold it to jump higher, and holding UP aims up; UP+RIGHT aims diagonally), **DOWN** crouches on the ground (DOWN+direction walks aiming diagonally down; in the air DOWN aims down), **FIRE shoots, hold for rapid fire**. Double-tap DOWN drops through a ledge. In water, DOWN dives under bullets. Jumps are a Contra-style somersault with a smaller hitbox. Touch: stick up = jump, button says FIRE, and touch players get a little aim assist (touch sticks are 4-way).
- **Weapons:** Blaster (default), **Fan Shot** (3/5-way), **Beam** (pierces), **Seekers** (homing); grabbing the same one again powers it up to level 3. Items: **Shield** (10 s, own music), **Nova Blast** (clears the screen, hurts bosses), **Repair** (+1 heart). From flying **supply pods** and crates. **Stomper mech** (stages 4 and 6): walk into it, 6 armour, big cannon, stomps small bots, ejects when broken.
- **Health and lives:** hearts per hero (Kids 5, Normal 3, Pro 1). Knocked out = "warp out" and drop back in from the sky with 2.6 s of invincibility; team lives pool (Normal 4 +2 per extra player, Pro 3 +1, Kids infinite), extra life every 20,000. No lives left but a partner still standing = **SOS bubble** until the partner touches you. Everyone out = Continue (checkpoint beacon, or straight back to the boss) or restart.
- **Kids:** 5 hearts, enemy bullets 68% speed and half as often, weaker robots and bosses (55% HP), fewer runners, pits bounce you back, keep weapons when knocked out, aim assist, no game over. Pro: 1 heart, faster bullets, lose weapons.
- **Stages** (each with its own original theme): 1 Jungle Outpost (crumbling bridge over water, bunkers; boss **Gatekeeper** fortress wall with 2 cannons and a core behind a shutter), 2 Thunder Falls (vertical climb up a waterfall, falling rocks, jetbots; boss **Boulder Bot**: throws bouncing boulders, belly furnace opens when it roars), 3 Frostbite Base (ice, tanks, igloo bunkers; boss **Snowplow**: shoot the cockpit, hop onto the ledge when it charges, jump the ice wave), 4 Scrap Factory (ceiling, conveyors, crushers, zap floors, breakable walls, mech; boss **Mega Claw**: stand beside the slammed claw and shoot up at the glowing core), 5 Skyway Chase (jet-board shoot-'em-up, timeline of waves in `SKY_WAVES`; boss **Thunderhull** gunship), 6 Iron Citadel (everything; boss **General Rustbolt**: fist slams with a warning shadow, eye laser low = jump / high = crouch, then his chest core opens: shoot it from underneath or from the top ledge). One secret **gold gear** per stage (saved, shown on the title). Level pieces: see the legend above `CH` in strike.js; the waterfall map `FALLS_MAP` was generated from a ledge plan (ledges 3 rows apart, every ledge has a reachable next one; the generator/validator lived in the scratchpad).
- **Extras:** combo multiplier (×2 to ×5), WARNING banner + siren before each boss, boss one-liners as toasts on host and guests, stage-clear ranks (S/A/B/C from knock-outs and hit %), awards on the results screen (Bot Buster, Sharpshooter, Pod Popper, Untouchable), best time per stage and difficulty.
- **Online:** host runs everything; snapshot = players, on-screen robots, player and enemy bullets (all interpolated by id), map mods (crumbled bridge, broken walls), boss state (`ph`, `v[]`, fist states). Boss one-liners go in the snapshot (`sy`/`sx`). Tested host + guest: guest moves and shoots, sees the boss, both reach the results menu.
- **Debug:** `window.__strike` = state, `window.__strikeDebug` has `newGame`, `loadLevel`, `step`, `sim`, `bossStart`, `startClear`, `ending`, `hurt`, `giveItem`, `BOSS`, `SKY_WAVES`… Set `p.bot = true` on players and `G.god = true`. `G.check = { boss: true }; loadLevel(lv, true)` jumps to a boss.
- **Tests (26 Sep):** bot runs of all 6 stages finish on Kids/Normal/Pro with 1, 2 and 4 players (god mode; ~30–100 s each for bots), non-god runs exercise knock-outs, SOS revive, game over and Continue; keyboard lobby → play → pause; phone viewport with touch (stick jump + FIRE); drop-in; file://; online host + guest; all other games and the index load with zero errors.

### Big Top (done)
Owner's brief (26 Sep): original circus platformer, 1–4 co-op, shared camera, settled platformer controls, 6 acts each with its own big-band chiptune, fun extras, Kids Mode, and the family features (5a) built as shared helpers. `public/games/bigtop.js` (~2,800 lines), built on hop.js (tile map, `moveBody`, shared camera, bubbles, snapshot pattern, bot).
- **Story:** a prankster wind scattered the circus; collect **star tokens** to raise the Big Top again. Heroes are original kid acrobats (tiny top hat and leotard in the player colour, star on the chest). Demo bots: Tumble and Twirl.
- **Controls:** D-pad runs (hold to sprint), FIRE jumps (hold = higher), **Down+FIRE drops through a plank or rope**. Trampoline: **hold FIRE as you land = SUPER BOUNCE**. Walk into a **cannon**, FIRE launches (auto after 2.6 s, 1.1 s on Kids). Jump to catch a **trapeze**, FIRE lets go (you leap in the direction you hold, or forward). Touch a **balloon cluster** to float up (steer left/right, FIRE lets go, ~6 s). Tightrope: walking speed only, balance pole, the rope sags; wind pushes harder there. Touch button says JUMP.
- **Hearts and lives:** 3 hearts (Pro 2); hits honk a clown horn. Lives: Normal 5, Pro 3, Kids infinite. Solo out of hearts = lose a life (restart at the flag); with friends = bubble. Popcorn = +1 heart, Golden Ticket = 1UP, Star Cape = 9 s invincible (own music). Crates: `?` token crate, `M` prize crate.
- **Hazards (all cartoon):** cheeky monkeys (bop them), rolling barrels (from barrel wagons; bounce on them for points), bouncy balls (bounce off the top), fire pots, **hoops**: jump through the middle for HOOP! (+200) or RING OF FIRE! (+500); fire hoops hurt on the rim; `j` hoops swing. Crumbling pedestals fall 0.6 s after you land (they grow back after 3.5 s, so nobody gets stuck at a wide pit; bonking one from below knocks it loose).
- **Acts** (each ~35–45 s for the bot, with its own theme): 1 Grand Parade (hoops, wagons, planks, trampoline, balloon ride), 2 Ring of Fire (fire hoops, pots, crumbling pedestals) + boss **Leo the Lion** (prowls, roars ground waves to hop over, leaps with a landing shadow, then sits dizzy: stomp him), 3 High Wire (tightropes, monkeys on the rope, balls, wind gusts with a WIND COMING! warning), 4 Cannon Alley (cannons with star-token trails over big gaps, trampoline walls) + boss **Colonel Kaboom** (a marching cannon: fires bouncy cannonballs you can hop on, then overheats and pops his hat: stomp him), 5 Midnight Trapeze (dark tent: glow around each acrobat, sweeping spotlights, chained trapezes), 6 Big Tent Finale (everything, wind section) + final boss **the Prankster** in a hot-air balloon (drops cream pies, rubber chickens and banana peels — peels make you slip, no damage — then his balloon springs a leak and sinks low: bonk the basket; a super bounce or a jump from the planks can bonk him from below too). Bosses: Kids 3 hits, Normal 4, Pro 5; boss one-liners go to guests as toasts. **Kids: a boss keeps its damage when you lose a life**, Colonel Kaboom fires fewer balls.
- **Bells and bonus tent:** 3 hidden bells per act (top-left of the start, high planks after a super bounce, above crumbling pedestals, on a cannon perch, above a trapeze, balloon rides…). Ring all 3 and the bonus tent before the podium opens: 12 s of stars and trampolines, then you come back out after the tent (bonus time doesn't count for medals). Bells found are saved per act (`arcade.bigtop.bells`) and shown on the act board.
- **Finish:** land on the **podium** (its sides are solid, jump on top); the middle = PERFECT LANDING +5000.
- **Kids Mode:** fire can't hurt (hoops say WARM!, pots give HOT FEET! bounces), slower balls and monkeys, safety nets under pits (bounce back), no game over, easier medal times (×1.6).
- **Family features:** act time medals (`MEDAL_TIMES`: gold ≈ 1.25× and silver ≈ 1.8× the bot's time, bronze = clear; tune after family play), NEW BEST on act time (per difficulty) and top score (ending), awards per act and for the whole run (Untouchable, Bell Ringer, Star Catcher, Ring Leader, Human Cannonball, Sky Swinger, Bounce Boss, Monkey Business, Balloonist). Title screen: an act board (medal + bells per act, the Big Top rises as medals are won) drawn when there's room beside the menu; "Start at" shows the best medal.
- **Online:** host runs everything; snapshot = players (flags for rope/hang/cannon/balloon/flight), on-screen entities (hoops, trapezes with pivot and angle, boss), wind, bells, bonus timer, boss line (`sy`/`sx`), map mods (tokens, crates, crumbled pedestals). Tested host + guest: guest moves and jumps, sees the boss and its line, results menu with awards and NEW BEST on the guest, guest picks "Next act".
- **Debug:** `window.__bigtop` = state, `window.__bigtopDebug` has `newGame`, `startAct`, `loadLevel`, `step`, `sim`, `results`, `ending`, `enterBonus`, `predictFlight`, `LEVELS`, `CH`, `MEDAL_TIMES`… Set `p.bot = true`, `G.god = true`, `G.log = []` (records hurts/falls). The bot predicts trapeze flights (bars swing on a clock) before jumping or letting go, and short-hops onto nearby pedestals.
- **Tests (26 Sep):** bot runs of all 6 acts finish on Kids (1P and 4P), Normal (god) and Normal 1P/2P/4P for every run level (the solo Normal bot sometimes loses to Leo/Kaboom: that's the bot's dodging, humans can hop the waves and cannonballs); trapeze release timings brute-forced (bar-to-bar and bar-to-ledge windows exist for every trapeze); all 18 bells placed on a reachable route (checked from the jump/bounce/trapeze numbers; the cannon perch by simulation — worth a human play-through); bonus tent entry/exit; keyboard lobby → play → pause; drop-in; phone viewport with touch (lobby button, JUMP); file://; online host + guest; all other games and the index load with zero errors over http and file://.

### Fizz Lab (done)
Owner's brief (26 Sep): original falling-capsule puzzle (Dr. Mario-style) in a candy-coloured science lab, 1–4 boards side by side on one TV, online, drop-in, Versus / Big Beaker co-op / Solo, fun extras, 3 original songs chosen in the menu, Kids Mode, family features (5a). `public/games/fizz.js` (~2,050 lines). Menus/lobby/online copied from bigtop.js; no tile map (its own beaker logic).
- **Story/art:** kid scientists (lab coat, goggles in the player colour) zap grumpy **Gloomies**: Berry (pink, round, leafy sprout), Lemon (yellow, lemon-shaped), Sky (blue droplet with little horns). No doctors, viruses or pills anywhere: capsules are "fizz capsules". Gloomies dance to the music (the beat is read from the sequencer), look worried (brows up, sweat drop, shaking) when they're one away from popping or nearly surrounded, and smile as they pop. Solo shows a flask with the three big Gloomies (a colour that's gone turns into a twinkling star). Demo bots: Pip and Dot.
- **Controls (settled for this game):** LEFT/RIGHT move (auto-repeat), DOWN soft drop, **double-tap DOWN hard drop**, FIRE rotates, UP rotates the other way, **hold UP (0.36 s) = hold slot**. A ghost shows where it lands (Kids: big, bright ghost). Touch: stick + **ROTATE** button, **swipe down = drop** (sent as a double-tap DOWN), **swipe up = hold** (`Input.holdTouch('up')`), so both work online.
- **Rules:** 8×16 beaker; 4+ of one colour in a row/column pop (halves and Gloomies); loose halves fall and chain (FIZZ x2, x3… with climbing chimes and callouts; DOUBLE FIZZ! for two lines at once). **Rainbow capsule** (both halves wild), **fizz bomb** (single bubble, pops a 3×3 where it lands; the ghost shows the blast square). Next preview + hold slot. Speed Low/Med/Hi, speeds up every 10 capsules and a little per level. Power-ups menu item: Off = classic (no rainbow, bomb or hold).
- **Levels:** Gloomies = (level+1)×4 (like the classic), but never more than 72% of the allowed rows, and the top rows stay free (levels 1–12: 6 rows, 13–15: 5, 16–20: 4). The classic 84-in-13-rows at level 20 was a wall (the bot died in 5 capsules), so 16–20 plateau at ~69 Gloomies and get harder through speed. Never 3 of a colour in a row, never the same colour 2 apart.
- **Modes:** **Solo** (levels 1–20, results after each level, awards at levels 5/10/15/20 and game over). **Versus** 1–4 (one board each, same Gloomies and capsules for everyone; 2+ lines in one lock, including chains, send that many loose halves (max 4) to the **leader** = fewest Gloomies left; first to clear or last one standing wins a star; best of 3 = first to 2 stars; 1 player gets **Fizzbot**, the CPU, whose speed/mistakes follow the Speed setting; drop-ins join the next round and replace Fizzbot). **Big Beaker** co-op 1–4: one shared beaker 8 + 4 per extra player wide (12/16/20), each player spawns in their own zone, falling capsules block each other, each glows in its owner's colour with a name tag; drop-ins join straight away. **Daily Lab** 1–4: seed = today's date (`fizzlab-daily-YYYY-MM-DD`, level-6 layout, power-ups always on), one counted try per name per day (later tries are "practice"), family times for today saved in `arcade.fizz.daily`. **Puzzles**: 30 beakers in `PUZZLES`, fixed capsule order, limit par+5 (Kids par+8), puzzles unlock 3 ahead of the best solved.
- **Puzzles:** 1–8 hand-made teaching boards (vertical, horizontal, two-for-one, fill the gap, rainbow bridge, bomb, first chain, double up); 9–30 picked from a generator (near-complete lines + blockers) and all 30 **checked by `solvePuzzle`** (breadth-first over straight drops): par 1 ×7, 2 ×9, 3 ×10, 4 ×4. Humans can sometimes beat par by sliding under overhangs (the solver only drops straight).
- **Kids Mode:** 1.7× slower drops, lock delay 0.55 s, big ghost, rainbow capsules ~2× as often, fewer Gloomies (2 + level×2, bottom 8 rows), **no game over** (when the beaker fills, the top 4 rows fizz away: FIZZ AWAY!), easier medals.
- **Family features:** NEW BEST (`Celebrate.record`) for top score and highest level (solo, per Kids/Normal), fastest Lab Puzzle (`daily`, lower) plus "fastest in the family today", longest chain (recorded from x2, banner from x3). Medals: `pz1`…`pz30` (gold = par, Kids par+1; silver = par+2) and `lv5`/`lv10`/`lv15`/`lv20` per band (capsules used ÷ (Gloomies + 6) over the band's levels played this run: gold ≤ 1.3, silver ≤ 1.9, Kids ×1.5; the bot scores ~1.9, tune after family play). Shown on the title-screen **Lab Medals** board, in the Level/Puzzle menu values and on the index card. Awards: Chain Champion, Best Helper (co-op), Gloomy Buster, Fizz Flinger (versus), Tidy Scientist (fewest halves left), Speedy Dropper, Rainbow Ranger, Bomb Squad, Combo Chemist, Steady Hands + team stats. More… → Family bests shows all records and today's puzzle times.
- **Music:** Fizz (140 bpm, bright C major), Chill (92 bpm, maj7 chords, walking bass), Fever (168 bpm, A minor, fast arps); the title plays the chosen one (like the classic's menu); results jingle `SX.results`; chain chimes `chime1..7`.
- **Online:** host runs everything; snapshot = each beaker as a short string (1 char per cell, only sent when it changes, full every 90 snaps or when someone joins) + popping cells + each player's capsule/next/hold/state. Effects travel as small events (`fx`) and are expanded into particles on every screen. No interpolation (grid game). Tested: versus host + guest (guest moves, rotates, hard-drops; results menu; guest picks Rematch), co-op guest dropping in mid-level and seeing the NEW BEST banner + awards.
- **Debug:** `window.__fizz` = state, `window.__fizzDebug` has `newGame`, `startLevel`, `step`, `sim`, `topOut`, `solvePuzzle`, `PUZZLES`, `evalBoard`, `BOTW` (bot weights)… Set `p.bot = true` on players and `G.botFast = true` (instant moves) for stress runs: `for(...) __fizzDebug.step(1/60)`.
- **The bot:** tries every reachable spot (rotate, slide, drop), simulates pops/chains, scores the result (`evalBoard`: Gloomies left, how many more halves each Gloomy's column needs, holes, height, the top 3 rows near the spawn) and looks one capsule ahead for the best 7. ~2.1 capsules per Gloomy.
- **Tests (26 Sep):** bot clears 20/20 seeded solo runs at levels 3/8/14/17/20 (Med); solo levels 1–20 on Med/Hi, Kids, Classic; Versus 1P (vs Fizzbot), 2P, 3P Kids, 4P to the match results; Big Beaker 1/2/3 (Kids)/4P to Lab clean!; Daily 1P and 3P (practice run detected); puzzles 1, 7, 21; Kids overflow → FIZZ AWAY and play continues, Normal overflow → game over menu; drop-in (versus next round, co-op straight away); pause menu; phone viewport (tap to join, ROTATE, swipe down drops, swipe up holds); file://; online host + guest; index card; all other games and the index load with zero errors over http and file://.

### Volt GP (done)
Owner's brief (25 Sep, from his phone): F1 Race, but **3 lanes**, **electric cars**, **regen when slowing/braking** that can be spent to **boost/overtake**, more F1 and Formula E ideas, at least 6 famous tracks including **Singapore at night**. Owner chose: behind-the-car view, name **Volt GP**, race length picked in the menu. `public/games/volt.js` (~1,600 lines). New pseudo-3D road renderer (segment projection, drawn back to front so tunnels, bridges, walls, sprites and cars layer correctly); menus/lobby/online/drop-in copied from brawl.js.
- **Controls:** the car accelerates by itself. LEFT/RIGHT = lane (3 lanes), DOWN = brake **and regen**, **hold FIRE = BOOST** (uses battery), UP = "box this lap" (pit request). Touch button says BOOST.
- **Battery:** drains slowly with speed (scaled so a race of any length is possible), boost drains fast, braking above 20% speed recharges 10%/s, rolling downhill recharges a little. Empty = limp at 55% speed. Rear light flashes while harvesting (like Formula E). Kids: battery never below 22%.
- **Bends:** each bend pushes the car outward (`PUSH`, `STEER`, tyre grip, rain). Too fast = slide wide + tyre scrub; street tracks (Monaco, Singapore, Hyderabad) have walls: a hard hit on Normal/Pro spins you. Kids get **brake assist** (auto-brakes for bends, still regens).
- **Formula extras:** Attack Mode (pink pad in the left lane once per lap: 8 s of +7% and half drain), DRS (on DRS straights within ~1 s of the car ahead, from lap 2), slipstream tow, pit stop (UP, stay in the right lane at the end of the lap, press FIRE when the needle is green: fresh tyres + Pit Boost +25%; the crew always releases you after ~4 s), tyre wear (8%/lap, shown on Medium/Long), safety car (after a spin, 35% chance; or once at random in Medium/Long races; field bunches up, no passing, then GREEN FLAG), 5 red start lights, fastest lap (purple, +1 championship point), podium with confetti.
- **Tracks** (real place names, original layouts approximated from sections in `TRACKS`): Monaco (harbour, tunnel under a hotel), Singapore (night, floodlights, skyline, observation wheel), Silverstone (rain possible), Monza (fastest), Suzuka (figure-of-eight: passes under a bridge, then over it), Spa (big valley dip and climb, rain possible), Buddh (India, sunset, long back straight), Hyderabad (India, night street race by a lake). Ad boards include HUMBLE YETI and XRETRO. Music: VOLT theme, NIGHT theme (Singapore), INDIA theme with sitar and tabla (Buddh, Hyderabad), PODIUM theme.
- **Modes:** Quick race or Championship (8 rounds in track order, points 25-18-15-12-10-8-6-4 + fastest lap). Lengths: Short 3 laps (~90 s), Medium 5, Long 8. Weather: Auto/Dry/Wet. Difficulty Kids/Normal/Pro. Rivals: Zap, Volty, Jolt, Flux, Dynamo, Ohmi, Coil (colours kept clear of the four player colours; no rival shares a fun-name). Humans start mid-grid. Rivals ease off when far ahead of every human.
- **Online:** host runs everything; snapshot ~8 cars × 22 fields (~900 bytes). Guests rebuild the track from its index. Tested host + guest: guest lane changes and boost reach the host, both reach the podium.
- **Debug:** `window.__volt` = state, `window.__voltDebug` has `newRace`, `startChampionship`, `sim`, `finishRace`, `TK()`, `safetyCar`, `spin`… Set `G.bot = true` to make human cars drive themselves (CPU logic, also pits).
- **Tests (25 Sep):** bot races on all 8 tracks × Short/Medium/Long, Normal/Pro/Kids, 1/2/4 players finish with zero errors (Short ≈ 80–105 s); non-braking driver crashes at Monaco and loses (bends matter); pit stops, safety car, championship round flow, podium/results, phone touch with BOOST held, file://, online host + guest, all other games load.

> **Settled (Strike Force):** UP jumps (hold = higher and aim up), FIRE shoots (hold = rapid), DOWN crouches/aims down. Run-and-guns use this, platformers keep the Hop Hero scheme below.

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
