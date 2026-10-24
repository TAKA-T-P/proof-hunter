/*
 * rank-questions.js — 段位認定のミニ問題を、既存の問題データ（PH.problems）から生成する（DOMに依存しない）
 * どの問題も解答箇所は1つ（テンポを上げるため）。対応する頂点だけを問う問題は作らない（対応する辺・角・三角形は問う）。
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
 *     / theorem 定理・三段論法（Ver.0.7）/ right 直角三角形（Ver.0.8）/ para 平行四辺形（Ver.0.9。総合証明だけ）
 *     / quad 四角形の分類（Ver.1.0。総合証明だけ。type 'quadrilateralClassification'）
 *   requiredTopics（Ver.0.8）：解くのに必要な学習テーマ。元の問題から作るミニ問題は元の問題の topics（js/rank-tracks.js）、
 *     定理の確認問題のテンプレートはテンプレートに書いた topics。段位認定のコース（基本・総合）は、これで出題範囲を決める。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function V() { return PH.validation; }
  function G() { return PH.geometry; }

  const CATEGORIES = ['eq', 'reason', 'cond', 'corr', 'final', 'theorem', 'right', 'para', 'quad'];
  const CATEGORY_LABEL = { eq: '等しい辺・角', reason: '等しい理由', cond: '合同条件', corr: '三角形の対応', final: '合同からの結論', theorem: '定理・三段論法', right: '直角三角形', para: '平行四辺形', quad: '四角形の分類' };

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
    isoscelesBaseAngles: '二等辺三角形の底角は等しくなります。',
    equilateralSides: '正三角形の3辺はすべて等しくなります。',
    squareSides: '正方形の4辺はすべて等しくなります。',
    perpendicular: '垂直な2直線がつくる角は90°です。',
    squareAngle: '正方形の4つの角はすべて90°です。',
    parallelogramSides: '平行四辺形の対辺は等しくなります（平行四辺形だと分かっているときだけ使えます）。',
    parallelogramParallel: '平行四辺形の対辺は平行です（定義）。',
    parallelogramAngles: '平行四辺形の対角は等しくなります。',
    parallelogramDiagonals: '平行四辺形の対角線は、それぞれの中点で交わります。',
    alternateConverse: '錯角が等しいならば、2直線は平行です。',
    correspondingConverse: '同位角が等しいならば、2直線は平行です。',
    rhombusSides: 'ひし形の4辺はすべて等しくなります（ひし形だと分かっているときだけ使えます）。',
    rhombusAngles: 'ひし形は平行四辺形なので、対角は等しくなります。',
    midpoint: '中点で分けた2つの線分の長さは等しくなります。',
    construction: '作図で同じ半径の円をかいたので、その半径は等しくなります。',
    rectangleSides: '長方形の対辺は等しくなります（長方形は平行四辺形）。',
    rectangleAngles: '長方形の4つの角はすべて90°で等しくなります。',
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
  /*
   * 同じ内容の問題をまとめるための署名の先頭。従来の問題は合同の式（△POQ≡△POR など）でまとめていたので、そのまま。
   * あとから加えた問題で、ほかの問題と三角形の名前が同じになるもの（p48 と p29 の △POQ≡△POR）は rankKey で区別する
   */
  function sigPrefix(p) { return p.rankKey ? p.rankKey + '|' : ''; }
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

  // 2つの三角形の辺・角のキー（三角形の部分かどうかの判定用）
  function triangleParts(p) {
    const out = {};
    p.triangles.forEach(function (t) {
      [[0, 1], [1, 2], [0, 2]].forEach(function (ij) { out[G().segKey(t[ij[0]] + t[ij[1]])] = true; });
      [0, 1, 2].forEach(function (i) { out[key(p, '∠' + t[(i + 1) % 3] + t[i] + t[(i + 2) % 3])] = true; });
    });
    return out;
  }

  /*
   * タイプA：理由に合う等しい辺・角を答える（「△…と△…において、対頂角より ＿＿」）
   * 選択肢がなくても答えが1つに決まる問題だけを作る：その理由で言える、2つの三角形の辺・角どうしの等式が1つだけのとき。
   * （仮定が2つある問題の「仮定より」や、錯角が2組ある問題の「錯角より」は作らない。
   *   三角形の外の角どうし（例 p05 の ∠AOC＝∠BOD）は、「△ABOと△DCOにおいて」の答えにならないので数えない）
   */
  function equationQuestion(p, ev) {
    if (ev.fromStep) return null;          // 前のステップで導いた等式（理由は「③、④より」など）は、ここでは問わない
    if (ev.role === 'right') return null;  // 直角の確認は、直角三角形の問題（rightQuestions）で問う
    const shown = { reason: ev.reason, text: reasonText(ev), specific: !!ev.proofReason };
    const accepted = p.evidence.filter(function (e) { return PH.puzzleUtil.reasonAccepts(shown, e); });
    const parts = triangleParts(p);
    const extra = (p.extraTruths || []).filter(function (x) {
      return x.reason === ev.reason && x.items.every(function (n) { return parts[key(p, n)]; });
    });
    if (accepted.length + extra.length !== 1) return null;
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
      signature: sigPrefix(p) + PH.congruenceText(p) + '|' + shown.text + '|' + ev.label,
    };
  }

  // 等式の理由の誤答（その等式に使っても正しくならない理由だけ）
  function wrongReasons(p, ev, count) {
    const keys = ev.items.map(function (n) { return key(p, n); });
    const pref = p.reasons.concat(((p.puzzle && p.puzzle.distractors) || {}).reasons || [], REASON_POOL);
    const out = [];
    // 仮定に書かれた性質（垂直・正方形）から言える等式では、「仮定より」も正しいと受け取れるので誤答にしない
    const givenToo = ['perpendicular', 'squareAngle', 'squareSides'].indexOf(ev.reason) >= 0;
    pref.forEach(function (r) {
      if (out.indexOf(r) >= 0 || r === ev.reason || !PH.REASONS[r] || PH.REASONS[r].finalOnly || PH.REASONS[r].meta) return;
      if (givenToo && r === 'given') return;
      const st = V().checkEvidence(p, keys, r, []).status;
      if (st === 'correct' || st === 'irrelevant') return;
      out.push(r);
    });
    return out.slice(0, count).map(function (r) { return PH.REASONS[r].proof; });
  }

  // タイプB：等しい理由を答える
  function reasonQuestion(p, ev) {
    if (ev.fromStep) return null;
    const wrong = wrongReasons(p, ev, 2);
    return {
      id: p.id + '-rs-' + ev.id, sourceId: p.id, category: 'reason', type: 'reason', typeLabel: '等しい理由',
      difficulty: ev.reason === 'given' || ev.reason === 'common' ? 1 : 2, blanks: 1, figure: p.id,
      highlight: ev.items.map(function (n) { return key(p, n); }),
      lines: givenLines(p),
      ask: ev.role === 'right' ? PH.evidenceText(ev) + ' と言える理由は？' : ev.label + ' が等しい理由は？',
      choice: wrong.length === 2 ? { blanks: [choiceBlank('理由', reasonText(ev), wrong)] } : null,
      input: null,
      answerText: reasonText(ev),
      explain: REASON_EXPLAIN[ev.reason] + (ev.proofReason ? '（' + ev.proofReason + '）' : ''),
      signature: sigPrefix(p) + PH.congruenceText(p) + '|reason|' + ev.label,
    };
  }

  // タイプC：図と仮定・結論（合同）から、使える合同条件を答える（根拠は自分で見つける）
  function conditionQuestion(p) {
    const cond = V().deriveCondition(p, p.evidence);
    const order = PH.CONDITION_ORDER.slice();
    let wrong = order.filter(function (c) { return c !== cond; }).map(function (c) { return PH.CONDITIONS[c].label; });
    // 直角三角形の問題：3つの合同条件は、別の道すじで示せる場合もあるので誤答にしない（もう一方の直角三角形の条件と、合同条件ではない文）
    if (PH.CONDITIONS[cond].right) {
      wrong = [PH.CONDITIONS[cond === 'RHA' ? 'RHS' : 'RHA'].label, NOT_CONDITION];
    }
    const cong = PH.congruenceText(p);
    return {
      id: p.id + '-cond', sourceId: p.id, category: 'cond', type: 'condition', typeLabel: '合同条件',
      difficulty: 2, blanks: 1, figure: p.id, highlight: [],
      // 図には、仮定で与えられた等しい辺・角だけ印をつける（共通な辺・対頂角など、仮定以外の根拠には印をつけない）
      marks: givenMarks(p),
      lines: ['仮定：' + p.given.join('、'), '結論：' + cong],
      ask: cong + ' を証明するとき、使える合同条件は？',
      choice: { blanks: [choiceBlank('合同条件', PH.CONDITIONS[cond].label, wrong)] }, input: null,
      answerText: PH.CONDITIONS[cond].label,
      explain: p.evidence.map(function (ev) { return PH.evidenceText(ev); }).join('、') + ' から。' + lastHint(p, 'congruence'),
      signature: sigPrefix(p) + cong + '|cond|' + p.given.join(','),
    };
  }

  /*
   * 仮定で与えられた等しい辺・角の印（要素キー → 印）。
   *   仮定の文（「AB＝AC」「∠POQ＝∠POR」「∠ABC＝∠DEF＝90°」）と、理由が「仮定より」の根拠（「Mは辺BCの中点」→ BM＝CM など）。
   *   共通な辺・対頂角・錯角など、仮定以外から言える関係には印をつけない。印の本数は等式ごとに 1、2、3…（辺と角で別々）
   */
  function givenMarks(p) {
    const out = {};
    const used = {};
    const count = { seg: 0, ang: 0 };
    function add(items, right) {
      let keys;
      try { keys = items.map(function (n) { return key(p, n); }); } catch (e) { return; }
      const eq = keys.slice().sort().join('=');
      if (used[eq] || keys.some(function (k) { return out[k] != null; })) return;
      used[eq] = true;
      const kind = keys[0].slice(0, 3);
      const mark = right ? 'right' : ++count[kind];
      keys.forEach(function (k) { out[k] = mark; });
    }
    (p.given || []).forEach(function (g) {
      const text = String(g);
      const right = /＝90°$/.test(text);
      const items = text.replace(/＝90°$/, '').split('＝');
      if (items.length < 2) return;
      const ok = items.every(function (n) { return /^∠[A-Z]{3}$/.test(n); }) || items.every(function (n) { return /^[A-Z]{2}$/.test(n); });
      if (ok && (right || items.length === 2)) add(items, right);
    });
    p.evidence.forEach(function (ev) { if (ev.reason === 'given') add(ev.items, ev.role === 'right'); });
    return out;
  }

  // 合同の式ごとの問題（同じ合同は1回だけ作る）
  function congruenceQuestions(p) {
    const out = [];
    const t1 = p.triangles[0], t2 = p.triangles[1];
    const cong = PH.congruenceText(p);
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
        signature: sigPrefix(p) + cong + '|pt|' + part.left,
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
      ask: (PH.isQuadProblem(p) ? p.finalStep.label : p.conclusion) + ' を証明するために合同を示す2つの三角形を、頂点の対応順に答えよう。',
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
      ask: 'したがって ' + p.finalStep.label + ' と言える理由は？',
      choice: { blanks: [choiceBlank('理由', PH.REASONS[answer].proof, wrong)] }, input: null,
      answerText: PH.REASONS[answer].proof,
      explain: REASON_EXPLAIN[answer],
      signature: 'fr|' + p.id,
    };
  }

  // ---- Ver.0.7：定理・三段論法（多段階証明のステップから作る短い問題） ----------------------------

  function theoremQuestions(p) {
    const out = [];
    if (!PH.proofEngine || !PH.proofEngine.hasSteps(p)) return out;
    const fig = p.figure;
    const R = PH.proofRules;
    const near = function (a, b) { return Math.abs(V().measure(fig, a).value - V().measure(fig, b).value) < 0.5; };
    const eqCheck = function (items) {
      const want = items.map(function (n) { return key(p, n); });
      return function (value) {
        const ks = inputKeys(p, value);
        return !!ks && V().equationKey(ks[0], ks[1]) === V().equationKey(want[0], want[1]);
      };
    };
    PH.proofEngine.stepsOf(p, 'pre').concat(PH.proofEngine.stepsOf(p, 'post')).forEach(function (st) {
      if (st.type === 'theorem' && st.rule === 'isoscelesBaseAngles') {
        // 「AB＝ACのとき、等しい角は？」（二等辺三角形の底角）
        const apex = st.premise[0].split('').find(function (c) { return st.premise[1].indexOf(c) >= 0; });
        const b = st.premise[0].replace(apex, ''), c = st.premise[1].replace(apex, '');
        const A = '∠' + b + apex + c, B = '∠' + apex + b + c, C = '∠' + apex + c + b;
        const wrong = [A + '＝' + B, A + '＝' + C].filter(function (w) { const it = w.split('＝'); return !near(it[0], it[1]); });
        out.push({
          id: p.id + '-th-' + st.id, sourceId: p.id, category: 'theorem', type: 'isoscelesAngles', typeLabel: '二等辺三角形の底角',
          difficulty: 2, blanks: 1, figure: p.id, highlight: st.premise.map(function (n) { return key(p, n); }),
          lines: ['△' + apex + b + c + 'で、' + st.premiseLabel], ask: st.premiseLabel + ' のとき、等しい角は？',
          choice: wrong.length === 2 ? { blanks: [choiceBlank('等しい角', st.label, wrong)] } : null,
          input: { keypad: { kinds: ['ang'] }, check: eqCheck(st.items), answerText: st.label },
          answerText: st.label, explain: '二等辺三角形の底角は等しくなります。' + st.premiseLabel + ' の二等辺三角形の底角は ' + st.label.replace('＝', 'と') + ' です。',
          signature: 'th|' + p.id + '|' + st.label,
        });
        out.push({
          id: p.id + '-thr-' + st.id, sourceId: p.id, category: 'theorem', type: 'theoremReason', typeLabel: '定理の理由',
          difficulty: 1, blanks: 1, figure: p.id, highlight: st.items.map(function (n) { return key(p, n); }),
          lines: [st.premiseLabel + ' より、' + st.label], ask: 'その理由は？',
          choice: { blanks: [choiceBlank('理由', R.label(st.rule), R.RULE_DISTRACTORS[st.rule].slice(0, 2))] }, input: null,
          answerText: R.label(st.rule), explain: '2辺が等しい三角形（二等辺三角形）の底角は等しくなります。',
          signature: 'thr|' + p.id + '|' + st.label,
        });
      } else if (st.type === 'theorem' && st.rule === 'isoscelesConverse') {
        // 「∠DBC＝∠DCBのとき、△DBCはどんな三角形？」
        const t = st.triangle.split('');
        const apexAngle = '∠' + t[1] + t[0] + t[2];
        const deg = V().measure(fig, apexAngle).value;
        const wrong = ['正三角形', '直角三角形'].filter(function (w) { return w === '正三角形' ? Math.abs(deg - 60) > 1 : Math.abs(deg - 90) > 1; });
        if (wrong.length === 2) {
          out.push({
            id: p.id + '-thc-' + st.id, sourceId: p.id, category: 'theorem', type: 'isoscelesConverse', typeLabel: '二等辺三角形になる条件',
            difficulty: 2, blanks: 1, figure: p.id, highlight: st.premise.map(function (n) { return key(p, n); }),
            lines: [st.premiseLabel], ask: st.premiseLabel + ' のとき、△' + st.triangle + 'はどんな三角形？',
            choice: { blanks: [choiceBlank('三角形', '二等辺三角形', wrong)] }, input: null,
            answerText: '二等辺三角形', explain: '2つの角が等しい三角形は二等辺三角形です。',
            signature: 'thc|' + p.id,
          });
        }
      } else if (st.type === 'theorem' && st.rule === 'alternateAnglesParallel') {
        // 「∠ADB＝∠CBD（錯角）が証明できた。言える平行な2辺は？」（記号入力は AD∥BC）。カテゴリは平行四辺形（平行の推論）
        const PG = PH.parallelogram;
        const want = PG.factKey(fig, st.lines, 'parallel');
        out.push({
          id: p.id + '-ppv-' + st.id, sourceId: p.id, category: 'para', type: 'ppConverse', typeLabel: '平行を導く',
          difficulty: 2, blanks: 1, figure: p.id, highlight: st.premise.map(function (n) { return key(p, n); }),
          lines: [st.premiseLabel + '（錯角）が証明できた。'], ask: 'このことから言える、平行な2つの辺は？',
          choice: { blanks: [choiceBlank('平行な辺', st.label, [st.lines[0] + '∥' + otherLine(p, st.lines), st.lines[0] + '＝' + st.lines[1]])] },
          input: {
            keypad: { kinds: ['par'] },
            check: function (value) {
              const v = PH.mathKeypad.parse(value);
              return !!v && v.kind === 'par' && PG.factKey(fig, [v.left, v.right], 'parallel') === want;
            },
            answerText: st.label,
          },
          answerText: st.label, explain: '錯角が等しいならば、2直線は平行です（平行線の錯角は等しい、の逆）。' + st.premise.join('と') + ' は直線' + st.lines.join('と直線') + 'がつくる錯角です。',
          signature: 'ppv|' + p.id + '|' + st.id,
          requiredTopics: ['parallelConverse'],
        });
        out.push({
          id: p.id + '-ppvr-' + st.id, sourceId: p.id, category: 'para', type: 'ppReason', typeLabel: '平行といえる理由',
          difficulty: 2, blanks: 1, figure: p.id, highlight: st.premise.map(function (n) { return key(p, n); }),
          lines: [st.premiseLabel + ' が証明できた。'], ask: st.label + ' と言える理由は？',
          choice: { blanks: [choiceBlank('理由', R.label(st.rule), R.RULE_DISTRACTORS[st.rule].slice(0, 2))] }, input: null,
          answerText: R.label(st.rule), explain: '錯角が等しいならば、2直線は平行です。「平行線の錯角は等しい」は、平行だと分かってから使う逆の向きの推論です。',
          signature: 'ppvr|' + p.id + '|' + st.id,
          requiredTopics: ['parallelConverse'],
        });
      } else if (st.type === 'expression') {
        // 「△DCEは正三角形。∠ACE＝∠ACD＋∠DCE を、角の大きさを使って表すと？」
        //  誤答：定数角を取りちがえた式（60°⇔90°）と、符号を取りちがえた式
        const value = st.value;
        const swapped = /60°/.test(value) ? value.replace('60°', '90°') : value.replace('90°', '60°');
        const flipped = /＋/.test(value) ? value.replace('＋', '－') : value.replace('－', '＋');
        const known = st.note || (st.premiseLabel + 'だから、正三角形の1つの角は60°');
        out.push({
          id: p.id + '-ex-' + st.id, sourceId: p.id, category: 'theorem', type: 'expression',
          typeLabel: st.rule === 'triangleAngleSum' ? '三角形の内角の和' : '角の和・差',
          difficulty: 2, blanks: 1, figure: p.id, highlight: [],
          lines: [known], ask: st.target + '＝' + PH.angleExpr.format(st.parts) + ' を、角の大きさを使って表すと？',
          choice: { blanks: [choiceBlank(st.target + '＝', value, [swapped, flipped])] }, input: null,
          answerText: st.target + '＝' + value, explain: known + 'なので、' + st.label + ' です。',
          signature: 'ex|' + p.id + '|' + st.id,
        });
      } else if (st.type === 'compare') {
        // 「③ ∠ACE＝∠ACD＋60°、④ ∠BCD＝∠ACD＋60° のとき、等しい2つの角は？」
        const deps = st.dependsOn.map(function (d) { return p.proofSteps.find(function (x) { return x.id === d; }); });
        out.push({
          id: p.id + '-cmp-' + st.id, sourceId: p.id, category: 'theorem', type: 'compare', typeLabel: '式を比べる（三段論法）',
          difficulty: 2, blanks: 1, figure: null, highlight: [],
          lines: deps.map(function (d) { return d.target + '＝' + d.value; }), ask: 'この2つの式から、等しいと言える2つの角は？',
          choice: (st.distractors || []).length >= 2 ? { blanks: [choiceBlank('等しい角', st.label, st.distractors.slice(0, 2))] } : null,
          input: { keypad: { kinds: ['ang'] }, check: eqCheck(st.items), answerText: st.label },
          answerText: st.label, explain: '2つの式の右辺が同じ（' + deps[0].value + '）なので、左辺どうしが等しくなります（三段論法）。',
          signature: 'cmp|' + p.id + '|' + st.id,
        });
      }
    });
    if ((p.equilateral || []).length && out.some(function (q) { return q.type === 'expression'; })) {
      out.push({
        id: 'rule-eq60', sourceId: p.id, category: 'theorem', type: 'equilateral60', typeLabel: '正三角形の角',
        difficulty: 1, blanks: 1, figure: null, highlight: [], lines: [], ask: '正三角形の1つの角は何度？',
        choice: { blanks: [choiceBlank('角度', '60°', ['90°', '45°'])] }, input: null,
        answerText: '60°', explain: '正三角形の3つの角はすべて等しく、180°÷3＝60°です。', signature: 'rule|eq60',
        requiredTopics: ['equilateral'],
      });
    }
    if (out.some(function (q) { return q.type === 'compare'; })) {
      out.push({
        id: 'rule-syllogism', sourceId: p.id, category: 'theorem', type: 'syllogism', typeLabel: '三段論法',
        difficulty: 1, blanks: 1, figure: null, highlight: [], lines: ['∠A＝∠C＋60°', '∠B＝∠C＋60°'], ask: '2つの式の右辺が同じとき、何が言える？',
        choice: { blanks: [choiceBlank('言えること', '∠A＝∠B', ['∠A＝∠C', '∠B＝60°'])] }, input: null,
        answerText: '∠A＝∠B', explain: '同じ式に等しい2つの角は等しくなります（三段論法）。', signature: 'rule|syllogism',
        requiredTopics: ['angleExpressions'],
      });
    }
    return out;
  }

  // ---- Ver.0.8：直角三角形 --------------------------------------------------------------

  // 合同条件ではない文（直角三角形の合同条件を問う問題の誤答）
  const NOT_CONDITION = '3組の角がそれぞれ等しい';

  /*
   * 直角三角形の問題から作るミニ問題
   *   タイプB：斜辺はどれ？（「△ABDで∠BAD＝90°のとき、斜辺は？」）
   *   タイプC：直角の理由（「BD⊥ACのとき、∠BEC＝∠CDB＝90°と言える理由は？」）
   */
  function rightQuestions(p) {
    const out = [];
    const RT = PH.rightTriangle;
    if (!RT || !PH.isRightProblem(p)) return out;
    const r = RT.rightIndex(p);
    p.triangles.forEach(function (t, i) {
      const tri = '△' + t.join('');
      const V = t[r];
      const others = t.filter(function (_, k) { return k !== r; });
      const angle = '∠' + others[0] + V + others[1];
      const hyp = RT.hypotenuse(p, i);
      const legs = others.map(function (o) { return [V, o].sort().join(''); });
      out.push({
        id: p.id + '-hyp' + i, sourceId: p.id, category: 'right', type: 'hypotenuse', typeLabel: '斜辺はどれ？',
        difficulty: 1, blanks: 1, figure: p.id, highlight: [key(p, angle)], hypIndex: i,
        lines: [tri + 'で、' + angle + '＝90°'], ask: tri + ' の斜辺はどれ？',
        choice: { blanks: [choiceBlank('斜辺', hyp, legs)] }, input: null,
        answerText: hyp, explain: '斜辺は、直角に向かい合う辺です。' + tri + 'で直角は' + angle + 'なので、斜辺は' + hyp + 'です。',
        signature: 'hyp|' + p.id + '|' + t.slice().sort().join(''),
      });
    });
    const ev = RT.rightEvidence(p);
    if (ev && (ev.reason === 'perpendicular' || ev.reason === 'squareAngle')) {
      const premise = ev.reason === 'perpendicular'
        ? ev.items.map(function (n) { return RT.perpendicularFor(p, n).label; }).filter(function (x, i, a) { return a.indexOf(x) === i; }).join('、')
        : '四角形' + RT.squareFor(p, ev.items[0]) + 'は正方形';
      const wrong = ev.reason === 'perpendicular' ? ['正方形の角だから', '対頂角は等しいから'] : ['二等辺三角形の底角は等しいから', '対頂角は等しいから'];
      out.push({
        id: p.id + '-rr', sourceId: p.id, category: 'right', type: 'rightReason', typeLabel: '直角である理由',
        difficulty: 1, blanks: 1, figure: p.id, highlight: ev.items.map(function (n) { return key(p, n); }),
        lines: [premise], ask: PH.evidenceText(ev) + ' と言える理由は？',
        choice: { blanks: [choiceBlank('理由', PH.REASONS[ev.reason].proof, wrong)] }, input: null,
        answerText: PH.REASONS[ev.reason].proof, explain: REASON_EXPLAIN[ev.reason],
        signature: 'rr|' + p.id,
      });
    }
    return out;
  }

  /*
   * 直角三角形の合同条件を確かめるミニ問題（ルールのテンプレート。図を使わない）
   *   タイプA：斜辺と他の1辺 → 使える合同条件は？　タイプD：斜辺と1つの鋭角 → 使える合同条件は？
   *   タイプE：RHS（RHA）で示すには、あと何が必要？　最初に確かめること：2つの三角形が直角三角形であること
   */
  function rightTemplates() {
    const C = PH.CONDITIONS;
    const t = function (o) {
      return Object.assign({ sourceId: null, category: 'right', difficulty: 1, blanks: 1, figure: null, highlight: [], lines: [], input: null }, o);
    };
    return [
      t({
        id: 'rule-rhs', type: 'rightCondition', typeLabel: '直角三角形の合同条件', cond: 'RHS',
        lines: ['2つの直角三角形で、斜辺と他の1辺がそれぞれ等しい。'], ask: '使える合同条件は？',
        choice: { blanks: [choiceBlank('合同条件', C.RHS.label, [C.RHA.label, C.SAS.label])] },
        answerText: C.RHS.label, explain: '斜辺と、斜辺ではないもう1組の辺（他の1辺）が等しいので、「' + C.RHS.label + '」です。',
        signature: 'rule|rhs', requiredTopics: ['rightTriangle', 'rightTriangleRHS'],
      }),
      t({
        id: 'rule-rha', type: 'rightCondition', typeLabel: '直角三角形の合同条件', cond: 'RHA',
        lines: ['2つの直角三角形で、斜辺と1つの鋭角がそれぞれ等しい。'], ask: '使える合同条件は？',
        choice: { blanks: [choiceBlank('合同条件', C.RHA.label, [C.RHS.label, C.ASA.label])] },
        answerText: C.RHA.label, explain: '斜辺と、直角ではない角（鋭角）が1つ等しいので、「' + C.RHA.label + '」です。',
        signature: 'rule|rha', requiredTopics: ['rightTriangle', 'rightTriangleRHA'],
      }),
      t({
        id: 'rule-need-rhs', type: 'rightNeed', typeLabel: 'あと何が必要？', difficulty: 2,
        lines: ['2つの直角三角形で、斜辺が等しい。'], ask: '「斜辺と他の1辺」の合同条件で示すには、あと何が等しければよい？',
        choice: { blanks: [choiceBlank('必要なこと', '対応する他の1辺', ['対応する1つの鋭角', '直角'])] },
        answerText: '対応する他の1辺', explain: '「' + C.RHS.label + '」なので、斜辺のほかに、対応する他の1辺が等しければよいです。',
        signature: 'rule|need-rhs', requiredTopics: ['rightTriangle', 'rightTriangleRHS'],
      }),
      t({
        id: 'rule-need-rha', type: 'rightNeed', typeLabel: 'あと何が必要？', difficulty: 2,
        lines: ['2つの直角三角形で、斜辺が等しい。'], ask: '「斜辺と1つの鋭角」の合同条件で示すには、あと何が等しければよい？',
        choice: { blanks: [choiceBlank('必要なこと', '対応する1つの鋭角', ['対応する他の1辺', '直角'])] },
        answerText: '対応する1つの鋭角', explain: '「' + C.RHA.label + '」なので、斜辺のほかに、対応する1つの鋭角が等しければよいです。',
        signature: 'rule|need-rha', requiredTopics: ['rightTriangle', 'rightTriangleRHA'],
      }),
      t({
        id: 'rule-right-first', type: 'rightFirst', typeLabel: '直角三角形の合同', difficulty: 1,
        lines: [], ask: '直角三角形の合同条件を使う前に、まず何を確かめる？',
        choice: { blanks: [choiceBlank('確かめること', '2つの三角形が直角三角形であること', ['2つの三角形の面積が等しいこと', '3組の角がそれぞれ等しいこと'])] },
        answerText: '2つの三角形が直角三角形であること', explain: '直角三角形の合同条件は、2つの三角形がどちらも直角三角形のときだけ使えます。図で直角に見えるだけでなく、仮定や垂直・正方形の角などから90°を確かめます。',
        signature: 'rule|right-first', requiredTopics: ['rightTriangle'],
      }),
      t({
        id: 'rule-hyp-def', type: 'rightHypDef', typeLabel: '斜辺とは？',
        lines: [], ask: '直角三角形の斜辺は、どの辺？',
        choice: { blanks: [choiceBlank('斜辺', '直角に向かい合う辺', ['直角をはさむ辺', 'いちばん短い辺'])] },
        answerText: '直角に向かい合う辺', explain: '直角三角形で、直角に向かい合う辺を斜辺といいます（3つの辺の中でいちばん長い辺）。',
        signature: 'rule|hyp-def', requiredTopics: ['rightTriangle'],
      }),
    ];
  }

  // ---- Ver.0.9：平行四辺形（総合証明だけ。カテゴリ「平行四辺形」） ------------------------------------

  const PPC = function () { return PH.PARALLELOGRAM_CONDITIONS; };
  // 成立条件の誤答の候補（取りちがえやすい順）
  const PP_CONFUSE = {
    PP_PARALLEL_PAIRS: ['PP_PARALLEL_EQUAL_PAIR', 'PP_EQUAL_SIDES'],
    PP_EQUAL_SIDES: ['PP_PARALLEL_EQUAL_PAIR', 'PP_EQUAL_ANGLES'],
    PP_EQUAL_ANGLES: ['PP_EQUAL_SIDES', 'PP_BISECT_DIAGONALS'],
    PP_BISECT_DIAGONALS: ['PP_EQUAL_SIDES', 'PP_PARALLEL_PAIRS'],
    PP_PARALLEL_EQUAL_PAIR: ['PP_PARALLEL_PAIRS', 'PP_EQUAL_SIDES'],
  };

  // 平行四辺形の根拠の印（等しい辺・角の印と、平行の矢印）
  function quadMarks(p, evs) {
    const marks = {};
    const par = [];
    evs.forEach(function (ev) {
      if (ev.rel === 'parallel') ev.items.forEach(function (s) { par.push([s[0], s[1], ev.mark || 1]); });
      else ev.items.forEach(function (n) { marks[key(p, n)] = ev.mark; });
    });
    return { marks: marks, parallelMarks: par };
  }

  /*
   * 平行四辺形の問題から作るミニ問題
   *   タイプA：根拠（2つの関係）から、使える成立条件を答える（図に根拠の印）
   *   タイプB：対角線の条件（成立条件が④の問題）「…のとき、どんな四角形？」
   *   等しい（平行な）理由：平行を導く理由（錯角が等しいから）・仮定の平行四辺形の性質
   *   平行の推論：合同から導いた錯角の等しさから、平行な2辺を答える（記号入力 AD∥BC）
   */
  function parallelogramQuestions(p) {
    const out = [];
    const PG = PH.parallelogram;
    if (!PG || !PH.isQuadProblem(p) || PH.quadType(p) !== 'parallelogram') return out;
    const pz = p.parallelogram;
    const qname = PH.quadrilateral.name(p.targetQuadrilateral);
    const evs = pz.evidence;
    const labels = evs.map(function (ev) { return ev.label; }).join('、');
    const m = quadMarks(p, evs);
    const cond = pz.condition;
    const wrong = PP_CONFUSE[cond].filter(function (c) { return (pz.alternatives || []).indexOf(c) < 0; });
    if (wrong.length < 2) wrong.push(Object.keys(PPC()).find(function (c) { return c !== cond && wrong.indexOf(c) < 0 && (pz.alternatives || []).indexOf(c) < 0; }));
    out.push({
      id: p.id + '-ppc', sourceId: p.id, category: 'para', type: 'ppCondition', typeLabel: '平行四辺形になるための条件',
      difficulty: 2, blanks: 1, figure: p.id, highlight: [], marks: m.marks, parallelMarks: m.parallelMarks,
      lines: [qname + 'で、' + labels + 'が分かった。'], ask: qname + 'が平行四辺形であることを示すのに使える条件は？',
      choice: { blanks: [choiceBlank('成立条件', PPC()[cond].label, wrong.slice(0, 2).map(function (c) { return PPC()[c].label; }))] }, input: null,
      answerText: PPC()[cond].label,
      explain: labels + ' は、' + PPC()[cond].label + 'ことを表しています。',
      signature: 'ppc|' + p.id,
    });
    if (cond === 'PP_BISECT_DIAGONALS') {
      const O = PH.quadrilateral.diagonalPoint(p.figure, p.targetQuadrilateral);
      const d = PH.quadrilateral.diagonals(p.targetQuadrilateral);
      out.push({
        id: p.id + '-ppd', sourceId: p.id, category: 'para', type: 'ppDiagonal', typeLabel: '対角線の条件',
        difficulty: 1, blanks: 1, figure: p.id, highlight: [], marks: m.marks, parallelMarks: m.parallelMarks,
        lines: [qname + 'の対角線' + d[0] + 'と' + d[1] + 'が' + O + 'で交わる。' + labels + 'のとき'], ask: qname + 'は必ずどんな四角形といえる？',
        choice: { blanks: [choiceBlank('四角形', '平行四辺形', ['ひし形', '長方形'])] }, input: null,
        answerText: '平行四辺形', explain: '対角線がそれぞれの中点で交わる四角形は平行四辺形です（ひし形・長方形になるとは限りません）。',
        signature: 'ppd|' + p.id,
      });
    }
    evs.forEach(function (ev) {
      if (ev.reason === 'given' || ev.fromStep) return;
      const rr = PH.REASONS[ev.reason];
      const wrongs = PG.CONVERSE_REASONS[ev.reason]
        ? ['平行線の錯角は等しいから', '平行四辺形の対辺は平行だから']
        : ev.fromFinal ? ['平行四辺形の対辺は等しいから', '仮定より']
        : ev.reason === 'parallelogramParallel' ? ['平行四辺形の対辺は等しいから', '錯角が等しいから']
        : ['平行四辺形の対辺は等しいから', '仮定より'];
      out.push({
        id: p.id + '-ppr-' + ev.id, sourceId: p.id, category: 'para', type: 'ppReason', typeLabel: ev.rel === 'parallel' ? '平行といえる理由' : '等しい理由',
        difficulty: 2, blanks: 1, figure: p.id, highlight: ev.items.map(function (n) { return key(p, n); }),
        lines: ['仮定：' + p.given.join('、')].concat(
          ev.via && PG.rightVia(p, ev) ? [ev.via.join('＝') + '＝90°'] : ev.via && p.finalStep ? [p.finalStep.label + ' が証明できた。'] : [],
          ev.fromFinal ? [PH.congruenceText(p) + ' が証明できた。'] : []),
        ask: ev.label + ' と言える理由は？',
        choice: { blanks: [choiceBlank('理由', rr.proof, wrongs)] }, input: null,
        answerText: rr.proof,
        explain: PG.CONVERSE_REASONS[ev.reason]
          ? ev.via.join('と') + ' は、直線' + ev.items.join('と直線') + 'がつくる' + (ev.reason === 'alternateConverse' ? '錯角' : '同位角') + 'です。それが等しいので、2直線は平行です（平行線の性質の逆）。'
          : ev.fromFinal ? '合同な図形の対応する辺は等しくなります（' + PH.congruenceText(p) + '）。'
          : '仮定で平行四辺形と分かっている四角形の性質です。',
        signature: 'ppr|' + p.id + '|' + ev.id,
      });
      if (ev.via) {
        // 平行の推論：等しい錯角から、平行な2辺を答える（記号入力は AD∥BC）
        const want = PG.factKey(p.figure, ev.items, 'parallel');
        out.push({
          id: p.id + '-ppv-' + ev.id, sourceId: p.id, category: 'para', type: 'ppConverse', typeLabel: '平行を導く',
          difficulty: 2, blanks: 1, figure: p.id, highlight: ev.via.map(function (n) { return key(p, n); }),
          lines: [ev.via.join('＝') + (PG.rightVia(p, ev) ? '＝90°' : '') + '（' + (ev.reason === 'alternateConverse' ? '錯角' : '同位角') + '）' +
            (PG.rightVia(p, ev) ? 'である。' : 'が証明できた。')], ask: 'このことから言える、平行な2つの辺は？',
          choice: { blanks: [choiceBlank('平行な辺', ev.label, [ev.items[0] + '∥' + otherSide(p, ev.items), ev.items[0] + '＝' + ev.items[1]])] },
          input: {
            keypad: { kinds: ['par'] },
            check: function (value) {
              const v = PH.mathKeypad.parse(value);
              return !!v && v.kind === 'par' && PG.factKey(p.figure, [v.left, v.right], 'parallel') === want;
            },
            answerText: ev.label,
          },
          answerText: ev.label, explain: '錯角（同位角）が等しいならば、2直線は平行です。' + ev.via.join('と') + ' は直線' + ev.items.join('と直線') + 'がつくる角です。',
          signature: 'ppv|' + p.id + '|' + ev.id,
          requiredTopics: ['parallelConverse', 'parallelogramConditions'],
        });
      }
    });
    return out;
  }

  // 平行の誤答（四角形がない問題）：図の辺のうち、items[0] と端点を共有するほかの辺（AD∥BC → AD∥AB）
  function otherLine(p, items) {
    const segs = G().getElements(p.figure).segments.map(function (s) { return s.name; });
    const norm = function (s) { return s.split('').sort().join(''); };
    return segs.find(function (s) { return norm(s) !== norm(items[0]) && norm(s) !== norm(items[1]) && s.indexOf(items[0][0]) >= 0; }) || segs[0];
  }

  // 平行の誤答：同じ四角形の、もう1組の対辺のうち items[1] でない方（AD∥BC → AD∥AB のような隣の辺）
  function otherSide(p, items) {
    const sides = PH.quadrilateral.sides(p.targetQuadrilateral);
    const norm = function (s) { return s.split('').sort().join(''); };
    return sides.find(function (s) { return norm(s) !== norm(items[0]) && norm(s) !== norm(items[1]) && s.indexOf(items[0][0]) >= 0; }) || sides[0];
  }

  /*
   * 平行四辺形のルールのミニ問題（図を使うものは p31・p33 の四角形ABCDの図）
   *   タイプA：成立条件から、どんな四角形か（5つ）
   *   タイプC：1組の対辺 「AB∥DC に加えて、どの条件があれば平行四辺形？」（記号入力 AB＝DC）／「AB＝DC に加えて？」（AB∥DC）
   *   タイプD：平行四辺形の性質 「ABと長さが等しい辺は？」「∠DABと等しい角は？」「AOと等しいのは？」「ADと平行な辺は？」
   *   タイプE：成立条件の正誤（教材の練習プリントの5つ。成り立つかは deriveParallelogramCondition で判定）
   *   性質と条件の区別
   */
  function parallelogramTemplates() {
    const out = [];
    const PG = PH.parallelogram;
    const p31 = PH.getProblem('p31'), p33 = PH.getProblem('p33');
    if (!PG || !p31 || !p33) return out;
    const C = PPC();
    const t = function (o) {
      return Object.assign({ category: 'para', difficulty: 1, blanks: 1, figure: null, highlight: [], lines: [], input: null }, o);
    };
    const shapes = ['平行四辺形', 'ひし形', '長方形'];
    PH.PARALLELOGRAM_CONDITION_ORDER.forEach(function (c) {
      out.push(t({
        id: 'rule-pp-' + c, sourceId: null, type: 'ppKind', typeLabel: '平行四辺形になるための条件',
        lines: [C[c].label + (c === 'PP_PARALLEL_PAIRS' ? 'な' : '') + '四角形'], ask: 'この四角形は、必ず何といえる？',
        choice: { blanks: [choiceBlank('四角形', shapes[0], shapes.slice(1))] },
        answerText: '平行四辺形', explain: '「' + C[c].label + '」は、平行四辺形になるための条件の1つです（ひし形・長方形になるとは限りません）。',
        signature: 'rule|pp|' + c, requiredTopics: c === 'PP_BISECT_DIAGONALS' ? ['parallelogramConditions', 'diagonalBisector'] : ['parallelogramConditions'],
      }));
    });
    // タイプC：1組の対辺（平行のあとに等しさ／等しさのあとに平行）
    const eqCheck = function (p, items, rel) {
      const want = PG.factKey(p.figure, items, rel);
      return function (value) {
        const v = PH.mathKeypad.parse(value);
        if (!v || v.kind === 'tri') return false;
        const r = v.kind === 'par' ? 'parallel' : 'eq';
        const pre = v.kind === 'ang' ? '∠' : '';
        return PG.factKey(p.figure, [pre + v.left, pre + v.right], r) === want;
      };
    };
    [['AB', 'DC', 'AD', 'BC'], ['AD', 'BC', 'AB', 'DC']].forEach(function (s) {
      out.push(t({
        id: 'rule-pp-need-eq-' + s[0], sourceId: 'p31', type: 'ppNeed', typeLabel: '1組の対辺', difficulty: 2, figure: 'p31',
        lines: ['四角形ABCDで、' + s[0] + '∥' + s[1] + '。'], ask: 'これに加えて、どの条件があれば平行四辺形といえる？',
        choice: { blanks: [choiceBlank('条件', s[0] + '＝' + s[1], [s[2] + '＝' + s[3], 'AC＝BD'])] },
        input: { keypad: { kinds: ['seg', 'par'] }, check: eqCheck(p31, [s[0], s[1]], 'eq'), answerText: s[0] + '＝' + s[1] },
        answerText: s[0] + '＝' + s[1], explain: '平行な1組の対辺 ' + s[0] + '、' + s[1] + ' の長さが等しければ、「' + C.PP_PARALLEL_EQUAL_PAIR.label + '」が使えます。' + s[2] + '＝' + s[3] + ' では、平行な辺と等しい辺が別の組になるので、平行四辺形とはいえません（等脚台形の場合があります）。',
        signature: 'rule|pp-need-eq|' + s[0], requiredTopics: ['parallelogramConditions'],
      }));
    });
    out.push(t({
      id: 'rule-pp-need-par', sourceId: 'p31', type: 'ppNeed', typeLabel: '1組の対辺', difficulty: 2, figure: 'p31',
      lines: ['四角形ABCDで、AB＝DC。'], ask: '「1組の対辺が平行で、その長さが等しい」を使うには、あと何が必要？',
      choice: { blanks: [choiceBlank('必要なこと', 'AB∥DC', ['AD∥BC', 'AD＝BC'])] },
      input: { keypad: { kinds: ['par', 'seg'] }, check: eqCheck(p31, ['AB', 'DC'], 'parallel'), answerText: 'AB∥DC' },
      answerText: 'AB∥DC', explain: '長さの等しい対辺 AB、DC が平行であることが必要です（同じ1組の対辺）。',
      signature: 'rule|pp-need-par', requiredTopics: ['parallelogramConditions'],
    }));
    // タイプD：平行四辺形の性質
    [
      { id: 'side', ask: 'ABと長さが等しい辺は？', left: 'AB', ans: 'CD', wrong: ['BC', 'AD'], rel: 'eq', p: p31, fig: 'p31' },
      { id: 'angle', ask: '∠DABと大きさが等しい角は？', left: '∠DAB', ans: '∠BCD', wrong: ['∠ABC', '∠CDA'], rel: 'eq', p: p31, fig: 'p31' },
      { id: 'diag', ask: '対角線の交点をOとするとき、AOと長さが等しいのは？', left: 'AO', ans: 'CO', wrong: ['BO', 'DO'], rel: 'eq', p: p33, fig: 'p33', topics: ['parallelogramProperties', 'diagonalBisector'] },
      { id: 'par', ask: 'ADと平行な辺は？', left: 'AD', ans: 'BC', wrong: ['AB', 'CD'], rel: 'parallel', p: p31, fig: 'p31' },
    ].forEach(function (d) {
      const sep = d.rel === 'parallel' ? '∥' : '＝';
      out.push(t({
        id: 'rule-ppp-' + d.id, sourceId: d.fig, type: 'ppProperty', typeLabel: '平行四辺形の性質', figure: d.fig,
        lines: ['四角形ABCDは平行四辺形。'], ask: d.ask,
        choice: { blanks: [choiceBlank(d.left + sep, d.ans, d.wrong)] },
        input: d.rel === 'eq' ? { keypad: { fixedLeft: d.left }, check: eqCheck(d.p, [d.left, d.ans], 'eq'), answerText: d.left + '＝' + d.ans } : null,
        answerText: d.left + sep + d.ans,
        explain: { side: '平行四辺形の対辺は等しい（AB＝CD、AD＝BC）。', angle: '平行四辺形の対角は等しい（∠A＝∠C、∠B＝∠D）。',
          diag: '平行四辺形の対角線はそれぞれの中点で交わる（AO＝CO、BO＝DO）。', par: '平行四辺形の対辺は平行（AB∥DC、AD∥BC）。' }[d.id],
        signature: 'rule|ppp|' + d.id, requiredTopics: d.topics || ['parallelogramProperties'],
      }));
    });
    // タイプE：成立条件の正誤（教材「証明練習プリント」平行四辺形④）
    const fig = p31.figure;
    [
      ['AD＝BC', 'AB∥DC'], ['AD＝BC', 'AD∥BC'], ['∠DAB＝∠BCD', '∠ABC＝∠CDA'], ['AB＝AD', 'CB＝CD'], ['AB＝DC', 'AD＝BC'],
    ].forEach(function (pair, i) {
      const facts = pair.map(function (s) { return PG.parseFact(s); });
      const r = PG.deriveParallelogramCondition({ figure: fig, vertices: ['A', 'B', 'C', 'D'] }, facts);
      const no = 'いえない';
      const yes = function (c) { return 'いえる（' + C[c].label + '）'; };
      const answer = r ? yes(r.condition) : no;
      const wrong = r ? [no, yes(PP_CONFUSE[r.condition][0])] : [yes('PP_PARALLEL_EQUAL_PAIR'), yes('PP_EQUAL_SIDES')];
      out.push(t({
        id: 'rule-pp-tf' + (i + 1), sourceId: null, type: 'ppTruth', typeLabel: '成立条件の正誤', difficulty: 2,
        lines: ['四角形ABCDで、' + pair.join('、') + '。'], ask: '必ず平行四辺形といえる？',
        choice: { blanks: [choiceBlank('答え', answer, wrong)] },
        answerText: answer,
        explain: r ? '「' + C[r.condition].label + '」から平行四辺形といえます。'
          : '成立条件にあてはまらないので、必ず平行四辺形とはいえません。' + (i === 0 ? '平行な辺（AB、DC）と等しい辺（AD、BC）が別の組の対辺です（等脚台形の場合がある）。' : '隣り合う辺が等しいだけです（たこ形の場合がある）。'),
        signature: 'rule|pp-tf|' + i, requiredTopics: ['parallelogramConditions'],
      }));
    });
    out.push(t({
      id: 'rule-pp-prop-cond', sourceId: null, type: 'ppDistinguish', typeLabel: '性質と条件', difficulty: 2,
      lines: ['「平行四辺形ならば、2組の対辺はそれぞれ等しい」'], ask: 'これは、どちらを表している？',
      choice: { blanks: [choiceBlank('答え', '平行四辺形の性質', ['平行四辺形になるための条件', '平行四辺形の定義'])] },
      answerText: '平行四辺形の性質',
      explain: '「平行四辺形ならば〜」は性質（平行四辺形だと分かってから使える）。「2組の対辺がそれぞれ等しい四角形は平行四辺形」は、平行四辺形になるための条件です。',
      signature: 'rule|pp-prop-cond', requiredTopics: ['parallelogramProperties', 'parallelogramConditions'],
    }));
    return out;
  }

  // ---- Ver.1.0：四角形の分類（総合証明だけ。カテゴリ「四角形の分類」） ------------------------------------

  /*
   * 条件から、必ずいえる最も特別な四角形の名前を答える（type 'quadrilateralClassification'）。
   * 正解は js/special-quadrilaterals.js の分類ルール（成立条件と包含関係）から求める（問題ごとに正解を書かない）。
   *   前提の種類（平行四辺形・ひし形・長方形、または ただの四角形）と、性質の記号（atoms）の組から、
   *   classify で最も特別な種類を求め、前提より特別になる（新しく言える）組だけを出題する。
   *   選択肢は ひし形・長方形・正方形（ただの四角形が前提のときは 平行四辺形 もふくむ）の3つ。正解は1つに決まる
   *   （ほかの選択肢は「この条件だけでは必ずそうなるとはいえない」か「より一般的な分類」）。
   * 生成元の問題：p44（AB＝AD）・p45（∠A＝90°）と、成立条件の表
   */
  const QC_ATOM_TEXT = {
    adjacentSidesEqual: ['AB＝AD', 'AB＝BC'],
    oneRightAngle: ['∠A＝90°', '∠B＝90°'],
    diagonalsEqual: ['AC＝BD'],
    diagonalsPerpendicular: ['AC⊥BD'],
    allSidesEqual: ['AB＝BC＝CD＝DA'],
    allAnglesEqual: ['∠A＝∠B＝∠C＝∠D'],
  };
  // 問題で証明した、性質の言いかえ（平行四辺形が前提。今はなし）
  const QC_DERIVED = {};
  const QC_CASES = [
    { base: 'parallelogram', atoms: ['adjacentSidesEqual'], v: 0, source: 'p44' },
    { base: 'parallelogram', atoms: ['adjacentSidesEqual'], v: 1 },
    { base: 'parallelogram', atoms: ['diagonalsPerpendicular'] },
    { base: 'parallelogram', atoms: ['oneRightAngle'], v: 0, source: 'p45' },
    { base: 'parallelogram', atoms: ['oneRightAngle'], v: 1 },
    { base: 'parallelogram', atoms: ['diagonalsEqual'] },
    { base: 'parallelogram', atoms: ['adjacentSidesEqual', 'oneRightAngle'] },
    { base: 'parallelogram', atoms: ['diagonalsEqual', 'diagonalsPerpendicular'] },
    { base: 'rectangle', atoms: ['adjacentSidesEqual'], v: 1 },
    { base: 'rectangle', atoms: ['diagonalsPerpendicular'] },
    { base: 'rhombus', atoms: ['oneRightAngle'], v: 0 },
    { base: 'rhombus', atoms: ['diagonalsEqual'] },
    { base: null, atoms: ['allSidesEqual'] },
    { base: null, atoms: ['allAnglesEqual'] },
    { base: null, atoms: ['allSidesEqual', 'allAnglesEqual'] },
  ];
  const QC_TOPIC = { parallelogram: 'parallelogramConditions', rhombus: 'rhombus', rectangle: 'rectangle', square: 'square' };

  // 1つの組から分類の問題を作る（新しく言える種類がなければ null）
  function classificationQuestion(c, i) {
    const S = PH.specialQuad;
    const atoms = [];
    const notes = [];
    c.atoms.forEach(function (a) {
      const d = QC_DERIVED[a];
      if (d) { atoms.push(d.gives); notes.push(d.note); } else atoms.push(a);
    });
    const types = S.guaranteedTypes(c.base, atoms);
    const answer = S.classify(c.base, atoms);
    if (!answer || (c.base && !S.isA(answer, c.base)) || answer === c.base) return null;
    if (c.base && S.implied(c.base).indexOf(answer) >= 0) return null;
    // 選択肢：正解と、正解でない種類2つ（ただの四角形の前提では、平行四辺形もふくめて選ぶ）
    const names = c.base ? ['rhombus', 'rectangle', 'square'] : ['parallelogram', 'rhombus', 'rectangle', 'square'];
    const others = names.filter(function (t) { return t !== answer; });
    // 必ずはいえない種類（guaranteed にない）を優先し、足りなければより一般的な種類
    const notSure = others.filter(function (t) { return types.indexOf(t) < 0; });
    const general = others.filter(function (t) { return types.indexOf(t) >= 0; });
    const wrong = notSure.concat(general).slice(0, 2);
    const conds = c.atoms.map(function (a) { return QC_ATOM_TEXT[a][c.v || 0] || QC_ATOM_TEXT[a][0]; });
    const baseText = c.base ? S.typeName(c.base) + 'ABCD' : '四角形ABCD';
    // 解説：使える成立条件（1回で言えるもの）。正方形は、ひし形かつ長方形
    const direct = S.conditionsFor(c.base, atoms, answer);
    let explain;
    if (direct.length) explain = '「' + S.CONDITIONS[direct[0]].label + '」ので、' + S.typeName(answer) + 'です。';
    else {
      const rh = S.conditionsFor(c.base, atoms, 'rhombus'), re = S.conditionsFor(c.base, atoms, 'rectangle');
      explain = (rh.length ? '「' + S.CONDITIONS[rh[0]].label + '」のでひし形、' : 'ひし形でもあり、') +
        (re.length ? '「' + S.CONDITIONS[re[0]].label + '」ので長方形。' : '長方形でもある。') + 'ひし形でも長方形でもあるので正方形です。';
    }
    if (notes.length) explain = notes.join('。') + '。' + explain;
    const wrongNote = wrong.map(function (t) {
      return types.indexOf(t) >= 0 ? S.typeName(t) + 'でもあるけれど、' + S.typeName(answer) + 'はそれより特別な分類です'
        : S.typeName(t) + 'は、この条件だけでは必ずそうなるとはいえません';
    }).join('。') + '。';
    const topics = ['quadrilateralClassification', QC_TOPIC[answer]];
    if (c.base && QC_TOPIC[c.base] && topics.indexOf(QC_TOPIC[c.base]) < 0) topics.push(QC_TOPIC[c.base]);
    if (answer === 'square') ['rhombus', 'rectangle'].forEach(function (t) { if (topics.indexOf(t) < 0) topics.push(t); });
    return {
      id: 'quad-class-' + answer + '-' + (i + 1), sourceId: c.source || null, category: 'quad', type: 'quadrilateralClassification',
      typeLabel: '四角形の分類', difficulty: answer === 'square' || notes.length ? 2 : 1, blanks: 1, figure: null, highlight: [],
      lines: [baseText + 'で、' + conds.join('、') + ' のとき', '（条件から必ずいえる、最も特別な四角形を答えよう）'],
      ask: 'この条件から、さらに何という特別な四角形であるといえる？',
      choice: { blanks: [choiceBlank('四角形', S.typeName(answer), wrong.map(function (t) { return S.typeName(t); }))] }, input: null,
      answerText: S.typeName(answer), explain: explain + wrongNote,
      premises: (c.base ? [c.base] : []).concat(c.atoms), answer: answer,
      signature: 'qc|' + (c.base || 'quad') + '|' + c.atoms.join('+') + '|' + (c.v || 0),
      requiredTopics: topics,
    };
  }

  function classificationQuestions() {
    if (!PH.specialQuad) return [];
    return QC_CASES.map(classificationQuestion).filter(Boolean);
  }

  // ---- 生成 ------------------------------------------------------------------

  /*
   * すべてのミニ問題（テンプレート）。同じ内容（図・三角形・問いが同じ）の問題は1つにまとめる。
   * 選択式の問題（choice）と記号入力の問題（input）の両方を持つものがある。どちらで出すかは出題時に決める。
   */
  function generate(problems) {
    const list = [];
    const seen = {};
    let src = null;
    // 解くのに必要な学習テーマ：テンプレートに書いたもの、なければ元の問題の topics（Ver.0.8）
    function add(q) {
      if (!q || seen[q.signature]) return;
      if (!q.choice && !q.input) return;
      if (!q.requiredTopics) q.requiredTopics = src && PH.rankTracks ? PH.rankTracks.problemTopics(src).slice() : [];
      seen[q.signature] = true;
      list.push(q);
    }
    (problems || PH.problems).forEach(function (p) {
      src = p;
      // 三角形の合同の部分（平行四辺形だけの問題にはない）
      if (PH.hasCongruence(p)) {
        p.evidence.forEach(function (ev) {
          add(equationQuestion(p, ev));
          add(reasonQuestion(p, ev));
        });
        add(conditionQuestion(p));
        congruenceQuestions(p).forEach(add);
        if (PH.hasFinalStep(p)) {
          add(triangleQuestion(p));
          add(finalReasonQuestion(p));
        }
      }
      theoremQuestions(p).forEach(add);
      rightQuestions(p).forEach(add);
      parallelogramQuestions(p).forEach(add);
    });
    src = null;
    if ((problems || PH.problems).some(function (p) { return PH.isRightProblem(p); })) rightTemplates().forEach(add);
    if ((problems || PH.problems).some(function (p) { return PH.isQuadProblem(p); })) parallelogramTemplates().forEach(add);
    // Ver.1.0：ひし形・長方形の問題があれば、四角形の分類の問題
    if ((problems || PH.problems).some(function (p) { return PH.quadType(p) === 'rhombus' || PH.quadType(p) === 'rectangle'; })) classificationQuestions().forEach(add);
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
    classificationQuestions: classificationQuestions,
    QC_CASES: QC_CASES,
    all: all,
    supports: supports,
    byId: function (id) { return all().find(function (q) { return q.id === id; }) || null; },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.rankQuestions;
})(typeof window !== 'undefined' ? window : globalThis);
