# xRetro

Arcade classics, reimagined for the whole family. **Play free at https://xretro.pages.dev**

- Up to 4 players on one screen: Xbox/PlayStation controllers over Bluetooth, keyboard, TV remote or touch.
- **Online rooms:** one device hosts and gets a 4-letter code; family anywhere joins with the code or an invite link. Any mix of TV, laptop and phones, and several people can share one screen inside an online game.
- Drop-in: someone new picks up a controller mid-game and presses FIRE to join.
- Original music and sound effects, all generated in code. No audio files, works offline.

Plain HTML + JavaScript. No build step, no frameworks, no npm packages in the game itself.

## Games

| Game | Style | Players |
|---|---|---|
| **Tank** | Battle City-style tank battles, co-op or versus, destructible walls, power-ups | 1–4 |
| **Dirt Dash** | Excitebike-style motocross: 5 tracks, lanes, jumps, engine heat, PERFECT landings | 1–4 + CPU rivals |
| **Hop Hero** | Mario-style co-op platformer: 3 worlds × 3 levels + bosses, shared camera, bubbles | 1–4 |
| **Blacktop Brawl** | Road Rash-style highway racing with cartoon bonks: 4 routes, traffic, gift-box items, hops and ramps | 1–4 + CPU rivals |
| **Tiki Trail** | Adventure Island-style island run: energy bar and fruit, stone axe, skateboards, secret caves, 3 islands × 3 areas + bosses | 1–2 |
| **Mighty Yeti** | A Humble Yeti game. Mario-style quest across India with Himu the explorer yeti: Kerala to Kangchenjunga, kindness snowballs, Mighty Meter, friends who help, 6 regions × 2 levels + 3 bosses | 1–4 |
| **Volt GP** | F1 Race-style electric Grand Prix, behind-the-car 3D on 3 lanes: battery with regen braking and BOOST, Attack Mode, DRS, slipstream, pit stops, safety car, start lights, 8 tracks (Monaco, Singapore at night, Silverstone, Monza, Suzuka, Spa, Buddh, Hyderabad), quick race or championship | 1–4 + CPU rivals |
| **Strike Force** | Contra-style run-and-gun against General Rustbolt's robot army: UP jumps and aims up, 8-way aim, Fan Shot / Beam / Seeker weapons that power up, Stomper mech, co-op SOS revive, 6 stages (jungle, waterfall climb, frozen base, scrap factory, jet-board sky chase, Iron Citadel) + 6 bosses | 1–4 |
| **Big Top** | Circus Charlie-style circus platformer: leap through (fire) hoops, trampolines with SUPER BOUNCE, cannon launches, trapezes, tightropes in the wind, balloon rides, 3 hidden bells per act open a bonus tent, 6 acts + 3 bosses (Leo the Lion, Colonel Kaboom, the Prankster in his hot-air balloon), medals per act | 1–4 |
| **Fizz Lab** | Dr. Mario-style falling-capsule puzzle in a candy science lab: line up 4 of a colour to pop the grumpy Gloomies, chains (FIZZ x3!), rainbow capsules, fizz bombs, ghost + next + hold. Solo levels 1–20 (Low/Med/Hi), Versus best of 3 (combos fling halves at the leader, or play Fizzbot), Big Beaker co-op in one wide shared beaker, a Daily Lab Puzzle for the whole family and 30 puzzle beakers with par. 3 music tracks (Fizz, Chill, Fever) | 1–4 |

More on the way. Every game has a Kids mode and works online. All characters, levels, art and music are original.

```
public/                   the website (Cloudflare Pages serves this folder)
  index.html              game picker + "Join a friend's room"
  tank.html, games/tank.js
  dirt.html, games/dirt.js
  hop.html, games/hop.js
  brawl.html, games/brawl.js
  tiki.html, games/tiki.js
  yeti.html, games/yeti.js
  volt.html, games/volt.js
  strike.html, games/strike.js
  bigtop.html, games/bigtop.js
  fizz.html, games/fizz.js
  shared/core.js          engine: controllers, sound, music, menus, names, lobby, resolution
  shared/net.js           online rooms: host/guest, invite links, reconnect, smooth motion
  shared/core.css, shared/fonts.css, sw.js, manifest.webmanifest, icons/
functions/rooms/[code].js xretro.pages.dev/rooms/ABCD  →  the room server
server/                   the room server: a Cloudflare Worker + Durable Object ("xretro-rooms")
wrangler.toml             Pages config (links the site to the room server)
tools/pi-kiosk.sh         optional: run the arcade full-screen on a Raspberry Pi
```

## Playing

- **TV:** open https://xretro.pages.dev in the TV's browser app, or connect a laptop by HDMI. Pair controllers to whichever device runs the browser.
- **Laptop / phone:** just open the link. Phones: hold sideways; on-screen stick + FIRE appear. "Add to Home Screen" makes it an app.
- **Online:** pick a game → Play online → Host. Share the code or the invite link (WhatsApp works). Friends open the link, or use "Join a friend's room" on the home page.
- **Offline:** copy the `public` folder to a USB stick and open `index.html`. Everything except online rooms works. No server or account needed.

## Want your own copy?

You're welcome to fork this repo and play with it. Please **host your own copy on your own account** rather than pointing at xretro.pages.dev: that site runs on a free plan for one family, and its room server only accepts players from xretro.pages.dev.

- **Just the games, no online rooms:** open `public/index.html` from disk, or put the `public` folder on any static host (GitHub Pages works). Local multiplayer works everywhere.
- **With online rooms (free Cloudflare account):**
  1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick your fork. Project name **xretro-rooms**, **Root directory `server`**, deploy command `npx wrangler deploy`. Durable Objects are included in the free plan.
  2. Create a **Pages** project from the same fork: build output directory `public`, no build command.
  3. Put your own site address in the `okOrigin` check in **both** `functions/rooms/[code].js` and `server/src/index.js` (it only allows `xretro.pages.dev` and localhost).
  4. Retry the latest Pages deployment so it picks up the room server. Check `https://<your-site>/rooms/TEST`: it should return `{"code":"TEST","open":false,...}`.

## Adding a game

1. Copy `dirt.html` → `mygame.html` and point it at `games/mygame.js`.
2. Build on `window.Arcade`: `Lobby.open`, `Input.get(player.source)`, `Sound.play`, `Music.play(song)`, `Menu.open`, `new Display(canvas, 384, 216)`, `run(step, render, display)`.
3. Online: the host sends a snapshot of the game ~30 times a second with `Net.broadcast`; guests draw it. Mark end-of-round menus `shared: true` so everyone sees them. See `games/dirt.js` (search "Online").
4. Add a card in `index.html`, add the files to `CORE` in `sw.js`, and bump `VERSION`.

## Local development

```bash
cd server && npm install && npx wrangler dev --port 8787 --inspector-port 9331   # room server
# wait ~15 s, then in another terminal:
server/node_modules/.bin/wrangler pages dev --port 8788                          # site + /rooms
```

## Credits

Fonts: Silkscreen and Chakra Petch, SIL Open Font License 1.1. All game art, levels, music and sounds are original and generated in code.
