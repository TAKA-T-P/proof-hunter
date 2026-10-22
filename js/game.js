/*
 * game.js — 問題進行・根拠収集（DOMに依存しない状態管理）
 *
 * phase : 'collect'（根拠収集） → 'congruence'（合同条件選択） → 'clear'（証明完成）
 *         結論が辺・角の等しさの問題（Ver.0.5、PH.hasFinalStep）は
 *         'triangle'（証明する三角形と頂点の対応を選ぶ） → 'collect' → 'congruence' → 'final'（合同から結論を導く） → 'clear'
 * mode  : 'side'（辺選択） / 'angle'（角選択） / 'mark'（印つけ） / 'erase'（印を消す） / 'tri'（三角形を選ぶ）
 *         辺選択では辺だけ、角選択では角だけがタップに反応する（頂点付近の誤選択を防ぐ）。
 * Ver.0.8：直角三角形の合同条件の問題（PH.isRightProblem）は、根拠の欄が「直角・斜辺・他の1辺（鋭角）」になる。
 *         role（今集めている欄）に合わない根拠は 'wrong-role'（例：他の1辺を斜辺の欄に入れた）。欄はタップで切りかえられる。
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
    // Ver.0.7：多段階証明（proofSteps）。前半のステップ → 根拠 → 合同条件 → 最終結論 → 後半のステップ
    this.engine = PH.proofEngine && PH.proofEngine.hasSteps(this.problem) ? new PH.ProofEngine(this.problem) : null;
    this.stepId = null;          // 解いているステップ
    this.stepChoice = null;      // 理由を選ぶステップで選んだ選択肢
    this.cmpPick = {};           // 式の比較：式のステップID → 選んだ部分（'target' 左辺 / 'value' 右辺）
    this.stepCounted = {};       // ミスに数えたステップの誤答
    this.phase = this.hasFinal ? 'triangle' : 'collect';
    this.mode = this.hasFinal ? 'tri' : 'side';
    if (!this.hasFinal && this.engine && this.engine.available('pre').length) this.enterSteps('pre');
    this.answerMode = this.mode; // 印つけ等から「解答にもどる」ときの戻り先
    this.triSel = [];            // 選んだ三角形（頂点の配列。1つ目が青、2つ目が黄）
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
    // Ver.0.8：直角三角形の根拠の欄（直角 → 斜辺 → 他の1辺／鋭角）と、今集めている欄
    this.roles = PH.rightTriangle ? PH.rightTriangle.slotRoles(this.problem) : [];
    this.role = this.roles[0] || null;
    this.established = {};       // 確かめた事実（等式キー → 根拠ID）。直角の根拠を確かめると、2つの三角形が直角三角形
    if (this.phase === 'collect') this.applyRoleMode();
  };

  // ---- 直角三角形の根拠の欄（Ver.0.8） -----------------------------------------------

  Game.prototype.isRight = function () { return this.roles.length > 0; };

  Game.prototype.roleOf = function (ev) { return PH.rightTriangle.roleOf(this.problem, ev); };

  // その欄の根拠を見つけたか
  Game.prototype.roleFound = function (role) {
    const self = this;
    return this.found.some(function (id) { return self.roleOf(self.evidenceById(id)) === role; });
  };

  // 今の欄に合わせて辺選択・角選択を切りかえる（直角・鋭角は角、斜辺・他の1辺は辺）
  Game.prototype.applyRoleMode = function () {
    if (!this.isRight() || !this.role || this.phase !== 'collect') return;
    this.mode = this.role === 'right' || this.role === 'acute' ? 'angle' : 'side';
    this.answerMode = this.mode;
  };

  // 集める欄を選ぶ（まだ見つけていない欄だけ）
  Game.prototype.selectRole = function (role) {
    if (!this.isRight() || this.phase !== 'collect' || this.roles.indexOf(role) < 0 || this.roleFound(role)) return false;
    this.role = role;
    this.clearSelection();
    this.applyRoleMode();
    return true;
  };

  // 2つの三角形が直角三角形であることを確かめたか（直角の根拠を見つけた）
  Game.prototype.rightConfirmed = function () { return this.isRight() && this.roleFound('right'); };

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
    // 多段階証明のステップでは、式の比較で共通部分を見つけたあとだけ辺・角を選べる
    if ((this.phase === 'step' || this.phase === 'post') && MODE_KIND[mode] && !this.commonFound()) return false;
    if (mode === 'step' && this.phase !== 'step' && this.phase !== 'post') return false;
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
    if (this.mode === 'step') return { type: 'ignored', message: this.currentStep() && this.currentStep().type === 'compare'
      ? '先に、2つの式で同じになっている部分をタップしよう。' : '下の選択肢から、理由を選ぼう。' };
    const stepPick = (this.phase === 'step' || this.phase === 'post') && this.commonFound();
    if (this.phase !== 'collect' && this.phase !== 'final' && !stepPick) return { type: 'ignored' };

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
    // Ver.0.8：直角の欄は「直角であることの理由」、ほかの欄では直角専用の理由を出さない
    if (this.isRight() && this.role === 'right') return PH.rightTriangle.RIGHT_REASONS.slice();
    const list = this.problem.reasons.filter(function (r) { return !(PH.REASONS[r] && PH.REASONS[r].rightOnly); });
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
      return { type: 'deselect' };
    }
    const t = tri.slice().sort();
    if (this.triSel.length < 2) this.triSel.push(t);
    else this.triSel[1] = t;
    return { type: 'select' };
  };

  Game.prototype.clearTriangles = function () {
    if (this.phase !== 'triangle') return false;
    this.triSel = [];
    return true;
  };

  // ハンターは入門用のモードなので、2つの三角形を選べば「決定」できる（頂点の対応は答えない。証明パズルでは答える）
  Game.prototype.canConfirmTriangles = function () {
    return this.phase === 'triangle' && this.triSel.length === 2;
  };

  /*
   * 「決定」（この2つの三角形で証明する）：三角形の組が正しければ根拠の収集へ。
   * 頂点の対応は問題データ（triangles・altTriangles）から決まり、「△ 三角形を確認」で見られる。
   * 誤りはミス1回（同じ組の再判定では増やさない）
   */
  Game.prototype.confirmTriangles = function () {
    if (!this.canConfirmTriangles()) return { status: 'incomplete', ok: false, miss: false };
    const key = function (t) { return t.slice().sort().join(''); };
    const sel = this.triSel.map(key);
    const pair = sel.slice().sort().join('|');
    const hit = [this.problem.triangles].concat(this.problem.altTriangles || []).find(function (c) {
      return [key(c[0]), key(c[1])].sort().join('|') === pair;
    });
    if (hit) {
      // 1つ目に選んだ三角形を先にした、正しい対応の順
      const tris = key(hit[0]) === sel[0] ? [hit[0], hit[1]] : [hit[1], hit[0]];
      this.phase = 'collect';
      this.mode = 'side';
      this.answerMode = 'side';
      this.triangles = [tris[0].slice(), tris[1].slice()];
      if (this.engine && this.engine.available('pre').length) this.enterSteps('pre');
      else this.applyRoleMode();
      return { status: 'ok', ok: true, miss: false };
    }
    const r = { status: 'wrong', ok: false, miss: false };
    if (!this.triCounted[pair]) {
      this.triCounted[pair] = true;
      this.misses++;
      r.miss = true;
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
      if (this.engine) this.engine.reach('final');
      // 最終結論のあとに解くステップ（例：2つの角が等しいので二等辺三角形）があれば、その段階へ
      if (this.engine && this.engine.available('post').length) {
        this.enterSteps('post');
        r.post = true;
      } else this.finish();
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
    let r = PH.validation.checkEvidence(this.problem, this.selection, this.reason, this.found, this.engine);
    // Ver.0.8：今の欄（直角・斜辺・他の1辺・鋭角）に合わない根拠（例：他の1辺を斜辺の欄に入れた）
    if (this.isRight() && r.evidence && r.status !== 'duplicate') {
      const got = this.roleOf(r.evidence);
      if (got !== this.role) r = { status: 'wrong-role', miss: true, evidence: r.evidence, kind: r.kind, role: got, want: this.role };
    }
    if (r.miss) this.misses++;
    switch (r.status) {
      case 'correct':
        this.found.push(r.evidence.id);
        this.clearSelection();
        this.establish(r.evidence);
        if (this.found.length === this.total()) {
          this.phase = 'congruence';
          r.complete = true;
        } else if (this.isRight()) {
          // 次の空いている欄へ
          const self = this;
          this.role = this.roles.find(function (x) { return !self.roleFound(x); }) || null;
          this.applyRoleMode();
          r.nextRole = this.role;
        }
        break;
      case 'wrong-role':
        this.clearSelection();
        break;
      case 'wrong-reason':
        this.reason = null;      // 等式の選択は残して理由だけ選び直す
        break;
      default:
        this.clearSelection();
    }
    return r;
  };

  // 見つけた根拠を、確かめた事実として登録する（直角の根拠なら2つの三角形が直角三角形になる）
  Game.prototype.establish = function (ev) {
    const keys = this.evidenceKeys(ev.id);
    const eq = PH.validation.equationKey(keys[0], keys[1]);
    this.established[eq] = ev.id;
    if (this.engine) this.engine.establish(eq, ev.id);
  };

  // 合同条件の選択肢（直角三角形の問題は5つ、それ以外は3つ）
  Game.prototype.conditionOptions = function () { return PH.conditionOrder(this.problem); };

  Game.prototype.selectCondition = function (id) {
    if (this.phase !== 'congruence' || !PH.CONDITIONS[id] || this.conditionOptions().indexOf(id) < 0) return false;
    this.condition = id;
    return true;
  };

  // 合同条件を決定
  Game.prototype.confirmCondition = function () {
    if (this.phase !== 'congruence' || !this.condition) return { ok: false, status: 'incomplete' };
    const r = PH.validation.checkCongruence(this.problem, this.found, this.condition);
    if (r.ok && this.engine) this.engine.reach('congruence');
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
    } else if (r.status === 'classic-condition') {
      // 直角三角形の問題で3つの合同条件を選んだ：数学的には別の道すじで示せる場合もあるので、ミスにはしない
      r.miss = false;
      this.condition = null;
    } else {
      this.misses++;
      r.miss = true;
      this.condition = null;
    }
    return r;
  };

  Game.prototype.finish = function () {
    this.phase = 'clear';
    this.mode = 'side';
    this.stars = calcStars(this.misses, this.hintsUsed);
  };

  // ---- 多段階証明のステップ（Ver.0.7） ------------------------------------------

  // 前半（'pre'）・後半（'post'）のステップの段階に入る。解けるステップのうち最初のものを選ぶ
  Game.prototype.enterSteps = function (stage) {
    this.phase = stage === 'post' ? 'post' : 'step';
    this.mode = 'step';
    this.answerMode = 'step';
    this.clearSelection();
    this.stepId = this.engine.available(stage)[0].id;
    this.stepChoice = null;
    this.cmpPick = {};
  };

  Game.prototype.currentStep = function () {
    return this.engine && this.stepId ? this.engine.step(this.stepId) : null;
  };

  Game.prototype.stepStage = function () { return this.phase === 'post' ? 'post' : 'pre'; };

  // 解けるステップのうち、別のものに切りかえる（独立したステップはどの順番でもよい）
  Game.prototype.selectStep = function (id) {
    if ((this.phase !== 'step' && this.phase !== 'post') || this.engine.status(id) !== 'available') return false;
    this.stepId = id;
    this.stepChoice = null;
    this.cmpPick = {};
    this.clearSelection();
    this.mode = 'step';
    this.answerMode = 'step';
    return true;
  };

  // 理由を選ぶステップの選択肢（正解と、その定理では言えない理由。並びは問題ごとに一定）
  Game.prototype.stepOptions = function (step) {
    return stepOptions(this.problem, step || this.currentStep());
  };

  Game.prototype.chooseStepOption = function (id) {
    const s = this.currentStep();
    if (!s || s.type === 'compare' || !this.stepOptions(s).some(function (o) { return o.id === id; })) return false;
    this.stepChoice = id;
    return true;
  };

  // 式の比較：2つの式のどちらの辺（左辺／右辺）を選ぶか（もう一度で解除）
  Game.prototype.pickPart = function (exprId, part) {
    const s = this.currentStep();
    if (!s || s.type !== 'compare' || (s.dependsOn || []).indexOf(exprId) < 0) return false;
    if (this.cmpPick[exprId] === part) delete this.cmpPick[exprId];
    else this.cmpPick[exprId] = part;
    this.clearSelection();
    this.mode = this.commonFound() ? 'angle' : 'step';
    this.answerMode = this.mode;
    return true;
  };

  // 2つの式の共通部分（右辺どうし）を選べたか
  Game.prototype.commonFound = function () {
    const s = this.currentStep();
    if (!s || s.type !== 'compare') return false;
    const self = this;
    return (s.dependsOn || []).every(function (d) { return self.cmpPick[d] === 'value'; });
  };

  Game.prototype.cmpPickedBoth = function () {
    const s = this.currentStep();
    const self = this;
    return !!s && (s.dependsOn || []).every(function (d) { return !!self.cmpPick[d]; });
  };

  Game.prototype.canConfirmStep = function () {
    const s = this.currentStep();
    if (!s) return false;
    if (s.type === 'compare') return this.commonFound() && this.selection.length === 2;
    return !!this.stepChoice;
  };

  // ステップの答えを確定：正しければ事実として登録し、次のステップ（または根拠の収集・証明完成）へ
  Game.prototype.confirmStep = function () {
    if (!this.canConfirmStep()) return { status: 'incomplete', miss: false };
    const s = this.currentStep();
    let ok;
    let sig;
    if (s.type === 'compare') {
      const want = s.items.map(function (n) { return PH.geometry.elementKey(this.problem.figure, n); }, this);
      ok = PH.validation.equationKey(this.selection[0], this.selection[1]) === PH.validation.equationKey(want[0], want[1]);
      sig = s.id + ':' + PH.validation.equationKey(this.selection[0], this.selection[1]);
    } else {
      ok = this.stepChoice === 'a';
      sig = s.id + ':' + this.stepChoice;
    }
    const r = { status: ok ? 'correct' : 'wrong', step: s, miss: false };
    if (!ok) {
      if (!this.stepCounted[sig]) { this.stepCounted[sig] = true; this.misses++; r.miss = true; }
      this.stepChoice = null;
      if (s.type === 'compare') this.clearSelection();
      return r;
    }
    this.engine.complete(s.id);
    this.clearSelection();
    const stage = this.stepStage();
    const next = this.engine.available(stage);
    if (next.length) {
      this.stepId = next[0].id;
      this.stepChoice = null;
      this.cmpPick = {};
      this.mode = 'step';
    } else if (stage === 'pre') {
      // 前半のステップがすべて終わった → 3つの根拠を集める
      this.stepId = null;
      this.phase = 'collect';
      this.mode = 'side';
      this.answerMode = 'side';
      this.applyRoleMode();
      r.stageDone = 'pre';
    } else {
      this.stepId = null;
      this.finish();
      r.stageDone = 'post';
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

  // 見つけた斜辺の要素キー（図で斜辺を強調する。Ver.0.8）
  Game.prototype.hypotenuseKeys = function () {
    const self = this;
    if (!this.isRight()) return [];
    const ev = this.found.map(function (id) { return self.evidenceById(id); }).find(function (e) { return self.roleOf(e) === 'hypotenuse'; });
    return ev ? this.evidenceKeys(ev.id) : [];
  };

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

  // 文字列から決まる疑似乱数（選択肢の並びを毎回同じにする）
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /*
   * 理由を選ぶステップ（定理・角の式）の選択肢：正解（id 'a'）と、その定理では言えない理由2つ
   * 証明文の書き方（「二等辺三角形の底角は等しいから」「角の和より」など）で表示する
   */
  function stepOptions(problem, step) {
    if (!step || step.type === 'compare') return [];
    const R = PH.proofRules;
    const opts = [{ id: 'a', text: R.label(step.rule) }].concat((R.RULE_DISTRACTORS[step.rule] || []).slice(0, 2).map(function (t, i) {
      return { id: 'w' + i, text: t };
    }));
    const rnd = seeded(problem.id + ':' + step.id);
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = opts[i]; opts[i] = opts[j]; opts[j] = t;
    }
    return opts;
  }

  // 完成した証明文。生徒が集めた順にかかわらず、問題データの evidence の順（標準的な順序）で並べる
  const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥', '⑦', '⑧', '⑨', '⑩'];
  /*
   * 完成した証明文。
   *   lines     … 合同の根拠の行（導いた事実を使う根拠は、そのステップの行で書くので入れない）
   *   stepLines … 多段階証明の前半のステップ（定理・角の式・式の比較）。番号は lines の続き
   *   summary   … 「①、②、⑤より、」（根拠の順。導いた事実はそのステップの番号）
   *   final     … 合同から導く結論、post … 最終結論のあとのステップ（例：二等辺三角形である）
   */
  function buildProof(problem) {
    const engine = PH.proofEngine;
    const rows = problem.evidence.filter(function (ev) { return !ev.fromStep; });
    const lines = rows.map(function (ev, i) {
      return {
        evidenceId: ev.id,
        reason: ev.proofReason || PH.REASONS[ev.reason].proof,
        equation: PH.evidenceText(ev),     // 直角の確認は「∠ABC＝∠DEF＝90°」
        no: CIRCLED[i],
        role: PH.rightTriangle ? PH.rightTriangle.roleOf(problem, ev) : null,
      };
    });
    const stepNo = {};
    const stepLines = [];
    const pre = engine && engine.hasSteps(problem) ? engine.stepsOf(problem, 'pre') : [];
    pre.forEach(function (s, i) {
      const no = CIRCLED[lines.length + i];
      stepNo[s.id] = no;
      stepLines.push({ stepId: s.id, no: no, reason: stepReasonText(s, stepNo), equation: s.label, type: s.type });
    });
    const nums = problem.evidence.map(function (ev) {
      if (ev.fromStep) return stepNo[ev.fromStep];
      return lines.find(function (l) { return l.evidenceId === ev.id; }).no;
    });
    const proof = {
      intro: problem.proof.intro,
      lines: lines,
      stepLines: stepLines,
      summary: nums.join('、') + 'より、',
      condition: PH.CONDITIONS[problem.congruence].label,
      conclusion: PH.hasFinalStep(problem) ? PH.congruenceText(problem) : problem.conclusion,
      final: null,
      post: [],
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
    if (engine && engine.hasSteps(problem)) {
      proof.post = engine.stepsOf(problem, 'post').map(function (s) {
        return { stepId: s.id, reason: stepReasonText(s, stepNo), conclusion: s.label };
      });
    }
    return proof;
  }

  // ステップの行の理由の書き方
  function stepReasonText(s, stepNo) {
    const R = PH.proofRules;
    if (s.type === 'compare') return (s.dependsOn || []).map(function (d) { return stepNo[d]; }).join('、') + 'より、';
    if (s.type === 'expression') return R.label(s.rule) + '（' + s.premiseLabel + '）、';
    return s.premiseLabel + 'より、' + R.label(s.rule) + '、';
  }

  PH.Game = Game;
  PH.calcStars = calcStars;
  PH.buildProof = buildProof;
  PH.stepOptions = stepOptions;
  PH.stepReasonText = stepReasonText;

  if (typeof module !== 'undefined' && module.exports) module.exports = { Game: Game, calcStars: calcStars };
})(typeof window !== 'undefined' ? window : globalThis);
