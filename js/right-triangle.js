/*
 * right-triangle.js — 直角三角形の合同条件（Ver.0.8。DOMに依存しない）
 *
 *   RHA … 直角三角形の斜辺と1つの鋭角がそれぞれ等しい
 *   RHS … 直角三角形の斜辺と他の1辺がそれぞれ等しい
 *
 * 直角三角形であること（2つの三角形の直角）は、証明上の前提として根拠に入れる（evidence の role: 'right'）。
 * 図の見た目（座標で90°に見える）では認めない。仮定・垂直・正方形の角など、問題データに書いた理由で示す。
 * 斜辺・他の1辺・鋭角の区別は、直角の位置（三角形の頂点の対応）から求める。辺の長さや図の見た目では決めない。
 *   直角の頂点 r（triangles の位置）に対して、r をふくまない辺が斜辺、r をふくむ辺が他の1辺、r 以外の角が鋭角。
 *
 *   PH.rightTriangle.roleOf(problem, ev)         … 'right' | 'hypotenuse' | 'leg' | 'acute' | null
 *   PH.rightTriangle.slotRoles(problem)          … 根拠を集める欄の並び（直角 → 斜辺 → 他の1辺／鋭角）
 *   PH.rightTriangle.derive(problem, evidence)   … 根拠の組から言える合同条件（RHS・RHA。直角をはさむ2辺なら SAS など）
 *   PH.rightTriangle.hypotenuse(problem, i)      … i 番目の三角形の斜辺（'BD' など）
 *   PH.rightTriangle.verify(problem)             … 問題データの確認（テスト・開発用）
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function G() { return PH.geometry; }
  function V() { return PH.validation; }

  const ROLE_LABEL = { right: '直角', hypotenuse: '斜辺', leg: '他の1辺', acute: '鋭角' };
  const ROLE_NOTE = {
    right: '2つの三角形の直角',
    hypotenuse: '直角に向かい合う辺',
    leg: '斜辺ではない、もう1組の辺',
    acute: '直角ではない方の角',
  };
  // 直角であることの理由（ハンターの「直角」の欄・パズルの直角の理由のカードで選ぶ）
  const RIGHT_REASONS = ['given', 'perpendicular', 'squareAngle'];

  function clean(n) { return String(n).replace(/[∠\s]/g, ''); }
  function keysOf(problem, items) { return items.map(function (n) { return G().elementKey(problem.figure, n); }); }

  function isRightProblem(problem) { return !!(PH.isRightProblem && PH.isRightProblem(problem)); }

  function rightEvidence(problem) {
    return (problem.evidence || []).find(function (ev) { return ev.role === 'right'; }) || null;
  }

  // 根拠が、2つの三角形のどの「対応する辺・角」にあたるか（validation.classifyPair）
  function partOf(problem, ev) {
    try { return V().classifyPair(problem, keysOf(problem, ev.items)); } catch (e) { return null; }
  }

  // 直角の頂点の位置（triangles の何番目の頂点か）。直角の根拠がなければ null
  function rightIndex(problem) {
    const ev = rightEvidence(problem);
    const part = ev && partOf(problem, ev);
    return part && part.kind === 'angle' ? part.idx[0] : null;
  }

  // i 番目の三角形の斜辺（直角に向かい合う辺）
  function hypotenuse(problem, i) {
    const r = rightIndex(problem);
    if (r == null) return null;
    const t = problem.triangles[i || 0];
    return t.filter(function (_, k) { return k !== r; }).join('');
  }

  // i 番目の三角形の直角の頂点
  function rightVertex(problem, i) {
    const r = rightIndex(problem);
    return r == null ? null : problem.triangles[i || 0][r];
  }

  // 根拠の役割
  function roleOf(problem, ev) {
    if (!ev) return null;
    if (ev.role === 'right') return 'right';
    const r = rightIndex(problem);
    const part = partOf(problem, ev);
    if (r == null || !part) return null;
    if (part.kind === 'side') return part.idx.indexOf(r) < 0 ? 'hypotenuse' : 'leg';
    return part.idx[0] === r ? null : 'acute';
  }

  // 根拠を集める欄の並び：直角 → 斜辺 → 他の1辺（RHS）／鋭角（RHA）
  function slotRoles(problem) {
    if (!isRightProblem(problem)) return [];
    return ['right', 'hypotenuse', problem.congruence === 'RHS' ? 'leg' : 'acute'];
  }

  function evidenceForRole(problem, role) {
    return (problem.evidence || []).find(function (ev) { return roleOf(problem, ev) === role; }) || null;
  }

  /*
   * 根拠の組から言える合同条件（直角の根拠をふくむとき）。
   *   直角 ＋ 斜辺 ＋ 他の1辺   → RHS
   *   直角 ＋ 斜辺 ＋ 鋭角     → RHA
   *   直角 ＋ 直角をはさむ2辺  → SAS（直角がその間の角）
   *   直角 ＋ 直角と鋭角の間の辺 ＋ 鋭角 → ASA
   *   それ以外（対応していない・同じ組が2回・直角が2組など）→ null
   * 直角の根拠がなければ RHS・RHA は認めない（直角三角形であることが前提）。
   */
  function derive(problem, list) {
    if (!list || list.length !== 3) return null;
    const rights = list.filter(function (ev) { return ev && ev.role === 'right'; });
    if (rights.length !== 1) return null;
    const rp = partOf(problem, rights[0]);
    if (!rp || rp.kind !== 'angle') return null;
    const r = rp.idx[0];
    const sides = [], angles = [];
    for (let n = 0; n < list.length; n++) {
      const ev = list[n];
      if (ev === rights[0]) continue;
      const part = partOf(problem, ev);
      if (!part) return null;
      if (part.kind === 'side') {
        const id = part.idx.join(',');
        if (sides.some(function (s) { return s.join(',') === id; })) return null;
        sides.push(part.idx);
      } else {
        if (part.idx[0] === r || angles.indexOf(part.idx[0]) >= 0) return null;
        angles.push(part.idx[0]);
      }
    }
    if (sides.length === 2) {
      const hyp = sides.filter(function (s) { return s.indexOf(r) < 0; }).length;
      const legs = sides.length - hyp;
      if (hyp === 1 && legs === 1) return 'RHS';
      if (legs === 2) return 'SAS';
      return null;
    }
    if (sides.length === 1 && angles.length === 1) {
      const s = sides[0];
      if (s.indexOf(r) < 0) return 'RHA';
      if (s.indexOf(angles[0]) >= 0) return 'ASA';
      return null;
    }
    return null;
  }

  // ---- 直角の理由（データの確認用。図と仮定から、その理由で90°と言えるか） ------------------

  const vec = function () { return G().vec; };
  function onLine(P, A, B) {
    const v = vec();
    const d = v.unit(v.sub(B, A)), w = v.sub(P, A);
    return Math.abs(w.x * d.y - w.y * d.x) < 0.6;
  }
  function measure(problem, name) { return V().measure(problem.figure, name).value; }

  // 仮定に「∠ABC＝90°」「∠ABC＝∠DEF＝90°」と書かれている角
  function givenRightAngles(problem) {
    const out = [];
    (problem.given || []).forEach(function (g) {
      const s = String(g);
      if (!/＝90°$/.test(s)) return;
      s.replace(/＝90°$/, '').split('＝').forEach(function (n) { if (/^∠[A-Z]{3}$/.test(n)) out.push(n); });
    });
    return out;
  }

  // 垂直な2直線（problem.perpendicular の { a, b }）がつくる角か
  function perpendicularFor(problem, name) {
    const pts = problem.figure.points;
    const s = clean(name);
    const P = pts[s[0]], Q = pts[s[1]], R = pts[s[2]];
    return (problem.perpendicular || []).find(function (pp) {
      const a = [pts[pp.a[0]], pts[pp.a[1]]], b = [pts[pp.b[0]], pts[pp.b[1]]];
      const along = function (X, L) { return onLine(Q, L[0], L[1]) && onLine(X, L[0], L[1]); };
      return (along(P, a) && along(R, b)) || (along(P, b) && along(R, a));
    }) || null;
  }

  // 正方形の角か（頂点が正方形の頂点で、2本の半直線が正方形の2辺の向き）
  function squareFor(problem, name) {
    const pts = problem.figure.points;
    const s = clean(name);
    const v = vec();
    return (problem.square || []).find(function (sq) {
      const i = sq.indexOf(s[1]);
      if (i < 0) return false;
      const n1 = sq[(i + 1) % 4], n2 = sq[(i + 3) % 4];
      const dir = function (X) { return v.unit(v.sub(pts[X], pts[s[1]])); };
      const same = function (X, Y) { const a = dir(X), b = dir(Y); return a.x * b.x + a.y * b.y > 0.999; };
      return (same(s[0], n1) && same(s[2], n2)) || (same(s[0], n2) && same(s[2], n1));
    }) || null;
  }

  // 正方形の2辺か（squareSides の根拠）
  function squareSidesOk(problem, items) {
    return (problem.square || []).some(function (sq) {
      const sides = [0, 1, 2, 3].map(function (i) { return [sq[i], sq[(i + 1) % 4]].sort().join(''); });
      return items.every(function (n) { return sides.indexOf(clean(n).split('').sort().join('')) >= 0; });
    });
  }

  /*
   * 90°と分かっている角（仮定・垂直・正方形の角。図の見た目ではない）。
   * 角の式（angle-expression）の定数 90° の根拠にも使う。
   */
  function knownRightAngles(problem) {
    const out = givenRightAngles(problem).slice();
    const ev = rightEvidence(problem);
    if (ev) ev.items.forEach(function (n) { if (out.indexOf(n) < 0) out.push(n); });
    return out;
  }

  // 直角の根拠の理由が、図と仮定から言えるか（言えなければ理由の文字列）
  function checkRightReason(problem, ev) {
    if (ev.reason === 'given') {
      return (problem.given || []).indexOf(PH.evidenceText(ev)) >= 0 ? null : '仮定に「' + PH.evidenceText(ev) + '」がない';
    }
    if (ev.reason === 'perpendicular') {
      for (let i = 0; i < ev.items.length; i++) {
        const pp = perpendicularFor(problem, ev.items[i]);
        if (!pp) return ev.items[i] + ' が垂直な2直線の角になっていない';
        if ((problem.given || []).indexOf(pp.label) < 0) return '仮定に「' + pp.label + '」がない';
      }
      return null;
    }
    if (ev.reason === 'squareAngle') {
      for (let i = 0; i < ev.items.length; i++) if (!squareFor(problem, ev.items[i])) return ev.items[i] + ' が正方形の角になっていない';
      return null;
    }
    if (ev.reason === 'proved') return ev.fromStep ? null : '導いた直角に fromStep がない';
    return '直角の理由が不正: ' + ev.reason;
  }

  // ---- データの確認 ---------------------------------------------------------------------

  function verify(problem) {
    const errors = [];
    const fig = problem.figure;
    const rights = (problem.evidence || []).filter(function (ev) { return ev.role === 'right'; });
    const isRight = isRightProblem(problem);
    if (isRight !== (rights.length > 0)) errors.push('直角三角形の合同条件と、直角の根拠（role: right）が合わない');
    if (rights.length > 1) errors.push('直角の根拠が2つ以上ある');
    rights.forEach(function (ev) {
      if (!ev.items.every(function (n) { return G().isAngleName(n); })) errors.push(ev.id + ': 直角の根拠が角になっていない');
      ev.items.forEach(function (n) {
        if (Math.abs(measure(problem, n) - 90) > 0.5) errors.push(ev.id + ': ' + n + ' が図の上で90°でない');
      });
      const part = partOf(problem, ev);
      if (!part || part.kind !== 'angle') errors.push(ev.id + ': 直角が2つの三角形の対応する角になっていない');
      if (ev.mark !== 'right') errors.push(ev.id + ': 直角の根拠の印は mark: right');
      if (RIGHT_REASONS.concat(['proved']).indexOf(ev.reason) < 0) errors.push(ev.id + ': 直角の理由として使えない: ' + ev.reason);
      const err = checkRightReason(problem, ev);
      if (err) errors.push(ev.id + ': ' + err);
    });
    if (isRight && rights.length === 1) {
      // 根拠の役割が、欄の並び（直角・斜辺・他の1辺／鋭角）とちょうど一致する
      const roles = problem.evidence.map(function (ev) { return roleOf(problem, ev); }).slice().sort().join(',');
      const want = slotRoles(problem).slice().sort().join(',');
      if (roles !== want) errors.push('根拠の役割が合同条件と合わない: ' + roles + ' / ' + want);
      problem.triangles.forEach(function (t, i) {
        if (Math.abs(measure(problem, '∠' + t[(rightIndex(problem) + 1) % 3] + rightVertex(problem, i) + t[(rightIndex(problem) + 2) % 3]) - 90) > 0.5) {
          errors.push('△' + t.join('') + ' の直角の位置が図と合わない');
        }
      });
      if (!(problem.hints && problem.hints.congruence && problem.hints.congruence.length === 3)) errors.push('合同条件のヒントが3段階ない');
    }
    // 正方形の辺・正方形のデータ
    (problem.evidence || []).forEach(function (ev) {
      if (ev.reason === 'squareSides' && !squareSidesOk(problem, ev.items)) errors.push(ev.id + ': 正方形の2辺になっていない');
      if ((ev.reason === 'perpendicular' || ev.reason === 'squareAngle') && ev.role !== 'right') errors.push(ev.id + ': 直角の理由は直角の根拠だけに使う');
    });
    (problem.square || []).forEach(function (sq) {
      const p = sq.split('').map(function (n) { return fig.points[n]; });
      if (p.some(function (x) { return !x; })) { errors.push('正方形の頂点が図にない: ' + sq); return; }
      const v = vec();
      const L = [0, 1, 2, 3].map(function (i) { return v.dist(p[i], p[(i + 1) % 4]); });
      if (L.some(function (l) { return Math.abs(l - L[0]) > 0.5; })) errors.push('正方形の辺の長さが等しくない: ' + sq);
      [0, 1, 2, 3].forEach(function (i) {
        const ang = measure(problem, '∠' + sq[(i + 3) % 4] + sq[i] + sq[(i + 1) % 4]);
        if (Math.abs(ang - 90) > 0.5) errors.push('正方形の角が90°でない: ' + sq);
      });
      if ((problem.given || []).indexOf('四角形' + sq + 'は正方形') < 0) errors.push('仮定に「四角形' + sq + 'は正方形」がない');
    });
    (problem.perpendicular || []).forEach(function (pp) {
      const pts = fig.points;
      if (![pp.a[0], pp.a[1], pp.b[0], pp.b[1]].every(function (n) { return pts[n]; })) { errors.push('垂直の直線の点が図にない: ' + pp.label); return; }
      const v = vec();
      const d1 = v.unit(v.sub(pts[pp.a[1]], pts[pp.a[0]])), d2 = v.unit(v.sub(pts[pp.b[1]], pts[pp.b[0]]));
      if (Math.abs(d1.x * d2.x + d1.y * d2.y) > 0.01) errors.push('垂直の2直線が図の上で垂直でない: ' + pp.label);
      if ((problem.given || []).indexOf(pp.label) < 0) errors.push('仮定に「' + pp.label + '」がない');
    });
    // 図の直角の印：90°で、仮定・垂直から分かっている角だけ（正方形の角など、導く直角は最初から見せない）
    const known = givenRightAngles(problem).concat(rights.filter(function (ev) { return ev.reason === 'given' || ev.reason === 'perpendicular'; })
      .reduce(function (a, ev) { return a.concat(ev.items); }, []));
    const knownKeys = known.map(function (n) { return G().angleKey(fig, n); });
    (fig.rightMarks || []).forEach(function (n) {
      if (Math.abs(measure(problem, '∠' + n) - 90) > 0.5) errors.push('直角の印の角が90°でない: ∠' + n);
      if (knownKeys.indexOf(G().angleKey(fig, n)) < 0) errors.push('直角の印が、仮定・垂直から分かる角ではない: ∠' + n);
    });
    return errors;
  }

  PH.rightTriangle = {
    ROLE_LABEL: ROLE_LABEL,
    ROLE_NOTE: ROLE_NOTE,
    RIGHT_REASONS: RIGHT_REASONS,
    isRightProblem: isRightProblem,
    rightEvidence: rightEvidence,
    rightIndex: rightIndex,
    rightVertex: rightVertex,
    hypotenuse: hypotenuse,
    roleOf: roleOf,
    slotRoles: slotRoles,
    evidenceForRole: evidenceForRole,
    derive: derive,
    knownRightAngles: knownRightAngles,
    givenRightAngles: givenRightAngles,
    perpendicularFor: perpendicularFor,
    squareFor: squareFor,
    squareSidesOk: squareSidesOk,
    checkRightReason: checkRightReason,
    verify: verify,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.rightTriangle;
})(typeof window !== 'undefined' ? window : globalThis);
