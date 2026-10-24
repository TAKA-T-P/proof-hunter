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
  //   辺は 'AB' のほか、途中に点がある長い辺を { name: 'AB', hit: ['D', 'B'] } と書ける。
  //   このとき操作領域は D〜B の部分だけになり（A〜D は別の辺 AD として選ぶ）、選ぶと AB 全体が選ばれる。
  function getElements(figure) {
    if (cache.has(figure)) return cache.get(figure);
    const pts = figure.points;
    const byKey = {};
    const segments = figure.segments.map(function (entry) {
      const name = typeof entry === 'string' ? entry : entry.name;
      const s = cleanName(name);
      const hit = typeof entry === 'string' || !entry.hit ? [s[0], s[1]] : entry.hit;
      const el = {
        key: segKey(s), kind: 'seg', name: s, display: s, p1: pts[s[0]], p2: pts[s[1]],
        h1: pts[hit[0]], h2: pts[hit[1]], composite: hit[0] + hit[1] !== s,
      };
      if (!el.p1 || !el.p2 || !el.h1 || !el.h2) throw new Error('点が定義されていません: ' + name);
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

  // 点 p から線分 ab までの距離
  function distToSegment(p, a, b) {
    const ab = sub(b, a);
    const l2 = ab.x * ab.x + ab.y * ab.y || 1;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * ab.x + (p.y - a.y) * ab.y) / l2));
    return dist(p, add(a, mul(ab, t)));
  }

  // 2線分の交点（端点どうしの接触は除く）。なければ null
  function segmentIntersection(a, b, c, d) {
    const r = sub(b, a), q = sub(d, c);
    const den = r.x * q.y - r.y * q.x;
    if (Math.abs(den) < 1e-9) return null;
    const t = ((c.x - a.x) * q.y - (c.y - a.y) * q.x) / den;
    const u = ((c.x - a.x) * r.y - (c.y - a.y) * r.x) / den;
    const eps = 1e-6;
    if (t <= eps || t >= 1 - eps || u <= eps || u >= 1 - eps) return null;
    return add(a, mul(r, t));
  }

  /*
   * 頂点 V から点 P の方向へ進んだとき、最初にぶつかる「名前のある点」までの距離と、
   * 「ほかの線分との交わり（名前のない交点）」までの距離を返す。角の操作領域の大きさの計算に使う。
   */
  function rayClearance(figure, vName, pName) {
    const pts = figure.points;
    const V = pts[vName], P = pts[pName];
    const dir = unit(sub(P, V));
    let point = dist(V, P);
    Object.keys(pts).forEach(function (n) {
      if (n === vName) return;
      const w = sub(pts[n], V);
      const along = w.x * dir.x + w.y * dir.y;
      const off = Math.abs(w.x * dir.y - w.y * dir.x);
      if (along > 1e-6 && off < 0.5 && along < point) point = along;
    });
    let crossing = Infinity;
    const far = add(V, mul(dir, point));
    getElements(figure).segments.forEach(function (s) {
      const x = segmentIntersection(V, far, s.p1, s.p2);
      // 頂点そのものを通る長い辺（p49 の OA は D を通る）との交わりは数えない
      if (x && dist(V, x) > 0.5) crossing = Math.min(crossing, dist(V, x));
    });
    return { point: point, crossing: crossing };
  }

  // 角の操作領域（扇形）の半径。隣の頂点の角や、線の交点の向こう側の角と重ならないようにする
  const ANGLE_HIT_MAX = 56;     // 辺と同時に置くとき
  const ANGLE_ONLY_MAX = 92;    // 角だけを置くとき（角選択モード）
  function angleHitRadius(figure, a, angleOnly) {
    const r1 = rayClearance(figure, a.name[1], a.name[0]);
    const r2 = rayClearance(figure, a.name[1], a.name[2]);
    let byPoint = Math.min(r1.point, r2.point);
    // 角の内側にほかの頂点があるときは、その頂点の角と重ならないよう距離の半分未満に抑える
    const u1 = sub(a.from, a.vertex), u2 = sub(a.to, a.vertex);
    const cr = function (p, q) { return p.x * q.y - p.y * q.x; };
    const sgn = Math.sign(cr(u1, u2));
    Object.keys(figure.points).forEach(function (n) {
      if (n === a.name[1]) return;
      const q = sub(figure.points[n], a.vertex);
      if (Math.sign(cr(u1, q)) * sgn > 0 && Math.sign(cr(q, u2)) * sgn > 0) byPoint = Math.min(byPoint, len(q));
    });
    const byCrossing = Math.min(r1.crossing, r2.crossing);
    return angleOnly
      ? Math.min(ANGLE_ONLY_MAX, 0.48 * byPoint, byCrossing)
      : Math.min(ANGLE_HIT_MAX, 0.45 * byPoint, byCrossing);
  }

  // 点 q が、頂点 V・半直線 VP1〜VP2（180°未満）・半径 R の扇形の中にあるか
  function inSector(V, P1, P2, R, q) {
    const w = sub(q, V);
    if (len(w) > R) return false;
    const u1 = sub(P1, V), u2 = sub(P2, V);
    const cr = function (a, b) { return a.x * b.y - a.y * b.x; };
    const s = Math.sign(cr(u1, u2));
    return Math.sign(cr(u1, w)) * s >= 0 && Math.sign(cr(w, u2)) * s >= 0;
  }

  function angleSize(a) {
    const u1 = unit(sub(a.from, a.vertex)), u2 = unit(sub(a.to, a.vertex));
    return Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.y * u2.y)));
  }

  /*
   * タップした点 q（図の座標）が指しうる辺の候補。
   * いちばん近い辺と同じ直線上にあって、同じくらい近い辺をすべて返す（長い辺が先）。
   * 例：線分AC上に点Bがあり、AC・AB が両方とも辺のとき、A〜B の間をタップすると [AC, AB]。
   */
  function segmentCandidates(figure, q) {
    const segs = getElements(figure).segments;
    let best = null, bestD = Infinity;
    segs.forEach(function (s) {
      const d = distToSegment(q, s.p1, s.p2);
      if (d < bestD) { bestD = d; best = s; }
    });
    if (!best) return [];
    const dir = unit(sub(best.p2, best.p1));
    const onLine = function (P) { const w = sub(P, best.p1); return Math.abs(w.x * dir.y - w.y * dir.x) < 0.5; };
    return segs
      .filter(function (s) { return distToSegment(q, s.p1, s.p2) <= bestD + 2 && onLine(s.p1) && onLine(s.p2); })
      .sort(function (a, b) { return dist(b.p1, b.p2) - dist(a.p1, a.p2); })
      .map(function (s) { return s.key; });
  }

  /*
   * タップした点 q が操作領域に入っている角の候補（大きい角が先）。
   * 例：∠ABC の内側に半直線BDがあり、∠ABC・∠ABD が両方とも選べる角のとき、∠ABD の中をタップすると [∠ABC, ∠ABD]。
   */
  function angleCandidates(figure, q, angleOnly) {
    return getElements(figure).angles
      .filter(function (a) { return inSector(a.vertex, a.from, a.to, angleHitRadius(figure, a, angleOnly), q); })
      .sort(function (a, b) { return angleSize(b) - angleSize(a); })
      .map(function (a) { return a.key; });
  }

  // ---- 三角形（Ver.0.5：証明する三角形を選ぶ） ----------------------------------

  // 2点が図の線で結ばれているか（辺そのもの、または一直線上に並んだ辺のつながり。例 A-O-C で AO・OC があれば AC）
  function connected(figure, P, Q) {
    const byKey = getElements(figure).byKey;
    if (byKey[segKey(P + Q)]) return true;
    return (figure.lines || []).some(function (L) {
      const i = L.indexOf(P), j = L.indexOf(Q);
      if (i < 0 || j < 0) return false;
      const a = Math.min(i, j), b = Math.max(i, j);
      for (let k = a; k < b; k++) {
        // 隣り合う点の間がどれかの辺（途中に点がある長い辺をふくむ）に覆われているか
        const covered = getElements(figure).segments.some(function (s) {
          const si = L.indexOf(s.name[0]), sj = L.indexOf(s.name[1]);
          return si >= 0 && sj >= 0 && Math.min(si, sj) <= k && Math.max(si, sj) >= k + 1;
        });
        if (!covered) return false;
      }
      return true;
    });
  }

  function triArea(A, B, C) {
    return Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)) / 2;
  }

  const triCache = new WeakMap();
  /*
   * 図の上にある三角形の一覧（頂点はアルファベット順の配列）。
   * 3辺がすべて図にかかれていて（一直線上のつながりもふくむ）、3点が一直線上にないものだけ。
   * 図にかかれていない三角形を候補として作らない。
   */
  function figureTriangles(figure) {
    if (triCache.has(figure)) return triCache.get(figure);
    const pts = figure.points;
    const names = Object.keys(pts).sort();
    const out = [];
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        for (let k = j + 1; k < names.length; k++) {
          const t = [names[i], names[j], names[k]];
          if (triArea(pts[t[0]], pts[t[1]], pts[t[2]]) < 1) continue;     // 一直線上
          if (connected(figure, t[0], t[1]) && connected(figure, t[1], t[2]) && connected(figure, t[0], t[2])) out.push(t);
        }
      }
    }
    triCache.set(figure, out);
    return out;
  }

  // 3つの頂点（順不同）が図の上の三角形か
  function isFigureTriangle(figure, tri) {
    if (!tri || tri.length !== 3 || new Set(tri).size !== 3) return false;
    const id = tri.slice().sort().join('');
    return figureTriangles(figure).some(function (t) { return t.join('') === id; });
  }

  // タップした点 q をふくむ図の三角形（小さい三角形が先）
  function triangleCandidates(figure, q) {
    const pts = figure.points;
    return figureTriangles(figure).filter(function (t) {
      const A = pts[t[0]], B = pts[t[1]], C = pts[t[2]];
      const s = triArea(A, B, C);
      return Math.abs(triArea(q, B, C) + triArea(A, q, C) + triArea(A, B, q) - s) < 0.5;
    }).sort(function (a, b) {
      return triArea(pts[a[0]], pts[a[1]], pts[a[2]]) - triArea(pts[b[0]], pts[b[1]], pts[b[2]]);
    });
  }

  // 平行の印の一覧。[始点, 終点] または [始点, 終点, 組番号]（組番号の数だけ矢印を重ねる）
  function parallelLines(figure) {
    return (figure.parallel || []).map(function (e) {
      return { from: e[0], to: e[1], group: e[2] || 1 };
    });
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
    angleHitRadius: angleHitRadius,
    parallelLines: parallelLines,
    segmentIntersection: segmentIntersection,
    distToSegment: distToSegment,
    inSector: inSector,
    segmentCandidates: segmentCandidates,
    angleCandidates: angleCandidates,
    figureTriangles: figureTriangles,
    isFigureTriangle: isFigureTriangle,
    triangleCandidates: triangleCandidates,
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
