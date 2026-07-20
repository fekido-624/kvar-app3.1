const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const srcSvg = path.join(__dirname, 'pwa-icon-source.svg');
const outDir = path.join(__dirname, '..', 'public', 'icons');

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const maskableSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#7b2d3a"/>
  <g transform="translate(256 256) scale(0.7)">
    <path d="M0 -140 L120 -96 L120 -8 C120 78 66 150 0 176 C-66 150 -120 78 -120 -8 L-120 -96 Z"
          fill="none" stroke="#fff7f8" stroke-width="22" stroke-linejoin="round" stroke-linecap="round"/>
    <path d="M-56 -6 L-16 34 L64 -58"
          fill="none" stroke="#fff7f8" stroke-width="24" stroke-linejoin="round" stroke-linecap="round"/>
  </g>
</svg>`;

async function main() {
  const svgBuffer = fs.readFileSync(srcSvg);

  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(outDir, 'icon-192.png'));
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(outDir, 'icon-512.png'));
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(outDir, 'apple-touch-icon.png'));
  await sharp(Buffer.from(maskableSvg)).resize(512, 512).png().toFile(path.join(outDir, 'maskable-icon-512.png'));
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(outDir, 'favicon-32.png'));

  console.log('PWA icons generated in', outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
