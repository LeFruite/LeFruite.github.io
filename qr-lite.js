/* Мінімальний генератор QR-кодів (байтовий режим, рівень виправлення M, версії 1–10). Без залежностей. */
(function (root) {
  'use strict';
  // [усього кодових слів, EC на блок, [[кількість блоків, даних у блоці], ...]] для рівня M
  var VER = [null,
    [26, 10, [[1, 16]]], [44, 16, [[1, 28]]], [70, 26, [[1, 44]]], [100, 18, [[2, 32]]], [134, 24, [[2, 43]]],
    [172, 16, [[4, 27]]], [196, 18, [[4, 31]]], [242, 22, [[2, 38], [2, 39]]], [292, 22, [[3, 36], [2, 37]]], [346, 26, [[4, 43], [1, 44]]]];
  var ALIGN = [null, [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]];

  var EXP = [], LOG = [];
  (function () { var x = 1; for (var i = 0; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; } for (i = 255; i < 512; i++) EXP[i] = EXP[i - 255]; })();
  function gmul(a, b) { return (a && b) ? EXP[LOG[a] + LOG[b]] : 0; }
  function rsGen(n) { var g = [1]; for (var i = 0; i < n; i++) { var ng = new Array(g.length + 1).fill(0); for (var j = 0; j < g.length; j++) { ng[j] ^= g[j]; ng[j + 1] ^= gmul(g[j], EXP[i]); } g = ng; } return g; }
  function rsEc(data, n) {
    var g = rsGen(n), res = new Array(n).fill(0);
    data.forEach(function (d) { var f = d ^ res[0]; res.shift(); res.push(0); if (f) for (var i = 0; i < n; i++) res[i] ^= gmul(g[i + 1], f); });
    return res;
  }
  function utf8(s) { var b = unescape(encodeURIComponent(s)), a = []; for (var i = 0; i < b.length; i++) a.push(b.charCodeAt(i)); return a; }
  function bch(v, gen, bits) { var d = v << bits; var gl = 0, t = gen; while (t) { gl++; t >>= 1; } while (true) { var dl = 0; t = d; while (t) { dl++; t >>= 1; } if (dl < gl) break; d ^= gen << (dl - gl); } return (v << bits) | d; }

  function encode(text) {
    var bytes = utf8(text), ver = 0, v;
    for (v = 1; v <= 10; v++) {
      var cap = VER[v][2].reduce(function (s, b) { return s + b[0] * b[1]; }, 0);
      var need = 4 + (v < 10 ? 8 : 16) + bytes.length * 8;
      if (need <= cap * 8) { ver = v; break; }
    }
    if (!ver) throw new Error('Посилання задовге для QR');
    var info = VER[ver], capBytes = info[2].reduce(function (s, b) { return s + b[0] * b[1]; }, 0);
    var bits = [];
    function put(val, n) { for (var i = n - 1; i >= 0; i--) bits.push((val >> i) & 1); }
    put(4, 4); put(bytes.length, ver < 10 ? 8 : 16);
    bytes.forEach(function (b) { put(b, 8); });
    for (var t = 0; t < 4 && bits.length < capBytes * 8; t++) bits.push(0);
    while (bits.length % 8) bits.push(0);
    var cw = [];
    for (var i = 0; i < bits.length; i += 8) { var x = 0; for (var j = 0; j < 8; j++) x = (x << 1) | bits[i + j]; cw.push(x); }
    for (var p = 0; cw.length < capBytes; p++) cw.push(p % 2 ? 0x11 : 0xec);
    // блоки + EC
    var blocks = [], pos = 0;
    info[2].forEach(function (g) { for (var k = 0; k < g[0]; k++) { blocks.push(cw.slice(pos, pos + g[1])); pos += g[1]; } });
    var ecs = blocks.map(function (b) { return rsEc(b, info[1]); });
    var out = [], maxD = Math.max.apply(null, blocks.map(function (b) { return b.length; }));
    for (i = 0; i < maxD; i++) blocks.forEach(function (b) { if (i < b.length) out.push(b[i]); });
    for (i = 0; i < info[1]; i++) ecs.forEach(function (e) { out.push(e[i]); });
    var stream = [];
    out.forEach(function (b) { for (var k = 7; k >= 0; k--) stream.push((b >> k) & 1); });
    return { ver: ver, stream: stream };
  }

  function build(text) {
    var enc = encode(text), ver = enc.ver, n = 17 + 4 * ver;
    var M = [], F = [];   // модулі та «зайняті» (службові) клітинки
    for (var r = 0; r < n; r++) { M.push(new Array(n).fill(0)); F.push(new Array(n).fill(false)); }
    function set(r, c, v) { if (r >= 0 && c >= 0 && r < n && c < n) { M[r][c] = v ? 1 : 0; F[r][c] = true; } }
    function finder(r0, c0) { for (var dr = -1; dr <= 7; dr++) for (var dc = -1; dc <= 7; dc++) {
      var on = dr >= 0 && dr <= 6 && dc >= 0 && dc <= 6 && (dr === 0 || dr === 6 || dc === 0 || dc === 6 || (dr >= 2 && dr <= 4 && dc >= 2 && dc <= 4));
      set(r0 + dr, c0 + dc, on); } }
    finder(0, 0); finder(0, n - 7); finder(n - 7, 0);
    for (var i = 8; i < n - 8; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
    var ap = ALIGN[ver];
    ap.forEach(function (ar) { ap.forEach(function (ac) {
      if ((ar === 6 && ac === 6) || (ar === 6 && ac === ap[ap.length - 1]) || (ac === 6 && ar === ap[ap.length - 1])) return;
      for (var dr = -2; dr <= 2; dr++) for (var dc = -2; dc <= 2; dc++) set(ar + dr, ac + dc, Math.max(Math.abs(dr), Math.abs(dc)) !== 1);
    }); });
    set(n - 8, 8, 1);                                   // «темний модуль»
    for (i = 0; i < 9; i++) { F[8][i] = true; F[i][8] = true; }   // зона інформації про формат
    for (i = 0; i < 8; i++) { F[8][n - 1 - i] = true; F[n - 1 - i][8] = true; }
    if (ver >= 7) for (i = 0; i < 6; i++) for (var j = 0; j < 3; j++) { F[i][n - 11 + j] = true; F[n - 11 + j][i] = true; }

    // розміщення даних зигзагом
    var bi = 0, up = true;
    for (var c = n - 1; c > 0; c -= 2) {
      if (c === 6) c--;
      for (var k = 0; k < n; k++) {
        var rr = up ? n - 1 - k : k;
        for (var cc = c; cc >= c - 1; cc--) if (!F[rr][cc]) { M[rr][cc] = bi < enc.stream.length ? enc.stream[bi] : 0; bi++; }
      }
      up = !up;
    }
    var MASKS = [function (r, c) { return (r + c) % 2 === 0; }, function (r) { return r % 2 === 0; }, function (r, c) { return c % 3 === 0; }, function (r, c) { return (r + c) % 3 === 0; },
      function (r, c) { return (Math.floor(r / 2) + Math.floor(c / 3)) % 2 === 0; }, function (r, c) { return (r * c) % 2 + (r * c) % 3 === 0; },
      function (r, c) { return ((r * c) % 2 + (r * c) % 3) % 2 === 0; }, function (r, c) { return ((r + c) % 2 + (r * c) % 3) % 2 === 0; }];

    function withMask(mk) {
      var Q = M.map(function (row) { return row.slice(); });
      for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (!F[r][c] && MASKS[mk](r, c)) Q[r][c] ^= 1;
      // інформація про формат (рівень M = 00)
      var fmt = bch((0 << 3) | mk, 0x537, 10) ^ 0x5412;
      function fb(k) { return (fmt >> k) & 1; }
      for (var k = 0; k <= 5; k++) Q[k][8] = fb(k);
      Q[7][8] = fb(6); Q[8][8] = fb(7); Q[8][7] = fb(8);
      for (k = 9; k < 15; k++) Q[8][14 - k] = fb(k);
      for (k = 0; k < 8; k++) Q[8][n - 1 - k] = fb(k);
      for (k = 8; k < 15; k++) Q[n - 15 + k][8] = fb(k);
      Q[n - 8][8] = 1;
      if (ver >= 7) {
        var vi = bch(ver, 0x1f25, 12);
        for (k = 0; k < 18; k++) { var bit = (vi >> k) & 1, a = Math.floor(k / 3), b = k % 3; Q[a][n - 11 + b] = bit; Q[n - 11 + b][a] = bit; }
      }
      return Q;
    }
    function penalty(Q) {
      var p = 0, r, c, run, k;
      for (var pass = 0; pass < 2; pass++) {
        for (r = 0; r < n; r++) { run = 1;
          for (c = 1; c < n; c++) { var a = pass ? Q[c][r] : Q[r][c], b = pass ? Q[c - 1][r] : Q[r][c - 1];
            if (a === b) { run++; if (run === 5) p += 3; else if (run > 5) p++; } else run = 1; } }
      }
      for (r = 0; r < n - 1; r++) for (c = 0; c < n - 1; c++) if (Q[r][c] === Q[r + 1][c] && Q[r][c] === Q[r][c + 1] && Q[r][c] === Q[r + 1][c + 1]) p += 3;
      var pat = [1, 0, 1, 1, 1, 0, 1, 0, 0, 0, 0], pat2 = pat.slice().reverse();
      for (r = 0; r < n; r++) for (c = 0; c <= n - 11; c++) for (var d = 0; d < 2; d++) {
        var m1 = true, m2 = true;
        for (k = 0; k < 11; k++) { var v = d ? Q[c + k][r] : Q[r][c + k]; if (v !== pat[k]) m1 = false; if (v !== pat2[k]) m2 = false; }
        if (m1) p += 40; if (m2) p += 40;
      }
      var dark = 0; Q.forEach(function (row) { row.forEach(function (v) { dark += v; }); });
      p += Math.floor(Math.abs(dark * 100 / (n * n) - 50) / 5) * 10;
      return p;
    }
    var best = null, bp = 1e9;
    for (var mk = 0; mk < 8; mk++) { var Q = withMask(mk), pp = penalty(Q); if (pp < bp) { bp = pp; best = Q; } }
    return best;
  }

  // SVG-рядок з відступом (quiet zone) 4 модулі
  function svg(text, px) {
    var Q = build(text), n = Q.length, q = 4, d = '';
    for (var r = 0; r < n; r++) for (var c = 0; c < n; c++) if (Q[r][c]) d += 'M' + (c + q) + ' ' + (r + q) + 'h1v1h-1z';
    var s = n + q * 2;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + s + ' ' + s + '" width="' + (px || 220) + '" height="' + (px || 220) + '" shape-rendering="crispEdges"><rect width="' + s + '" height="' + s + '" fill="#fff"/><path d="' + d + '" fill="#000"/></svg>';
  }
  root.QRLite = { build: build, svg: svg };
})(typeof window !== 'undefined' ? window : globalThis);
