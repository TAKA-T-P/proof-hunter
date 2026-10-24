// 証明ハンター Ver.1.2 のテスト（証明の間違い探し：ランダム5問チャレンジ・2コース・誤りバリエーション）
//   コース分類／バリエーション（数学的な検証）／ランダム出題（シード・重複・履歴）／ゲーム進行／コース別記録／振り返り／回帰
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
require('../js/error-hunt-data.js');
require('../js/error-hunt-generator.js');
require('../js/error-hunt-game.js');
require('../js/error-hunt-variants.js');
require('../js/error-hunt-challenge.js');

const PH = globalThis.PH;
const E = PH.errorHunt;
const V = PH.errorVariants;
const C = PH.errorChallenge;
const ALL = V.all();
const BASES = PH.ERROR_HUNT_PROBLEMS;

function withFakeStorage(initial, fn) {
  const mem = initial == null ? {} : { [PH.storage.KEY]: initial };
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

// 基本の合同証明で出してはいけない知識（二等辺三角形・正三角形・直角三角形・平行四辺形・特別な平行四辺形・三段論法 など）
const ADVANCED = ['isosceles', 'equilateral', 'angleExpressions', 'square', 'rightTriangle', 'rightTriangleRHA', 'rightTriangleRHS',
  'parallelogramProperties', 'parallelogramConditions', 'diagonalBisector', 'parallelConverse', 'rhombus', 'rectangle', 'quadrilateralClassification'];

// チャレンジを最後まで進める（answers[i] が true なら正解の行、false なら別の行を選ぶ）
function playThrough(session, answers) {
  answers.forEach((ok, i) => {
    const q = session.current();
    assert.ok(q, 'Q' + (i + 1));
    const steps = E.build(q.def).steps;
    const pickId = ok ? q.target : steps.find((s) => s.id !== q.target).id;
    session.answer(pickId);
    session.next();
  });
  return session;
}

// =====================================================================================
// コース分類
// =====================================================================================

test('コースIDと表示名は段位認定と共通（基本の合同証明・総合証明）', () => {
  assert.deepEqual(C.ORDER, ['basic', 'comprehensive']);
  assert.equal(C.course('basic').label, '基本の合同証明');
  assert.equal(C.course('comprehensive').label, '総合証明');
  assert.equal(C.course('basic').label, PH.rankTracks.get('basic').label);
  assert.equal(C.course('comprehensive').label, PH.rankTracks.get('comprehensive').label);
  assert.equal(C.course('legacy'), null);
  assert.equal(C.isCourse('x'), false);
});

test('基本コースには基本の合同証明だけ。特殊な図形の性質・直角三角形の合同条件は混入しない', () => {
  const pool = C.pool('basic');
  pool.forEach((e) => e.variants.forEach((d) => {
    const t = V.topics(d);
    ADVANCED.forEach((a) => assert.ok(t.indexOf(a) < 0, d.key + ' に ' + a));
    assert.ok(PH.rankTracks.allows('basic', { requiredTopics: t }), d.key);
    // 間違いとして使う理由・条件も基本の範囲（RHA・RHS・二等辺三角形の定理などを誤答に使わない）
    const m = d.mutation;
    if (m.condition) assert.ok(['SSS', 'SAS', 'ASA'].indexOf(m.condition) >= 0, d.key);
    if (m.rule) assert.fail(d.key + ' 推論ルールの間違いは基本コースに入れない');
  }));
  // 単元は「基本の合同証明」「合同から結論を導く」だけ
  pool.forEach((e) => assert.ok(['basic', 'conclusion'].indexOf(e.base.unit) >= 0, e.base.id));
});

test('基本コースのベース問題は5問以上（15問以上を確保）。総合コースは全範囲（30問・4単元）', () => {
  const b = C.pool('basic'), c = C.pool('comprehensive');
  assert.ok(b.length >= 5);
  assert.ok(b.length >= 15, '基本 ' + b.length);
  assert.equal(c.length, 30);
  assert.deepEqual([...new Set(c.map((e) => e.base.unit))].sort(), ['basic', 'conclusion', 'quadrilateral', 'triangle']);
  // 総合コースはすべてのバリエーションを出題できる
  assert.equal(c.reduce((n, e) => n + e.variants.length, 0), ALL.length);
});

test('requiredTopics：元の問題の知識 ∪ 間違いに使った理由・条件・ルールの知識 ∪ バリエーションの指定', () => {
  // 元の問題が基本でも、間違いに直角三角形の合同条件を使えば基本コースから外れる
  const base = V.def('eh-p01-cong', 'original');
  const rha = Object.assign({}, base, { mutation: { target: 'condition', field: 'condition', condition: 'RHA' } });
  assert.ok(V.topics(rha).indexOf('rightTriangle') >= 0);
  assert.deepEqual(V.courses(rha), ['comprehensive']);
  // 二等辺三角形の定理を理由に使う間違い → 総合だけ
  const iso = Object.assign({}, base, { mutation: { target: 'e1', field: 'reason', reason: 'isoscelesBaseAngles' } });
  assert.deepEqual(V.courses(iso), ['comprehensive']);
  // バリエーションに requiredTopics を個別に設定できる
  const extra = Object.assign({}, base, { requiredTopics: ['parallelogramProperties'] });
  assert.deepEqual(V.courses(extra), ['comprehensive']);
  // 元の問題の知識だけで基本の範囲なら、基本・総合の両方
  assert.deepEqual(V.courses(base), ['basic', 'comprehensive']);
  // 元の問題が総合（二等辺三角形）なら、基本的な間違いでも基本コースには入らない
  assert.deepEqual(V.courses(V.def('eh-p21-theorem', 'condition-cong')), ['comprehensive']);
  // 知らない理由は 'unknown:' で、どのコースにも入らない
  const unk = Object.assign({}, base, { mutation: { target: 'e1', field: 'reason', reason: 'nope' } });
  assert.deepEqual(V.courses(unk), []);
});

// =====================================================================================
// バリエーション
// =====================================================================================

test('既存30問をベース問題として使う（ID・番号は Ver.1.1 のまま）。最初のバリエーションは既存の問題そのもの', () => {
  assert.equal(BASES.length, 30);
  BASES.forEach((b) => {
    const vs = V.list(b.id);
    assert.equal(vs[0].variantId, 'original');
    assert.deepEqual(vs[0].mutation, b.mutation);
    assert.equal(vs[0].category, b.category);
    assert.equal(vs[0].explain, b.explain);
    assert.equal(vs[0].id, b.id);
    assert.equal(vs[0].no, b.no);
  });
});

test('バリエーションは90種類以上。各ベース問題に3種類以上', () => {
  assert.ok(ALL.length >= 90, String(ALL.length));
  BASES.forEach((b) => assert.ok(V.list(b.id).length >= 3, b.id));
  assert.equal(new Set(ALL.map((d) => d.key)).size, ALL.length);
});

test('すべてのバリエーションの検証が通る（元の問題・変えるステップがあり、変えたステップが誤り）', () => {
  assert.deepEqual(V.verifyAll(), []);
  ALL.forEach((d) => {
    assert.ok(PH.getProblem(d.source), d.key);
    assert.ok(E.structure(PH.getProblem(d.source)).some((s) => s.id === d.mutation.target), d.key);
    assert.ok(E.CATEGORIES[d.category], d.key);
    assert.ok(d.explain && d.explain.length > 20, d.key);
  });
});

test('変更前の証明は正しい（ハンターの完成した証明と同じ・元の問題データの検証が通る）', () => {
  assert.deepEqual(PH.validation.verifyAll(PH.problems, PH.STAGES), []);
  ALL.forEach((d) => {
    const p = PH.getProblem(d.source);
    const pr = PH.buildProof(p);
    const text = E.build(d).correctSteps.map(E.stepText).join('\n');
    pr.lines.forEach((l) => assert.ok(text.indexOf(l.equation) >= 0, d.key + ' ' + l.equation));
  });
});

test('誤りは1か所：変わるのは1ステップだけ。正解の行は一意で、そこを直すと元の証明に戻る', () => {
  ALL.forEach((d) => {
    const b = E.build(d);
    const changed = b.steps.filter((s, i) => E.stepText(s) !== E.stepText(b.correctSteps[i]));
    assert.equal(changed.length, 1, d.key);
    assert.equal(changed[0].id, d.mutation.target, d.key);
    assert.equal(b.steps.filter((s) => s.id === b.target).length, 1, d.key);
    assert.equal(new Set(b.steps.map((s) => s.id)).size, b.steps.length, d.key);
    const fixed = b.steps.map((s) => (s.id === b.target ? b.right : s));
    assert.deepEqual(fixed.map(E.stepText), b.correctSteps.map(E.stepText), d.key);
    assert.ok(!/null|undefined/.test(E.stepText(b.wrong)), d.key);
  });
});

test('種類ごとに、既存の判定で本当に誤り（別の正しい理由・表記・合同条件を誤答にしない）', () => {
  const Val = PH.validation;
  const k = (p, n) => PH.geometry.elementKey(p.figure, n);
  ALL.forEach((d) => {
    const p = PH.getProblem(d.source);
    const m = d.mutation;
    if (d.category === 'wrongCongruence') {
      assert.notEqual(Val.deriveCondition(p, p.evidence), m.condition, d.key);
      assert.notEqual(p.congruence, m.condition, d.key);
    }
    if (d.category === 'wrongCorrespondence') assert.equal(Val.checkTriangles(p, m.triangles[0].split(''), m.triangles[1].split('')).status, 'order', d.key);
    if ((d.category === 'wrongReason' || d.category === 'wrongLogicalOrder') && /^e\d/.test(m.target)) {
      const ev = p.evidence.find((e) => e.id === m.target);
      assert.equal(Val.checkEvidence(p, ev.items.map((n) => k(p, n)), m.reason, []).status, 'wrong-reason', d.key);
      assert.ok(PH.acceptedReasons(ev).indexOf(m.reason) < 0, d.key);
    }
    if (d.category === 'wrongEquation' && m.items && /^e\d/.test(m.target)) {
      const ev = p.evidence.find((e) => e.id === m.target);
      const st = Val.checkEvidence(p, m.items.map((n) => k(p, n)), ev.reason, []).status;
      assert.ok(st !== 'correct' && st !== 'irrelevant', d.key + ' ' + st);
    }
  });
  // 正しい別表記（左右の入れかえ）や、もう1つの正しい理由は、検証で誤りとして認めない
  const b = V.def('eh-p01-cong', 'e2-eq');
  assert.ok(E.verify(Object.assign({}, b, { mutation: { target: 'e2', field: 'body', items: ['CD', 'AD'] } })).length > 0);
  assert.ok(E.verify(Object.assign({}, V.def('eh-p12-eq', 'e1-reason'), { mutation: { target: 'e2', field: 'reason', reason: 'midpoint' }, category: 'wrongReason' })).length > 0);
});

test('同じ証明でも、ちがう行・ちがう種類の誤りがある（行の位置を覚えるだけでは解けない）', () => {
  BASES.forEach((b) => {
    const vs = V.list(b.id);
    assert.equal(new Set(vs.map((d) => JSON.stringify(d.mutation))).size, vs.length, b.id);
    assert.ok(new Set(vs.map((d) => d.mutation.target)).size >= 2, b.id + ' 誤りの行が1つだけ');
  });
  // 6種類すべてのカテゴリーがあり、基本コースにも5種類（定理の間違い以外）がある
  const cats = new Set(ALL.map((d) => d.category));
  assert.deepEqual([...cats].sort(), Object.keys(E.CATEGORIES).sort());
  const basicCats = new Set(C.pool('basic').flatMap((e) => e.variants.map((d) => d.category)));
  ['wrongEquation', 'wrongReason', 'wrongCongruence', 'wrongCorrespondence', 'wrongLogicalOrder'].forEach((c) => assert.ok(basicCats.has(c), c));
});

test('じっくり練習：開くたびにバリエーションを選ぶ（直前と同じものは避ける）。★はベース問題IDで記録', () => {
  let seq = 0;
  const r = () => [0.1, 0.9, 0.4, 0.6][seq++ % 4];
  const seen = [];
  for (let i = 0; i < 8; i++) {
    const d = V.practice('eh-p01-cong', r);
    assert.equal(d.id, 'eh-p01-cong');
    if (seen.length) assert.notEqual(d.variantId, seen[seen.length - 1]);
    seen.push(d.variantId);
  }
  assert.ok(new Set(seen).size >= 3);
  // 同じ問題データ（画面の再描画）なら、バリエーションは変わらない
  const d = V.practice('eh-p02-reason', () => 0.5);
  const g = new PH.ErrorHuntGame(d);
  assert.equal(g.built.target, E.build(d).target);
  assert.equal(g.def.variantId, d.variantId);
});

// =====================================================================================
// ランダム出題
// =====================================================================================

test('basic・comprehensive でそれぞれ5問を抽出できる。1回の挑戦でベース問題は重複しない', () => {
  ['basic', 'comprehensive'].forEach((c) => {
    for (let seed = 1; seed <= 60; seed++) {
      const dr = C.draw(c, { seed });
      assert.equal(dr.items.length, 5, c + ' ' + seed);
      assert.equal(new Set(dr.items.map((it) => it.baseId)).size, 5, c + ' ' + seed);
      dr.items.forEach((it) => {
        const d = V.def(it.baseId, it.variantId);
        assert.ok(d, it.baseId + '/' + it.variantId);
        assert.ok(V.courses(d).indexOf(c) >= 0, c + ' にコース外の問題 ' + d.key);
      });
    }
  });
});

test('シードを固定すると同じ5問。別のシードでは出題が変わる', () => {
  ['basic', 'comprehensive'].forEach((c) => {
    const h = { recentVariants: { 'eh-p01-cong': ['e2-eq'] }, lastBases: ['eh-p01-cong'] };
    assert.deepEqual(C.draw(c, { seed: 12345, history: h }), C.draw(c, { seed: 12345, history: h }));
    const sets = new Set();
    for (let s = 1; s <= 20; s++) sets.add(JSON.stringify(C.draw(c, { seed: s }).items));
    assert.ok(sets.size >= 15, c + ' ' + sets.size);
  });
  // セッションも同じシードなら同じ問題
  const a = C.start('basic', null, 777), b = C.start('basic', null, 777);
  assert.deepEqual(a.items.map((q) => q.def.key), b.items.map((q) => q.def.key));
  assert.equal(a.seed, 777);
});

test('総合コースは4つの単元から1問ずつ以上。誤りの種類が極端に偏らない', () => {
  const catMax = [];
  for (let seed = 1; seed <= 100; seed++) {
    const dr = C.draw('comprehensive', { seed });
    const units = new Set(dr.items.map((it) => PH.getErrorProblem(it.baseId).unit));
    assert.equal(units.size, 4, 'seed ' + seed);
    const cats = {};
    dr.items.forEach((it) => { const c = V.def(it.baseId, it.variantId).category; cats[c] = (cats[c] || 0) + 1; });
    catMax.push(Math.max(...Object.values(cats)));
  }
  // 5問のうち同じ種類が4問以上になることはほとんどない
  assert.ok(catMax.filter((n) => n >= 4).length <= 3, JSON.stringify(catMax));
  const basic = [];
  for (let seed = 1; seed <= 100; seed++) {
    const cats = {};
    C.draw('basic', { seed }).items.forEach((it) => { const c = V.def(it.baseId, it.variantId).category; cats[c] = (cats[c] || 0) + 1; });
    basic.push(Math.max(...Object.values(cats)));
  }
  assert.ok(basic.filter((n) => n >= 4).length <= 3, JSON.stringify(basic));
});

test('直近と同じバリエーションは、ほかに候補があれば出さない（同じベース問題でも別の誤り）', () => {
  ['basic', 'comprehensive'].forEach((c) => {
    for (let seed = 1; seed <= 80; seed++) {
      const first = C.draw(c, { seed });
      const history = { recentVariants: {}, lastBases: [] };
      first.items.forEach((it) => { history.recentVariants[it.baseId] = [it.variantId]; });
      // 前回とまったく同じベース問題が出てもよいが、バリエーションは前回とちがう
      const again = C.draw(c, { seed, history });
      again.items.forEach((it) => {
        const prev = history.recentVariants[it.baseId];
        if (prev) assert.notEqual(it.variantId, prev[0], c + ' seed ' + seed + ' ' + it.baseId);
      });
    }
  });
  // すべての履歴を入れても動く（すべて直前に出ていても、別のバリエーションを選ぶ）
  const h = { recentVariants: {}, lastBases: [] };
  C.pool('basic').forEach((e) => { h.recentVariants[e.base.id] = [e.variants[0].variantId]; });
  C.draw('basic', { seed: 3, history: h }).items.forEach((it) => assert.notEqual(it.variantId, h.recentVariants[it.baseId][0]));
});

test('候補が足りなくても無限ループしない（あるだけ出題）。壊れた履歴でも動く', () => {
  const save = C.pool('basic').slice();
  const p = C.pool('basic');
  p.splice(3);                    // 候補を3問にする
  try {
    const dr = C.draw('basic', { seed: 9 });
    assert.equal(dr.items.length, 3);
    // バリエーションが1つしかないベース問題で、前回と同じでも出題できる
    p.splice(1);
    const only = p[0];
    const one = { base: only.base, variants: [only.variants[0]] };
    p[0] = one;
    const dr2 = C.draw('basic', { seed: 1, history: { recentVariants: { [only.base.id]: [only.variants[0].variantId] } } });
    assert.deepEqual(dr2.items, [{ baseId: only.base.id, variantId: only.variants[0].variantId }]);
  } finally {
    p.length = 0;
    save.forEach((e) => p.push(e));
  }
  assert.equal(C.draw('nope', { seed: 1 }).items.length, 0);
  assert.equal(C.start('nope'), null);
  ['x', null, { recentVariants: 'a', lastBases: 3 }, { recentVariants: { 'eh-p01-cong': 'e1' } }].forEach((h) => {
    assert.equal(C.draw('basic', { seed: 5, history: h }).items.length, 5);
  });
});

// =====================================================================================
// ゲーム進行
// =====================================================================================

test('1問につき1回だけ判定。正解20点・不正解0点。二重に確定しない', () => {
  const s = C.start('basic', null, 42);
  const q = s.current();
  assert.equal(s.answer(null).status, 'none');
  assert.equal(s.answer('nope').status, 'none');
  assert.equal(q.answered, false);
  const r = s.answer(q.target);
  assert.equal(r.status, 'correct');
  assert.equal(r.points, 20);
  assert.equal(s.score(), 20);
  // もう一度確定しても判定しない（別の行でも）
  const other = E.build(q.def).steps.find((x) => x.id !== q.target).id;
  assert.equal(s.answer(other).status, 'locked');
  assert.equal(s.score(), 20);
  assert.equal(q.selected, q.target);
  // 次の問題で不正解は0点
  assert.equal(s.next(), true);
  const q2 = s.current();
  const wrong = E.build(q2.def).steps.find((x) => x.id !== q2.target).id;
  const r2 = s.answer(wrong);
  assert.equal(r2.status, 'wrong');
  assert.equal(r2.points, 0);
  assert.equal(s.score(), 20);
});

test('答えていない問題は飛ばせない。5問終了で結果へ（100点満点）', () => {
  const s = C.start('comprehensive', null, 2024);
  assert.equal(s.next(), false);         // 未解答では進めない
  assert.equal(s.current().no, 1);
  playThrough(s, [true, true, false, true, true]);
  assert.equal(s.finished(), true);
  assert.equal(s.current(), null);
  assert.equal(s.score(), 80);
  assert.equal(s.maxScore(), 100);
  const res = s.result();
  assert.equal(res.course, 'comprehensive');
  assert.equal(res.seed, 2024);
  assert.equal(res.correct, 4);
  assert.equal(res.wrong, 1);
  assert.equal(res.items.length, 5);
  assert.deepEqual(res.items.map((it) => it.correct), [true, true, false, true, true]);
  assert.equal(s.answer('intro').status, 'locked');
  assert.equal(C.message(100), 'PERFECT！ 証明の達人！');
  assert.equal(C.message(80), 'EXCELLENT！ 見直し上手！');
  assert.equal(C.message(60), 'GOOD！ あと一歩！');
  assert.equal(C.message(40), '間違いを見抜く力を磨こう！');
  assert.equal(C.message(0), '間違いを見抜く力を磨こう！');
});

test('途中終了は記録しない。チャレンジの状態は保存しない（再読み込みで再開しない）', () => {
  withFakeStorage(null, (mem) => {
    const s = C.start('basic', PH.storage.getErrorChallengeHistory('basic'), 5);
    s.answer(s.current().target);
    s.next();
    s.abort();
    assert.equal(s.current(), null);
    assert.equal(s.finished(), false);
    assert.equal(s.answer('intro').status, 'locked');
    const r = PH.storage.getErrorChallenge('basic');
    assert.equal(r.playCount, 0);
    assert.equal(r.bestScore, null);
    // 保存データにチャレンジ途中の状態は入らない
    const raw = mem[PH.storage.KEY];
    assert.ok(!raw || !/"session"|"index"/.test(raw));
  });
});

// =====================================================================================
// コース別の記録
// =====================================================================================

test('未挑戦は bestScore null（0点と区別）。記録すると最高得点・挑戦回数・直近結果が保存される', () => {
  withFakeStorage(null, (mem) => {
    const S = PH.storage;
    ['basic', 'comprehensive'].forEach((c) => {
      const r = S.getErrorChallenge(c);
      assert.equal(r.bestScore, null);
      assert.equal(r.playCount, 0);
      assert.equal(r.lastResult, null);
    });
    // 0点でも初挑戦の記録は 0点（未挑戦ではない）
    const s0 = playThrough(C.start('basic', null, 11), [false, false, false, false, false]);
    const sv0 = S.recordErrorChallenge('basic', s0.result());
    assert.deepEqual(sv0, { newBest: false, firstTime: true, bestScore: 0 });
    assert.equal(S.getErrorChallenge('basic').bestScore, 0);
    // 最高得点の更新
    const s1 = playThrough(C.start('basic', S.getErrorChallengeHistory('basic'), 12), [true, true, true, false, true]);
    assert.equal(S.recordErrorChallenge('basic', s1.result()).newBest, true);
    // 低い得点では最高得点は下がらない
    const s2 = playThrough(C.start('basic', S.getErrorChallengeHistory('basic'), 13), [true, false, false, false, false]);
    assert.equal(S.recordErrorChallenge('basic', s2.result()).newBest, false);
    const r = S.getErrorChallenge('basic');
    assert.equal(r.bestScore, 80);
    assert.equal(r.playCount, 3);
    assert.equal(r.lastResult.score, 20);
    assert.equal(r.lastResult.seed, 13);
    assert.equal(r.lastResult.items.length, 5);
    assert.equal(r.lastResult.newBest, false);
    const saved = JSON.parse(mem[S.KEY]);
    assert.equal(saved.errorHunt.challenge.basic.bestScore, 80);
  });
});

test('basic と comprehensive の記録は完全に別。段位認定・じっくり練習の記録にも影響しない', () => {
  withFakeStorage(null, () => {
    const S = PH.storage;
    S.recordError('eh-p01-cong', { stars: 3, misses: 0, solvedByUser: true });
    S.recordRank({ rank: 5, rankName: '5級', effectiveScore: 8, correct: 8, misses: 0, passes: 0, maxCombo: 3, criteriaVersion: PH.rank.config.criteriaVersion, wrongs: [] }, 'basic');
    const rankBefore = JSON.stringify([S.getRank('basic'), S.getRank('comprehensive')]);
    const sb = playThrough(C.start('basic', null, 21), [true, true, true, true, true]);
    S.recordErrorChallenge('basic', sb.result());
    assert.equal(S.getErrorChallenge('basic').bestScore, 100);
    assert.equal(S.getErrorChallenge('comprehensive').bestScore, null);
    assert.equal(S.getErrorChallenge('comprehensive').playCount, 0);
    const sc = playThrough(C.start('comprehensive', null, 22), [true, false, true, false, false]);
    S.recordErrorChallenge('comprehensive', sc.result());
    assert.equal(S.getErrorChallenge('basic').bestScore, 100);
    assert.equal(S.getErrorChallenge('basic').playCount, 1);
    assert.equal(S.getErrorChallenge('comprehensive').bestScore, 40);
    // 直近の結果も混ざらない
    assert.equal(S.getErrorChallenge('basic').lastResult.seed, 21);
    assert.equal(S.getErrorChallenge('comprehensive').lastResult.seed, 22);
    // 履歴もコースごと
    const hb = S.getErrorChallengeHistory('basic'), hc = S.getErrorChallengeHistory('comprehensive');
    assert.deepEqual(hb.lastBases, sb.result().items.map((it) => it.baseId));
    assert.deepEqual(hc.lastBases, sc.result().items.map((it) => it.baseId));
    // ほかのモードの記録は変わらない
    assert.equal(JSON.stringify([S.getRank('basic'), S.getRank('comprehensive')]), rankBefore);
    assert.equal(S.getErrorRecord('eh-p01-cong').bestStars, 3);
    assert.equal(S.recordErrorChallenge('nope', sb.result()), null);
  });
});

test('直近のバリエーション履歴は少量（ベース問題ごとに3つまで）で、抽選に使われる', () => {
  withFakeStorage(null, () => {
    const S = PH.storage;
    for (let i = 0; i < 12; i++) {
      const s = playThrough(C.start('basic', S.getErrorChallengeHistory('basic'), 100 + i), [true, true, true, true, true]);
      S.recordErrorChallenge('basic', s.result());
      const h = S.getErrorChallengeHistory('basic');
      // 抽選した5問は、前回の履歴の先頭とはちがうバリエーション
      Object.keys(h.recentVariants).forEach((id) => {
        assert.ok(h.recentVariants[id].length <= 3);
        assert.equal(new Set(h.recentVariants[id]).size, h.recentVariants[id].length);
      });
    }
  });
});

test('旧データ（Ver.1.1：challenge なし）を読める。★評価・段位認定はそのまま。壊れた値は未挑戦', () => {
  const old = JSON.stringify({
    version: 6, problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 } }, puzzleLevel: 'challenge', puzzleMigrated: true, sound: true,
    rankCertification: { format: 2, tracks: { comprehensive: { criteriaVersion: 2, best: { rank: 10, rankName: '初段' }, playCount: 2 } } },
    errorHunt: { problems: { 'eh-p05-cong': { completed: true, solvedByUser: true, bestStars: 2, minMisses: 1, attempts: 4 } }, lastId: 'eh-p05-cong' },
  });
  withFakeStorage(old, (mem) => {
    const S = PH.storage;
    assert.deepEqual(S.getErrorRecord('eh-p05-cong'), { completed: true, solvedByUser: true, bestStars: 2, minMisses: 1, attempts: 4 });
    assert.equal(S.getErrorChallenge('basic').bestScore, null);
    const s = playThrough(C.start('comprehensive', null, 1), [true, true, true, true, false]);
    S.recordErrorChallenge('comprehensive', s.result());
    const saved = JSON.parse(mem[S.KEY]);
    assert.equal(saved.errorHunt.problems['eh-p05-cong'].bestStars, 2);
    assert.equal(saved.errorHunt.lastId, 'eh-p05-cong');
    assert.equal(saved.rankCertification.tracks.comprehensive.best.rankName, '初段');
    assert.equal(saved.problems.p01.bestStars, 3);
    assert.equal(saved.errorHunt.challenge.comprehensive.bestScore, 80);
  });
  const broken = JSON.stringify({ errorHunt: { problems: {}, challenge: { basic: { bestScore: 'x', playCount: -3, lastResult: { score: 500, items: 'a' }, recentVariants: { a: 'b', c: [1, 'v', 'w', 'x', 'y'] }, lastBases: 'z' }, comprehensive: 7 } } });
  withFakeStorage(broken, () => {
    const r = PH.storage.getErrorChallenge('basic');
    assert.equal(r.bestScore, null);
    assert.equal(r.playCount, 0);
    assert.equal(r.lastResult, null);
    assert.deepEqual(r.recentVariants, { c: ['v', 'w', 'x'] });
    assert.deepEqual(r.lastBases, []);
    assert.equal(PH.storage.getErrorChallenge('comprehensive').bestScore, null);
    assert.doesNotThrow(() => PH.storage.recordErrorChallenge('basic', playThrough(C.start('basic', PH.storage.getErrorChallengeHistory('basic'), 3), [true, true, true, true, true]).result()));
  });
});

// =====================================================================================
// 振り返り
// =====================================================================================

test('振り返り：保存したバリエーションIDから、出題時と同じ証明文・選んだ行・正解の行を再現する', () => {
  withFakeStorage(null, () => {
    const s = C.start('comprehensive', null, 31415);
    const shown = s.items.map((q) => E.build(q.def).steps.map(E.stepText));
    playThrough(s, [false, true, false, true, true]);
    const res = s.result();
    PH.storage.recordErrorChallenge('comprehensive', res);
    // 別のコースの挑戦をしても混ざらない
    PH.storage.recordErrorChallenge('basic', playThrough(C.start('basic', null, 2), [true, true, true, true, true]).result());
    const last = PH.storage.getErrorChallenge('comprehensive').lastResult;
    assert.equal(last.items.length, 5);
    last.items.forEach((it, i) => {
      const def = V.def(it.baseId, it.variantId);           // 再抽選しない
      const b = E.build(def);
      assert.deepEqual(b.steps.map(E.stepText), shown[i], 'Q' + it.no + ' の証明文');
      assert.equal(it.target, b.target);
      assert.equal(it.selected, res.items[i].selected);
      assert.equal(it.correct, res.items[i].correct);
      assert.ok(b.steps.some((x) => x.id === it.selected), '選んだ行が証明の中にある');
      // 正しい文・解説・正しい証明全文がある
      assert.notEqual(E.stepText(b.wrong), E.stepText(b.right));
      assert.ok(def.explain.length > 20);
      assert.ok(b.correctSteps.length >= 3);
    });
    assert.notEqual(PH.storage.getErrorChallenge('basic').lastResult.seed, last.seed);
  });
});

// =====================================================================================
// 回帰
// =====================================================================================

test('既存の50問・10ステージ・証明パズル3レベルは変わらない', () => {
  assert.equal(PH.problems.length, 50);
  assert.equal(PH.STAGES.length, 10);
  assert.deepEqual(PH.validation.verifyAll(PH.problems, PH.STAGES), []);
  assert.equal(PH.PUZZLE_LEVELS.length, 3);
  PH.problems.forEach((p) => PH.PUZZLE_LEVELS.forEach((lv) => assert.ok(new PH.Puzzle(p, lv.id), p.id + ' ' + lv.id)));
});

test('段位認定：449問・2コース・21段階のまま（間違い探しの問題は段位認定に入れない）', () => {
  assert.equal(PH.rankQuestions.all().length, 449);
  assert.deepEqual(PH.rankTracks.ORDER, ['basic', 'comprehensive']);
  assert.equal(PH.rank.config.grades.length, 21);
});

test('じっくり練習の30問（ID・番号・元の問題データの検証）は Ver.1.1 のまま', () => {
  assert.equal(BASES.length, 30);
  assert.deepEqual(E.verifyAll(BASES), []);
  assert.deepEqual(BASES.map((d) => d.no), Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, '0')));
  // ベース問題そのもの（Ver.1.1 の問題データ）でも、これまでどおり遊べる
  const g = new PH.ErrorHuntGame(PH.getErrorProblem('eh-p01-cong'));
  g.select('condition');
  assert.equal(g.confirm().status, 'correct');
});
