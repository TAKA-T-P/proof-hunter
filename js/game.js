/*
 * game.js — 問題進行・根拠収集（DOMに依存しない状態管理）
 *
 * phase : 'collect'（根拠収集） → 'congruence'（合同条件選択） → 'clear'（証明完成）
 *         結論が辺・角の等しさの問題（Ver.0.5、PH.hasFinalStep）は
 *         'triangle'（証明する三角形と頂点の対応を選ぶ） → 'collect' → 'congruence' → 'final'（合同から結論を導く） → 'clear'
 * mode  : 'side'（辺選択） / 'angle'（角選択） / 'mark'（印つけ） / 'erase'（印を消す） / 'tri'（三角形を選ぶ）
 *         辺選択では辺だけ、角選択では角だけがタップに反応する（頂点付近の誤選択を防ぐ）。
 * Ver.0.8：多段階証明（proofSteps）のハンターは「三角形 → 根拠 → 合同条件 → 結論」の順。前のステップで導く根拠（fromStep）は、
 *         根拠の収集で2つの要素を選んで「詳しい理由を説明する」（explain）を押すと、そのステップ（定理・角の式・式の比較）を解き、
 *         解きおえるとその根拠が登録されて根拠の収集にもどる。
 * Ver.0.8：直角三角形の合同条件の問題（PH.isRightProblem）は、根拠の欄が「直角・斜辺・他の1辺（鋭角）」になる。
 *         role（今集めている欄）に合わない根拠は 'wrong-role'（例：他の1辺を斜辺の欄に入れた）。欄はタップで切りかえられる。
 *         根拠そのもの（等式と理由）が正しく、欄の順番だけがちがうときはミスに数えない（理由もまちがっていればミス）。
 * Ver.0.9：結論が平行四辺形の問題（PH.isQuadProblem）は、'qcollect'（平行四辺形の根拠を集める。数は問題ごと）→ 'qcondition'
 *         （5つの成立条件から選ぶ）→ 'clear'。三角形の合同を示す部分がある問題（PH.hasLemma。p35）は、
 *         'triangle' → 'collect' → 'congruence' → 'final'（合同から角の等しさを導く）のあとで 'qcollect' に進む。
 *         relation：2つの辺を選んだときの関係（'eq' 等しい ＝ / 'parallel' 平行 ∥。「＝⇔∥」で切りかえる）。
 * Ver.1.0：結論がひし形・長方形の問題も同じ段階（'qcollect' → 'qcondition'）。成立条件は、ひし形・長方形の6つから選ぶ。
 *         証明できたら、四角形の種類を証明済みの事実（{ kind: 'quadrilateralType', vertices, type }）として登録する。
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
    this.baseProblem = problem;      // 左右対称の道すじの形（p45）に切りかえても、やり直すときはこの問題にもどる
    this.problem = problem;
    this.elements = PH.geometry.getElements(problem.figure);
    this.reset();
  }

  Game.prototype.reset = function () {
    this.problem = this.baseProblem;
    this.hasFinal = !!(PH.hasFinalStep && PH.hasFinalStep(this.problem));
    // Ver.0.7：多段階証明（proofSteps）。前半のステップ → 根拠 → 合同条件 → 最終結論 → 後半のステップ
    this.engine = PH.proofEngine && PH.proofEngine.hasSteps(this.problem) ? new PH.ProofEngine(this.problem) : null;
    this.stepId = null;          // 解いているステップ
    this.stepChoice = null;      // 理由を選ぶステップで選んだ選択肢
    this.cmpPick = {};           // 式の比較：式のステップID → 選んだ部分（'target' 左辺 / 'value' 右辺）
    this.stepCounted = {};       // ミスに数えたステップの誤答
    // 三角形を問題文で指定している問題（p46・p47）は、三角形を選ぶ段階をとばして根拠から
    const pick = this.hasFinal && !PH.trianglesGiven(this.problem);
    this.phase = pick ? 'triangle' : 'collect';
    this.mode = pick ? 'tri' : 'side';
    this.triangles = pick || !this.problem.triangles ? null : this.problem.triangles.map(function (t) { return t.slice(); });
    this.explaining = null;      // 「詳しい理由を説明する」で説明している根拠のID
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
    // Ver.0.9：平行四辺形の問題
    this.quad = !!(PH.isQuadProblem && PH.isQuadProblem(this.problem));
    this.part = this.quad && !PH.hasLemma(this.problem) ? 'quad' : 'tri';   // 今の部分（三角形の合同／平行四辺形）
    this.qfound = [];            // 見つけた平行四辺形の根拠ID
    this.relation = 'eq';        // 2つの辺の関係（'eq' ＝ / 'parallel' ∥）
    this.pcondition = null;      // 選択中の成立条件
    this.finalDone = false;      // 合同から結論（平行を導く角の等しさ）を導いた
    this.explainPart = null;     // 「詳しい理由を説明する」をおしたときの部分
    if (this.part === 'quad') {
      this.phase = 'qcollect';
      this.mode = this.answerMode = 'side';
    }
    if (this.phase === 'collect') this.applyRoleMode();
    // Ver.1.0（p50）：合同を使わない問題は、等しい2つの角を選ぶところから（最初から角選択）
    if (PH.isGoalOnly && PH.isGoalOnly(this.problem)) this.mode = this.answerMode = 'angle';
  };

  // ---- 平行四辺形（Ver.0.9） -----------------------------------------------------

  Game.prototype.quadEvidence = function () { return (this.problem.parallelogram && this.problem.parallelogram.evidence) || []; };

  // 今の部分の根拠の一覧と、見つけた根拠
  Game.prototype.partEvidence = function () { return this.part === 'quad' ? this.quadEvidence() : this.problem.evidence; };
  Game.prototype.partFound = function () { return this.part === 'quad' ? this.qfound : this.found; };

  /*
   * 左右対称の道すじ（p45：∠A＝90° から ∠B・∠D のどちらを先に求めてもよい）。
   * 形によって変わる根拠をまだ見つけていなければ、選んだ関係に合う形（問題データの variants）に切りかえる
   */
  Game.prototype.switchVariant = function (keys) {
    const base = this.baseProblem;
    if (!base.variants || this.part !== 'quad' || this.relation !== 'eq') return false;
    const self = this;
    const changed = Object.keys(base.variants[0].evidence || {});
    if (changed.some(function (id) { return self.qfound.indexOf(id) >= 0; })) return false;
    const PG = PH.parallelogram;
    const key = PG.factKeyFromKeys(base.figure, keys, 'eq');
    const forms = [base].concat(base.variants.map(function (v) { return PH.problemVariant(base, v.id); }));
    const hit = forms.find(function (q) { const ev = PG.matchEvidence(q, key); return !!ev && changed.indexOf(ev.id) >= 0; });
    if (!hit || hit === this.problem) return false;
    this.problem = hit;
    const old = this.engine;
    this.engine = new PH.ProofEngine(hit);
    if (old) ['done', 'reached', 'facts', 'types'].forEach(function (k) { self.engine[k] = old[k]; });
    return true;
  };

  // 平行四辺形の根拠を集める段階へ（三角形の合同の部分がある問題は、結論を導いたあと）
  Game.prototype.enterQuad = function () {
    this.part = 'quad';
    this.role = null;              // 直角三角形の欄（直角・斜辺・鋭角）は三角形の合同の部分だけ（p42）
    this.phase = 'qcollect';
    this.mode = this.answerMode = 'side';
    this.relation = 'eq';
    this.clearSelection();
  };

  // 「＝」と「∥」の切りかえ（平行四辺形の根拠を集めるとき、辺を選んでいる（または何も選んでいない）ときだけ）
  Game.prototype.canToggleRelation = function () {
    return this.phase === 'qcollect' && this.mode === 'side' && (!this.selection.length || this.selectionKind() === 'seg');
  };

  Game.prototype.toggleRelation = function () {
    if (!this.canToggleRelation()) return false;
    this.relation = this.relation === 'parallel' ? 'eq' : 'parallel';
    this.reason = null;
    return true;
  };

  // 平行を導く角の等しさなどが、証明済みか（合同から導いた結論・ステップの結論・見つけた根拠）
  Game.prototype.isEstablished = function (eqKey) {
    const p = this.problem;
    if (this.finalDone && p.finalStep) {
      const fk = p.finalStep.items.map(function (n) { return PH.geometry.elementKey(p.figure, n); });
      if (PH.validation.equationKey(fk[0], fk[1]) === eqKey) return true;
    }
    if (this.engine && this.engine.isProved(eqKey)) return true;
    return !!this.established[eqKey];
  };

  // 平行四辺形の根拠を確定
  Game.prototype.confirmQuadEvidence = function () {
    const self = this;
    this.switchVariant(this.selection);
    const r = PH.parallelogram.checkEvidence(this.problem, this.selection, this.relation, this.reason, this.qfound, {
      engine: this.engine, isEstablished: function (k) { return self.isEstablished(k); },
    });
    if (r.miss) this.misses++;
    if (r.status === 'correct') {
      this.qfound.push(r.evidence.id);
      this.clearSelection();
      this.relation = 'eq';            // 次の根拠は「＝」から
      if (this.qfound.length === this.total()) {
        this.phase = 'qcondition';
        r.complete = true;
      }
    } else if (r.status === 'wrong-reason') {
      this.reason = null;
    } else {
      this.clearSelection();
    }
    return r;
  };

  // 成立条件の決定
  Game.prototype.confirmQuadCondition = function () {
    if (this.phase !== 'qcondition' || !this.pcondition) return { ok: false, status: 'incomplete' };
    const r = PH.parallelogram.checkCondition(this.problem, this.qfound, this.pcondition);
    if (r.ok) {
      // 証明できた四角形の種類を、証明済みの事実として登録する（包含関係で、より一般的な種類としても使える）
      const p = this.problem;
      this.provedType = { kind: 'quadrilateralType', vertices: p.targetQuadrilateral.slice(), type: PH.quadType(p) };
      if (this.engine) this.engine.establishType(p.targetQuadrilateral, PH.quadType(p), 'proved');
      this.finish();
      return r;
    }
    if (r.status === 'alternative') r.miss = false;      // 数学的には別の道すじで示せる条件：ミスにしない
    else { r.miss = true; this.misses++; }
    this.pcondition = null;
    return r;
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

  Game.prototype.total = function () { return this.partEvidence().length; };

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
    if (this.phase === 'qcondition' && MODE_KIND[mode]) return false;
    if (mode === 'angle') this.relation = 'eq';            // 角どうしは平行にならない
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
    if (this.phase !== 'collect' && this.phase !== 'final' && this.phase !== 'qcollect' && !stepPick) return { type: 'ignored' };

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
    // Ver.0.9：平行四辺形の根拠の理由（性質・平行を導く理由など。「導いた等式より」は出さない）
    if (this.phase === 'qcollect') {
      return this.problem.parallelogram.reasons.filter(function (r) { return !(PH.REASONS[r] && PH.REASONS[r].meta); });
    }
    // Ver.0.8：直角の欄は「直角であることの理由」、ほかの欄では直角専用の理由を出さない
    if (this.isRight() && this.role === 'right') return PH.rightTriangle.RIGHT_REASONS.slice();
    // 「導いた等式より」（meta）は選択肢に出さない（導く根拠は「詳しい理由を説明する」で説明する）
    const list = this.problem.reasons.filter(function (r) { return !(PH.REASONS[r] && (PH.REASONS[r].rightOnly || PH.REASONS[r].meta)); });
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
    if ((this.phase !== 'collect' && this.phase !== 'final' && this.phase !== 'qcollect') || this.selection.length !== 2) return false;
    if (this.availableReasons().indexOf(id) < 0) return false;
    this.reason = id;
    return true;
  };

  Game.prototype.canConfirm = function () {
    return (this.phase === 'collect' || this.phase === 'qcollect') && this.selection.length === 2 && !!this.reason;
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
      this.applyRoleMode();
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
      this.finalDone = true;
      // Ver.0.9：平行四辺形の問題（p35）は、導いた角の等しさを使って平行四辺形の根拠を集める段階へ
      if (this.quad) {
        this.enterQuad();
        r.quad = true;
        return r;
      }
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
    if (this.phase === 'qcollect') return this.confirmQuadEvidence();
    let r = PH.validation.checkEvidence(this.problem, this.selection, this.reason, this.found, this.engine);
    // Ver.0.8：今の欄（直角・斜辺・他の1辺・鋭角）に合わない根拠（例：他の1辺を斜辺の欄に入れた）
    if (this.isRight() && r.evidence && r.status !== 'duplicate') {
      const got = this.roleOf(r.evidence);
      // 根拠は正しく、答える欄の順番だけがちがう（例：斜辺の欄で他の1辺を先に答えた）ときはミスにしない
      if (got !== this.role) r = { status: 'wrong-role', miss: r.status !== 'correct', evidence: r.evidence, kind: r.kind, role: got, want: this.role };
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
    if (ev.rel === 'parallel') return;           // 平行の関係は等式キーにしない
    const keys = this.evidenceKeys(ev.id);
    const eq = PH.validation.equationKey(keys[0], keys[1]);
    this.established[eq] = ev.id;
    if (this.engine) this.engine.establish(eq, ev.id);
  };

  // 合同条件の選択肢（直角三角形の問題は5つ、それ以外は3つ）
  Game.prototype.conditionOptions = function () {
    return this.phase === 'qcondition' ? PH.quadConditionOrder(this.problem) : PH.conditionOrder(this.problem);
  };

  Game.prototype.selectCondition = function (id) {
    if (this.phase === 'qcondition') {
      if (this.conditionOptions().indexOf(id) < 0) return false;
      this.pcondition = id;
      return true;
    }
    if (this.phase !== 'congruence' || !PH.CONDITIONS[id] || this.conditionOptions().indexOf(id) < 0) return false;
    this.condition = id;
    return true;
  };

  // 合同条件を決定
  Game.prototype.confirmCondition = function () {
    if (this.phase === 'qcondition') return this.confirmQuadCondition();
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

  // 「詳しい理由を説明する」が使える問題か（前のステップで導く根拠がある）
  Game.prototype.canExplain = function () {
    return !!this.engine && this.partEvidence().some(function (ev) { return !!ev.fromStep; });
  };

  // そのステップを導くのに必要なステップ（自分をふくむ。dependsOn をたどる）
  Game.prototype.stepChain = function (id) {
    const out = [];
    const self = this;
    (function visit(x) {
      const s = self.engine.step(x);
      if (!s || out.indexOf(x) >= 0) return;
      out.push(x);
      (s.dependsOn || []).forEach(visit);
    })(id);
    return out;
  };

  /*
   * 「詳しい理由を説明する」：選んだ2つの要素が、前のステップで導く根拠なら、そのステップを解く段階へ。
   *   explain       … 説明のステップへ進んだ（解きおえると根拠に登録される）
   *   duplicate     … もう見つけた根拠
   *   wrong-role    … 直角三角形の問題で、今の欄に合わない
   *   not-explain   … 理由を選ぶだけで言える根拠（説明のステップはない）
   *   from-conclusion / not-common / wrong-equation / irrelevant … 根拠ではない
   */
  Game.prototype.explain = function () {
    if ((this.phase !== 'collect' && this.phase !== 'qcollect') || this.selection.length !== 2 || !this.canExplain()) return { status: 'incomplete', miss: false };
    const keys = this.selection.slice();
    const kind = keys[0].slice(0, 3) === 'ang' ? 'ang' : 'seg';
    const quad = this.phase === 'qcollect';
    const PG = PH.parallelogram;
    if (quad) this.switchVariant(keys);
    const qkey = quad ? PG.factKeyFromKeys(this.problem.figure, keys, this.relation) : null;
    const ev = quad ? PG.matchEvidence(this.problem, qkey) : PH.validation.matchEvidence(this.problem, keys);
    let r;
    if (!ev) {
      const st = quad ? PG.equationStatus(this.problem, qkey) : PH.validation.equationStatus(this.problem, keys);
      r = { status: st, miss: st !== 'irrelevant' && st !== 'alternative', kind: kind, rel: quad ? this.relation : 'eq' };
      if (st === 'alternative') r.alt = quad ? PG.altRoute(this.problem, qkey) : PH.validation.altRoute(this.problem, keys);
      if (quad && st === 'irrelevant') r.outsideQuad = !PG.isTargetRelation(this.problem, keys);   // 四角形の外の辺・角をふくむ関係（p40 の AD∥BC）
    } else if (this.partFound().indexOf(ev.id) >= 0) {
      r = { status: 'duplicate', miss: false, evidence: ev, kind: kind };
    } else if (!quad && this.isRight() && this.roleOf(ev) !== this.role) {
      r = { status: 'wrong-role', miss: false, evidence: ev, kind: kind, role: this.roleOf(ev), want: this.role };   // 欄の順番だけのちがいはミスにしない
    } else if (!ev.fromStep) {
      r = { status: 'not-explain', miss: true, evidence: ev, kind: kind };
    } else {
      this.explaining = ev.id;
      this.explainSel = keys;                       // 選んだ2つの要素（式の比較で、もう一度選ばせない）
      this.explainFrom = this.answerMode;          // もどったときの辺選択・角選択
      this.explainPart = this.part;                // もどる段階（三角形の根拠 'collect' / 平行四辺形の根拠 'qcollect'）
      this.enterSteps('pre');
      return { status: 'explain', miss: false, evidence: ev, kind: kind };
    }
    if (r.miss) this.misses++;
    this.clearSelection();
    return r;
  };

  // 説明している根拠（なければ null）
  Game.prototype.explainingEvidence = function () { return this.explaining ? this.evidenceById(this.explaining) : null; };

  // 説明をやめて根拠の収集にもどる（解きおえたステップは証明済みのまま）
  Game.prototype.cancelExplain = function () {
    if (this.phase !== 'step' || !this.explaining) return false;
    this.explaining = null;
    this.stepId = null;
    this.phase = this.explainPart === 'quad' ? 'qcollect' : 'collect';
    this.mode = this.answerMode = this.explainFrom || 'side';
    this.applyRoleMode();
    return true;
  };

  // 今解けるステップ（説明中は、その根拠を導くのに必要なステップだけ）
  Game.prototype.availableSteps = function (stage) {
    const list = this.engine.available(stage);
    const ev = stage === 'pre' ? this.explainingEvidence() : null;
    if (!ev) return list;
    const chain = this.stepChain(ev.fromStep);
    return list.filter(function (s) { return chain.indexOf(s.id) >= 0; });
  };

  // 前半（'pre'）・後半（'post'）のステップの段階に入る。解けるステップのうち最初のものを選ぶ
  Game.prototype.enterSteps = function (stage) {
    this.phase = stage === 'post' ? 'post' : 'step';
    this.mode = 'step';
    this.answerMode = 'step';
    this.clearSelection();
    this.stepId = this.availableSteps(stage)[0].id;
    this.stepChoice = null;
    this.cmpPick = {};
  };

  Game.prototype.currentStep = function () {
    return this.engine && this.stepId ? this.engine.step(this.stepId) : null;
  };

  Game.prototype.stepStage = function () { return this.phase === 'post' ? 'post' : 'pre'; };

  // 解けるステップのうち、別のものに切りかえる（独立したステップはどの順番でもよい）
  Game.prototype.selectStep = function (id) {
    if ((this.phase !== 'step' && this.phase !== 'post') || !this.availableSteps(this.stepStage()).some(function (s) { return s.id === id; })) return false;
    this.stepId = id;
    this.stepChoice = null;
    this.cmpPick = {};
    this.clearSelection();
    this.mode = 'step';
    this.answerMode = 'step';
    return true;
  };

  // 理由を選ぶステップの選択肢（正解と、その定理では言えない理由。並びは問題ごとに一定）
  //   ハンターの角の式のステップ（p23・p24・p30）は、理由ではなく「∠ACE＝∠ACD＋∠DCE＝□」の□に入る式を選ぶ（expressionOptions）
  Game.prototype.stepOptions = function (step) {
    const s = step || this.currentStep();
    return s && s.type === 'expression' ? expressionOptions(this.problem, s) : stepOptions(this.problem, s);
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
    // 「詳しい理由を説明する」で選んだ2つの角が、この比較で導く等式なら、もう一度選ばせない（決定を押すだけ）
    if (this.commonFound() && this.cmpPrefilled()) {
      this.selection = this.explainSel.slice();
      this.mode = this.answerMode = 'step';
    }
    return true;
  };

  // 式の比較の結論が、説明している根拠（最初に選んだ2つの要素）と同じか
  Game.prototype.cmpPrefilled = function () {
    const s = this.currentStep();
    const ev = this.explainingEvidence();
    if (!s || s.type !== 'compare' || !ev || !this.explainSel) return false;
    const V = PH.validation;
    const want = s.items.map(function (n) { return PH.geometry.elementKey(this.problem.figure, n); }, this);
    return V.equationKey(want[0], want[1]) === V.equationKey(this.explainSel[0], this.explainSel[1]);
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
    const next = this.availableSteps(stage);
    if (next.length) {
      this.stepId = next[0].id;
      this.stepChoice = null;
      this.cmpPick = {};
      this.mode = 'step';
    } else if (stage === 'pre') {
      // 説明のステップがすべて終わった → 説明した根拠を登録して、根拠の収集にもどる
      const ev = this.explainingEvidence();
      const quad = this.explainPart === 'quad';
      this.explaining = null;
      this.stepId = null;
      this.phase = quad ? 'qcollect' : 'collect';
      this.mode = this.answerMode = this.explainFrom || 'side';
      r.stageDone = 'pre';
      const list = this.partFound();
      if (ev && this.engine.canUse(ev) && list.indexOf(ev.id) < 0) {
        list.push(ev.id);
        this.establish(ev);
        r.registered = ev;
        this.relation = 'eq';            // 次の根拠は「＝」から（平行四辺形の根拠）
        if (list.length === this.total()) {
          this.phase = quad ? 'qcondition' : 'congruence';
          r.complete = true;
          // Ver.1.0（p50）：合同を使わない問題は、根拠がそろったら後半のステップ（二等辺三角形である）へ
          if (PH.isGoalOnly(this.problem)) { this.enterSteps('post'); r.post = true; }
        } else if (!quad && this.isRight()) {
          const self = this;
          this.role = this.roles.find(function (x) { return !self.roleFound(x); }) || null;
        }
      }
      this.applyRoleMode();
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
    this.found.concat(this.qfound).forEach(function (id) {
      const ev = self.evidenceById(id);
      if (ev.rel === 'parallel') return;         // 平行の根拠は矢印（autoParallel）
      ev.items.forEach(function (name) {
        out[PH.geometry.elementKey(fig, name)] = ev.mark;
      });
    });
    return out;
  };

  // 見つけた平行の根拠の矢印（[始点, 終点, 矢印の数]。renderer の view.parallelMarks）
  Game.prototype.autoParallel = function () {
    const self = this;
    const out = [];
    this.qfound.forEach(function (id) {
      const ev = self.evidenceById(id);
      if (ev.rel !== 'parallel') return;
      ev.items.forEach(function (s) { out.push([s[0], s[1], ev.mark || 1]); });
    });
    return out;
  };

  Game.prototype.evidenceById = function (id) {
    return this.problem.evidence.concat(this.quadEvidence()).find(function (e) { return e.id === id; }) || null;
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
  //   ステップに choices があれば、理由ではなくその式を選ぶ（先頭が正解。p41 の「EB＝AB－AE、DF＝DC－FC」）
  function stepOptions(problem, step) {
    if (!step || step.type === 'compare') return [];
    const R = PH.proofRules;
    const opts = step.choices
      ? step.choices.map(function (t, i) { return { id: i === 0 ? 'a' : 'w' + (i - 1), text: t }; })
      : [{ id: 'a', text: R.label(step.rule) }].concat((R.RULE_DISTRACTORS[step.rule] || []).slice(0, 2).map(function (t, i) {
        return { id: 'w' + i, text: t };
      }));
    const rnd = seeded(problem.id + ':' + step.id);
    for (let i = opts.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = opts[i]; opts[i] = opts[j]; opts[j] = t;
    }
    return opts;
  }

  /*
   * 角の式のステップの選択肢（ハンター）：「∠ACE＝∠ACD＋∠DCE＝□」の□に入る式（正解 id 'a'）と、
   * 定数角を取りちがえた式（60°⇔90°）・符号を取りちがえた式（＋⇔－）。並びは問題ごとに一定
   */
  function expressionOptions(problem, step) {
    const value = step.value;
    const swapped = /60°/.test(value) ? value.replace('60°', '90°') : value.replace('90°', '60°');
    const flipped = /＋/.test(value) ? value.replace('＋', '－') : value.replace('－', '＋');
    const opts = [{ id: 'a', text: value }];
    [swapped, flipped].forEach(function (t, i) { if (t !== value && !opts.some(function (o) { return o.text === t; })) opts.push({ id: 'w' + i, text: t }); });
    const rnd = seeded(problem.id + ':' + step.id + ':expr');
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
    // Ver.1.0：合同を使わない問題（p50）は、書き出し → ステップの行 → 後半のステップ（結論）
    if (PH.isGoalOnly && PH.isGoalOnly(problem)) {
      const stepNo0 = {};
      const sl = PH.proofEngine.stepsOf(problem, 'pre').map(function (s, i) {
        stepNo0[s.id] = CIRCLED[i];
        return { stepId: s.id, no: CIRCLED[i], reason: stepReasonText(s, stepNo0), equation: s.label, type: s.type };
      });
      return { goalOnly: true, intro: problem.proof.intro, lines: [], stepLines: sl, summary: '', condition: null, conclusion: null, final: null,
        post: PH.proofEngine.stepsOf(problem, 'post').map(function (s) { return { stepId: s.id, reason: stepReasonText(s, stepNo0), conclusion: s.label }; }) };
    }
    // Ver.0.9：平行四辺形だけの問題（三角形の合同の部分がない）は、平行四辺形の部分（proof.quad）だけ
    if (PH.isQuadProblem && PH.isQuadProblem(problem) && !PH.hasLemma(problem)) {
      const empty = { intro: null, lines: [], stepLines: [], summary: '', condition: null, conclusion: null, final: null, post: [] };
      empty.quad = buildQuadProof(problem, 0, null, true);
      empty.stepLines = empty.quad.stepLines;
      return empty;
    }
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
    // Ver.0.9（p35）：合同から導いた結論に番号をつけ、平行四辺形の部分へつなげる
    if (PH.isQuadProblem && PH.isQuadProblem(problem)) {
      const used = lines.length + stepLines.length;
      if (proof.final) proof.final.no = CIRCLED[used];
      proof.quad = buildQuadProof(problem, used + (proof.final ? 1 : 0), proof.final, false);
    }
    return proof;
  }

  /*
   * 平行四辺形の部分の証明文（Ver.0.9）
   *   intro（「四角形ABCDにおいて」など）/ lines（根拠の行。平行を導く根拠は「④より、錯角が等しいから」）
   *   / stepLines（平行四辺形だけの問題の、根拠を導くステップの行）/ summary（「①、②より、」）
   *   / condition（成立条件）/ conclusion（「四角形ABCDは平行四辺形である。」）
   *   start … 番号の始まり（三角形の部分の続き）、final … 合同から導いた結論（番号つき）
   */
  function buildQuadProof(problem, start, final, withSteps) {
    const pz = problem.parallelogram;
    const engine = PH.proofEngine;
    const fig = problem.figure;
    let n = start;
    const viaText = function (ev) {
      if (!ev.via || !final || !problem.finalStep) return '';
      const a = ev.via.map(function (x) { return PH.geometry.elementKey(fig, x); });
      const b = problem.finalStep.items.map(function (x) { return PH.geometry.elementKey(fig, x); });
      return PH.validation.equationKey(a[0], a[1]) === PH.validation.equationKey(b[0], b[1]) ? final.no + 'より、' : '';
    };
    // 合同から導いた結論そのもの（fromFinal）は、その番号を使う（行にはしない）
    const lines = pz.evidence.filter(function (ev) { return !ev.fromStep && !(ev.fromFinal && final); }).map(function (ev) {
      return { evidenceId: ev.id, reason: viaText(ev) + (ev.proofReason || PH.REASONS[ev.reason].proof), equation: ev.label, no: CIRCLED[n++], rel: ev.rel || 'eq' };
    });
    const stepNo = {};
    const stepLines = [];
    if (withSteps && engine && engine.hasSteps(problem)) {
      engine.stepsOf(problem, 'pre').forEach(function (s) {
        const no = CIRCLED[n++];
        stepNo[s.id] = no;
        stepLines.push({ stepId: s.id, no: no, reason: stepReasonText(s, stepNo), equation: s.label, type: s.type });
      });
    }
    const nums = pz.evidence.map(function (ev) {
      if (ev.fromStep) return stepNo[ev.fromStep];
      if (ev.fromFinal && final) return final.no;
      return lines.find(function (l) { return l.evidenceId === ev.id; }).no;
    });
    // Ver.1.0：「4つの辺（角）がすべて等しい」問題は、番号の小さい順に「①、②、⑥より、」
    if (pz.chain) nums.sort(function (a, b) { return CIRCLED.indexOf(a) - CIRCLED.indexOf(b); });
    return {
      intro: pz.intro.slice(),
      lines: lines,
      stepLines: stepLines,
      summary: nums.join('、') + 'より、',
      chain: pz.chain || null,                    // Ver.1.0：「AB＝BC＝CD＝DA」（4つの辺・角がすべて等しいことの確認）
      condition: PH.quadCondition(pz.condition).label,
      conclusion: problem.conclusion + 'である。',
    };
  }

  // ステップの行の理由の書き方（proofText があればそれを使う。{s1} はそのステップの番号）
  function stepReasonText(s, stepNo) {
    const R = PH.proofRules;
    if (s.proofText) return s.proofText.replace(/\{(\w+)\}/g, function (_, id) { return stepNo[id] || ''; });
    if (s.type === 'compare') return (s.dependsOn || []).map(function (d) { return stepNo[d]; }).join('、') + 'より、';
    if (s.type === 'expression') return R.label(s.rule) + '（' + s.premiseLabel + '）、';
    return s.premiseLabel + 'より、' + R.label(s.rule) + '、';
  }

  PH.Game = Game;
  PH.calcStars = calcStars;
  PH.buildProof = buildProof;
  PH.stepOptions = stepOptions;
  PH.expressionOptions = expressionOptions;
  PH.stepReasonText = stepReasonText;
  PH.buildQuadProof = buildQuadProof;

  if (typeof module !== 'undefined' && module.exports) module.exports = { Game: Game, calcStars: calcStars };
})(typeof window !== 'undefined' ? window : globalThis);
