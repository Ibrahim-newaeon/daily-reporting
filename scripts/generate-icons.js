const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [72, 96, 128, 144, 152, 192, 384, 512];
const outputDir = path.join(__dirname, '../public/icons');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create a simple icon SVG with a chart/analytics theme
const createIconSvg = (size) => {
  const padding = Math.floor(size * 0.15);
  const innerSize = size - padding * 2;
  const barWidth = Math.floor(innerSize / 5);
  const barGap = Math.floor(barWidth * 0.3);

  // Bar heights as percentages
  const bars = [0.4, 0.7, 0.5, 0.9, 0.6];

  let barsSvg = '';
  bars.forEach((height, i) => {
    const barHeight = Math.floor(innerSize * height);
    const x = padding + i * (barWidth + barGap);
    const y = padding + innerSize - barHeight;
    barsSvg += `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="${Math.floor(barWidth * 0.2)}" fill="white"/>`;
  });

  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:#3b82f6;stop-opacity:1" />
          <stop offset="100%" style="stop-color:#1d4ed8;stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" rx="${Math.floor(size * 0.2)}" fill="url(#grad)"/>
      ${barsSvg}
    </svg>
  `;
};

async function generateIcons() {
  console.log('Generating PWA icons...');

  for (const size of sizes) {
    const svg = createIconSvg(size);
    const outputPath = path.join(outputDir, `icon-${size}x${size}.png`);

    await sharp(Buffer.from(svg))
      .png()
      .toFile(outputPath);

    console.log(`Generated: icon-${size}x${size}.png`);
  }

  // Also create favicon.ico (using 32x32 for simplicity)
  const faviconSvg = createIconSvg(32);
  await sharp(Buffer.from(faviconSvg))
    .png()
    .toFile(path.join(__dirname, '../public/favicon.ico'));
  console.log('Generated: favicon.ico');

  console.log('All icons generated successfully!');
}

generateIcons().catch(console.error);
