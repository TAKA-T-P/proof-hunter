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

  ErrorView.prototype.build = function () {
    const p = this.problem;
    this.root.innerHTML =
      '<header class="play-header eh-header">' +
        '<button class="head-btn" data-act="list" aria-label="問題一覧に戻る"><span class="ico">◀</span><span class="lbl">問題</span></button>' +
        '<div class="play-title"><span class="play-no">間違い探し' + esc(this.def.no) + '</span><span class="play-name">' + esc(p.title) + '</span></div>' +
        '<button class="head-btn head-hint" data-act="hint" aria-label="ヒント"><span class="ico">💡</span><span class="lbl">ヒント</span></button>' +
      '</header>' +
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
            '<p class="eh-rule"><b>間違いは1か所！</b> 最初に論理がくずれる行をタップしよう。</p>' +
            '<ol class="eh-lines" data-ref="lines"></ol>' +
          '</div>' +
          '<p class="eh-hintbox" data-ref="hintbox" hidden></p>' +
          '<p class="eh-feedback" data-ref="feedback" aria-live="polite"></p>' +
          '<div class="eh-help" data-ref="help" hidden>' +
            '<button class="btn" data-act="hint">💡 ヒントを見る</button>' +
            '<button class="btn" data-act="reveal">正解を確認する</button>' +
          '</div>' +
        '</div>' +
        '<div class="eh-bar">' +
          '<button class="btn btn-big eh-confirm" data-act="confirm" data-ref="confirm">ここが間違い！</button>' +
        '</div>' +
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
    const hasNext = list.indexOf(this.def) < list.length - 1;
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
  }

  PH.errorView = {
    renderTop: renderTop,
    renderReview: renderReview,
    mount: mount,
    unmount: unmount,
    current: function () { return current; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
