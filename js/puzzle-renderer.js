/*
 * puzzle-renderer.js — 証明パズルのプレイ画面（DOM・イベント・演出）
 *
 * 状態は PH.Puzzle（puzzle.js）が持ち、この画面は操作を渡して描画し直すだけにする。
 * 操作はすべてタップ：空欄をタップ → 下のカードをタップすると入る → 次の空欄へ自動で進む。
 * 図形の描画は既存の PH.renderer を使う。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const doc = root.document;
  const PLACEHOLDER = {
    eq: '等式を選ぶ', reason: '理由を選ぶ', cond: '合同条件を選ぶ', input: '等式を入力',
    // Ver.0.5：三角形の選択・最終結論
    tripair: '三角形の組を選ぶ', tri1: '三角形を選ぶ', tri2: '対応する三角形を選ぶ', tri: '三角形を入力',
    freason: '理由を選ぶ', final: '結論を選ぶ', finalInput: '結論の等式を入力',
    // Ver.0.7：多段階証明のステップ
    srule: '理由を選ぶ', cmc: '共通な部分を選ぶ', cmp: '比べる式を選ぶ', cmr: '導ける等式を選ぶ', cmrInput: '導ける等式を入力',
    // Ver.0.8：直角三角形の直角である理由
    rreason: '直角の理由を選ぶ',
  };
  const KIND_NAME = { eq: '等式', reason: '理由', cond: '合同条件', tripair: '三角形の組', tri1: '三角形', tri2: '三角形', freason: '理由', final: '結論の等式',
    srule: '理由', cmc: '共通な部分', cmp: '比べる2つの式', cmr: '導ける等式', rreason: '理由' };
  // 空欄の種類（ステップの空欄は 'srule:s1' のように問題のステップIDがつくので、前の部分だけ）
  function kindOf(s) { return String(s.kind).split(':')[0]; }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function starsText(n) {
    return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
  }

  // ---------------------------------------------------------------------

  function PuzzleView(container, problem, nav) {
    this.root = container;
    this.problem = problem;
    this.nav = nav;
    // 解答レベル（おてがる／スタンダード／チャレンジ）。記録はレベルごとに別々
    this.level = PH.getPuzzleLevel(PH.storage.getPuzzleLevel());
    this.recordMode = 'puzzle:' + this.level.id;
    this.puzzle = new PH.Puzzle(problem, this.level.type);
    this.drafts = {};           // チャレンジ：等式の空欄ごとの入力途中の内容（キーパッド）。図を開いても消えない
    this.flashKeys = [];
    this.flashLines = [];
    this.flashTimer = null;
    this.timers = [];
    this.resultBuilt = false;
    this.stageCleared = false;
    this.trayOpen = false;      // カードの領域（解答欄をタップしたときだけ出す）
    this.userMarks = {};        // 生徒がつけた印（要素キー → 本数）。答え合わせには使わない
    this.markTool = { kind: 'seg', n: 1 };
    this.markMode = 'mark';     // 'mark'（印をつける）/ 'erase'（消す）
    this.markOpen = false;
    this.build();
    this.onClick = this.handleClick.bind(this);
    this.onResize = function () { this.renderFigure(); if (this.markOpen) this.renderMarkFigure(); }.bind(this);
    this.onKey = this.handleKey.bind(this);
    this.onPaste = this.handlePaste.bind(this);
    doc.addEventListener('keydown', this.onKey);
    doc.addEventListener('paste', this.onPaste);
    this.root.addEventListener('click', this.onClick);
    root.addEventListener('resize', this.onResize);
    PH.storage.setLastProblem(problem.id, 'puzzle');
    this.render();
  }

  PuzzleView.prototype.ref = function (name) {
    return this.root.querySelector('[data-ref="' + name + '"]');
  };

  PuzzleView.prototype.build = function () {
    const p = this.problem;
    this.root.innerHTML =
      '<header class="play-header">' +
        '<button class="head-btn" data-act="home" aria-label="ホームに戻る"><span class="ico">⌂</span><span class="lbl">ホーム</span></button>' +
        '<div class="play-title"><span class="play-no">証明パズル ・ 問題' + esc(p.number) + '</span><span class="play-name">' + esc(p.title) + '</span></div>' +
        '<button class="pz-level-badge pz-level-' + this.level.id + '" data-act="change-level" aria-label="解答レベル：' + this.level.label + '（変更する）">' +
          esc(this.level.label) + '<span class="pz-level-chg">変更</span></button>' +
        '<button class="head-btn head-hint" data-act="hint" aria-label="ヒント"><span class="ico">💡</span><span class="lbl">ヒント</span></button>' +
      '</header>' +
      '<div class="pz-body" data-ref="body">' +
        '<div class="pz-top">' +
          '<button class="card figure-card pz-figure" data-act="open-marks" aria-label="図を大きくして印をつける">' +
            '<svg class="figure" data-ref="svg" aria-hidden="true"></svg>' +
            '<span class="pz-fig-badge" aria-hidden="true">✏️</span>' +
          '</button>' +
          '<div class="card statement pz-cond">' +
            '<div class="cond-row"><span class="tag tag-given">仮定</span><span class="cond-text">' + p.given.map(esc).join('、') + '</span></div>' +
            '<div class="cond-row"><span class="tag tag-goal">結論</span><span class="cond-text">' + esc(p.conclusion) + '</span></div>' +
          '</div>' +
        '</div>' +
        '<div class="pz-scroll" data-ref="scroll">' +
          '<p class="pz-statement">' + esc(p.statement) + '</p>' +
          '<div class="card proof-sheet pz-proof" data-ref="proof"></div>' +
          '<div class="pz-checkbar" data-ref="checkbar">' +
            '<div class="pz-feedback" data-ref="feedback" aria-live="polite"></div>' +
            '<div class="pz-actions">' +
              '<button class="btn" data-act="reset">すべてリセット</button>' +
              '<button class="btn btn-confirm" data-act="check" data-ref="checkBtn">答え合わせ</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        // カードの領域：解答欄をタップしたときだけ出し、カードを選ぶと隠す
        '<div class="card pz-tray" data-ref="tray" hidden>' +
          '<div class="pz-tray-head"><div class="pz-tray-title" data-ref="trayHead"></div>' +
            '<button class="pz-tray-close" data-act="close-tray" aria-label="閉じる">×</button></div>' +
          '<div class="pz-cards" data-ref="cards"></div>' +
        '</div>' +
      '</div>' +
      '<div class="result" data-ref="result" hidden></div>' +
      // 図に印をつけるウィンドウ（閉じると、つけた印が問題の図に反映される）
      '<div class="pz-modal" data-ref="markModal" role="dialog" aria-modal="true" aria-label="図に印をつける" hidden>' +
        '<div class="card pz-modal-box">' +
          '<div class="pz-modal-head"><span class="pz-modal-title">✏️ 図に印をつける</span>' +
            '<button class="pz-tray-close" data-act="close-marks" aria-label="閉じる">×</button></div>' +
          '<div class="pz-modal-fig" data-ref="markFigWrap"><svg class="figure" data-ref="markSvg" role="group" aria-label="印をつける図"></svg></div>' +
          '<div class="pz-modal-tools" data-ref="markTools"></div>' +
          '<p class="pz-modal-note">印は考えを整理するための下書きで、答え合わせには関係しないよ。</p>' +
          '<div class="pz-modal-actions">' +
            '<button class="btn" data-act="clear-marks">印をすべて消す</button>' +
            '<button class="btn btn-primary" data-act="close-marks">閉じる</button>' +
          '</div>' +
        '</div>' +
      '</div>';
  };

  PuzzleView.prototype.destroy = function () {
    this.root.removeEventListener('click', this.onClick);
    root.removeEventListener('resize', this.onResize);
    doc.removeEventListener('keydown', this.onKey);
    doc.removeEventListener('paste', this.onPaste);
    clearTimeout(this.flashTimer);
    this.timers.forEach(clearTimeout);
    PH.hints.hide(doc.getElementById('hint-popup'));
    const ov = doc.getElementById('success-overlay');
    if (ov) { ov.hidden = true; ov.classList.remove('show'); }
    this.root.innerHTML = '';
  };

  PuzzleView.prototype.later = function (fn, ms) {
    this.timers.push(setTimeout(fn, ms));
  };

  // ---- 入力 -------------------------------------------------------------

  PuzzleView.prototype.handleClick = function (e) {
    if (this.markOpen && e.target === this.ref('markModal')) return this.setMarks(false);   // 外側をタップで閉じる
    const t = e.target.closest('[data-key],[data-mark-tool],[data-kp],[data-slot],[data-card],[data-act],[data-ev],[data-proof-reason],[data-fact]');
    if (!t || t.disabled) return;
    if (t.hasAttribute('data-kp')) return this.keypadAction(t.getAttribute('data-kp'));
    if (t.hasAttribute('data-key')) return this.tapMarkFromFigure(t, e.clientX, e.clientY);
    if (t.hasAttribute('data-mark-tool')) return this.selectMarkTool(t.getAttribute('data-mark-tool'));
    if (t.hasAttribute('data-slot')) return this.selectSlot(t.getAttribute('data-slot'));
    if (t.hasAttribute('data-card')) return this.placeCard(t.getAttribute('data-card'));
    if (t.hasAttribute('data-ev')) return this.showEvidence(t.getAttribute('data-ev'), false);
    if (t.hasAttribute('data-fact')) return this.showFact(t.getAttribute('data-fact'));
    if (t.hasAttribute('data-proof-reason')) return this.showEvidence(t.getAttribute('data-proof-reason'), true);
    switch (t.getAttribute('data-act')) {
      case 'home': return this.nav.home();
      case 'stages': return this.nav.stages();
      case 'next': return this.nav.next();
      case 'next-stage': return this.nav.nextStage();
      case 'hint': return this.hint();
      case 'close-tray': return this.setTray(false);
      case 'open-marks': return this.setMarks(true);
      case 'close-marks': return this.setMarks(false);
      case 'clear-marks': return this.clearMarks();
      case 'reset': return this.resetCards();
      case 'check': return this.check();
      case 'restart': return this.restart();
      case 'change-level': return this.changeLevel();
      case 'final-flash': return this.flashFinal();
    }
  };

  // 完成した証明のステップの行のタップ：その式・等式の辺・角を光らせる
  PuzzleView.prototype.showFact = function (id) {
    const st = (this.problem.proofSteps || []).find(function (x) { return x.id === id; });
    if (!st) return;
    PH.sound.play('tap');
    this.flash(PH.stepKeys(this.problem, st), 1600);
  };

  // 完成した証明の最終結論のタップ：結論の辺・角を光らせる
  PuzzleView.prototype.flashFinal = function () {
    const p = this.problem;
    PH.sound.play('tap');
    this.flash(p.finalStep.items.map(function (n) { return PH.geometry.elementKey(p.figure, n); }), 1600);
  };

  // ---- チャレンジ：数学キーパッド --------------------------------------------------

  PuzzleView.prototype.activeInputSlot = function () {
    const s = this.puzzle.slot(this.puzzle.active);
    return s && s.input ? s : null;
  };

  // 空欄ごとの入力途中の内容。決定ずみの等式があれば読み込む
  PuzzleView.prototype.draftFor = function (slotId) {
    if (!this.drafts[slotId]) {
      const z = this.puzzle;
      // 三角形の欄は三角形だけ（図の上の三角形でなければ決定できない）、等式の欄は辺・角の等式
      const kp = PH.mathKeypad.create(z.letters, { kinds: z.inputKinds(slotId), isTriangle: z.isTriangle.bind(z) });
      if (this.puzzle.inputs[slotId]) kp.load(this.puzzle.inputs[slotId]);
      this.drafts[slotId] = kp;
    }
    return this.drafts[slotId];
  };

  PuzzleView.prototype.keypadAction = function (action) {
    const s = this.activeInputSlot();
    if (!s || !this.trayOpen) return;
    const kp = this.draftFor(s.id);
    let ok = false;
    if (action === 'toggle') ok = kp.toggleKind();      // 辺⇔角の切りかえは、その空欄の入力をリセットする
    else if (action.indexOf('key:') === 0) ok = kp.press(action.slice(4));
    else if (action === 'eq') ok = kp.pressEq();
    else if (action === 'back') ok = kp.backspace();
    else if (action === 'clear') { ok = !kp.isEmpty(); kp.clear(); }
    else if (action === 'decide') return this.decideInput();
    if (ok) PH.sound.play('tap');
    this.render();
  };

  // 決定：等式を空欄に入れて、キーパッドを閉じる（形式が不完全なら決定できない）
  PuzzleView.prototype.decideInput = function () {
    const s = this.activeInputSlot();
    if (!s) return;
    const kp = this.draftFor(s.id);
    if (!kp.complete()) return;
    if (this.puzzle.setInput(kp.value())) {
      PH.sound.play('tap');
      this.setTray(false);
    }
  };

  // PCのキーボード：A〜Z・=・Backspace・Enter・Esc（キーパッドが開いているとき）
  PuzzleView.prototype.handleKey = function (e) {
    if (PH.chooser.isOpen()) return;
    if (e.key === 'Escape') {
      if (this.markOpen) return this.setMarks(false);
      if (this.trayOpen) return this.setTray(false);
      return;
    }
    const s = this.activeInputSlot();
    if (!s || !this.trayOpen || this.markOpen || e.ctrlKey || e.metaKey || e.altKey) return;
    const kp = this.draftFor(s.id);
    const key = e.key;
    if (/^[a-zA-Z]$/.test(key)) {
      if (!kp.kind) kp.setKind(kp.kinds[0]);
      if (kp.press(key.toUpperCase())) PH.sound.play('tap');
    } else if (key === '=' || key === '＝') {
      kp.pressEq();
    } else if (key === '<' || key === '∠') {
      if (kp.kind !== 'ang') kp.setKind('ang');
    } else if (key === 'Backspace') {
      kp.backspace();
    } else if (key === 'Enter') {
      e.preventDefault();
      return this.decideInput();
    } else {
      return;
    }
    e.preventDefault();
    this.render();
  };

  // 貼り付け：正しい形式の等式だけを受け付ける（不正な文字列は無視）
  PuzzleView.prototype.handlePaste = function (e) {
    const s = this.activeInputSlot();
    if (!s || !this.trayOpen || this.markOpen) return;
    const text = e.clipboardData && e.clipboardData.getData('text');
    const kp = this.draftFor(s.id);
    if (text && kp.load(text)) {
      e.preventDefault();
      this.render();
    }
  };

  // ---- 解答レベルの変更（プレイ中） ---------------------------------------------------

  PuzzleView.prototype.changeLevel = function () {
    const self = this;
    const others = PH.PUZZLE_LEVELS.filter(function (l) { return l.id !== self.level.id; });
    PH.chooser.open({
      title: '解答レベルを変更する',
      message: '解答形式を変更すると、今の解答内容はリセットされます。変更しますか？',
      options: others.map(function (l) { return { value: l.id, label: l.label }; }),
      textOptions: true,
      onChoose: function (id) {
        PH.storage.setPuzzleLevel(id);
        self.nav.reload();       // 新しい形式で最初から（ミス・ヒント・印もリセット。保存ずみの最高評価は変わらない）
      },
    });
  };

  // ---- 図に印をつける（拡大ウィンドウ） ----------------------------------------

  PuzzleView.prototype.setMarks = function (open) {
    this.markOpen = !!open;
    const modal = this.ref('markModal');
    if (!modal) return;
    modal.hidden = !this.markOpen;
    if (this.markOpen) {
      this.reopenTray = this.trayOpen;
      this.trayOpen = false;
      PH.hints.hide(doc.getElementById('hint-popup'));
      PH.sound.play('tap');
      this.render();
      this.renderMarkTools();
      this.renderMarkFigure();
    } else {
      this.renderFigure();       // 閉じたら、つけた印を問題の図に反映
      if (this.reopenTray) { this.reopenTray = false; this.setTray(true); }
    }
  };

  PuzzleView.prototype.selectMarkTool = function (v) {
    if (v === 'erase') {
      this.markMode = this.markMode === 'erase' ? 'mark' : 'erase';
    } else {
      const parts = v.split(':');
      this.markTool = { kind: parts[0], n: Number(parts[1]) };
      this.markMode = 'mark';
    }
    PH.sound.play('tap');
    this.renderMarkTools();
    this.renderMarkFigure();
  };

  // 印つけはハンターモードと同じ：選んだ種類（辺／角）の要素だけに、選んだ本数の印。同じ印をもう一度で外す
  PuzzleView.prototype.tapMarkElement = function (key) {
    if (!this.markOpen || !key) return;
    const el = PH.geometry.getElements(this.problem.figure).byKey[key];
    if (!el) return;
    if (this.markMode === 'erase') {
      if (this.userMarks[key] == null) return;
      delete this.userMarks[key];
    } else {
      if (el.kind !== this.markTool.kind) return;
      if (this.userMarks[key] === this.markTool.n) delete this.userMarks[key];
      else this.userMarks[key] = this.markTool.n;
    }
    PH.sound.play('tap');
    this.renderMarkFigure();
  };

  PuzzleView.prototype.clearMarks = function () {
    this.userMarks = {};
    PH.sound.play('tap');
    this.renderMarkFigure();
  };

  /*
   * 図のタップが指しうる要素の候補（geometry.segmentCandidates / angleCandidates）。
   * 線分ACの上に点Bがあり AC・AB の両方が選べるときなど、候補が2つ以上なら
   * 「どちらに〜？」のポップアップ（PH.chooser）で選んでもらう。
   */
  PuzzleView.prototype.tapCandidates = function (target, clientX, clientY) {
    const key = target.getAttribute('data-key');
    const svg = this.ref('markSvg');
    const ctm = svg && svg.getScreenCTM && svg.getScreenCTM();
    if (!ctm || clientX == null) return [key];
    const q = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const fig = this.problem.figure;
    const list = target.classList.contains('hit-seg')
      ? PH.geometry.segmentCandidates(fig, q)
      : PH.geometry.angleCandidates(fig, q, this.markMode === 'mark' && this.markTool.kind === 'ang');
    return list.length ? list : [key];
  };

  PuzzleView.prototype.tapMarkFromFigure = function (target, clientX, clientY) {
    const self = this;
    let list = this.tapCandidates(target, clientX, clientY);
    if (this.markMode === 'erase') {
      const marked = list.filter(function (k) { return self.userMarks[k] != null; });
      if (marked.length) list = marked;
    }
    if (list.length <= 1) return this.tapMarkElement(list[0]);
    const byKey = PH.geometry.getElements(this.problem.figure).byKey;
    PH.chooser.open({
      title: this.markMode === 'erase' ? 'どちらの印を消しますか？' : 'どちらに印をつけますか？',
      options: list.map(function (k) { return { value: k, label: byKey[k].display }; }),
      onChoose: function (k) { self.tapMarkElement(k); },
    });
  };

  PuzzleView.prototype.renderMarkTools = function () {
    const self = this;
    const btn = function (kind, n) {
      const on = self.markMode === 'mark' && self.markTool.kind === kind && self.markTool.n === n;
      return '<button class="tool-mark" data-mark-tool="' + kind + ':' + n + '" aria-pressed="' + on + '" aria-label="' +
        (kind === 'seg' ? '辺の印 ' + n + '本線' : '角の印 円弧' + n + '本') + '">' + PH.markToolIcon(kind, n) + '</button>';
    };
    const tools = PH.MARK_TOOLS;
    this.ref('markTools').innerHTML =
      '<div class="palette-row"><span class="palette-label">辺の印</span>' +
        tools.filter(function (t) { return t[0] === 'seg'; }).map(function (t) { return btn('seg', t[1]); }).join('') + '</div>' +
      '<div class="palette-row"><span class="palette-label">角の印</span>' +
        tools.filter(function (t) { return t[0] === 'ang'; }).map(function (t) { return btn('ang', t[1]); }).join('') +
        '<button class="tool-mark tool-erase" data-mark-tool="erase" aria-pressed="' + (this.markMode === 'erase') + '">🧽 消す</button>' +
      '</div>' +
      '<p class="pz-modal-guide">' + (this.markMode === 'erase'
        ? '消したい印がついた辺や角をタップしよう。'
        : (this.markTool.kind === 'seg' ? '印をつけたい辺をタップしよう。' : '印をつけたい角の内側をタップしよう。')) + '</p>';
  };

  PuzzleView.prototype.renderMarkFigure = function () {
    const svg = this.ref('markSvg');
    if (!svg || !this.markOpen) return;
    const wrap = this.ref('markFigWrap');
    wrap.className = 'pz-modal-fig mode-' + (this.markMode === 'erase' ? 'erase' : 'mark');
    PH.renderer.render(svg, this.problem, {
      userMarks: this.userMarks,
      interactive: true,
      // 印をつけるときは選んだ種類だけ、消すときは辺と角の両方がタップに反応する
      hit: this.markMode === 'erase' ? { seg: true, ang: true }
        : { seg: this.markTool.kind === 'seg', ang: this.markTool.kind === 'ang' },
    });
  };

  // カードの領域の表示・非表示
  PuzzleView.prototype.setTray = function (open) {
    this.trayOpen = !!open;
    this.render();
    if (this.trayOpen) this.revealActive();
  };

  // 解答欄をタップ → その空欄を選び、カードの領域を出す
  PuzzleView.prototype.selectSlot = function (id) {
    if (this.puzzle.selectSlot(id)) {
      PH.sound.play('tap');
      PH.hints.hide(doc.getElementById('hint-popup'));
      this.setTray(true);
    }
  };

  // カードを選ぶ → 空欄に入れて、カードの領域を隠す（選択は次の空欄へ進む）
  PuzzleView.prototype.placeCard = function (id) {
    if (this.puzzle.place(id)) {
      PH.sound.play('tap');
      this.setTray(false);
    }
  };

  PuzzleView.prototype.resetCards = function () {
    if (this.puzzle.clearAll()) {
      PH.sound.play('tap');
      this.drafts = {};
      this.trayOpen = false;
      this.render();
      this.ref('scroll').scrollTop = 0;
    }
  };

  PuzzleView.prototype.restart = function () {
    this.puzzle.reset();
    this.resultBuilt = false;
    this.stageCleared = false;
    this.flashKeys = [];
    this.flashLines = [];
    this.trayOpen = false;
    this.drafts = {};
    this.userMarks = {};
    this.setMarks(false);
    PH.hints.hide(doc.getElementById('hint-popup'));
    PH.storage.setLastProblem(this.problem.id, 'puzzle');
    this.render();
    root.scrollTo(0, 0);
    this.ref('scroll').scrollTop = 0;
  };

  // 選択中の空欄が証明文の領域に見えるようにする（ページ全体は動かさない）
  PuzzleView.prototype.revealActive = function () {
    const sc = this.ref('scroll');
    const el = this.root.querySelector('.pz-blank.is-active');
    if (!sc || !el) return;
    if (sc.scrollHeight <= sc.clientHeight) {
      // 証明文が独立してスクロールしない画面（スマホ横向き・PCなど）：
      // ページ全体を動かして、選んだ空欄を画面の下のカード・キーパッドより上に見せる
      const tray = this.ref('tray');
      const r = el.getBoundingClientRect();
      const fixedTray = tray && !tray.hidden && root.getComputedStyle(tray).position === 'fixed';
      // シートは下からすべり出るアニメーション中なので、位置ではなく高さから計算する
      const bottomLimit = fixedTray ? root.innerHeight - tray.offsetHeight - 8 : root.innerHeight - 8;
      if (r.bottom > bottomLimit) root.scrollBy(0, r.bottom - bottomLimit);
      else if (r.top < 64) root.scrollBy(0, r.top - 64);
      return;
    }
    const top = el.offsetTop - sc.offsetTop;
    if (top < sc.scrollTop + 8) sc.scrollTop = Math.max(0, top - 8);
    else if (top + el.offsetHeight > sc.scrollTop + sc.clientHeight - 8) sc.scrollTop = top + el.offsetHeight - sc.clientHeight + 8;
  };

  PuzzleView.prototype.flash = function (keys, ms, lines) {
    const self = this;
    this.flashKeys = keys.slice();
    this.flashLines = (lines || []).slice();
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(function () {
      self.flashKeys = [];
      self.flashLines = [];
      self.renderFigure();
    }, ms || 1400);
    this.renderFigure();
  };

  // 完成した証明の式・理由のタップ：辺・角を光らせ、平行線の理由なら平行線も光らせる
  PuzzleView.prototype.showEvidence = function (id, withReason) {
    const p = this.problem;
    const ev = p.evidence.find(function (e) { return e.id === id; });
    if (!ev) return;
    const keys = ev.items.map(function (n) { return PH.geometry.elementKey(p.figure, n); });
    let lines = [];
    if (withReason && (ev.reason === 'alternate' || ev.reason === 'corresponding')) {
      const group = ev.parallelGroup || 1;
      lines = PH.geometry.parallelLines(p.figure)
        .filter(function (pl) { return pl.group === group; })
        .map(function (pl) { return [pl.from, pl.to]; });
    }
    PH.sound.play('tap');
    this.flash(keys, 1600, lines);
  };

  PuzzleView.prototype.hint = function () {
    const z = this.puzzle;
    if (z.phase !== 'play') return;
    const h = z.useHint();
    PH.sound.play('tap');
    PH.hints.show(doc.getElementById('hint-popup'), h, z.hintsUsed);
    this.trayOpen = false;
    if (h) {
      if (h.slotId) z.selectSlot(h.slotId);
      if (h.focus.length) this.flash(h.focus, 1800);
    }
    this.render();
    this.revealActive();
  };

  PuzzleView.prototype.check = function () {
    const z = this.puzzle;
    const r = z.check();
    if (r.status === 'incomplete' || r.status === 'done') return;
    this.trayOpen = false;
    if (r.status === 'wrong') {
      PH.sound.play('wrong');
      this.render();
      const bar = this.ref('checkbar');
      bar.classList.remove('shake');
      void bar.offsetWidth;
      bar.classList.add('shake');
      return;
    }
    PH.sound.play('success');
    PH.hints.hide(doc.getElementById('hint-popup'));
    const stageBefore = PH.storage.stageStats(this.problem.stage, this.recordMode).complete;
    const saved = PH.storage.recordClear(this.problem.id, z.stars, z.misses, this.recordMode);
    this.improved = saved.improved;
    this.lowered = saved.lowered || [];
    this.stageCleared = !stageBefore && PH.storage.stageStats(this.problem.stage, this.recordMode).complete;
    this.showSuccess();
    this.render();
    root.scrollTo(0, 0);
  };

  PuzzleView.prototype.showOverlay = function (title, sub, cls) {
    const ov = doc.getElementById('success-overlay');
    if (!ov) return;
    ov.querySelector('.success-text').textContent = title;
    ov.querySelector('.success-concl').textContent = sub;
    ov.className = 'success-overlay ' + (cls || '');
    ov.hidden = false;
    void ov.offsetWidth;
    ov.classList.add('show');
  };

  PuzzleView.prototype.showSuccess = function () {
    const self = this;
    const ov = doc.getElementById('success-overlay');
    if (!ov) return;
    this.showOverlay('証明パズル完成！', this.problem.conclusion, 'is-puzzle');
    if (this.stageCleared) {
      const st = PH.getStage(this.problem.stage);
      this.later(function () {
        PH.sound.play('success');
        self.showOverlay('STAGE CLEAR！', 'STAGE ' + st.id + '「' + st.title + '」', 'is-stage');
      }, 1900);
      this.later(function () { ov.classList.remove('show'); ov.hidden = true; }, 4100);
    } else {
      this.later(function () { ov.classList.remove('show'); ov.hidden = true; }, 2000);
    }
  };

  // ---- 描画 -------------------------------------------------------------

  PuzzleView.prototype.render = function () {
    const z = this.puzzle;
    const clear = z.phase === 'clear';
    this.ref('body').hidden = clear;
    this.ref('result').hidden = !clear;
    this.root.querySelectorAll('.head-hint').forEach(function (b) { b.disabled = clear; });
    if (clear) {
      if (!this.resultBuilt) this.buildResult();
      this.renderFigure();
      return;
    }
    this.renderProof();
    this.renderTray();
    this.renderFigure();
  };

  PuzzleView.prototype.renderFigure = function () {
    const svg = this.puzzle.phase === 'clear' ? this.ref('miniSvg') : this.ref('svg');
    if (!svg) return;
    const clear = this.puzzle.phase === 'clear';
    const marks = {};
    if (clear) {
      // 完成したら、根拠の辺・角に等しいことを表す印をつける
      const fig = this.problem.figure;
      this.problem.evidence.forEach(function (ev) {
        ev.items.forEach(function (n) { marks[PH.geometry.elementKey(fig, n)] = ev.mark; });
      });
    }
    PH.renderer.render(svg, this.problem, {
      flash: this.flashKeys, flashLines: this.flashLines, autoMarks: marks,
      userMarks: clear ? {} : this.userMarks,
      triangles: clear, interactive: false,
    });
  };

  PuzzleView.prototype.blank = function (slotId) {
    const z = this.puzzle;
    const s = z.slot(slotId);
    const card = z.cardIn(slotId);
    const status = z.result && z.result.slotStatus[slotId];
    const cls = ['pz-blank', 'kind-' + s.kind];
    if (s.input) cls.push('is-input');
    if (z.active === slotId) cls.push('is-active');
    if (card) cls.push('is-filled');
    if (status === 'ng') cls.push('is-ng');
    if (status === 'ok') cls.push('is-ok');
    const k = kindOf(s);
    let text = card ? card.text : PLACEHOLDER[s.input ? (s.inputKind === 'tri' ? 'tri' : k === 'final' ? 'finalInput' : k === 'cmr' ? 'cmrInput' : 'input') : k];
    const draft = s.input && this.drafts[slotId];
    if (draft && draft.kind && !draft.isEmpty() && draft.value() !== z.inputs[slotId]) {
      cls.push('is-draft');
      text = draft.display() + '（入力中）';
    }
    return '<button class="' + cls.join(' ') + '" data-slot="' + slotId + '" aria-label="' + esc(s.label) + '">' +
      esc(text) + '</button>';
  };

  PuzzleView.prototype.renderProof = function () {
    const z = this.puzzle;
    const p = this.problem;
    const proof = PH.buildProof(p);
    const self = this;
    let rows;
    if (z.right) {
      // Ver.0.8：直角三角形の問題は、行ごとに役割（直角・斜辺・他の1辺／鋭角）を表示する。直角の行の等式は表示済み
      const RT = PH.rightTriangle;
      rows = z.rowEv.map(function (ev, i) {
        const role = z.rowRoles[i];
        const reason = z.buildLike ? self.blank('r' + i) : '<span class="pz-fixed-reason">' + esc(z.rowReason(i).text) + '</span>';
        const eq = role === 'right' ? '<span class="pz-step-eq pz-right-eq">' + esc(PH.evidenceText(ev)) + '</span>' : self.blank(z.eqSlotId(i));
        return '<li class="pz-row pz-rolerow"><span class="pz-row-no pz-role role-' + role + '">' + RT.ROLE_LABEL[role] + '</span>' +
          '<div class="pz-row-body">' + reason +
          '<div class="pz-eqline">' + eq + '<span class="pl-no">……' + proof.lines[i].no + '</span></div></div></li>';
      }).join('');
    } else if (z.buildLike) {
      rows = z.rowEv.map(function (_, i) {
        return '<li class="pz-row"><span class="pz-row-no">根拠' + proof.lines[i].no + '</span>' +
          '<div class="pz-row-body">' + self.blank('r' + i) +
          '<div class="pz-eqline">' + self.blank('e' + i) + '<span class="pl-no">……' + proof.lines[i].no + '</span></div></div></li>';
      }).join('');
    } else {
      rows = z.slots.filter(function (s) { return s.kind === 'eq'; }).map(function (s, i) {
        return '<li class="pz-row"><span class="pz-fixed-reason">' + esc(s.fixed.text) + '</span>' +
          '<div class="pz-eqline">' + self.blank(s.id) + '<span class="pl-no">……' + proof.lines[i].no + '</span></div></li>';
      }).join('');
    }
    // 結論が辺・角の等しさの問題（Ver.0.5）：「△＿と△＿において」を空欄にし、
    // 合同の行は生徒が選んだ三角形で表示（STEP 1 の答えを見せない）、最後に結論の空欄
    let intro = '<p class="proof-intro">' + esc(proof.intro) + '</p>';
    let concl = '<p class="proof-concl">' + esc(proof.conclusion) + '</p>';
    if (z.hasFinal) {
      intro = '<div class="pz-introline">' +
        (z.type === 'build' ? this.blank('t1') + '<span>と</span>' + this.blank('t2') : this.blank('tri')) +
        '<span>において</span></div>';
      const ans = z.triangleAnswer();
      concl = '<p class="proof-concl is-mid">' + (ans ? esc('△' + ans[0].join('') + '≡△' + ans[1].join('')) : '△＿＿＿≡△＿＿＿') + '</p>' +
        '<div class="proof-final">' +
          '<p class="proof-final-lead">したがって、</p>' +
          (z.type === 'fill'
            ? '<p class="proof-final-reason"><span class="pz-fixed-reason">' + esc(z.slot('fe').fixed.text) + '、</span></p>'
            : '<div class="pz-finalline">' + this.blank('fr') + '<span>、</span></div>') +
          '<div class="pz-finalline">' + this.blank('fe') + '</div>' +
        '</div>';
    }
    // Ver.0.7：多段階証明のステップ（根拠の行の続き。後半のステップは最後）
    const steps = proof.stepLines.map(function (l) { return self.stepRow(z.preSteps.find(function (x) { return x.id === l.stepId; }), l.no, proof); }).join('');
    const post = z.postSteps.map(function (st) { return self.stepRow(st, '', proof); }).join('');
    this.ref('proof').innerHTML =
      intro +
      '<ol class="pz-lines">' + rows + steps + '</ol>' +
      '<p class="proof-sum">' + esc(proof.summary) + '</p>' +
      '<div class="pz-condline">' + this.blank('cond') + '<span>ので、</span></div>' +
      concl + (post ? '<ol class="pz-lines pz-post">' + post + '</ol>' : '');
  };

  // ステップの行：定理（「AB＝ACより、【理由】 ∠ABC＝∠ACB」）・角の式（「【理由】（△DCEは正三角形）、∠ACE＝…」）・式の比較
  PuzzleView.prototype.stepRow = function (st, no, proof) {
    const z = this.puzzle;
    const self = this;
    const numOf = function (id) { const l = proof.stepLines.find(function (x) { return x.stepId === id; }); return l ? l.no : ''; };
    const tail = no ? '<span class="pl-no">……' + no + '</span>' : '';
    let body;
    if (st.type === 'theorem') {
      body = '<p class="pz-step-lead">' + esc(st.premiseLabel) + 'より、</p>' + this.blank('st:' + st.id) +
        '<div class="pz-eqline"><span class="pz-step-eq">' + esc(st.label) + '</span>' + tail + '</div>';
    } else if (st.type === 'expression') {
      body = '<div class="pz-finalline">' + this.blank('st:' + st.id) + '<span>（' + esc(st.premiseLabel) + '）、</span></div>' +
        '<div class="pz-eqline"><span class="pz-step-eq">' + esc(st.label) + '</span>' + tail + '</div>';
    } else if (z.type === 'fill') {
      // おてがる：2つの式の共通部分を選ぶ。結論は自動で表示
      body = '<div class="pz-finalline"><span>' + st.dependsOn.map(numOf).join('と') + 'で同じ部分：</span>' + this.blank('cc:' + st.id) + '</div>' +
        '<div class="pz-eqline"><span class="pz-step-eq">' + st.dependsOn.map(numOf).join('、') + 'より、' + esc(st.label) + '</span>' + tail + '</div>';
    } else {
      body = '<div class="pz-finalline">' + this.blank('cp:' + st.id) + '<span>より、</span></div>' +
        '<div class="pz-eqline">' + this.blank('cr:' + st.id) + tail + '</div>';
    }
    return '<li class="pz-row pz-steprow"><span class="pz-row-no">' + (no || '結論') + '</span><div class="pz-row-body">' + body + '</div></li>';
  };

  PuzzleView.prototype.renderTray = function () {
    const z = this.puzzle;
    const s = z.slot(z.active);
    const current = z.placed[z.active];
    const kindName = KIND_NAME[kindOf(s)];
    this.ref('tray').hidden = !this.trayOpen;
    this.root.classList.toggle('tray-open', this.trayOpen);
    const box = this.ref('cards');
    if (s.input) {
      // チャレンジ：等式カードは出さず、数学キーパッドで入力する（三角形の欄は三角形を入力）
      const guide = s.inputKind === 'tri' ? '証明する2つの三角形を、対応する頂点の順に入力しよう！'
        : s.kind === 'final' ? '合同から導く結論の等式を入力しよう！' : '等しい辺（角）を入力しよう！';
      this.ref('trayHead').innerHTML = '<span class="pz-tray-target">' + esc(s.label) + '</span>' +
        '<span class="pz-tray-note">' + guide + '</span>';
      box.className = 'pz-cards kind-input';
      box.innerHTML = this.trayOpen ? PH.mathKeypad.render(this.draftFor(s.id)) : '';
    } else {
      const t1 = s.kind === 'tri2' && z.cardIn('t1');
      this.ref('trayHead').innerHTML = '<span class="pz-tray-target">' + esc(s.label) + '</span>' +
        '<span class="pz-tray-note">' + (t1
          ? esc(t1.text) + ' の頂点 ' + esc(t1.tri.join('・')) + ' に対応する順に並んだ三角形をタップ'
          : 'に入れる' + kindName + 'をタップ') + '</span>';
      const cards = z.cardsForActive();
      box.className = 'pz-cards kind-' + kindOf(s);
      box.innerHTML = cards.map(function (c) {
        return '<button class="pz-card' + (c.id === current ? ' is-current' : '') + '" data-card="' + c.id + '">' + esc(c.text) + '</button>';
      }).join('');
    }
    const empty = z.emptyCount();
    const btn = this.ref('checkBtn');
    btn.disabled = empty > 0;
    btn.textContent = empty > 0 ? '答え合わせ（あと' + empty + 'か所）' : '答え合わせ';

    const fb = this.ref('feedback');
    const res = z.result;
    if (!res) {
      fb.innerHTML = empty > 0
        ? '<p class="pz-msg-guide">' + (z.type === 'challenge' ? '解答欄をタップして、理由を選んだり等式を入力したりしよう。' : '解答欄をタップして、カードを選ぼう。') + '</p>'
        : '<p class="pz-msg-guide">すべて埋まったよ。「答え合わせ」を押そう！</p>';
    } else {
      const open = res.messages.filter(function (m) { return res.slotStatus[m.slotId] === 'ng'; });
      fb.innerHTML = open.length
        ? '<ul class="pz-msgs">' + open.map(function (m) {
          return '<li><b>' + esc(m.label) + '</b> ' + esc(m.text) + '</li>';
        }).join('') + '</ul>'
        : '<p class="pz-msg-info">直したところで、もう一度「答え合わせ」を押そう！</p>';
    }
  };

  // そのレベルの全問をクリアしているときの案内（レベルは自動では変えない）
  PuzzleView.prototype.levelGuide = function () {
    const mode = this.recordMode;
    const all = PH.problems.every(function (p) { return PH.storage.getProblem(p.id, mode).cleared; });
    return all ? '<p class="result-guide level-guide">' + esc(levelAllClearText(this.level.id)) + '</p>' : '';
  };

  function levelAllClearText(id) {
    return {
      easy: 'おてがる全問クリア！ 次はスタンダードに挑戦してみよう！',
      standard: 'スタンダード全問クリア！ チャレンジにも挑戦してみよう！',
      challenge: '証明マスターへの道をクリア！ ノートでも証明を書いてみよう！',
    }[id];
  }
  PH.levelAllClearText = levelAllClearText;

  // 完成画面：生徒が組み立てた順で証明全文を表示する
  PuzzleView.prototype.buildResult = function () {
    const z = this.puzzle;
    const p = this.problem;
    const proof = PH.buildProof(p);
    const stage = PH.getStage(p.stage);
    const list = PH.stageProblems(p.stage);
    const hasNext = list.indexOf(p) < list.length - 1;
    const nextStage = PH.getStage(p.stage + 1);
    const rows = z.evaluateRows();
    // 結論が辺・角の等しさの問題：生徒が選んだ三角形（対応は正しい）で「において」と合同の行を書く
    const ans = z.triangleAnswer();
    const intro = ans ? '△' + ans[0].join('') + 'と△' + ans[1].join('') + 'において' : proof.intro;
    const congruence = ans ? '△' + ans[0].join('') + '≡△' + ans[1].join('') : proof.conclusion;
    const f = z.evaluateFinal();
    const finalHtml = f ? PH.finalProofHtml(proof, f.reasonCard && f.reasonCard.text, f.eqCard && f.eqCard.text) : '';
    const lines = rows.map(function (r, i) {
      return '<li class="proof-line">' +
        '<button class="pl-reason" data-proof-reason="' + r.evidence.id + '">' + esc(r.reason.text) + '</button>' +
        '<button class="pl-eq" data-ev="' + r.evidence.id + '">' + esc(r.eqCard.text) + '<span class="pl-no">……' + proof.lines[i].no + '</span></button>' +
        '</li>';
    }).join('');
    let guide = '';
    if (!hasNext) {
      guide = nextStage
        ? '<p class="result-guide">STAGE ' + stage.id + 'のパズルはこれで最後！ 次は <b>STAGE ' + nextStage.id + '「' + esc(nextStage.title) + '」</b> に挑戦しよう！</p>'
        : '<p class="result-guide">これで最後のステージの最後のパズルだよ。★★★をめざして挑戦しよう！</p>';
    }
    this.ref('result').innerHTML =
      '<div class="result-top">' +
        '<div class="card result-figure"><svg class="figure mini" data-ref="miniSvg" aria-label="証明した図"></svg></div>' +
        '<div class="result-side">' +
          '<div class="result-banner is-puzzle">' +
            '<div class="result-title">証明パズル完成！</div>' +
            '<div class="result-stars" aria-label="評価 星' + z.stars + 'つ">' + starsText(z.stars) + '</div>' +
            '<div class="result-meta"><span>' + esc(this.level.label) + '</span><span class="sep">・</span><span>ミス ' + z.misses + '回</span><span class="sep">・</span><span>ヒント ' + z.hintsUsed + '回</span></div>' +
            (this.improved ? '<span class="best">ベスト更新！</span>' : '') +
          '</div>' +
          '<div class="result-actions">' +
            '<button class="btn" data-act="restart">↺ もう一度</button>' +
            (hasNext ? '<button class="btn btn-primary" data-act="next">次の問題 ▶</button>' : '') +
            (!hasNext && nextStage ? '<button class="btn btn-primary" data-act="next-stage">次のステージ ▶</button>' : '') +
            '<button class="btn" data-act="stages">ステージ選択</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="result-scroll" data-ref="resultScroll">' +
        (this.stageCleared
          ? '<div class="stage-clear-banner"><span class="scb-title">STAGE CLEAR！</span><span class="scb-sub">証明パズル STAGE ' + stage.id + '「' + esc(stage.title) + '」をすべてクリアしたよ！</span></div>'
          : '') +
        (this.lowered.length
          ? '<p class="result-guide">' + this.lowered.map(function (lv) { return '<b>' + esc(PH.getPuzzleLevel(lv).label) + '</b>'; }).join('・') +
            ' のこの問題も ★★★ になったよ！</p>'
          : '') +
        guide + this.levelGuide() +
        '<div class="result-body">' +
          '<div class="card proof-sheet">' +
            '<h2 class="proof-title">完成した証明</h2>' +
            '<p class="small-note">式や理由をタップすると、図の場所が光るよ</p>' +
            '<p class="proof-intro">' + esc(intro) + '</p>' +
            '<ol class="proof-lines">' + lines + PH.stepLinesHtml(proof) + '</ol>' +
            '<p class="proof-sum">' + esc(proof.summary) + '</p>' +
            '<p class="proof-cond"><strong>' + esc(proof.condition) + '</strong>ので、</p>' +
            '<p class="proof-concl' + (f ? ' is-mid' : '') + '">' + esc(congruence) + '</p>' +
            finalHtml + PH.postProofHtml(proof) +
          '</div>' +
          '<div class="card points explain">' +
            '<h3>💡 今回のポイント</h3>' +
            '<p class="explain-text">' + esc(p.explanation) + '</p>' +
            '<h4>学習のポイント</h4><ul>' +
              p.learningPoints.map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') +
            '</ul>' +
          '</div>' +
        '</div>' +
      '</div>';
    this.resultBuilt = true;
  };

  // ---------------------------------------------------------------------

  let current = null;

  PH.puzzleView = {
    mount: function (container, problem, nav) {
      PH.puzzleView.unmount();
      current = new PuzzleView(container, problem, nav);
      return current;
    },
    unmount: function () {
      if (current) current.destroy();
      current = null;
    },
    current: function () { return current; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
