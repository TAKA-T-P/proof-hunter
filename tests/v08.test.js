// 証明ハンター Ver.0.8 のテスト（直角三角形の合同条件・STAGE 8・段位認定の2コース）
// 実行: npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/problems.js');
require('../js/geometry.js');
require('../js/validation.js');
require('../js/right-triangle.js');
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
const RT = PH.rightTriangle;
const TR = PH.rankTracks;
const CFG = PH.rank.config;
const k = (p, n) => geo.elementKey(p.figure, n);
const P = (id) => PH.getProblem(id);
const NEW = ['p25', 'p26', 'p27', 'p28', 'p29', 'p30'].map(P);
const TYPES = ['fill', 'build', 'challenge'];

// 問題データを一部だけ変えたコピー（図などは共有）
function variant(p, over) { return Object.assign({}, p, over); }
function evOf(p, role) { return RT.evidenceForRole(p, role); }

// ---- ハンター --------------------------------------------------------------------

function chooseTriangles(g) {
  const t = g.problem.triangles;
  g.tapTriangle(t[0]);
  g.tapTriangle(t[1]);
  return g.confirmTriangles();
}

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

// 根拠を答える（role を渡すと、その欄を選んでから）
function answer(g, ev, reason, role) {
  const p = g.problem;
  if (role) g.selectRole(role);
  g.setMode(geo.isAngleName(ev.items[0]) ? 'angle' : 'side');
  g.clearSelection();
  g.tap(k(p, ev.items[0]));
  g.tap(k(p, ev.items[1]));
  g.selectReason(reason);
  return g.confirmEvidence();
}

function toCollect(g) {
  if (g.phase === 'triangle') assert.equal(chooseTriangles(g).status, 'ok');
  while (g.phase === 'step') assert.equal(solveStep(g).status, 'correct');
  assert.equal(g.phase, 'collect');
}

function finishHunter(g) {
  const p = g.problem;
  g.selectCondition(p.congruence);
  assert.equal(g.confirmCondition().ok, true, p.id);
  if (g.phase === 'final') {
    g.setMode(geo.isAngleName(p.finalStep.items[0]) ? 'angle' : 'side');
    g.tap(k(p, p.finalStep.items[0]));
    g.tap(k(p, p.finalStep.items[1]));
    g.selectReason(p.finalStep.reason);
    assert.equal(g.confirmFinal().status, 'correct');
  }
  assert.equal(g.phase, 'clear', p.id);
}

// ---- パズル --------------------------------------------------------------------

function fill(z, placement) {
  z.slots.forEach((s) => {
    if (placement[s.id] == null) return;
    z.selectSlot(s.id);
    const ok = s.input ? z.setInput(placement[s.id]) : z.place(placement[s.id]);
    assert.equal(ok, true, s.id + ' ' + placement[s.id]);
  });
}

// ---- 記録 --------------------------------------------------------------------

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

function result(over) {
  return Object.assign({ correct: 15, misses: 4, passes: 1, answered: 19, effectiveScore: 15, rank: 15, rankName: '六段',
    maxCombo: 7, criteriaVersion: CFG.criteriaVersion, seed: 1, wrongs: [] }, over || {});
}

// =====================================================================================
// 問題データ・STAGE 8
// =====================================================================================

test('30問・8ステージ。STAGE 8「直角三角形を攻略せよ！」は p25〜p30', () => {
  assert.equal(PH.problems.length, 30);
  assert.equal(PH.STAGES.length, 8);
  assert.equal(PH.getStage(8).title, '直角三角形を攻略せよ！');
  assert.deepEqual(PH.stageProblems(8).map((p) => p.id), ['p25', 'p26', 'p27', 'p28', 'p29', 'p30']);
  assert.deepEqual(val.verifyAll(PH.problems, PH.STAGES), []);
  assert.deepEqual(NEW.map((p) => p.congruence), ['RHS', 'RHA', 'RHA', 'RHS', 'RHA', 'RHA']);
  // 既存の24問は変わらない（直角三角形の合同条件を使わない・データの形もそのまま）
  PH.problems.filter((p) => p.stage <= 7).forEach((p) => {
    assert.ok(['SSS', 'SAS', 'ASA'].includes(p.congruence), p.id);
    assert.ok(!p.evidence.some((ev) => ev.role), p.id);
  });
});

test('合同条件は5つ。RHA・RHS は直角三角形の合同条件で、中学数学の表現', () => {
  assert.equal(PH.CONDITIONS.RHA.label, '直角三角形の斜辺と1つの鋭角がそれぞれ等しい');
  assert.equal(PH.CONDITIONS.RHS.label, '直角三角形の斜辺と他の1辺がそれぞれ等しい');
  assert.deepEqual(PH.CONDITION_ORDER, ['SSS', 'SAS', 'ASA']);
  assert.deepEqual(PH.RIGHT_CONDITION_ORDER, ['SSS', 'SAS', 'ASA', 'RHA', 'RHS']);
  PH.problems.forEach((p) => assert.equal(PH.conditionOrder(p).length, p.stage === 8 ? 5 : 3, p.id));
});

// =====================================================================================
// 26-1 直角三角形
// =====================================================================================

test('直角の頂点・斜辺を正しく求める（直角の位置から。辺の長さや見た目では決めない）', () => {
  const want = {
    p25: [['A', 'BD'], ['C', 'BD']], p26: [['B', 'AO'], ['C', 'DO']], p27: [['E', 'BC'], ['D', 'CB']],
    p28: [['D', 'CE'], ['B', 'CF']], p29: [['Q', 'PO'], ['R', 'PO']], p30: [['D', 'AB'], ['E', 'CA']],
  };
  NEW.forEach((p) => {
    [0, 1].forEach((i) => {
      assert.equal(RT.rightVertex(p, i), want[p.id][i][0], p.id + ' 直角の頂点');
      assert.equal(geo.segKey(RT.hypotenuse(p, i)), geo.segKey(want[p.id][i][1]), p.id + ' 斜辺');
      // 斜辺は直角の頂点をふくまない
      assert.ok(!RT.hypotenuse(p, i).includes(RT.rightVertex(p, i)));
    });
  });
});

test('根拠の役割：直角・斜辺・他の1辺・鋭角を区別する', () => {
  const want = {
    p25: ['right', 'hypotenuse', 'leg'], p26: ['right', 'hypotenuse', 'acute'], p27: ['right', 'hypotenuse', 'acute'],
    p28: ['right', 'hypotenuse', 'leg'], p29: ['right', 'hypotenuse', 'acute'], p30: ['right', 'hypotenuse', 'acute'],
  };
  NEW.forEach((p) => {
    assert.deepEqual(p.evidence.map((ev) => RT.roleOf(p, ev)), want[p.id], p.id);
    assert.deepEqual(RT.slotRoles(p), want[p.id], p.id);
  });
  // 斜辺と他の1辺：直角をはさむ辺は「他の1辺」、直角に向かい合う辺は「斜辺」
  const p = P('p25');
  assert.equal(RT.roleOf(p, { items: ['AD', 'CD'] }), 'leg');
  assert.equal(RT.roleOf(p, { items: ['BD', 'BD'] }), 'hypotenuse');
  // 鋭角：直角ではない方の角。直角の位置の角は鋭角にならない
  assert.equal(RT.roleOf(p, { items: ['∠ABD', '∠CBD'] }), 'acute');
  assert.equal(RT.roleOf(p, { items: ['∠BAD', '∠BCD'] }), null);
  // 通常の問題には役割がない
  assert.deepEqual(RT.slotRoles(P('p01')), []);
});

test('垂直から直角を導ける（垂直な2直線がつくる角）・正方形の角から直角を導ける', () => {
  const p27 = P('p27');
  assert.equal(RT.perpendicularFor(p27, '∠BEC').label, 'CE⊥AB');
  assert.equal(RT.perpendicularFor(p27, '∠CDB').label, 'BD⊥AC');
  assert.equal(RT.perpendicularFor(p27, '∠EBC'), null);
  assert.equal(RT.checkRightReason(p27, evOf(p27, 'right')), null);
  const p30 = P('p30');
  assert.equal(RT.perpendicularFor(p30, '∠ADB').label, 'BD⊥ℓ');
  assert.equal(RT.perpendicularFor(p30, '∠CEA').label, 'CE⊥ℓ');
  const p28 = P('p28');
  assert.equal(RT.squareFor(p28, '∠CDE'), 'ABCD');
  assert.equal(RT.squareFor(p28, '∠CBF'), 'ABCD');
  assert.equal(RT.squareFor(p28, '∠ECD'), null);
  assert.equal(RT.checkRightReason(p28, evOf(p28, 'right')), null);
  // 90°の根拠：仮定・垂直・正方形の角から分かる角だけ（角の式の 90° にも使う）
  assert.deepEqual(RT.knownRightAngles(p30).sort(), ['∠ADB', '∠BAC', '∠CEA']);
  assert.deepEqual(RT.knownRightAngles(P('p26')).sort(), ['∠ABO', '∠DCO']);
});

test('直角に見えるだけでは証明済みにしない（仮定・垂直・正方形の角の根拠が必要）', () => {
  // 仮定に90°が書かれていない・垂直の仮定がない → データの検証でエラー
  const p25 = P('p25');
  assert.ok(RT.checkRightReason(variant(p25, { given: ['AB＝CB'] }), evOf(p25, 'right')));
  const p27 = P('p27');
  assert.ok(RT.checkRightReason(variant(p27, { perpendicular: [] }), evOf(p27, 'right')));
  assert.ok(RT.checkRightReason(variant(p27, { given: ['AB＝AC'] }), evOf(p27, 'right')));
  assert.ok(RT.checkRightReason(variant(P('p28'), { square: [] }), evOf(P('p28'), 'right')));
  // 図の上では90°の正方形の角（∠EAF）も、根拠でなければ「直角」として認めない
  const p28 = P('p28');
  assert.equal(Math.round(val.measure(p28.figure, '∠EAF').value), 90);
  assert.ok(!RT.knownRightAngles(p28).includes('∠EAF'));
  assert.notEqual(val.checkEvidence(p28, [k(p28, '∠EAF'), k(p28, '∠CDE')], 'squareAngle', []).status, 'correct');
  // 図の直角の印は、仮定・垂線の直角だけ（正方形の角など、導く直角は最初は表示しない）
  assert.equal(p28.figure.rightMarks, undefined);
  assert.deepEqual(P('p30').figure.rightMarks, ['BAC', 'ADB', 'CEA']);
  const bad = variant(P('p26'), { figure: Object.assign({}, P('p26').figure, { rightMarks: ['ABO', 'AOB'] }) });
  assert.ok(RT.verify(bad).some((e) => /直角の印/.test(e)));
});

// =====================================================================================
// 26-2 合同条件の判定
// =====================================================================================

test('RHS・RHA を正しく判定する（共通の判定関数 deriveCondition → right-triangle.js）', () => {
  NEW.forEach((p) => assert.equal(val.deriveCondition(p, p.evidence), p.congruence, p.id));
  // 直角＋直角をはさむ2辺は SAS、直角＋（直角と鋭角の間の辺）＋鋭角は ASA（直角三角形でも通常の条件になる組）
  const p25 = P('p25');
  const right = evOf(p25, 'right');
  assert.equal(val.deriveCondition(p25, [right, { items: ['AB', 'CB'] }, { items: ['AD', 'CD'] }]), 'SAS');
  assert.equal(val.deriveCondition(p25, [right, { items: ['AB', 'CB'] }, { items: ['∠ABD', '∠CBD'] }]), 'ASA');
  // 直角＋斜辺＋鋭角 → RHA、直角＋斜辺＋他の1辺 → RHS
  assert.equal(val.deriveCondition(p25, [right, { items: ['BD', 'BD'] }, { items: ['∠ABD', '∠CBD'] }]), 'RHA');
  assert.equal(val.deriveCondition(p25, [right, { items: ['BD', 'BD'] }, { items: ['AD', 'CD'] }]), 'RHS');
});

test('直角三角形でない（直角の根拠がない）場合は RHS・RHA を認めない', () => {
  NEW.forEach((p) => {
    const noRight = p.evidence.map((ev) => (ev.role === 'right' ? Object.assign({}, ev, { role: undefined }) : ev));
    assert.ok(!['RHS', 'RHA'].includes(val.deriveCondition(p, noRight)), p.id);
  });
  // 通常の問題の根拠からは RHS・RHA にならない
  PH.problems.filter((p) => p.stage <= 7).forEach((p) => assert.ok(!PH.CONDITIONS[val.deriveCondition(p, p.evidence)].right, p.id));
  // 直角の根拠が2つ（直角が2組）も不成立
  const p26 = P('p26');
  assert.equal(RT.derive(p26, [evOf(p26, 'right'), evOf(p26, 'right'), evOf(p26, 'hypotenuse')]), null);
});

test('斜辺・他の1辺・鋭角が対応していない場合は不正解', () => {
  const p26 = P('p26');
  const right = evOf(p26, 'right');
  // 斜辺が対応していない（AO と CO）
  assert.equal(val.deriveCondition(p26, [right, { items: ['AO', 'CO'] }, evOf(p26, 'acute')]), null);
  // 鋭角が対応していない（∠AOB と ∠CDO）
  assert.equal(val.deriveCondition(p26, [right, evOf(p26, 'hypotenuse'), { items: ['∠AOB', '∠CDO'] }]), null);
  // 他の1辺が対応していない（AB と CD ではなく AB と CO）
  const p25 = P('p25');
  assert.equal(val.deriveCondition(p25, [evOf(p25, 'right'), evOf(p25, 'hypotenuse'), { items: ['AB', 'CD'] }]), null);
  // 斜辺がない（直角＋他の1辺＋鋭角で、辺が鋭角の間にない）
  assert.equal(val.deriveCondition(p26, [right, { items: ['AB', 'DC'] }, evOf(p26, 'acute')]), null);
});

test('未証明の直角や辺・角の等しさは利用できない', () => {
  // p30：鋭角 ∠ABD＝∠CAE は、式を比べるステップ（s3）を証明してから
  const p30 = P('p30');
  const eng = new PH.ProofEngine(p30);
  const acute = evOf(p30, 'acute');
  assert.equal(val.checkEvidence(p30, acute.items.map((n) => k(p30, n)), 'proved', [], eng).status, 'not-proved');
  eng.complete('s1'); eng.complete('s2');
  assert.equal(val.checkEvidence(p30, acute.items.map((n) => k(p30, n)), 'proved', [], eng).status, 'not-proved');
  eng.complete('s3');
  assert.equal(val.checkEvidence(p30, acute.items.map((n) => k(p30, n)), 'proved', [], eng).status, 'correct');
  // 根拠がそろう前は合同条件を判定しない（直角を確かめていなければ、RHS・RHA は選べない）
  const p25 = P('p25');
  assert.equal(val.checkCongruence(p25, ['e2', 'e3'], 'RHS').status, 'incomplete');
  const g = new PH.Game(p25);
  g.selectRole('hypotenuse');
  assert.equal(answer(g, evOf(p25, 'hypotenuse'), 'common').status, 'correct');
  assert.equal(g.rightConfirmed(), false);
  assert.equal(g.selectCondition('RHS'), false);          // まだ合同条件の段階ではない
  assert.equal(answer(g, evOf(p25, 'right'), 'given', 'right').status, 'correct');
  assert.equal(g.rightConfirmed(), true);
  // 確かめた直角は「確かめた事実」として登録される
  const r = evOf(p25, 'right');
  assert.ok(g.established[val.equationKey(k(p25, r.items[0]), k(p25, r.items[1]))]);
});

// =====================================================================================
// 26-3 既存の合同条件
// =====================================================================================

test('SSS・SAS・ASA は従来どおり判定され、通常の問題の合同条件の選択肢は3つのまま', () => {
  PH.problems.filter((p) => p.stage <= 7).forEach((p) => {
    assert.equal(val.deriveCondition(p, p.evidence), p.congruence, p.id);
    const g = new PH.Game(p);
    assert.deepEqual(g.conditionOptions(), ['SSS', 'SAS', 'ASA']);
    assert.deepEqual(g.roles, []);
    TYPES.forEach((t) => assert.deepEqual(new PH.Puzzle(p, t).cards.cond.map((c) => c.cond), ['SSS', 'SAS', 'ASA']));
  });
});

test('直角三角形の問題では、5つの合同条件が表示される', () => {
  NEW.forEach((p) => {
    assert.deepEqual(new PH.Game(p).conditionOptions(), ['SSS', 'SAS', 'ASA', 'RHA', 'RHS']);
    TYPES.forEach((t) => assert.equal(new PH.Puzzle(p, t).cards.cond.length, 5));
  });
});

// =====================================================================================
// 26-4 新規問題：ハンター
// =====================================================================================

NEW.forEach((p) => {
  test(p.id + ': ハンターで、直角 → 斜辺 → 他の1辺（鋭角）を集めて★★★でクリアできる', () => {
    const g = new PH.Game(p);
    toCollect(g);
    assert.equal(g.role, 'right');
    assert.equal(g.mode, 'angle');                                    // 直角の欄は角選択から
    assert.deepEqual(g.availableReasons(), ['given', 'perpendicular', 'squareAngle']);
    g.roles.forEach((role) => {
      const ev = evOf(p, role);
      assert.equal(g.role, role);
      const r = answer(g, ev, ev.reason);
      assert.equal(r.status, 'correct', p.id + ' ' + role);
    });
    assert.equal(g.phase, 'congruence');
    // 斜辺を見つけると、図で斜辺を強調する
    assert.deepEqual(g.hypotenuseKeys().slice().sort(), evOf(p, 'hypotenuse').items.map((n) => k(p, n)).sort());
    finishHunter(g);
    assert.equal(g.misses, 0);
    assert.equal(g.stars, 3);
  });

  test(p.id + ': 欄を選べば、どの順番で集めてもよい', () => {
    const g = new PH.Game(p);
    toCollect(g);
    g.roles.slice().reverse().forEach((role) => {
      const ev = evOf(p, role);
      assert.equal(answer(g, ev, ev.reason, role).status, 'correct', role);
    });
    finishHunter(g);
    assert.equal(g.misses, 0);
  });

  test(p.id + ': 欄に合わない根拠（他の1辺・鋭角を斜辺の欄に入れる など）はミス', () => {
    const g = new PH.Game(p);
    toCollect(g);
    const third = g.roles[2];
    const ev = evOf(p, third);
    g.selectRole('hypotenuse');
    const r = answer(g, ev, ev.reason);
    assert.equal(r.status, 'wrong-role');
    assert.equal(r.role, third);
    assert.equal(r.want, 'hypotenuse');
    assert.equal(g.misses, 1);
    assert.equal(g.found.length, 0);
    // 直角を斜辺の欄に入れてもミス（直角専用の理由（垂直・正方形の角）は、直角の欄でしか選べない）
    const right = evOf(p, 'right');
    if (PH.REASONS[right.reason].rightOnly) {
      assert.ok(!g.availableReasons().includes(right.reason));
      assert.equal(answer(g, right, right.reason).status, 'incomplete');
      assert.equal(g.misses, 1);
    } else {
      assert.equal(answer(g, right, right.reason).status, 'wrong-role');
      assert.equal(g.misses, 2);
    }
  });

  test(p.id + ': 直角の理由・合同条件の誤り（3つの合同条件はミスにせず選び直し）', () => {
    const g = new PH.Game(p);
    toCollect(g);
    const right = evOf(p, 'right');
    const wrongReason = ['given', 'perpendicular', 'squareAngle'].find((x) => !PH.acceptedReasons(right).includes(x));
    assert.equal(answer(g, right, wrongReason).status, 'wrong-reason');
    assert.equal(g.misses, 1);
    g.roles.forEach((role) => answer(g, evOf(p, role), evOf(p, role).reason, role));
    assert.equal(g.phase, 'congruence');
    // 3つの合同条件：ミスに数えない
    ['SSS', 'SAS', 'ASA'].forEach((c) => {
      g.selectCondition(c);
      const r = g.confirmCondition();
      assert.equal(r.status, 'classic-condition');
      assert.equal(r.miss, false);
    });
    assert.equal(g.misses, 1);
    // もう一方の直角三角形の合同条件：ミス
    g.selectCondition(p.congruence === 'RHA' ? 'RHS' : 'RHA');
    assert.equal(g.confirmCondition().status, 'wrong-condition');
    assert.equal(g.misses, 2);
    finishHunter(g);
    assert.equal(g.stars, 2);
  });

  test(p.id + ': ヒントは、今集めている欄の根拠（3段階）', () => {
    const g = new PH.Game(p);
    toCollect(g);
    g.roles.forEach((role) => {
      g.selectRole(role);
      assert.equal(PH.hints.targetId(p, g), evOf(p, role).id, role);
      assert.equal(p.hints[evOf(p, role).id].length, 3);
    });
    g.selectRole('right');
    const h1 = g.useHint();
    assert.equal(h1.text, '2つの三角形の中に90°の角はあるかな？');
    assert.equal(g.hintsUsed, 1);
    const h2 = g.useHint();
    assert.equal(h2.level, 2);
    g.useHint();
    const again = g.useHint();                                        // 最終段階はくり返し表示できるが、回数は増えない
    assert.equal(again.isNew, false);
    assert.equal(g.hintsUsed, 3);
    assert.equal(p.hints.congruence.length, 3);
  });
});

// =====================================================================================
// 26-4 新規問題：証明パズル
// =====================================================================================

NEW.forEach((p) => {
  TYPES.forEach((type) => {
    test(p.id + '（' + type + '）: 証明パズルでクリアでき、斜辺の行に他の1辺を入れると不正解', () => {
      const z = new PH.Puzzle(p, type);
      assert.ok(z.right);
      assert.deepEqual(z.rowRoles, z.rowEv.map((ev) => RT.roleOf(p, ev)));
      assert.equal(z.rowRoles[0], 'right');
      // 直角の行：等式は表示済み（空欄にしない）。理由はスタンダード・チャレンジで選ぶ
      assert.equal(z.slot('e0'), null);
      assert.equal(z.slot('s0'), null);
      if (type === 'fill') assert.equal(z.slot('r0'), null);
      else assert.equal(z.slot('r0').kind, 'rreason');
      assert.equal(z.rowEq(0).text, PH.evidenceText(z.rowEv[0]));
      fill(z, z.solution());
      const r = z.check();
      assert.equal(r.status, 'clear', JSON.stringify(r.result && r.result.messages));
      assert.equal(z.misses, 0);
      // 他の1辺（鋭角）が行に入る問題で、斜辺の行と入れかえると不正解（役割がちがう）
      const hypRow = z.rowRoles.indexOf('hypotenuse');
      const otherRow = z.rowRoles.findIndex((x) => x === 'leg' || x === 'acute');
      if (otherRow >= 0) {
        const z2 = new PH.Puzzle(p, type);
        const sol = z2.solution();
        const swapped = Object.assign({}, sol, { [z2.eqSlotId(hypRow)]: sol[z2.eqSlotId(otherRow)], [z2.eqSlotId(otherRow)]: sol[z2.eqSlotId(hypRow)] });
        if (type !== 'fill') Object.assign(swapped, { ['r' + hypRow]: sol['r' + otherRow], ['r' + otherRow]: sol['r' + hypRow] });
        fill(z2, swapped);
        const r2 = z2.check();
        assert.equal(r2.status, 'wrong');
        assert.equal(r2.result.slotStatus[z2.eqSlotId(hypRow)], 'ng');
        assert.ok(r2.result.messages.some((m) => /斜辺/.test(m.text)));
      }
    });

    test(p.id + '（' + type + '）: 3つの合同条件はミスに数えず、もう一方の直角三角形の条件はミス', () => {
      const z = new PH.Puzzle(p, type);
      const sol = z.solution();
      fill(z, Object.assign({}, sol, { cond: z.cards.cond.find((c) => c.cond === 'SAS').id }));
      let r = z.check();
      assert.equal(r.status, 'wrong');
      assert.equal(r.result.slotStatus.cond, 'ng');
      assert.equal(z.misses, 0);
      z.selectSlot('cond');
      z.place(z.cards.cond.find((c) => c.cond === (p.congruence === 'RHA' ? 'RHS' : 'RHA')).id);
      r = z.check();
      assert.equal(r.status, 'wrong');
      assert.equal(z.misses, 1);
      z.selectSlot('cond');
      z.place(sol.cond);
      assert.equal(z.check().status, 'clear');
    });
  });

  test(p.id + '（standard）: 直角の理由の誤りは、直角の行の理由だけが不正解', () => {
    const z = new PH.Puzzle(p, 'build');
    const sol = z.solution();
    const wrong = z.cards.rreason.find((c) => !PH.acceptedReasons(z.rowEv[0]).includes(c.reason));
    fill(z, Object.assign({}, sol, { r0: wrong.id }));
    const r = z.check();
    assert.equal(r.status, 'wrong');
    assert.equal(r.result.slotStatus.r0, 'ng');
    assert.ok(r.result.messages.some((m) => /90°/.test(m.text)));
  });

  test(p.id + ': パズルのヒント（直角の理由・斜辺・他の1辺／鋭角の順）', () => {
    const z = new PH.Puzzle(p, 'build');
    const preSteps = z.preSteps.length;
    // 前半のステップのあと、直角の行（理由）から
    if (!preSteps && !z.hasFinal) {
      const h = z.useHint();
      assert.equal(h.slotId, 'r0');
      assert.match(h.text, /90°/);
    }
    const zf = new PH.Puzzle(p, 'fill');
    const sol = zf.solution();
    // おてがるは直角の行がすべて表示済みなので、斜辺の行からヒントを出す
    Object.keys(sol).filter((id) => !/^s\d/.test(id)).forEach((id) => { zf.selectSlot(id); zf.slot(id).input ? zf.setInput(sol[id]) : zf.place(sol[id]); });
    const h = zf.useHint();
    assert.equal(h.slotId, zf.eqSlotId(zf.rowRoles.indexOf('hypotenuse')));
    assert.match(h.text, /斜辺/);
  });
});

test('垂直から言える直角は「仮定より」も正解（仮定に BD⊥AC などがあるので）。正方形の角は「正方形の角だから」だけ', () => {
  ['p27', 'p29', 'p30'].forEach((id) => {
    const p = P(id);
    const right = evOf(p, 'right');
    assert.deepEqual(PH.acceptedReasons(right), ['perpendicular', 'given']);
    // ハンター
    const g = new PH.Game(p);
    toCollect(g);
    assert.equal(answer(g, right, 'given').status, 'correct', id);
    assert.equal(g.misses, 0);
    assert.equal(answer(g, evOf(p, 'hypotenuse'), evOf(p, 'hypotenuse').reason, 'hypotenuse').status, 'correct');
    // パズル（スタンダード・チャレンジ）
    ['build', 'challenge'].forEach((type) => {
      const z = new PH.Puzzle(p, type);
      const sol = z.solution();
      fill(z, Object.assign({}, sol, { r0: z.cards.rreason.find((c) => c.reason === 'given').id }));
      assert.equal(z.check().status, 'clear', id + ' ' + type);
      assert.equal(z.misses, 0);
    });
    // 「正方形の角だから」は誤り
    assert.equal(val.checkEvidence(p, right.items.map((n) => k(p, n)), 'squareAngle', []).status, 'wrong-reason');
  });
  const p28 = P('p28');
  const r28 = evOf(p28, 'right');
  assert.deepEqual(PH.acceptedReasons(r28), ['squareAngle']);
  assert.equal(val.checkEvidence(p28, r28.items.map((n) => k(p28, n)), 'given', []).status, 'wrong-reason');
  // 仮定に90°と書かれている直角（p25・p26）は従来どおり「仮定より」だけ
  assert.deepEqual(PH.acceptedReasons(evOf(P('p25'), 'right')), ['given']);
});

test('完成した証明文：直角の確認・斜辺・他の1辺（鋭角）・直角三角形の合同条件', () => {
  const p25 = PH.buildProof(P('p25'));
  assert.deepEqual(p25.lines.map((l) => l.reason + ' ' + l.equation + ' ' + l.no),
    ['仮定より ∠BAD＝∠BCD＝90° ①', '共通な辺だから BD＝BD ②', '仮定より AB＝CB ③']);
  assert.equal(p25.summary, '①、②、③より、');
  assert.equal(p25.condition, '直角三角形の斜辺と他の1辺がそれぞれ等しい');
  assert.equal(p25.conclusion, '△ABD≡△CBD');
  const p27 = PH.buildProof(P('p27'));
  assert.deepEqual(p27.lines.map((l) => l.reason + ' ' + l.equation), ['垂直な2直線がつくる角だから ∠BEC＝∠CDB＝90°', '共通な辺だから BC＝CB']);
  assert.equal(p27.stepLines[0].equation, '∠ABC＝∠ACB');
  assert.equal(p27.summary, '①、②、③より、');
  assert.equal(p27.condition, '直角三角形の斜辺と1つの鋭角がそれぞれ等しい');
  const p28 = PH.buildProof(P('p28'));
  assert.deepEqual(p28.lines.map((l) => l.reason + ' ' + l.equation),
    ['正方形の角だから ∠CDE＝∠CBF＝90°', '正三角形の3辺は等しいから CE＝CF', '正方形の4辺は等しいから CD＝CB']);
  assert.equal(p28.conclusion, '△CED≡△CFB');
  assert.equal(p28.final.conclusion, '∠ECD＝∠FCB');
  assert.equal(p28.final.reason, '合同な図形の対応する角は等しいから');
  const p29 = PH.buildProof(P('p29'));
  assert.equal(p29.final.conclusion, 'PQ＝PR');
  // p30：教材の模範解答どおり「①、②、⑤より」
  const p30 = PH.buildProof(P('p30'));
  assert.deepEqual(p30.lines.map((l) => l.equation), ['∠ADB＝∠CEA＝90°', 'AB＝CA']);
  assert.deepEqual(p30.stepLines.map((l) => l.no + ' ' + l.equation),
    ['③ ∠ABD＝180°－(90°＋∠DAB)＝90°－∠DAB', '④ ∠CAE＝∠BAC－∠DAB＝90°－∠DAB', '⑤ ∠ABD＝∠CAE']);
  assert.equal(p30.stepLines[0].reason, '三角形の内角の和は180°だから（△ABDで、∠ADB＝90°）、');
  assert.equal(p30.stepLines[2].reason, '③、④より、');
  assert.equal(p30.summary, '①、②、⑤より、');
  assert.equal(p30.condition, '直角三角形の斜辺と1つの鋭角がそれぞれ等しい');
});

test('証明文の数学的な正しさ：根拠は図の上で等しく、頂点の対応順どおりに書かれている', () => {
  NEW.forEach((p) => {
    p.evidence.forEach((ev) => {
      assert.equal(val.correspondenceOrder(p, ev.items), 'ok', p.id + ' ' + ev.label);
      const a = val.measure(p.figure, ev.items[0]).value, b = val.measure(p.figure, ev.items[1]).value;
      assert.ok(Math.abs(a - b) < 0.5, p.id + ' ' + ev.label);
    });
    // 2つの三角形は図の上で合同に描かれている
    const t = p.triangles;
    [[0, 1], [1, 2], [0, 2]].forEach((ij) => {
      const a = val.measure(p.figure, t[0][ij[0]] + t[0][ij[1]]).value, b = val.measure(p.figure, t[1][ij[0]] + t[1][ij[1]]).value;
      assert.ok(Math.abs(a - b) < 0.5, p.id);
    });
  });
});

test('角の式：三角形の内角の和と、直角の 90° を使う式を検証する（p30）', () => {
  const p30 = P('p30');
  const s1 = p30.proofSteps[0], s2 = p30.proofSteps[1];
  assert.equal(PH.proofRules.checkExpression(p30, s1), null);
  assert.equal(PH.proofRules.checkExpression(p30, s2), null);
  // 90°の根拠のない角を数に置きかえると誤り
  assert.ok(PH.proofRules.checkExpression(p30, Object.assign({}, s1, { parts: '180°－∠ABD－∠DAB', target: '∠ADB' })));
  // 三角形の3つの角になっていない式は誤り
  assert.ok(PH.proofRules.checkExpression(p30, Object.assign({}, s1, { parts: '180°－∠ADB－∠CAE' })));
  assert.deepEqual(PH.proofRules.compareExpressions(p30, s1, s2).sort(), [k(p30, '∠ABD'), k(p30, '∠CAE')].sort());
});

test('図の選択領域：角・辺の候補が重ならず、角の操作領域が小さすぎない（p25〜p30）', () => {
  NEW.forEach((p) => {
    const els = geo.getElements(p.figure);
    els.angles.forEach((a) => {
      [true, false].forEach((only) => assert.ok(geo.angleHitRadius(p.figure, a, only) >= 18, p.id + ' ∠' + a.name));
      const R = geo.angleHitRadius(p.figure, a, true);
      const q = geo.vec.add(a.vertex, geo.vec.mul(geo.bisector(a.vertex, a.from, a.to), R * 0.6));
      assert.deepEqual(geo.angleCandidates(p.figure, q, true), [a.key], p.id + ' ∠' + a.name);
    });
    els.segments.forEach((s) => {
      assert.deepEqual(geo.segmentCandidates(p.figure, geo.vec.lerp(s.h1, s.h2, 0.5)), [s.key], p.id + ' ' + s.name);
    });
    // 直角の根拠・鋭角の根拠の角は、図で選べる
    p.evidence.forEach((ev) => ev.items.forEach((n) => assert.ok(els.byKey[k(p, n)], p.id + ' ' + n)));
  });
});

// =====================================================================================
// 26-5 段位認定の2コース
// =====================================================================================

const BASIC = TR.pool('basic');
const COMP = TR.pool('comprehensive');

test('2つのコースの定義（表示名・説明・出題範囲）', () => {
  assert.deepEqual(TR.ORDER, ['basic', 'comprehensive']);
  assert.equal(TR.get('basic').label, '基本の合同証明');
  assert.equal(TR.get('basic').desc, '3つの合同条件と基本的な辺・角の性質に挑戦！');
  assert.equal(TR.get('comprehensive').label, '総合証明');
  assert.equal(TR.get('comprehensive').desc, '二等辺三角形・直角三角形など、いろいろな証明に挑戦！');
  // 総合証明は基本の範囲をすべてふくむ
  TR.get('basic').allowedTopics.forEach((t) => assert.ok(TR.get('comprehensive').allowedTopics.includes(t), t));
  // まだ実装していない単元（平行四辺形など）はどちらのコースにもない
  ['basic', 'comprehensive'].forEach((id) => assert.ok(!TR.get(id).allowedTopics.some((t) => /parallelogram/.test(t))));
});

test('出題範囲はステージ番号ではなく、必要な知識（topics）で決まる', () => {
  // 問題の topics は、合同条件・根拠の理由・推論ルールから求まる
  assert.deepEqual(TR.problemTopics(P('p01')).sort(), ['basicCongruence', 'common', 'given', 'triangleCorrespondence']);
  assert.ok(TR.problemTopics(P('p21')).includes('isosceles'));
  assert.ok(TR.problemTopics(P('p23')).includes('equilateral'));
  assert.ok(TR.problemTopics(P('p23')).includes('angleExpressions'));
  assert.ok(TR.problemTopics(P('p25')).includes('rightTriangleRHS'));
  assert.ok(TR.problemTopics(P('p26')).includes('rightTriangleRHA'));
  assert.ok(TR.problemTopics(P('p28')).includes('square'));
  // STAGE 6 以下でも、範囲外の知識を使う問題（仮に二等辺三角形の定理を使うようにした問題）は基本コースに入らない
  const fake = variant(P('p01'), { evidence: P('p01').evidence.map((ev, i) => (i === 0 ? Object.assign({}, ev, { reason: 'isoscelesBaseAngles' }) : ev)) });
  assert.ok(!TR.problemTopics(fake).every((t) => TR.get('basic').allowedTopics.includes(t)));
  // 知らない理由・ルールは unknown として、どのコースにも入らない
  const unknown = variant(P('p01'), { evidence: P('p01').evidence.map((ev, i) => (i === 0 ? Object.assign({}, ev, { reason: 'parallelogramSides' }) : ev)) });
  assert.ok(TR.problemTopics(unknown).includes('unknown:parallelogramSides'));
  assert.equal(TR.allows('comprehensive', { requiredTopics: TR.problemTopics(unknown) }), false);
  // requiredTopics のない問題は出題しない
  assert.equal(TR.allows('basic', { requiredTopics: [] }), false);
});

test('基本コース：二等辺三角形・正三角形・三段論法・直角三角形の問題が混ざらない', () => {
  const banned = ['isosceles', 'equilateral', 'angleExpressions', 'rightTriangle', 'rightTriangleRHA', 'rightTriangleRHS', 'square'];
  assert.ok(BASIC.length >= 100, String(BASIC.length));
  BASIC.forEach((q) => {
    assert.ok(q.requiredTopics.every((t) => TR.get('basic').allowedTopics.includes(t)), q.id);
    assert.ok(!q.requiredTopics.some((t) => banned.includes(t)), q.id);
    assert.ok(!['theorem', 'right'].includes(q.category), q.id);
    // 元の問題も、二等辺三角形・正三角形・三段論法・直角三角形を使わない
    const p = P(q.sourceId);
    assert.ok(p, q.id);
    assert.ok(!p.proofSteps, q.id);
    assert.ok(!PH.isRightProblem(p), q.id);
    assert.ok(!p.evidence.some((ev) => ['isoscelesBaseAngles', 'equilateralSides', 'proved', 'perpendicular', 'squareAngle', 'squareSides'].includes(ev.reason)), q.id);
    // 選択肢にも直角三角形の合同条件は出ない
    (q.choice ? q.choice.blanks[0].choices : []).forEach((c) => assert.ok(!/直角三角形/.test(c.text), q.id + ' ' + c.text));
  });
  // 基本のカテゴリはすべてある
  ['eq', 'reason', 'cond', 'corr', 'final'].forEach((c) => assert.ok(BASIC.some((q) => q.category === c), c));
});

test('総合コース：基本の問題すべてに、実装ずみの新しい単元（二等辺三角形・正三角形・三段論法・直角三角形）を加える', () => {
  BASIC.forEach((q) => assert.ok(COMP.includes(q), q.id));
  ['theorem', 'right'].forEach((c) => assert.ok(COMP.some((q) => q.category === c), c));
  ['p21', 'p22', 'p23', 'p24', 'p25', 'p26', 'p27', 'p28', 'p29', 'p30'].forEach((id) => assert.ok(COMP.some((q) => q.sourceId === id), id));
  ['isosceles', 'equilateral', 'angleExpressions', 'rightTriangleRHA', 'rightTriangleRHS', 'square'].forEach((t) => {
    assert.ok(COMP.some((q) => q.requiredTopics.includes(t)), t);
  });
  // 総合コースでも、範囲外の知識が必要な問題は出ない
  COMP.forEach((q) => assert.ok(TR.allows('comprehensive', q), q.id));
});

test('直角三角形のミニ問題（タイプA〜E）：正解が1つに決まる', () => {
  const byType = (t) => COMP.filter((q) => q.type === t);
  // タイプA・D：合同条件
  const rhs = COMP.find((q) => q.id === 'rule-rhs'), rha = COMP.find((q) => q.id === 'rule-rha');
  assert.equal(rhs.answerText, PH.CONDITIONS.RHS.label);
  assert.equal(rha.answerText, PH.CONDITIONS.RHA.label);
  // タイプB：斜辺（直角に向かい合う辺。選択肢の残りは直角をはさむ辺）
  assert.equal(byType('hypotenuse').length, 12);
  byType('hypotenuse').forEach((q) => {
    const p = P(q.sourceId);
    const choices = q.choice.blanks[0].choices;
    const ans = choices.find((c) => c.id === q.choice.blanks[0].answer);
    assert.equal(geo.segKey(ans.text), geo.segKey(RT.hypotenuse(p, q.hypIndex)), q.id);
    choices.filter((c) => c !== ans).forEach((c) => assert.ok(c.text.includes(RT.rightVertex(p, q.hypIndex)), q.id + ' ' + c.text));
  });
  // タイプC：直角の理由（「仮定より」は誤答に使わない：垂直・正方形は仮定に書かれているので）
  byType('rightReason').forEach((q) => {
    const choices = q.choice.blanks[0].choices.map((c) => c.text);
    assert.ok(!choices.includes('仮定より'), q.id);
    assert.ok(choices.includes(PH.REASONS[RT.rightEvidence(P(q.sourceId)).reason].proof), q.id);
  });
  assert.deepEqual(byType('rightReason').map((q) => q.sourceId), ['p27', 'p28', 'p29', 'p30']);
  // タイプE：あと何が必要？
  assert.equal(COMP.find((q) => q.id === 'rule-need-rhs').answerText, '対応する他の1辺');
  assert.equal(COMP.find((q) => q.id === 'rule-need-rha').answerText, '対応する1つの鋭角');
  // 直角三角形の問題の「合同条件」の問題：誤答は、もう一方の直角三角形の条件と、合同条件ではない文（3つの合同条件は誤答にしない）
  COMP.filter((q) => q.type === 'condition' && PH.isRightProblem(P(q.sourceId))).forEach((q) => {
    const texts = q.choice.blanks[0].choices.map((c) => c.text);
    ['SSS', 'SAS', 'ASA'].forEach((c) => assert.ok(!texts.includes(PH.CONDITIONS[c].label), q.id));
    assert.ok(texts.includes(PH.CONDITIONS[val.deriveCondition(P(q.sourceId), P(q.sourceId).evidence)].label));
  });
  // 選択肢の重複がない
  COMP.filter((q) => q.choice).forEach((q) => {
    const texts = q.choice.blanks[0].choices.map((c) => c.text);
    assert.equal(new Set(texts).size, texts.length, q.id);
  });
});

function play(track, seed, count) {
  const g = new PH.RankGame({ seed, track });
  g.start(0);
  const out = [];
  for (let i = 0; i < count && g.state === 'play'; i++) {
    const c = g.current;
    out.push(c);
    if (c.mode === 'input') g.submit(i, c.q.input.answerText.split('／')[0].replace(/[△]/g, '').replace('と', '/').replace('＝', '='));
    else c.blanks.forEach((b, j) => g.choose(j, b.answer, i));
  }
  return { g, out };
}

test('どちらのコースでも、出題はコースの範囲内。1〜10問目は選択式で、序盤は易しい問題から', () => {
  ['basic', 'comprehensive'].forEach((track) => {
    for (let seed = 1; seed <= 15; seed++) {
      const { g, out } = play(track, seed, 40);
      assert.equal(g.track, track);
      out.forEach((c) => {
        assert.ok(TR.allows(track, c.q), track + ' ' + c.q.id);
        if (c.no <= CFG.selectZoneCount) assert.equal(c.mode, 'choice');
        if (c.no <= 3) assert.equal(c.q.difficulty, 1, track + ' seed ' + seed + ' Q' + c.no);
      });
      assert.equal(new Set(out.map((c) => c.q.id)).size, out.length, track + ' seed ' + seed + ' 重複なし');
    }
  });
});

test('総合コースの出題バランス：直角三角形・定理の問題ばかりにならない', () => {
  let right = 0, theorem = 0, total = 0;
  for (let seed = 1; seed <= 30; seed++) {
    const { out } = play('comprehensive', seed, 30);
    out.forEach((c) => { total++; if (c.q.category === 'right') right++; if (c.q.category === 'theorem') theorem++; });
    // 最初の10問で、基本のカテゴリ（等しい辺・角／理由／合同条件／合同からの結論）は出る
    const first = new Set(out.slice(0, 10).map((c) => c.q.category));
    ['eq', 'reason', 'cond', 'final'].forEach((cat) => assert.ok(first.has(cat), 'seed ' + seed + ' ' + cat));
  }
  assert.ok(right > 0 && theorem > 0);
  assert.ok(right / total <= 0.2, '直角三角形 ' + (right / total).toFixed(2));
  assert.ok(theorem / total <= 0.2, '定理 ' + (theorem / total).toFixed(2));
  // 基本コースには出ない
  for (let seed = 1; seed <= 10; seed++) {
    assert.ok(!play('basic', seed, 30).out.some((c) => c.q.category === 'right' || c.q.category === 'theorem'));
  }
});

test('どちらのコースでも、120秒制限・誤答の時間ペナルティ・21段階の段位は同じ', () => {
  ['basic', 'comprehensive'].forEach((track) => {
    const g = new PH.RankGame({ seed: 5, track });
    g.start(0);
    const wrong = (t) => { const c = g.current; return c.mode === 'input' ? g.submit(t, 'AB=AB') : g.choose(0, c.blanks[0].choices.find((x) => x.id !== c.blanks[0].answer).id, t); };
    assert.equal(wrong(1000).penaltyMs, 4000);
    assert.equal(g.pass(2000).penaltyMs, 8000);
    assert.equal(g.limit(), 120000 - 12000);
    g.tick(107999);
    assert.equal(g.state, 'play');
    g.tick(108000);
    assert.equal(g.state, 'over');
    assert.equal(g.result.track, track);
    assert.equal(g.result.misses, 2);
  });
  assert.equal(CFG.timeLimitMs, 120000);
  assert.equal(CFG.grades.length, 21);
  assert.equal(PH.rank.gradeFor(0).name, '10級');
  assert.equal(PH.rank.gradeFor(10).name, '初段');
  assert.equal(PH.rank.gradeFor(19).name, '十段');
  assert.equal(PH.rank.gradeFor(20).name, '皆伝');
});

test('コースを変えてもプレイ状態が混ざらない（別々のゲーム・別々の出題候補）', () => {
  const a = new PH.RankGame({ seed: 9, track: 'basic' });
  const b = new PH.RankGame({ seed: 9, track: 'comprehensive' });
  a.start(0); b.start(0);
  assert.notEqual(a.picker.pool, b.picker.pool);
  assert.equal(a.picker.pool.length, BASIC.length);
  assert.equal(b.picker.pool.length, COMP.length);
  a.pass(10);
  assert.equal(a.misses, 1);
  assert.equal(b.misses, 0);
  assert.equal(a.wrongs[0].track, 'basic');
  // 知らないコース名はコースなし（すべての問題）として扱い、止まらない
  const c = new PH.RankGame({ seed: 1, track: 'xxx' });
  assert.equal(c.track, null);
  c.start(0);
  assert.ok(c.current);
});

// =====================================================================================
// 26-6 記録と移行
// =====================================================================================

test('2つのコースの記録（最高段位・正解数・挑戦回数・コンボ・誤答履歴）は独立している', () => {
  withFakeStorage(null, () => {
    const S = PH.storage;
    assert.equal(S.getRank('basic').best, null);                    // 未挑戦は未認定（10級とは区別）
    assert.equal(S.getRank('comprehensive').best, null);
    assert.equal(S.getRank('basic').playCount, 0);
    S.recordRank(result({ track: 'comprehensive', correct: 12, rank: 12, rankName: '三段', effectiveScore: 12, maxCombo: 9, wrongs: [{ qid: 'rule-rhs', track: 'comprehensive' }] }));
    assert.equal(S.getRank('basic').best, null);
    assert.equal(S.getRank('basic').playCount, 0);
    assert.deepEqual(S.getRank('basic').lastReview, []);
    assert.equal(S.getRank('comprehensive').best.rankName, '三段');
    assert.equal(S.getRank('comprehensive').bestCombo, 9);
    assert.equal(S.getRank('comprehensive').lastReview.length, 1);
    S.recordRank(result({ correct: 17, rank: 17, rankName: '八段', effectiveScore: 17, maxCombo: 4 }), 'basic');
    S.recordRank(result({ correct: 3, rank: 3, rankName: '7級', effectiveScore: 3, maxCombo: 1 }), 'basic');
    assert.equal(S.getRank('basic').best.rankName, '八段');          // 下がらない
    assert.equal(S.getRank('basic').playCount, 2);
    assert.equal(S.getRank('basic').bestCorrect, 17);
    assert.equal(S.getRank('basic').bestCombo, 4);
    assert.equal(S.getRank('comprehensive').best.rankName, '三段');  // 基本の結果は総合に反映されない
    assert.equal(S.getRank('comprehensive').playCount, 1);
    assert.equal(S.getRank('comprehensive').bestCorrect, 12);
    // 10級（0問）で認定された記録と、未挑戦（未認定）は区別できる
    S.recordRank(result({ correct: 0, rank: 0, rankName: '10級', effectiveScore: 0, maxCombo: 0 }), 'comprehensive');
    assert.equal(S.getRank('comprehensive').best.rankName, '三段');
    withFakeStorage(null, () => {
      PH.storage.recordRank(result({ correct: 0, rank: 0, rankName: '10級', effectiveScore: 0, maxCombo: 0 }), 'basic');
      assert.equal(PH.storage.getRank('basic').best.rankName, '10級');
      assert.equal(PH.storage.getRank('comprehensive').best, null);
    });
  });
});

test('Ver.0.7 までの段位認定の記録は legacy に残し、新しい2コースは未認定から始まる（二重に移行しない）', () => {
  const v07 = JSON.stringify({
    version: 5,
    problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 }, p22: { cleared: true, bestStars: 2, minMisses: 1 } },
    puzzleLevels: { easy: { p23: { cleared: true, bestStars: 3, minMisses: 0 } }, standard: {}, challenge: { p05: { cleared: true, bestStars: 1, minMisses: 3 } } },
    puzzleLevel: 'standard', puzzleMigrated: true, sound: true,
    rankCertification: {
      criteriaVersion: 2, best: { rank: 14, rankName: '五段', effectiveScore: 14, correct: 14, maxCombo: 6, at: '2026-10-01T00:00:00.000Z' },
      bestCorrect: 14, bestEffectiveScore: 14, bestCombo: 6, playCount: 7,
      lastResult: { correct: 11, rankName: '二段' }, lastReview: [{ qid: 'p01-cond' }], previous: [],
    },
  });
  withFakeStorage(v07, (mem) => {
    const S = PH.storage;
    const legacy = S.getRankLegacy();
    assert.equal(legacy.best.rankName, '五段');
    assert.equal(legacy.bestCorrect, 14);
    assert.equal(legacy.playCount, 7);
    assert.equal(legacy.lastReview.length, 1);
    ['basic', 'comprehensive'].forEach((id) => {
      assert.equal(S.getRank(id).best, null, id);                     // 新しいコースに勝手に変換しない
      assert.equal(S.getRank(id).playCount, 0, id);
      assert.equal(S.getRank(id).lastResult, null, id);
    });
    // ハンター・パズルの記録は変わらない
    assert.equal(S.getProblem('p01').bestStars, 3);
    assert.equal(S.getProblem('p22').bestStars, 2);
    assert.equal(S.getProblem('p23', 'puzzle:easy').bestStars, 3);
    assert.equal(S.getProblem('p05', 'puzzle:challenge').bestStars, 1);
    assert.equal(S.getPuzzleLevel(), 'standard');
    // 新しいコースで挑戦して保存 → 読み直しても legacy はそのまま、二重に移行しない
    S.recordRank(result({ track: 'basic' }));
    const saved = JSON.parse(mem[S.KEY]);
    assert.equal(saved.rankCertification.format, 2);
    assert.equal(saved.rankCertification.legacy.best.rankName, '五段');
    assert.equal(saved.rankCertification.tracks.basic.best.rankName, '六段');
    assert.equal(saved.rankCertification.tracks.comprehensive.best, null);
    assert.equal(saved.problems.p01.bestStars, 3);
    PH.storage._reset();
    assert.equal(S.getRankLegacy().best.rankName, '五段');
    assert.equal(S.getRankLegacy().playCount, 7);
    assert.equal(S.getRank('basic').best.rankName, '六段');
    assert.equal(S.getRank('basic').playCount, 1);
    assert.equal(S.getRank('comprehensive').best, null);
    S.recordRank(result({ track: 'comprehensive', rankName: '初段', rank: 10, correct: 10, effectiveScore: 10 }));
    PH.storage._reset();
    assert.equal(S.getRankLegacy().playCount, 7);                     // 何度読み直しても同じ
    assert.equal(S.getRank('basic').playCount, 1);
    assert.equal(S.getRank('comprehensive').playCount, 1);
  });
});

test('段位認定の記録がない・壊れている保存データでも起動でき、legacy は作らない', () => {
  [null, '{not json', JSON.stringify({ rankCertification: 'x' }), JSON.stringify({ rankCertification: { best: 5, playCount: -3 } }),
    JSON.stringify({ rankCertification: { tracks: 'x', legacy: 3 } }), JSON.stringify({ rankCertification: { tracks: { basic: { best: { rank: 'x' } } } } })].forEach((raw) => {
    withFakeStorage(raw, () => {
      const S = PH.storage;
      assert.equal(S.getRankLegacy(), null, String(raw));
      ['basic', 'comprehensive'].forEach((id) => assert.equal(S.getRank(id).best, null, String(raw)));
      S.recordRank(result(), 'comprehensive');
      assert.equal(S.getRank('comprehensive').best.rankName, '六段');
      assert.equal(S.getRank('basic').best, null);
    });
  });
});
