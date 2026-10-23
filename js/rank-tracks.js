/*
 * rank-tracks.js — 段位認定のコース（Ver.0.8。DOMに依存しない）
 *
 *   basic         … 基本の合同証明：3つの合同条件と、仮定・共通・対頂角・平行線・三角形の対応・合同な図形の性質
 *   comprehensive … 総合証明：基本のすべてに、二等辺三角形・正三角形・角の和と差（三段論法）・直角三角形などを加える
 *
 * 出題できるかどうかは、ステージ番号ではなく「その問題を解くのに必要な知識（topics）」で決める。
 *   元の問題の topics … 使う合同条件・根拠の理由・推論ルール・図形の性質（正三角形・正方形）から自動で求める
 *   ミニ問題の requiredTopics … 元の問題の topics（定理の確認問題のテンプレートは、テンプレートに書いた topics）
 *   コースの allowedTopics にすべてふくまれるミニ問題だけを出題する
 * あとで単元を追加したら、その topics を総合証明の allowedTopics に加える（Ver.0.9：平行四辺形の4つの topics を加えた）。
 * Ver.1.0：ひし形（rhombus）・長方形（rectangle）・四角形の分類（quadrilateralClassification）を総合証明に加えた（正方形 square は Ver.0.8 から）。
 * まだ実装していない単元の topics は、どのコースにも入れない（出題されない）。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  // 学習テーマ（topics）の表示名
  const TOPIC_LABEL = {
    basicCongruence: '3つの合同条件',
    given: '仮定',
    common: '共通な辺・角',
    vertical: '対頂角',
    alternate: '平行線の錯角',
    corresponding: '平行線の同位角',
    triangleCorrespondence: '三角形の対応',
    congruenceConsequence: '合同な図形の対応する辺・角',
    isosceles: '二等辺三角形',
    equilateral: '正三角形',
    angleExpressions: '角の和・差と三段論法',
    square: '正方形',
    rightTriangle: '直角三角形',
    rightTriangleRHA: '斜辺と1つの鋭角',
    rightTriangleRHS: '斜辺と他の1辺',
    // Ver.0.9：平行四辺形
    parallelogramProperties: '平行四辺形の性質',
    parallelogramConditions: '平行四辺形になるための条件',
    diagonalBisector: '対角線がそれぞれの中点で交わる',
    parallelConverse: '錯角・同位角が等しいならば平行',
    // Ver.1.0：特別な平行四辺形
    rhombus: 'ひし形',
    rectangle: '長方形',
    quadrilateralClassification: '四角形の分類',
  };

  const BASIC_TOPICS = ['basicCongruence', 'given', 'common', 'vertical', 'alternate', 'corresponding', 'triangleCorrespondence', 'congruenceConsequence'];

  // コースの定義。categoryWeights はカテゴリごとの出題の重み（新しい単元ばかり出ないよう、定理・直角三角形は軽め）
  const TRACKS = {
    basic: {
      id: 'basic',
      label: '基本の合同証明',
      short: '基本',
      lead: '3つの合同条件をマスター！',
      desc: '3つの合同条件と基本的な辺・角の性質に挑戦！',
      allowedTopics: BASIC_TOPICS.slice(),
      categoryWeights: { eq: 1, reason: 1, cond: 1, corr: 1, final: 1 },
    },
    comprehensive: {
      id: 'comprehensive',
      label: '総合証明',
      short: '総合',
      lead: 'いろいろな証明に挑戦！',
      desc: '二等辺三角形・直角三角形・平行四辺形・ひし形・長方形など、いろいろな証明に挑戦！',
      allowedTopics: BASIC_TOPICS.concat(['isosceles', 'equilateral', 'angleExpressions', 'square', 'rightTriangle', 'rightTriangleRHA', 'rightTriangleRHS',
        'parallelogramProperties', 'parallelogramConditions', 'diagonalBisector', 'parallelConverse',
        'rhombus', 'rectangle', 'quadrilateralClassification']),
      // 新しい単元（定理・三段論法、直角三角形、平行四辺形、四角形の分類）も、ほかのカテゴリと同じ重み（Ver.0.9 で 0.6 → 1）
      categoryWeights: { eq: 1, reason: 1, cond: 1, corr: 1, final: 1, theorem: 1, right: 1, para: 1, quad: 1 },
    },
  };
  const ORDER = ['basic', 'comprehensive'];

  // 根拠・結論の理由 → 学習テーマ
  const REASON_TOPIC = {
    given: 'given', common: 'common', commonAngle: 'common', vertical: 'vertical',
    alternate: 'alternate', corresponding: 'corresponding',
    correspondingSides: 'congruenceConsequence', correspondingAngles: 'congruenceConsequence',
    isoscelesBaseAngles: 'isosceles', equilateralSides: 'equilateral',
    squareSides: 'square', squareAngle: 'square', perpendicular: 'rightTriangle',
    parallelogramSides: 'parallelogramProperties', parallelogramParallel: 'parallelogramProperties',
    parallelogramAngles: 'parallelogramProperties', parallelogramDiagonals: 'diagonalBisector',
    alternateConverse: 'parallelConverse', correspondingConverse: 'parallelConverse',
    rhombusSides: 'rhombus', rhombusAngles: 'rhombus', midpoint: 'given',
  };
  // 推論ルール → 学習テーマ
  const RULE_TOPIC = {
    isoscelesBaseAngles: ['isosceles'], isoscelesConverse: ['isosceles'],
    angleAddition: ['angleExpressions'], angleSubtraction: ['angleExpressions'], triangleAngleSum: ['angleExpressions'],
    equalExpressions: ['angleExpressions'],
    parallelogramOppositeSidesParallel: ['parallelogramProperties'], parallelogramOppositeSidesEqual: ['parallelogramProperties'],
    parallelogramOppositeAnglesEqual: ['parallelogramProperties'], parallelogramDiagonalsBisect: ['parallelogramProperties', 'diagonalBisector'],
    halfSegments: ['parallelogramProperties'],
    parallelTransitive: ['parallelogramProperties'], equalTransitive: ['parallelogramProperties'], segmentSubtraction: ['parallelogramProperties'],
    alternateAnglesParallel: ['parallelConverse'],
    // Ver.1.0
    parallelogramAdjacentSupplementary: ['parallelogramProperties', 'rectangle'], parallelAlternateAngles: ['alternate', 'parallelogramProperties'],
    angleBisector: ['rhombus'], angleTransitive: ['angleExpressions'], isoscelesConverseSides: ['isosceles'],
  };
  // 合同条件 → 学習テーマ
  const CONDITION_TOPIC = {
    SSS: ['basicCongruence'], SAS: ['basicCongruence'], ASA: ['basicCongruence'],
    RHA: ['rightTriangle', 'rightTriangleRHA'], RHS: ['rightTriangle', 'rightTriangleRHS'],
  };

  function addAll(set, list) { (list || []).forEach(function (t) { if (set.indexOf(t) < 0) set.push(t); }); return set; }

  /*
   * 問題を解くのに必要な学習テーマ（使う合同条件・根拠の理由・推論ルール・図形の性質から）。
   * 未知の理由・ルールは 'unknown:…' として残す（どのコースにも入らないので、知らない単元が混ざらない）。
   */
  const topicCache = new WeakMap();
  function problemTopics(p) {
    if (topicCache.has(p)) return topicCache.get(p);
    const out = [];
    // 三角形の合同の部分（平行四辺形だけの問題にはない）
    if (!PH.hasCongruence || PH.hasCongruence(p)) {
      addAll(out, ['triangleCorrespondence']);
      addAll(out, CONDITION_TOPIC[p.congruence] || ['unknown:' + p.congruence]);
    }
    // Ver.0.9：平行四辺形の成立条件・根拠の理由（性質・平行の推論）
    if (PH.isQuadProblem && PH.isQuadProblem(p)) {
      // Ver.1.0：ひし形・長方形を証明する問題は、その種類の topics（平行四辺形の成立条件は使わない）
      const qt = PH.quadType ? PH.quadType(p) : 'parallelogram';
      addAll(out, qt === 'parallelogram' ? ['parallelogramConditions'] : [qt]);
      if (p.parallelogram.condition === 'PP_BISECT_DIAGONALS') addAll(out, ['diagonalBisector']);
      p.parallelogram.evidence.forEach(function (ev) {
        if (ev.reason !== 'proved') addAll(out, [REASON_TOPIC[ev.reason] || 'unknown:' + ev.reason]);
      });
    }
    p.evidence.forEach(function (ev) {
      if (ev.reason === 'proved') return;                 // 導いた事実は、そのステップのルールで数える
      addAll(out, [REASON_TOPIC[ev.reason] || 'unknown:' + ev.reason]);
    });
    if (PH.hasFinalStep && PH.hasFinalStep(p)) addAll(out, ['congruenceConsequence']);
    (p.proofSteps || []).forEach(function (s) {
      if (s.type === 'compare') { addAll(out, ['angleExpressions']); return; }
      addAll(out, RULE_TOPIC[s.rule] || ['unknown:' + s.rule]);
      if (s.type === 'expression' && /60°/.test(String(s.value))) addAll(out, ['equilateral']);
    });
    if ((p.equilateral || []).length) addAll(out, ['equilateral']);
    if ((p.square || []).length) addAll(out, ['square']);
    if (PH.isRightProblem && PH.isRightProblem(p)) addAll(out, ['rightTriangle']);
    topicCache.set(p, out);
    return out;
  }

  function get(id) { return TRACKS[id] || null; }

  // ミニ問題がそのコースで出題できるか（必要な知識がすべてコースの範囲内）
  function allows(track, q) {
    const t = typeof track === 'string' ? TRACKS[track] : track;
    if (!t || !q || !Array.isArray(q.requiredTopics) || !q.requiredTopics.length) return false;
    return q.requiredTopics.every(function (x) { return t.allowedTopics.indexOf(x) >= 0; });
  }

  // コースの出題候補（PH.rankQuestions.all() から抽出。正解データはコースごとに別管理しない）
  const poolCache = {};
  function pool(id) {
    if (!poolCache[id]) poolCache[id] = PH.rankQuestions.all().filter(function (q) { return allows(id, q); });
    return poolCache[id];
  }

  PH.rankTracks = {
    TRACKS: TRACKS,
    ORDER: ORDER,
    TOPIC_LABEL: TOPIC_LABEL,
    get: get,
    isTrack: function (id) { return !!TRACKS[id]; },
    problemTopics: problemTopics,
    allows: allows,
    pool: pool,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.rankTracks;
})(typeof window !== 'undefined' ? window : globalThis);
