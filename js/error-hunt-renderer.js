/*
 * error-hunt-renderer.js — 「証明の間違い探し」（Ver.1.1）の画面
 *
 *   PH.errorView.renderTop(el, unit)   … 問題一覧（#/error、#/error/category/<単元>）
 *   PH.errorView.renderReview(el)      … 苦手な問題（#/error/review）
 *   PH.errorView.mount(el, def, nav)   … プレイ画面と正解画面（#/error/play/<問題ID>）
 *   PH.errorView.unmount()
 * 証明文は論理ステップ（PH.errorHunt.structure）ごとに1つのボタン。スマホで文が折り返されても、1つのステップは1つのタップ領域。
 * プレイ画面のレイアウトは証明パズルと同じ（.screen-play・.pz-body・.pz-top・.pz-scroll。スマホ縦画面は図・仮定・結論を
 * 上に固定して証明文だけスクロール、PC は左に図・仮定・結論）。図をタップすると拡大ウィンドウで印をつけられる（判定には関係しない）。
 */
(function (root) {
  'use strict';
  const PH = root.PH;
  const doc = root.document;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function starsText(n) { return '★'.repeat(n) + '<span class="dim">' + '☆'.repeat(3 - n) + '</span>'; }
  function unitOf(id) { return PH.errorHunt.UNITS.find(function (u) { return u.id === id; }); }

  // ---- 問題一覧 ---------------------------------------------------------------

  function header(title, back, backLabel) {
    return '<header class="page-header">' +
      '<button class="head-btn" data-go="' + back + '" aria-label="戻る"><span class="ico">' + (back === '#/' ? '⌂' : '◀') + '</span><span class="lbl">' + backLabel + '</span></button>' +
      '<h1 class="page-title">' + esc(title) + '</h1><span></span>' +
    '</header>';
  }

  function card(def, showUnit) {
    const rec = PH.storage.getErrorRecord(def.id);
    const src = PH.getProblem(def.source);
    const diff = '★'.repeat(def.difficulty) + '<span class="dim">' + '★'.repeat(Math.max(0, 3 - def.difficulty)) + '</span>';
    const badge = rec.solvedByUser ? 'クリア' : rec.completed ? '正解を確認' : '未クリア';
    return '<li><a class="problem-card eh-card' + (rec.solvedByUser ? ' is-cleared' : '') + '" href="#/error/play/' + def.id + '">' +
      '<span class="pc-no">間違い探し<b>' + esc(def.no) + '</b></span>' +
      '<span class="pc-body">' +
        '<span class="pc-stage">' + (showUnit ? esc(unitOf(def.unit).label) + '｜' : '') + '元の問題 ' + esc(src.number) + '</span>' +
        '<span class="pc-title">' + esc(src.title) + '</span>' +
        '<span class="pc-meta"><span class="pc-diff" aria-label="難易度' + def.difficulty + '">難易度 ' + diff + '</span></span>' +
      '</span>' +
      '<span class="pc-status">' +
        '<span class="pc-badge">' + badge + '</span>' +
        '<span class="pc-best" aria-label="最高評価"><span class="best-stars">' + (rec.completed ? starsText(rec.bestStars) : '<span class="dim">☆☆☆</span>') + '</span></span>' +
        (rec.solvedByUser && rec.minMisses != null ? '<span class="pc-miss">最少ミス ' + rec.minMisses + '回</span>' : '') +
      '</span>' +
    '</a></li>';
  }

  function stats(list) {
    const recs = list.map(function (d) { return PH.storage.getErrorRecord(d.id); });
    return {
      cleared: recs.filter(function (r) { return r.solvedByUser; }).length,
      stars: recs.reduce(function (s, r) { return s + r.bestStars; }, 0),
      total: list.length,
    };
  }

  function renderTop(el, unit) {
    const all = PH.errorProblems();
    const st = stats(all);
    const review = all.filter(function (d) { return PH.storage.isErrorReviewTarget(d.id); }).length;
    const units = PH.errorHunt.UNITS.filter(function (u) { return !unit || u.id === unit; });
    el.innerHTML = header('証明の間違い探し', '#/', 'ホーム') +
      '<div class="eh-top">' +
        '<div class="stage-intro eh-intro">' +
          '<p class="eh-lead">🔎 証明文の中に間違いが1か所！ よく読んで見つけよう！</p>' +
          '<p class="stage-intro-stat">クリア ' + st.cleared + '/' + st.total + '問 ・ ★ ' + st.stars + '/' + (st.total * 3) + '</p>' +
        '</div>' +
        // Ver.1.2：ランダム5問チャレンジの入口
        '<a class="ehc-entry" href="#/error/challenge">' +
          '<span class="ehc-entry-ico" aria-hidden="true">🎯</span>' +
          '<span class="ehc-entry-text"><span class="ehc-entry-name">ランダム5問チャレンジ</span>' +
          '<span class="ehc-entry-desc">基本の合同証明・総合証明　毎回ちがう間違いが出るよ！</span></span>' +
          '<span class="ehc-entry-go" aria-hidden="true">▶</span>' +
        '</a>' +
        '<h2 class="eh-practice-title">じっくり練習（' + st.total + '問）<span class="eh-unit-stat">開くたびに、間違いの場所が変わることがあるよ</span></h2>' +
        '<a class="btn btn-gold eh-review-btn" href="#/error/review">苦手な問題に挑戦！<span class="cont-sub">（' + review + '問）</span></a>' +
        '<nav class="eh-tabs" aria-label="単元">' +
          '<a class="eh-tab" href="#/error"' + (!unit ? ' aria-current="page"' : '') + '>すべて</a>' +
          PH.errorHunt.UNITS.map(function (u) {
            return '<a class="eh-tab" href="#/error/category/' + u.id + '"' + (unit === u.id ? ' aria-current="page"' : '') + ' aria-label="' + esc(u.label) + '">' + esc(u.short) + '</a>';
          }).join('') +
        '</nav>' +
        units.map(function (u) {
          const list = PH.errorProblems(u.id);
          const s = stats(list);
          return '<section class="eh-unit"><h2 class="eh-unit-title">' + esc(u.label) + '<span class="eh-unit-stat">クリア ' + s.cleared + '/' + s.total + '</span></h2>' +
            '<ul class="problem-list">' + list.map(function (d) { return card(d, false); }).join('') + '</ul></section>';
        }).join('') +
      '</div>';
  }

  function renderReview(el) {
    const list = PH.errorProblems().filter(function (d) { return PH.storage.isErrorReviewTarget(d.id); });
    el.innerHTML = header('間違い探し：苦手な問題', '#/error', '一覧') +
      '<div class="eh-top">' + (list.length
        ? '<p class="select-note">まだ自分で見つけていない問題と、★★以下の問題だよ。★★★をめざそう！</p><ul class="problem-list">' + list.map(function (d) { return card(d, true); }).join('') + '</ul>'
        : '<div class="card review-empty"><p class="review-empty-title">復習する問題はありません！</p><p>すべて★★★！ すばらしい！</p>' +
          '<a class="btn btn-primary" href="#/error">問題一覧へ</a></div>') +
      '</div>';
  }

  // ---- プレイ画面 ---------------------------------------------------------------

  let current = null;

  function ErrorView(el, def, nav) {
    this.root = el;
    this.def = def;
    this.nav = nav;
    this.game = new PH.ErrorHuntGame(def);
    this.problem = this.game.built.problem;
    this.feedback = null;
    this.hint = null;
    this.timers = [];
    this.userMarks = {};          // 図につけた印（要素キー → 本数）。判定には使わない
    this.markTool = { kind: 'seg', n: 1 };
    this.markMode = 'mark';       // 'mark'（印をつける）/ 'erase'（消す）
    this.markOpen = false;
    this.onClick = this.handleClick.bind(this);
    this.onKey = this.handleKey.bind(this);
    this.onResize = function () { this.renderFigure(); if (this.markOpen) this.renderMarkFigure(); }.bind(this);
    el.addEventListener('click', this.onClick);
    doc.addEventListener('keydown', this.onKey);
    root.addEventListener('resize', this.onResize);
    this.build();
    this.render();
  }

  ErrorView.prototype.ref = function (name) { return this.root.querySelector('[data-ref="' + name + '"]'); };
  ErrorView.prototype.later = function (fn, ms) { this.timers.push(root.setTimeout(fn, ms)); };

  ErrorView.prototype.destroy = function () {
    this.root.removeEventListener('click', this.onClick);
    doc.removeEventListener('keydown', this.onKey);
    root.removeEventListener('resize', this.onResize);
    this.root.classList.remove('screen-play', 'eh-playing', 'is-result');
    this.timers.forEach(function (t) { root.clearTimeout(t); });
    const ov = doc.getElementById('success-overlay');
    if (ov) { ov.classList.remove('show'); ov.hidden = true; }
    doc.body.classList.remove('has-result');
  };

  // 画面の部品（ランダム5問チャレンジ ChallengeView が差しかえる）
  ErrorView.prototype.headerHtml = function () {
    return '<header class="play-header eh-header">' +
        '<button class="head-btn" data-act="list" aria-label="問題一覧に戻る"><span class="ico">◀</span><span class="lbl">問題</span></button>' +
        '<div class="play-title"><span class="play-no">間違い探し' + esc(this.def.no) + '</span><span class="play-name">' + esc(this.problem.title) + '</span></div>' +
        '<button class="head-btn head-hint" data-act="hint" aria-label="ヒント"><span class="ico">💡</span><span class="lbl">ヒント</span></button>' +
      '</header>';
  };
  ErrorView.prototype.ruleHtml = function () {
    return '<p class="eh-rule"><b>間違いは1か所！</b> 最初に論理がくずれる行をタップしよう。</p>';
  };
  ErrorView.prototype.helpHtml = function () {
    return '<p class="eh-hintbox" data-ref="hintbox" hidden></p>' +
      '<p class="eh-feedback" data-ref="feedback" aria-live="polite"></p>' +
      '<div class="eh-help" data-ref="help" hidden>' +
        '<button class="btn" data-act="hint">💡 ヒントを見る</button>' +
        '<button class="btn" data-act="reveal">正解を確認する</button>' +
      '</div>';
  };
  ErrorView.prototype.barHtml = function () {
    return '<div class="eh-bar">' +
        '<button class="btn btn-big eh-confirm" data-act="confirm" data-ref="confirm">ここが間違い！</button>' +
      '</div>';
  };

  ErrorView.prototype.build = function () {
    const p = this.problem;
    this.root.innerHTML =
      this.headerHtml() +
      // 証明パズルと同じレイアウト：上（図・仮定・結論）は固定、証明文だけスクロール、下に「ここが間違い！」
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
          '<div class="card eh-sheet">' +
            this.ruleHtml() +
            '<ol class="eh-lines" data-ref="lines"></ol>' +
          '</div>' +
          this.helpHtml() +
        '</div>' +
        this.barHtml() +
      '</div>' +
      '<div class="result eh-result" data-ref="result" hidden></div>' +
      // 図に印をつけるウィンドウ（証明パズルと同じ。閉じると、つけた印が問題の図に反映される）
      '<div class="pz-modal" data-ref="markModal" role="dialog" aria-modal="true" aria-label="図に印をつける" hidden>' +
        '<div class="card pz-modal-box">' +
          '<div class="pz-modal-head"><span class="pz-modal-title">✏️ 図に印をつける</span>' +
            '<button class="pz-tray-close" data-act="close-marks" aria-label="閉じる">×</button></div>' +
          '<div class="pz-modal-fig" data-ref="markFigWrap"><svg class="figure" data-ref="markSvg" role="group" aria-label="印をつける図"></svg></div>' +
          '<div class="pz-modal-tools" data-ref="markTools"></div>' +
          '<p class="pz-modal-note">印は考えを整理するための下書きで、判定には関係しないよ。</p>' +
          '<div class="pz-modal-actions">' +
            '<button class="btn" data-act="clear-marks">印をすべて消す</button>' +
            '<button class="btn btn-primary" data-act="close-marks">閉じる</button>' +
          '</div>' +
        '</div>' +
      '</div>';
    this.renderFigure();
  };

  ErrorView.prototype.renderFigure = function () {
    const svg = this.ref('svg');
    if (svg) PH.renderer.render(svg, this.problem, { interactive: false, userMarks: this.userMarks });
  };

  // ---- 図に印をつける（拡大ウィンドウ。証明パズルと同じ操作） ----------------------------

  ErrorView.prototype.setMarks = function (open) {
    this.markOpen = !!open;
    const modal = this.ref('markModal');
    modal.hidden = !this.markOpen;
    if (this.markOpen) {
      PH.sound.play('tap');
      this.renderMarkTools();
      this.renderMarkFigure();
    } else {
      this.renderFigure();       // 閉じたら、つけた印を問題の図に反映
    }
  };

  ErrorView.prototype.selectMarkTool = function (v) {
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

  ErrorView.prototype.tapMarkElement = function (key) {
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

  ErrorView.prototype.clearMarks = function () {
    this.userMarks = {};
    PH.sound.play('tap');
    this.renderMarkFigure();
  };

  // タップした場所が2つ以上の辺・角にあたるときは「どちらに〜？」で選ぶ
  ErrorView.prototype.tapMarkFromFigure = function (target, clientX, clientY) {
    const self = this;
    const key = target.getAttribute('data-key');
    const svg = this.ref('markSvg');
    const ctm = svg && svg.getScreenCTM && svg.getScreenCTM();
    let list = [key];
    if (ctm && clientX != null) {
      const q = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      const fig = this.problem.figure;
      const c = target.classList.contains('hit-seg')
        ? PH.geometry.segmentCandidates(fig, q)
        : PH.geometry.angleCandidates(fig, q, this.markMode === 'mark' && this.markTool.kind === 'ang');
      if (c.length) list = c;
    }
    if (this.markMode === 'erase') {
      const marked = list.filter(function (k) { return self.userMarks[k] != null; });
      if (marked.length) list = marked;
    }
    if (list.length <= 1) return this.tapMarkElement(list[0]);
    const byKey = PH.geometry.getElements(this.problem.figure).byKey;
    PH.chooser.open({
      title: this.markMode === 'erase' ? 'どちらの印を消しますか？' : 'どちらに印をつけますか？',
      options: list.map(function (k) { return { value: k, label: byKey[k].display }; }),
      avoid: this.ref('markFigWrap'),
      onChoose: function (k) { self.tapMarkElement(k); },
    });
  };

  ErrorView.prototype.renderMarkTools = function () {
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

  ErrorView.prototype.renderMarkFigure = function () {
    const svg = this.ref('markSvg');
    if (!svg || !this.markOpen) return;
    this.ref('markFigWrap').className = 'pz-modal-fig mode-' + (this.markMode === 'erase' ? 'erase' : 'mark');
    PH.renderer.render(svg, this.problem, {
      userMarks: this.userMarks,
      interactive: true,
      hit: this.markMode === 'erase' ? { seg: true, ang: true } : { seg: this.markTool.kind === 'seg', ang: this.markTool.kind === 'ang' },
    });
  };

  ErrorView.prototype.handleKey = function (e) {
    if (e.key === 'Escape' && this.markOpen && !PH.chooser.isOpen()) this.setMarks(false);
  };

  // 1つの論理ステップ（前置き・理由・式・番号）
  function stepHtml(s) {
    return (s.lead ? '<span class="eh-lead-text">' + esc(s.lead) + '</span>' : '') +
      (s.reason ? '<span class="eh-reason">' + esc(s.reason) + '</span>' : '') +
      (s.chain ? '<span class="eh-chain">' + esc(s.chain) + '</span>' : '') +
      '<span class="eh-text' + (s.kind === 'condition' || s.kind === 'qcondition' ? ' is-cond' : '') + '">' + esc(s.body) + (s.tail ? esc(s.tail) : '') + '</span>' +
      (s.no ? '<span class="eh-no">……' + esc(s.no) + '</span>' : '');
  }

  ErrorView.prototype.render = function () {
    const g = this.game;
    const done = g.finished();
    this.ref('body').hidden = done;
    this.ref('result').hidden = !done;
    doc.body.classList.toggle('has-result', done);
    // 証明パズルと同じ画面の形。プレイ中は図・仮定・結論、正解画面は図・結果・ボタンを固定し、証明文・解説だけスクロール
    this.root.classList.add('screen-play');
    this.root.classList.toggle('eh-playing', !done);
    this.root.classList.toggle('is-result', done);
    doc.body.setAttribute('data-screen', 'error-play');
    this.root.querySelectorAll('.head-hint').forEach(function (b) { b.disabled = done; });
    if (done) { if (!this.resultBuilt) this.buildResult(); return; }
    const wrong = g.wrongIds;
    this.ref('lines').innerHTML = g.built.steps.map(function (s) {
      const cls = ['eh-line', 'kind-' + s.kind];
      if (g.selected === s.id) cls.push('is-selected');
      if (wrong.indexOf(s.id) >= 0) cls.push('is-checked');
      return '<li><button class="' + cls.join(' ') + '" data-step="' + s.id + '" aria-pressed="' + (g.selected === s.id) + '">' + stepHtml(s) + '</button></li>';
    }).join('');
    this.ref('confirm').disabled = !g.selected;
    const fb = this.ref('feedback');
    fb.textContent = this.feedback ? this.feedback.text : '';
    fb.className = 'eh-feedback' + (this.feedback ? ' is-' + this.feedback.type : '');
    const hb = this.ref('hintbox');
    hb.hidden = !this.hint;
    hb.textContent = this.hint ? '💡 ' + this.hint : '';
    this.ref('help').hidden = !g.canHelp();
  };

  ErrorView.prototype.handleClick = function (e) {
    if (this.markOpen && e.target === this.ref('markModal')) return this.setMarks(false);   // 外側をタップで閉じる
    const t = e.target.closest('[data-key],[data-mark-tool],[data-step],[data-act]');
    if (!t || !this.root.contains(t)) return;
    if (t.hasAttribute('data-key')) return this.tapMarkFromFigure(t, e.clientX, e.clientY);
    if (t.hasAttribute('data-mark-tool')) return this.selectMarkTool(t.getAttribute('data-mark-tool'));
    if (t.hasAttribute('data-step')) return this.select(t.getAttribute('data-step'));
    switch (t.getAttribute('data-act')) {
      case 'open-marks': return this.setMarks(true);
      case 'close-marks': return this.setMarks(false);
      case 'clear-marks': return this.clearMarks();
      case 'list': return this.nav.list();
      case 'confirm': return this.confirm();
      case 'hint': return this.showHint();
      case 'reveal': return this.reveal();
      case 'retry': return this.nav.reload();
      case 'next': return this.nav.next();
      case 'source': return this.nav.source();
    }
  };

  ErrorView.prototype.select = function (id) {
    if (this.game.select(id)) {
      PH.sound.play('tap');
      this.feedback = null;
      this.render();
    }
  };

  ErrorView.prototype.confirm = function () {
    const g = this.game;
    const r = g.confirm();
    if (r.status === 'none') return;
    if (r.status === 'correct') return this.finish();
    if (r.status === 'repeat') {
      PH.sound.play('soft');
      this.feedback = { type: 'info', text: 'その行は、さっき確かめた正しい行だよ。ほかの行を選ぼう！' };
    } else {
      PH.sound.play('soft');
      this.feedback = g.canHelp()
        ? { type: 'ng', text: 'この行は正しいよ。' + PH.ERROR_HUNT_HELP_AFTER + '回まちがえたね。ヒントを見るか、正解を確認しよう。' }
        : { type: 'ng', text: 'この行は正しいよ。ほかの行も確認してみよう！' };
    }
    this.render();
  };

  ErrorView.prototype.showHint = function () {
    const h = this.game.useHint();
    if (!h) return;
    PH.sound.play('tap');
    this.hint = h;
    this.render();
  };

  ErrorView.prototype.reveal = function () {
    if (!this.game.reveal()) return;
    this.finish();
  };

  ErrorView.prototype.finish = function () {
    const g = this.game;
    this.saved = PH.storage.recordError(this.def.id, g.result());
    if (g.solved) {
      PH.sound.play('success');
      const ov = doc.getElementById('success-overlay');
      if (ov) {
        ov.querySelector('.success-text').textContent = '間違い発見！';
        ov.querySelector('.success-concl').textContent = '';
        ov.className = 'success-overlay is-puzzle';
        ov.hidden = false;
        void ov.offsetWidth;
        ov.classList.add('show');
        this.later(function () { ov.classList.remove('show'); ov.hidden = true; }, 2000);
      }
    } else PH.sound.play('tap');
    this.render();
    root.scrollTo(0, 0);
  };

  // ---- 正解画面：何が・なぜ間違いか、正しくはどう書くか、正しい証明全文 -----------------------

  ErrorView.prototype.buildResult = function () {
    const g = this.game;
    const b = g.built;
    const E = PH.errorHunt;
    const list = PH.errorProblems();
    const self = this;
    // Ver.1.2：this.def はバリエーションの問題データ（ベース問題とは別のオブジェクト）なので ID で探す
    const hasNext = list.findIndex(function (d) { return d.id === self.def.id; }) < list.length - 1;
    const stars = g.stars();
    // 証明パズル・ハンターの正解画面と同じ形：上（図・結果・ボタン）は固定、下（解説・正しい証明）だけスクロール
    this.ref('result').innerHTML =
      '<div class="result-top">' +
        '<div class="card result-figure"><svg class="figure mini" data-ref="miniSvg" aria-label="問題の図"></svg></div>' +
        '<div class="result-side">' +
          '<div class="result-banner is-error' + (g.solved ? '' : ' is-revealed') + '">' +
            '<div class="result-title">' + (g.solved ? '間違い発見！' : '正解を確認') + '</div>' +
            '<div class="result-stars" aria-label="評価 星' + stars + 'つ">' + starsText(stars) + '</div>' +
            '<div class="result-meta"><span>ミス ' + g.misses + '回</span>' + (g.hintUsed ? '<span class="sep">・</span><span>ヒントあり</span>' : '') + '</div>' +
            (this.saved && this.saved.improved && !this.saved.firstTime && g.solved ? '<span class="best">ベスト更新！</span>' : '') +
          '</div>' +
          '<div class="result-actions">' +
            '<button class="btn" data-act="retry">↺ もう一度</button>' +
            (hasNext ? '<button class="btn btn-primary" data-act="next">次の問題 ▶</button>' : '') +
            '<button class="btn" data-act="list">問題一覧へ</button>' +
            '<button class="btn" data-act="source">元の問題を解く</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="result-scroll" data-ref="resultScroll">' +
      '<div class="result-body">' +
        '<div class="card eh-fix">' +
          '<h2 class="eh-fix-title">どこが間違い？ <span class="eh-cat">' + esc(E.CATEGORIES[this.def.category].label) + '</span></h2>' +
          '<div class="eh-fix-row is-wrong"><span class="eh-fix-label">✖ 間違い</span><span class="eh-fix-text">' + esc(E.stepText(b.wrong)) + '</span></div>' +
          '<div class="eh-fix-row is-right"><span class="eh-fix-label">○ 正しくは</span><span class="eh-fix-text">' + esc(E.stepText(b.right)) + '</span></div>' +
          '<h3 class="eh-why-title">💡 なぜ間違い？</h3>' +
          '<p class="eh-why">' + esc(this.def.explain) + '</p>' +
        '</div>' +
        '<div class="card eh-proof-card">' +
          '<h2 class="proof-title">正しい証明</h2>' +
          '<ol class="eh-lines is-proof">' + b.correctSteps.map(function (s) {
            return '<li><div class="eh-line kind-' + s.kind + (s.id === b.target ? ' is-fixed' : '') + '">' + stepHtml(s) + '</div></li>';
          }).join('') + '</ol>' +
        '</div>' +
      '</div>' +
      '</div>';
    PH.renderer.render(this.ref('miniSvg'), this.problem, { interactive: false, userMarks: this.userMarks });
    this.resultBuilt = true;
  };

  function mount(el, def, nav) {
    unmount();
    current = new ErrorView(el, def, nav);
    return current;
  }

  function unmount() {
    if (current) current.destroy();
    current = null;
    challenge = null;            // プレイ中にほかの画面へ移ったら、そのチャレンジは記録しない
  }

  // =====================================================================================
  // Ver.1.2：ランダム5問チャレンジ
  //   #/error/challenge                       コースを選ぶ
  //   #/error/challenge/<コース>/play         プレイ（「〜に挑戦」から来たときだけ始める。再読み込みでは再開しない）
  //   #/error/challenge/<コース>/result       結果発表（そのコースの直近の挑戦）
  //   #/error/challenge/<コース>/review       振り返り（挑戦した5問。保存したバリエーションをそのまま再現し、再抽選しない）
  // =====================================================================================

  const CH = function () { return PH.errorChallenge; };
  let challenge = null;         // { course, session, el, nav }
  let pendingStart = null;      // 「〜に挑戦」で選んだコース
  let lastShown = null;         // 直近に終えたチャレンジ（結果画面の演出用）

  function courseTag(c) { return '<span class="rank-course-tag ehc-tag course-' + c.id + '">' + esc(c.label) + '</span>'; }

  // プレイ画面：間違い探しの画面（図・仮定・結論・証明文・印つけ）をそのまま使い、ヘッダー・下のボタンだけ変える
  function ChallengeView(el, ch) {
    this.ch = ch;
    this.q = ch.session.current();
    this.course = CH().course(ch.course);
    this.judge = null;            // 判定の結果 { status, points }
    ErrorView.call(this, el, this.q.def, ch.nav);
  }
  ChallengeView.prototype = Object.create(ErrorView.prototype);
  ChallengeView.prototype.constructor = ChallengeView;

  ChallengeView.prototype.headerHtml = function () {
    const s = this.ch.session;
    return '<header class="play-header eh-header ehc-header">' +
        '<button class="head-btn" data-act="quit" aria-label="チャレンジをやめる"><span class="ico">✕</span><span class="lbl">やめる</span></button>' +
        '<div class="play-title"><span class="play-no">証明の間違い探し</span><span class="play-name">' + esc(this.course.label) + '</span></div>' +
        '<div class="ehc-status" aria-label="問題番号と得点">' +
          '<span class="ehc-q">Q<b>' + this.q.no + '</b> / ' + s.total() + '</span>' +
          '<span class="ehc-score"><b data-ref="score">' + s.score() + '</b>点</span>' +
        '</div>' +
      '</header>';
  };
  ChallengeView.prototype.ruleHtml = function () {
    return '<p class="eh-rule"><b>間違いは1か所！</b> 解答は1回だけ。よく確かめてから「ここが間違い！」</p>';
  };
  ChallengeView.prototype.helpHtml = function () {
    return '<p class="eh-feedback ehc-feedback" data-ref="feedback" aria-live="polite"></p>';
  };
  ChallengeView.prototype.barHtml = function () {
    const last = this.q.no >= this.ch.session.total();
    return '<div class="eh-bar">' +
        '<button class="btn btn-big eh-confirm" data-act="confirm" data-ref="confirm">ここが間違い！</button>' +
        '<button class="btn btn-big btn-primary ehc-next" data-act="cnext" data-ref="cnext" hidden>' + (last ? '結果発表へ ▶' : '次の問題へ ▶') + '</button>' +
      '</div>' +
      '<div class="ehc-judge" data-ref="judge" aria-hidden="true" hidden></div>';
  };

  ChallengeView.prototype.render = function () {
    const g = this.game;
    const q = this.q;
    const done = q.answered;
    this.root.classList.add('screen-play', 'eh-playing');
    this.root.classList.remove('is-result');
    doc.body.setAttribute('data-screen', 'error-play');
    // 解答したあとも、正解の行は表示しない（5問終了後の振り返りで確認する）
    this.ref('lines').innerHTML = g.built.steps.map(function (s) {
      const cls = ['eh-line', 'kind-' + s.kind];
      const sel = (done ? q.selected : g.selected) === s.id;
      if (sel) cls.push(done ? (q.correct ? 'is-judged-ok' : 'is-judged-ng') : 'is-selected');
      return '<li><button class="' + cls.join(' ') + '" data-step="' + s.id + '" aria-pressed="' + sel + '"' + (done ? ' disabled' : '') + '>' + stepHtml(s) + '</button></li>';
    }).join('');
    const confirm = this.ref('confirm');
    confirm.hidden = done;
    confirm.disabled = done || !g.selected;
    this.ref('cnext').hidden = !done;
    this.ref('score').textContent = String(this.ch.session.score());
    const fb = this.ref('feedback');
    fb.textContent = this.feedback ? this.feedback.text : '';
    fb.className = 'eh-feedback ehc-feedback' + (this.feedback ? ' is-' + this.feedback.type : '');
  };

  ChallengeView.prototype.handleClick = function (e) {
    const t = e.target.closest('[data-act]');
    if (t && this.root.contains(t)) {
      const act = t.getAttribute('data-act');
      if (act === 'quit') return this.ch.quit();
      if (act === 'cnext') return this.ch.next();
    }
    return ErrorView.prototype.handleClick.call(this, e);
  };

  ChallengeView.prototype.select = function (id) {
    if (this.q.answered) return;
    ErrorView.prototype.select.call(this, id);
  };

  // 「ここが間違い！」：1問1回だけ判定（二重に確定しない）
  ChallengeView.prototype.confirm = function () {
    if (this.q.answered || !this.game.selected) return;
    const r = this.ch.session.answer(this.game.selected);
    if (r.status !== 'correct' && r.status !== 'wrong') return;
    const ok = r.status === 'correct';
    PH.sound.play(ok ? 'correct' : 'wrong');
    this.feedback = ok ? { type: 'ok', text: '○ 正解！ ＋20点' } : { type: 'ng', text: '× 不正解… 0点（正しい答えは、5問終了後の振り返りで確認しよう）' };
    const j = this.ref('judge');
    j.className = 'ehc-judge ' + (ok ? 'is-ok' : 'is-ng');
    j.innerHTML = '<span class="ehc-judge-mark">' + (ok ? '○' : '×') + '</span><span class="ehc-judge-pt">' + (ok ? '+20点' : '0点') + '</span>';
    j.hidden = false;
    this.later(function () { j.hidden = true; }, 900);
    this.render();
    const nx = this.ref('cnext');
    if (nx && nx.focus) nx.focus();
  };

  // 「〜に挑戦」から来たときだけ始める。戻り値：始めたら true（再読み込み・直接の URL では false）
  function mountChallenge(el, course, nav) {
    unmount();
    if (!pendingStart || pendingStart !== course || !CH().isCourse(course)) { pendingStart = null; return false; }
    pendingStart = null;
    lastShown = null;
    const session = CH().start(course, PH.storage.getErrorChallengeHistory(course));
    if (!session || !session.current()) return false;
    const ch = {
      course: course, session: session, el: el, nav: nav,
      quit: function () {
        PH.chooser.open({
          title: 'チャレンジをやめる',
          message: 'チャレンジを途中で終了しますか？ 今回の記録は残りません。',
          options: [{ value: 'quit', label: '終了する' }],
          textOptions: true,
          onChoose: function () { session.abort(); nav.top(); },
        });
      },
      next: function () {
        if (session.next()) { showQuestion(ch); root.scrollTo(0, 0); return; }
        if (!session.finished()) return;
        const res = session.result();
        const saved = PH.storage.recordErrorChallenge(course, res);     // 同じプレイ（playId）は二重に記録しない
        lastShown = { course: course, result: res, saved: saved, fresh: true };
        nav.result();
      },
    };
    showQuestion(ch);
    return true;
  }

  function showQuestion(ch) {
    if (current) current.destroy();
    challenge = ch;
    current = new ChallengeView(ch.el, ch);
  }

  // ---- コースを選ぶ ----

  function challengeCard(id) {
    const c = CH().course(id);
    const r = PH.storage.getErrorChallenge(id);
    const pool = CH().pool(id);
    const variants = pool.reduce(function (n, e) { return n + e.variants.length; }, 0);
    const played = r.bestScore !== null;
    return '<div class="card rank-course ehc-course course-' + id + '">' +
      '<h2 class="rank-course-name">' + esc(c.label) + '</h2>' +
      '<p class="rank-course-desc">' + esc(c.desc) + '</p>' +
      '<div class="rank-best ehc-best">' +
        '<div class="rank-best-item"><span>最高得点</span><b>' + (played ? r.bestScore + '点' : '未挑戦') + '</b></div>' +
        '<div class="rank-best-item"><span>挑戦回数</span><b>' + r.playCount + '回</b></div>' +
        '<div class="rank-best-item"><span>出題範囲</span><b class="ehc-pool">' + pool.length + '問<small>' + variants + '通り</small></b></div>' +
      '</div>' +
      titleSummary(r) +
      '<button class="btn btn-confirm btn-big ehc-start" data-act="errch-start" data-course="' + id + '">' + esc(c.short) + 'コースに挑戦</button>' +
      '<div class="rank-top-links">' +
        '<button class="btn" data-go="#/error/challenge/' + id + '/titles">🏅 称号一覧</button>' +
        (r.lastResult ? '<button class="btn" data-go="#/error/challenge/' + id + '/result">前回の結果</button>' : '') +
      '</div>' +
    '</div>';
  }

  // ---- 連続PERFECT・称号（Ver.1.2。段位認定の段位とは完全に別） ----

  function titleName(level) { const t = CH().title(level); return t ? t.name : null; }

  // コースのカード：現在の連続PERFECT・最高連続・獲得した最高称号
  function titleSummary(r) {
    const best = titleName(r.highestTitleLevel);
    return '<div class="ehc-title-sum">' +
      '<span>🔥 連続PERFECT <b>' + r.currentPerfectStreak + '</b>回</span>' +
      '<span>最高 <b>' + r.bestPerfectStreak + '</b>回</span>' +
      '<span class="ehc-title-now">🏅 ' + (best ? '<b>' + esc(best) + '</b>' : '称号なし') + '</span>' +
    '</div>';
  }

  // 結果発表の連続PERFECT・称号の欄（lr＝保存した直近の結果、rec＝コースの記録）
  function perfectBlock(lr, rec) {
    if (!lr) return '';
    if (!lr.perfect) {
      return '<div class="ehc-streak is-reset">' +
        '<p>連続PERFECT は <b>0回</b> にもどったよ。100点で、また1回目から！</p>' +
        (rec.highestTitleLevel ? '<p class="ehc-streak-keep">獲得した称号「' + esc(titleName(rec.highestTitleLevel)) + '」はそのまま（最高 ' + rec.bestPerfectStreak + '回連続）</p>' : '') +
      '</div>';
    }
    const n = lr.perfectStreak;
    const nx = CH().nextTitle(n, rec.highestTitleLevel);
    const top = lr.newTitleLevel === CH().MAX_TITLE;
    return (lr.newTitleLevel
        ? '<div class="ehc-promote' + (top ? ' is-top' : '') + '" role="status">' +
            '<span class="ehc-promote-ico" aria-hidden="true">' + (top ? '👑' : '🎊') + '</span>' +
            '<span class="ehc-promote-label">' + (top ? '最高称号 達成！' : '称号昇格！') + '</span>' +
            '<span class="ehc-promote-name">「' + esc(titleName(lr.newTitleLevel)) + '」</span>' +
            (top ? '<span class="ehc-promote-sub">10回連続PERFECT！ 証明の神眼の持ち主だ！</span>' : '') +
          '</div>'
        : '') +
      '<div class="ehc-streak">' +
        '<p class="ehc-streak-count">🔥 連続PERFECT <b>' + n + '</b>回</p>' +
        '<p>現在の称号：<b>' + esc(titleName(Math.max(lr.titleLevel, rec.highestTitleLevel))) + '</b></p>' +
        '<p class="ehc-streak-next">' + (nx
          ? '次の称号「' + esc(nx.title.name) + '」まで、あと <b>' + nx.remaining + '</b>回'
          : '最高称号に到達！ 連続記録はまだまだ続くよ') + '</p>' +
      '</div>';
  }

  // 称号一覧（コース別。未獲得の称号も名前を見せて目標にする）
  function renderChallengeTitles(el, course) {
    const c = CH().course(course);
    if (!c) { root.location.hash = '#/error/challenge'; return; }
    const r = PH.storage.getErrorChallenge(course);
    const nx = CH().nextTitle(r.currentPerfectStreak, r.highestTitleLevel);
    const MAX = CH().MAX_TITLE;
    el.innerHTML = header(c.label + '｜称号一覧', '#/error/challenge', 'コース') +
      '<div class="rank-grades ehc-titles">' +
        '<div class="card rank-now ehc-titles-now course-' + course + '">' +
          courseTag(c) +
          '<p>獲得した最高称号：<b>' + (r.highestTitleLevel ? esc(titleName(r.highestTitleLevel)) : 'まだなし') + '</b></p>' +
          '<p>現在の連続PERFECT：<b>' + r.currentPerfectStreak + '</b>回 ／ 最高：<b>' + r.bestPerfectStreak + '</b>回</p>' +
          '<p class="rank-next">' + (nx
            ? '連続PERFECT であと<b class="rank-need">' + nx.remaining + '回</b>で「' + esc(nx.title.name) + '」！'
            : '最高称号「' + esc(titleName(MAX)) + '」の連続記録を更新中！') + '</p>' +
          '<p class="select-note">5問すべて正解（100点）で連続PERFECT が1回ふえ、80点以下で0回にもどるよ。一度獲得した称号は失わない。</p>' +
        '</div>' +
        '<ol class="grade-list ehc-title-list">' + CH().TITLES.slice().reverse().map(function (t) {
          const got = t.level <= r.highestTitleLevel;
          const isBest = t.level === r.highestTitleLevel;
          return '<li class="grade-item' + (got ? ' is-got' : '') + (isBest ? ' is-best' : '') + (t.level === MAX ? ' is-top' : '') + '">' +
            '<span class="grade-ico" aria-hidden="true">' + (got ? (t.level === MAX ? '👑' : '🏅') : '・') + '</span>' +
            '<span class="grade-name">' + esc(t.name) + (isBest ? '<span class="ehc-title-mark">現在の最高称号</span>' : '') + '</span>' +
            '<span class="grade-min">' + t.need + '回連続' + (t.level === MAX ? '以上' : '') + '　' + (got ? '<b class="ehc-got">獲得済み</b>' : '未獲得') + '</span>' +
          '</li>';
        }).join('') + '</ol>' +
        '<p class="select-note">称号は「' + esc(c.label) + '」コースだけの記録だよ（もう一方のコース・段位認定とは別）。</p>' +
      '</div>';
  }

  function renderChallengeTop(el) {
    el.innerHTML = header('ランダム5問チャレンジ', '#/error', '間違い探し') +
      '<div class="rank-top ehc-top">' +
        '<div class="card rank-hero ehc-hero">' +
          '<div class="rank-hero-ico" aria-hidden="true">🎯</div>' +
          '<p class="rank-hero-tag">証明の間違い探し</p>' +
          '<p class="rank-hero-lead">5問の証明に隠れた間違いを見抜け！</p>' +
          '<p class="ehc-rules">1問20点・100点満点 ／ 解答は1問1回 ／ ヒントなし・制限時間なし</p>' +
        '</div>' +
        '<div class="rank-courses">' + CH().ORDER.map(challengeCard).join('') + '</div>' +
      '</div>';
  }

  // ---- 結果発表 ----

  function resultFor(course) {
    const shown = lastShown && lastShown.course === course ? lastShown : null;
    if (shown) return shown;
    const r = PH.storage.getErrorChallenge(course);
    return r.lastResult ? { course: course, result: r.lastResult, saved: { newBest: r.lastResult.newBest }, fresh: false } : null;
  }

  function renderChallengeResult(el, course) {
    const c = CH().course(course);
    const shown = c && resultFor(course);
    if (!shown) { el.innerHTML = ''; root.location.hash = '#/error/challenge'; return; }
    const res = shown.result;
    const rec = PH.storage.getErrorChallenge(course);
    const best = rec.bestScore;
    // 連続PERFECT・称号は、保存した直近の結果から（いま終えた挑戦と同じプレイのときだけ）
    const lr = rec.lastResult && (!res.playId || rec.lastResult.playId === res.playId) ? rec.lastResult : null;
    el.innerHTML = header(c.label + '｜結果発表', '#/error/challenge', 'コース') +
      '<div class="rank-result ehc-result">' +
        '<div class="card ehc-result-card course-' + course + '">' +
          courseTag(c) +
          '<p class="ehc-result-label">結果発表</p>' +
          '<p class="ehc-result-score"><b>' + res.score + '</b>点<span> / 100点</span></p>' +
          '<p class="ehc-result-msg">' + esc(CH().message(res.score)) + '</p>' +
          (shown.saved && shown.saved.newBest ? '<p class="ehc-newbest">🎉 自己ベスト更新！</p>' : '') +
          '<p class="ehc-result-count">正解 <b>' + res.correct + '</b>問 ・ 不正解 <b>' + res.wrong + '</b>問</p>' +
          '<ol class="ehc-marks">' + res.items.map(function (it) {
            return '<li class="' + (it.correct ? 'is-ok' : 'is-ng') + '"><span>Q' + it.no + '</span><b>' + (it.correct ? '○' : '×') + '</b></li>';
          }).join('') + '</ol>' +
          '<p class="ehc-result-best">このコースの最高得点：<b>' + (best === null ? '－' : best + '点') + '</b></p>' +
          perfectBlock(lr, rec) +
        '</div>' +
        '<div class="ehc-result-actions">' +
          '<button class="btn btn-confirm btn-big" data-act="errch-start" data-course="' + course + '">同じコースでもう一度挑戦</button>' +
          '<button class="btn btn-primary" data-go="#/error/challenge/' + course + '/review">' + (res.wrong ? '間違えた問題を確認' : '問題を振り返る') + '</button>' +
          '<button class="btn" data-go="#/error/challenge">コースを選ぶ</button>' +
          '<button class="btn" data-go="#/error">間違い探しトップへ</button>' +
        '</div>' +
      '</div>';
    if (shown.fresh) {
      shown.fresh = false;
      PH.sound.play(res.score >= 60 ? 'success' : 'soft');
      if (lr && lr.newTitleLevel) root.setTimeout(function () { PH.sound.play('get'); }, 700);
    }
  }

  // ---- 振り返り：挑戦したときと同じ証明文（保存したバリエーション）を再現する ----

  function stepTextOf(steps, id) {
    const s = steps.find(function (x) { return x.id === id; });
    return s ? PH.errorHunt.stepText(s) : null;
  }

  function reviewItem(it, c) {
    const def = PH.errorVariants.def(it.baseId, it.variantId);
    if (!def) return '<li class="card ehc-rv"><p>Q' + it.no + '：この問題は表示できません（' + esc(it.baseId + '/' + it.variantId) + '）</p></li>';
    const b = PH.errorHunt.build(def);
    const src = b.problem;
    const mine = it.selected ? stepTextOf(b.steps, it.selected) : null;
    return '<li class="card ehc-rv ' + (it.correct ? 'is-ok' : 'is-ng') + '">' +
      '<div class="ehc-rv-head">' +
        '<span class="ehc-rv-no">Q' + it.no + '</span>' +
        '<span class="ehc-rv-mark">' + (it.correct ? '○ 正解' : '× 不正解') + '</span>' +
        courseTag(c) +
      '</div>' +
      '<p class="ehc-rv-src">間違い探し' + esc(def.no) + '（元の問題 ' + esc(src.number) + '）' + esc(src.title) +
        '<span class="eh-cat">' + esc(PH.errorHunt.CATEGORIES[def.category].label) + '</span></p>' +
      '<div class="ehc-rv-body">' +
        '<div class="ehc-rv-fig"><svg class="figure mini" data-rv-fig="' + it.no + '" aria-label="問題の図"></svg></div>' +
        '<div class="ehc-rv-cond">' +
          '<p><span class="tag tag-given">仮定</span> ' + src.given.map(esc).join('、') + '</p>' +
          '<p><span class="tag tag-goal">結論</span> ' + esc(src.conclusion) + '</p>' +
        '</div>' +
      '</div>' +
      '<h3 class="ehc-rv-sub">出題された証明</h3>' +
      '<ol class="eh-lines is-proof ehc-rv-lines">' + b.steps.map(function (s) {
        const cls = ['eh-line', 'kind-' + s.kind];
        if (s.id === b.target) cls.push('is-answer');
        if (s.id === it.selected && !it.correct) cls.push('is-mine');
        return '<li><div class="' + cls.join(' ') + '">' + stepHtml(s) + '</div></li>';
      }).join('') + '</ol>' +
      '<div class="eh-fix">' +
        '<div class="eh-fix-row is-mine"><span class="eh-fix-label">👆 あなたが選んだ行</span><span class="eh-fix-text">' + (mine ? esc(mine) : '（なし）') + '</span></div>' +
        '<div class="eh-fix-row is-wrong"><span class="eh-fix-label">✖ 間違いがある行（正解の行）</span><span class="eh-fix-text">' + esc(PH.errorHunt.stepText(b.wrong)) + '</span></div>' +
        '<div class="eh-fix-row is-right"><span class="eh-fix-label">○ 正しくは</span><span class="eh-fix-text">' + esc(PH.errorHunt.stepText(b.right)) + '</span></div>' +
        '<h3 class="eh-why-title">💡 なぜ間違い？</h3>' +
        '<p class="eh-why">' + esc(def.explain) + '</p>' +
      '</div>' +
      '<details class="ehc-rv-proof"><summary>正しい証明全文を見る</summary>' +
        '<ol class="eh-lines is-proof">' + b.correctSteps.map(function (s) {
          return '<li><div class="eh-line kind-' + s.kind + (s.id === b.target ? ' is-fixed' : '') + '">' + stepHtml(s) + '</div></li>';
        }).join('') + '</ol>' +
      '</details>' +
    '</li>';
  }

  function renderChallengeReview(el, course) {
    const c = CH().course(course);
    const r = c ? PH.storage.getErrorChallenge(course).lastResult : null;
    if (!r) { el.innerHTML = ''; root.location.hash = '#/error/challenge'; return; }
    el.innerHTML = header(c.label + '｜振り返り', '#/error/challenge/' + course + '/result', '結果') +
      '<div class="ehc-review">' +
        '<p class="select-note">前回の' + esc(c.label) + 'コース（' + r.score + '点）で出題された' + r.items.length + '問だよ。黄色が正解の行（間違いがある行）、赤があなたが選んだ行。</p>' +
        '<ol class="ehc-rv-list">' + r.items.map(function (it) { return reviewItem(it, c); }).join('') + '</ol>' +
        '<div class="ehc-result-actions">' +
          '<button class="btn btn-confirm btn-big" data-act="errch-start" data-course="' + course + '">同じコースでもう一度挑戦</button>' +
          '<button class="btn" data-go="#/error/challenge">コースを選ぶ</button>' +
        '</div>' +
      '</div>';
    r.items.forEach(function (it) {
      const def = PH.errorVariants.def(it.baseId, it.variantId);
      const svg = el.querySelector('[data-rv-fig="' + it.no + '"]');
      if (def && svg) PH.renderer.render(svg, PH.getProblem(def.source), { interactive: false });
    });
  }

  // =====================================================================================
  // 開発者用：誤りバリエーションの確認（#/error/dev。生徒の画面からはリンクしない）
  // =====================================================================================

  const devFilter = { base: '', course: '', category: '', target: '' };

  function renderDev(el) {
    const V = PH.errorVariants;
    const E = PH.errorHunt;
    const all = V.all();
    const errors = V.verifyAll();
    const count = function (course) {
      const p = CH().pool(course);
      return { bases: p.length, variants: p.reduce(function (n, e) { return n + e.variants.length; }, 0) };
    };
    const cb = count('basic'), cc = count('comprehensive');
    const opt = function (v, label, cur) { return '<option value="' + esc(v) + '"' + (v === cur ? ' selected' : '') + '>' + esc(label) + '</option>'; };
    const targets = all.map(function (d) { return d.mutation.target; }).filter(function (t, i, a) { return a.indexOf(t) === i; }).sort();
    el.innerHTML = header('開発者用：誤りバリエーション', '#/error', '間違い探し') +
      '<div class="ehd">' +
        '<div class="card ehd-summary">' +
          '<p>バリエーション総数 <b>' + all.length + '</b>（ベース問題 ' + PH.ERROR_HUNT_PROBLEMS.length + '問）／ 検証エラー <b class="' + (errors.length ? 'ehd-ng' : 'ehd-ok') + '">' + errors.length + '件</b></p>' +
          '<p>基本の合同証明：ベース問題 <b>' + cb.bases + '</b>問・バリエーション <b>' + cb.variants + '</b>通り ／ 総合証明：ベース問題 <b>' + cc.bases + '</b>問・バリエーション <b>' + cc.variants + '</b>通り</p>' +
          (errors.length ? '<pre class="ehd-errors">' + esc(errors.join('\n')) + '</pre>' : '') +
          '<details><summary>ベース問題ごとの候補数</summary><table class="ehd-table"><thead><tr><th>ベース問題</th><th>元</th><th>単元</th><th>全体</th><th>基本</th><th>総合</th></tr></thead><tbody>' +
            PH.ERROR_HUNT_PROBLEMS.map(function (b) {
              const vs = V.list(b.id);
              const n = function (c) { return vs.filter(function (d) { return V.courses(d).indexOf(c) >= 0; }).length; };
              return '<tr><td>' + esc(b.id) + '</td><td>' + esc(b.source) + '</td><td>' + esc(b.unit) + '</td><td>' + vs.length + '</td><td>' + n('basic') + '</td><td>' + n('comprehensive') + '</td></tr>';
            }).join('') +
          '</tbody></table></details>' +
        '</div>' +
        '<div class="card ehd-filters">' +
          '<label>ベース問題 <select data-dev="base">' + opt('', 'すべて', devFilter.base) + PH.ERROR_HUNT_PROBLEMS.map(function (b) { return opt(b.id, b.no + ' ' + b.id, devFilter.base); }).join('') + '</select></label>' +
          '<label>コース <select data-dev="course">' + opt('', 'すべて', devFilter.course) + opt('basic', '基本の合同証明で出題', devFilter.course) + opt('comprehensive', '総合証明で出題', devFilter.course) + opt('comprehensive-only', '総合証明だけ', devFilter.course) + '</select></label>' +
          '<label>誤りの種類 <select data-dev="category">' + opt('', 'すべて', devFilter.category) + Object.keys(E.CATEGORIES).map(function (k) { return opt(k, E.CATEGORIES[k].label, devFilter.category); }).join('') + '</select></label>' +
          '<label>変更するステップ <select data-dev="target">' + opt('', 'すべて', devFilter.target) + targets.map(function (t) { return opt(t, t, devFilter.target); }).join('') + '</select></label>' +
        '</div>' +
        '<p class="select-note" data-ref="devCount"></p>' +
        '<ol class="ehd-list" data-ref="devList"></ol>' +
      '</div>';
    renderDevList(el, all);
    el.onchange = function (e) {
      const k = e.target.getAttribute && e.target.getAttribute('data-dev');
      if (!k) return;
      devFilter[k] = e.target.value;
      renderDevList(el, all);
    };
  }

  function renderDevList(el, all) {
    const V = PH.errorVariants;
    const E = PH.errorHunt;
    const f = devFilter;
    const list = all.filter(function (d) {
      const cs = V.courses(d);
      if (f.base && d.id !== f.base) return false;
      if (f.course === 'comprehensive-only' ? cs.indexOf('basic') >= 0 || cs.indexOf('comprehensive') < 0 : f.course && cs.indexOf(f.course) < 0) return false;
      if (f.category && d.category !== f.category) return false;
      if (f.target && d.mutation.target !== f.target) return false;
      return true;
    });
    el.querySelector('[data-ref="devCount"]').textContent = list.length + '件を表示';
    const lines = function (steps, mark) {
      return '<ol class="eh-lines is-proof">' + steps.map(function (s) {
        return '<li><div class="eh-line kind-' + s.kind + (s.id === mark ? ' is-answer' : '') + '">' + stepHtml(s) + '</div></li>';
      }).join('') + '</ol>';
    };
    el.querySelector('[data-ref="devList"]').innerHTML = list.map(function (d) {
      const b = E.build(d);
      return '<li class="card ehd-item">' +
        '<p class="ehd-key"><b>' + esc(d.key) + '</b>　元の問題 ' + esc(d.source) + '　<span class="eh-cat">' + esc(E.CATEGORIES[d.category].label) + '</span></p>' +
        '<table class="ehd-table"><tbody>' +
          '<tr><th>ベース問題ID</th><td>' + esc(d.id) + '</td></tr>' +
          '<tr><th>バリエーションID</th><td>' + esc(d.variantId) + '</td></tr>' +
          '<tr><th>誤りカテゴリー</th><td>' + esc(d.category) + '</td></tr>' +
          '<tr><th>requiredTopics</th><td>' + esc(V.topics(d).join(', ')) + '</td></tr>' +
          '<tr><th>出題可能コース</th><td>' + esc(V.courses(d).join(' / ')) + '</td></tr>' +
          '<tr><th>変更するステップ</th><td>' + esc(d.mutation.target) + '</td></tr>' +
          '<tr><th>修正内容</th><td><code>' + esc(JSON.stringify(d.mutation)) + '</code></td></tr>' +
          '<tr><th>間違い</th><td>' + esc(E.stepText(b.wrong)) + '</td></tr>' +
          '<tr><th>正しくは</th><td>' + esc(E.stepText(b.right)) + '</td></tr>' +
          '<tr><th>解説</th><td>' + esc(d.explain) + '</td></tr>' +
        '</tbody></table>' +
        '<details><summary>間違った証明全文・正しい証明全文</summary>' +
          '<div class="ehd-proofs"><div><h4>間違った証明</h4>' + lines(b.steps, b.target) + '</div><div><h4>正しい証明</h4>' + lines(b.correctSteps, b.target) + '</div></div>' +
        '</details>' +
      '</li>';
    }).join('');
  }

  PH.errorView = {
    renderTop: renderTop,
    renderReview: renderReview,
    mount: mount,
    unmount: unmount,
    current: function () { return current; },
    // Ver.1.2：ランダム5問チャレンジ・開発者用の確認画面
    renderChallengeTop: renderChallengeTop,
    renderChallengeResult: renderChallengeResult,
    renderChallengeReview: renderChallengeReview,
    renderChallengeTitles: renderChallengeTitles,
    renderDev: renderDev,
    requestStart: function (course) { pendingStart = CH().isCourse(course) ? course : null; },
    mountChallenge: mountChallenge,
    challenge: function () { return challenge; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
