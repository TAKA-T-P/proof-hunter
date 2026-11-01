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

test('クイズの進行：15問を1回ずつ答えると終わり、答え合わせの表示中はクリアタイムに入れない', () => {
  const s = new S.QuizSession({ rand: function () { return 0.5; } });
  assert.equal(s.total(), 15);
  assert.equal(new Set(s.order.map(function (q) { return q.id; })).size, 15);
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
    assert.ok(!s.push(s.keys()[0]), '答え合わせ中は入力できない');
    t += 5000;       // 答え合わせの表示（時間に入れない）
    s.next(t);
  }
  assert.ok(s.finished());
  const r = s.result();
  assert.equal(r.correct, 8);
  assert.equal(r.total, 15);
  assert.equal(r.timeMs, 30000);
  assert.equal(r.items.length, 15);
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
    assert.equal(PH.storage.getSummaryQuiz().best, null);
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
    assert.ok(JSON.parse(store[PH.storage.KEY]).summaryQuiz);
  });
});

test('記録：古いデータ（summaryQuiz なし）や壊れた値は未挑戦として読む', () => {
  withFakeStorage(function (store) {
    store[PH.storage.KEY] = JSON.stringify({ version: 6, problems: {}, summaryQuiz: { best: { correct: 'x' }, playCount: -3 } });
    const r = PH.storage.getSummaryQuiz();
    assert.equal(r.best, null);
    assert.equal(r.playCount, 0);
    assert.equal(r.lastResult, null);
  });
});
