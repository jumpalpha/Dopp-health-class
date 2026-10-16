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

  // ---------- upgrade gear (bought in the Sprite shop) ----------
  let UID = 0;
  const G = {
    star(x, y, s, fill) {
      return '<path d="M' + x + ' ' + (y - s) + ' L' + (x + s * 0.3) + ' ' + (y - s * 0.3) + ' L' + (x + s) + ' ' + y + ' L' + (x + s * 0.3) + ' ' + (y + s * 0.3) + ' L' + x + ' ' + (y + s) + ' L' + (x - s * 0.3) + ' ' + (y + s * 0.3) + ' L' + (x - s) + ' ' + y + ' L' + (x - s * 0.3) + ' ' + (y - s * 0.3) + 'Z" fill="' + fill + '" stroke="' + INK + '" stroke-width="1.5"/>';
    },
    aura(k) {
      if (k !== 'sparkles') return '';
      let g = '<circle cx="100" cy="118" r="80" fill="#B49BFF" opacity=".16"/><circle cx="100" cy="118" r="62" fill="#FFF6A8" opacity=".12"/>';
      [[34, 74, 8], [164, 66, 9], [26, 132, 6], [172, 140, 7], [100, 34, 6], [58, 40, 5], [146, 30, 5]].forEach(a => g += G.star(a[0], a[1], a[2], '#FFF6A8'));
      return g;
    },
    cape(cx, cy, rx, ry) {
      return '<path d="M' + (cx - rx * 0.6) + ' ' + (cy - ry * 0.45) + ' Q' + (cx - rx - 22) + ' ' + (cy + ry * 0.6) + ' ' + (cx - rx - 14) + ' ' + (cy + ry + 8) +
        ' L' + (cx + rx + 14) + ' ' + (cy + ry + 8) + ' Q' + (cx + rx + 22) + ' ' + (cy + ry * 0.6) + ' ' + (cx + rx * 0.6) + ' ' + (cy - ry * 0.45) + ' Z" fill="#E0213F" stroke="' + INK + '" stroke-width="3"/>' +
        '<path d="M' + (cx - rx - 12) + ' ' + (cy + ry + 2) + ' L' + (cx + rx + 12) + ' ' + (cy + ry + 2) + '" stroke="#FFD700" stroke-width="3"/>';
    },
    shoe(k, x, y) {
      if (k === 'sneakers') return '<rect x="' + (x - 16) + '" y="' + (y - 9) + '" width="32" height="17" rx="8" fill="#fff" stroke="' + INK + '" stroke-width="3"/>' +
        '<path d="M' + (x - 14) + ' ' + (y + 4) + ' h28" stroke="#38BFFF" stroke-width="4"/><path d="M' + (x - 4) + ' ' + (y - 6) + ' l6 6 M' + (x + 2) + ' ' + (y - 7) + ' l6 6" stroke="' + INK + '" stroke-width="1.6"/>';
      if (k === 'spikes') return '<rect x="' + (x - 16) + '" y="' + (y - 9) + '" width="32" height="16" rx="8" fill="#FF3B5C" stroke="' + INK + '" stroke-width="3"/>' +
        '<path d="M' + (x - 10) + ' ' + (y + 7) + ' l2 5 l2 -5 M' + (x - 2) + ' ' + (y + 7) + ' l2 5 l2 -5 M' + (x + 6) + ' ' + (y + 7) + ' l2 5 l2 -5" stroke="' + INK + '" stroke-width="2" fill="#ddd"/>' +
        '<path d="M' + (x - 12) + ' ' + (y - 2) + ' l20 -4" stroke="#fff" stroke-width="3" stroke-linecap="round"/>';
      if (k === 'rockets') return '<path d="M' + (x - 8) + ' ' + (y + 8) + ' q8 16 16 0 z" fill="#FF8C42" stroke="' + INK + '" stroke-width="2"/><path d="M' + (x - 4) + ' ' + (y + 8) + ' q4 9 8 0 z" fill="#FFE066"/>' +
        '<rect x="' + (x - 16) + '" y="' + (y - 12) + '" width="32" height="20" rx="7" fill="#9AA6C2" stroke="' + INK + '" stroke-width="3"/><circle cx="' + x + '" cy="' + (y - 2) + '" r="4" fill="#38BFFF" stroke="' + INK + '" stroke-width="1.5"/>';
      return '';
    },
    skinFill(k, id, base) {
      if (k === 'galaxy') return { fill: 'url(#gx' + id + ')', defs: '<radialGradient id="gx' + id + '" cx=".4" cy=".35"><stop offset="0" stop-color="#7B5CFF"/><stop offset=".6" stop-color="#3A1E8C"/><stop offset="1" stop-color="#160A40"/></radialGradient>' };
      if (k === 'chrome') return { fill: 'url(#ch' + id + ')', defs: '<linearGradient id="ch' + id + '" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF6B0"/><stop offset=".45" stop-color="#FFD23F"/><stop offset=".55" stop-color="#E0A800"/><stop offset="1" stop-color="#FFE680"/></linearGradient>' };
      return { fill: base, defs: '' };
    },
    skinPattern(k, cx, cy, rx, ry, p) {
      let g = '';
      if (k === 'spots') [[-28, -24, 8], [20, -30, 6], [32, 4, 9], [-36, 10, 6], [-10, 30, 7], [18, 30, 5], [0, -8, 4]].forEach(a => g += '<circle cx="' + (cx + a[0]) + '" cy="' + (cy + a[1]) + '" r="' + a[2] + '" fill="' + p.dark + '" opacity=".5"/>');
      if (k === 'stripes') for (let i = -2; i <= 2; i++) { const x = cx + i * 20; g += '<path d="M' + (x - 6) + ' ' + (cy - ry) + ' q10 ' + (ry * 0.5) + ' 0 ' + (ry * 0.75) + ' l6 -4 q8 -' + (ry * 0.3) + ' -2 -' + (ry * 0.75) + 'z" fill="' + INK + '" opacity=".55"/>'; }
      if (k === 'galaxy') [[-30, -20], [24, -28], [36, 8], [-22, 24], [6, 36], [-40, -2], [12, -6]].forEach((a, i) => g += '<circle cx="' + (cx + a[0]) + '" cy="' + (cy + a[1]) + '" r="' + (i % 3 ? 1.6 : 2.6) + '" fill="#fff"/>');
      if (k === 'chrome') g += '<path d="M' + (cx - rx * 0.6) + ' ' + (cy - ry * 0.2) + ' q' + (rx * 0.6) + ' -' + (ry * 0.7) + ' ' + (rx * 1.2) + ' -' + (ry * 0.2) + '" stroke="#fff" stroke-width="5" fill="none" opacity=".6" stroke-linecap="round"/>';
      return g;
    },
    shirt(k, cx, cy, rx, ry) {
      const col = k === 'jersey' ? '#FF3B5C' : '#00C98B', top = cy + 22;
      let g = '<rect x="' + (cx - rx - 2) + '" y="' + top + '" width="' + (rx * 2 + 4) + '" height="' + (ry + 4) + '" fill="' + col + '"/>' +
        '<path d="M' + (cx - rx) + ' ' + top + ' H' + (cx - 12) + ' q12 10 24 0 H' + (cx + rx) + '" stroke="' + INK + '" stroke-width="3" fill="none"/>';
      if (k === 'jersey') g += '<path d="M' + (cx - rx) + ' ' + (top + 9) + ' H' + (cx + rx) + '" stroke="#fff" stroke-width="4"/><text x="' + cx + '" y="' + (top + 30) + '" text-anchor="middle" font-family="Arial Black,Arial" font-weight="900" font-size="18" fill="#fff" stroke="' + INK + '" stroke-width="1">1</text>';
      else g += '<path d="M' + cx + ' ' + (top + 26) + ' l-8 -8 a5 5 0 0 1 8 -6 a5 5 0 0 1 8 6 z" fill="#fff" stroke="' + INK + '" stroke-width="1.5"/>';
      return g;
    },
    abs(cx, cy) {
      let g = '';
      for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) g += '<rect x="' + (cx - 11 + c * 12) + '" y="' + (cy + 20 + r * 9) + '" width="10" height="7" rx="3" fill="none" stroke="' + INK + '" stroke-width="1.8" opacity=".55"/>';
      return g;
    },
    hair(k, cx, top, col) {
      if (k === 'spiky') { let d = 'M' + (cx - 34) + ' ' + (top + 18); for (let i = 0; i < 7; i++) { const x = cx - 34 + i * 10; d += ' L' + (x + 5) + ' ' + (top - 6 + (i % 2) * 5) + ' L' + (x + 10) + ' ' + (top + 12); } return '<path d="' + d + ' Z" fill="' + col + '" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>'; }
      if (k === 'curls') { let g = ''; [[-30, 14], [-20, 4], [-8, -1], [6, -1], [18, 4], [30, 14], [-36, 26], [36, 26]].forEach(a => g += '<circle cx="' + (cx + a[0]) + '" cy="' + (top + a[1]) + '" r="10" fill="' + col + '" stroke="' + INK + '" stroke-width="2.5"/>'); return g; }
      if (k === 'mohawk') { let d = 'M' + (cx - 30) + ' ' + (top + 16); for (let i = 0; i < 6; i++) d += ' L' + (cx - 25 + i * 10) + ' ' + (top - 30 + Math.abs(i - 2.5) * 6) + ' L' + (cx - 20 + i * 10) + ' ' + (top + 4); return '<path d="' + d + ' L' + (cx + 30) + ' ' + (top + 16) + ' Z" fill="#FF3B5C" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>'; }
      return '';
    },
    hatLow(k, cx, cy, rx, ry, top) {
      const y = top + 16, hw = rx * Math.sqrt(Math.max(0, 1 - Math.pow((y - cy) / ry, 2)));
      if (k === 'headband') return '<rect x="' + (cx - hw) + '" y="' + (y - 5) + '" width="' + (hw * 2) + '" height="11" rx="4" fill="#fff" stroke="' + INK + '" stroke-width="2.5"/><path d="M' + (cx - hw + 3) + ' ' + y + ' H' + (cx + hw - 3) + '" stroke="#FF3B5C" stroke-width="3"/>';
      if (k === 'cap') return '<path d="M' + (cx - rx * 0.78) + ' ' + (top + 18) + ' Q' + cx + ' ' + (top - 22) + ' ' + (cx + rx * 0.78) + ' ' + (top + 18) + ' Z" fill="#38BFFF" stroke="' + INK + '" stroke-width="3"/>' +
        '<path d="M' + (cx + rx * 0.2) + ' ' + (top + 16) + ' q' + (rx * 0.6) + ' -6 ' + (rx * 0.95) + ' 6 q-' + (rx * 0.5) + ' 6 -' + (rx * 0.95) + ' 0z" fill="#1676A8" stroke="' + INK + '" stroke-width="3"/>';
      return '';
    },
    crown(cx, top) {
      const y = top - 4;
      return '<path d="M' + (cx - 24) + ' ' + (y + 4) + ' L' + (cx - 26) + ' ' + (y - 18) + ' L' + (cx - 12) + ' ' + (y - 6) + ' L' + cx + ' ' + (y - 24) + ' L' + (cx + 12) + ' ' + (y - 6) + ' L' + (cx + 26) + ' ' + (y - 18) + ' L' + (cx + 24) + ' ' + (y + 4) + ' Z" fill="#FFD700" stroke="' + INK + '" stroke-width="3" stroke-linejoin="round"/>' +
        '<circle cx="' + cx + '" cy="' + (y - 4) + '" r="4" fill="#FF3B5C" stroke="' + INK + '" stroke-width="1.5"/><circle cx="' + (cx - 15) + '" cy="' + (y - 2) + '" r="3" fill="#00E5A0" stroke="' + INK + '" stroke-width="1.5"/><circle cx="' + (cx + 15) + '" cy="' + (y - 2) + '" r="3" fill="#38BFFF" stroke="' + INK + '" stroke-width="1.5"/>';
    },
    face(k, cx, cy, gap) {
      const L = cx - gap, R = cx + gap;
      if (k === 'glasses') return '<circle cx="' + L + '" cy="' + cy + '" r="14" fill="rgba(255,255,255,.15)" stroke="' + INK + '" stroke-width="3.5"/><circle cx="' + R + '" cy="' + cy + '" r="14" fill="rgba(255,255,255,.15)" stroke="' + INK + '" stroke-width="3.5"/><path d="M' + (L + 14) + ' ' + cy + ' q' + (gap - 14) + ' -6 ' + (gap * 2 - 28) + ' 0" stroke="' + INK + '" stroke-width="3" fill="none"/>';
      if (k === 'shades') return '<rect x="' + (L - 15) + '" y="' + (cy - 10) + '" width="30" height="20" rx="8" fill="#14102A" stroke="' + INK + '" stroke-width="3"/><rect x="' + (R - 15) + '" y="' + (cy - 10) + '" width="30" height="20" rx="8" fill="#14102A" stroke="' + INK + '" stroke-width="3"/>' +
        '<path d="M' + (L + 15) + ' ' + (cy - 4) + ' H' + (R - 15) + '" stroke="' + INK + '" stroke-width="3"/><path d="M' + (L - 9) + ' ' + (cy - 4) + ' l6 -3 M' + (R - 9) + ' ' + (cy - 4) + ' l6 -3" stroke="#fff" stroke-width="2.5" stroke-linecap="round" opacity=".8"/>';
      return '';
    },
    medal(cx, cy) {
      return '<path d="M' + (cx - 14) + ' ' + (cy + 20) + ' L' + (cx - 3) + ' ' + (cy + 38) + ' M' + (cx + 14) + ' ' + (cy + 20) + ' L' + (cx + 3) + ' ' + (cy + 38) + '" stroke="#38BFFF" stroke-width="6" stroke-linecap="round"/>' +
        '<circle cx="' + cx + '" cy="' + (cy + 44) + '" r="10" fill="#FFD700" stroke="' + INK + '" stroke-width="3"/>' + G.star(cx, cy + 44, 5, '#FFF6A8');
    },
    hand(k, x, y) {
      if (k === 'bottle') return '<rect x="' + (x - 6) + '" y="' + (y - 20) + '" width="13" height="26" rx="4" fill="#7FD3FF" stroke="' + INK + '" stroke-width="2.5"/><rect x="' + (x - 4) + '" y="' + (y - 26) + '" width="9" height="7" rx="2" fill="#1676A8" stroke="' + INK + '" stroke-width="2"/><path d="M' + (x - 3) + ' ' + (y - 8) + ' h7" stroke="#fff" stroke-width="2"/>';
      if (k === 'dumbbell') return '<path d="M' + x + ' ' + (y - 18) + ' V' + (y + 10) + '" stroke="' + INK + '" stroke-width="5"/><rect x="' + (x - 9) + '" y="' + (y - 26) + '" width="18" height="10" rx="3" fill="#5B4D8C" stroke="' + INK + '" stroke-width="2.5"/><rect x="' + (x - 9) + '" y="' + (y + 8) + '" width="18" height="10" rx="3" fill="#5B4D8C" stroke="' + INK + '" stroke-width="2.5"/>';
      return '';
    }
  };

  function petSpriteSVG(pet, opts) {
    const p = PAL[pet.color] || PAL.emerald;
    const stage = pet.stage || 'egg', form = pet.form, alive = pet.alive !== false;
    const mood = alive ? (pet.mood_label || 'happy') : 'ghost';
    let inner = '', scaleUsed = 1;
    const gear = (pet.gear && typeof pet.gear === 'object') ? pet.gear : {}, uid = ++UID;
    if (stage === 'egg') {
      inner = egg(p);
    } else {
      const scale = { baby: 0.62, child: 0.78, teen: 0.9, adult: 1 }[stage] || 1;
      scaleUsed = scale;
      const fat = form === 'sugar' ? 1.14 : 1;
      const rx = 52 * fat, ry = (stage === 'teen' || stage === 'adult' ? 50 : 46);
      const cy = 122, cx = 100;
      const sk = G.skinFill(gear.skin, uid, mood === 'sick' ? '#B9D98C' : p.base);
      const body = sk.fill, top = cy - ry, ax = gear.arms === 'buff' ? 1.6 : gear.arms === 'toned' ? 1.25 : 1;
      let g = sk.defs ? '<defs>' + sk.defs + '<clipPath id="bd' + uid + '"><ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '"/></clipPath></defs>' : '<defs><clipPath id="bd' + uid + '"><ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '"/></clipPath></defs>';
      g += G.aura(gear.aura);
      // shadow
      g += '<ellipse cx="100" cy="182" rx="' + (44 * fat) + '" ry="7" fill="rgba(0,0,0,.25)"/>';
      // wings
      if (stage === 'teen' || stage === 'adult') {
        const w = stage === 'adult' ? 1 : 0.75;
        g += '<path d="M' + (cx - rx + 8) + ' ' + (cy - 10) + ' q' + (-40 * w) + ' ' + (-30 * w) + ' ' + (-46 * w) + ' ' + (6 * w) + ' q' + (20 * w) + ' ' + (4 * w) + ' ' + (40 * w) + ' ' + (20 * w) + ' z" fill="' + p.light + '" stroke="' + INK + '" stroke-width="3" opacity=".95"/>';
        g += '<path d="M' + (cx + rx - 8) + ' ' + (cy - 10) + ' q' + (40 * w) + ' ' + (-30 * w) + ' ' + (46 * w) + ' ' + (6 * w) + ' q' + (-20 * w) + ' ' + (4 * w) + ' ' + (-40 * w) + ' ' + (20 * w) + ' z" fill="' + p.light + '" stroke="' + INK + '" stroke-width="3" opacity=".95"/>';
      }
      if (gear.back === 'cape') g += G.cape(cx, cy, rx, ry);
      // feet
      if (stage !== 'baby' || gear.shoes) {
        g += '<ellipse cx="' + (cx - 22) + '" cy="' + (cy + ry - 2) + '" rx="13" ry="8" fill="' + p.dark + '" stroke="' + INK + '" stroke-width="3"/>';
        g += '<ellipse cx="' + (cx + 22) + '" cy="' + (cy + ry - 2) + '" rx="13" ry="8" fill="' + p.dark + '" stroke="' + INK + '" stroke-width="3"/>';
      }
      // body
      g += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="' + body + '" stroke="' + INK + '" stroke-width="4"/>';
      g += '<ellipse cx="' + cx + '" cy="' + (cy + 16) + '" rx="' + (rx * 0.58) + '" ry="' + (ry * 0.5) + '" fill="' + p.light + '" opacity=".85"/>';
      g += '<ellipse cx="' + (cx - rx * 0.45) + '" cy="' + (cy - ry * 0.5) + '" rx="10" ry="6" fill="#fff" opacity=".55" transform="rotate(-30 ' + (cx - rx * 0.45) + ' ' + (cy - ry * 0.5) + ')"/>';
      g += '<g clip-path="url(#bd' + uid + ')">' + G.skinPattern(gear.skin, cx, cy, rx, ry, p) + (gear.arms === 'buff' ? G.abs(cx, cy) : '') + (gear.shirt ? G.shirt(gear.shirt, cx, cy, rx, ry) : '') + '</g>';
      g += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + rx + '" ry="' + ry + '" fill="none" stroke="' + INK + '" stroke-width="4"/>';
      if (gear.shoes) g += G.shoe(gear.shoes, cx - 24, cy + ry + 2) + G.shoe(gear.shoes, cx + 24, cy + ry + 2);
      if (gear.hair) g += G.hair(gear.hair, cx, top, p.dark);
      if (gear.hat === 'headband' || gear.hat === 'cap') g += G.hatLow(gear.hat, cx, cy, rx, ry, top);
      // scruffy tufts / smudges
      if (form === 'scruffy' || mood === 'dirty') {
        g += '<path d="M' + (cx - 30) + ' ' + (cy - ry + 6) + ' l6 -10 l4 9 l6 -11 l4 10" stroke="' + INK + '" stroke-width="3" fill="' + body + '" stroke-linejoin="round"/>';
        g += '<ellipse cx="' + (cx + 26) + '" cy="' + (cy + 18) + '" rx="9" ry="6" fill="#7A5C3A" opacity=".55"/><ellipse cx="' + (cx - 30) + '" cy="' + (cy + 26) + '" rx="6" ry="4" fill="#7A5C3A" opacity=".5"/>';
      }
      // sprout on head
      g += sprout(stage, form, cx, cy - ry + 4);
      if (gear.hat === 'crown') g += G.crown(cx, top);
      // face
      g += eyes(mood, cx, cy - 6, 18);
      if (mood !== 'ghost') g += '<circle cx="' + (cx - 32) + '" cy="' + (cy + 8) + '" r="7" fill="#FF8FA8" opacity=".6"/><circle cx="' + (cx + 32) + '" cy="' + (cy + 8) + '" r="7" fill="#FF8FA8" opacity=".6"/>';
      g += mouth(mood, cx, cy + 14);
      if (gear.face) g += G.face(gear.face, cx, cy - 6, 18);
      if (gear.neck === 'medal') g += G.medal(cx, cy);
      // arms
      g += '<ellipse cx="' + (cx - rx + 4) + '" cy="' + (cy + 12) + '" rx="' + (8 * ax) + '" ry="' + (12 * Math.sqrt(ax)) + '" fill="' + body + '" stroke="' + INK + '" stroke-width="3" transform="rotate(25 ' + (cx - rx + 4) + ' ' + (cy + 12) + ')"/>';
      g += '<ellipse cx="' + (cx + rx - 4) + '" cy="' + (cy + 12) + '" rx="' + (8 * ax) + '" ry="' + (12 * Math.sqrt(ax)) + '" fill="' + body + '" stroke="' + INK + '" stroke-width="3" transform="rotate(-25 ' + (cx + rx - 4) + ' ' + (cy + 12) + ')"/>';
      if (ax > 1) [-1, 1].forEach(sd => { const x = cx + sd * (rx - 4); g += '<path d="M' + (x - 5 * ax) + ' ' + (cy + 8) + ' q' + (5 * ax) + ' -' + (7 * ax) + ' ' + (10 * ax) + ' 0" stroke="' + INK + '" stroke-width="2" fill="none" opacity=".6"/>'; });
      if (gear.hand) g += G.hand(gear.hand, cx + rx + 4 + 4 * (ax - 1), cy + 20);
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
  window.PET_PAL = PAL;
  window.PET_PALETTE = PAL;
  window.petSpriteSVG = petSpriteSVG;
})();
