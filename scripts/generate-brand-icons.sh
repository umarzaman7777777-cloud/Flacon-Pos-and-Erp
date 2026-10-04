#!/usr/bin/env bash
set -e

SOURCE_LOGO="public/falcon-logo-transparent.png"
if [ ! -f "$SOURCE_LOGO" ]; then
  echo "Source logo not found at $SOURCE_LOGO"
  exit 1
fi

echo "=== Generating 100% Transparent Brand Icons (Zero Black Box) ==="

# 1. GitHub, PWA and Web Master Logos with pure transparent background
convert "$SOURCE_LOGO" \
  -resize "512x512" \
  -background none \
  -gravity center \
  -extent "512x512" \
  public/falcon-exact-logo.png

convert "$SOURCE_LOGO" \
  -resize "512x512" \
  -background none \
  -gravity center \
  -extent "512x512" \
  public/falcon-logo.png

convert "$SOURCE_LOGO" \
  -resize "512x512" \
  -background none \
  -gravity center \
  -extent "512x512" \
  public/logo.png

convert "$SOURCE_LOGO" \
  -resize "512x512" \
  -background none \
  -gravity center \
  -extent "512x512" \
  public/pwa-512x512.png

convert "$SOURCE_LOGO" \
  -resize "512x512" \
  -background none \
  -gravity center \
  -extent "512x512" \
  public/pwa-maskable-512x512.png

# 192x192 icons with pure transparent background
convert "$SOURCE_LOGO" \
  -resize "192x192" \
  -background none \
  -gravity center \
  -extent "192x192" \
  public/logo-192.png

convert "$SOURCE_LOGO" \
  -resize "192x192" \
  -background none \
  -gravity center \
  -extent "192x192" \
  public/pwa-192x192.png

# 180x180 Apple touch icon
convert "$SOURCE_LOGO" \
  -resize "180x180" \
  -background none \
  -gravity center \
  -extent "180x180" \
  public/apple-touch-icon.png

# 64x64 and 32x32 Favicons
convert "$SOURCE_LOGO" \
  -resize "64x64" \
  -background none \
  -gravity center \
  -extent "64x64" \
  public/favicon.png

convert "$SOURCE_LOGO" \
  -resize "32x32" \
  -background none \
  -gravity center \
  -extent "32x32" \
  public/favicon.ico

echo "✓ Web & PWA icons generated with 100% transparent backgrounds."

echo "=== Generating Android APK Launcher Icons (Transparent) ==="

declare -A DENSITIES=(
  ["mdpi"]="48:108"
  ["hdpi"]="72:162"
  ["xhdpi"]="96:216"
  ["xxhdpi"]="144:324"
  ["xxxhdpi"]="192:432"
)

for d in "${!DENSITIES[@]}"; do
  IFS=":" read -r size fg_size <<< "${DENSITIES[$d]}"
  out_dir="android/app/src/main/res/mipmap-${d}"
  mkdir -p "$out_dir"

  # 1. Standard launcher icon (pure transparent background, zero black block)
  convert "$SOURCE_LOGO" \
    -resize "${size}x${size}" \
    -background none \
    -gravity center \
    -extent "${size}x${size}" \
    "${out_dir}/ic_launcher.png"

  # 2. Round launcher icon (pure transparent background, zero black block)
  convert "$SOURCE_LOGO" \
    -resize "${size}x${size}" \
    -background none \
    -gravity center \
    -extent "${size}x${size}" \
    "${out_dir}/ic_launcher_round.png"

  # 3. Adaptive foreground icon (pure transparent background, zero black block)
  convert "$SOURCE_LOGO" \
    -resize "${fg_size}x${fg_size}" \
    -background none \
    -gravity center \
    -extent "${fg_size}x${fg_size}" \
    "${out_dir}/ic_launcher_foreground.png"

  echo "✓ Generated ${d}: transparent launcher (${size}x${size}), round (${size}x${size}), fg (${fg_size}x${fg_size})"
done

echo "=== Configuring Android Adaptive Icons ==="

mkdir -p android/app/src/main/res/values
mkdir -p android/app/src/main/res/mipmap-anydpi-v26

cat << 'EOF' > android/app/src/main/res/values/ic_launcher_background.xml
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">@android:color/transparent</color>
</resources>
EOF

cat << 'EOF' > android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
EOF

cat << 'EOF' > android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
EOF

echo "✓ Android icons configured with 100% transparent backgrounds."
