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
    triangleCongruence: { label: '三角形の合同条件', short: '合同' },
  };

  // 理由を選ぶステップの誤答（その定理では言えない理由）。もっともらしい順
  const RULE_DISTRACTORS = {
    isoscelesBaseAngles: ['対頂角は等しいから', '平行線の錯角は等しいから'],
    isoscelesConverse: ['二等辺三角形の底角は等しいから', '正三角形の1つの角は60°だから'],
    angleAddition: ['角の差より', '対頂角は等しいから'],
    angleSubtraction: ['角の和より', '対頂角は等しいから'],
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

  // 角の式：target ＝ parts ＝ value（parts は角の和・差、value は正三角形の 60° などを入れた式）
  function checkExpression(problem, step) {
    const fig = problem.figure;
    const parts = E().parse(fig, step.parts), value = E().parse(fig, step.value);
    if (!parts || !value) return '角の式が読めない';
    if (!E().parse(fig, step.target) || !E().singleAngle(E().parse(fig, step.target))) return '左辺が1つの角ではない';
    const signs = Object.keys(parts.terms).map(function (k) { return parts.terms[k]; });
    if (step.rule === 'angleAddition' && !(signs.length === 2 && signs.every(function (s) { return s === 1; }))) return '角の和の式になっていない';
    if (step.rule === 'angleSubtraction' && !(signs.length === 2 && signs.indexOf(-1) >= 0)) return '角の差の式になっていない';
    const t = E().evaluate(fig, step.target), a = E().evaluate(fig, step.parts), b = E().evaluate(fig, step.value);
    if (!near(t, a) || !near(a, b)) return '角の式が図の上で成り立たない（' + t.toFixed(1) + '／' + a.toFixed(1) + '／' + b.toFixed(1) + '）';
    // 定数角（60°など）に置きかえた角は、正三角形の角であること
    if (value.constant && !(problem.equilateral || []).length) return '定数角の根拠（正三角形）がない';
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
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.proofRules;
})(typeof window !== 'undefined' ? window : globalThis);
