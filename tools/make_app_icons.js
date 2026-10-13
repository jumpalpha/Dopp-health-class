// Draws the home-screen icons in app/ (used by tools/build_pwa.py).
// Needs Playwright + Chromium + an emoji font. Usage: node tools/make_app_icons.js app/icons.json
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');
const spec = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const outDir = path.dirname(process.argv[2]);

(async () => {
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium', args: ['--headless=new'] });
  const p = await b.newPage();
  await p.setContent('<canvas id="c"></canvas>');
  for (const it of spec) {
    for (const size of [512, 192, 180]) {
      const file = path.join(outDir, it.name + '-' + size + '.png');
      if (fs.existsSync(file) && !process.env.FORCE) continue;
      const data = await p.evaluate(({ it, size }) => {
        const c = document.getElementById('c'); c.width = c.height = size; const x = c.getContext('2d'), s = size / 512;
        // full-bleed background so Android's round/squircle masks never cut into the art
        const g = x.createRadialGradient(256 * s, 180 * s, 30 * s, 256 * s, 256 * s, 380 * s);
        g.addColorStop(0, `hsl(${it.hue},70%,46%)`); g.addColorStop(1, `hsl(${it.hue},75%,16%)`);
        x.fillStyle = g; x.fillRect(0, 0, size, size);
        x.strokeStyle = 'rgba(255,215,0,.85)'; x.lineWidth = 14 * s; x.beginPath(); x.arc(256 * s, 256 * s, 196 * s, 0, 7); x.stroke();
        x.textAlign = 'center'; x.textBaseline = 'middle';
        if (it.letter) {
          x.fillStyle = '#FFD700'; x.font = `900 ${250 * s}px "DejaVu Serif",Georgia,serif`;
          x.shadowColor = 'rgba(0,0,0,.5)'; x.shadowOffsetY = 8 * s; x.fillText(it.letter, 256 * s, 262 * s); x.shadowColor = 'transparent';
          if (it.badge) { x.font = `${92 * s}px "Noto Color Emoji"`; x.fillText(it.badge, 372 * s, 372 * s); }
        } else {
          x.font = `${220 * s}px "Noto Color Emoji"`; x.fillText(it.emoji, 256 * s, 268 * s);
        }
        return c.toDataURL('image/png');
      }, { it, size });
      fs.writeFileSync(file, Buffer.from(data.split(',')[1], 'base64'));
    }
  }
  await b.close();
})();
