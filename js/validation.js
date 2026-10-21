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

  // 等式（キー2つ）がこの問題の根拠のどれにあたるか。左右・表記の違いは同一視。なければ null
  function matchEvidence(problem, keys) {
    const eq = equationKey(keys[0], keys[1]);
    const hit = compiled(problem).evidence.find(function (e) { return e.eq === eq; });
    return hit ? hit.ev : null;
  }

  // 根拠ではない等式の種類：'irrelevant'（正しいが今回は使わない）/ 'from-conclusion' / 'not-common' / 'wrong-equation'
  function equationStatus(problem, keys) {
    if (matchEvidence(problem, keys)) return 'evidence';
    const eq = equationKey(keys[0], keys[1]);
    if (compiled(problem).extras.some(function (e) { return e.eq === eq; })) return 'irrelevant';
    if (classifyPair(problem, keys)) return 'from-conclusion';
    if (keys[0] === keys[1]) return 'not-common';
    return 'wrong-equation';
  }

  /*
   * 等式の書き方が、2つの三角形の頂点の対応順に合っているか。
   *   items: 書かれたとおりの左辺・右辺（例 ['AB', 'BC']、['∠BAC', '∠DCA']）
   *   左辺を一方の三角形の頂点で読み、対応（triangles の同じ位置の頂点どうし）で移したものが、
   *   右辺をもう一方の三角形の頂点で読んだものと、文字の順番まで一致すれば 'ok'。
   *   例：△ABD≡△CBD（A↔C、B↔B、D↔D）で AB＝CB・BA＝BC は ok、AB＝BC・BD＝DB は 'order'。
   *   角は一直線上の別名を、その三角形の頂点に読みかえる（O が AC 上なら ∠BAC は △ABO の ∠BAO）。
   *   どちらの三角形でも読めないときは 'unknown'（判定しない）。
   */
  function correspondenceOrder(problem, items) {
    const fig = problem.figure;
    const tris = problem.triangles;
    function resolve(name, tri) {
      const isAng = geo().isAngleName(name);
      const s = String(name).replace(/[∠\s]/g, '');
      if (!isAng) return s.length === 2 && tri.indexOf(s[0]) >= 0 && tri.indexOf(s[1]) >= 0 ? s : null;
      if (s.length !== 3) return null;
      const V = s[1];
      if (tri.indexOf(V) < 0) return null;
      const end = function (P) {
        if (tri.indexOf(P) >= 0 && P !== V) return P;
        const ray = geo().rayKey(fig, V, P);
        const w = tri.find(function (W) { return W !== V && geo().rayKey(fig, V, W) === ray; });
        return w || null;
      };
      const P = end(s[0]), Q = end(s[2]);
      return P && Q && P !== Q ? P + V + Q : null;
    }
    let judged = false;
    for (const pair of [[0, 1], [1, 0]]) {
      const from = tris[pair[0]], to = tris[pair[1]];
      const L = resolve(items[0], from), R = resolve(items[1], to);
      if (!L || !R) continue;
      judged = true;
      const mapped = L.split('').map(function (c) { return to[from.indexOf(c)]; }).join('');
      if (mapped === R) return 'ok';
    }
    return judged ? 'order' : 'unknown';
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

  // ---- 図の座標を使った数値チェック -------------------------------------

  // 辺の長さ・角の大きさ（度）を図の座標から測る
  function measure(figure, name) {
    const pts = figure.points;
    const v = geo().vec;
    if (geo().isAngleName(name)) {
      const n = String(name).replace(/[∠\s]/g, '');
      const V = pts[n[1]], P = pts[n[0]], Q = pts[n[2]];
      const a = v.sub(P, V), b = v.sub(Q, V);
      const cos = (a.x * b.x + a.y * b.y) / (v.len(a) * v.len(b));
      return { kind: 'ang', value: Math.acos(Math.max(-1, Math.min(1, cos))) * 180 / Math.PI };
    }
    const n = String(name).replace(/\s/g, '');
    return { kind: 'seg', value: v.dist(pts[n[0]], pts[n[1]]) };
  }

  function nearlyEqual(m1, m2) {
    if (m1.kind !== m2.kind) return false;
    return m1.kind === 'ang'
      ? Math.abs(m1.value - m2.value) < 0.5
      : Math.abs(m1.value - m2.value) < Math.max(0.5, m1.value * 0.005);
  }

  // 問題データの整合性チェック（テスト・開発用）。問題がなければ空配列
  function verifyProblem(problem) {
    const errors = [];
    const fig = problem.figure;
    const v = geo().vec;
    try {
      ['id', 'title', 'statement', 'conclusion', 'explanation'].forEach(function (k) {
        if (typeof problem[k] !== 'string' || !problem[k]) errors.push(k + ' がない');
      });
      if (!PH.getStage || !PH.getStage(problem.stage)) errors.push('stage が無効: ' + problem.stage);
      if (!(problem.difficulty >= 1 && problem.difficulty <= 3)) errors.push('difficulty が無効');
      if (!Array.isArray(problem.learningPoints) || !problem.learningPoints.length) errors.push('learningPoints がない');
      if (!problem.proof || !problem.proof.intro) errors.push('proof.intro がない');
      if (!PH.CONDITIONS[problem.congruence]) errors.push('congruence が無効');
      if (!(problem.hints && problem.hints.congruence && problem.hints.congruence.length)) errors.push('合同条件のヒントがない');

      // 三角形：点があり、3点が異なり、一直線上にない。結論の表記と対応順が一致
      problem.triangles.forEach(function (t, i) {
        if (t.length !== 3 || new Set(t).size !== 3) errors.push('三角形' + (i + 1) + 'の頂点が不正');
        t.forEach(function (n) { if (!fig.points[n]) errors.push('三角形の頂点 ' + n + ' が図にない'); });
        if (t.every(function (n) { return fig.points[n]; })) {
          const A = fig.points[t[0]], B = fig.points[t[1]], C = fig.points[t[2]];
          if (Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)) < 1) errors.push('三角形' + (i + 1) + 'がつぶれている');
        }
      });
      const expected = '△' + problem.triangles[0].join('') + '≡△' + problem.triangles[1].join('');
      if (problem.conclusion !== expected) errors.push('結論の表記と triangles の対応順が一致しない: ' + expected);

      // 一直線上の点（figure.lines）が本当に一直線上に、書いた順で並んでいるか
      (fig.lines || []).forEach(function (L) {
        const P = fig.points[L[0]], Q = fig.points[L[L.length - 1]];
        const d = v.unit(v.sub(Q, P));
        let last = -Infinity;
        L.forEach(function (n) {
          const w = v.sub(fig.points[n], P);
          if (Math.abs(w.x * d.y - w.y * d.x) > 0.5) errors.push('lines の点が一直線上にない: ' + n);
          const t = w.x * d.x + w.y * d.y;
          if (t <= last) errors.push('lines の点の順番が不正: ' + L.join(''));
          last = t;
        });
      });

      const els = geo().getElements(fig);
      els.angles.forEach(function (a) {
        const m = measure(fig, '∠' + a.name).value;
        if (!(m > 1 && m < 179)) errors.push('角 ∠' + a.name + ' が不正（' + m.toFixed(1) + '°）');
      });

      const c = compiled(problem);
      c.evidence.forEach(function (e) {
        e.keys.forEach(function (k) {
          if (!els.byKey[k]) errors.push(e.ev.id + ': 図で選択できない要素 ' + k);
        });
        if (!PH.REASONS[e.ev.reason]) errors.push(e.ev.id + ': 未定義の理由 ' + e.ev.reason);
        const same = e.keys[0] === e.keys[1];
        const auto = same ? [e.keys[0].slice(0, 3) === 'ang' ? 'commonAngle' : 'common'] : [];
        if (problem.reasons.concat(auto).indexOf(e.ev.reason) < 0) errors.push(e.ev.id + ': 理由が選択肢にない');
        if (!(problem.hints && problem.hints[e.ev.id] && problem.hints[e.ev.id].length)) errors.push(e.ev.id + ': ヒントがない');
        if (!nearlyEqual(measure(fig, e.ev.items[0]), measure(fig, e.ev.items[1]))) errors.push(e.ev.id + ': 図の上で等しくない ' + e.ev.label);
        if ((e.ev.reason === 'common' || e.ev.reason === 'commonAngle') !== same) errors.push(e.ev.id + ': 共通の理由と要素が合わない');
        if (e.ev.label.replace(/＝/g, '=') !== e.ev.items.join('=')) errors.push(e.ev.id + ': label と items が一致しない');
      });
      c.extras.forEach(function (x) {
        if (!nearlyEqual(measure(fig, x.item.items[0]), measure(fig, x.item.items[1]))) errors.push('extraTruths が図の上で等しくない: ' + x.item.items.join('='));
        x.keys.forEach(function (k) { if (!els.byKey[k]) errors.push('extraTruths: 図で選択できない要素 ' + k); });
      });

      // 図の2つの三角形が実際に合同に描かれているか（対応する辺がすべて等しい）
      const t1 = problem.triangles[0], t2 = problem.triangles[1];
      [[0, 1], [1, 2], [0, 2]].forEach(function (ij) {
        const a = t1[ij[0]] + t1[ij[1]], b = t2[ij[0]] + t2[ij[1]];
        if (!nearlyEqual(measure(fig, a), measure(fig, b))) errors.push('図の三角形が合同でない: ' + a + '≠' + b);
      });

      // 平行の組（同じ組番号の線）が本当に平行で、矢印が同じ向きか
      const groups = {};
      geo().parallelLines(fig).forEach(function (pl) { (groups[pl.group] = groups[pl.group] || []).push(pl); });
      Object.keys(groups).forEach(function (gid) {
        const ls = groups[gid];
        if (ls.length < 2) errors.push('平行の組' + gid + 'が1本しかない');
        const d0 = v.unit(v.sub(fig.points[ls[0].to], fig.points[ls[0].from]));
        ls.forEach(function (pl) {
          const d = v.unit(v.sub(fig.points[pl.to], fig.points[pl.from]));
          if (Math.abs(d.x * d0.y - d.y * d0.x) > 0.005 || d.x * d0.x + d.y * d0.y < 0) errors.push('平行の印の向き・平行が不正: ' + pl.from + pl.to);
        });
      });
      problem.evidence.forEach(function (ev) {
        if (ev.parallelGroup && !groups[ev.parallelGroup]) errors.push(ev.id + ': parallelGroup が図にない');
        if ((ev.reason === 'alternate' || ev.reason === 'corresponding') && !Object.keys(groups).length) errors.push(ev.id + ': 平行線の理由なのに平行の印がない');
      });

      // 途中に点がある長い辺：タップ部分の端点が辺の上にあるか
      fig.segments.forEach(function (entry) {
        if (typeof entry === 'string' || !entry.hit) return;
        const el = els.byKey[geo().segKey(entry.name)];
        const d = v.unit(v.sub(el.p2, el.p1));
        [el.h1, el.h2].forEach(function (h) {
          const w = v.sub(h, el.p1);
          if (Math.abs(w.x * d.y - w.y * d.x) > 0.5) errors.push('hit の点が辺 ' + entry.name + ' の上にない');
        });
      });

      const derived = deriveCondition(problem, problem.evidence);
      if (derived !== problem.congruence) errors.push('合同条件が根拠と一致しない: ' + derived + ' / ' + problem.congruence);

      // 証明パズルのデータ：形式と、ダミーカードが「正しい関係」になっていないか
      const pz = problem.puzzle;
      if (!pz || (pz.type !== 'fill' && pz.type !== 'build')) errors.push('puzzle.type が無効');
      const dist = (pz && pz.distractors) || {};
      (dist.equations || []).forEach(function (label) {
        const items = String(label).split('＝');
        if (items.length !== 2) { errors.push('ダミーの等式の形式が不正: ' + label); return; }
        const keys = keysOf(fig, items);
        const st = equationStatus(problem, keys);
        if (st === 'evidence' || st === 'irrelevant') errors.push('ダミーが正しい関係になっている: ' + label);
        if (st === 'wrong-equation' && nearlyEqual(measure(fig, items[0]), measure(fig, items[1]))) {
          errors.push('ダミーが図の上で等しく見える（まぎらわしい）: ' + label);
        }
      });
      (dist.reasons || []).forEach(function (r) { if (!PH.REASONS[r]) errors.push('ダミーの理由が未定義: ' + r); });
    } catch (err) {
      errors.push(String(err && err.message || err));
    }
    return errors;
  }

  // 問題全体のチェック（ID重複・各ステージに問題があるか・各問題）
  function verifyAll(problems, stages) {
    const errors = [];
    const ids = {};
    problems.forEach(function (p) {
      if (ids[p.id]) errors.push('問題IDが重複: ' + p.id);
      ids[p.id] = true;
      verifyProblem(p).forEach(function (e) { errors.push(p.id + ': ' + e); });
    });
    (stages || []).forEach(function (st) {
      if (!problems.some(function (p) { return p.stage === st.id; })) errors.push('STAGE ' + st.id + ' に問題がない');
    });
    return errors;
  }

  PH.validation = {
    equationKey: equationKey,
    correspondingParts: correspondingParts,
    classifyPair: classifyPair,
    checkEvidence: checkEvidence,
    matchEvidence: matchEvidence,
    equationStatus: equationStatus,
    correspondenceOrder: correspondenceOrder,
    deriveCondition: deriveCondition,
    checkCongruence: checkCongruence,
    verifyProblem: verifyProblem,
    verifyAll: verifyAll,
    measure: measure,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.validation;
})(typeof window !== 'undefined' ? window : globalThis);
