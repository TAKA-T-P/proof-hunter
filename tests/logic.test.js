// 証明ハンター 判定ロジックの自動テスト
// 実行: node --test tests/
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

const PH = globalThis.PH;
// Ver.0.8 までの30問（p01〜p30）。Ver.0.9 の問題（p31〜p42。p35 は STAGE 6）は v09.test.js で確かめる
const TRI = PH.problems.filter((p) => Number(p.id.slice(1)) <= 30);
const geo = PH.geometry;
const val = PH.validation;
const p01 = PH.getProblem('p01');
const p02 = PH.getProblem('p02');
const p03 = PH.getProblem('p03');

const k = (p, name) => geo.elementKey(p.figure, name);
const keys = (p, a, b) => [k(p, a), k(p, b)];

// ---- 線分・角の同一性 -------------------------------------------------------

test('ABとBAは同じ線分として扱われる', () => {
  assert.equal(geo.segKey('AB'), geo.segKey('BA'));
  assert.notEqual(geo.segKey('AB'), geo.segKey('AC'));
});

test('等式の左右を入れ替えても同じ等式になる（AB＝CD, CD＝AB, BA＝DC）', () => {
  const e1 = val.equationKey(geo.segKey('AB'), geo.segKey('CD'));
  const e2 = val.equationKey(geo.segKey('CD'), geo.segKey('AB'));
  const e3 = val.equationKey(geo.segKey('BA'), geo.segKey('DC'));
  assert.equal(e1, e2);
  assert.equal(e1, e3);
});

test('∠ABCと∠CBAは同じ角として扱われる', () => {
  const fig = { lines: [] };
  assert.equal(geo.angleKey(fig, '∠ABC'), geo.angleKey(fig, '∠CBA'));
  assert.notEqual(geo.angleKey(fig, '∠ABC'), geo.angleKey(fig, '∠BAC'));
});

test('一直線上の点で名前が違っても同じ角（∠BAO＝∠BAC）、向きが逆なら別の角', () => {
  assert.equal(k(p03, '∠BAO'), k(p03, '∠BAC'));
  assert.equal(k(p03, '∠DCO'), k(p03, '∠DCA'));
  // 対頂角は別の領域
  assert.notEqual(k(p02, '∠AOC'), k(p02, '∠BOD'));
  assert.notEqual(k(p02, '∠AOC'), k(p02, '∠AOD'));
});

test('すべての問題データが整合している（要素・理由・ヒント・合同条件）', () => {
  for (const p of TRI) {
    assert.deepEqual(val.verifyProblem(p), [], p.id);
  }
});

// ---- 根拠の判定 -------------------------------------------------------------

test('正しい等式と理由で根拠獲得（左右・向きを入れ替えても正解）', () => {
  assert.equal(val.checkEvidence(p01, keys(p01, 'AB', 'CB'), 'given', []).status, 'correct');
  assert.equal(val.checkEvidence(p01, keys(p01, 'BC', 'BA'), 'given', []).status, 'correct');
  assert.equal(val.checkEvidence(p01, keys(p01, 'BD', 'DB'), 'common', []).status, 'correct');
  assert.equal(val.checkEvidence(p02, keys(p02, '∠BOD', '∠COA'), 'vertical', []).status, 'correct');
  assert.equal(val.checkEvidence(p03, keys(p03, '∠ACD', '∠CAB'), 'alternate', []).status, 'correct');
  assert.equal(val.checkEvidence(p03, keys(p03, '∠CDB', '∠ABD'), 'alternate', []).status, 'correct');
});

test('等式は正しいが理由が誤っている場合は不正解（wrong-reason）', () => {
  const r = val.checkEvidence(p01, keys(p01, 'AB', 'CB'), 'common', []);
  assert.equal(r.status, 'wrong-reason');
  assert.equal(r.miss, true);
  assert.equal(val.checkEvidence(p03, keys(p03, '∠BAO', '∠DCO'), 'corresponding', []).status, 'wrong-reason');
  assert.equal(val.checkEvidence(p02, keys(p02, '∠AOC', '∠BOD'), 'given', []).status, 'wrong-reason');
});

test('登録済みの根拠は重複登録されない（ミスにもならない）', () => {
  const r = val.checkEvidence(p01, keys(p01, 'CB', 'AB'), 'given', ['e1']);
  assert.equal(r.status, 'duplicate');
  assert.equal(r.miss, false);
});

test('結論（合同）から導かれる関係は根拠として使用できない', () => {
  const r1 = val.checkEvidence(p01, keys(p01, '∠BAD', '∠BCD'), 'given', []);
  assert.equal(r1.status, 'from-conclusion');
  assert.equal(r1.miss, true);
  assert.equal(val.checkEvidence(p02, keys(p02, 'AC', 'BD'), 'given', []).status, 'from-conclusion');
  assert.equal(val.checkEvidence(p03, keys(p03, 'AO', 'CO'), 'given', []).status, 'from-conclusion');
});

test('見た目で等しそうでも根拠のない等式は不正解', () => {
  assert.equal(val.checkEvidence(p01, keys(p01, 'AB', 'AD'), 'given', []).status, 'wrong-equation');
  assert.equal(val.checkEvidence(p03, keys(p03, 'AO', 'BO'), 'given', []).status, 'wrong-equation');
});

test('共通でない辺を「共通な辺」にすると不正解', () => {
  assert.equal(val.checkEvidence(p01, keys(p01, 'AB', 'AB'), 'common', []).status, 'not-common');
  assert.equal(val.checkEvidence(p02, keys(p02, 'AO', 'AO'), 'common', []).status, 'not-common');
});

test('正しいが今回の証明で使わない関係はミスにしない', () => {
  const r = val.checkEvidence(p02, keys(p02, '∠AOD', '∠BOC'), 'vertical', []);
  assert.equal(r.status, 'irrelevant');
  assert.equal(r.miss, false);
  assert.equal(val.checkEvidence(p03, keys(p03, '∠AOB', '∠COD'), 'vertical', []).status, 'irrelevant');
});

// ---- 合同条件 ---------------------------------------------------------------

test('根拠の組から合同条件を正しく導く', () => {
  assert.equal(val.deriveCondition(p01, p01.evidence), 'SSS');
  assert.equal(val.deriveCondition(p02, p02.evidence), 'SAS');
  assert.equal(val.deriveCondition(p03, p03.evidence), 'ASA');
});

test('「間の角」でない角では SAS にならない', () => {
  const bad = [p02.evidence[0], p02.evidence[1], { items: ['∠OAC', '∠OBD'] }];
  assert.equal(val.deriveCondition(p02, bad), null);
});

test('合同条件を誤るとクリアにならない', () => {
  const all = ['e1', 'e2', 'e3'];
  assert.equal(val.checkCongruence(p01, all, 'SAS').ok, false);
  assert.equal(val.checkCongruence(p01, all, 'ASA').ok, false);
  assert.equal(val.checkCongruence(p01, all, 'SSS').ok, true);
  assert.equal(val.checkCongruence(p02, all, 'SAS').ok, true);
  assert.equal(val.checkCongruence(p03, all, 'ASA').ok, true);
  assert.equal(val.checkCongruence(p03, all, 'SAS').status, 'wrong-condition');
});

test('根拠がそろっていなければ合同条件は判定しない', () => {
  assert.equal(val.checkCongruence(p01, ['e1', 'e2'], 'SSS').ok, false);
});

// ---- ゲーム進行 -------------------------------------------------------------

function play(game, a, b, reason) {
  game.setMode(geo.isAngleName(a) ? 'angle' : 'side');
  game.tap(k(game.problem, a));
  game.tap(k(game.problem, b));
  game.selectReason(reason);
  return game.confirmEvidence();
}

test('問題01をミスなしで最後まで進めると★3', () => {
  const g = new PH.Game(p01);
  assert.equal(play(g, 'AB', 'CB', 'given').status, 'correct');
  assert.equal(play(g, 'CD', 'AD', 'given').status, 'correct');
  g.tap(k(p01, 'BD'));
  g.tap(k(p01, 'BD'));
  g.selectReason('common');
  assert.equal(g.confirmEvidence().status, 'correct');
  assert.equal(g.phase, 'congruence');
  g.selectCondition('SSS');
  assert.equal(g.confirmCondition().ok, true);
  assert.equal(g.phase, 'clear');
  assert.equal(g.stars, 3);
});

test('理由だけ誤った場合は等式の選択を残して再選択できる', () => {
  const g = new PH.Game(p01);
  assert.equal(play(g, 'AB', 'CB', 'common').status, 'wrong-reason');
  assert.equal(g.selection.length, 2);
  assert.equal(g.reason, null);
  assert.equal(g.misses, 1);
  g.selectReason('given');
  assert.equal(g.confirmEvidence().status, 'correct');
});

test('重複はミスにならず、誤った合同条件はミスになる', () => {
  const g = new PH.Game(p03);
  play(g, 'AB', 'CD', 'given');
  assert.equal(play(g, 'DC', 'BA', 'given').status, 'duplicate');
  assert.equal(g.misses, 0);
  play(g, '∠BAO', '∠DCO', 'alternate');
  play(g, '∠ABO', '∠CDO', 'alternate');
  g.selectCondition('SSS');
  assert.equal(g.confirmCondition().ok, false);
  assert.equal(g.misses, 1);
  assert.equal(g.phase, 'congruence');
  g.selectCondition('ASA');
  assert.equal(g.confirmCondition().ok, true);
  assert.equal(g.stars, 2);
});

test('辺選択では角、角選択では辺はタップしても選ばれない', () => {
  const g = new PH.Game(p02);
  assert.equal(g.mode, 'side');
  g.tap(k(p02, 'AO'));
  assert.equal(g.tap(k(p02, '∠AOC')).type, 'ignored');
  assert.deepEqual(g.selection, [k(p02, 'AO')]);
  // 角選択に切り替えると、種類の違う選択はやり直しになる
  g.setMode('angle');
  assert.deepEqual(g.selection, []);
  assert.equal(g.tap(k(p02, 'AO')).type, 'ignored');
  g.tap(k(p02, '∠AOC'));
  g.tap(k(p02, '∠BOD'));
  assert.equal(g.selection.length, 2);
});

test('印つけから「解答にもどる」と直前の辺選択/角選択に戻る', () => {
  const g = new PH.Game(p02);
  g.setMode('angle');
  g.setMode('mark');
  g.setMarkTool('ang', 2);
  g.tap(k(p02, '∠OAC'));
  g.setMarkTool('seg', 1);
  g.tap(k(p02, 'AC'));
  assert.equal(Object.keys(g.userMarks).length, 2);
  g.setMode('answer');
  assert.equal(g.mode, 'angle');
});

test('辺選択で同じ辺を2回タップすると共通な辺の候補、3回目で選択解除', () => {
  const g = new PH.Game(p01);
  const bd = k(p01, 'BD');
  g.tap(bd);
  g.tap(bd);
  assert.deepEqual(g.selection, [bd, bd]);
  assert.ok(g.availableReasons().includes('common'));
  g.tap(bd);
  assert.deepEqual(g.selection, []);
  g.tap(bd);
  g.tap(bd);
  g.selectReason('common');
  assert.equal(g.confirmEvidence().status, 'correct');
  // 共通な辺を選択肢に持たない問題でも、同じ辺を2回選べば理由に出る
  const g3 = new PH.Game(p03);
  g3.tap(k(p03, 'AB'));
  g3.tap(k(p03, 'AB'));
  assert.ok(g3.availableReasons().includes('common'));
  g3.selectReason('common');
  assert.equal(g3.confirmEvidence().status, 'not-common');
});

// 共通な角を使う問題（今後の拡張用のサンプル）: AB＝AC、AD＝AE、∠Aが共通 → △ABE≡△ACD
const commonAngleProblem = {
  id: 'tca', triangles: [['A', 'B', 'E'], ['A', 'C', 'D']],
  figure: {
    viewBox: [0, 0, 400, 340],
    points: { A: { x: 200, y: 30 }, B: { x: 80, y: 310 }, C: { x: 320, y: 310 }, D: { x: 140, y: 170 }, E: { x: 260, y: 170 } },
    lines: [['A', 'D', 'B'], ['A', 'E', 'C']],
    segments: ['AD', 'DB', 'AE', 'EC', 'BE', 'CD'],
    angles: ['BAC', 'ADC', 'AEB'],
  },
  reasons: ['given', 'vertical'],
  evidence: [
    { id: 'e1', items: ['AB', 'AC'], reason: 'given', label: 'AB＝AC', mark: 1 },
    { id: 'e2', items: ['∠BAE', '∠CAD'], reason: 'commonAngle', label: '∠BAE＝∠CAD', mark: 'common' },
    { id: 'e3', items: ['AE', 'AD'], reason: 'given', label: 'AE＝AD', mark: 2 },
  ],
  extraTruths: [], congruence: 'SAS', hints: {},
};

test('角も同じ角を2回タップで共通な角の候補、3回目で選択解除', () => {
  const g = new PH.Game(commonAngleProblem);
  const a = k(commonAngleProblem, '∠BAC');
  // 一直線上の点で名前が違っても同じ角
  assert.equal(a, k(commonAngleProblem, '∠DAE'));
  g.setMode('angle');
  g.tap(a);
  g.tap(a);
  assert.deepEqual(g.selection, [a, a]);
  assert.ok(g.availableReasons().includes('commonAngle'));
  assert.ok(!g.availableReasons().includes('common'));
  g.tap(a);
  assert.deepEqual(g.selection, []);
  g.tap(a);
  g.tap(a);
  g.selectReason('given');
  assert.equal(g.confirmEvidence().status, 'wrong-reason');
  g.selectReason('commonAngle');
  assert.equal(g.confirmEvidence().status, 'correct');
  assert.equal(g.autoMarks()[a], 'common');
  assert.equal(val.deriveCondition(commonAngleProblem, commonAngleProblem.evidence), 'SAS');
});

test('共通でない角を共通な角にすると不正解', () => {
  const g = new PH.Game(p02);
  g.setMode('angle');
  g.tap(k(p02, '∠AOC'));
  g.tap(k(p02, '∠AOC'));
  g.selectReason('commonAngle');
  assert.equal(g.confirmEvidence().status, 'not-common');
});

test('印つけでは選んだ種類（辺の印/角の印）の要素にだけ印がつく', () => {
  const g = new PH.Game(p02);
  g.setMode('mark');
  assert.equal(g.markTool.kind, 'seg');
  assert.equal(g.tap(k(p02, '∠AOC')).type, 'ignored');
  assert.equal(g.tap(k(p02, 'AO')).type, 'mark');
  g.setMarkTool('ang', 1);
  assert.equal(g.tap(k(p02, 'BO')).type, 'ignored');
  assert.equal(g.tap(k(p02, '∠AOC')).type, 'mark');
  assert.equal(Object.keys(g.userMarks).length, 2);
});

test('同じ要素の再タップで選択解除・確定前は判定しない', () => {
  const g = new PH.Game(p01);
  g.tap(k(p01, 'AB'));
  g.tap(k(p01, 'CB'));
  g.tap(k(p01, 'CB'));
  assert.deepEqual(g.selection, [k(p01, 'AB')]);
  g.tap(k(p01, 'AB'));   // AB＝AB
  g.tap(k(p01, 'AB'));   // 3回目で解除
  assert.equal(g.selection.length, 0);
  assert.equal(g.confirmEvidence().status, 'incomplete');
  assert.equal(g.misses, 0);
});

test('印つけは判定に影響せず、生徒の印を消しても根拠の印は残る', () => {
  const g = new PH.Game(p01);
  play(g, 'AB', 'CB', 'given');
  g.setMode('mark');
  g.tap(k(p01, 'AB'));
  g.tap(k(p01, 'AD'));
  assert.equal(g.misses, 0);
  assert.equal(g.found.length, 1);
  assert.equal(Object.keys(g.userMarks).length, 2);
  g.clearUserMarks();
  assert.equal(Object.keys(g.userMarks).length, 0);
  assert.equal(g.autoMarks()[k(p01, 'AB')], 1);
});

test('ヒントは未発見の根拠を優先し、段階的に進み、使用回数を数える', () => {
  const g = new PH.Game(p01);
  play(g, 'AB', 'CB', 'given');
  const h1 = g.useHint();
  assert.equal(h1.targetId, 'e2');
  assert.equal(h1.level, 1);
  assert.equal(g.useHint().level, 2);
  assert.equal(g.useHint().level, 3);
  const again = g.useHint();
  assert.equal(again.level, 3);
  assert.equal(again.isNew, false);
  assert.equal(g.hintsUsed, 3);
});

test('再挑戦でミス・ヒント回数・印が初期化される', () => {
  const g = new PH.Game(p01);
  play(g, 'AB', 'AD', 'given');
  g.useHint();
  g.setMode('mark');
  g.tap(k(p01, 'BD'));
  g.reset();
  assert.equal(g.misses, 0);
  assert.equal(g.hintsUsed, 0);
  assert.deepEqual(g.userMarks, {});
  assert.deepEqual(g.found, []);
  assert.equal(g.mode, 'side');
});

test('クリア評価の計算', () => {
  assert.equal(PH.calcStars(0, 0), 3);
  assert.equal(PH.calcStars(1, 0), 2);
  assert.equal(PH.calcStars(2, 1), 2);
  assert.equal(PH.calcStars(0, 2), 1);
  assert.equal(PH.calcStars(3, 0), 1);
});

// ---- 保存 -------------------------------------------------------------------

test('LocalStorage が使えなくても進捗を記録でき、最高評価は下がらない', () => {
  PH.storage._reset();
  const r1 = PH.storage.recordClear('p01', 2, 1);
  assert.equal(r1.improved, true);
  const r2 = PH.storage.recordClear('p01', 1, 4);
  assert.equal(r2.improved, false);
  assert.equal(PH.storage.getProblem('p01').bestStars, 2);
  assert.equal(PH.storage.getProblem('p01').minMisses, 1);
  PH.storage.recordClear('p01', 3, 0);
  assert.equal(PH.storage.getProblem('p01').bestStars, 3);
});
