/*
 * app.js — 画面管理・アプリ起動
 *
 * 画面はURLのハッシュで切り替える（ブラウザの「戻る」でも状態が崩れない）。
 *   #/                       タイトル・モード選択
 *   #/select                 ハンターモード：ステージ選択（＋苦手な問題に挑戦）
 *   #/stage/<n>              ハンターモード：ステージの問題一覧
 *   #/review                 ハンターモード：苦手な問題（未クリア・★★以下）
 *   #/play/<id>              ハンターモード：プレイ（開くたびに新しい状態で開始）
 *   #/puzzle                 証明パズル：ステージ選択（＋苦手な問題に挑戦）
 *   #/puzzle/stage/<n>       証明パズル：ステージの問題一覧
 *   #/puzzle/review          証明パズル：苦手な問題
 *   #/puzzle/play/<id>       証明パズル：プレイ
 *   #/howto  #/howto/puzzle  あそびかた（ハンター／パズル）
 * 記録・評価はモードごとに別々。証明パズルは、さらに解答レベル（おてがる／スタンダード／チャレンジ）ごとに別々
 * （storage.js の mode 引数：'hunter' / 'puzzle:<レベル>'）。
 */
(function (root) {
  'use strict';
  const PH = root.PH;
  const doc = root.document;
  const $ = function (sel) { return doc.querySelector(sel); };

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  // モードごとのURLと表示名
  const MODES = {
    hunter: {
      name: 'ハンターモード',
      select: '#/select',
      stage: function (n) { return '#/stage/' + n; },
      review: '#/review',
      play: function (id) { return '#/play/' + id; },
    },
    puzzle: {
      name: '証明パズル',
      select: '#/puzzle',
      stage: function (n) { return '#/puzzle/stage/' + n; },
      review: '#/puzzle/review',
      play: function (id) { return '#/puzzle/play/' + id; },
    },
  };

  const SCREENS = ['title', 'select', 'howto', 'play', 'puzzle'];

  // 記録の種類：ハンターはそのまま、パズルは選んでいる解答レベルの記録
  function recMode(mode) {
    return mode === 'puzzle' ? 'puzzle:' + PH.storage.getPuzzleLevel() : 'hunter';
  }
  function currentLevel() { return PH.getPuzzleLevel(PH.storage.getPuzzleLevel()); }

  function show(name) {
    SCREENS.forEach(function (s) {
      const el = doc.getElementById('screen-' + s);
      el.hidden = s !== name;
    });
    doc.body.setAttribute('data-screen', name);
    root.scrollTo(0, 0);
  }

  function go(hash) {
    if (location.hash === hash) route();
    else location.hash = hash;
  }

  // ---- タイトル ----------------------------------------------------------

  function renderTitle() {
    const last = PH.storage.getLastPlay();
    const cont = $('#btn-continue');
    const problem = last && PH.getProblem(last.id);
    cont.hidden = !problem;
    if (problem) {
      cont.querySelector('.cont-sub').textContent =
        (last.mode === 'puzzle' ? '証明パズル（' + currentLevel().label + '）' : 'ハンター') + '・問題' + problem.number;
    }
    renderSoundButtons();
  }

  function renderSoundButtons() {
    const on = PH.storage.getSound();
    doc.querySelectorAll('[data-sound-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? '🔊 効果音 ON' : '🔈 効果音 OFF';
    });
  }

  // ---- ステージ選択・問題一覧・復習（モード共通） ------------------------------

  // 獲得した星は ★、未獲得の星は ☆（塗りつぶしなし）
  function starsHtml(rec) {
    if (!rec.cleared) return '<span class="dim" aria-label="未クリア">☆☆☆</span>';
    return '★'.repeat(rec.bestStars) + '<span class="dim">' + '☆'.repeat(3 - rec.bestStars) + '</span>';
  }

  // 問題選択画面の見出し（戻るボタンの行き先と題名）とモードの色
  function setSelectHeader(mode, title, backHash, backLabel) {
    const back = $('#select-back');
    back.setAttribute('data-go', backHash);
    back.querySelector('.lbl').textContent = backLabel;
    back.querySelector('.ico').textContent = backHash === '#/' ? '⌂' : '◀';
    $('#select-title').textContent = title;
    $('#screen-select').setAttribute('data-mode', mode);
  }

  function problemCard(mode, p, showStage) {
    const rec = PH.storage.getProblem(p.id, recMode(mode));
    const diff = '★'.repeat(p.difficulty) + '<span class="dim">' + '★'.repeat(Math.max(0, 3 - p.difficulty)) + '</span>';
    const best = '<span class="best-stars">' + starsHtml(rec) + '</span>';
    return '<li><a class="problem-card' + (rec.cleared ? ' is-cleared' : '') + '" href="' + MODES[mode].play(p.id) + '">' +
      '<span class="pc-no">問題<b>' + esc(p.number) + '</b></span>' +
      '<span class="pc-body">' +
        (showStage ? '<span class="pc-stage">STAGE ' + p.stage + '</span>' : '') +
        '<span class="pc-title">' + esc(p.title) + '</span>' +
        '<span class="pc-meta"><span class="pc-diff" aria-label="難易度' + p.difficulty + '">難易度 ' + diff + '</span></span>' +
      '</span>' +
      '<span class="pc-status">' +
        '<span class="pc-badge">' + (rec.cleared ? 'クリア' : '未クリア') + '</span>' +
        '<span class="pc-best" aria-label="最高評価">' + best + '</span>' +
        (rec.cleared && rec.minMisses != null ? '<span class="pc-miss">最少ミス ' + rec.minMisses + '回</span>' : '') +
      '</span>' +
    '</a></li>';
  }

  function levelSelector() {
    const cur = PH.storage.getPuzzleLevel();
    return '<div class="level-select"><p class="level-select-title">解答レベルをえらぼう！</p><div class="level-btns">' +
      PH.PUZZLE_LEVELS.map(function (l) {
        return '<button class="level-btn level-' + l.id + '" data-level="' + l.id + '" aria-pressed="' + (l.id === cur) + '">' +
          '<span class="level-name">' + esc(l.label) + '</span><span class="level-desc">' + esc(l.desc) + '</span></button>';
      }).join('') + '</div></div>';
  }

  function levelLine() {
    return '<p class="level-current">現在の解答レベル：<b class="level-' + currentLevel().id + '">' + esc(currentLevel().label) + '</b></p>';
  }

  // そのレベルの全問をクリアしたときの案内（レベルは自動で変えない）
  function levelGuide() {
    const rm = recMode('puzzle');
    const all = PH.problems.every(function (p) { return PH.storage.getProblem(p.id, rm).cleared; });
    return all ? '<p class="result-guide level-guide">' + esc(PH.levelAllClearText(currentLevel().id)) + '</p>' : '';
  }

  function renderStageList(mode) {
    const M = MODES[mode];
    setSelectHeader(mode, (mode === 'puzzle' ? '証明パズル｜' : '') + 'ステージをえらぶ', '#/', 'ホーム');
    const review = PH.storage.reviewProblems(recMode(mode)).length;
    $('#select-body').innerHTML =
      '<p class="mode-lead">' + (mode === 'puzzle'
        ? '🧩 <b>証明パズル</b>：カードを組み合わせて、証明文を完成させよう！'
        : '🔍 <b>ハンターモード</b>：図をタップして、3つの根拠を探し出せ！') + '</p>' +
      (mode === 'puzzle' ? levelSelector() + levelGuide() : '') +
      '<button class="review-btn" data-go="' + M.review + '">🔁 苦手な問題に挑戦！<span class="review-count">' +
        (review ? '復習 ' + review + '問' : '復習なし') + '</span></button>' +
      '<ul class="stage-list">' + PH.STAGES.map(function (st) {
        const stat = PH.storage.stageStats(st.id, recMode(mode));
        return '<li><a class="stage-card' + (stat.complete ? ' is-complete' : '') + '" href="' + M.stage(st.id) + '">' +
          '<span class="sc-no">STAGE<b>' + st.id + '</b></span>' +
          '<span class="sc-body">' +
            '<span class="sc-title">' + esc(st.title) + '</span>' +
            '<span class="sc-theme">' + esc(st.theme) + '</span>' +
            '<span class="sc-stars">' + stat.records.map(function (r) { return '<span class="sc-star">' + starsHtml(r) + '</span>'; }).join('') + '</span>' +
          '</span>' +
          '<span class="sc-status">' +
            (stat.complete ? '<span class="sc-badge">STAGE CLEAR</span>' : '') +
            '<span class="sc-clear">クリア <b>' + stat.cleared + '</b>/' + stat.total + '問</span>' +
            '<span class="sc-total">★ ' + stat.stars + '/' + stat.maxStars + '</span>' +
          '</span>' +
        '</a></li>';
      }).join('') + '</ul>' +
      '<p class="select-note">どのステージ・どの問題からでも挑戦できるよ。ミス0・ヒント0でクリアすると ★★★！</p>';
  }

  function renderStage(mode, stage) {
    setSelectHeader(mode, (mode === 'puzzle' ? 'パズル ' : '') + 'STAGE ' + stage.id + '｜' + stage.title, MODES[mode].select, 'ステージ');
    const stat = PH.storage.stageStats(stage.id, recMode(mode));
    $('#select-body').innerHTML =
      '<div class="stage-intro"><p>' + esc(stage.theme) + '</p>' + (mode === 'puzzle' ? levelLine() : '') +
        '<p class="stage-intro-stat">クリア ' + stat.cleared + '/' + stat.total + '問 ・ ★ ' + stat.stars + '/' + stat.maxStars +
        (stat.complete ? ' <span class="sc-badge">STAGE CLEAR</span>' : '') + '</p></div>' +
      '<ul class="problem-list">' + stat.problems.map(function (p) { return problemCard(mode, p, false); }).join('') + '</ul>';
  }

  function renderReview(mode) {
    setSelectHeader(mode, (mode === 'puzzle' ? 'パズル：' : '') + '苦手な問題に挑戦！', MODES[mode].select, 'ステージ');
    const list = PH.storage.reviewProblems(recMode(mode));
    $('#select-body').innerHTML = (mode === 'puzzle' ? levelLine() : '') + (list.length
      ? '<p class="select-note">まだクリアしていない問題と、★★以下の問題だよ。★★★をめざそう！</p>' +
        '<ul class="problem-list">' + list.map(function (p) { return problemCard(mode, p, true); }).join('') + '</ul>'
      : '<div class="card review-empty"><p class="review-empty-title">復習する問題はありません！</p><p>すべて★★★をめざそう！ すばらしい！</p>' +
        '<button class="btn btn-primary" data-go="' + MODES[mode].select + '">ステージ選択へ</button></div>');
  }

  // ---- あそびかた（モード別） -----------------------------------------------

  const HOWTO = {
    hunter: [
      {
        title: '証明ハンターって？',
        text: '図形に隠された3つの根拠を見つけ、証明を完成させるゲーム！',
        art: '<svg viewBox="0 0 200 120"><polygon points="40,20 10,100 90,100" class="h-tri1"/><polygon points="120,20 110,100 190,100" class="h-tri2"/><circle cx="150" cy="45" r="22" class="h-lens"/><line x1="166" y1="61" x2="186" y2="81" class="h-handle"/></svg>',
      },
      {
        title: '等しい辺や角をタップ！',
        text: '図をよく見て、等しいと思う辺や角を2つ選ぼう！ 角は、角の内側をタップするよ。',
        art: '<svg viewBox="0 0 200 120"><polygon points="100,12 30,105 170,105" class="h-tri"/><line x1="100" y1="12" x2="30" y2="105" class="h-sel"/><line x1="100" y1="12" x2="170" y2="105" class="h-sel"/><text x="44" y="50" class="h-txt">AB</text><text x="140" y="50" class="h-txt">AC</text><text x="88" y="78" class="h-finger">👆</text></svg>',
      },
      {
        title: '理由を選んで根拠ゲット！',
        text: '「仮定より」「共通な辺より」など、正しい理由を選んで「根拠を確定」！',
        art: '<svg viewBox="0 0 200 120"><rect x="20" y="10" width="160" height="28" rx="8" class="h-btn h-on"/><text x="100" y="29" class="h-btxt">仮定より</text><rect x="20" y="46" width="160" height="28" rx="8" class="h-btn"/><text x="100" y="65" class="h-btxt">共通な辺より</text><rect x="20" y="82" width="160" height="28" rx="8" class="h-btn"/><text x="100" y="101" class="h-btxt">対頂角より</text></svg>',
      },
      {
        title: '3つの根拠を集めよう！',
        text: '3つの根拠がそろったら、合同条件を選ぼう！',
        art: '<svg viewBox="0 0 200 120"><rect x="8" y="30" width="58" height="56" rx="8" class="h-slot"/><rect x="71" y="30" width="58" height="56" rx="8" class="h-slot"/><rect x="134" y="30" width="58" height="56" rx="8" class="h-slot"/><text x="37" y="63" class="h-stxt">AB＝CB</text><text x="100" y="63" class="h-stxt">AD＝CD</text><text x="163" y="63" class="h-stxt">BD＝BD</text></svg>',
      },
      {
        title: '合同から結論を導こう！（STAGE 6）',
        text: '結論が「AC＝BD」のような問題では、①証明する2つの三角形をタップして頂点の対応を決め、②根拠を3つ、③合同条件、④「合同な図形の対応する辺（角）は等しい」で結論を導くよ。',
        art: '<svg viewBox="0 0 200 120"><polygon points="20,100 60,20 95,100" class="h-tri1"/><polygon points="105,100 140,20 180,100" class="h-tri2"/><text x="60" y="80" class="h-btxt">1</text><text x="140" y="80" class="h-btxt">2</text><text x="100" y="114" class="h-btxt">A↔D・B↔E・C↔F</text></svg>',
      },
      {
        title: '証明成功！',
        text: '完成した証明文を確認しよう！ ミスやヒントが少ないほど、★が増えるよ。',
        art: '<svg viewBox="0 0 200 120"><rect x="30" y="8" width="140" height="104" rx="8" class="h-paper"/><line x1="45" y1="30" x2="150" y2="30" class="h-rule"/><line x1="45" y1="48" x2="135" y2="48" class="h-rule"/><line x1="45" y1="66" x2="145" y2="66" class="h-rule"/><text x="100" y="98" class="h-star">★★★</text></svg>',
      },
    ],
    puzzle: [
      {
        title: '図と仮定・結論を確認しよう！',
        text: '上の図と、仮定（使える情報）・結論（証明するゴール）をよく見よう。図をタップすると、大きくして印もつけられるよ。',
        art: '<svg viewBox="0 0 200 120"><polygon points="50,15 15,100 85,100" class="h-tri1"/><rect x="100" y="28" width="90" height="22" rx="6" class="h-btn h-on"/><text x="145" y="44" class="h-btxt">仮定</text><rect x="100" y="64" width="90" height="22" rx="6" class="h-btn"/><text x="145" y="80" class="h-btxt">結論</text></svg>',
      },
      {
        title: '解答レベルをえらぼう！',
        text: '「おてがる」は正しい等式を選んで穴埋め、「スタンダード」は等式と理由を組み立て、「チャレンジ」は選択肢なしで等式を自分で入力！',
        art: '<svg viewBox="0 0 200 120"><rect x="6" y="30" width="58" height="56" rx="8" class="h-btn h-on"/><text x="35" y="63" class="h-btxt">おてがる</text><rect x="71" y="30" width="58" height="56" rx="8" class="h-btn"/><text x="100" y="63" class="h-btxt">スタンダード</text><rect x="136" y="30" width="58" height="56" rx="8" class="h-btn"/><text x="165" y="63" class="h-btxt">チャレンジ</text></svg>',
      },
      {
        title: '空欄をタップして、カードを入れよう！',
        text: '証明文の空欄をタップすると、下に入れられるカードが出るよ。カードをタップすると空欄に入るよ。入れたカードは何度でも変えられるよ。',
        art: '<svg viewBox="0 0 200 120"><rect x="10" y="14" width="85" height="26" rx="8" class="h-btn h-on"/><text x="52" y="32" class="h-btxt">AB＝CB</text><rect x="105" y="14" width="85" height="26" rx="8" class="h-btn"/><text x="147" y="32" class="h-btxt">BD＝BD</text><rect x="10" y="50" width="85" height="26" rx="8" class="h-btn"/><text x="52" y="68" class="h-btxt">AB＝AD</text><rect x="105" y="50" width="85" height="26" rx="8" class="h-btn"/><text x="147" y="68" class="h-btxt">AD＝CD</text><text x="40" y="104" class="h-finger">👆</text></svg>',
      },
      {
        title: '理由と等式の組み合わせを確認しよう！',
        text: '「スタンダード」と「チャレンジ」では、理由と等式をセットで考えるよ。等式が合っていても、理由がちがうと正解にならないよ。',
        art: '<svg viewBox="0 0 200 120"><rect x="15" y="16" width="170" height="24" rx="8" class="h-btn h-on"/><text x="100" y="33" class="h-btxt">共通な辺だから</text><rect x="45" y="48" width="110" height="24" rx="8" class="h-btn"/><text x="100" y="65" class="h-btxt">BD＝BD</text><text x="100" y="100" class="h-star">✓</text></svg>',
      },
      {
        title: 'チャレンジはキーパッドで入力！',
        text: '「辺の等式」を選んで、A → B → C → D と押すと AB＝CD（＝ は自動で入るよ）。角は「角の等式」を選んで A → B → C → D → E → F で ∠ABC＝∠DEF。最後に「決定」！',
        art: '<svg viewBox="0 0 200 120"><rect x="30" y="8" width="140" height="28" rx="8" class="h-paper"/><text x="100" y="28" class="h-kp-disp">AB＝C＿</text><rect x="20" y="46" width="34" height="26" rx="6" class="h-btn"/><text x="37" y="64" class="h-btxt">A</text><rect x="62" y="46" width="34" height="26" rx="6" class="h-btn"/><text x="79" y="64" class="h-btxt">B</text><rect x="104" y="46" width="34" height="26" rx="6" class="h-btn h-on"/><text x="121" y="64" class="h-btxt">C</text><rect x="146" y="46" width="34" height="26" rx="6" class="h-btn h-on"/><text x="163" y="64" class="h-btxt">D</text><rect x="20" y="80" width="40" height="26" rx="6" class="h-btn"/><text x="40" y="98" class="h-btxt">←</text><rect x="66" y="80" width="40" height="26" rx="6" class="h-btn"/><text x="86" y="98" class="h-btxt">消す</text><rect x="112" y="80" width="68" height="26" rx="6" class="h-btn h-on h-confirm"/><text x="146" y="98" class="h-btxt">決定</text></svg>',
      },
      {
        title: '合同から結論を導く問題（STAGE 6）',
        text: '最初に「△＿と△＿において」の三角形を、頂点の対応がそろうように答えよう（チャレンジは △ABC と △DEF のようにキーパッドで入力）。最後に「合同な図形の対応する辺（角）は等しいから」で結論を答えるよ。',
        art: '<svg viewBox="0 0 200 120"><rect x="10" y="14" width="80" height="26" rx="8" class="h-btn h-on"/><text x="50" y="32" class="h-btxt">△ABC</text><text x="100" y="32" class="h-btxt">と</text><rect x="110" y="14" width="80" height="26" rx="8" class="h-btn h-on"/><text x="150" y="32" class="h-btxt">△DEF</text><rect x="15" y="56" width="170" height="24" rx="8" class="h-btn"/><text x="100" y="73" class="h-btxt">対応する辺は等しいから</text><rect x="55" y="88" width="90" height="24" rx="8" class="h-btn h-on"/><text x="100" y="105" class="h-btxt">AC＝DF</text></svg>',
      },
      {
        title: '証明を完成させよう！',
        text: 'すべて埋めたら「答え合わせ」！ まちがえた所は赤くなるので、そこだけ直してもう一度。★はレベルごとに記録されるよ。',
        art: '<svg viewBox="0 0 200 120"><rect x="30" y="8" width="140" height="104" rx="8" class="h-paper"/><line x1="45" y1="30" x2="150" y2="30" class="h-rule"/><line x1="45" y1="48" x2="135" y2="48" class="h-rule"/><line x1="45" y1="66" x2="145" y2="66" class="h-rule"/><text x="100" y="98" class="h-star">★★★</text></svg>',
      },
    ],
  };
  let howtoMode = 'hunter';
  let howtoPage = 0;

  function renderHowto() {
    const pages = HOWTO[howtoMode];
    const page = pages[howtoPage];
    doc.querySelectorAll('[data-howto-tab]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-howto-tab') === howtoMode));
    });
    $('#howto-art').innerHTML = page.art;
    $('#howto-title').textContent = (howtoPage + 1) + '. ' + page.title;
    $('#howto-text').textContent = page.text;
    $('#howto-dots').innerHTML = pages.map(function (_, i) {
      return '<span class="dot' + (i === howtoPage ? ' on' : '') + '"></span>';
    }).join('');
    $('#howto-prev').disabled = howtoPage === 0;
    const last = howtoPage === pages.length - 1;
    $('#howto-next').textContent = last ? 'はじめる！' : 'つぎへ ▶';
  }

  // ---- ルーティング -------------------------------------------------------

  function playNav(mode, problem) {
    const M = MODES[mode];
    return {
      home: function () { go('#/'); },
      list: function () { go(M.stage(problem.stage)); },
      stages: function () { go(M.select); },
      // 次の問題は同じステージの中で進む。ステージ最後なら次のステージの一覧へ
      next: function () {
        const list = PH.stageProblems(problem.stage);
        const nxt = list[list.indexOf(problem) + 1];
        go(nxt ? M.play(nxt.id) : M.stage(problem.stage));
      },
      nextStage: function () {
        go(PH.getStage(problem.stage + 1) ? M.stage(problem.stage + 1) : M.select);
      },
      reload: function () { route(); },
    };
  }

  function route() {
    let parts = location.hash.replace(/^#\/?/, '').split('/');
    let mode = 'hunter';
    if (parts[0] === 'puzzle') {
      mode = 'puzzle';
      parts = parts.slice(1);
      if (!parts[0]) parts = ['select'];
    }
    const name = parts[0];
    PH.play.unmount();
    PH.puzzleView.unmount();
    doc.title = '証明ハンター';

    if (name === 'select') {
      renderStageList(mode);
      show('select');
    } else if (name === 'stage' && PH.getStage(parts[1])) {
      renderStage(mode, PH.getStage(parts[1]));
      show('select');
    } else if (name === 'review') {
      renderReview(mode);
      show('select');
    } else if (name === 'howto' && mode === 'hunter') {
      howtoMode = parts[1] === 'puzzle' ? 'puzzle' : 'hunter';
      howtoPage = 0;
      renderHowto();
      show('howto');
    } else if (name === 'play' && PH.getProblem(parts[1])) {
      const problem = PH.getProblem(parts[1]);
      if (mode === 'puzzle') {
        show('puzzle');
        PH.puzzleView.mount(doc.getElementById('screen-puzzle'), problem, playNav('puzzle', problem));
        doc.title = '証明パズル 問題' + problem.number + '｜証明ハンター';
      } else {
        show('play');
        PH.play.mount(doc.getElementById('screen-play'), problem, playNav('hunter', problem));
        doc.title = '問題' + problem.number + ' ' + problem.title + '｜証明ハンター';
      }
    } else {
      renderTitle();
      show('title');
    }
  }

  function init() {
    PH.sound.setEnabled(PH.storage.getSound());

    doc.addEventListener('click', function (e) {
      const t = e.target.closest('[data-go],[data-level],[data-sound-toggle],#btn-continue,#howto-prev,#howto-next,#hint-close,#tri-close');
      if (!t) return;
      if (t.hasAttribute('data-level')) {
        if (PH.storage.setPuzzleLevel(t.getAttribute('data-level'))) {
          PH.sound.play('tap');
          renderStageList('puzzle');
        }
        return;
      }
      if (t.hasAttribute('data-go')) {
        PH.sound.play('tap');
        go(t.getAttribute('data-go'));
      } else if (t.hasAttribute('data-sound-toggle')) {
        const on = !PH.storage.getSound();
        PH.storage.setSound(on);
        PH.sound.setEnabled(on);
        PH.sound.play('tap');
        renderSoundButtons();
      } else if (t.id === 'btn-continue') {
        const last = PH.storage.getLastPlay();
        if (!last) return;
        PH.sound.play('tap');
        go(MODES[last.mode].play(last.id));
      } else if (t.id === 'howto-prev') {
        if (howtoPage > 0) { howtoPage--; renderHowto(); }
      } else if (t.id === 'howto-next') {
        if (howtoPage < HOWTO[howtoMode].length - 1) { howtoPage++; renderHowto(); }
        else go(MODES[howtoMode].select);
      } else if (t.id === 'hint-close') {
        PH.hints.hide(doc.getElementById('hint-popup'));
      } else if (t.id === 'tri-close') {
        const c = PH.play.current();
        if (c) c.setTriCheck(false);
        else PH.hints.hide(doc.getElementById('tri-popup'));
      }
    });

    // ヒントのポップアップは図形を隠さないので、表示したまま操作を続けられる。Escでも閉じる。
    doc.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      PH.hints.hide(doc.getElementById('hint-popup'));
      const c = PH.play.current();
      if (c && c.triCheck) c.setTriCheck(false);
    });

    root.addEventListener('hashchange', route);
    route();
  }

  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', init);
  else init();
})(window);
