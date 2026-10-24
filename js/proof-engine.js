/*
 * proof-engine.js — 多段階証明のステップと証明済みの事実の管理（Ver.0.7。DOMに依存しない）
 *
 * 新しい多段階証明の問題は、従来のデータ（evidence・congruence・finalStep）に proofSteps を加える。
 *   proofSteps: [
 *     { id, type: 'theorem',    stage: 'pre'|'post', rule, premise: [左辺, 右辺], premiseLabel, items | triangle, label, dependsOn },
 *     { id, type: 'expression', rule: 'angleAddition'|'angleSubtraction'|'triangleAngleSum', target, parts, value, premiseLabel, note?, label, dependsOn },
 *     { id, type: 'compare',    dependsOn: [式のステップ2つ], items, label, distractors },
 *   ]
 *   evidence の fromStep … そのステップで導いた事実を、合同の根拠に使う（reason: 'proved'）
 *   dependsOn の 'final' … 合同から結論を導いたあとに解けるステップ（例：2つの角が等しいので二等辺三角形）
 *   Ver.0.9：平行四辺形の問題では、parallelogram.evidence（平行四辺形の根拠）の fromStep も、そのステップで導いた事実を使う。
 *     定理のステップに平行四辺形の性質（quad：仮定の平行四辺形）・等しい線分の半分（halfSegments）が加わる。
 *     lead … パネル・パズルでの書き出し（なければ「premiseLabelより、」）、proofText … 証明文での理由の書き方（{s1} はそのステップの番号）
 *
 *   Ver.1.0：ひし形・長方形の問題のステップ（隣り合う角の和・平行線の錯角・角の二等分線・角をつなぐ・二等辺三角形の2辺）。
 *     四角形の種類（{ kind: 'quadrilateralType', vertices, type }）も証明済みの事実として登録できる（establishType）。
 *     正方形と登録すれば、長方形・ひし形・平行四辺形としても使える（hasType）。より特別な種類へは、勝手に変換しない。
 *
 * 進む順番（ハンター）：三角形の選択（あれば）→ 3つの根拠（前半のステップ（stage 'pre'）は、導く根拠を「詳しい理由を説明する」で解く）
 *   → 合同条件 → 最終結論 → 後半のステップ（'post'）。証明パズル・証明文は、前半のステップの行 → 根拠の行の順
 * ステップの状態：locked（前提がまだない）／ available（解ける）／ completed（証明した）。
 * 依存関係のないステップどうし（独立した式など）は、どの順番で解いてもよい。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function G() { return PH.geometry; }
  function V() { return PH.validation; }

  const STAGES = ['final', 'congruence'];   // ステップ以外に依存先として書ける段階
  const EXPRESSION_RULES = ['angleAddition', 'angleSubtraction', 'triangleAngleSum'];   // 角の式のステップのルール
  // Ver.0.9：平行四辺形の性質を使う定理のステップのルール
  const PARALLELOGRAM_RULES = ['parallelogramOppositeSidesParallel', 'parallelogramOppositeSidesEqual', 'parallelogramOppositeAnglesEqual', 'parallelogramDiagonalsBisect'];

  function quadEvidence(problem) { return (problem.parallelogram && problem.parallelogram.evidence) || []; }

  function hasSteps(problem) { return Array.isArray(problem.proofSteps) && problem.proofSteps.length > 0; }

  function stepsOf(problem, stage) {
    return (problem.proofSteps || []).filter(function (s) { return (s.stage || 'pre') === stage; });
  }

  // ステップの結論の等式キー（等式でないもの（二等辺三角形）は null。平行の関係（rel: 'parallel'）は平行のキー）
  function factKey(problem, step) {
    const fig = problem.figure;
    if (step.type === 'expression') return null;       // 角の式は「式」として扱う（等式キーにしない）
    if (!step.items) return null;
    if (step.rel === 'parallel') return PH.parallelogram ? PH.parallelogram.factKey(fig, step.items, 'parallel') : null;
    const k = step.items.map(function (n) { return G().elementKey(fig, n); });
    return V().equationKey(k[0], k[1]);
  }

  function ProofEngine(problem) {
    this.problem = problem;
    this.steps = problem.proofSteps || [];
    this.reset();
  }

  ProofEngine.prototype.reset = function () {
    this.done = {};            // ステップID → true（証明した）
    this.reached = {};         // 'congruence' / 'final' → true
    this.facts = {};           // 等式キー → 導いたステップID（証明済みの事実）
    this.types = {};           // Ver.1.0：四角形のキー → { kind: 'quadrilateralType', vertices, type, types（包含関係で言える種類） }
    // 仮定で分かっている四角形の種類（「四角形ABCDは平行四辺形」「…はひし形」）
    const S = PH.specialQuad;
    const self = this;
    if (S && this.problem) S.knownQuads(this.problem).forEach(function (x) { x.types.forEach(function (t) { self.establishType(x.vertices, t, 'given'); }); });
  };

  /*
   * 四角形の種類を、証明済みの事実として登録する（Ver.1.0）。包含関係で、より一般的な種類としても使える
   *   （正方形 → 長方形・ひし形・平行四辺形）。より特別な種類には変換しない（平行四辺形 → ひし形 にはならない）
   */
  ProofEngine.prototype.establishType = function (vertices, type, source) {
    const S = PH.specialQuad;
    if (!S || !S.isType(type)) return false;
    const key = S.quadKey(vertices);
    if (!key) return false;
    const cur = this.types[key];
    const types = S.closeTypes((cur ? cur.types : []).concat([type]));
    this.types[key] = { kind: 'quadrilateralType', vertices: PH.quadrilateral.vertices(vertices), type: S.mostSpecific(types), types: types, source: cur ? cur.source : (source || true) };
    return true;
  };

  // その四角形が、その種類だと分かっているか（包含関係をふくむ）
  ProofEngine.prototype.hasType = function (vertices, type) {
    const S = PH.specialQuad;
    const x = S ? this.types[S.quadKey(vertices)] : null;
    return !!x && x.types.indexOf(type) >= 0;
  };

  // 登録した四角形の種類の事実の一覧
  ProofEngine.prototype.typeFacts = function () {
    const self = this;
    return Object.keys(this.types).map(function (k) {
      const x = self.types[k];
      return { kind: 'quadrilateralType', vertices: x.vertices.slice(), type: x.type, types: x.types.slice() };
    });
  };

  ProofEngine.prototype.step = function (id) {
    return this.steps.find(function (s) { return s.id === id; }) || null;
  };

  ProofEngine.prototype.depsMet = function (step) {
    const self = this;
    return (step.dependsOn || []).every(function (d) { return STAGES.indexOf(d) >= 0 ? self.reached[d] : self.done[d]; });
  };

  ProofEngine.prototype.status = function (id) {
    const s = this.step(id);
    if (!s) return null;
    if (this.done[id]) return 'completed';
    return this.depsMet(s) ? 'available' : 'locked';
  };

  ProofEngine.prototype.available = function (stage) {
    const self = this;
    return stepsOf(this.problem, stage).filter(function (s) { return self.status(s.id) === 'available'; });
  };

  ProofEngine.prototype.stageDone = function (stage) {
    const self = this;
    return stepsOf(this.problem, stage).every(function (s) { return self.done[s.id]; });
  };

  // ステップを証明した：前提が成り立っていなければ失敗（未証明の事実は使えない）
  ProofEngine.prototype.complete = function (id) {
    const s = this.step(id);
    if (!s || this.status(id) !== 'available') return false;
    this.done[id] = true;
    const k = factKey(this.problem, s);
    if (k) this.facts[k] = id;
    return true;
  };

  ProofEngine.prototype.reach = function (stage) { this.reached[stage] = true; };

  // 合同の根拠として使えるか（導いた事実を使う根拠は、そのステップを証明してから）
  ProofEngine.prototype.canUse = function (ev) {
    return !ev || !ev.fromStep || !!this.done[ev.fromStep];
  };

  ProofEngine.prototype.isProved = function (eqKey) { return !!this.facts[eqKey]; };

  /*
   * 証明済みの事実（establishedFacts）に登録する（Ver.0.8）。ステップ以外で確かめた事実
   * （例：直角の根拠 ∠ADB＝∠CEA＝90° を確かめた → 2つの三角形は直角三角形）を、あとの判定・表示に使う。
   */
  ProofEngine.prototype.establish = function (eqKey, source) {
    if (eqKey && !this.facts[eqKey]) this.facts[eqKey] = source || true;
  };

  ProofEngine.prototype.establishedFacts = function () { return Object.assign({}, this.facts); };

  // ---- データの検証 -----------------------------------------------------------------

  /*
   * proofSteps の検証（問題がなければ空配列）
   *   IDの重複・依存先の存在・循環参照、ルールと式の正しさ（図と仮定から言えるか）、
   *   式の比較から結論が導けるか、fromStep の根拠が導いた事実と同じか、最終結論まで到達できるか
   */
  function verify(problem) {
    const errors = [];
    const steps = problem.proofSteps || [];
    const ids = {};
    steps.forEach(function (s) {
      if (!s.id) errors.push('ステップにIDがない');
      if (ids[s.id]) errors.push('ステップIDが重複: ' + s.id);
      ids[s.id] = s;
    });
    steps.forEach(function (s) {
      (s.dependsOn || []).forEach(function (d) {
        if (!ids[d] && STAGES.indexOf(d) < 0) errors.push(s.id + ': 依存先がない ' + d);
      });
    });
    // 循環参照（深さ優先探索）
    const state = {};
    function visit(id, path) {
      if (state[id] === 2) return;
      if (state[id] === 1) { errors.push('循環参照: ' + path.concat(id).join(' → ')); return; }
      state[id] = 1;
      ((ids[id] && ids[id].dependsOn) || []).forEach(function (d) { if (ids[d]) visit(d, path.concat(id)); });
      state[id] = 2;
    }
    Object.keys(ids).forEach(function (id) { visit(id, []); });
    if (errors.length) return errors;

    const R = PH.proofRules;
    steps.forEach(function (s) {
      try {
        if (s.type === 'theorem') {
          if (!R.RULES[s.rule]) { errors.push(s.id + ': 未定義のルール ' + s.rule); return; }
          let err = null;
          if (s.rule === 'isoscelesBaseAngles') err = R.checkIsoscelesBaseAngles(problem, s.premise, s.items);
          else if (s.rule === 'isoscelesConverse') err = R.checkIsoscelesConverse(problem, s.premise, s.triangle);
          else if (PARALLELOGRAM_RULES.indexOf(s.rule) >= 0) err = R.checkParallelogramProperty(problem, s);
          else if (s.rule === 'parallelTransitive' || s.rule === 'equalTransitive') {
            err = R.checkTransitive(problem, s, (s.dependsOn || []).map(function (d) { return ids[d]; }).filter(Boolean));
          } else if (s.rule === 'segmentSubtraction') {
            err = R.checkSegmentSubtraction(problem, s);
            // 式を選ぶ形式（choices）なら、正解（先頭）が「EB＝AB－AE、DF＝DC－FC」の形であること
            if (s.choices) {
              const want = s.items.map(function (r0, i) { return r0 + '＝' + s.premise[i] + '－' + s.subtract[i]; }).join('、');
              if (s.choices[0] !== want) errors.push(s.id + ': choices の正解が線分の差の式になっていない: ' + want);
              if (new Set(s.choices).size !== s.choices.length || s.choices.length < 3) errors.push(s.id + ': choices は異なる3つ以上');
            }
            const pk = s.premise.map(function (n) { return G().elementKey(problem.figure, n); });
            const dep = (s.dependsOn || []).map(function (d) { return ids[d]; }).filter(Boolean);
            if (!dep.some(function (d) { return factKey(problem, d) === V().equationKey(pk[0], pk[1]); })) errors.push(s.id + ': 前提の等式を導くステップに依存していない');
          } else if (s.rule === 'alternateAnglesParallel') {
            // 後半のステップ：合同から導いた錯角の等しさ（最終結論）から、2直線は平行（p35）
            err = PH.parallelogram ? PH.parallelogram.checkConverse(problem.figure, s.lines || [], s.premise, 'alternate') : '平行の判定がない';
            const fk = problem.finalStep && problem.finalStep.items.map(function (n) { return G().elementKey(problem.figure, n); });
            const pk = s.premise.map(function (n) { return G().elementKey(problem.figure, n); });
            if (!fk || V().equationKey(fk[0], fk[1]) !== V().equationKey(pk[0], pk[1])) errors.push(s.id + ': 前提が最終結論と一致しない');
            if ((s.dependsOn || []).indexOf('final') < 0) errors.push(s.id + ': 最終結論のあとに解くステップなのに dependsOn に final がない');
            if (s.label !== (s.lines || []).join('∥')) errors.push(s.id + ': label が平行の関係と一致しない');
          } else if (s.rule === 'parallelogramAdjacentSupplementary') err = R.checkAdjacentSupplementary(problem, s);
          else if (s.rule === 'parallelAlternateAngles') err = R.checkParallelAlternate(problem, s);
          else if (s.rule === 'angleBisector') err = R.checkAngleBisector(problem, s);
          else if (s.rule === 'isoscelesConverseSides') err = R.checkIsoscelesConverseSides(problem, s);
          else if (s.rule === 'angleTransitive') err = R.checkTransitive(problem, s, (s.dependsOn || []).map(function (d) { return ids[d]; }).filter(Boolean));
          else if (s.rule === 'foldAngles') err = R.checkFold(problem, s);
          else if (s.rule === 'linearPairRightAngle') {
            // 後半のステップ：合同から導いた角の等しさ（最終結論）から、2直線は垂直（p47）
            err = R.checkLinearPair(problem, s);
            const fk = problem.finalStep && problem.finalStep.items.map(function (n) { return G().elementKey(problem.figure, n); });
            const pk = s.premise.map(function (n) { return G().elementKey(problem.figure, n); });
            if (!fk || V().equationKey(fk[0], fk[1]) !== V().equationKey(pk[0], pk[1])) errors.push(s.id + ': 前提が最終結論と一致しない');
            if ((s.dependsOn || []).indexOf('final') < 0) errors.push(s.id + ': 最終結論のあとに解くステップなのに dependsOn に final がない');
            if (s.label !== (s.lines || []).join('⊥')) errors.push(s.id + ': label が垂直の関係と一致しない');
          }
          else if (s.rule === 'halfSegments') {
            err = R.checkHalfSegments(problem, s);
            // 前提（等しい2つの線分）は、依存するステップの結論であること
            const pk = s.premise.map(function (n) { return G().elementKey(problem.figure, n); });
            const dep = (s.dependsOn || []).map(function (d) { return ids[d]; }).filter(Boolean);
            if (!dep.some(function (d) { return factKey(problem, d) === V().equationKey(pk[0], pk[1]); })) errors.push(s.id + ': 前提の等式を導くステップに依存していない');
          }
          else err = '定理のステップで使えないルール: ' + s.rule;
          if (err) errors.push(s.id + ': ' + err);
          if (s.rule === 'isoscelesConverse' && (s.stage || 'pre') === 'post' && PH.isGoalOnly(problem)) {
            // 合同を使わない問題（p50）：前提（2つの角が等しい）は、集めた根拠（ステップで導いた等式）であること
            const pk = s.premise.map(function (n) { return G().elementKey(problem.figure, n); });
            const ev = problem.evidence.find(function (e) { const k = e.items.map(function (n) { return G().elementKey(problem.figure, n); }); return V().equationKey(k[0], k[1]) === V().equationKey(pk[0], pk[1]); });
            if (!ev) errors.push(s.id + ': 前提が集める根拠と一致しない');
            else if (ev.fromStep && (s.dependsOn || []).indexOf(ev.fromStep) < 0) errors.push(s.id + ': 前提を導くステップに依存していない');
          } else if (s.rule === 'isoscelesConverse' && (s.stage || 'pre') === 'post') {
            // 前提（2つの角が等しい）は、合同から導いた最終結論であること
            const fk = problem.finalStep && problem.finalStep.items.map(function (n) { return G().elementKey(problem.figure, n); });
            const pk = s.premise.map(function (n) { return G().elementKey(problem.figure, n); });
            if (!fk || V().equationKey(fk[0], fk[1]) !== V().equationKey(pk[0], pk[1])) errors.push(s.id + ': 前提が最終結論と一致しない');
            if ((s.dependsOn || []).indexOf('final') < 0) errors.push(s.id + ': 最終結論のあとに解くステップなのに dependsOn に final がない');
          }
        } else if (s.type === 'expression') {
          if (EXPRESSION_RULES.indexOf(s.rule) < 0) errors.push(s.id + ': 角の式のルールが不正');
          const err = R.checkExpression(problem, s);
          if (err) errors.push(s.id + ': ' + err);
        } else if (s.type === 'compare') {
          const deps = (s.dependsOn || []).map(function (d) { return ids[d]; });
          if (deps.length !== 2 || deps.some(function (d) { return !d || d.type !== 'expression'; })) {
            errors.push(s.id + ': 式の比較は、角の式のステップ2つに依存する');
            return;
          }
          const got = R.compareExpressions(problem, deps[0], deps[1]);
          if (!got) { errors.push(s.id + ': 2つの式の右辺が同じではない'); return; }
          const want = s.items.map(function (n) { return G().elementKey(problem.figure, n); });
          if (V().equationKey(got[0], got[1]) !== V().equationKey(want[0], want[1])) errors.push(s.id + ': 比較の結論が式から導けない');
          (s.distractors || []).forEach(function (d) {
            const it = String(d).split('＝');
            const k = it.map(function (n) { return G().elementKey(problem.figure, n); });
            if (V().equationKey(k[0], k[1]) === V().equationKey(want[0], want[1])) errors.push(s.id + ': 比較のダミーが正解と同じ ' + d);
            if (Math.abs(V().measure(problem.figure, it[0]).value - V().measure(problem.figure, it[1]).value) < 0.5) errors.push(s.id + ': 比較のダミーが図の上で等しい ' + d);
          });
        } else {
          errors.push(s.id + ': 未定義のステップの種類 ' + s.type);
        }
        if (!s.label) errors.push(s.id + ': label がない');
        if (!(problem.hints && problem.hints[s.id] && problem.hints[s.id].length === 3)) errors.push(s.id + ': ヒントが3段階ない');
      } catch (e) {
        errors.push(s.id + ': ' + (e && e.message || e));
      }
    });
    // 導いた事実を使う根拠：そのステップの結論と同じ等式であること（平行四辺形の根拠は js/parallelogram-rules.js で確かめる）
    problem.evidence.forEach(function (ev) {
      if (!ev.fromStep) return;
      const s = ids[ev.fromStep];
      if (!s) { errors.push(ev.id + ': fromStep のステップがない'); return; }
      if ((s.stage || 'pre') !== 'pre') errors.push(ev.id + ': 合同の根拠は前半のステップで導くこと');
      const fk = factKey(problem, s);
      const ek = ev.items.map(function (n) { return G().elementKey(problem.figure, n); });
      if (fk !== V().equationKey(ek[0], ek[1])) errors.push(ev.id + ': 導いた事実と根拠の等式が一致しない');
      if (ev.reason !== 'proved') errors.push(ev.id + ': 導いた事実を使う根拠の理由は proved');
    });
    // 最終結論まで到達できるか（順に解いていくと、すべてのステップを証明できる）
    const eng = new ProofEngine(problem);
    let guard = 0;
    while (eng.available('pre').length && guard++ < 100) eng.complete(eng.available('pre')[0].id);
    if (!eng.stageDone('pre')) errors.push('前半のステップをすべて証明できない');
    if (!problem.evidence.every(function (ev) { return eng.canUse(ev); })) errors.push('合同の根拠に、証明できない事実を使っている');
    if (!quadEvidence(problem).every(function (ev) { return eng.canUse(ev); })) errors.push('平行四辺形の根拠に、証明できない事実を使っている');
    eng.reach('congruence'); eng.reach('final');
    guard = 0;
    while (eng.available('post').length && guard++ < 100) eng.complete(eng.available('post')[0].id);
    if (!eng.stageDone('post')) errors.push('後半のステップをすべて証明できない');
    const last = stepsOf(problem, 'post').slice(-1)[0];
    if (last && last.label !== problem.conclusion) errors.push('最後のステップの結論と問題の結論が一致しない');
    return errors;
  }

  PH.ProofEngine = ProofEngine;
  PH.proofEngine = { hasSteps: hasSteps, stepsOf: stepsOf, factKey: factKey, verify: verify, STAGES: STAGES, PARALLELOGRAM_RULES: PARALLELOGRAM_RULES };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.proofEngine;
})(typeof window !== 'undefined' ? window : globalThis);
