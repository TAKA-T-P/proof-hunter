// 証明ハンター Ver.1.1 のテスト（第4のモード「証明の間違い探し」）
//   問題データ（30問・元の問題・1か所だけの誤り）／正誤判定／★評価／保存／既存モードの回帰
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

const PH = globalThis.PH;
const E = PH.errorHunt;
const DEFS = PH.ERROR_HUNT_PROBLEMS;
const Game = PH.ErrorHuntGame;
const def = (id) => PH.getErrorProblem(id);

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

// まちがいの行（正解でない行）を1つ選ぶ
function otherStep(g, n) { return g.built.steps.filter((s) => s.id !== g.built.target)[n || 0].id; }

// =====================================================================================
// 問題データ
// =====================================================================================

test('間違い探しは30問。IDと番号は重複せず、番号は 01〜30 の連番', () => {
  assert.equal(DEFS.length, 30);
  assert.equal(new Set(DEFS.map((d) => d.id)).size, 30);
  assert.deepEqual(DEFS.map((d) => d.no), Array.from({ length: 30 }, (_, i) => String(i + 1).padStart(2, '0')));
});

test('30問すべてに有効な元の問題があり、変更するステップが存在する', () => {
  DEFS.forEach((d) => {
    const p = PH.getProblem(d.source);
    assert.ok(p, d.id + ' の元の問題');
    assert.ok(E.structure(p).some((s) => s.id === d.mutation.target), d.id + ' のステップ ' + d.mutation.target);
    assert.ok(E.build(d), d.id);
  });
});

test('すべての問題データの検証が通る（変えたステップが誤りで、ほかは正しい）', () => {
  assert.deepEqual(E.verifyAll(DEFS), []);
});

test('単元の内訳：基本12・結論5・三角形6・四角形7。誤りの種類は6つすべて、どれも4〜6問', () => {
  const by = (k) => DEFS.reduce((m, d) => { m[d[k]] = (m[d[k]] || 0) + 1; return m; }, {});
  assert.deepEqual(by('unit'), { basic: 12, conclusion: 5, triangle: 6, quadrilateral: 7 });
  const cats = by('category');
  assert.deepEqual(Object.keys(cats).sort(), Object.keys(E.CATEGORIES).sort());
  Object.keys(cats).forEach((c) => assert.ok(cats[c] >= 4 && cats[c] <= 6, c + ' ' + cats[c]));
  // 元の問題も分散している（同じ元の問題は2問まで）
  const src = by('source');
  Object.keys(src).forEach((s) => assert.ok(src[s] <= 2, s));
});

test('元の証明（間違いを入れる前）は、ハンターの完成した証明文と同じ内容', () => {
  DEFS.forEach((d) => {
    const p = PH.getProblem(d.source);
    const pr = PH.buildProof(p);
    const text = E.structure(p).map(E.stepText).join('\n');
    pr.lines.forEach((l) => assert.ok(text.indexOf(l.equation) >= 0 && text.indexOf(l.reason) >= 0, d.id + ' ' + l.equation));
    if (pr.condition) assert.ok(text.indexOf(pr.condition) >= 0, d.id);
    if (pr.quad) assert.ok(text.indexOf(pr.quad.condition) >= 0, d.id);
  });
});

test('変わるのは1つのステップだけ。間違いの文は正しい文とちがい、そのステップを直すと正しい証明にもどる', () => {
  DEFS.forEach((d) => {
    const b = E.build(d);
    const changed = b.steps.filter((s, i) => E.stepText(s) !== E.stepText(b.correctSteps[i]));
    assert.equal(changed.length, 1, d.id);
    assert.equal(changed[0].id, d.mutation.target, d.id);
    assert.notEqual(E.stepText(b.wrong), E.stepText(b.right), d.id);
    const fixed = b.steps.map((s) => (s.id === b.target ? b.right : s));
    assert.deepEqual(fixed.map(E.stepText), b.correctSteps.map(E.stepText), d.id);
    assert.ok(!/null|undefined/.test(E.stepText(b.wrong)), d.id);
  });
});

test('元の問題データは変更されない（間違い探しの問題を作っても、ハンター・パズルの正解は同じ）', () => {
  const before = JSON.stringify(PH.problems.map((p) => [p.evidence, p.congruence, p.parallelogram, p.finalStep]));
  DEFS.forEach((d) => { E.build(d); E.verify(d); });
  assert.equal(JSON.stringify(PH.problems.map((p) => [p.evidence, p.congruence, p.parallelogram, p.finalStep])), before);
  assert.deepEqual(PH.validation.verifyAll(PH.problems, PH.STAGES), []);
});

test('検証は、誤りになっていない・誤りが複数になる問題データを見つける', () => {
  const bad = (m, extra) => E.verify(Object.assign({}, def('eh-p01-cong'), { id: 'x' }, extra, m ? { mutation: m } : {}));
  // 根拠から導ける合同条件（誤りになっていない）
  assert.ok(bad({ target: 'condition', field: 'condition', condition: 'SSS' }).length > 0);
  // 正しい理由（共通な辺）のまま
  assert.ok(bad({ target: 'e3', field: 'reason', reason: 'common' }, { category: 'wrongReason' }).length > 0);
  // 仮定から言える等式（AB＝CB の左右の入れかえ）
  assert.ok(bad({ target: 'e1', field: 'body', items: ['CB', 'AB'] }, { category: 'wrongEquation' }).length > 0);
  // 存在しないステップ・元の問題
  assert.ok(bad({ target: 'e9', field: 'reason', reason: 'vertical' }).length > 0);
  assert.ok(E.verify(Object.assign({}, def('eh-p01-cong'), { id: 'y', source: 'p99' })).length > 0);
  // 対称な図で、別の対応でも合同になってしまう（p09 の △ABO≡△CDO）
  assert.ok(E.verify(Object.assign({}, def('eh-p09-corr'), { mutation: { target: 'conclusion', field: 'body', triangles: ['ABO', 'CDO'] } })).length > 0);
  // 合同を示す前の理由ではない（論理の順序の間違いになっていない）
  assert.ok(E.verify(Object.assign({}, def('eh-p11-order'), { mutation: { target: 'e1', field: 'reason', reason: 'vertical' } })).length > 0);
  // ID の重複
  assert.ok(E.verifyAll([def('eh-p01-cong'), def('eh-p01-cong')]).some((e) => /重複/.test(e)));
});

test('種類ごとの誤り：既存の判定で本当に誤り（理由・等式・合同条件・頂点の対応・論理の順序・成立条件）', () => {
  const V = PH.validation;
  const k = (p, n) => PH.geometry.elementKey(p.figure, n);
  DEFS.forEach((d) => {
    const p = PH.getProblem(d.source);
    const m = d.mutation;
    if (d.category === 'wrongCongruence') assert.notEqual(V.deriveCondition(p, p.evidence), m.condition, d.id);
    if (d.category === 'wrongCorrespondence') assert.equal(V.checkTriangles(p, m.triangles[0].split(''), m.triangles[1].split('')).status, 'order', d.id);
    if ((d.category === 'wrongReason' || d.category === 'wrongLogicalOrder') && /^e\d/.test(m.target)) {
      const ev = p.evidence.find((e) => e.id === m.target);
      assert.equal(V.checkEvidence(p, ev.items.map((n) => k(p, n)), m.reason, []).status, 'wrong-reason', d.id);
    }
  });
});

test('解説・ヒントがある。ヒントは正解の行（間違いの文）をそのまま教えない', () => {
  DEFS.forEach((d) => {
    assert.ok(d.explain && d.explain.length > 20, d.id);
    const g = new Game(d);
    const h = g.hintText();
    assert.ok(h && h.length > 5, d.id);
    assert.ok(h.indexOf(g.built.wrong.body) < 0, d.id);
  });
});

test('論理ステップの単位：根拠の行・合同条件の行・結論はそれぞれ別のタップ領域。ステップIDは安定', () => {
  const ids = E.structure(PH.getProblem('p01')).map((s) => s.id);
  assert.deepEqual(ids, ['intro', 'e1', 'e2', 'e3', 'condition', 'conclusion']);
  const p23 = E.structure(PH.getProblem('p23')).map((s) => s.id);
  assert.deepEqual(p23, ['intro', 'e1', 'e2', 's:s1', 's:s2', 's:s3', 'condition', 'conclusion', 'final']);
  const p42 = E.structure(PH.getProblem('p42')).map((s) => s.id);
  assert.ok(p42.indexOf('final') >= 0 && p42.indexOf('q:q2') >= 0 && p42.indexOf('q-condition') >= 0);
  const p50 = E.structure(PH.getProblem('p50')).map((s) => s.id);
  assert.deepEqual(p50, ['intro', 's:s1', 's:s2', 's:s3', 'post:s4']);
  // 「①、②、③より、…ので、」は1つのステップ（折り返しても1つのタップ領域）
  const cond = E.structure(PH.getProblem('p01')).find((s) => s.id === 'condition');
  assert.equal(E.stepText(cond), '①、②、③より、3組の辺がそれぞれ等しいので、');
});

// =====================================================================================
// 正誤判定
// =====================================================================================

test('正解の行を選んで「ここが間違い！」で正解。不正解の行では正解にならない', () => {
  DEFS.forEach((d) => {
    const g = new Game(d);
    assert.equal(g.select(otherStep(g)), true);
    assert.equal(g.confirm().status, 'wrong', d.id);
    assert.equal(g.finished(), false);
    g.select(g.built.target);
    assert.equal(g.confirm().status, 'correct', d.id);
    assert.equal(g.finished(), true);
  });
});

test('行をタップしただけでは判定しない。選んでいないと判定できない。選び直し・解除ができる', () => {
  const g = new Game(def('eh-p01-cong'));
  assert.equal(g.confirm().status, 'none');
  g.select('e1');
  assert.equal(g.misses, 0);
  assert.equal(g.finished(), false);
  g.select('e2');
  assert.equal(g.selected, 'e2');
  g.select('e2');
  assert.equal(g.selected, null);
  assert.equal(g.confirm().status, 'none');
  assert.equal(g.select('nope'), false);
});

test('同じ誤答をくり返してもミスは増えない。別の誤答では増える', () => {
  const g = new Game(def('eh-p05-cong'));
  g.select('e1'); g.confirm();
  g.select('e1'); assert.equal(g.confirm().status, 'repeat');
  assert.equal(g.misses, 1);
  g.select('e2'); g.confirm();
  assert.equal(g.misses, 2);
});

test('3回まちがえると、ヒントと正解の確認が出る（それまでは出ない）', () => {
  const g = new Game(def('eh-p12-eq'));
  [0, 1].forEach((n) => { g.select(otherStep(g, n)); g.confirm(); });
  assert.equal(g.canHelp(), false);
  g.select(otherStep(g, 2)); g.confirm();
  assert.equal(g.canHelp(), true);
  assert.equal(g.reveal(), true);
  assert.equal(g.finished(), true);
  assert.equal(g.canHelp(), false);
  assert.equal(g.select('intro'), false);      // 終わったあとは選べない
});

// =====================================================================================
// ★評価
// =====================================================================================

test('★評価：1回目で正解 ★★★、2回目 ★★、3回目以降 ★', () => {
  const play = (misses) => {
    const g = new Game(def('eh-p02-reason'));
    for (let i = 0; i < misses; i++) { g.select(otherStep(g, i)); g.confirm(); }
    g.select(g.built.target); g.confirm();
    return g;
  };
  assert.equal(play(0).stars(), 3);
  assert.equal(play(1).stars(), 2);
  assert.equal(play(2).stars(), 1);
  assert.equal(play(4).stars(), 1);
  assert.deepEqual(play(0).result(), { stars: 3, misses: 0, solvedByUser: true });
});

test('ヒントを使うと最高★★。正解を確認したら★1で、自力で正解した扱いにしない', () => {
  const g = new Game(def('eh-p03-reason'));
  assert.ok(g.useHint());
  g.select(g.built.target); g.confirm();
  assert.equal(g.stars(), 2);
  const r = new Game(def('eh-p03-reason'));
  r.reveal();
  assert.equal(r.stars(), 1);
  assert.deepEqual(r.result(), { stars: 1, misses: 0, solvedByUser: false });
  assert.equal(r.selected, r.built.target);
});

// =====================================================================================
// 保存
// =====================================================================================

test('間違い探しの記録が保存され、最高評価は下がらない。正解の確認のあと、自力で正解すれば更新できる', () => {
  withFakeStorage(null, (mem) => {
    const S = PH.storage;
    assert.deepEqual(S.getErrorRecord('eh-p01-cong'), { completed: false, solvedByUser: false, bestStars: 0, minMisses: null, attempts: 0 });
    let r = S.recordError('eh-p01-cong', { stars: 1, misses: 3, solvedByUser: false });
    assert.equal(r.firstTime, true);
    assert.deepEqual(S.getErrorRecord('eh-p01-cong'), { completed: true, solvedByUser: false, bestStars: 1, minMisses: null, attempts: 1 });
    assert.equal(S.isErrorReviewTarget('eh-p01-cong'), true);
    r = S.recordError('eh-p01-cong', { stars: 3, misses: 0, solvedByUser: true });
    assert.equal(r.improved, true);
    S.recordError('eh-p01-cong', { stars: 2, misses: 1, solvedByUser: true });
    assert.deepEqual(S.getErrorRecord('eh-p01-cong'), { completed: true, solvedByUser: true, bestStars: 3, minMisses: 0, attempts: 3 });
    assert.equal(S.isErrorReviewTarget('eh-p01-cong'), false);
    const saved = JSON.parse(mem[S.KEY]);
    assert.equal(saved.errorHunt.problems['eh-p01-cong'].bestStars, 3);
    assert.equal(saved.errorHunt.lastId, 'eh-p01-cong');
    // 正解を確認しただけの記録で★が★1より上がることはない
    S.recordError('eh-p02-reason', { stars: 3, misses: 0, solvedByUser: false });
    assert.equal(S.getErrorRecord('eh-p02-reason').bestStars, 1);
  });
});

test('旧データ（errorHunt なし）の記録は保たれ、間違い探しは空から始まる', () => {
  const old = JSON.stringify({
    version: 6, problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 } }, puzzleLevels: { easy: { p02: { cleared: true, bestStars: 2, minMisses: 1 } } },
    puzzleLevel: 'standard', puzzleMigrated: true, lastProblemId: 'p01', lastMode: 'hunter', sound: false,
    rankCertification: { format: 2, tracks: { basic: { criteriaVersion: 2, best: { rank: 12, rankName: '三段' }, playCount: 4 } } },
  });
  withFakeStorage(old, (mem) => {
    const S = PH.storage;
    assert.equal(S.getErrorRecord('eh-p01-cong').completed, false);
    S.recordError('eh-p01-cong', { stars: 3, misses: 0, solvedByUser: true });
    assert.deepEqual(S.getProblem('p01'), { cleared: true, bestStars: 3, minMisses: 0 });
    assert.equal(S.getProblem('p02', 'puzzle:easy').bestStars, 2);
    assert.equal(S.getPuzzleLevel(), 'standard');
    assert.equal(S.getSound(), false);
    assert.equal(S.getRank('basic').best.rankName, '三段');
    const saved = JSON.parse(mem[S.KEY]);
    assert.equal(saved.problems.p01.bestStars, 3);
    assert.equal(saved.rankCertification.tracks.basic.playCount, 4);
    assert.equal(saved.errorHunt.problems['eh-p01-cong'].solvedByUser, true);
  });
});

test('保存データがない・壊れている・不正な値でも安全に読める', () => {
  [null, '{broken', JSON.stringify({ errorHunt: 'x' }), JSON.stringify({ errorHunt: { problems: { 'eh-p01-cong': { completed: 'yes', bestStars: 9, minMisses: -1, attempts: 'a' }, bad: 3 } } })].forEach((raw) => {
    withFakeStorage(raw, () => {
      const r = PH.storage.getErrorRecord('eh-p01-cong');
      assert.deepEqual(r, { completed: false, solvedByUser: false, bestStars: 0, minMisses: null, attempts: 0 });
      assert.doesNotThrow(() => PH.storage.recordError('eh-p01-cong', { stars: 2, misses: 1, solvedByUser: true }));
      assert.equal(PH.storage.getErrorRecord('eh-p01-cong').bestStars, 2);
    });
  });
});

// =====================================================================================
// 回帰（既存のモードは変わらない）
// =====================================================================================

test('既存の50問・10ステージ・問題データの検証は変わらない', () => {
  assert.equal(PH.problems.length, 50);
  assert.equal(PH.STAGES.length, 10);
  assert.deepEqual(PH.validation.verifyAll(PH.problems, PH.STAGES), []);
});

test('段位認定のミニ問題は449問のまま（間違い探しは段位認定に入れない）', () => {
  assert.equal(PH.rankQuestions.all().length, 449);
});

test('ハンター・証明パズル3レベルは、元の問題で従来どおり作れる', () => {
  DEFS.forEach((d) => {
    const p = PH.getProblem(d.source);
    assert.ok(new PH.Game(p), d.source);
    PH.PUZZLE_LEVELS.forEach((lv) => assert.ok(new PH.Puzzle(p, lv.id), d.source + ' ' + lv.id));
  });
});
