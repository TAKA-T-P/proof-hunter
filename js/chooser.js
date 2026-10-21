/*
 * chooser.js — 「どちらに印をつけますか？」のような、候補から1つを選ぶ小さなポップアップ（両モード共通）
 *
 * PH.chooser.open({ title, options: [{ value, label }], onChoose(value) })
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
    box.innerHTML = '<div class="card chooser-box"><p class="chooser-title"></p><div class="chooser-options"></div>' +
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
    el.querySelector('.chooser-options').innerHTML = opts.options.map(function (o, i) {
      return '<button class="btn chooser-option" data-choose="' + i + '">' + esc(o.label) + '</button>';
    }).join('');
    el.hidden = false;
    const first = el.querySelector('.chooser-option');
    if (first && first.focus) first.focus({ preventScroll: true });
  }

  function close() {
    if (box) box.hidden = true;
    current = null;
  }

  PH.chooser = { open: open, close: close, isOpen: function () { return !!current; } };
})(typeof window !== 'undefined' ? window : globalThis);
