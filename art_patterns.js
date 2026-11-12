// art_patterns.js — the 100 designs for the Art Studio (art_studio.html).
// Each design is a function (c, o) that draws over the box o.X0..o.X1, o.Y0..o.Y1.
// o.u = spacing unit, o.lw = line width, o.cx/o.cy = the area's center, o.R = its radius,
// o.fill = the area's background color, o.rnd() = seeded random (same picture every redraw).
(function () {
  var TAU = Math.PI * 2, PI = Math.PI;
  var PATS = [];
  function P(name, cat, fn, ang) { PATS.push({ name: name, cat: cat, fn: fn, ang: ang || 0 }); }

  // ---------- helpers ----------
  function ln(c, a, b, x, y) { c.beginPath(); c.moveTo(a, b); c.lineTo(x, y); c.stroke(); }
  function ci(c, x, y, r, f) { c.beginPath(); c.arc(x, y, Math.max(0.5, r), 0, TAU); f ? c.fill() : c.stroke(); }
  function el(c, x, y, rx, ry, rot, f) { c.beginPath(); c.ellipse(x, y, Math.max(.5, rx), Math.max(.5, ry), rot || 0, 0, TAU); f ? c.fill() : c.stroke(); }
  function poly(c, pts, f) { c.beginPath(); for (var i = 0; i < pts.length; i += 2) c.lineTo(pts[i], pts[i + 1]); c.closePath(); f ? c.fill() : c.stroke(); }
  function rows(o, step, fn) { var j = Math.floor(o.Y0 / step) - 1; for (var y = j * step; y <= o.Y1 + step; y += step, j++) fn(y, j); }
  function cols(o, step, fn) { var i = Math.floor(o.X0 / step) - 1; for (var x = i * step; x <= o.X1 + step; x += step, i++) fn(x, i); }
  function grid(o, sx, sy, fn, off) {
    rows(o, sy, function (y, j) { var sh = off && (j & 1) ? sx / 2 : 0; cols(o, sx, function (x, i) { fn(x + sh, y, i, j); }); });
  }
  function jgrid(o, s, fn) { grid(o, s, s, function (x, y, i, j) { fn(x + (o.rnd() - .5) * s * .5, y + (o.rnd() - .5) * s * .5, i, j); }, true); }
  function wave(c, o, y, amp, per, ph) {
    c.beginPath(); var st = per / 14, first = true;
    for (var x = o.X0 - per; x <= o.X1 + per; x += st) { var yy = y + Math.sin(x / per * TAU + (ph || 0)) * amp; first ? c.moveTo(x, yy) : c.lineTo(x, yy); first = false; }
    c.stroke();
  }
  function zig(c, o, y, amp, per) {
    c.beginPath(); var h = per / 2, k = Math.floor(o.X0 / h) - 2;
    for (var x = k * h; x <= o.X1 + per; x += h, k++) c.lineTo(x, y + ((k & 1) ? amp : -amp));
    c.stroke();
  }
  function star(c, x, y, r, ri, n, f) {
    c.beginPath();
    for (var k = 0; k < n * 2; k++) { var a = -PI / 2 + k * PI / n, rr = k & 1 ? ri : r; c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    c.closePath(); f ? c.fill() : c.stroke();
  }
  function tri(c, x, y, r, f) { poly(c, [x, y - r, x + r * .866, y + r * .5, x - r * .866, y + r * .5], f); }
  function heart(c, x, y, s) {
    c.beginPath(); c.moveTo(x, y + s * .9);
    c.bezierCurveTo(x - s * 1.3, y + s * .1, x - s * .7, y - s * .9, x, y - s * .35);
    c.bezierCurveTo(x + s * .7, y - s * .9, x + s * 1.3, y + s * .1, x, y + s * .9); c.fill();
  }
  function lineSet(c, o, ang, step) {
    var mx = (o.X0 + o.X1) / 2, my = (o.Y0 + o.Y1) / 2, R = Math.max(o.X1 - o.X0, o.Y1 - o.Y0) * .75;
    var dx = Math.cos(ang), dy = Math.sin(ang), nx = -dy, ny = dx;
    for (var k = -Math.ceil(R / step) * step; k <= R; k += step) {
      var px = mx + nx * k, py = my + ny * k; ln(c, px - dx * R, py - dy * R, px + dx * R, py + dy * R);
    }
  }
  function area(o) { return (o.X1 - o.X0) * (o.Y1 - o.Y0); }
  function stripes(step) { return function (c, o) { rows(o, o.u * step, function (y) { ln(c, o.X0, y, o.X1, y); }); }; }
  function bands(step, w) { return function (c, o) { rows(o, o.u * step, function (y) { c.fillRect(o.X0, y, o.X1 - o.X0, o.u * w); }); }; }
  function gridL(step, lwm) {
    return function (c, o) {
      c.lineWidth = o.lw * (lwm || 1); var s = o.u * step;
      rows(o, s, function (y) { ln(c, o.X0, y, o.X1, y); }); cols(o, s, function (x) { ln(c, x, o.Y0, x, o.Y1); });
    };
  }
  function checker(step) { return function (c, o) { var s = o.u * step; grid(o, s, s, function (x, y, i, j) { if ((i + j) & 1) c.fillRect(x, y, s, s); }); }; }

  // ================= LINES (20) =================
  P('Thin stripes', 'lines', stripes(.8));
  P('Bold stripes', 'lines', bands(1.6, .7));
  P('Vertical stripes', 'lines', stripes(.8), 90);
  P('Vertical bands', 'lines', bands(1.6, .7), 90);
  P('Diagonal lines', 'lines', stripes(.8), -45);
  P('Diagonal bands', 'lines', bands(1.8, .75), -45);
  P('Slanted lines', 'lines', stripes(.8), 45);
  P('Candy stripes', 'lines', bands(2.2, 1), 45);
  P('Double lines', 'lines', function (c, o) { rows(o, o.u * 1.7, function (y) { ln(c, o.X0, y, o.X1, y); ln(c, o.X0, y + o.u * .4, o.X1, y + o.u * .4); }); });
  P('Dashed lines', 'lines', function (c, o) {
    c.setLineDash([o.u * .6, o.u * .45]);
    rows(o, o.u * .9, function (y, j) { c.lineDashOffset = (j & 1) ? o.u * .5 : 0; ln(c, o.X0, y, o.X1, y); });
    c.setLineDash([]); c.lineDashOffset = 0;
  });
  P('Grid', 'lines', gridL(1));
  P('Diamond lattice', 'lines', gridL(1.1), 45);
  P('Fine crosshatch', 'lines', gridL(.55, .7), 30);
  P('Plaid', 'lines', function (c, o) {
    var s = o.u * 2.6; c.globalAlpha = .35;
    rows(o, s, function (y) { c.fillRect(o.X0, y, o.X1 - o.X0, o.u); });
    cols(o, s, function (x) { c.fillRect(x, o.Y0, o.u, o.Y1 - o.Y0); });
    c.globalAlpha = 1; c.lineWidth = o.lw * .7;
    rows(o, s, function (y) { ln(c, o.X0, y + o.u * 1.7, o.X1, y + o.u * 1.7); });
    cols(o, s, function (x) { ln(c, x + o.u * 1.7, o.Y0, x + o.u * 1.7, o.Y1); });
  });
  P('Basket weave', 'lines', function (c, o) {
    var s = o.u * 1.8;
    grid(o, s, s, function (x, y, i, j) {
      for (var k = 1; k < 4; k++) { var d = s * k / 4; if ((i + j) & 1) ln(c, x + d, y + s * .12, x + d, y + s * .88); else ln(c, x + s * .12, y + d, x + s * .88, y + d); }
    });
  });
  P('Bricks', 'lines', function (c, o) {
    var h = o.u * 1.1, w = h * 2;
    rows(o, h, function (y, j) { ln(c, o.X0, y, o.X1, y); var sh = (j & 1) ? w / 2 : 0; cols(o, w, function (x) { ln(c, x + sh, y, x + sh, y + h); }); });
  });
  P('Ladder', 'lines', function (c, o) {
    var s = o.u * 2.4, g = o.u * .9;
    cols(o, s, function (x) { ln(c, x, o.Y0, x, o.Y1); ln(c, x + g, o.Y0, x + g, o.Y1); rows(o, o.u * .6, function (y) { ln(c, x, y, x + g, y); }); });
  });
  P('Rainbow arches', 'lines', function (c, o) {
    var s = o.u * 3.2;
    grid(o, s, s * .9, function (x, y) {
      for (var k = 1; k <= 3; k++) { c.beginPath(); c.arc(x, y + s * .35, s * .15 * k, PI, 0); c.stroke(); }
    }, true);
  });
  P('Wood grain', 'lines', function (c, o) {
    var s = o.u * .75;
    rows(o, s, function (y, j) {
      c.beginPath(); var first = true;
      for (var x = o.X0; x <= o.X1 + o.u; x += o.u * .3) {
        var yy = y + Math.sin(x / (o.u * 4) + j * .5) * o.u * .35 + Math.sin(x / (o.u * 9) + j * .13) * o.u * .5;
        first ? c.moveTo(x, yy) : c.lineTo(x, yy); first = false;
      }
      c.stroke();
    });
  });
  P('Hatch blocks', 'lines', function (c, o) {
    var s = o.u * 1.6;
    grid(o, s, s, function (x, y, i, j) {
      for (var k = 1; k < 5; k++) {
        var t = s * k / 5;
        if ((i + j) & 1) ln(c, x + t - s * .15, y + s * .85, x + t + s * .15, y + s * .15);
        else ln(c, x + t - s * .15, y + s * .15, x + t + s * .15, y + s * .85);
      }
    });
  });

  // ================= WAVES & ZIGZAGS (14) =================
  P('Zigzag', 'waves', function (c, o) { rows(o, o.u * 1.1, function (y) { zig(c, o, y, o.u * .35, o.u * 1.1); }); });
  P('Big zigzag', 'waves', function (c, o) { c.lineWidth = o.lw * 1.6; rows(o, o.u * 2.6, function (y) { zig(c, o, y, o.u * .9, o.u * 1.8); }); });
  P('Chevrons', 'waves', function (c, o) { c.lineWidth = o.u * .55; c.lineJoin = 'miter'; c.lineCap = 'butt'; rows(o, o.u * 1.9, function (y) { zig(c, o, y, o.u * .55, o.u * 1.6); }); });
  P('Gentle waves', 'waves', function (c, o) { rows(o, o.u, function (y) { wave(c, o, y, o.u * .35, o.u * 3); }); });
  P('Tight waves', 'waves', function (c, o) { rows(o, o.u * .7, function (y) { wave(c, o, y, o.u * .22, o.u * 1.2); }); });
  P('Fish scales', 'waves', function (c, o) {
    var s = o.u * 1.4;
    grid(o, s, s * .5, function (x, y) { c.beginPath(); c.arc(x, y, s / 2, 0, PI); c.stroke(); }, true);
  });
  P('Squiggles', 'waves', function (c, o) {
    var s = o.u * 2;
    grid(o, s, s * .8, function (x, y) {
      c.beginPath();
      for (var t = 0; t <= 1.001; t += .05) { var xx = x - s * .35 + t * s * .7, yy = y + Math.sin(t * TAU * 1.5) * o.u * .22; t ? c.lineTo(xx, yy) : c.moveTo(xx, yy); }
      c.stroke();
    }, true);
  });
  P('Loops', 'waves', function (c, o) {
    var r = o.u * .13, d = o.u * .4;
    rows(o, o.u * 1.5, function (y) {
      c.beginPath(); var first = true;
      for (var t = (o.X0 - d) / r - 6; r * t - d <= o.X1 + d; t += .15) {
        var x = r * t - d * Math.sin(t), yy = y - d * Math.cos(t);
        first ? c.moveTo(x, yy) : c.lineTo(x, yy); first = false;
      }
      c.stroke();
    });
  });
  P('Sawtooth', 'waves', function (c, o) {
    var p = o.u * 1.1, a = o.u * .45;
    rows(o, o.u * 1.3, function (y) { c.beginPath(); cols(o, p, function (x) { c.lineTo(x, y + a); c.lineTo(x + p, y - a); c.lineTo(x + p, y + a); }); c.stroke(); });
  });
  P('Lightning band', 'waves', function (c, o) {
    rows(o, o.u * 3, function (y) { zig(c, o, y, o.u * .8, o.u * 1.6); zig(c, o, y + o.u * .7, o.u * .8, o.u * 1.6); });
  });
  P('Bumps', 'waves', function (c, o) {
    var r = o.u * .4;
    rows(o, o.u * 1.3, function (y) { c.beginPath(); cols(o, r * 2, function (x) { c.arc(x + r, y, r, PI, 0); }); c.stroke(); });
  });
  P('Braids', 'waves', function (c, o) { rows(o, o.u * 1.8, function (y) { wave(c, o, y, o.u * .4, o.u * 2); wave(c, o, y, o.u * .4, o.u * 2, PI); }); });
  P('Square waves', 'waves', function (c, o) {
    var p = o.u * 1.2, a = o.u * .45;
    rows(o, o.u * 1.6, function (y) { c.beginPath(); cols(o, p, function (x, i) { var s = (i & 1) ? a : -a; c.lineTo(x, y - s); c.lineTo(x, y + s); }); c.stroke(); });
  });
  P('Little swirls', 'waves', function (c, o) {
    var s = o.u * 2.2;
    grid(o, s, s, function (x, y) {
      c.beginPath();
      for (var t = 0; t <= TAU * 2.4; t += .2) { var r = t / (TAU * 2.4) * s * .38; c.lineTo(x + Math.cos(t) * r, y + Math.sin(t) * r); }
      c.stroke();
    }, true);
  });

  // ================= DOTS & CIRCLES (13) =================
  P('Tiny dots', 'dots', function (c, o) { var s = o.u * .8; grid(o, s, s, function (x, y) { ci(c, x, y, o.lw * .7, 1); }, true); });
  P('Polka dots', 'dots', function (c, o) { var s = o.u * 2; grid(o, s, s, function (x, y) { ci(c, x, y, o.u * .4, 1); }, true); });
  P('Dot grid', 'dots', function (c, o) { var s = o.u * 1.2; grid(o, s, s, function (x, y) { ci(c, x, y, o.u * .16, 1); }); });
  P('Circles', 'dots', function (c, o) { var s = o.u * 1.7; grid(o, s, s, function (x, y) { ci(c, x, y, o.u * .5); }, true); });
  P('Targets', 'dots', function (c, o) {
    var s = o.u * 2.6; grid(o, s, s, function (x, y) { ci(c, x, y, o.u * .95); ci(c, x, y, o.u * .55); ci(c, x, y, o.u * .18, 1); }, true);
  });
  P('Bubbles', 'dots', function (c, o) {
    var n = area(o) / (o.u * o.u * 2.5);
    for (var i = 0; i < n; i++) ci(c, o.X0 + o.rnd() * (o.X1 - o.X0), o.Y0 + o.rnd() * (o.Y1 - o.Y0), o.u * (.15 + o.rnd() * .6));
  });
  P('Dotted rows', 'dots', function (c, o) { rows(o, o.u, function (y) { cols(o, o.u * .45, function (x) { ci(c, x, y, o.lw * .6, 1); }); }); });
  P('Chain rings', 'dots', function (c, o) { c.lineWidth = o.lw * .8; var s = o.u * 1.2; grid(o, s, s, function (x, y) { ci(c, x, y, o.u * .85); }); });
  P('Half circles', 'dots', function (c, o) {
    var s = o.u * 1.7;
    grid(o, s, s, function (x, y, i, j) { var a = ((i + j) & 1) ? 0 : PI; c.beginPath(); c.arc(x, y, o.u * .5, a, a + PI); c.closePath(); c.fill(); }, true);
  });
  P('Pebbles', 'dots', function (c, o) { jgrid(o, o.u * 1.5, function (x, y) { el(c, x, y, o.u * (.3 + o.rnd() * .25), o.u * (.2 + o.rnd() * .2), o.rnd() * PI); }); });
  P('Donuts', 'dots', function (c, o) { c.lineWidth = o.u * .28; var s = o.u * 2.1; grid(o, s, s, function (x, y) { ci(c, x, y, o.u * .5); }, true); });
  P('Seeds', 'dots', function (c, o) { jgrid(o, o.u * 1.1, function (x, y) { el(c, x, y, o.u * .32, o.u * .13, o.rnd() * PI, 1); }); });
  P('Dot flowers', 'dots', function (c, o) {
    var s = o.u * 2.2;
    grid(o, s, s, function (x, y) { ci(c, x, y, o.u * .15, 1); for (var k = 0; k < 6; k++) { var a = k * TAU / 6; ci(c, x + Math.cos(a) * o.u * .45, y + Math.sin(a) * o.u * .45, o.u * .12, 1); } }, true);
  });

  // ================= SHAPES (18) =================
  P('Checkerboard', 'shapes', checker(1.3));
  P('Argyle', 'shapes', checker(1.3), 45);
  P('Triangle row', 'shapes', function (c, o) {
    var s = o.u * 1.7; grid(o, s, s, function (x, y) { poly(c, [x, y - o.u * .45, x + o.u * .5, y + o.u * .4, x - o.u * .5, y + o.u * .4], 1); }, true);
  });
  P('Triangle tiles', 'shapes', function (c, o) { var s = o.u * 1.3; lineSet(c, o, 0, s); lineSet(c, o, PI / 3, s); lineSet(c, o, -PI / 3, s); });
  P('Honeycomb', 'shapes', function (c, o) {
    var r = o.u * .75, w = Math.sqrt(3) * r;
    grid(o, w, r * 1.5, function (x, y) {
      c.beginPath(); for (var k = 0; k < 6; k++) { var a = PI / 6 + k * PI / 3; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); } c.closePath(); c.stroke();
    }, true);
  });
  P('Stars', 'shapes', function (c, o) { var s = o.u * 2.3; grid(o, s, s, function (x, y) { star(c, x, y, o.u * .6, o.u * .25, 5, 1); }, true); });
  P('Hearts', 'shapes', function (c, o) { var s = o.u * 2.3; grid(o, s, s, function (x, y) { heart(c, x, y, o.u * .5); }, true); });
  P('Plus signs', 'shapes', function (c, o) {
    c.lineWidth = o.lw * 1.3; var s = o.u * 1.6, a = o.u * .35;
    grid(o, s, s, function (x, y) { ln(c, x - a, y, x + a, y); ln(c, x, y - a, x, y + a); }, true);
  });
  P('X marks', 'shapes', function (c, o) {
    c.lineWidth = o.lw * 1.3; var s = o.u * 1.6, a = o.u * .28;
    grid(o, s, s, function (x, y) { ln(c, x - a, y - a, x + a, y + a); ln(c, x + a, y - a, x - a, y + a); }, true);
  });
  P('Squares', 'shapes', function (c, o) { var s = o.u * 1.8, h = o.u * .48; grid(o, s, s, function (x, y) { c.strokeRect(x - h, y - h, h * 2, h * 2); }); });
  P('Nested squares', 'shapes', function (c, o) {
    var s = o.u * 2.6;
    grid(o, s, s, function (x, y) { var a = o.u * .9, b = o.u * .55, d = o.u * .22; c.strokeRect(x - a, y - a, a * 2, a * 2); c.strokeRect(x - b, y - b, b * 2, b * 2); c.fillRect(x - d, y - d, d * 2, d * 2); });
  });
  P('Arrows', 'shapes', function (c, o) {
    var s = o.u * 2, u = o.u;
    grid(o, s, s, function (x, y) { ln(c, x - u * .5, y, x + u * .4, y); ln(c, x + u * .4, y, x + u * .1, y - u * .3); ln(c, x + u * .4, y, x + u * .1, y + u * .3); }, true);
  });
  P('Crescent moons', 'shapes', function (c, o) {
    var s = o.u * 2.2, r = o.u * .5, d = r * .6, h = Math.sqrt(r * r - d * d / 4), a = Math.atan2(h, d / 2), b = Math.atan2(h, -d / 2);
    grid(o, s, s, function (x, y) { c.beginPath(); c.arc(x, y, r, a, TAU - a, false); c.arc(x + d, y, r, TAU - b, b, true); c.closePath(); c.fill(); }, true);
  });
  P('Diamonds', 'shapes', function (c, o) {
    var s = o.u * 1.6, u = o.u;
    grid(o, s, s, function (x, y) { poly(c, [x, y - u * .6, x + u * .4, y, x, y + u * .6, x - u * .4, y]); }, true);
  });
  P('Nested triangles', 'shapes', function (c, o) {
    var s = o.u * 2.6; grid(o, s, s * .9, function (x, y) { tri(c, x, y, o.u * 1.05); tri(c, x, y, o.u * .62); tri(c, x, y, o.u * .25, 1); }, true);
  });
  P('Music notes', 'shapes', function (c, o) {
    var s = o.u * 2.4, u = o.u;
    grid(o, s, s, function (x, y) {
      el(c, x, y + u * .35, u * .22, u * .16, -.4, 1); ln(c, x + u * .2, y + u * .3, x + u * .2, y - u * .5);
      c.beginPath(); c.moveTo(x + u * .2, y - u * .5); c.quadraticCurveTo(x + u * .55, y - u * .3, x + u * .45, y - u * .05); c.stroke();
    }, true);
  });
  P('Smiles', 'shapes', function (c, o) {
    var s = o.u * 2.4, u = o.u;
    grid(o, s, s, function (x, y) {
      ci(c, x, y, u * .55); ci(c, x - u * .2, y - u * .13, o.lw * .8, 1); ci(c, x + u * .2, y - u * .13, o.lw * .8, 1);
      c.beginPath(); c.arc(x, y + u * .02, u * .3, .2 * PI, .8 * PI); c.stroke();
    }, true);
  });
  P('Raindrops', 'shapes', function (c, o) {
    var s = o.u * 1.8, u = o.u;
    grid(o, s, s, function (x, y) {
      c.beginPath(); c.moveTo(x, y - u * .55); c.bezierCurveTo(x + u * .1, y - u * .3, x + u * .32, y - u * .05, x + u * .32, y + u * .18);
      c.arc(x, y + u * .18, u * .32, 0, PI); c.bezierCurveTo(x - u * .32, y - u * .05, x - u * .1, y - u * .3, x, y - u * .55); c.fill();
    }, true);
  });

  // ================= NATURE & FLOWERS (15) =================
  P('Daisies', 'nature', function (c, o) {
    var s = o.u * 2.6, r = o.u * .8;
    grid(o, s, s, function (x, y) {
      for (var k = 0; k < 8; k++) { var a = k * TAU / 8; el(c, x + Math.cos(a) * r * .55, y + Math.sin(a) * r * .55, r * .38, r * .15, a); }
      ci(c, x, y, r * .18, 1);
    }, true);
  });
  P('Five-petal flowers', 'nature', function (c, o) {
    var s = o.u * 2.4, u = o.u;
    grid(o, s, s, function (x, y) {
      for (var k = 0; k < 5; k++) { var a = -PI / 2 + k * TAU / 5; ci(c, x + Math.cos(a) * u * .32, y + Math.sin(a) * u * .32, u * .26, 1); }
      var keep = c.fillStyle; c.fillStyle = o.fill; ci(c, x, y, u * .16, 1); c.fillStyle = keep; ci(c, x, y, u * .16);
    }, true);
  });
  P('Tulips', 'nature', function (c, o) {
    var s = o.u * 2.6, u = o.u;
    grid(o, s, s, function (x, y) {
      c.beginPath(); c.moveTo(x - u * .35, y - u * .45); c.lineTo(x - u * .15, y - u * .22); c.lineTo(x, y - u * .5); c.lineTo(x + u * .15, y - u * .22); c.lineTo(x + u * .35, y - u * .45);
      c.quadraticCurveTo(x + u * .38, y + u * .05, x, y + u * .08); c.quadraticCurveTo(x - u * .38, y + u * .05, x - u * .35, y - u * .45); c.fill();
      ln(c, x, y + u * .05, x, y + u * .75); el(c, x + u * .2, y + u * .48, u * .22, u * .08, -.6, 1);
    }, true);
  });
  P('Blossoms', 'nature', function (c, o) {
    var s = o.u * 2.2, u = o.u;
    grid(o, s, s, function (x, y) { for (var k = 0; k < 4; k++) { var a = PI / 4 + k * PI / 2; el(c, x + Math.cos(a) * u * .32, y + Math.sin(a) * u * .32, u * .32, u * .17, a); } ci(c, x, y, u * .1, 1); }, true);
  });
  P('Leaves', 'nature', function (c, o) {
    var u = o.u;
    jgrid(o, u * 1.9, function (x, y) {
      c.save(); c.translate(x, y); c.rotate(o.rnd() * TAU);
      c.beginPath(); c.moveTo(-u * .55, 0); c.quadraticCurveTo(0, -u * .45, u * .55, 0); c.quadraticCurveTo(0, u * .45, -u * .55, 0); c.stroke();
      ln(c, -u * .55, 0, u * .4, 0); c.restore();
    });
  });
  P('Vines', 'nature', function (c, o) {
    var u = o.u, per = u * 3, amp = u * .4;
    rows(o, u * 2.8, function (y) {
      wave(c, o, y, amp, per);
      cols(o, u * .75, function (x, i) { var yy = y + Math.sin(x / per * TAU) * amp, sd = (i & 1) ? 1 : -1; el(c, x, yy + sd * u * .28, u * .28, u * .11, sd * .7, 1); });
    });
  });
  P('Ferns', 'nature', function (c, o) {
    var s = o.u * 3, u = o.u;
    grid(o, s, s, function (x, y) {
      ln(c, x, y - u * .95, x, y + u * .95);
      for (var k = -3; k <= 3; k++) { var t = y + k * u * .26, L = u * .5 * (1 - Math.abs(k) / 4.5); ln(c, x, t, x - L, t - u * .25); ln(c, x, t, x + L, t - u * .25); }
    }, true);
  });
  P('Snowflakes', 'nature', function (c, o) {
    var s = o.u * 2.6, u = o.u;
    grid(o, s, s, function (x, y) {
      for (var k = 0; k < 6; k++) {
        var a = k * PI / 3, ca = Math.cos(a), sa = Math.sin(a);
        ln(c, x, y, x + ca * u * .7, y + sa * u * .7);
        var bx = x + ca * u * .42, by = y + sa * u * .42;
        ln(c, bx, by, bx + Math.cos(a + .7) * u * .2, by + Math.sin(a + .7) * u * .2); ln(c, bx, by, bx + Math.cos(a - .7) * u * .2, by + Math.sin(a - .7) * u * .2);
      }
    }, true);
  });
  P('Suns', 'nature', function (c, o) {
    var s = o.u * 2.6, u = o.u;
    grid(o, s, s, function (x, y) { ci(c, x, y, u * .3, 1); for (var k = 0; k < 8; k++) { var a = k * TAU / 8; ln(c, x + Math.cos(a) * u * .42, y + Math.sin(a) * u * .42, x + Math.cos(a) * u * .68, y + Math.sin(a) * u * .68); } }, true);
  });
  P('Grass', 'nature', function (c, o) {
    var u = o.u;
    rows(o, u * 1.3, function (y) {
      cols(o, u * .9, function (x) {
        var jx = x + (o.rnd() - .5) * u * .4;
        [[-.25, -.6], [0, -.75], [.25, -.6]].forEach(function (b) { c.beginPath(); c.moveTo(jx, y); c.quadraticCurveTo(jx + b[0] * u * .2, y + b[1] * u * .5, jx + b[0] * u, y + b[1] * u); c.stroke(); });
      });
    });
  });
  P('Clovers', 'nature', function (c, o) {
    var s = o.u * 2.2, u = o.u;
    grid(o, s, s, function (x, y) {
      [-90, 30, 150].forEach(function (d) { var a = d * PI / 180; ci(c, x + Math.cos(a) * u * .22, y + Math.sin(a) * u * .22, u * .2, 1); });
      c.beginPath(); c.moveTo(x, y); c.quadraticCurveTo(x + u * .05, y + u * .4, x + u * .2, y + u * .6); c.stroke();
    }, true);
  });
  P('Fish', 'nature', function (c, o) {
    var s = o.u * 2.6, u = o.u;
    grid(o, s, s, function (x, y) { el(c, x, y, u * .45, u * .25); poly(c, [x + u * .4, y, x + u * .7, y - u * .25, x + u * .7, y + u * .25]); ci(c, x - u * .22, y - u * .05, o.lw * .7, 1); }, true);
  });
  P('Sparkles', 'nature', function (c, o) { jgrid(o, o.u * 2.2, function (x, y) { var k = .6 + o.rnd() * .5; star(c, x, y, o.u * .55 * k, o.u * .12 * k, 4, 1); }); });
  P('Butterflies', 'nature', function (c, o) {
    var s = o.u * 2.8, u = o.u;
    grid(o, s, s, function (x, y) {
      el(c, x - u * .28, y - u * .18, u * .28, u * .2, -.5); el(c, x + u * .28, y - u * .18, u * .28, u * .2, .5);
      el(c, x - u * .2, y + u * .2, u * .2, u * .14, .5); el(c, x + u * .2, y + u * .2, u * .2, u * .14, -.5);
      var w = c.lineWidth; c.lineWidth = w * 1.6; ln(c, x, y - u * .35, x, y + u * .35); c.lineWidth = w;
    }, true);
  });
  P('Pine trees', 'nature', function (c, o) {
    var s = o.u * 2, u = o.u;
    grid(o, s, s * 1.1, function (x, y) { poly(c, [x, y - u * .7, x + u * .45, y + u * .3, x - u * .45, y + u * .3]); ln(c, x, y + u * .3, x, y + u * .6); }, true);
  });

  // ================= CENTER DESIGNS (15) — built around the middle of the space =================
  P('Big spiral', 'center', function (c, o) {
    var step = o.u * .9; c.beginPath();
    for (var t = 0, r = 0; r < o.R; t += .06) { r = t / TAU * step; c.lineTo(o.cx + Math.cos(t) * r, o.cy + Math.sin(t) * r); }
    c.stroke();
  });
  P('Bullseye', 'center', function (c, o) { for (var r = o.u * .5; r < o.R; r += o.u * .9) ci(c, o.cx, o.cy, r); });
  P('Concentric diamonds', 'center', function (c, o) {
    for (var d = o.u * .6; d < o.R * 1.45; d += o.u * .9) poly(c, [o.cx, o.cy - d, o.cx + d, o.cy, o.cx, o.cy + d, o.cx - d, o.cy]);
  });
  P('Concentric squares', 'center', function (c, o) { for (var d = o.u * .4; d < o.R; d += o.u * .8) c.strokeRect(o.cx - d, o.cy - d, d * 2, d * 2); });
  P('Starburst', 'center', function (c, o) { for (var k = 0; k < 28; k++) { var a = k * TAU / 28; ln(c, o.cx, o.cy, o.cx + Math.cos(a) * o.R * 1.2, o.cy + Math.sin(a) * o.R * 1.2); } });
  P('Pinwheel', 'center', function (c, o) {
    for (var k = 0; k < 12; k++) {
      var a = k * TAU / 12, R = o.R * 1.15;
      c.beginPath(); c.moveTo(o.cx, o.cy); c.quadraticCurveTo(o.cx + Math.cos(a + .7) * R * .5, o.cy + Math.sin(a + .7) * R * .5, o.cx + Math.cos(a) * R, o.cy + Math.sin(a) * R); c.stroke();
    }
  });
  P('Sunburst', 'center', function (c, o) {
    for (var k = 0; k < 32; k += 2) { var a = k * TAU / 32; c.beginPath(); c.moveTo(o.cx, o.cy); c.arc(o.cx, o.cy, o.R * 1.3, a, a + TAU / 32); c.closePath(); c.fill(); }
  });
  P('Ovals', 'center', function (c, o) {
    var k = Math.min(1.8, Math.max(.55, o.bw / Math.max(1, o.bh)));
    for (var d = o.u * .4; d < o.R * 1.3; d += o.u * .8) el(c, o.cx, o.cy, d * Math.sqrt(k), d / Math.sqrt(k), 0);
  });
  P('Square spiral', 'center', function (c, o) {
    var x = o.cx, y = o.cy, step = o.u * .8, len = step, dir = 0; c.beginPath(); c.moveTo(x, y);
    for (var k = 0; len < o.R * 2.2; k++) {
      x += [1, 0, -1, 0][dir] * len; y += [0, 1, 0, -1][dir] * len; c.lineTo(x, y);
      dir = (dir + 1) % 4; if (k & 1) len += step;
    }
    c.stroke();
  });
  P('Mandala', 'center', function (c, o) {
    var u = o.u; ci(c, o.cx, o.cy, u * .4, 1);
    for (var i = 1; i * u * 1.5 < o.R; i++) {
      var rad = i * u * 1.5, n = 6 * i;
      for (var k = 0; k < n; k++) { var a = k * TAU / n + (i & 1) * PI / n; el(c, o.cx + Math.cos(a) * rad, o.cy + Math.sin(a) * rad, u * .55, u * .22, a); }
      ci(c, o.cx, o.cy, rad + u * .75);
    }
  });
  P('Spider web', 'center', function (c, o) {
    var n = 10, R = o.R * 1.2;
    for (var k = 0; k < n; k++) { var a = k * TAU / n; ln(c, o.cx, o.cy, o.cx + Math.cos(a) * R, o.cy + Math.sin(a) * R); }
    for (var r = o.u; r < R; r += o.u * 1.1) {
      c.beginPath();
      for (k = 0; k <= n; k++) {
        var a1 = k * TAU / n, px = o.cx + Math.cos(a1) * r, py = o.cy + Math.sin(a1) * r;
        if (!k) { c.moveTo(px, py); continue; }
        var am = (k - .5) * TAU / n; c.quadraticCurveTo(o.cx + Math.cos(am) * r * .82, o.cy + Math.sin(am) * r * .82, px, py);
      }
      c.stroke();
    }
  });
  P('Spirograph', 'center', function (c, o) {
    var A = 10, B = 3, D = 5, sc = o.R * .95 / (A - B + D); c.lineWidth = Math.max(1, o.lw * .7); c.beginPath();
    for (var t = 0; t <= TAU * 3 + .01; t += .02) c.lineTo(o.cx + sc * ((A - B) * Math.cos(t) + D * Math.cos((A - B) / B * t)), o.cy + sc * ((A - B) * Math.sin(t) - D * Math.sin((A - B) / B * t)));
    c.stroke();
  });
  P('Sunrise', 'center', function (c, o) {
    var x = o.cx, y = o.cy + o.R * .45;
    for (var k = 0; k <= 16; k++) { var a = PI + k * PI / 16; ln(c, x, y, x + Math.cos(a) * o.R * 2, y + Math.sin(a) * o.R * 2); }
    for (var r = o.u * 1.2; r < o.R * .8; r += o.u * 1.2) { c.beginPath(); c.arc(x, y, r, PI, TAU); c.stroke(); }
  });
  P('Wavy rings', 'center', function (c, o) {
    for (var r = o.u; r < o.R; r += o.u) {
      c.beginPath(); for (var t = 0; t <= TAU + .01; t += .05) { var rr = r + Math.sin(t * 9) * o.u * .18; c.lineTo(o.cx + Math.cos(t) * rr, o.cy + Math.sin(t) * rr); } c.stroke();
    }
  });
  P('Star lines', 'center', function (c, o) {
    var R = o.R * 1.2;
    for (var k = 0; k < 4; k++) { var a = k * PI / 4; ln(c, o.cx - Math.cos(a) * R, o.cy - Math.sin(a) * R, o.cx + Math.cos(a) * R, o.cy + Math.sin(a) * R); }
    ci(c, o.cx, o.cy, o.u * .5, 1);
  });

  // ================= TEXTURES (5) =================
  P('Crayon shading', 'texture', function (c, o) {
    var n = area(o) / (o.u * o.u * .25), L = o.u * .5; c.globalAlpha = .35; c.lineWidth = o.lw * .8;
    for (var i = 0; i < n; i++) { var x = o.X0 + o.rnd() * (o.X1 - o.X0), y = o.Y0 + o.rnd() * (o.Y1 - o.Y0), a = -.9 + (o.rnd() - .5) * .6; ln(c, x, y, x + Math.cos(a) * L, y + Math.sin(a) * L); }
    c.globalAlpha = 1;
  });
  P('Scribble', 'texture', function (c, o) {
    var n = area(o) / (o.u * o.u * .3), x = (o.X0 + o.X1) / 2, y = (o.Y0 + o.Y1) / 2, a = o.rnd() * TAU, st = o.u * .45;
    c.lineWidth = o.lw * .8; c.beginPath(); c.moveTo(x, y);
    for (var i = 0; i < n; i++) {
      a += (o.rnd() - .5) * 1.4; x += Math.cos(a) * st; y += Math.sin(a) * st;
      if (x < o.X0 || x > o.X1 || y < o.Y0 || y > o.Y1) { a = Math.atan2((o.Y0 + o.Y1) / 2 - y, (o.X0 + o.X1) / 2 - x) + (o.rnd() - .5); }
      c.lineTo(x, y);
    }
    c.stroke();
  });
  P('Stipple', 'texture', function (c, o) {
    var n = Math.min(40000, area(o) / (o.u * o.u * .35));
    for (var i = 0; i < n; i++) ci(c, o.X0 + o.rnd() * (o.X1 - o.X0), o.Y0 + o.rnd() * (o.Y1 - o.Y0), o.lw * .5, 1);
  });
  P('Confetti', 'texture', function (c, o) {
    var n = area(o) / (o.u * o.u * 1.1), L = o.u * .22;
    for (var i = 0; i < n; i++) { var x = o.X0 + o.rnd() * (o.X1 - o.X0), y = o.Y0 + o.rnd() * (o.Y1 - o.Y0), a = o.rnd() * PI; ln(c, x - Math.cos(a) * L, y - Math.sin(a) * L, x + Math.cos(a) * L, y + Math.sin(a) * L); }
  });
  P('Rain', 'texture', function (c, o) {
    var n = area(o) / (o.u * o.u * .9), L = o.u * .35;
    for (var i = 0; i < n; i++) { var x = o.X0 + o.rnd() * (o.X1 - o.X0), y = o.Y0 + o.rnd() * (o.Y1 - o.Y0); ln(c, x, y, x - L * .25, y + L); }
  });

  window.ART_PATTERNS = PATS;
  window.ART_CATS = [['all', 'All 100'], ['lines', 'Lines'], ['waves', 'Waves'], ['dots', 'Dots & circles'], ['shapes', 'Shapes'],
                     ['nature', 'Flowers & nature'], ['center', 'Center designs'], ['texture', 'Textures']];
})();
