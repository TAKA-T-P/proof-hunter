/*
 * renderer.js — SVGによる図形描画と選択状態の表示
 *
 * render(svg, problem, view)
 *   view.selection   : 選択中の要素キー
 *   view.flash       : 一瞬光らせる要素キー
 *   view.autoMarks   : 根拠登録で自動表示する印 { key: 本数 | 'common' }
 *   view.userMarks   : 生徒がつけた印 { key: 本数 }
 *   view.triangles   : true なら対象の2つの三角形を色付け（'check' なら輪郭も強調：三角形を確認）
 *   view.flashLines  : 一瞬光らせる線 [[点名, 点名], ...]（平行線の強調など）
 *   view.interactive : true ならタップ用の透明な操作領域を置く
 *   view.hit         : { seg, ang } どちらの操作領域を置くか（省略時は両方）
 *   view.angleGuide  : true なら選択できる角に薄い円弧を表示（角選択モード）
 *   view.triSel      : 選んだ三角形（頂点の配列のリスト。1つ目は青、2つ目は黄）（Ver.0.5：三角形を選ぶ）
 *   view.hit.tri     : true なら図の三角形の内側をタップできる（data-tri="ABD"）
 *   view.hypotenuse  : 斜辺として強調する辺のキー（Ver.0.8：直角三角形の斜辺を見つけたとき）
 * Ver.0.8：autoMarks の 'right' は直角の印（小さな四角）。figure.rightMarks（図にかかれている直角）は常に表示する。
 *         どちらも生徒の印（userMarks）とは別に管理するので、「消す」では消えない。
 *         figure.rays は直線をのばした飾りの線と名前（例：直線ℓ）。タップには反応しない。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const NS = 'http://www.w3.org/2000/svg';
  const G = function () { return PH.geometry; };

  const SEG_HIT_WIDTH = 40;     // 辺の操作領域の太さ（viewBox単位）の最小値
  const SEG_HIT_PX = 36;        // 図が縮小表示されても、画面上でこの太さ(px)は確保する
  const SEG_HIT_MAX = 64;
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

  // 図の中心から離れる向きの法線（途中に点がある長い辺の印を外側に描くため）
  function outward(fig, p1, p2) {
    const g = G();
    const names = Object.keys(fig.points);
    const c = names.reduce(function (acc, n) {
      return { x: acc.x + fig.points[n].x / names.length, y: acc.y + fig.points[n].y / names.length };
    }, { x: 0, y: 0 });
    const nm = g.vec.normal(g.vec.sub(p2, p1));
    const mid = g.vec.lerp(p1, p2, 0.5);
    const toC = g.vec.sub(c, mid);
    return nm.x * toC.x + nm.y * toC.y > 0 ? g.vec.mul(nm, -1) : nm;
  }

  // 直角の印（頂点 V から2本の半直線にそって size の小さな四角）
  function rightMark(group, V, P1, P2, cls) {
    const g = G();
    const size = 13;
    const u1 = g.vec.mul(g.vec.unit(g.vec.sub(P1, V)), size), u2 = g.vec.mul(g.vec.unit(g.vec.sub(P2, V)), size);
    const a = g.vec.add(V, u1), b = g.vec.add(g.vec.add(V, u1), u2), c = g.vec.add(V, u2);
    el('polyline', { points: [a, b, c].map(function (q) { return g.fmt(q).replace(' ', ','); }).join(' '), class: 'mark-right ' + cls }, group);
  }

  function drawMark(group, item, mark, cls, fig) {
    const g = G();
    if (item.kind === 'ang' && mark === 'right') {
      rightMark(group, item.vertex, item.from, item.to, cls);
      return;
    }
    if (item.kind === 'seg' && item.composite && mark !== 'common') {
      // 途中に点がある長い辺は、辺に沿わせた補助線（寸法線）の上に印をつける
      const o = g.vec.mul(outward(fig, item.p1, item.p2), 16);
      const a = g.vec.add(item.p1, o), b = g.vec.add(item.p2, o);
      line(a, b, { class: 'mark-dim ' + cls }, group);
      [item.p1, item.p2].forEach(function (p) {
        line(g.vec.add(p, g.vec.mul(o, 0.6)), g.vec.add(p, g.vec.mul(o, 1.4)), { class: 'mark-dim ' + cls }, group);
      });
      g.tickLines(a, b, mark, 14, 6).forEach(function (t) { line(t.a, t.b, { class: 'mark-tick ' + cls }, group); });
      return;
    }
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
      g.tickLines(item.h1, item.h2, mark, 16, 6).forEach(function (s) {
        line(s.a, s.b, { class: 'mark-tick ' + cls }, group);
      });
    } else if (mark === 'common') {
      // 共通な角：円弧と「共通」の文字
      el('path', { d: g.arcPath(item.vertex, item.from, item.to, 22), class: 'mark-arc ' + cls }, group);
      const at = g.vec.add(item.vertex, g.vec.mul(g.bisector(item.vertex, item.from, item.to), 40));
      const t = el('text', { x: at.x, y: at.y, class: 'mark-common-text ' + cls }, group);
      t.textContent = '共通';
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

    // 1. 三角形（証明成功時・三角形を確認）
    if (v.triangles) {
      const gt = el('g', { class: 'layer-tri' + (v.triangles === 'check' ? ' tri-check' : '') }, svg);
      problem.triangles.forEach(function (tri, i) {
        const pts = tri.map(function (n) { return g.fmt(fig.points[n]).replace(' ', ','); }).join(' ');
        el('polygon', { points: pts, class: 'tri tri-' + i }, gt);
      });
    }

    // 1b. 選んだ三角形（三角形を選ぶ段階）
    if (v.triSel && v.triSel.length) {
      const gs0 = el('g', { class: 'layer-trisel' }, svg);
      v.triSel.forEach(function (tri, i) {
        const pts = tri.map(function (n) { return g.fmt(fig.points[n]).replace(' ', ','); }).join(' ');
        el('polygon', { points: pts, class: 'tri-sel tri-sel-' + i }, gs0);
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
    (v.flashLines || []).forEach(function (pq) {
      line(fig.points[pq[0]], fig.points[pq[1]], { class: 'under-seg is-flash is-parallel' }, gu);
    });
    // 斜辺の強調（Ver.0.8）
    (v.hypotenuse || []).forEach(function (k) {
      const s = els.byKey[k];
      if (s && s.kind === 'seg') line(s.p1, s.p2, { class: 'under-seg is-hyp' }, gu);
    });
    flash.forEach(function (k) { if (els.byKey[k]) underlay(els.byKey[k], 'is-flash'); });
    // 同じ要素を2回選んだ（共通な辺・角）ときは赤で表示
    const sameTwice = selection.length === 2 && selection[0] === selection[1];
    selection.forEach(function (k, i) {
      if (els.byKey[k] && selection.indexOf(k) === i) underlay(els.byKey[k], sameTwice ? 'is-selected is-common' : 'is-selected');
    });

    // 3. 図形の線
    const gs = el('g', { class: 'layer-seg' }, svg);
    els.segments.forEach(function (s) { line(s.p1, s.p2, { class: 'seg' }, gs); });
    // 直線をのばした飾りの線と名前（例：直線ℓ）
    (fig.rays || []).forEach(function (r) {
      const P = fig.points[r.from], Q = fig.points[r.through];
      const end = g.vec.add(Q, g.vec.mul(g.vec.unit(g.vec.sub(Q, P)), r.extend || 30));
      line(Q, end, { class: 'seg seg-ray' }, gs);
      if (r.label) {
        const at = g.vec.add(end, g.vec.mul(g.vec.unit(g.vec.sub(Q, P)), 13));      // 線の先に名前
        const t = el('text', { x: at.x.toFixed(1), y: at.y.toFixed(1), class: 'ray-label' }, gs);
        t.textContent = r.label;
      }
    });

    // 4. 選択できる角の目印（角選択モード）と、選択中の角の円弧
    const ga = el('g', { class: 'layer-arc' }, svg);
    if (v.angleGuide) {
      els.angles.forEach(function (a) {
        if (selection.indexOf(a.key) < 0) el('path', { d: g.arcPath(a.vertex, a.from, a.to, 30), class: 'ang-guide' }, ga);
      });
    }
    selection.forEach(function (k) {
      const a = els.byKey[k];
      if (a && a.kind === 'ang') el('path', { d: g.arcPath(a.vertex, a.from, a.to, SELECT_RADIUS), class: sameTwice ? 'sel-arc is-common' : 'sel-arc' }, ga);
    });

    // 5. 印（自動表示を優先、生徒の印は内部的に別管理）
    const gm = el('g', { class: 'layer-mark' }, svg);
    // 図にかかれている直角の印（仮定・垂線の直角）。根拠として確かめた直角は自動表示の印（緑）でかく
    (fig.rightMarks || []).forEach(function (n) {
      const k = g.angleKey(fig, n);
      if (autoMarks[k] === 'right') return;
      rightMark(gm, fig.points[n[1]], fig.points[n[0]], fig.points[n[2]], 'mark-fig');
    });
    Object.keys(userMarks).forEach(function (k) {
      if (autoMarks[k] == null && els.byKey[k]) drawMark(gm, els.byKey[k], userMarks[k], 'mark-user', fig);
    });
    Object.keys(autoMarks).forEach(function (k) {
      if (els.byKey[k]) drawMark(gm, els.byKey[k], autoMarks[k], 'mark-auto', fig);
    });

    // 6. 平行の矢印（等しい辺の印とは別の表示）
    g.parallelLines(fig).forEach(function (pl) {
      const P = fig.points[pl.from], Q = fig.points[pl.to];
      const step = 9 / g.vec.dist(P, Q);
      for (let i = 0; i < pl.group; i++) {
        const p = g.chevron(P, Q, 0.28 + i * step, 14);
        el('polyline', { points: p.map(function (q) { return q.x + ',' + q.y; }).join(' '), class: 'parallel' }, gm);
      }
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
      const hit = v.hit || { seg: true, ang: true };
      const angleOnly = hit.ang && !hit.seg;
      const scale = svg.clientWidth ? Math.min(svg.clientWidth / fig.viewBox[2], svg.clientHeight / fig.viewBox[3]) : 1;
      const segHit = Math.min(SEG_HIT_MAX, Math.max(SEG_HIT_WIDTH, SEG_HIT_PX / (scale || 1)));
      // 三角形の内側（重なった三角形は、タップした点から候補を出して「どの三角形を選びますか？」で選ぶ）
      if (hit.tri) g.figureTriangles(fig).forEach(function (t) {
        const h = el('polygon', {
          points: t.map(function (n) { return g.fmt(fig.points[n]).replace(' ', ','); }).join(' '),
          class: 'hit hit-tri', 'data-tri': t.join(''), role: 'button', tabindex: '0', 'aria-label': '△' + t.join(''),
        }, gh);
        el('title', null, h).textContent = '△' + t.join('');
      });
      if (hit.seg) els.segments.forEach(function (s) {
        const h = line(s.h1, s.h2, {
          class: 'hit hit-seg', 'stroke-width': segHit, 'data-key': s.key,
          role: 'button', tabindex: '0', 'aria-label': '辺' + s.display,
        }, gh);
        el('title', null, h).textContent = '辺' + s.display;
      });
      if (hit.ang) els.angles.forEach(function (a) {
        const h = el('path', {
          d: g.sectorPath(a.vertex, a.from, a.to, g.angleHitRadius(fig, a, angleOnly)),
          class: 'hit hit-ang', 'data-key': a.key,
          role: 'button', tabindex: '0', 'aria-label': a.display,
        }, gh);
        el('title', null, h).textContent = a.display;
      });
    }
  }

  PH.renderer = { render: render };
})(typeof window !== 'undefined' ? window : globalThis);
