/*
 * math-keypad.js — チャレンジ（証明パズル）の等式・三角形の入力：数学キーパッド
 *
 * 入力のモデル（DOMに依存しない。テスト可能）
 *   PH.mathKeypad.create(letters, opts)  … letters はその問題の図にある頂点記号だけ
 *     opts.kinds      入力できる種類（省略時 ['seg', 'ang']。三角形の入力欄は ['tri']。種類が1つなら最初から選ばれている）
 *     opts.isTriangle 三角形の入力で、3点が図の上の三角形かを確かめる関数（図にない三角形は決定できない）
 *     .setKind('seg' | 'ang' | 'tri')  辺の等式（□□＝□□）／角の等式（∠□□□＝∠□□□）／三角形（△□□□と△□□□）。切りかえると入力はリセット
 *     .press('A')                   頂点記号を1文字（同じ辺・角・三角形の中で同じ文字は使えない）
 *                                   左辺（1つ目の三角形）を入力しおわると、そのまま右辺へ進む（＝・∠・△ は表示ずみなので押さなくてよい）
 *     .pressEq()                    ＝（キーボードの = 用。左辺が入力しおわっていれば右辺へ。押さなくても進む）
 *     .backspace() / .clear()       1文字削除（＝をまたいで左辺へ戻る）／すべて消す
 *     .complete()                   最後まで入力され、決定できるか（三角形は図の上の異なる2つの三角形であること）
 *     .problem()                    最後まで入力したが決定できない理由（表示用）。なければ null
 *     .value()                      'AB=CD' / '∠ABC=∠DEF' / '△ABC/△DEF'（判定に渡す正規化された文字列）
 *     .display()                    'AB＝C＿' や '△AB＿と△＿＿＿' のような表示用の文字列（入力位置が分かる）
 *   PH.mathKeypad.parse(text, letters) … キーボードや貼り付けの文字列を正規化して検証。不正なら null
 *     小文字→大文字、全角・半角の＝の同一視、空白の除去。数学的な同一性（AB＝BA など）は判定側（validation.js）で扱う。
 *
 * 画面（DOM）は PH.mathKeypad.render(...) … puzzle-renderer.js から使う。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  const SIZE = { seg: 2, ang: 3, tri: 3 };
  const PRE = { seg: '', ang: '∠', tri: '△' };
  const SEP = { seg: '＝', ang: '＝', tri: 'と' };

  function Keypad(letters, opts) {
    const o = opts || {};
    this.letters = letters.slice();
    this.kinds = (o.kinds || ['seg', 'ang']).filter(function (k) { return SIZE[k]; });
    this.isTriangle = o.isTriangle || null;
    this.kind = this.kinds.length === 1 ? this.kinds[0] : null;   // 種類が1つなら選ぶ必要はない
    this.left = [];
    this.right = [];
    this.eq = false;
  }

  Keypad.prototype.setKind = function (kind) {
    if (!SIZE[kind] || this.kinds.indexOf(kind) < 0) return false;
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
    return side.indexOf(letter) < 0;          // AA のような辺、頂点と端の点が同じ角、同じ点を2回使う三角形は作れない
  };

  Keypad.prototype.press = function (letter) {
    const L = String(letter).toUpperCase();
    if (!this.canPress(L)) return false;
    this.side().push(L);
    // 左辺が入力しおわったら、＝を押さなくても右辺の入力に進む
    if (!this.eq && this.left.length === SIZE[this.kind]) this.eq = true;
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

  // 1文字削除。右辺が空なら＝をまたいで、左辺の最後の文字を消す
  Keypad.prototype.backspace = function () {
    if (this.right.length) this.right.pop();
    else if (this.left.length) { this.eq = false; this.left.pop(); }
    else return false;
    return true;
  };

  Keypad.prototype.isEmpty = function () {
    return !this.left.length && !this.eq;
  };

  Keypad.prototype.filled = function () {
    return !!this.kind && this.eq && this.right.length === SIZE[this.kind];
  };

  // 最後まで入力したが決定できない理由（三角形：同じ三角形・図にない三角形）
  Keypad.prototype.problem = function () {
    if (!this.filled() || this.kind !== 'tri') return null;
    const key = function (a) { return a.slice().sort().join(''); };
    if (key(this.left) === key(this.right)) return '同じ三角形を2つ選んでいるよ。ちがう三角形を入力しよう。';
    const bad = [this.left, this.right].find(function (t) { return this.isTriangle && !this.isTriangle(t); }, this);
    if (bad) return '△' + bad.join('') + ' は図の中の三角形ではないよ。';
    return null;
  };

  Keypad.prototype.complete = function () {
    return this.filled() && !this.problem();
  };

  Keypad.prototype.value = function () {
    if (!this.complete()) return null;
    const pre = PRE[this.kind];
    return pre + this.left.join('') + (this.kind === 'tri' ? '/' : '=') + pre + this.right.join('');
  };

  Keypad.prototype.display = function () {
    if (!this.kind) return '';
    const n = SIZE[this.kind];
    const pre = PRE[this.kind];
    const pad = function (a) { return a.join('') + '＿'.repeat(n - a.length); };
    return pre + pad(this.left) + SEP[this.kind] + pre + pad(this.right);
  };

  // 決定済みの値（'AB=CD'・'△ABC/△DEF' など）を入力欄に読み込む（もう一度開いたとき・貼り付け）
  Keypad.prototype.load = function (value) {
    const v = parse(value, this.letters);
    if (!v || this.kinds.indexOf(v.kind) < 0) return false;
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
   * 等式・三角形の組の文字列を検証する。正しければ { kind, left, right, value }、不正なら null（例外は出さない）
   *   辺：AB=CD（2文字ずつ）／角：∠ABC=∠DEF（3文字ずつ）。左右は同じ種類。
   *   三角形：△ABC/△DEF（「と」「,」「、」「≡」でもよい。△は省略可。「＝」は等式と区別するので使わない）。2つは異なる三角形。
   *   使える文字は letters だけ。同じ辺・角・三角形の中に同じ文字は使えない。
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
      if (!m) {
        m = s.match(/^△?([A-Z])([A-Z])([A-Z])(?:\/|と|,|、|≡)△?([A-Z])([A-Z])([A-Z])$/);
        kind = 'tri';
      }
      if (!m) return null;
      const chars = m.slice(1);
      if (letters && chars.some(function (c) { return letters.indexOf(c) < 0; })) return null;
      const n = SIZE[kind];
      const left = chars.slice(0, n), right = chars.slice(n);
      const distinct = function (a) { return new Set(a).size === a.length; };
      if (!distinct(left) || !distinct(right)) return null;
      if (kind === 'tri' && left.slice().sort().join('') === right.slice().sort().join('')) return null;
      const pre = PRE[kind];
      return { kind: kind, left: left.join(''), right: right.join(''),
        value: pre + left.join('') + (kind === 'tri' ? '/' : '=') + pre + right.join('') };
    } catch (e) {
      return null;
    }
  }

  // 表示用（＝を全角に、三角形の組は「と」で）
  function pretty(value) {
    return String(value).replace(/=/g, '＝').replace(/\//g, 'と');
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

  const KIND_LABEL = {
    seg: ['辺の等式', '□□＝□□'],
    ang: ['角の等式', '∠□□□＝∠□□□'],
    tri: ['三角形', '△□□□と△□□□'],
  };

  /*
   * キーパッドのHTML。ボタンは data-kp 属性で操作を表す：
   *   kind:seg / kind:ang / key:A / back / clear / decide
   */
  function render(kp) {
    const kindBtn = function (k) {
      return '<button class="kp-kind' + (kp.kind === k ? ' is-on' : '') + '" data-kp="kind:' + k + '" aria-pressed="' + (kp.kind === k) + '">' +
        '<span class="kp-kind-label">' + KIND_LABEL[k][0] + '</span><span class="kp-kind-sample">' + KIND_LABEL[k][1] + '</span></button>';
    };
    // 種類が1つ（三角形の入力欄）なら、種類のボタンは出さない
    let html = kp.kinds.length > 1 ? '<div class="kp-kinds">' + kp.kinds.map(kindBtn).join('') + '</div>' : '';
    if (!kp.kind) {
      return html + '<p class="kp-guide">はじめに「辺の等式」か「角の等式」を選ぼう。</p>';
    }
    html += '<div class="kp-display" aria-live="polite">' + esc(kp.display()) + '</div>';
    const prob = kp.problem();
    if (prob) html += '<p class="kp-warn">' + esc(prob) + '</p>';
    html += '<div class="kp-keys">' + kp.letters.map(function (L) {
      const can = kp.canPress(L);
      return '<button class="kp-key' + (can ? ' is-next' : '') + '" data-kp="key:' + esc(L) + '"' + (can ? '' : ' disabled') + '>' + esc(L) + '</button>';
    }).join('') + '</div>';
    // ＝・∠・△ は入力欄に表示ずみなのでボタンはない。←・消す・決定を1行に並べる
    html += '<div class="kp-ops">' +
      '<button class="kp-op" data-kp="back"' + (kp.isEmpty() ? ' disabled' : '') + ' aria-label="1文字消す">←</button>' +
      '<button class="kp-op" data-kp="clear"' + (kp.isEmpty() ? ' disabled' : '') + '>消す</button>' +
      '<button class="btn btn-confirm kp-decide" data-kp="decide"' + (kp.complete() ? '' : ' disabled') + '>決定</button>' +
      '</div>';
    return html;
  }

  PH.mathKeypad = {
    create: function (letters, opts) { return new Keypad(letters, opts); },
    parse: parse,
    normalizeText: normalizeText,
    pretty: pretty,
    lettersOf: lettersOf,
    render: render,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.mathKeypad;
})(typeof window !== 'undefined' ? window : globalThis);
