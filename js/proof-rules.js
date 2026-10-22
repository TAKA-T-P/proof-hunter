/*
 * proof-rules.js — 多段階証明の推論ルール（Ver.0.7。DOMに依存しない）
 *
 * 定理・性質は「理由を1回選んで完了」する1ステップとして使う（細かく分けすぎない）。
 *   isoscelesBaseAngles  二等辺三角形の底角は等しい（AB＝AC → ∠ABC＝∠ACB）
 *   isoscelesConverse    2つの角が等しい三角形は二等辺三角形（∠DBC＝∠DCB → △DBCは二等辺三角形）
 *   equilateralAngles    正三角形の1つの角は60°
 *   equilateralSides     正三角形の3辺は等しい
 *   angleAddition        角の和（∠ACE＝∠ACD＋∠DCE）
 *   angleSubtraction     角の差（∠BAD＝∠BAC－∠DAC）
 *   equalExpressions     同じ式に等しい2つの角は等しい（③④の右辺が同じ → 左辺どうしが等しい）
 *   Ver.0.8：
 *   triangleAngleSum     三角形の内角の和は180°（∠ABD＝180°－∠ADB－∠DAB）
 *   perpendicularRightAngle  垂直な2直線がつくる角は90°（根拠の理由 perpendicular）
 *   squareRightAngle     正方形の角は90°（根拠の理由 squareAngle）
 *   rightTriangleHypotenuseAcute / rightTriangleHypotenuseLeg  直角三角形の合同条件（RHA / RHS。js/right-triangle.js で判定）
 *   Ver.0.9（平行四辺形。判定は js/parallelogram-rules.js）：
 *   parallelogramOppositeSidesParallel / parallelogramOppositeSidesEqual / parallelogramOppositeAnglesEqual / parallelogramDiagonalsBisect
 *                        平行四辺形の性質（平行四辺形だと分かっている四角形にだけ使う）
 *   alternateAnglesParallel / correspondingAnglesParallel  錯角・同位角が等しいならば2直線は平行
 *   halfSegments         等しい線分の半分（中点までの長さ）は等しい（OB＝OD、E・F が中点 → OE＝OF）
 *   PP_PARALLEL_PAIRS ほか5つ … 平行四辺形になるための条件（PH.PARALLELOGRAM_CONDITIONS）
 * 合同（三角形の合同・対応する辺・角）は既存の validation.js のしくみを使う（名前が重ならないよう、ここでは
 * 'triangleCongruence' は合同条件の判定、'correspondingSides'・'correspondingAngles' は PH.REASONS の既存の理由を指す）。
 *
 * check(...) は問題データが数学的に正しいかの確認用（verifyProblem から使う）。ゲームの正誤判定は問題データの正解と比べる。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function G() { return PH.geometry; }
  function E() { return PH.angleExpr; }
  function V() { return PH.validation; }

  function clean(n) { return String(n).replace(/[∠\s]/g, ''); }
  function near(a, b, tol) { return Math.abs(a - b) <= (tol || 0.5); }

  const RULES = {
    isoscelesBaseAngles: { label: '二等辺三角形の底角は等しいから', short: '二等辺三角形の底角' },
    isoscelesConverse: { label: '2つの角が等しい三角形は二等辺三角形だから', short: '2つの角が等しい三角形' },
    equilateralAngles: { label: '正三角形の1つの角は60°だから', short: '正三角形の角' },
    equilateralSides: { label: '正三角形の3辺は等しいから', short: '正三角形の辺' },
    angleAddition: { label: '角の和より', short: '角の和' },
    angleSubtraction: { label: '角の差より', short: '角の差' },
    equalExpressions: { label: '同じ式に等しいから', short: '式の比較' },
    triangleAngleSum: { label: '三角形の内角の和は180°だから', short: '三角形の内角の和' },
    perpendicularRightAngle: { label: '垂直な2直線がつくる角だから', short: '垂直', reason: 'perpendicular' },
    squareRightAngle: { label: '正方形の角だから', short: '正方形の角', reason: 'squareAngle' },
    rightTriangleHypotenuseAcute: { label: '直角三角形の斜辺と1つの鋭角がそれぞれ等しい', short: '斜辺と1つの鋭角', condition: 'RHA' },
    rightTriangleHypotenuseLeg: { label: '直角三角形の斜辺と他の1辺がそれぞれ等しい', short: '斜辺と他の1辺', condition: 'RHS' },
    triangleCongruence: { label: '三角形の合同条件', short: '合同' },
    // Ver.0.9：平行四辺形の性質（「平行四辺形である → …」）と平行の推論
    parallelogramOppositeSidesParallel: { label: '平行四辺形の対辺は平行だから', short: '平行四辺形の対辺（平行）', reason: 'parallelogramParallel' },
    parallelogramOppositeSidesEqual: { label: '平行四辺形の対辺は等しいから', short: '平行四辺形の対辺', reason: 'parallelogramSides' },
    parallelogramOppositeAnglesEqual: { label: '平行四辺形の対角は等しいから', short: '平行四辺形の対角', reason: 'parallelogramAngles' },
    parallelogramDiagonalsBisect: { label: '平行四辺形の対角線はそれぞれの中点で交わるから', short: '平行四辺形の対角線', reason: 'parallelogramDiagonals' },
    alternateAnglesParallel: { label: '錯角が等しいから', short: '錯角が等しい → 平行', reason: 'alternateConverse' },
    correspondingAnglesParallel: { label: '同位角が等しいから', short: '同位角が等しい → 平行', reason: 'correspondingConverse' },
    halfSegments: { label: '等しい線分の半分の長さは等しいから', short: '線分の半分' },
    // 平行四辺形になるための条件（「… → 平行四辺形である」。性質とは逆向きの推論）
    PP_PARALLEL_PAIRS: { label: '2組の対辺がそれぞれ平行', short: '成立条件①', condition: 'PP_PARALLEL_PAIRS' },
    PP_EQUAL_SIDES: { label: '2組の対辺がそれぞれ等しい', short: '成立条件②', condition: 'PP_EQUAL_SIDES' },
    PP_EQUAL_ANGLES: { label: '2組の対角がそれぞれ等しい', short: '成立条件③', condition: 'PP_EQUAL_ANGLES' },
    PP_BISECT_DIAGONALS: { label: '対角線がそれぞれの中点で交わる', short: '成立条件④', condition: 'PP_BISECT_DIAGONALS' },
    PP_PARALLEL_EQUAL_PAIR: { label: '1組の対辺が平行で、その長さが等しい', short: '成立条件⑤', condition: 'PP_PARALLEL_EQUAL_PAIR' },
  };

  // 理由を選ぶステップの誤答（その定理では言えない理由）。もっともらしい順
  const RULE_DISTRACTORS = {
    isoscelesBaseAngles: ['対頂角は等しいから', '平行線の錯角は等しいから'],
    isoscelesConverse: ['二等辺三角形の底角は等しいから', '正三角形の1つの角は60°だから'],
    angleAddition: ['角の差より', '対頂角は等しいから'],
    angleSubtraction: ['角の和より', '対頂角は等しいから'],
    triangleAngleSum: ['角の差より', '対頂角は等しいから'],
    parallelogramDiagonalsBisect: ['平行四辺形の対辺は等しいから', '対頂角は等しいから'],
    parallelogramOppositeSidesEqual: ['平行四辺形の対角は等しいから', '共通な辺だから'],
    parallelogramOppositeAnglesEqual: ['平行四辺形の対辺は等しいから', '対頂角は等しいから'],
    parallelogramOppositeSidesParallel: ['平行四辺形の対辺は等しいから', '錯角が等しいから'],
    halfSegments: ['平行四辺形の対角線はそれぞれの中点で交わるから', '平行四辺形の対辺は等しいから'],
  };

  // ---- データの確認（図と仮定から、そのルールで本当に言えるか） ---------------------------

  // AB＝AC（頂点 A を共有する2辺）→ 底角 ∠ABC＝∠ACB
  function checkIsoscelesBaseAngles(problem, premise, items) {
    const fig = problem.figure;
    const s1 = clean(premise[0]), s2 = clean(premise[1]);
    const apex = s1.split('').find(function (c) { return s2.indexOf(c) >= 0; });
    if (!apex) return '二等辺三角形の2辺が頂点を共有していない';
    const b = s1.replace(apex, ''), c = s2.replace(apex, '');
    if (!near(V().measure(fig, s1).value, V().measure(fig, s2).value)) return '仮定の2辺が図の上で等しくない';
    const want = [G().angleKey(fig, apex + b + c), G().angleKey(fig, apex + c + b)].sort().join('|');
    const got = items.map(function (n) { return G().elementKey(fig, n); }).sort().join('|');
    return want === got ? null : '結論が底角になっていない';
  }

  // ∠DBC＝∠DCB → △DBC は二等辺三角形（頂点 D）
  function checkIsoscelesConverse(problem, premise, tri) {
    const fig = problem.figure;
    const t = clean(tri).split('');
    if (t.length !== 3) return '三角形の名前が不正';
    const keys = premise.map(function (n) { return G().elementKey(fig, n); });
    const at = function (v) {
      const others = t.filter(function (x) { return x !== v; });
      return G().angleKey(fig, others[0] + v + others[1]);
    };
    const pairs = [[1, 2], [0, 2], [0, 1]];
    const ok = pairs.some(function (ij) {
      const want = [at(t[ij[0]]), at(t[ij[1]])].sort().join('|');
      return want === keys.slice().sort().join('|');
    });
    if (!ok) return '等しい2つの角が、その三角形の2つの角になっていない';
    if (!near(V().measure(fig, premise[0]).value, V().measure(fig, premise[1]).value)) return '2つの角が図の上で等しくない';
    return null;
  }

  /*
   * 大きさが分かっている角（角のキー → 度）。図の見た目ではなく、仮定から言えるものだけ：
   *   正三角形の角 60°（problem.equilateral）、直角 90°（仮定の「∠ABC＝90°」・直角の根拠。js/right-triangle.js）
   */
  function knownAngles(problem) {
    const fig = problem.figure;
    const out = {};
    (problem.equilateral || []).forEach(function (tri) {
      const t = clean(tri).split('');
      [0, 1, 2].forEach(function (i) {
        try { out[G().angleKey(fig, t[(i + 1) % 3] + t[i] + t[(i + 2) % 3])] = 60; } catch (e) { /* 図にない角 */ }
      });
    });
    if (PH.rightTriangle) PH.rightTriangle.knownRightAngles(problem).forEach(function (n) { out[G().elementKey(fig, n)] = 90; });
    return out;
  }

  /*
   * 角の式：target ＝ parts ＝ value
   *   parts は角の和・差（angleAddition / angleSubtraction）、または 180°－2つの角（triangleAngleSum：三角形の内角の和）。
   *   value は parts の角のうち、大きさが分かっている角（正三角形の 60°・直角の 90°）を数に置きかえた式。
   */
  function checkExpression(problem, step) {
    const fig = problem.figure;
    const parts = E().parse(fig, step.parts), value = E().parse(fig, step.value);
    if (!parts || !value) return '角の式が読めない';
    const target = E().singleAngle(E().parse(fig, step.target));
    if (!target) return '左辺が1つの角ではない';
    const signs = Object.keys(parts.terms).map(function (k) { return parts.terms[k]; });
    if (step.rule === 'angleAddition' && !(parts.constant === 0 && signs.length === 2 && signs.every(function (s) { return s === 1; }))) return '角の和の式になっていない';
    if (step.rule === 'angleSubtraction' && !(parts.constant === 0 && signs.length === 2 && signs.indexOf(-1) >= 0)) return '角の差の式になっていない';
    if (step.rule === 'triangleAngleSum') {
      // 180°－（同じ三角形のほかの2つの角）
      if (!(parts.constant === 180 && signs.length === 2 && signs.every(function (s) { return s === -1; }))) return '三角形の内角の和の式になっていない';
      const tv = clean(step.target), others = (String(step.parts).match(/∠[A-Z]{3}/g) || []).map(clean);
      const tri = tv.split('').sort().join('');
      if (!others.every(function (o) { return o.split('').sort().join('') === tri; }) || new Set([tv[1]].concat(others.map(function (o) { return o[1]; }))).size !== 3) {
        return '三角形の3つの角になっていない';
      }
    }
    const t = E().evaluate(fig, step.target), a = E().evaluate(fig, step.parts), b = E().evaluate(fig, step.value);
    if (!near(t, a) || !near(a, b)) return '角の式が図の上で成り立たない（' + t.toFixed(1) + '／' + a.toFixed(1) + '／' + b.toFixed(1) + '）';
    // 数に置きかえた角は、大きさが分かっている角（正三角形の角・直角）であること
    const known = knownAngles(problem);
    let constant = parts.constant;
    const keys = Object.keys(parts.terms);
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      if (value.terms[k] === parts.terms[k]) continue;
      if (value.terms[k] != null) return '角の係数が合わない';
      if (known[k] == null) return '数に置きかえた角の大きさの根拠（正三角形・直角）がない';
      constant += parts.terms[k] * known[k];
    }
    if (Object.keys(value.terms).some(function (k) { return parts.terms[k] == null; })) return '式にない角が右辺にある';
    if (Math.abs(constant - value.constant) > 1e-9) return '数に置きかえた式の値が合わない';
    return null;
  }

  // 2つの式の右辺が同じ → 左辺どうしが等しい
  function compareExpressions(problem, s1, s2) {
    const fig = problem.figure;
    const v1 = E().parse(fig, s1.value), v2 = E().parse(fig, s2.value);
    if (!v1 || !v2 || !E().equal(v1, v2)) return null;
    const k1 = E().singleAngle(E().parse(fig, s1.target)), k2 = E().singleAngle(E().parse(fig, s2.target));
    if (!k1 || !k2 || k1 === k2) return null;
    return [k1, k2];
  }

  /*
   * Ver.0.9：平行四辺形の性質のステップ（仮定の平行四辺形 step.quad の性質で、items が言えるか）
   *   例 p36 s1：四角形ABCDは平行四辺形 → OB＝OD（parallelogramDiagonalsBisect）
   */
  function checkParallelogramProperty(problem, step) {
    const PG = PH.parallelogram;
    if (!PG) return '平行四辺形の判定がない';
    const quad = String(step.quad || '').split('');
    if (!(problem.knownParallelograms || []).some(function (q) { return q.join('') === quad.join(''); })) return '仮定の平行四辺形ではない四角形の性質を使っている';
    const key = PG.factKey(problem.figure, step.items, step.rel);
    const ok = PG.propertyFacts(problem.figure, quad).some(function (f) { return f.key === key && f.rule === step.rule; });
    return ok ? null : '結論が、その平行四辺形の性質になっていない';
  }

  /*
   * Ver.0.9：等しい線分の半分（halfSegments）。premise の2つの線分が等しく、items の線分がそれぞれの「端点と中点」を結ぶ
   *   例 p36 s2：OB＝OD、E は OB の中点・F は OD の中点 → OE＝OF。中点は problem.midpoints（仮定）
   */
  function checkHalfSegments(problem, step) {
    const mids = problem.midpoints || [];
    const prem = (step.premise || []).map(clean);
    if (prem.length !== 2) return '前提の2つの線分がない';
    const items = step.items.map(clean);
    const used = [];
    const ok = items.every(function (s) {
      return prem.some(function (P, i) {
        if (used.indexOf(i) >= 0) return false;
        const m = mids.find(function (x) { return clean(x.of).split('').sort().join('') === P.split('').sort().join(''); });
        if (!m) return false;
        const end = P.split('').filter(function (c) { return s.indexOf(c) >= 0; });
        const hit = s.indexOf(m.point) >= 0 && end.length === 1;
        if (hit) used.push(i);
        return hit;
      });
    });
    if (!ok) return '結論が、等しい線分の端点と中点を結ぶ線分になっていない';
    // 図の上でも中点になっているか（データの確認）
    const v = G().vec;
    const bad = mids.some(function (m) {
      const s = clean(m.of), P = problem.figure.points[s[0]], Qp = problem.figure.points[s[1]], M = problem.figure.points[m.point];
      return !P || !Qp || !M || v.dist(M, v.lerp(P, Qp, 0.5)) > 0.5;
    });
    return bad ? '仮定の中点が図の上で中点になっていない' : null;
  }

  // 正三角形の2辺（equilateralSides の根拠）か
  function checkEquilateralSides(problem, items) {
    const sides = items.map(clean);
    return (problem.equilateral || []).some(function (tri) {
      return sides.every(function (s) { return s.length === 2 && tri.indexOf(s[0]) >= 0 && tri.indexOf(s[1]) >= 0; });
    }) ? null : '正三角形の2辺になっていない';
  }

  PH.PROOF_RULES = RULES;
  PH.proofRules = {
    RULES: RULES,
    RULE_DISTRACTORS: RULE_DISTRACTORS,
    label: function (id) { return RULES[id] ? RULES[id].label : ''; },
    checkIsoscelesBaseAngles: checkIsoscelesBaseAngles,
    checkIsoscelesConverse: checkIsoscelesConverse,
    checkExpression: checkExpression,
    compareExpressions: compareExpressions,
    checkEquilateralSides: checkEquilateralSides,
    checkParallelogramProperty: checkParallelogramProperty,
    checkHalfSegments: checkHalfSegments,
    knownAngles: knownAngles,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.proofRules;
})(typeof window !== 'undefined' ? window : globalThis);
