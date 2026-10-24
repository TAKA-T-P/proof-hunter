// 証明ハンター Ver.1.0 のテスト（STAGE 11「特別な平行四辺形」・ひし形／長方形／正方形の分類・段位認定の「四角形の分類」）
//   p43 ひし形と直角三角形の合同（RHA）／ p44 ひし形になることの証明／ p45 長方形になることの証明
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
const NEW_IDS = ['p43', 'p44', 'p45'];
const SPECIAL_IDS = ['p44', 'p45'];
const DIAG_IDS = ['p46', 'p47'];                              // 長方形・ひし形の対角線の性質を、指定した三角形の合同で証明する        // 結論がひし形・長方形
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
  const fig = P('p45').figure;
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
  assert.deepEqual(PH.quadConditionOrder(P('p44')), ['rhombusDefinition', 'rectangleDefinition', 'squareDefinition']);
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

test('50問・10ステージ。STAGE 10「特別な平行四辺形」は p43〜p47', () => {
  assert.equal(PH.problems.length, 50);
  assert.equal(PH.STAGES.length, 10);
  const st = PH.getStage(10);
  assert.equal(st.title, '特別な平行四辺形');
  assert.equal(st.theme, 'ひし形・長方形の性質を使い、証明を完成させよう！');
  assert.deepEqual(PH.stageProblems(10).map((p) => p.id), NEW_IDS.concat(DIAG_IDS));
  assert.deepEqual(NEW_IDS.concat(DIAG_IDS).map((id) => P(id).difficulty), [2, 1, 1, 2, 3]);
  assert.deepEqual(NEW_IDS.concat(DIAG_IDS).map((id) => P(id).title), ['ひし形と直角三角形の合同', '隣り合う2辺が等しい平行四辺形', '1つの直角から長方形へ', '長方形の対角線の長さ', 'ひし形の対角線は垂直']);
  assert.deepEqual(val.verifyAll(PH.problems, PH.STAGES), []);
  // 証明方法が複数あり複雑な問題（はじめの p45 角の二等分線・p47 中点と合同・p48 対角線と合同）は削除した
});

test('p43〜p45 の仮定・結論・推論が正しい', () => {
  assert.equal(PH.conclusionType(P('p43')), 'triangleCongruence');
  assert.equal(P('p43').conclusion, '△ABH≡△ADK');
  assert.equal(PH.quadType(P('p44')), 'rhombus');
  assert.equal(PH.quadType(P('p45')), 'rectangle');
  SPECIAL_IDS.forEach((id) => {
    const p = P(id);
    assert.equal(p.conclusion, '四角形ABCDは' + PH.quadTypeName(p));
    assert.ok(p.given.includes('四角形ABCDは平行四辺形'), id);
    assert.deepEqual(S.knownTypes(p, ABCD), ['parallelogram'], id);     // 結論の種類は仮定にない
    assert.deepEqual(PG.verify(p), [], id);
    const r = PG.deriveCondition(p, p.parallelogram.evidence);
    assert.ok(r.all.some((a) => a.condition === p.parallelogram.condition), id);
    assert.equal(PG.holdsSpecial(p.figure, ABCD, PH.quadType(p)), true, id);
    // 根拠を1つ減らすと、4つの辺（角）がすべて等しいとはいえない
    p.parallelogram.evidence.forEach((_, i) => {
      const evs = p.parallelogram.evidence.filter((__, j) => j !== i);
      const r2 = PG.deriveCondition(p, evs);
      assert.ok(!r2 || !r2.all.some((a) => a.condition === p.parallelogram.condition), id + ' -' + i);
    });
  });
  // 多段階証明のデータ（p45）：前提を変えると誤りを見つける
  assert.deepEqual(PH.proofEngine.verify(P('p45')), []);
  assert.ok(PH.proofEngine.verify(variant(P('p45'), { given: ['四角形ABCDは平行四辺形'] })).length > 0);
  // ひし形の性質は、仮定のひし形にだけ（p43）
  assert.deepEqual(PG.verifyKnown(P('p43')), []);
  assert.ok(PG.verifyKnown(variant(P('p43'), { given: ['四角形ABCDは平行四辺形', 'AH⊥BC', 'AK⊥CD'] })).length > 0);
});

test('ハンターモードで p43〜p45 を解ける（ミス・ヒントなしで★3）', () => {
  NEW_IDS.forEach((id) => {
    const g = solveHunter(P(id));
    assert.equal(g.phase, 'clear', id);
    assert.equal(g.misses, 0, id);
    assert.equal(g.stars, 3, id);
    if (id !== 'p43') assert.deepEqual(g.provedType, { kind: 'quadrilateralType', vertices: ABCD, type: PH.quadType(P(id)) }, id);
  });
});

test('証明パズル3レベル（おてがる・スタンダード・チャレンジ）で p43〜p45 を解ける', () => {
  NEW_IDS.forEach((id) => TYPES.forEach((t) => {
    const p = P(id);
    const z = new PH.Puzzle(p, t);
    assert.equal(z.slots.some((s) => s.id === 'pcond'), PH.isQuadProblem(p), id + ' ' + t);
    // 成立条件はカードで選ぶ（キーパッドで入力しない）。3択
    if (PH.isQuadProblem(p)) {
      assert.equal(z.slots.find((s) => s.id === 'pcond').input, undefined);
      assert.deepEqual(z.cards.pcond.map((c) => c.text), ['4つの辺がすべて等しい', '4つの角がすべて等しい', '4つの辺と角がすべて等しい']);
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
});

test('p44・p45：成立条件は「4つの辺／4つの角／4つの辺と角がすべて等しい」の3択（ハンター・パズル共通）', () => {
  const CH = ['rhombusDefinition', 'rectangleDefinition', 'squareDefinition'];
  SPECIAL_IDS.forEach((id) => {
    const p = P(id);
    assert.deepEqual(PH.quadConditionOrder(p), CH, id);
    assert.deepEqual(CH.map((c) => PH.quadCondition(c).label), ['4つの辺がすべて等しい', '4つの角がすべて等しい', '4つの辺と角がすべて等しい']);
    const g = new PH.Game(p);
    p.parallelogram.evidence.forEach((ev) => answerQ(g, ev));
    assert.deepEqual(g.conditionOptions(), CH, id);
    const right = p.parallelogram.condition;
    const other = right === 'rhombusDefinition' ? 'rectangleDefinition' : 'rhombusDefinition';
    // ほかの種類の条件・正方形の条件はミス
    g.selectCondition(other);
    assert.equal(g.confirmCondition().status, 'wrong-type', id);
    g.selectCondition('squareDefinition');
    const sq = g.confirmCondition();
    assert.equal(sq.status, 'too-specific', id);
    assert.equal(sq.type, 'square');
    assert.equal(g.misses, 2, id);
    g.selectCondition(right);
    assert.equal(g.confirmCondition().ok, true, id);
    // パズルでも正方形の条件はミス
    const z = new PH.Puzzle(p, 'build');
    const sol = z.solution();
    sol.pcond = z.cards.pcond.find((c) => c.cond === 'squareDefinition').id;
    fill(z, sol);
    const r = z.check();
    assert.equal(r.result.slotStatus.pcond, 'ng');
    assert.ok(/正方形になるための条件/.test(r.result.messages[0].text));
  });
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
  g.selectCondition('rhombusDefinition');
  assert.equal(g.confirmCondition().ok, true);
  const q = PH.buildProof(p).quad;
  assert.equal(q.summary, '①、②、③より、');
  assert.equal(q.chain, 'AB＝BC＝CD＝DA');
  assert.equal(q.condition, '4つの辺がすべて等しい');
  assert.equal(q.conclusion, '四角形ABCDはひし形である。');
});

test('p45：4つの角がすべて直角であることを示せる（∠A＋∠B＝180° → ∠B＝90° は1ステップ）', () => {
  const p = P('p45');
  assert.deepEqual(p.proofSteps.map((s) => s.rule), ['parallelogramAdjacentSupplementary']);
  assert.equal(p.proofSteps[0].label, '∠DAB＝∠ABC＝90°');
  assert.equal(p.parallelogram.chain, '∠A＝∠B＝∠C＝∠D＝90°');
  assert.equal(p.parallelogram.condition, 'rectangleDefinition');
  assert.deepEqual(RT.givenRightAngles(p), ['∠DAB']);
  assert.deepEqual(p.figure.rightMarks, ['DAB']);
  const g = solveHunter(p);
  assert.equal(g.phase, 'clear');
  const q = PH.buildProof(p).quad;
  assert.equal(q.summary, '①、②、③より、');
  assert.equal(q.condition, '4つの角がすべて等しい');
  assert.equal(q.conclusion, '四角形ABCDは長方形である。');
});

test('ヒント：p43〜p45 に3段階ヒントがあり、表示しただけでは解答を自動入力しない', () => {
  NEW_IDS.forEach((id) => {
    const p = P(id);
    Object.keys(p.hints).forEach((h) => assert.equal(p.hints[h].length, 3, id + ' ' + h));
  });
  assert.equal(P('p43').hints.e1[0].text, '直角三角形に注目しよう！ AH⊥BC、AK⊥CD だね。');
  assert.equal(P('p44').hints.q1[0].text, '平行四辺形の対辺にはどんな性質があるかな？');
  assert.equal(P('p45').hints.q1[0].text, '平行四辺形の隣り合う角の和は？');
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
  assert.equal(QC.length, 15);
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
  // 問題データ（p44・p45）を生成元にした問題がある
  ['p44', 'p45'].forEach((id) => assert.ok(QC.some((q) => q.sourceId === id), id));
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
    const derived = atoms;
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
  assert.equal(BASIC.length, 162);                                   // 基本コースは、STAGE 5 の p48（角の二等分線の作図）のぶんだけ増える（148問 → 162問）
  assert.ok(!BASIC.some((q) => q.category === 'quad'));
  assert.ok(!BASIC.some((q) => NEW_IDS.includes(q.sourceId)));
  assert.ok(!BASIC.some((q) => q.requiredTopics.some((t) => ['rhombus', 'rectangle', 'square', 'quadrilateralClassification'].includes(t))));
  QC.forEach((q) => assert.ok(COMP.includes(q), q.id));
  assert.ok(COMP.some((q) => q.sourceId === 'p43'));
  ['rhombus', 'rectangle', 'square', 'quadrilateralClassification'].forEach((t) => {
    assert.ok(TR.get('comprehensive').allowedTopics.includes(t), t);
    assert.ok(!TR.get('basic').allowedTopics.includes(t), t);
    assert.ok(TR.TOPIC_LABEL[t], t);
  });
  assert.equal(TR.get('comprehensive').categoryWeights.quad, 1);
  assert.equal(TR.get('basic').categoryWeights.quad, undefined);
  // 新しい問題の topics
  assert.ok(TR.problemTopics(P('p43')).includes('rhombus'));
  assert.ok(TR.problemTopics(P('p45')).includes('rectangle'));
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
  // チャレンジ：p45 の根拠の行は角（∠A＝∠C）から入力する
  const z = new PH.Puzzle(P('p45'), 'challenge');
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

test('角の式のステップ（p23・p24・p30）は、理由ではなく □ に入る式を選ぶ（ハンター・パズル）', () => {
  [['p23', 's1', '∠ACD＋60°', ['∠ACD＋90°', '∠ACD－60°']], ['p24', 's2', '60°－∠DAC', ['90°－∠DAC', '60°＋∠DAC']], ['p30', 's1', '90°－∠DAB', ['60°－∠DAB', '90°＋∠DAB']]]
    .forEach(([id, sid, ans, wrong]) => {
      const p = P(id);
      const g = new PH.Game(p);
      const st = p.proofSteps.find((s) => s.id === sid);
      const opts = g.stepOptions(st);
      assert.deepEqual(opts.map((o) => o.text).sort(), [ans].concat(wrong).sort(), id);
      assert.equal(opts.find((o) => o.id === 'a').text, ans);
      assert.ok(!opts.some((o) => /角の和|角の差|内角の和/.test(o.text)), id);
      // 証明パズルも、□に入る式のカード（3レベル共通）
      ['fill', 'build', 'challenge'].forEach((t) => {
        const z = new PH.Puzzle(p, t);
        assert.deepEqual(z.cards['srule:' + sid].map((c) => c.text).sort(), [ans].concat(wrong).sort(), id + ' ' + t);
        assert.equal(z.slot('st:' + sid).expr, true);
      });
    });
  // 誤った式はミス、正しい式で次へ
  const p23 = P('p23');
  const g = new PH.Game(p23);
  if (g.phase === 'triangle') { g.tapTriangle(p23.triangles[0]); g.tapTriangle(p23.triangles[1]); g.confirmTriangles(); }
  const ev = p23.evidence.find((e) => e.fromStep);
  sel(g, ev.items[0], ev.items[1]);
  assert.equal(g.explain().status, 'explain');
  const wrong = g.stepOptions().find((o) => o.id !== 'a');
  g.chooseStepOption(wrong.id);
  assert.equal(g.confirmStep().status, 'wrong');
  assert.equal(g.misses, 1);
  g.chooseStepOption('a');
  assert.equal(g.confirmStep().status, 'correct');
});

test('p46・p47：長方形・ひし形の対角線の性質を、指定された三角形の合同で証明できる（ハンター・パズル）', () => {
  // 使う三角形を問題文で指定している
  assert.ok(/△ABCと△DCBの合同を使って/.test(P('p46').statement));
  assert.ok(/△ABOと△ADOの合同を使って/.test(P('p47').statement));
  assert.equal(PH.congruenceText(P('p46')), '△ABC≡△DCB');
  assert.equal(PH.congruenceText(P('p47')), '△ABO≡△ADO');
  assert.equal(val.deriveCondition(P('p46'), P('p46').evidence), 'SAS');
  assert.equal(val.deriveCondition(P('p47'), P('p47').evidence), 'SSS');
  // 長方形・ひし形の性質は、仮定の長方形・ひし形にだけ使える
  assert.deepEqual(PG.verifyKnown(P('p46')), []);
  assert.ok(PG.verifyKnown(variant(P('p46'), { given: ['四角形ABCDは平行四辺形'] })).length > 0);
  // p47 の後半のステップ：∠AOB＝∠AOD と ∠AOB＋∠AOD＝180° から AC⊥BD
  assert.deepEqual(PH.proofEngine.verify(P('p47')), []);
  const bad = variant(P('p47'), { proofSteps: [Object.assign({}, P('p47').proofSteps[0], { premise: ['∠AOB', '∠BAO'] })] });
  assert.ok(PH.proofEngine.verify(bad).length > 0);
  DIAG_IDS.forEach((id) => {
    const p = P(id);
    const g = new PH.Game(p);
    const r = solveLemma(g);
    assert.equal(r.status, 'correct', id);
    while (g.phase === 'post') {
      assert.ok(!/一直線/.test(g.currentStep().lead), id + ' 書き出しに理由を書かない');
      assert.equal(solveStep(g).status, 'correct');
    }
    assert.equal(g.phase, 'clear', id);
    assert.equal(g.stars, 3, id);
    TYPES.forEach((t) => {
      const z = new PH.Puzzle(p, t);
      fill(z, z.solution());
      assert.equal(z.check().status, 'clear', id + ' ' + t);
    });
  });
  const proof = PH.buildProof(P('p47'));
  assert.deepEqual(proof.post.map((l) => l.conclusion), ['AC⊥BD']);
  assert.equal(PH.buildProof(P('p46')).final.conclusion, 'AC＝DB');
});

test('p45：隣り合う角のステップの書き出しに、答えの理由（隣り合う角の和は180°）を書かない（ハンター・パズル共通）', () => {
  const st = P('p45').proofSteps[0];
  assert.ok(!/180°/.test(st.lead), st.lead);
  assert.ok(!/隣り合う角/.test(st.lead), st.lead);
  assert.equal(PH.stepOptions(P('p45'), st).find((o) => o.id === 'a').text, '平行四辺形の隣り合う角の和は180°だから');
});

test('p41：線分の差のステップは、理由ではなく「EB＝AB－AE、DF＝DC－FC」を選ぶ（ハンター・パズル）', () => {
  const p = P('p41');
  const st = p.proofSteps.find((s) => s.rule === 'segmentSubtraction');
  assert.ok(!/AB－AE|残りは等しい/.test(st.lead), st.lead);
  const opts = PH.stepOptions(p, st);
  assert.equal(opts.find((o) => o.id === 'a').text, 'EB＝AB－AE、DF＝DC－FC');
  assert.equal(opts.length, 3);
  assert.ok(!opts.some((o) => /残りは等しい/.test(o.text)));
  assert.deepEqual(PH.proofEngine.verify(p), []);
  assert.ok(PH.proofEngine.verify(variant(p, { proofSteps: p.proofSteps.map((s) => (s === st ? Object.assign({}, s, { choices: ['EB＝AB＋AE、DF＝DC＋FC', 'a', 'b'] }) : s)) })).length > 0);
  ['fill', 'build', 'challenge'].forEach((t) => {
    const z = new PH.Puzzle(p, t);
    assert.equal(z.slot('st:' + st.id).expr, true);
    assert.ok(z.cards['srule:' + st.id].some((c) => c.correct && c.text === 'EB＝AB－AE、DF＝DC－FC'));
  });
});

test('p48（STAGE 5 の6問目）：角の二等分線の作図を、作図から OQ＝OR・PQ＝PR と共通な辺で証明する', () => {
  const p = P('p48');
  assert.equal(p.stage, 5);
  assert.deepEqual(PH.stageProblems(5).map((x) => x.id), ['p16', 'p17', 'p18', 'p19', 'p20', 'p48', 'p35']);
  assert.equal(PH.congruenceText(p), '△POQ≡△POR');
  assert.equal(val.deriveCondition(p, p.evidence), 'SSS');
  assert.equal(p.conclusion, '∠POQ＝∠POR');
  // 「作図より」は「仮定より」でもよい（仮定に作図のしかたが書いてある）
  assert.deepEqual(PH.acceptedReasons(p.evidence[0]), ['construction', 'given']);
  const g = new PH.Game(p);
  const r = solveLemma(g);
  assert.equal(r.status, 'correct');
  assert.equal(g.phase, 'clear');
  assert.equal(g.stars, 3);
  TYPES.forEach((t) => { const z = new PH.Puzzle(p, t); fill(z, z.solution()); assert.equal(z.check().status, 'clear', t); });
  // 段位認定：合同の式が同じ p29（△POQ≡△POR）のミニ問題を消さない。基本コースにも入る
  assert.ok(ALL.some((q) => q.sourceId === 'p29' && q.type === 'part'));
  assert.ok(BASIC.some((q) => q.sourceId === 'p48'));
});

test('p49（STAGE 7 の3問目）：共通な角を鋭角に使う、直角三角形の斜辺と1つの鋭角', () => {
  const p = P('p49');
  assert.equal(p.stage, 7);
  assert.deepEqual(PH.stageProblems(7).map((x) => x.id), ['p25', 'p26', 'p49', 'p27', 'p28', 'p29', 'p30']);
  assert.equal(p.congruence, 'RHA');
  assert.equal(val.deriveCondition(p, p.evidence), 'RHA');
  assert.equal(geo.segKey(RT.hypotenuse(p, 0)), geo.segKey('OA'));
  assert.equal(geo.segKey(RT.hypotenuse(p, 1)), geo.segKey('OB'));
  assert.equal(k(p, '∠AOC'), k(p, '∠BOD'));          // 共通な角
  // D を通る長い辺 OA があっても、∠BDO の操作領域がつぶれない
  const el = geo.getElements(p.figure).byKey[k(p, '∠BDO')];
  assert.ok(geo.angleHitRadius(p.figure, el, true) > 20);
  const g = solveHunter(p);
  assert.equal(g.phase, 'clear');
  assert.equal(g.stars, 3);
  TYPES.forEach((t) => { const z = new PH.Puzzle(p, t); fill(z, z.solution()); assert.equal(z.check().status, 'clear', t); });
});

test('p50（STAGE 6 の3問目）：合同を使わず、2つの角が等しいので二等辺三角形（ハンター・パズル）', () => {
  const p = P('p50');
  assert.equal(p.stage, 6);
  assert.deepEqual(PH.stageProblems(6).map((x) => x.id), ['p21', 'p22', 'p50', 'p23', 'p24']);
  assert.equal(PH.isGoalOnly(p), true);
  assert.equal(PH.hasCongruence(p), false);
  assert.equal(p.triangles, undefined);
  assert.ok(/どの角とどの角が等しい/.test(p.goalPrompt));
  assert.deepEqual(PH.proofEngine.verify(p), []);
  // 折り返しのデータを壊すと検出する
  assert.ok(PH.proofEngine.verify(variant(p, { fold: { line: 'AC', from: 'B', to: 'F' } })).length > 0);
  const g = new PH.Game(p);
  assert.equal(g.phase, 'collect');
  assert.equal(g.mode, 'angle');
  assert.equal(g.total(), 1);
  sel(g, '∠FAC', '∠ACF');
  assert.equal(g.explain().status, 'explain');
  let last;
  while (g.phase === 'step') last = solveStep(g);
  assert.equal(last.post, true);
  assert.equal(g.phase, 'post');
  assert.equal(g.currentStep().rule, 'isoscelesConverse');
  assert.equal(solveStep(g).status, 'correct');
  assert.equal(g.phase, 'clear');
  assert.equal(g.stars, 3);
  const proof = PH.buildProof(p);
  assert.equal(proof.goalOnly, true);
  assert.deepEqual(proof.stepLines.map((l) => l.equation), ['∠ACB＝∠FAC', '∠ACB＝∠ACF', '∠FAC＝∠ACF']);
  assert.deepEqual(proof.post.map((l) => l.conclusion), ['△AFCは二等辺三角形']);
  TYPES.forEach((t) => {
    const z = new PH.Puzzle(p, t);
    assert.ok(!z.slots.some((s) => s.id === 'cond'), t);
    fill(z, z.solution());
    assert.equal(z.check().status, 'clear', t);
  });
});

test('問題番号は、ステージの小さい順に 01・02・03… と振ってある（問題ID・記録はそのまま）', () => {
  assert.deepEqual(PH.problems.map((p) => p.number), PH.problems.map((_, i) => String(i + 1).padStart(2, '0')));
  const stages = PH.problems.map((p) => p.stage);
  assert.deepEqual(stages, stages.slice().sort((a, b) => a - b));
  assert.equal(P('p07').number, '04');     // 旧 STAGE 4 の問題は STAGE 1 の4問目
  assert.equal(P('p47').number, '50');
});
