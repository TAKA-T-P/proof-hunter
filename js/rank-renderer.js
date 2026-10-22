/*
 * rank-renderer.js — 段位認定モードの画面（トップ・プレイ・結果・誤答の振り返り・段位一覧）
 *
 * 進行と判定は PH.RankGame（rank-game.js）が持ち、この画面は操作を渡して描画するだけにする。
 * 残り時間は performance.now() と開始時刻の差から毎回計算する（タイマーの呼び出し回数は数えない）。
 * Ver.0.8：コース（基本の合同証明 basic / 総合証明 comprehensive。js/rank-tracks.js）ごとに記録・画面を分ける。
 *   #/rank                    トップ（2つのコースのカード・ルール）
 *   #/rank/<コース>/play      プレイ（「このコースに挑戦！」から来たときだけ始める。再読み込みでは再開しない）
 *   #/rank/<コース>/result    結果（そのコースの直近の挑戦）
 *   #/rank/<コース>/review    間違えた問題の振り返り（そのコースの直近1回分）
 *   #/rank/<コース>/grades    段位一覧（そのコースの最高段位）
 *   #/rank/legacy             Ver.0.7 までの段位認定の記録
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
  function C() { return PH.rank.config; }
  function fmtTime(ms) {
    const s = Math.ceil(ms / 1000);
    return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0');
  }
  function fmtScore(v) { return String(Math.round(v * 10) / 10); }
  function fmtSec(ms) { return String(Math.round(ms / 1000)); }

  const TIER_ICON = { kyu: '🎖️', medal: '🥇', gold: '🏆', crown: '👑' };

  // ---- トップ ---------------------------------------------------------------------

  function T() { return PH.rankTracks; }
  function trackOf(id) { return T().get(id) || T().get('basic'); }

  // そのコースの最高段位（未挑戦は「未認定」。最高段位の記録がない＝10級とは表示しない）
  function bestLine(track) {
    const r = PH.storage.getRank(track);
    return r.best ? r.best.rankName : '未認定';
  }

  function courseCard(id) {
    const t = trackOf(id);
    const r = PH.storage.getRank(id);
    const played = r.playCount > 0;
    return '<div class="card rank-course course-' + id + '">' +
      '<h2 class="rank-course-name">' + esc(t.label) + '</h2>' +
      '<p class="rank-course-lead">' + esc(t.lead) + '</p>' +
      '<p class="rank-course-desc">' + esc(t.desc) + '</p>' +
      '<div class="rank-best">' +
        '<div class="rank-best-item"><span>最高段位</span><b class="rank-best-name">' + esc(bestLine(id)) + '</b></div>' +
        '<div class="rank-best-item"><span>最高正解数</span><b>' + (played ? r.bestCorrect + '問' : '－') + '</b></div>' +
        '<div class="rank-best-item"><span>挑戦回数</span><b>' + r.playCount + '回</b></div>' +
      '</div>' +
      '<button class="btn btn-confirm btn-big rank-start" data-act="rank-start" data-track="' + id + '">このコースに挑戦！</button>' +
      '<div class="rank-top-links">' +
        '<button class="btn" data-go="#/rank/' + id + '/grades">段位一覧</button>' +
        (r.lastResult ? '<button class="btn" data-go="#/rank/' + id + '/result">前回の結果</button>' : '') +
      '</div>' +
    '</div>';
  }

  function renderTop(el) {
    const legacy = PH.storage.getRankLegacy();
    el.innerHTML =
      '<header class="page-header rank-header">' +
        '<button class="head-btn" data-go="#/" aria-label="ホームに戻る"><span class="ico">⌂</span><span class="lbl">ホーム</span></button>' +
        '<h1 class="page-title">段位認定</h1>' +
      '</header>' +
      '<div class="rank-top">' +
        '<div class="card rank-hero">' +
          '<div class="rank-hero-ico" aria-hidden="true">⏱️</div>' +
          '<p class="rank-hero-tag">120秒チャレンジ</p>' +
          '<p class="rank-hero-lead">120秒で何問解ける？ コースを選んで、目指せ皆伝！</p>' +
          '<div class="rank-top-links">' +
            '<button class="btn" data-go="#/howto/rank">あそびかた</button>' +
            (legacy ? '<button class="btn" data-go="#/rank/legacy">Ver.0.7までの記録を見る</button>' : '') +
          '</div>' +
        '</div>' +
        '<div class="rank-courses">' + T().ORDER.map(courseCard).join('') + '</div>' +
        '<div class="card rank-rules">' +
          '<h2>ルール</h2>' +
          '<ul>' +
            '<li><b>基本の合同証明</b>は、3つの合同条件・仮定・共通な辺や角・対頂角・平行線の角・合同な図形の性質の問題。<b>総合証明</b>は、それに二等辺三角形・正三角形・角の式（三段論法）・直角三角形などが加わるよ。</li>' +
            '<li>2つのコースの段位・記録は別々。どちらのコースからでも挑戦できるよ。</li>' +
            '<li>制限時間は <b>120秒</b>。時間内なら何問でも挑戦できるよ。</li>' +
            '<li><b>1〜10問目</b>はセレクトゾーン（選択式）。<b>11問目から</b>はチャレンジゾーン（記号の入力もあるよ）。</li>' +
            '<li><b>正解数</b>で段位が決まるよ（10級〜皆伝の21段階）。</li>' +
            '<li>まちがい・パスは<b>制限時間が減る</b>よ。1回目は −4秒、2回目は −8秒、3回目は −12秒…と、だんだん重くなるよ。</li>' +
            '<li>途中でやめると記録は残らないよ。一時停止はできないよ。</li>' +
          '</ul>' +
        '</div>' +
      '</div>';
  }

  // ---- 段位一覧 -------------------------------------------------------------------

  function renderGrades(el, track) {
    const t = trackOf(track);
    const r = PH.storage.getRank(t.id);
    const bestRank = r.best ? r.best.rank : -1;
    const score = r.best ? r.best.effectiveScore : 0;
    const nxt = r.best ? PH.rank.nextGrade(score) : { grade: PH.rank.config.grades[0], need: 0 };
    const grades = C().grades.slice().sort(function (a, b) { return b.rank - a.rank; });
    el.innerHTML =
      '<header class="page-header rank-header">' +
        '<button class="head-btn" data-go="#/rank" aria-label="段位認定に戻る"><span class="ico">◀</span><span class="lbl">段位認定</span></button>' +
        '<h1 class="page-title">' + esc(t.label) + '｜段位一覧</h1>' +
      '</header>' +
      '<div class="rank-grades">' +
        '<div class="card rank-now">' +
          '<p class="rank-course-tag course-' + t.id + '">' + esc(t.label) + '</p>' +
          '<p>現在の最高段位：<b>' + esc(bestLine(t.id)) + '</b>' + (r.best ? '（正解数 ' + fmtScore(score) + '問）' : '') + '</p>' +
          (r.best && nxt ? '<p class="rank-next">次の<b>' + esc(nxt.grade.name) + '</b>まで：<b class="rank-need">あと' + fmtScore(nxt.need) + '問！</b></p>' : '') +
          (r.best && !nxt ? '<p class="rank-next">最高の段位「皆伝」に到達！</p>' : '') +
          (!r.best ? '<p class="rank-next">まずは挑戦して、段位を認定してもらおう！</p>' : '') +
        '</div>' +
        '<ol class="grade-list">' + grades.map(function (g) {
          const got = g.rank <= bestRank;
          return '<li class="grade-item tier-' + PH.rank.tierFor(g.rank) + (got ? ' is-got' : '') + (g.rank === bestRank ? ' is-best' : '') + '">' +
            '<span class="grade-ico" aria-hidden="true">' + (got ? TIER_ICON[PH.rank.tierFor(g.rank)] : '・') + '</span>' +
            '<span class="grade-name">' + esc(g.name) + '</span>' +
            '<span class="grade-min">正解数 ' + g.min + '問 以上</span>' +
            '</li>';
        }).join('') + '</ol>' +
        '<p class="select-note">認定基準は暫定版です（基準バージョン ' + C().criteriaVersion + '）。</p>' +
      '</div>';
  }

  // ---- 結果・振り返り -----------------------------------------------------------------

  let lastShown = null;   // 直近に終えた挑戦（結果画面の演出用。再読み込み後は保存した記録から表示）

  // 直近に終えた挑戦が、そのコースのものなら返す（別のコースの結果を表示しない）
  function shownFor(track) { return lastShown && lastShown.track === track ? lastShown : null; }

  function renderResult(el, track) {
    const t = trackOf(track);
    const r = PH.storage.getRank(t.id);
    const shown = shownFor(t.id);
    const res = shown ? shown.result : r.lastResult;
    if (!res) { el.innerHTML = ''; root.location.hash = '#/rank'; return; }
    const fresh = !!shown;
    const saved = shown ? shown.saved : { newRecord: !!res.newRecord };
    const tier = PH.rank.tierFor(res.rank);
    const review = shown ? shown.result.wrongs.length : r.lastReview.length;
    el.innerHTML =
      '<header class="page-header rank-header">' +
        '<button class="head-btn" data-go="#/rank" aria-label="段位認定に戻る"><span class="ico">◀</span><span class="lbl">段位認定</span></button>' +
        '<h1 class="page-title">' + esc(t.label) + '｜段位認定結果</h1>' +
      '</header>' +
      '<div class="rank-result">' +
        '<div class="card rank-cert tier-' + tier + (fresh ? ' is-fresh' : '') + '">' +
          '<p class="rank-course-tag course-' + t.id + '">' + esc(t.label) + '</p>' +
          '<p class="rank-cert-label">認定段位</p>' +
          '<div class="rank-cert-ico" aria-hidden="true">' + TIER_ICON[tier] + '</div>' +
          '<p class="rank-cert-name">' + esc(res.rankName) + '</p>' +
          (saved.newRecord ? '<p class="rank-newrec">NEW RECORD！</p>' : '') +
          '<dl class="rank-stats">' +
            '<div><dt>正解数</dt><dd>' + res.correct + '問</dd></div>' +
            '<div><dt>ミス数</dt><dd>' + res.misses + '回' + (res.passes ? '<small>（パス' + res.passes + '）</small>' : '') + '</dd></div>' +
            '<div><dt>時間ペナルティ</dt><dd>' + (res.penaltyMs ? '−' + fmtSec(res.penaltyMs) + '秒' : 'なし') + '</dd></div>' +
            '<div><dt>最高連続正解</dt><dd>' + res.maxCombo + '問</dd></div>' +
          '</dl>' +
          (function () {
            const nxt = PH.rank.nextGrade(res.effectiveScore);
            return nxt ? '<p class="rank-next">次の<b>' + esc(nxt.grade.name) + '</b>まで あと' + fmtScore(nxt.need) + '問</p>' : '';
          })() +
        '</div>' +
        '<div class="rank-result-actions">' +
          '<button class="btn btn-confirm btn-big" data-act="rank-start" data-track="' + t.id + '">もう一度挑戦！</button>' +
          (review ? '<button class="btn" data-go="#/rank/' + t.id + '/review">間違えた問題を確認（' + review + '）</button>' : '') +
          '<button class="btn" data-go="#/rank/' + t.id + '/grades">段位一覧へ</button>' +
          '<button class="btn" data-go="#/rank">コースを選ぶ</button>' +
        '</div>' +
      '</div>';
    if (fresh && !shown.played) {
      shown.played = true;
      PH.sound.play(saved.newRecord ? 'record' : 'certify');
    }
  }

  function renderReview(el, track) {
    const t = trackOf(track);
    const shown = shownFor(t.id);
    const list = shown ? shown.result.wrongs : PH.storage.getRank(t.id).lastReview;
    el.innerHTML =
      '<header class="page-header rank-header">' +
        '<button class="head-btn" data-go="#/rank/' + t.id + '/result" aria-label="結果に戻る"><span class="ico">◀</span><span class="lbl">結果</span></button>' +
        '<h1 class="page-title">' + esc(t.label) + '｜間違えた問題</h1>' +
      '</header>' +
      '<div class="rank-review">' +
        (list.length ? '<p class="select-note">' + esc(t.label) + 'の前回の挑戦で、まちがえた問題・パスした問題だよ。</p>' : '<div class="card review-empty"><p class="review-empty-title">まちがえた問題はありません！</p></div>') +
        '<ol class="rank-review-list">' + list.map(function (w, i) {
          const q = PH.rankQuestions.byId(w.qid);
          const p = q && q.figure ? PH.getProblem(q.figure) : null;
          return '<li class="card rank-review-item">' +
            '<p class="rr-head">問題' + String(w.no).padStart(2, '0') + '｜' + esc(w.typeLabel) + (w.passed ? '<span class="rr-pass">パス</span>' : '') + '</p>' +
            '<div class="rr-body">' +
              (p ? '<svg class="figure rr-fig" data-rr-fig="' + i + '" aria-hidden="true"></svg>' : '') +
              '<div class="rr-text">' +
                '<p class="rr-q">' + esc(w.question) + '</p>' +
                '<p class="rr-you">あなたの解答：<b>' + esc(w.yourAnswer) + '</b></p>' +
                '<p class="rr-ans">正解：<b>' + esc(w.correctAnswer) + '</b></p>' +
                (w.explain ? '<p class="rr-exp">解説：' + esc(w.explain) + '</p>' : '') +
                (w.sourceId && PH.getProblem(w.sourceId) ? '<p class="rr-link"><a href="#/play/' + esc(w.sourceId) + '">元の問題（問題' + esc(PH.getProblem(w.sourceId).number) + '）を解く ▶</a></p>' : '') +
              '</div>' +
            '</div>' +
          '</li>';
        }).join('') + '</ol>' +
      '</div>';
    list.forEach(function (w, i) {
      const q = PH.rankQuestions.byId(w.qid);
      const svg = el.querySelector('[data-rr-fig="' + i + '"]');
      if (svg && q && q.figure) PH.renderer.render(svg, PH.getProblem(q.figure), { interactive: false, selection: q.highlight });
    });
  }

  // Ver.0.7 までの段位認定の記録（コースに分かれる前。新しいコースの記録とは別に残す）
  function renderLegacy(el) {
    const r = PH.storage.getRankLegacy();
    el.innerHTML =
      '<header class="page-header rank-header">' +
        '<button class="head-btn" data-go="#/rank" aria-label="段位認定に戻る"><span class="ico">◀</span><span class="lbl">段位認定</span></button>' +
        '<h1 class="page-title">Ver.0.7までの記録</h1>' +
      '</header>' +
      '<div class="rank-grades">' +
        (r ? '<div class="card rank-now rank-legacy">' +
          '<p>Ver.0.7までの段位認定（コースに分かれる前）の記録だよ。新しい2つのコースの記録とは別に、そのまま残しているよ。</p>' +
          '<div class="rank-best">' +
            '<div class="rank-best-item"><span>最高段位</span><b class="rank-best-name">' + esc(r.best ? r.best.rankName : '未認定') + '</b></div>' +
            '<div class="rank-best-item"><span>最高正解数</span><b>' + r.bestCorrect + '問</b></div>' +
            '<div class="rank-best-item"><span>挑戦回数</span><b>' + r.playCount + '回</b></div>' +
          '</div>' +
        '</div>' : '<div class="card review-empty"><p class="review-empty-title">Ver.0.7までの記録はありません。</p></div>') +
        '<p class="select-note">Ver.0.8 からは「基本の合同証明」と「総合証明」の2つのコースで、それぞれ未認定から認定するよ。</p>' +
      '</div>';
  }

  // ---- プレイ ---------------------------------------------------------------------

  function RankPlay(el, nav, track) {
    this.el = el;
    this.nav = nav;
    this.track = trackOf(track).id;
    this.game = new PH.RankGame({ track: this.track, onFinish: this.onFinish.bind(this) });
    this.kp = null;
    this.locked = false;       // 正解・不正解の表示中は操作しない（時間は進む）
    this.warned = false;
    this.timers = [];
    this.build();
    this.onClick = this.handleClick.bind(this);
    this.onKey = this.handleKey.bind(this);
    this.onVis = this.update.bind(this);
    el.addEventListener('click', this.onClick);
    doc.addEventListener('keydown', this.onKey);
    doc.addEventListener('visibilitychange', this.onVis);
    this.countdown();
  }

  RankPlay.prototype.ref = function (n) { return this.el.querySelector('[data-ref="' + n + '"]'); };

  RankPlay.prototype.later = function (fn, ms) { this.timers.push(setTimeout(fn, ms)); };

  RankPlay.prototype.build = function () {
    this.el.innerHTML =
      '<div class="rank-play">' +
        '<header class="rank-bar">' +
          '<button class="head-btn" data-act="rank-quit" aria-label="やめる"><span class="ico">✕</span><span class="lbl">やめる</span></button>' +
          '<div class="rank-timer" data-ref="timer" aria-label="残り時間">2:00</div>' +
          '<div class="rank-score">' +
            '<span class="rs-course course-' + this.track + '">' + esc(trackOf(this.track).short) + '</span>' +
            '<span class="rs-q">問題 <b data-ref="qno">-</b></span>' +
            '<span class="rs-ok">正解 <b data-ref="ok">0</b></span>' +
            '<span class="rs-ng">ミス <b data-ref="ng">0</b></span>' +
            '<span class="rs-combo" data-ref="comboBox">連続 <b data-ref="combo">0</b></span>' +
          '</div>' +
        '</header>' +
        '<div class="rank-pop" data-ref="pop" aria-live="polite"></div>' +
        '<div class="rank-penalty" data-ref="penalty" aria-live="polite"></div>' +
        '<div class="rank-zone" data-ref="zone" hidden>CHALLENGE ZONE！</div>' +
        '<div class="rank-stage" data-ref="stage"></div>' +
        '<div class="rank-count" data-ref="count" aria-live="assertive"></div>' +
      '</div>';
  };

  // 3・2・1・START！ STARTと同時に計測を始める
  RankPlay.prototype.countdown = function () {
    const self = this;
    const steps = C().countdown;
    const box = this.ref('count');
    steps.forEach(function (t, i) {
      self.later(function () {
        box.textContent = t;
        box.className = 'rank-count show' + (i === steps.length - 1 ? ' is-start' : '');
        PH.sound.play(i === steps.length - 1 ? 'start' : 'count');
        if (i === steps.length - 1) {
          self.game.start(now());
          self.renderQuestion();
          self.loop = setInterval(self.update.bind(self), 100);
          self.later(function () { box.className = 'rank-count'; box.textContent = ''; }, 450);
        }
      }, i * C().countdownStepMs);
    });
  };

  RankPlay.prototype.destroy = function () {
    this.el.removeEventListener('click', this.onClick);
    doc.removeEventListener('keydown', this.onKey);
    doc.removeEventListener('visibilitychange', this.onVis);
    clearInterval(this.loop);
    this.timers.forEach(clearTimeout);
    if (this.game.state === 'play' || this.game.state === 'ready') this.game.abort();   // 途中終了は記録しない
    this.el.innerHTML = '';
  };

  // 残り時間の表示と、時間切れの確認（別タブから戻ったときも、ここで経過時間から判定する）
  RankPlay.prototype.update = function () {
    const g = this.game;
    if (g.state !== 'play') return;
    const t = now();
    g.tick(t);
    if (g.state !== 'play') return;
    const left = g.timeLeft(t);
    const el = this.ref('timer');
    el.textContent = fmtTime(left);
    const sec = left / 1000;
    el.className = 'rank-timer' + (sec <= C().dangerSeconds ? ' is-danger' : sec <= C().warnSeconds ? ' is-warn' : '');
    if (!this.warned && sec <= C().dangerSeconds) { this.warned = true; PH.sound.play('warn'); }
  };

  RankPlay.prototype.onFinish = function (result) {
    clearInterval(this.loop);
    const saved = PH.storage.recordRank(result, this.track);
    lastShown = { track: this.track, result: result, saved: saved, played: false };
    PH.sound.play('timeup');
    const t = this.ref('timer');
    if (t) { t.textContent = '0:00'; t.className = 'rank-timer is-danger'; }
    const box = this.ref('count');
    if (box) { box.textContent = 'TIME UP！'; box.className = 'rank-count show is-up'; }
    const self = this;
    this.later(function () { self.nav.result(); }, 900);
  };

  RankPlay.prototype.quit = function () {
    const self = this;
    PH.chooser.open({
      title: '段位認定をやめる',
      message: '段位認定を途中で終了しますか？ 今回の記録は残りません。',
      options: [{ value: 'quit', label: '終了する' }],
      textOptions: true,
      onChoose: function () { self.game.abort(); self.nav.home(); },
    });
  };

  // ---- 問題の表示 ----

  RankPlay.prototype.renderQuestion = function () {
    const g = this.game;
    const inst = g.current;
    if (!inst) return;
    const q = inst.q;
    const p = q.figure ? PH.getProblem(q.figure) : null;
    this.ref('qno').textContent = String(inst.no);
    this.ref('ok').textContent = String(g.correct);
    this.ref('ng').textContent = String(g.misses);
    this.ref('combo').textContent = String(g.combo);
    const src = PH.getProblem(q.sourceId);
    let answer = '';
    if (inst.mode === 'choice') {
      answer = inst.blanks.map(function (b, i) {
        return '<div class="rq-blank">' + (inst.blanks.length > 1 ? '<p class="rq-blabel">' + esc(b.label) + '</p>' : '') +
          '<div class="rq-choices">' + b.choices.map(function (c) {
            const on = g.selections[i] === c.id;
            return '<button class="rq-choice' + (on ? ' is-on' : '') + '" data-blank="' + i + '" data-choice="' + c.id + '" aria-pressed="' + on + '">' + esc(c.text) + '</button>';
          }).join('') + '</div></div>';
      }).join('');
      if (inst.blanks.length > 1) {
        answer += '<button class="btn btn-confirm rq-decide" data-act="rank-decide"' + (g.complete() ? '' : ' disabled') + '>決定</button>';
      }
      this.kp = null;
    } else {
      const k = q.input.keypad;
      const letters = PH.mathKeypad.lettersOf(src.figure);
      this.kp = PH.mathKeypad.create(letters, k.triangle
        ? { kinds: ['tri'], isTriangle: function (t) { return PH.geometry.isFigureTriangle(src.figure, t); } }
        : k.fixedLeft ? { fixedLeft: k.fixedLeft } : { kinds: k.kinds });
      answer = '<div class="rq-keypad" data-ref="keypad"></div>';
    }
    this.ref('stage').innerHTML =
      '<div class="rank-q' + (p ? ' has-fig' : '') + '" data-ref="qcard">' +
        (p ? '<div class="rq-figwrap"><svg class="figure rq-fig" data-ref="fig" aria-label="問題の図"></svg></div>' : '') +
        '<div class="rq-main">' +
          '<div class="rq-text">' +
            '<p class="rq-type">' + esc(q.typeLabel) + '</p>' +
            q.lines.map(function (l) { return '<p class="rq-line">' + esc(l) + '</p>'; }).join('') +
            '<p class="rq-ask">' + esc(q.ask) + '</p>' +
          '</div>' +
          '<div class="rq-answer">' + answer + '</div>' +
          '<div class="rq-foot"><button class="btn rq-pass" data-act="rank-pass">パス</button></div>' +
        '</div>' +
        '<div class="rq-mark" data-ref="mark" aria-hidden="true"></div>' +
      '</div>';
    if (p) PH.renderer.render(this.ref('fig'), p, { interactive: false, selection: q.highlight });
    this.renderKeypad();
  };

  RankPlay.prototype.renderKeypad = function () {
    const box = this.ref('keypad');
    if (box && this.kp) box.innerHTML = PH.mathKeypad.render(this.kp);
  };

  // 判定のあと：○／× を短く表示して、次の問題へ
  RankPlay.prototype.after = function (r) {
    if (r.status === 'closed' || r.status === 'incomplete' || r.status === 'ignored' || r.status === 'selected') {
      if (r.status === 'selected') this.renderQuestion();
      return;
    }
    const ok = r.status === 'correct';
    PH.sound.play(ok ? 'rankOk' : 'rankNg');
    this.locked = true;
    const mark = this.ref('mark');
    mark.textContent = ok ? '○' : r.status === 'pass' ? 'パス' : '×';
    mark.className = 'rq-mark show ' + (ok ? 'is-ok' : 'is-ng');
    this.ref('ok').textContent = String(this.game.correct);
    this.ref('ng').textContent = String(this.game.misses);
    this.ref('combo').textContent = String(this.game.combo);
    if (r.comboText) this.pop(r.comboText);
    if (r.penaltyMs) this.penalty(r.penaltyMs);
    const self = this;
    this.later(function () {
      self.locked = false;
      if (self.game.state !== 'play') return;
      self.renderQuestion();
      if (r.zoneEnter) self.zone();
    }, C().feedbackMs);
  };

  // 誤答の時間ペナルティ（「−4秒」をタイマーの下に短く表示し、残り時間をすぐ更新）
  RankPlay.prototype.penalty = function (ms) {
    const el = this.ref('penalty');
    el.textContent = '−' + fmtSec(ms) + '秒';
    el.className = 'rank-penalty';
    void el.offsetWidth;
    el.className = 'rank-penalty show';
    this.update();
  };

  RankPlay.prototype.pop = function (text) {
    const el = this.ref('pop');
    el.textContent = text;
    el.className = 'rank-pop';
    void el.offsetWidth;
    el.className = 'rank-pop show';
    PH.sound.play('combo');
  };

  // CHALLENGE ZONE！（タイマーは止めず、操作もさえぎらない）
  RankPlay.prototype.zone = function () {
    const el = this.ref('zone');
    el.hidden = false;
    el.className = 'rank-zone';
    void el.offsetWidth;
    el.className = 'rank-zone show';
    PH.sound.play('zone');
    this.later(function () { el.hidden = true; }, 1300);
  };

  RankPlay.prototype.handleClick = function (e) {
    const t = e.target.closest('[data-choice],[data-act],[data-kp]');
    if (!t || t.disabled) return;
    const act = t.getAttribute('data-act');
    if (act === 'rank-quit') return this.quit();
    if (this.locked || this.game.state !== 'play') return;
    if (t.hasAttribute('data-choice')) {
      return this.after(this.game.choose(Number(t.getAttribute('data-blank')), t.getAttribute('data-choice'), now()));
    }
    if (act === 'rank-decide') return this.after(this.game.submit(now()));
    if (act === 'rank-pass') return this.after(this.game.pass(now()));
    if (t.hasAttribute('data-kp')) return this.keypad(t.getAttribute('data-kp'));
  };

  RankPlay.prototype.keypad = function (action) {
    const kp = this.kp;
    if (!kp) return;
    if (action === 'decide') {
      if (!kp.complete()) return;
      return this.after(this.game.submit(now(), kp.value()));
    }
    if (action === 'toggle') kp.toggleKind();
    else if (action.indexOf('key:') === 0) kp.press(action.slice(4));
    else if (action === 'back') kp.backspace();
    else if (action === 'clear') kp.clear();
    PH.sound.play('tap');
    this.renderKeypad();
  };

  // PCのキーボード：記号入力の問題で A〜Z・Backspace・Enter
  RankPlay.prototype.handleKey = function (e) {
    if (PH.chooser.isOpen() || this.locked || this.game.state !== 'play' || !this.kp) return;
    if (e.ctrlKey || e.metaKey || e.altKey) return;
    const kp = this.kp;
    if (/^[a-zA-Z]$/.test(e.key)) {
      if (!kp.kind) kp.setKind(kp.kinds[0]);
      kp.press(e.key.toUpperCase());
    } else if (e.key === 'Backspace') kp.backspace();
    else if (e.key === 'Enter') { e.preventDefault(); return this.keypad('decide'); }
    else return;
    e.preventDefault();
    this.renderKeypad();
  };

  // ---------------------------------------------------------------------------

  let current = null;
  let pendingStart = null;    // 「このコースに挑戦！」で選んだコース

  PH.rankView = {
    renderTop: renderTop,
    renderGrades: renderGrades,
    renderResult: renderResult,
    renderReview: renderReview,
    renderLegacy: renderLegacy,
    bestName: bestLine,
    // 「このコースに挑戦！」「もう一度挑戦！」から来たときだけ挑戦を始める（再読み込み・直接のURLでは始めない）
    requestStart: function (track) { pendingStart = T().isTrack(track) ? track : 'basic'; },
    // 挑戦中にコースを変えることはできない（選んだコースと URL のコースが同じときだけ始める）
    mountPlay: function (el, nav, track) {
      PH.rankView.unmount();
      if (!pendingStart || pendingStart !== track) { pendingStart = null; return false; }
      pendingStart = null;
      lastShown = null;
      current = new RankPlay(el, nav, track);
      return true;
    },
    unmount: function () {
      if (current) current.destroy();
      current = null;
    },
    current: function () { return current; },
  };
})(typeof window !== 'undefined' ? window : globalThis);
