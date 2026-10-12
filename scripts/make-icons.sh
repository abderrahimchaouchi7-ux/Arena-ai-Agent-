#!/usr/bin/env bash
# Regenerates every Android launcher icon density plus the PWA icons from
# branding/app-icon.png. Requires ImageMagick. Run after changing the artwork.
set -euo pipefail

SRC="${1:-branding/app-icon.png}"
[ -f "$SRC" ] || { echo "missing $SRC" >&2; exit 1; }

declare -A DENSITIES=(
  [mdpi]=48 [hdpi]=72 [xhdpi]=96 [xxhdpi]=144 [xxxhdpi]=192
)

for density in "${!DENSITIES[@]}"; do
  size=${DENSITIES[$density]}
  dir="android/app/src/main/res/mipmap-$density"
  mkdir -p "$dir"
  convert "$SRC" -resize "${size}x${size}" -strip "$dir/ic_launcher.png"
  convert "$SRC" -resize "${size}x${size}" -strip "$dir/ic_launcher_round.png"
  # Adaptive-icon foreground needs the safe-zone padding, so scale to 66%.
  fg=$(( size * 108 / 48 ))
  convert "$SRC" -resize "$(( size * 2 ))x$(( size * 2 ))" \
    -gravity center -background none -extent "${fg}x${fg}" -strip \
    "$dir/ic_launcher_foreground.png"
  echo "wrote $dir ($size px, foreground $fg px)"
done

# PWA assets. The filenames must match index.html and the manifest block in
# vite.config.ts exactly, or the install prompt loses its icons.
mkdir -p public
convert "$SRC" -resize 192x192 -strip public/pwa-192x192.png
convert "$SRC" -resize 512x512 -strip public/pwa-512x512.png
# Maskable icons need a generous safe zone: the outer 20% may be cropped.
convert "$SRC" -resize 320x320 -gravity center -background '#0F1720' \
  -extent 512x512 -strip public/pwa-maskable-512x512.png
convert "$SRC" -resize 180x180 -strip public/apple-touch-icon.png
echo "wrote public/ PWA icons"
