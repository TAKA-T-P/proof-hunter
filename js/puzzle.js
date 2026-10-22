/*
 * puzzle.js — 証明パズルの状態管理・答え合わせ（DOMに依存しない）
 *
 * 正解データは problems.js の evidence・congruence をそのまま使い、パズル専用には
 * problem.puzzle = { type: 'fill' | 'build', distractors: { equations: [...], reasons: [...] } }
 * だけを持つ（正解の二重管理をしない）。
 *
 *   fill（穴埋め）  … 証明文の理由は表示済み。等式の空欄と合同条件の空欄を埋める（解答レベル「おてがる」）
 *   build（組み立て）… 根拠ごとに「理由」と「等式」の空欄を埋め、最後に合同条件を選ぶ（根拠の順番は自由）（「スタンダード」）
 *   challenge        … build と同じ形で、等式はカードではなく数学キーパッドで自分で入力する（「チャレンジ」）
 *                      入力した等式は、カードと同じ形（keys・eq）に変換して同じ判定にかける
 *
 * 判定は validation.js の正規化（AB＝BA、∠ABC＝∠CBA、一直線上の別名の同一視）を使う。
 * 同じ理由の空欄どうしなら等式の順番を入れ替えても正解。
 *
 * Ver.0.8：直角三角形の合同条件の問題（PH.isRightProblem）は、根拠の行が「直角・斜辺・他の1辺（鋭角）」になる。
 *   直角の行 … 等式（∠ABC＝∠DEF＝90°）は表示済み。おてがるは理由も表示済み、スタンダード・チャレンジは理由（rreason）を選ぶ
 *   斜辺・他の1辺・鋭角の行 … その役割の等式を入れる（他の1辺を斜辺の行に入れると 'wrong-role'）
 *   合同条件のカードは5つ。3つの合同条件を選んだときは、ミスに数えずに選び直してもらう
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const CIRCLED = ['①', '②', '③', '④', '⑤', '⑥'];

  function V() { return PH.validation; }
  function G() { return PH.geometry; }

  // 文字列から決まる疑似乱数（カードの並びを毎回同じにする）
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

  function shuffle(list, seed) {
    const rnd = seeded(seed);
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function splitEquation(label) {
    const parts = String(label).split('＝');
    if (parts.length !== 2) throw new Error('等式の形式が不正です: ' + label);
    return parts;
  }

  // 根拠ごとの、証明文での理由の書き方
  function reasonText(ev) {
    return ev.proofReason || PH.REASONS[ev.reason].proof;
  }

  /*
   * 理由（カードまたは穴埋めの表示済みの理由）が、その根拠の理由として正しいか。
   *   reason が同じであることが必要。
   *   根拠専用の書き方（proofReason、例「AD∥BCより、平行線の錯角は等しいから」）のカードは、
   *   その書き方を使う根拠にだけ当てはまる（平行線が2組ある問題で、どちらの平行線かを区別する）。
   */
  function reasonAccepts(reasonCard, ev) {
    if (!reasonCard || reasonCard.reason !== ev.reason) return false;
    return reasonCard.specific ? reasonCard.text === reasonText(ev) : true;
  }

  // ---- カードの作成 ---------------------------------------------------------

  function makeEquationCards(problem) {
    const fig = problem.figure;
    const seen = {};
    const out = [];
    const labels = problem.evidence.filter(function (e) { return e.role !== 'right'; }).map(function (e) { return e.label; })
      .concat(((problem.puzzle && problem.puzzle.distractors) || {}).equations || []);
    labels.forEach(function (label) {
      const items = splitEquation(label);
      const keys = items.map(function (n) { return G().elementKey(fig, n); });
      const eq = V().equationKey(keys[0], keys[1]);
      if (seen[eq]) return;
      seen[eq] = true;
      out.push({ kind: 'eq', text: label, items: items, keys: keys, eq: eq });
    });
    return shuffle(out, problem.id + ':eq').map(function (c, i) { c.id = 'q' + i; return c; });
  }

  function makeReasonCards(problem) {
    const out = [];
    const texts = {};
    function add(card) {
      if (texts[card.text]) return;
      texts[card.text] = true;
      out.push(card);
    }
    // 根拠に使う理由（根拠専用の書き方があればそれを使う）。直角の根拠の理由は、直角の行のカード（rreason）で選ぶ
    const specificReasons = {};
    problem.evidence.forEach(function (ev) {
      if (ev.role === 'right') return;
      if (ev.proofReason) {
        specificReasons[ev.reason] = true;
        add({ kind: 'reason', reason: ev.reason, text: ev.proofReason, specific: true });
      } else {
        add({ kind: 'reason', reason: ev.reason, text: PH.REASONS[ev.reason].proof, specific: false });
      }
    });
    // 選択肢として出す理由・ダミーの理由（根拠専用の書き方がある理由は、一般的な書き方を重ねて出さない）
    const extra = problem.reasons.concat(((problem.puzzle && problem.puzzle.distractors) || {}).reasons || []);
    extra.forEach(function (r) {
      if (specificReasons[r] || !PH.REASONS[r] || PH.REASONS[r].rightOnly) return;
      add({ kind: 'reason', reason: r, text: PH.REASONS[r].proof, specific: false });
    });
    return shuffle(out, problem.id + ':reason').map(function (c, i) { c.id = 'r' + i; return c; });
  }

  // Ver.0.8：直角であることの理由のカード（仮定より／垂直な2直線がつくる角だから／正方形の角だから）
  function makeRightReasonCards(problem) {
    if (!PH.isRightProblem(problem)) return [];
    return shuffle(PH.rightTriangle.RIGHT_REASONS.map(function (r) {
      return { kind: 'rreason', reason: r, text: PH.REASONS[r].proof, specific: false };
    }), problem.id + ':rreason').map(function (c, i) { c.id = 'rr' + i; return c; });
  }

  // 合同条件のカード（直角三角形の問題は5つ、それ以外は従来の3つ）
  function makeConditionCards(problem) {
    return PH.conditionOrder(problem).map(function (c, i) {
      return { id: 'c' + i, kind: 'cond', cond: c, text: PH.CONDITIONS[c].label };
    });
  }

  // ---- Ver.0.7：多段階証明のステップのカード ------------------------------------------

  /*
   * 定理・角の式：理由のカード（正解＋その定理では言えない理由。並びは問題ごとに一定）
   * 式の比較：おてがるは共通部分（2つの式の左辺・右辺）、スタンダード・チャレンジは比べる2つの式の組（①と②／①と①…）、
   *           スタンダードは導ける等式（正解＋ダミー）
   */
  function makeStepCards(z) {
    const p = z.problem;
    const proof = PH.buildProof(p);
    const no = {};
    proof.stepLines.forEach(function (l) { no[l.stepId] = l.no; });
    z.preSteps.concat(z.postSteps).forEach(function (st) {
      if (st.type !== 'compare') {
        z.cards['srule:' + st.id] = PH.stepOptions(p, st).map(function (o) {
          return { id: 'sr:' + st.id + ':' + o.id, kind: 'srule:' + st.id, text: o.text, correct: o.id === 'a' };
        });
        return;
      }
      const deps = st.dependsOn.map(function (d) { return PH.proofEngine.stepsOf(p, 'pre').find(function (x) { return x.id === d; }); });
      if (z.type === 'fill') {
        const texts = [];
        deps.forEach(function (d) { [d.target, d.value].forEach(function (t) { if (texts.indexOf(t) < 0) texts.push(t); }); });
        z.cards['cmc:' + st.id] = shuffle(texts.map(function (t) {
          return { kind: 'cmc:' + st.id, text: t, correct: t === deps[0].value };
        }), p.id + ':cmc').map(function (c, i) { c.id = 'cc:' + st.id + ':' + i; return c; });
        return;
      }
      const a = no[deps[0].id], b = no[deps[1].id];
      z.cards['cmp:' + st.id] = [
        { id: 'cp:' + st.id + ':0', kind: 'cmp:' + st.id, text: a + 'と' + b, correct: true },
        { id: 'cp:' + st.id + ':1', kind: 'cmp:' + st.id, text: a + 'と' + a, correct: false, same: true },
        { id: 'cp:' + st.id + ':2', kind: 'cmp:' + st.id, text: b + 'と' + b, correct: false, same: true },
      ];
      if (z.type === 'build') {
        z.cards['cmr:' + st.id] = shuffle([st.label].concat(st.distractors || []).map(function (label) {
          const items = splitEquation(label);
          const keys = items.map(function (n) { return G().elementKey(p.figure, n); });
          return { kind: 'cmr:' + st.id, text: label, items: items, keys: keys, correct: label === st.label };
        }), p.id + ':cmr').map(function (c, i) { c.id = 'cr:' + st.id + ':' + i; return c; });
      }
    });
  }

  // ---- Ver.0.5：三角形の選択・最終結論のカード ------------------------------------------

  function triText(t1, t2) { return '△' + t1.join('') + 'と△' + t2.join(''); }

  function permutations(a) {
    if (a.length <= 1) return [a.slice()];
    const out = [];
    a.forEach(function (x, i) {
      permutations(a.slice(0, i).concat(a.slice(i + 1))).forEach(function (rest) { out.push([x].concat(rest)); });
    });
    return out;
  }

  // おてがる：三角形の組（正しい組と対応＋ダミー）から1つ選ぶ
  function makeTriPairCards(problem) {
    const t = problem.triangles;
    const list = [[t[0], t[1]]].concat((problem.puzzle.distractors.triangles || []).map(function (s) {
      return String(s).split('/').map(function (x) { return x.split(''); });
    }));
    return shuffle(list.map(function (pair) {
      return { kind: 'tripair', t1: pair[0], t2: pair[1], text: triText(pair[0], pair[1]) };
    }), problem.id + ':tripair').map(function (c, i) { c.id = 'tp' + i; return c; });
  }

  // スタンダード：1つ目の三角形（図の三角形を頂点のアルファベット順で）と、
  // 2つ目の三角形（頂点の並び6通り。並びが1つ目との対応を表す）
  function makeTriCards(problem) {
    const tris = G().figureTriangles(problem.figure);
    const first = tris.map(function (t, i) { return { id: 'ta' + i, kind: 'tri1', tri: t.slice(), text: '△' + t.join('') }; });
    const second = [];
    tris.forEach(function (t) {
      permutations(t).forEach(function (q) { second.push({ kind: 'tri2', tri: q, set: t.join(''), text: '△' + q.join('') }); });
    });
    return {
      tri1: first,
      tri2: shuffle(second, problem.id + ':tri2').map(function (c, i) { c.id = 'tb' + i; return c; }),
    };
  }

  // 最終結論の理由のカード（合同な図形の対応する辺／角・仮定）
  function makeFinalReasonCards(problem) {
    return shuffle(['correspondingSides', 'correspondingAngles', 'given'].map(function (r) {
      return { kind: 'freason', reason: r, text: PH.REASONS[r].proof };
    }), problem.id + ':freason').map(function (c, i) { c.id = 'fr' + i; return c; });
  }

  // 最終結論の等式のカード（結論＋ダミー）
  function makeFinalCards(problem) {
    const fig = problem.figure;
    const labels = [problem.finalStep.label].concat(problem.puzzle.distractors.finals || []);
    return shuffle(labels.map(function (label) {
      const items = splitEquation(label);
      const keys = items.map(function (n) { return G().elementKey(fig, n); });
      return { kind: 'final', text: label, items: items, keys: keys, eq: V().equationKey(keys[0], keys[1]) };
    }), problem.id + ':final').map(function (c, i) { c.id = 'fe' + i; return c; });
  }

  // チャレンジで入力した三角形の組（'△ABC/△DEF'）をカードと同じ形に
  function inputTriangles(value) {
    const v = PH.mathKeypad.parse(value);
    if (!v || v.kind !== 'tri') return null;
    return { id: 'in:' + v.value, kind: 'tri', t1: v.left.split(''), t2: v.right.split(''), text: PH.mathKeypad.pretty(v.value), input: true };
  }

  // ---- 解答レベル（Ver.0.4） -----------------------------------------------------

  // 3段階の解答レベル。どの問題も3つすべてで遊べる（problem.puzzle.type は Ver.0.3 の標準形式として残っているだけ）
  PH.PUZZLE_LEVELS = [
    { id: 'easy',      type: 'fill',      label: 'おてがる',     desc: '等式を選んで穴埋め！' },
    { id: 'standard',  type: 'build',     label: 'スタンダード', desc: '等式と理由を組み立てよう！' },
    { id: 'challenge', type: 'challenge', label: 'チャレンジ',   desc: '等式を自分で入力しよう！' },
  ];
  PH.getPuzzleLevel = function (id) {
    return PH.PUZZLE_LEVELS.find(function (l) { return l.id === id; }) || PH.PUZZLE_LEVELS[0];
  };

  // 入力された等式（'AB=CD' / '∠ABC=∠DEF'）を、カードと同じ形にする。図にない角などで計算できないときは keys が null
  function inputCard(problem, value) {
    const v = PH.mathKeypad.parse(value);
    if (!v) return null;
    const pre = v.kind === 'ang' ? '∠' : '';
    const items = [pre + v.left, pre + v.right];
    let keys = null, eq = null;
    try {
      keys = items.map(function (n) { return G().elementKey(problem.figure, n); });
      eq = V().equationKey(keys[0], keys[1]);
    } catch (e) {
      keys = null;
    }
    return { id: 'in:' + (eq || v.value), kind: 'eq', text: PH.mathKeypad.pretty(v.value), items: items, keys: keys, eq: eq, input: true };
  }

  // ---- パズル本体 -------------------------------------------------------------

  function Puzzle(problem, type) {
    this.problem = problem;
    this.type = type || (problem.puzzle && problem.puzzle.type) || 'fill';
    this.buildLike = this.type === 'build' || this.type === 'challenge';   // 理由も選ぶ形式
    this.letters = PH.mathKeypad ? PH.mathKeypad.lettersOf(problem.figure) : [];
    // 結論が辺・角の等しさの問題（Ver.0.5）：最初に三角形を選び、最後に合同から結論を導く
    this.hasFinal = !!(PH.hasFinalStep && PH.hasFinalStep(problem));
    // Ver.0.7：多段階証明。根拠の行は、前のステップで導いた事実を使わない根拠だけ（導いた事実はステップの行で書く）
    this.multi = !!(PH.proofEngine && PH.proofEngine.hasSteps(problem));
    this.rowEv = problem.evidence.filter(function (ev) { return !ev.fromStep; });
    // Ver.0.8：直角三角形の問題は、根拠の行ごとの役割（直角・斜辺・他の1辺・鋭角）
    this.right = !!(PH.isRightProblem && PH.isRightProblem(problem));
    this.rowRoles = this.right ? this.rowEv.map(function (ev) { return PH.rightTriangle.roleOf(problem, ev); }) : [];
    this.preSteps = this.multi ? PH.proofEngine.stepsOf(problem, 'pre') : [];
    this.postSteps = this.multi ? PH.proofEngine.stepsOf(problem, 'post') : [];
    const triCards = this.hasFinal && this.type === 'build' ? makeTriCards(problem) : { tri1: [], tri2: [] };
    this.cards = {
      eq: this.type === 'challenge' ? [] : makeEquationCards(problem),   // チャレンジでは等式カードを出さない
      reason: this.buildLike ? makeReasonCards(problem) : [],
      rreason: this.buildLike ? makeRightReasonCards(problem) : [],
      cond: makeConditionCards(problem),
      tripair: this.hasFinal && this.type === 'fill' ? makeTriPairCards(problem) : [],
      tri1: triCards.tri1,
      tri2: triCards.tri2,
      freason: this.hasFinal && this.buildLike ? makeFinalReasonCards(problem) : [],
      final: this.hasFinal && this.type !== 'challenge' ? makeFinalCards(problem) : [],
    };
    if (this.multi) makeStepCards(this);
    this.cardById = {};
    const self = this;
    Object.keys(this.cards).forEach(function (k) {
      self.cards[k].forEach(function (c) { self.cardById[c.id] = c; });
    });
    this.slots = this.makeSlots();
    this.reset();
  }

  /*
   * 空欄の一覧（画面の上から順）。
   *   fill : { id:'s0', kind:'eq', row:0, fixed:{reason,text,specific} } … 理由は表示済み
   *   build: { id:'r0', kind:'reason', row:0 }, { id:'e0', kind:'eq', row:0 } …
   *   challenge: build と同じで、等式の空欄に input: true（キーパッドで入力）
   *   共通 : { id:'cond', kind:'cond' }
   *   Ver.0.5（結論が辺・角の等しさ）：最初に三角形、最後に最終結論
   *     fill     : { id:'tri', kind:'tripair' } … { id:'fe', kind:'final', fixed:{ text } }（理由は表示済み）
   *     build    : { id:'t1', kind:'tri1' }, { id:'t2', kind:'tri2' } … { id:'fr', kind:'freason' }, { id:'fe', kind:'final' }
   *     challenge: { id:'tri', kind:'tri', input:true, inputKind:'tri' } … { id:'fr', kind:'freason' }, { id:'fe', kind:'final', input:true }
   */
  Puzzle.prototype.makeSlots = function () {
    const p = this.problem;
    const slots = [];
    if (this.hasFinal) {
      if (this.type === 'fill') slots.push({ id: 'tri', kind: 'tripair', label: '証明する三角形' });
      else if (this.type === 'build') {
        slots.push({ id: 't1', kind: 'tri1', label: '1つ目の三角形' });
        slots.push({ id: 't2', kind: 'tri2', label: '2つ目の三角形（頂点の対応）' });
      } else slots.push({ id: 'tri', kind: 'tri', label: '証明する三角形', input: true, inputKind: 'tri' });
    }
    this.preSteps.forEach(function (st) { this.stepSlots(st).forEach(function (x) { slots.push(x); }); }, this);
    const RT = PH.rightTriangle;
    this.rowEv.forEach(function (ev, i) {
      const role = this.rowRoles[i];
      if (role === 'right') {
        // 直角の行：等式は表示済み。理由はスタンダード・チャレンジで選ぶ（おてがるは表示済み）
        if (this.buildLike) slots.push({ id: 'r' + i, kind: 'rreason', row: i, label: '直角である理由' });
        return;
      }
      if (role) {
        const name = RT.ROLE_LABEL[role];
        if (this.buildLike) {
          slots.push({ id: 'r' + i, kind: 'reason', row: i, label: name + 'の理由' });
          slots.push({ id: 'e' + i, kind: 'eq', row: i, label: name + 'の等式', input: this.type === 'challenge' });
        } else {
          slots.push({ id: 's' + i, kind: 'eq', row: i, label: name + 'の等式', fixed: { reason: ev.reason, text: reasonText(ev), specific: !!ev.proofReason } });
        }
        return;
      }
      if (this.buildLike) {
        slots.push({ id: 'r' + i, kind: 'reason', row: i, label: '根拠' + CIRCLED[i] + 'の理由' });
        slots.push({ id: 'e' + i, kind: 'eq', row: i, label: '根拠' + CIRCLED[i] + 'の等式', input: this.type === 'challenge' });
      } else {
        slots.push({
          id: 's' + i, kind: 'eq', row: i, label: CIRCLED[i] + 'の等式',
          fixed: { reason: ev.reason, text: reasonText(ev), specific: !!ev.proofReason },
        });
      }
    }, this);
    slots.push({ id: 'cond', kind: 'cond', label: '合同条件' });
    if (this.hasFinal) {
      if (this.type === 'fill') {
        slots.push({ id: 'fe', kind: 'final', label: '結論', fixed: { text: PH.REASONS[PH.finalReasonFor(p)].proof } });
      } else {
        slots.push({ id: 'fr', kind: 'freason', label: '結論の理由' });
        slots.push({ id: 'fe', kind: 'final', label: '結論の等式', input: this.type === 'challenge' });
      }
    }
    this.postSteps.forEach(function (st) { this.stepSlots(st).forEach(function (x) { slots.push(x); }); }, this);
    return slots;
  };

  /*
   * 多段階証明のステップの空欄（Ver.0.7）
   *   定理・角の式：{ id: 'st:<id>', kind: 'srule:<id>' }（理由のカードを選ぶ。3レベル共通）
   *   式の比較：おてがる     { id: 'cc:<id>', kind: 'cmc:<id>' }（2つの式の共通部分。結論は自動で表示）
   *             スタンダード { id: 'cp:<id>', kind: 'cmp:<id>' }（比べる2つの式）＋ { id: 'cr:<id>', kind: 'cmr:<id>' }（導ける等式の3択）
   *             チャレンジ   cp ＋ { id: 'cr:<id>', input: true }（導ける等式をキーパッドで入力）
   */
  Puzzle.prototype.stepSlots = function (st) {
    if (st.type !== 'compare') return [{ id: 'st:' + st.id, kind: 'srule:' + st.id, step: st.id, label: st.short + '（理由）' }];
    if (this.type === 'fill') return [{ id: 'cc:' + st.id, kind: 'cmc:' + st.id, step: st.id, label: '2つの式の共通部分' }];
    return [
      { id: 'cp:' + st.id, kind: 'cmp:' + st.id, step: st.id, label: '比べる2つの式' },
      { id: 'cr:' + st.id, kind: 'cmr:' + st.id, step: st.id, label: '導ける等式', input: this.type === 'challenge' },
    ];
  };

  // 空欄が数学キーパッドで入力する欄か、そのとき入力できる種類
  Puzzle.prototype.inputKinds = function (slotId) {
    const s = this.slot(slotId);
    if (!s || !s.input) return null;
    return s.inputKind === 'tri' ? ['tri'] : ['seg', 'ang'];
  };

  // 3つの頂点が図の上の三角形か（三角形の入力欄で、図にない三角形は決定できない）
  Puzzle.prototype.isTriangle = function (tri) {
    return G().isFigureTriangle(this.problem.figure, tri);
  };

  Puzzle.prototype.reset = function () {
    this.placed = {};          // 空欄ID → カードID（チャレンジの等式は 'input'）
    this.inputs = {};          // チャレンジ：空欄ID → 入力した等式（'AB=CD' など）
    this.active = this.slots[0].id;
    this.misses = 0;
    this.hintsUsed = 0;
    this.hintLevels = {};
    this.counted = {};         // ミスに数えた誤りの組み合わせ（同じ誤りでは増やさない）
    this.result = null;        // 直前の答え合わせの結果
    this.phase = 'play';
    this.stars = 0;
  };

  Puzzle.prototype.slot = function (id) {
    return this.slots.find(function (s) { return s.id === id; }) || null;
  };

  Puzzle.prototype.selectSlot = function (id) {
    if (this.phase !== 'play' || !this.slot(id)) return false;
    this.active = id;
    return true;
  };

  // 選択中の空欄に入れられるカード
  Puzzle.prototype.cardsForActive = function () {
    const s = this.slot(this.active);
    if (!s || s.input) return [];             // チャレンジの等式・三角形はキーパッドで入力
    if (s.kind === 'tri2') {
      // 2つ目の三角形：1つ目と同じ三角形の並べかえは出さない
      const first = this.cardIn('t1');
      if (first) {
        const set = first.tri.slice().sort().join('');
        return this.cards.tri2.filter(function (c) { return c.set !== set; });
      }
    }
    return this.cards[s.kind];
  };

  // 入れたあと、次の空いている空欄へ進む
  Puzzle.prototype.advanceFrom = function (s) {
    const idx = this.slots.indexOf(s);
    const order = this.slots.slice(idx + 1).concat(this.slots.slice(0, idx));
    const next = order.find(function (x) { return !this.placed[x.id]; }, this);
    if (next) this.active = next.id;
  };

  // チャレンジ：選択中の等式の空欄に、入力した等式を入れる（形式が不正なら入れない）
  Puzzle.prototype.setInput = function (value) {
    if (this.phase !== 'play') return false;
    const s = this.slot(this.active);
    if (!s || !s.input) return false;
    const v = PH.mathKeypad.parse(value, this.letters);
    if (!v) return false;
    // 三角形の欄には図の上の三角形の組だけ、等式の欄には辺・角の等式だけが入る
    if (s.inputKind === 'tri') {
      if (v.kind !== 'tri' || !this.isTriangle(v.left.split('')) || !this.isTriangle(v.right.split(''))) return false;
    } else if (v.kind === 'tri') return false;
    this.inputs[s.id] = v.value;
    this.placed[s.id] = 'input';
    if (this.result) delete this.result.slotStatus[s.id];
    this.advanceFrom(s);
    return true;
  };

  // カードを選択中の空欄に入れ、次の空いている空欄へ進む
  Puzzle.prototype.place = function (cardId) {
    if (this.phase !== 'play') return false;
    const s = this.slot(this.active);
    const card = this.cardById[cardId];
    if (!s || !card || card.kind !== s.kind) return false;
    if (s.input) return false;
    this.placed[s.id] = cardId;
    if (this.result) delete this.result.slotStatus[s.id];
    this.advanceFrom(s);
    return true;
  };

  // 選択中の空欄のカードを取り消す
  Puzzle.prototype.clearActive = function () {
    if (this.phase !== 'play' || !this.placed[this.active]) return false;
    delete this.placed[this.active];
    delete this.inputs[this.active];
    if (this.result) delete this.result.slotStatus[this.active];
    return true;
  };

  Puzzle.prototype.clearAll = function () {
    if (this.phase !== 'play') return false;
    this.placed = {};
    this.inputs = {};
    this.result = null;
    this.active = this.slots[0].id;
    return true;
  };

  Puzzle.prototype.emptyCount = function () {
    return this.slots.filter(function (s) { return !this.placed[s.id]; }, this).length;
  };

  Puzzle.prototype.canCheck = function () {
    return this.phase === 'play' && this.emptyCount() === 0;
  };

  Puzzle.prototype.cardIn = function (slotId) {
    const id = this.placed[slotId];
    if (id === 'input') {
      const s = this.slot(slotId);
      return s && s.inputKind === 'tri' ? inputTriangles(this.inputs[slotId]) : inputCard(this.problem, this.inputs[slotId]);
    }
    return id ? this.cardById[id] : null;
  };

  // 答えた三角形の組 [t1, t2]（同じ位置の頂点どうしが対応）。未完成なら null
  Puzzle.prototype.triangleAnswer = function () {
    if (!this.hasFinal) return null;
    if (this.type === 'build') {
      const a = this.cardIn('t1'), b = this.cardIn('t2');
      return a && b ? [a.tri, b.tri] : null;
    }
    const c = this.cardIn('tri');
    return c ? [c.t1, c.t2] : null;
  };

  Puzzle.prototype.triangleSlotIds = function () {
    if (!this.hasFinal) return [];
    return this.type === 'build' ? ['t1', 't2'] : ['tri'];
  };

  // 三角形の判定（validation.checkTriangles）。未完成は 'incomplete'
  Puzzle.prototype.evaluateTriangles = function () {
    const ans = this.triangleAnswer();
    if (!ans) return { status: 'incomplete', ok: false };
    return V().checkTriangles(this.problem, ans[0], ans[1]);
  };

  /*
   * 最終結論の判定
   *   reasonOk … 理由（おてがるは表示済みなので常に正しい）
   *   status   … goal / not-goal / evidence / wrong-equation / empty
   *   orderOk  … チャレンジで入力した等式の頂点の対応順
   */
  Puzzle.prototype.evaluateFinal = function () {
    if (!this.hasFinal) return null;
    const p = this.problem;
    const rc = this.type === 'fill' ? { reason: PH.finalReasonFor(p) } : this.cardIn('fr');
    const ec = this.cardIn('fe');
    const out = { reasonCard: rc, eqCard: ec, reasonOk: !!rc && rc.reason === PH.finalReasonFor(p), status: 'empty', orderOk: true };
    if (!ec) return out;
    out.status = ec.keys ? V().finalEquationStatus(p, ec.keys) : 'wrong-equation';
    if (out.status === 'goal' && ec.input) out.orderOk = V().correspondenceOrder(p, ec.items) !== 'order';
    return out;
  };

  // 根拠の行ごとの理由（fill は表示済みの理由、build・challenge は理由カード）
  Puzzle.prototype.rowReason = function (row) {
    if (this.buildLike) return this.cardIn('r' + row);
    if (this.rowRoles[row] === 'right') {
      const ev = this.rowEv[row];
      return { reason: ev.reason, text: reasonText(ev), specific: false };
    }
    return this.slot('s' + row).fixed;
  };

  // 根拠の行の等式（直角の行は表示済みの等式「∠ABC＝∠DEF＝90°」）
  Puzzle.prototype.rowEq = function (row) {
    if (this.rowRoles[row] === 'right') {
      const ev = this.rowEv[row];
      const keys = ev.items.map(function (n) { return G().elementKey(this.problem.figure, n); }, this);
      return { id: 'fx' + row, kind: 'eq', text: PH.evidenceText(ev), items: ev.items.slice(), keys: keys, eq: V().equationKey(keys[0], keys[1]), fixed: true };
    }
    return this.cardIn(this.eqSlotId(row));
  };

  Puzzle.prototype.eqSlotId = function (row) {
    return (this.buildLike ? 'e' : 's') + row;
  };

  /*
   * 根拠の各行の判定（入っていないところは 'empty'）。
   *   ok / empty / wrong-reason（等式は根拠だが理由が合わない）/ duplicate（同じ根拠を2回）
   *   / from-conclusion / not-common / wrong-equation / irrelevant（正しいが今回は使わない）
   *   / order（チャレンジ：根拠の等式だが、頂点の対応順が合っていない。ミスにはしない）
   *   row.orderOk … チャレンジで入力した等式の頂点の対応順が合っているか（理由が誤りのときも別に確かめる）
   */
  Puzzle.prototype.evaluateRows = function () {
    const p = this.problem;
    const used = {};
    const rows = [];
    for (let i = 0; i < this.rowEv.length; i++) {
      const eqCard = this.rowEq(i);
      const reason = this.rowReason(i);
      const row = { row: i, status: 'ok', evidence: null, eqCard: eqCard, reason: reason, orderOk: true };
      if (!eqCard) {
        row.status = 'empty';
      } else if (!eqCard.keys) {
        row.status = 'wrong-equation';          // 図の上で角にならない入力など
      } else {
        const ev = V().matchEvidence(p, eqCard.keys);
        row.evidence = ev;
        // チャレンジで入力した等式は、頂点の対応順（例：AB＝CB を AB＝BC と書いていないか）も確かめる
        if (ev && eqCard.input) row.orderOk = V().correspondenceOrder(p, eqCard.items) !== 'order';
        if (!ev) row.status = V().equationStatus(p, eqCard.keys);
        else if (ev.fromStep) row.status = 'derived';     // 前のステップで導いた等式（ステップの行で書くので、ここには入れない）
        else if (this.right && PH.rightTriangle.roleOf(p, ev) !== this.rowRoles[i]) {
          row.status = 'wrong-role';                      // Ver.0.8：その行の役割（斜辺など）ではない根拠
          row.role = PH.rightTriangle.roleOf(p, ev);
        }
        else if (!reason) row.status = 'empty';
        else if (!reasonAccepts(reason, ev)) row.status = 'wrong-reason';
        else if (used[ev.id]) row.status = 'duplicate';
        else {
          used[ev.id] = true;
          if (!row.orderOk) row.status = 'order';
        }
      }
      rows.push(row);
    }
    return rows;
  };

  // ステップの式の番号（証明文の ③④⑤ など）
  Puzzle.prototype.stepNo = function (id) {
    const l = PH.buildProof(this.problem).stepLines.find(function (x) { return x.stepId === id; });
    return l ? l.no : '';
  };

  /*
   * ステップの判定（Ver.0.7）。ステップごとに { ok, slots, okSlots, ngSlot, message, label, sig, empty }
   *   定理・角の式：理由のカードが正しいか
   *   式の比較：共通部分（おてがる）／比べる2つの式と導ける等式（スタンダード・チャレンジ）
   */
  Puzzle.prototype.evaluateSteps = function () {
    if (!this.multi) return [];
    const p = this.problem;
    const self = this;
    return this.preSteps.concat(this.postSteps).map(function (st) {
      const ids = self.stepSlots(st).map(function (x) { return x.id; });
      const r = { step: st, slots: ids, okSlots: [], ok: false, label: st.short, empty: ids.some(function (id) { return !self.placed[id]; }) };
      if (st.type !== 'compare') {
        const c = self.cardIn(ids[0]);
        r.ok = !!c && c.correct;
        r.ngSlot = ids[0];
        r.sig = c ? c.id : '';
        r.message = st.type === 'expression' ? 'この式は、どんな角の関係を使って導いたかな？ 理由をもう一度考えよう。'
          : 'その理由で言えるかな？ どんな図形の性質を使うか、もう一度考えよう。';
        return r;
      }
      if (self.type === 'fill') {
        const c = self.cardIn(ids[0]);
        r.ok = !!c && c.correct;
        r.ngSlot = ids[0];
        r.sig = c ? c.id : '';
        r.message = '2つの式で、まったく同じになっている部分はどれかな？';
        return r;
      }
      const pair = self.cardIn(ids[0]);
      const res = self.cardIn(ids[1]);
      const want = st.items.map(function (n) { return G().elementKey(p.figure, n); });
      const resOk = !!res && !!res.keys && V().equationKey(res.keys[0], res.keys[1]) === V().equationKey(want[0], want[1]);
      if (!pair || !pair.correct) {
        r.ngSlot = ids[0];
        r.sig = pair ? pair.id : '';
        r.message = pair && pair.same ? '同じ式を2回選んでも、新しい等式は導けないよ。2つの式を比べよう！' : '比べる2つの式を確認しよう。';
        if (resOk) r.okSlots.push(ids[1]);
        return r;
      }
      r.okSlots.push(ids[0]);
      r.ok = resOk;
      r.ngSlot = ids[1];
      r.sig = res ? res.id : '';
      r.message = '2つの式の右辺が同じだから、左辺どうしが等しいね。導ける等式をもう一度考えよう。';
      return r;
    });
  };

  // 答え合わせ
  Puzzle.prototype.check = function () {
    if (this.phase !== 'play') return { status: 'done' };
    if (!this.canCheck()) return { status: 'incomplete', missing: this.emptyCount() };
    const p = this.problem;
    const self = this;
    const rows = this.evaluateRows();
    const slotStatus = {};
    const messages = [];
    let newMisses = 0;

    // まちがいの表示だけ（ミスに数えない）：頂点の対応順
    function note(slotId, text, label) {
      slotStatus[slotId] = 'ng';
      messages.push({ slotId: slotId, label: label, text: text });
    }

    function fail(slotId, signature, text, label) {
      slotStatus[slotId] = 'ng';
      messages.push({ slotId: slotId, label: label, text: text });
      if (!self.counted[signature]) {
        self.counted[signature] = true;
        newMisses++;
      }
    }

    const challenge = this.type === 'challenge';
    // 結論が辺・角の等しさの問題では、答え合わせの文で証明する三角形（STEP 1 の答え）を明かさない
    const MSG = {
      wrongReason: '等式は合っているよ！ 理由をもう一度考えてみよう。',
      duplicate: '同じ根拠が2回使われているよ！',
      fromConclusion: challenge ? 'それは合同が証明できてから使える関係だよ！'
        : this.hasFinal ? 'それは合同が証明できてから使える関係だよ！ まだ根拠に使えないよ。'
        : 'それは' + p.conclusion + 'が証明できたら言えることだよ！ 結論はまだ根拠に使えないよ。',
      wrongEquation: challenge ? 'その2つが等しいと言えるか、図と仮定を確認しよう。' : 'この等式は、まだ言えないよ！',
      cond: challenge ? '3つの根拠と合同条件の関係を確認しよう。' : 'この3つの根拠では、その合同条件は使えないよ！',
      // Ver.0.8：直角三角形
      condClassic: '3つの合同条件で示せる場合もあるけれど、今回の根拠（直角・斜辺・' +
        (this.right ? PH.rightTriangle.ROLE_LABEL[PH.rightTriangle.slotRoles(p)[2]] : '') + '）には、直角三角形の合同条件がぴったり合うよ。選び直そう！（ミスには数えないよ）',
      rightReason: '直角は確かめられたね！ なぜ90°と言えるのか、仮定や図形の性質をもう一度考えよう。',
      order: this.hasFinal ? '対応順が合っていないよ！ 2つの三角形の頂点の対応に合わせて書こう。'
        : '対応順が合っていないよ！ 結論 ' + p.conclusion + ' の頂点の順番に合わせて書こう。',
      triOrder: '三角形は見つけられたね！ 頂点の対応順を確認しよう！',
      triWrong: 'この2つの三角形で、結論を導けるかな？ 対応する辺・角に注目しよう！',
      finalNotGoal: '正しい関係だけれど、問題で求められている結論ではないよ。結論をもう一度確認しよう！',
      finalEvidence: 'それは合同を示すのに使った関係だよ。合同から導く結論を答えよう！',
      finalWrong: 'その2つは、合同な三角形で対応しているかな？ 結論をもう一度確認しよう！',
      finalReason: '合同な図形の性質を使おう。辺と角のどちらの等しさかな？',
    };

    // 三角形の選択（Ver.0.5）：三角形の組と頂点の対応
    if (this.hasFinal) {
      const tr = this.evaluateTriangles();
      const ids = this.triangleSlotIds();
      const ans = this.triangleAnswer();
      const sig = 'tri:' + (ans ? V().correspondenceKey(ans[0], ans[1]) : '');
      if (tr.ok) ids.forEach(function (id) { slotStatus[id] = 'ok'; });
      else {
        const last = ids[ids.length - 1];
        ids.forEach(function (id) { slotStatus[id] = 'ng'; });
        if (tr.status === 'order' && ids.length > 1) slotStatus[ids[0]] = 'ok';   // 1つ目の三角形は合っている
        fail(last, sig, tr.status === 'order' ? MSG.triOrder : MSG.triWrong, '三角形');
      }
    }

    // 多段階証明のステップ（Ver.0.7）
    this.evaluateSteps().forEach(function (r) {
      if (r.ok) { r.slots.forEach(function (id) { slotStatus[id] = 'ok'; }); return; }
      r.okSlots.forEach(function (id) { slotStatus[id] = 'ok'; });
      fail(r.ngSlot, 'step:' + r.ngSlot + ':' + r.sig, r.message, r.label);
    });

    rows.forEach(function (r) {
      const eqId = self.eqSlotId(r.row);
      const rsId = self.buildLike ? 'r' + r.row : null;
      const role = self.rowRoles[r.row];
      const label = role ? PH.rightTriangle.ROLE_LABEL[role] : (self.buildLike ? '根拠' : '') + CIRCLED[r.row];
      if (role === 'right') {
        // 直角の行：等式は表示済み。理由だけを確かめる（おてがるは理由も表示済み）
        if (!rsId) return;
        if (r.status === 'ok') slotStatus[rsId] = 'ok';
        else fail(rsId, 'right:' + self.placed[rsId], MSG.rightReason, label);
        return;
      }
      const sig = eqId + ':' + r.eqCard.id + (rsId ? '/' + self.placed[rsId] : '');
      switch (r.status) {
        case 'ok':
          slotStatus[eqId] = 'ok';
          if (rsId) slotStatus[rsId] = 'ok';
          break;
        case 'order':
          if (rsId) slotStatus[rsId] = 'ok';
          note(eqId, MSG.order, label);
          break;
        case 'wrong-reason':
          if (self.buildLike) {
            if (r.orderOk) slotStatus[eqId] = 'ok';
            else note(eqId, MSG.order, label);
            fail(rsId, sig, MSG.wrongReason, label);
          } else {
            fail(eqId, sig, '「' + r.reason.text + '」で言える等式かな？ 理由と等式の組み合わせを考えよう。', label);
          }
          break;
        case 'duplicate':
          if (rsId) slotStatus[rsId] = 'ok';
          fail(eqId, sig, MSG.duplicate, label);
          break;
        case 'from-conclusion':
          fail(eqId, sig, MSG.fromConclusion, label);
          break;
        case 'irrelevant':
          fail(eqId, sig, 'たしかに等しいけれど、今回の証明では使わない関係だよ。', label);
          break;
        case 'derived':
          fail(eqId, sig, 'その等式は、ステップで導いた等式（' + self.stepNo(r.evidence.fromStep) + '）だよ。ここには、ほかの根拠を入れよう。', label);
          break;
        case 'wrong-role':
          fail(eqId, sig, role === 'hypotenuse' && r.role === 'leg' ? 'それは斜辺ではなく「他の1辺」だよ。斜辺は、直角に向かい合う辺だよ。'
            : role === 'leg' && r.role === 'hypotenuse' ? 'それは斜辺だよ。ここには、斜辺ではない方の辺（他の1辺）を入れよう。'
            : 'それは「' + PH.rightTriangle.ROLE_LABEL[r.role] + '」の根拠だよ。ここには「' + label + '」を入れよう。', label);
          break;
        case 'not-common':
          fail(eqId, sig, 'その辺（角）は、2つの三角形の両方にふくまれているかな？', label);
          break;
        default:
          fail(eqId, sig, MSG.wrongEquation, label);
      }
    });

    // 合同条件：根拠がすべて正しければ、その3つから導いた条件と比べる
    const condCard = this.cardIn('cond');
    const allRowsOk = rows.every(function (r) { return r.status === 'ok'; });
    const fixedEv = p.evidence.filter(function (ev) { return ev.fromStep; });
    const expected = allRowsOk ? V().deriveCondition(p, rows.map(function (r) { return r.evidence; }).concat(fixedEv)) : p.congruence;
    if (condCard.cond === expected) slotStatus.cond = 'ok';
    else if (this.right && !PH.CONDITIONS[condCard.cond].right) note('cond', MSG.condClassic, '合同条件');   // ミスに数えない
    else fail('cond', 'cond:' + condCard.id + ':' + rows.map(function (r) { return r.eqCard.id; }).join(','),
      MSG.cond, '合同条件');

    // 最終結論（Ver.0.5）：合同な図形の対応する辺・角から導く結論と、その理由
    if (this.hasFinal) {
      const f = this.evaluateFinal();
      const fsig = 'final:' + f.eqCard.id;
      if (this.type !== 'fill') {
        if (f.reasonOk) slotStatus.fr = 'ok';
        else fail('fr', 'freason:' + f.reasonCard.id, MSG.finalReason, '結論の理由');
      }
      if (f.status === 'goal') {
        if (f.orderOk) slotStatus.fe = 'ok';
        else note('fe', MSG.order, '結論');
      } else if (f.status === 'not-goal') fail('fe', fsig, MSG.finalNotGoal, '結論');
      else if (f.status === 'evidence') fail('fe', fsig, MSG.finalEvidence, '結論');
      else fail('fe', fsig, MSG.finalWrong, '結論');
    }

    this.misses += newMisses;
    const ok = messages.length === 0;
    this.result = { ok: ok, slotStatus: slotStatus, messages: messages, newMisses: newMisses };
    if (ok) {
      this.phase = 'clear';
      this.stars = PH.calcStars(this.misses, this.hintsUsed);
    } else {
      // 最初の誤りの空欄を選ぶ（すぐ直せるように）
      const first = this.slots.find(function (s) { return slotStatus[s.id] === 'ng'; });
      if (first) this.active = first.id;
    }
    return { status: ok ? 'clear' : 'wrong', result: this.result };
  };

  // ---- ヒント -----------------------------------------------------------------

  const REASON_HINT = {
    given: '仮定に書かれている等しい辺や角を探そう！',
    common: '2つの三角形の両方にふくまれている辺はないかな？',
    commonAngle: '2つの三角形の両方にふくまれている角はないかな？',
    vertical: '2本の直線が交わってできる、向かい合う角（対頂角）に注目しよう！',
    alternate: '平行線と交わる直線に注目して、錯角を探そう！',
    corresponding: '平行線と交わる直線に注目して、同位角を探そう！',
    equilateralSides: '正三角形の辺に注目しよう！',
    squareSides: '正方形の辺に注目しよう！',
    isoscelesBaseAngles: '二等辺三角形の底角に注目しよう！',
  };
  // Ver.0.8：直角三角形の根拠の役割ごとの最初のヒント
  const ROLE_HINT = {
    hypotenuse: '直角三角形のどの辺が斜辺かな？ 斜辺は、直角に向かい合う辺だよ。',
    leg: '斜辺と、もう1組の対応する辺を探そう！',
    acute: '斜辺のほかに、等しい角はないかな？ 直角ではない方の角（鋭角）に注目しよう！',
  };

  // ヒントの対象：まだ正しくそろっていない根拠（答え合わせで誤りがあった所・空欄を優先）、最後に合同条件
  Puzzle.prototype.hintTarget = function () {
    const p = this.problem;
    // Ver.0.5：まず証明する三角形
    if (this.hasFinal && !this.evaluateTriangles().ok) {
      return { id: 'triangleSelection', ev: null, slotId: this.triangleSlotIds()[0] };
    }
    // Ver.0.7：前半のステップ（まだ正しくないもの）
    const steps = this.evaluateSteps();
    const preNg = steps.find(function (r) { return !r.ok && (r.step.stage || 'pre') === 'pre'; });
    if (preNg) return { id: preNg.step.id, ev: null, step: preNg.step, slotId: preNg.empty ? preNg.slots.find(function (id) { return !this.placed[id]; }, this) : preNg.ngSlot };
    const rows = this.evaluateRows();
    const done = {};
    rows.forEach(function (r) { if (r.status === 'ok') done[r.evidence.id] = true; });
    const rowEv = this.rowEv;
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.status === 'ok') continue;
      if (this.right) {
        // 直角三角形の問題は、行ごとに役割が決まっている（直角の行は理由の欄）
        if (this.type === 'fill' && this.rowRoles[i] === 'right') continue;
        return { id: rowEv[i].id, ev: rowEv[i], slotId: this.rowRoles[i] === 'right' ? 'r' + i : this.eqSlotId(i) };
      }
      if (this.type === 'fill') {
        // 表示済みの理由で言える根拠のうち、まだ使っていないもの（同じ理由の行どうしは入れかえ可）
        const fixed = this.slot('s' + i).fixed;
        const ev = rowEv.find(function (e) { return !done[e.id] && reasonAccepts(fixed, e); });
        if (ev) return { id: ev.id, ev: ev, slotId: 's' + i };
      } else {
        const ev = rowEv.find(function (e) { return !done[e.id]; });
        if (ev) return { id: ev.id, ev: ev, slotId: 'e' + i };
      }
    }
    // 根拠がそろい、合同条件も正しければ、最後は合同から結論を導くところ
    if (this.hasFinal) {
      const cond = this.cardIn('cond');
      const f = this.evaluateFinal();
      const finalOk = f.reasonOk && f.status === 'goal' && f.orderOk;
      if (cond && cond.cond === p.congruence && !finalOk) {
        return { id: 'finalStep', ev: null, slotId: this.type === 'fill' || f.reasonOk ? 'fe' : 'fr' };
      }
      // 最後は後半のステップ（二等辺三角形である、など）
      const postNg = steps.find(function (r) { return !r.ok && r.step.stage === 'post'; });
      if (cond && cond.cond === p.congruence && finalOk && postNg) return { id: postNg.step.id, ev: null, step: postNg.step, slotId: postNg.ngSlot };
    }
    return { id: 'congruence', ev: null, slotId: 'cond' };
  };

  Puzzle.prototype.hintList = function (target) {
    const p = this.problem;
    if (target.id === 'triangleSelection' || target.id === 'finalStep' || target.step) {
      // 問題データのヒント（最終段階でも答えは自動で入れない）
      return (p.hints[target.id] || []).map(function (h) {
        return { text: h.text, focus: (h.focus || []).map(function (n) { return G().elementKey(p.figure, n); }) };
      });
    }
    if (!target.ev) return (p.hints.congruence || []).map(function (h) { return { text: h.text, focus: [] }; });
    const ev = target.ev;
    const fig = p.figure;
    const keys = ev.items.map(function (n) { return G().elementKey(fig, n); });
    const name = function (n) { return G().isAngleName(n) ? n : '辺' + n; };
    const same = keys[0] === keys[1];
    const role = this.right ? PH.rightTriangle.roleOf(p, ev) : null;
    if (role === 'right') {
      // 直角の行（スタンダード・チャレンジ）：なぜ90°と言えるか
      return [
        { text: '2つの三角形の中に90°の角はあるかな？ ' + PH.evidenceText(ev) + ' になる理由を考えよう。', focus: [] },
        { text: '仮定の90°・垂直な線・正方形の角に注目しよう！', focus: keys },
        { text: 'この2つの角が直角であることを確認しよう。理由は「' + reasonText(ev) + '」だよ。', focus: keys },
      ];
    }
    const base = REASON_HINT[ev.reason] || '仮定や、図形の性質を確認しよう！';
    const first = role ? ROLE_HINT[role] + (this.type === 'fill' ? '（' + reasonText(ev) + '）' : '')
      : this.type === 'fill'
        ? '「' + reasonText(ev) + '」で言える等式を考えよう。' + base
        : base;
    const second = same
      ? name(ev.items[0]) + 'は、2つの三角形で共通しているよ！'
      : name(ev.items[0]) + 'と' + name(ev.items[1]) + 'に注目しよう！';
    const third = this.type === 'fill'
      ? ev.label + ' を入れよう！'
      : this.type === 'challenge'
        ? ev.label + ' を使おう！ 理由は「' + reasonText(ev) + '」だよ。（等式は自分で入力しよう）'
        : '理由「' + reasonText(ev) + '」と、等式 ' + ev.label + ' を組み合わせよう！';
    return [
      { text: first, focus: [] },
      { text: second, focus: keys },
      { text: third, focus: keys },
    ];
  };

  // ヒントを1段階進める（最終段階はくり返し表示できるが、回数は増えない）
  Puzzle.prototype.useHint = function () {
    if (this.phase !== 'play') return null;
    const target = this.hintTarget();
    const list = this.hintList(target);
    if (!list.length) return null;
    const cur = this.hintLevels[target.id] || 0;
    const level = Math.min(cur + 1, list.length);
    const isNew = level > cur;
    if (isNew) {
      this.hintLevels[target.id] = level;
      this.hintsUsed++;
    }
    return { targetId: target.id, slotId: target.slotId, level: level, max: list.length,
      text: list[level - 1].text, focus: list[level - 1].focus, isNew: isNew };
  };

  // 正解の配置（テスト・開発用）。rowsOrder で根拠の並びを変えられる
  Puzzle.prototype.solution = function (rowsOrder) {
    const p = this.problem;
    const self = this;
    const order = rowsOrder || this.rowEv.map(function (_, i) { return i; });
    const out = {};
    const findEq = function (ev) {
      const keys = ev.items.map(function (n) { return G().elementKey(p.figure, n); });
      const eq = V().equationKey(keys[0], keys[1]);
      return self.cards.eq.find(function (c) { return c.eq === eq; });
    };
    order.forEach(function (evIndex, row) {
      const ev = self.rowEv[evIndex];
      if (self.rowRoles[row] === 'right') {
        // 直角の行：等式は表示済み。理由のカードだけ
        if (self.buildLike) out['r' + row] = self.cards.rreason.find(function (c) { return reasonAccepts(c, ev); }).id;
        return;
      }
      out[self.eqSlotId(row)] = self.type === 'challenge' ? ev.items.join('=') : findEq(ev).id;
      if (self.buildLike) {
        out['r' + row] = self.cards.reason.find(function (c) { return reasonAccepts(c, ev); }).id;
      }
    });
    out.cond = this.cards.cond.find(function (c) { return c.cond === p.congruence; }).id;
    if (this.hasFinal) {
      const t = p.triangles;
      // 1つ目をアルファベット順にしたときの、対応する2つ目の頂点の並び
      const first = t[0].slice().sort();
      const second = first.map(function (v) { return t[1][t[0].indexOf(v)]; });
      if (this.type === 'fill') {
        out.tri = this.cards.tripair.find(function (c) { return V().checkTriangles(p, c.t1, c.t2).ok; }).id;
      } else if (this.type === 'build') {
        out.t1 = this.cards.tri1.find(function (c) { return c.tri.join('') === first.join(''); }).id;
        out.t2 = this.cards.tri2.find(function (c) { return c.tri.join('') === second.join(''); }).id;
      } else {
        out.tri = '△' + first.join('') + '/△' + second.join('');
      }
      if (this.type !== 'fill') out.fr = this.cards.freason.find(function (c) { return c.reason === PH.finalReasonFor(p); }).id;
      out.fe = this.type === 'challenge' ? p.finalStep.items.join('=')
        : this.cards.final.find(function (c) { return c.text === p.finalStep.label; }).id;
    }
    // Ver.0.7：多段階証明のステップ
    this.preSteps.concat(this.postSteps).forEach(function (st) {
      self.stepSlots(st).forEach(function (x) {
        if (x.input) { out[x.id] = st.items.join('='); return; }
        out[x.id] = self.cards[x.kind].find(function (c) { return c.correct; }).id;
      });
    });
    return out;
  };

  PH.Puzzle = Puzzle;
  PH.puzzleUtil = { reasonText: reasonText, reasonAccepts: reasonAccepts, splitEquation: splitEquation, inputCard: inputCard, inputTriangles: inputTriangles };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Puzzle: Puzzle };
})(typeof window !== 'undefined' ? window : globalThis);
