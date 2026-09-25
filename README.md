# xRetro

Arcade classics, reimagined for the whole family. **Play at https://YOUR-CLOUDFLARE-PAGE**

- Up to 4 players on one screen: Xbox/PlayStation controllers over Bluetooth, keyboard, TV remote or touch.
- **Online rooms:** one device hosts and gets a 4-letter code; family anywhere joins with the code or an invite link. Any mix of TV, laptop and phones, and several people can share one screen inside an online game.
- Drop-in: someone new picks up a controller mid-game and presses FIRE to join.
- Original music and sound effects, all generated in code. No audio files, works offline.

Plain HTML + JavaScript. No build step.

```
public/                   the website (Cloudflare Pages serves this folder)
  index.html              game picker + "Join a friend's room"
  tank.html, games/tank.js
  dirt.html, games/dirt.js
  hop.html, games/hop.js    Hop Hero: co-op platformer, 3 worlds x 3 levels + bosses
  shared/core.js          engine: controllers, sound, music, menus, names, lobby, resolution
  shared/net.js           online rooms: host/guest, invite links, reconnect, smooth motion
  shared/core.css, shared/fonts.css, sw.js, manifest.webmanifest, icons/
functions/rooms/[code].js YOUR-CLOUDFLARE-PAGE/rooms/ABCD  →  the room server
server/                   the room server: a Cloudflare Worker + Durable Object ("xretro-rooms")
wrangler.toml             Pages config (links the site to the room server)
```

## How deploys work

Pushing to `main` on GitHub deploys everything automatically:

- **Site** → Cloudflare Pages project `xretro` (connected to this repo).
- **Room server** → Cloudflare Worker `xretro-rooms`, built from the `server/` folder (Workers Builds, connected to this repo).

### One-time setup for online rooms (about 2 minutes)

The site is already connected. The room server needs connecting once:

1. Cloudflare dashboard → **Workers & Pages → Create → Import a repository** → pick `fangchu-in/xretro`.
2. Settings on the next screen:
   - Project name: **xretro-rooms**
   - **Root directory: `server`** (under Advanced settings)
   - Build command: *(leave empty)* · Deploy command: `npx wrangler deploy`
3. Click **Deploy**. Durable Objects are included in the free plan.
4. Go to the **xretro** Pages project → Deployments → **Retry deployment** on the latest one, so the site picks up the room server.

Check it: https://YOUR-CLOUDFLARE-PAGE/rooms/TEST should show `{"code":"TEST","open":false,...}`.
If it says "Online rooms are not switched on yet", step 4 hasn't run.

## Playing

- **TV:** open https://YOUR-CLOUDFLARE-PAGE in the TV's browser app, or connect a laptop by HDMI. Pair controllers to whichever device runs the browser.
- **Laptop / phone:** just open the link. Phones: hold sideways; on-screen stick + FIRE appear. "Add to Home Screen" makes it an app.
- **Online:** Tank → Play online → Host. Share the code or the invite link (WhatsApp works). Friends open the link, or use "Join a friend's room" on the home page.
- **Offline:** copy the `public` folder to a USB stick and open `index.html`. Everything except online rooms works.

## Adding a game

1. Copy `tank.html` → `mygame.html`, point it at `games/mygame.js`, load `shared/core.js` and `shared/net.js`.
2. Build on `window.Arcade`: `Lobby.open`, `Input.get(player.source)`, `Sound.play`, `Music.play(song)`, `Menu.open`, `new Display(canvas, 384, 216)`.
3. Online: the host sends a snapshot of the game ~30 times a second with `Net.broadcast`; guests draw it. Mark end-of-round menus `shared: true` so everyone sees them. See `games/tank.js` (search "Online").
4. Add a card in `index.html`, add the files to `CORE` in `sw.js`, bump `VERSION`, push.

## Local development

```bash
cd server && npm install && npx wrangler dev          # room server on :8787
cd .. && server/node_modules/.bin/wrangler pages dev   # site + /rooms on :8788
```

## Credits

Fonts: Silkscreen and Chakra Petch, SIL Open Font License 1.1. All game art, levels, music and sounds are original and generated in code.
