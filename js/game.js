/*
 * game.js — 問題進行・根拠収集（DOMに依存しない状態管理）
 *
 * phase : 'collect'（根拠収集） → 'congruence'（合同条件選択） → 'clear'（証明完成）
 *         結論が辺・角の等しさの問題（Ver.0.5、PH.hasFinalStep）は
 *         'triangle'（証明する三角形と頂点の対応を選ぶ） → 'collect' → 'congruence' → 'final'（合同から結論を導く） → 'clear'
 * mode  : 'side'（辺選択） / 'angle'（角選択） / 'mark'（印つけ） / 'erase'（印を消す） / 'tri'（三角形を選ぶ）
 *         辺選択では辺だけ、角選択では角だけがタップに反応する（頂点付近の誤選択を防ぐ）。
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
    this.hasFinal = !!(PH.hasFinalStep && PH.hasFinalStep(this.problem));
    this.phase = this.hasFinal ? 'triangle' : 'collect';
    this.mode = this.hasFinal ? 'tri' : 'side';
    this.answerMode = this.mode; // 印つけ等から「解答にもどる」ときの戻り先
    this.triSel = [];            // 選んだ三角形（頂点の配列。1つ目が青、2つ目が黄）
    this.triMap = [];            // 1つ目の三角形の頂点の順に対応する、2つ目の三角形の頂点
    this.triCounted = {};        // ミスに数えた三角形の誤答（同じ誤答の再判定ではミスを増やさない）
    this.congruent = false;      // 合同が成立した（最終結論を導ける）
    this.selection = [];         // 選択中の要素キー（共通な辺は同じキーが2つ）
    this.reason = null;          // 選択中の理由ID
    this.found = [];             // 見つけた根拠ID（見つけた順）
    this.misses = 0;
    this.hintsUsed = 0;
    this.hintLevels = {};        // 根拠ID → 表示済みヒント段階
    this.userMarks = {};         // 要素キー → 印の本数（生徒がつけた印）
    this.markTool = { kind: 'seg', n: 1 };   // 印つけ：辺の印か角の印のどちらか一方と、その本数
    this.condition = null;       // 選択中の合同条件
    this.stars = 0;
  };

  Game.prototype.total = function () { return this.problem.evidence.length; };

  Game.prototype.element = function (key) { return this.elements.byKey[key] || null; };

  Game.prototype.selectionKind = function () {
    const el = this.selection.length ? this.element(this.selection[0]) : null;
    return el ? el.kind : null;
  };

  const MODE_KIND = { side: 'seg', angle: 'ang' };

  Game.prototype.isAnswering = function () {
    return this.mode === 'side' || this.mode === 'angle' || this.mode === 'tri';
  };

  Game.prototype.setMode = function (mode) {
    // 同じボタンをもう一度押すと（印つけ・消す）解答に戻る。'answer' は直前の辺選択/角選択（三角形選択）
    if (mode === 'answer' || (mode === this.mode && !MODE_KIND[mode] && mode !== 'tri')) mode = this.answerMode;
    // 三角形を選ぶ段階では辺選択・角選択はできない。三角形選択はその段階だけ
    if (this.phase === 'triangle' && MODE_KIND[mode]) return false;
    if (mode === 'tri' && this.phase !== 'triangle') return false;
    if (MODE_KIND[mode]) {
      // 辺選択⇔角選択：選択中のものと種類が違えば選び直し
      if (this.selection.length && this.selectionKind() !== MODE_KIND[mode]) this.clearSelection();
      this.answerMode = mode;
    }
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
      if (el.kind !== this.markTool.kind) {
        return { type: 'ignored', message: el.kind === 'ang' ? '角に印をつけるときは「角の印」を選ぼう。' : '辺に印をつけるときは「辺の印」を選ぼう。' };
      }
      const n = this.markTool.n;
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

    if (this.mode === 'tri') return { type: 'ignored', message: '三角形の内側をタップして選ぼう。' };
    if (this.phase !== 'collect' && this.phase !== 'final') return { type: 'ignored' };

    // 辺選択・角選択（根拠の収集と、最終結論）
    if (el.kind !== MODE_KIND[this.mode]) {
      return { type: 'ignored', message: el.kind === 'ang' ? '角を選ぶときは「角選択」に切り替えよう。' : '辺を選ぶときは「辺選択」に切り替えよう。' };
    }
    // 同じ辺・角を2回タップ → 「BD＝BD」「∠A＝∠A」（共通）の候補、3回目で選択解除
    if (this.selection.length === 1 && this.selection[0] === key) {
      this.selection.push(key);
      this.reason = null;
      return { type: 'select' };
    }
    const idx = this.selection.indexOf(key);
    if (idx >= 0) {
      if (this.isSameTwice()) this.selection = [];
      else this.selection.splice(idx, 1);
      this.reason = null;
      return { type: 'deselect' };
    }
    if (this.selection.length === 1) this.selection.push(key);
    else this.selection = [key];
    this.reason = null;
    return { type: 'select' };
  };

  // 同じ要素が2つ選ばれている（共通な辺・共通な角の候補）
  Game.prototype.isSameTwice = function () {
    return this.selection.length === 2 && this.selection[0] === this.selection[1];
  };

  Game.prototype.availableReasons = function () {
    if (this.phase === 'final') return this.finalReasons();
    const list = this.problem.reasons.slice();
    if (this.isSameTwice()) {
      const id = this.selectionKind() === 'ang' ? 'commonAngle' : 'common';
      if (list.indexOf(id) < 0) list.splice(1, 0, id);
    }
    return list;
  };

  // 最終結論の理由の選択肢：仮定・問題のほかの理由1つ・合同な図形の対応する辺／角（最終結論の段階だけで使える）
  Game.prototype.finalReasons = function () {
    const other = this.problem.reasons.find(function (r) { return r !== 'given' && r !== 'common' && r !== 'commonAngle'; });
    return ['given'].concat(other ? [other] : [], ['correspondingSides', 'correspondingAngles']);
  };

  Game.prototype.selectReason = function (id) {
    if ((this.phase !== 'collect' && this.phase !== 'final') || this.selection.length !== 2) return false;
    if (this.availableReasons().indexOf(id) < 0) return false;
    this.reason = id;
    return true;
  };

  Game.prototype.canConfirm = function () {
    return this.phase === 'collect' && this.selection.length === 2 && !!this.reason;
  };

  // ---- 三角形の選択（Ver.0.5） -------------------------------------------------

  // 図の三角形をタップ：1つ目・2つ目を選ぶ。選んだ三角形をもう一度タップで解除、3つ目は2つ目と入れかえ
  Game.prototype.tapTriangle = function (tri) {
    if (this.phase !== 'triangle' || this.mode !== 'tri') return { type: 'ignored' };
    if (!PH.geometry.isFigureTriangle(this.problem.figure, tri)) return { type: 'ignored' };
    const id = tri.slice().sort().join('');
    const idx = this.triSel.findIndex(function (t) { return t.slice().sort().join('') === id; });
    if (idx >= 0) {
      this.triSel.splice(idx, 1);
      this.triMap = [];
      return { type: 'deselect' };
    }
    const t = tri.slice().sort();
    if (this.triSel.length < 2) this.triSel.push(t);
    else this.triSel[1] = t;
    this.triMap = [];
    return { type: 'select' };
  };

  // 1つ目の三角形の頂点（順に）に対応する、2つ目の三角形の頂点を押す
  Game.prototype.pressVertex = function (v) {
    if (this.phase !== 'triangle' || this.triSel.length !== 2 || this.triMap.length >= 3) return false;
    if (this.triSel[1].indexOf(v) < 0 || this.triMap.indexOf(v) >= 0) return false;
    this.triMap.push(v);
    return true;
  };

  Game.prototype.backVertex = function () {
    if (this.phase !== 'triangle' || !this.triMap.length) return false;
    this.triMap.pop();
    return true;
  };

  Game.prototype.clearTriangles = function () {
    if (this.phase !== 'triangle') return false;
    this.triSel = [];
    this.triMap = [];
    return true;
  };

  Game.prototype.canConfirmTriangles = function () {
    return this.phase === 'triangle' && this.triSel.length === 2 && this.triMap.length === 3;
  };

  // 「決定」（この2つの三角形で証明する）：正しければ根拠の収集へ。誤りはミス1回（同じ誤答の再判定では増やさない）
  Game.prototype.confirmTriangles = function () {
    if (!this.canConfirmTriangles()) return { status: 'incomplete', ok: false, miss: false };
    const t1 = this.triSel[0], t2 = this.triMap.slice();
    const r = PH.validation.checkTriangles(this.problem, t1, t2);
    r.miss = false;
    if (r.ok) {
      this.phase = 'collect';
      this.mode = 'side';
      this.answerMode = 'side';
      this.triangles = [t1.slice(), t2];
    } else if (r.status === 'order' || r.status === 'wrong') {
      const sig = PH.validation.correspondenceKey(t1, t2);
      if (!this.triCounted[sig]) {
        this.triCounted[sig] = true;
        this.misses++;
        r.miss = true;
      }
    }
    return r;
  };

  // ---- 最終結論（Ver.0.5） -----------------------------------------------------

  Game.prototype.canConfirmFinal = function () {
    return this.phase === 'final' && this.selection.length === 2 && !!this.reason;
  };

  // 「証明を完成する」：結論の等式と理由を判定。正しければ証明完成
  Game.prototype.confirmFinal = function () {
    if (!this.canConfirmFinal()) return { status: 'incomplete', miss: false };
    const r = PH.validation.checkFinal(this.problem, this.selection, this.reason, this.congruent);
    if (r.miss) this.misses++;
    if (r.status === 'correct') {
      this.clearSelection();
      this.phase = 'clear';
      this.mode = 'side';
      this.stars = calcStars(this.misses, this.hintsUsed);
    } else if (r.status === 'wrong-reason') {
      this.reason = null;        // 等式は残して理由だけ選び直す
    } else {
      this.clearSelection();
    }
    return r;
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
    if (r.ok && this.hasFinal) {
      // 合同成立。まだクリアではなく、対応する辺・角から結論を導く段階へ
      this.congruent = true;
      this.phase = 'final';
      this.mode = this.problem.finalStep.relationType === 'angle' ? 'angle' : 'side';
      this.answerMode = this.mode;
      this.clearSelection();
      r.final = true;
    } else if (r.ok) {
      this.phase = 'clear';
      this.mode = this.answerMode;
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

  Game.prototype.setMarkTool = function (kind, n) {
    if (kind !== 'seg' && kind !== 'ang') return false;
    this.markTool = { kind: kind, n: n };
    return true;
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

  // 完成した証明文。生徒が集めた順にかかわらず、問題データの evidence の順（標準的な順序）で並べる
  const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'];
  function buildProof(problem) {
    const lines = problem.evidence.map(function (ev, i) {
      return {
        evidenceId: ev.id,
        reason: ev.proofReason || PH.REASONS[ev.reason].proof,
        equation: ev.label,
        no: CIRCLED[i],
      };
    });
    const proof = {
      intro: problem.proof.intro,
      lines: lines,
      summary: lines.map(function (l) { return l.no; }).join('、') + 'より、',
      condition: PH.CONDITIONS[problem.congruence].label,
      conclusion: PH.hasFinalStep(problem) ? PH.congruenceText(problem) : problem.conclusion,
      final: null,
    };
    // 結論が辺・角の等しさの問題：合同のあとに「したがって、合同な図形の対応する〜は等しいから、結論」
    if (PH.hasFinalStep(problem)) {
      proof.final = {
        lead: 'したがって、',
        reason: PH.REASONS[PH.finalReasonFor(problem)].proof,
        conclusion: problem.finalStep.label,
        items: problem.finalStep.items,
      };
    }
    return proof;
  }

  PH.Game = Game;
  PH.calcStars = calcStars;
  PH.buildProof = buildProof;

  if (typeof module !== 'undefined' && module.exports) module.exports = { Game: Game, calcStars: calcStars };
})(typeof window !== 'undefined' ? window : globalThis);
