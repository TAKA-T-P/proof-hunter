/*
 * geometry.js — 図形情報・線分/角の同一性・SVG用の幾何計算
 *
 * 要素キー（element key）
 *   線分: "seg:AB"   … 端点を文字順に並べる（AB と BA は同じ）
 *   角  : "ang:V:r1|r2" … 頂点 V と、2本の半直線のキー。
 *         半直線は figure.lines（一直線上の点の列）で正規化するので、
 *         O が AC 上にあれば ∠BAO と ∠BAC は同じ角になる。∠ABC と ∠CBA も同じ。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  // ---- 名前の正規化 ------------------------------------------------------

  function cleanName(name) {
    return String(name).replace(/[∠\s]/g, '');
  }

  function normalizeSegment(name) {
    const s = cleanName(name);
    if (s.length !== 2 || s[0] === s[1]) throw new Error('線分名が不正です: ' + name);
    return s[0] < s[1] ? s : s[1] + s[0];
  }

  function segKey(name) {
    return 'seg:' + normalizeSegment(name);
  }

  // 頂点 v から点 p へ向かう半直線のキー
  function rayKey(figure, v, p) {
    const lines = (figure && figure.lines) || [];
    for (let i = 0; i < lines.length; i++) {
      const iv = lines[i].indexOf(v);
      const ip = lines[i].indexOf(p);
      if (iv >= 0 && ip >= 0 && iv !== ip) return v + '@' + i + (ip > iv ? '+' : '-');
    }
    return v + '>' + p;
  }

  function angleKey(figure, name) {
    const s = cleanName(name);
    if (s.length !== 3) throw new Error('角の名前は3文字です: ' + name);
    const v = s[1];
    const rays = [rayKey(figure, v, s[0]), rayKey(figure, v, s[2])].sort();
    if (rays[0] === rays[1]) throw new Error('角になっていません: ' + name);
    return 'ang:' + v + ':' + rays.join('|');
  }

  function isAngleName(name) {
    return /^\s*∠/.test(String(name));
  }

  // "AB" → 線分キー、"∠ABC" → 角キー
  function elementKey(figure, name) {
    return isAngleName(name) ? angleKey(figure, name) : segKey(name);
  }

  // ---- 図形要素一覧 -----------------------------------------------------

  const cache = new WeakMap();

  // 図形データから選択可能な要素（辺・角）を作る
  function getElements(figure) {
    if (cache.has(figure)) return cache.get(figure);
    const pts = figure.points;
    const byKey = {};
    const segments = figure.segments.map(function (name) {
      const s = cleanName(name);
      const el = { key: segKey(s), kind: 'seg', name: s, display: s, p1: pts[s[0]], p2: pts[s[1]] };
      if (!el.p1 || !el.p2) throw new Error('点が定義されていません: ' + name);
      if (byKey[el.key]) throw new Error('線分が重複しています: ' + name);
      byKey[el.key] = el;
      return el;
    });
    const angles = (figure.angles || []).map(function (name) {
      const s = cleanName(name);
      const el = {
        key: angleKey(figure, s), kind: 'ang', name: s, display: '∠' + s,
        vertex: pts[s[1]], from: pts[s[0]], to: pts[s[2]],
      };
      if (!el.vertex || !el.from || !el.to) throw new Error('点が定義されていません: ' + name);
      if (byKey[el.key]) throw new Error('角が重複しています: ' + name);
      byKey[el.key] = el;
      return el;
    });
    const result = { segments: segments, angles: angles, byKey: byKey };
    cache.set(figure, result);
    return result;
  }

  // ---- ベクトル計算（SVG描画用） ------------------------------------------

  function sub(a, b) { return { x: a.x - b.x, y: a.y - b.y }; }
  function add(a, b) { return { x: a.x + b.x, y: a.y + b.y }; }
  function mul(a, k) { return { x: a.x * k, y: a.y * k }; }
  function len(a) { return Math.hypot(a.x, a.y); }
  function dist(a, b) { return len(sub(a, b)); }
  function unit(a) { const l = len(a) || 1; return { x: a.x / l, y: a.y / l }; }
  function normal(a) { const u = unit(a); return { x: -u.y, y: u.x }; }
  function lerp(a, b, t) { return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
  function f(n) { return Math.round(n * 100) / 100; }
  function pt(p) { return f(p.x) + ' ' + f(p.y); }

  // 頂点 V で、P1 方向から P2 方向へ小さい方の角を回る円弧の情報
  function arcInfo(V, P1, P2, r) {
    const u1 = unit(sub(P1, V));
    const u2 = unit(sub(P2, V));
    const cross = u1.x * u2.y - u1.y * u2.x;
    return { a: add(V, mul(u1, r)), b: add(V, mul(u2, r)), sweep: cross > 0 ? 1 : 0 };
  }

  function arcPath(V, P1, P2, r) {
    const k = arcInfo(V, P1, P2, r);
    return 'M ' + pt(k.a) + ' A ' + f(r) + ' ' + f(r) + ' 0 0 ' + k.sweep + ' ' + pt(k.b);
  }

  function sectorPath(V, P1, P2, r) {
    const k = arcInfo(V, P1, P2, r);
    return 'M ' + pt(V) + ' L ' + pt(k.a) + ' A ' + f(r) + ' ' + f(r) + ' 0 0 ' + k.sweep + ' ' + pt(k.b) + ' Z';
  }

  // 角の二等分線方向の単位ベクトル
  function bisector(V, P1, P2) {
    return unit(add(unit(sub(P1, V)), unit(sub(P2, V))));
  }

  // 線分の中点付近に n 本の短い線（等しい辺の印）
  function tickLines(P1, P2, n, size, gap) {
    const d = unit(sub(P2, P1));
    const nm = normal(sub(P2, P1));
    const mid = lerp(P1, P2, 0.5);
    const out = [];
    for (let i = 0; i < n; i++) {
      const c = add(mid, mul(d, (i - (n - 1) / 2) * gap));
      out.push({ a: add(c, mul(nm, size / 2)), b: add(c, mul(nm, -size / 2)) });
    }
    return out;
  }

  // 平行の矢印（くの字）
  function chevron(P1, P2, t, size) {
    const d = unit(sub(P2, P1));
    const nm = normal(sub(P2, P1));
    const tip = add(lerp(P1, P2, t), mul(d, size / 2));
    const back = add(tip, mul(d, -size));
    return [add(back, mul(nm, size * 0.7)), tip, add(back, mul(nm, -size * 0.7))];
  }

  PH.geometry = {
    normalizeSegment: normalizeSegment,
    segKey: segKey,
    rayKey: rayKey,
    angleKey: angleKey,
    isAngleName: isAngleName,
    elementKey: elementKey,
    getElements: getElements,
    vec: { sub: sub, add: add, mul: mul, len: len, dist: dist, unit: unit, normal: normal, lerp: lerp },
    fmt: pt,
    arcPath: arcPath,
    sectorPath: sectorPath,
    bisector: bisector,
    tickLines: tickLines,
    chevron: chevron,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.geometry;
})(typeof window !== 'undefined' ? window : globalThis);
