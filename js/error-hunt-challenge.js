/*
 * error-hunt-challenge.js — 「証明の間違い探し」ランダム5問チャレンジ（Ver.1.2。DOM非依存）
 *
 * コース（段位認定と同じID・表示名。js/rank-tracks.js）
 *   basic         … 基本の合同証明：3つの合同条件と、仮定・共通・対頂角・平行線・三角形の対応・合同な図形の性質
 *   comprehensive … 総合証明：二等辺三角形・正三角形・直角三角形・平行四辺形・ひし形・長方形もふくむ全範囲
 *   出題できるかどうかは、バリエーションごとの必要な知識（PH.errorVariants.courses）で決める。
 *
 * 抽選（シード付き乱数。同じコース・シード・問題プール・履歴なら同じ5問）
 *   1. コースで出題できるバリエーションが1つ以上あるベース問題を集める
 *   2. 重複しない5問のベース問題を選ぶ（総合証明は4つの単元から、できれば1問ずつ。前回のチャレンジのベース問題は少し出にくく）
 *   3. ベース問題ごとにバリエーションを1つ選ぶ
 *      … 前回と同じバリエーションは、ほかに候補があれば出さない。前々回・前回と同じ行の間違い、同じ誤りの種類の重なりは出にくくする
 *   候補が5問に足りなければ、ある分だけ出題する（無限ループしない）。
 *
 *   PH.errorChallenge.draw(course, { seed, history }) … { course, seed, items: [{ baseId, variantId }] }
 *   PH.errorChallenge.start(course, history, seed?)   … new ChallengeSession（seed を省略すると新しいシード）
 *   session.current() / answer(stepId) / next() / finished() / abort() / score() / result()
 * ルール：1問につき解答は1回（「ここが間違い！」で確定）。正解20点・不正解0点、5問で100点満点。ヒントなし・制限時間なし。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  const SIZE = 5;            // 出題数
  const POINTS = 20;         // 1問の得点
  const RECENT_KEEP = 3;     // ベース問題ごとに覚えておく、直近のバリエーションの数
  const UNIT_ORDER = ['basic', 'conclusion', 'triangle', 'quadrilateral'];

  // コースの表示（ID・表示名は段位認定と共通。説明は間違い探しのもの）
  const COURSES = {
    basic: { id: 'basic', desc: '通常の3つの合同条件を中心に、証明の間違いを見抜こう！' },
    comprehensive: { id: 'comprehensive', desc: '二等辺三角形・直角三角形・平行四辺形なども出題！' },
  };
  const ORDER = ['basic', 'comprehensive'];
  function course(id) {
    const c = COURSES[id];
    if (!c) return null;
    const t = PH.rankTracks.get(id);
    return { id: id, label: t.label, short: t.short, desc: c.desc };
  }

  // ---- シード付き乱数（mulberry32） -------------------------------------------------

  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function newSeed() { return (Math.floor(Math.random() * 0x7fffffff) ^ (Date.now() & 0x7fffffff)) >>> 0; }

  // 重みつきで1つ選ぶ（重みがすべて0なら先頭）
  function pick(list, weight, r) {
    const ws = list.map(weight);
    const total = ws.reduce(function (s, w) { return s + w; }, 0);
    if (!(total > 0)) return list[0];
    let x = r() * total;
    for (let i = 0; i < list.length; i++) {
      x -= ws[i];
      if (x < 0) return list[i];
    }
    return list[list.length - 1];
  }

  // ---- 出題候補 ------------------------------------------------------------------

  const poolCache = {};
  // コースの出題候補：[{ base（ベース問題）, variants: [出題できるバリエーションの問題データ] }]（ベース問題の番号順）
  function pool(id) {
    if (!COURSES[id]) return [];
    if (!poolCache[id]) {
      poolCache[id] = PH.ERROR_HUNT_PROBLEMS.map(function (b) {
        return { base: b, variants: PH.errorVariants.list(b.id).filter(function (d) { return PH.errorVariants.courses(d).indexOf(id) >= 0; }) };
      }).filter(function (e) { return e.variants.length > 0; });
    }
    return poolCache[id];
  }

  function cleanHistory(h) {
    const out = { recentVariants: {}, lastBases: [] };
    if (!h || typeof h !== 'object') return out;
    if (h.recentVariants && typeof h.recentVariants === 'object') out.recentVariants = h.recentVariants;
    if (Array.isArray(h.lastBases)) out.lastBases = h.lastBases;
    return out;
  }

  /*
   * 5問を抽選する。同じ course・seed・問題プール・history なら同じ結果。
   *   history = { recentVariants: { ベース問題ID: [新しい順のバリエーションID] }, lastBases: [前回のベース問題ID] }
   */
  function draw(courseId, opts) {
    const o = opts || {};
    const seed = (typeof o.seed === 'number' && isFinite(o.seed) ? o.seed : newSeed()) >>> 0;
    const hist = cleanHistory(o.history);
    const r = rng(seed);
    const rest = pool(courseId).slice();
    const chosen = [];
    const baseWeight = function (e) { return hist.lastBases.indexOf(e.base.id) >= 0 ? 0.4 : 1; };
    const take = function (cands) {
      if (!cands.length) return;
      const e = pick(cands, baseWeight, r);
      chosen.push(e);
      rest.splice(rest.indexOf(e), 1);
    };
    // 総合証明：4つの単元から、できれば1問ずつ（単元の順はシードで変える）
    if (courseId === 'comprehensive') {
      const units = UNIT_ORDER.slice();
      for (let i = units.length - 1; i > 0; i--) {
        const j = Math.floor(r() * (i + 1));
        const t = units[i]; units[i] = units[j]; units[j] = t;
      }
      units.forEach(function (u) {
        if (chosen.length < SIZE) take(rest.filter(function (e) { return e.base.unit === u; }));
      });
    }
    while (chosen.length < SIZE && rest.length) take(rest);
    // 出題順をシャッフル
    for (let i = chosen.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      const t = chosen[i]; chosen[i] = chosen[j]; chosen[j] = t;
    }
    // バリエーション：前回と同じものは、ほかに候補があれば出さない。同じ行・同じ誤りの種類が続かないように重みを下げる
    const catCount = {};
    const items = chosen.map(function (e) {
      const recent = Array.isArray(hist.recentVariants[e.base.id]) ? hist.recentVariants[e.base.id] : [];
      let cands = e.variants;
      if (recent.length && cands.length > 1) {
        const fresh = cands.filter(function (d) { return d.variantId !== recent[0]; });
        if (fresh.length) cands = fresh;
      }
      const lastTarget = (e.variants.find(function (d) { return d.variantId === recent[0]; }) || {}).mutation;
      const v = pick(cands, function (d) {
        let w = 1;
        const at = recent.indexOf(d.variantId);
        if (at >= 0) w *= at === 1 ? 0.25 : 0.5;
        if (lastTarget && d.mutation.target === lastTarget.target) w *= 0.3;
        w *= Math.pow(0.35, catCount[d.category] || 0);
        return w;
      }, r);
      catCount[v.category] = (catCount[v.category] || 0) + 1;
      return { baseId: e.base.id, variantId: v.variantId };
    });
    return { course: courseId, seed: seed, items: items };
  }

  // ---- 1回のチャレンジ ---------------------------------------------------------------

  let playCounter = 0;

  function ChallengeSession(drawn) {
    this.course = drawn.course;
    this.seed = drawn.seed;
    // 1回のプレイのID（同じ結果を二重に記録しないため。storage.recordErrorChallenge が確かめる）
    this.playId = drawn.course + '-' + drawn.seed + '-' + Date.now().toString(36) + '-' + (++playCounter);
    this.items = drawn.items.map(function (it, i) {
      const def = PH.errorVariants.def(it.baseId, it.variantId);
      const built = PH.errorHunt.build(def);
      return { no: i + 1, baseId: it.baseId, variantId: it.variantId, def: def, target: built.target, selected: null, answered: false, correct: null };
    });
    this.index = 0;
    this.state = this.items.length ? 'play' : 'done';     // 'play' / 'done'（5問終了） / 'aborted'（途中終了）
  }

  ChallengeSession.prototype.total = function () { return this.items.length; };
  ChallengeSession.prototype.current = function () { return this.state === 'play' ? this.items[this.index] : null; };
  ChallengeSession.prototype.finished = function () { return this.state === 'done'; };
  ChallengeSession.prototype.correctCount = function () { return this.items.filter(function (q) { return q.correct === true; }).length; };
  ChallengeSession.prototype.score = function () { return this.correctCount() * POINTS; };
  ChallengeSession.prototype.maxScore = function () { return this.items.length * POINTS; };

  // 「ここが間違い！」：1問につき1回だけ判定する（二重に確定しない）
  ChallengeSession.prototype.answer = function (stepId) {
    const q = this.current();
    if (!q || q.answered) return { status: 'locked' };
    if (!stepId || !PH.errorHunt.build(q.def).steps.some(function (s) { return s.id === stepId; })) return { status: 'none' };
    q.selected = stepId;
    q.answered = true;
    q.correct = stepId === q.target;
    return { status: q.correct ? 'correct' : 'wrong', points: q.correct ? POINTS : 0, score: this.score() };
  };

  // 次の問題へ（答えていない問題は飛ばせない）。最後の問題のあとは終了。戻り値：次の問題があれば true
  ChallengeSession.prototype.next = function () {
    const q = this.current();
    if (!q || !q.answered) return false;
    if (this.index < this.items.length - 1) { this.index++; return true; }
    this.state = 'done';
    return false;
  };

  ChallengeSession.prototype.abort = function () { if (this.state === 'play') this.state = 'aborted'; };

  // 記録・振り返り用（出題したバリエーションと、選んだ行をそのまま残す。再抽選しない）
  ChallengeSession.prototype.result = function () {
    const correct = this.correctCount();
    return {
      course: this.course, seed: this.seed, playId: this.playId, score: this.score(), correct: correct, wrong: this.items.length - correct, total: this.items.length,
      items: this.items.map(function (q) {
        return { no: q.no, baseId: q.baseId, variantId: q.variantId, category: q.def.category, target: q.target, selected: q.selected, correct: q.correct === true };
      }),
    };
  };

  function start(courseId, history, seed) {
    if (!COURSES[courseId]) return null;
    return new ChallengeSession(draw(courseId, { seed: seed, history: history }));
  }

  // 結果発表のメッセージ
  function message(score) {
    if (score >= 100) return 'PERFECT！ 証明の達人！';
    if (score >= 80) return 'EXCELLENT！ 見直し上手！';
    if (score >= 60) return 'GOOD！ あと一歩！';
    return '間違いを見抜く力を磨こう！';
  }

  // ---- 連続PERFECT の称号（Ver.1.2。段位認定の段位とは完全に別） ----------------------------
  //   100点（5問すべて正解）で連続回数+1、80点以下で0。途中終了は変えない（記録は js/storage.js）。
  //   称号は最高連続記録（bestPerfectStreak）から決まり、連続が途切れても失わない。10回で最高称号（11回以上も回数は数える）
  const TITLES = [
    { level: 1, need: 1, name: '見習い鑑定士' },
    { level: 2, need: 2, name: '証明チェッカー' },
    { level: 3, need: 3, name: 'ミス発見名人' },
    { level: 4, need: 4, name: '論理の観察者' },
    { level: 5, need: 5, name: '証明鑑定士' },
    { level: 6, need: 6, name: '推理の達人' },
    { level: 7, need: 7, name: '論理の番人' },
    { level: 8, need: 8, name: '証明の眼力王' },
    { level: 9, need: 9, name: '真理の探究者' },
    { level: 10, need: 10, name: '証明の神眼' },
  ];
  const MAX_TITLE = TITLES.length;

  // 連続回数 → 称号の段階（0 は称号なし）
  function titleLevel(streak) { return Math.max(0, Math.min(MAX_TITLE, Math.floor(streak) || 0)); }
  function title(level) { return TITLES[level - 1] || null; }
  // 次の称号（まだ獲得していない一番下の称号。すべて獲得ずみなら null）と、いまの連続回数からあと何回の連続PERFECT が必要か。
  // highestLevel（獲得ずみの最高称号）を渡すと、連続が途切れたあとも獲得ずみの称号を「次」にしない
  function nextTitle(streak, highestLevel) {
    const t = TITLES[Math.max(titleLevel(streak), titleLevel(highestLevel || 0))];
    return t ? { title: t, remaining: t.need - (Math.floor(streak) || 0) } : null;
  }

  PH.errorChallenge = {
    TITLES: TITLES,
    MAX_TITLE: MAX_TITLE,
    titleLevel: titleLevel,
    title: title,
    nextTitle: nextTitle,
    SIZE: SIZE,
    POINTS: POINTS,
    RECENT_KEEP: RECENT_KEEP,
    ORDER: ORDER,
    course: course,
    isCourse: function (id) { return !!COURSES[id]; },
    pool: pool,
    rng: rng,
    newSeed: newSeed,
    draw: draw,
    start: start,
    message: message,
    ChallengeSession: ChallengeSession,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.errorChallenge;
})(typeof window !== 'undefined' ? window : globalThis);
