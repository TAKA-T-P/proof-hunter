// 証明ハンター Ver.0.7 のテスト（多段階証明：定理の適用・角度式・式の比較・証明済みの事実の再利用・STAGE 7）
// 実行: npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/problems.js');
require('../js/geometry.js');
require('../js/validation.js');
require('../js/angle-expression.js');
require('../js/proof-rules.js');
require('../js/proof-engine.js');
require('../js/hints.js');
require('../js/storage.js');
require('../js/game.js');
require('../js/math-keypad.js');
require('../js/puzzle.js');
require('../js/rank-config.js');
require('../js/rank-questions.js');
require('../js/rank-game.js');

const PH = globalThis.PH;
const val = PH.validation;
const geo = PH.geometry;
const E = PH.angleExpr;
const R = PH.proofRules;
const k = (p, n) => geo.elementKey(p.figure, n);
const MULTI = PH.problems.filter((p) => p.proofSteps);
const TYPES = ['fill', 'build', 'challenge'];

function fill(z, placement) {
  z.slots.forEach((s) => {
    if (placement[s.id] == null) return;
    z.selectSlot(s.id);
    const ok = s.input ? z.setInput(placement[s.id]) : z.place(placement[s.id]);
    assert.equal(ok, true, s.id + ' ' + placement[s.id]);
  });
}

// ハンター：三角形を選ぶ
function chooseTriangles(g) {
  const t = g.problem.triangles;
  g.tapTriangle(t[0]);
  g.tapTriangle(t[1]);
  const first = g.triSel[0];
  const from = first.join('') === t[0].slice().sort().join('') ? [t[0], t[1]] : [t[1], t[0]];
  first.forEach((v) => g.pressVertex(from[1][from[0].indexOf(v)]));
  return g.confirmTriangles();
}

// ハンター：今のステップを正しく答える
function solveStep(g) {
  const s = g.currentStep();
  const p = g.problem;
  if (s.type === 'compare') {
    s.dependsOn.forEach((d) => g.pickPart(d, 'value'));
    g.tap(k(p, s.items[0]));
    g.tap(k(p, s.items[1]));
  } else g.chooseStepOption('a');
  return g.confirmStep();
}

function answer(g, ev, reason) {
  const p = g.problem;
  g.setMode(geo.isAngleName(ev.items[0]) ? 'angle' : 'side');
  g.clearSelection();
  g.tap(k(p, ev.items[0]));
  g.tap(k(p, ev.items[1]));
  g.selectReason(reason);
  return g.confirmEvidence();
}

function solveHunter(p) {
  const g = new PH.Game(p);
  assert.equal(chooseTriangles(g).status, 'ok');
  while (g.phase === 'step') assert.equal(solveStep(g).status, 'correct');
  p.evidence.forEach((ev) => assert.equal(answer(g, ev, ev.reason).status, 'correct', p.id + ' ' + ev.label));
  g.selectCondition(p.congruence);
  assert.equal(g.confirmCondition().ok, true);
  g.setMode(geo.isAngleName(p.finalStep.items[0]) ? 'angle' : 'side');
  g.tap(k(p, p.finalStep.items[0]));
  g.tap(k(p, p.finalStep.items[1]));
  g.selectReason(PH.finalReasonFor(p));
  assert.equal(g.confirmFinal().status, 'correct');
  while (g.phase === 'post') assert.equal(solveStep(g).status, 'correct');
  return g;
}

// ---- 問題データ ---------------------------------------------------------------------

test('24問・7ステージ。STAGE 7「証明をつなげろ！」は p21〜p24 の多段階証明', () => {
  assert.equal(PH.problems.length, 24);
  assert.equal(PH.getStage(7).title, '証明をつなげろ！');
  assert.deepEqual(PH.stageProblems(7).map((p) => p.id), ['p21', 'p22', 'p23', 'p24']);
  assert.deepEqual(MULTI.map((p) => p.id), ['p21', 'p22', 'p23', 'p24']);
  assert.deepEqual(val.verifyAll(PH.problems, PH.STAGES), []);
  // p01〜p20 は proofSteps を持たない（従来の形式）
  PH.problems.filter((p) => p.stage <= 6).forEach((p) => assert.equal(p.proofSteps, undefined, p.id));
});

test('新しい4問の仮定・推論ステップ・結論（教材の模範解答どおり）', () => {
  const steps = (id) => PH.getProblem(id).proofSteps.map((s) => s.type + ':' + (s.rule || '') + ':' + s.label);
  assert.deepEqual(steps('p21'), ['theorem:isoscelesBaseAngles:∠ABC＝∠ACB']);
  assert.deepEqual(steps('p22'), ['theorem:isoscelesBaseAngles:∠ABC＝∠ACB', 'theorem:isoscelesConverse:△DBCは二等辺三角形']);
  assert.deepEqual(steps('p23'), ['expression:angleAddition:∠ACE＝∠ACD＋∠DCE＝∠ACD＋60°',
    'expression:angleAddition:∠BCD＝∠BCA＋∠ACD＝∠ACD＋60°', 'compare::∠ACE＝∠BCD']);
  assert.deepEqual(steps('p24'), ['expression:angleSubtraction:∠BAD＝∠BAC－∠DAC＝60°－∠DAC',
    'expression:angleSubtraction:∠CAE＝∠DAE－∠DAC＝60°－∠DAC', 'compare::∠BAD＝∠CAE']);
  const sum = (id) => { const p = PH.getProblem(id); return [p.given.join('、'), PH.congruenceText(p), p.congruence, p.conclusion].join(' | '); };
  assert.equal(sum('p21'), 'AB＝AC、BD＝CE | △ABD≡△ACE | SAS | AD＝AE');
  assert.equal(sum('p22'), 'AB＝AC、BM＝CN | △MBC≡△NCB | SAS | △DBCは二等辺三角形');
  assert.equal(sum('p23'), '△ABCは正三角形、△DCEは正三角形 | △ACE≡△BCD | SAS | AE＝BD');
  assert.equal(sum('p24'), '△ABCは正三角形、△ADEは正三角形 | △ABD≡△ACE | SAS | BD＝CE');
});

// ---- 21-1 定理の適用 ------------------------------------------------------------------

test('二等辺三角形の底角：AB＝AC から ∠ABC＝∠ACB を導ける（ちがう角・前提では言えない）', () => {
  const p = PH.getProblem('p21');
  assert.equal(R.checkIsoscelesBaseAngles(p, ['AB', 'AC'], ['∠ABC', '∠ACB']), null);
  assert.equal(R.checkIsoscelesBaseAngles(p, ['AC', 'AB'], ['∠ACB', '∠ABC']), null);
  assert.equal(R.checkIsoscelesBaseAngles(p, ['AB', 'AC'], ['∠ABD', '∠ACE']), null);   // 一直線上の別名（D・E は BC 上）
  assert.ok(R.checkIsoscelesBaseAngles(p, ['AB', 'AC'], ['∠BAD', '∠CAE']));
  assert.ok(R.checkIsoscelesBaseAngles(p, ['AD', 'BC'], ['∠ABC', '∠ACB']));
  assert.equal(R.label('isoscelesBaseAngles'), '二等辺三角形の底角は等しいから');
});

test('2つの角が等しい三角形は二等辺三角形：前提（∠DCB＝∠DBC）が証明されるまで使えない', () => {
  const p = PH.getProblem('p22');
  assert.equal(R.checkIsoscelesConverse(p, ['∠DBC', '∠DCB'], 'DBC'), null);
  assert.ok(R.checkIsoscelesConverse(p, ['∠MBC', '∠DCB'], 'DBC'));
  const eng = new PH.ProofEngine(p);
  assert.equal(eng.status('s2'), 'locked');
  assert.equal(eng.complete('s2'), false);                 // 前提がないので使えない
  eng.complete('s1');
  eng.reach('congruence');
  assert.equal(eng.status('s2'), 'locked');
  eng.reach('final');
  assert.equal(eng.status('s2'), 'available');
  assert.equal(eng.complete('s2'), true);
});

test('正三角形の性質：3辺が等しい（根拠の理由）・1つの角は60°（角の式）', () => {
  const p23 = PH.getProblem('p23');
  assert.equal(R.checkEquilateralSides(p23, ['AC', 'BC']), null);
  assert.equal(R.checkEquilateralSides(p23, ['CE', 'CD']), null);
  assert.ok(R.checkEquilateralSides(p23, ['AC', 'CE']));     // ちがう三角形の辺
  // ∠DCE（正三角形の角）は図の上で 60°
  assert.ok(Math.abs(val.measure(p23.figure, '∠DCE').value - 60) < 0.5);
  assert.equal(R.checkExpression(p23, p23.proofSteps[0]), null);
  // 正三角形がない問題では、定数角（60°）の式を作れない
  const fake = Object.assign({}, p23, { equilateral: [] });
  assert.match(R.checkExpression(fake, p23.proofSteps[0]), /正三角形/);
});

// ---- 21-2 角度式 ----------------------------------------------------------------------

test('角度式：加法の順序・角の逆順・一直線上の別名を同一視し、ちがう式は区別する', () => {
  const f = PH.getProblem('p23').figure;
  const eq = (a, b) => E.equal(E.parse(f, a), E.parse(f, b));
  assert.ok(eq('∠ACD＋60°', '60°＋∠ACD'));
  assert.ok(eq('∠ACD＋60°', '∠DCA＋60°'));
  assert.ok(eq('∠ACD+60', '60°＋∠DCA'));
  assert.ok(!eq('∠ACD＋60°', '∠ACD＋90°'));
  assert.ok(!eq('∠ACD＋60°', '∠ACE＋60°'));
  assert.ok(!eq('∠ACD＋60°', '60°－∠ACD'));
  const f24 = PH.getProblem('p24').figure;
  assert.ok(E.equal(E.parse(f24, '60°－∠DAC'), E.parse(f24, '－∠CAD＋60°')));
  // 一直線上の別名（p21：D は BC 上なので ∠ABD＝∠ABC）
  const f21 = PH.getProblem('p21').figure;
  assert.ok(E.equal(E.parse(f21, '∠ABD＋∠BAD'), E.parse(f21, '∠BAD＋∠ABC')));
  // 同じ角を足して引くと消える
  assert.deepEqual(E.parse(f, '∠ACD＋60°－∠ACD').terms, {});
});

test('角度式：読めない式は null（ゲームを止めない）。図の値は整合性の確認だけに使う', () => {
  const f = PH.getProblem('p23').figure;
  [null, '', '∠AC', '∠ABCD＋1', 'ab', '<script>', '60°＋＋∠ACD', '∠AXZ'].forEach((t) => {
    assert.doesNotThrow(() => E.parse(f, t));
  });
  assert.equal(E.parse(f, '∠AC'), null);
  assert.equal(E.parse(f, '60°＋＋∠ACD'), null);
  // 図の上で ∠ACE＝∠ACD＋∠DCE＝∠ACD＋60°
  assert.ok(Math.abs(E.evaluate(f, '∠ACE') - E.evaluate(f, '∠ACD＋60°')) < 0.5);
});

test('同じ式に等しい2つの角は等しい（式の比較）。右辺がちがう・同じ式どうしでは導けない', () => {
  const p = PH.getProblem('p23');
  const [s1, s2] = p.proofSteps;
  const got = R.compareExpressions(p, s1, s2);
  assert.equal(val.equationKey(got[0], got[1]), val.equationKey(k(p, '∠ACE'), k(p, '∠BCD')));
  assert.equal(R.compareExpressions(p, s1, s1), null);                                   // 同じ式を2回
  assert.equal(R.compareExpressions(p, s1, Object.assign({}, s2, { value: '∠ACD＋90°' })), null);
});

// ---- 21-3 ステップの管理 ----------------------------------------------------------------

test('ステップの状態：前提を満たしたステップだけ解け、結論が証明済みの事実として登録される', () => {
  const p = PH.getProblem('p23');
  const eng = new PH.ProofEngine(p);
  assert.deepEqual(eng.available('pre').map((s) => s.id), ['s1', 's2']);    // 独立した2つの式はどちらからでも
  assert.equal(eng.status('s3'), 'locked');
  assert.equal(eng.complete('s3'), false);                                 // 式がまだないので比べられない
  eng.complete('s2');
  assert.equal(eng.status('s3'), 'locked');
  eng.complete('s1');
  assert.equal(eng.status('s3'), 'available');
  const ev3 = p.evidence.find((e) => e.fromStep);
  assert.equal(eng.canUse(ev3), false);                                    // 未証明の事実は根拠に使えない
  eng.complete('s3');
  assert.equal(eng.status('s3'), 'completed');
  assert.equal(eng.canUse(ev3), true);
  assert.ok(eng.isProved(val.equationKey(k(p, '∠ACE'), k(p, '∠BCD'))));
  assert.ok(eng.stageDone('pre'));
});

test('未証明の事実を根拠にすると「先に証明する必要」（not-proved）。証明後は根拠に使える', () => {
  const p = PH.getProblem('p24');
  const eng = new PH.ProofEngine(p);
  const keys = [k(p, '∠BAD'), k(p, '∠CAE')];
  const r = val.checkEvidence(p, keys, 'proved', [], eng);
  assert.equal(r.status, 'not-proved');
  assert.equal(r.miss, true);
  eng.complete('s1'); eng.complete('s2'); eng.complete('s3');
  assert.equal(val.checkEvidence(p, keys, 'proved', [], eng).status, 'correct');
  assert.equal(val.checkEvidence(p, keys, 'given', [], eng).status, 'wrong-reason');
});

test('データ検証：ID重複・依存先なし・循環参照・導けない比較・前提ちがいを見つける', () => {
  const base = PH.getProblem('p23');
  const withSteps = (steps) => Object.assign({}, base, { proofSteps: steps });
  const s = base.proofSteps;
  assert.match(PH.proofEngine.verify(withSteps([s[0], s[0]])).join(' / '), /重複/);
  assert.match(PH.proofEngine.verify(withSteps([s[0], s[1], Object.assign({}, s[2], { dependsOn: ['s1', 'zz'] })])).join(' / '), /依存先がない/);
  const cyc = [Object.assign({}, s[0], { dependsOn: ['s3'] }), s[1], s[2]];
  assert.match(PH.proofEngine.verify(withSteps(cyc)).join(' / '), /循環参照: s1 → s3 → s1|循環参照/);
  const bad = [s[0], Object.assign({}, s[1], { value: '∠ACD＋90°' }), s[2]];
  assert.match(PH.proofEngine.verify(withSteps(bad)).join(' / '), /成り立たない|右辺が同じではない/);
  const wrongItems = [s[0], s[1], Object.assign({}, s[2], { items: ['∠ACE', '∠ACD'], label: '∠ACE＝∠ACD' })];
  assert.match(PH.proofEngine.verify(withSteps(wrongItems)).join(' / '), /導けない/);
  // 根拠が導いた事実と一致しない
  const p21 = PH.getProblem('p21');
  const ev = p21.evidence.map((e) => (e.fromStep ? Object.assign({}, e, { items: ['∠BAD', '∠CAE'], label: '∠BAD＝∠CAE' }) : e));
  assert.match(PH.proofEngine.verify(Object.assign({}, p21, { evidence: ev })).join(' / '), /一致しない/);
  // 後半のステップの前提が最終結論でない
  const p22 = PH.getProblem('p22');
  const post = Object.assign({}, p22.proofSteps[1], { premise: ['∠MBC', '∠NCB'] });
  assert.ok(PH.proofEngine.verify(Object.assign({}, p22, { proofSteps: [p22.proofSteps[0], post] })).length > 0);
});

// ---- 21-4 両モード ---------------------------------------------------------------------

MULTI.forEach((p) => {
  test(p.id + ': ハンターで、三角形 → 前半のステップ → 根拠 → 合同条件 → 最終結論（→ 後半のステップ）と解いて★★★', () => {
    const g = solveHunter(p);
    assert.equal(g.phase, 'clear');
    assert.equal(g.stars, 3);
    assert.equal(g.misses, 0);
    assert.ok(g.engine.stageDone('pre') && g.engine.stageDone('post'));
  });

  test(p.id + ': ハンターの誤答（理由・式の比較）はミス1回、同じ誤答では増えない', () => {
    const g = new PH.Game(p);
    chooseTriangles(g);
    assert.equal(g.phase, 'step');
    const s = g.currentStep();
    if (s.type === 'compare') throw new Error('最初のステップは理由を選ぶステップ');
    const wrong = g.stepOptions().find((o) => o.id !== 'a');
    g.chooseStepOption(wrong.id);
    assert.equal(g.confirmStep().status, 'wrong');
    assert.equal(g.misses, 1);
    g.chooseStepOption(wrong.id);
    g.confirmStep();
    assert.equal(g.misses, 1);
    // 根拠の段階へ進む前に、ステップの段階では辺・角を選べない
    assert.equal(g.setMode('side'), false);
    assert.equal(g.tap(k(p, p.evidence[0].items[0])).type, 'ignored');
  });

  TYPES.forEach((t) => {
    test(p.id + ': パズル（' + t + '）で、ステップ・根拠・合同条件・最終結論をそろえて完成', () => {
      const z = new PH.Puzzle(p, t);
      assert.ok(z.multi);
      assert.equal(z.rowEv.length, p.evidence.filter((e) => !e.fromStep).length);
      fill(z, z.solution());
      const r = z.check();
      assert.equal(r.status, 'clear', JSON.stringify(r.result && r.result.messages));
      assert.equal(z.stars, 3);
    });
  });

  test(p.id + ': 完成した証明文（推論の順・式番号・導いた事実の番号）', () => {
    const proof = PH.buildProof(p);
    const rows = p.evidence.filter((e) => !e.fromStep);
    assert.deepEqual(proof.lines.map((l) => l.equation), rows.map((e) => e.label));
    const pre = PH.proofEngine.stepsOf(p, 'pre');
    assert.deepEqual(proof.stepLines.map((l) => l.equation), pre.map((s) => s.label));
    // 番号は根拠の行の続き
    assert.equal(proof.stepLines[0].no, ['①', '②', '③', '④', '⑤'][rows.length]);
    // 合同の根拠のまとめは、導いた事実をそのステップの番号で書く
    const nums = p.evidence.map((ev) => (ev.fromStep ? proof.stepLines.find((l) => l.stepId === ev.fromStep).no
      : proof.lines.find((l) => l.evidenceId === ev.id).no));
    assert.equal(proof.summary, nums.join('、') + 'より、');
    assert.equal(proof.conclusion, PH.congruenceText(p));
  });
});

test('完成した証明文の例：p23 は ①AC＝BC ②CE＝CD ③④ 角の式 ⑤ ③、④より ∠ACE＝∠BCD →「①、②、⑤より」', () => {
  const proof = PH.buildProof(PH.getProblem('p23'));
  assert.deepEqual(proof.stepLines.map((l) => l.no + l.reason + l.equation), [
    '③角の和より（△DCEは正三角形）、∠ACE＝∠ACD＋∠DCE＝∠ACD＋60°',
    '④角の和より（△ABCは正三角形）、∠BCD＝∠BCA＋∠ACD＝∠ACD＋60°',
    '⑤③、④より、∠ACE＝∠BCD',
  ]);
  assert.equal(proof.summary, '①、②、⑤より、');
  assert.equal(proof.final.conclusion, 'AE＝BD');
  const p22 = PH.buildProof(PH.getProblem('p22'));
  assert.deepEqual(p22.post, [{ stepId: 's2', reason: '∠DCB＝∠DBCより、2つの角が等しい三角形は二等辺三角形だから、', conclusion: '△DBCは二等辺三角形' }]);
});

test('ハンター：式の比較は、2つの式の右辺（共通部分）を選んでから2つの角を選ぶ', () => {
  const p = PH.getProblem('p23');
  const g = new PH.Game(p);
  chooseTriangles(g);
  solveStep(g);                                         // s1
  solveStep(g);                                         // s2
  const s = g.currentStep();
  assert.equal(s.type, 'compare');
  assert.equal(g.setMode('angle'), false);              // 共通部分を選ぶ前は角を選べない
  g.pickPart('s1', 'target'); g.pickPart('s2', 'value');
  assert.equal(g.commonFound(), false);
  assert.equal(g.cmpPickedBoth(), true);
  g.pickPart('s1', 'value');
  assert.equal(g.commonFound(), true);
  assert.equal(g.mode, 'angle');
  // 等しくない2つの角はミス
  g.tap(k(p, '∠ACE')); g.tap(k(p, '∠ACD'));
  assert.equal(g.confirmStep().status, 'wrong');
  assert.equal(g.misses, 1);
  g.tap(k(p, '∠BCD')); g.tap(k(p, '∠ACE'));          // 左右を入れかえても正解
  const r = g.confirmStep();
  assert.equal(r.status, 'correct');
  assert.equal(r.stageDone, 'pre');
  assert.equal(g.phase, 'collect');
});

test('ハンターのヒント：ステップごとの3段階。最終段階を見ても自動で答えない', () => {
  const p = PH.getProblem('p21');
  const g = new PH.Game(p);
  chooseTriangles(g);
  let h = g.useHint();
  assert.equal(h.targetId, 's1');
  assert.equal(h.text, 'どんな図形の性質が使えるかな？');
  g.useHint();
  h = g.useHint();
  assert.equal(h.text, '「二等辺三角形の底角は等しい」という性質を使おう！');
  assert.equal(g.useHint().isNew, false);
  assert.equal(g.hintsUsed, 3);
  assert.equal(g.phase, 'step');
  assert.equal(g.stepChoice, null);
});

test('パズル：ステップの誤答のメッセージ（理由・同じ式を2回・共通部分・導いた等式を根拠の行に入れた）', () => {
  const p = PH.getProblem('p23');
  // スタンダード：同じ式を2回
  let z = new PH.Puzzle(p, 'build');
  let sol = z.solution();
  fill(z, Object.assign({}, sol, { 'cp:s3': z.cards['cmp:s3'].find((c) => c.same).id }));
  let r = z.check();
  assert.ok(r.result.messages.some((m) => /同じ式を2回選んでも/.test(m.text)));
  assert.equal(z.misses, 1);
  // スタンダード：導ける等式のダミー
  z = new PH.Puzzle(p, 'build');
  fill(z, Object.assign({}, z.solution(), { 'cr:s3': z.cards['cmr:s3'].find((c) => !c.correct).id }));
  r = z.check();
  assert.ok(r.result.messages.some((m) => /左辺どうしが等しい/.test(m.text)));
  // 理由の誤り
  z = new PH.Puzzle(p, 'challenge');
  fill(z, Object.assign({}, z.solution(), { 'st:s1': z.cards['srule:s1'].find((c) => !c.correct).id }));
  r = z.check();
  assert.ok(r.result.messages.some((m) => /どんな角の関係を使って/.test(m.text)));
  // チャレンジ：導ける等式は入力（左右の入れかえ・角の別表記も正解）
  z = new PH.Puzzle(p, 'challenge');
  fill(z, Object.assign({}, z.solution(), { 'cr:s3': '∠DCB=∠ECA' }));
  assert.equal(z.check().status, 'clear');
  // おてがる：共通部分ではない部分
  z = new PH.Puzzle(p, 'fill');
  fill(z, Object.assign({}, z.solution(), { 'cc:s3': z.cards['cmc:s3'].find((c) => !c.correct).id }));
  r = z.check();
  assert.ok(r.result.messages.some((m) => /まったく同じになっている部分/.test(m.text)));
  // 導いた等式を根拠の行に入れた
  z = new PH.Puzzle(p, 'build');
  sol = z.solution();
  const derived = z.cards.eq.find((c) => c.text === '∠ACE＝∠BCD');
  fill(z, Object.assign({}, sol, { e0: derived.id }));
  r = z.check();
  assert.ok(r.result.messages.some((m) => /ステップで導いた等式（⑤）/.test(m.text)));
});

test('パズルのヒント：三角形 → 前半のステップ → 根拠 → 合同条件 → 最終結論 → 後半のステップ', () => {
  const p = PH.getProblem('p22');
  TYPES.forEach((t) => {
    const z = new PH.Puzzle(p, t);
    const sol = z.solution();
    assert.equal(z.useHint().targetId, 'triangleSelection');
    const tri = t === 'build' ? { t1: sol.t1, t2: sol.t2 } : { tri: sol.tri };
    fill(z, tri);
    let h = z.useHint();
    assert.equal(h.targetId, 's1');
    assert.equal(h.slotId, 'st:s1');
    fill(z, Object.assign({}, sol, { 'st:s2': null }));
    h = z.useHint();
    assert.equal(h.targetId, 's2');
    assert.equal(z.placed['st:s2'], undefined);       // 自動では入れない
  });
});

// ---- 段位認定 -------------------------------------------------------------------------

test('段位認定：定理・三段論法のミニ問題（1か所解答・正解は1つ）が出題でき、既存カテゴリの割合を崩さない', () => {
  const th = PH.rankQuestions.all().filter((q) => q.category === 'theorem');
  assert.ok(th.length >= 10);
  const types = new Set(th.map((q) => q.type));
  ['isoscelesAngles', 'theoremReason', 'isoscelesConverse', 'expression', 'compare', 'equilateral60', 'syllogism'].forEach((t) => assert.ok(types.has(t), t));
  th.forEach((q) => assert.equal(q.blanks, 1, q.id));
  assert.equal(PH.rankQuestions.byId('rule-eq60').choice.blanks[0].choices.find((c) => c.id === 'a').text, '60°');
  // 式の比較は記号入力でも答えられる（左右の入れかえ・別表記も正解）
  const cmp = PH.rankQuestions.byId('p23-cmp-s3');
  assert.equal(cmp.input.check('∠BCD=∠ACE'), true);
  assert.equal(cmp.input.check('∠ACE=∠ACD'), false);
  // 出題の割合：定理・三段論法は既存カテゴリのおよそ半分（重み 0.5）
  const cnt = {};
  for (let seed = 1; seed <= 20; seed++) {
    const g = new PH.RankGame({ seed });
    g.start(0);
    for (let i = 0; i < 40; i++) {
      cnt[g.current.q.category] = (cnt[g.current.q.category] || 0) + 1;
      g.pass(i);
      if (g.state !== 'play') break;
    }
  }
  const avg = ['eq', 'reason', 'cond', 'final'].reduce((s, c) => s + (cnt[c] || 0), 0) / 4;
  assert.ok(cnt.theorem > 0 && cnt.theorem < avg * 0.8, JSON.stringify(cnt));
});

// ---- 21-5 回帰 -----------------------------------------------------------------------

test('回帰：p01〜p20 はステップの段階がなく、従来どおりの流れ・証明文・パズルの空欄', () => {
  PH.problems.filter((p) => p.stage <= 6).forEach((p) => {
    const g = new PH.Game(p);
    assert.equal(g.engine, null, p.id);
    assert.equal(g.phase, PH.hasFinalStep(p) ? 'triangle' : 'collect', p.id);
    const proof = PH.buildProof(p);
    assert.deepEqual(proof.stepLines, []);
    assert.deepEqual(proof.post, []);
    assert.equal(proof.lines.length, 3);
    TYPES.forEach((t) => {
      const z = new PH.Puzzle(p, t);
      assert.equal(z.multi, false);
      assert.ok(!z.slots.some((s) => /^(st|cc|cp|cr):/.test(s.id)), p.id + ' ' + t);
    });
  });
});

test('回帰：段位認定の制限時間・時間ペナルティ・21段階・既存のミニ問題の正解は変わらない', () => {
  assert.equal(PH.rankConfig.timeLimitMs, 120000);
  assert.equal(PH.rankConfig.penaltyStepMs, 4000);
  assert.equal(PH.rankConfig.grades.length, 21);
  assert.equal(PH.rankConfig.grades[20].name, '皆伝');
  assert.equal(PH.rankConfig.criteriaVersion, 2);
  const q = (id) => PH.rankQuestions.byId(id);
  assert.equal(q('p01-eq-e3').answerText, 'BD＝BD');
  assert.equal(q('p02-rs-e3').answerText, '対頂角は等しいから');
  assert.equal(q('p12-cond').answerText, '3組の辺がそれぞれ等しい');
  assert.equal(q('p17-fr').answerText, '合同な図形の対応する辺は等しいから');
  assert.match(q('p17-fr').ask, /AC＝BD/);
  // 結論が「二等辺三角形」の問題でも、結論を導く理由は合同から導いた等式で問う
  assert.match(q('p22-fr').ask, /∠DCB＝∠DBC/);
});

test('回帰：Ver.0.6 の保存データを引き継ぎ、STAGE 7 は未クリアで始まる', () => {
  const mem = {
    'proofHunter.v1': JSON.stringify({
      version: 5,
      problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 } },
      puzzleLevels: { easy: { p16: { cleared: true, bestStars: 2, minMisses: 1 } }, standard: {}, challenge: {} },
      rankCertification: { criteriaVersion: 2, best: { rank: 13, rankName: '四段', effectiveScore: 13, correct: 13, maxCombo: 5 }, playCount: 3 },
    }),
  };
  const fake = { getItem: (key) => (key in mem ? mem[key] : null), setItem: (key, v) => { mem[key] = String(v); } };
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  PH.storage._reset();
  try {
    const S = PH.storage;
    assert.equal(S.getProblem('p01').bestStars, 3);
    assert.equal(S.getProblem('p16', 'puzzle:easy').bestStars, 2);
    assert.equal(S.getRank().best.rankName, '四段');
    assert.equal(S.stageStats(7).cleared, 0);
    assert.equal(S.stageStats(7).total, 4);
    S.recordClear('p23', 3, 0, 'puzzle:challenge');
    assert.equal(S.getProblem('p23', 'puzzle:easy').bestStars, 3);          // 上位レベルの★★★の反映
    assert.equal(S.getProblem('p23').cleared, false);                       // ハンターとは独立
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
    PH.storage._reset();
  }
});
