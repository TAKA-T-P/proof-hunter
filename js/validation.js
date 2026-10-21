/*
 * validation.js — 数学的な正誤判定（問題データを参照する共通処理）
 *
 * checkEvidence    : 選んだ2要素＋理由が、この問題の有効な根拠かを判定
 * deriveCondition  : 根拠の組と三角形の対応から、成り立つ合同条件を導く
 * checkCongruence  : 選んだ合同条件が正しいかを判定
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function geo() { return PH.geometry; }

  // 等式のキー。左右を入れ替えても同じになる。
  function equationKey(k1, k2) {
    return [k1, k2].sort().join('=');
  }

  function keysOf(figure, items) {
    return items.map(function (n) { return geo().elementKey(figure, n); });
  }

  const cache = new WeakMap();

  // 問題ごとに、根拠・正しいが不要な関係・対応する辺/角 のキーを前計算
  function compiled(problem) {
    if (cache.has(problem)) return cache.get(problem);
    const fig = problem.figure;
    const evidence = problem.evidence.map(function (ev) {
      const keys = keysOf(fig, ev.items);
      return { ev: ev, keys: keys, eq: equationKey(keys[0], keys[1]) };
    });
    const extras = (problem.extraTruths || []).map(function (x) {
      const keys = keysOf(fig, x.items);
      return { item: x, keys: keys, eq: equationKey(keys[0], keys[1]) };
    });
    const parts = correspondingParts(problem);
    const c = { evidence: evidence, extras: extras, parts: parts };
    cache.set(problem, c);
    return c;
  }

  // 2つの三角形（対応順）の、対応する辺・角の組
  function correspondingParts(problem) {
    const fig = problem.figure;
    const t1 = problem.triangles[0];
    const t2 = problem.triangles[1];
    const parts = [];
    const sidePairs = [[0, 1], [1, 2], [0, 2]];
    sidePairs.forEach(function (ij) {
      const i = ij[0], j = ij[1];
      const k1 = geo().segKey(t1[i] + t1[j]);
      const k2 = geo().segKey(t2[i] + t2[j]);
      parts.push({ kind: 'side', idx: [i, j], keys: [k1, k2], eq: equationKey(k1, k2) });
    });
    [0, 1, 2].forEach(function (i) {
      const j = (i + 1) % 3, k = (i + 2) % 3;
      const k1 = geo().angleKey(fig, t1[j] + t1[i] + t1[k]);
      const k2 = geo().angleKey(fig, t2[j] + t2[i] + t2[k]);
      parts.push({ kind: 'angle', idx: [i], keys: [k1, k2], eq: equationKey(k1, k2) });
    });
    return parts;
  }

  // 等式（キー2つ）が、どの「対応する辺・角」にあたるか。対応していなければ null。
  // 向き（三角形1の要素が左か右か）も確認する。
  function classifyPair(problem, keys) {
    const parts = compiled(problem).parts;
    for (let n = 0; n < parts.length; n++) {
      const p = parts[n];
      if ((keys[0] === p.keys[0] && keys[1] === p.keys[1]) ||
          (keys[0] === p.keys[1] && keys[1] === p.keys[0])) {
        return p;
      }
    }
    return null;
  }

  /*
   * 根拠の判定
   *   keys     : 選んだ2要素のキー（共通な辺なら同じキーが2つ）
   *   reasonId : 選んだ理由
   *   foundIds : 登録済みの根拠ID
   * 戻り値 status:
   *   correct / duplicate / wrong-reason / irrelevant / from-conclusion / not-common / wrong-equation / incomplete
   */
  function checkEvidence(problem, keys, reasonId, foundIds) {
    if (!keys || keys.length !== 2 || !keys[0] || !keys[1] || !reasonId) {
      return { status: 'incomplete', miss: false };
    }
    const kind = keys[0].slice(0, 3) === 'ang' ? 'ang' : 'seg';
    const eq = equationKey(keys[0], keys[1]);
    const c = compiled(problem);
    const found = foundIds || [];

    const hit = c.evidence.find(function (e) { return e.eq === eq; });
    if (hit) {
      if (found.indexOf(hit.ev.id) >= 0) return { status: 'duplicate', miss: false, evidence: hit.ev, kind: kind };
      if (hit.ev.reason === reasonId) return { status: 'correct', miss: false, evidence: hit.ev, kind: kind };
      return { status: 'wrong-reason', miss: true, evidence: hit.ev, kind: kind };
    }

    const extra = c.extras.find(function (e) { return e.eq === eq; });
    if (extra) {
      if (extra.item.reason === reasonId) return { status: 'irrelevant', miss: false, kind: kind };
      return { status: 'wrong-reason', miss: true, kind: kind };
    }

    // 結論（合同）から導かれる関係は、まだ根拠に使えない
    if (classifyPair(problem, keys)) return { status: 'from-conclusion', miss: true, kind: kind };

    if (keys[0] === keys[1]) return { status: 'not-common', miss: true, kind: kind };
    return { status: 'wrong-equation', miss: true, kind: kind };
  }

  /*
   * 根拠の組から合同条件を導く。
   *   'SSS' 3組の辺 / 'SAS' 2組の辺とその間の角 / 'ASA' 1組の辺とその両端の角 / null 不成立
   */
  function deriveCondition(problem, evidenceList) {
    if (!evidenceList || evidenceList.length !== 3) return null;
    const fig = problem.figure;
    const sides = [];
    const angles = [];
    for (let n = 0; n < evidenceList.length; n++) {
      const keys = keysOf(fig, evidenceList[n].items);
      const part = classifyPair(problem, keys);
      if (!part) return null;
      const id = part.idx.join(',');
      if (part.kind === 'side') {
        if (sides.some(function (s) { return s.join(',') === id; })) return null;
        sides.push(part.idx);
      } else {
        if (angles.indexOf(part.idx[0]) >= 0) return null;
        angles.push(part.idx[0]);
      }
    }
    if (sides.length === 3) return 'SSS';
    if (sides.length === 2 && angles.length === 1) {
      const shared = sides[0].filter(function (v) { return sides[1].indexOf(v) >= 0; });
      return shared.length === 1 && shared[0] === angles[0] ? 'SAS' : null;
    }
    if (sides.length === 1 && angles.length === 2) {
      const s = sides[0];
      return angles.indexOf(s[0]) >= 0 && angles.indexOf(s[1]) >= 0 ? 'ASA' : null;
    }
    return null;
  }

  function evidenceByIds(problem, ids) {
    return ids.map(function (id) {
      return problem.evidence.find(function (e) { return e.id === id; });
    }).filter(Boolean);
  }

  // 合同条件の判定
  function checkCongruence(problem, foundIds, conditionId) {
    if (!conditionId) return { ok: false, status: 'incomplete' };
    const ids = foundIds || [];
    const allFound = problem.evidence.every(function (e) { return ids.indexOf(e.id) >= 0; });
    if (!allFound) return { ok: false, status: 'incomplete' };
    const derived = deriveCondition(problem, evidenceByIds(problem, ids));
    if (!derived) return { ok: false, status: 'invalid-set' };
    if (derived !== conditionId) return { ok: false, status: 'wrong-condition' };
    return { ok: true, status: 'correct', condition: derived };
  }

  // 問題データの整合性チェック（テスト・開発用）
  function verifyProblem(problem) {
    const errors = [];
    try {
      const els = geo().getElements(problem.figure);
      const c = compiled(problem);
      c.evidence.forEach(function (e) {
        e.keys.forEach(function (k) {
          if (!els.byKey[k]) errors.push(e.ev.id + ': 図で選択できない要素 ' + k);
        });
        if (!PH.REASONS[e.ev.reason]) errors.push(e.ev.id + ': 未定義の理由 ' + e.ev.reason);
        const reasonsOffered = problem.reasons.concat(e.keys[0] === e.keys[1] ? ['common'] : []);
        if (reasonsOffered.indexOf(e.ev.reason) < 0) errors.push(e.ev.id + ': 理由が選択肢にない');
        if (!(problem.hints && problem.hints[e.ev.id] && problem.hints[e.ev.id].length)) errors.push(e.ev.id + ': ヒントがない');
      });
      const derived = deriveCondition(problem, problem.evidence);
      if (derived !== problem.congruence) errors.push('合同条件が根拠と一致しない: ' + derived + ' / ' + problem.congruence);
    } catch (err) {
      errors.push(String(err && err.message || err));
    }
    return errors;
  }

  PH.validation = {
    equationKey: equationKey,
    correspondingParts: correspondingParts,
    classifyPair: classifyPair,
    checkEvidence: checkEvidence,
    deriveCondition: deriveCondition,
    checkCongruence: checkCongruence,
    verifyProblem: verifyProblem,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.validation;
})(typeof window !== 'undefined' ? window : globalThis);
