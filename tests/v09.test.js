// 証明ハンター Ver.0.9 のテスト（平行四辺形の性質・5つの成立条件・四角形の証明・STAGE 9／10・段位認定の総合コース）
//   STAGE 6 に p35（結論が平行：合同 → 錯角が等しいから平行）、STAGE 9「平行四辺形を利用せよ！」に p37〜p39、
//   STAGE 10「平行四辺形を証明せよ！」に p31〜p34・p36・p40〜p42
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
const Q = PH.quadrilateral;
const PG = PH.parallelogram;
const RT = PH.rightTriangle;
const TR = PH.rankTracks;
const CFG = PH.rank.config;
const k = (p, n) => geo.elementKey(p.figure, n);
const P = (id) => PH.getProblem(id);
const QUAD_IDS = ['p31', 'p32', 'p33', 'p34', 'p36', 'p40', 'p41', 'p42'];   // STAGE 10（平行四辺形になることの証明）
const USE_IDS = ['p37', 'p38', 'p39'];                                         // STAGE 9（平行四辺形の性質を使う合同）
const NEW_IDS = ['p35'].concat(USE_IDS, QUAD_IDS);                             // Ver.0.9 の問題
const QUAD = QUAD_IDS.map(P);
const TYPES = ['fill', 'build', 'challenge'];
const ABCD = ['A', 'B', 'C', 'D'];

// 平行四辺形の図（p31）と、対角線の交点 O のある図（p33）
const FIG = P('p31').figure;
const FIGO = P('p33').figure;
const derive = (facts, fig, quad) => PG.deriveParallelogramCondition({ figure: fig || FIG, vertices: quad || ABCD }, facts);
const fact = (s) => PG.parseFact(s);
const conds = (facts, fig) => { const r = derive(facts.map(fact), fig); return r ? r.all.map((a) => a.condition) : []; };

function withFigure(fig, over) { return Object.assign({}, fig, over); }
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

// 「＝⇔∥」を rel（'parallel' / 'eq'）に合わせる（誤答のあとは切りかえた関係がそのまま残る）
function setRel(g, rel) {
  if (g.relation !== rel) assert.equal(g.toggleRelation(), true);
}

// 平行四辺形の根拠を1つ答える（rel: 'parallel' なら「＝⇔∥」で ∥ に切りかえる）
function answerQ(g, ev, reason) {
  sel(g, ev.items[0], ev.items[1]);
  setRel(g, ev.rel === 'parallel' ? 'parallel' : 'eq');
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

// 三角形の合同の部分（三角形 → 根拠（直角三角形の問題は欄を選ぶ）→ 合同条件 → 結論）
function solveLemma(g) {
  const p = g.problem;
  g.tapTriangle(p.triangles[0]);
  g.tapTriangle(p.triangles[1]);
  assert.equal(g.confirmTriangles().status, 'ok');
  const list = g.roles.length ? g.roles.map((r) => RT.evidenceForRole(p, r)) : p.evidence;
  list.forEach((ev) => {
    if (g.roles.length) g.selectRole(RT.roleOf(p, ev));
    sel(g, ev.items[0], ev.items[1]);
    g.selectReason(ev.reason);
    assert.equal(g.confirmEvidence().status, 'correct', p.id + ' ' + ev.id);
  });
  g.selectCondition(p.congruence);
  assert.equal(g.confirmCondition().ok, true);
  sel(g, p.finalStep.items[0], p.finalStep.items[1]);
  g.selectReason(p.finalStep.reason);
  return g.confirmFinal();
}

function solveHunter(p, order) {
  const g = new PH.Game(p);
  if (PH.hasLemma(p)) assert.equal(solveLemma(g).quad, true);
  assert.equal(g.phase, 'qcollect');
  const evs = p.parallelogram.evidence.slice();
  (order ? order.map((i) => evs[i]) : evs).forEach((ev) => assert.equal(answerQ(g, ev).status, 'correct', p.id + ' ' + ev.id));
  assert.equal(g.phase, 'qcondition');
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
// 22-1 平行四辺形の成立条件
// =====================================================================================

test('5つの成立条件の定義（ID・表現）', () => {
  assert.deepEqual(PH.PARALLELOGRAM_CONDITION_ORDER, ['PP_PARALLEL_PAIRS', 'PP_EQUAL_SIDES', 'PP_EQUAL_ANGLES', 'PP_BISECT_DIAGONALS', 'PP_PARALLEL_EQUAL_PAIR']);
  assert.equal(PH.PARALLELOGRAM_CONDITIONS.PP_PARALLEL_PAIRS.label, '2組の対辺がそれぞれ平行');
  assert.equal(PH.PARALLELOGRAM_CONDITIONS.PP_EQUAL_SIDES.label, '2組の対辺がそれぞれ等しい');
  assert.equal(PH.PARALLELOGRAM_CONDITIONS.PP_EQUAL_ANGLES.label, '2組の対角がそれぞれ等しい');
  assert.equal(PH.PARALLELOGRAM_CONDITIONS.PP_BISECT_DIAGONALS.label, '対角線がそれぞれの中点で交わる');
  assert.equal(PH.PARALLELOGRAM_CONDITIONS.PP_PARALLEL_EQUAL_PAIR.label, '1組の対辺が平行で、その長さが等しい');
});

test('①2組の対辺がそれぞれ平行なら成立する（向き・左右を入れかえても同じ）', () => {
  assert.deepEqual(conds(['AB∥DC', 'AD∥BC']), ['PP_PARALLEL_PAIRS']);
  assert.deepEqual(conds(['CD∥BA', 'BC∥AD']), ['PP_PARALLEL_PAIRS']);
});

test('②2組の対辺がそれぞれ等しければ成立する', () => {
  assert.deepEqual(conds(['AB＝DC', 'AD＝BC']), ['PP_EQUAL_SIDES']);
  assert.deepEqual(conds(['CD＝AB', 'CB＝DA']), ['PP_EQUAL_SIDES']);
});

test('③2組の対角がそれぞれ等しければ成立する（隣り合う角では成立しない）', () => {
  assert.deepEqual(conds(['∠DAB＝∠BCD', '∠ABC＝∠CDA']), ['PP_EQUAL_ANGLES']);
  assert.deepEqual(conds(['∠BAD＝∠DCB', '∠CBA＝∠ADC']), ['PP_EQUAL_ANGLES']);
  assert.deepEqual(conds(['∠DAB＝∠ABC', '∠BCD＝∠CDA']), []);
});

test('④対角線がそれぞれの中点で交われば成立する（交点が図にないと成立しない）', () => {
  assert.deepEqual(conds(['AO＝CO', 'BO＝DO'], FIGO), ['PP_BISECT_DIAGONALS']);
  assert.deepEqual(conds(['AO＝BO', 'CO＝DO'], FIGO), []);
  assert.deepEqual(conds(['AO＝CO'], FIGO), []);
  const noLine = withFigure(FIGO, { lines: [['B', 'O', 'D']] });
  assert.equal(Q.diagonalPoint(noLine, ABCD), null);
  assert.equal(derive(['AO＝CO', 'BO＝DO'].map(fact), noLine), null);
});

test('⑤1組の対辺が平行かつ等長なら成立する。異なる組の対辺を混同しない', () => {
  assert.deepEqual(conds(['AD∥BC', 'AD＝BC']), ['PP_PARALLEL_EQUAL_PAIR']);
  assert.deepEqual(conds(['AB∥DC', 'DC＝AB']), ['PP_PARALLEL_EQUAL_PAIR']);
  assert.deepEqual(conds(['AB∥DC', 'AD＝BC']), []);
  assert.deepEqual(conds(['AD∥BC', 'AB＝DC']), []);
});

test('根拠不足なら成立しない。返り値に使った事実のIDをふくむ', () => {
  assert.equal(derive([]), null);
  assert.equal(derive([fact('AB＝DC')]), null);
  assert.equal(derive([fact('AB∥DC')]), null);
  assert.equal(derive(['AB＝AD', 'CB＝CD'].map(fact)), null);        // たこ形（隣り合う辺）
  const r = derive([{ id: 'x', items: ['AB', 'DC'], rel: 'parallel' }, { id: 'y', items: ['AB', 'DC'] }, { id: 'z', items: ['AB', 'BC'] }]);
  assert.equal(r.condition, 'PP_PARALLEL_EQUAL_PAIR');
  assert.deepEqual(r.used.slice().sort(), ['x', 'y']);
});

test('成立条件の判定（ハンターの checkCondition）：正解・ほかの道すじ・⑤の取りちがえ・誤り', () => {
  const p41 = P('p41');
  assert.equal(PG.checkCondition(p41, ['q1', 'q2'], 'PP_PARALLEL_EQUAL_PAIR').status, 'correct');
  assert.equal(PG.checkCondition(p41, ['q1', 'q2'], 'PP_PARALLEL_PAIRS').status, 'wrong-condition');
  assert.equal(PG.checkCondition(p41, ['q1'], 'PP_PARALLEL_EQUAL_PAIR').status, 'incomplete');
  // ほかの道すじで示せる条件（alternatives）はミスにしない
  const alt = PG.checkCondition(withQuad(P('p34'), { alternatives: ['PP_EQUAL_SIDES'] }), ['q1', 'q2'], 'PP_EQUAL_SIDES');
  assert.equal(alt.status, 'alternative');
  assert.equal(alt.miss, false);
  // ⑤の取りちがえ（平行な辺と等しい辺が別の組）
  const p34 = P('p34');
  const mixed = withQuad(p34, { evidence: [p34.parallelogram.evidence[0], { id: 'q2', items: ['AD', 'BC'], reason: 'given', label: 'AD＝BC', mark: 1 }] });
  assert.equal(PG.checkCondition(mixed, ['q1', 'q2'], 'PP_PARALLEL_EQUAL_PAIR').status, 'invalid-set');
  assert.equal(PG.isMixedPair(mixed, mixed.parallelogram.evidence), true);
});

// =====================================================================================
// 22-2 四角形の幾何処理
// =====================================================================================

test('頂点の周回順・対辺と隣辺・対角と隣り合う角・対角線', () => {
  assert.deepEqual(Q.sides(ABCD), ['AB', 'BC', 'CD', 'DA']);
  assert.deepEqual(Q.oppositeSides('ABCD'), [['AB', 'CD'], ['BC', 'DA']]);
  assert.deepEqual(Q.adjacentSides(ABCD)[0], ['AB', 'BC']);
  assert.deepEqual(Q.oppositeAngles(ABCD), [['∠DAB', '∠BCD'], ['∠ABC', '∠CDA']]);
  assert.deepEqual(Q.diagonals(ABCD), ['AC', 'BD']);
  assert.equal(Q.oppositeIndex(ABCD, 'DC', 'BA'), 0);
  assert.equal(Q.oppositeIndex(ABCD, 'AD', 'CB'), 1);
  assert.equal(Q.oppositeIndex(ABCD, 'AB', 'BC'), -1);
  assert.equal(Q.oppositeIndex(ABCD, 'AC', 'BD'), -1);
  assert.equal(Q.name(['A', 'E', 'C', 'F']), '四角形AECF');
  assert.deepEqual(Q.oppositeSides('ACBD'), [['AC', 'BD'], ['CB', 'DA']]);
});

test('対角線の交点と中点：交点 O が両方の対角線の内側にあるときだけ', () => {
  assert.equal(Q.diagonalPoint(FIGO, ABCD), 'O');
  assert.deepEqual(Q.diagonalHalves(FIGO, ABCD), [['AO', 'CO'], ['BO', 'DO']]);
  assert.equal(Q.isBetween(FIGO, 'A', 'O', 'C'), true);
  assert.equal(Q.isBetween(FIGO, 'A', 'C', 'O'), false);
  const p36 = P('p36');
  assert.equal(Q.diagonalPoint(p36.figure, p36.targetQuadrilateral), 'O');
  assert.deepEqual(Q.diagonalHalves(p36.figure, p36.targetQuadrilateral), [['AO', 'CO'], ['EO', 'FO']]);
});

test('自己交差した四角形・退化した四角形を受け付けない', () => {
  assert.equal(Q.isSimple(FIG, ABCD), true);
  assert.equal(Q.isConvex(FIG, ABCD), true);
  assert.equal(Q.isSimple(FIG, ['A', 'C', 'B', 'D']), false);
  assert.equal(derive(['AC∥BD', 'CB∥DA'].map(fact), FIG, ['A', 'C', 'B', 'D']), null);
  const flat = withFigure(FIG, { points: Object.assign({}, FIG.points, { D: { x: 200, y: 280 } }) });
  assert.equal(Q.isSimple(flat, ABCD), false);
  assert.equal(derive(['AB＝DC', 'AD＝BC'].map(fact), flat), null);
  assert.equal(Q.isSimple(FIG, ['A', 'B', 'A', 'D']), false);
});

test('平行の関係の正規化：AB∥CD・CD∥AB・BA∥DC は同じ。一直線上の点による別表記も同じ', () => {
  const key = (a, b, fig) => Q.parallelKey(fig || FIG, a, b);
  assert.equal(key('AB', 'CD'), key('CD', 'AB'));
  assert.equal(key('AB', 'CD'), key('BA', 'DC'));
  assert.notEqual(key('AB', 'CD'), key('AD', 'BC'));
  assert.equal(key('AB', 'BA'), null);
  const p41 = P('p41');
  // E は AB 上、F は DC 上：EB∥DF は AB∥DC と同じ関係
  assert.equal(key('EB', 'DF', p41.figure), key('AB', 'DC', p41.figure));
  assert.equal(Q.lineKey(P('p36').figure, 'EO'), Q.lineKey(P('p36').figure, 'BD'));
});

test('錯角・同位角が等しい → 平行：図の配置で、錯角・同位角かを確かめる', () => {
  const p35 = P('p35');
  assert.equal(PG.checkConverse(p35.figure, ['AD', 'BC'], ['∠ADB', '∠CBD'], 'alternate'), null);
  assert.ok(PG.checkConverse(p35.figure, ['AD', 'BC'], ['∠ADB', '∠CBD'], 'corresponding'));
  assert.equal(PG.checkConverse(p35.figure, ['AB', 'DC'], ['∠ABD', '∠CDB'], 'alternate'), null);
  // 等しい角が2つあるだけでは平行とはいえない
  assert.ok(PG.checkConverse(p35.figure, ['AD', 'BC'], ['∠DAB', '∠BCD'], 'alternate'));
  assert.ok(PG.checkConverse(p35.figure, ['AD', 'BC'], ['∠ABD', '∠CBD'], 'alternate'));
  const p10 = P('p10');
  assert.equal(PG.checkConverse(p10.figure, ['AB', 'DC'], ['∠ABC', '∠DCE'], 'corresponding'), null);
  assert.ok(PG.checkConverse(p10.figure, ['AB', 'DC'], ['∠ABC', '∠DCE'], 'alternate'));
  // p42：垂線がつくる直角どうし（∠BEF＝∠DFE＝90°）は錯角
  const p42 = P('p42');
  assert.equal(PG.checkConverse(p42.figure, ['BE', 'FD'], ['∠BEF', '∠DFE'], 'alternate'), null);
});

// =====================================================================================
// 22-3 証明エンジン・平行四辺形の性質
// =====================================================================================

test('平行四辺形の4つの性質（ルールID）と、性質から言える事実', () => {
  ['parallelogramOppositeSidesParallel', 'parallelogramOppositeSidesEqual', 'parallelogramOppositeAnglesEqual', 'parallelogramDiagonalsBisect']
    .forEach((r) => assert.ok(PH.proofRules.RULES[r], r));
  const facts = PG.propertyFacts(FIGO, ABCD);
  assert.deepEqual([...new Set(facts.map((f) => f.rule))].sort(),
    ['parallelogramDiagonalsBisect', 'parallelogramOppositeAnglesEqual', 'parallelogramOppositeSidesEqual', 'parallelogramOppositeSidesParallel']);
  assert.equal(facts.length, 8);
  assert.ok(PH.proofRules.RULES.PP_EQUAL_SIDES.condition);
  assert.notEqual(PH.REASONS.parallelogramSides.proof, PH.PARALLELOGRAM_CONDITIONS.PP_EQUAL_SIDES.label);
});

test('仮定の平行四辺形の性質は使え、まだ平行四辺形と証明していない四角形の性質は使えない', () => {
  const p31 = P('p31');
  const g = new PH.Game(p31);
  sel(g, 'AB', 'DC');
  g.selectReason('parallelogramSides');
  const r = g.confirmEvidence();
  assert.equal(r.status, 'property-unproved');
  assert.equal(r.miss, true);
  sel(g, 'AD', 'BC');
  g.toggleRelation();
  g.selectReason('parallelogramParallel');
  assert.equal(g.confirmEvidence().status, 'property-unproved');
  const p36 = P('p36');
  const keys = (a, b) => [k(p36, a), k(p36, b)];
  assert.equal(PG.checkEvidence(p36, keys('OA', 'OC'), 'eq', 'parallelogramDiagonals', []).status, 'correct');
  assert.equal(PG.checkEvidence(p36, keys('AE', 'CF'), 'eq', 'parallelogramSides', []).status, 'property-unproved');
  assert.equal(PG.checkEvidence(p36, keys('AE', 'CF'), 'parallel', 'parallelogramParallel', []).status, 'property-unproved');
  assert.equal(PG.checkEvidence(p36, keys('AB', 'DC'), 'eq', 'parallelogramSides', []).status, 'irrelevant');
  assert.equal(PH.proofRules.checkParallelogramProperty(p36, p36.proofSteps[0]), null);
  assert.ok(PH.proofRules.checkParallelogramProperty(p36, Object.assign({}, p36.proofSteps[0], { quad: 'AECF' })));
  assert.equal(PH.proofRules.checkHalfSegments(p36, p36.proofSteps[1]), null);
  assert.ok(PH.proofRules.checkHalfSegments(p36, Object.assign({}, p36.proofSteps[1], { items: ['OE', 'OD'] })));
});

test('新しい推論ルール：平行・長さをつなぐ（p40）、等しい線分の差（p41）。データの誤りを見つける', () => {
  const R = PH.proofRules;
  const p40 = P('p40'), p41 = P('p41');
  const s = (p, id) => p.proofSteps.find((x) => x.id === id);
  assert.equal(R.checkTransitive(p40, s(p40, 's3'), [s(p40, 's1'), s(p40, 's2')]), null);
  assert.equal(R.checkTransitive(p40, s(p40, 's6'), [s(p40, 's4'), s(p40, 's5')]), null);
  assert.ok(R.checkTransitive(p40, Object.assign({}, s(p40, 's3'), { items: ['AD', 'BC'] }), [s(p40, 's1'), s(p40, 's2')]));
  assert.ok(R.checkTransitive(p40, s(p40, 's3'), [s(p40, 's1'), s(p40, 's4')]));        // 平行と等しさを混ぜない
  assert.equal(R.checkSegmentSubtraction(p41, s(p41, 's2')), null);
  assert.ok(R.checkSegmentSubtraction(p41, Object.assign({}, s(p41, 's2'), { items: ['AE', 'DF'] })));
  assert.ok(R.checkSegmentSubtraction(Object.assign({}, p41, { given: ['四角形ABCDは平行四辺形'] }), s(p41, 's2')));   // 仮定がない
  // 平行の関係のステップは、等式の事実として登録しない（AD∥BC を AD＝BC にしない）
  assert.ok(/^par:/.test(PH.proofEngine.factKey(p40, s(p40, 's1'))));
});

test('p35（STAGE 6）：合同 → 対応する角 → 「錯角が等しいから平行」で AD∥BC を証明する', () => {
  const p = P('p35');
  assert.equal(p.stage, 6);
  assert.equal(PH.conclusionType(p), 'parallelLines');
  assert.equal(p.conclusion, 'AD∥BC');
  assert.equal(PH.isQuadProblem(p), false);
  const g = new PH.Game(p);
  const r = solveLemma(g);
  assert.equal(r.status, 'correct');
  assert.equal(r.post, true);
  assert.equal(g.phase, 'post');
  assert.equal(g.currentStep().rule, 'alternateAnglesParallel');
  // 逆の推論（平行線の錯角は等しい）を選ぶとミス
  const opts = g.stepOptions();
  assert.deepEqual(opts.map((o) => o.text).sort(), ['対頂角は等しいから', '平行線の錯角は等しいから', '錯角が等しいから'].sort());
  g.chooseStepOption(opts.find((o) => o.text === '平行線の錯角は等しいから').id);
  assert.equal(g.confirmStep().status, 'wrong');
  assert.equal(g.misses, 1);
  assert.equal(solveStep(g).status, 'correct');
  assert.equal(g.phase, 'clear');
  // 証明文の最後：「∠ADB＝∠CBDより、錯角が等しいから、AD∥BC」
  const proof = PH.buildProof(p);
  assert.deepEqual(proof.post.map((l) => l.reason + l.conclusion), ['∠ADB＝∠CBDより、錯角が等しいから、AD∥BC']);
  assert.equal(proof.quad, undefined);
  // パズル3レベル
  TYPES.forEach((t) => {
    const z = new PH.Puzzle(p, t);
    assert.ok(z.slots.some((x) => x.id === 'st:s1'));
    fill(z, z.solution());
    assert.equal(z.check().status, 'clear', t);
  });
});

test('合同から導いた事実を使える（p42）。錯角の等しさが証明されていなければ平行を導けない', () => {
  const p = P('p42');
  const g = new PH.Game(p);
  const r = solveLemma(g);
  assert.equal(r.quad, true);
  assert.equal(g.phase, 'qcollect');
  // 合同から導いた BE＝DF（合同な図形の対応する辺）と、垂線の直角による錯角から BE∥FD
  const [q1, q2] = p.parallelogram.evidence;
  assert.equal(q1.fromFinal, true);
  assert.equal(answerQ(g, q1).status, 'correct');
  // 「平行線の錯角は等しい」（逆の推論）は、平行を導く理由にならない
  sel(g, 'BE', 'FD');
  g.toggleRelation();
  g.selectReason('alternate');
  assert.equal(g.confirmEvidence().status, 'wrong-reason');
  assert.equal(answerQ(g, q2).status, 'correct');
  g.selectCondition('PP_PARALLEL_EQUAL_PAIR');
  assert.equal(g.confirmCondition().ok, true);
  // 垂直の仮定がなければ、∠BEF＝∠DFE は証明されていないので平行を導けない
  const noPerp = Object.assign({}, p, { given: ['四角形ABCDは平行四辺形'] });
  assert.equal(PG.rightVia(noPerp, q2), false);
  assert.equal(PG.checkEvidence(noPerp, [k(p, 'BE'), k(p, 'FD')], 'parallel', 'alternateConverse', [], { isEstablished: () => false }).status, 'via-unproved');
  assert.equal(PG.checkEvidence(p, [k(p, 'BE'), k(p, 'FD')], 'parallel', 'alternateConverse', [], { isEstablished: () => false }).status, 'correct');
});

test('証明済みの事実を再利用し、成立条件に必要な根拠だけを集めると完成する（STAGE 10 の8問を★★★）', () => {
  QUAD.forEach((p) => {
    const g = solveHunter(p);
    g.selectCondition(p.parallelogram.condition);
    const r = g.confirmCondition();
    assert.equal(r.status, 'correct', p.id);
    assert.equal(g.phase, 'clear', p.id);
    assert.equal(g.misses, 0, p.id);
    assert.equal(g.stars, 3, p.id);
  });
  // 見つけた平行の根拠は矢印（autoParallel）で表示する
  const g = solveHunter(P('p34'));
  assert.deepEqual(g.autoParallel().map((a) => a.slice(0, 2).join('')), ['AB', 'DC', 'AD', 'BC']);
});

test('多段階証明（p36・p40）：導く根拠は「詳しい理由を説明する」→ 性質・推論のステップ', () => {
  const p = P('p36');
  const g = new PH.Game(p);
  const q2 = p.parallelogram.evidence[1];
  sel(g, 'OE', 'OF');
  g.selectReason('given');
  assert.equal(g.confirmEvidence().status, 'not-proved');
  sel(g, 'OE', 'OF');
  assert.equal(g.explain().status, 'explain');
  assert.equal(g.currentStep().id, 's1');
  assert.equal(solveStep(g).status, 'correct');
  assert.equal(g.currentStep().id, 's2');
  const r = solveStep(g);
  assert.equal(r.registered.id, q2.id);
  assert.equal(g.phase, 'qcollect');
  sel(g, 'OA', 'OC');
  assert.equal(g.explain().status, 'not-explain');
  // p40：AD∥EF（平行）と AD＝EF（等しい）の2つの根拠を、それぞれ3つのステップで説明する。登録後は「＝」にもどる
  const p40 = P('p40');
  const g40 = new PH.Game(p40);
  assert.equal(answerQ(g40, p40.parallelogram.evidence[0]).status, 'correct');
  assert.equal(g40.relation, 'eq');
  assert.equal(answerQ(g40, p40.parallelogram.evidence[1]).status, 'correct');
  assert.equal(g40.phase, 'qcondition');
});

test('最終結論（平行四辺形である）を正しく判定する：誤った成立条件ではクリアにならない', () => {
  const p = P('p31');
  const g = solveHunter(p);
  g.selectCondition('PP_PARALLEL_EQUAL_PAIR');
  const r = g.confirmCondition();
  assert.equal(r.ok, false);
  assert.equal(r.miss, true);
  assert.equal(g.misses, 1);
  assert.equal(g.phase, 'qcondition');
  g.selectCondition('PP_EQUAL_SIDES');
  assert.equal(g.confirmCondition().ok, true);
  assert.equal(g.phase, 'clear');
});

// =====================================================================================
// 22-4 ハンター・パズル
// =====================================================================================

test('42問・10ステージ。STAGE 9「平行四辺形を利用せよ！」・STAGE 10「平行四辺形を証明せよ！」', () => {
  assert.equal(PH.problems.length, 48);   // Ver.1.0 で STAGE 11（p43〜p48）を追加（v10.test.js）
  assert.equal(PH.STAGES.length, 11);
  assert.equal(PH.getStage(9).title, '平行四辺形を利用せよ！');
  assert.equal(PH.getStage(10).title, '平行四辺形を証明せよ！');
  assert.deepEqual(PH.stageProblems(6).map((p) => p.id), ['p16', 'p17', 'p18', 'p19', 'p20', 'p35']);
  assert.deepEqual(PH.stageProblems(9).map((p) => p.id), USE_IDS);
  assert.deepEqual(PH.stageProblems(10).map((p) => p.id), QUAD_IDS);
  QUAD.forEach((p) => {
    assert.equal(PH.conclusionType(p), 'parallelogram', p.id);
    assert.equal(p.conclusion, Q.name(p.targetQuadrilateral) + 'は平行四辺形');
  });
  // 三角形の合同の部分があるのは p42 だけ（triangles は必須ではない）
  assert.deepEqual(QUAD.filter((p) => PH.hasLemma(p)).map((p) => p.id), ['p42']);
  QUAD.filter((p) => !PH.hasLemma(p)).forEach((p) => {
    assert.equal(p.triangles, undefined, p.id);
    assert.equal(p.congruence, undefined, p.id);
    assert.deepEqual(p.evidence, [], p.id);
  });
  // STAGE 9：仮定の平行四辺形の性質を合同の根拠に使う
  USE_IDS.map(P).forEach((p) => {
    assert.deepEqual(p.knownParallelograms, [ABCD], p.id);
    assert.ok(p.evidence.some((ev) => PG.isPropertyReason(ev.reason)), p.id);
    assert.equal(PH.isQuadProblem(p), false, p.id);
  });
  assert.deepEqual(USE_IDS.map((id) => P(id).congruence), ['SAS', 'RHA', 'ASA']);
});

test('全問題のデータ検証（平行四辺形の根拠・性質の使い方・平行を導く角をふくむ）', () => {
  assert.deepEqual(val.verifyAll(PH.problems, PH.STAGES), []);
  const p31 = P('p31');
  const bad = (pz) => val.verifyProblem(withQuad(p31, pz));
  assert.ok(bad({ condition: 'PP_PARALLEL_PAIRS' }).some((e) => /成立条件が根拠と一致しない/.test(e)));
  assert.ok(bad({ evidence: [p31.parallelogram.evidence[0], Object.assign({}, p31.parallelogram.evidence[1], { reason: 'parallelogramSides' })] })
    .some((e) => /仮定の平行四辺形の性質になっていない/.test(e)));
  assert.ok(bad({ alternatives: ['PP_PARALLEL_PAIRS'] }).some((e) => /alternatives が仮定から言えない/.test(e)));
  // STAGE 9：仮定の平行四辺形の性質になっていない根拠（隣り合う辺）は見つける
  const p37 = P('p37');
  const broken = Object.assign({}, p37, { evidence: p37.evidence.map((e) => (e.id === 'e2' ? Object.assign({}, e, { items: ['AB', 'BC'], label: 'AB＝BC' }) : e)) });
  assert.ok(val.verifyProblem(broken).some((e) => /仮定の平行四辺形の性質になっていない/.test(e)));
});

test('5つの成立条件すべてを学習できる（STAGE 10 の正解の条件）', () => {
  const used = QUAD.map((p) => p.parallelogram.condition);
  PH.PARALLELOGRAM_CONDITION_ORDER.forEach((c) => assert.ok(used.includes(c), c));
  assert.deepEqual(used, ['PP_EQUAL_SIDES', 'PP_EQUAL_ANGLES', 'PP_BISECT_DIAGONALS', 'PP_PARALLEL_PAIRS', 'PP_BISECT_DIAGONALS',
    'PP_PARALLEL_EQUAL_PAIR', 'PP_PARALLEL_EQUAL_PAIR', 'PP_PARALLEL_EQUAL_PAIR']);
});

test('根拠スロット数が問題に応じて変わる（平行四辺形は2つ、三角形の合同は3つ）', () => {
  QUAD.forEach((p) => {
    const g = new PH.Game(p);
    if (PH.hasLemma(p)) {
      assert.equal(g.total(), 3, p.id);
      solveLemma(g);
    }
    assert.equal(g.total(), 2, p.id);
    assert.equal(g.part, 'quad');
  });
  assert.equal(new PH.Game(P('p01')).total(), 3);
});

test('ハンター：根拠を逆の順番で集めても完成する。「＝⇔∥」は辺を選んでいるときだけ', () => {
  QUAD.forEach((p) => {
    const g = solveHunter(p, [1, 0]);
    g.selectCondition(p.parallelogram.condition);
    assert.equal(g.confirmCondition().ok, true, p.id);
  });
  const g = new PH.Game(P('p32'));
  sel(g, '∠DAB', '∠BCD');
  assert.equal(g.toggleRelation(), false);
  assert.equal(g.relation, 'eq');
});

test('ハンター：誤った理由・関係を判定する（関係の種類・平行でない辺・使わない関係）', () => {
  const p34 = P('p34');
  const g = new PH.Game(p34);
  sel(g, 'AD', 'BC');
  g.toggleRelation();
  g.selectReason('parallelogramParallel');
  assert.equal(g.confirmEvidence().status, 'property-unproved');
  sel(g, 'AB', 'DC');
  setRel(g, 'eq');
  g.selectReason('given');
  assert.equal(g.confirmEvidence().status, 'wrong-equation');            // 仮定は AB∥DC（AB＝DC ではない）
  assert.equal(answerQ(g, p34.parallelogram.evidence[0]).status, 'correct');
  assert.equal(answerQ(g, p34.parallelogram.evidence[1]).status, 'correct');
  // p42：合同の根拠に使った AB＝CD（平行四辺形の対辺）は正しいが、平行四辺形BFDEの根拠ではない（ミスにしない）
  const g42 = new PH.Game(P('p42'));
  solveLemma(g42);
  sel(g42, 'AB', 'CD');
  g42.selectReason('parallelogramSides');
  const r = g42.confirmEvidence();
  assert.equal(r.status, 'irrelevant');
  assert.equal(r.miss, false);
});

test('ハンター：ヒントは平行四辺形の根拠 → 成立条件の順（3段階）', () => {
  const p = P('p31');
  const g = new PH.Game(p);
  assert.equal(PH.hints.targetId(p, g), 'q1');
  const h = g.useHint();
  assert.equal(h.level, 1);
  answerQ(g, p.parallelogram.evidence[0]);
  assert.equal(PH.hints.targetId(p, g), 'q2');
  answerQ(g, p.parallelogram.evidence[1]);
  assert.equal(PH.hints.targetId(p, g), 'pcondition');
  QUAD.forEach((q) => assert.equal(q.hints.pcondition.length, 3, q.id));
  assert.equal(P('p33').hints.pcondition[0].text, '対角線が交わる点に注目しよう！');
});

test('STAGE 9（p37〜p39）をハンターで★★★：平行四辺形の性質を合同の根拠に使う', () => {
  USE_IDS.map(P).forEach((p) => {
    const g = new PH.Game(p);
    if (g.phase === 'triangle') {
      g.tapTriangle(p.triangles[0]);
      g.tapTriangle(p.triangles[1]);
      assert.equal(g.confirmTriangles().status, 'ok');
    }
    const list = g.roles.length ? g.roles.map((r) => RT.evidenceForRole(p, r)) : p.evidence;
    list.forEach((ev) => {
      if (g.roles.length) g.selectRole(RT.roleOf(p, ev));
      sel(g, ev.items[0], ev.items[1]);
      // 平行四辺形の性質を「仮定より」にするのは誤り
      if (PG.isPropertyReason(ev.reason)) {
        g.selectReason('given');
        assert.equal(g.confirmEvidence().status, 'wrong-reason', p.id);
      }
      g.selectReason(ev.reason);
      assert.equal(g.confirmEvidence().status, 'correct', p.id + ' ' + ev.id);
    });
    g.selectCondition(p.congruence);
    assert.equal(g.confirmCondition().ok, true, p.id);
    if (g.phase === 'final') {
      sel(g, p.finalStep.items[0], p.finalStep.items[1]);
      g.selectReason(p.finalStep.reason);
      assert.equal(g.confirmFinal().status, 'correct');
    }
    assert.equal(g.phase, 'clear', p.id);
  });
  // p39：錯角 ∠AMO＝∠CNO も正しい関係（ミスにしない）
  const p39 = P('p39');
  const g = new PH.Game(p39);
  g.tapTriangle(p39.triangles[0]); g.tapTriangle(p39.triangles[1]); g.confirmTriangles();
  sel(g, '∠AMO', '∠CNO');
  g.selectReason('alternate');
  assert.equal(g.confirmEvidence().status, 'irrelevant');
});

test('証明パズル3レベル：Ver.0.9 の問題（p35・p37〜p42・STAGE 10）を正しい配置で完成できる', () => {
  NEW_IDS.map(P).forEach((p) => TYPES.forEach((t) => {
    const z = new PH.Puzzle(p, t);
    assert.equal(z.slots.some((s) => s.id === 'pcond'), PH.isQuadProblem(p), p.id + ' ' + t);
    assert.equal(z.slots.some((s) => s.id === 'cond'), PH.hasCongruence(p), p.id + ' ' + t);
    fill(z, z.solution());
    const r = z.check();
    assert.equal(r.status, 'clear', p.id + ' ' + t + ' ' + JSON.stringify(r.result && r.result.messages));
    assert.equal(z.misses, 0);
  }));
  // p42：合同から導いた BE＝DF は、平行四辺形の部分の行にしない（証明文では ④ を使う）
  assert.deepEqual(new PH.Puzzle(P('p42'), 'build').qrowEv.map((ev) => ev.id), ['q2']);
  // p40：根拠はどちらもステップで導くので、平行四辺形の部分はステップの行と成立条件だけ
  assert.deepEqual(new PH.Puzzle(P('p40'), 'fill').quadSlots().map((s) => s.id), ['st:s1', 'st:s2', 'st:s3', 'st:s4', 'st:s5', 'st:s6', 'pcond']);
});

test('証明パズル：成立条件のカードは5つ。平行の等式カードがある。根拠の順番を入れかえても正解（スタンダード）', () => {
  const p = P('p31');
  const z = new PH.Puzzle(p, 'build');
  assert.equal(z.cards.pcond.length, 5);
  assert.ok(z.cards.qeq.some((c) => c.text === 'AB∥DC' && c.rel === 'parallel'));
  assert.ok(z.cards.qeq.some((c) => c.text === 'AB＝DC' && c.rel === 'eq'));
  const sol = z.solution();
  const swapped = Object.assign({}, sol, { qe0: sol.qe1, qe1: sol.qe0, qr0: sol.qr1, qr1: sol.qr0 });
  fill(z, swapped);
  assert.equal(z.check().status, 'clear');
});

test('証明パズル：誤りの判定（性質の先取り・関係の誤り・理由の誤り・成立条件・ほかの道すじ）', () => {
  const p31 = P('p31');
  let z = new PH.Puzzle(p31, 'fill');
  let sol = z.solution();
  sol.qs0 = z.cards.qeq.find((c) => c.text === 'AB∥DC').id;
  fill(z, sol);
  let r = z.check();
  assert.equal(r.status, 'wrong');
  assert.ok(/平行四辺形だと証明できてから/.test(r.result.messages[0].text));
  assert.equal(z.misses, 1);
  z = new PH.Puzzle(p31, 'build');
  sol = z.solution();
  sol.qr0 = z.cards.qreason.find((c) => c.reason === 'parallelogramSides').id;
  fill(z, sol);
  r = z.check();
  assert.equal(r.result.slotStatus.qr0, 'ng');
  assert.equal(r.result.slotStatus.qe0, 'ok');
  z = new PH.Puzzle(p31, 'fill');
  sol = z.solution();
  sol.pcond = z.cards.pcond.find((c) => c.cond === 'PP_PARALLEL_PAIRS').id;
  fill(z, sol);
  r = z.check();
  assert.equal(r.result.slotStatus.pcond, 'ng');
  assert.equal(z.misses, 1);
  // ほかの道すじの条件（alternatives）はミスにしない
  z = new PH.Puzzle(withQuad(P('p34'), { alternatives: ['PP_EQUAL_SIDES'] }), 'build');
  sol = z.solution();
  sol.pcond = z.cards.pcond.find((c) => c.cond === 'PP_EQUAL_SIDES').id;
  fill(z, sol);
  r = z.check();
  assert.equal(r.status, 'wrong');
  assert.equal(z.misses, 0);
  assert.ok(/その条件でも平行四辺形といえる場合があるよ/.test(r.result.messages[0].text));
});

test('証明パズル：ヒントは平行四辺形の根拠 → 成立条件（p42 は三角形の合同の部分から）', () => {
  const z = new PH.Puzzle(P('p31'), 'build');
  assert.equal(z.hintTarget().id, 'q1');
  assert.equal(z.useHint().slotId, 'qe0');
  const z42 = new PH.Puzzle(P('p42'), 'build');
  assert.equal(z42.hintTarget().id, 'triangleSelection');
  const sol = z42.solution();
  delete sol.qe0; delete sol.qr0; delete sol.pcond;
  fill(z42, sol);
  assert.equal(z42.hintTarget().id, 'q2');
  assert.equal(new PH.Puzzle(P('p36'), 'fill').hintTarget().id, 's1');
});

test('数学キーパッドで平行関係を入力できる（チャレンジ：空欄の種類に合わせて入力形式を自動設定）', () => {
  const K = PH.mathKeypad;
  assert.deepEqual(K.parse('AD∥BC'), { kind: 'par', left: 'AD', right: 'BC', value: 'AD∥BC' });
  assert.equal(K.parse('ad//bc').value, 'AD∥BC');
  assert.equal(K.parse('AD|BC').value, 'AD∥BC');
  assert.equal(K.parse('AD∥DA'), null);
  const z = new PH.Puzzle(P('p41'), 'challenge');
  assert.deepEqual(z.inputKinds('qe0'), ['par', 'seg', 'ang']);      // EB∥DF の行は最初から平行
  assert.deepEqual(new PH.Puzzle(P('p31'), 'challenge').inputKinds('qe0'), ['seg', 'ang', 'par']);   // AB＝DC の行は辺
  const kp = K.create(z.letters, { kinds: z.inputKinds('qe0') });
  assert.equal(kp.kind, 'par');
  ['E', 'B', 'D', 'F'].forEach((c) => kp.press(c));
  assert.equal(kp.display(), 'EB∥DF');
  assert.equal(kp.value(), 'EB∥DF');
  assert.equal(kp.toggleLabel(), '辺⇔角⇔∥');
  kp.toggleKind();
  assert.equal(kp.kind, 'seg');
  // 三角形の合同の部分の等式の欄には平行は入らない。平行の欄は向き・左右がちがっても同じ平行
  const z42 = new PH.Puzzle(P('p42'), 'challenge');
  z42.selectSlot('e1');
  assert.equal(z42.setInput('AB∥DC'), false);
  z42.selectSlot('qe0');
  assert.equal(z42.setInput('DF∥EB'), true);
  assert.equal(z42.cardIn('qe0').key, PG.factKey(z42.problem.figure, ['BE', 'FD'], 'parallel'));
  assert.equal(K.create(['A', 'B']).toggleLabel(), '辺⇔角');
});

test('完成した証明文：四角形の名前・事実番号・成立条件・最終結論（仕様 §16・教材の模範解答の形）', () => {
  const q31 = PH.buildProof(P('p31')).quad;
  assert.deepEqual(q31.intro, ['四角形ABCDにおいて']);
  assert.deepEqual(q31.lines.map((l) => l.reason + ' ' + l.equation + ' ……' + l.no), ['仮定より AB＝DC ……①', '仮定より AD＝BC ……②']);
  assert.equal(q31.summary, '①、②より、');
  assert.equal(q31.condition, '2組の対辺がそれぞれ等しい');
  assert.equal(q31.conclusion, '四角形ABCDは平行四辺形である。');
  const q33 = PH.buildProof(P('p33')).quad;
  assert.deepEqual(q33.intro, ['四角形ABCDにおいて', '対角線ACとBDの交点をOとする。']);
  // p42：合同の部分の続きに番号をつける（合同から導いた BE＝DF は ④）
  const p42 = PH.buildProof(P('p42'));
  assert.equal(p42.final.no, '④');
  assert.deepEqual(p42.quad.lines.map((l) => l.reason + ' ' + l.equation + ' ……' + l.no), ['∠BEF＝∠DFE＝90°より、錯角が等しいから BE∥FD ……⑤']);
  assert.equal(p42.quad.summary, '④、⑤より、');
  assert.equal(p42.quad.condition, '1組の対辺が平行で、その長さが等しい');
  // p36：性質と中点のステップの行
  const p36 = PH.buildProof(P('p36')).quad;
  assert.deepEqual(p36.stepLines.map((l) => l.reason + l.equation + ' ……' + l.no), [
    '平行四辺形の対角線はそれぞれの中点で交わるから、OB＝OD ……②',
    '仮定より OE＝1/2OB、OF＝1/2OD であるから、②より、OE＝OF ……③',
  ]);
  assert.equal(p36.summary, '①、③より、');
  // p40：教材の模範解答と同じ順（①②より AD∥EF、④⑤より AD＝EF）
  const p40 = PH.buildProof(P('p40')).quad;
  assert.deepEqual(p40.stepLines.map((l) => l.equation + l.no), ['AD∥BC①', 'BC∥EF②', 'AD∥EF③', 'AD＝BC④', 'BC＝EF⑤', 'AD＝EF⑥']);
  assert.equal(p40.stepLines[2].reason, '①、②より、');
  assert.equal(p40.summary, '③、⑥より、');
  // p41：線分の差
  const p41 = PH.buildProof(P('p41')).quad;
  assert.equal(p41.stepLines[1].reason + p41.stepLines[1].equation, '仮定より AE＝FC、また EB＝AB－AE、DF＝DC－FC だから、②より、EB＝DF');
  assert.equal(p41.summary, '①、③より、');
});

// =====================================================================================
// 22-5 段位認定
// =====================================================================================

const ALL = PH.rankQuestions.all();
const PARA = ALL.filter((q) => q.category === 'para');
const BASIC = TR.pool('basic');
const COMP = TR.pool('comprehensive');

test('基本コースに平行四辺形・Ver.0.9 の問題が混入しない。総合コースに新しいミニ問題が追加される', () => {
  assert.equal(BASIC.length, 148);
  assert.ok(!BASIC.some((q) => q.category === 'para'));
  assert.ok(!BASIC.some((q) => NEW_IDS.includes(q.sourceId)));
  assert.ok(!BASIC.some((q) => q.requiredTopics.some((t) => /parallel|diagonal/.test(t))));
  assert.equal(PARA.length, 35);
  PARA.forEach((q) => assert.ok(COMP.includes(q), q.id));
  assert.equal(COMP.length, ALL.length);
  // Ver.0.8 の274問 ＋ 平行四辺形 ＋ Ver.0.9 の問題の三角形の合同の部分（p35・p37〜p39・p42）
  //   ＋ Ver.1.0 の四角形の分類と、p43〜p48 から作る問題（v10.test.js）
  const triNew = COMP.filter((q) => NEW_IDS.includes(q.sourceId) && q.category !== 'para').length;
  const v10 = COMP.filter((q) => q.category === 'quad' || ['p43', 'p44', 'p45', 'p46', 'p47', 'p48'].includes(q.sourceId)).length;
  assert.equal(COMP.length, 274 + PARA.length + triNew + v10);
  ['parallelogramProperties', 'parallelogramConditions', 'diagonalBisector', 'parallelConverse']
    .forEach((t) => assert.ok(TR.get('comprehensive').allowedTopics.includes(t), t));
  assert.equal(PH.rankQuestions.CATEGORY_LABEL.para, '平行四辺形');
});

test('新しいミニ問題（タイプA〜E）：正解が1つに決まる', () => {
  const types = new Set(PARA.map((q) => q.type));
  ['ppCondition', 'ppDiagonal', 'ppNeed', 'ppProperty', 'ppTruth', 'ppKind', 'ppReason', 'ppConverse', 'ppDistinguish'].forEach((t) => assert.ok(types.has(t), t));
  PARA.forEach((q) => {
    assert.equal(q.blanks, 1, q.id);
    const b = q.choice.blanks[0];
    assert.equal(b.choices.length, 3, q.id);
    assert.equal(new Set(b.choices.map((c) => c.text)).size, 3, q.id);
    assert.equal(b.answer, 'a');
  });
  const tf = (i) => PH.rankQuestions.byId('rule-pp-tf' + i).answerText;
  assert.equal(tf(1), 'いえない');
  assert.equal(tf(2), 'いえる（1組の対辺が平行で、その長さが等しい）');
  assert.equal(tf(3), 'いえる（2組の対角がそれぞれ等しい）');
  assert.equal(tf(4), 'いえない');
  assert.equal(tf(5), 'いえる（2組の対辺がそれぞれ等しい）');
  PARA.filter((q) => q.type === 'ppCondition').forEach((q) => {
    const p = P(q.sourceId);
    const wrongs = q.choice.blanks[0].choices.filter((c) => c.id !== 'a').map((c) => c.text);
    const r = PG.deriveCondition(p, p.parallelogram.evidence);
    r.all.forEach((a) => assert.ok(!wrongs.includes(PH.PARALLELOGRAM_CONDITIONS[a.condition].label), q.id));
  });
  const inp = (id) => PH.rankQuestions.byId(id).input.check;
  assert.equal(inp('rule-pp-need-eq-AB')('DC=AB'), true);
  assert.equal(inp('rule-pp-need-eq-AB')('AD=BC'), false);
  assert.equal(inp('rule-pp-need-eq-AB')('AB∥DC'), false);
  assert.equal(inp('rule-pp-need-par')('BA∥CD'), true);
  assert.equal(inp('rule-ppp-side')('AB=DC'), true);
  assert.equal(inp('rule-ppp-angle')('∠DAB=∠DCB'), true);
  // 平行を導く（p35 の後半のステップ・p42 の垂線の直角）
  assert.equal(inp('p35-ppv-s1')('BC∥AD'), true);
  assert.equal(inp('p35-ppv-s1')('AB∥DC'), false);
  assert.equal(inp('p42-ppv-q2')('FD∥BE'), true);
  assert.equal(PH.rankQuestions.byId('p35-ppvr-s1').answerText, '錯角が等しいから');
  assert.ok(PH.rankQuestions.byId('p35-ppvr-s1').choice.blanks[0].choices.some((c) => c.text === '平行線の錯角は等しいから'));
});

test('120秒・時間ペナルティ・21段階認定・認定基準は変わらない。出題範囲のバージョンを記録する', () => {
  assert.equal(CFG.timeLimitMs, 120000);
  assert.equal(CFG.penaltyStepMs, 4000);
  assert.equal(PH.rank.totalPenalty(3), 24000);
  assert.equal(CFG.grades.length, 21);
  assert.equal(PH.rank.gradeFor(20).name, '皆伝');
  assert.equal(CFG.criteriaVersion, 2);
  assert.equal(CFG.questionPoolVersion, 3);   // Ver.1.0 で 3（ひし形・長方形・四角形の分類を追加）
  const g = new PH.RankGame({ seed: 5, track: 'comprehensive' });
  g.start(0);
  g.tick(120001);
  assert.equal(g.result.criteriaVersion, 2);
  assert.equal(g.result.questionPoolVersion, 3);
});

test('コース別の記録が維持される（Ver.0.8 の総合証明の記録を引き継ぎ、基準が同じなので比べ続ける）', () => {
  const old = JSON.stringify({
    version: 6, problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 } },
    rankCertification: { format: 2, legacy: null, tracks: {
      basic: { criteriaVersion: 2, best: { rank: 12, rankName: '三段', effectiveScore: 12, correct: 12, maxCombo: 5, at: 'x' }, bestCorrect: 12, playCount: 3 },
      comprehensive: { criteriaVersion: 2, best: { rank: 15, rankName: '六段', effectiveScore: 15, correct: 15, maxCombo: 7, at: 'y' }, bestCorrect: 15, playCount: 4 },
    } },
  });
  withFakeStorage(old, () => {
    assert.equal(PH.storage.getProblem('p01').bestStars, 3);
    assert.equal(PH.storage.getRank('basic').best.rankName, '三段');
    const comp = PH.storage.getRank('comprehensive');
    assert.equal(comp.best.rankName, '六段');
    assert.equal(comp.questionPoolVersion, null);
    const out = PH.storage.recordRank({ correct: 10, misses: 2, passes: 0, answered: 12, effectiveScore: 10, rank: 10, rankName: '初段',
      maxCombo: 4, criteriaVersion: 2, questionPoolVersion: 2, wrongs: [] }, 'comprehensive');
    assert.equal(out.newRecord, false);
    const after = PH.storage.getRank('comprehensive');
    assert.equal(after.best.rankName, '六段');
    assert.deepEqual(after.previous, []);
    assert.equal(after.questionPoolVersion, 2);
    assert.equal(after.lastResult.questionPoolVersion, 2);
    assert.equal(after.playCount, 5);
    assert.equal(PH.storage.getRank('basic').playCount, 3);
    assert.equal(PH.storage.getProblem('p31').cleared, false);
  });
});

test('新カテゴリ（平行四辺形）の出題比率が適切：総合コースで、どのカテゴリも同じくらい出る（重みはすべて1）', () => {
  ['eq', 'reason', 'cond', 'corr', 'final', 'theorem', 'right', 'para'].forEach((c) => assert.equal(TR.get('comprehensive').categoryWeights[c], 1, c));
  assert.equal(TR.get('basic').categoryWeights.para, undefined);
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
  // 8つのカテゴリがほぼ均等（1/8 ＝ 12.5% 前後。どれも1割〜2割の間）。Ver.1.0 の「四角形の分類」（選択式だけ）は v10.test.js
  Object.keys(cnt).filter((c) => c !== 'quad').forEach((c) => assert.ok(cnt[c] / total >= 0.08 && cnt[c] / total <= 0.2, c + ' ' + JSON.stringify(cnt)));
  assert.equal(Object.keys(cnt).length, 9);
});

// =====================================================================================
// 22-6 回帰
// =====================================================================================

test('回帰：p01〜p30 の流れ・合同条件（SSS・SAS・ASA・RHA・RHS）は変わらない', () => {
  const tri = PH.problems.filter((p) => Number(p.id.slice(1)) <= 30);
  assert.equal(tri.length, 30);
  const counts = {};
  tri.forEach((p) => {
    counts[p.congruence] = (counts[p.congruence] || 0) + 1;
    assert.equal(val.deriveCondition(p, p.evidence), p.congruence, p.id);
    const g = new PH.Game(p);
    assert.equal(g.quad, false);
    assert.equal(g.part, 'tri');
    assert.equal(g.phase, PH.hasFinalStep(p) ? 'triangle' : 'collect', p.id);
    assert.equal(PH.buildProof(p).quad, undefined, p.id);
    TYPES.forEach((t) => assert.ok(!new PH.Puzzle(p, t).slots.some((s) => s.id === 'pcond'), p.id));
  });
  ['SSS', 'SAS', 'ASA', 'RHA', 'RHS'].forEach((c) => assert.ok(counts[c] >= 2, c));
});

test('回帰：二等辺三角形・正三角形の推論・三段論法・角度式の比較は変わらない', () => {
  ['p21', 'p22', 'p23', 'p24', 'p27', 'p30'].forEach((id) => assert.deepEqual(PH.proofEngine.verify(P(id)), [], id));
  assert.equal(PH.buildProof(P('p23')).stepLines[2].reason, '③、④より、');
  assert.equal(PH.stepReasonText(P('p21').proofSteps[0], {}), 'AB＝ACより、二等辺三角形の底角は等しいから、');
});

test('回帰：Ver.0.8 の保存データ（ハンター・パズル3レベル）を引き継ぐ', () => {
  const old = JSON.stringify({
    version: 6, problems: { p30: { cleared: true, bestStars: 2, minMisses: 1 } },
    puzzleLevels: { easy: { p01: { cleared: true, bestStars: 3, minMisses: 0 } }, standard: {}, challenge: {} }, puzzleLevel: 'standard',
  });
  withFakeStorage(old, () => {
    assert.equal(PH.storage.getProblem('p30').bestStars, 2);
    assert.equal(PH.storage.getProblem('p01', 'puzzle:easy').bestStars, 3);
    assert.equal(PH.storage.getPuzzleLevel(), 'standard');
    assert.equal(PH.storage.stageStats(9).total, 3);
    assert.equal(PH.storage.stageStats(10).total, 8);
    assert.equal(PH.storage.stageStats(10).cleared, 0);
  });
});
