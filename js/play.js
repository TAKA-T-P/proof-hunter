/*
 * play.js — 問題プレイ画面（DOM・イベント・演出）
 *
 * 状態は PH.Game が持ち、この画面は Game を操作して描画し直すだけにする。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const doc = root.document;
  const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'];

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function starsText(n) {
    return '★★★'.slice(0, n) + '☆☆☆'.slice(0, 3 - n);
  }

  function triName(tri) { return '△' + tri.join(''); }

  // 印パレットのアイコン
  function toolIcon(kind, n) {
    if (kind === 'seg') {
      let ticks = '';
      for (let i = 0; i < n; i++) {
        const x = 20 + (i - (n - 1) / 2) * 5;
        ticks += '<line x1="' + x + '" y1="7" x2="' + x + '" y2="21"/>';
      }
      return '<svg viewBox="0 0 40 28" aria-hidden="true"><line x1="3" y1="14" x2="37" y2="14"/>' + ticks + '</svg>';
    }
    let arcs = '';
    for (let i = 0; i < n; i++) {
      const r = 12 + i * 5;
      const a = 0.62;
      arcs += '<path d="M ' + (6 + r) + ' 24 A ' + r + ' ' + r + ' 0 0 0 ' +
        (6 + r * Math.cos(a)).toFixed(1) + ' ' + (24 - r * Math.sin(a)).toFixed(1) + '"/>';
    }
    return '<svg viewBox="0 0 40 28" aria-hidden="true"><polyline points="38,24 6,24 34,4"/>' + arcs + '</svg>';
  }

  const MARK_TOOLS = [['seg', 1], ['seg', 2], ['seg', 3], ['ang', 1], ['ang', 2]];

  // 証明する三角形を1つだけ取り出した小さな図（向きは元の図のまま。重ねる演出はしない）
  // 頂点は対応順の番号ごとに同じ色（vx-0〜2）で表示する
  function miniTriangle(fig, tri, idx) {
    const pts = tri.map(function (n) { return fig.points[n]; });
    const xs = pts.map(function (q) { return q.x; }), ys = pts.map(function (q) { return q.y; });
    const pad = 30;
    const minX = Math.min.apply(null, xs) - pad, minY = Math.min.apply(null, ys) - pad;
    const w = Math.max.apply(null, xs) - minX + pad, h = Math.max.apply(null, ys) - minY + pad;
    const cx = xs.reduce(function (a, b) { return a + b; }) / 3, cy = ys.reduce(function (a, b) { return a + b; }) / 3;
    let body = '<polygon class="tri tri-' + idx + '" points="' + pts.map(function (q) { return q.x + ',' + q.y; }).join(' ') + '"/>';
    pts.forEach(function (q, k) {
      const dx = q.x - cx, dy = q.y - cy, l = Math.hypot(dx, dy) || 1;
      body += '<circle class="vx-dot vx-' + k + '" cx="' + q.x + '" cy="' + q.y + '" r="7"/>' +
        '<text class="vx-label vx-' + k + '" x="' + (q.x + dx / l * 20).toFixed(1) + '" y="' + (q.y + dy / l * 20).toFixed(1) + '">' + esc(tri[k]) + '</text>';
    });
    return '<svg class="tri-mini" viewBox="' + [minX, minY, w, h].map(function (n) { return n.toFixed(1); }).join(' ') + '" aria-hidden="true">' + body + '</svg>';
  }

  // ---------------------------------------------------------------------

  function PlayController(container, problem, nav) {
    this.root = container;
    this.problem = problem;
    this.nav = nav;
    this.game = new PH.Game(problem);
    this.flashKeys = [];
    this.flashLines = [];
    this.flashTimer = null;
    this.triCheck = false;      // 「三角形を確認」表示中
    this.stageCleared = false;  // この問題のクリアで初めてステージクリアになった
    this.timers = [];
    this.message = null;
    this.newSlot = null;
    this.shake = false;
    this.resultBuilt = false;
    this.resultFlash = [];
    this.build();
    this.onClick = this.handleClick.bind(this);
    this.onKey = this.handleKey.bind(this);
    this.root.addEventListener('click', this.onClick);
    this.root.addEventListener('keydown', this.onKey);
    // 画面の回転などで図の表示サイズが変わったら、操作領域の太さを計算し直す
    this.onResize = this.renderFigures.bind(this);
    root.addEventListener('resize', this.onResize);
    PH.storage.setLastProblem(problem.id);
    this.render();
  }

  PlayController.prototype.ref = function (name) {
    return this.root.querySelector('[data-ref="' + name + '"]');
  };

  PlayController.prototype.build = function () {
    const p = this.problem;
    this.root.innerHTML =
      '<header class="play-header">' +
        '<button class="head-btn" data-act="home" aria-label="ホームに戻る"><span class="ico">⌂</span><span class="lbl">ホーム</span></button>' +
        '<div class="play-title"><span class="play-no">問題' + esc(p.number) + '</span><span class="play-name">' + esc(p.title) + '</span></div>' +
        '<div class="counter" data-ref="counter" aria-live="polite"><span class="counter-label">根拠</span><b data-ref="count">0</b><span>/' + p.evidence.length + '</span></div>' +
        '<button class="head-btn head-hint" data-act="hint" aria-label="ヒント"><span class="ico">💡</span><span class="lbl">ヒント</span></button>' +
      '</header>' +
      // スマホ縦画面: .play-stage（図＋ボタン）を上に固定し、.play-scroll（問題文・解答欄）だけスクロール
      // PC・横画面: .play-scroll は display: contents になり、グリッドで2カラム配置
      '<div class="play-body" data-ref="body">' +
        '<div class="play-stage">' +
          '<div class="card figure-card" data-ref="figureCard">' +
            '<div class="mode-badge" data-ref="modeBadge"></div>' +
            '<svg class="figure" data-ref="svg" role="group" aria-label="問題の図"></svg>' +
            '<button class="tri-btn" data-act="tri-check" aria-pressed="false">△ 三角形を確認</button>' +
            '<div class="pop-msg" data-ref="popMsg" aria-hidden="true"></div>' +
          '</div>' +
          '<div class="toolbar" role="toolbar" aria-label="操作">' +
            '<button class="tool" data-mode="side"><span class="ico ico-glyph">／</span><span class="lbl">辺選択</span></button>' +
            '<button class="tool" data-mode="angle"><span class="ico ico-glyph">∠</span><span class="lbl">角選択</span></button>' +
            '<button class="tool" data-mode="mark"><span class="ico">🖍️</span><span class="lbl">印つけ</span></button>' +
            '<button class="tool" data-mode="erase"><span class="ico">🧽</span><span class="lbl">消す</span></button>' +
            '<button class="tool" data-act="hint"><span class="ico">💡</span><span class="lbl">ヒント</span></button>' +
            '<button class="tool" data-act="restart"><span class="ico">↺</span><span class="lbl">最初から</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="play-scroll" data-ref="scroll">' +
          '<div class="card statement">' +
            '<p class="statement-text">' + esc(p.statement) + '</p>' +
            '<div class="cond-row"><span class="tag tag-given">仮定</span><span class="cond-text">' + p.given.map(esc).join('、') + '</span></div>' +
            '<div class="cond-row"><span class="tag tag-goal">結論</span><span class="cond-text">' + esc(p.conclusion) + '</span></div>' +
            '<p class="cond-note"><span class="tag-mini tag-given">仮定</span>証明の根拠に使える　<span class="tag-mini tag-goal">結論</span>証明するゴール（根拠には使えない）</p>' +
          '</div>' +
          '<div class="play-side">' +
            '<div class="card panel" data-ref="panel"></div>' +
            '<div class="slots-wrap"><div class="slots" data-ref="slots"></div><p class="slots-note">見つけた根拠をタップすると、図の場所が光るよ</p></div>' +
            '<div class="stats" data-ref="stats"></div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="result" data-ref="result" hidden></div>';
  };

  PlayController.prototype.destroy = function () {
    this.root.removeEventListener('click', this.onClick);
    this.root.removeEventListener('keydown', this.onKey);
    root.removeEventListener('resize', this.onResize);
    clearTimeout(this.flashTimer);
    this.timers.forEach(clearTimeout);
    PH.hints.hide(doc.getElementById('hint-popup'));
    PH.hints.hide(doc.getElementById('tri-popup'));
    const ov = doc.getElementById('success-overlay');
    if (ov) { ov.hidden = true; ov.classList.remove('show'); }
    this.root.innerHTML = '';
  };

  PlayController.prototype.later = function (fn, ms) {
    const t = setTimeout(fn, ms);
    this.timers.push(t);
    return t;
  };

  // ---- 入力 -------------------------------------------------------------

  PlayController.prototype.handleKey = function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest && e.target.closest('[data-key]');
    if (!t) return;
    e.preventDefault();
    this.tapElement(t.getAttribute('data-key'));
  };

  PlayController.prototype.handleClick = function (e) {
    const t = e.target.closest('[data-key],[data-act],[data-mode],[data-reason],[data-cond],[data-tool],[data-ev],[data-proof-reason]');
    if (!t || t.disabled) return;
    if (t.hasAttribute('data-key')) return this.tapElement(this.resolveTapKey(t, e.clientX, e.clientY));
    if (t.hasAttribute('data-mode')) return this.setMode(t.getAttribute('data-mode'));
    if (t.hasAttribute('data-reason')) return this.selectReason(t.getAttribute('data-reason'));
    if (t.hasAttribute('data-cond')) return this.selectCondition(t.getAttribute('data-cond'));
    if (t.hasAttribute('data-tool')) return this.selectTool(t.getAttribute('data-tool'));
    if (t.hasAttribute('data-ev')) return this.showEvidence(t.getAttribute('data-ev'));
    if (t.hasAttribute('data-proof-reason')) return this.showReason(t.getAttribute('data-proof-reason'));
    switch (t.getAttribute('data-act')) {
      case 'home': return this.nav.home();
      case 'list': return this.nav.list();
      case 'stages': return this.nav.stages();
      case 'next': return this.nav.next();
      case 'next-stage': return this.nav.nextStage();
      case 'tri-check': return this.setTriCheck(!this.triCheck);
      case 'hint': return this.hint();
      case 'restart': return this.restart();
      case 'clear-sel': return this.clearSelection();
      case 'confirm': return this.confirm();
      case 'confirm-cond': return this.confirmCondition();
      case 'clear-marks': return this.clearMarks();
    }
  };

  /*
   * 辺の操作領域は太いので、2本の辺が鋭い角度で交わる頂点の近くでは重なる。
   * 辺をタップしたときは、重なりの上下関係ではなく「タップした点にいちばん近い辺」を選ぶ。
   */
  PlayController.prototype.resolveTapKey = function (target, clientX, clientY) {
    const key = target.getAttribute('data-key');
    if (!target.classList.contains('hit-seg') || clientX == null) return key;
    const svg = this.ref('svg');
    const ctm = svg && svg.getScreenCTM && svg.getScreenCTM();
    if (!ctm) return key;
    const q = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    let best = key, bestD = Infinity;
    PH.geometry.getElements(this.problem.figure).segments.forEach(function (s) {
      const d = PH.geometry.distToSegment(q, s.h1, s.h2);
      if (d < bestD) { bestD = d; best = s.key; }
    });
    return best;
  };

  PlayController.prototype.say = function (text, type) {
    this.message = text ? { text: text, type: type || 'info' } : null;
  };

  PlayController.prototype.tapElement = function (key) {
    const g = this.game;
    if (g.phase === 'clear') return;
    const r = g.tap(key);
    if (r.type === 'ignored') {
      if (r.message) this.say(r.message, 'info');
      else if (g.phase === 'congruence') this.say('3つの根拠はそろったよ。合同条件を選ぼう！', 'info');
    } else {
      PH.sound.play('tap');
      this.say(null);
    }
    this.render();
  };

  PlayController.prototype.setMode = function (mode) {
    if (this.game.phase === 'clear') return;
    if (this.game.setMode(mode)) {
      PH.sound.play('tap');
      this.say(null);
    }
    this.render();
  };

  PlayController.prototype.selectReason = function (id) {
    if (this.game.selectReason(id)) {
      PH.sound.play('tap');
      this.say(null);
      this.render();
    }
  };

  PlayController.prototype.selectCondition = function (id) {
    if (this.game.selectCondition(id)) {
      PH.sound.play('tap');
      this.say(null);
      this.render();
    }
  };

  PlayController.prototype.selectTool = function (v) {
    const parts = v.split(':');
    this.game.setMarkTool(parts[0], Number(parts[1]));
    this.say(null);
    PH.sound.play('tap');
    this.render();
  };

  PlayController.prototype.clearSelection = function () {
    this.game.clearSelection();
    this.say(null);
    this.render();
  };

  PlayController.prototype.clearMarks = function () {
    this.game.clearUserMarks();
    this.say('自分でつけた印をすべて消したよ。', 'info');
    this.render();
  };

  PlayController.prototype.restart = function () {
    this.game.reset();
    this.resultBuilt = false;
    this.stageCleared = false;
    this.newSlot = null;
    this.flashKeys = [];
    this.flashLines = [];
    this.say(null);
    this.setTriCheck(false);
    PH.hints.hide(doc.getElementById('hint-popup'));
    PH.storage.setLastProblem(this.problem.id);
    this.render();
    this.scrollToTop();
  };

  // ページ全体と、スマホ縦画面で独立してスクロールする領域を先頭に戻す
  PlayController.prototype.scrollToTop = function () {
    root.scrollTo(0, 0);
    this.ref('scroll').scrollTop = 0;
    this.ref('result').scrollTop = 0;
    const rs = this.ref('resultScroll');
    if (rs) rs.scrollTop = 0;
  };

  PlayController.prototype.flash = function (keys, ms, lines) {
    const self = this;
    this.flashKeys = keys.slice();
    this.flashLines = (lines || []).slice();
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(function () {
      self.flashKeys = [];
      self.flashLines = [];
      self.renderFigures();
    }, ms || 1300);
    this.renderFigures();
  };

  // 根拠の等式：その辺・角を光らせる
  PlayController.prototype.showEvidence = function (id) {
    const keys = this.game.evidenceKeys(id);
    if (keys.length) {
      PH.sound.play('tap');
      this.flash(keys, 1400);
    }
  };

  // 根拠の理由：辺・角に加えて、平行線の錯角・同位角なら使った平行線も光らせる
  PlayController.prototype.showReason = function (id) {
    const ev = this.game.evidenceById(id);
    if (!ev) return;
    let lines = [];
    if (ev.reason === 'alternate' || ev.reason === 'corresponding') {
      const group = ev.parallelGroup || 1;
      lines = PH.geometry.parallelLines(this.problem.figure)
        .filter(function (pl) { return pl.group === group; })
        .map(function (pl) { return [pl.from, pl.to]; });
    }
    PH.sound.play('tap');
    this.flash(this.game.evidenceKeys(id), 1600, lines);
  };

  // 「三角形を確認」：対象の2つの三角形を色分けし、頂点の対応を表示する
  PlayController.prototype.setTriCheck = function (on) {
    this.triCheck = !!on;
    const popup = doc.getElementById('tri-popup');
    if (this.triCheck) {
      PH.hints.hide(doc.getElementById('hint-popup'));
      this.fillTriPopup(popup);
      popup.hidden = false;
      popup.classList.remove('pop');
      void popup.offsetWidth;
      popup.classList.add('pop');
      PH.sound.play('tap');
    } else {
      PH.hints.hide(popup);
    }
    const btn = this.root.querySelector('.tri-btn');
    if (btn) btn.setAttribute('aria-pressed', String(this.triCheck));
    this.renderFigures();
  };

  PlayController.prototype.fillTriPopup = function (popup) {
    const p = this.problem;
    const t1 = p.triangles[0], t2 = p.triangles[1];
    const pairs = [0, 1, 2].map(function (k) {
      return '<span class="vx-pair"><span class="vx-chip vx-' + k + '">' + esc(t1[k]) + '</span>↔<span class="vx-chip vx-' + k + '">' + esc(t2[k]) + '</span></span>';
    }).join('');
    popup.querySelector('.tri-body').innerHTML =
      '<div class="tri-pair">' +
        '<figure><figcaption class="tri-cap tri-cap-0">' + triName(t1) + '</figcaption>' + miniTriangle(p.figure, t1, 0) + '</figure>' +
        '<span class="tri-and">と</span>' +
        '<figure><figcaption class="tri-cap tri-cap-1">' + triName(t2) + '</figcaption>' + miniTriangle(p.figure, t2, 1) + '</figure>' +
      '</div>' +
      '<div class="tri-map"><span class="tri-map-label">対応する頂点</span>' + pairs + '</div>' +
      '<p class="tri-note">結論 <b>' + esc(p.conclusion) + '</b> の文字の順番が、頂点の対応を表しているよ。同じ色の頂点どうしが対応するよ。</p>';
  };

  PlayController.prototype.popMessage = function (text) {
    const el = this.ref('popMsg');
    if (!el) return;
    el.textContent = text;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
  };

  PlayController.prototype.hint = function () {
    const g = this.game;
    const popup = doc.getElementById('hint-popup');
    if (g.phase === 'clear') return;
    const h = g.useHint();
    if (this.triCheck) this.setTriCheck(false);
    PH.sound.play('tap');
    PH.hints.show(popup, h, g.hintsUsed);
    if (h && h.focus.length) this.flash(h.focus, 1800);
    this.render();
  };

  PlayController.prototype.confirm = function () {
    const g = this.game;
    const p = this.problem;
    const r = g.confirmEvidence();
    const what = r.kind === 'ang' ? '角' : '辺';
    switch (r.status) {
      case 'incomplete':
        return;
      case 'correct': {
        const ev = r.evidence;
        PH.sound.play('get');
        this.newSlot = ev.id;
        this.popMessage('根拠発見！');
        this.flash(g.evidenceKeys(ev.id), 1100);
        PH.hints.hide(doc.getElementById('hint-popup'));
        this.bumpCounter = true;
        if (r.complete) {
          this.say('3つの根拠がそろった！ 合同条件を見極めよう！', 'ok');
          this.focusPanel = true;
        } else {
          this.say('根拠発見！ ' + ev.label + '（' + PH.REASONS[ev.reason].short + '）', 'ok');
        }
        break;
      }
      case 'duplicate':
        this.say('この根拠はもう見つけているよ！', 'info');
        break;
      case 'irrelevant':
        PH.sound.play('soft');
        this.say('たしかに等しいね！ でも、今回の証明では使わない関係だよ。ほかの根拠を探そう！', 'info');
        break;
      case 'wrong-reason':
        this.say('等しい' + what + 'は見つけられたね！ でも、理由をもう一度考えてみよう。', 'ng');
        break;
      case 'from-conclusion':
        this.say('それは' + p.conclusion + 'が証明できたら言えることだよ！ 結論はまだ根拠に使えないよ。', 'ng');
        break;
      case 'not-common': {
        this.say('その' + what + 'は、' + triName(p.triangles[0]) + 'と' + triName(p.triangles[1]) + 'の両方にふくまれているかな？ 共通な' + what + 'ではないみたい。', 'ng');
        break;
      }
      default:
        this.say('この2つが等しいとは、まだ言えないよ！', 'ng');
    }
    if (r.miss) {
      PH.sound.play('wrong');
      this.shake = true;
    }
    this.render();
  };

  PlayController.prototype.confirmCondition = function () {
    const g = this.game;
    const r = g.confirmCondition();
    if (r.status === 'incomplete') return;
    if (!r.ok) {
      PH.sound.play('wrong');
      this.shake = true;
      this.say('集めた3つの根拠をもう一度確認しよう！', 'ng');
      this.render();
      return;
    }
    PH.sound.play('success');
    PH.hints.hide(doc.getElementById('hint-popup'));
    this.setTriCheck(false);
    const stageBefore = PH.storage.stageStats(this.problem.stage).complete;
    const saved = PH.storage.recordClear(this.problem.id, g.stars, g.misses);
    this.improved = saved.improved;
    // そのステージの全問題がこのクリアで初めてそろったときだけ「STAGE CLEAR！」を出す
    this.stageCleared = !stageBefore && PH.storage.stageStats(this.problem.stage).complete;
    this.say(null);
    this.showSuccess();
    this.render();
    this.scrollToTop();
  };

  PlayController.prototype.showOverlay = function (title, sub, cls) {
    const ov = doc.getElementById('success-overlay');
    if (!ov) return;
    ov.querySelector('.success-text').textContent = title;
    ov.querySelector('.success-concl').textContent = sub;
    ov.className = 'success-overlay ' + (cls || '');
    ov.hidden = false;
    void ov.offsetWidth;
    ov.classList.add('show');
  };

  PlayController.prototype.showSuccess = function () {
    const self = this;
    const ov = doc.getElementById('success-overlay');
    if (!ov) return;
    this.showOverlay('証明成功！', this.problem.conclusion);
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

  PlayController.prototype.render = function () {
    const g = this.game;
    const clear = g.phase === 'clear';
    this.ref('body').hidden = clear;
    this.ref('result').hidden = !clear;
    this.ref('count').textContent = String(g.found.length);
    this.root.querySelectorAll('.head-hint').forEach(function (b) { b.disabled = clear; });
    if (clear) {
      if (!this.resultBuilt) this.buildResult();
      this.renderFigures();
      return;
    }
    this.renderToolbar();
    this.renderPanel();
    this.renderSlots();
    this.ref('stats').textContent = 'ミス ' + g.misses + '回 ・ ヒント ' + g.hintsUsed + '回';
    this.renderFigures();
    if (this.shake) {
      const panel = this.ref('panel');
      panel.classList.remove('shake');
      void panel.offsetWidth;
      panel.classList.add('shake');
      this.shake = false;
    }
    if (this.bumpCounter) {
      const c = this.ref('counter');
      c.classList.remove('bump');
      void c.offsetWidth;
      c.classList.add('bump');
      this.bumpCounter = false;
    }
    if (this.focusPanel) {
      // 3つそろったら合同条件の選択欄が見えるようにする（スマホでは下の領域だけスクロール）
      const panel = this.ref('panel');
      panel.classList.add('glow');
      if (panel.scrollIntoView) panel.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      this.focusPanel = false;
    }
  };

  PlayController.prototype.renderFigures = function () {
    const g = this.game;
    if (g.phase === 'clear') {
      const mini = this.ref('miniSvg');
      if (mini) {
        PH.renderer.render(mini, this.problem, {
          flash: this.flashKeys, flashLines: this.flashLines, autoMarks: g.autoMarks(), triangles: true, interactive: false,
        });
      }
      return;
    }
    const card = this.ref('figureCard');
    card.className = 'card figure-card mode-' + g.mode;
    const badge = { side: '', angle: '∠ 角選択：角の内側をタップ', mark: '🖍️ 印つけ：下書き用（判定なし）', erase: '🧽 消す：印をタップ' }[g.mode];
    const mb = this.ref('modeBadge');
    mb.textContent = badge;
    mb.hidden = !badge;
    PH.renderer.render(this.ref('svg'), this.problem, {
      selection: g.selection,
      flash: this.flashKeys,
      autoMarks: g.autoMarks(),
      userMarks: g.userMarks,
      flashLines: this.flashLines,
      triangles: this.triCheck ? 'check' : false,
      interactive: true,
      // 辺選択では辺だけ、角選択では角だけ、印つけでは選んだ印の種類だけ、消すでは両方がタップに反応する
      hit: g.mode === 'erase' ? { seg: true, ang: true }
        : g.mode === 'mark' ? { seg: g.markTool.kind === 'seg', ang: g.markTool.kind === 'ang' }
        : { seg: g.mode === 'side', ang: g.mode === 'angle' },
      angleGuide: g.mode === 'angle' && g.phase === 'collect',
    });
  };

  PlayController.prototype.renderToolbar = function () {
    const g = this.game;
    this.root.querySelectorAll('.toolbar [data-mode]').forEach(function (b) {
      const m = b.getAttribute('data-mode');
      b.setAttribute('aria-pressed', String(g.mode === m));
      b.disabled = m !== 'mark' && m !== 'erase' && g.phase !== 'collect';
    });
  };

  PlayController.prototype.feedbackHtml = function () {
    const m = this.message;
    return '<p class="feedback ' + (m ? 'fb-' + m.type : '') + '" aria-live="polite">' + (m ? esc(m.text) : '') + '</p>';
  };

  PlayController.prototype.renderPanel = function () {
    const g = this.game;
    const panel = this.ref('panel');
    let html = '';

    if (g.mode === 'mark' || g.mode === 'erase') {
      if (g.mode === 'mark') {
        html += '<div class="panel-head">🖍️ 印つけモード</div>' +
          '<p class="panel-note">印の種類を1つ選ぼう。「辺の印」なら辺だけ、「角の印」なら角だけに印をつけられるよ。印は下書き用で、正誤判定はしないよ。</p>' +
          '<div class="palette">' +
            '<div class="palette-row"><span class="palette-label">辺の印</span>' +
              MARK_TOOLS.filter(function (t) { return t[0] === 'seg'; }).map(function (t) {
                return '<button class="tool-mark" data-tool="seg:' + t[1] + '" aria-pressed="' + (g.markTool.kind === 'seg' && g.markTool.n === t[1]) + '" aria-label="辺の印 ' + t[1] + '本線">' + toolIcon('seg', t[1]) + '</button>';
              }).join('') + '</div>' +
            '<div class="palette-row"><span class="palette-label">角の印</span>' +
              MARK_TOOLS.filter(function (t) { return t[0] === 'ang'; }).map(function (t) {
                return '<button class="tool-mark" data-tool="ang:' + t[1] + '" aria-pressed="' + (g.markTool.kind === 'ang' && g.markTool.n === t[1]) + '" aria-label="角の印 円弧' + t[1] + '本">' + toolIcon('ang', t[1]) + '</button>';
              }).join('') + '</div>' +
          '</div>';
      } else {
        html += '<div class="panel-head">🧽 消すモード</div>' +
          '<p class="panel-note">消したい印がついた辺や角をタップしよう。見つけた根拠の印（緑）は消えないよ。</p>';
      }
      html += '<div class="panel-actions">' +
        '<button class="btn" data-act="clear-marks">印をすべて消す</button>' +
        '<button class="btn btn-primary" data-mode="answer">解答にもどる</button>' +
        '</div>' + this.feedbackHtml();
      panel.innerHTML = html;
      return;
    }

    if (g.phase === 'congruence') {
      html += '<div class="panel-head">⚖️ 合同条件を見極めよう！</div>' +
        '<p class="panel-note">3つの根拠がそろった！ どの合同条件で <b>' + esc(this.problem.conclusion) + '</b> といえるかな？</p>' +
        '<div class="choices conds">' +
          PH.CONDITION_ORDER.map(function (id, i) {
            return '<button class="choice" data-cond="' + id + '" aria-pressed="' + (g.condition === id) + '">' +
              '<span class="choice-no">' + CIRCLED[i] + '</span>' + esc(PH.CONDITIONS[id].label) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="panel-actions"><button class="btn btn-confirm btn-wide" data-act="confirm-cond"' + (g.condition ? '' : ' disabled') + '>決定</button></div>' +
        this.feedbackHtml();
      panel.innerHTML = html;
      return;
    }

    const what = g.mode === 'angle' ? '角' : '辺';
    const cand = g.candidate();
    const n = g.selection.length;
    const same = g.isSameTwice();
    let note;
    if (n === 0) note = g.mode === 'angle'
      ? '等しいと思う角を、角の内側をタップして選ぼう（共通な角は同じ角を2回）。辺を選ぶときは「辺選択」へ。'
      : '等しいと思う辺をタップしよう（共通な辺は同じ辺を2回）。角を選ぶときは「角選択」へ。';
    else if (n === 1) note = '等しいと思う2つ目の' + what + 'をタップしよう。同じ' + what + 'をもう一度タップすると共通な' + what + 'になるよ。';
    else if (!g.reason) note = same ? '共通な' + what + 'として選んだよ（もう一度タップで解除）。理由を選ぼう。' : '等しい理由を選ぼう。';
    else note = '「根拠を確定」を押そう！';

    const head = g.mode === 'angle' ? '∠ 等しい角をさがそう' : '／ 等しい辺をさがそう';
    html += '<div class="panel-head">' + head + '</div>' +
      '<p class="panel-note">' + note + '</p>' +
      '<div class="equation' + (n === 2 ? ' is-ready' : '') + (same ? ' is-common' : '') + '" aria-label="等式の候補">' +
        '<span class="eq-part' + (cand[0] ? ' filled' : '') + '">' + esc(cand[0] || '？') + '</span>' +
        '<span class="eq-sign">＝</span>' +
        '<span class="eq-part' + (cand[1] ? ' filled' : '') + '">' + esc(cand[1] || '？') + '</span>' +
      '</div>' +
      '<div class="reasons-label">等しい理由</div>' +
      '<div class="choices reasons" role="group" aria-label="等しい理由">' +
        g.availableReasons().map(function (id) {
          return '<button class="choice" data-reason="' + id + '" aria-pressed="' + (g.reason === id) + '"' + (n === 2 ? '' : ' disabled') + '>' +
            esc(PH.REASONS[id].label) + '</button>';
        }).join('') +
      '</div>' +
      '<div class="panel-actions">' +
        '<button class="btn" data-act="clear-sel"' + (n ? '' : ' disabled') + '>選択解除</button>' +
        '<button class="btn btn-confirm" data-act="confirm"' + (g.canConfirm() ? '' : ' disabled') + '>根拠を確定</button>' +
      '</div>' + this.feedbackHtml();
    panel.innerHTML = html;
  };

  PlayController.prototype.renderSlots = function () {
    const g = this.game;
    const self = this;
    const total = g.total();
    let html = '';
    for (let i = 0; i < total; i++) {
      const id = g.found[i];
      if (id) {
        const ev = g.evidenceById(id);
        html += '<button class="slot filled' + (self.newSlot === id ? ' is-new' : '') + '" data-ev="' + id + '" aria-label="根拠' + CIRCLED[i] + ' ' + esc(ev.label) + ' ' + esc(PH.REASONS[ev.reason].label) + '">' +
          '<span class="slot-eq">' + esc(ev.label) + '</span>' +
          '<span class="slot-reason">' + esc(PH.REASONS[ev.reason].short) + '</span></button>';
      } else {
        html += '<div class="slot empty"><span class="slot-q">？</span><span class="slot-label">根拠' + CIRCLED[i] + '</span></div>';
      }
    }
    const slots = this.ref('slots');
    slots.innerHTML = html;
    slots.classList.toggle('complete', g.found.length === total);
    this.newSlot = null;
  };

  PlayController.prototype.buildResult = function () {
    const g = this.game;
    const p = this.problem;
    const proof = PH.buildProof(p);
    const stage = PH.getStage(p.stage);
    const list = PH.stageProblems(p.stage);
    const hasNext = list.indexOf(p) < list.length - 1;
    const nextStage = PH.getStage(p.stage + 1);
    const lines = proof.lines.map(function (l) {
      return '<li class="proof-line">' +
        '<button class="pl-reason" data-proof-reason="' + l.evidenceId + '">' + esc(l.reason) + '</button>' +
        '<button class="pl-eq" data-ev="' + l.evidenceId + '">' + esc(l.equation) + '<span class="pl-no">……' + l.no + '</span></button>' +
        '</li>';
    }).join('');

    let guide = '';
    if (!hasNext) {
      guide = nextStage
        ? '<p class="result-guide">STAGE ' + stage.id + 'の問題はこれで最後！ 次は <b>STAGE ' + nextStage.id + '「' + esc(nextStage.title) + '」</b> に挑戦しよう！</p>'
        : '<p class="result-guide">これで最後のステージの最後の問題だよ。ステージ選択から、★★★をめざして挑戦しよう！</p>';
    }

    // スマホ縦画面：.result-top（図・結果カード・ボタン）を固定し、.result-scroll（証明文・解説）だけスクロール
    this.ref('result').innerHTML =
      '<div class="result-top">' +
        '<div class="card result-figure"><svg class="figure mini" data-ref="miniSvg" aria-label="証明した図"></svg></div>' +
        '<div class="result-side">' +
          '<div class="result-banner">' +
            '<div class="result-title">証明成功！</div>' +
            '<div class="result-stars" aria-label="評価 星' + g.stars + 'つ">' + starsText(g.stars) + '</div>' +
            '<div class="result-meta"><span>ミス ' + g.misses + '回</span><span class="sep">・</span><span>ヒント ' + g.hintsUsed + '回</span></div>' +
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
          ? '<div class="stage-clear-banner"><span class="scb-title">STAGE CLEAR！</span><span class="scb-sub">STAGE ' + stage.id + '「' + esc(stage.title) + '」の問題をすべてクリアしたよ！</span></div>'
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

  PH.play = {
    mount: function (container, problem, nav) {
      PH.play.unmount();
      current = new PlayController(container, problem, nav);
      return current;
    },
    unmount: function () {
      if (current) current.destroy();
      current = null;
    },
    current: function () { return current; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
