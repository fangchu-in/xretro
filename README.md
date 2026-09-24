# Family Arcade

Retro-style games for the family, playable on a TV (via Raspberry Pi or laptop), a Windows laptop, and phones.
Up to 4 players with Xbox/PlayStation controllers, keyboard, TV remote or touch.

Everything is plain HTML + JavaScript. There is no build step and nothing to install.

```
public/                 ← the whole website (this is what gets hosted or copied to a USB stick)
  index.html            ← game picker
  tank.html             ← Tank
  games/tank.js         ← Tank game code
  shared/core.js        ← shared engine: controllers, sound, menus, "press A to join", resolution
  shared/core.css       ← shared look
  shared/fonts.css      ← fonts embedded, so it works offline
  sw.js, manifest.webmanifest, icons/   ← lets phones "install" it and play offline
tools/pi-kiosk.sh       ← start the arcade full screen on a Raspberry Pi
wrangler.jsonc          ← Cloudflare config
```

## Play it right now

- **Windows laptop:** open `public/index.html` in Chrome, Edge or Firefox. Plug the laptop into the TV by HDMI for the big screen.
- **USB stick:** copy the whole `public` folder, not just one file. It works offline from a stick or SD card.
- **Phone:** use the online link (below). Hold the phone sideways. On-screen stick + FIRE button appear automatically.

## Put it online (GitHub + Cloudflare, free)

1. Create a GitHub repository called `family-arcade` and upload this folder (GitHub Desktop, or drag the files onto the GitHub web page).
2. In the Cloudflare dashboard: **Workers & Pages → Create → Pages → Connect to Git**, pick the repository.
   - Framework preset: **None**
   - Build command: *(leave empty)*
   - Build output directory: **public**
3. Deploy. You get a link like `https://family-arcade.pages.dev`. Every time you push to GitHub, the site updates in about a minute.

(If you'd rather use a Cloudflare Worker instead of Pages, `wrangler.jsonc` is already set up: `npx wrangler deploy`.)

After the first visit, the site keeps working offline (the service worker caches it). On Android, Chrome's menu → **Add to Home screen** gives it an app icon and full-screen mode.

## Raspberry Pi as a games console

The Pi Zero 2W will run it, but it only has 512 MB of memory, so expect it to lower the resolution by itself (Settings → Resolution → Auto). A Raspberry Pi 4 or 5 runs it smoothly. A laptop over HDMI is the best free option.

1. Install **Raspberry Pi OS (Bookworm)** with desktop, using Raspberry Pi Imager.
2. **Set the TV output to 1080p, not 4K.** The TV upscales 1080p cleanly and the games are drawn as sharp shapes, so it still looks crisp.
   Add this to the end of the single line in `/boot/firmware/cmdline.txt`:
   `video=HDMI-A-1:1920x1080@60`
3. **Sound over HDMI:** `sudo raspi-config` → System Options → Audio → HDMI. Then turn the TV volume up and set the in-game volume in Settings.
4. **Pair the controllers:** Bluetooth icon → Add device, hold the controller's pair button. (Update Xbox controllers' firmware from an Xbox or the Windows "Xbox Accessories" app first if they won't pair.)
5. Copy `tools/pi-kiosk.sh` to the Pi, make it runnable (`chmod +x pi-kiosk.sh`) and start it at boot by adding this line to `~/.config/labwc/autostart`:
   `/home/pi/pi-kiosk.sh https://family-arcade.pages.dev &`
   For the offline copy on the SD card, pass `file:///home/pi/family-arcade/public/index.html` instead.

## Sony Bravia TV

Recent Bravias run Google TV / Android TV. The built-in USB player can't open `.html` files, so a USB stick in the TV won't work.
You can try installing a browser app from the Play Store (for example "TV Bro") and opening the online link. Whether it passes Bluetooth controller input through to web pages depends on the app, so test it before relying on it.

## Adding the next game

1. Copy `tank.html` to e.g. `circus.html` and point it at `games/circus.js`.
2. Build the game using `window.Arcade` from `shared/core.js`:
   - `Arcade.Lobby.open({...})` gives you the "press A to join" screen and returns the players.
   - `Arcade.Input.get(player.source)` gives `up/down/left/right/fire/dir` for that player's controller, keyboard or touch.
   - `Arcade.Sound.play('explode')` etc. for sound effects; `Arcade.Menu.open({...})` for controller-friendly menus.
   - `new Arcade.Display(canvas, 384, 216)` handles sharp scaling from phone to 4K and drops resolution on slow devices.
3. Add a card for it in `index.html`, add its files to `CORE` in `sw.js`, and bump `VERSION`.

## Coming next: online multiplayer

Plan: a small Cloudflare Worker with a Durable Object acting as a "room". One device hosts the game; others join with a 4-letter room code from anywhere.
Each remote player's controller input is sent to the host, and the host sends back the game state. The game code already treats every player as an input source, so a remote player is just one more source.

## Credits

Fonts: Silkscreen and Chakra Petch, SIL Open Font License 1.1 (`public/shared/fonts/`).
All game art, levels and sounds are original and generated in code.
