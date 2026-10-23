// 証明ハンター Ver.1.0 のテスト（STAGE 11「特別な平行四辺形」・ひし形／長方形／正方形の分類・段位認定の「四角形の分類」）
//   p43 ひし形と直角三角形の合同（RHA）／ p44・p45 ひし形になることの証明／ p46〜p48 長方形になることの証明（p47・p48 は合同を経由）
// 実行: npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/problems.js');
require('../js/geometry.js');
require('../js/validation.js');
require('../js/right-triangle.js');
require('../js/quadrilateral.js');
require('../js/parallelogram-rules.js');
require('../js/special-quadrilaterals.js');
require('../js/angle-expression.js');
require('../js/proof-rules.js');
require('../js/proof-engine.js');
require('../js/hints.js');
require('../js/storage.js');
require('../js/game.js');
require('../js/math-keypad.js');
require('../js/puzzle.js');
require('../js/rank-config.js');
require('../js/rank-tracks.js');
require('../js/rank-questions.js');
require('../js/rank-game.js');

const PH = globalThis.PH;
const val = PH.validation;
const geo = PH.geometry;
const PG = PH.parallelogram;
const S = PH.specialQuad;
const RT = PH.rightTriangle;
const TR = PH.rankTracks;
const CFG = PH.rank.config;
const k = (p, n) => geo.elementKey(p.figure, n);
const P = (id) => PH.getProblem(id);
const NEW_IDS = ['p43', 'p44', 'p45', 'p46', 'p47', 'p48'];
const SPECIAL_IDS = ['p44', 'p45', 'p46', 'p47', 'p48'];        // 結論がひし形・長方形
const TYPES = ['fill', 'build', 'challenge'];
const ABCD = ['A', 'B', 'C', 'D'];
const OLD = PH.problems.filter((p) => Number(p.id.slice(1)) <= 42);

function variant(p, over) { return Object.assign({}, p, over); }
function withQuad(p, over) { return Object.assign({}, p, { parallelogram: Object.assign({}, p.parallelogram, over) }); }

// ---- ハンター ------------------------------------------------------------------------

function sel(g, a, b) {
  const p = g.problem;
  g.setMode(geo.isAngleName(a) ? 'angle' : 'side');
  g.clearSelection();
  g.tap(k(p, a));
  g.tap(k(p, b));
}

function solveStep(g) {
  const s = g.currentStep();
  if (s.type === 'compare') s.dependsOn.forEach((d) => g.pickPart(d, 'value'));
  else g.chooseStepOption('a');
  return g.confirmStep();
}

// 四角形の根拠を1つ答える（導く根拠は「詳しい理由を説明する」でステップを解く）
function answerQ(g, ev, reason) {
  sel(g, ev.items[0], ev.items[1]);
  if (g.relation !== (ev.rel === 'parallel' ? 'parallel' : 'eq')) g.toggleRelation();
  if (ev.fromStep && (reason || ev.reason) === 'proved') {
    const r = g.explain();
    assert.equal(r.status, 'explain');
    let last = null;
    while (g.phase === 'step') { last = solveStep(g); assert.equal(last.status, 'correct'); }
    return { status: last && last.registered && last.registered.id === ev.id ? 'correct' : 'not-registered' };
  }
  g.selectReason(reason || ev.reason);
  return g.confirmEvidence();
}

// 三角形の合同の部分（三角形 → 根拠 → 合同条件 → 結論）
function solveLemma(g) {
  const p = g.problem;
  if (g.phase === 'triangle') {
    g.tapTriangle(p.triangles[0]);
    g.tapTriangle(p.triangles[1]);
    assert.equal(g.confirmTriangles().status, 'ok');
  }
  const list = g.roles.length ? g.roles.map((r) => RT.evidenceForRole(p, r)) : p.evidence;
  list.forEach((ev) => {
    if (g.roles.length) g.selectRole(RT.roleOf(p, ev));
    sel(g, ev.items[0], ev.items[1]);
    g.selectReason(ev.reason);
    assert.equal(g.confirmEvidence().status, 'correct', p.id + ' ' + ev.id);
  });
  g.selectCondition(p.congruence);
  const c = g.confirmCondition();
  assert.equal(c.ok, true);
  if (!p.finalStep) return c;
  sel(g, p.finalStep.items[0], p.finalStep.items[1]);
  g.selectReason(p.finalStep.reason);
  return g.confirmFinal();
}

function solveHunter(p) {
  const g = new PH.Game(p);
  if (PH.hasCongruence(p)) solveLemma(g);
  if (PH.isQuadProblem(p)) {
    assert.equal(g.phase, 'qcollect', p.id);
    p.parallelogram.evidence.forEach((ev) => assert.equal(answerQ(g, ev).status, 'correct', p.id + ' ' + ev.id));
    assert.equal(g.phase, 'qcondition');
    assert.equal(g.selectCondition(p.parallelogram.condition), true);
    assert.equal(g.confirmCondition().ok, true);
  }
  return g;
}

// ---- パズル --------------------------------------------------------------------------

function fill(z, placement) {
  z.slots.forEach((s) => {
    if (placement[s.id] == null) return;
    z.selectSlot(s.id);
    const ok = s.input ? z.setInput(placement[s.id]) : z.place(placement[s.id]);
    assert.equal(ok, true, s.id + ' ' + placement[s.id]);
  });
}

function withFakeStorage(initial, fn) {
  const mem = { [PH.storage.KEY]: initial };
  const fake = { getItem: (key) => (key in mem ? mem[key] : null), setItem: (key, v) => { mem[key] = String(v); } };
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  PH.storage._reset();
  try { fn(mem); } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
    PH.storage._reset();
  }
}

// =====================================================================================
// 21-1 図形分類
// =====================================================================================

test('図形の種類（QUADRILATERAL_TYPES）と包含関係', () => {
  assert.deepEqual(PH.QUADRILATERAL_TYPES, { parallelogram: '平行四辺形', rhombus: 'ひし形', rectangle: '長方形', square: '正方形' });
  assert.deepEqual(S.implied('square'), ['parallelogram', 'rhombus', 'rectangle', 'square']);
  assert.deepEqual(S.implied('rhombus'), ['parallelogram', 'rhombus']);
  assert.deepEqual(S.implied('rectangle'), ['parallelogram', 'rectangle']);
  assert.deepEqual(S.implied('parallelogram'), ['parallelogram']);
  assert.equal(S.isA('rhombus', 'parallelogram'), true);
  assert.equal(S.isA('rectangle', 'parallelogram'), true);
  assert.equal(S.isA('square', 'rhombus'), true);
  assert.equal(S.isA('square', 'rectangle'), true);
  assert.equal(S.isA('square', 'parallelogram'), true);
  // 一般的な種類から、特別な種類へは変換しない
  assert.equal(S.isA('parallelogram', 'rhombus'), false);
  assert.equal(S.isA('rhombus', 'rectangle'), false);
  assert.equal(S.isA('rectangle', 'square'), false);
  assert.equal(S.mostSpecific(['rhombus', 'rectangle']), 'square');
  assert.deepEqual(S.verifyTables(), []);
});

test('ひし形の成立条件：4辺が等しい／平行四辺形で隣り合う2辺が等しい／平行四辺形で対角線が垂直', () => {
  assert.equal(S.classify(null, ['allSidesEqual']), 'rhombus');
  assert.equal(S.classify('parallelogram', ['adjacentSidesEqual']), 'rhombus');
  assert.equal(S.classify('parallelogram', ['diagonalsPerpendicular']), 'rhombus');
  assert.deepEqual(S.conditionsFor('parallelogram', ['adjacentSidesEqual'], 'rhombus'), ['rhombusAdjacentEqual']);
  assert.deepEqual(S.conditionsFor(null, ['allSidesEqual'], 'rhombus'), ['rhombusDefinition']);
});

test('長方形の成立条件：4つの角が等しい／平行四辺形で1つの角が直角／平行四辺形で対角線が等しい', () => {
  assert.equal(S.classify(null, ['allAnglesEqual']), 'rectangle');
  assert.equal(S.classify('parallelogram', ['oneRightAngle']), 'rectangle');
  assert.equal(S.classify('parallelogram', ['diagonalsEqual']), 'rectangle');
  assert.deepEqual(S.conditionsFor('parallelogram', ['diagonalsEqual'], 'rectangle'), ['rectangleDiagonalsEqual']);
});

test('正方形の成立条件：4辺・4角／長方形で隣り合う2辺／ひし形で1つの直角／平行四辺形で対角線が等しく垂直', () => {
  assert.equal(S.classify(null, ['allSidesEqual', 'allAnglesEqual']), 'square');
  assert.equal(S.classify('rectangle', ['adjacentSidesEqual']), 'square');
  assert.equal(S.classify('rhombus', ['oneRightAngle']), 'square');
  assert.equal(S.classify('parallelogram', ['diagonalsEqual', 'diagonalsPerpendicular']), 'square');
  assert.deepEqual(S.conditionsFor('rectangle', ['adjacentSidesEqual'], 'square'), ['squareRectangleAdjacent']);
  assert.deepEqual(S.conditionsFor('rhombus', ['oneRightAngle'], 'square'), ['squareRhombusRightAngle']);
  assert.ok(S.guaranteedTypes('square', []).includes('rhombus'));
});

test('平行四辺形であることの前提を確認する：対角線が等しいだけ・垂直なだけでは判定しない', () => {
  assert.equal(S.classify(null, ['diagonalsEqual']), null);
  assert.equal(S.classify(null, ['diagonalsPerpendicular']), null);
  assert.equal(S.classify(null, ['adjacentSidesEqual']), null);
  assert.equal(S.classify(null, ['oneRightAngle']), null);
  assert.equal(S.classify(null, ['diagonalsEqual', 'diagonalsPerpendicular']), null);
  // 図の事実による判定（ハンター・パズル）：前提の平行四辺形がなければ「平行四辺形で…」の条件は成り立たない
  const fig = P('p48').figure;
  const facts = [{ id: 'd', items: ['AC', 'BD'] }, { id: 'r', items: ['∠DAB'], rel: 'right' }];
  const none = S.deriveSpecialCondition({ figure: fig, vertices: ABCD, knownTypes: [] }, facts).map((a) => a.condition);
  assert.deepEqual(none, []);
  const para = S.deriveSpecialCondition({ figure: fig, vertices: ABCD, knownTypes: ['parallelogram'] }, facts).map((a) => a.condition);
  assert.deepEqual(para.sort(), ['rectangleDiagonalsEqual', 'rectangleOneRightAngle']);
  // 4辺が等しいこと（定義）は前提なしで、等式をつないで判定する（AB＝DC、AD＝BC、AB＝AD → 4辺）
  const rh = P('p44').figure;
  const sides = [{ id: 1, items: ['AB', 'DC'] }, { id: 2, items: ['AD', 'BC'] }, { id: 3, items: ['AB', 'AD'] }];
  assert.ok(S.deriveSpecialCondition({ figure: rh, vertices: ABCD, knownTypes: [] }, sides).some((a) => a.condition === 'rhombusDefinition'));
  assert.ok(!S.deriveSpecialCondition({ figure: rh, vertices: ABCD, knownTypes: [] }, sides.slice(0, 2)).some((a) => a.condition === 'rhombusDefinition'));
  // 自己交差した四角形は判定しない
  assert.deepEqual(S.deriveSpecialCondition({ figure: rh, vertices: ['A', 'C', 'B', 'D'], knownTypes: ['parallelogram'] }, sides), []);
});

test('推論ルールの追加（IDの衝突がない）', () => {
  const rules = ['rhombusDefinition', 'rhombusAdjacentEqual', 'rhombusDiagonalPerpendicular', 'rectangleDefinition', 'rectangleOneRightAngle',
    'rectangleDiagonalsEqual', 'parallelogramAdjacentSupplementary', 'angleBisector', 'segmentMidpoint'];
  rules.forEach((r) => {
    assert.ok(PH.PROOF_RULES[r], r);
    assert.equal(PH.REASONS[r], undefined, r + ' は理由IDと重ならない');
  });
  assert.equal(PH.PROOF_RULES.segmentMidpoint.reason, 'midpoint');
  assert.equal(PH.REASONS.midpoint.label, '中点より');
  assert.deepEqual(S.PROOF_CONDITION_ORDER.map((c) => PH.SPECIAL_CONDITIONS[c].type), ['rhombus', 'rhombus', 'rhombus', 'rectangle', 'rectangle', 'rectangle']);
  // 既存の平行四辺形の5つの成立条件・ルールはそのまま
  assert.deepEqual(PH.PARALLELOGRAM_CONDITION_ORDER, ['PP_PARALLEL_PAIRS', 'PP_EQUAL_SIDES', 'PP_EQUAL_ANGLES', 'PP_BISECT_DIAGONALS', 'PP_PARALLEL_EQUAL_PAIR']);
  assert.deepEqual(PH.quadConditionOrder(P('p31')), PH.PARALLELOGRAM_CONDITION_ORDER);
  assert.deepEqual(PH.quadConditionOrder(P('p44')), S.PROOF_CONDITION_ORDER);
});

test('証明済み事実（quadrilateralType）：包含関係で使えるが、証明していない種類へは変換しない', () => {
  const e = new PH.ProofEngine(P('p44'));
  // 仮定の「四角形ABCDは平行四辺形」は登録済み。ひし形ではない
  assert.equal(e.hasType(ABCD, 'parallelogram'), true);
  assert.equal(e.hasType(ABCD, 'rhombus'), false);
  e.establishType(ABCD, 'rhombus');
  assert.equal(e.hasType(['C', 'D', 'A', 'B'], 'rhombus'), true);      // 頂点の回転・逆回りは同じ四角形
  assert.equal(e.hasType(['D', 'C', 'B', 'A'], 'parallelogram'), true);
  assert.equal(e.hasType(ABCD, 'square'), false);
  assert.equal(e.hasType(ABCD, 'rectangle'), false);
  e.establishType(ABCD, 'square');
  ['square', 'rectangle', 'rhombus', 'parallelogram'].forEach((t) => assert.equal(e.hasType(ABCD, t), true, t));
  assert.deepEqual(e.typeFacts(), [{ kind: 'quadrilateralType', vertices: ABCD, type: 'square', types: ['parallelogram', 'rhombus', 'rectangle', 'square'] }]);
  // 仮定がひし形の問題（p43）は、ひし形・平行四辺形として使える
  const e43 = new PH.ProofEngine(P('p43'));
  assert.equal(e43.hasType(ABCD, 'rhombus'), true);
  assert.equal(e43.hasType(ABCD, 'parallelogram'), true);
  assert.equal(e43.hasType(ABCD, 'square'), false);
});

// =====================================================================================
// 21-2 新規6問
// =====================================================================================

test('48問・11ステージ。STAGE 11「特別な平行四辺形」は p43〜p48', () => {
  assert.equal(PH.problems.length, 48);
  assert.equal(PH.STAGES.length, 11);
  const st = PH.getStage(11);
  assert.equal(st.title, '特別な平行四辺形');
  assert.equal(st.theme, 'ひし形・長方形の性質を使い、証明を完成させよう！');
  assert.deepEqual(PH.stageProblems(11).map((p) => p.id), NEW_IDS);
  assert.deepEqual(NEW_IDS.map((id) => P(id).difficulty), [2, 1, 2, 1, 3, 3]);
  assert.deepEqual(val.verifyAll(PH.problems, PH.STAGES), []);
});

test('p43〜p48 の仮定・結論・推論が正しい', () => {
  assert.equal(PH.conclusionType(P('p43')), 'triangleCongruence');
  assert.equal(P('p43').conclusion, '△ABH≡△ADK');
  assert.deepEqual(['p44', 'p45'].map((id) => PH.quadType(P(id))), ['rhombus', 'rhombus']);
  assert.deepEqual(['p46', 'p47', 'p48'].map((id) => PH.quadType(P(id))), ['rectangle', 'rectangle', 'rectangle']);
  SPECIAL_IDS.forEach((id) => {
    const p = P(id);
    assert.equal(p.conclusion, '四角形ABCDは' + PH.quadTypeName(p));
    assert.ok(p.given.includes('四角形ABCDは平行四辺形'), id);
    assert.deepEqual(S.knownTypes(p, ABCD), ['parallelogram'], id);     // 結論の種類は仮定にない
    assert.deepEqual(PG.verify(p), [], id);
    const r = PG.deriveCondition(p, p.parallelogram.evidence);
    assert.ok(r.all.some((a) => a.condition === p.parallelogram.condition), id);
    // 図は、結論の種類の図形に描いてある（判定には使わない）
    assert.equal(PG.holdsSpecial(p.figure, ABCD, PH.quadType(p)), true, id);
  });
  // 根拠を1つ減らすと、4つの辺（角）がすべて等しいとはいえない
  SPECIAL_IDS.forEach((id) => {
    const p = P(id);
    p.parallelogram.evidence.forEach((_, i) => {
      const evs = p.parallelogram.evidence.filter((__, j) => j !== i);
      const r = PG.deriveCondition(p, evs);
      assert.ok(!r || !r.all.some((a) => a.condition === p.parallelogram.condition), id + ' -' + i);
    });
  });
  // 多段階証明のデータ（p45・p46）：前提を変えると誤りを見つける
  assert.deepEqual(PH.proofEngine.verify(P('p45')), []);
  assert.deepEqual(PH.proofEngine.verify(P('p46')), []);
  assert.ok(PH.proofEngine.verify(variant(P('p45'), { given: ['四角形ABCDは平行四辺形', 'ACは∠BCDの二等分線'] })).length > 0);
  assert.ok(PH.proofEngine.verify(variant(P('p46'), { given: ['四角形ABCDは平行四辺形'] })).length > 0);
  // ひし形の性質は、仮定のひし形にだけ（p43）
  assert.deepEqual(PG.verifyKnown(P('p43')), []);
  assert.ok(PG.verifyKnown(variant(P('p43'), { given: ['四角形ABCDは平行四辺形', 'AH⊥BC', 'AK⊥CD'] })).length > 0);
});

test('ハンターモードで p43〜p48 を解ける（ミス・ヒントなしで★3）', () => {
  NEW_IDS.forEach((id) => {
    const g = solveHunter(P(id));
    assert.equal(g.phase, 'clear', id);
    assert.equal(g.misses, 0, id);
    assert.equal(g.stars, 3, id);
    if (id !== 'p43') assert.deepEqual(g.provedType, { kind: 'quadrilateralType', vertices: ABCD, type: PH.quadType(P(id)) }, id);
  });
});

test('証明パズル3レベル（おてがる・スタンダード・チャレンジ）で p43〜p48 を解ける', () => {
  NEW_IDS.forEach((id) => TYPES.forEach((t) => {
    const p = P(id);
    const z = new PH.Puzzle(p, t);
    assert.equal(z.slots.some((s) => s.id === 'pcond'), PH.isQuadProblem(p), id + ' ' + t);
    // ひし形・長方形の成立条件はカードで選ぶ（キーパッドで入力しない）
    if (PH.isQuadProblem(p)) {
      assert.equal(z.slots.find((s) => s.id === 'pcond').input, undefined);
      assert.deepEqual(z.cards.pcond.map((c) => c.cond), S.PROOF_CONDITION_ORDER);
    }
    fill(z, z.solution());
    const r = z.check();
    assert.equal(r.status, 'clear', id + ' ' + t + ' ' + JSON.stringify(r.result && r.result.messages));
    assert.equal(z.misses, 0);
  }));
});

test('p43：ひし形の性質を使い、直角三角形の合同条件（RHA）で証明できる', () => {
  const p = P('p43');
  assert.equal(p.congruence, 'RHA');
  assert.equal(PH.isRightProblem(p), true);
  assert.deepEqual(RT.slotRoles(p), ['right', 'hypotenuse', 'acute']);
  assert.equal(geo.segKey(RT.hypotenuse(p, 0)), geo.segKey('AB'));
  assert.equal(geo.segKey(RT.hypotenuse(p, 1)), geo.segKey('AD'));
  assert.equal(val.deriveCondition(p, p.evidence), 'RHA');
  // ∠ABH・∠ADK はひし形の対角（∠ABC・∠ADC）
  assert.equal(k(p, '∠ABH'), k(p, '∠ABC'));
  assert.equal(k(p, '∠ADK'), k(p, '∠ADC'));
  // 鋭角の理由は「ひし形の対角」でも「平行四辺形の対角」でもよい（ひし形は平行四辺形）
  const g = new PH.Game(p);
  const right = RT.evidenceForRole(p, 'right'), hyp = RT.evidenceForRole(p, 'hypotenuse'), acute = RT.evidenceForRole(p, 'acute');
  [right, hyp].forEach((ev) => { g.selectRole(RT.roleOf(p, ev)); sel(g, ev.items[0], ev.items[1]); g.selectReason(ev.reason); assert.equal(g.confirmEvidence().status, 'correct'); });
  g.selectRole('acute');
  sel(g, acute.items[0], acute.items[1]);
  g.selectReason('parallelogramAngles');
  assert.equal(g.confirmEvidence().status, 'correct');
  g.selectCondition('RHA');
  assert.equal(g.confirmCondition().ok, true);
  assert.equal(g.misses, 0);
  // 斜辺の欄で鋭角を先に答えても、ミスにしない（Ver.0.9 の仕様）
  const g2 = new PH.Game(p);
  g2.selectRole('right');
  sel(g2, right.items[0], right.items[1]); g2.selectReason(right.reason); g2.confirmEvidence();
  sel(g2, acute.items[0], acute.items[1]); g2.selectReason(acute.reason);
  assert.equal(g2.confirmEvidence().status, 'wrong-role');
  assert.equal(g2.misses, 0);
});

test('p44：4辺の等しさを示せる（4辺の等式は入力させず「4つの辺がすべて等しい」を確認して条件を選ぶ）', () => {
  const p = P('p44');
  assert.equal(p.parallelogram.chain, 'AB＝BC＝CD＝DA');
  assert.equal(p.parallelogram.condition, 'rhombusDefinition');
  const g = new PH.Game(p);
  // ひし形の性質（4辺は等しい）は、ひし形だと証明する前には使えない
  sel(g, 'AB', 'BC');
  g.selectReason('rhombusSides');
  assert.equal(g.confirmEvidence().status, 'property-unproved');
  assert.equal(g.misses, 1);
  p.parallelogram.evidence.forEach((ev) => assert.equal(answerQ(g, ev).status, 'correct'));
  assert.equal(g.phase, 'qcondition');
  // 長方形の条件はミス、ほかの道すじ（平行四辺形で隣り合う2辺）はミスにしない、言えない条件はミス
  g.selectCondition('rectangleDefinition');
  assert.equal(g.confirmCondition().status, 'wrong-type');
  assert.equal(g.misses, 2);
  g.selectCondition('rhombusAdjacentEqual');
  const alt = g.confirmCondition();
  assert.equal(alt.status, 'alternative');
  assert.equal(alt.miss, false);
  g.selectCondition('rhombusDiagonalPerpendicular');
  assert.equal(g.confirmCondition().status, 'wrong-condition');
  assert.equal(g.misses, 3);
  g.selectCondition('rhombusDefinition');
  assert.equal(g.confirmCondition().ok, true);
  // 証明文：①、②、③より、AB＝BC＝CD＝DA、4つの辺がすべて等しいので、四角形ABCDはひし形である。
  const q = PH.buildProof(p).quad;
  assert.equal(q.summary, '①、②、③より、');
  assert.equal(q.chain, 'AB＝BC＝CD＝DA');
  assert.equal(q.condition, '4つの辺がすべて等しい');
  assert.equal(q.conclusion, '四角形ABCDはひし形である。');
});

test('p45：角の二等分線と二等辺三角形を利用できる（三角形の合同は使わない）', () => {
  const p = P('p45');
  assert.equal(PH.hasCongruence(p), false);
  assert.equal(p.triangles, undefined);
  assert.equal(p.congruence, undefined);
  assert.deepEqual(p.proofSteps.map((s) => s.rule), ['angleBisector', 'parallelAlternateAngles', 'angleTransitive', 'isoscelesConverseSides']);
  const g = new PH.Game(p);
  assert.equal(g.phase, 'qcollect');
  // AB＝BC は理由1つでは言えない：「詳しい理由を説明する」で4つのステップを解く
  const q1 = p.parallelogram.evidence.find((ev) => ev.fromStep);
  sel(g, q1.items[0], q1.items[1]);
  assert.equal(g.explain().status, 'explain');
  assert.deepEqual(g.availableSteps('pre').map((s) => s.id).sort(), ['s1', 's2']);
  const solved = [];
  while (g.phase === 'step') { solved.push(g.currentStep().id); assert.equal(solveStep(g).status, 'correct'); }
  assert.deepEqual(solved.slice(-2), ['s3', 's4']);
  assert.ok(g.qfound.includes(q1.id));
  p.parallelogram.evidence.filter((ev) => !ev.fromStep).forEach((ev) => assert.equal(answerQ(g, ev).status, 'correct'));
  g.selectCondition('rhombusDefinition');
  assert.equal(g.confirmCondition().ok, true);
  assert.equal(g.misses, 0);
  const proof = PH.buildProof(p);
  assert.deepEqual(proof.quad.stepLines.map((l) => l.equation), ['∠BAC＝∠CAD', '∠CAD＝∠ACB', '∠BAC＝∠ACB', 'AB＝BC']);
  assert.equal(proof.quad.summary, '①、②、⑥より、');
  // ステップの誤答（その定理では言えない理由）はミス
  const g2 = new PH.Game(p);
  sel(g2, q1.items[0], q1.items[1]);
  g2.explain();
  const wrong = g2.stepOptions().find((o) => o.id !== 'a');
  g2.chooseStepOption(wrong.id);
  assert.equal(g2.confirmStep().status, 'wrong');
  assert.equal(g2.misses, 1);
});

test('p46：4つの角がすべて直角であることを示せる（∠A＋∠B＝180° → ∠B＝90° は1ステップ）', () => {
  const p = P('p46');
  assert.deepEqual(p.proofSteps.map((s) => s.rule), ['parallelogramAdjacentSupplementary']);
  assert.equal(p.proofSteps[0].label, '∠DAB＝∠ABC＝90°');
  assert.equal(p.parallelogram.chain, '∠A＝∠B＝∠C＝∠D＝90°');
  assert.equal(p.parallelogram.condition, 'rectangleDefinition');
  // 仮定の ∠A＝90° は ∠DAB の直角（図の直角の印もこの角だけ）
  assert.deepEqual(RT.givenRightAngles(p), ['∠DAB']);
  assert.deepEqual(p.figure.rightMarks, ['DAB']);
  const g = solveHunter(p);
  assert.equal(g.phase, 'clear');
  // 「平行四辺形で1つの角が直角」（ほかの道すじ）はミスにしない。ひし形の条件はミス
  const g2 = new PH.Game(p);
  p.parallelogram.evidence.forEach((ev) => answerQ(g2, ev));
  g2.selectCondition('rectangleOneRightAngle');
  assert.equal(g2.confirmCondition().status, 'alternative');
  g2.selectCondition('rhombusAdjacentEqual');
  assert.equal(g2.confirmCondition().status, 'wrong-type');
  assert.equal(g2.misses, 1);
  const q = PH.buildProof(p).quad;
  assert.equal(q.summary, '①、②、③より、');
  assert.equal(q.condition, '4つの角がすべて等しい');
  assert.equal(q.conclusion, '四角形ABCDは長方形である。');
});

test('p47・p48：合同を証明してもクリアにならず、1つの問題の中で長方形まで証明する', () => {
  ['p47', 'p48'].forEach((id) => {
    const p = P(id);
    assert.equal(PH.hasLemma(p), true);
    assert.equal(p.congruence, 'SSS');
    const g = new PH.Game(p);
    const r = solveLemma(g);
    assert.equal(r.status, 'correct');
    assert.equal(r.quad, true);
    assert.notEqual(g.phase, 'clear');
    assert.equal(g.phase, 'qcollect');
    // 合同から導いた角の等しさ（fromFinal）を、四角形の角として根拠にする
    const q1 = p.parallelogram.evidence[0];
    assert.equal(q1.fromFinal, true);
    assert.equal(PG.factKey(p.figure, q1.items, 'eq'), PG.factKey(p.figure, p.finalStep.items, 'eq'), id);
    p.parallelogram.evidence.forEach((ev) => assert.equal(answerQ(g, ev).status, 'correct', id + ' ' + ev.id));
    g.selectCondition('rectangleDefinition');
    assert.equal(g.confirmCondition().ok, true);
    assert.equal(g.phase, 'clear');
    // 証明文：合同（①〜③）→ 対応する角 ④ → 平行四辺形の対角 ⑤⑥ → ④、⑤、⑥より 4つの角がすべて等しい → 長方形
    const proof = PH.buildProof(p);
    assert.equal(proof.conclusion, PH.congruenceText(p));
    assert.equal(proof.final.no, '④');
    assert.deepEqual(proof.quad.lines.map((l) => l.no), ['⑤', '⑥']);
    assert.equal(proof.quad.summary, '④、⑤、⑥より、');
    assert.equal(proof.quad.chain, '∠A＝∠B＝∠C＝∠D');
    assert.equal(proof.quad.conclusion, '四角形ABCDは長方形である。');
  });
  // p47：△ABM≡△DCM（A↔D、B↔C、M↔M）。∠BAM と ∠DAB は同じ角（Mは辺AD上）
  const p47 = P('p47');
  assert.equal(PH.congruenceText(p47), '△ABM≡△DCM');
  assert.equal(k(p47, '∠BAM'), k(p47, '∠DAB'));
  assert.equal(k(p47, '∠CDM'), k(p47, '∠CDA'));
  assert.equal(p47.evidence.find((ev) => ev.reason === 'midpoint').label, 'AM＝DM');
  assert.ok(PH.acceptedReasons(p47.evidence[1]).includes('given'));
  // p48：△ABC≡△DCB（A↔D、B↔C、C↔B）。頂点の対応順がちがう組は不正解
  const p48 = P('p48');
  assert.equal(PH.congruenceText(p48), '△ABC≡△DCB');
  assert.equal(val.checkTriangles(p48, ['A', 'B', 'C'], ['D', 'C', 'B']).status, 'ok');
  assert.notEqual(val.checkTriangles(p48, ['A', 'B', 'C'], ['D', 'B', 'C']).status, 'ok');
  assert.equal(val.correspondenceOrder(p48, ['∠ABC', '∠DCB']), 'ok');
  // 「平行四辺形で、対角線の長さが等しい」（ほかの道すじ）はミスにしない
  const g = new PH.Game(p48);
  solveLemma(g);
  p48.parallelogram.evidence.forEach((ev) => answerQ(g, ev));
  g.selectCondition('rectangleDiagonalsEqual');
  assert.equal(g.confirmCondition().status, 'alternative');
  assert.equal(g.misses, 0);
});

test('ヒント：p43〜p48 に3段階ヒントがあり、表示しただけでは解答を自動入力しない', () => {
  NEW_IDS.forEach((id) => {
    const p = P(id);
    Object.keys(p.hints).forEach((h) => assert.equal(p.hints[h].length, 3, id + ' ' + h));
  });
  assert.equal(P('p43').hints.e1[0].text, '直角三角形に注目しよう！ AH⊥BC、AK⊥CD だね。');
  assert.equal(P('p44').hints.q1[0].text, '平行四辺形の対辺にはどんな性質があるかな？');
  assert.equal(P('p45').hints.q1[0].text, '角の二等分線に注目しよう！');
  assert.equal(P('p46').hints.q1[0].text, '平行四辺形の隣り合う角の和は？');
  assert.equal(P('p47').hints.triangleSelection[0].text, '△ABMと△DCMを比べよう！');
  assert.equal(P('p48').hints.triangleSelection[0].text, '対角線が等しいことを使って、合同な三角形を探そう！');
  NEW_IDS.forEach((id) => {
    const g = new PH.Game(P(id));
    for (let i = 0; i < 3; i++) assert.ok(g.useHint(), id);
    assert.deepEqual(g.found, [], id);
    assert.deepEqual(g.qfound, [], id);
    assert.deepEqual(g.selection, [], id);
    assert.equal(g.hintsUsed, 3);
    const z = new PH.Puzzle(P(id), 'build');
    const before = JSON.stringify(z.placed);
    z.useHint();
    assert.equal(JSON.stringify(z.placed), before, id);
  });
});

// =====================================================================================
// 21-3 段位認定
// =====================================================================================

const ALL = PH.rankQuestions.all();
const QC = ALL.filter((q) => q.type === 'quadrilateralClassification');
const BASIC = TR.pool('basic');
const COMP = TR.pool('comprehensive');

test('四角形の分類の問題を、分類ルールから生成できる', () => {
  assert.equal(QC.length, 17);
  assert.equal(PH.rankQuestions.CATEGORY_LABEL.quad, '四角形の分類');
  QC.forEach((q) => {
    assert.equal(q.category, 'quad');
    assert.equal(q.blanks, 1);
    assert.equal(q.input, null);                                       // 四角形の名前は選択式（入力しない）
    assert.equal(q.ask, 'この条件から、さらに何という特別な四角形であるといえる？');
    assert.ok(q.requiredTopics.includes('quadrilateralClassification'), q.id);
    // 正解は、前提と条件から分類ルールで求めた「必ずいえる最も特別な種類」
    const base = S.isType(q.premises[0]) ? q.premises[0] : null;
    assert.ok(S.isType(q.answer), q.id);
    assert.equal(q.answerText, S.typeName(q.answer));
    if (base) assert.ok(!S.implied(base).includes(q.answer), q.id + ' 前提より特別な種類（さらに言える）');
  });
  // 出題例（教材の仕様）
  const find = (text) => QC.find((q) => q.lines[0] === text);
  [
    ['平行四辺形ABCDで、AB＝AD のとき', 'ひし形'],
    ['平行四辺形ABCDで、∠A＝90° のとき', '長方形'],
    ['平行四辺形ABCDで、AC＝BD のとき', '長方形'],
    ['平行四辺形ABCDで、AC⊥BD のとき', 'ひし形'],
    ['長方形ABCDで、AB＝BC のとき', '正方形'],
    ['ひし形ABCDで、∠A＝90° のとき', '正方形'],
  ].forEach(([line, ans]) => {
    const q = find(line);
    assert.ok(q, line);
    assert.equal(q.answerText, ans, line);
  });
  // 問題データ（p44〜p48）を生成元にした問題がある
  ['p44', 'p45', 'p46', 'p47', 'p48'].forEach((id) => assert.ok(QC.some((q) => q.sourceId === id), id));
  // 新しく言える種類がない組（長方形で1つの角が直角など）は出題しない
  assert.ok(!QC.some((q) => q.premises[0] === 'rectangle' && q.premises.includes('oneRightAngle')));
});

test('正解が一意に決まり、図形の包含関係によって誤判定しない', () => {
  QC.forEach((q) => {
    const b = q.choice.blanks[0];
    assert.equal(b.choices.length, 3, q.id);
    assert.equal(new Set(b.choices.map((c) => c.text)).size, 3, q.id);
    const base = S.isType(q.premises[0]) ? q.premises[0] : null;
    const atoms = q.premises.filter((x) => !S.isType(x));
    const derived = atoms.map((a) => ({ bisector: 'adjacentSidesEqual', midpointEqual: 'oneRightAngle' }[a] || a));
    const types = S.guaranteedTypes(base, derived);
    const best = S.mostSpecific(types);
    const correct = b.choices.filter((c) => c.text === S.typeName(best));
    assert.equal(correct.length, 1, q.id);
    assert.equal(correct[0].id, b.answer, q.id);
    // 誤答は「必ずそうなるとはいえない種類」か「より一般的な種類」（正しい分類だが、最も特別ではない）
    b.choices.filter((c) => c.id !== b.answer).forEach((c) => {
      const t = S.TYPE_ORDER.find((x) => S.typeName(x) === c.text);
      assert.ok(!types.includes(t) || (S.isA(best, t) && t !== best), q.id + ' ' + c.text);
    });
  });
  // 正方形が答えの問題で、ひし形・長方形は「正方形でもある」より一般的な分類（誤りではないが最も特別ではない）
  const sq = QC.find((q) => q.lines[0] === 'ひし形ABCDで、∠A＝90° のとき');
  assert.ok(/ひし形でもあるけれど、正方形はそれより特別な分類です/.test(sq.explain));
});

test('基本コースには出題されず、総合コースには出題される', () => {
  assert.equal(BASIC.length, 148);                                   // 基本コースは変わらない
  assert.ok(!BASIC.some((q) => q.category === 'quad'));
  assert.ok(!BASIC.some((q) => NEW_IDS.includes(q.sourceId)));
  assert.ok(!BASIC.some((q) => q.requiredTopics.some((t) => ['rhombus', 'rectangle', 'square', 'quadrilateralClassification'].includes(t))));
  QC.forEach((q) => assert.ok(COMP.includes(q), q.id));
  assert.ok(COMP.some((q) => q.sourceId === 'p43'));
  assert.ok(COMP.some((q) => q.sourceId === 'p47'));
  assert.ok(COMP.some((q) => q.sourceId === 'p48'));
  ['rhombus', 'rectangle', 'square', 'quadrilateralClassification'].forEach((t) => {
    assert.ok(TR.get('comprehensive').allowedTopics.includes(t), t);
    assert.ok(!TR.get('basic').allowedTopics.includes(t), t);
    assert.ok(TR.TOPIC_LABEL[t], t);
  });
  assert.equal(TR.get('comprehensive').categoryWeights.quad, 1);
  assert.equal(TR.get('basic').categoryWeights.quad, undefined);
  // 新しい問題の topics
  assert.ok(TR.problemTopics(P('p43')).includes('rhombus'));
  assert.ok(TR.problemTopics(P('p46')).includes('rectangle'));
  // 基本コースでは、何問解いても四角形の分類・新しい問題は出ない
  for (let seed = 1; seed <= 5; seed++) {
    const g = new PH.RankGame({ seed, track: 'basic' });
    g.start(0);
    for (let i = 0; i < 30 && g.state === 'play'; i++) {
      const c = g.current;
      assert.notEqual(c.q.category, 'quad');
      assert.ok(!NEW_IDS.includes(c.q.sourceId));
      g.pass(i);
    }
  }
});

test('総合コースで四角形の分類が出題され、ほかのカテゴリとのバランスを崩さない', () => {
  const cnt = {};
  let total = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const g = new PH.RankGame({ seed, track: 'comprehensive' });
    g.start(0);
    for (let i = 0; i < 30; i++) {
      const inst = g.current;
      cnt[inst.q.category] = (cnt[inst.q.category] || 0) + 1;
      total++;
      const ok = inst.mode === 'input' ? g.submit(i, inst.q.input.answerText.replace(/＝/g, '=')) : g.choose(0, inst.blanks[0].answer, i);
      assert.equal(ok.status, 'correct', inst.q.id);
    }
  }
  assert.ok(cnt.quad > 0, JSON.stringify(cnt));
  // 四角形の分類ばかりにならない（9カテゴリなので1割前後。選択式だけなので少なめでもよい）
  assert.ok(cnt.quad / total <= 0.15, JSON.stringify(cnt));
  assert.ok(cnt.quad / total >= 0.03, JSON.stringify(cnt));
});

test('120秒・時間ペナルティ・21段階の称号は変わらない。出題範囲のバージョンは3', () => {
  assert.equal(CFG.timeLimitMs, 120000);
  assert.equal(CFG.penaltyStepMs, 4000);
  assert.equal(PH.rank.penaltyFor(1), 4000);
  assert.equal(PH.rank.totalPenalty(3), 24000);
  assert.equal(CFG.grades.length, 21);
  assert.equal(PH.rank.gradeFor(0).name, '10級');
  assert.equal(PH.rank.gradeFor(10).name, '初段');
  assert.equal(PH.rank.gradeFor(20).name, '皆伝');
  assert.equal(CFG.criteriaVersion, 2);
  assert.equal(CFG.questionPoolVersion, 3);
  const g = new PH.RankGame({ seed: 7, track: 'comprehensive' });
  g.start(0);
  g.tick(120001);
  assert.ok(g.result);
  assert.equal(g.result.criteriaVersion, 2);
  assert.equal(g.result.questionPoolVersion, 3);
});

// =====================================================================================
// 21-4 回帰
// =====================================================================================

test('回帰：p01〜p42 のデータ・判定は従来どおり（四角形の問題は平行四辺形のまま）', () => {
  assert.equal(OLD.length, 42);
  assert.deepEqual(val.verifyAll(OLD, []), []);
  OLD.filter((p) => PH.isQuadProblem(p)).forEach((p) => {
    assert.equal(PH.quadType(p), 'parallelogram', p.id);
    assert.equal(PH.quadTypeName(p), '平行四辺形');
    assert.equal(PG.isSpecial(p), false);
  });
  // 既存の四角形の成立条件
  const p31 = P('p31');
  assert.equal(PG.checkCondition(p31, ['q1', 'q2'], 'PP_EQUAL_SIDES').status, 'correct');
  assert.equal(PG.checkCondition(p31, ['q1', 'q2'], 'PP_PARALLEL_PAIRS').status, 'wrong-condition');
  assert.equal(PH.buildProof(p31).quad.condition, '2組の対辺がそれぞれ等しい');
  assert.equal(PH.buildProof(p31).quad.chain, null);
  // ハンターの★評価
  assert.equal(PH.calcStars(0, 0), 3);
  assert.equal(PH.calcStars(2, 1), 2);
  assert.equal(PH.calcStars(3, 0), 1);
  // 平行四辺形の問題の成立条件の選択肢は5つ
  const g = new PH.Game(P('p31'));
  P('p31').parallelogram.evidence.forEach((ev) => answerQ(g, ev));
  assert.deepEqual(g.conditionOptions(), PH.PARALLELOGRAM_CONDITION_ORDER);
});

test('回帰：数学キーパッドの既存機能（辺・角・平行・三角形）', () => {
  const K = PH.mathKeypad;
  assert.deepEqual(K.parse('AB=CD'), { kind: 'seg', left: 'AB', right: 'CD', value: 'AB=CD' });
  assert.equal(K.parse('∠ABC=∠DEF').kind, 'ang');
  assert.equal(K.parse('AD∥BC').kind, 'par');
  assert.equal(K.parse('AD∥DA'), null);
  // チャレンジ：p47 の根拠の行は角（∠A＝∠C）から入力する
  const z = new PH.Puzzle(P('p47'), 'challenge');
  const row = z.slots.find((s) => s.kind === 'qeq');
  assert.equal(row.inputKinds[0], 'ang');
});

test('回帰：旧段位記録・問題の記録を引き継ぐ', () => {
  const old = JSON.stringify({
    version: 6, problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 }, p42: { cleared: true, bestStars: 2, minMisses: 1 } },
    rankCertification: { format: 2, legacy: null, tracks: {
      basic: { criteriaVersion: 2, best: { rank: 12, rankName: '三段', effectiveScore: 12, correct: 12, maxCombo: 5, at: 'x' }, bestCorrect: 12, playCount: 3 },
      comprehensive: { criteriaVersion: 2, questionPoolVersion: 2, best: { rank: 15, rankName: '六段', effectiveScore: 15, correct: 15, maxCombo: 7, at: 'y' }, bestCorrect: 15, playCount: 4 },
    } },
  });
  withFakeStorage(old, () => {
    assert.equal(PH.storage.getProblem('p01').bestStars, 3);
    assert.equal(PH.storage.getProblem('p42').bestStars, 2);
    assert.equal(PH.storage.getProblem('p43').cleared, false);
    assert.equal(PH.storage.getRank('basic').best.rankName, '三段');
    assert.equal(PH.storage.getRank('comprehensive').best.rankName, '六段');
    // 出題範囲のバージョンが変わっても、認定基準が同じなので最高段位は比べ続ける
    const out = PH.storage.recordRank({ correct: 10, misses: 2, passes: 0, answered: 12, effectiveScore: 10, rank: 10, rankName: '初段',
      maxCombo: 4, criteriaVersion: 2, questionPoolVersion: 3, wrongs: [] }, 'comprehensive');
    assert.equal(out.newRecord, false);
    const after = PH.storage.getRank('comprehensive');
    assert.equal(after.best.rankName, '六段');
    assert.equal(after.questionPoolVersion, 3);
    assert.equal(after.playCount, 5);
  });
});
