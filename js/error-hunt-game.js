/*
 * error-hunt-game.js — 「証明の間違い探し」（Ver.1.1）の1問の進行（DOM非依存）
 *
 *   const g = new PH.ErrorHuntGame(def)
 *   g.select(stepId)  … 行を選ぶ（同じ行をもう一度で解除）。選んだだけでは判定しない
 *   g.confirm()       … 「ここが間違い！」：{ status: 'correct' | 'wrong' | 'repeat'（すでにまちがえた行。ミスは増えない） | 'none' }
 *   g.canHelp()       … 3回まちがえたら「ヒントを見る」「正解を確認する」を出す
 *   g.useHint()       … ヒント（誤りの種類に応じた1段階。使うと最高★★）
 *   g.reveal()        … 正解を確認する（★1・自力で正解していない扱い）
 *   g.stars()         … 1回目で正解 ★★★、2回目 ★★、3回目以降・正解を確認 ★。ヒントを使ったら最高★★
 *   g.result()        … 記録用 { stars, misses, solvedByUser }
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const HELP_AFTER = 3;          // この回数まちがえたら、ヒント・正解の確認を出す

  function ErrorHuntGame(def) {
    this.def = def;
    this.built = PH.errorHunt.build(def);
    this.reset();
  }

  ErrorHuntGame.prototype.reset = function () {
    this.selected = null;
    this.wrongIds = [];          // まちがえた行（同じ行をくり返してもミスは増えない）
    this.misses = 0;
    this.hintUsed = false;
    this.solved = false;
    this.revealed = false;
  };

  ErrorHuntGame.prototype.finished = function () { return this.solved || this.revealed; };

  ErrorHuntGame.prototype.hasStep = function (id) {
    return this.built.steps.some(function (s) { return s.id === id; });
  };

  ErrorHuntGame.prototype.select = function (id) {
    if (this.finished() || !this.hasStep(id)) return false;
    this.selected = this.selected === id ? null : id;
    return true;
  };

  ErrorHuntGame.prototype.confirm = function () {
    if (this.finished() || !this.selected) return { status: 'none' };
    const id = this.selected;
    if (id === this.built.target) {
      this.solved = true;
      return { status: 'correct' };
    }
    this.selected = null;        // まちがえたら選択を外す（選び直す）
    if (this.wrongIds.indexOf(id) >= 0) return { status: 'repeat', stepId: id };
    this.wrongIds.push(id);
    this.misses++;
    return { status: 'wrong', stepId: id };
  };

  ErrorHuntGame.prototype.canHelp = function () { return !this.finished() && this.misses >= HELP_AFTER; };

  ErrorHuntGame.prototype.hintText = function () {
    return this.def.hint || PH.errorHunt.CATEGORIES[this.def.category].hint;
  };

  ErrorHuntGame.prototype.useHint = function () {
    if (this.finished()) return null;
    this.hintUsed = true;
    return this.hintText();
  };

  ErrorHuntGame.prototype.reveal = function () {
    if (this.finished()) return false;
    this.revealed = true;
    this.selected = this.built.target;
    return true;
  };

  ErrorHuntGame.prototype.stars = function () {
    if (this.revealed) return 1;
    const s = this.misses === 0 ? 3 : this.misses === 1 ? 2 : 1;
    return this.hintUsed ? Math.min(s, 2) : s;
  };

  ErrorHuntGame.prototype.result = function () {
    return { stars: this.stars(), misses: this.misses, solvedByUser: this.solved && !this.revealed };
  };

  PH.ErrorHuntGame = ErrorHuntGame;
  PH.ERROR_HUNT_HELP_AFTER = HELP_AFTER;

  // 間違い探しの問題（番号順）と、単元・ID で探す
  PH.errorProblems = function (unit) {
    return PH.ERROR_HUNT_PROBLEMS.filter(function (d) { return !unit || d.unit === unit; });
  };
  PH.getErrorProblem = function (id) {
    return PH.ERROR_HUNT_PROBLEMS.find(function (d) { return d.id === id; }) || null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = ErrorHuntGame;
})(typeof window !== 'undefined' ? window : globalThis);
