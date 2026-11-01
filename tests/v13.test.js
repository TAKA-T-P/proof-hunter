// 証明ハンター Ver.1.3 のテスト（条件・定義のまとめ・条件・定義クイズ）
//   15問の中身／キーパッドで答えが作れること／判定／クイズの進行とクリアタイム／記録
// 実行: npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/storage.js');
require('../js/summary.js');

const PH = globalThis.PH;
const S = PH.summary;

function withFakeStorage(fn) {
  const store = {};
  globalThis.localStorage = {
    getItem: function (k) { return k in store ? store[k] : null; },
    setItem: function (k, v) { store[k] = String(v); },
  };
  PH.storage._reset();
  try { return fn(store); } finally { delete globalThis.localStorage; PH.storage._reset(); }
}

test('15問：合同条件5・平行四辺形になるための条件5・定義5（二等辺三角形・正三角形・長方形・ひし形・正方形）', () => {
  assert.equal(S.QUESTIONS.length, 15);
  const count = function (g) { return S.QUESTIONS.filter(function (q) { return q.group === g; }).length; };
  assert.equal(count('tri'), 5);
  assert.equal(count('para'), 5);
  assert.deepEqual(S.QUESTIONS.filter(function (q) { return q.group === 'def'; }).map(function (q) { return q.name; }),
    ['二等辺三角形', '正三角形', '長方形', 'ひし形', '正方形']);
  assert.equal(new Set(S.QUESTIONS.map(function (q) { return q.id; })).size, 15);
});

test('どの答えも、その問題のキーパッドの語句だけで作れて、正しい文と同じ言葉になる', () => {
  S.QUESTIONS.forEach(function (q) {
    const keys = S.group(q.group).keys;
    assert.equal(new Set(keys).size, keys.length, q.group + ' のキーが重複');
    q.answers.forEach(function (a) {
      a.forEach(function (t) { assert.ok(keys.indexOf(t) >= 0, q.id + ' の「' + t + '」がキーにない'); });
      assert.ok(a.length <= S.MAX_TOKENS);
    });
    // 1つ目の答えは、読点・（定義）をのぞいた正しい文と同じ
    assert.equal(q.answers[0].join(''), q.text.replace(/、|（定義）/g, ''), q.id);
  });
});

test('判定：語句の順番・過不足がちがうとまちがい。正方形は角と辺の順番が逆でも正解', () => {
  const sas = S.question('tri2');
  assert.ok(S.isCorrect(sas, ['2組の', '辺と', 'その間の', '角が', 'それぞれ', '等しい']));
  assert.ok(!S.isCorrect(sas, ['2組の', '辺と', 'その両端の', '角が', 'それぞれ', '等しい']));
  assert.ok(!S.isCorrect(sas, ['2組の', '辺と', 'その間の', '角が', '等しい']));
  const sq = S.question('def-square');
  assert.ok(S.isCorrect(sq, ['4つの', '辺が', '等しく', '4つの', '角が', '等しい', '四角形']));
  assert.ok(!S.isCorrect(S.question('def-rect'), ['4つの', '辺が', '等しい', '四角形']));
});

test('クイズの進行：15問を1回ずつ答えると終わり。不正解は n 回目に＋10×n 秒、答え合わせの表示中は時間に入れない', () => {
  const s = new S.QuizSession({ rand: function () { return 0.5; } });
  assert.equal(s.mode, 'random');
  assert.equal(s.total(), 15);
  assert.equal(new Set(s.slots.map(function (x) { return x.q.id; })).size, 15);
  let t = 1000;
  s.start(t);
  assert.equal(s.submit(t), null, '何も入れていないときは答えない');
  for (let i = 0; i < 15; i++) {
    const q = s.current();
    assert.ok(!s.push('ないキー'));
    const ans = i % 2 === 0 ? q.answers[0] : s.keys().slice(0, 2);
    ans.forEach(function (k) { assert.ok(s.push(k)); });
    t += 2000;
    const item = s.submit(t);
    assert.equal(item.correct, i % 2 === 0);
    assert.equal(item.penaltyMs, item.correct ? 0 : 10000 * ((i + 1) / 2));     // 1回目 10秒、2回目 20秒…
    assert.ok(!s.push(s.keys()[0]), '答え合わせ中は入力できない');
    t += 5000;       // 答え合わせの表示（時間に入れない）
    s.next(t);
  }
  assert.ok(s.finished());
  const r = s.result();
  assert.equal(r.correct, 8);
  assert.equal(r.total, 15);
  assert.equal(r.misses, 7);
  assert.equal(r.penaltyMs, 10000 * (1 + 2 + 3 + 4 + 5 + 6 + 7));
  assert.equal(r.timeMs, 30000 + r.penaltyMs);
  assert.equal(r.items.length, 15);
});

test('キーは1問で最大12個、その問題の答えの語句はすべて入る（図つき・ランダム）', () => {
  for (let seed = 0; seed < 30; seed++) {
    let x = seed + 1;
    const rand = function () { x = (x * 16807) % 2147483647; return x / 2147483647; };
    const s = new S.QuizSession({ rand: rand });
    s.start(0);
    for (let i = 0; i < 15; i++) {
      const keys = s.keys();
      assert.ok(keys.length <= 12 && keys.length >= 8, keys.length + '個');
      assert.equal(new Set(keys).size, keys.length);
      s.current().answers.forEach(function (a) { a.forEach(function (t) { assert.ok(keys.indexOf(t) >= 0, s.current().id + ' ' + t); }); });
      s.push(keys[0]); s.submit(0); s.next(0);
    }
  }
});

test('問題文だけ・順番固定：問題1（合同条件5つ）→問題2（平行四辺形の条件5つ）→問題3（定義①〜⑤）', () => {
  const a = new S.QuizSession({ mode: 'text' });
  const b = new S.QuizSession({ mode: 'text' });
  assert.equal(a.total(), 15);
  assert.deepEqual(a.slots.map(function (x) { return x.problem.no; }), [1, 1, 1, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3]);
  assert.deepEqual(a.slots.map(function (x) { return x.q && x.q.id; }), b.slots.map(function (x) { return x.q && x.q.id; }));
  assert.deepEqual(a.slots.slice(10).map(function (x) { return x.q.name; }), ['二等辺三角形', '正三角形', '長方形', 'ひし形', '正方形']);
  assert.ok(a.slots.slice(0, 10).every(function (x) { return x.q === null; }), '問題1・2は順不同');
});

test('問題文だけ：問題1・2は順不同で判定。同じ条件を2回答えると不正解、不正解のときはまだ答えていない条件を1つ見せる', () => {
  const s = new S.QuizSession({ mode: 'text', rand: function () { return 0.3; } });
  s.start(0);
  // まだ答えていない条件のうち、キーで作れるものを答える
  function answerable() {
    return s.remaining().find(function (q) { return q.answers[0].every(function (t) { return s.keys().indexOf(t) >= 0; }); });
  }
  assert.equal(s.keys().length, 15);
  assert.equal(s.remaining().filter(function (q) { return q.answers[0].every(function (t) { return s.keys().indexOf(t) >= 0; }); }).length, 5,
    '1つ目から、5つの条件すべてがキーで作れる');
  const first = answerable();
  first.answers[0].forEach(function (t) { s.push(t); });
  assert.equal(s.submit(0).id, first.id);
  s.next(0);
  assert.equal(s.remaining().length, 4);
  // 同じ条件をもう一度（キーにあれば）→ 不正解・ペナルティ10秒・まだ答えていない条件が1つ減る
  s.input = first.answers[0].slice();
  const dup = s.submit(0);
  assert.equal(dup.correct, false);
  assert.equal(dup.dup, true);
  assert.equal(dup.penaltyMs, 10000);
  assert.notEqual(dup.id, first.id);
  s.next(0);
  assert.equal(s.remaining().length, 3);
  for (let i = 2; i < 5; i++) {
    assert.deepEqual(s.keys(), S.group('tri').keys, '順不同の問題は、合同条件の語句をすべて出す（15個）');
    const q = answerable();
    assert.ok(q, (i + 1) + 'つ目：キーで作れる条件がある');
    q.answers[0].forEach(function (t) { s.push(t); });
    assert.equal(s.submit(0).correct, true);
    s.next(0);
  }
  assert.equal(s.slot().problem.no, 2);
  assert.deepEqual(s.keys(), S.group('para').keys, '問題2も平行四辺形の語句をすべて出す（14個）');
  assert.equal(s.remaining().length, 5);
  assert.equal(s.correctCount(), 4);
});

test('入力：1つ消す・クリア・語句の数の上限', () => {
  const s = new S.QuizSession();
  s.start(0);
  const k = s.keys()[0];
  for (let i = 0; i < S.MAX_TOKENS; i++) assert.ok(s.push(k));
  assert.ok(!s.push(k));
  assert.ok(s.pop());
  assert.equal(s.input.length, S.MAX_TOKENS - 1);
  assert.ok(s.clear());
  assert.equal(s.input.length, 0);
  assert.ok(!s.pop());
});

test('記録：自己ベストは正解数が多いほう、同じならクリアタイムが短いほう', () => {
  withFakeStorage(function (store) {
    assert.equal(PH.storage.getSummaryQuiz('random').best, null);
    assert.equal(PH.storage.getSummaryQuiz('text').best, null);
    const r1 = PH.storage.recordSummaryQuiz({ correct: 12, total: 15, timeMs: 90000, items: [] });
    assert.equal(r1.firstTime, true);
    assert.equal(r1.newBest, false);
    assert.equal(PH.storage.recordSummaryQuiz({ correct: 11, total: 15, timeMs: 40000, items: [] }).newBest, false);
    assert.equal(PH.storage.recordSummaryQuiz({ correct: 12, total: 15, timeMs: 80000, items: [] }).newBest, true);
    assert.equal(PH.storage.recordSummaryQuiz({ correct: 15, total: 15, timeMs: 120000, items: [{ id: 'tri1', input: ['3組の'], correct: false }] }).newBest, true);
    const rec = PH.storage.getSummaryQuiz();
    assert.equal(rec.playCount, 4);
    assert.equal(rec.best.correct, 15);
    assert.equal(rec.lastResult.items[0].id, 'tri1');
    // 保存したものを読みなおしても同じ。ほかのモードの記録は変わらない
    PH.storage._reset();
    assert.equal(PH.storage.getSummaryQuiz().best.timeMs, 120000);
    assert.equal(PH.storage.getRank('basic').playCount, 0);
    assert.ok(JSON.parse(store[PH.storage.KEY]).summaryQuiz.random);
    // 問題文だけのモードの記録は別
    assert.equal(PH.storage.getSummaryQuiz('text').playCount, 0);
    const t1 = PH.storage.recordSummaryQuiz({ mode: 'text', correct: 10, total: 15, timeMs: 200000, penaltyMs: 150000, misses: 5, items: [] });
    assert.equal(t1.firstTime, true);
    assert.equal(PH.storage.getSummaryQuiz('text').best.penaltyMs, 150000);
    assert.equal(PH.storage.getSummaryQuiz('random').playCount, 4);
  });
});

test('記録：モードに分ける前の記録は、図つき・ランダムの記録として読む', () => {
  withFakeStorage(function (store) {
    store[PH.storage.KEY] = JSON.stringify({ version: 6, summaryQuiz: { best: { correct: 14, total: 15, timeMs: 70000 }, playCount: 2, lastResult: null } });
    assert.equal(PH.storage.getSummaryQuiz('random').best.correct, 14);
    assert.equal(PH.storage.getSummaryQuiz('random').playCount, 2);
    assert.equal(PH.storage.getSummaryQuiz('text').best, null);
  });
});

test('記録：古いデータ（summaryQuiz なし）や壊れた値は未挑戦として読む', () => {
  withFakeStorage(function (store) {
    store[PH.storage.KEY] = JSON.stringify({ version: 6, problems: {}, summaryQuiz: { best: { correct: 'x' }, playCount: -3 } });
    const r = PH.storage.getSummaryQuiz('random');
    assert.equal(r.best, null);
    assert.equal(r.playCount, 0);
    assert.equal(r.lastResult, null);
  });
});
