// 証明ハンター Ver.0.3 のテスト（証明パズル・モード別の保存）
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
require('../js/puzzle.js');

const PH = globalThis.PH;
const val = PH.validation;
const geo = PH.geometry;

// 配置をまとめて入れる（空欄ID → カードID）
function fill(z, placement) {
  z.slots.forEach((s) => {
    if (placement[s.id] == null) return;
    z.selectSlot(s.id);
    assert.equal(z.place(placement[s.id]), true, s.id);
  });
}

function permutations(a) {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations(a.slice(0, i).concat(a.slice(i + 1))).map((r) => [x].concat(r)));
}

const eqCard = (z, label) => z.cards.eq.find((c) => c.text === label);
const condCard = (z, c) => z.cards.cond.find((x) => x.cond === c);

// ---- 問題・データ ---------------------------------------------------------------

test('全問題のデータ検証（パズルのダミーカードを含む）に問題がない', () => {
  assert.deepEqual(val.verifyAll(PH.problems, PH.STAGES), []);
});

test('15問すべてでパズルを作れ、正解カード・合同条件カードがそろっている', () => {
  assert.equal(PH.problems.length, 15);
  PH.problems.forEach((p) => {
    const z = new PH.Puzzle(p);
    assert.equal(z.type, p.puzzle.type);
    p.evidence.forEach((ev) => {
      const keys = ev.items.map((n) => geo.elementKey(p.figure, n));
      const eq = val.equationKey(keys[0], keys[1]);
      assert.ok(z.cards.eq.some((c) => c.eq === eq), p.id + ' 等式カード ' + ev.label);
      if (z.type === 'build') assert.ok(z.cards.reason.some((c) => PH.puzzleUtil.reasonAccepts(c, ev)), p.id + ' 理由カード ' + ev.label);
    });
    assert.deepEqual(z.cards.cond.map((c) => c.cond), ['SSS', 'SAS', 'ASA']);
    assert.ok(z.cards.eq.length > p.evidence.length, p.id + ' ダミーがある');
    // 同じ関係のカードが重複しない
    assert.equal(new Set(z.cards.eq.map((c) => c.eq)).size, z.cards.eq.length);
  });
});

test('ステージ1・2は穴埋め、ステージ4・5は組み立て、ステージ3は両方', () => {
  const types = (st) => new Set(PH.stageProblems(st).map((p) => p.puzzle.type));
  assert.deepEqual([...types(1)], ['fill']);
  assert.deepEqual([...types(2)], ['fill']);
  assert.deepEqual([...types(3)].sort(), ['build', 'fill']);
  assert.deepEqual([...types(4)], ['build']);
  assert.deepEqual([...types(5)], ['build']);
});

test('ダミーの等式は、どの理由と組み合わせても正解にならない（正解を妨げない）', () => {
  PH.problems.forEach((p) => {
    const z = new PH.Puzzle(p, 'build');
    const evEq = p.evidence.map((ev) => val.equationKey(...ev.items.map((n) => geo.elementKey(p.figure, n))));
    z.cards.eq.filter((c) => !evEq.includes(c.eq)).forEach((dummy) => {
      assert.equal(val.matchEvidence(p, dummy.keys), null, p.id + ' ' + dummy.text);
      assert.ok(['from-conclusion', 'wrong-equation', 'not-common'].includes(val.equationStatus(p, dummy.keys)), p.id + ' ' + dummy.text);
    });
  });
});

// ---- タイプA（穴埋め） -----------------------------------------------------------

PH.problems.filter((p) => p.puzzle.type === 'fill').forEach((p) => {
  test(p.id + '（穴埋め）: 正しい配置でクリア・同じ理由の行どうしの入れかえもクリア', () => {
    // 表示済みの理由が同じ行どうしの並べかえをすべて試す
    const reasons = p.evidence.map((ev) => PH.puzzleUtil.reasonText(ev));
    permutations([0, 1, 2]).forEach((order) => {
      const z = new PH.Puzzle(p);
      fill(z, z.solution(order));
      const valid = order.every((evIndex, row) => reasons[evIndex] === reasons[row]);
      assert.equal(z.check().status, valid ? 'clear' : 'wrong', order.join(''));
    });
  });

  test(p.id + '（穴埋め）: 未入力は答え合わせできず、誤ったカード・合同条件ではクリアできない', () => {
    const z = new PH.Puzzle(p);
    const sol = z.solution();
    fill(z, Object.assign({}, sol, { cond: undefined }));
    assert.equal(z.check().status, 'incomplete');
    assert.equal(z.check().missing, 1);
    // ダミーの等式を①に入れる
    const evEq = p.evidence.map((ev) => val.equationKey(...ev.items.map((n) => geo.elementKey(p.figure, n))));
    const dummy = z.cards.eq.find((c) => !evEq.includes(c.eq));
    fill(z, { s0: dummy.id, cond: sol.cond });
    const r = z.check();
    assert.equal(r.status, 'wrong');
    assert.equal(r.result.slotStatus.s0, 'ng');
    assert.equal(z.phase, 'play');
    // 合同条件だけ誤り
    const other = z.cards.cond.find((c) => c.cond !== p.congruence);
    fill(z, Object.assign({}, sol, { cond: other.id }));
    const r2 = z.check();
    assert.equal(r2.status, 'wrong');
    assert.equal(r2.result.slotStatus.cond, 'ng');
    assert.match(r2.result.messages[0].text, /その合同条件は使えない/);
    fill(z, sol);
    assert.equal(z.check().status, 'clear');
  });
});

test('穴埋め：理由と合わない等式は不正解（p01 の「仮定より」に BD＝BD）', () => {
  const p = PH.getProblem('p01');
  const z = new PH.Puzzle(p);
  fill(z, { s0: eqCard(z, 'BD＝BD').id, s1: eqCard(z, 'AD＝CD').id, s2: eqCard(z, 'AB＝CB').id, cond: condCard(z, 'SSS').id });
  const r = z.check();
  assert.equal(r.result.slotStatus.s0, 'ng');
  assert.equal(r.result.slotStatus.s2, 'ng');
  assert.match(r.result.messages[0].text, /仮定より/);
});

// ---- タイプB（組み立て） ---------------------------------------------------------

PH.problems.filter((p) => p.puzzle.type === 'build').forEach((p) => {
  test(p.id + '（組み立て）: 根拠の順番を入れかえてもクリア（6通りすべて）', () => {
    permutations([0, 1, 2]).forEach((order) => {
      const z = new PH.Puzzle(p);
      fill(z, z.solution(order));
      assert.equal(z.check().status, 'clear', order.join(''));
      assert.equal(z.stars, 3);
    });
  });

  test(p.id + '（組み立て）: 理由の組み合わせ・重複・合同条件の誤りを見つける', () => {
    const z = new PH.Puzzle(p);
    const sol = z.solution();
    // 1行目の理由を、その根拠に合わない理由に変える
    const wrongReason = z.cards.reason.find((c) => !PH.puzzleUtil.reasonAccepts(c, p.evidence[0]));
    fill(z, Object.assign({}, sol, { r0: wrongReason.id }));
    let r = z.check();
    assert.equal(r.result.slotStatus.r0, 'ng');
    assert.equal(r.result.slotStatus.e0, 'ok');
    assert.match(r.result.messages[0].text, /等式は合っているよ/);
    // 同じ根拠を2回
    fill(z, Object.assign({}, sol, { r1: sol.r0, e1: sol.e0 }));
    r = z.check();
    assert.equal(r.result.slotStatus.e1, 'ng');
    assert.ok(r.result.messages.some((m) => /同じ根拠が2回/.test(m.text)));
    // 合同条件の誤り
    const other = z.cards.cond.find((c) => c.cond !== p.congruence);
    fill(z, Object.assign({}, sol, { cond: other.id }));
    r = z.check();
    assert.equal(r.status, 'wrong');
    assert.equal(r.result.slotStatus.cond, 'ng');
    fill(z, sol);
    assert.equal(z.check().status, 'clear');
  });
});

test('組み立て：平行線が2組ある問題では、どちらの平行線の錯角かも区別する（p13）', () => {
  const p = PH.getProblem('p13');
  const z = new PH.Puzzle(p);
  const sol = z.solution();
  const g1 = z.cards.reason.find((c) => c.text.startsWith('AB∥DC'));
  const g2 = z.cards.reason.find((c) => c.text.startsWith('AD∥BC'));
  // ∠BAC＝∠DCA（AB∥DC の錯角）に AD∥BC の理由
  fill(z, Object.assign({}, sol, { r0: g2.id }));
  assert.equal(z.check().result.slotStatus.r0, 'ng');
  fill(z, Object.assign({}, sol, { r0: g1.id }));
  assert.equal(z.check().status, 'clear');
});

test('組み立て：一般的な「仮定より」は、根拠専用の書き方の根拠（p12 の中点）にも使える', () => {
  const p = PH.getProblem('p12');
  const z = new PH.Puzzle(p);
  const generic = z.cards.reason.find((c) => c.text === '仮定より');
  const midpoint = z.cards.reason.find((c) => c.text.includes('中点'));
  const sol = z.solution();
  // BM＝CM（e1）に「仮定より」→ 正解、AB＝AC（e0）に「中点だから」→ 不正解
  fill(z, Object.assign({}, sol, { r1: generic.id }));
  assert.equal(z.check().status, 'clear');
  const z2 = new PH.Puzzle(p);
  fill(z2, Object.assign({}, z2.solution(), { r0: z2.cards.reason.find((c) => c.text.includes('中点')).id }));
  assert.equal(z2.check().result.slotStatus.r0, 'ng');
  assert.ok(midpoint);
});

// ---- ミス・ヒント・評価 ------------------------------------------------------------

test('同じ誤りのまま答え合わせをくり返してもミスは増えず、別の誤りに変えると増える', () => {
  const p = PH.getProblem('p01');
  const z = new PH.Puzzle(p);
  const sol = z.solution();
  fill(z, Object.assign({}, sol, { s0: eqCard(z, 'AB＝AD').id }));
  z.check();
  assert.equal(z.misses, 1);
  z.check();
  z.check();
  assert.equal(z.misses, 1);
  fill(z, { s0: eqCard(z, 'CB＝CD').id });
  z.check();
  assert.equal(z.misses, 2);
  fill(z, sol);
  assert.equal(z.check().status, 'clear');
  assert.equal(z.stars, 2);
});

test('カードを入れたり変えたりするだけではミスにならない', () => {
  const p = PH.getProblem('p02');
  const z = new PH.Puzzle(p);
  z.cards.eq.forEach((c) => { z.selectSlot('s0'); z.place(c.id); });
  z.clearAll();
  assert.equal(z.misses, 0);
});

test('ヒントは未完成・不正解の部分を優先し、3段階で、最終段階のくり返しでは回数が増えない', () => {
  const p = PH.getProblem('p01');
  const z = new PH.Puzzle(p);
  const sol = z.solution();
  fill(z, { s0: sol.s0 });
  const h1 = z.useHint();
  assert.equal(h1.targetId, 'e2');      // ①は正しく入っているので、②（AD＝CD）が対象
  assert.equal(h1.slotId, 's1');
  assert.equal(z.useHint().level, 2);
  const h3 = z.useHint();
  assert.equal(h3.level, 3);
  assert.match(h3.text, /AD＝CD/);
  assert.equal(z.useHint().isNew, false);
  assert.equal(z.hintsUsed, 3);
  fill(z, sol);
  assert.equal(z.check().status, 'clear');
  assert.equal(z.stars, 1);
});

test('合同条件だけが残っているときは合同条件のヒントを出す', () => {
  const p = PH.getProblem('p11');
  const z = new PH.Puzzle(p);
  fill(z, Object.assign({}, z.solution(), { cond: undefined }));
  const h = z.useHint();
  assert.equal(h.targetId, 'congruence');
  assert.equal(h.slotId, 'cond');
});

// ---- カード操作 ---------------------------------------------------------------------

test('カードの配置・交換・取り消し・自動で次の空欄へ・種類の違うカードは入らない', () => {
  const p = PH.getProblem('p10');
  const z = new PH.Puzzle(p);
  assert.equal(z.active, 'r0');
  assert.equal(z.place(z.cards.eq[0].id), false);      // 理由の空欄に等式は入らない
  assert.equal(z.place(z.cards.reason[0].id), true);
  assert.equal(z.active, 'e0');                         // 次の空欄へ
  z.place(z.cards.eq[0].id);
  z.selectSlot('e0');
  z.place(z.cards.eq[1].id);                            // 交換
  assert.equal(z.placed.e0, z.cards.eq[1].id);
  z.selectSlot('e0');
  assert.equal(z.clearActive(), true);                  // 取り消し
  assert.equal(z.placed.e0, undefined);
  assert.equal(z.emptyCount(), z.slots.length - 1);
  // 連続操作でも状態がこわれない
  for (let i = 0; i < 50; i++) {
    z.selectSlot(z.slots[i % z.slots.length].id);
    const cards = z.cardsForActive();
    z.place(cards[i % cards.length].id);
    if (i % 7 === 0) z.clearActive();
  }
  assert.ok(Object.keys(z.placed).every((sid) => z.slot(sid).kind === z.cardById[z.placed[sid]].kind));
  z.clearAll();
  assert.equal(z.emptyCount(), z.slots.length);
  assert.equal(z.active, 'r0');
});

test('クリア後は操作できない・最初からで初期化される', () => {
  const p = PH.getProblem('p03');
  const z = new PH.Puzzle(p);
  fill(z, z.solution());
  z.check();
  assert.equal(z.phase, 'clear');
  assert.equal(z.place(z.cards.eq[0].id), false);
  assert.equal(z.useHint(), null);
  z.reset();
  assert.equal(z.phase, 'play');
  assert.equal(z.emptyCount(), z.slots.length);
  assert.equal(z.misses, 0);
});

// ---- 保存 ---------------------------------------------------------------------------

function withFakeStorage(initial, fn) {
  const mem = { [PH.storage.KEY]: initial };
  const fake = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  PH.storage._reset();
  try { fn(mem); } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
    PH.storage._reset();
  }
}

test('パズルの評価はハンターモードと別に保存され、Ver.0.2 のデータを引き継ぐ', () => {
  const v02 = JSON.stringify({ version: 2, problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 } }, lastProblemId: 'p01', sound: true });
  withFakeStorage(v02, (mem) => {
    assert.equal(PH.storage.getProblem('p01').bestStars, 3);
    assert.equal(PH.storage.getProblem('p01', 'puzzle').cleared, false);
    assert.deepEqual(PH.storage.getLastPlay(), { mode: 'hunter', id: 'p01' });
    PH.storage.recordClear('p01', 1, 4, 'puzzle');
    PH.storage.setLastProblem('p04', 'puzzle');
    assert.equal(PH.storage.getProblem('p01').bestStars, 3);            // ハンターは変わらない
    assert.equal(PH.storage.getProblem('p01', 'puzzle').bestStars, 1);
    assert.equal(PH.storage.stageStats(1).stars, 3);
    assert.equal(PH.storage.stageStats(1, 'puzzle').stars, 1);
    assert.ok(PH.storage.isReviewTarget('p01', 'puzzle'));
    assert.ok(!PH.storage.isReviewTarget('p01'));
    assert.deepEqual(PH.storage.getLastPlay(), { mode: 'puzzle', id: 'p04' });
    assert.equal(PH.storage.getLastProblem(), 'p01');                    // ハンターの「最後の問題」は残る
    const saved = JSON.parse(mem[PH.storage.KEY]);
    assert.ok(saved.version >= 3);
    assert.equal(saved.problems.p01.bestStars, 3);
    assert.equal(saved.puzzleProblems.p01.bestStars, 1);
    assert.equal(saved.lastMode, 'puzzle');
  });
});

test('壊れたパズルの保存データでもエラーにならない', () => {
  withFakeStorage(JSON.stringify({ problems: { p01: { cleared: true, bestStars: 2 } }, puzzleProblems: [1, 2], lastMode: 'x', lastPuzzleProblemId: 5 }), () => {
    assert.equal(PH.storage.getProblem('p01', 'puzzle').cleared, false);
    assert.equal(PH.storage.reviewProblems('puzzle').length, 15);
    assert.deepEqual(PH.storage.getLastPlay(), null);
    PH.storage.recordClear('p02', 3, 0, 'puzzle');
    assert.equal(PH.storage.getProblem('p02', 'puzzle').bestStars, 3);
    assert.equal(PH.storage.getProblem('p01').bestStars, 2);
  });
});

// ---- 重なった辺・角の候補（「どちらに印をつけますか？」） ---------------------------

test('一直線上に重なる辺：A〜D の間のタップは AB と AD の両方が候補（長い辺が先）、D〜B は AB だけ（p14）', () => {
  const p = PH.getProblem('p14');
  const pts = p.figure.points;
  const k = (n) => geo.elementKey(p.figure, n);
  const onAD = geo.vec.lerp(pts.A, pts.D, 0.5);
  assert.deepEqual(geo.segmentCandidates(p.figure, onAD), [k('AB'), k('AD')]);
  // 線から少しずれたタップでも同じ
  assert.deepEqual(geo.segmentCandidates(p.figure, geo.vec.add(onAD, { x: 6, y: 2 })), [k('AB'), k('AD')]);
  assert.deepEqual(geo.segmentCandidates(p.figure, geo.vec.lerp(pts.D, pts.B, 0.5)), [k('AB')]);
  assert.deepEqual(geo.segmentCandidates(p.figure, geo.vec.lerp(pts.A, pts.E, 0.4)), [k('AC'), k('AE')]);
});

test('重ならない辺は候補が1つ（どの問題でも辺の中点は1つだけ。p14 の短い辺を除く）', () => {
  PH.problems.forEach((p) => {
    geo.getElements(p.figure).segments.forEach((s) => {
      const c = geo.segmentCandidates(p.figure, geo.vec.lerp(s.p1, s.p2, 0.5));
      // p14 の AD・AE は AB・AC に重なるので2つ、それ以外は1つ
      const expectTwo = p.id === 'p14' && (s.name === 'AD' || s.name === 'AE');
      assert.equal(c.length, expectTwo ? 2 : 1, p.id + ' ' + s.name + ' ' + c.join(','));
      assert.ok(c.includes(s.key));
    });
  });
});

test('ふくむ角とふくまれる角：∠ABD の中のタップは ∠ABC と ∠ABD が候補（大きい角が先）', () => {
  // 半直線BDが ∠ABC の内側にある図で、∠ABC・∠ABD・∠DBC をすべて選べるようにした例
  const fig = {
    viewBox: [0, 0, 400, 300],
    points: { A: { x: 60, y: 40 }, B: { x: 200, y: 260 }, C: { x: 360, y: 60 }, D: { x: 210, y: 30 } },
    lines: [],
    segments: ['AB', 'BC', 'BD'],
    angles: ['ABC', 'ABD', 'DBC'],
  };
  const k = (n) => geo.angleKey(fig, n);
  const B = fig.points.B;
  const inside = (P1, P2) => geo.vec.add(B, geo.vec.mul(geo.bisector(B, P1, P2), 30));
  assert.deepEqual(geo.angleCandidates(fig, inside(fig.points.A, fig.points.D), true), [k('ABC'), k('ABD')]);
  assert.deepEqual(geo.angleCandidates(fig, inside(fig.points.D, fig.points.C), true), [k('ABC'), k('DBC')]);
  // 角の外は候補なし
  assert.deepEqual(geo.angleCandidates(fig, { x: 200, y: 290 }, true), []);
});

test('重ならない角は候補が1つ（現在の15問）', () => {
  PH.problems.forEach((p) => {
    geo.getElements(p.figure).angles.forEach((a) => {
      const R = geo.angleHitRadius(p.figure, a, true);
      const q = geo.vec.add(a.vertex, geo.vec.mul(geo.bisector(a.vertex, a.from, a.to), R * 0.6));
      assert.deepEqual(geo.angleCandidates(p.figure, q, true), [a.key], p.id + ' ∠' + a.name);
    });
  });
});
