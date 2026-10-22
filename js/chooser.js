/*
 * chooser.js — 「どちらに印をつけますか？」のような、候補から1つを選ぶ小さなポップアップ（両モード共通）
 *
 * PH.chooser.open({ title, message?, options: [{ value, label }], onChoose(value), textOptions? })
 *   textOptions: true … 選択肢が長い文字（「スタンダード」など）のとき、改行しない小さめの文字で表示
 *   avoid: 要素   … その要素（図）と重ならない位置に出す（図の下 → 図の右 → 図の左 → 図の上。どこにも入らなければ中央）
 * キャンセル（ボタン・外側のタップ・Esc）では何もしない。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const doc = root.document;
  let box = null;
  let current = null;

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function ensure() {
    if (box) return box;
    box = doc.createElement('div');
    box.className = 'chooser';
    box.hidden = true;
    box.setAttribute('role', 'dialog');
    box.setAttribute('aria-modal', 'true');
    box.innerHTML = '<div class="card chooser-box"><p class="chooser-title"></p><p class="chooser-message"></p><div class="chooser-options"></div>' +
      '<button class="btn chooser-cancel" data-choose-cancel>キャンセル</button></div>';
    doc.body.appendChild(box);
    box.addEventListener('click', function (e) {
      const opt = e.target.closest('[data-choose]');
      if (opt) {
        const cb = current && current.onChoose;
        const value = current.options[Number(opt.getAttribute('data-choose'))].value;
        close();
        if (cb) cb(value);
        return;
      }
      if (e.target === box || e.target.closest('[data-choose-cancel]')) close();
    });
    doc.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && current) close();
    });
    return box;
  }

  function open(opts) {
    const el = ensure();
    current = opts;
    el.querySelector('.chooser-title').textContent = opts.title;
    // 文字の長い選択肢（解答レベル名など）は、改行しないよう小さめの文字にする
    el.classList.toggle('is-text', !!opts.textOptions);
    // 選択肢が4つ以上なら2列に並べる（1列に並べると、△BDM のような文字がボタンからはみ出す）
    el.classList.toggle('is-many', opts.options.length > 3);
    const msg = el.querySelector('.chooser-message');
    msg.textContent = opts.message || '';
    msg.hidden = !opts.message;
    el.querySelector('.chooser-options').innerHTML = opts.options.map(function (o, i) {
      return '<button class="btn chooser-option" data-choose="' + i + '">' + esc(o.label) + '</button>';
    }).join('');
    el.hidden = false;
    place(el, opts.avoid);
    const first = el.querySelector('.chooser-option');
    if (first && first.focus) first.focus({ preventScroll: true });
  }

  // 図と重ならない位置に置く（入らなければ画面の中央）
  function place(el, avoid) {
    const card = el.querySelector('.chooser-box');
    el.classList.remove('is-placed');
    card.style.marginTop = card.style.marginLeft = card.style.width = '';
    if (!avoid || !avoid.getBoundingClientRect) return;
    const r = avoid.getBoundingClientRect();
    const vw = root.innerWidth, vh = root.innerHeight;
    const w = card.offsetWidth, h = card.offsetHeight;
    const gap = 10, edge = 8;
    let top = null, left = null;
    if (r.bottom + gap + h <= vh - edge) {            // 図の下
      top = Math.max(edge, r.bottom + gap);
      left = (vw - w) / 2;
    } else if (r.right + gap + w <= vw - edge) {      // 図の右
      left = r.right + gap;
      top = Math.min(Math.max(edge, r.top + (r.height - h) / 2), vh - h - edge);
    } else if (r.left - gap - w >= edge) {            // 図の左
      left = r.left - gap - w;
      top = Math.min(Math.max(edge, r.top + (r.height - h) / 2), vh - h - edge);
    } else if (r.top - gap - h >= edge) {             // 図の上
      top = r.top - gap - h;
      left = (vw - w) / 2;
    }
    if (top == null) return;
    el.classList.add('is-placed');
    card.style.width = w + 'px';
    card.style.marginTop = Math.round(top) + 'px';
    card.style.marginLeft = Math.round(Math.max(edge, left)) + 'px';
  }

  function close() {
    if (box) box.hidden = true;
    current = null;
  }

  PH.chooser = { open: open, close: close, isOpen: function () { return !!current; } };
})(typeof window !== 'undefined' ? window : globalThis);
