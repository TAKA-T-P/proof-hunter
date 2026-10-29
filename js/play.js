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
        '<button class="head-btn" data-act="list" aria-label="問題選択に戻る"><span class="ico">◀</span><span class="lbl">問題</span></button>' +
        '<div class="play-title"><span class="play-no">問題' + esc(p.number) + '</span><span class="play-name">' + esc(p.title) + '</span></div>' +
        '<div class="counter" data-ref="counter" aria-live="polite"><span class="counter-label">根拠</span><b data-ref="count">0</b><span data-ref="countTotal">/' + this.game.total() + '</span></div>' +
        '<button class="head-btn head-puzzle" data-act="to-puzzle" aria-label="証明パズルモードに切り替える"><span class="ico">🧩</span><span class="lbl">パズル</span></button>' +
      '</header>' +
      // スマホ縦画面: .play-stage（図＋ボタン）を上に固定し、.play-scroll（問題文・解答欄）だけスクロール
      // PC・横画面: .play-scroll は display: contents になり、グリッドで2カラム配置
      '<div class="play-body" data-ref="body">' +
        '<div class="play-stage">' +
          '<div class="card figure-card" data-ref="figureCard">' +
            '<div class="mode-badge" data-ref="modeBadge"></div>' +
            '<svg class="figure" data-ref="svg" role="group" aria-label="問題の図"></svg>' +
            '<div class="pop-msg" data-ref="popMsg" aria-hidden="true"></div>' +
          '</div>' +
          '<div class="toolbar" role="toolbar" aria-label="操作">' +
            '<button class="tool" data-mode="side"><span class="ico ico-glyph">／</span><span class="lbl">辺選択</span></button>' +
            '<button class="tool" data-mode="angle"><span class="ico ico-glyph">∠</span><span class="lbl">角選択</span></button>' +
            '<button class="tool" data-mode="mark"><span class="ico">🖍️</span><span class="lbl">印つけ</span></button>' +
            '<button class="tool head-hint" data-act="hint" aria-label="ヒント"><span class="ico">💡</span><span class="lbl">ヒント</span></button>' +
            '<button class="tool tool-tri" data-act="tri-check" aria-pressed="false" data-ref="triBtn" aria-label="三角形確認"><span class="ico ico-glyph">△</span><span class="lbl">三角形確認</span></button>' +
            '<button class="tool" data-act="restart"><span class="ico">↺</span><span class="lbl">最初から</span></button>' +
          '</div>' +
        '</div>' +
        '<div class="play-scroll" data-ref="scroll">' +
          '<div class="card statement">' +
            '<p class="statement-text">' + esc(p.statement) + '</p>' +
            '<div class="cond-row"><span class="tag tag-given">仮定</span><span class="cond-text">' + p.given.map(esc).join('、') + '</span></div>' +
            '<div class="cond-row"><span class="tag tag-goal">結論</span><span class="cond-text">' + esc(p.conclusion) + '</span></div>' +
          '</div>' +
          '<div class="play-side">' +
            '<div class="card panel" data-ref="panel"></div>' +
            '<div class="slots-wrap"><div class="slots" data-ref="slots"></div><p class="slots-note">' +
              (PH.isRightProblem(p) ? '空いている欄をタップすると、集める根拠を切りかえられるよ。見つけた根拠をタップすると図が光るよ' : '見つけた根拠をタップすると、図の場所が光るよ') + '</p></div>' +
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
    const t = e.target.closest('[data-key],[data-tri],[data-step-opt],[data-cmp],[data-step-go],[data-fact],[data-act],[data-mode],[data-reason],[data-cond],[data-tool],[data-ev],[data-proof-reason],[data-role]');
    if (!t || t.disabled) return;
    if (t.hasAttribute('data-role')) return this.selectRole(t.getAttribute('data-role'));
    if (t.hasAttribute('data-step-opt')) return this.chooseStepOption(t.getAttribute('data-step-opt'));
    if (t.hasAttribute('data-cmp')) { const v = t.getAttribute('data-cmp').split(':'); return this.pickPart(v[0], v[1]); }
    if (t.hasAttribute('data-step-go')) return this.selectStep(t.getAttribute('data-step-go'));
    if (t.hasAttribute('data-fact')) return this.flashStep(t.getAttribute('data-fact'));
    if (t.hasAttribute('data-key')) return this.tapFromFigure(t, e.clientX, e.clientY);
    if (t.hasAttribute('data-tri')) return this.tapTriangleFromFigure(t, e.clientX, e.clientY);
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
      case 'to-puzzle': return this.toPuzzle();
      case 'erase-toggle': return this.setMode(this.game.mode === 'erase' ? 'mark' : 'erase');
      case 'restart': return this.restart();
      case 'clear-sel': return this.clearSelection();
      case 'confirm': return this.confirm();
      case 'confirm-cond': return this.confirmCondition();
      case 'clear-marks': return this.clearMarks();
      case 'tri-clear': return this.triAction();
      case 'confirm-tri': return this.confirmTriangles();
      case 'confirm-final': return this.confirmFinal();
      case 'confirm-step': return this.confirmStep();
      case 'explain': return this.explainEvidence();
      case 'explain-cancel': return this.cancelExplain();
      case 'toggle-rel': return this.toggleRelation();
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
      avoid: this.ref('figureCard'),
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

  PlayController.prototype.triAction = function () {
    if (this.game.clearTriangles()) {
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
      this.say(triName(g.triangles[0]) + 'と' + triName(g.triangles[1]) + 'で証明しよう！（対応する頂点は「三角形確認」ボタンで見られるよ）' +
        (g.isRight() ? 'まず、2つの三角形の直角を確かめよう。' : '次は3つの根拠を見つけよう。'), 'ok');
    } else {
      const text = 'この2つの三角形で、結論を導けるかな？ 結論の辺・角をふくむ三角形に注目しよう！';
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
    if (r.status === 'correct' && r.quad) {
      // Ver.0.9（p35）：合同から導いた角の等しさを使って、平行四辺形の根拠を集める
      PH.sound.play('get');
      this.popMessage('新しい根拠を発見！');
      this.say(this.problem.finalStep.label + ' を導けた！ 次は、' + PH.quadrilateral.name(this.problem.targetQuadrilateral) +
        'が' + PH.quadTypeName(this.problem) + 'になるための根拠を集めよう！', 'ok');
      this.focusPanel = true;
      this.render();
      return;
    }
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
    if (g.commonFound() && g.cmpPrefilled()) {
      this.say('2つの式の右辺が同じだね！ だから、選んだ ' + g.explainingEvidence().label + ' が言えるよ。「決定」を押そう！', 'ok');
    } else if (g.commonFound()) {
      this.say('2つの式の右辺が同じだね！ 図で、等しくなる2つの角をタップしよう。', 'ok');
    } else if (g.cmpPickedBoth()) {
      this.say('その2つは同じ式かな？ 2つの式で、まったく同じになっている部分を探そう。', 'info');
    } else this.say(null);
    this.render();
  };

  // 「詳しい理由を説明する」：選んだ等式が、式や定理で説明する根拠なら、説明のステップへ
  PlayController.prototype.explainEvidence = function () {
    const g = this.game;
    const p = this.problem;
    const r = g.explain();
    if (r.status === 'incomplete') return;
    const what = r.kind === 'ang' ? '角' : '辺';
    if (r.status === 'explain') {
      PH.sound.play('tap');
      PH.hints.hide(doc.getElementById('hint-popup'));
      this.say(r.evidence.label + ' を説明しよう！ ' + (g.currentStep().type === 'theorem' ? '使う図形の性質を選ぼう。' : '角の関係を式で表そう。'), 'ok');
      this.focusPanel = true;
      this.render();
      return;
    }
    const text = {
      duplicate: 'この根拠はもう見つけているよ！',
      'not-explain': '等しい' + what + 'は見つけられたね！ それは、理由を1つ選ぶだけで言える関係だよ。下の「等しい理由」から選ぼう。',
      'wrong-role': r.evidence && wrongRoleText(p, r),
      irrelevant: r.outsideQuad ? quadFirstText(p) : 'たしかに等しいね！ でも、今回の証明では使わない関係だよ。ほかの根拠を探そう！',
      alternative: r.alt && r.alt.text,
      'from-conclusion': PH.hasCongruence(p) ? 'それは' + PH.congruenceText(p) + 'が証明できたら言えることだよ！ まだ根拠には使えないよ。' : '',
      outside: PH.hasCongruence(p) ? outsideText(g) : '',
      'target-property': targetPropertyText(p),
    }[r.status] || (r.rel === 'parallel' ? 'この2つが平行とは、まだ言えないよ！ 説明できる関係を選ぼう。' : 'この2つが等しいとは、まだ言えないよ！ 説明できる等式を選ぼう。');
    this.say(text, r.miss ? 'ng' : 'info');
    PH.sound.play(r.miss ? 'wrong' : 'soft');
    if (r.miss) this.shake = true;
    this.render();
  };

  PlayController.prototype.cancelExplain = function () {
    if (this.game.cancelExplain()) {
      PH.sound.play('tap');
      this.say('根拠の選択にもどったよ。説明できたステップは「証明済みの事実」に残っているよ。', 'info');
      this.render();
    }
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
      if (r.stageDone === 'pre' && r.registered) {
        // 説明できた根拠を登録して、根拠の収集にもどる
        this.newSlot = r.registered.id;
        this.bumpCounter = true;
        this.popMessage('根拠発見！');
        this.flash(g.evidenceKeys(r.registered.id), 1200);
        this.say(r.registered.label + ' を説明できた！ 根拠に登録したよ。' + (r.complete
          ? (g.phase === 'qcondition' ? '根拠がそろった！ どの成立条件で' + PH.quadTypeName(this.problem) + 'といえるかな？' : '3つの根拠がそろった！ 合同条件を見極めよう！')
          : 'ほかの根拠も見つけよう。'), 'ok');
      } else if (r.stageDone === 'pre') {
        this.say(s.label + ' を導けた！', 'ok');
      } else {
        this.say(s.label + ' を導けた！ 次のステップへ進もう。', 'ok');
      }
      this.focusPanel = true;
    } else {
      this.say(s.type === 'compare'
        ? '2つの式の右辺が同じなら、左辺どうしが等しいね。等しくなる2つの角をもう一度選ぼう。'
        : s.type === 'expression' ? 'その式で合っているかな？ 角の大きさ（60°・90°）と、＋・－をもう一度確かめよう。'
        : s.choices ? 'その式で合っているかな？ 線分の長さの和・差を、図でもう一度確かめよう。'
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
      avoid: this.ref('figureCard'),
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
      else if (g.phase === 'qcondition') this.say('根拠はそろったよ。' + PH.quadTypeName(this.problem) + 'になるための条件を選ぼう！', 'info');
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

  // 直角三角形の根拠の欄（直角・斜辺・他の1辺・鋭角）を選ぶ（Ver.0.8）
  PlayController.prototype.selectRole = function (role) {
    if (this.game.phase === 'clear') return;
    if (this.game.selectRole(role)) {
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
    if (this.game.mode === 'erase') this.game.setMode('mark');     // 消すモードで印を選んだら、印つけにもどる
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
    if (ev.via) {
      // 平行を導く根拠：等しい錯角・同位角を光らせる
      const p = this.problem;
      PH.sound.play('tap');
      this.flash(this.game.evidenceKeys(id).concat(ev.via.map(function (n) { return PH.geometry.elementKey(p.figure, n); })), 1600);
      return;
    }
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

  // 平行四辺形の部分か（「三角形確認」ボタンが「四角形確認」になる）
  PlayController.prototype.quadView = function () {
    return this.game.quad && this.game.part === 'quad';
  };

  // 「三角形を確認」：対象の2つの三角形を色分けし、頂点の対応を表示する
  //  （STEP 1 の前は「三角形を探すヒント」：答えは見せずに、結論の辺・角に注目させる）
  PlayController.prototype.setTriCheck = function (on) {
    this.triCheck = !!on;
    const popup = doc.getElementById('tri-popup');
    if (this.triCheck) {
      PH.hints.hide(doc.getElementById('hint-popup'));
      if (this.quadView()) this.fillQuadPopup(popup);
      else if (this.trianglesHidden()) {
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
    const btn = this.ref('triBtn');
    if (btn) btn.setAttribute('aria-pressed', String(this.triCheck));
    this.renderFigures();
  };

  // 「四角形確認」：証明する四角形の対辺・対角（同じ色が向かい合う組）と対角線
  PlayController.prototype.fillQuadPopup = function (popup) {
    const p = this.problem;
    const Q = PH.quadrilateral;
    const quad = p.targetQuadrilateral;
    const chip = function (text, i) { return '<span class="q-chip q-pair-' + i + '">' + esc(text) + '</span>'; };
    const O = Q.diagonalPoint(p.figure, quad);
    popup.querySelector('.hint-level').textContent = '□ 証明する四角形';
    popup.querySelector('.tri-body').innerHTML =
      '<p class="quad-name">' + esc(Q.name(quad)) + '</p>' +
      '<dl class="quad-parts">' +
        '<dt>対辺</dt><dd>' + Q.oppositeSides(quad).map(function (s, i) { return chip(s[0] + 'と' + s[1], i); }).join('') + '</dd>' +
        '<dt>対角</dt><dd>' + Q.oppositeAngles(quad).map(function (a, i) { return chip(a[0] + 'と' + a[1], i); }).join('') + '</dd>' +
        '<dt>対角線</dt><dd>' + Q.diagonals(quad).map(function (d) { return '<span class="q-chip q-diag">' + esc(d) + '</span>'; }).join('') +
          (O ? '<span class="quad-o">交点 ' + esc(O) + '</span>' : '') + '</dd>' +
      '</dl>' +
      '<p class="tri-note">同じ色どうしが向かい合う組だよ。' + esc(PH.quadTypeName(p)) + 'になるための条件は、辺・角・対角線のどれかについての関係だよ。</p>';
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

  // Ver.1.0：同じ問題の証明パズルモードへ（解答レベルを選ぶ）
  PlayController.prototype.toPuzzle = function () {
    const self = this;
    PH.sound.play('tap');
    PH.chooser.open({
      title: '証明パズルモードに切り替えますか？',
      options: PH.PUZZLE_LEVELS.map(function (l) { return { value: l.id, label: l.label }; }),
      textOptions: true,
      onChoose: function (id) { self.nav.switchMode(id); },
    });
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
    if (g.phase === 'qcollect') return this.confirmQuad();
    const r = g.confirmEvidence();
    const what = r.kind === 'ang' ? '角' : '辺';
    switch (r.status) {
      case 'incomplete':
        return;
      case 'correct': {
        const ev = r.evidence;
        const role = g.isRight() ? g.roleOf(ev) : null;
        PH.sound.play('get');
        this.newSlot = ev.id;
        this.popMessage(role === 'right' ? '直角三角形を確認！' : '根拠発見！');
        this.flash(g.evidenceKeys(ev.id), 1100);
        PH.hints.hide(doc.getElementById('hint-popup'));
        this.bumpCounter = true;
        if (r.complete) {
          this.say('3つの根拠がそろった！ 合同条件を見極めよう！', 'ok');
          this.focusPanel = true;
        } else if (role === 'right') {
          const t = p.triangles;
          this.say(PH.evidenceText(ev) + '（' + PH.REASONS[ev.reason].short + '）。' + triName(t[0]) + 'と' + triName(t[1]) +
            'は直角三角形だね！ 次は' + PH.rightTriangle.ROLE_LABEL[g.role] + 'を見つけよう。', 'ok');
        } else if (role) {
          this.say(PH.rightTriangle.ROLE_LABEL[role] + 'を発見！ ' + ev.label + '（' + PH.REASONS[ev.reason].short + '）' +
            (g.role ? ' 次は' + PH.rightTriangle.ROLE_LABEL[g.role] + 'を見つけよう。' : ''), 'ok');
        } else {
          this.say('根拠発見！ ' + ev.label + '（' + PH.REASONS[ev.reason].short + '）', 'ok');
        }
        break;
      }
      case 'wrong-role':
        // 根拠は正しく欄の順番だけがちがうときはミスにしない（メッセージは同じ）
        this.say(wrongRoleText(p, r), 'ng');
        if (!r.miss) PH.sound.play('soft');
        break;
      case 'duplicate':
        this.say('この根拠はもう見つけているよ！', 'info');
        break;
      case 'not-proved':
        this.say(r.evidence.label + ' は、理由を1つ選ぶだけでは言えないよ。「📝 詳しい理由を説明する」で説明しよう！', 'ng');
        break;
      case 'irrelevant':
        PH.sound.play('soft');
        this.say('たしかに等しいね！ でも、今回の証明では使わない関係だよ。ほかの根拠を探そう！', 'info');
        break;
      case 'alternative':
        // 別の道すじで言える関係（ミスにしない）
        PH.sound.play('soft');
        this.say(r.alt.text, 'info');
        break;
      case 'wrong-reason':
        this.say(r.evidence && r.evidence.role === 'right'
          ? '直角は見つけられたね！ でも、なぜ90°と言えるのか、仮定や図形の性質をもう一度確認しよう。'
          : '等しい' + what + 'は見つけられたね！ でも、理由をもう一度考えてみよう。', 'ng');
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
        this.say(r.status === 'outside' ? outsideText(g) : 'この2つが等しいとは、まだ言えないよ！', 'ng');
    }
    if (r.miss) {
      PH.sound.play('wrong');
      this.shake = true;
    }
    this.render();
  };

  // ---- 平行四辺形（Ver.0.9） ---------------------------------------------------------

  // 「＝」と「∥」の切りかえ
  PlayController.prototype.toggleRelation = function () {
    if (this.game.toggleRelation()) {
      PH.sound.play('tap');
      this.say(null);
      this.render();
    }
  };

  // 平行四辺形の根拠を確定
  PlayController.prototype.confirmQuad = function () {
    const g = this.game;
    const p = this.problem;
    const r = g.confirmEvidence();
    if (r.status === 'incomplete') return;
    const par = r.rel === 'parallel';
    const what = par ? '平行な辺' : r.kind === 'ang' ? '等しい角' : '等しい辺';
    switch (r.status) {
      case 'correct': {
        const ev = r.evidence;
        PH.sound.play('get');
        this.newSlot = ev.id;
        this.popMessage('根拠発見！');
        this.flash(g.evidenceKeys(ev.id), 1100);
        PH.hints.hide(doc.getElementById('hint-popup'));
        this.bumpCounter = true;
        if (r.complete) {
          this.say('根拠がそろった！ どの成立条件で' + PH.quadTypeName(p) + 'といえるかな？', 'ok');
          this.focusPanel = true;
        } else this.say('根拠発見！ ' + ev.label + '（' + PH.REASONS[ev.reason].short + '）', 'ok');
        break;
      }
      case 'duplicate':
        this.say('この根拠はもう見つけているよ！', 'info');
        break;
      case 'irrelevant':
        PH.sound.play('soft');
        this.say(r.outsideQuad ? quadFirstText(p) : 'たしかに言える関係だね！ でも、今回の証明では使わない関係だよ。ほかの根拠を探そう！', 'info');
        break;
      case 'property-unproved':
        this.say(targetPropertyText(p), 'ng');
        break;
      case 'via-unproved':
        this.say('錯角・同位角が等しいことを、先に証明する必要があるよ！', 'ng');
        break;
      case 'not-proved':
        this.say(r.evidence.label + ' は、理由を1つ選ぶだけでは言えないよ。「📝 詳しい理由を説明する」で説明しよう！', 'ng');
        break;
      case 'wrong-reason':
        this.say(what + 'は見つけられたね！ でも、理由をもう一度考えてみよう。', 'ng');
        break;
      default:
        this.say(par ? 'この2つの辺が平行とは、まだ言えないよ！ 仮定や、証明できたことを確認しよう。'
          : 'この2つが等しいとは、まだ言えないよ！ 仮定や、証明できたことを確認しよう。', 'ng');
    }
    if (r.miss) {
      PH.sound.play('wrong');
      this.shake = true;
    }
    this.render();
  };

  PlayController.prototype.confirmQuadCondition = function () {
    const g = this.game;
    const r = g.confirmCondition();
    if (r.status === 'incomplete') return;
    if (r.ok) return this.cleared();
    const tname = PH.quadTypeName(this.problem);
    if (r.status === 'alternative') {
      PH.sound.play('soft');
      this.say('その条件でも' + tname + 'といえる場合があるよ。今回は集めた根拠を使って考えよう！', 'info');
    } else {
      PH.sound.play('wrong');
      this.shake = true;
      this.say(r.status === 'mixed-pair'
        ? '平行な辺と長さが等しい辺は、同じ1組の対辺かな？ 集めた根拠をもう一度確認しよう！'
        : r.status === 'wrong-type'
          ? 'それは' + PH.QUAD_TYPE_NAMES[r.type] + 'になるための条件だよ！ 今回証明するのは' + tname + 'だね。'
        : r.status === 'too-specific'
          ? 'それは' + PH.QUAD_TYPE_NAMES[r.type] + 'になるための条件だよ！ 集めた根拠で分かったことを、もう一度確認しよう。'
          : '集めた根拠と成立条件の関係を確認しよう！ どの辺・角・対角線についての関係かな？', 'ng');
    }
    this.render();
  };

  PlayController.prototype.confirmCondition = function () {
    const g = this.game;
    if (g.phase === 'qcondition') return this.confirmQuadCondition();
    const r = g.confirmCondition();
    if (r.status === 'incomplete') return;
    if (r.status === 'classic-condition') {
      // 直角三角形の問題で3つの合同条件を選んだ（ミスにはしない）
      PH.sound.play('soft');
      this.say('3つの合同条件で示せる場合もあるけれど、今回集めた根拠（直角・斜辺・' +
        PH.rightTriangle.ROLE_LABEL[g.roles[2]] + '）には、直角三角形の合同条件がぴったり合うよ。選び直そう！', 'info');
      this.render();
      return;
    }
    if (!r.ok) {
      PH.sound.play('wrong');
      this.shake = true;
      this.say(g.isRight()
        ? '集めた根拠をもう一度確認しよう！ 斜辺のほかに等しいのは、辺かな？ 角かな？'
        : '集めた3つの根拠をもう一度確認しよう！', 'ng');
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
    this.root.classList.toggle('is-result', clear);     // 正解画面（PC・タブレットでは図を固定し、証明文だけスクロール）
    doc.body.classList.toggle('has-result', clear);
    this.ref('count').textContent = String(g.partFound().length);
    this.ref('countTotal').textContent = '/' + g.total();
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
          flash: this.flashKeys, flashLines: this.flashLines, autoMarks: g.autoMarks(), interactive: false,
          // 平行四辺形の問題は、証明した四角形と平行の矢印を表示する（三角形の色分けはしない）
          triangles: !g.quad, quad: g.quad ? { vertices: this.problem.targetQuadrilateral, check: false } : null,
          parallelMarks: g.autoParallel(),
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
    // 「三角形確認」のボタン（図の右のボタン）：STEP 1 の前は「三角形を探すヒント」を表示する（正しい三角形は見せない）
    const tb = this.ref('triBtn');
    if (tb) {
      const qv = this.quadView();
      tb.setAttribute('title', qv ? '証明する四角形を確認' : this.trianglesHidden() ? '三角形を探すヒント' : '証明する三角形を確認');
      tb.setAttribute('aria-label', qv ? '四角形確認' : '三角形確認');
      tb.querySelector('.lbl').textContent = qv ? '四角形確認' : '三角形確認';
      tb.querySelector('.ico').textContent = qv ? '□' : '△';
    }
    PH.renderer.render(this.ref('svg'), this.problem, {
      selection: g.selection,
      flash: this.flashKeys,
      autoMarks: g.autoMarks(),
      hypotenuse: g.hypotenuseKeys(),
      userMarks: g.userMarks,
      flashLines: this.flashLines,
      // 合同が成立したら（STEP 4）2つの三角形を色分けして表示する
      triangles: this.quadView() ? false : this.triCheck && !this.trianglesHidden() ? 'check' : g.phase === 'final',
      // Ver.0.9：平行四辺形の部分では、証明する四角形を薄く表示（「四角形確認」で対辺・対角を色分け）
      quad: this.quadView() ? { vertices: this.problem.targetQuadrilateral, check: this.triCheck } : null,
      parallelMarks: g.autoParallel(),
      triSel: g.phase === 'triangle' ? g.triSel : null,
      interactive: true,
      // 辺選択では辺だけ、角選択では角だけ、印つけでは選んだ印の種類だけ、消すでは両方、三角形選択では三角形がタップに反応する
      hit: g.mode === 'erase' ? { seg: true, ang: true }
        : g.mode === 'mark' ? { seg: g.markTool.kind === 'seg', ang: g.markTool.kind === 'ang' }
        : g.mode === 'tri' ? { tri: true }
        : g.mode === 'step' ? {}
        : { seg: g.mode === 'side', ang: g.mode === 'angle' },
      angleGuide: g.mode === 'angle' && (g.phase === 'collect' || g.phase === 'final' || g.phase === 'step' || g.phase === 'qcollect'),
    });
  };

  PlayController.prototype.renderToolbar = function () {
    const g = this.game;
    this.root.querySelectorAll('.toolbar [data-mode]').forEach(function (b) {
      const m = b.getAttribute('data-mode');
      b.setAttribute('aria-pressed', String(g.mode === m || (m === 'mark' && g.mode === 'erase')));   // 消すは印つけの中
      b.disabled = m !== 'mark' && m !== 'erase' && g.phase !== 'collect' && g.phase !== 'final' && g.phase !== 'qcollect';
    });
  };

  /*
   * STEP の表示：三角形 → 根拠 → 合同条件 → 結論（→ 後半のステップ）
   * 多段階証明では、根拠の中で「詳しい理由を説明する」ときのステップ（定理・角の式・式を比べる）を、根拠の下の小さな手順として表示する
   */
  PlayController.prototype.stepBar = function () {
    const g = this.game;
    if (g.quad) return this.quadStepBar();
    if (!g.hasFinal && !g.engine) return '';
    const ORDER = ['triangle', 'collect', 'congruence', 'final', 'clear'];
    const at = function (ph) { return ORDER.indexOf(ph === 'step' ? 'collect' : ph === 'post' ? 'final' : ph); };
    const now = at(g.phase);
    let steps = [['triangle', '三角形'], ['collect', '根拠'], ['congruence', '合同条件'], ['final', '結論']];
    if (!g.hasFinal) steps = steps.filter(function (s) { return s[0] !== 'triangle' && s[0] !== 'final'; });
    if (PH.isGoalOnly(this.problem)) steps = [['collect', '等しい角']];        // Ver.1.0（p50）：合同を使わない
    const items = steps.map(function (st) {
      const i = at(st[0]);
      return { label: st[1], state: i < now || (st[0] === 'final' && g.phase === 'post') ? 'is-done' : i === now ? 'is-now' : '' };
    });
    if (g.engine) {
      // 説明のステップ（同じ種類が続くものは1つにまとめる）は根拠の下に、後半のステップは最後に
      const NAME = { theorem: '定理を使う', expression: '角の式', compare: '式を比べる' };
      const groups = [];
      PH.proofEngine.stepsOf(this.problem, 'pre').forEach(function (s) {
        const last = groups[groups.length - 1];
        if (last && last.type === s.type) last.ids.push(s.id);
        else groups.push({ type: s.type, ids: [s.id] });
      });
      const stateOf = function (ids) {
        if (ids.every(function (id) { return g.engine.done[id]; })) return 'is-done';
        return ids.indexOf(g.stepId) >= 0 && (g.phase === 'step' || g.phase === 'post') ? 'is-now' : '';
      };
      const pre = groups.map(function (gr) { return { label: NAME[gr.type], state: stateOf(gr.ids), sub: true }; });
      const ci = items.findIndex(function (it) { return it.label === '根拠' || it.label === '等しい角'; });
      items.splice.apply(items, [ci + 1, 0].concat(pre));
      PH.proofEngine.stepsOf(this.problem, 'post').forEach(function (s) { items.push({ label: s.short, state: stateOf([s.id]) }); });
    }
    let n = 0;
    return '<ol class="step-bar" aria-label="証明の手順">' + items.map(function (it) {
      return '<li class="' + it.state + (it.sub ? ' is-sub' : '') + '">' + (it.sub ? '<b>↳</b>' : '<b>' + (++n) + '</b>') + it.label + '</li>';
    }).join('') + '</ol>';
  };

  // Ver.0.9：平行四辺形の問題の手順（（三角形 → 根拠 → 合同条件 → 結論 →）平行四辺形の根拠 → 成立条件）
  PlayController.prototype.quadStepBar = function () {
    const g = this.game;
    const ORDER = ['triangle', 'collect', 'congruence', 'final', 'qcollect', 'qcondition', 'clear'];
    const ph = g.phase === 'step' ? (g.explainPart === 'quad' ? 'qcollect' : 'collect') : g.phase;
    const now = ORDER.indexOf(ph);
    const qlabel = PH.quadTypeName(this.problem) + 'の根拠';
    // 合同から導く結論は、辺の等しさ（p42 の BE＝DF）か角の等しさ（p35・p47・p48）
    const fsLabel = this.problem.finalStep && this.problem.finalStep.relationType === 'side' ? '辺の等しさ' : '角の等しさ';
    let steps = [['triangle', '三角形'], ['collect', '合同の根拠'], ['congruence', '合同条件'], ['final', fsLabel], ['qcollect', qlabel], ['qcondition', '成立条件']];
    if (!PH.hasLemma(this.problem)) steps = steps.slice(4);
    const items = steps.map(function (st) {
      const i = ORDER.indexOf(st[0]);
      return { label: st[1], state: i < now ? 'is-done' : i === now ? 'is-now' : '' };
    });
    if (g.engine) {
      const NAME = { theorem: '定理を使う', expression: '角の式', compare: '式を比べる' };
      const pre = PH.proofEngine.stepsOf(this.problem, 'pre').map(function (s) {
        return { label: s.short || NAME[s.type], state: g.engine.done[s.id] ? 'is-done' : g.stepId === s.id && g.phase === 'step' ? 'is-now' : '', sub: true };
      });
      const ci = items.findIndex(function (it) { return it.label === qlabel; });
      items.splice.apply(items, [ci + 1, 0].concat(pre));
    }
    let n = 0;
    return '<ol class="step-bar" aria-label="証明の手順">' + items.map(function (it) {
      return '<li class="' + it.state + (it.sub ? ' is-sub' : '') + '">' + (it.sub ? '<b>↳</b>' : '<b>' + (++n) + '</b>') + it.label + '</li>';
    }).join('') + '</ol>';
  };

  // 多段階証明のステップ（定理・角の式・式の比較）のパネル
  PlayController.prototype.stepPanel = function () {
    const g = this.game;
    const s = g.currentStep();
    const proof = PH.buildProof(this.problem);
    const no = {};
    proof.stepLines.forEach(function (l) { no[l.stepId] = l.no; });
    const avail = g.availableSteps(g.stepStage());
    const target = g.explainingEvidence();
    let html = '<div class="panel-head">🔗 ' + (s.type === 'compare' ? '2つの式を比べよう' : s.type === 'expression' ? '角の関係を見つけよう' : '定理を使おう') + '</div>' + this.stepBar() +
      (target ? '<p class="explain-target">説明する根拠：<b>' + esc(target.label) + '</b><button class="btn explain-back" data-act="explain-cancel">◀ 根拠の選択にもどる</button></p>' : '');
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
        html += '<p class="panel-note">' + deps.map(function (d) { return no[d.id]; }).join('、') +
          (g.cmpPrefilled() ? 'より、選んだ2つの角が等しいと言えるね。「決定」を押そう！' : 'より、等しくなる2つの角を図でタップしよう。') + '</p>' +
          '<div class="equation' + (g.selection.length === 2 ? ' is-ready' : '') + '">' +
            '<span class="eq-part' + (cand[0] ? ' filled' : '') + '">' + esc(cand[0] || '？') + '</span><span class="eq-sign">＝</span>' +
            '<span class="eq-part' + (cand[1] ? ' filled' : '') + '">' + esc(cand[1] || '？') + '</span></div>';
      }
    } else {
      const lead = s.type === 'expression'
        ? '<p class="step-premise">' + esc(s.note || s.premiseLabel + 'だから、正三角形の1つの角は60°') + '</p>' +
          '<p class="step-expr">' + esc(s.target + '＝' + PH.angleExpr.format(s.parts) + '＝') + '<span class="expr-blank">' + esc(g.stepChoice ? g.stepOptions(s).find(function (o) { return o.id === g.stepChoice; }).text : '？') + '</span></p>' +
          '<p class="panel-note">角の大きさを使って表すと、□に入る式はどれかな？</p>'
        : '<p class="step-premise">' + esc(s.lead || s.premiseLabel + 'より、') + '</p><p class="panel-note">' + (s.choices ? esc(s.choiceNote || '式を選ぼう') : '理由を選ぼう') + '</p>';
      html += lead + '<div class="choices reasons step-opts" role="group" aria-label="' + (s.type === 'expression' ? '式' : '理由') + '">' + g.stepOptions(s).map(function (o) {
        return '<button class="choice" data-step-opt="' + o.id + '" aria-pressed="' + (g.stepChoice === o.id) + '">' + esc(o.text) + '</button>';
      }).join('') + '</div>' +
        (s.type === 'theorem' ? '<p class="step-concl">' + (s.choices ? 'だから、' : '') + esc(s.label) + '</p>' : '');
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

  // STEP 1：証明する2つの三角形を選ぶパネル（ハンターは入門用なので、頂点の対応は答えない）
  PlayController.prototype.trianglePanel = function () {
    const g = this.game;
    const sel = g.triSel;
    let note;
    if (sel.length === 0) note = 'どの2つの三角形を合同にすればよい？ 図の三角形の内側をタップしよう。';
    else if (sel.length === 1) note = '2つ目の三角形をタップしよう。（もう一度タップで選び直し）';
    else note = '2つの三角形を選んだよ。「決定」を押そう！';
    const slotTri = function (tri, i) {
      return '<span class="tri-slot tri-slot-' + i + (tri ? ' filled' : '') + '">△' +
        (tri ? tri.map(function (c) { return '<span>' + esc(c) + '</span>'; }).join('') : '＿＿＿') + '</span>';
    };
    let html = '<div class="panel-head">△ 証明する三角形を選ぼう</div>' + this.stepBar() +
      '<p class="panel-note">' + note + '</p>' +
      '<div class="tri-answer" aria-label="選んだ三角形">' + slotTri(sel[0], 0) + '<span class="tri-and">と</span>' +
        slotTri(sel[1], 1) + '<span class="tri-and">において</span></div>';
    html += '<div class="panel-actions">' +
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
      // Ver.1.0：「消す」は印つけモードの中のボタン（ツールバーの「消す」はヒントに変えた）
      const erasing = g.mode === 'erase';
      html += '<div class="panel-head">🖍️ 印つけモード</div>' +
        '<p class="panel-note">' + (erasing ? '消したい印がついた辺や角をタップしよう。見つけた根拠の印（緑）は消えないよ。'
          : '印の種類を1つ選ぼう。「辺の印」なら辺だけ、「角の印」なら角だけに印をつけられるよ。印は下書き用で、正誤判定はしないよ。') + '</p>' +
        '<div class="palette">' +
          '<div class="palette-row"><span class="palette-label">辺の印</span>' +
            MARK_TOOLS.filter(function (t) { return t[0] === 'seg'; }).map(function (t) {
              return '<button class="tool-mark" data-tool="seg:' + t[1] + '" aria-pressed="' + (!erasing && g.markTool.kind === 'seg' && g.markTool.n === t[1]) + '" aria-label="辺の印 ' + t[1] + '本線">' + toolIcon('seg', t[1]) + '</button>';
            }).join('') + '</div>' +
          '<div class="palette-row"><span class="palette-label">角の印</span>' +
            MARK_TOOLS.filter(function (t) { return t[0] === 'ang'; }).map(function (t) {
              return '<button class="tool-mark" data-tool="ang:' + t[1] + '" aria-pressed="' + (!erasing && g.markTool.kind === 'ang' && g.markTool.n === t[1]) + '" aria-label="角の印 円弧' + t[1] + '本">' + toolIcon('ang', t[1]) + '</button>';
            }).join('') + '</div>' +
          '<div class="palette-row"><span class="palette-label">消す</span>' +
            '<button class="tool-mark tool-erase" data-act="erase-toggle" aria-pressed="' + erasing + '" aria-label="印を消す">🧽</button>' +
          '</div>' +
        '</div>';
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

    if (g.phase === 'qcondition') {
      const qname = PH.quadrilateral.name(this.problem.targetQuadrilateral);
      const chain = this.problem.parallelogram.chain;
      html += '<div class="panel-head">▱ 成立条件を選ぼう！</div>' + this.stepBar() +
        // Ver.1.0：4つの辺（角）がすべて等しいことは入力させず、集めた根拠から確認して表示する
        (chain ? '<p class="quad-chain">集めた根拠から <b>' + esc(chain) + '</b></p>' : '') +
        '<p class="panel-note">根拠がそろった！ どの条件で <b>' + esc(qname) + '</b> が' + esc(PH.quadTypeName(this.problem)) + 'といえるかな？</p>' +
        '<div class="choices conds conds-5">' +
          g.conditionOptions().map(function (id, i) {
            return '<button class="choice" data-cond="' + id + '" aria-pressed="' + (g.pcondition === id) + '">' +
              '<span class="choice-no">' + CIRCLED[i] + '</span>' + esc(PH.quadCondition(id).label) + '</button>';
          }).join('') +
        '</div>' +
        '<div class="panel-actions"><button class="btn btn-confirm btn-wide" data-act="confirm-cond"' + (g.pcondition ? '' : ' disabled') + '>証明を完成する</button></div>' +
        this.feedbackHtml();
      panel.innerHTML = html;
      return;
    }

    if (g.phase === 'congruence') {
      html += '<div class="panel-head">⚖️ 合同条件を見極めよう！</div>' + this.stepBar() +
        '<p class="panel-note">3つの根拠がそろった！ どの合同条件で <b>' + esc(PH.congruenceText(this.problem)) + '</b> といえるかな？</p>' +
        '<div class="choices conds' + (g.isRight() ? ' conds-5' : '') + '">' +
          g.conditionOptions().map(function (id, i) {
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
      // 四角形の問題（p42・p47・p48）は、合同から導いた等しさを四角形の根拠に使う（結論そのものではない）
      if (n === 0) note = PH.isQuadProblem(this.problem)
        ? PH.congruenceText(this.problem) + ' が証明できた！ <b>' + esc(PH.quadrilateral.name(this.problem.targetQuadrilateral)) + '</b>が' + esc(PH.quadTypeName(this.problem)) +
          'であることを示すのに使う、合同な図形の対応する' + fw + 'で等しい2つの' + fw + 'を選ぼう。'
        : PH.congruenceText(this.problem) + ' が証明できた！ 結論 <b>' + esc(this.problem.conclusion) + '</b> になる2つの' + fw + 'を選ぼう。';
      else if (n === 1) note = '2つ目の' + what + 'をタップしよう。';
      else if (!g.reason) note = 'その2つが等しい理由を選ぼう。';
      else note = '「証明を完成する」を押そう！';
    }

    // Ver.0.9：平行四辺形の根拠（辺は「＝」と「∥」を切りかえる）
    const qc = g.phase === 'qcollect';
    const par = qc && g.relation === 'parallel';
    if (qc) {
      const qname = PH.quadrilateral.name(this.problem.targetQuadrilateral);
      if (n === 0) note = qname + 'が' + PH.quadTypeName(this.problem) + 'になるための根拠を探そう！ ' + (g.mode === 'angle'
        ? '等しい角を、角の内側をタップして選ぼう。'
        : '2つの辺をタップしよう。平行を示すときは「＝⇔∥」で ∥ に切りかえよう。');
      else if (n === 1) note = '2つ目の' + what + 'をタップしよう。';
      else if (!g.reason) note = (par ? '平行と言える' : '等しいと言える') + '理由を選ぼう。';
    }
    // Ver.0.8：直角三角形の問題は、今集めている欄（直角・斜辺・他の1辺・鋭角）を見出しに出す
    const RT = PH.rightTriangle;
    // 直角三角形の欄は、三角形の合同の根拠を集めているときだけ（四角形の根拠を集める段階では出さない。p42）
    const roleNow = g.phase === 'collect' && g.isRight() ? g.role : null;
    let head = final ? '⭐ 結論を導こう！' : qc ? '▱ ' + PH.quadTypeName(this.problem) + 'の根拠をさがそう' : g.mode === 'angle' ? '∠ 等しい角をさがそう' : '／ 等しい辺をさがそう';
    if (roleNow) {
      head = roleNow === 'right' ? '📐 直角を確かめよう' : '📐 ' + RT.ROLE_LABEL[roleNow] + 'をさがそう';
      if (n === 0) note = {
        right: '2つの三角形の直角を、角の内側をタップして選ぼう。図が直角に見えるだけではダメ。理由も選ぶよ。',
        hypotenuse: '斜辺は、直角に向かい合う辺だよ。2つの三角形の斜辺をタップしよう（共通な辺は同じ辺を2回）。',
        leg: '斜辺ではない、もう1組の等しい辺（他の1辺）をタップしよう。',
        acute: '直角ではない方の角（鋭角）で、等しい2つの角をタップしよう。',
      }[roleNow] + (g.mode !== (roleNow === 'right' || roleNow === 'acute' ? 'angle' : 'side') ? '（' + (roleNow === 'right' || roleNow === 'acute' ? '角選択' : '辺選択') + 'に切り替えよう）' : '');
      else if (roleNow === 'right' && n === 1) note = 'もう1つの三角形の直角をタップしよう。';
      else if (roleNow === 'right' && n === 2 && !g.reason) note = '2つの角が90°と言える理由を選ぼう。';
    }
    // Ver.1.0（p50）：合同を使わない問題は、どの2つの角が等しいことを言えばよいかを最初に案内する
    if (PH.isGoalOnly(this.problem) && g.phase === 'collect' && n === 0) {
      head = '∠ 等しい2つの角をさがそう';
      note = esc(this.problem.goalPrompt);
    }
    html += '<div class="panel-head">' + head + '</div>' + this.stepBar() +
      (roleNow ? '<p class="role-now">いま集める根拠：<b class="role-tag role-' + roleNow + '">' + RT.ROLE_LABEL[roleNow] + '</b><span>' + esc(RT.ROLE_NOTE[roleNow]) + '</span></p>' : '') +
      '<p class="panel-note">' + note + '</p>' +
      '<div class="equation' + (n === 2 ? ' is-ready' : '') + (same ? ' is-common' : '') + '" aria-label="等式の候補">' +
        '<span class="eq-part' + (cand[0] ? ' filled' : '') + '">' + esc(cand[0] || '？') + '</span>' +
        (qc && g.canToggleRelation()
          ? '<button class="eq-sign eq-rel" data-act="toggle-rel" aria-label="＝と∥を切りかえる（いまは' + (par ? '平行' : '等しい') + '）">' + (par ? '∥' : '＝') + '<small>＝⇔∥</small></button>'
          : '<span class="eq-sign">' + (par ? '∥' : '＝') + '</span>') +
        '<span class="eq-part' + (cand[1] ? ' filled' : '') + '">' + esc(cand[1] || '？') + '</span>' +
        (roleNow === 'right' ? '<span class="eq-sign">＝</span><span class="eq-part filled eq-90">90°</span>' : '') +
      '</div>' +
      '<div class="reasons-label">' + (roleNow === 'right' ? '90°と言える理由' : par ? '平行と言える理由' : '等しい理由') + '</div>' +
      '<div class="choices reasons" role="group" aria-label="等しい理由">' +
        g.availableReasons().map(function (id) {
          return '<button class="choice" data-reason="' + id + '" aria-pressed="' + (g.reason === id) + '"' + (n === 2 ? '' : ' disabled') + '>' +
            esc(PH.REASONS[id].label) + '</button>';
        }).join('') +
      '</div>' +
      // 多段階証明：前のステップで導く根拠は、理由を選ぶかわりに「詳しい理由を説明する」（2つ選べばどの組でも押せる）
      (!final && g.canExplain()
        ? '<button class="btn btn-explain" data-act="explain"' + (n === 2 ? '' : ' disabled') + '>📝 詳しい理由を説明する</button>' +
          '<p class="explain-note">理由を1つ選ぶだけでは言えない等式は、式や図形の性質を使って説明しよう。</p>'
        : '') +
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
    // 四角形の根拠を集める段階（p42）は、直角三角形の欄ではなく四角形の根拠の欄にする
    if (g.isRight() && g.part !== 'quad') {
      // Ver.0.8：直角三角形の根拠の欄（直角 → 斜辺 → 他の1辺／鋭角）。空いている欄はタップで選べる
      const RT = PH.rightTriangle;
      g.roles.forEach(function (role) {
        const id = g.found.find(function (x) { return g.roleOf(g.evidenceById(x)) === role; });
        if (id) {
          const ev = g.evidenceById(id);
          html += '<button class="slot filled slot-role role-' + role + (self.newSlot === id ? ' is-new' : '') + '" data-ev="' + id + '" aria-label="' + RT.ROLE_LABEL[role] + ' ' + esc(PH.evidenceText(ev)) + ' ' + esc(PH.REASONS[ev.reason].label) + '">' +
            '<span class="slot-role-tag">' + RT.ROLE_LABEL[role] + '</span>' +
            '<span class="slot-eq">' + esc(PH.evidenceText(ev)) + '</span>' +
            '<span class="slot-reason">' + esc(PH.REASONS[ev.reason].short) + '</span></button>';
        } else {
          const on = g.phase === 'collect' && g.role === role;
          html += '<button class="slot empty slot-role role-' + role + (on ? ' is-active' : '') + '" data-role="' + role + '" aria-pressed="' + on + '"' + (g.phase === 'collect' ? '' : ' disabled') + '>' +
            '<span class="slot-role-tag">' + RT.ROLE_LABEL[role] + '</span><span class="slot-q">？</span></button>';
        }
      });
      const slots = this.ref('slots');
      slots.innerHTML = html;
      const facts = this.ref('facts');
      if (facts) facts.innerHTML = this.factsHtml();
      slots.classList.toggle('complete', g.found.length === total);
      slots.classList.add('slots-role');
      this.newSlot = null;
      return;
    }
    const foundList = g.partFound();
    for (let i = 0; i < total; i++) {
      const id = foundList[i];
      if (id) {
        const ev = g.evidenceById(id);
        html += '<button class="slot filled' + (self.newSlot === id ? ' is-new' : '') + '" data-ev="' + id + '" aria-label="根拠' + CIRCLED[i] + ' ' + esc(PH.evidenceText(ev)) + ' ' + esc(PH.REASONS[ev.reason].label) + '">' +
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
    slots.classList.toggle('complete', foundList.length === total);
    slots.classList.remove('slots-role');
    const note = this.root.querySelector('.slots-note');
    if (note && g.part === 'quad') note.textContent = '見つけた根拠をタップすると、図の場所が光るよ';
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
            (proof.goalOnly
              ? '<p class="proof-intro">' + esc(proof.intro) + '</p><ol class="proof-lines">' + stepLinesHtml(proof) + '</ol>' + postProofHtml(proof)
              : '') +
            (proof.intro && !proof.goalOnly ? '<p class="proof-intro">' + esc(proof.intro) + '</p>' +
              '<ol class="proof-lines">' + lines + stepLinesHtml(proof) + '</ol>' +
              '<p class="proof-sum">' + esc(proof.summary) + '</p>' +
              '<p class="proof-cond"><strong>' + esc(proof.condition) + '</strong>ので、</p>' +
              '<p class="proof-concl' + (proof.final ? ' is-mid' : '') + '">' + esc(proof.conclusion) + '</p>' +
              finalProofHtml(proof) + postProofHtml(proof) : '') +
            quadProofHtml(proof) +
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
      // 後半のステップ・平行四辺形の部分（Ver.0.9）が続くときは途中の結果（番号つき）
      '<p class="proof-concl ' + ((proof.post && proof.post.length) || proof.quad ? 'is-mid' : 'proof-goal') + '"><button class="pl-eq" data-act="final-flash">' + esc(conclusionText || proof.final.conclusion) +
        (proof.final.no ? '<span class="pl-no">……' + proof.final.no + '</span>' : '') + '</button></p>' +
      '</div>';
  }

  /*
   * 平行四辺形の部分の証明文（Ver.0.9）
   *   四角形ABCDにおいて / 仮定より AB＝DC ……① / … / ①、②より、/ 2組の対辺がそれぞれ等しいので、/ 四角形ABCDは平行四辺形である。
   *   rowsHtml を渡すと、根拠の行をそれにする（パズルで生徒が組み立てた行）
   */
  function quadProofHtml(proof, rowsHtml) {
    const q = proof.quad;
    if (!q) return '';
    const rows = rowsHtml != null ? rowsHtml : q.lines.map(function (l) {
      return '<li class="proof-line">' +
        '<button class="pl-reason" data-proof-reason="' + l.evidenceId + '">' + esc(l.reason) + '</button>' +
        '<button class="pl-eq" data-ev="' + l.evidenceId + '">' + esc(l.equation) + '<span class="pl-no">……' + l.no + '</span></button>' +
        '</li>';
    }).join('');
    return '<div class="proof-quad">' +
      q.intro.map(function (t) { return '<p class="proof-intro">' + esc(t) + '</p>'; }).join('') +
      '<ol class="proof-lines">' + rows + stepLinesHtml({ stepLines: q.stepLines }) + '</ol>' +
      '<p class="proof-sum">' + esc(q.summary) + '</p>' +
      (q.chain ? '<p class="proof-chain">' + esc(q.chain) + '</p>' : '') +
      '<p class="proof-cond"><strong>' + esc(q.condition) + '</strong>' + (/(平行|直角)$/.test(q.condition) ? 'な' : '') + 'ので、</p>' +
      '<p class="proof-concl proof-goal">' + esc(q.conclusion) + '</p>' +
      '</div>';
  }

  // 正しいが、証明する四角形の外の辺・角をふくむ関係を根拠にしようとしたとき（p40 の AD∥BC。AD∥EF を説明するときに使う）
  function quadFirstText(p) {
    return 'たしかに言える関係だね！ でも、まずは' + PH.quadrilateral.name(p.targetQuadrilateral) + 'の辺や角から選んでね！';
  }

  // 証明する四角形の性質を、平行四辺形と分かる前に使ったときのメッセージ
  function targetPropertyText(p) {
    const t = PH.quadTypeName(p);
    return 'それは、' + PH.quadrilateral.name(p.targetQuadrilateral) + 'が' + t + 'だと証明できてから使える性質だよ！ ' +
      '「' + t + 'の性質」と「' + t + 'になるための条件」を区別しよう。';
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

  // 合同を証明する三角形の辺・角ではないものを選んだとき（例：p23 の ∠BCA＝∠DCE。正しい関係でも根拠にならない）
  function outsideText(g) {
    const t = g.triangles || g.problem.triangles;
    return '合同を証明したい' + triName(t[0]) + 'と' + triName(t[1]) + 'の辺や角を選ぼう。';
  }

  // 欄に合わない根拠のメッセージ（Ver.0.8）：正しい根拠だが、今集めている欄（斜辺など）ではない
  function wrongRoleText(p, r) {
    const RT = PH.rightTriangle;
    const want = RT.ROLE_LABEL[r.want], got = RT.ROLE_LABEL[r.role];
    if (r.want === 'hypotenuse' && r.role === 'leg') {
      return r.evidence.label + ' は等しいけれど、斜辺ではなく「他の1辺」だよ。斜辺は、直角に向かい合う辺だよ。';
    }
    if (r.want === 'leg' && r.role === 'hypotenuse') return r.evidence.label + ' は斜辺だよ。「他の1辺」は、斜辺ではない方の辺だよ。';
    if (r.role === 'right') return 'それは2つの三角形の直角だね！ 今は「' + want + '」の欄だよ。直角の欄をタップして入れよう。';
    return PH.evidenceText(r.evidence) + ' は「' + got + '」の根拠だね。今は「' + want + '」の欄だよ。欄を確認しよう！';
  }

  // ---------------------------------------------------------------------

  let current = null;

  PH.finalProofHtml = finalProofHtml;
  PH.stepLinesHtml = stepLinesHtml;
  PH.postProofHtml = postProofHtml;
  PH.quadProofHtml = quadProofHtml;
  PH.targetPropertyText = targetPropertyText;

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
      if (current) {
        current.destroy();
        current.root.classList.remove('is-result');
        doc.body.classList.remove('has-result');
      }
      current = null;
    },
    current: function () { return current; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
