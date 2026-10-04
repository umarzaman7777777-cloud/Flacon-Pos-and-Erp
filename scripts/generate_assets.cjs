#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const SOURCE_SVG = path.resolve(__dirname, '../public/falcon-theme-rod-logo.svg');

if (!fs.existsSync(SOURCE_SVG)) {
  console.error('[AssetGen] Error: Source SVG logo not found at', SOURCE_SVG);
  process.exit(1);
}

console.log('[AssetGen] Generating Brand Assets from Exact In-App Falcon Logo using High-Res Resvg Engine...');

const rawSvg = fs.readFileSync(SOURCE_SVG, 'utf-8');
const match = rawSvg.match(/<svg[^>]*>([\s\S]*)<\/svg>/i);
const innerSvg = match ? match[1] : '';

const RES_DIR = path.resolve(__dirname, '../android/app/src/main/res');

// 1. Android Adaptive Background Color: #0b0f19 (Brand Obsidian Slate)
const VALUES_DIR = path.join(RES_DIR, 'values');
fs.mkdirSync(VALUES_DIR, { recursive: true });
const BG_COLOR_XML = `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0b0f19</color>
</resources>
`;
fs.writeFileSync(path.join(VALUES_DIR, 'ic_launcher_background.xml'), BG_COLOR_XML);
console.log('[AssetGen] ✓ Created values/ic_launcher_background.xml (#0b0f19)');

// 2. Android Adaptive Icon XML (API 26+)
const ANYDPI_DIR = path.join(RES_DIR, 'mipmap-anydpi-v26');
fs.mkdirSync(ANYDPI_DIR, { recursive: true });
const ADAPTIVE_ICON_XML = `<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
`;
fs.writeFileSync(path.join(ANYDPI_DIR, 'ic_launcher.xml'), ADAPTIVE_ICON_XML);
fs.writeFileSync(path.join(ANYDPI_DIR, 'ic_launcher_round.xml'), ADAPTIVE_ICON_XML);
console.log('[AssetGen] ✓ Created mipmap-anydpi-v26/ic_launcher.xml & ic_launcher_round.xml');

// 3. Android Mipmap densities
const DENSITIES = [
  { name: 'mdpi', size: 48, fgSize: 108 },
  { name: 'hdpi', size: 72, fgSize: 162 },
  { name: 'xhdpi', size: 96, fgSize: 216 },
  { name: 'xxhdpi', size: 144, fgSize: 324 },
  { name: 'xxxhdpi', size: 192, fgSize: 432 },
];

for (const d of DENSITIES) {
  const dir = path.join(RES_DIR, `mipmap-${d.name}`);
  fs.mkdirSync(dir, { recursive: true });

  // A. Adaptive Foreground: Falcon centered with safe margins for Android adaptive masks
  const fgSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-180 -140 980 740" width="${d.fgSize}" height="${d.fgSize}">
    ${innerSvg}
  </svg>`;
  const fgPng = new Resvg(fgSvg, { fitTo: { mode: 'width', value: d.fgSize } }).render().asPng();
  fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), fgPng);

  // B. Standard Launcher Icon: Squircle Obsidian background with Falcon Logo
  const launcherSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 620" width="${d.size}" height="${d.size}">
    <rect width="620" height="620" rx="140" fill="#0b0f19" />
    <g transform="translate(55, 120) scale(0.82)">
      ${innerSvg}
    </g>
  </svg>`;
  const launcherPng = new Resvg(launcherSvg, { fitTo: { mode: 'width', value: d.size } }).render().asPng();
  fs.writeFileSync(path.join(dir, 'ic_launcher.png'), launcherPng);

  // C. Round Launcher Icon: Circular Obsidian background with Falcon Logo
  const roundSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 620" width="${d.size}" height="${d.size}">
    <circle cx="310" cy="310" r="310" fill="#0b0f19" />
    <g transform="translate(65, 128) scale(0.79)">
      ${innerSvg}
    </g>
  </svg>`;
  const roundPng = new Resvg(roundSvg, { fitTo: { mode: 'width', value: d.size } }).render().asPng();
  fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), roundPng);

  console.log(`[AssetGen] ✓ Density ${d.name}: generated launcher (${d.size}x${d.size}), round (${d.size}x${d.size}), foreground (${d.fgSize}x${d.fgSize})`);
}

// 4. Web & PWA Assets in public/
const PUBLIC_DIR = path.resolve(__dirname, '../public');

// Master 512x512 transparent PNG
const transparent512Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 460" width="512" height="512">
  ${innerSvg}
</svg>`;
const pwa512Transparent = new Resvg(transparent512Svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
fs.writeFileSync(path.join(PUBLIC_DIR, 'falcon-logo-transparent.png'), pwa512Transparent);

// Master 512x512 standard PWA icon: Full bleed #0b0f19 square (NO transparent rounded corners)
const standard512Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 620" width="512" height="512">
  <rect width="620" height="620" fill="#0b0f19" />
  <g transform="translate(55, 120) scale(0.82)">
    ${innerSvg}
  </g>
</svg>`;
const standard512Png = new Resvg(standard512Svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
fs.writeFileSync(path.join(PUBLIC_DIR, 'logo.png'), standard512Png);
fs.writeFileSync(path.join(PUBLIC_DIR, 'falcon-logo.png'), standard512Png);
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-512x512.png'), standard512Png);

// Dedicated Maskable 512x512 PWA Icon:
// Full bleed #0b0f19 background with the logo contained safely within the central 80% circle
// (Android safe zone: radius 204px inside 512x512; here scale 0.70 with translation keeps all elements >= 15% from any edge)
const maskable512Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 620" width="512" height="512">
  <rect width="620" height="620" fill="#0b0f19" />
  <g transform="translate(93, 150) scale(0.70)">
    ${innerSvg}
  </g>
</svg>`;
const maskable512Png = new Resvg(maskable512Svg, { fitTo: { mode: 'width', value: 512 } }).render().asPng();
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-maskable-512x512.png'), maskable512Png);

// 192x192 Standard PWA Icon: Full bleed #0b0f19 square
const standard192Svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 620" width="192" height="192">
  <rect width="620" height="620" fill="#0b0f19" />
  <g transform="translate(55, 120) scale(0.82)">
    ${innerSvg}
  </g>
</svg>`;
const standard192Png = new Resvg(standard192Svg, { fitTo: { mode: 'width', value: 192 } }).render().asPng();
fs.writeFileSync(path.join(PUBLIC_DIR, 'logo-192.png'), standard192Png);
fs.writeFileSync(path.join(PUBLIC_DIR, 'pwa-192x192.png'), standard192Png);

// Apple touch icon 180x180 (iOS Safari requires solid background without transparent rounded corners)
const appleTouchSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 620 620" width="180" height="180">
  <rect width="620" height="620" fill="#0b0f19" />
  <g transform="translate(68, 130) scale(0.78)">
    ${innerSvg}
  </g>
</svg>`;
const appleTouchPng = new Resvg(appleTouchSvg, { fitTo: { mode: 'width', value: 180 } }).render().asPng();
fs.writeFileSync(path.join(PUBLIC_DIR, 'apple-touch-icon.png'), appleTouchPng);

// Favicon 64x64 & 32x32
const fav64Png = new Resvg(standard512Svg, { fitTo: { mode: 'width', value: 64 } }).render().asPng();
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.png'), fav64Png);
const fav32Png = new Resvg(standard512Svg, { fitTo: { mode: 'width', value: 32 } }).render().asPng();
fs.writeFileSync(path.join(PUBLIC_DIR, 'favicon.ico'), fav32Png);

console.log('[AssetGen] === All Android & Web Brand Assets Successfully Synchronized with Exact In-App Falcon Logo! ===');
