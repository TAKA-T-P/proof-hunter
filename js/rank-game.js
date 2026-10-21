/*
 * rank-game.js — 段位認定の進行（出題・判定・集計・コンボ・時間切れ・結果）。DOMに依存しない
 *
 * 時刻はすべて呼び出し側から渡す（画面では performance.now()）。残り時間は「開始時刻との差」から計算するので、
 * 描画の遅れ・別タブ・端末のロックで制限時間が延びることはない（setInterval の回数は数えない）。
 *
 *   const g = new PH.RankGame({ seed });
 *   g.start(now)                      … 1問目を出題し、計測を始める
 *   g.timeLeft(now)                   … 残りミリ秒（0未満にならない）
 *   g.choose(blank, choiceId, now)    … 選択式：解答箇所が1つなら、その場で判定
 *   g.submit(now, inputValue?)        … 解答を確定して判定（記号入力は文字列を渡す）
 *   g.pass(now)                       … パス（ミス1回）
 *   g.tick(now)                       … 時間切れなら終了（終了処理は1回だけ）
 *   g.abort()                         … 途中終了（記録しない）
 *   g.result                          … 終了後の結果
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function C() { return PH.rank.config; }
  function Q() { return PH.rankQuestions; }

  // 再現できる乱数（シード固定でテストできる）
  function mulberry32(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function shuffle(list, rnd) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pickWeighted(weights, rnd) {
    const keys = Object.keys(weights);
    const total = keys.reduce(function (s, k) { return s + weights[k]; }, 0);
    let r = rnd() * total;
    for (let i = 0; i < keys.length; i++) {
      r -= weights[keys[i]];
      if (r < 0) return Number(keys[i]);
    }
    return Number(keys[keys.length - 1]);
  }

  /*
   * 出題の抽選（n 問目）。問題の種類（カテゴリ）が偏らないよう、出題数の少ないカテゴリから選ぶ。
   *   1〜10問目：すべて選択式。序盤は易しい問題から（difficultyCaps）。
   *   11問目〜：記号入力を inputRatio の割合で出す（記号入力は解答箇所1つ）。
   *   解答箇所の数（選択式）：blankWeights の割合。
   * 同じ問題は、未出題の候補があるうちは出さない。同じ元問題が続かないようにする。
   * 候補が足りなくなったら、直近の問題を避けて再利用する（無限ループにはならない）。
   */
  function Picker(rnd, pool) {
    this.rnd = rnd;
    this.pool = pool || Q().all();
    this.used = {};
    this.recent = [];
    this.catCount = {};
    this.lastSource = null;
  }

  Picker.prototype.capFor = function (n) {
    const caps = C().difficultyCaps;
    for (let i = 0; i < caps.length; i++) if (n <= caps[i].upTo) return caps[i].max;
    return 3;
  };

  Picker.prototype.pick = function (n) {
    const cfg = C();
    const rnd = this.rnd;
    const zone = n <= cfg.selectZoneCount ? 'select' : 'challenge';
    let mode = zone === 'select' ? 'choice' : (rnd() < cfg.inputRatio ? 'input' : 'choice');
    // 解答箇所の数も序盤は少なく（難易度の上限まで：1〜3問目は1か所、4〜10問目は2か所まで）
    let blanks = mode === 'input' ? 1 : Math.min(pickWeighted(cfg.blankWeights, rnd), this.capFor(n));
    const self = this;
    let fits = function (q) { return Q().supports(q, mode) && (mode === 'input' ? q.blanks === 1 : q.blanks === blanks); };
    // その形の候補がなければ、解答箇所1つ → 解答箇所の数を問わない → 選択式 → どれでも、の順にゆるめる（止まらない）
    if (!this.pool.some(fits)) blanks = 1;
    if (!this.pool.some(fits)) fits = function (q) { return Q().supports(q, mode); };
    if (!this.pool.some(fits)) { mode = 'choice'; fits = function (q) { return Q().supports(q, 'choice'); }; }
    if (!this.pool.some(fits)) { mode = 'input'; fits = function (q) { return Q().supports(q, 'input'); }; }
    const cands = this.pool.filter(fits);
    const cap = this.capFor(n);
    // カテゴリ：今の難易度で出せる未出題の問題があるカテゴリ → 未出題の問題があるカテゴリ → すべて、の順に絞り、
    // その中で出題数が最も少ないものを選ぶ（同数なら乱数）
    const has = function (c, test) { return cands.some(function (q) { return q.category === c && test(q); }); };
    const allCats = Q().CATEGORIES.filter(function (c) { return has(c, function () { return true; }); });
    let cats = allCats.filter(function (c) { return has(c, function (q) { return !self.used[q.id] && q.difficulty <= cap; }); });
    if (!cats.length) cats = allCats.filter(function (c) { return has(c, function (q) { return !self.used[q.id]; }); });
    if (!cats.length) cats = allCats;
    const minCount = Math.min.apply(null, cats.map(function (c) { return self.catCount[c] || 0; }));
    const lows = cats.filter(function (c) { return (self.catCount[c] || 0) === minCount; });
    const cat = lows[Math.floor(rnd() * lows.length)];
    const inCat = cands.filter(function (q) { return q.category === cat; });
    const recent = this.recent.slice(-cfg.recentAvoid);
    const last = this.recent[this.recent.length - 1];
    const steps = [
      function (q) { return q.difficulty <= cap && !self.used[q.id] && q.sourceId !== self.lastSource; },
      function (q) { return !self.used[q.id] && q.sourceId !== self.lastSource; },
      function (q) { return !self.used[q.id]; },
      function (q) { return recent.indexOf(q.id) < 0 && q.sourceId !== self.lastSource; },
      function (q) { return recent.indexOf(q.id) < 0; },
      function (q) { return q.id !== last; },
      function () { return true; },
    ];
    let list = [];
    for (let i = 0; i < steps.length && !list.length; i++) list = inCat.filter(steps[i]);
    // そのカテゴリに直前と同じ問題しか残っていなければ、ほかのカテゴリから選ぶ（同じ問題を続けない）
    if (!list.length || list.every(function (q) { return q.id === last; })) {
      const others = cands.filter(function (q) { return q.id !== last; });
      // それでもなければ、出題の形（選択式／記号入力）を変えてでも別の問題を出す
      const any = this.pool.filter(function (q) { return q.id !== last; });
      list = others.length ? others : any.length ? any : cands;
    }
    const q = list[Math.floor(rnd() * list.length)];
    if (!Q().supports(q, mode)) mode = q.choice ? 'choice' : 'input';
    this.used[q.id] = true;
    this.recent.push(q.id);
    this.catCount[q.category] = (this.catCount[q.category] || 0) + 1;
    this.lastSource = q.sourceId;
    return instance(q, mode, n, zone, rnd);
  };

  // 出題するときの形（選択肢の順番は毎回変える）
  function instance(q, mode, n, zone, rnd) {
    const inst = { no: n, zone: zone, mode: mode, q: q };
    if (mode === 'choice') {
      inst.blanks = q.choice.blanks.map(function (b) {
        return { label: b.label, answer: b.answer, choices: shuffle(b.choices, rnd) };
      });
    } else {
      inst.blanks = [{ label: '入力', input: true }];
    }
    return inst;
  }

  // 解答の判定（解答箇所がいくつあっても、すべて正しいときだけ正解）
  function judge(inst, selections, inputValue) {
    if (inst.mode === 'input') return !!inputValue && inst.q.input.check(inputValue);
    return inst.blanks.every(function (b, i) { return selections[i] === b.answer; });
  }

  // 選択肢の文字を振り返り用に書く（「AC＝」のように左辺が決まっている問題は等式の形に）
  function choiceText(inst, b, text) {
    if (/＝$/.test(b.label)) return b.label + text;
    return (inst.blanks.length > 1 ? b.label + '：' : '') + text;
  }

  function answerText(inst, selections, inputValue) {
    if (inst.mode === 'input') return inputValue ? PH.mathKeypad.pretty(inputValue) : '';
    return inst.blanks.map(function (b, i) {
      const c = b.choices.find(function (x) { return x.id === selections[i]; });
      return c ? choiceText(inst, b, c.text) : '（未選択）';
    }).join('／');
  }

  function correctText(inst) {
    if (inst.mode === 'input') return inst.q.input.answerText;
    return inst.blanks.map(function (b) {
      return choiceText(inst, b, b.choices.find(function (x) { return x.id === b.answer; }).text);
    }).join('／');
  }

  // ---- ゲーム本体 ----------------------------------------------------------------

  function RankGame(opts) {
    const o = opts || {};
    this.seed = o.seed != null ? (o.seed >>> 0) : (Math.floor(Math.random() * 4294967296) >>> 0);
    this.rnd = mulberry32(this.seed);
    this.picker = new Picker(this.rnd, o.pool);
    this.onFinish = o.onFinish || null;
    this.state = 'ready';     // ready → play → over（途中終了は aborted）
    this.startAt = null;
    this.correct = 0;
    this.misses = 0;
    this.passes = 0;
    this.combo = 0;
    this.maxCombo = 0;
    this.answered = 0;
    this.wrongs = [];         // 振り返り用（誤答・パス）
    this.current = null;
    this.selections = [];
    this.result = null;
  }

  // 制限時間（誤答のたびに短くなる：n 回目の誤答で 4×n 秒）
  RankGame.prototype.penaltyMs = function () { return PH.rank.totalPenalty(this.misses); };
  RankGame.prototype.limit = function () { return Math.max(0, C().timeLimitMs - this.penaltyMs()); };

  RankGame.prototype.start = function (now) {
    if (this.state !== 'ready') return false;
    this.state = 'play';
    this.startAt = now;
    this.next();
    return true;
  };

  RankGame.prototype.elapsed = function (now) {
    return this.startAt == null ? 0 : Math.max(0, now - this.startAt);
  };

  RankGame.prototype.timeLeft = function (now) {
    if (this.startAt == null) return this.limit();
    return Math.max(0, this.limit() - this.elapsed(now));
  };

  // 解答を受け付けるか（確定した時刻が制限時間内か）
  RankGame.prototype.accepting = function (now) {
    return this.state === 'play' && this.elapsed(now) <= this.limit();
  };

  RankGame.prototype.next = function () {
    this.current = this.picker.pick(this.answered + 1);
    this.selections = [];
  };

  RankGame.prototype.isSingleChoice = function () {
    return this.current && this.current.mode === 'choice' && this.current.blanks.length === 1;
  };

  // 選択式：選択肢を選ぶ。解答箇所が1つならその場で判定する（複数なら「決定」で判定）
  RankGame.prototype.choose = function (blank, choiceId, now) {
    if (!this.accepting(now)) { this.tick(now); return { status: 'closed' }; }
    const inst = this.current;
    if (inst.mode !== 'choice' || !inst.blanks[blank]) return { status: 'ignored' };
    if (!inst.blanks[blank].choices.some(function (c) { return c.id === choiceId; })) return { status: 'ignored' };
    this.selections[blank] = choiceId;
    if (inst.blanks.length === 1) return this.submit(now);
    return { status: 'selected' };
  };

  RankGame.prototype.complete = function (inputValue) {
    const inst = this.current;
    if (!inst) return false;
    if (inst.mode === 'input') return !!inputValue;
    return inst.blanks.every(function (_, i) { return this.selections[i] != null; }, this);
  };

  // 解答の確定。解答途中（未選択・未入力）は判定しない
  RankGame.prototype.submit = function (now, inputValue) {
    if (!this.accepting(now)) { this.tick(now); return { status: 'closed' }; }
    if (!this.complete(inputValue)) return { status: 'incomplete' };
    const inst = this.current;
    const ok = judge(inst, this.selections, inputValue);
    return this.record(inst, ok, answerText(inst, this.selections, inputValue), false, now);
  };

  // パス：ミス1回として次の問題へ
  RankGame.prototype.pass = function (now) {
    if (!this.accepting(now)) { this.tick(now); return { status: 'closed' }; }
    return this.record(this.current, false, 'パス', true, now);
  };

  RankGame.prototype.record = function (inst, ok, given, passed, now) {
    this.answered++;
    let comboText = null;
    if (ok) {
      this.correct++;
      this.combo++;
      this.maxCombo = Math.max(this.maxCombo, this.combo);
      comboText = PH.rank.comboText(this.combo);
    } else {
      this.misses++;
      if (passed) this.passes++;
      this.combo = 0;
      this.wrongs.push({
        no: inst.no, qid: inst.q.id, sourceId: inst.q.sourceId, typeLabel: inst.q.typeLabel,
        question: inst.q.lines.concat([inst.q.ask]).join(' '),
        yourAnswer: given, correctAnswer: correctText(inst), explain: inst.q.explain, passed: passed,
      });
    }
    const prevZone = inst.zone;
    this.next();
    const out = {
      status: ok ? 'correct' : passed ? 'pass' : 'wrong',
      combo: this.combo, comboText: comboText,
      zoneEnter: prevZone === 'select' && this.current.zone === 'challenge',
      penaltyMs: ok ? 0 : PH.rank.penaltyFor(this.misses),    // この誤答で減った時間
    };
    // 時間ペナルティで制限時間を過ぎたら、その場で終了
    if (!ok && now != null) this.tick(now);
    return out;
  };

  // 時間切れの確認。終了処理は1回だけ
  RankGame.prototype.tick = function (now) {
    if (this.state === 'play' && this.elapsed(now) >= this.limit()) this.finish();
    return this.state;
  };

  RankGame.prototype.finish = function () {
    if (this.state !== 'play') return this.result;
    this.state = 'over';
    const score = PH.rank.effectiveScore(this.correct, this.misses);
    const grade = PH.rank.gradeFor(score);
    this.result = {
      correct: this.correct, misses: this.misses, passes: this.passes, answered: this.answered,
      effectiveScore: score, rank: grade.rank, rankName: grade.name, maxCombo: this.maxCombo,
      penaltyMs: this.penaltyMs(),
      criteriaVersion: C().criteriaVersion, seed: this.seed,
      wrongs: this.wrongs.slice(0, C().reviewLimit),
    };
    if (this.onFinish) this.onFinish(this.result);
    return this.result;
  };

  // 途中終了（記録に反映しない）
  RankGame.prototype.abort = function () {
    if (this.state === 'play' || this.state === 'ready') this.state = 'aborted';
  };

  PH.RankGame = RankGame;
  PH.rankUtil = { mulberry32: mulberry32, Picker: Picker, judge: judge };

  if (typeof module !== 'undefined' && module.exports) module.exports = RankGame;
})(typeof window !== 'undefined' ? window : globalThis);
