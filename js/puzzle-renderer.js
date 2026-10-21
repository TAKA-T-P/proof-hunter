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
  const TYPE_LABEL = { fill: '穴埋め', build: '組み立て' };
  const PLACEHOLDER = { eq: '等式を選ぶ', reason: '理由を選ぶ', cond: '合同条件を選ぶ' };

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
    this.puzzle = new PH.Puzzle(problem);
    this.flashKeys = [];
    this.flashLines = [];
    this.flashTimer = null;
    this.timers = [];
    this.resultBuilt = false;
    this.stageCleared = false;
    this.trayOpen = false;      // カードの領域（解答欄をタップしたときだけ出す）
    this.build();
    this.onClick = this.handleClick.bind(this);
    this.onResize = this.renderFigure.bind(this);
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
    const type = this.puzzle.type;
    this.root.innerHTML =
      '<header class="play-header">' +
        '<button class="head-btn" data-act="home" aria-label="ホームに戻る"><span class="ico">⌂</span><span class="lbl">ホーム</span></button>' +
        '<div class="play-title"><span class="play-no">証明パズル ・ 問題' + esc(p.number) + '</span><span class="play-name">' + esc(p.title) + '</span></div>' +
        '<span class="pz-type pz-type-' + type + '">' + TYPE_LABEL[type] + '</span>' +
        '<button class="head-btn head-hint" data-act="hint" aria-label="ヒント"><span class="ico">💡</span><span class="lbl">ヒント</span></button>' +
      '</header>' +
      '<div class="pz-body" data-ref="body">' +
        '<div class="pz-top">' +
          '<div class="card figure-card pz-figure"><svg class="figure" data-ref="svg" aria-label="問題の図"></svg></div>' +
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
          '<div class="pz-tray-actions"><button class="btn" data-act="undo">この空欄を取り消す</button></div>' +
        '</div>' +
      '</div>' +
      '<div class="result" data-ref="result" hidden></div>';
  };

  PuzzleView.prototype.destroy = function () {
    this.root.removeEventListener('click', this.onClick);
    root.removeEventListener('resize', this.onResize);
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
    const t = e.target.closest('[data-slot],[data-card],[data-act],[data-ev],[data-proof-reason]');
    if (!t || t.disabled) return;
    if (t.hasAttribute('data-slot')) return this.selectSlot(t.getAttribute('data-slot'));
    if (t.hasAttribute('data-card')) return this.placeCard(t.getAttribute('data-card'));
    if (t.hasAttribute('data-ev')) return this.showEvidence(t.getAttribute('data-ev'), false);
    if (t.hasAttribute('data-proof-reason')) return this.showEvidence(t.getAttribute('data-proof-reason'), true);
    switch (t.getAttribute('data-act')) {
      case 'home': return this.nav.home();
      case 'stages': return this.nav.stages();
      case 'next': return this.nav.next();
      case 'next-stage': return this.nav.nextStage();
      case 'hint': return this.hint();
      case 'undo': return this.undo();
      case 'close-tray': return this.setTray(false);
      case 'reset': return this.resetCards();
      case 'check': return this.check();
      case 'restart': return this.restart();
    }
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

  PuzzleView.prototype.undo = function () {
    if (this.puzzle.clearActive()) {
      PH.sound.play('tap');
      this.render();
    }
  };

  PuzzleView.prototype.resetCards = function () {
    if (this.puzzle.clearAll()) {
      PH.sound.play('tap');
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
    if (!sc || !el || sc.scrollHeight <= sc.clientHeight) return;
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
    const stageBefore = PH.storage.stageStats(this.problem.stage, 'puzzle').complete;
    const saved = PH.storage.recordClear(this.problem.id, z.stars, z.misses, 'puzzle');
    this.improved = saved.improved;
    this.stageCleared = !stageBefore && PH.storage.stageStats(this.problem.stage, 'puzzle').complete;
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
      triangles: clear, interactive: false,
    });
  };

  PuzzleView.prototype.blank = function (slotId) {
    const z = this.puzzle;
    const s = z.slot(slotId);
    const card = z.cardIn(slotId);
    const status = z.result && z.result.slotStatus[slotId];
    const cls = ['pz-blank', 'kind-' + s.kind];
    if (z.active === slotId) cls.push('is-active');
    if (card) cls.push('is-filled');
    if (status === 'ng') cls.push('is-ng');
    if (status === 'ok') cls.push('is-ok');
    return '<button class="' + cls.join(' ') + '" data-slot="' + slotId + '" aria-label="' + esc(s.label) + '">' +
      esc(card ? card.text : PLACEHOLDER[s.kind]) + '</button>';
  };

  PuzzleView.prototype.renderProof = function () {
    const z = this.puzzle;
    const p = this.problem;
    const proof = PH.buildProof(p);
    const self = this;
    let rows;
    if (z.type === 'build') {
      rows = p.evidence.map(function (_, i) {
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
    this.ref('proof').innerHTML =
      '<p class="proof-intro">' + esc(proof.intro) + '</p>' +
      '<ol class="pz-lines">' + rows + '</ol>' +
      '<p class="proof-sum">' + esc(proof.summary) + '</p>' +
      '<div class="pz-condline">' + this.blank('cond') + '<span>ので、</span></div>' +
      '<p class="proof-concl">' + esc(proof.conclusion) + '</p>';
  };

  PuzzleView.prototype.renderTray = function () {
    const z = this.puzzle;
    const s = z.slot(z.active);
    const current = z.placed[z.active];
    const kindName = { eq: '等式', reason: '理由', cond: '合同条件' }[s.kind];
    this.ref('trayHead').innerHTML = '<span class="pz-tray-target">' + esc(s.label) + '</span>' +
      '<span class="pz-tray-note">に入れる' + kindName + 'をタップ</span>';
    const cards = z.cardsForActive();
    this.ref('tray').hidden = !this.trayOpen;
    const box = this.ref('cards');
    box.className = 'pz-cards kind-' + s.kind;
    box.innerHTML = cards.map(function (c) {
      return '<button class="pz-card' + (c.id === current ? ' is-current' : '') + '" data-card="' + c.id + '">' + esc(c.text) + '</button>';
    }).join('');
    const empty = z.emptyCount();
    const btn = this.ref('checkBtn');
    btn.disabled = empty > 0;
    btn.textContent = empty > 0 ? '答え合わせ（あと' + empty + 'か所）' : '答え合わせ';
    this.root.querySelector('[data-act="undo"]').disabled = !current;

    const fb = this.ref('feedback');
    const res = z.result;
    if (!res) {
      fb.innerHTML = empty > 0
        ? '<p class="pz-msg-guide">解答欄をタップして、カードを選ぼう。</p>'
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
            '<div class="result-meta"><span>ミス ' + z.misses + '回</span><span class="sep">・</span><span>ヒント ' + z.hintsUsed + '回</span></div>' +
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
        guide +
        '<div class="result-body">' +
          '<div class="card proof-sheet">' +
            '<h2 class="proof-title">完成した証明</h2>' +
            '<p class="small-note">式や理由をタップすると、図の場所が光るよ</p>' +
            '<p class="proof-intro">' + esc(proof.intro) + '</p>' +
            '<ol class="proof-lines">' + lines + '</ol>' +
            '<p class="proof-sum">' + esc(proof.summary) + '</p>' +
            '<p class="proof-cond"><strong>' + esc(proof.condition) + '</strong>ので、</p>' +
            '<p class="proof-concl">' + esc(proof.conclusion) + '</p>' +
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
