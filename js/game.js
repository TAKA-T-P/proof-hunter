/*
 * game.js — 問題進行・根拠収集（DOMに依存しない状態管理）
 *
 * phase : 'collect'（根拠収集） → 'congruence'（合同条件選択） → 'clear'（証明完成）
 * mode  : 'answer'（解答） / 'common'（共通な辺） / 'mark'（印つけ） / 'erase'（印を消す）
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  // クリア評価（★1〜3）
  function calcStars(misses, hintsUsed) {
    if (misses === 0 && hintsUsed === 0) return 3;
    if (misses <= 2 && hintsUsed <= 1) return 2;
    return 1;
  }

  function Game(problem) {
    this.problem = problem;
    this.elements = PH.geometry.getElements(problem.figure);
    this.reset();
  }

  Game.prototype.reset = function () {
    this.phase = 'collect';
    this.mode = 'answer';
    this.selection = [];         // 選択中の要素キー（共通な辺は同じキーが2つ）
    this.reason = null;          // 選択中の理由ID
    this.found = [];             // 見つけた根拠ID（見つけた順）
    this.misses = 0;
    this.hintsUsed = 0;
    this.hintLevels = {};        // 根拠ID → 表示済みヒント段階
    this.userMarks = {};         // 要素キー → 印の本数（生徒がつけた印）
    this.markTool = { seg: 1, ang: 1 };
    this.condition = null;       // 選択中の合同条件
    this.stars = 0;
  };

  Game.prototype.total = function () { return this.problem.evidence.length; };

  Game.prototype.element = function (key) { return this.elements.byKey[key] || null; };

  Game.prototype.selectionKind = function () {
    const el = this.selection.length ? this.element(this.selection[0]) : null;
    return el ? el.kind : null;
  };

  Game.prototype.setMode = function (mode) {
    if (mode === 'common' && this.phase !== 'collect') return false;
    // 同じボタンをもう一度押すと解答モードへ戻る
    if (mode === this.mode && mode !== 'answer') mode = 'answer';
    // 「共通な辺」に入る・出るときは選択をやり直す
    if ((this.mode === 'common') !== (mode === 'common')) this.clearSelection();
    this.mode = mode;
    return true;
  };

  Game.prototype.clearSelection = function () {
    this.selection = [];
    this.reason = null;
  };

  // 図形の要素をタップしたとき
  Game.prototype.tap = function (key) {
    const el = this.element(key);
    if (!el) return { type: 'ignored' };

    if (this.mode === 'mark') {
      const n = el.kind === 'seg' ? this.markTool.seg : this.markTool.ang;
      if (this.userMarks[key] === n) {
        delete this.userMarks[key];
        return { type: 'unmark' };
      }
      this.userMarks[key] = n;
      return { type: 'mark' };
    }

    if (this.mode === 'erase') {
      if (this.userMarks[key] != null) {
        delete this.userMarks[key];
        return { type: 'erase' };
      }
      return { type: 'ignored', message: 'ここには自分でつけた印がないよ。' };
    }

    if (this.phase !== 'collect') return { type: 'ignored' };

    if (this.mode === 'common') {
      if (el.kind !== 'seg') return { type: 'ignored', message: '「共通な辺」では、辺をタップしよう。' };
      if (this.selection[0] === key) {
        this.clearSelection();
        return { type: 'deselect' };
      }
      this.selection = [key, key];
      this.reason = 'common';
      return { type: 'select' };
    }

    // 解答モード
    const idx = this.selection.indexOf(key);
    if (idx >= 0) {
      this.selection.splice(idx, 1);
      this.reason = null;
      return { type: 'deselect' };
    }
    const switched = this.selection.length === 1 && this.selectionKind() !== el.kind;
    if (this.selection.length !== 1 || switched) {
      this.selection = [key];
    } else {
      this.selection.push(key);
    }
    this.reason = null;
    return { type: 'select', switched: switched };
  };

  Game.prototype.availableReasons = function () {
    const list = this.problem.reasons.slice();
    if (this.mode === 'common' && list.indexOf('common') < 0) list.splice(1, 0, 'common');
    return list;
  };

  Game.prototype.selectReason = function (id) {
    if (this.phase !== 'collect' || this.selection.length !== 2) return false;
    if (this.availableReasons().indexOf(id) < 0) return false;
    this.reason = id;
    return true;
  };

  Game.prototype.canConfirm = function () {
    return this.phase === 'collect' && this.selection.length === 2 && !!this.reason;
  };

  // 等式の候補（表示用）
  Game.prototype.candidate = function () {
    const self = this;
    return this.selection.map(function (k) { return self.element(k).display; });
  };

  // 「根拠を確定」
  Game.prototype.confirmEvidence = function () {
    if (!this.canConfirm()) return { status: 'incomplete', miss: false };
    const r = PH.validation.checkEvidence(this.problem, this.selection, this.reason, this.found);
    if (r.miss) this.misses++;
    switch (r.status) {
      case 'correct':
        this.found.push(r.evidence.id);
        this.clearSelection();
        if (this.mode === 'common') this.mode = 'answer';
        if (this.found.length === this.total()) {
          this.phase = 'congruence';
          r.complete = true;
        }
        break;
      case 'wrong-reason':
        this.reason = null;      // 等式の選択は残して理由だけ選び直す
        break;
      default:
        this.clearSelection();
    }
    return r;
  };

  Game.prototype.selectCondition = function (id) {
    if (this.phase !== 'congruence' || !PH.CONDITIONS[id]) return false;
    this.condition = id;
    return true;
  };

  // 合同条件を決定
  Game.prototype.confirmCondition = function () {
    if (this.phase !== 'congruence' || !this.condition) return { ok: false, status: 'incomplete' };
    const r = PH.validation.checkCongruence(this.problem, this.found, this.condition);
    if (r.ok) {
      this.phase = 'clear';
      this.mode = 'answer';
      this.stars = calcStars(this.misses, this.hintsUsed);
    } else {
      this.misses++;
      this.condition = null;
    }
    return r;
  };

  Game.prototype.useHint = function () {
    const h = PH.hints.next(this.problem, this);
    if (!h) return null;
    if (h.isNew) {
      this.hintLevels[h.targetId] = h.level;
      this.hintsUsed++;
    }
    return h;
  };

  Game.prototype.clearUserMarks = function () { this.userMarks = {}; };

  // 登録済み根拠に対応する自動表示の印（要素キー → 印）
  Game.prototype.autoMarks = function () {
    const out = {};
    const fig = this.problem.figure;
    const self = this;
    this.found.forEach(function (id) {
      const ev = self.evidenceById(id);
      ev.items.forEach(function (name) {
        out[PH.geometry.elementKey(fig, name)] = ev.mark;
      });
    });
    return out;
  };

  Game.prototype.evidenceById = function (id) {
    return this.problem.evidence.find(function (e) { return e.id === id; }) || null;
  };

  Game.prototype.evidenceKeys = function (id) {
    const ev = this.evidenceById(id);
    const fig = this.problem.figure;
    return ev ? ev.items.map(function (n) { return PH.geometry.elementKey(fig, n); }) : [];
  };

  PH.Game = Game;
  PH.calcStars = calcStars;

  if (typeof module !== 'undefined' && module.exports) module.exports = { Game: Game, calcStars: calcStars };
})(typeof window !== 'undefined' ? window : globalThis);
