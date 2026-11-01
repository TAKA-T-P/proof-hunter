/*
 * summary.js — 条件・定義のまとめ と 条件・定義クイズ（Ver.1.3）
 *
 * クイズは15問（三角形の合同条件5つ・平行四辺形になるための条件5つ・図形の定義5つ）。2つのモードがある。
 *   random … 図つき・出題順はランダム。図の印から、どの条件・定義かを答える
 *   text   … 問題文だけ・出題順は固定。問題1（合同条件を5つ）・問題2（平行四辺形になるための条件を5つ）は順不同、
 *            問題3（定義）は①二等辺三角形〜⑤正方形の順
 * 答えはキーパッドの語句（「2組の」「辺が」「それぞれ」「等しい」など）を順に並べて作る。キーは1問につき最大12個
 * （順不同の問題1・2だけは、その種類の語句をすべて出す。合同条件は15個、平行四辺形は14個）。
 * 1問につき解答は1回。不正解のたびにペナルティとして n 回目は 10×n 秒をクリアタイムに足す。
 * 答え合わせの表示中は、クリアタイムに入れない。
 * 画面は js/summary-renderer.js。この中身は画面なしで動く（tests/v13.test.js）。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  // 問題の種類と、その種類で使う語句（キーはこの並びで出す。1問ごとに、この中から最大12個。順不同の問題はすべて）
  const GROUPS = [
    {
      id: 'tri', label: '三角形の合同条件',
      keys: ['1組の', '2組の', '3組の', '直角三角形の', '辺が', '辺と', '角が', '斜辺と', '他の1辺が',
        '1つの', '鋭角が', 'その間の', 'その両端の', 'それぞれ', '等しい'],
    },
    {
      id: 'para', label: '平行四辺形になるための条件',
      keys: ['1組の', '2組の', '対辺が', '対角が', '対角線が', 'それぞれ', 'それぞれの', '平行', '平行で',
        'その長さが', '中点で', '垂直に', '交わる', '等しい'],
    },
    {
      id: 'def', label: '図形の定義',
      keys: ['2辺が', '3辺が', '4つの', '2組の', '辺が', '角が', '対辺が', '平行な', '等しく', '等しい', '三角形', '四角形'],
    },
  ];

  /*
   * 15問。answers … 正解の語句の並び（ほかの言い方も正解にするときは2つ目以降に書く）
   *   text … 正しい文（読点つき。答え合わせ・まとめで見せる）
   *   fig … 図の種類（summary-renderer.js が描く）。after … 定義の問題で、答えのうしろに続く言葉
   */
  const QUESTIONS = [
    { id: 'tri1', group: 'tri', no: 1, fig: 'tri-sss', text: '3組の辺がそれぞれ等しい',
      answers: [['3組の', '辺が', 'それぞれ', '等しい']] },
    { id: 'tri2', group: 'tri', no: 2, fig: 'tri-sas', text: '2組の辺とその間の角がそれぞれ等しい',
      answers: [['2組の', '辺と', 'その間の', '角が', 'それぞれ', '等しい']] },
    { id: 'tri3', group: 'tri', no: 3, fig: 'tri-asa', text: '1組の辺とその両端の角がそれぞれ等しい',
      answers: [['1組の', '辺と', 'その両端の', '角が', 'それぞれ', '等しい']] },
    { id: 'tri4', group: 'tri', no: 4, fig: 'tri-rha', text: '直角三角形の斜辺と1つの鋭角がそれぞれ等しい',
      answers: [['直角三角形の', '斜辺と', '1つの', '鋭角が', 'それぞれ', '等しい']] },
    { id: 'tri5', group: 'tri', no: 5, fig: 'tri-rhs', text: '直角三角形の斜辺と他の1辺がそれぞれ等しい',
      answers: [['直角三角形の', '斜辺と', '他の1辺が', 'それぞれ', '等しい']] },
    { id: 'para1', group: 'para', no: 1, fig: 'para-par', text: '2組の対辺がそれぞれ平行（定義）',
      answers: [['2組の', '対辺が', 'それぞれ', '平行']] },
    { id: 'para2', group: 'para', no: 2, fig: 'para-side', text: '2組の対辺がそれぞれ等しい',
      answers: [['2組の', '対辺が', 'それぞれ', '等しい']] },
    { id: 'para3', group: 'para', no: 3, fig: 'para-angle', text: '2組の対角がそれぞれ等しい',
      answers: [['2組の', '対角が', 'それぞれ', '等しい']] },
    { id: 'para4', group: 'para', no: 4, fig: 'para-diag', text: '対角線がそれぞれの中点で交わる',
      answers: [['対角線が', 'それぞれの', '中点で', '交わる']] },
    { id: 'para5', group: 'para', no: 5, fig: 'para-one', text: '1組の対辺が平行で、その長さが等しい',
      answers: [['1組の', '対辺が', '平行で', 'その長さが', '等しい']] },
    { id: 'def-iso', group: 'def', no: 1, name: '二等辺三角形', fig: 'def-iso', text: '2辺が等しい三角形',
      after: 'を二等辺三角形という', answers: [['2辺が', '等しい', '三角形']] },
    { id: 'def-equi', group: 'def', no: 2, name: '正三角形', fig: 'def-equi', text: '3辺が等しい三角形',
      after: 'を正三角形という', answers: [['3辺が', '等しい', '三角形']] },
    { id: 'def-rect', group: 'def', no: 3, name: '長方形', fig: 'def-rect', text: '4つの角が等しい四角形',
      after: 'を長方形という', answers: [['4つの', '角が', '等しい', '四角形']] },
    { id: 'def-rhombus', group: 'def', no: 4, name: 'ひし形', fig: 'def-rhombus', text: '4つの辺が等しい四角形',
      after: 'をひし形という', answers: [['4つの', '辺が', '等しい', '四角形']] },
    { id: 'def-square', group: 'def', no: 5, name: '正方形', fig: 'def-square', text: '4つの角が等しく、4つの辺が等しい四角形',
      after: 'を正方形という',
      answers: [['4つの', '角が', '等しく', '4つの', '辺が', '等しい', '四角形'],
        ['4つの', '辺が', '等しく', '4つの', '角が', '等しい', '四角形']] },
  ];

  // モード（記録はモードごとに別々）
  const MODES = [
    { id: 'random', label: '図つき・ランダム', ico: '🖼️', desc: '図の印を見て答える。出題順は毎回かわる' },
    { id: 'text', label: '問題文だけ・順番固定', ico: '📄', desc: '問題1・2は条件を5つずつ（順不同）、問題3は定義を5つ' },
  ];
  // 問題文だけのモードの大問（問題1・2は順不同、問題3は①〜⑤の順）
  const TEXT_PROBLEMS = [
    { no: 1, group: 'tri', unordered: true, text: '三角形の合同条件を5つ答えよ。' },
    { no: 2, group: 'para', unordered: true, text: '平行四辺形になるための条件を5つ答えよ。' },
    { no: 3, group: 'def', unordered: false, text: '次の図形の定義をそれぞれ答えよ。①二等辺三角形，②正三角形，③長方形，④ひし形，⑤正方形' },
  ];

  const MAX_TOKENS = 10;      // 入力できる語句の数の上限（いちばん長い答えより多め）
  const MAX_KEYS = 12;        // 1問で出すキーの数の上限
  const PENALTY_STEP_MS = 10000;   // n 回目の不正解で 10×n 秒をクリアタイムに足す

  function group(id) { return GROUPS.find(function (g) { return g.id === id; }) || null; }
  function question(id) { return QUESTIONS.find(function (q) { return q.id === id; }) || null; }
  function groupQuestions(id) { return QUESTIONS.filter(function (q) { return q.group === id; }); }
  function isMode(id) { return MODES.some(function (m) { return m.id === id; }); }
  function mode(id) { return MODES.find(function (m) { return m.id === id; }) || null; }
  function penaltyFor(n) { return PENALTY_STEP_MS * n; }

  // 図つきモードの問題文（図の下に出す）
  function prompt(q) {
    if (q.group === 'tri') return '図の印から、2つの三角形が合同になる条件を答えよう';
    if (q.group === 'para') return '図の印から、平行四辺形になるための条件を答えよう';
    return q.name + 'の定義を答えよう';
  }

  function isCorrect(q, tokens) {
    return q.answers.some(function (a) {
      return a.length === tokens.length && a.every(function (t, i) { return t === tokens[i]; });
    });
  }

  function shuffle(list, rand) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // 答えに使う語句（ほかの言い方の分もふくむ）
  function tokensOf(q) {
    const out = [];
    q.answers.forEach(function (a) { a.forEach(function (t) { if (out.indexOf(t) < 0) out.push(t); }); });
    return out;
  }

  /*
   * 1問分のキー（最大12個。並びは GROUPS の keys の順）
   *   candidates … 正解になりうる問題（いまは図つき・定義の1問だけを渡す。複数のときは12個に収まる分だけ入れる）
   *   候補をランダムな順に見て、語句を合わせても12個におさまる条件の語句を入れ（最初の1つは必ず入る）、
   *   残りは同じ種類の語句からランダムに選んで12個にする
   */
  function makeKeys(groupId, candidates, rand) {
    const pool = group(groupId).keys;
    const set = [];
    shuffle(candidates, rand).forEach(function (q, i) {
      const add = tokensOf(q).filter(function (t) { return set.indexOf(t) < 0; });
      if (i === 0 || set.length + add.length <= MAX_KEYS) add.forEach(function (t) { set.push(t); });
    });
    shuffle(pool.filter(function (t) { return set.indexOf(t) < 0; }), rand).forEach(function (t) {
      if (set.length < MAX_KEYS) set.push(t);
    });
    return pool.filter(function (t) { return set.indexOf(t) >= 0; });
  }

  // 15問の並び。{ q（決まった問題）| null, group, problem（問題文だけのモードの大問）, k（大問の中の何問目 1〜5） }
  function makeSlots(modeId, rand) {
    if (modeId === 'text') {
      const out = [];
      TEXT_PROBLEMS.forEach(function (p) {
        groupQuestions(p.group).forEach(function (q, i) {
          out.push({ q: p.unordered ? null : q, group: p.group, problem: p, k: i + 1 });
        });
      });
      return out;
    }
    return shuffle(QUESTIONS, rand).map(function (q) { return { q: q, group: q.group, problem: null, k: 0 }; });
  }

  // 語句がどれだけ合っているか（不正解のとき、どの条件を正解として見せるか決めるのに使う）
  function overlap(q, tokens) {
    return Math.max.apply(null, q.answers.map(function (a) {
      return a.filter(function (t) { return tokens.indexOf(t) >= 0; }).length;
    }));
  }

  /*
   * クイズ1回分。時刻（ミリ秒）は呼ぶ側が渡す（画面は performance.now()、テストは好きな数）。
   *   start(t) → 入力（push / pop / clear）→ submit(t) で答え合わせ → next(t) で次の問題 … 15問で finished
   *   opts = { mode: 'random' | 'text', rand }
   */
  function QuizSession(opts) {
    opts = opts || {};
    this.mode = isMode(opts.mode) ? opts.mode : 'random';
    this.rand = opts.rand || Math.random;
    this.slots = makeSlots(this.mode, this.rand);
    this.index = 0;
    this.input = [];
    this.items = [];          // 答えた問題 { id, input, correct, dup, penaltyMs }
    this.used = {};           // 順不同の問題で、答えた（または正解を見せた）条件の ID
    this.phase = 'ready';     // ready → answer ⇄ feedback → finished
    this.elapsedMs = 0;       // 答えている時間の合計（答え合わせの表示中はふくめない）
    this.penaltyMs = 0;       // 不正解のペナルティの合計
    this.misses = 0;
    this.since = 0;
    this.slotKeys = [];
  }
  QuizSession.prototype.total = function () { return this.slots.length; };
  QuizSession.prototype.slot = function () { return this.slots[this.index] || null; };
  // いまの問題（順不同の問題は決まっていないので null）
  QuizSession.prototype.current = function () { const s = this.slot(); return s ? s.q : null; };
  QuizSession.prototype.correctCount = function () {
    return this.items.filter(function (it) { return it.correct; }).length;
  };
  // 順不同の問題で、まだ答えていない条件
  QuizSession.prototype.remaining = function () {
    const s = this.slot(), used = this.used;
    return s ? groupQuestions(s.group).filter(function (q) { return !used[q.id]; }) : [];
  };
  // いまの大問で、すでに答えた（正解を見せた）もの
  QuizSession.prototype.answeredInProblem = function () {
    const s = this.slot();
    if (!s || !s.problem) return [];
    const ids = groupQuestions(s.group).map(function (q) { return q.id; });
    return this.items.filter(function (it) { return ids.indexOf(it.id) >= 0; });
  };
  QuizSession.prototype.enter = function (t) {
    const s = this.slot();
    // 順不同の問題（問題文だけのモードの問題1・2）は、どの条件でも答えられるよう、その種類の語句をすべて出す（12個の上限なし）
    this.slotKeys = s.q ? makeKeys(s.group, [s.q], this.rand) : group(s.group).keys.slice();
    this.phase = 'answer';
    this.since = t;
  };
  QuizSession.prototype.start = function (t) {
    if (this.phase !== 'ready') return;
    this.enter(t);
  };
  // いまの経過時間（ペナルティと、答えている途中の分もふくめる）
  QuizSession.prototype.timeAt = function (t) {
    return this.elapsedMs + this.penaltyMs + (this.phase === 'answer' ? Math.max(0, t - this.since) : 0);
  };
  QuizSession.prototype.keys = function () { return this.slotKeys; };
  QuizSession.prototype.push = function (token) {
    if (this.phase !== 'answer' || this.input.length >= MAX_TOKENS || this.keys().indexOf(token) < 0) return false;
    this.input.push(token);
    return true;
  };
  QuizSession.prototype.pop = function () {
    if (this.phase !== 'answer' || !this.input.length) return false;
    this.input.pop();
    return true;
  };
  QuizSession.prototype.clear = function () {
    if (this.phase !== 'answer') return false;
    this.input = [];
    return true;
  };
  /*
   * 答え合わせ（何も入れていないときは答えない）
   *   順不同の問題 … まだ答えていない条件のどれかと同じなら正解。すでに答えた条件なら不正解（dup）。
   *   不正解のときは、まだ答えていない条件のうち入力にいちばん近いものを正解として見せ、答えたことにする
   */
  QuizSession.prototype.submit = function (t) {
    if (this.phase !== 'answer' || !this.input.length) return null;
    const s = this.slot(), input = this.input;
    let q = s.q, correct, dup = false;
    if (q) {
      correct = isCorrect(q, input);
    } else {
      const rest = this.remaining();
      const hit = rest.find(function (c) { return isCorrect(c, input); });
      correct = !!hit;
      if (hit) q = hit;
      else {
        dup = groupQuestions(s.group).some(function (c) { return isCorrect(c, input); });
        q = rest.reduce(function (best, c) { return overlap(c, input) > overlap(best, input) ? c : best; });
      }
      this.used[q.id] = true;
    }
    let penalty = 0;
    if (!correct) {
      this.misses++;
      penalty = penaltyFor(this.misses);
      this.penaltyMs += penalty;
    }
    const item = { id: q.id, input: input.slice(), correct: correct, dup: dup, penaltyMs: penalty };
    this.items.push(item);
    this.elapsedMs += Math.max(0, t - this.since);
    this.phase = 'feedback';
    return item;
  };
  QuizSession.prototype.isLast = function () { return this.index >= this.slots.length - 1; };
  QuizSession.prototype.next = function (t) {
    if (this.phase !== 'feedback') return;
    this.input = [];
    if (this.isLast()) { this.phase = 'finished'; return; }
    this.index++;
    this.enter(t);
  };
  QuizSession.prototype.finished = function () { return this.phase === 'finished'; };
  QuizSession.prototype.result = function () {
    return {
      mode: this.mode, correct: this.correctCount(), total: this.total(),
      timeMs: Math.round(this.elapsedMs + this.penaltyMs), penaltyMs: this.penaltyMs, misses: this.misses,
      items: this.items.map(function (it) {
        return { id: it.id, input: it.input.slice(), correct: it.correct, penaltyMs: it.penaltyMs };
      }),
    };
  };

  PH.summary = {
    GROUPS: GROUPS,
    QUESTIONS: QUESTIONS,
    MODES: MODES,
    TEXT_PROBLEMS: TEXT_PROBLEMS,
    MAX_TOKENS: MAX_TOKENS,
    MAX_KEYS: MAX_KEYS,
    group: group,
    question: question,
    groupQuestions: groupQuestions,
    isMode: isMode,
    mode: mode,
    penaltyFor: penaltyFor,
    prompt: prompt,
    isCorrect: isCorrect,
    makeKeys: makeKeys,
    QuizSession: QuizSession,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.summary;
})(typeof window !== 'undefined' ? window : globalThis);
