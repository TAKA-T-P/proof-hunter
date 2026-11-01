/*
 * summary.js — 条件・定義のまとめ と 条件・定義クイズ（Ver.1.3）
 *
 * クイズは15問（三角形の合同条件5つ・平行四辺形になるための条件5つ・図形の定義5つ）。
 * 答えはキーパッドの語句（「2組の」「辺が」「それぞれ」「等しい」など）を順に並べて作る。
 * 1問につき解答は1回。答え合わせの表示中は、クリアタイムに入れない。
 * 画面は js/summary-renderer.js。この中身は画面なしで動く（tests/v13.test.js）。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  // 問題の種類と、その種類で使うキーパッド（並びは固定。覚えやすいように、毎回同じ位置に出す）
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
    { id: 'def-iso', group: 'def', name: '二等辺三角形', fig: 'def-iso', text: '2辺が等しい三角形',
      after: 'を二等辺三角形という', answers: [['2辺が', '等しい', '三角形']] },
    { id: 'def-equi', group: 'def', name: '正三角形', fig: 'def-equi', text: '3辺が等しい三角形',
      after: 'を正三角形という', answers: [['3辺が', '等しい', '三角形']] },
    { id: 'def-rect', group: 'def', name: '長方形', fig: 'def-rect', text: '4つの角が等しい四角形',
      after: 'を長方形という', answers: [['4つの', '角が', '等しい', '四角形']] },
    { id: 'def-rhombus', group: 'def', name: 'ひし形', fig: 'def-rhombus', text: '4つの辺が等しい四角形',
      after: 'をひし形という', answers: [['4つの', '辺が', '等しい', '四角形']] },
    { id: 'def-square', group: 'def', name: '正方形', fig: 'def-square', text: '4つの角が等しく、4つの辺が等しい四角形',
      after: 'を正方形という',
      answers: [['4つの', '角が', '等しく', '4つの', '辺が', '等しい', '四角形'],
        ['4つの', '辺が', '等しく', '4つの', '角が', '等しい', '四角形']] },
  ];

  const MAX_TOKENS = 10;      // 入力できる語句の数の上限（いちばん長い答えより多め）

  function group(id) { return GROUPS.find(function (g) { return g.id === id; }) || null; }
  function question(id) { return QUESTIONS.find(function (q) { return q.id === id; }) || null; }

  // 問題文（図の下に出す）
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

  /*
   * クイズ1回分。時刻（ミリ秒）は呼ぶ側が渡す（画面は performance.now()、テストは好きな数）。
   *   start(t) → 入力（push / pop / clear）→ submit(t) で答え合わせ → next(t) で次の問題 … 15問で finished
   */
  function QuizSession(opts) {
    opts = opts || {};
    this.order = opts.order || shuffle(QUESTIONS, opts.rand || Math.random);
    this.index = 0;
    this.input = [];
    this.items = [];          // 答えた問題 { id, input, correct }
    this.phase = 'ready';     // ready → answer ⇄ feedback → finished
    this.elapsedMs = 0;       // 答えている時間の合計（答え合わせの表示中はふくめない）
    this.since = 0;
  }
  QuizSession.prototype.total = function () { return this.order.length; };
  QuizSession.prototype.current = function () { return this.order[this.index] || null; };
  QuizSession.prototype.correctCount = function () {
    return this.items.filter(function (it) { return it.correct; }).length;
  };
  QuizSession.prototype.start = function (t) {
    if (this.phase !== 'ready') return;
    this.phase = 'answer';
    this.since = t;
  };
  // いまの経過時間（答えている途中なら、その分もふくめる）
  QuizSession.prototype.timeAt = function (t) {
    return this.elapsedMs + (this.phase === 'answer' ? Math.max(0, t - this.since) : 0);
  };
  QuizSession.prototype.keys = function () {
    const q = this.current();
    return q ? group(q.group).keys : [];
  };
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
  // 答え合わせ（何も入れていないときは答えない）
  QuizSession.prototype.submit = function (t) {
    if (this.phase !== 'answer' || !this.input.length) return null;
    const q = this.current();
    const item = { id: q.id, input: this.input.slice(), correct: isCorrect(q, this.input) };
    this.items.push(item);
    this.elapsedMs += Math.max(0, t - this.since);
    this.phase = 'feedback';
    return item;
  };
  QuizSession.prototype.isLast = function () { return this.index >= this.order.length - 1; };
  QuizSession.prototype.next = function (t) {
    if (this.phase !== 'feedback') return;
    this.input = [];
    if (this.isLast()) { this.phase = 'finished'; return; }
    this.index++;
    this.phase = 'answer';
    this.since = t;
  };
  QuizSession.prototype.finished = function () { return this.phase === 'finished'; };
  QuizSession.prototype.result = function () {
    return {
      correct: this.correctCount(), total: this.total(), timeMs: Math.round(this.elapsedMs),
      items: this.items.map(function (it) { return { id: it.id, input: it.input.slice(), correct: it.correct }; }),
    };
  };

  PH.summary = {
    GROUPS: GROUPS,
    QUESTIONS: QUESTIONS,
    MAX_TOKENS: MAX_TOKENS,
    group: group,
    question: question,
    prompt: prompt,
    isCorrect: isCorrect,
    QuizSession: QuizSession,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.summary;
})(typeof window !== 'undefined' ? window : globalThis);
