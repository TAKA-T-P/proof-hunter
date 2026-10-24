/*
 * error-hunt-generator.js — 「証明の間違い探し」（Ver.1.1）の問題を、既存の正しい証明データから作る（DOM非依存）
 *
 * 証明全文はコピーして持たない。PH.buildProof(元の問題) の正しい証明を、論理ステップ（タップする単位）に分け、
 * 問題データ（js/error-hunt-data.js）の mutation が指す1つのステップだけを間違った内容に変える。元の問題データは変更しない。
 *
 *   PH.errorHunt.structure(problem)   … 正しい証明の論理ステップ [{ id, kind, lead?, reason?, chain?, body, tail?, no? }]
 *   PH.errorHunt.build(def)           … { def, problem, steps（間違いを1つふくむ）, correctSteps, target, wrong, right }
 *   PH.errorHunt.verify(def)          … 問題データの誤り（文字列の配列。空なら正しい）
 *   PH.errorHunt.stepText(step)       … 1ステップの文（表示・比較用）
 *
 * ステップの ID（安定）：intro / e1… （根拠の行）/ s:<ステップID>（多段階証明の行）/ condition（「①、②、③より、…ので、」）
 *   / conclusion（△…≡△…）/ final（したがって、…）/ post:<ステップID> / q-intro… / q:<根拠ID> / qs:<ステップID>
 *   / q-condition / q-conclusion（平行四辺形の部分）
 *
 * mutation：{ target: ステップID, field: 'reason' | 'body' | 'condition', ... }
 *   reason    … reason: 理由ID（PH.REASONS）または rule: 推論ルールID（PH.proofRules。多段階証明・後半のステップ）
 *   body      … items: ['AB', 'AC']（等式）/ value: '∠ACD＋90°'（角の式の□）/ triangles: ['ABC', 'ACD']（合同の三角形）
 *   condition … condition: 合同条件ID・平行四辺形の成立条件ID、または text: 成立条件ではない文
 * 誤りの種類ごとに、既存の判定（validation.checkEvidence・deriveCondition・checkTriangles など）と図の座標で、
 * 変えたステップが本当に誤りであることを確かめる（verify）。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  // 誤りの種類（ヒントは正解の行を直接教えない）
  const CATEGORIES = {
    wrongEquation:       { label: '等式の間違い', hint: '理由だけでなく、等式の左と右が本当に等しいか、図と仮定で確かめよう！' },
    wrongReason:         { label: '理由の間違い', hint: '等式は正しそうかな？ その等式を言うための「理由」が合っているか確かめよう！' },
    wrongCongruence:     { label: '合同条件の間違い', hint: '集めた根拠（辺・角の等しさ）と、合同条件を見比べてみよう！' },
    wrongCorrespondence: { label: '頂点の対応の間違い', hint: '合同な三角形の頂点の順番に注目しよう！ 等しい辺・角から、どの頂点が対応するかな？' },
    wrongLogicalOrder:   { label: '論理の順序の間違い', hint: 'その時点で、もう分かっていること（証明できていること）だけを使っているかな？ 証明の順番に注目しよう！' },
    wrongTheorem:        { label: '定理・条件の間違い', hint: '使っている図形の性質や条件の向き（「〜ならば〜」）が正しいか確かめよう！' },
  };

  // 単元（問題一覧の分類）
  const UNITS = [
    { id: 'basic', label: '基本の合同証明' },
    { id: 'conclusion', label: '合同から結論を導く' },
    { id: 'triangle', label: '三角形の性質・直角三角形' },
    { id: 'quadrilateral', label: '平行四辺形・特別な平行四辺形' },
  ];

  // 証明する四角形の、特別な平行四辺形としての性質（証明する前には使えない）
  const TYPE_PROPERTIES = { rhombus: ['rhombusSides', 'rhombusAngles'], rectangle: ['rectangleSides', 'rectangleAngles'] };

  function condTail(label) { return (/(平行|直角)$/.test(label) ? 'な' : '') + 'ので、'; }

  // ---- 正しい証明を論理ステップに分ける -------------------------------------------

  function structure(problem) {
    const pr = PH.buildProof(problem);
    const steps = [];
    if (pr.intro) steps.push({ id: 'intro', kind: 'intro', body: pr.intro });
    pr.lines.forEach(function (l) {
      steps.push({ id: l.evidenceId, kind: 'evidence', reason: l.reason, body: l.equation, no: l.no, ref: l.evidenceId });
    });
    // 平行四辺形だけの問題は、ステップの行を平行四辺形の部分で書く（pr.intro がない）
    if (pr.intro) {
      pr.stepLines.forEach(function (l) {
        steps.push({ id: 's:' + l.stepId, kind: 'step', reason: l.reason, body: l.equation, no: l.no, ref: l.stepId });
      });
    }
    if (pr.condition) {
      steps.push({ id: 'condition', kind: 'condition', lead: pr.summary, body: pr.condition, tail: 'ので、' });
      steps.push({ id: 'conclusion', kind: 'conclusion', body: pr.conclusion });
    }
    if (pr.final) {
      steps.push({ id: 'final', kind: 'final', lead: pr.final.lead, reason: pr.final.reason + '、', body: pr.final.conclusion, no: pr.final.no || null });
    }
    pr.post.forEach(function (l) {
      steps.push({ id: 'post:' + l.stepId, kind: 'post', reason: l.reason, body: l.conclusion, ref: l.stepId });
    });
    if (pr.quad) {
      const q = pr.quad;
      q.intro.filter(Boolean).forEach(function (t, i) { steps.push({ id: 'q-intro' + (i ? i + 1 : ''), kind: 'intro', body: t }); });
      q.lines.forEach(function (l) {
        steps.push({ id: 'q:' + l.evidenceId, kind: 'qevidence', reason: l.reason, body: l.equation, no: l.no, ref: l.evidenceId });
      });
      q.stepLines.forEach(function (l) {
        steps.push({ id: 'qs:' + l.stepId, kind: 'step', reason: l.reason, body: l.equation, no: l.no, ref: l.stepId });
      });
      steps.push({ id: 'q-condition', kind: 'qcondition', lead: q.summary, chain: q.chain, body: q.condition, tail: condTail(q.condition) });
      steps.push({ id: 'q-conclusion', kind: 'conclusion', body: q.conclusion });
    }
    return steps;
  }

  function stepText(s) {
    return (s.lead || '') + (s.reason ? s.reason + ' ' : '') + (s.chain ? s.chain + ' ' : '') + s.body + (s.tail || '') + (s.no ? ' ……' + s.no : '');
  }

  // ---- 1つのステップを間違った内容に変える ----------------------------------------------

  function proofStep(problem, id) { return (problem.proofSteps || []).find(function (s) { return s.id === id; }) || null; }
  function evidenceOf(problem, step) {
    const list = step.kind === 'qevidence' ? problem.parallelogram.evidence : problem.evidence;
    return list.find(function (ev) { return ev.id === step.ref; }) || null;
  }
  function conditionLabel(id) {
    if (PH.CONDITIONS[id]) return PH.CONDITIONS[id].label;
    const q = PH.quadCondition && PH.quadCondition(id);
    return q ? q.label : null;
  }

  // 理由の文：根拠の行は「AB∥CDより、」のような前置きを残して理由だけ変える。ステップの行は推論ルールの文を差しかえる
  function reasonText(problem, step, m) {
    if (m.rule) {
      const ps = proofStep(problem, step.ref);
      return ps ? step.reason.replace(PH.proofRules.label(ps.rule), PH.proofRules.label(m.rule)) : null;
    }
    if (!PH.REASONS[m.reason]) return null;
    if (step.kind === 'final') return PH.REASONS[m.reason].proof + '、';
    const ev = evidenceOf(problem, step);
    const base = ev ? PH.REASONS[ev.reason].proof : '';
    const prefix = base && step.reason.slice(-base.length) === base ? step.reason.slice(0, -base.length) : '';
    return prefix + PH.REASONS[m.reason].proof;
  }

  function bodyText(problem, step, m) {
    if (m.items) return m.items[0] + (step.kind === 'qevidence' && evidenceOf(problem, step).rel === 'parallel' ? '∥' : '＝') + m.items[1];
    if (m.triangles) return '△' + m.triangles[0] + '≡△' + m.triangles[1];
    if (m.value) {
      const ps = proofStep(problem, step.ref);
      return ps ? ps.target + '＝' + ps.parts + '＝' + m.value : null;
    }
    return null;
  }

  function mutate(problem, step, m) {
    const out = Object.assign({}, step);
    if (m.field === 'reason') out.reason = reasonText(problem, step, m);
    else if (m.field === 'body') out.body = bodyText(problem, step, m);
    else if (m.field === 'condition') {
      out.body = m.text || conditionLabel(m.condition);
      if (step.kind === 'qcondition') out.tail = condTail(out.body);
    }
    return out;
  }

  function build(def) {
    const problem = PH.getProblem(def.source);
    if (!problem) return null;
    const correctSteps = structure(problem);
    const target = correctSteps.find(function (s) { return s.id === def.mutation.target; });
    if (!target) return null;
    const wrong = mutate(problem, target, def.mutation);
    return {
      def: def, problem: problem, correctSteps: correctSteps, target: def.mutation.target,
      steps: correctSteps.map(function (s) { return s.id === target.id ? wrong : s; }),
      wrong: wrong, right: target,
    };
  }

  // ---- 検証：変えたステップが本当に誤りか ------------------------------------------------

  function keysOf(problem, items) { return items.map(function (n) { return PH.geometry.elementKey(problem.figure, n); }); }

  // 図の座標で測って等しいか（図の整合性の確認だけに使う。ゲームの正誤判定には使わない）
  function measuredEqual(problem, a, b) {
    const m1 = PH.validation.measure(problem.figure, a), m2 = PH.validation.measure(problem.figure, b);
    if (m1.kind !== m2.kind) return false;
    return m1.kind === 'ang' ? Math.abs(m1.value - m2.value) < 1.5 : Math.abs(m1.value - m2.value) < Math.max(2, 0.02 * Math.max(m1.value, m2.value));
  }

  function verify(def) {
    const errors = [];
    const err = function (t) { errors.push(def.id + ': ' + t); };
    const problem = PH.getProblem(def.source);
    if (!problem) { err('元の問題がない ' + def.source); return errors; }
    if (!CATEGORIES[def.category]) err('誤りの種類が不明 ' + def.category);
    if (!UNITS.some(function (u) { return u.id === def.unit; })) err('単元が不明 ' + def.unit);
    if (!def.explain) err('解説がない');
    const b = build(def);
    if (!b) { err('変更するステップがない ' + def.mutation.target); return errors; }
    const m = def.mutation;
    const step = b.right;
    const wrongText = stepText(b.wrong);
    if (!b.wrong.body || (b.wrong.reason === null) || wrongText.indexOf('null') >= 0 || wrongText.indexOf('undefined') >= 0) err('間違いの文を作れない');
    if (wrongText === stepText(step)) err('文が変わっていない');
    // 変えたのは1つのステップだけ（ほかのステップは正しい証明のまま）
    const changed = b.steps.filter(function (s, i) { return stepText(s) !== stepText(b.correctSteps[i]); });
    if (changed.length !== 1 || changed[0].id !== step.id) err('変わったステップが1つではない');

    const ev = (step.kind === 'evidence' || step.kind === 'qevidence') ? evidenceOf(problem, step) : null;
    const reasonWrongForEvidence = function () {
      if (step.kind === 'evidence') {
        const st = PH.validation.checkEvidence(problem, keysOf(problem, ev.items), m.reason, []).status;
        if (st !== 'wrong-reason') err('その理由でも正しくなってしまう（' + st + '）');
      } else if (PH.acceptedReasons(ev).indexOf(m.reason) >= 0) err('その理由でも正しくなってしまう');
    };

    switch (def.category) {
      case 'wrongEquation':
        if (m.field !== 'body') { err('等式の間違いは body を変える'); break; }
        if (m.items && ev) {
          if (step.kind === 'evidence') {
            const st = PH.validation.checkEvidence(problem, keysOf(problem, m.items), ev.reason, []).status;
            if (st === 'correct' || st === 'irrelevant') err('間違いの等式が、その理由で言えてしまう');
          }
          if (measuredEqual(problem, m.items[0], m.items[1])) err('間違いの等式が、図の上で等しい（まぎらわしい）');
        } else if (m.items && step.kind === 'final') {
          const k = keysOf(problem, m.items), f = keysOf(problem, problem.finalStep.items);
          if (PH.validation.equationKey(k[0], k[1]) === PH.validation.equationKey(f[0], f[1])) err('結論と同じ等式');
          if (PH.validation.classifyPair(problem, k)) err('間違いの等式が、合同から言えてしまう');
          if (measuredEqual(problem, m.items[0], m.items[1])) err('間違いの等式が、図の上で等しい');
        } else if (m.value && step.kind === 'step') {
          const ps = proofStep(problem, step.ref);
          const AE = PH.angleExpr;
          const w = AE.parse(problem.figure, m.value), r = AE.parse(problem.figure, ps.value);
          if (!w || AE.equal(w, r)) err('間違いの式が、正しい式と同じ');
          else if (Math.abs(AE.evaluate(problem.figure, m.value) - AE.evaluate(problem.figure, ps.target)) < 1.5) err('間違いの式が、図の上で成り立つ');
        } else err('等式の間違いを確かめられない');
        break;
      case 'wrongReason':
        if (m.field !== 'reason') { err('理由の間違いは reason を変える'); break; }
        if (ev) reasonWrongForEvidence();
        else if (step.kind === 'final') {
          if (m.reason === PH.finalReasonFor(problem)) err('その理由でも正しくなってしまう');
        } else err('理由の間違いを確かめられない');
        break;
      case 'wrongCongruence':
        if (step.id !== 'condition' || !PH.CONDITIONS[m.condition]) { err('合同条件の間違いは condition に合同条件のID'); break; }
        if (m.condition === PH.validation.deriveCondition(problem, problem.evidence) || m.condition === problem.congruence) err('根拠から導ける合同条件');
        break;
      case 'wrongCorrespondence': {
        if (step.id !== 'conclusion' || !m.triangles) { err('頂点の対応の間違いは conclusion の triangles'); break; }
        const t1 = m.triangles[0].split(''), t2 = m.triangles[1].split('');
        const st = PH.validation.checkTriangles(problem, t1, t2).status;
        if (st !== 'order') err('同じ三角形の組で、頂点の対応だけがちがう、になっていない（' + st + '）');
        // 図の上でも、その対応では合同にならない（対称な図で別の対応が成り立つものは使わない）
        const sides = [[0, 1], [1, 2], [0, 2]];
        if (sides.every(function (s) { return measuredEqual(problem, t1[s[0]] + t1[s[1]], t2[s[0]] + t2[s[1]]); })) err('その対応でも図の上で合同になる');
        break;
      }
      case 'wrongLogicalOrder':
        if (m.field !== 'reason' || !ev) { err('論理の順序の間違いは、根拠の行の理由を変える'); break; }
        if (step.kind === 'evidence') {
          // 合同を示す前に「合同な図形の対応する辺・角」を使う
          if (!(PH.REASONS[m.reason] || {}).finalOnly) err('合同を証明したあとの理由ではない');
        } else {
          // 証明する四角形の、特別な平行四辺形としての性質を先に使う
          if ((TYPE_PROPERTIES[PH.quadType(problem)] || []).indexOf(m.reason) < 0) err('証明する四角形の性質ではない');
        }
        reasonWrongForEvidence();
        break;
      case 'wrongTheorem':
        if (m.field === 'reason' && m.rule) {
          const ps = proofStep(problem, step.ref);
          if (!ps || ps.rule === m.rule || !PH.proofRules.label(m.rule)) err('ちがう推論ルールになっていない');
          else if (b.wrong.reason === step.reason) err('推論ルールの文を差しかえられない');
        } else if (m.field === 'condition' && step.kind === 'qcondition') {
          const pz = problem.parallelogram;
          if (m.condition) {
            if (m.condition === pz.condition || (pz.alternatives || []).indexOf(m.condition) >= 0) err('根拠から言える成立条件');
          } else {
            const labels = Object.keys(PH.PARALLELOGRAM_CONDITIONS).map(function (k) { return PH.PARALLELOGRAM_CONDITIONS[k].label; })
              .concat(Object.keys(PH.SPECIAL_CONDITIONS || {}).map(function (k) { return PH.SPECIAL_CONDITIONS[k].label; }));
            if (labels.indexOf(m.text) >= 0) err('正しい成立条件の文になっている');
          }
        } else err('定理・条件の間違いを確かめられない');
        break;
    }
    return errors;
  }

  function verifyAll(defs) {
    const errors = [];
    const ids = {};
    defs.forEach(function (d) {
      if (ids[d.id]) errors.push('問題IDの重複 ' + d.id);
      ids[d.id] = true;
      verify(d).forEach(function (e) { errors.push(e); });
    });
    return errors;
  }

  PH.errorHunt = {
    CATEGORIES: CATEGORIES,
    UNITS: UNITS,
    structure: structure,
    stepText: stepText,
    build: build,
    verify: verify,
    verifyAll: verifyAll,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.errorHunt;
})(typeof window !== 'undefined' ? window : globalThis);
