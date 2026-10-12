// arcade_art.js — shared hand-drawn (ink outline) food & enemy sprites for the Sprite Arcade games.
// Usage: ART.draw(ctx, kind, x, y, size, t)   (x,y = centre, size ≈ width in px, t = time for wobble)
// Healthy: apple orange grape carrot broccoli banana water strawberry
// Junk:    soda burger donut candy fries cookie
// Other:   virus stress shield star heart
(function () {
  const INK = '#1A1030';
  const ART = {
    HEALTHY: ['apple', 'orange', 'grape', 'carrot', 'broccoli', 'banana', 'water', 'strawberry'],
    JUNK: ['soda', 'burger', 'donut', 'candy', 'fries', 'cookie'],
    NAMES: { apple: 'Apple', orange: 'Orange', grape: 'Grapes', carrot: 'Carrot', broccoli: 'Broccoli', banana: 'Banana', water: 'Water', strawberry: 'Strawberry',
             soda: 'Soda', burger: 'Burger', donut: 'Donut', candy: 'Candy', fries: 'Fries', cookie: 'Cookie' }
  };
  function ink(ctx, fill, lw) { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = INK; ctx.stroke(); }
  function rr(ctx, x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function shine(ctx, x, y, r) { ctx.fillStyle = 'rgba(255,255,255,.55)'; ctx.beginPath(); ctx.ellipse(x, y, r * 0.55, r, 0.4, 0, 7); ctx.fill(); }
  function eyes(ctx, x, y, s, mad) {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - s, y, s * 0.8, 0, 7); ctx.arc(x + s, y, s * 0.8, 0, 7); ctx.fill();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(x - s, y + s * 0.15, s * 0.4, 0, 7); ctx.arc(x + s, y + s * 0.15, s * 0.4, 0, 7); ctx.fill();
    if (mad) { ctx.lineWidth = Math.max(1.5, s * 0.35); ctx.strokeStyle = INK; ctx.beginPath(); ctx.moveTo(x - s * 1.7, y - s * 1.2); ctx.lineTo(x - s * 0.3, y - s * 0.6); ctx.moveTo(x + s * 1.7, y - s * 1.2); ctx.lineTo(x + s * 0.3, y - s * 0.6); ctx.stroke(); }
  }
  ART.draw = function (ctx, kind, x, y, size, t) {
    const s = size / 40, lw = Math.max(1.5, 3 * s);   // drawn on a 40px design grid
    t = t || 0;
    ctx.save(); ctx.translate(x, y); ctx.scale(s, s); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const L = 3;
    switch (kind) {
      case 'apple':
        ctx.beginPath(); ctx.moveTo(0, -10); ctx.bezierCurveTo(14, -20, 22, 0, 12, 14); ctx.bezierCurveTo(6, 20, -6, 20, -12, 14); ctx.bezierCurveTo(-22, 0, -14, -20, 0, -10); ink(ctx, '#FF5C77', L);
        ctx.fillStyle = '#7A3B1F'; ctx.fillRect(-1.5, -18, 3, 9);
        ctx.beginPath(); ctx.ellipse(7, -15, 7, 3.5, -0.5, 0, 7); ink(ctx, '#3FCB6B', 2); shine(ctx, -7, -3, 4); break;
      case 'strawberry':
        ctx.beginPath(); ctx.moveTo(0, 18); ctx.bezierCurveTo(-20, 4, -16, -14, 0, -12); ctx.bezierCurveTo(16, -14, 20, 4, 0, 18); ink(ctx, '#FF3B5C', L);
        ctx.fillStyle = '#FFE066'; [[-6, -3], [5, -4], [0, 4], [-4, 9], [6, 6]].forEach(([a, b]) => { ctx.beginPath(); ctx.ellipse(a, b, 1.3, 2, 0, 0, 7); ctx.fill(); });
        ctx.beginPath(); ctx.moveTo(-10, -12); ctx.lineTo(0, -18); ctx.lineTo(10, -12); ctx.lineTo(0, -8); ctx.closePath(); ink(ctx, '#3FCB6B', 2); break;
      case 'orange':
        ctx.beginPath(); ctx.arc(0, 2, 16, 0, 7); ink(ctx, '#FF9F43', L);
        ctx.fillStyle = 'rgba(122,59,31,.25)'; [[-6, 6], [5, 9], [7, -2], [-3, -4]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 1.2, 0, 7); ctx.fill(); });
        ctx.beginPath(); ctx.ellipse(5, -15, 6, 3, -0.4, 0, 7); ink(ctx, '#3FCB6B', 2); shine(ctx, -7, -4, 4); break;
      case 'grape':
        [[-7, -6], [7, -6], [0, -6], [-4, 3], [4, 3], [0, 12]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 7, 0, 7); ink(ctx, '#9b5de5', 2.5); });
        ctx.strokeStyle = '#3FCB6B'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(3, -19); ctx.stroke(); shine(ctx, -9, -8, 2.2); break;
      case 'carrot':
        ctx.beginPath(); ctx.moveTo(-9, -10); ctx.quadraticCurveTo(0, -14, 9, -10); ctx.lineTo(1, 19); ctx.lineTo(-1, 19); ctx.closePath(); ink(ctx, '#FF9F43', L);
        ctx.strokeStyle = 'rgba(122,59,31,.4)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(-5, -2); ctx.lineTo(1, -2); ctx.moveTo(-2, 7); ctx.lineTo(3, 7); ctx.stroke();
        ['#3FCB6B', '#2fae5a', '#3FCB6B'].forEach((c, i) => { ctx.beginPath(); ctx.ellipse((i - 1) * 5, -17, 3, 7, (i - 1) * 0.4, 0, 7); ink(ctx, c, 1.8); }); break;
      case 'broccoli':
        ctx.beginPath(); rr(ctx, -4, 0, 8, 18, 3); ink(ctx, '#8BC34A', 2.5);
        [[-9, -4, 9], [9, -4, 9], [0, -11, 10], [0, 0, 8]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a, b, r, 0, 7); ink(ctx, '#3FCB6B', 2.5); }); break;
      case 'banana':
        ctx.beginPath(); ctx.moveTo(-16, -8); ctx.quadraticCurveTo(-8, 20, 18, 4); ctx.quadraticCurveTo(-2, 10, -10, -10); ctx.closePath(); ink(ctx, '#FFD23F', L);
        ctx.fillStyle = '#7A3B1F'; ctx.fillRect(-17, -11, 4, 4); break;
      case 'water':
        ctx.beginPath(); ctx.moveTo(0, -19); ctx.bezierCurveTo(4, -8, 15, 0, 15, 8); ctx.arc(0, 8, 15, 0, Math.PI); ctx.bezierCurveTo(-15, 0, -4, -8, 0, -19); ink(ctx, '#38BFFF', L); shine(ctx, -6, 5, 4); break;
      case 'soda':
        ctx.beginPath(); rr(ctx, -11, -17, 22, 34, 5); ink(ctx, '#FF3B5C', L);
        ctx.fillStyle = '#fff'; ctx.fillRect(-9, -4, 18, 9); ctx.fillStyle = '#FF3B5C'; ctx.font = '900 7px Nunito,sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('SODA', 0, 1);
        ctx.fillStyle = '#c8c8d4'; ctx.fillRect(-9, -16, 18, 4); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(-8, -10, 3, 22); break;
      case 'burger':
        ctx.beginPath(); ctx.moveTo(-17, -2); ctx.quadraticCurveTo(-17, -17, 0, -17); ctx.quadraticCurveTo(17, -17, 17, -2); ctx.closePath(); ink(ctx, '#E9A44C', L);
        ctx.fillStyle = '#fff'; [[-7, -10], [0, -13], [7, -10]].forEach(([a, b]) => { ctx.beginPath(); ctx.ellipse(a, b, 1.6, 1, 0, 0, 7); ctx.fill(); });
        ctx.beginPath(); rr(ctx, -19, -2, 38, 5, 2); ink(ctx, '#3FCB6B', 2);
        ctx.beginPath(); rr(ctx, -17, 3, 34, 6, 3); ink(ctx, '#7A3B1F', 2.5);
        ctx.beginPath(); rr(ctx, -17, 9, 34, 7, 4); ink(ctx, '#E9A44C', 2.5); break;
      case 'donut':
        ctx.beginPath(); ctx.arc(0, 0, 17, 0, 7); ink(ctx, '#d9a066', L);
        ctx.beginPath(); ctx.arc(0, -1, 14, 0, 7); ctx.fillStyle = '#ff8fc7'; ctx.fill();
        ctx.beginPath(); ctx.arc(0, 0, 5.5, 0, 7); ink(ctx, '#1f1640', 2.5);
        ['#38BFFF', '#FFD700', '#00E5A0', '#fff', '#9b5de5'].forEach((c, i) => { ctx.save(); ctx.rotate(i * 1.26); ctx.fillStyle = c; ctx.fillRect(7, -1.5, 5, 3); ctx.restore(); }); break;
      case 'candy':
        ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(-19, -8); ctx.lineTo(-19, 8); ctx.closePath(); ink(ctx, '#FF4D9A', 2);
        ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(19, -8); ctx.lineTo(19, 8); ctx.closePath(); ink(ctx, '#FF4D9A', 2);
        ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ink(ctx, '#FFD23F', L);
        ctx.strokeStyle = '#FF4D9A'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(0, 0, 6, 0.3, 4); ctx.stroke(); break;
      case 'fries':
        for (let i = 0; i < 5; i++) { ctx.beginPath(); rr(ctx, -11 + i * 4.5, -18 + (i % 2) * 4, 4, 18, 1); ink(ctx, '#FFD23F', 1.5); }
        ctx.beginPath(); ctx.moveTo(-14, -4); ctx.lineTo(14, -4); ctx.lineTo(11, 18); ctx.lineTo(-11, 18); ctx.closePath(); ink(ctx, '#E63946', L);
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-5, 7, 2.2, 0, 7); ctx.arc(5, 7, 2.2, 0, 7); ctx.fill(); ctx.beginPath(); ctx.arc(0, 11, 2.2, 0, 7); ctx.fill(); break;
      case 'cookie':
        ctx.beginPath(); ctx.arc(0, 0, 16, 0, 7); ink(ctx, '#D9A066', L);
        ctx.fillStyle = '#5a3420'; [[-6, -6], [6, -3], [-2, 6], [8, 8], [-9, 4]].forEach(([a, b]) => { ctx.beginPath(); ctx.arc(a, b, 2.4, 0, 7); ctx.fill(); }); break;
      case 'virus': {
        const w = Math.sin(t * 5) * 1.5;
        ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
        for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4 + t * 0.6; ctx.beginPath(); ctx.moveTo(Math.cos(a) * 12, Math.sin(a) * 12); ctx.lineTo(Math.cos(a) * (19 + w), Math.sin(a) * (19 + w)); ctx.stroke();
          ctx.beginPath(); ctx.arc(Math.cos(a) * (19 + w), Math.sin(a) * (19 + w), 3, 0, 7); ink(ctx, '#B8F15A', 1.5); }
        ctx.beginPath(); ctx.arc(0, 0, 14, 0, 7); ink(ctx, '#7BD148', L); eyes(ctx, 0, -1, 4, true);
        ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 8, 4, Math.PI * 1.1, Math.PI * 1.9); ctx.stroke(); break; }
      case 'stress': {
        ctx.beginPath(); [[-10, 2, 10], [0, -6, 12], [11, 1, 10], [0, 6, 11]].forEach(([a, b, r]) => ctx.arc(a, b, r, 0, 7));
        ctx.fillStyle = '#6c6488'; ctx.fill(); ctx.lineWidth = L; ctx.strokeStyle = INK; ctx.stroke();
        [[-10, 2, 10], [0, -6, 12], [11, 1, 10], [0, 6, 11]].forEach(([a, b, r]) => { ctx.beginPath(); ctx.arc(a, b, r - 1.5, 0, 7); ctx.fillStyle = '#7d75a0'; ctx.fill(); });
        eyes(ctx, 0, 0, 3.5, true);
        ctx.strokeStyle = '#FFD700'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(4, 14); ctx.lineTo(0, 20); ctx.lineTo(4, 20); ctx.lineTo(0, 26); ctx.stroke(); break; }
      case 'shield':
        ctx.beginPath(); ctx.moveTo(0, -18); ctx.lineTo(15, -11); ctx.quadraticCurveTo(14, 10, 0, 18); ctx.quadraticCurveTo(-14, 10, -15, -11); ctx.closePath(); ink(ctx, '#38BFFF', L);
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(-1, 6); ctx.lineTo(7, -5); ctx.stroke(); break;
      case 'star':
        ctx.beginPath(); for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5 - Math.PI / 2, r = i % 2 ? 8 : 18; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); } ctx.closePath(); ink(ctx, '#FFD700', L); break;
      case 'heart':
        ctx.beginPath(); ctx.moveTo(0, 16); ctx.bezierCurveTo(-22, 2, -14, -18, 0, -7); ctx.bezierCurveTo(14, -18, 22, 2, 0, 16); ink(ctx, '#FF3B5C', L); shine(ctx, -7, -5, 3); break;
    }
    ctx.restore();
  };
  window.ART = ART;
})();
