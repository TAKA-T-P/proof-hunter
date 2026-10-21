/*
 * app.js — 画面管理・アプリ起動
 *
 * 画面はURLのハッシュで切り替える（ブラウザの「戻る」でも状態が崩れない）。
 *   #/            タイトル
 *   #/select      ステージ選択（＋苦手な問題に挑戦）
 *   #/stage/<n>   ステージの問題一覧
 *   #/review      苦手な問題（未クリア・★★以下）
 *   #/howto       あそびかた
 *   #/play/<id>   問題プレイ（開くたびに新しい状態で開始）
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

  const SCREENS = ['title', 'select', 'howto', 'play'];

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
    const last = PH.storage.getLastProblem();
    const cont = $('#btn-continue');
    cont.hidden = !(PH.storage.hasHistory() && last && PH.getProblem(last));
    renderSoundButtons();
  }

  function renderSoundButtons() {
    const on = PH.storage.getSound();
    doc.querySelectorAll('[data-sound-toggle]').forEach(function (b) {
      b.setAttribute('aria-pressed', String(on));
      b.textContent = on ? '🔊 効果音 ON' : '🔈 効果音 OFF';
    });
  }

  // ---- ステージ選択・問題一覧・復習 ----------------------------------------

  function starsHtml(rec) {
    if (!rec.cleared) return '<span class="dim" aria-label="未クリア">★★★</span>';
    return '★'.repeat(rec.bestStars) + '<span class="dim">' + '★'.repeat(3 - rec.bestStars) + '</span>';
  }

  // 問題選択画面の見出し（戻るボタンの行き先と題名）
  function setSelectHeader(title, backHash, backLabel) {
    const back = $('#select-back');
    back.setAttribute('data-go', backHash);
    back.querySelector('.lbl').textContent = backLabel;
    back.querySelector('.ico').textContent = backHash === '#/' ? '⌂' : '◀';
    $('#select-title').textContent = title;
  }

  function problemCard(p, showStage) {
    const rec = PH.storage.getProblem(p.id);
    const diff = '★'.repeat(p.difficulty) + '<span class="dim">' + '★'.repeat(Math.max(0, 3 - p.difficulty)) + '</span>';
    const best = rec.cleared
      ? '<span class="best-stars">' + '★'.repeat(rec.bestStars) + '<span class="dim">' + '★'.repeat(3 - rec.bestStars) + '</span></span>'
      : '<span class="best-stars dim">★★★</span>';
    return '<li><a class="problem-card' + (rec.cleared ? ' is-cleared' : '') + '" href="#/play/' + p.id + '">' +
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

  function renderStageList() {
    setSelectHeader('ステージをえらぶ', '#/', 'ホーム');
    const review = PH.storage.reviewProblems().length;
    $('#select-body').innerHTML =
      '<button class="review-btn" data-go="#/review">🔁 苦手な問題に挑戦！<span class="review-count">' +
        (review ? '復習 ' + review + '問' : '復習なし') + '</span></button>' +
      '<ul class="stage-list">' + PH.STAGES.map(function (st) {
        const stat = PH.storage.stageStats(st.id);
        return '<li><a class="stage-card' + (stat.complete ? ' is-complete' : '') + '" href="#/stage/' + st.id + '">' +
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
    renderSoundButtons();
  }

  function renderStage(stage) {
    setSelectHeader('STAGE ' + stage.id + '｜' + stage.title, '#/select', 'ステージ');
    const stat = PH.storage.stageStats(stage.id);
    $('#select-body').innerHTML =
      '<div class="stage-intro"><p>' + esc(stage.theme) + '</p>' +
        '<p class="stage-intro-stat">クリア ' + stat.cleared + '/' + stat.total + '問 ・ ★ ' + stat.stars + '/' + stat.maxStars +
        (stat.complete ? ' <span class="sc-badge">STAGE CLEAR</span>' : '') + '</p></div>' +
      '<ul class="problem-list">' + stat.problems.map(function (p) { return problemCard(p, false); }).join('') + '</ul>';
    renderSoundButtons();
  }

  function renderReview() {
    setSelectHeader('苦手な問題に挑戦！', '#/select', 'ステージ');
    const list = PH.storage.reviewProblems();
    $('#select-body').innerHTML = list.length
      ? '<p class="select-note">まだクリアしていない問題と、★★以下の問題だよ。★★★をめざそう！</p>' +
        '<ul class="problem-list">' + list.map(function (p) { return problemCard(p, true); }).join('') + '</ul>'
      : '<div class="card review-empty"><p class="review-empty-title">復習する問題はありません！</p><p>すべて★★★をめざそう！ すばらしい！</p>' +
        '<button class="btn btn-primary" data-go="#/select">ステージ選択へ</button></div>';
    renderSoundButtons();
  }

  // ---- あそびかた --------------------------------------------------------

  const HOWTO = [
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
      text: '「仮定より」「共通な辺だから」など、正しい理由を選んで「根拠を確定」！',
      art: '<svg viewBox="0 0 200 120"><rect x="20" y="10" width="160" height="28" rx="8" class="h-btn h-on"/><text x="100" y="29" class="h-btxt">仮定より</text><rect x="20" y="46" width="160" height="28" rx="8" class="h-btn"/><text x="100" y="65" class="h-btxt">共通な辺だから</text><rect x="20" y="82" width="160" height="28" rx="8" class="h-btn"/><text x="100" y="101" class="h-btxt">対頂角だから</text></svg>',
    },
    {
      title: '3つの根拠を集めよう！',
      text: '3つの根拠がそろったら、合同条件を選ぼう！',
      art: '<svg viewBox="0 0 200 120"><rect x="8" y="30" width="58" height="56" rx="8" class="h-slot"/><rect x="71" y="30" width="58" height="56" rx="8" class="h-slot"/><rect x="134" y="30" width="58" height="56" rx="8" class="h-slot"/><text x="37" y="63" class="h-stxt">AB＝CB</text><text x="100" y="63" class="h-stxt">AD＝CD</text><text x="163" y="63" class="h-stxt">BD＝BD</text></svg>',
    },
    {
      title: '証明成功！',
      text: '完成した証明文を確認しよう！ ミスやヒントが少ないほど、★が増えるよ。',
      art: '<svg viewBox="0 0 200 120"><rect x="30" y="8" width="140" height="104" rx="8" class="h-paper"/><line x1="45" y1="30" x2="150" y2="30" class="h-rule"/><line x1="45" y1="48" x2="135" y2="48" class="h-rule"/><line x1="45" y1="66" x2="145" y2="66" class="h-rule"/><text x="100" y="98" class="h-star">★★★</text></svg>',
    },
  ];
  let howtoPage = 0;

  function renderHowto() {
    const page = HOWTO[howtoPage];
    $('#howto-art').innerHTML = page.art;
    $('#howto-title').textContent = (howtoPage + 1) + '. ' + page.title;
    $('#howto-text').textContent = page.text;
    $('#howto-dots').innerHTML = HOWTO.map(function (_, i) {
      return '<span class="dot' + (i === howtoPage ? ' on' : '') + '"></span>';
    }).join('');
    $('#howto-prev').disabled = howtoPage === 0;
    const last = howtoPage === HOWTO.length - 1;
    $('#howto-next').textContent = last ? 'はじめる！' : 'つぎへ ▶';
  }

  // ---- ルーティング -------------------------------------------------------

  function route() {
    const parts = location.hash.replace(/^#\/?/, '').split('/');
    const name = parts[0];
    PH.play.unmount();
    if (name === 'select') {
      renderStageList();
      show('select');
    } else if (name === 'stage' && PH.getStage(parts[1])) {
      renderStage(PH.getStage(parts[1]));
      show('select');
    } else if (name === 'review') {
      renderReview();
      show('select');
    } else if (name === 'howto') {
      howtoPage = 0;
      renderHowto();
      show('howto');
    } else if (name === 'play' && PH.getProblem(parts[1])) {
      const problem = PH.getProblem(parts[1]);
      show('play');
      PH.play.mount(doc.getElementById('screen-play'), problem, {
        home: function () { go('#/'); },
        list: function () { go('#/stage/' + problem.stage); },
        stages: function () { go('#/select'); },
        // 次の問題は同じステージの中で進む。ステージ最後なら次のステージの一覧へ
        next: function () {
          const list = PH.stageProblems(problem.stage);
          const nxt = list[list.indexOf(problem) + 1];
          go(nxt ? '#/play/' + nxt.id : '#/stage/' + problem.stage);
        },
        nextStage: function () {
          go(PH.getStage(problem.stage + 1) ? '#/stage/' + (problem.stage + 1) : '#/select');
        },
      });
      doc.title = '問題' + problem.number + ' ' + problem.title + '｜証明ハンター';
      return;
    } else {
      renderTitle();
      show('title');
    }
    doc.title = '証明ハンター';
  }

  function init() {
    PH.sound.setEnabled(PH.storage.getSound());

    doc.addEventListener('click', function (e) {
      const t = e.target.closest('[data-go],[data-sound-toggle],#btn-continue,#howto-prev,#howto-next,#hint-close,#tri-close');
      if (!t) return;
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
        PH.sound.play('tap');
        go('#/play/' + PH.storage.getLastProblem());
      } else if (t.id === 'howto-prev') {
        if (howtoPage > 0) { howtoPage--; renderHowto(); }
      } else if (t.id === 'howto-next') {
        if (howtoPage < HOWTO.length - 1) { howtoPage++; renderHowto(); }
        else go('#/select');
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
