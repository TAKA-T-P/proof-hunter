/*
 * math-keypad.js — チャレンジ（証明パズル）の等式入力：数学キーパッド
 *
 * 入力のモデル（DOMに依存しない。テスト可能）
 *   PH.mathKeypad.create(letters)  … letters はその問題の図にある頂点記号だけ
 *     .setKind('seg' | 'ang')       辺の等式（□□＝□□）／角の等式（∠□□□＝∠□□□）。切りかえると入力はリセット
 *     .press('A')                   頂点記号を1文字（同じ辺・角の中で同じ文字は使えない）
 *     .pressEq()                    ＝（左辺が入力しおわったときだけ）
 *     .backspace() / .clear()       1文字削除／すべて消す
 *     .complete()                   最後まで入力されたか（決定できるか）
 *     .value()                      'AB=CD' / '∠ABC=∠DEF'（判定に渡す正規化された文字列）
 *     .display()                    'AB＝C＿' のような表示用の文字列（入力位置が分かる）
 *   PH.mathKeypad.parse(text, letters) … キーボードや貼り付けの文字列を正規化して検証。不正なら null
 *     小文字→大文字、全角・半角の＝の同一視、空白の除去。数学的な同一性（AB＝BA など）は判定側（validation.js）で扱う。
 *
 * 画面（DOM）は PH.mathKeypad.render(...) … puzzle-renderer.js から使う。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  const SIZE = { seg: 2, ang: 3 };

  function Keypad(letters) {
    this.letters = letters.slice();
    this.kind = null;            // まだ「辺の等式／角の等式」を選んでいない
    this.left = [];
    this.right = [];
    this.eq = false;
  }

  Keypad.prototype.setKind = function (kind) {
    if (!SIZE[kind]) return false;
    this.kind = kind;
    this.clear();
    return true;
  };

  Keypad.prototype.clear = function () {
    this.left = [];
    this.right = [];
    this.eq = false;
  };

  // いま入力しているのは左辺か右辺か
  Keypad.prototype.side = function () { return this.eq ? this.right : this.left; };

  // その文字を今押せるか（入力位置に応じて押せるボタンを強調するため）
  Keypad.prototype.canPress = function (letter) {
    if (!this.kind || this.letters.indexOf(letter) < 0) return false;
    const side = this.side();
    if (side.length >= SIZE[this.kind]) return false;
    return side.indexOf(letter) < 0;          // AA のような辺、頂点と端の点が同じ角は作れない
  };

  Keypad.prototype.press = function (letter) {
    const L = String(letter).toUpperCase();
    if (!this.canPress(L)) return false;
    this.side().push(L);
    return true;
  };

  Keypad.prototype.canPressEq = function () {
    return !!this.kind && !this.eq && this.left.length === SIZE[this.kind];
  };

  Keypad.prototype.pressEq = function () {
    if (!this.canPressEq()) return false;
    this.eq = true;
    return true;
  };

  Keypad.prototype.backspace = function () {
    if (this.right.length) this.right.pop();
    else if (this.eq) this.eq = false;
    else if (this.left.length) this.left.pop();
    else return false;
    return true;
  };

  Keypad.prototype.isEmpty = function () {
    return !this.left.length && !this.eq;
  };

  Keypad.prototype.complete = function () {
    return !!this.kind && this.eq && this.right.length === SIZE[this.kind];
  };

  Keypad.prototype.value = function () {
    if (!this.complete()) return null;
    const pre = this.kind === 'ang' ? '∠' : '';
    return pre + this.left.join('') + '=' + pre + this.right.join('');
  };

  Keypad.prototype.display = function () {
    if (!this.kind) return '';
    const n = SIZE[this.kind];
    const pre = this.kind === 'ang' ? '∠' : '';
    const pad = function (a) { return a.join('') + '＿'.repeat(n - a.length); };
    return pre + pad(this.left) + '＝' + pre + pad(this.right);
  };

  // 決定済みの値（'AB=CD' など）を入力欄に読み込む（もう一度開いたとき）
  Keypad.prototype.load = function (value) {
    const v = parse(value, this.letters);
    if (!v) return false;
    this.kind = v.kind;
    this.left = v.left.split('');
    this.right = v.right.split('');
    this.eq = true;
    return true;
  };

  // ---- 文字列の正規化・検証 -------------------------------------------------

  function normalizeText(text) {
    return String(text == null ? '' : text)
      .normalize('NFKC')               // 全角英字・全角＝ → 半角
      .toUpperCase()
      .replace(/\s+/g, '')
      .replace(/[＝]/g, '=')
      .replace(/[<＜]/g, '∠');          // キーボードで ∠ の代わりに < を使ってもよい
  }

  /*
   * 等式の文字列を検証する。正しければ { kind, left, right, value }、不正なら null（例外は出さない）
   *   辺：AB=CD（2文字ずつ）／角：∠ABC=∠DEF（3文字ずつ）。左右は同じ種類。
   *   使える文字は letters だけ。同じ辺・角の中に同じ文字は使えない。
   */
  function parse(text, letters) {
    try {
      const s = normalizeText(text);
      let m = s.match(/^([A-Z])([A-Z])=([A-Z])([A-Z])$/);
      let kind = 'seg';
      if (!m) {
        m = s.match(/^∠([A-Z])([A-Z])([A-Z])=∠([A-Z])([A-Z])([A-Z])$/);
        kind = 'ang';
      }
      if (!m) return null;
      const chars = m.slice(1);
      if (letters && chars.some(function (c) { return letters.indexOf(c) < 0; })) return null;
      const n = SIZE[kind];
      const left = chars.slice(0, n), right = chars.slice(n);
      const distinct = function (a) { return new Set(a).size === a.length; };
      if (!distinct(left) || !distinct(right)) return null;
      const pre = kind === 'ang' ? '∠' : '';
      return { kind: kind, left: left.join(''), right: right.join(''), value: pre + left.join('') + '=' + pre + right.join('') };
    } catch (e) {
      return null;
    }
  }

  // 表示用（＝を全角に）
  function pretty(value) {
    return String(value).replace(/=/g, '＝');
  }

  // 図にある頂点記号（アルファベット順）
  function lettersOf(figure) {
    return Object.keys(figure.points).sort();
  }

  // ---- 画面（DOM） --------------------------------------------------------------

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /*
   * キーパッドのHTML。ボタンは data-kp 属性で操作を表す：
   *   kind:seg / kind:ang / key:A / eq / back / clear / decide
   */
  function render(kp) {
    const kindBtn = function (k, label, sample) {
      return '<button class="kp-kind' + (kp.kind === k ? ' is-on' : '') + '" data-kp="kind:' + k + '" aria-pressed="' + (kp.kind === k) + '">' +
        '<span class="kp-kind-label">' + label + '</span><span class="kp-kind-sample">' + sample + '</span></button>';
    };
    let html = '<div class="kp-kinds">' +
      kindBtn('seg', '辺の等式', '□□＝□□') + kindBtn('ang', '角の等式', '∠□□□＝∠□□□') + '</div>';
    if (!kp.kind) {
      return html + '<p class="kp-guide">はじめに「辺の等式」か「角の等式」を選ぼう。</p>';
    }
    html += '<div class="kp-display" aria-live="polite">' + esc(kp.display()) + '</div>';
    html += '<div class="kp-keys">' + kp.letters.map(function (L) {
      const can = kp.canPress(L);
      return '<button class="kp-key' + (can ? ' is-next' : '') + '" data-kp="key:' + esc(L) + '"' + (can ? '' : ' disabled') + '>' + esc(L) + '</button>';
    }).join('') + '</div>';
    html += '<div class="kp-ops">' +
      '<button class="kp-op' + (kp.kind === 'seg' ? '' : ' is-fixed') + '" data-kp="kind:ang" aria-label="∠（角の等式にする）">∠</button>' +
      '<button class="kp-op' + (kp.canPressEq() ? ' is-next' : '') + '" data-kp="eq"' + (kp.canPressEq() ? '' : ' disabled') + '>＝</button>' +
      '<button class="kp-op" data-kp="back"' + (kp.isEmpty() ? ' disabled' : '') + ' aria-label="1文字消す">←</button>' +
      '<button class="kp-op" data-kp="clear"' + (kp.isEmpty() ? ' disabled' : '') + '>消す</button>' +
      '</div>';
    html += '<button class="btn btn-primary kp-decide" data-kp="decide"' + (kp.complete() ? '' : ' disabled') + '>決定</button>';
    return html;
  }

  PH.mathKeypad = {
    create: function (letters) { return new Keypad(letters); },
    parse: parse,
    normalizeText: normalizeText,
    pretty: pretty,
    lettersOf: lettersOf,
    render: render,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.mathKeypad;
})(typeof window !== 'undefined' ? window : globalThis);
