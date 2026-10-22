/*
 * validation.js — 数学的な正誤判定（問題データを参照する共通処理）
 *
 * checkEvidence    : 選んだ2要素＋理由が、この問題の有効な根拠かを判定
 * deriveCondition  : 根拠の組と三角形の対応から、成り立つ合同条件を導く
 * checkCongruence  : 選んだ合同条件が正しいかを判定
 * Ver.0.9：結論が「四角形…は平行四辺形」の問題（PH.isQuadProblem）の平行四辺形の根拠・成立条件は js/parallelogram-rules.js。
 *   三角形の合同を示す部分（triangles など）がない問題では、三角形の判定（対応する辺・角など）はしない。
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

  // 2つの三角形（対応順）の、対応する辺・角の組（三角形の合同を示す部分がない問題は空）
  function correspondingParts(problem) {
    if (!Array.isArray(problem.triangles) || problem.triangles.length !== 2) return [];
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
   *   / not-proved（Ver.0.7：まだ証明していない事実を根拠に使った。engine を渡したときだけ）
   */
  function checkEvidence(problem, keys, reasonId, foundIds, engine) {
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
      // Ver.0.7：前のステップで導く事実は、そのステップを証明してから（未証明の事実は根拠に使えない）
      if (hit.ev.fromStep && engine && !engine.canUse(hit.ev)) return { status: 'not-proved', miss: true, evidence: hit.ev, kind: kind };
      if (PH.acceptedReasons(hit.ev).indexOf(reasonId) >= 0) return { status: 'correct', miss: false, evidence: hit.ev, kind: kind };
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
    if (outsideTriangles(problem, keys)) return { status: 'outside', miss: true, kind: kind };
    return { status: 'wrong-equation', miss: true, kind: kind };
  }

  /*
   * 選んだ辺・角のどちらかが、合同を証明する2つの三角形の辺・角ではないか（Ver.0.8）。
   * 例：p23 の ∠BCA＝∠DCE は正しい関係だが、△ACE・△BCD の角ではない →「合同を証明したい三角形の辺や角を選ぼう」
   * 図の見た目（長さ・角度）では判断しない（三角形の辺・角かどうかだけで決める）
   */
  function outsideTriangles(problem, keys) {
    const parts = {};
    compiled(problem).parts.forEach(function (p) { p.keys.forEach(function (k) { parts[k] = true; }); });
    return keys.some(function (k) { return !parts[k]; });
  }

  // 等式（キー2つ）がこの問題の根拠のどれにあたるか。左右・表記の違いは同一視。なければ null
  function matchEvidence(problem, keys) {
    const eq = equationKey(keys[0], keys[1]);
    const hit = compiled(problem).evidence.find(function (e) { return e.eq === eq; });
    return hit ? hit.ev : null;
  }

  // 根拠ではない等式の種類：'irrelevant'（正しいが今回は使わない）/ 'from-conclusion' / 'not-common'
  //   / 'outside'（合同を証明する2つの三角形の辺・角ではない）/ 'wrong-equation'
  function equationStatus(problem, keys) {
    if (matchEvidence(problem, keys)) return 'evidence';
    const eq = equationKey(keys[0], keys[1]);
    if (compiled(problem).extras.some(function (e) { return e.eq === eq; })) return 'irrelevant';
    if (classifyPair(problem, keys)) return 'from-conclusion';
    if (keys[0] === keys[1]) return 'not-common';
    if (outsideTriangles(problem, keys)) return 'outside';
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

  // ---- 三角形の選択と頂点の対応（Ver.0.5） ------------------------------------

  /*
   * 頂点の対応を正規化したキー。対応を保ったまま頂点を並べ替えた表記と、左右の三角形の交換を同じキーにする。
   *   △ABCと△DEF、△BCAと△EFD、△ACBと△DFE、△DEFと△ABC → どれも同じキー
   *   キーは「対応する頂点の組」（例 'A>D,B>E,C>F'）を並べたもの。左右を入れかえた向きと比べて小さい方。
   */
  function correspondenceKey(t1, t2) {
    const pairs = function (a, b) {
      return [0, 1, 2].map(function (i) { return a[i] + '>' + b[i]; }).sort().join(',');
    };
    const k1 = pairs(t1, t2), k2 = pairs(t2, t1);
    return k1 < k2 ? k1 : k2;
  }

  // 頂点の集合としての三角形（向き・並びを無視）
  function triangleSetKey(t) { return t.slice().sort().join(''); }

  // 正解として認める対応：triangles（唯一の基準）と、対称性などで明示的に許可した対応（altTriangles、任意）
  function acceptedCorrespondences(problem) {
    return [problem.triangles].concat(problem.altTriangles || []);
  }

  /*
   * 証明する2つの三角形と頂点の対応の判定。t1, t2 は頂点の配列（同じ位置どうしが対応）。
   *   ok        … 正しい三角形と対応（並べ方・左右の交換は自由）
   *   order     … 三角形の組は正しいが、頂点の対応がちがう
   *   wrong     … 三角形の組がちがう
   *   same      … 同じ三角形を2つ選んだ
   *   invalid   … 図の上の三角形ではない（一直線上の3点・かかれていない辺など）
   *   incomplete… 未完成
   */
  function checkTriangles(problem, t1, t2) {
    const full = function (t) { return Array.isArray(t) && t.length === 3 && t.every(function (c) { return typeof c === 'string' && c; }); };
    if (!full(t1) || !full(t2)) return { status: 'incomplete', ok: false };
    const fig = problem.figure;
    if (!geo().isFigureTriangle(fig, t1) || !geo().isFigureTriangle(fig, t2)) return { status: 'invalid', ok: false };
    if (triangleSetKey(t1) === triangleSetKey(t2)) return { status: 'same', ok: false };
    const key = correspondenceKey(t1, t2);
    const sets = [triangleSetKey(t1), triangleSetKey(t2)].sort().join('|');
    const accepted = acceptedCorrespondences(problem);
    if (accepted.some(function (c) { return correspondenceKey(c[0], c[1]) === key; })) return { status: 'ok', ok: true };
    const sameSets = accepted.some(function (c) { return [triangleSetKey(c[0]), triangleSetKey(c[1])].sort().join('|') === sets; });
    return { status: sameSets ? 'order' : 'wrong', ok: false };
  }

  // ---- 最終結論（合同から導く辺・角の等しさ） -----------------------------------

  function finalKeys(problem) {
    return keysOf(problem.figure, problem.finalStep.items);
  }

  /*
   * 最終結論の等式の種類（合同が成立したあとに判定する）
   *   goal       … 問題で求められている結論（左右・表記の違いは同一視）
   *   not-goal   … 合同から言える正しい関係（対応する辺・角）だが、求められている結論ではない
   *   evidence   … 合同を示すのに使った根拠（または今回使わない正しい関係）で、結論ではない
   *   wrong-equation … 等しいと言えない
   */
  function finalEquationStatus(problem, keys) {
    if (!keys || !keys[0] || !keys[1]) return 'incomplete';
    const fk = finalKeys(problem);
    const eq = equationKey(keys[0], keys[1]);
    if (eq === equationKey(fk[0], fk[1])) return 'goal';
    const st = equationStatus(problem, keys);
    if (st === 'evidence' || st === 'irrelevant') return 'evidence';
    if (st === 'from-conclusion') return 'not-goal';
    return 'wrong-equation';
  }

  /*
   * 最終結論の判定。congruenceProved が false（合同がまだ成立していない）なら、結論は使えない。
   *   correct / wrong-reason（等式は正しいが理由がちがう）/ not-goal / evidence / wrong-equation / not-proved / incomplete
   */
  function checkFinal(problem, keys, reasonId, congruenceProved) {
    if (!keys || keys.length !== 2 || !keys[0] || !keys[1] || !reasonId) return { status: 'incomplete', miss: false };
    if (!congruenceProved) return { status: 'not-proved', miss: true };
    const st = finalEquationStatus(problem, keys);
    if (st === 'goal') {
      return reasonId === PH.finalReasonFor(problem)
        ? { status: 'correct', miss: false }
        : { status: 'wrong-reason', miss: true };
    }
    return { status: st, miss: st !== 'not-goal' };
  }

  /*
   * 根拠の組から合同条件を導く。
   *   'SSS' 3組の辺 / 'SAS' 2組の辺とその間の角 / 'ASA' 1組の辺とその両端の角 / null 不成立
   *   Ver.0.8：直角の根拠（role: 'right'）をふくむ組は js/right-triangle.js で判定（'RHS' / 'RHA' など）。
   *   直角の根拠がない組では RHS・RHA にならない（直角三角形であることが前提）。
   */
  function deriveCondition(problem, evidenceList) {
    if (!evidenceList || evidenceList.length !== 3) return null;
    if (evidenceList.some(function (ev) { return ev && ev.role === 'right'; })) {
      return PH.rightTriangle ? PH.rightTriangle.derive(problem, evidenceList) : null;
    }
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

  /*
   * 合同条件の判定
   *   status: correct / wrong-condition / invalid-set / incomplete
   *   / classic-condition（Ver.0.8：直角三角形の問題で3つの合同条件を選んだ。数学的には別の道すじで示せる場合も
   *     あるので、単純な誤りとは扱わない。今回の根拠に合う直角三角形の合同条件を選び直してもらう）
   */
  function checkCongruence(problem, foundIds, conditionId) {
    if (!conditionId) return { ok: false, status: 'incomplete' };
    const ids = foundIds || [];
    const allFound = problem.evidence.every(function (e) { return ids.indexOf(e.id) >= 0; });
    if (!allFound) return { ok: false, status: 'incomplete' };
    const derived = deriveCondition(problem, evidenceByIds(problem, ids));
    if (!derived) return { ok: false, status: 'invalid-set' };
    if (derived !== conditionId) {
      const classic = PH.isRightProblem && PH.isRightProblem(problem) && PH.CONDITIONS[conditionId] && !PH.CONDITIONS[conditionId].right;
      return { ok: false, status: classic ? 'classic-condition' : 'wrong-condition' };
    }
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
      // Ver.0.9：平行四辺形だけの問題（三角形の合同を示す部分がない）は、三角形・合同条件のデータを持たない
      const tri = !PH.hasCongruence || PH.hasCongruence(problem);
      if (tri) {
        if (!problem.proof || !problem.proof.intro) errors.push('proof.intro がない');
        if (!PH.CONDITIONS[problem.congruence]) errors.push('congruence が無効');
        if (!(problem.hints && problem.hints.congruence && problem.hints.congruence.length)) errors.push('合同条件のヒントがない');
      } else {
        ['triangles', 'congruence', 'finalStep'].forEach(function (k) { if (problem[k]) errors.push('平行四辺形だけの問題に ' + k + ' がある'); });
        if (!Array.isArray(problem.evidence) || problem.evidence.length) errors.push('平行四辺形だけの問題の evidence は空にする');
      }

      // 三角形：点があり、3点が異なり、一直線上にない。結論の表記と対応順が一致
      (problem.triangles || []).forEach(function (t, i) {
        if (t.length !== 3 || new Set(t).size !== 3) errors.push('三角形' + (i + 1) + 'の頂点が不正');
        t.forEach(function (n) { if (!fig.points[n]) errors.push('三角形の頂点 ' + n + ' が図にない'); });
        if (t.every(function (n) { return fig.points[n]; })) {
          const A = fig.points[t[0]], B = fig.points[t[1]], C = fig.points[t[2]];
          if (Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x)) < 1) errors.push('三角形' + (i + 1) + 'がつぶれている');
        }
      });
      const ctype = PH.conclusionType(problem);
      if (PH.CONCLUSION_TYPES.indexOf(ctype) < 0) errors.push('conclusionType が無効: ' + ctype);
      if (ctype === 'triangleCongruence') {
        const expected = '△' + problem.triangles[0].join('') + '≡△' + problem.triangles[1].join('');
        if (problem.conclusion !== expected) errors.push('結論の表記と triangles の対応順が一致しない: ' + expected);
        if (problem.finalStep) errors.push('三角形の合同が結論の問題に finalStep がある');
      } else if (tri) {
        verifyFinalStep(problem, errors);
      }
      // Ver.0.9：平行四辺形の根拠・成立条件・性質の使い方（js/parallelogram-rules.js）
      if (ctype === 'parallelogram') {
        if (!PH.parallelogram) errors.push('平行四辺形の判定（parallelogram-rules.js）がない');
        else PH.parallelogram.verify(problem).forEach(function (e) { errors.push(e); });
      }

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
      if (tri) {
        const t1 = problem.triangles[0], t2 = problem.triangles[1];
        [[0, 1], [1, 2], [0, 2]].forEach(function (ij) {
          const a = t1[ij[0]] + t1[ij[1]], b = t2[ij[0]] + t2[ij[1]];
          if (!nearlyEqual(measure(fig, a), measure(fig, b))) errors.push('図の三角形が合同でない: ' + a + '≠' + b);
        });
      }

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

      // Ver.0.7：定理を使う根拠・導いた事実を使う根拠、多段階証明のステップ（js/proof-engine.js）
      problem.evidence.forEach(function (ev) {
        if (ev.reason === 'equilateralSides' && PH.proofRules) {
          const err = PH.proofRules.checkEquilateralSides(problem, ev.items);
          if (err) errors.push(ev.id + ': ' + err);
        }
        if ((ev.reason === 'proved') !== !!ev.fromStep) errors.push(ev.id + ': 導いた事実の根拠は reason: proved と fromStep の両方が必要');
      });
      if (PH.proofEngine && PH.proofEngine.hasSteps(problem)) {
        PH.proofEngine.verify(problem).forEach(function (e) { errors.push(e); });
      }
      // Ver.0.8：直角三角形（直角の根拠・斜辺・正方形・垂直・図の直角の印）
      if (PH.rightTriangle) PH.rightTriangle.verify(problem).forEach(function (e) { errors.push(e); });
      (fig.rays || []).forEach(function (r) {
        if (!fig.points[r.from] || !fig.points[r.through]) errors.push('rays の点が図にない');
      });

      if (tri) {
        const derived = deriveCondition(problem, problem.evidence);
        if (derived !== problem.congruence) errors.push('合同条件が根拠と一致しない: ' + derived + ' / ' + problem.congruence);
      }

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
        if ((st === 'wrong-equation' || st === 'outside') && nearlyEqual(measure(fig, items[0]), measure(fig, items[1]))) {
          errors.push('ダミーが図の上で等しく見える（まぎらわしい）: ' + label);
        }
      });
      (dist.reasons || []).forEach(function (r) { if (!PH.REASONS[r]) errors.push('ダミーの理由が未定義: ' + r); });
    } catch (err) {
      errors.push(String(err && err.message || err));
    }
    return errors;
  }

  /*
   * 結論が辺・角の等しさの問題（Ver.0.5）の追加チェック
   *   最終結論が、途中で示す合同の対応する辺・角から導けるか、根拠に混ざっていないか、理由・ヒント・パズルのダミーが正しいか
   */
  function verifyFinalStep(problem, errors) {
    const fig = problem.figure;
    const fs = problem.finalStep;
    if (!fs || !Array.isArray(fs.items) || fs.items.length !== 2) { errors.push('finalStep がない・不正'); return; }
    // 結論が「二等辺三角形である」（Ver.0.7）の問題は、合同から導いた等式（finalStep）をもとに、後半のステップで結論を導く
    // 結論が「平行四辺形」（Ver.0.9）の問題は、合同から導いた等式（finalStep）を、平行四辺形の根拠（平行を導く角など）に使う
    const ctype = PH.conclusionType(problem);
    const viaPost = ctype === 'isoscelesTriangle';
    const viaQuad = ctype === 'parallelogram';
    const kind = ctype === 'equalAngle' ? 'angle' : ctype === 'equalSide' ? 'side' : fs.relationType;
    if (fs.relationType !== kind) errors.push('finalStep.relationType が conclusionType と合わない');
    if (fs.items.some(function (n) { return geo().isAngleName(n) !== (kind === 'angle'); })) errors.push('finalStep.items の種類が合わない');
    if (fs.reason !== PH.finalReasonFor(problem)) errors.push('finalStep.reason が不正: ' + fs.reason);
    if (viaPost) {
      if (!PH.proofEngine || !PH.proofEngine.stepsOf(problem, 'post').length) errors.push('結論を導く後半のステップがない');
    } else if (viaQuad) {
      const fk = keysOf(fig, fs.items);
      const used = ((problem.parallelogram && problem.parallelogram.evidence) || []).some(function (ev) {
        if (!ev.via) return false;
        const vk = keysOf(fig, ev.via);
        return equationKey(vk[0], vk[1]) === equationKey(fk[0], fk[1]);
      });
      if (!used) errors.push('合同から導いた等式が、平行四辺形の根拠に使われていない');
    } else if (fs.label !== problem.conclusion) errors.push('finalStep.label と結論が一致しない');
    if (fs.label.replace(/＝/g, '=') !== fs.items.join('=')) errors.push('finalStep の label と items が一致しない');
    const els = geo().getElements(fig);
    const keys = keysOf(fig, fs.items);
    keys.forEach(function (k) { if (!els.byKey[k]) errors.push('最終結論: 図で選択できない要素 ' + k); });
    // 合同の対応する辺・角か（＝合同から導ける）。頂点の対応順どおりに書かれているか
    if (!classifyPair(problem, keys)) errors.push('最終結論が、合同な三角形の対応する辺・角になっていない');
    if (correspondenceOrder(problem, fs.items) !== 'ok') errors.push('最終結論が頂点の対応順どおりに書かれていない');
    if (!nearlyEqual(measure(fig, fs.items[0]), measure(fig, fs.items[1]))) errors.push('最終結論が図の上で等しくない');
    // 最終結論を途中の根拠に使っていない・仮定そのものではない（合同を示す意味がある）
    const st = equationStatus(problem, keys);
    if (st === 'evidence') errors.push('最終結論が根拠（仮定など）にふくまれている');
    if (st === 'irrelevant') errors.push('最終結論が extraTruths にふくまれている');
    if (problem.given.indexOf(problem.conclusion) >= 0) errors.push('最終結論が仮定にふくまれている');
    // 証明する三角形が図の上にあるか
    problem.triangles.forEach(function (t) { if (!geo().isFigureTriangle(fig, t)) errors.push('三角形 △' + t.join('') + ' が図の上の三角形ではない'); });
    // ヒント
    ['triangleSelection', 'finalStep'].forEach(function (id) {
      if (!(problem.hints && problem.hints[id] && problem.hints[id].length === 3)) errors.push(id + ' のヒントが3段階ない');
    });
    // パズルのダミー：三角形の組は不正解になること、最終結論のダミーは結論にならないこと
    const dist = (problem.puzzle && problem.puzzle.distractors) || {};
    const tris = dist.triangles || [];
    if (tris.length < 2) errors.push('三角形の組のダミーが2つ未満');
    tris.forEach(function (s) {
      const tt = String(s).split('/').map(function (x) { return x.split(''); });
      const r = tt.length === 2 ? checkTriangles(problem, tt[0], tt[1]) : { status: 'incomplete' };
      if (r.status !== 'order' && r.status !== 'wrong') errors.push('三角形の組のダミーが不適切（' + r.status + '）: ' + s);
    });
    const finals = dist.finals || [];
    if (finals.length < 2) errors.push('最終結論のダミーが2つ未満');
    finals.forEach(function (label) {
      const items = String(label).split('＝');
      if (items.length !== 2) { errors.push('最終結論のダミーの形式が不正: ' + label); return; }
      const fst = finalEquationStatus(problem, keysOf(fig, items));
      if (fst === 'goal') errors.push('最終結論のダミーが結論と同じ: ' + label);
      if (fst === 'wrong-equation' && nearlyEqual(measure(fig, items[0]), measure(fig, items[1]))) errors.push('最終結論のダミーが図の上で等しく見える: ' + label);
    });
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
    outsideTriangles: outsideTriangles,
    matchEvidence: matchEvidence,
    equationStatus: equationStatus,
    correspondenceOrder: correspondenceOrder,
    correspondenceKey: correspondenceKey,
    checkTriangles: checkTriangles,
    finalEquationStatus: finalEquationStatus,
    checkFinal: checkFinal,
    deriveCondition: deriveCondition,
    checkCongruence: checkCongruence,
    verifyProblem: verifyProblem,
    verifyAll: verifyAll,
    measure: measure,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.validation;
})(typeof window !== 'undefined' ? window : globalThis);
