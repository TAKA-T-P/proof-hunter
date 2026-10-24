// 証明ハンター Ver.0.2 のテスト（全15問・ステージ・復習・保存）
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

const PH = globalThis.PH;
// Ver.0.8 までの30問（p01〜p30）。Ver.0.9 の問題（p31〜p42。p35 は STAGE 6）は v09.test.js で確かめる
const TRI = PH.problems.filter((p) => Number(p.id.slice(1)) <= 30);
const geo = PH.geometry;
const val = PH.validation;
const k = (p, name) => geo.elementKey(p.figure, name);

// 根拠1つを画面と同じ手順で答える（共通な辺・角は同じ要素を2回タップ）
function answer(game, ev, reason) {
  const p = game.problem;
  game.setMode(geo.isAngleName(ev.items[0]) ? 'angle' : 'side');
  game.clearSelection();
  game.tap(k(p, ev.items[0]));
  game.tap(k(p, ev.items[1]));
  game.selectReason(reason);
  return game.confirmEvidence();
}

// ---- 問題データ ---------------------------------------------------------------

test('全問題のデータ検証（図の数値チェック・ID重複・ステージ）に問題がない', () => {
  assert.deepEqual(val.verifyAll(PH.problems, PH.STAGES), []);
});

test('50問・10ステージ（STAGE 1 は6問（旧 STAGE 4 の3問をふくむ）、STAGE 2〜4は各3問、STAGE 5 は7問（p35・p48 をふくむ）、STAGE 6 は5問（p50 をふくむ）、STAGE 7 は7問（p49 をふくむ）、STAGE 8 は3問、STAGE 9 は8問、STAGE 10 は5問）', () => {
  assert.equal(PH.problems.length, 50);   // Ver.0.9：STAGE 9（p37〜p39）・STAGE 10（p31〜p34・p36・p40〜p42）、p35 は STAGE 6。Ver.1.0：STAGE 11（p43〜p47）
  assert.equal(PH.STAGES.length, 10);
  const size = { 1: 6, 5: 7, 6: 5, 7: 7, 8: 3, 9: 8, 10: 5 };
  PH.STAGES.forEach((st) => assert.equal(PH.stageProblems(st.id).length, size[st.id] || 3, 'STAGE ' + st.id));
  ['p01', 'p02', 'p03'].forEach((id) => assert.ok(PH.getProblem(id), id + ' が残っている'));
});

test('3つの合同条件がバランスよく出題される（Ver.0.8 の直角三角形の合同条件も2問以上ずつ）', () => {
  const count = { SSS: 0, SAS: 0, ASA: 0, RHA: 0, RHS: 0 };
  TRI.forEach((p) => count[p.congruence]++);
  ['SSS', 'SAS', 'ASA'].forEach((c) => assert.ok(count[c] >= 3, c + ': ' + count[c]));
  ['RHA', 'RHS'].forEach((c) => assert.ok(count[c] >= 2, c + ': ' + count[c]));
});

test('問題はステージ順に並び、ステージ内の次の問題をたどれる', () => {
  const stages = TRI.map((p) => p.stage);
  assert.deepEqual(stages, stages.slice().sort((a, b) => a - b));
  const s1 = PH.stageProblems(1).map((p) => p.id);
  assert.deepEqual(s1, ['p01', 'p04', 'p06', 'p07', 'p11', 'p12']);   // 旧 STAGE 4（p07・p11・p12）を STAGE 1 へ移した
  assert.ok(PH.stageProblems(1).every((p) => p.difficulty === 1));
});

// ---- 全問題の正誤判定 ----------------------------------------------------------
// 三角形の合同が結論の問題（p01〜p15）。結論が辺・角の等しさの問題（STAGE 6）は v05.test.js で同じ内容を確かめる

// 直角三角形の問題（STAGE 8）は根拠の欄（直角・斜辺・他の1辺）があるので、v08.test.js で同じ内容を確かめる
TRI.filter((p) => !PH.hasFinalStep(p) && !PH.isRightProblem(p)).forEach((p) => {
  test(p.id + ': 根拠を逆の順番で登録しても証明が完成し、合同条件を誤るとクリアにならない', () => {
    const g = new PH.Game(p);
    p.evidence.slice().reverse().forEach((ev) => {
      assert.equal(answer(g, ev, ev.reason).status, 'correct', ev.label);
    });
    assert.equal(g.phase, 'congruence');
    PH.CONDITION_ORDER.filter((c) => c !== p.congruence).forEach((c) => {
      g.selectCondition(c);
      assert.equal(g.confirmCondition().ok, false, c);
    });
    g.selectCondition(p.congruence);
    assert.equal(g.confirmCondition().ok, true);
    assert.equal(g.phase, 'clear');
  });

  test(p.id + ': 正しい等式でも理由が誤っていれば不正解', () => {
    p.evidence.forEach((ev) => {
      const g = new PH.Game(p);
      g.setMode(geo.isAngleName(ev.items[0]) ? 'angle' : 'side');
      g.tap(k(p, ev.items[0]));
      g.tap(k(p, ev.items[1]));
      const wrong = g.availableReasons().find((r) => r !== ev.reason);
      g.selectReason(wrong);
      assert.equal(g.confirmEvidence().status, 'wrong-reason', ev.label + ' / ' + wrong);
    });
  });

  test(p.id + ': 根拠にならない等式は正解にならない', () => {
    const els = geo.getElements(p.figure);
    const all = els.segments.concat(els.angles);
    let checked = 0;
    for (let i = 0; i < all.length && checked < 3; i++) {
      for (let j = i + 1; j < all.length && checked < 3; j++) {
        if (all[i].kind !== all[j].kind) continue;
        const keys = [all[i].key, all[j].key];
        const statuses = Object.keys(PH.REASONS).map((r) => val.checkEvidence(p, keys, r, []).status);
        if (statuses.includes('correct') || statuses.includes('irrelevant')) continue;
        statuses.forEach((st) => assert.ok(['wrong-equation', 'from-conclusion'].includes(st), st));
        checked++;
      }
    }
    assert.ok(checked > 0);
  });

  test(p.id + ': 完成した証明文が標準の順序・合同条件で表示される', () => {
    const proof = PH.buildProof(p);
    assert.equal(proof.intro, '△' + p.triangles[0].join('') + 'と△' + p.triangles[1].join('') + 'において');
    assert.deepEqual(proof.lines.map((l) => l.equation), p.evidence.map((e) => e.label));
    assert.equal(proof.summary, '①、②、③より、');
    assert.equal(proof.condition, PH.CONDITIONS[p.congruence].label);
    assert.equal(proof.conclusion, p.conclusion);
    proof.lines.forEach((l) => assert.ok(l.reason.length > 0));
  });
});

test('結論から導かれる関係はどの問題でも根拠にできない', () => {
  TRI.forEach((p) => {
    const evEq = p.evidence.map((e) => val.equationKey(k(p, e.items[0]), k(p, e.items[1])));
    const exEq = (p.extraTruths || []).map((x) => val.equationKey(k(p, x.items[0]), k(p, x.items[1])));
    val.correspondingParts(p).forEach((part) => {
      if (evEq.includes(part.eq) || exEq.includes(part.eq)) return;
      Object.keys(PH.REASONS).forEach((r) => {
        assert.equal(val.checkEvidence(p, part.keys, r, []).status, 'from-conclusion', p.id + ' ' + part.eq);
      });
    });
  });
});

test('別ルートで使える正しい関係はミスにしない（p10・p15）', () => {
  const p10 = PH.getProblem('p10');
  assert.equal(val.checkEvidence(p10, [k(p10, '∠BAC'), k(p10, '∠CDE')], 'alternate', []).status, 'irrelevant');
  const p15 = PH.getProblem('p15');
  const r = val.checkEvidence(p15, [k(p15, '∠ABO'), k(p15, '∠DCO')], 'alternate', []);
  assert.equal(r.status, 'irrelevant');
  assert.equal(r.miss, false);
});

test('途中に点がある長い辺（p14 の AB）を選べ、共通な角は名前がちがっても同じ角', () => {
  const p = PH.getProblem('p14');
  const ab = geo.getElements(p.figure).byKey[k(p, 'AB')];
  assert.ok(ab && ab.composite);
  assert.equal(ab.h1, p.figure.points.D);
  assert.equal(k(p, '∠BAE'), k(p, '∠CAD'));
  assert.equal(k(p, '∠BAE'), k(p, '∠BAC'));
});

// ---- 角の操作領域が重ならない ---------------------------------------------------

function inSector(V, P1, P2, R, Q) {
  const v = geo.vec;
  const q = v.sub(Q, V);
  if (v.len(q) > R) return false;
  const u1 = v.sub(P1, V), u2 = v.sub(P2, V);
  const cr = (a, b) => a.x * b.y - a.y * b.x;
  const s = Math.sign(cr(u1, u2));
  return Math.sign(cr(u1, q)) * s > 0 && Math.sign(cr(q, u2)) * s > 0;
}

test('どの問題でも、角の操作領域どうしが重ならない（角選択・印つけの両方）', () => {
  TRI.forEach((p) => {
    const els = geo.getElements(p.figure);
    [true, false].forEach((angleOnly) => {
      const sectors = els.angles.map((a) => ({ a, R: geo.angleHitRadius(p.figure, a, angleOnly) }));
      sectors.forEach((s) => assert.ok(s.R >= 18, p.id + ' ∠' + s.a.name + ' の操作領域が小さすぎる: ' + s.R.toFixed(1)));
      const [x0, y0, w, h] = p.figure.viewBox;
      for (let x = x0; x <= x0 + w; x += 4) {
        for (let y = y0; y <= y0 + h; y += 4) {
          const hits = sectors.filter((s) => inSector(s.a.vertex, s.a.from, s.a.to, s.R, { x, y }));
          // 重なってよいのは、同じ頂点で一方の角が他方をふくむ場合だけ（そのときは「どちらを選びますか？」で選ぶ）
          const nested = hits.every((h) => h.a.vertex === hits[0].a.vertex);
          assert.ok(hits.length <= 1 || nested, p.id + ' (' + x + ',' + y + ') ' + hits.map((s) => s.a.name).join(','));
        }
      }
    });
  });
});

// ---- ステージ集計・復習・保存 ----------------------------------------------------

function withFakeStorage(initial, fn) {
  const mem = { [PH.storage.KEY]: initial };
  const fake = {
    getItem: (key) => (key in mem ? mem[key] : null),
    setItem: (key, v) => { mem[key] = String(v); },
  };
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  PH.storage._reset();
  try {
    fn(mem);
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
    PH.storage._reset();
  }
}

test('Ver.0.1 の保存データを引き継ぎ、ステージのクリア数・星の合計を集計できる', () => {
  const v01 = JSON.stringify({
    problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 }, p02: { cleared: true, bestStars: 2, minMisses: 1 } },
    lastProblemId: 'p02', sound: false,
  });
  withFakeStorage(v01, (mem) => {
    assert.deepEqual(PH.storage.getProblem('p01'), { cleared: true, bestStars: 3, minMisses: 0 });
    assert.equal(PH.storage.getLastProblem(), 'p02');
    assert.equal(PH.storage.getSound(), false);
    const s1 = PH.storage.stageStats(1);
    assert.equal(s1.total, 6);
    assert.equal(s1.cleared, 1);
    assert.equal(s1.stars, 3);
    assert.equal(s1.maxStars, 18);
    assert.equal(s1.complete, false);
    assert.equal(PH.storage.stageStats(2).stars, 2);
    // 保存すると旧データを残したまま version が付く
    PH.storage.recordClear('p04', 1, 5);
    const saved = JSON.parse(mem[PH.storage.KEY]);
    assert.ok(saved.version >= 2);
    assert.equal(saved.problems.p01.bestStars, 3);
    assert.equal(saved.problems.p04.bestStars, 1);
  });
});

test('復習対象：未クリアと★・★★の問題。★★★は外れ、評価が上がると更新される', () => {
  withFakeStorage(null, () => {
    assert.equal(PH.storage.reviewProblems().length, PH.problems.length);
    PH.storage.recordClear('p01', 3, 0);
    PH.storage.recordClear('p04', 1, 4);
    PH.storage.recordClear('p06', 2, 1);
    const ids = PH.storage.reviewProblems().map((p) => p.id);
    assert.ok(!ids.includes('p01'));
    assert.ok(ids.includes('p04'));
    assert.ok(ids.includes('p06'));
    assert.ok(ids.includes('p02'));
    PH.storage.recordClear('p04', 3, 0);
    assert.ok(!PH.storage.reviewProblems().map((p) => p.id).includes('p04'));
    // 評価は下がらない（★★★のあとに★でクリアしても復習対象に戻らない）
    PH.storage.recordClear('p04', 1, 5);
    assert.ok(!PH.storage.isReviewTarget('p04'));
    ['p07', 'p11', 'p12'].forEach((id) => PH.storage.recordClear(id, 3, 0));
    assert.equal(PH.storage.stageStats(1).complete, true);
  });
});

test('壊れた保存データでも安全な値で動く', () => {
  withFakeStorage(JSON.stringify({ problems: { p01: { cleared: 1, bestStars: 'x', minMisses: -3 }, p02: 5 } }), () => {
    assert.deepEqual(PH.storage.getProblem('p01'), { cleared: true, bestStars: 0, minMisses: null });
    assert.deepEqual(PH.storage.getProblem('p02'), { cleared: false, bestStars: 0, minMisses: null });
  });
  withFakeStorage('{not json', () => {
    assert.equal(PH.storage.reviewProblems().length, PH.problems.length);
  });
});

test('LocalStorage が使えない環境でも進行できる', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('denied'); }, configurable: true });
  PH.storage._reset();
  try {
    PH.storage.recordClear('p05', 2, 1);
    assert.equal(PH.storage.getProblem('p05').bestStars, 2);
    assert.ok(PH.storage.isReviewTarget('p05'));
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
    PH.storage._reset();
  }
});
