const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const outputDir = path.join(__dirname, '../public/screenshots');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Create a dashboard-style screenshot placeholder
const createDashboardSvg = (width, height) => {
  const padding = 20;

  // Header
  const headerHeight = 60;

  // Cards
  const cardHeight = 100;
  const cardGap = 15;

  // Chart area
  const chartHeight = height - headerHeight - cardHeight - padding * 4 - cardGap;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="#f3f4f6"/>

      <!-- Header -->
      <rect x="0" y="0" width="${width}" height="${headerHeight}" fill="#3b82f6"/>
      <text x="${padding}" y="38" fill="white" font-family="system-ui" font-size="20" font-weight="bold">Daily Reports</text>

      <!-- Metric Cards -->
      <g transform="translate(${padding}, ${headerHeight + padding})">
        <rect x="0" y="0" width="${(width - padding * 2 - cardGap * 3) / 4}" height="${cardHeight}" rx="8" fill="white"/>
        <rect x="${(width - padding * 2 - cardGap * 3) / 4 + cardGap}" y="0" width="${(width - padding * 2 - cardGap * 3) / 4}" height="${cardHeight}" rx="8" fill="white"/>
        <rect x="${((width - padding * 2 - cardGap * 3) / 4 + cardGap) * 2}" y="0" width="${(width - padding * 2 - cardGap * 3) / 4}" height="${cardHeight}" rx="8" fill="white"/>
        <rect x="${((width - padding * 2 - cardGap * 3) / 4 + cardGap) * 3}" y="0" width="${(width - padding * 2 - cardGap * 3) / 4}" height="${cardHeight}" rx="8" fill="white"/>

        <!-- Card labels -->
        <text x="15" y="30" fill="#6b7280" font-family="system-ui" font-size="12">SPEND</text>
        <text x="15" y="60" fill="#111827" font-family="system-ui" font-size="24" font-weight="bold">$12,450</text>

        <text x="${(width - padding * 2 - cardGap * 3) / 4 + cardGap + 15}" y="30" fill="#6b7280" font-family="system-ui" font-size="12">CONVERSIONS</text>
        <text x="${(width - padding * 2 - cardGap * 3) / 4 + cardGap + 15}" y="60" fill="#111827" font-family="system-ui" font-size="24" font-weight="bold">1,234</text>
      </g>

      <!-- Chart Area -->
      <g transform="translate(${padding}, ${headerHeight + padding + cardHeight + cardGap})">
        <rect x="0" y="0" width="${width - padding * 2}" height="${chartHeight}" rx="8" fill="white"/>

        <!-- Chart bars -->
        <g transform="translate(40, 40)">
          ${Array.from({ length: 7 }, (_, i) => {
            const barHeight = Math.floor(Math.random() * (chartHeight - 100) + 50);
            const barWidth = Math.floor((width - padding * 2 - 100) / 8);
            const x = i * (barWidth + 10);
            const y = chartHeight - 80 - barHeight;
            return `<rect x="${x}" y="${y}" width="${barWidth}" height="${barHeight}" rx="4" fill="#3b82f6" opacity="0.8"/>`;
          }).join('')}
        </g>
      </g>
    </svg>
  `;
};

// Create mobile dashboard screenshot
const createMobileSvg = (width, height) => {
  const padding = 15;
  const headerHeight = 50;
  const cardHeight = 80;
  const cardGap = 10;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Background -->
      <rect width="${width}" height="${height}" fill="#f3f4f6"/>

      <!-- Status bar -->
      <rect x="0" y="0" width="${width}" height="44" fill="#3b82f6"/>

      <!-- Header -->
      <rect x="0" y="44" width="${width}" height="${headerHeight}" fill="#3b82f6"/>
      <text x="${padding}" y="78" fill="white" font-family="system-ui" font-size="18" font-weight="bold">Dashboard</text>

      <!-- Metric Cards (stacked on mobile) -->
      <g transform="translate(${padding}, ${44 + headerHeight + padding})">
        <rect x="0" y="0" width="${(width - padding * 2 - cardGap) / 2}" height="${cardHeight}" rx="8" fill="white"/>
        <rect x="${(width - padding * 2 - cardGap) / 2 + cardGap}" y="0" width="${(width - padding * 2 - cardGap) / 2}" height="${cardHeight}" rx="8" fill="white"/>

        <rect x="0" y="${cardHeight + cardGap}" width="${(width - padding * 2 - cardGap) / 2}" height="${cardHeight}" rx="8" fill="white"/>
        <rect x="${(width - padding * 2 - cardGap) / 2 + cardGap}" y="${cardHeight + cardGap}" width="${(width - padding * 2 - cardGap) / 2}" height="${cardHeight}" rx="8" fill="white"/>

        <text x="10" y="25" fill="#6b7280" font-family="system-ui" font-size="10">SPEND</text>
        <text x="10" y="50" fill="#111827" font-family="system-ui" font-size="18" font-weight="bold">$12.4k</text>
      </g>

      <!-- Chart Area -->
      <g transform="translate(${padding}, ${44 + headerHeight + padding + cardHeight * 2 + cardGap * 2 + padding})">
        <rect x="0" y="0" width="${width - padding * 2}" height="200" rx="8" fill="white"/>

        <!-- Simple line chart placeholder -->
        <polyline
          points="20,150 60,120 100,140 140,90 180,100 220,60 260,80 300,50 340,70"
          fill="none"
          stroke="#3b82f6"
          stroke-width="2"
          transform="translate(0, 20)"
        />
      </g>

      <!-- Bottom Navigation -->
      <rect x="0" y="${height - 80}" width="${width}" height="80" fill="white"/>
      <g transform="translate(0, ${height - 60})">
        <text x="${width / 5}" y="0" fill="#3b82f6" font-family="system-ui" font-size="10" text-anchor="middle">Dashboard</text>
        <text x="${width / 5 * 2}" y="0" fill="#6b7280" font-family="system-ui" font-size="10" text-anchor="middle">Reports</text>
        <text x="${width / 5 * 3}" y="0" fill="#6b7280" font-family="system-ui" font-size="10" text-anchor="middle">Connect</text>
        <text x="${width / 5 * 4}" y="0" fill="#6b7280" font-family="system-ui" font-size="10" text-anchor="middle">Settings</text>
      </g>
    </svg>
  `;
};

async function generateScreenshots() {
  console.log('Generating PWA screenshots...');

  // Desktop screenshot (1280x720)
  const desktopSvg = createDashboardSvg(1280, 720);
  await sharp(Buffer.from(desktopSvg))
    .png()
    .toFile(path.join(outputDir, 'dashboard.png'));
  console.log('Generated: dashboard.png (1280x720)');

  // Mobile screenshot (390x844 - iPhone 12/13/14 size)
  const mobileSvg = createMobileSvg(390, 844);
  await sharp(Buffer.from(mobileSvg))
    .png()
    .toFile(path.join(outputDir, 'mobile-dashboard.png'));
  console.log('Generated: mobile-dashboard.png (390x844)');

  console.log('All screenshots generated successfully!');
}

generateScreenshots().catch(console.error);
