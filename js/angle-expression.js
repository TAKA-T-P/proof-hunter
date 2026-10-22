/*
 * angle-expression.js — 角度の式（角の和・差と定数角）の構造化・正規化・比較（Ver.0.7。DOMに依存しない）
 *
 * 式は文字列で比べず、{ terms: { 角のキー: 係数 }, constant: 定数角（度） } に直して比べる。
 *   '∠ACD＋60°' と '60°＋∠ACD' と '∠DCA＋60°' は同じ式（角の別表記は geometry.js の角のキーで同一視）。
 *   '60°－∠DAC' は { terms: { ∠DAC: -1 }, constant: 60 }。
 * 一般の数式処理はしない（角・定数角の和と差だけ）。読めない式は null を返し、例外でゲームを止めない。
 *
 *   PH.angleExpr.parse(figure, text)        … 構造化した式。読めなければ null
 *   PH.angleExpr.equal(a, b)                … 同じ式か
 *   PH.angleExpr.evaluate(figure, expr)     … 図の座標で測った値（度）。図の整合性の確認用（証明の正誤判定には使わない）
 *   PH.angleExpr.format(text)               … 表示用（＋・－・° を全角の記号に）
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function G() { return PH.geometry; }

  // 項に分ける：'∠ACD＋60°' → [{ sign: 1, text: '∠ACD' }, { sign: 1, text: '60°' }]
  function tokens(text) {
    const s = String(text == null ? '' : text).normalize('NFKC').replace(/\s+/g, '').replace(/[−–ー－]/g, '-').replace(/＋/g, '+').replace(/<|＜/g, '∠');
    if (!s) return null;
    const out = [];
    let i = 0, sign = 1;
    if (s[0] === '+' || s[0] === '-') { sign = s[0] === '-' ? -1 : 1; i = 1; }
    let cur = '';
    for (; i <= s.length; i++) {
      const c = s[i];
      if (c === '+' || c === '-' || c === undefined) {
        if (!cur) return null;
        out.push({ sign: sign, text: cur });
        cur = '';
        sign = c === '-' ? -1 : 1;
      } else cur += c;
    }
    return out;
  }

  function parse(figure, text) {
    try {
      const ts = tokens(text);
      if (!ts || !ts.length) return null;
      const expr = { terms: {}, constant: 0 };
      for (let i = 0; i < ts.length; i++) {
        const t = ts[i].text;
        let m = t.match(/^(\d+(?:\.\d+)?)°?$/);
        if (m) { expr.constant += ts[i].sign * Number(m[1]); continue; }
        m = t.match(/^∠([A-Z]{3})$/);
        if (!m) return null;
        const key = G().angleKey(figure, m[1]);
        expr.terms[key] = (expr.terms[key] || 0) + ts[i].sign;
        if (expr.terms[key] === 0) delete expr.terms[key];
      }
      return expr;
    } catch (e) {
      return null;
    }
  }

  function equal(a, b) {
    if (!a || !b) return false;
    if (Math.abs(a.constant - b.constant) > 1e-9) return false;
    const ka = Object.keys(a.terms), kb = Object.keys(b.terms);
    if (ka.length !== kb.length) return false;
    return ka.every(function (k) { return b.terms[k] === a.terms[k]; });
  }

  // 1つの角だけの式（係数1・定数0）なら、その角のキー
  function singleAngle(expr) {
    if (!expr || expr.constant !== 0) return null;
    const ks = Object.keys(expr.terms);
    return ks.length === 1 && expr.terms[ks[0]] === 1 ? ks[0] : null;
  }

  // 図の座標で測った値（度）。図の整合性の確認だけに使う
  function evaluate(figure, text) {
    const ts = tokens(text);
    if (!ts) return NaN;
    let v = 0;
    for (let i = 0; i < ts.length; i++) {
      const t = ts[i].text;
      const m = t.match(/^(\d+(?:\.\d+)?)°?$/);
      if (m) v += ts[i].sign * Number(m[1]);
      else v += ts[i].sign * PH.validation.measure(figure, t).value;
    }
    return v;
  }

  function format(text) {
    return String(text).replace(/\+/g, '＋').replace(/-/g, '－');
  }

  PH.angleExpr = { parse: parse, equal: equal, singleAngle: singleAngle, evaluate: evaluate, format: format, tokens: tokens };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.angleExpr;
})(typeof window !== 'undefined' ? window : globalThis);
