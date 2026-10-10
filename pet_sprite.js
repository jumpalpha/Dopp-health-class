// Wellness Sprite drawing (original character). Used by pet.html and pets.html.
// petSpriteSVG({color, stage, form, mood_label, alive}) -> SVG string
(function () {
  const PAL = {
    gold:    { base: '#FFD23F', dark: '#B98A00', light: '#FFF1B0' },
    emerald: { base: '#2EE6A6', dark: '#0A8F63', light: '#C9FBE8' },
    sky:     { base: '#4CC4FF', dark: '#1676A8', light: '#D4F1FF' },
    crimson: { base: '#FF5C77', dark: '#B0213C', light: '#FFD3DB' },
    violet:  { base: '#B49BFF', dark: '#6545C9', light: '#E9E1FF' }
  };
  const INK = '#1A1030';
  const LEAF = '#3FCB6B', LEAF_D = '#1F7F40';

  function egg(p) {
    return '<g class="sp-egg">' +
      '<ellipse cx="100" cy="182" rx="38" ry="7" fill="rgba(0,0,0,.25)"/>' +
      '<path d="M100 62 C 132 62 146 112 146 138 C 146 166 126 182 100 182 C 74 182 54 166 54 138 C 54 112 68 62 100 62 Z" fill="#FFF8EC" stroke="' + INK + '" stroke-width="4"/>' +
      '<circle cx="82" cy="112" r="9" fill="' + p.base + '"/><circle cx="118" cy="98" r="7" fill="' + p.base + '"/>' +
      '<circle cx="112" cy="140" r="11" fill="' + p.base + '"/><circle cx="78" cy="152" r="6" fill="' + p.base + '"/>' +
      '<path d="M86 76 q6 -6 12 0" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round" opacity=".8"/>' +
      '</g>';
  }

  function eyes(mood, cx, cy, gap) {
    const L = cx - gap, R = cx + gap;
    const open = (x) => '<ellipse cx="' + x + '" cy="' + cy + '" rx="9" ry="11" fill="#fff" stroke="' + INK + '" stroke-width="3"/>' +
      '<circle cx="' + (x + 2) + '" cy="' + (cy + 2) + '" r="5" fill="' + INK + '"/><circle cx="' + (x + 4) + '" cy="' + (cy - 1) + '" r="1.8" fill="#fff"/>';
    switch (mood) {
      case 'tired': case 'sick':
        return [L, R].map(x => '<path d="M' + (x - 9) + ' ' + cy + ' q9 6 18 0" stroke="' + INK + '" stroke-width="4" fill="none" stroke-linecap="round"/>').join('');
      case 'sugar':
        return [L, R].map(x => '<circle cx="' + x + '" cy="' + cy + '" r="10" fill="#fff" stroke="' + INK + '" stroke-width="3"/>' +
          '<path d="M' + x + ' ' + cy + ' m-5 0 a5 5 0 1 1 5 5 a3 3 0 1 1 -3 -3" stroke="' + INK + '" stroke-width="2" fill="none"/>').join('');
      case 'ghost':
        return [L, R].map(x => '<path d="M' + (x - 6) + ' ' + (cy - 5) + ' l12 10 M' + (x + 6) + ' ' + (cy - 5) + ' l-12 10" stroke="' + INK + '" stroke-width="3.5" stroke-linecap="round"/>').join('');
      case 'happy':
        return open(L) + open(R);
      default:
        return open(L) + open(R);
    }
  }

  function mouth(mood, cx, cy) {
    const s = 'stroke="' + INK + '" stroke-width="4" fill="none" stroke-linecap="round"';
    switch (mood) {
      case 'happy': return '<path d="M' + (cx - 12) + ' ' + cy + ' q12 13 24 0" ' + s + '/>';
      case 'hungry': return '<ellipse cx="' + cx + '" cy="' + (cy + 3) + '" rx="8" ry="9" fill="#5B1730" stroke="' + INK + '" stroke-width="3"/>';
      case 'sad': case 'ghost': return '<path d="M' + (cx - 11) + ' ' + (cy + 7) + ' q11 -10 22 0" ' + s + '/>';
      case 'sick': return '<path d="M' + (cx - 12) + ' ' + (cy + 4) + ' q4 -5 8 0 q4 5 8 0 q4 -5 8 0" ' + s + '/>';
      case 'sugar': return '<path d="M' + (cx - 12) + ' ' + cy + ' q12 16 24 0 z" fill="#5B1730" stroke="' + INK + '" stroke-width="3"/>';
      default: return '<path d="M' + (cx - 9) + ' ' + (cy + 3) + ' h18" ' + s + '/>';
    }
  }

  function sprout(stage, form, x, y) {
    let g = '<path d="M' + x + ' ' + y + ' q-2 -16 2 -26" stroke="' + LEAF_D + '" stroke-width="4" fill="none" stroke-linecap="round"/>';
    const leaf = (dx, dy, rot, sz) => '<ellipse cx="' + (x + dx) + '" cy="' + (y + dy) + '" rx="' + sz + '" ry="' + (sz * 0.55) + '" fill="' + LEAF + '" stroke="' + LEAF_D + '" stroke-width="3" transform="rotate(' + rot + ' ' + (x + dx) + ' ' + (y + dy) + ')"/>';
    if (stage === 'baby') g += leaf(9, -26, -25, 10);
    else if (stage === 'child') g += leaf(-9, -26, 25, 11) + leaf(11, -28, -25, 12);
    else {
      g += leaf(-11, -24, 25, 13) + leaf(13, -26, -25, 14);
      const petal = form === 'scruffy' ? '#C9B79C' : form === 'sugar' ? '#FF9AD5' : '#FFE066';
      if (stage === 'adult') {
        for (let i = 0; i < 6; i++) {
          const a = i * 60 * Math.PI / 180, px = x + 2 + Math.cos(a) * 8, py = y - 32 + Math.sin(a) * 8;
          g += '<circle cx="' + px.toFixed(1) + '" cy="' + py.toFixed(1) + '" r="6" fill="' + petal + '" stroke="' + INK + '" stroke-width="2"/>';
        }
        g += '<circle cx="' + (x + 2) + '" cy="' + (y - 32) + '" r="5" fill="#FF8C42" stroke="' + INK + '" stroke-width="2"/>';
      } else {
        g += '<circle cx="' + (x + 2) + '" cy="' + (y - 30) + '" r="6" fill="' + petal + '" stroke="' + INK + '" stroke-width="2.5"/>';
      }
    }
    return g;
  }

  function petSpriteSVG(pet, opts) {
    const p = PAL[pet.color] || PAL.emerald;
    const stage = pet.stage || 'egg', form = pet.form, alive = pet.alive !== false;
    const mood = alive ? (pet.mood_label || 'happy') : 'ghost';
    let inner = '', scaleUsed = 1;
    if (stage === 'egg') {
      inner = egg(p);
    } else {
      const scale = { baby: 0.62, child: 0.78, teen: 0.9, adult: 1 }[stage] || 1;
      scaleUsed = scale;
      const fat = form === 'sugar' ? 1.14 : 1;
      const rx = 52 * fat, ry = (stage === 'teen' || stage === 'adult' ? 50 : 46);
      const cy = 122, cx = 100;
      const body = mood === 'sick' ? '#B9D98C' : p.base;
      let g = '';
      // shadow
      g += '<ellipse cx="100" cy="182" rx="' + (44 * fat) + '" ry="7" fill="rgba(0,0,0,.25)"/>';
      // wings
      if (stage === 'teen' || stage === 'adult') {
        const w = stage === 'adult' ? 1 : 0.75;
        g += '<path d="M' + (cx - rx + 8) + ' ' + (cy - 10) + ' q' + (-40 * w) + ' ' + (-30 * w) + ' ' + (-46 * w) + ' ' + (6 * w) + ' q' + (20 * w) + ' ' + (4 * w) + ' ' + (40 * w) + ' ' + (20 * w) + ' z" fill="' + p.light + '" stroke="' + INK + '" stroke-width="3" opacity=".95"/>';
        g += '<path d="M' + (cx + rx - 8) + ' ' + (cy - 10) + ' q' + (40 * w) + ' ' + (-30 * w) + ' ' + (46 * w) + ' ' + (6 * w) + ' q' + (-20 * w) + ' ' + (4 * w) + ' ' + (-40 * w) + ' ' + (20 * w) + ' z" fill="' + p.light + '" stroke="' + INK + '" stroke-width="3" opacity=".95"/>';
      }
      // feet
      if (stage !== 'baby') {
        g += '<ellipse cx="' + (cx - 22) + '" cy="' + (cy + ry - 2) + '" rx="13" ry="8" fill="' + p.dark + '" stroke="' + INK + '" stroke-width="3"/>';
        g += '<ellipse cx="' + (cx + 22) + '" cy="' + (cy + ry - 2) + '" rx="13" ry="8" fill="' + p.dark + '" stroke="' + INK + '" stroke-width="3"/>';
      }
      // body
      g += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + body + '" stroke="' + INK + '" stroke-width="4"/>';
      g += '<ellipse cx="' + cx + '" cy="' + (cy + 16) + '" rx="' + (rx * 0.58) + '" ry="' + (ry * 0.5) + '" fill="' + p.light + '" opacity=".85"/>';
      g += '<ellipse cx="' + (cx - rx * 0.45) + '" cy="' + (cy - ry * 0.5) + '" rx="10" ry="6" fill="#fff" opacity=".55" transform="rotate(-30 ' + (cx - rx * 0.45) + ' ' + (cy - ry * 0.5) + ')"/>';
      // scruffy tufts / smudges
      if (form === 'scruffy' || mood === 'dirty') {
        g += '<path d="M' + (cx - 30) + ' ' + (cy - ry + 6) + ' l6 -10 l4 9 l6 -11 l4 10" stroke="' + INK + '" stroke-width="3" fill="' + body + '" stroke-linejoin="round"/>';
        g += '<ellipse cx="' + (cx + 26) + '" cy="' + (cy + 18) + '" rx="9" ry="6" fill="#7A5C3A" opacity=".55"/><ellipse cx="' + (cx - 30) + '" cy="' + (cy + 26) + '" rx="6" ry="4" fill="#7A5C3A" opacity=".5"/>';
      }
      // sprout on head
      g += sprout(stage, form, cx, cy - ry + 4);
      // face
      g += eyes(mood, cx, cy - 6, 18);
      if (mood !== 'ghost') g += '<circle cx="' + (cx - 32) + '" cy="' + (cy + 8) + '" r="7" fill="#FF8FA8" opacity=".6"/><circle cx="' + (cx + 32) + '" cy="' + (cy + 8) + '" r="7" fill="#FF8FA8" opacity=".6"/>';
      g += mouth(mood, cx, cy + 14);
      // arms
      g += '<ellipse cx="' + (cx - rx + 4) + '" cy="' + (cy + 12) + '" rx="8" ry="12" fill="' + body + '" stroke="' + INK + '" stroke-width="3" transform="rotate(25 ' + (cx - rx + 4) + ' ' + (cy + 12) + ')"/>';
      g += '<ellipse cx="' + (cx + rx - 4) + '" cy="' + (cy + 12) + '" rx="8" ry="12" fill="' + body + '" stroke="' + INK + '" stroke-width="3" transform="rotate(-25 ' + (cx + rx - 4) + ' ' + (cy + 12) + ')"/>';
      // mood extras
      if (mood === 'tired') g += '<text x="150" y="70" font-family="Arial Black,Arial" font-weight="900" font-size="22" fill="#fff" stroke="' + INK + '" stroke-width="1.5">z</text><text x="166" y="52" font-family="Arial Black,Arial" font-weight="900" font-size="16" fill="#fff" stroke="' + INK + '" stroke-width="1.2">z</text>';
      if (mood === 'sad') g += '<path d="M' + (cx + 20) + ' ' + (cy + 4) + ' q4 8 0 12 q-4 -4 0 -12z" fill="#7FD3FF" stroke="' + INK + '" stroke-width="1.5"/>';
      if (mood === 'dirty') g += '<path d="M48 70 q-6 -8 0 -16 q6 -8 0 -16 M152 70 q6 -8 0 -16 q-6 -8 0 -16" stroke="#9DBF5A" stroke-width="3" fill="none" stroke-linecap="round"/>';
      if (mood === 'hungry') g += '<text x="146" y="78" font-family="Arial Black,Arial" font-weight="900" font-size="15" fill="#FFD700" stroke="' + INK + '" stroke-width="1">grr</text>';
      if (mood === 'sick') g += '<g transform="rotate(25 150 110)"><rect x="146" y="88" width="8" height="34" rx="4" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/><circle cx="150" cy="124" r="6" fill="#FF3B5C" stroke="' + INK + '" stroke-width="2.5"/></g>';
      if (mood === 'sugar' || form === 'sugar') {
        const cols = ['#FF5C77', '#38BFFF', '#FFD700', '#00E5A0'];
        for (let i = 0; i < 7; i++) g += '<rect x="' + (cx - 34 + i * 11) + '" y="' + (cy - 22 + (i % 3) * 9) + '" width="7" height="3" rx="1.5" fill="' + cols[i % 4] + '" transform="rotate(' + (i * 37) + ' ' + (cx - 30 + i * 11) + ' ' + (cy - 20 + (i % 3) * 9) + ')"/>';
      }
      if (form === 'radiant' && alive) {
        const st = (x, y, s) => '<path d="M' + x + ' ' + (y - s) + ' L' + (x + s * 0.3) + ' ' + (y - s * 0.3) + ' L' + (x + s) + ' ' + y + ' L' + (x + s * 0.3) + ' ' + (y + s * 0.3) + ' L' + x + ' ' + (y + s) + ' L' + (x - s * 0.3) + ' ' + (y + s * 0.3) + ' L' + (x - s) + ' ' + y + ' L' + (x - s * 0.3) + ' ' + (y - s * 0.3) + 'Z" fill="#FFF6A8" stroke="' + INK + '" stroke-width="1.5"/>';
        g = '<circle cx="100" cy="118" r="78" fill="url(#glow)"/>' + g + st(36, 60, 9) + st(168, 92, 7) + st(44, 150, 6);
      }
      if (!alive) g += '<ellipse cx="100" cy="' + (cy - ry - 34) + '" rx="22" ry="6" fill="none" stroke="#FFE066" stroke-width="4"/>';
      const wrapCls = alive ? 'sp-alive sp-' + mood : 'sp-ghost';
      inner = '<g class="' + wrapCls + '" ' + (alive ? '' : 'opacity=".55"') + ' transform="translate(' + (100 - 100 * scale) + ' ' + (182 - 182 * scale) + ') scale(' + scale + ')">' + g + '</g>';
    }
    // tight crop for small thumbnails
    let vb = '0 0 200 200';
    if (opts && opts.tight) { const size = Math.min(200, 200 * scaleUsed + 16); vb = (100 - size / 2).toFixed(1) + ' ' + (190 - size).toFixed(1) + ' ' + size.toFixed(1) + ' ' + size.toFixed(1); }
    return '<svg viewBox="' + vb + '" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="' +
      String(pet.name || 'Wellness Sprite').replace(/[<>&"]/g, '') + ', ' + stage + ', ' + mood + '">' +
      '<defs><radialGradient id="glow"><stop offset="0" stop-color="#FFF6A8" stop-opacity=".55"/><stop offset="1" stop-color="#FFF6A8" stop-opacity="0"/></radialGradient></defs>' +
      inner + '</svg>';
  }

  window.PET_COLORS = Object.keys(PAL);
  window.PET_PALETTE = PAL;
  window.petSpriteSVG = petSpriteSVG;
})();
