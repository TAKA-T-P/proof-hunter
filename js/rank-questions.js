/*
 * rank-questions.js — 段位認定のミニ問題を、既存の問題データ（PH.problems）から生成する（DOMに依存しない）
 *
 * 正解はすべて evidence・congruence・triangles・finalStep から求め、問題文や正解を別に書き写さない。
 * 判定は geometry.js・validation.js の正規化（AB＝BA、左右の入れかえ、∠ABC＝∠CBA、一直線上の別名、頂点の対応）を使う。
 *
 * ミニ問題（テンプレート）の形
 *   { id, sourceId, category, type, typeLabel, difficulty, blanks（解答箇所の数）,
 *     figure（図を表示する問題ID・なければ null）, highlight（図で強調する要素キー）, lines（前置きの文）, ask（問い）,
 *     choice: { blanks: [{ label, choices: [{ id, text }], answer }] } | null,     … 選択式
 *     input:  { keypad: { kinds, fixedLeft?, triangle? }, check(value), answerText } | null,  … 記号入力（数学キーパッド）
 *     answerText, explain }
 *   category（出題のバランス用）：eq 等しい辺・角 / reason 理由 / cond 合同条件 / corr 三角形の対応 / final 合同からの結論
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function V() { return PH.validation; }
  function G() { return PH.geometry; }

  const CATEGORIES = ['eq', 'reason', 'cond', 'corr', 'final'];
  const CATEGORY_LABEL = { eq: '等しい辺・角', reason: '等しい理由', cond: '合同条件', corr: '三角形の対応', final: '合同からの結論' };

  // 理由ごとの解説（振り返り用）
  const REASON_EXPLAIN = {
    given: '仮定に書かれていることは、そのまま根拠に使えます。',
    common: '2つの三角形に共通な辺は、同じ長さです。',
    commonAngle: '2つの三角形に共通な角は、同じ大きさです。',
    vertical: '2本の直線が交わるとき、向かい合う角（対頂角）は等しくなります。',
    alternate: '平行線の錯角は等しくなります。',
    corresponding: '平行線の同位角は等しくなります。',
    correspondingSides: '合同な図形では、対応する辺の長さは等しくなります。',
    correspondingAngles: '合同な図形では、対応する角の大きさは等しくなります。',
  };
  // 理由の誤答の候補（もっともらしい順）
  const REASON_POOL = ['given', 'common', 'vertical', 'alternate', 'corresponding', 'commonAngle'];

  // 文字列から決まる疑似乱数（生成を毎回同じにする）
  function seeded(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return function () {
      h += 0x6D2B79F5;
      let t = h;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function shuffle(list, rnd) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function key(p, name) { return G().elementKey(p.figure, name); }
  function eqKeyOf(p, items) { return V().equationKey(key(p, items[0]), key(p, items[1])); }
  function triText(p) { return '△' + p.triangles[0].join('') + 'と△' + p.triangles[1].join(''); }
  // 図を使う問題の前置き：仮定（「仮定より」で答える問題に必要）と、2つの三角形
  function givenLines(p) { return ['仮定：' + p.given.join('、'), triText(p) + 'において']; }
  function reasonText(ev) { return ev.proofReason || PH.REASONS[ev.reason].proof; }
  function lastHint(p, id) {
    const h = p.hints && p.hints[id];
    return h && h.length ? h[h.length - 1].text : '';
  }

  // 等式の文字列（'AB=CD'）を要素キーの組に。図の上で計算できなければ null
  function inputKeys(p, value) {
    const v = PH.mathKeypad.parse(value);
    if (!v || v.kind === 'tri') return null;
    const pre = v.kind === 'ang' ? '∠' : '';
    try {
      return [key(p, pre + v.left), key(p, pre + v.right)];
    } catch (e) {
      return null;
    }
  }

  function choiceBlank(label, answerText, wrongTexts) {
    const choices = [{ id: 'a', text: answerText }].concat(wrongTexts.map(function (t, i) { return { id: 'w' + i, text: t }; }));
    return { label: label, choices: choices, answer: 'a' };
  }

  // ---- 各タイプの生成 ----------------------------------------------------------

  // タイプA：理由に合う等しい辺・角を答える（「△…と△…において、共通な辺だから ＿＿」）
  function equationQuestion(p, ev) {
    const shown = { reason: ev.reason, text: reasonText(ev), specific: !!ev.proofReason };
    // 同じ理由で言える根拠はどれも正解（仮定が2つあるときなど）
    const accepted = p.evidence.filter(function (e) { return PH.puzzleUtil.reasonAccepts(shown, e); });
    const acceptedEq = accepted.map(function (e) { return eqKeyOf(p, e.items); });
    const rnd = seeded(p.id + ev.id + ':eq');
    const wrong = shuffle(((p.puzzle && p.puzzle.distractors) || {}).equations || [], rnd).filter(function (label) {
      const items = label.split('＝');
      if (items.length !== 2) return false;
      const st = V().equationStatus(p, items.map(function (n) { return key(p, n); }));
      return st !== 'evidence' && st !== 'irrelevant' && acceptedEq.indexOf(eqKeyOf(p, items)) < 0;
    }).slice(0, 2);
    const kinds = accepted.map(function (e) { return G().isAngleName(e.items[0]) ? 'ang' : 'seg'; })
      .filter(function (k, i, a) { return a.indexOf(k) === i; });
    const easy = ev.reason === 'given' || ev.reason === 'common' || ev.reason === 'commonAngle';
    return {
      id: p.id + '-eq-' + ev.id, sourceId: p.id, category: 'eq', type: 'equation', typeLabel: '等しい辺・角',
      difficulty: easy ? 1 : 2, blanks: 1, figure: p.id, highlight: [],
      lines: givenLines(p),
      ask: shown.text + '、＿＿＿ に入る等式は？',
      choice: wrong.length === 2 ? { blanks: [choiceBlank('等式', ev.label, wrong)] } : null,
      input: {
        keypad: { kinds: kinds },
        check: function (value) {
          const ks = inputKeys(p, value);
          return !!ks && acceptedEq.indexOf(V().equationKey(ks[0], ks[1])) >= 0;
        },
        answerText: accepted.map(function (e) { return e.label; }).join('／'),
      },
      answerText: ev.label,
      explain: lastHint(p, ev.id) || REASON_EXPLAIN[ev.reason],
      signature: PH.congruenceText(p) + '|' + shown.text + '|' + ev.label,
    };
  }

  // 等式の理由の誤答（その等式に使っても正しくならない理由だけ）
  function wrongReasons(p, ev, count) {
    const keys = ev.items.map(function (n) { return key(p, n); });
    const pref = p.reasons.concat(((p.puzzle && p.puzzle.distractors) || {}).reasons || [], REASON_POOL);
    const out = [];
    pref.forEach(function (r) {
      if (out.indexOf(r) >= 0 || r === ev.reason || !PH.REASONS[r] || PH.REASONS[r].finalOnly) return;
      const st = V().checkEvidence(p, keys, r, []).status;
      if (st === 'correct' || st === 'irrelevant') return;
      out.push(r);
    });
    return out.slice(0, count).map(function (r) { return PH.REASONS[r].proof; });
  }

  // タイプB：等しい理由を答える
  function reasonQuestion(p, ev) {
    const wrong = wrongReasons(p, ev, 2);
    return {
      id: p.id + '-rs-' + ev.id, sourceId: p.id, category: 'reason', type: 'reason', typeLabel: '等しい理由',
      difficulty: ev.reason === 'given' || ev.reason === 'common' ? 1 : 2, blanks: 1, figure: p.id,
      highlight: ev.items.map(function (n) { return key(p, n); }),
      lines: givenLines(p),
      ask: ev.label + ' が等しい理由は？',
      choice: wrong.length === 2 ? { blanks: [choiceBlank('理由', reasonText(ev), wrong)] } : null,
      input: null,
      answerText: reasonText(ev),
      explain: REASON_EXPLAIN[ev.reason] + (ev.proofReason ? '（' + ev.proofReason + '）' : ''),
      signature: PH.congruenceText(p) + '|reason|' + ev.label,
    };
  }

  // タイプB（2〜3か所）：複数の等式の理由をまとめて答える（すべて正しければ1問正解）
  function reasonMultiQuestion(p, n) {
    const evs = p.evidence.slice(0, n);
    const blanks = evs.map(function (ev) { return choiceBlank(ev.label + ' の理由', reasonText(ev), wrongReasons(p, ev, 2)); });
    if (blanks.some(function (b) { return b.choices.length < 3; })) return null;
    return {
      id: p.id + '-rs' + n, sourceId: p.id, category: 'reason', type: 'reasonMulti', typeLabel: '等しい理由（' + n + 'か所）',
      difficulty: n === 2 ? 2 : 3, blanks: n, figure: p.id, highlight: [],
      lines: givenLines(p),
      ask: 'それぞれの等式が等しい理由は？',
      choice: { blanks: blanks }, input: null,
      answerText: evs.map(function (ev) { return ev.label + '：' + reasonText(ev); }).join('／'),
      explain: evs.map(function (ev) { return REASON_EXPLAIN[ev.reason]; }).filter(function (t, i, a) { return a.indexOf(t) === i; }).join(' '),
      signature: PH.congruenceText(p) + '|reason' + n + '|' + evs.map(function (e) { return e.label; }).join(','),
    };
  }

  // タイプC：3つの根拠から合同条件を答える
  function conditionQuestion(p) {
    const cond = V().deriveCondition(p, p.evidence);
    const order = PH.CONDITION_ORDER.slice();
    const wrong = order.filter(function (c) { return c !== cond; }).map(function (c) { return PH.CONDITIONS[c].label; });
    return {
      id: p.id + '-cond', sourceId: p.id, category: 'cond', type: 'condition', typeLabel: '合同条件',
      difficulty: 2, blanks: 1, figure: null, highlight: [],
      lines: [triText(p) + 'において'].concat(p.evidence.map(function (ev) { return ev.label; })),
      ask: 'これらから使える合同条件は？',
      choice: { blanks: [choiceBlank('合同条件', PH.CONDITIONS[cond].label, wrong)] }, input: null,
      answerText: PH.CONDITIONS[cond].label,
      explain: lastHint(p, 'congruence'),
      signature: PH.congruenceText(p) + '|cond|' + p.evidence.map(function (e) { return e.label; }).join(','),
    };
  }

  // 合同の式ごとの問題（同じ合同は1回だけ作る）
  function congruenceQuestions(p) {
    const out = [];
    const t1 = p.triangles[0], t2 = p.triangles[1];
    const cong = PH.congruenceText(p);
    const vxExplain = '合同の式 ' + cong + ' では、同じ位置にある頂点どうしが対応します。';
    // タイプD：対応する頂点（両方向）
    [[t1, t2], [t2, t1]].forEach(function (pair, dir) {
      pair[0].forEach(function (v, i) {
        const others = pair[1].filter(function (w) { return w !== pair[1][i]; });
        out.push({
          id: p.id + '-vx' + dir + i, sourceId: p.id, category: 'corr', type: 'vertex', typeLabel: '対応する頂点',
          difficulty: 1, blanks: 1, figure: null, highlight: [],
          lines: [cong + ' のとき'], ask: '頂点 ' + v + ' に対応する頂点は？',
          choice: { blanks: [choiceBlank('頂点', pair[1][i], others)] }, input: null,
          answerText: pair[1][i], explain: vxExplain,
          signature: cong + '|vx|' + dir + i,
        });
      });
    });
    // タイプD（2〜3か所）：対応する頂点をまとめて答える
    [2, 3].forEach(function (n) {
      const blanks = t1.slice(0, n).map(function (v, i) {
        return choiceBlank(v + ' に対応する頂点', t2[i], t2.filter(function (w) { return w !== t2[i]; }));
      });
      out.push({
        id: p.id + '-vxm' + n, sourceId: p.id, category: 'corr', type: 'vertexMulti', typeLabel: '対応する頂点（' + n + 'か所）',
        difficulty: n === 2 ? 2 : 3, blanks: n, figure: null, highlight: [],
        lines: [cong + ' のとき'], ask: 'それぞれに対応する頂点は？',
        choice: { blanks: blanks }, input: null,
        answerText: t1.slice(0, n).map(function (v, i) { return v + '↔' + t2[i]; }).join('、'), explain: vxExplain,
        signature: cong + '|vxm' + n,
      });
    });
    // タイプE：合同から等しい辺・角を答える（「△ABC≡△DEF より、AC＝＿＿」）
    const parts = [];
    [[0, 1], [1, 2], [0, 2]].forEach(function (ij) {
      parts.push({ kind: 'side', left: t1[ij[0]] + t1[ij[1]], right: t2[ij[0]] + t2[ij[1]],
        all: [[0, 1], [1, 2], [0, 2]].map(function (x) { return t2[x[0]] + t2[x[1]]; }) });
    });
    [0, 1, 2].forEach(function (i) {
      const j = (i + 1) % 3, k = (i + 2) % 3;
      parts.push({ kind: 'angle', left: '∠' + t1[j] + t1[i] + t1[k], right: '∠' + t2[j] + t2[i] + t2[k],
        all: [0, 1, 2].map(function (a) { return '∠' + t2[(a + 1) % 3] + t2[a] + t2[(a + 2) % 3]; }) });
    });
    parts.forEach(function (part, idx) {
      const lk = key(p, part.left), rk = key(p, part.right);
      if (lk === rk) return;                                      // 共通な辺・角は問わない
      const lm = V().measure(p.figure, part.left).value;
      // 誤答：もう一方の三角形のほかの辺（角）のうち、図の上で左辺と等しくないもの
      const wrong = part.all.filter(function (n) {
        if (key(p, n) === rk) return false;
        const m = V().measure(p.figure, n).value;
        return part.kind === 'side' ? Math.abs(m - lm) > Math.max(1, lm * 0.01) : Math.abs(m - lm) > 1;
      });
      out.push({
        id: p.id + '-pt' + idx, sourceId: p.id, category: 'final', type: 'part',
        typeLabel: part.kind === 'side' ? '合同から等しい辺' : '合同から等しい角',
        difficulty: 2, blanks: 1, figure: null, highlight: [],
        lines: [cong + ' より'], ask: part.left + '＝＿＿ に入るのは？',
        choice: wrong.length >= 2 ? { blanks: [choiceBlank(part.left + '＝', part.right, wrong.slice(0, 2))] } : null,
        input: {
          keypad: { fixedLeft: part.left },
          check: function (value) {
            const ks = inputKeys(p, value);
            return !!ks && ks[0] === lk && ks[1] === rk;
          },
          answerText: part.left + '＝' + part.right,
        },
        answerText: part.left + '＝' + part.right,
        explain: '合同な図形の対応する' + (part.kind === 'side' ? '辺' : '角') + 'は等しくなります。' + cong + ' で ' + part.left + ' と同じ位置にあるのは ' + part.right + ' です。',
        signature: cong + '|pt|' + part.left,
      });
    });
    return out;
  }

  // タイプF（STAGE 6）：結論を証明するために合同を示す三角形を、頂点の対応順に答える
  function triangleQuestion(p) {
    const t = p.triangles;
    const correct = '△' + t[0].join('') + 'と△' + t[1].join('');
    const wrong = (p.puzzle.distractors.triangles || []).slice(0, 2).map(function (s) {
      const tt = s.split('/');
      return '△' + tt[0] + 'と△' + tt[1];
    });
    return {
      id: p.id + '-tri', sourceId: p.id, category: 'corr', type: 'triangle', typeLabel: '証明する三角形',
      difficulty: 3, blanks: 1, figure: p.id, highlight: [],
      lines: ['仮定：' + p.given.join('、')],
      ask: p.conclusion + ' を証明するために合同を示す2つの三角形を、頂点の対応順に答えよう。',
      choice: wrong.length === 2 ? { blanks: [choiceBlank('三角形', correct, wrong)] } : null,
      input: {
        keypad: { triangle: true },
        check: function (value) {
          const v = PH.mathKeypad.parse(value);
          return !!v && v.kind === 'tri' && V().checkTriangles(p, v.left.split(''), v.right.split('')).ok;
        },
        answerText: correct,
      },
      answerText: correct,
      explain: lastHint(p, 'triangleSelection'),
      signature: 'tri|' + p.id,
    };
  }

  // STAGE 6：合同から結論を導く理由
  function finalReasonQuestion(p) {
    const answer = PH.finalReasonFor(p);
    const wrong = ['correspondingSides', 'correspondingAngles', 'given'].filter(function (r) { return r !== answer; })
      .map(function (r) { return PH.REASONS[r].proof; });
    return {
      id: p.id + '-fr', sourceId: p.id, category: 'final', type: 'finalReason', typeLabel: '結論を導く理由',
      difficulty: 2, blanks: 1, figure: null, highlight: [],
      lines: [PH.congruenceText(p) + ' が証明できた。'],
      ask: 'したがって ' + p.conclusion + ' と言える理由は？',
      choice: { blanks: [choiceBlank('理由', PH.REASONS[answer].proof, wrong)] }, input: null,
      answerText: PH.REASONS[answer].proof,
      explain: REASON_EXPLAIN[answer],
      signature: 'fr|' + p.id,
    };
  }

  // ---- 生成 ------------------------------------------------------------------

  /*
   * すべてのミニ問題（テンプレート）。同じ内容（図・三角形・問いが同じ）の問題は1つにまとめる。
   * 選択式の問題（choice）と記号入力の問題（input）の両方を持つものがある。どちらで出すかは出題時に決める。
   */
  function generate(problems) {
    const list = [];
    const seen = {};
    function add(q) {
      if (!q || seen[q.signature]) return;
      if (!q.choice && !q.input) return;
      seen[q.signature] = true;
      list.push(q);
    }
    (problems || PH.problems).forEach(function (p) {
      p.evidence.forEach(function (ev) {
        add(equationQuestion(p, ev));
        add(reasonQuestion(p, ev));
      });
      add(reasonMultiQuestion(p, 2));
      add(reasonMultiQuestion(p, 3));
      add(conditionQuestion(p));
      congruenceQuestions(p).forEach(add);
      if (PH.hasFinalStep(p)) {
        add(triangleQuestion(p));
        add(finalReasonQuestion(p));
      }
    });
    return list;
  }

  let cache = null;
  function all() {
    if (!cache) cache = generate(PH.problems);
    return cache;
  }

  // 出題する形（mode: 'choice' | 'input'）があるか
  function supports(q, mode) { return mode === 'input' ? !!q.input : !!q.choice; }

  PH.rankQuestions = {
    CATEGORIES: CATEGORIES,
    CATEGORY_LABEL: CATEGORY_LABEL,
    REASON_EXPLAIN: REASON_EXPLAIN,
    generate: generate,
    all: all,
    supports: supports,
    byId: function (id) { return all().find(function (q) { return q.id === id; }) || null; },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.rankQuestions;
})(typeof window !== 'undefined' ? window : globalThis);
