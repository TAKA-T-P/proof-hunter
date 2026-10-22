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
            '<button class="tri-btn" data-act="tri-check" aria-pressed="false" data-ref="triBtn">△ 三角形を確認</button>' +
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
            '<div class="facts-wrap" data-ref="facts"></div>' +
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
    const t = e.target.closest('[data-key],[data-tri],[data-vx],[data-step-opt],[data-cmp],[data-step-go],[data-fact],[data-act],[data-mode],[data-reason],[data-cond],[data-tool],[data-ev],[data-proof-reason]');
    if (!t || t.disabled) return;
    if (t.hasAttribute('data-step-opt')) return this.chooseStepOption(t.getAttribute('data-step-opt'));
    if (t.hasAttribute('data-cmp')) { const v = t.getAttribute('data-cmp').split(':'); return this.pickPart(v[0], v[1]); }
    if (t.hasAttribute('data-step-go')) return this.selectStep(t.getAttribute('data-step-go'));
    if (t.hasAttribute('data-fact')) return this.flashStep(t.getAttribute('data-fact'));
    if (t.hasAttribute('data-key')) return this.tapFromFigure(t, e.clientX, e.clientY);
    if (t.hasAttribute('data-tri')) return this.tapTriangleFromFigure(t, e.clientX, e.clientY);
    if (t.hasAttribute('data-vx')) return this.pressVertex(t.getAttribute('data-vx'));
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
      case 'tri-back': return this.triAction('back');
      case 'tri-clear': return this.triAction('clear');
      case 'confirm-tri': return this.confirmTriangles();
      case 'confirm-final': return this.confirmFinal();
      case 'confirm-step': return this.confirmStep();
      case 'final-flash': return this.flashFinal();
    }
  };

  // ---- 三角形を選ぶ（Ver.0.5：STEP 1） ------------------------------------------

  // 三角形の内側のタップ。重なった三角形があれば「どの三角形を選びますか？」
  PlayController.prototype.tapTriangleFromFigure = function (target, clientX, clientY) {
    const fig = this.problem.figure;
    let list = [target.getAttribute('data-tri').split('')];
    const svg = this.ref('svg');
    const ctm = svg && svg.getScreenCTM && svg.getScreenCTM();
    if (ctm && clientX != null) {
      const q = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
      const found = PH.geometry.triangleCandidates(fig, q);
      if (found.length) list = found;
    }
    const self = this;
    if (list.length <= 1) return this.tapTriangle(list[0]);
    PH.chooser.open({
      title: 'どの三角形を選びますか？',
      options: list.map(function (t) { return { value: t, label: triName(t) }; }),
      onChoose: function (t) { self.tapTriangle(t); },
    });
  };

  PlayController.prototype.tapTriangle = function (tri) {
    const r = this.game.tapTriangle(tri);
    if (r.type !== 'ignored') {
      PH.sound.play('tap');
      this.say(null);
    }
    this.render();
  };

  PlayController.prototype.pressVertex = function (v) {
    if (this.game.pressVertex(v)) {
      PH.sound.play('tap');
      this.say(null);
      this.render();
    }
  };

  PlayController.prototype.triAction = function (what) {
    const g = this.game;
    const ok = what === 'back' ? g.backVertex() : g.clearTriangles();
    if (ok) {
      PH.sound.play('tap');
      this.say(null);
      this.render();
    }
  };

  // 「決定」：この2つの三角形で証明する
  PlayController.prototype.confirmTriangles = function () {
    const g = this.game;
    const r = g.confirmTriangles();
    if (r.status === 'incomplete') return;
    if (r.ok) {
      PH.sound.play('get');
      PH.hints.hide(doc.getElementById('hint-popup'));
      this.setTriCheck(false);
      this.popMessage('三角形が決まった！');
      this.say(triName(g.triangles[0]) + 'と' + triName(g.triangles[1]) + 'で証明しよう！ ' +
        (g.phase === 'step' ? 'まず、根拠に使う新しい関係を導こう。' : '次は3つの根拠を見つけよう。'), 'ok');
    } else {
      const text = {
        order: '三角形は見つけられたね！ 頂点の対応順を確認しよう！',
        same: '同じ三角形を2つ選んでいるよ。ちがう2つの三角形を選ぼう！',
      }[r.status] || 'この2つの三角形で、結論を導けるかな？ 対応する辺・角に注目しよう！';
      this.say(text, 'ng');
      PH.sound.play(r.miss ? 'wrong' : 'soft');
      this.shake = true;
    }
    this.render();
  };

  // ---- 合同から結論を導く（Ver.0.5：STEP 4） -------------------------------------

  PlayController.prototype.confirmFinal = function () {
    const g = this.game;
    const r = g.confirmFinal();
    if (r.status === 'incomplete') return;
    if (r.status === 'correct' && r.post) {
      // 最終結論から、さらに結論を導く（例：2つの角が等しいので二等辺三角形）
      PH.sound.play('get');
      this.popMessage('新しい根拠を発見！');
      this.say(this.problem.finalStep.label + ' を導けた！ これを使って、結論を証明しよう！', 'ok');
      this.focusPanel = true;
      this.render();
      return;
    }
    if (r.status === 'correct') return this.cleared();
    const what = this.problem.finalStep.relationType === 'angle' ? '角' : '辺';
    const text = {
      'wrong-reason': '等しい' + what + 'は選べたね！ 合同な図形の性質を使って、理由をもう一度考えよう。',
      'not-goal': '正しい関係だけれど、問題で求められている結論ではないよ。結論をもう一度確認しよう！',
      evidence: 'それは合同を示すのに使った関係だよ。合同から導く結論を選ぼう！',
    }[r.status] || 'その2つは、合同な三角形で対応しているかな？ 結論をもう一度確認しよう！';
    this.say(text, r.miss ? 'ng' : 'info');
    PH.sound.play(r.miss ? 'wrong' : 'soft');
    if (r.miss) this.shake = true;
    this.render();
  };

  // ---- 多段階証明のステップ（Ver.0.7） -----------------------------------------

  // ステップで扱う辺・角の要素キー（図で光らせる）
  function stepKeys(problem, step) {
    const fig = problem.figure;
    const k = function (n) { try { return PH.geometry.elementKey(fig, n); } catch (e) { return null; } };
    let names = [];
    if (step.type === 'expression') {
      names = [step.target].concat((String(step.parts).match(/∠[A-Z]{3}/g) || []));
    } else if (step.items) names = step.items;
    else if (step.premise) names = step.premise;
    return names.map(k).filter(Boolean);
  }
  PH.stepKeys = stepKeys;

  PlayController.prototype.flashStep = function (id) {
    const s = this.game.engine && this.game.engine.step(id);
    if (!s) return;
    PH.sound.play('tap');
    this.flash(stepKeys(this.problem, s), 1600);
  };

  PlayController.prototype.chooseStepOption = function (id) {
    if (this.game.chooseStepOption(id)) {
      PH.sound.play('tap');
      this.say(null);
      this.render();
    }
  };

  PlayController.prototype.selectStep = function (id) {
    if (this.game.selectStep(id)) {
      PH.sound.play('tap');
      this.say(null);
      this.render();
    }
  };

  // 式の比較：左辺・右辺をタップ
  PlayController.prototype.pickPart = function (exprId, part) {
    const g = this.game;
    if (!g.pickPart(exprId, part)) return;
    PH.sound.play('tap');
    if (g.commonFound()) {
      this.say('2つの式の右辺が同じだね！ 図で、等しくなる2つの角をタップしよう。', 'ok');
    } else if (g.cmpPickedBoth()) {
      this.say('その2つは同じ式かな？ 2つの式で、まったく同じになっている部分を探そう。', 'info');
    } else this.say(null);
    this.render();
  };

  PlayController.prototype.confirmStep = function () {
    const g = this.game;
    const r = g.confirmStep();
    if (r.status === 'incomplete') return;
    const s = r.step;
    if (r.status === 'correct') {
      PH.sound.play('get');
      this.popMessage(s.type === 'compare' ? '新しい根拠を発見！' : '証明できた！');
      this.flash(stepKeys(this.problem, s), 1200);
      if (r.stageDone === 'post') return this.cleared();
      if (r.stageDone === 'pre') {
        this.say(s.label + ' を導けた！ 次は、合同を示す3つの根拠を集めよう。導いた等式も根拠に使えるよ。', 'ok');
      } else {
        this.say(s.label + ' を導けた！ 次のステップへ進もう。', 'ok');
      }
      this.focusPanel = true;
    } else {
      this.say(s.type === 'compare'
        ? '2つの式の右辺が同じなら、左辺どうしが等しいね。等しくなる2つの角をもう一度選ぼう。'
        : 'その理由で言えるかな？ どんな図形の性質・角の関係を使ったか、もう一度考えよう。', 'ng');
      PH.sound.play(r.miss ? 'wrong' : 'soft');
      this.shake = true;
    }
    this.render();
  };

  // 完成した証明の最終結論のタップ：結論の辺・角を光らせる
  PlayController.prototype.flashFinal = function () {
    const p = this.problem;
    PH.sound.play('tap');
    this.flash(p.finalStep.items.map(function (n) { return PH.geometry.elementKey(p.figure, n); }), 1600);
  };

  /*
   * 図のタップが指しうる要素の候補（geometry.segmentCandidates / angleCandidates）。
   * 線分ACの上に点Bがあり AC・AB の両方が選べるときなど、候補が2つ以上なら
   * 「どちらに〜？」のポップアップ（PH.chooser）で選んでもらう。
   */
  PlayController.prototype.tapCandidates = function (target, clientX, clientY) {
    const key = target.getAttribute('data-key');
    const svg = this.ref('svg');
    const ctm = svg && svg.getScreenCTM && svg.getScreenCTM();
    if (!ctm || clientX == null) return [key];
    const q = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
    const fig = this.problem.figure;
    const g = this.game;
    let list;
    if (target.classList.contains('hit-seg')) {
      list = PH.geometry.segmentCandidates(fig, q);
    } else {
      // 角の操作領域の大きさは、描画と同じ条件（角だけを置いているか）で計算する
      const angleOnly = g.mode === 'angle' || (g.mode === 'mark' && g.markTool.kind === 'ang');
      list = PH.geometry.angleCandidates(fig, q, angleOnly);
    }
    return list.length ? list : [key];
  };

  PlayController.prototype.tapFromFigure = function (target, clientX, clientY) {
    const g = this.game;
    let list = this.tapCandidates(target, clientX, clientY);
    if (g.mode === 'erase') {
      // 消すときは、印がついているものだけを候補にする
      const marked = list.filter(function (k) { return g.userMarks[k] != null; });
      if (marked.length) list = marked;
    }
    if (list.length <= 1) return this.tapElement(list[0]);
    const byKey = PH.geometry.getElements(this.problem.figure).byKey;
    const self = this;
    PH.chooser.open({
      title: g.mode === 'mark' ? 'どちらに印をつけますか？' : g.mode === 'erase' ? 'どちらの印を消しますか？' : 'どちらを選びますか？',
      options: list.map(function (k) { return { value: k, label: byKey[k].display }; }),
      onChoose: function (k) { self.tapElement(k); },
    });
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

  // 証明する三角形がまだ決まっていない（Ver.0.5 の問題の STEP 1）。このあいだは正しい三角形を見せない
  PlayController.prototype.trianglesHidden = function () {
    return this.game.phase === 'triangle';
  };

  // 「三角形を確認」：対象の2つの三角形を色分けし、頂点の対応を表示する
  //  （STEP 1 の前は「三角形を探すヒント」：答えは見せずに、結論の辺・角に注目させる）
  PlayController.prototype.setTriCheck = function (on) {
    this.triCheck = !!on;
    const popup = doc.getElementById('tri-popup');
    if (this.triCheck) {
      PH.hints.hide(doc.getElementById('hint-popup'));
      if (this.trianglesHidden()) {
        this.fillTriSearchPopup(popup);
        const p = this.problem;
        this.flash(p.finalStep.items.map(function (n) { return PH.geometry.elementKey(p.figure, n); }), 1800);
      } else this.fillTriPopup(popup);
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

  PlayController.prototype.fillTriSearchPopup = function (popup) {
    const items = this.problem.finalStep.items;
    const name = function (n) { return PH.geometry.isAngleName(n) ? n : '辺' + n; };
    popup.querySelector('.hint-level').textContent = '△ 三角形を探すヒント';
    popup.querySelector('.tri-body').innerHTML =
      '<ul class="tri-search">' +
        '<li>結論の' + esc(name(items[0])) + 'は、どの三角形にふくまれているかな？</li>' +
        '<li>もう1つの' + esc(name(items[1])) + 'と対応させられる三角形を探そう！</li>' +
      '</ul>' +
      '<p class="tri-note">三角形が決まると、ここで2つの三角形と対応する頂点を確認できるよ。</p>';
  };

  PlayController.prototype.fillTriPopup = function (popup) {
    const p = this.problem;
    const t1 = p.triangles[0], t2 = p.triangles[1];
    popup.querySelector('.hint-level').textContent = '△ 証明する三角形';
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
      '<p class="tri-note">' + (PH.hasFinalStep(p) ? '合同の式 <b>' + esc(PH.congruenceText(p)) + '</b>' : '結論 <b>' + esc(p.conclusion) + '</b>') +
        ' の文字の順番が、頂点の対応を表しているよ。同じ色の頂点どうしが対応するよ。</p>';
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
        // 対応する辺・角が等しいと言えるのは、合同を証明してから（STAGE 6 では最終結論ではなく途中の合同を示す）
        this.say(PH.hasFinalStep(p)
          ? 'それは' + PH.congruenceText(p) + 'が証明できたら言えることだよ！ 合同はまだ証明できていないので、根拠には使えないよ。'
          : 'それは' + p.conclusion + 'が証明できたら言えることだよ！ 結論はまだ根拠に使えないよ。', 'ng');
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
    if (r.final) {
      // 合同成立。まだクリアではなく、合同から結論を導く（STEP 4）
      PH.sound.play('get');
      PH.hints.hide(doc.getElementById('hint-popup'));
      this.popMessage('合同成立！');
      this.say('合同成立！ あと一歩で証明完成！ ' + PH.congruenceText(this.problem) + ' から、結論を導こう！', 'ok');
      this.focusPanel = true;
      this.render();
      return;
    }
    this.cleared();
  };

  // 証明完成：記録して完成画面へ
  PlayController.prototype.cleared = function () {
    const g = this.game;
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
    const badge = { side: '', angle: '∠ 角選択：角の内側をタップ', mark: '🖍️ 印つけ：下書き用（判定なし）', erase: '🧽 消す：印をタップ', tri: '△ 三角形の内側をタップ' }[g.mode];
    const mb = this.ref('modeBadge');
    mb.textContent = badge;
    mb.hidden = !badge;
    // 「三角形を確認」のボタン：STEP 1 の前は「三角形を探すヒント」（正しい三角形は見せない）
    const tb = this.ref('triBtn');
    if (tb) tb.textContent = this.trianglesHidden() ? '△ 三角形を探すヒント' : '△ 三角形を確認';
    PH.renderer.render(this.ref('svg'), this.problem, {
      selection: g.selection,
      flash: this.flashKeys,
      autoMarks: g.autoMarks(),
      userMarks: g.userMarks,
      flashLines: this.flashLines,
      // 合同が成立したら（STEP 4）2つの三角形を色分けして表示する
      triangles: this.triCheck && !this.trianglesHidden() ? 'check' : g.phase === 'final',
      triSel: g.phase === 'triangle' ? g.triSel : null,
      interactive: true,
      // 辺選択では辺だけ、角選択では角だけ、印つけでは選んだ印の種類だけ、消すでは両方、三角形選択では三角形がタップに反応する
      hit: g.mode === 'erase' ? { seg: true, ang: true }
        : g.mode === 'mark' ? { seg: g.markTool.kind === 'seg', ang: g.markTool.kind === 'ang' }
        : g.mode === 'tri' ? { tri: true }
        : g.mode === 'step' ? {}
        : { seg: g.mode === 'side', ang: g.mode === 'angle' },
      angleGuide: g.mode === 'angle' && (g.phase === 'collect' || g.phase === 'final' || g.phase === 'step'),
    });
  };

  PlayController.prototype.renderToolbar = function () {
    const g = this.game;
    this.root.querySelectorAll('.toolbar [data-mode]').forEach(function (b) {
      const m = b.getAttribute('data-mode');
      b.setAttribute('aria-pressed', String(g.mode === m));
      b.disabled = m !== 'mark' && m !== 'erase' && g.phase !== 'collect' && g.phase !== 'final';
    });
  };

  // STEP の表示（結論が辺・角の等しさの問題だけ）：三角形 → 根拠 → 合同条件 → 結論
  PlayController.prototype.stepBar = function () {
    const g = this.game;
    if (!g.hasFinal && !g.engine) return '';
    let steps = [['triangle', '三角形'], ['collect', '根拠'], ['congruence', '合同条件'], ['final', '結論']];
    if (!g.hasFinal) steps = steps.filter(function (s) { return s[0] !== 'triangle' && s[0] !== 'final'; });
    let cur = steps.findIndex(function (s) { return s[0] === g.phase; });
    if (g.engine) {
      // 前半のステップ（同じ種類が続くものは1つにまとめる）と、後半のステップを加える
      const NAME = { theorem: '定理を使う', expression: '角の式', compare: '式を比べる' };
      const groups = [];
      PH.proofEngine.stepsOf(this.problem, 'pre').forEach(function (s) {
        const last = groups[groups.length - 1];
        if (last && last.type === s.type) last.ids.push(s.id);
        else groups.push({ type: s.type, ids: [s.id] });
      });
      const pre = groups.map(function (gr) { return ['pre:' + gr.ids.join(','), NAME[gr.type], gr.ids]; });
      const post = PH.proofEngine.stepsOf(this.problem, 'post').map(function (s) { return ['post:' + s.id, s.short, [s.id]]; });
      const at = g.hasFinal ? 1 : 0;
      steps = steps.slice(0, at).concat(pre, steps.slice(at), post);
      if (g.phase === 'step' || g.phase === 'post') {
        cur = steps.findIndex(function (st) { return st[2] && st[2].indexOf(g.stepId) >= 0; });
      } else if (g.phase !== 'clear') {
        cur = steps.findIndex(function (st) { return st[0] === g.phase; });
      }
    }
    return '<ol class="step-bar" aria-label="証明の手順">' + steps.map(function (s, i) {
      return '<li class="' + (i < cur ? 'is-done' : i === cur ? 'is-now' : '') + '"><b>' + (i + 1) + '</b>' + s[1] + '</li>';
    }).join('') + '</ol>';
  };

  // 多段階証明のステップ（定理・角の式・式の比較）のパネル
  PlayController.prototype.stepPanel = function () {
    const g = this.game;
    const s = g.currentStep();
    const proof = PH.buildProof(this.problem);
    const no = {};
    proof.stepLines.forEach(function (l) { no[l.stepId] = l.no; });
    const avail = g.engine.available(g.stepStage());
    let html = '<div class="panel-head">🔗 ' + (s.type === 'compare' ? '2つの式を比べよう' : s.type === 'expression' ? '角の関係を見つけよう' : '定理を使おう') + '</div>' + this.stepBar();
    // 解けるステップが2つ以上なら、どれから解いてもよい
    if (avail.length > 1) {
      html += '<div class="step-tabs" role="group" aria-label="解けるステップ">' + avail.map(function (a) {
        return '<button class="step-tab" data-step-go="' + a.id + '" aria-pressed="' + (a.id === s.id) + '">' + esc(a.short) + '</button>';
      }).join('') + '</div>';
    }
    if (s.type === 'compare') {
      const deps = s.dependsOn.map(function (d) { return g.engine.step(d); });
      html += '<p class="panel-note">2つの式で、まったく同じになっている部分をタップしよう。</p>' +
        '<div class="cmp-exprs">' + deps.map(function (d) {
          const pick = g.cmpPick[d.id];
          const btn = function (part, text) {
            const on = pick === part;
            const common = g.commonFound() && part === 'value';
            return '<button class="cmp-part' + (on ? ' is-on' : '') + (common ? ' is-common' : '') + '" data-cmp="' + d.id + ':' + part + '" aria-pressed="' + on + '">' + esc(text) + '</button>';
          };
          return '<div class="cmp-row"><span class="cmp-no">' + no[d.id] + '</span>' + btn('target', d.target) + '<span class="eq-sign">＝</span>' + btn('value', d.value) + '</div>';
        }).join('') + '</div>';
      if (g.commonFound()) {
        const cand = g.candidate();
        html += '<p class="panel-note">' + deps.map(function (d) { return no[d.id]; }).join('、') + 'より、等しくなる2つの角を図でタップしよう。</p>' +
          '<div class="equation' + (g.selection.length === 2 ? ' is-ready' : '') + '">' +
            '<span class="eq-part' + (cand[0] ? ' filled' : '') + '">' + esc(cand[0] || '？') + '</span><span class="eq-sign">＝</span>' +
            '<span class="eq-part' + (cand[1] ? ' filled' : '') + '">' + esc(cand[1] || '？') + '</span></div>';
      }
    } else {
      const lead = s.type === 'expression'
        ? '<p class="step-premise">' + esc(s.premiseLabel) + 'だから、正三角形の1つの角は60°</p><p class="step-expr">' + esc(s.label) + '</p><p class="panel-note">この式は、何を使って導いたかな？</p>'
        : '<p class="step-premise">' + esc(s.premiseLabel) + 'より、</p><p class="panel-note">理由を選ぼう</p>';
      html += lead + '<div class="choices reasons step-opts" role="group" aria-label="理由">' + g.stepOptions(s).map(function (o) {
        return '<button class="choice" data-step-opt="' + o.id + '" aria-pressed="' + (g.stepChoice === o.id) + '">' + esc(o.text) + '</button>';
      }).join('') + '</div>' +
        (s.type === 'theorem' ? '<p class="step-concl">' + esc(s.label) + '</p>' : '');
    }
    html += '<div class="panel-actions">' +
      '<button class="btn btn-confirm btn-wide" data-act="confirm-step"' + (g.canConfirmStep() ? '' : ' disabled') + '>決定</button>' +
      '</div>' + this.feedbackHtml();
    return html;
  };

  // 証明済みの事実の一覧（多段階証明。タップすると図が光る）
  PlayController.prototype.factsHtml = function () {
    const g = this.game;
    if (!g.engine) return '';
    const proof = PH.buildProof(this.problem);
    const done = proof.stepLines.concat(proof.post.map(function (l) { return { stepId: l.stepId, no: '', equation: l.conclusion }; }))
      .filter(function (l) { return g.engine.done[l.stepId]; });
    return '<details class="facts"' + (done.length ? ' open' : '') + '><summary>証明済みの事実（' + done.length + '）</summary>' +
      (done.length ? '<ul>' + done.map(function (l) {
        return '<li><button class="fact" data-fact="' + l.stepId + '">' + esc(l.no + ' ' + l.equation) + '</button></li>';
      }).join('') + '</ul>' : '<p class="small-note">ステップを証明すると、ここに増えていくよ。</p>') + '</details>';
  };

  // STEP 1：証明する三角形と頂点の対応を選ぶパネル
  PlayController.prototype.trianglePanel = function () {
    const g = this.game;
    const sel = g.triSel;
    let note;
    if (sel.length === 0) note = 'どの2つの三角形を合同にすればよい？ 図の三角形の内側をタップしよう。';
    else if (sel.length === 1) note = '2つ目の三角形をタップしよう。（もう一度タップで選び直し）';
    else if (g.triMap.length < 3) note = triName(sel[0]) + 'の頂点 <b>' + esc(sel[0][g.triMap.length]) + '</b> に対応する頂点を、' + triName(sel[1]) + 'から選ぼう。';
    else note = '頂点の対応が決まったよ。「決定」を押そう！';
    const slotTri = function (tri, i, letters) {
      return '<span class="tri-slot tri-slot-' + i + (tri ? ' filled' : '') + '">△' +
        (tri ? letters.map(function (c) { return '<span>' + esc(c || '＿') + '</span>'; }).join('') : '＿＿＿') + '</span>';
    };
    const second = sel[1] ? [0, 1, 2].map(function (k) { return g.triMap[k] || ''; }) : null;
    let html = '<div class="panel-head">△ 証明する三角形を選ぼう</div>' + this.stepBar() +
      '<p class="panel-note">' + note + '</p>' +
      '<div class="tri-answer" aria-label="選んだ三角形">' + slotTri(sel[0], 0, sel[0] || []) + '<span class="tri-and">と</span>' +
        slotTri(sel[1], 1, second || []) + '<span class="tri-and">において</span></div>';
    if (sel.length === 2) {
      html += '<div class="vx-map">' + sel[0].map(function (v, k) {
        return '<span class="vx-pair"><span class="vx-chip vx-' + k + '">' + esc(v) + '</span>↔<span class="vx-chip ' + (g.triMap[k] ? 'vx-' + k : 'vx-empty') + '">' + esc(g.triMap[k] || '？') + '</span></span>';
      }).join('') + '</div>' +
      '<div class="vx-keys" role="group" aria-label="対応する頂点">' + sel[1].map(function (v) {
        const used = g.triMap.indexOf(v) >= 0;
        return '<button class="choice vx-key" data-vx="' + esc(v) + '"' + (used || g.triMap.length >= 3 ? ' disabled' : '') + '>' + esc(v) + '</button>';
      }).join('') + '</div>';
    }
    html += '<div class="panel-actions">' +
      '<button class="btn" data-act="tri-back"' + (g.triMap.length ? '' : ' disabled') + ' aria-label="1つもどす">←</button>' +
      '<button class="btn" data-act="tri-clear"' + (sel.length ? '' : ' disabled') + ' aria-label="選んだ三角形を消す">消す</button>' +
      '<button class="btn btn-confirm" data-act="confirm-tri"' + (g.canConfirmTriangles() ? '' : ' disabled') + ' aria-label="この2つの三角形で証明する">決定</button>' +
      '</div>' + this.feedbackHtml();
    return html;
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

    if (g.phase === 'triangle') {
      panel.innerHTML = this.trianglePanel();
      return;
    }

    if (g.phase === 'step' || g.phase === 'post') {
      panel.innerHTML = this.stepPanel();
      return;
    }

    if (g.phase === 'congruence') {
      html += '<div class="panel-head">⚖️ 合同条件を見極めよう！</div>' + this.stepBar() +
        '<p class="panel-note">3つの根拠がそろった！ どの合同条件で <b>' + esc(PH.congruenceText(this.problem)) + '</b> といえるかな？</p>' +
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

    // STEP 4：合同から結論を導く（等式の選び方は根拠と同じ。理由に「合同な図形の対応する〜」が加わる）
    const final = g.phase === 'final';
    if (final) {
      const fw = this.problem.finalStep.relationType === 'angle' ? '角' : '辺';
      if (n === 0) note = PH.congruenceText(this.problem) + ' が証明できた！ 結論 <b>' + esc(this.problem.conclusion) + '</b> になる2つの' + fw + 'を選ぼう。';
      else if (n === 1) note = '2つ目の' + what + 'をタップしよう。';
      else if (!g.reason) note = 'その2つが等しい理由を選ぼう。';
      else note = '「証明を完成する」を押そう！';
    }

    const head = final ? '⭐ 結論を導こう！' : g.mode === 'angle' ? '∠ 等しい角をさがそう' : '／ 等しい辺をさがそう';
    html += '<div class="panel-head">' + head + '</div>' + this.stepBar() +
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
        (final
          ? '<button class="btn btn-confirm" data-act="confirm-final"' + (g.canConfirmFinal() ? '' : ' disabled') + '>証明を完成する</button>'
          : '<button class="btn btn-confirm" data-act="confirm"' + (g.canConfirm() ? '' : ' disabled') + '>根拠を確定</button>') +
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
    const facts = this.ref('facts');
    if (facts) facts.innerHTML = this.factsHtml();
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
            '<ol class="proof-lines">' + lines + stepLinesHtml(proof) + '</ol>' +
            '<p class="proof-sum">' + esc(proof.summary) + '</p>' +
            '<p class="proof-cond"><strong>' + esc(proof.condition) + '</strong>ので、</p>' +
            '<p class="proof-concl' + (proof.final ? ' is-mid' : '') + '">' + esc(proof.conclusion) + '</p>' +
            finalProofHtml(proof) + postProofHtml(proof) +
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

  /*
   * 完成した証明の最後（結論が辺・角の等しさの問題）：
   *   したがって、 / 合同な図形の対応する辺は等しいから、 / AC＝BD（最終結論として強調）
   * reasonText を渡すと、その理由の書き方を使う（パズルで生徒が選んだカード）
   */
  function finalProofHtml(proof, reasonText, conclusionText) {
    if (!proof.final) return '';
    return '<div class="proof-final">' +
      '<p class="proof-final-lead">' + esc(proof.final.lead) + '</p>' +
      '<p class="proof-final-reason"><button class="pl-reason" data-act="final-flash">' + esc(reasonText || proof.final.reason) + '、</button></p>' +
      // 後半のステップがあるとき（二等辺三角形である、など）は、ここは途中の結果
      '<p class="proof-concl ' + (proof.post && proof.post.length ? 'is-mid' : 'proof-goal') + '"><button class="pl-eq" data-act="final-flash">' + esc(conclusionText || proof.final.conclusion) + '</button></p>' +
      '</div>';
  }

  // 多段階証明の前半のステップの行（「③、④より、∠ACE＝∠BCD ……⑤」など。タップすると図が光る）
  function stepLinesHtml(proof) {
    return (proof.stepLines || []).map(function (l) {
      return '<li class="proof-line is-step">' +
        '<button class="pl-reason" data-fact="' + l.stepId + '">' + esc(l.reason) + '</button>' +
        '<button class="pl-eq" data-fact="' + l.stepId + '">' + esc(l.equation) + '<span class="pl-no">……' + l.no + '</span></button>' +
        '</li>';
    }).join('');
  }

  // 後半のステップ（「∠DCB＝∠DBCより、2つの角が等しい三角形は二等辺三角形だから、△DBCは二等辺三角形」）
  function postProofHtml(proof) {
    return (proof.post || []).map(function (l) {
      return '<div class="proof-final proof-post">' +
        '<p class="proof-final-reason"><button class="pl-reason" data-fact="' + l.stepId + '">' + esc(l.reason) + '</button></p>' +
        '<p class="proof-concl proof-goal"><button class="pl-eq" data-fact="' + l.stepId + '">' + esc(l.conclusion) + '</button></p>' +
        '</div>';
    }).join('');
  }

  // ---------------------------------------------------------------------

  let current = null;

  PH.finalProofHtml = finalProofHtml;
  PH.stepLinesHtml = stepLinesHtml;
  PH.postProofHtml = postProofHtml;

  // 印のアイコン（証明パズルの「図に印をつける」でも使う）
  PH.markToolIcon = toolIcon;
  PH.MARK_TOOLS = MARK_TOOLS;

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
