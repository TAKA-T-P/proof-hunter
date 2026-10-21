// 証明ハンター Ver.0.5 のテスト（結論が辺・角の等しさの問題：三角形の選択・頂点の対応・合同から結論を導く）
// 実行: npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/problems.js');
require('../js/geometry.js');
require('../js/validation.js');
require('../js/hints.js');
require('../js/storage.js');
require('../js/game.js');
require('../js/math-keypad.js');
require('../js/puzzle.js');

const PH = globalThis.PH;
const val = PH.validation;
const geo = PH.geometry;
const KP = PH.mathKeypad;
const k = (p, n) => geo.elementKey(p.figure, n);
const NEW = PH.problems.filter((p) => PH.hasFinalStep(p));
const LEGACY = PH.problems.filter((p) => !PH.hasFinalStep(p));
const TYPES = ['fill', 'build', 'challenge'];

// 対応を保ったまま頂点を同時に並べ替えた表記（6通り）と、左右を交換した表記（さらに6通り）
function equivalentForms(t1, t2) {
  const orders = [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]];
  const out = [];
  orders.forEach((o) => {
    const a = o.map((i) => t1[i]), b = o.map((i) => t2[i]);
    out.push([a, b], [b, a]);
  });
  return out;
}

// ハンター：三角形を選んで頂点の対応を押す（t1 の頂点はアルファベット順に並ぶ）
function chooseTriangles(g, t1, t2) {
  g.clearTriangles();
  g.tapTriangle(t1);
  g.tapTriangle(t2);
  const first = g.triSel[0];
  const from = first.join('') === t1.slice().sort().join('') ? [t1, t2] : [t2, t1];
  first.forEach((v) => g.pressVertex(from[1][from[0].indexOf(v)]));
  return g.confirmTriangles();
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

function answerFinal(g, items, reason) {
  const p = g.problem;
  g.setMode(geo.isAngleName(items[0]) ? 'angle' : 'side');
  g.clearSelection();
  g.tap(k(p, items[0]));
  g.tap(k(p, items[1]));
  g.selectReason(reason);
  return g.confirmFinal();
}

// ハンター：STEP 1〜3 を正しく進めて、合同が成立した状態にする
function toFinal(p) {
  const g = new PH.Game(p);
  assert.equal(chooseTriangles(g, p.triangles[0], p.triangles[1]).status, 'ok');
  p.evidence.forEach((ev) => assert.equal(answer(g, ev, ev.reason).status, 'correct'));
  g.selectCondition(p.congruence);
  assert.equal(g.confirmCondition().ok, true);
  return g;
}

// パズル：配置をまとめて入れる（チャレンジの等式・三角形は文字列で入力）
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

// ---- 問題データ ---------------------------------------------------------------

test('20問・6ステージ。STAGE 6 は p16〜p20 で、結論が辺・角の等しさ', () => {
  assert.equal(PH.problems.length, 20);
  const st6 = PH.getStage(6);
  assert.equal(st6.title, '合同から結論を導け！');
  assert.deepEqual(PH.stageProblems(6).map((p) => p.id), ['p16', 'p17', 'p18', 'p19', 'p20']);
  assert.deepEqual(NEW.map((p) => p.id), ['p16', 'p17', 'p18', 'p19', 'p20']);
  assert.deepEqual(NEW.map((p) => PH.conclusionType(p)), ['equalAngle', 'equalSide', 'equalSide', 'equalSide', 'equalAngle']);
  // 既存の15問は三角形の合同のまま（conclusionType がなければ triangleCongruence）
  assert.equal(LEGACY.length, 15);
  LEGACY.forEach((p) => {
    assert.equal(PH.conclusionType(p), 'triangleCongruence');
    assert.equal(p.finalStep, undefined);
    assert.equal(p.conclusion, PH.congruenceText(p));
  });
});

test('新しい5問の数学的な検証：最終結論は途中の合同の対応する辺・角で、根拠や仮定にふくまれない', () => {
  assert.deepEqual(val.verifyAll(PH.problems, PH.STAGES), []);
  const expect = {
    p16: ['△ABD≡△CBD', 'SSS', '∠BAD＝∠BCD', 'angle'],
    p17: ['△AOC≡△BOD', 'SAS', 'AC＝BD', 'side'],
    p18: ['△ABO≡△CDO', 'ASA', 'AO＝CO', 'side'],
    p19: ['△ADC≡△CBA', 'SAS', 'DC＝BA', 'side'],
    p20: ['△ABC≡△CDA', 'ASA', '∠ABC＝∠CDA', 'angle'],
  };
  NEW.forEach((p) => {
    const e = expect[p.id];
    assert.equal(PH.congruenceText(p), e[0], p.id);
    assert.equal(p.congruence, e[1], p.id);
    assert.equal(val.deriveCondition(p, p.evidence), e[1], p.id);
    assert.equal(p.conclusion, e[2], p.id);
    assert.equal(p.finalStep.relationType, e[3], p.id);
    const keys = p.finalStep.items.map((n) => k(p, n));
    const part = val.classifyPair(p, keys);
    assert.ok(part, p.id + ' 対応する辺・角');
    assert.equal(part.kind, e[3], p.id);
    assert.equal(val.correspondenceOrder(p, p.finalStep.items), 'ok', p.id);
    assert.equal(val.matchEvidence(p, keys), null, p.id + ' 根拠にふくまれない');
    assert.ok(!p.given.includes(p.conclusion), p.id + ' 仮定にふくまれない');
    // 図の上でも等しい（座標で測る）
    const m = p.finalStep.items.map((n) => val.measure(p.figure, n).value);
    assert.ok(Math.abs(m[0] - m[1]) < 0.5, p.id + ' ' + m.join(' / '));
    // 証明する三角形は図の上の三角形
    p.triangles.forEach((t) => assert.ok(geo.isFigureTriangle(p.figure, t), p.id + ' △' + t.join('')));
  });
});

test('問題データ検証は、ダミーや最終結論の誤りを見つける', () => {
  const base = PH.getProblem('p17');
  const broken = (patch) => Object.assign({}, base, patch);
  const errs = (p) => val.verifyProblem(p).join(' / ');
  assert.match(errs(broken({ conclusionType: 'parallel' })), /conclusionType が無効/);
  assert.match(errs(broken({ finalStep: Object.assign({}, base.finalStep, { reason: 'given' }) })), /finalStep.reason/);
  // 最終結論が根拠に混ざっている（仮定そのもの）
  assert.match(errs(broken({ conclusion: 'AO＝BO', finalStep: Object.assign({}, base.finalStep, { items: ['AO', 'BO'], label: 'AO＝BO' }) })), /根拠/);
  // 対応しない辺を結論にした
  assert.match(errs(broken({ conclusion: 'AC＝CO', finalStep: Object.assign({}, base.finalStep, { items: ['AC', 'CO'], label: 'AC＝CO' }) })), /対応する辺・角になっていない/);
  // 三角形のダミーが正解になっている
  assert.match(errs(broken({ puzzle: { type: 'build', distractors: Object.assign({}, base.puzzle.distractors, { triangles: ['BOD/AOC', 'AOC/OBD'] }) } })), /三角形の組のダミーが不適切/);
  // 最終結論のダミーが結論と同じ
  assert.match(errs(broken({ puzzle: { type: 'build', distractors: Object.assign({}, base.puzzle.distractors, { finals: ['BD＝AC', 'AC＝CO'] }) } })), /最終結論のダミーが結論と同じ/);
  // ヒントの不足
  assert.match(errs(broken({ hints: Object.assign({}, base.hints, { finalStep: undefined }) })), /finalStep のヒント/);
});

// ---- 既存問題の回帰 ---------------------------------------------------------------

test('既存の15問：三角形選択・最終結論のステップは追加されず、従来どおり合同条件でクリア', () => {
  LEGACY.forEach((p) => {
    const g = new PH.Game(p);
    assert.equal(g.phase, 'collect', p.id);
    assert.equal(g.mode, 'side', p.id);
    assert.equal(g.setMode('tri'), false, p.id);
    p.evidence.forEach((ev) => assert.equal(answer(g, ev, ev.reason).status, 'correct', p.id));
    g.selectCondition(p.congruence);
    const r = g.confirmCondition();
    assert.equal(r.ok, true);
    assert.equal(r.final, undefined);
    assert.equal(g.phase, 'clear', p.id);
    const proof = PH.buildProof(p);
    assert.equal(proof.final, null);
    assert.equal(proof.conclusion, p.conclusion);
    // 理由の選択肢に「合同な図形の対応する〜」は出ない
    assert.ok(!g.availableReasons().some((r2) => PH.REASONS[r2].finalOnly), p.id);
  });
});

test('既存の15問のパズル：三角形・最終結論の空欄はなく、3レベルとも従来の空欄のまま', () => {
  LEGACY.forEach((p) => {
    TYPES.forEach((t) => {
      const z = new PH.Puzzle(p, t);
      assert.equal(z.hasFinal, false);
      assert.ok(!z.slots.some((s) => ['tri', 't1', 't2', 'fr', 'fe'].includes(s.id)), p.id + ' ' + t);
      assert.equal(z.slots.length, t === 'fill' ? 4 : 7, p.id + ' ' + t);
      fill(z, z.solution());
      assert.equal(z.check().status, 'clear', p.id + ' ' + t);
    });
  });
});

// ---- 三角形の選択と頂点の対応 ----------------------------------------------------------

test('三角形の対応：同時の並べ替え・左右の交換は正解、対応がちがえば order', () => {
  NEW.forEach((p) => {
    const [t1, t2] = p.triangles;
    const forms = equivalentForms(t1, t2);
    const ok = new Set();
    forms.forEach(([a, b]) => {
      assert.equal(val.checkTriangles(p, a, b).status, 'ok', p.id + ' △' + a.join('') + 'と△' + b.join(''));
      ok.add(a.join('') + '/' + b.join(''));
    });
    // 2つ目の頂点の並びを変えた（対応がちがう）ものはすべて order
    const perms = [[0, 1, 2], [0, 2, 1], [1, 0, 2], [1, 2, 0], [2, 0, 1], [2, 1, 0]];
    perms.forEach((o) => {
      const b = o.map((i) => t2[i]);
      if (ok.has(t1.join('') + '/' + b.join(''))) return;
      assert.equal(val.checkTriangles(p, t1, b).status, 'order', p.id + ' △' + t1.join('') + 'と△' + b.join(''));
    });
  });
  // 例：△ABC≡△DEF と同じ対応
  const p20 = PH.getProblem('p20');      // △ABC≡△CDA
  [['BCA', 'DAC'], ['CAB', 'ACD'], ['ACB', 'CAD'], ['CDA', 'ABC']].forEach(([a, b]) => {
    assert.equal(val.checkTriangles(p20, a.split(''), b.split('')).ok, true, a + '/' + b);
  });
  assert.equal(val.correspondenceKey(['A', 'B', 'C'], ['D', 'E', 'F']), val.correspondenceKey(['E', 'F', 'D'], ['B', 'C', 'A']));
});

test('三角形の選択：図にない三角形・一直線上の3点・同じ三角形・未完成は正解にしない', () => {
  const p17 = PH.getProblem('p17');      // 線分AB・CDが O で交わる（A・O・B は一直線上）
  assert.equal(geo.isFigureTriangle(p17.figure, ['A', 'O', 'B']), false);   // 一直線上
  assert.equal(geo.isFigureTriangle(p17.figure, ['A', 'B', 'C']), false);   // 辺BCがかかれていない
  assert.equal(geo.isFigureTriangle(p17.figure, ['A', 'C', 'O']), true);
  assert.deepEqual(geo.figureTriangles(p17.figure).map((t) => t.join('')), ['ACO', 'BDO']);
  assert.equal(val.checkTriangles(p17, ['A', 'O', 'B'], ['B', 'O', 'D']).status, 'invalid');
  assert.equal(val.checkTriangles(p17, ['A', 'B', 'C'], ['B', 'O', 'D']).status, 'invalid');
  assert.equal(val.checkTriangles(p17, ['A', 'O', 'C'], ['C', 'O', 'A']).status, 'same');
  assert.equal(val.checkTriangles(p17, ['A', 'O', 'C'], null).status, 'incomplete');
  assert.equal(val.checkTriangles(p17, ['A', 'O'], ['B', 'O', 'D']).status, 'incomplete');
  // 三角形の組そのものがちがう（p16 に図の三角形が2つしかないので、架空の問題で確かめる）
  const p12 = PH.getProblem('p12');      // 図に △ABC・△ABM・△ACM
  assert.equal(val.checkTriangles(p12, ['A', 'B', 'C'], ['A', 'C', 'M']).status, 'wrong');
  // タップした点をふくむ三角形
  const pts = p17.figure.points;
  const inside = { x: (pts.A.x + pts.O.x + pts.C.x) / 3, y: (pts.A.y + pts.O.y + pts.C.y) / 3 };
  assert.deepEqual(geo.triangleCandidates(p17.figure, inside), [['A', 'C', 'O']]);
  // 重なった三角形（p14 の △ABE と △ACD）はどちらも候補になる
  const p14 = PH.getProblem('p14');
  const q = p14.figure.points;
  const near = { x: (q.A.x * 2 + q.D.x + q.E.x) / 4, y: (q.A.y * 2 + q.D.y + q.E.y) / 4 };
  assert.equal(geo.triangleCandidates(p14.figure, near).length, 2);
});

test('ハンター：三角形の選択（タップ・解除・入れかえ・頂点の対応・ミスの数え方）', () => {
  const p = PH.getProblem('p16');        // △ABD≡△CBD
  const g = new PH.Game(p);
  assert.equal(g.phase, 'triangle');
  assert.equal(g.mode, 'tri');
  // 三角形を選ぶ段階では辺選択・角選択はできず、根拠も登録できない
  assert.equal(g.setMode('side'), false);
  assert.equal(g.tap(k(p, 'AB')).type, 'ignored');
  assert.equal(g.canConfirm(), false);
  // 印つけはできる
  assert.equal(g.setMode('mark'), true);
  assert.equal(g.tap(k(p, 'AB')).type, 'mark');
  g.setMode('answer');
  assert.equal(g.mode, 'tri');

  assert.equal(g.tapTriangle(['A', 'B', 'D']).type, 'select');
  assert.equal(g.tapTriangle(['A', 'B', 'D']).type, 'deselect');       // もう一度で解除
  g.tapTriangle(['A', 'B', 'D']);
  g.tapTriangle(['B', 'C', 'D']);
  assert.deepEqual(g.triSel.map((t) => t.join('')), ['ABD', 'BCD']);
  assert.equal(g.tapTriangle(['A', 'B', 'C']).type, 'ignored');        // 図にない三角形
  assert.equal(g.canConfirmTriangles(), false);
  // 対応：A→C、B→D（誤り）、D→B
  assert.equal(g.pressVertex('C'), true);
  assert.equal(g.pressVertex('C'), false);                             // 同じ頂点は2回使えない
  assert.equal(g.pressVertex('A'), false);                             // 2つ目の三角形の頂点ではない
  g.pressVertex('D'); g.pressVertex('B');
  assert.equal(g.misses, 0);                                           // 選択途中の操作はミスにしない
  let r = g.confirmTriangles();
  assert.equal(r.status, 'order');
  assert.equal(g.misses, 1);
  r = g.confirmTriangles();                                            // 同じ誤答のまま再判定してもミスは増えない
  assert.equal(r.miss, false);
  assert.equal(g.misses, 1);
  assert.equal(g.phase, 'triangle');
  // 1つもどして直す
  g.backVertex(); g.backVertex();
  g.pressVertex('B'); g.pressVertex('D');
  r = g.confirmTriangles();
  assert.equal(r.status, 'ok');
  assert.equal(g.phase, 'collect');
  assert.equal(g.mode, 'side');
  // 2つ目を先に選んでも（左右の交換）正解
  const g2 = new PH.Game(p);
  assert.equal(chooseTriangles(g2, ['C', 'B', 'D'], ['A', 'B', 'D']).status, 'ok');
  assert.equal(g2.misses, 0);
});

// ---- 最終結論 -------------------------------------------------------------------

test('最終結論の判定：対応する辺・角、理由、結論とちがう等式、合同成立前', () => {
  const p17 = PH.getProblem('p17');      // AC＝BD（辺）
  const p16 = PH.getProblem('p16');      // ∠BAD＝∠BCD（角）
  const ks = (p, a, b) => [k(p, a), k(p, b)];
  assert.equal(val.checkFinal(p17, ks(p17, 'AC', 'BD'), 'correspondingSides', true).status, 'correct');
  assert.equal(val.checkFinal(p17, ks(p17, 'DB', 'CA'), 'correspondingSides', true).status, 'correct');   // 左右・向きは同一視
  assert.equal(val.checkFinal(p16, ks(p16, '∠BAD', '∠BCD'), 'correspondingAngles', true).status, 'correct');
  assert.equal(val.checkFinal(p16, ks(p16, '∠DAB', '∠DCB'), 'correspondingAngles', true).status, 'correct');
  // 正しい等式＋誤った理由
  assert.equal(val.checkFinal(p17, ks(p17, 'AC', 'BD'), 'correspondingAngles', true).status, 'wrong-reason');
  assert.equal(val.checkFinal(p17, ks(p17, 'AC', 'BD'), 'given', true).status, 'wrong-reason');
  assert.equal(val.checkFinal(p16, ks(p16, '∠BAD', '∠BCD'), 'correspondingSides', true).status, 'wrong-reason');
  // 問題の結論とはちがう等式（正しいが結論ではない／根拠／等しくない）
  const notGoal = val.checkFinal(p17, ks(p17, '∠OAC', '∠OBD'), 'correspondingAngles', true);
  assert.equal(notGoal.status, 'not-goal');
  assert.equal(notGoal.miss, false);
  assert.equal(val.checkFinal(p17, ks(p17, 'AO', 'BO'), 'given', true).status, 'evidence');
  assert.equal(val.checkFinal(p17, ks(p17, 'AC', 'CO'), 'correspondingSides', true).status, 'wrong-equation');
  // 合同成立前は結論を使えない
  assert.equal(val.checkFinal(p17, ks(p17, 'AC', 'BD'), 'correspondingSides', false).status, 'not-proved');
  // 未回答
  assert.equal(val.checkFinal(p17, [k(p17, 'AC')], 'correspondingSides', true).status, 'incomplete');
});

test('根拠を集める段階では、最終結論も「対応する辺・角」の理由も使えない', () => {
  NEW.forEach((p) => {
    const keys = p.finalStep.items.map((n) => k(p, n));
    Object.keys(PH.REASONS).forEach((r) => {
      assert.equal(val.checkEvidence(p, keys, r, []).status, 'from-conclusion', p.id + ' ' + r);
    });
    const g = new PH.Game(p);
    chooseTriangles(g, p.triangles[0], p.triangles[1]);
    assert.ok(!g.availableReasons().some((r) => PH.REASONS[r].finalOnly), p.id);
    // 結論の2つを選んで確定すると「結論から導かれる関係」でミス
    g.setMode(geo.isAngleName(p.finalStep.items[0]) ? 'angle' : 'side');
    g.tap(keys[0]); g.tap(keys[1]);
    g.selectReason('given');
    assert.equal(g.confirmEvidence().status, 'from-conclusion');
    assert.equal(g.misses, 1);
    // 最終結論の理由は、根拠の段階では選べない
    g.tap(keys[0]); g.tap(keys[1]);
    assert.equal(g.selectReason(PH.finalReasonFor(p)), false);
    assert.equal(g.confirmFinal().status, 'incomplete');
  });
});

NEW.forEach((p) => {
  test(p.id + ': ハンターで三角形→根拠（逆順）→合同条件→最終結論の順に証明でき、合同成立だけではクリアにならない', () => {
    const g = new PH.Game(p);
    assert.equal(g.phase, 'triangle');
    // 左右を交換し、頂点も並べ替えた表記で選ぶ
    const [t1, t2] = p.triangles;
    assert.equal(chooseTriangles(g, [t2[1], t2[2], t2[0]], [t1[1], t1[2], t1[0]]).status, 'ok');
    p.evidence.slice().reverse().forEach((ev) => assert.equal(answer(g, ev, ev.reason).status, 'correct', ev.label));
    assert.equal(g.phase, 'congruence');
    PH.CONDITION_ORDER.filter((c) => c !== p.congruence).forEach((c) => {
      g.selectCondition(c);
      assert.equal(g.confirmCondition().ok, false, c);
    });
    g.selectCondition(p.congruence);
    const r = g.confirmCondition();
    assert.equal(r.ok, true);
    assert.equal(r.final, true);
    assert.equal(g.phase, 'final');                          // 合同成立。まだクリアではない
    assert.equal(g.stars, 0);
    assert.equal(g.mode, p.finalStep.relationType === 'angle' ? 'angle' : 'side');
    // 理由の選択肢に「合同な図形の対応する辺／角」がある
    g.tap(k(p, p.finalStep.items[0])); g.tap(k(p, p.finalStep.items[1]));
    assert.ok(g.availableReasons().includes('correspondingSides'));
    assert.ok(g.availableReasons().includes('correspondingAngles'));
    // 正しい等式＋誤った理由は不正解（等式は残る）
    const wrongReason = p.finalStep.relationType === 'angle' ? 'correspondingSides' : 'correspondingAngles';
    g.selectReason(wrongReason);
    assert.equal(g.confirmFinal().status, 'wrong-reason');
    assert.equal(g.selection.length, 2);
    assert.equal(g.phase, 'final');
    g.selectReason(PH.finalReasonFor(p));
    assert.equal(g.confirmFinal().status, 'correct');
    assert.equal(g.phase, 'clear');
    assert.equal(g.misses, PH.CONDITION_ORDER.length - 1 + 1);
    assert.equal(g.stars, PH.calcStars(g.misses, g.hintsUsed));
  });

  test(p.id + ': ハンターでミス・ヒントなしなら★★★', () => {
    const g = toFinal(p);
    assert.equal(answerFinal(g, p.finalStep.items, PH.finalReasonFor(p)).status, 'correct');
    assert.equal(g.stars, 3);
  });

  test(p.id + ': 完成した証明文（合同は途中の結果、最後に対応する辺・角から結論）', () => {
    const proof = PH.buildProof(p);
    assert.equal(proof.intro, '△' + p.triangles[0].join('') + 'と△' + p.triangles[1].join('') + 'において');
    assert.deepEqual(proof.lines.map((l) => l.equation), p.evidence.map((e) => e.label));
    assert.equal(proof.summary, '①、②、③より、');
    assert.equal(proof.condition, PH.CONDITIONS[p.congruence].label);
    assert.equal(proof.conclusion, PH.congruenceText(p));
    assert.equal(proof.final.lead, 'したがって、');
    assert.equal(proof.final.reason, p.finalStep.relationType === 'angle' ? '合同な図形の対応する角は等しいから' : '合同な図形の対応する辺は等しいから');
    assert.equal(proof.final.conclusion, p.conclusion);
  });

  TYPES.forEach((t) => {
    test(p.id + ': パズル（' + t + '）で三角形・根拠・合同条件・最終結論を答えて完成できる', () => {
      const z = new PH.Puzzle(p, t);
      assert.equal(z.hasFinal, true);
      const ids = z.slots.map((s) => s.id);
      if (t === 'build') assert.deepEqual(ids.slice(0, 2), ['t1', 't2']);
      else assert.equal(ids[0], 'tri');
      assert.equal(ids[ids.length - 1], 'fe');
      if (t !== 'fill') assert.equal(ids[ids.length - 2], 'fr');
      assert.equal(z.active, ids[0]);
      const sol = z.solution();
      // 最終結論だけ空のままでは答え合わせできない
      fill(z, Object.assign({}, sol, { fe: null }));
      assert.equal(z.check().status, 'incomplete');
      fill(z, { fe: sol.fe });
      const r = z.check();
      assert.equal(r.status, 'clear', JSON.stringify(r.result && r.result.messages));
      assert.equal(z.stars, 3);
    });
  });
});

// ---- 証明パズル -----------------------------------------------------------------

test('パズル（おてがる）：三角形の組は3択。対応ちがいはミス1回、同じ誤答では増えない', () => {
  NEW.forEach((p) => {
    const z = new PH.Puzzle(p, 'fill');
    assert.equal(z.cards.tripair.length, 3, p.id);
    assert.equal(z.cards.tripair.filter((c) => val.checkTriangles(p, c.t1, c.t2).ok).length, 1, p.id);
    assert.equal(z.cards.final.length, 3, p.id);
    assert.equal(z.cards.final.filter((c) => val.finalEquationStatus(p, c.keys) === 'goal').length, 1, p.id);
    // おてがるの最終結論の理由は表示済み
    assert.equal(z.slot('fe').fixed.text, PH.REASONS[PH.finalReasonFor(p)].proof);
    const sol = z.solution();
    const wrong = z.cards.tripair.find((c) => c.id !== sol.tri);
    fill(z, Object.assign({}, sol, { tri: wrong.id }));
    let r = z.check();
    assert.equal(r.status, 'wrong');
    assert.equal(r.result.slotStatus.tri, 'ng');
    assert.equal(r.result.messages[0].text, '三角形は見つけられたね！ 頂点の対応順を確認しよう！');
    assert.equal(z.misses, 1);
    z.check();
    assert.equal(z.misses, 1);
    fill(z, { tri: sol.tri });
    assert.equal(z.check().status, 'clear');
    assert.equal(z.stars, 2);
  });
});

test('パズル（スタンダード）：1つ目の三角形と、対応する頂点の順に並んだ2つ目の三角形を選ぶ', () => {
  const p = PH.getProblem('p19');        // △ADC≡△CBA
  const z = new PH.Puzzle(p, 'build');
  assert.deepEqual(z.cards.tri1.map((c) => c.text), ['△ABC', '△ACD']);
  z.selectSlot('t2');
  assert.equal(z.cardsForActive().length, 12);                 // 1つ目が未選択なら全部
  const sol = z.solution();
  fill(z, { t1: sol.t1 });
  z.selectSlot('t2');
  const t1 = z.cardIn('t1');
  assert.equal(t1.text, '△ACD');
  assert.equal(z.cardsForActive().length, 6);                  // 同じ三角形の並べかえは出さない
  assert.ok(z.cardsForActive().every((c) => c.set === 'ABC'));
  assert.equal(z.cardById[sol.t2].text, '△CAB');               // A↔C、C↔A、D↔B
  // 対応ちがいの並び → t1 は正しく、t2 が赤
  const wrong = z.cardsForActive().find((c) => c.id !== sol.t2);
  fill(z, Object.assign({}, sol, { t2: wrong.id }));
  const r = z.check();
  assert.equal(r.result.slotStatus.t1, 'ok');
  assert.equal(r.result.slotStatus.t2, 'ng');
  assert.equal(r.result.messages[0].label, '三角形');
  assert.equal(z.misses, 1);
  // カードを変えて直す
  fill(z, { t2: sol.t2 });
  assert.equal(z.check().status, 'clear');
});

test('パズル（スタンダード）：最終結論の理由とカードの判定', () => {
  const p = PH.getProblem('p17');        // AC＝BD
  const z = new PH.Puzzle(p, 'build');
  const sol = z.solution();
  const angleReason = z.cards.freason.find((c) => c.reason === 'correspondingAngles');
  const notGoal = z.cards.final.find((c) => c.text === '∠OAC＝∠OBD');
  fill(z, Object.assign({}, sol, { fr: angleReason.id, fe: notGoal.id }));
  const r = z.check();
  assert.equal(r.status, 'wrong');
  assert.equal(r.result.slotStatus.fr, 'ng');
  assert.equal(r.result.slotStatus.fe, 'ng');
  const texts = r.result.messages.map((m) => m.text);
  assert.ok(texts.includes('合同な図形の性質を使おう。辺と角のどちらの等しさかな？'));
  assert.ok(texts.includes('正しい関係だけれど、問題で求められている結論ではないよ。結論をもう一度確認しよう！'));
  assert.equal(z.misses, 2);
  // 等しくないカード
  fill(z, { fr: sol.fr, fe: z.cards.final.find((c) => c.text === 'AC＝CO').id });
  assert.ok(z.check().result.messages.some((m) => m.text === 'その2つは、合同な三角形で対応しているかな？ 結論をもう一度確認しよう！'));
  fill(z, { fe: sol.fe });
  assert.equal(z.check().status, 'clear');
});

test('パズル（チャレンジ）：三角形をキーパッドで入力し、最終結論の対応順も確かめる', () => {
  const p = PH.getProblem('p17');        // △AOC≡△BOD、AC＝BD
  const z = new PH.Puzzle(p, 'challenge');
  assert.deepEqual(z.inputKinds('tri'), ['tri']);
  assert.deepEqual(z.inputKinds('fe'), ['seg', 'ang']);
  assert.equal(z.inputKinds('fr'), null);
  // 三角形の欄に等式・図にない三角形は入らない。等式の欄に三角形は入らない
  z.selectSlot('tri');
  assert.equal(z.setInput('AC=BD'), false);
  assert.equal(z.setInput('△ABC/△BOD'), false);
  assert.equal(z.setInput('△AOB/△COD'), false);              // 一直線上の3点
  assert.equal(z.setInput('△AOC/△COA'), false);              // 同じ三角形
  z.selectSlot('fe');
  assert.equal(z.setInput('△AOC/△BOD'), false);
  // 入力の表記ゆれ（小文字・「と」・△の省略）
  z.selectSlot('tri');
  assert.equal(z.setInput('aoc と bod'), true);
  assert.equal(z.inputs.tri, '△AOC/△BOD');
  assert.equal(z.cardIn('tri').text, '△AOCと△BOD');
  const sol = z.solution();
  // 最終結論：対応順が合っていない書き方（CA＝BD）は正解にしないが、ミスにも数えない
  fill(z, Object.assign({}, sol, { tri: '△OCA/△ODB', fe: 'CA=BD' }));
  let r = z.check();
  assert.equal(r.status, 'wrong');
  assert.equal(r.result.slotStatus.tri, 'ok');                 // 同時に並べ替えた表記は正解
  assert.equal(r.result.slotStatus.fe, 'ng');
  assert.match(r.result.messages[0].text, /^対応順が合っていないよ/);
  assert.equal(z.misses, 0);
  fill(z, { fe: 'BD=AC' });                                    // 左右の入れかえは対応どおり
  r = z.check();
  assert.equal(r.status, 'clear');
  assert.equal(z.stars, 3);
  // 三角形の対応ちがいはミス
  const z2 = new PH.Puzzle(p, 'challenge');
  fill(z2, Object.assign({}, z2.solution(), { tri: '△AOC/△DOB' }));
  r = z2.check();
  assert.equal(r.result.slotStatus.tri, 'ng');
  assert.equal(r.result.messages[0].text, '三角形は見つけられたね！ 頂点の対応順を確認しよう！');
  assert.equal(z2.misses, 1);
});

test('パズル：答え合わせの文で、STEP 1 の答え（証明する三角形）を明かさない', () => {
  NEW.forEach((p) => {
    TYPES.forEach((t) => {
      const z = new PH.Puzzle(p, t);
      const sol = z.solution();
      // 結論を根拠に使う誤り
      const fe = p.finalStep.items;
      const bad = Object.assign({}, sol);
      if (t === 'challenge') bad.e0 = fe.join('=');
      else if (t === 'build') bad.e0 = z.cards.eq.find((c) => c.text === p.finalStep.label).id;
      else {
        const card = z.cards.eq.find((c) => c.text === p.finalStep.label);
        bad.s0 = card.id;
      }
      fill(z, bad);
      const r = z.check();
      r.result.messages.forEach((m) => assert.ok(!m.text.includes(PH.congruenceText(p)), p.id + ' ' + t + ' ' + m.text));
    });
  });
});

test('パズルのヒント：三角形 → 根拠 → 合同条件 → 最終結論の順。最終段階でも答えは入れない', () => {
  const p = PH.getProblem('p18');
  TYPES.forEach((t) => {
    const z = new PH.Puzzle(p, t);
    let h = z.useHint();
    assert.equal(h.targetId, 'triangleSelection');
    assert.equal(h.slotId, z.slots[0].id);
    z.useHint(); h = z.useHint();
    assert.equal(h.level, 3);
    assert.match(h.text, /△ABOと△CDO/);
    assert.equal(z.useHint().isNew, false);                    // 最終段階のくり返しでは増えない
    assert.equal(z.hintsUsed, 3);
    assert.equal(z.emptyCount(), z.slots.length);              // 自動で入力しない
    // 三角形・根拠・合同条件を入れると、最後は最終結論のヒント
    const sol = z.solution();
    fill(z, Object.assign({}, sol, { fr: null, fe: null }));
    h = z.useHint();
    assert.equal(h.targetId, 'finalStep');
    assert.equal(h.slotId, t === 'fill' ? 'fe' : 'fr');
    assert.equal(h.focus.length, 0);                           // 1段階目は考え方
    h = z.useHint();
    assert.equal(h.focus.length, 2);                           // 2段階目は結論の辺を光らせる
    h = z.useHint();
    assert.match(h.text, /合同な図形の対応する辺は等しい/);
    assert.equal(z.placed.fe, undefined);
    fill(z, { fr: sol.fr, fe: sol.fe });
    assert.equal(z.check().status, 'clear');
    assert.equal(z.stars, 1);                                  // ヒント6回
  });
});

test('ハンターのヒント：三角形を探すヒント → 根拠 → 合同条件 → 最終結論', () => {
  const p = PH.getProblem('p16');
  const g = new PH.Game(p);
  let h = g.useHint();
  assert.equal(h.targetId, 'triangleSelection');
  assert.equal(h.focus.length, 0);
  h = g.useHint();
  assert.deepEqual(h.focus, p.finalStep.items.map((n) => k(p, n)));
  assert.equal(g.phase, 'triangle');                           // 自動では確定しない
  chooseTriangles(g, p.triangles[0], p.triangles[1]);
  assert.equal(g.useHint().targetId, 'e1');
  p.evidence.forEach((ev) => answer(g, ev, ev.reason));
  assert.equal(g.useHint().targetId, 'congruence');
  g.selectCondition(p.congruence);
  g.confirmCondition();
  h = g.useHint();
  assert.equal(h.targetId, 'finalStep');
  assert.equal(g.hintsUsed, 5);
  answerFinal(g, p.finalStep.items, PH.finalReasonFor(p));
  assert.equal(g.stars, 1);
});

// ---- 数学キーパッド：三角形の入力 ----------------------------------------------------

test('キーパッド：三角形の入力（△□□□と△□□□）。図にない三角形・同じ三角形は決定できない', () => {
  const p = PH.getProblem('p17');
  const isTri = (t) => geo.isFigureTriangle(p.figure, t);
  const kp = KP.create(KP.lettersOf(p.figure), { kinds: ['tri'], isTriangle: isTri });
  assert.equal(kp.kind, 'tri');                                // 種類が1つなら最初から選ばれている
  assert.equal(kp.setKind('seg'), false);
  assert.equal(kp.display(), '△＿＿＿と△＿＿＿');
  ['A', 'O'].forEach((c) => kp.press(c));
  assert.equal(kp.press('A'), false);                          // 同じ三角形の中で同じ文字は使えない
  kp.press('C');
  assert.equal(kp.display(), '△AOCと△＿＿＿');                // 1つ目が終わると自動で2つ目へ
  ['B', 'O'].forEach((c) => kp.press(c));
  assert.equal(kp.complete(), false);
  kp.press('D');
  assert.equal(kp.complete(), true);
  assert.equal(kp.value(), '△AOC/△BOD');
  assert.equal(KP.pretty(kp.value()), '△AOCと△BOD');
  // 図にない三角形
  kp.backspace(); kp.press('A');
  assert.equal(kp.complete(), false);
  assert.match(kp.problem(), /△BOA は図の中の三角形ではない/);
  assert.ok(KP.render(kp).includes('kp-warn'));
  assert.ok(KP.render(kp).includes('data-kp="decide" disabled'));
  // 同じ三角形
  kp.clear();
  'AOCCAO'.split('').forEach((c) => kp.press(c));
  assert.match(kp.problem(), /同じ三角形/);
  // 種類のボタンは出さない
  assert.ok(!KP.render(kp).includes('data-kp="kind:'));
  // 文字列の検証
  assert.equal(KP.parse('△ABC/△DEF').kind, 'tri');
  assert.equal(KP.parse('abc と def').value, '△ABC/△DEF');
  assert.equal(KP.parse('ABC,DEF').value, '△ABC/△DEF');
  assert.equal(KP.parse('ABC=DEF'), null);                     // ＝は等式と区別する
  assert.equal(KP.parse('ABC/CBA'), null);                     // 同じ三角形
  assert.equal(KP.parse('AAB/CDE'), null);
  // 等式の欄のキーパッドは従来どおり
  const eq = KP.create(['A', 'B', 'C', 'D']);
  assert.equal(eq.kind, null);
  assert.equal(eq.load('△ABC/△ABD'), false);
});

// ---- 保存 -----------------------------------------------------------------------

test('保存：Ver.0.4 の記録を保ち、新しい問題は未クリアで始まり、3レベル・ハンターの記録が独立する', () => {
  const v04 = JSON.stringify({
    version: 4,
    problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 } },
    puzzleProblems: {},
    puzzleLevels: { easy: { p02: { cleared: true, bestStars: 2, minMisses: 1 } }, standard: {}, challenge: { p03: { cleared: true, bestStars: 1, minMisses: 4 } } },
    puzzleLevel: 'standard',
    puzzleMigrated: true,
  });
  withFakeStorage(v04, () => {
    const S = PH.storage;
    assert.equal(S.getProblem('p01').bestStars, 3);
    assert.equal(S.getProblem('p02', 'puzzle:easy').bestStars, 2);
    assert.equal(S.getProblem('p03', 'puzzle:challenge').bestStars, 1);
    assert.equal(S.getPuzzleLevel(), 'standard');
    NEW.forEach((p) => {
      assert.equal(S.getProblem(p.id).cleared, false);
      ['easy', 'standard', 'challenge'].forEach((lv) => assert.equal(S.getProblem(p.id, 'puzzle:' + lv).cleared, false));
    });
    // STAGE 6 の集計と復習
    let st = S.stageStats(6);
    assert.equal(st.total, 5);
    assert.equal(st.cleared, 0);
    assert.equal(st.maxStars, 15);
    assert.ok(S.reviewProblems().some((p) => p.id === 'p16'));
    S.recordClear('p16', 3, 0);
    S.recordClear('p17', 2, 1, 'puzzle:easy');
    assert.ok(!S.reviewProblems().some((p) => p.id === 'p16'));
    assert.ok(S.reviewProblems('puzzle:easy').some((p) => p.id === 'p17'));       // ★★は復習対象
    assert.equal(S.getProblem('p16', 'puzzle:easy').cleared, false);              // ハンターとパズルは独立
    assert.equal(S.getProblem('p17', 'puzzle:standard').cleared, false);          // レベルどうしも独立
    // 上位レベルの★★★は、下位レベルにも反映
    const r = S.recordClear('p18', 3, 0, 'puzzle:challenge');
    assert.deepEqual(r.lowered, ['easy', 'standard']);
    assert.equal(S.getProblem('p18', 'puzzle:easy').bestStars, 3);
    st = S.stageStats(6, 'puzzle:standard');
    assert.equal(st.cleared, 1);
    // 既存の記録は変わらない
    assert.equal(S.getProblem('p01').bestStars, 3);
    assert.equal(S.getProblem('p02', 'puzzle:easy').bestStars, 2);
  });
});

test('保存：LocalStorage が使えなくても、新しい問題の記録はメモリ上で動く', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('denied'); }, configurable: true });
  PH.storage._reset();
  try {
    PH.storage.recordClear('p20', 3, 0, 'puzzle:standard');
    assert.equal(PH.storage.getProblem('p20', 'puzzle:standard').bestStars, 3);
    assert.equal(PH.storage.getProblem('p20', 'puzzle:easy').bestStars, 3);
    assert.equal(PH.storage.getProblem('p20', 'puzzle:challenge').cleared, false);
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
    PH.storage._reset();
  }
});
