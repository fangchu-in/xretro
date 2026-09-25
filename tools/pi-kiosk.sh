#!/bin/bash
# Starts the arcade full screen on a Raspberry Pi, like a games console.
# Usage:  ./pi-kiosk.sh                       (online copy)
#         ./pi-kiosk.sh file:///home/pi/xretro/public/index.html   (copy on the SD card / USB stick)
URL="${1:-https://xretro.pages.dev}"
BROWSER="$(command -v chromium-browser || command -v chromium)"
exec "$BROWSER" --kiosk --noerrdialogs --disable-infobars \
  --autoplay-policy=no-user-gesture-required \
  --enable-gpu-rasterization --ignore-gpu-blocklist \
  --overscroll-history-navigation=0 --disable-features=Translate \
  --check-for-update-interval=31536000 \
  "$URL"
