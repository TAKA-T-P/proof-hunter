/*
 * renderer.js — SVGによる図形描画と選択状態の表示
 *
 * render(svg, problem, view)
 *   view.selection   : 選択中の要素キー
 *   view.flash       : 一瞬光らせる要素キー
 *   view.autoMarks   : 根拠登録で自動表示する印 { key: 本数 | 'common' }
 *   view.userMarks   : 生徒がつけた印 { key: 本数 }
 *   view.triangles   : true なら対象の2つの三角形を色付け
 *   view.interactive : true ならタップ用の透明な操作領域を置く
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const NS = 'http://www.w3.org/2000/svg';
  const G = function () { return PH.geometry; };

  const SEG_HIT_WIDTH = 40;     // 辺の操作領域の太さ（viewBox単位）
  const ANGLE_HIT_MAX = 56;     // 角の操作領域の半径の上限
  const SELECT_RADIUS = 34;

  function el(name, attrs, parent) {
    const node = root.document.createElementNS(NS, name);
    if (attrs) Object.keys(attrs).forEach(function (k) { node.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(node);
    return node;
  }

  function line(a, b, attrs, parent) {
    return el('line', Object.assign({ x1: a.x, y1: a.y, x2: b.x, y2: b.y }, attrs), parent);
  }

  function hitRadius(a) {
    const v = G().vec;
    return Math.min(ANGLE_HIT_MAX, 0.45 * Math.min(v.dist(a.vertex, a.from), v.dist(a.vertex, a.to)));
  }

  function drawMark(group, item, mark, cls) {
    const g = G();
    if (item.kind === 'seg') {
      if (mark === 'common') {
        const mid = g.vec.lerp(item.p1, item.p2, 0.5);
        const nm = g.vec.normal(g.vec.sub(item.p2, item.p1));
        const off = nm.y < 0 || (nm.y === 0 && nm.x < 0) ? g.vec.mul(nm, -20) : g.vec.mul(nm, 20);
        const at = g.vec.add(mid, off);
        line(item.p1, item.p2, { class: 'mark-common-line ' + cls }, group);
        const t = el('text', { x: at.x, y: at.y, class: 'mark-common-text ' + cls }, group);
        t.textContent = '共通';
        return;
      }
      g.tickLines(item.p1, item.p2, mark, 16, 6).forEach(function (s) {
        line(s.a, s.b, { class: 'mark-tick ' + cls }, group);
      });
    } else {
      for (let i = 0; i < mark; i++) {
        el('path', { d: g.arcPath(item.vertex, item.from, item.to, 20 + i * 5), class: 'mark-arc ' + cls }, group);
      }
    }
  }

  function render(svg, problem, view) {
    const g = G();
    const fig = problem.figure;
    const els = g.getElements(fig);
    const v = view || {};
    const selection = v.selection || [];
    const flash = v.flash || [];
    const autoMarks = v.autoMarks || {};
    const userMarks = v.userMarks || {};

    while (svg.firstChild) svg.removeChild(svg.firstChild);
    svg.setAttribute('viewBox', fig.viewBox.join(' '));
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // 1. 三角形（証明成功時）
    if (v.triangles) {
      const gt = el('g', { class: 'layer-tri' }, svg);
      problem.triangles.forEach(function (tri, i) {
        const pts = tri.map(function (n) { return g.fmt(fig.points[n]).replace(' ', ','); }).join(' ');
        el('polygon', { points: pts, class: 'tri tri-' + i }, gt);
      });
    }

    // 2. 強調（選択・フラッシュ）の下敷き
    const gu = el('g', { class: 'layer-under' }, svg);
    function underlay(item, cls) {
      if (item.kind === 'seg') {
        line(item.p1, item.p2, { class: 'under-seg ' + cls }, gu);
      } else {
        el('path', { d: g.sectorPath(item.vertex, item.from, item.to, SELECT_RADIUS), class: 'under-sector ' + cls }, gu);
        line(item.vertex, item.from, { class: 'under-ray ' + cls }, gu);
        line(item.vertex, item.to, { class: 'under-ray ' + cls }, gu);
      }
    }
    flash.forEach(function (k) { if (els.byKey[k]) underlay(els.byKey[k], 'is-flash'); });
    selection.forEach(function (k, i) {
      if (els.byKey[k] && selection.indexOf(k) === i) underlay(els.byKey[k], 'is-selected');
    });

    // 3. 図形の線
    const gs = el('g', { class: 'layer-seg' }, svg);
    els.segments.forEach(function (s) { line(s.p1, s.p2, { class: 'seg' }, gs); });

    // 4. 選択中の角の円弧
    const ga = el('g', { class: 'layer-arc' }, svg);
    selection.forEach(function (k) {
      const a = els.byKey[k];
      if (a && a.kind === 'ang') el('path', { d: g.arcPath(a.vertex, a.from, a.to, SELECT_RADIUS), class: 'sel-arc' }, ga);
    });

    // 5. 印（自動表示を優先、生徒の印は内部的に別管理）
    const gm = el('g', { class: 'layer-mark' }, svg);
    Object.keys(userMarks).forEach(function (k) {
      if (autoMarks[k] == null && els.byKey[k]) drawMark(gm, els.byKey[k], userMarks[k], 'mark-user');
    });
    Object.keys(autoMarks).forEach(function (k) {
      if (els.byKey[k]) drawMark(gm, els.byKey[k], autoMarks[k], 'mark-auto');
    });

    // 6. 平行の矢印（等しい辺の印とは別の表示）
    (fig.parallel || []).forEach(function (pair) {
      const p = g.chevron(fig.points[pair[0]], fig.points[pair[1]], 0.28, 14);
      el('polyline', { points: p.map(function (q) { return q.x + ',' + q.y; }).join(' '), class: 'parallel' }, gm);
    });

    // 7. 頂点と名前
    const gp = el('g', { class: 'layer-pt' }, svg);
    Object.keys(fig.points).forEach(function (name) {
      const p = fig.points[name];
      el('circle', { cx: p.x, cy: p.y, r: 4.5, class: 'pt' }, gp);
      const off = p.label || [0, -18];
      const t = el('text', { x: p.x + off[0], y: p.y + off[1], class: 'pt-label' }, gp);
      t.textContent = name;
    });

    // 8. 操作領域（辺 → 角の順。角を上に置き、頂点付近のタップは角を優先）
    if (v.interactive) {
      const gh = el('g', { class: 'layer-hit' }, svg);
      els.segments.forEach(function (s) {
        const h = line(s.p1, s.p2, {
          class: 'hit hit-seg', 'stroke-width': SEG_HIT_WIDTH, 'data-key': s.key,
          role: 'button', tabindex: '0', 'aria-label': '辺' + s.display,
        }, gh);
        el('title', null, h).textContent = '辺' + s.display;
      });
      els.angles.forEach(function (a) {
        const h = el('path', {
          d: g.sectorPath(a.vertex, a.from, a.to, hitRadius(a)),
          class: 'hit hit-ang', 'data-key': a.key,
          role: 'button', tabindex: '0', 'aria-label': a.display,
        }, gh);
        el('title', null, h).textContent = a.display;
      });
    }
  }

  PH.renderer = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
