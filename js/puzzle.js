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
    const labels = problem.evidence.map(function (e) { return e.label; })
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
    // 根拠に使う理由（根拠専用の書き方があればそれを使う）
    const specificReasons = {};
    problem.evidence.forEach(function (ev) {
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
      if (specificReasons[r] || !PH.REASONS[r]) return;
      add({ kind: 'reason', reason: r, text: PH.REASONS[r].proof, specific: false });
    });
    return shuffle(out, problem.id + ':reason').map(function (c, i) { c.id = 'r' + i; return c; });
  }

  function makeConditionCards() {
    return PH.CONDITION_ORDER.map(function (c, i) {
      return { id: 'c' + i, kind: 'cond', cond: c, text: PH.CONDITIONS[c].label };
    });
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
    this.cards = {
      eq: this.type === 'challenge' ? [] : makeEquationCards(problem),   // チャレンジでは等式カードを出さない
      reason: this.buildLike ? makeReasonCards(problem) : [],
      cond: makeConditionCards(),
    };
    this.cardById = {};
    const self = this;
    ['eq', 'reason', 'cond'].forEach(function (k) {
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
   */
  Puzzle.prototype.makeSlots = function () {
    const p = this.problem;
    const slots = [];
    p.evidence.forEach(function (ev, i) {
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
    return slots;
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
    if (!s || s.input) return [];             // チャレンジの等式はキーパッドで入力
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
    if (id === 'input') return inputCard(this.problem, this.inputs[slotId]);
    return id ? this.cardById[id] : null;
  };

  // 根拠の行ごとの理由（fill は表示済みの理由、build・challenge は理由カード）
  Puzzle.prototype.rowReason = function (row) {
    if (this.buildLike) return this.cardIn('r' + row);
    return this.slots[row].fixed;
  };

  Puzzle.prototype.eqSlotId = function (row) {
    return (this.buildLike ? 'e' : 's') + row;
  };

  /*
   * 根拠の各行の判定（入っていないところは 'empty'）。
   *   ok / empty / wrong-reason（等式は根拠だが理由が合わない）/ duplicate（同じ根拠を2回）
   *   / from-conclusion / not-common / wrong-equation / irrelevant（正しいが今回は使わない）
   */
  Puzzle.prototype.evaluateRows = function () {
    const p = this.problem;
    const used = {};
    const rows = [];
    for (let i = 0; i < p.evidence.length; i++) {
      const eqCard = this.cardIn(this.eqSlotId(i));
      const reason = this.rowReason(i);
      const row = { row: i, status: 'ok', evidence: null, eqCard: eqCard, reason: reason };
      if (!eqCard) {
        row.status = 'empty';
      } else if (!eqCard.keys) {
        row.status = 'wrong-equation';          // 図の上で角にならない入力など
      } else {
        const ev = V().matchEvidence(p, eqCard.keys);
        row.evidence = ev;
        if (!ev) row.status = V().equationStatus(p, eqCard.keys);
        else if (!reason) row.status = 'empty';
        else if (!reasonAccepts(reason, ev)) row.status = 'wrong-reason';
        else if (used[ev.id]) row.status = 'duplicate';
        else used[ev.id] = true;
      }
      rows.push(row);
    }
    return rows;
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

    function fail(slotId, signature, text, label) {
      slotStatus[slotId] = 'ng';
      messages.push({ slotId: slotId, label: label, text: text });
      if (!self.counted[signature]) {
        self.counted[signature] = true;
        newMisses++;
      }
    }

    const challenge = this.type === 'challenge';
    const MSG = {
      wrongReason: '等式は合っているよ！ 理由をもう一度考えてみよう。',
      duplicate: '同じ根拠が2回使われているよ！',
      fromConclusion: challenge ? 'それは合同が証明できてから使える関係だよ！'
        : 'それは' + p.conclusion + 'が証明できたら言えることだよ！ 結論はまだ根拠に使えないよ。',
      wrongEquation: challenge ? 'その2つが等しいと言えるか、図と仮定を確認しよう。' : 'この等式は、まだ言えないよ！',
      cond: challenge ? '3つの根拠と合同条件の関係を確認しよう。' : 'この3つの根拠では、その合同条件は使えないよ！',
    };

    rows.forEach(function (r) {
      const eqId = self.eqSlotId(r.row);
      const rsId = self.buildLike ? 'r' + r.row : null;
      const label = (self.buildLike ? '根拠' : '') + CIRCLED[r.row];
      const sig = eqId + ':' + r.eqCard.id + (rsId ? '/' + self.placed[rsId] : '');
      switch (r.status) {
        case 'ok':
          slotStatus[eqId] = 'ok';
          if (rsId) slotStatus[rsId] = 'ok';
          break;
        case 'wrong-reason':
          if (self.buildLike) {
            slotStatus[eqId] = 'ok';
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
    const expected = allRowsOk ? V().deriveCondition(p, rows.map(function (r) { return r.evidence; })) : p.congruence;
    if (condCard.cond === expected) slotStatus.cond = 'ok';
    else fail('cond', 'cond:' + condCard.id + ':' + rows.map(function (r) { return r.eqCard.id; }).join(','),
      MSG.cond, '合同条件');

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
  };

  // ヒントの対象：まだ正しくそろっていない根拠（答え合わせで誤りがあった所・空欄を優先）、最後に合同条件
  Puzzle.prototype.hintTarget = function () {
    const p = this.problem;
    const rows = this.evaluateRows();
    const done = {};
    rows.forEach(function (r) { if (r.status === 'ok') done[r.evidence.id] = true; });
    const order = this.slots.filter(function (s) { return s.kind !== 'cond'; });
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (r.status === 'ok') continue;
      if (this.type === 'fill') {
        // 表示済みの理由で言える根拠のうち、まだ使っていないもの（同じ理由の行どうしは入れかえ可）
        const fixed = this.slots[i].fixed;
        const ev = p.evidence.find(function (e) { return !done[e.id] && reasonAccepts(fixed, e); });
        if (ev) return { id: ev.id, ev: ev, slotId: order[i].id };
      } else {
        const ev = p.evidence.find(function (e) { return !done[e.id]; });
        if (ev) return { id: ev.id, ev: ev, slotId: 'e' + i };
      }
    }
    return { id: 'congruence', ev: null, slotId: 'cond' };
  };

  Puzzle.prototype.hintList = function (target) {
    const p = this.problem;
    if (!target.ev) return (p.hints.congruence || []).map(function (h) { return { text: h.text, focus: [] }; });
    const ev = target.ev;
    const fig = p.figure;
    const keys = ev.items.map(function (n) { return G().elementKey(fig, n); });
    const name = function (n) { return G().isAngleName(n) ? n : '辺' + n; };
    const same = keys[0] === keys[1];
    const first = this.type === 'fill'
      ? '「' + reasonText(ev) + '」で言える等式を考えよう。' + REASON_HINT[ev.reason]
      : REASON_HINT[ev.reason];
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
    const order = rowsOrder || p.evidence.map(function (_, i) { return i; });
    const out = {};
    const findEq = function (ev) {
      const keys = ev.items.map(function (n) { return G().elementKey(p.figure, n); });
      const eq = V().equationKey(keys[0], keys[1]);
      return self.cards.eq.find(function (c) { return c.eq === eq; });
    };
    order.forEach(function (evIndex, row) {
      const ev = p.evidence[evIndex];
      out[self.eqSlotId(row)] = self.type === 'challenge' ? ev.items.join('=') : findEq(ev).id;
      if (self.buildLike) {
        out['r' + row] = self.cards.reason.find(function (c) { return reasonAccepts(c, ev); }).id;
      }
    });
    out.cond = this.cards.cond.find(function (c) { return c.cond === p.congruence; }).id;
    return out;
  };

  PH.Puzzle = Puzzle;
  PH.puzzleUtil = { reasonText: reasonText, reasonAccepts: reasonAccepts, splitEquation: splitEquation, inputCard: inputCard };

  if (typeof module !== 'undefined' && module.exports) module.exports = { Puzzle: Puzzle };
})(typeof window !== 'undefined' ? window : globalThis);
