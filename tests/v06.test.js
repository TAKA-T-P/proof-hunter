// 証明ハンター Ver.0.6 のテスト（段位認定モード：ミニ問題の生成・出題順・タイマー・判定・段位・コンボ・保存）
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
require('../js/rank-config.js');
require('../js/rank-questions.js');
require('../js/rank-game.js');

const PH = globalThis.PH;
const val = PH.validation;
const geo = PH.geometry;
const RQ = PH.rankQuestions;
const R = PH.rank;
const CFG = PH.rankConfig;
const ALL = RQ.all();
const k = (p, n) => geo.elementKey(p.figure, n);

// 正解の選択肢を選んで確定する（記号入力は正解の文字列を入れる）
function answerRight(g, t) {
  const c = g.current;
  if (c.mode === 'input') return g.submit(t, rightInput(c.q));
  let r;
  c.blanks.forEach((b, i) => { r = g.choose(i, b.answer, t); });
  if (c.blanks.length > 1) r = g.submit(t);
  return r;
}
function answerWrong(g, t) {
  const c = g.current;
  if (c.mode === 'input') return g.submit(t, wrongInput(c.q));
  let r;
  c.blanks.forEach((b, i) => { r = g.choose(i, b.choices.find((x) => x.id !== b.answer).id, t); });
  if (c.blanks.length > 1) r = g.submit(t);
  return r;
}
function rightInput(q) {
  if (q.input.keypad.triangle) return q.input.answerText.replace(/[△]/g, '').replace('と', '/');
  return q.input.answerText.split('／')[0].replace('＝', '=');
}
function wrongInput(q) {
  if (q.input.keypad.triangle) return 'ZZZ/YYY';
  if (q.input.keypad.fixedLeft) return q.input.keypad.fixedLeft + '=' + q.input.keypad.fixedLeft;
  return 'AB=AB';
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

function result(over) {
  return Object.assign({ correct: 15, misses: 4, passes: 1, answered: 19, effectiveScore: 13, rank: 13, rankName: '四段',
    maxCombo: 7, criteriaVersion: CFG.criteriaVersion, seed: 1, wrongs: [] }, over || {});
}

// ---- 22-1 問題生成 ---------------------------------------------------------------

test('既存20問からミニ問題を生成でき、IDが重複しない', () => {
  assert.ok(ALL.length >= 200, String(ALL.length));
  assert.equal(new Set(ALL.map((q) => q.id)).size, ALL.length);
  // すべての元問題が使われている（同じ内容の問題はまとめるが、各問題から1つ以上）
  const sources = new Set(ALL.map((q) => q.sourceId));
  PH.problems.forEach((p) => assert.ok(sources.has(p.id), p.id));
  // どの問題も、選択式か記号入力のどちらかで出題できる
  ALL.forEach((q) => {
    assert.ok(q.choice || q.input, q.id);
    assert.ok(RQ.CATEGORIES.includes(q.category), q.id);
    assert.ok(q.difficulty >= 1 && q.difficulty <= 3, q.id);
    if (q.choice) assert.equal(q.choice.blanks.length, q.blanks, q.id);
    if (q.input) assert.equal(q.blanks, 1, q.id);
    assert.ok(q.ask && q.answerText && q.explain, q.id);
  });
});

test('問題の種類が偏りすぎない（カテゴリ・解答箇所の数・記号入力）', () => {
  const by = (f) => ALL.reduce((m, q) => { m[f(q)] = (m[f(q)] || 0) + 1; return m; }, {});
  const cats = by((q) => q.category);
  RQ.CATEGORIES.forEach((c) => assert.ok(cats[c] >= 10, c + ': ' + cats[c]));
  const blanks = by((q) => q.blanks);
  assert.ok(blanks[1] > 0 && blanks[2] > 0 && blanks[3] > 0, JSON.stringify(blanks));
  const input = ALL.filter((q) => q.input);
  assert.ok(input.length >= 50, String(input.length));
  assert.deepEqual([...new Set(input.map((q) => q.category))].sort(), ['corr', 'eq', 'final']);
});

// 選択肢の正しさを、生成とは別の方法で判定する
function isCorrectChoice(q, blankIndex, text) {
  const p = PH.getProblem(q.sourceId);
  const b = q.choice.blanks[blankIndex];
  switch (q.type) {
    case 'equation': {
      const ev = p.evidence.find((e) => q.id.endsWith('-' + e.id));
      const shown = { reason: ev.reason, text: ev.proofReason || PH.REASONS[ev.reason].proof, specific: !!ev.proofReason };
      const keys = text.split('＝').map((n) => k(p, n));
      const hit = val.matchEvidence(p, keys);
      return !!hit && PH.puzzleUtil.reasonAccepts(shown, hit);
    }
    case 'reason': case 'reasonMulti': {
      const label = b.label.replace(/ の理由$/, '');
      const ev = q.type === 'reason' ? p.evidence.find((e) => q.id.endsWith('-' + e.id)) : p.evidence.find((e) => e.label === label);
      const keys = ev.items.map((n) => k(p, n));
      if (ev.proofReason && text === ev.proofReason) return true;
      const rid = Object.keys(PH.REASONS).find((r) => PH.REASONS[r].proof === text);
      if (!rid) return false;
      const st = val.checkEvidence(p, keys, rid, []).status;
      return st === 'correct' && !ev.proofReason;
    }
    case 'condition':
      return text === PH.CONDITIONS[val.deriveCondition(p, p.evidence)].label;
    case 'vertex': case 'vertexMulti': {
      const t1 = p.triangles[0], t2 = p.triangles[1];
      const v = q.type === 'vertex' ? q.ask.match(/頂点 (\S) /)[1] : b.label[0];
      const from = q.type === 'vertex' && q.id.includes('-vx1') ? [t2, t1] : [t1, t2];
      return from[1][from[0].indexOf(v)] === text;
    }
    case 'part': {
      const left = b.label.replace('＝', '');
      // 合同な三角形の対応する辺・角で、左辺と対応するもの
      const part = val.classifyPair(p, [k(p, left), k(p, text)]);
      return !!part;
    }
    case 'triangle': {
      const m = text.match(/^△(\w{3})と△(\w{3})$/);
      return val.checkTriangles(p, m[1].split(''), m[2].split('')).ok;
    }
    case 'finalReason':
      return text === PH.REASONS[PH.finalReasonFor(p)].proof;
  }
  throw new Error('unknown type ' + q.type);
}

test('どの選択式の問題も、正解の選択肢がちょうど1つ（誤答の選択肢に別の正解がない）', () => {
  ALL.filter((q) => q.choice).forEach((q) => {
    q.choice.blanks.forEach((b, i) => {
      assert.ok(b.choices.length >= 3, q.id + ' 3択以上');
      assert.equal(new Set(b.choices.map((c) => c.text)).size, b.choices.length, q.id + ' 選択肢の重複');
      const correct = b.choices.filter((c) => isCorrectChoice(q, i, c.text));
      assert.equal(correct.length, 1, q.id + ' ' + b.label + ': ' + correct.map((c) => c.text).join(','));
      assert.equal(correct[0].id, b.answer, q.id);
    });
  });
});

test('誤答の選択肢に、正しいが今回は使わない関係（extraTruths）や根拠を使わない', () => {
  ALL.filter((q) => q.type === 'equation' && q.choice).forEach((q) => {
    const p = PH.getProblem(q.sourceId);
    q.choice.blanks[0].choices.filter((c) => c.id !== 'a').forEach((c) => {
      const st = val.equationStatus(p, c.text.split('＝').map((n) => k(p, n)));
      assert.ok(st !== 'irrelevant' && st !== 'evidence', q.id + ' ' + c.text + ' ' + st);
    });
  });
  // 合同から等しい辺・角の誤答は、図の上でも等しくない（見た目でも別の正解にならない）
  ALL.filter((q) => q.type === 'part' && q.choice).forEach((q) => {
    const p = PH.getProblem(q.sourceId);
    const left = q.choice.blanks[0].label.replace('＝', '');
    const lm = val.measure(p.figure, left).value;
    q.choice.blanks[0].choices.filter((c) => c.id !== 'a').forEach((c) => {
      assert.ok(Math.abs(val.measure(p.figure, c.text).value - lm) > 0.5, q.id + ' ' + c.text);
    });
  });
});

test('記号入力：正しい別表記を正解にし、数学的に正しくない等式は正解にしない', () => {
  const byId = (id) => RQ.byId(id);
  // p01（△ABD≡△CBD）共通な辺：BD＝BD、DB＝BD、BD＝DB はどれも正解
  const common = byId('p01-eq-e3');
  ['BD=BD', 'DB=BD', 'BD=DB', 'db=bd'].forEach((v) => assert.equal(common.input.check(v), true, v));
  assert.equal(common.input.check('AB=CB'), false);
  // 仮定より：仮定のどちらの等式でも正解（左右の入れかえも可）
  const given = byId('p01-eq-e1');
  ['AB=CB', 'CB=AB', 'BA=BC', 'AD=CD', 'DC=DA'].forEach((v) => assert.equal(given.input.check(v), true, v));
  ['AB=AD', 'BD=BD', 'AB=CD'].forEach((v) => assert.equal(given.input.check(v), false, v));
  // 対頂角（p02）：∠AOC＝∠BOD、∠COA＝∠DOB、∠BOD＝∠AOC
  const vert = byId('p02-eq-e3');
  ['∠AOC=∠BOD', '∠COA=∠DOB', '∠BOD=∠AOC'].forEach((v) => assert.equal(vert.input.check(v), true, v));
  assert.equal(vert.input.check('∠AOD=∠BOC'), false);                    // 正しいが今回は使わない関係（extraTruths）
  // 一直線上の点による角の別名（p03：O は AC 上なので ∠BAO＝∠BAC）
  const alias = byId('p03-eq-e2');
  ['∠BAO=∠DCO', '∠BAC=∠DCA', '∠OAB=∠OCD'].forEach((v) => assert.equal(alias.input.check(v), true, v));
  // 合同から等しい辺（左辺は固定）：向きは問わない
  const part = ALL.find((q) => q.type === 'part' && q.input.keypad.fixedLeft === 'AB' && q.sourceId === 'p01');
  assert.equal(part.input.check('AB=CB'), true);
  assert.equal(part.input.check('AB=BC'), true);
  assert.equal(part.input.check('AB=CD'), false);
  // 三角形：対応を保った並べ替え・左右の交換は正解、対応ちがいは不正解
  const tri = byId('p17-tri');
  ['AOC/BOD', 'OCA/ODB', 'BOD/AOC'].forEach((v) => assert.equal(tri.input.check(v), true, v));
  ['AOC/DOB', 'AOB/COD', 'AOC/AOC'].forEach((v) => assert.equal(tri.input.check(v), false, v));
  // 形式が不正・図にない記号でもエラーにならない
  [null, '', 'XYZ', '<script>', 'AB=', 'ZZ=ZZ'].forEach((v) => assert.equal(common.input.check(v), false, String(v)));
});

test('出題候補が足りなくても止まらない（少ない候補で何問でも出題できる）', () => {
  const small = ALL.filter((q) => q.sourceId === 'p01' && q.choice && q.blanks === 1).slice(0, 2);
  const picker = new PH.rankUtil.Picker(PH.rankUtil.mulberry32(1), small);
  const ids = [];
  for (let n = 1; n <= 60; n++) ids.push(picker.pick(n).q.id);
  assert.equal(ids.length, 60);
  // 候補が2つなら、同じ問題が続かない
  for (let i = 1; i < ids.length; i++) assert.notEqual(ids[i], ids[i - 1]);
  const one = new PH.rankUtil.Picker(PH.rankUtil.mulberry32(2), small.slice(0, 1));
  for (let n = 1; n <= 20; n++) assert.ok(one.pick(n));
});

// ---- 22-2 出題順 -----------------------------------------------------------------

function sequence(seed, count) {
  const g = new PH.RankGame({ seed });
  g.start(0);
  const out = [];
  for (let i = 0; i < count; i++) {
    out.push(g.current);
    answerRight(g, i);
  }
  return { g, out };
}

test('1〜10問目は選択式、11問目以降は設定した割合で記号入力を含む', () => {
  let input = 0, total = 0;
  for (let seed = 1; seed <= 40; seed++) {
    const { out } = sequence(seed, 30);
    out.forEach((c) => {
      if (c.no <= CFG.selectZoneCount) {
        assert.equal(c.mode, 'choice', 'seed ' + seed + ' Q' + c.no);
        assert.equal(c.zone, 'select');
      } else {
        assert.equal(c.zone, 'challenge');
        total++;
        if (c.mode === 'input') input++;
      }
      if (c.no <= 3) { assert.equal(c.q.difficulty, 1, 'Q' + c.no); assert.equal(c.blanks.length, 1); }   // 序盤は易しく
      if (c.no <= 10) assert.ok(c.blanks.length <= 2, 'Q' + c.no);
      if (c.mode === 'input') assert.equal(c.blanks.length, 1);
    });
  }
  const ratio = input / total;
  assert.ok(Math.abs(ratio - CFG.inputRatio) < 0.1, 'input ratio ' + ratio.toFixed(2));
});

test('解答箇所の数の割合は、おおむね 1か所70%・2か所25%・3か所5%（チャレンジゾーンの選択式）', () => {
  const cnt = { 1: 0, 2: 0, 3: 0 };
  for (let seed = 1; seed <= 60; seed++) {
    sequence(seed, 40).out.filter((c) => c.no > 10 && c.mode === 'choice').forEach((c) => { cnt[c.blanks.length]++; });
  }
  const sum = cnt[1] + cnt[2] + cnt[3];
  assert.ok(Math.abs(cnt[1] / sum - 0.7) < 0.08, JSON.stringify(cnt));
  assert.ok(Math.abs(cnt[2] / sum - 0.25) < 0.08, JSON.stringify(cnt));
  assert.ok(cnt[3] > 0 && cnt[3] / sum < 0.12, JSON.stringify(cnt));
});

test('同じ問題を短時間に出さない・同じ元問題が続かない・カテゴリが偏らない', () => {
  for (let seed = 1; seed <= 20; seed++) {
    const { out } = sequence(seed, 40);
    const ids = out.map((c) => c.q.id);
    assert.equal(new Set(ids).size, ids.length, 'seed ' + seed + ' 40問で重複なし');
    let same = 0;
    for (let i = 1; i < out.length; i++) if (out[i].q.sourceId === out[i - 1].q.sourceId) same++;
    assert.ok(same <= 2, 'seed ' + seed + ' 同じ元問題の連続 ' + same);
    // 最初の10問で5つのカテゴリがすべて出る
    assert.equal(new Set(out.slice(0, 10).map((c) => c.q.category)).size, 5, 'seed ' + seed);
  }
});

test('シードを固定すると同じ問題順・同じ選択肢の並びになり、正解の判定は変わらない', () => {
  const a = sequence(123, 30).out, b = sequence(123, 30).out;
  assert.deepEqual(a.map((c) => c.q.id + ':' + c.mode), b.map((c) => c.q.id + ':' + c.mode));
  assert.deepEqual(a.map((c) => c.blanks.map((x) => (x.choices || []).map((y) => y.id).join('')).join('|')),
    b.map((c) => c.blanks.map((x) => (x.choices || []).map((y) => y.id).join('')).join('|')));
  const c = sequence(124, 30).out;
  assert.notDeepEqual(a.map((x) => x.q.id), c.map((x) => x.q.id));
  // どのシードでも、正解を選べば必ず正解
  for (let seed = 1; seed <= 30; seed++) {
    const { g } = sequence(seed, 40);
    assert.equal(g.correct, 40, 'seed ' + seed);
    assert.equal(g.misses, 0);
  }
});

// ---- 22-3 タイマー ----------------------------------------------------------------

test('120秒で終了し、残り時間は0未満にならない（呼び出し回数ではなく経過時間で決まる）', () => {
  const g = new PH.RankGame({ seed: 5 });
  assert.equal(g.timeLeft(0), 120000);
  g.start(1000);
  assert.equal(g.timeLeft(1000), 120000);
  assert.equal(g.timeLeft(61000), 60000);
  assert.equal(g.timeLeft(500000), 0);
  assert.equal(g.tick(120999), 'play');
  // 表示の更新が止まっていても（別タブ・端末のロック）、次に確認した時点で終わっている
  assert.equal(g.tick(400000), 'over');
  assert.ok(g.result);
  assert.equal(g.timeLeft(400000), 0);
});

test('確定した時刻が制限時間内なら受け付け、時間切れ後の解答は受け付けない', () => {
  let g = new PH.RankGame({ seed: 6 });
  g.start(0);
  assert.notEqual(answerRight(g, 120000).status, 'closed');      // ちょうど120秒は時間内
  assert.equal(g.correct, 1);
  g = new PH.RankGame({ seed: 6 });
  g.start(0);
  const r = answerRight(g, 120001);
  assert.equal(r.status, 'closed');
  assert.equal(g.correct, 0);
  assert.equal(g.misses, 0);
  assert.equal(g.state, 'over');
  assert.equal(g.pass(130000).status, 'closed');
  assert.equal(g.misses, 0);                                       // 時間切れ後のパスはミスにしない
});

test('終了処理は1回だけ。途中終了は結果を作らない', () => {
  let calls = 0;
  const g = new PH.RankGame({ seed: 7, onFinish: () => { calls++; } });
  g.start(0);
  answerRight(g, 1000);
  g.tick(120000); g.tick(130000); g.submit(140000, 'AB=CD'); g.pass(150000); g.finish();
  assert.equal(calls, 1);
  assert.equal(g.result.correct, 1);
  // 途中終了
  let aborted = 0;
  const h = new PH.RankGame({ seed: 8, onFinish: () => { aborted++; } });
  h.start(0);
  answerRight(h, 1000);
  h.abort();
  assert.equal(h.state, 'aborted');
  h.tick(200000);
  assert.equal(aborted, 0);
  assert.equal(h.result, null);
  assert.equal(h.choose(0, 'a', 2000).status, 'closed');
});

// ---- 22-4 正誤判定 ----------------------------------------------------------------

test('正解で正解数+1、不正解でミス+1、パスでミス+1（正解数は増えない）', () => {
  const g = new PH.RankGame({ seed: 9 });
  g.start(0);
  assert.equal(answerRight(g, 1).status, 'correct');
  assert.equal(answerWrong(g, 2).status, 'wrong');
  assert.equal(g.pass(3).status, 'pass');
  assert.equal(g.correct, 1);
  assert.equal(g.misses, 2);
  assert.equal(g.passes, 1);
  assert.equal(g.answered, 3);
  assert.equal(g.wrongs.length, 2);
  assert.equal(g.wrongs[1].yourAnswer, 'パス');
  assert.ok(g.wrongs[0].correctAnswer && g.wrongs[0].explain && g.wrongs[0].sourceId);
});

test('複数の解答箇所：すべて正しいときだけ1問正解。一部だけ正しくてもミスは1回。選択途中は判定しない', () => {
  const multi = ALL.filter((q) => q.blanks === 2 && q.choice);
  const g = new PH.RankGame({ seed: 10, pool: multi });
  g.start(0);
  const c = g.current;
  assert.equal(c.blanks.length, 2);
  // 1つ目だけ選んだ段階では判定しない
  assert.equal(g.choose(0, c.blanks[0].answer, 1).status, 'selected');
  assert.equal(g.submit(2).status, 'incomplete');
  assert.equal(g.misses, 0);
  // 2つ目をまちがえて確定 → ミスは1回だけ
  g.choose(1, c.blanks[1].choices.find((x) => x.id !== c.blanks[1].answer).id, 3);
  assert.equal(g.submit(4).status, 'wrong');
  assert.equal(g.misses, 1);
  assert.equal(g.correct, 0);
  // 両方正しければ1問正解（2問分ではない）
  assert.equal(answerRight(g, 5).status, 'correct');
  assert.equal(g.correct, 1);
  // 3か所の問題
  const three = ALL.filter((q) => q.blanks === 3 && q.choice);
  const h = new PH.RankGame({ seed: 11, pool: three });
  h.start(0);
  assert.equal(answerRight(h, 1).status, 'correct');
  assert.equal(h.correct, 1);
});

test('記号入力：未入力は判定しない。正しい別表記は正解', () => {
  const pool = [RQ.byId('p02-eq-e3')];
  const g = new PH.RankGame({ seed: 12, pool: pool });
  g.start(0);
  // 選択式（1〜10問目）として出るので、11問目まで進める
  for (let i = 0; i < 10; i++) answerRight(g, i);
  let guard = 0;
  while (g.current.mode !== 'input' && guard++ < 50) answerRight(g, 20 + guard);
  assert.equal(g.current.mode, 'input');
  assert.equal(g.submit(100, null).status, 'incomplete');
  assert.equal(g.submit(101, '∠DOB=∠COA').status, 'correct');
});

test('理由・合同条件・頂点の対応を正しく判定する', () => {
  ['reason', 'condition', 'vertex', 'finalReason'].forEach((type) => {
    const pool = ALL.filter((q) => q.type === type);
    const g = new PH.RankGame({ seed: 13, pool: pool });
    g.start(0);
    for (let i = 0; i < 15; i++) {
      assert.equal(g.current.q.type, type);
      if (i % 2) assert.equal(answerWrong(g, i).status, 'wrong', type);
      else assert.equal(answerRight(g, i).status, 'correct', type);
    }
  });
});

// ---- 22-5 段位 -------------------------------------------------------------------

test('有効正解数 = 正解数 − ミス数 × 0.5（0未満にならない）', () => {
  assert.equal(R.effectiveScore(15, 4), 13);
  assert.equal(R.effectiveScore(14, 3), 12.5);
  assert.equal(R.effectiveScore(2, 10), 0);
  assert.equal(R.effectiveScore(0, 0), 0);
});

test('21段階の段位が正しい順序で、境界値で正しく認定される（20以上で皆伝）', () => {
  const g = CFG.grades;
  assert.equal(g.length, 21);
  assert.deepEqual(g.map((x) => x.name), ['10級', '9級', '8級', '7級', '6級', '5級', '4級', '3級', '2級', '1級',
    '初段', '二段', '三段', '四段', '五段', '六段', '七段', '八段', '九段', '十段', '皆伝']);
  g.forEach((x, i) => { assert.equal(x.rank, i); if (i) assert.ok(x.min > g[i - 1].min); });
  const name = (s) => R.gradeFor(s).name;
  assert.equal(name(0), '10級');
  assert.equal(name(0.5), '10級');
  assert.equal(name(1), '9級');
  assert.equal(name(9.5), '1級');
  assert.equal(name(10), '初段');
  assert.equal(name(13), '四段');
  assert.equal(name(19.5), '十段');
  assert.equal(name(20), '皆伝');
  assert.equal(name(35), '皆伝');
  assert.deepEqual(R.nextGrade(13), { grade: g[14], need: 1 });
  assert.deepEqual(R.nextGrade(12.5), { grade: g[13], need: 0.5 });
  assert.equal(R.nextGrade(20), null);
  assert.equal(R.tierFor(9), 'kyu');
  assert.equal(R.tierFor(10), 'medal');
  assert.equal(R.tierFor(15), 'gold');
  assert.equal(R.tierFor(20), 'crown');
});

test('結果：段位・有効正解数・最高連続正解・認定基準のバージョン', () => {
  const g = new PH.RankGame({ seed: 14 });
  g.start(0);
  for (let i = 0; i < 15; i++) answerRight(g, i);
  for (let i = 0; i < 4; i++) answerWrong(g, 20 + i);
  g.tick(120000);
  const r = g.result;
  assert.equal(r.correct, 15);
  assert.equal(r.misses, 4);
  assert.equal(r.effectiveScore, 13);
  assert.equal(r.rankName, '四段');
  assert.equal(r.rank, 13);
  assert.equal(r.maxCombo, 15);
  assert.equal(r.criteriaVersion, CFG.criteriaVersion);
  assert.equal(r.wrongs.length, 4);
});

test('最高段位を保存し、下がらない。認定基準のバージョンを保存する', () => {
  withFakeStorage(null, (mem) => {
    const S = PH.storage;
    assert.equal(S.getRank().best, null);
    let s = S.recordRank(result());
    assert.equal(s.firstTime, true);
    assert.equal(s.newRecord, false);
    assert.equal(S.getRank().best.rankName, '四段');
    s = S.recordRank(result({ correct: 5, misses: 2, effectiveScore: 4, rank: 4, rankName: '6級', maxCombo: 3 }));
    assert.equal(s.newRecord, false);
    assert.equal(S.getRank().best.rank, 13);                      // 下がらない
    s = S.recordRank(result({ correct: 18, misses: 1, effectiveScore: 17.5, rank: 17, rankName: '八段', maxCombo: 12 }));
    assert.equal(s.newRecord, true);
    const r = S.getRank();
    assert.equal(r.best.rankName, '八段');
    assert.equal(r.bestCorrect, 18);
    assert.equal(r.bestCombo, 12);
    assert.equal(r.playCount, 3);
    assert.equal(r.criteriaVersion, CFG.criteriaVersion);
    assert.equal(r.lastResult.rankName, '八段');
    const saved = JSON.parse(mem[S.KEY]);
    assert.equal(saved.rankCertification.criteriaVersion, CFG.criteriaVersion);
    assert.equal(saved.rankCertification.best.rankName, '八段');
    // 認定基準が変わったら、以前の最高記録は比べずに previous に残す
    s = S.recordRank(result({ criteriaVersion: CFG.criteriaVersion + 1, rank: 2, rankName: '8級', effectiveScore: 2, correct: 2 }));
    assert.equal(S.getRank().best.rankName, '8級');
    assert.equal(S.getRank().previous[0].best.rankName, '八段');
    assert.equal(S.getRank().previous[0].criteriaVersion, CFG.criteriaVersion);
  });
});

// ---- 22-6 コンボ ------------------------------------------------------------------

test('連続正解：正解で+1、不正解・パスでリセット、最高連続正解を記録。得点は変わらない', () => {
  const g = new PH.RankGame({ seed: 15 });
  g.start(0);
  const texts = [];
  for (let i = 0; i < 15; i++) { const r = answerRight(g, i); if (r.comboText) texts.push(r.combo + ':' + r.comboText); }
  assert.deepEqual(texts, ['3:NICE！', '5:GREAT！', '10:EXCELLENT！', '15:AMAZING！']);
  assert.equal(g.combo, 15);
  answerWrong(g, 20);
  assert.equal(g.combo, 0);
  answerRight(g, 21); answerRight(g, 22);
  g.pass(23);
  assert.equal(g.combo, 0);
  assert.equal(g.maxCombo, 15);
  g.tick(120000);
  // コンボのボーナスはない：17正解・2ミス → 16
  assert.equal(g.result.effectiveScore, R.effectiveScore(17, 2));
});

// ---- 22-7 保存・互換性 --------------------------------------------------------------

test('Ver.0.5 の保存データを引き継ぎ、ハンター・パズル3レベルの記録は変わらない', () => {
  const v05 = JSON.stringify({
    version: 4,
    problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 }, p17: { cleared: true, bestStars: 2, minMisses: 1 } },
    puzzleLevels: { easy: { p02: { cleared: true, bestStars: 3, minMisses: 0 } }, standard: { p16: { cleared: true, bestStars: 1, minMisses: 4 } }, challenge: {} },
    puzzleLevel: 'challenge', puzzleMigrated: true, lastMode: 'puzzle', lastPuzzleProblemId: 'p16', sound: false,
  });
  withFakeStorage(v05, (mem) => {
    const S = PH.storage;
    assert.equal(S.getRank().best, null);                          // 段位認定は未認定から
    assert.equal(S.getRank().playCount, 0);
    S.recordRank(result());
    assert.equal(S.getProblem('p01').bestStars, 3);
    assert.equal(S.getProblem('p17').bestStars, 2);
    assert.equal(S.getProblem('p02', 'puzzle:easy').bestStars, 3);
    assert.equal(S.getProblem('p16', 'puzzle:standard').bestStars, 1);
    assert.equal(S.getPuzzleLevel(), 'challenge');
    assert.deepEqual(S.getLastPlay(), { mode: 'puzzle', id: 'p16' });
    assert.equal(S.getSound(), false);
    const saved = JSON.parse(mem[S.KEY]);
    assert.equal(saved.problems.p01.bestStars, 3);
    assert.equal(saved.puzzleLevels.easy.p02.bestStars, 3);
    assert.equal(saved.rankCertification.best.rankName, '四段');
    // 段位認定の記録は、ハンター・パズルの記録を変えない（逆も同じ）
    S.recordClear('p03', 3, 0);
    assert.equal(S.getRank().best.rankName, '四段');
  });
});

test('壊れた段位認定のデータでもエラーにならない', () => {
  [{ rankCertification: 'x' }, { rankCertification: { best: 5, playCount: -3, lastReview: 'a', previous: 1 } },
    { rankCertification: { best: { rank: 'x' }, bestCorrect: 'nan' } }].forEach((bad) => {
    withFakeStorage(JSON.stringify(bad), () => {
      const r = PH.storage.getRank();
      assert.equal(r.best, null);
      assert.equal(r.playCount, 0);
      assert.deepEqual(r.lastReview, []);
      PH.storage.recordRank(result());
      assert.equal(PH.storage.getRank().best.rankName, '四段');
    });
  });
  withFakeStorage('{not json', () => {
    assert.equal(PH.storage.getRank().best, null);
  });
});

test('LocalStorage が使えなくても段位認定をプレイ・記録できる（メモリ上）', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('denied'); }, configurable: true });
  PH.storage._reset();
  try {
    const g = new PH.RankGame({ seed: 16 });
    g.start(0);
    answerRight(g, 1);
    g.tick(120000);
    PH.storage.recordRank(g.result);
    assert.equal(PH.storage.getRank().playCount, 1);
    assert.equal(PH.storage.getRank().lastResult.correct, 1);
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
    PH.storage._reset();
  }
});

test('振り返り用の誤答は上限つきで、直近1回分だけ保存する', () => {
  withFakeStorage(null, () => {
    const many = Array.from({ length: 60 }, (_, i) => ({ no: i + 1, qid: 'x', typeLabel: 't', question: 'q', yourAnswer: 'a', correctAnswer: 'b', explain: 'e' }));
    PH.storage.recordRank(result({ wrongs: many }));
    assert.equal(PH.storage.getRank().lastReview.length, 40);
    PH.storage.recordRank(result({ wrongs: many.slice(0, 2) }));
    assert.equal(PH.storage.getRank().lastReview.length, 2);
  });
});

test('数学キーパッド：左辺を固定した入力（段位認定の「AC＝＿＿」）', () => {
  const kp = PH.mathKeypad.create(['A', 'B', 'C', 'D', 'E', 'F'], { fixedLeft: 'AC' });
  assert.equal(kp.kind, 'seg');
  assert.equal(kp.display(), 'AC＝＿＿');
  assert.equal(kp.setKind('ang'), false);
  assert.equal(kp.isEmpty(), true);
  assert.equal(kp.backspace(), false);                              // 左辺は消せない
  kp.press('D'); kp.press('F');
  assert.equal(kp.value(), 'AC=DF');
  kp.backspace(); kp.backspace();
  assert.equal(kp.backspace(), false);
  assert.equal(kp.display(), 'AC＝＿＿');
  kp.press('E'); kp.clear();
  assert.equal(kp.display(), 'AC＝＿＿');
  const ang = PH.mathKeypad.create(['A', 'B', 'C', 'D', 'E', 'F'], { fixedLeft: '∠ABC' });
  ['D', 'E', 'F'].forEach((c) => ang.press(c));
  assert.equal(ang.value(), '∠ABC=∠DEF');
  assert.ok(!PH.mathKeypad.render(ang).includes('data-kp="kind:'));
});
