// dopp_faces.js — cartoon Mr. Dopp with different hair and beard styles.
// doppFace(style) returns an SVG string (viewBox 0 0 100 100). DOPP_STYLES lists the styles.
(function () {
  const SKIN = '#f3c4a6', SKIN_D = '#e2a587', INK = '#2a1a14';
  const BROWN = '#7a4e2d', BROWN_D = '#5b3920', GRAY = '#b8b4ae', GRAY_D = '#8f8a84';
  const S = (d, fill, extra) => `<path d="${d}" fill="${fill}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round" ${extra || ''}/>`;

  // the parts that never change: ears, head, eyes, nose, smile
  function face(o) {
    return `
      <ellipse cx="22.5" cy="52" rx="5" ry="8" fill="${SKIN}" stroke="${INK}" stroke-width="1.6"/>
      <ellipse cx="77.5" cy="52" rx="5" ry="8" fill="${SKIN}" stroke="${INK}" stroke-width="1.6"/>
      <path d="M21 53 q2-3 3 0 M79 53 q-2-3-3 0" fill="none" stroke="${SKIN_D}" stroke-width="1.4"/>
      <ellipse cx="50" cy="52" rx="27" ry="31" fill="${SKIN}" stroke="${INK}" stroke-width="1.8"/>
      ${o.forehead ? `<path d="M36 24 q14-6 28 0" fill="none" stroke="${SKIN_D}" stroke-width="1.2" opacity=".6"/>` : ''}
      <ellipse cx="35" cy="60" rx="5" ry="3" fill="#ec9b8a" opacity=".45"/>
      <ellipse cx="65" cy="60" rx="5" ry="3" fill="#ec9b8a" opacity=".45"/>
      <path d="M33.5 41 q6.5-3 12 0" fill="none" stroke="${o.brow || BROWN_D}" stroke-width="2.6" stroke-linecap="round"/>
      <path d="M54.5 41 q6.5-3 12 0" fill="none" stroke="${o.brow || BROWN_D}" stroke-width="2.6" stroke-linecap="round"/>
      <ellipse cx="40" cy="48" rx="5.2" ry="3.6" fill="#fff" stroke="${INK}" stroke-width="1.1"/>
      <ellipse cx="60" cy="48" rx="5.2" ry="3.6" fill="#fff" stroke="${INK}" stroke-width="1.1"/>
      <circle cx="40.5" cy="48.2" r="2.4" fill="#6f8fa8"/><circle cx="60.5" cy="48.2" r="2.4" fill="#6f8fa8"/>
      <circle cx="40.7" cy="48.3" r="1.1" fill="${INK}"/><circle cx="60.7" cy="48.3" r="1.1" fill="${INK}"/>
      <circle cx="41.4" cy="47.4" r=".6" fill="#fff"/><circle cx="61.4" cy="47.4" r=".6" fill="#fff"/>
      <path d="M35 51.8 q5 2 10 0 M55 51.8 q5 2 10 0" fill="none" stroke="${SKIN_D}" stroke-width="1"/>
      <path d="M50 49 q-1 7-4 10 q4 2.5 8 0" fill="${SKIN_D}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>
      ${o.noSmile ? '' : `<path d="M43 67 q7 4 14 0" fill="none" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`}`;
  }
  // beards
  const BEARD = {
    // his real one: brown at the sides, gray on the chin
    classic: `<path d="M23.5 55 q1 22 26.5 31 q25.5-9 26.5-31 q-4 9-10 9 q-6-6-16-6 q-10 0-16 6 q-6 0-11-9z" fill="${BROWN}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M38 72 q12 4 24 0 q-2 11-12 14 q-10-3-12-14z" fill="${GRAY}"/>
      <path d="M40 64 q10-5 20 0 q-4 2-10 1.5 q-6 .5-10-1.5z" fill="${BROWN_D}"/>
      <path d="M44 69 q6 2.5 12 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
    full: `<path d="M23 54 q-2 34 27 38 q29-4 27-38 q-5 9-11 9 q-6-6-16-6 q-10 0-16 6 q-6 0-11-9z" fill="${BROWN}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M40 64 q10-5 20 0 q-4 2-10 1.5 q-6 .5-10-1.5z" fill="${BROWN_D}"/><path d="M44 69 q6 2.5 12 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
    wizard: `<path d="M24 56 q-2 18 10 26 q6 14 16 18 q10-4 16-18 q12-8 10-26 q-5 8-10 8 q-6-5-16-5 q-10 0-16 5 q-5 0-10-8z" fill="${GRAY}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M42 76 q2 10 8 20 M58 76 q-2 10-8 20 M50 74 v22" fill="none" stroke="${GRAY_D}" stroke-width="1.2"/>
      <path d="M38 64 q12-6 24 0 q-5 3-12 2 q-7 1-12-2z" fill="${GRAY_D}"/><path d="M44 69 q6 2.5 12 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
    goatee: `<path d="M43 64 q7-3 14 0 v1.5 q-7-1.5-14 0z" fill="${BROWN_D}"/><path d="M44 72 q6 2 12 0 q-1 9-6 11 q-5-2-6-11z" fill="${BROWN}" stroke="${INK}" stroke-width="1.4"/>`,
    viking: `<path d="M24 56 q0 18 12 24 q5 4 14 4 q9 0 14-4 q12-6 12-24 q-5 8-10 8 q-6-5-16-5 q-10 0-16 5 q-5 0-10-8z" fill="#b5652f" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>
      <path d="M40 80 q-1 6 0 14 M60 80 q1 6 0 14" fill="none" stroke="#b5652f" stroke-width="5" stroke-linecap="round"/>
      <path d="M40 80 q-1 6 0 14 M60 80 q1 6 0 14" fill="none" stroke="${INK}" stroke-width="1" stroke-dasharray="2 2"/>
      <circle cx="40" cy="94" r="2" fill="#d4af37" stroke="${INK}"/><circle cx="60" cy="94" r="2" fill="#d4af37" stroke="${INK}"/>
      <path d="M40 64 q10-5 20 0 q-4 2-10 1.5 q-6 .5-10-1.5z" fill="#8a4a22"/><path d="M44 69 q6 2.5 12 0" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round"/>`,
    stubble: `<path d="M26 58 q2 20 24 26 q22-6 24-26 q-6 8-24 8 q-18 0-24-8z" fill="${BROWN}" opacity=".28"/>`,
    handlebar: `<path d="M50 63 q-9-3-16 1 q-5 2-7-3 q1 6 7 6 q9 0 16-2 q7 2 16 2 q6 0 7-6 q-2 5-7 3 q-7-4-16-1z" fill="${BROWN_D}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`,
    mustache: `<path d="M38 65 q12-7 24 0 q-2 4-6 3 q-6-2-12 0 q-4 1-6-3z" fill="${BROWN_D}" stroke="${INK}" stroke-width="1.3"/>`,
    chops: `<path d="M23.5 50 q0 18 9 22 q3-2 6-6 q-4-6-6-16z M76.5 50 q0 18-9 22 q-3-2-6-6 q4-6 6-16z" fill="${BROWN}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
    none: ''
  };
  // hair: back = behind the head, front = on top of it
  const HAIR = {
    classic: { front: `<path d="M27 40 q-1-12 5-17 q2 6 4 4 q4-9 14-10 q10 1 14 10 q2 2 4-4 q6 5 5 17 q-2-9-6-11 q-6 1-17-2 q-11 3-17 2 q-4 2-6 11z" fill="${BROWN}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M41 19 q9-3 18 0" fill="none" stroke="${BROWN_D}" stroke-width="1.2"/>`, forehead: true },
    mohawk: { front: `<path d="M44 26 q-2-14 6-24 q8 10 6 24 q-6-2-12 0z" fill="#e0245e" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M47 24 q0-10 3-17 M53 24 q0-10-3-17" fill="none" stroke="#a3123f" stroke-width="1"/>`, forehead: true },
    mullet: { back: `<path d="M25 48 q-4 20 2 34 q8 4 12 0 q-2-8 0-14z M75 48 q4 20-2 34 q-8 4-12 0 q2-8 0-14z" fill="${BROWN}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
      front: `<path d="M23 44 q-2-22 27-25 q29 3 27 25 q-4-10-10-12 q-2 6-8 4 q-4-6-9-5 q-5-1-9 5 q-6 2-8-4 q-6 2-10 12z" fill="${BROWN}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` },
    afro: { back: `<g fill="#3b2516" stroke="${INK}" stroke-width="1.5">${[[50,20,26],[28,30,15],[72,30,15],[22,48,11],[78,48,11],[36,14,13],[64,14,13]].map(([x,y,r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`,
      front: `<path d="M24 42 q2-16 26-18 q24 2 26 18 q-10-8-26-8 q-16 0-26 8z" fill="#3b2516"/>` },
    bald: { front: `<ellipse cx="42" cy="26" rx="7" ry="3.5" fill="#fff" opacity=".55" transform="rotate(-20 42 26)"/>
      <path d="M23.5 46 q0-8 3-12 M76.5 46 q0-8-3-12" fill="none" stroke="${GRAY_D}" stroke-width="4" stroke-linecap="round"/>`, brow: GRAY_D },
    bun: { back: `<circle cx="50" cy="12" r="9" fill="${BROWN}" stroke="${INK}" stroke-width="1.5"/><path d="M44 12 q6-4 12 0" fill="none" stroke="${BROWN_D}" stroke-width="1.2"/>`,
      front: `<path d="M24 44 q-1-24 26-26 q27 2 26 26 q-3-10-8-13 q-8-4-18-4 q-10 0-18 4 q-5 3-8 13z" fill="${BROWN}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M36 22 q14-4 28 0 M40 27 q10-3 20 0" fill="none" stroke="${BROWN_D}" stroke-width="1.2"/>
      <rect x="44.5" y="18.5" width="11" height="3.5" rx="1.7" fill="#38BFFF" stroke="${INK}" stroke-width="1"/>` },
    pompadour: { front: `<path d="M25 40 q-2-16 10-20 q-2-14 22-14 q22 2 16 16 q8 6 2 18 q-4-8-10-10 q-8 3-16 0 q-10 2-16 0 q-4 2-8 10z" fill="#2f1f14" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M38 14 q14-6 30 2 M36 20 q16-5 32 2" fill="none" stroke="#5a4130" stroke-width="1.3"/>` },
    long: { back: `<path d="M24 34 q-8 30-2 56 q8 2 12-4 q-2-20 0-36z M76 34 q8 30 2 56 q-8 2-12-4 q2-20 0-36z" fill="#b5652f" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>`,
      front: `<path d="M23 46 q-2-26 27-28 q29 2 27 28 q-6-14-14-16 q-6 4-13 3 q-7 1-13-3 q-8 2-14 16z" fill="#b5652f" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>
      <path d="M22 30 q28-10 56 0" fill="none" stroke="#2f6fd1" stroke-width="3"/>` },
    spiky: { front: `<path d="M24 42 l-2-14 l8 4 l0-12 l8 6 l4-12 l6 8 l6-10 l4 10 l8-6 l0 12 l8-4 l-2 14 q-6-8-13-9 q-6 3-12 1 q-6 2-12-1 q-7 1-13 9z" fill="#f2c94c" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` },
    curly: { front: `<g fill="${BROWN}" stroke="${INK}" stroke-width="1.3">${[[30,30],[38,23],[47,20],[56,20],[64,23],[71,30],[26,39],[74,39],[42,27],[52,25],[61,27]].map(([x,y]) => `<circle cx="${x}" cy="${y}" r="6"/>`).join('')}</g>` }
  };
  const STYLES = {
    'Classic Dopp':  ['classic', 'classic'],
    'Mohawk':        ['mohawk', 'goatee'],
    'Mullet':        ['mullet', 'mustache'],
    'Afro':          ['afro', 'full'],
    'Wizard':        ['bald', 'wizard'],
    'Man Bun':       ['bun', 'stubble'],
    'Pompadour':     ['pompadour', 'handlebar'],
    'Viking':        ['long', 'viking'],
    'Spiky':         ['spiky', 'chops'],
    'Curly':         ['curly', 'none']
  };
  window.DOPP_STYLES = Object.keys(STYLES);
  window.doppFace = function (style) {
    const [h, b] = STYLES[style] || STYLES['Classic Dopp'], hair = HAIR[h];
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">${hair.back || ''}${face({ forehead: hair.forehead, brow: hair.brow })}${BEARD[b]}${hair.front || ''}</svg>`;
  };
})();
