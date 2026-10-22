/*
 * quadrilateral.js — 四角形の基本処理（Ver.0.9。DOMに依存しない）
 *
 * 四角形は、周に沿った順の頂点の配列（例 ['A', 'B', 'C', 'D']）で表す。'ABCD' のような文字列も受け付ける。
 *   sides(q)             … 4つの辺 ['AB', 'BC', 'CD', 'DA']
 *   oppositeSides(q)     … 2組の対辺 [['AB', 'CD'], ['BC', 'DA']]
 *   adjacentSides(q)     … 隣り合う2辺の組（4組。対辺と取りちがえないための確認用）
 *   angles(q)            … 4つの角 ['∠DAB', '∠ABC', '∠BCD', '∠CDA']（真ん中が頂点）
 *   oppositeAngles(q)    … 2組の対角 [['∠DAB', '∠BCD'], ['∠ABC', '∠CDA']]
 *   diagonals(q)         … 2本の対角線 ['AC', 'BD']
 *   isSimple(fig, q)     … 退化（3つの頂点が一直線上）・自己交差していない四角形か
 *   isConvex(fig, q)     … 凸四角形か
 *   diagonalPoint(fig, q)… 2本の対角線の交点の名前。図の点で、figure.lines の上で両方の対角線の「内側」にあるもの。なければ null
 *   diagonalHalves(fig, q) … 交点 O で分けた対角線の半分の組 [['AO', 'CO'], ['BO', 'DO']]。交点がなければ null
 *   lineKey(fig, seg)    … 線分がのっている直線のキー（一直線上の点 figure.lines で正規化。E が AB 上なら AE・EB・AB は同じ直線）
 *   parallelKey(fig, s1, s2) … 平行の関係のキー（AB∥CD・CD∥AB・BA∥DC は同じ。同じ直線どうしは null）
 *   isBetween(fig, P, X, Q) … 点 X が線分 PQ の内側にあるか（figure.lines の並びで判定）
 *
 * 図の座標は、退化・自己交差・凸性の確認だけに使う（等しい・平行の判定には使わない）。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function G() { return PH.geometry; }

  function verts(q) {
    const a = Array.isArray(q) ? q.slice() : String(q || '').replace(/[□四角形\s]/g, '').split('');
    return a.length === 4 ? a : null;
  }

  function sides(q) {
    const v = verts(q);
    return [0, 1, 2, 3].map(function (i) { return v[i] + v[(i + 1) % 4]; });
  }

  function oppositeSides(q) {
    const s = sides(q);
    return [[s[0], s[2]], [s[1], s[3]]];
  }

  function adjacentSides(q) {
    const s = sides(q);
    return [0, 1, 2, 3].map(function (i) { return [s[i], s[(i + 1) % 4]]; });
  }

  function angles(q) {
    const v = verts(q);
    return [0, 1, 2, 3].map(function (i) { return '∠' + v[(i + 3) % 4] + v[i] + v[(i + 1) % 4]; });
  }

  function oppositeAngles(q) {
    const a = angles(q);
    return [[a[0], a[2]], [a[1], a[3]]];
  }

  function diagonals(q) {
    const v = verts(q);
    return [v[0] + v[2], v[1] + v[3]];
  }

  function cross(o, a, b) { return (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x); }

  // 2つの線分が共有点をもつか（端点での接触・重なりもふくむ）
  function segmentsTouch(a, b, c, d) {
    const d1 = cross(c, d, a), d2 = cross(c, d, b), d3 = cross(a, b, c), d4 = cross(a, b, d);
    const eps = 1e-6;
    if (((d1 > eps && d2 < -eps) || (d1 < -eps && d2 > eps)) && ((d3 > eps && d4 < -eps) || (d3 < -eps && d4 > eps))) return true;
    const on = function (p, q, r) {     // r が線分 pq の上
      return Math.abs(cross(p, q, r)) <= eps && Math.min(p.x, q.x) - eps <= r.x && r.x <= Math.max(p.x, q.x) + eps &&
        Math.min(p.y, q.y) - eps <= r.y && r.y <= Math.max(p.y, q.y) + eps;
    };
    return on(c, d, a) || on(c, d, b) || on(a, b, c) || on(a, b, d);
  }

  // 退化していない・自己交差していない四角形か
  function isSimple(fig, q) {
    const v = verts(q);
    if (!v || new Set(v).size !== 4) return false;
    const P = v.map(function (n) { return fig.points[n]; });
    if (P.some(function (p) { return !p; })) return false;
    for (let i = 0; i < 4; i++) {
      // 隣り合う3つの頂点が一直線上にない（三角形の面積が0でない）
      if (Math.abs(cross(P[(i + 3) % 4], P[i], P[(i + 1) % 4])) / 2 < 1) return false;
    }
    // 対辺どうしが交わらない（ねじれた「8の字」の四角形ではない）
    if (segmentsTouch(P[0], P[1], P[2], P[3]) || segmentsTouch(P[1], P[2], P[3], P[0])) return false;
    return true;
  }

  function isConvex(fig, q) {
    if (!isSimple(fig, q)) return false;
    const P = verts(q).map(function (n) { return fig.points[n]; });
    const s = [0, 1, 2, 3].map(function (i) { return Math.sign(cross(P[i], P[(i + 1) % 4], P[(i + 2) % 4])); });
    return s.every(function (x) { return x === s[0]; });
  }

  // 点 X が線分 PQ の内側にあるか（P・X・Q が figure.lines の同じ線にこの順で並ぶ。端点は内側ではない）
  function isBetween(fig, P, X, Q) {
    return (fig.lines || []).some(function (L) {
      const i = L.indexOf(P), j = L.indexOf(X), k = L.indexOf(Q);
      return i >= 0 && j >= 0 && k >= 0 && ((i < j && j < k) || (k < j && j < i));
    });
  }

  // 2本の対角線の交点（図の点）。両方の対角線の内側にある点だけ。四角形が単純でなければ null
  function diagonalPoint(fig, q) {
    const v = verts(q);
    if (!v || !isSimple(fig, v)) return null;
    const names = Object.keys(fig.points).filter(function (n) { return v.indexOf(n) < 0; });
    return names.find(function (O) { return isBetween(fig, v[0], O, v[2]) && isBetween(fig, v[1], O, v[3]); }) || null;
  }

  function diagonalHalves(fig, q) {
    const O = diagonalPoint(fig, q);
    if (!O) return null;
    const v = verts(q);
    return [[v[0] + O, v[2] + O], [v[1] + O, v[3] + O]];
  }

  // 線分がのっている直線のキー
  function lineKey(fig, seg) {
    const s = G().normalizeSegment(seg);
    const lines = fig.lines || [];
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].indexOf(s[0]) >= 0 && lines[i].indexOf(s[1]) >= 0) return 'L' + i;
    }
    return 'S' + s;
  }

  // 平行の関係のキー。同じ直線（同じ辺・一直線上の2辺）なら null
  function parallelKey(fig, s1, s2) {
    const a = lineKey(fig, s1), b = lineKey(fig, s2);
    if (a === b) return null;
    return 'par:' + [a, b].sort().join('|');
  }

  // 2つの辺が、四角形のどちらの組の対辺か（0 / 1）。対辺でなければ -1（隣り合う辺・対角線など）
  function oppositeIndex(q, s1, s2) {
    const k = function (s) { return G().normalizeSegment(s); };
    const want = [k(s1), k(s2)].sort().join('|');
    return oppositeSides(q).findIndex(function (pair) { return [k(pair[0]), k(pair[1])].sort().join('|') === want; });
  }

  // 四角形の名前（'四角形ABCD'）
  function name(q) { return '四角形' + verts(q).join(''); }

  PH.quadrilateral = {
    vertices: verts,
    sides: sides,
    oppositeSides: oppositeSides,
    adjacentSides: adjacentSides,
    angles: angles,
    oppositeAngles: oppositeAngles,
    diagonals: diagonals,
    isSimple: isSimple,
    isConvex: isConvex,
    isBetween: isBetween,
    diagonalPoint: diagonalPoint,
    diagonalHalves: diagonalHalves,
    lineKey: lineKey,
    parallelKey: parallelKey,
    oppositeIndex: oppositeIndex,
    name: name,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.quadrilateral;
})(typeof window !== 'undefined' ? window : globalThis);
