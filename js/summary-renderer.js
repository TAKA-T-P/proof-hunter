/*
 * summary-renderer.js — 条件・定義のまとめ・条件・定義クイズの画面（Ver.1.3）
 *
 *   #/summary          まとめ（三角形の合同条件・二等辺三角形・平行四辺形になるための条件・特別な平行四辺形）
 *   #/summary/quiz     クイズ（開くたびに新しい15問。再読み込みでもはじめから）
 *   #/summary/result   結果（直近の挑戦。正解数・クリアタイム・自己ベスト・1問ずつの答え）
 * 問題・判定・時間の計算は PH.summary（summary.js）。この画面は操作を渡して描画するだけにする。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const doc = root.document;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function now() { return root.performance && root.performance.now ? root.performance.now() : Date.now(); }
  // クリアタイム（1:23.4 の形）
  function fmtTime(ms) {
    const ds = Math.floor(ms / 100);
    const s = Math.floor(ds / 10);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0') + '.' + (ds % 10);
  }
  function S() { return PH.summary; }

  // ---- 図（SVG） -------------------------------------------------------------------

  function r1(v) { return Math.round(v * 10) / 10; }
  function unit(p, q) {
    const dx = q[0] - p[0], dy = q[1] - p[1], len = Math.hypot(dx, dy) || 1;
    return [dx / len, dy / len];
  }
  function along(p, q, t) { return [p[0] + (q[0] - p[0]) * t, p[1] + (q[1] - p[1]) * t]; }
  function line(a, b, cls) {
    return '<line x1="' + r1(a[0]) + '" y1="' + r1(a[1]) + '" x2="' + r1(b[0]) + '" y2="' + r1(b[1]) + '" class="' + cls + '"/>';
  }
  function poly(pts, cls) {
    return '<polygon points="' + pts.map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ') + '" class="' + (cls || 'sf-shape') + '"/>';
  }
  // 等しい辺の印（辺 pq の位置 t に n 本）
  function tick(p, q, n, t) {
    const d = unit(p, q), m = along(p, q, t === undefined ? 0.5 : t), nv = [-d[1], d[0]];
    let s = '';
    for (let k = 0; k < n; k++) {
      const o = (k - (n - 1) / 2) * 4;
      const c = [m[0] + d[0] * o, m[1] + d[1] * o];
      s += line([c[0] - nv[0] * 6, c[1] - nv[1] * 6], [c[0] + nv[0] * 6, c[1] + nv[1] * 6], 'sf-mark');
    }
    return s;
  }
  // 平行の印（p → q の向きの矢じり n 個）
  function arrow(p, q, n, t) {
    const d = unit(p, q), m = along(p, q, t === undefined ? 0.5 : t), nv = [-d[1], d[0]];
    let s = '';
    for (let k = 0; k < n; k++) {
      const o = (k - (n - 1) / 2) * 5 + 3;
      const tip = [m[0] + d[0] * o, m[1] + d[1] * o];
      const back = [tip[0] - d[0] * 6, tip[1] - d[1] * 6];
      s += '<polyline points="' + r1(back[0] + nv[0] * 4.5) + ',' + r1(back[1] + nv[1] * 4.5) + ' ' + r1(tip[0]) + ',' + r1(tip[1]) + ' ' +
        r1(back[0] - nv[0] * 4.5) + ',' + r1(back[1] - nv[1] * 4.5) + '" class="sf-mark"/>';
    }
    return s;
  }
  // 等しい角の印（頂点 v、2つの辺の向き a・b。n 本の弧）
  function arc(v, a, b, n) {
    const ua = unit(v, a), ub = unit(v, b);
    const sweep = ua[0] * ub[1] - ua[1] * ub[0] > 0 ? 1 : 0;
    let s = '';
    for (let k = 0; k < n; k++) {
      const r = 13 + k * 4;
      s += '<path d="M' + r1(v[0] + ua[0] * r) + ' ' + r1(v[1] + ua[1] * r) + ' A' + r + ' ' + r + ' 0 0 ' + sweep + ' ' +
        r1(v[0] + ub[0] * r) + ' ' + r1(v[1] + ub[1] * r) + '" class="sf-mark"/>';
    }
    return s;
  }
  // 直角の印
  function right(v, a, b) {
    const ua = unit(v, a), ub = unit(v, b), z = 10;
    const p1 = [v[0] + ua[0] * z, v[1] + ua[1] * z], p3 = [v[0] + ub[0] * z, v[1] + ub[1] * z];
    const p2 = [p1[0] + ub[0] * z, p1[1] + ub[1] * z];
    return '<polyline points="' + [p1, p2, p3].map(function (p) { return r1(p[0]) + ',' + r1(p[1]); }).join(' ') + '" class="sf-mark"/>';
  }

  const TRI = [[20, 100], [62, 22], [112, 100]];      // ふつうの三角形
  const RT = [[22, 100], [22, 24], [115, 100]];       // 直角三角形（頂点0が直角、辺1-2が斜辺）
  const PARA = [[48, 18], [196, 18], [166, 98], [18, 98]];

  // 三角形の印（2つ目は左右を反転して並べる）
  function triPair(pts, marks) {
    const one = poly(pts) + marks;
    return '<svg viewBox="0 0 250 116" class="sf-svg">' + one +
      '<g transform="translate(250,0) scale(-1,1)">' + one + '</g></svg>';
  }
  function paraFig(marks, extra) {
    return '<svg viewBox="0 0 214 116" class="sf-svg">' + poly(PARA) + (extra || '') + marks + '</svg>';
  }
  function shapeFig(pts, name) {
    return '<svg viewBox="0 0 200 116" class="sf-svg">' + poly(pts, 'sf-shape sf-plain') +
      '<text x="100" y="62" class="sf-name">' + esc(name) + '</text></svg>';
  }

  const T = TRI, R = RT, P = PARA;
  const O = along(P[0], P[2], 0.5);
  const FIGS = {
    'tri-sss': function () { return triPair(T, tick(T[0], T[1], 1) + tick(T[1], T[2], 2) + tick(T[2], T[0], 3)); },
    'tri-sas': function () { return triPair(T, tick(T[0], T[1], 1) + tick(T[0], T[2], 2) + arc(T[0], T[1], T[2], 1)); },
    'tri-asa': function () { return triPair(T, tick(T[0], T[2], 1) + arc(T[0], T[1], T[2], 1) + arc(T[2], T[1], T[0], 2)); },
    'tri-rha': function () { return triPair(R, right(R[0], R[1], R[2]) + tick(R[1], R[2], 1) + arc(R[2], R[1], R[0], 1)); },
    'tri-rhs': function () { return triPair(R, right(R[0], R[1], R[2]) + tick(R[1], R[2], 1) + tick(R[0], R[1], 2)); },
    'para-par': function () {
      return paraFig(arrow(P[0], P[1], 1) + arrow(P[3], P[2], 1) + arrow(P[3], P[0], 2) + arrow(P[2], P[1], 2));
    },
    'para-side': function () {
      return paraFig(tick(P[0], P[1], 1) + tick(P[3], P[2], 1) + tick(P[1], P[2], 2) + tick(P[3], P[0], 2));
    },
    'para-angle': function () {
      return paraFig(arc(P[0], P[1], P[3], 1) + arc(P[2], P[3], P[1], 1) + arc(P[1], P[0], P[2], 2) + arc(P[3], P[2], P[0], 2));
    },
    'para-diag': function () {
      return paraFig(tick(P[0], O, 1) + tick(O, P[2], 1) + tick(P[1], O, 2) + tick(O, P[3], 2),
        line(P[0], P[2], 'sf-diag') + line(P[1], P[3], 'sf-diag'));
    },
    'para-one': function () { return paraFig(arrow(P[0], P[1], 1, 0.35) + arrow(P[3], P[2], 1, 0.35) + tick(P[0], P[1], 1, 0.65) + tick(P[3], P[2], 1, 0.65)); },
    'def-iso': function () { return shapeFig([[50, 104], [100, 12], [150, 104]], '二等辺三角形'); },
    'def-equi': function () { return shapeFig([[46, 104], [154, 104], [100, 10.5]], '正三角形'); },
    'def-rect': function () { return shapeFig([[25, 22], [175, 22], [175, 100], [25, 100]], '長方形'); },
    'def-rhombus': function () { return shapeFig([[100, 6], [168, 58], [100, 110], [32, 58]], 'ひし形'); },
    'def-square': function () { return shapeFig([[55, 14], [145, 14], [145, 104], [55, 104]], '正方形'); },
  };
  function fig(id) { return FIGS[id] ? FIGS[id]() : ''; }

  // 二等辺三角形（定義・定理①②）
  function isoFig() {
    const a = [62, 14], b = [18, 112], c = [106, 112];
    const a2 = [182, 14], b2 = [138, 112], c2 = [226, 112], m2 = [182, 112];
    return '<svg viewBox="0 0 244 132" class="sf-svg sf-iso">' +
      poly([a, b, c]) + tick(a, b, 1) + tick(a, c, 1) + arc(b, a, c, 1) + arc(c, b, a, 1) +
      '<text x="62" y="10" class="sf-lbl">頂角</text><text x="62" y="104" class="sf-lbl">底角</text>' +
      '<text x="62" y="127" class="sf-lbl">底辺</text>' +
      poly([a2, b2, c2]) + tick(a2, b2, 1) + tick(a2, c2, 1) + line(a2, m2, 'sf-diag') +
      arc(a2, b2, m2, 1) + arc(a2, m2, c2, 1) + right(m2, a2, c2) + tick(b2, m2, 2) + tick(m2, c2, 2) +
      '</svg>';
  }

  // 台形・平行四辺形・長方形・ひし形・正方形の関係
  function vennFig() {
    return '<svg viewBox="0 0 260 176" class="sf-svg sf-venn">' +
      '<rect x="4" y="4" width="252" height="168" rx="12" class="sf-v1"/><text x="130" y="22" class="sf-vlbl">台形</text>' +
      '<rect x="20" y="30" width="220" height="134" rx="10" class="sf-v2"/><text x="130" y="48" class="sf-vlbl">平行四辺形</text>' +
      '<ellipse cx="100" cy="106" rx="66" ry="46" class="sf-v3"/><ellipse cx="160" cy="106" rx="66" ry="46" class="sf-v4"/>' +
      '<text x="70" y="104" class="sf-vlbl">長方形</text><text x="190" y="104" class="sf-vlbl">ひし形</text>' +
      '<text x="130" y="104" class="sf-vlbl sf-vsq">正方</text><text x="130" y="120" class="sf-vlbl sf-vsq">形</text>' +
      '</svg>';
  }

  // ---- まとめ ---------------------------------------------------------------------

  function condList(group, withFig) {
    const nums = ['①', '②', '③', '④', '⑤'];
    return '<ol class="sm-conds">' + S().QUESTIONS.filter(function (q) { return q.group === group; }).map(function (q, i) {
      return '<li class="sm-cond">' +
        '<span class="sm-num">' + nums[i] + '</span><span class="sm-text">' + esc(q.text) + '</span>' +
        (withFig ? '<span class="sm-fig" aria-hidden="true">' + fig(q.fig) + '</span>' : '') +
      '</li>';
    }).join('') + '</ol>';
  }

  function quizBox() {
    const r = PH.storage.getSummaryQuiz();
    return '<div class="card sm-quiz">' +
      '<button class="btn btn-confirm btn-big" data-go="#/summary/quiz">📝 条件・定義クイズ</button>' +
      '<p class="sm-quiz-desc">合同条件5つ・平行四辺形になるための条件5つ・定義5つの全15問。キーで言葉を並べて答えよう！</p>' +
      (r.best ? '<p class="sm-quiz-best">自己ベスト：<b>' + r.best.correct + '/' + r.best.total + '問</b>・<b>' + fmtTime(r.best.timeMs) + '</b>' +
        (r.lastResult ? ' <button class="btn btn-small" data-go="#/summary/result">前回の結果</button>' : '') + '</p>' : '') +
    '</div>';
  }

  function renderSummary(el) {
    el.innerHTML =
      '<header class="page-header">' +
        '<button class="head-btn" data-go="#/howto" aria-label="あそびかたのメニューに戻る"><span class="ico">◀</span><span class="lbl">メニュー</span></button>' +
        '<h1 class="page-title">条件・定義のまとめ</h1>' +
      '</header>' +
      '<div class="sm-body">' +
        quizBox() +
        '<section class="card sm-sec">' +
          '<h2 class="sm-h">三角形の合同条件</h2>' +
          condList('tri', true) +
          '<p class="sm-tip">💡 直角三角形の合同条件は（直角）＋（斜辺）＋（どれでも1つ）と考えるといいね！</p>' +
          '<div class="sm-box"><p class="sm-box-h">証明でよく使う三段論法</p>' +
            '<p>例：∠A＝∠C＋90°<br>　　∠B＝∠C＋90°<br>よって　∠A＝∠B</p></div>' +
        '</section>' +
        '<section class="card sm-sec">' +
          '<h2 class="sm-h">二等辺三角形・正三角形</h2>' +
          '<dl class="sm-defs">' +
            '<dt>定義</dt><dd>2辺が等しい三角形を<b>二等辺三角形</b>という</dd>' +
            '<dt>定理①</dt><dd>2つの底角は等しい</dd>' +
            '<dt>定理②</dt><dd>頂角の二等分線は、底辺を垂直に2等分する</dd>' +
            '<dt>条件</dt><dd>2つの角が等しい三角形は、二等辺三角形である</dd>' +
            '<dt>定義</dt><dd>3辺が等しい三角形を<b>正三角形</b>という</dd>' +
          '</dl>' +
          '<div class="sm-figwide" aria-hidden="true">' + isoFig() + '</div>' +
        '</section>' +
        '<section class="card sm-sec">' +
          '<h2 class="sm-h">平行四辺形になるための条件</h2>' +
          condList('para', true) +
          '<p class="sm-note">※ ④、⑤の条件で証明する問題が多い</p>' +
        '</section>' +
        '<section class="card sm-sec">' +
          '<h2 class="sm-h">特別な平行四辺形</h2>' +
          '<ul class="sm-special">' +
            '<li><b>ひし形</b>の定義：4つの辺が等しい四角形<span class="sm-prop">性質：対角線は垂直に交わる</span></li>' +
            '<li><b>長方形</b>の定義：4つの角が等しい四角形<span class="sm-prop">性質：対角線の長さは等しい</span></li>' +
            '<li><b>正方形</b>の定義：4つの角が等しく、4つの辺が等しい四角形</li>' +
          '</ul>' +
          '<ul class="sm-flow">' +
            '<li>平行四辺形 <span>→ となり合う辺を等しくする →</span> ひし形</li>' +
            '<li>平行四辺形 <span>→ 1つの角を直角にする →</span> 長方形</li>' +
            '<li>ひし形 <span>→ 1つの角を直角にする →</span> 正方形</li>' +
            '<li>長方形 <span>→ となり合う辺を等しくする →</span> 正方形</li>' +
          '</ul>' +
          '<div class="sm-figwide" aria-hidden="true">' + vennFig() + '</div>' +
          '<p class="sm-tip">💡 定義や条件は丸暗記ではなく、図とセットで理解するのがコツだよ！</p>' +
        '</section>' +
      '</div>';
  }

  // ---- クイズ ---------------------------------------------------------------------

  let session = null;
  let mounted = null;      // { el, nav, timer, onKey }
  let lastFeedback = null;

  function answerLine(q, tokens) {
    const chips = tokens.length
      ? tokens.map(function (t) { return '<span class="sq-chip">' + esc(t) + '</span>'; }).join('')
      : '<span class="sq-placeholder">下のキーで言葉を並べよう</span>';
    return '<div class="sq-answer" aria-live="polite">' + chips +
      (q.after ? '<span class="sq-after">' + esc(q.after) + '</span>' : '') + '</div>';
  }

  function keypad() {
    const full = session.input.length >= S().MAX_TOKENS;
    return '<div class="sq-pad">' +
      '<div class="sq-keys">' + session.keys().map(function (k) {
        return '<button class="sq-key" data-sq="key" data-key="' + esc(k) + '"' + (full ? ' disabled' : '') + '>' + esc(k) + '</button>';
      }).join('') + '</div>' +
      '<div class="sq-ops">' +
        '<button class="btn sq-op" data-sq="pop"' + (session.input.length ? '' : ' disabled') + '>⌫ 1つ消す</button>' +
        '<button class="btn sq-op" data-sq="clear"' + (session.input.length ? '' : ' disabled') + '>クリア</button>' +
        '<button class="btn btn-primary sq-op sq-submit" data-sq="submit"' + (session.input.length ? '' : ' disabled') + '>答える</button>' +
      '</div>' +
    '</div>';
  }

  function feedback(q, item) {
    return '<div class="sq-feedback ' + (item.correct ? 'is-ok' : 'is-ng') + '">' +
      '<p class="sq-judge">' + (item.correct ? '⭕ 正解！' : '❌ ざんねん…') + '</p>' +
      (item.correct ? '' : '<p class="sq-yours">あなたの答え：' + esc(item.input.join('')) + '</p>') +
      '<p class="sq-correct">' + esc(q.text) + (q.after ? esc(q.after) : '') + '</p>' +
      '<button class="btn btn-primary btn-big" data-sq="next">' + (session.isLast() ? '結果を見る ▶' : 'つぎへ ▶') + '</button>' +
    '</div>';
  }

  function renderQuiz() {
    const el = mounted.el;
    const q = session.current();
    const g = S().group(q.group);
    const fb = session.phase === 'feedback';
    el.innerHTML =
      '<header class="page-header">' +
        '<button class="head-btn" data-go="#/summary" aria-label="まとめに戻る"><span class="ico">◀</span><span class="lbl">まとめ</span></button>' +
        '<h1 class="page-title">条件・定義クイズ</h1>' +
        '<span class="sq-timer" id="sq-timer">' + fmtTime(session.timeAt(now())) + '</span>' +
      '</header>' +
      '<div class="sq-body">' +
        '<div class="sq-progress"><b>' + (session.index + 1) + '</b> / ' + session.total() +
          '<span class="sq-group sq-g-' + q.group + '">' + esc(g.label) + '</span>' +
          '<span class="sq-score">正解 ' + session.correctCount() + '</span></div>' +
        '<div class="card sq-q">' +
          '<div class="sq-fig" aria-hidden="true">' + fig(q.fig) + '</div>' +
          '<p class="sq-prompt">' + esc(S().prompt(q)) + '</p>' +
          answerLine(q, fb ? lastFeedback.input : session.input) +
        '</div>' +
        (fb ? feedback(q, lastFeedback) : keypad()) +
      '</div>';
    if (fb) el.querySelector('[data-sq="next"]').focus();
  }

  function tickTimer() {
    const t = doc.getElementById('sq-timer');
    if (t && session) t.textContent = fmtTime(session.timeAt(now()));
  }

  function act(kind, key) {
    if (!session) return;
    if (kind === 'key') { if (session.push(key)) { PH.sound.play('tap'); renderQuiz(); } return; }
    if (kind === 'pop') { if (session.pop()) { PH.sound.play('tap'); renderQuiz(); } return; }
    if (kind === 'clear') { if (session.clear()) { PH.sound.play('tap'); renderQuiz(); } return; }
    if (kind === 'submit') {
      const item = session.submit(now());
      if (!item) return;
      lastFeedback = item;
      PH.sound.play(item.correct ? 'get' : 'wrong');
      renderQuiz();
      return;
    }
    if (kind === 'next') {
      session.next(now());
      if (session.finished()) {
        PH.storage.recordSummaryQuiz(session.result());
        PH.sound.play('success');
        const nav = mounted.nav;
        unmount();
        nav.result();
        return;
      }
      PH.sound.play('tap');
      renderQuiz();
    }
  }

  function mountQuiz(el, nav) {
    unmount();
    session = new PH.summary.QuizSession();
    session.start(now());
    mounted = { el: el, nav: nav };
    mounted.onClick = function (e) {
      const b = e.target.closest('[data-sq]');
      if (!b || b.disabled) return;
      act(b.getAttribute('data-sq'), b.getAttribute('data-key'));
    };
    // パソコンでは Enter で答える・つぎへ、Backspace で1つ消す
    mounted.onKey = function (e) {
      if (!session || e.altKey || e.ctrlKey || e.metaKey) return;
      if (e.key === 'Enter') {
        if (session.phase === 'feedback') act('next');
        else act('submit');
        e.preventDefault();
      } else if (e.key === 'Backspace') {
        act('pop');
        e.preventDefault();
      }
    };
    el.addEventListener('click', mounted.onClick);
    doc.addEventListener('keydown', mounted.onKey);
    mounted.timer = root.setInterval(tickTimer, 100);
    renderQuiz();
  }

  function unmount() {
    if (!mounted) return;
    mounted.el.removeEventListener('click', mounted.onClick);
    doc.removeEventListener('keydown', mounted.onKey);
    root.clearInterval(mounted.timer);
    mounted = null;
    session = null;
  }

  // ---- 結果 -----------------------------------------------------------------------

  function renderResult(el) {
    const r = PH.storage.getSummaryQuiz();
    const last = r.lastResult;
    const head =
      '<header class="page-header">' +
        '<button class="head-btn" data-go="#/summary" aria-label="まとめに戻る"><span class="ico">◀</span><span class="lbl">まとめ</span></button>' +
        '<h1 class="page-title">クイズの結果</h1>' +
      '</header>';
    if (!last) {
      el.innerHTML = head + '<div class="sm-body"><div class="card sq-result"><p>まだ記録がありません。</p>' +
        '<button class="btn btn-confirm btn-big" data-go="#/summary/quiz">クイズに挑戦！</button></div></div>';
      return;
    }
    const perfect = last.correct === last.total;
    el.innerHTML = head +
      '<div class="sm-body">' +
        '<div class="card sq-result">' +
          (perfect ? '<p class="sq-perfect">🎉 全問正解！</p>' : '') +
          '<div class="sq-stats">' +
            '<div class="sq-stat"><span>正解数</span><b>' + last.correct + '<small> / ' + last.total + '問</small></b></div>' +
            '<div class="sq-stat"><span>クリアタイム</span><b>' + fmtTime(last.timeMs) + '</b></div>' +
          '</div>' +
          (last.newBest ? '<p class="sq-newbest">✨ 自己ベスト更新！</p>' : '') +
          (r.best ? '<p class="sq-best">自己ベスト：' + r.best.correct + '/' + r.best.total + '問・' + fmtTime(r.best.timeMs) + '</p>' : '') +
          '<p class="sq-time-note">※ 答え合わせを見ている時間は、クリアタイムにふくめない</p>' +
          '<div class="sq-result-btns">' +
            '<button class="btn btn-confirm btn-big" data-go="#/summary/quiz">もう一度挑戦</button>' +
            '<button class="btn btn-big" data-go="#/summary">まとめにもどる</button>' +
          '</div>' +
        '</div>' +
        '<div class="card sq-review"><h2 class="sm-h">ふりかえり</h2><ol class="sq-items">' +
          last.items.map(function (it) {
            const q = S().question(it.id);
            if (!q) return '';
            const label = q.group === 'def' ? q.name + 'の定義' : S().group(q.group).label + '（' + q.no + '）';
            return '<li class="sq-item ' + (it.correct ? 'is-ok' : 'is-ng') + '">' +
              '<span class="sq-mark">' + (it.correct ? '⭕' : '❌') + '</span>' +
              '<span class="sq-item-body"><span class="sq-item-label">' + esc(label) + '</span>' +
                '<span class="sq-item-text">' + esc(q.text) + (q.after ? esc(q.after) : '') + '</span>' +
                (it.correct ? '' : '<span class="sq-item-yours">あなたの答え：' + esc(it.input.join('')) + '</span>') +
              '</span></li>';
          }).join('') +
        '</ol></div>' +
      '</div>';
  }

  PH.summaryView = {
    renderSummary: renderSummary,
    mountQuiz: mountQuiz,
    renderResult: renderResult,
    unmount: unmount,
    fig: fig,
  };
})(typeof window !== 'undefined' ? window : globalThis);
