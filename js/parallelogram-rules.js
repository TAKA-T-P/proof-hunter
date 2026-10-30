/*
 * parallelogram-rules.js — 平行四辺形の性質・成立条件・平行の推論（Ver.0.9。DOMに依存しない）
 *
 * 「平行四辺形の性質」と「平行四辺形になるための条件」は別の推論として扱う。
 *   性質（平行四辺形である → …）：平行四辺形だと分かっている四角形（仮定の knownParallelograms）にだけ使える
 *     parallelogramOppositeSidesParallel 2組の対辺はそれぞれ平行     （理由 parallelogramParallel）
 *     parallelogramOppositeSidesEqual    2組の対辺はそれぞれ等しい   （理由 parallelogramSides）
 *     parallelogramOppositeAnglesEqual   2組の対角はそれぞれ等しい   （理由 parallelogramAngles）
 *     parallelogramDiagonalsBisect       対角線はそれぞれの中点で交わる（理由 parallelogramDiagonals）
 *     まだ平行四辺形と証明していない四角形（証明する四角形）に性質を使うと 'property-unproved'
 *   成立条件（… → 平行四辺形である）：PH.PARALLELOGRAM_CONDITIONS の5つ
 *     PP_PARALLEL_PAIRS 2組の対辺がそれぞれ平行 / PP_EQUAL_SIDES 2組の対辺がそれぞれ等しい / PP_EQUAL_ANGLES 2組の対角がそれぞれ等しい
 *     / PP_BISECT_DIAGONALS 対角線がそれぞれの中点で交わる / PP_PARALLEL_EQUAL_PAIR 1組の対辺が平行で、その長さが等しい
 *     ⑤は、平行な辺と等しい辺が「同じ1組の対辺」のときだけ（AB∥DC と AD＝BC では成り立たない）
 *   平行の推論：錯角が等しい（alternateConverse）・同位角が等しい（correspondingConverse）なら2直線は平行。
 *     等しい2つの角が、どの2直線と、それを横切るどの直線でできた錯角・同位角かを、図の配置で確かめる（checkConverse）。
 *
 * 事実（fact）のキー：等式は 'eq:' + validation.equationKey、平行は quadrilateral.parallelKey（'par:…'）。
 *   AB∥CD・CD∥AB・BA∥DC は同じキー。E が AB 上なら EB∥DF は AB∥DF と同じ（figure.lines で正規化）。
 *
 * 問題データ（problems.js）
 *   conclusionType: 'parallelogram'、targetQuadrilateral: ['A','B','C','D']（証明する四角形）、knownParallelograms（仮定の平行四辺形）
 *   parallelogram: { intro, evidence: [{ id, items, rel?: 'parallel', reason, label, mark, via?, fromStep? }], condition,
 *                    alternatives（ほかの道すじで示せる成立条件。選んでもミスにしない）, reasons, distractors }
 *
 * Ver.1.0：結論が「四角形…はひし形」「…は長方形」の問題（PH.quadType が 'rhombus'・'rectangle'）も、同じ parallelogram のデータで
 *   根拠を集め、成立条件（js/special-quadrilaterals.js の PH.SPECIAL_CONDITIONS）を選ぶ。証明する四角形は仮定で平行四辺形と分かっている。
 *   chain … 「4つの辺（角）がすべて等しい」の確認の表示（'AB＝BC＝CD＝DA'）。生徒には入力させず、根拠がそろったら表示する
 *   証明する四角形のひし形・長方形としての性質（4辺が等しい・4つの角が等しい・対角線が等しい）は、証明できるまで使えない（'property-unproved'）
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function G() { return PH.geometry; }
  function Q() { return PH.quadrilateral; }
  function V() { return PH.validation; }

  const ORDER = ['PP_PARALLEL_PAIRS', 'PP_EQUAL_SIDES', 'PP_EQUAL_ANGLES', 'PP_BISECT_DIAGONALS', 'PP_PARALLEL_EQUAL_PAIR'];

  // 性質の理由 → 推論ルール
  const PROPERTY_REASONS = {
    parallelogramParallel: 'parallelogramOppositeSidesParallel',
    parallelogramSides: 'parallelogramOppositeSidesEqual',
    parallelogramAngles: 'parallelogramOppositeAnglesEqual',
    parallelogramDiagonals: 'parallelogramDiagonalsBisect',
  };
  // 平行を導く理由 → 角の種類
  const CONVERSE_REASONS = { alternateConverse: 'alternate', correspondingConverse: 'corresponding' };

  function isQuad(p) { return !!p && PH.isQuadProblem(p); }
  function S() { return PH.specialQuad; }
  // 証明する四角形の種類（平行四辺形・ひし形・長方形）
  function targetType(p) { return PH.quadType(p) || 'parallelogram'; }
  function isSpecial(p) { return isQuad(p) && targetType(p) !== 'parallelogram'; }
  // ひし形・長方形の性質の理由 → その性質をもつ種類（Ver.1.0）
  const SPECIAL_PROPERTY_REASONS = { rhombusSides: 'rhombus', rhombusAngles: 'rhombus', rectangleSides: 'rectangle', rectangleAngles: 'rectangle' };

  // 仮定で平行四辺形と分かっている四角形（ひし形・長方形・正方形と書かれた四角形もふくむ。包含関係）
  function knownParallelogramList(p) {
    const out = (p.knownParallelograms || []).slice();
    if (S()) {
      S().knownOfType(p, 'parallelogram').forEach(function (q) {
        if (!out.some(function (x) { return S().quadKey(x) === S().quadKey(q); })) out.push(q);
      });
    }
    return out;
  }
  function part(p) { return (p && p.parallelogram) || null; }
  function evidenceOf(p) { return (part(p) && part(p).evidence) || []; }

  // ---- 事実のキー -------------------------------------------------------------

  function keysOf(fig, items) { return items.map(function (n) { return G().elementKey(fig, n); }); }

  // items（辺・角の名前2つ）と関係（'parallel' / それ以外は等式）から事実のキー。作れないときは null
  function factKey(fig, items, rel) {
    try {
      if (rel === 'parallel') {
        if (items.some(function (n) { return G().isAngleName(n); })) return null;
        return Q().parallelKey(fig, items[0], items[1]);
      }
      const k = keysOf(fig, items);
      if (k[0] === k[1]) return null;
      return 'eq:' + V().equationKey(k[0], k[1]);
    } catch (e) {
      return null;
    }
  }

  // 要素キー2つ（ハンターで選んだもの）から事実のキー
  function factKeyFromKeys(fig, keys, rel) {
    if (!keys || keys.length !== 2 || !keys[0] || !keys[1]) return null;
    if (rel === 'parallel') {
      const m = keys.map(function (k) { return /^seg:([A-Z]{2})$/.exec(k); });
      if (!m[0] || !m[1]) return null;
      return Q().parallelKey(fig, m[0][1], m[1][1]);
    }
    if (keys[0] === keys[1]) return null;
    return 'eq:' + V().equationKey(keys[0], keys[1]);
  }

  function evidenceKey(p, ev) { return factKey(p.figure, ev.items, ev.rel); }

  // 等式・平行の表記（'AB＝CD' / 'AB∥CD'）
  function relText(items, rel) { return items.join(rel === 'parallel' ? '∥' : '＝'); }

  // 仮定の文（'AB∥DC'・'AD＝BC'）を事実に。読めない文（「四角形ABCDは平行四辺形」など）は null
  function parseFact(text) {
    const s = String(text);
    let m = /^([A-Z]{2})∥([A-Z]{2})$/.exec(s);
    if (m) return { rel: 'parallel', items: [m[1], m[2]] };
    m = /^(∠[A-Z]{3}|[A-Z]{2})＝(∠[A-Z]{3}|[A-Z]{2})$/.exec(s);
    if (m && G().isAngleName(m[1]) === G().isAngleName(m[2])) return { rel: 'eq', items: [m[1], m[2]] };
    return null;
  }

  // ---- 平行四辺形の性質 ---------------------------------------------------------

  /*
   * 平行四辺形 quad の性質から言える事実の一覧（それぞれ rule・reason・rel・items・key）
   *   対辺の平行2つ・対辺の長さ2つ・対角2つ・（対角線の交点が図にあれば）対角線の半分どうし2つ
   */
  function propertyFacts(fig, quad) {
    const out = [];
    const add = function (reason, rel, items) {
      const key = factKey(fig, items, rel);
      if (key) out.push({ rule: PROPERTY_REASONS[reason], reason: reason, rel: rel, items: items, key: key });
    };
    Q().oppositeSides(quad).forEach(function (pair) { add('parallelogramParallel', 'parallel', pair); });
    Q().oppositeSides(quad).forEach(function (pair) { add('parallelogramSides', 'eq', pair); });
    Q().oppositeAngles(quad).forEach(function (pair) { add('parallelogramAngles', 'eq', pair); });
    (Q().diagonalHalves(fig, quad) || []).forEach(function (pair) { add('parallelogramDiagonals', 'eq', pair); });
    return out;
  }

  // 仮定で平行四辺形と分かっている四角形の性質（ゲーム中に使える）
  function knownProperties(p) {
    const out = [];
    knownParallelogramList(p).forEach(function (q) { propertyFacts(p.figure, q).forEach(function (f) { out.push(f); }); });
    return out;
  }

  // Ver.1.0：ひし形・長方形としての性質（4辺が等しい・4つの角が等しい・対角線の長さが等しい）
  function specialPropertyFacts(fig, quad, type) {
    const out = [];
    const add = function (reason, items) {
      const key = factKey(fig, items, 'eq');
      if (key && !out.some(function (f) { return f.key === key; })) out.push({ rule: null, reason: reason, rel: 'eq', items: items, key: key });
    };
    const pairs = function (list) {
      const r = [];
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) r.push([list[i], list[j]]);
      return r;
    };
    if (type === 'rhombus' || type === 'square') pairs(Q().sides(quad)).forEach(function (pr) { add('rhombusSides', pr); });
    if (type === 'rectangle' || type === 'square') {
      pairs(Q().angles(quad)).forEach(function (pr) { add(null, pr); });
      add(null, Q().diagonals(quad));
    }
    return out;
  }

  // 証明する四角形の性質（平行四辺形だと証明するまで使えない）
  //   Ver.1.0：ひし形・長方形を証明する問題は、ひし形・長方形としての性質（平行四辺形の性質は仮定から使える）
  function targetProperties(p) {
    if (!isQuad(p)) return [];
    if (!isSpecial(p)) return propertyFacts(p.figure, p.targetQuadrilateral);
    const known = knownProperties(p).map(function (f) { return f.key; });
    return specialPropertyFacts(p.figure, p.targetQuadrilateral, targetType(p)).filter(function (f) { return known.indexOf(f.key) < 0; });
  }

  // ---- 成立条件の判定 -----------------------------------------------------------

  /*
   * 平行四辺形になるための条件を、事実の組から導く。
   *   quadrilateral   … { figure, vertices }（vertices は周に沿った順の頂点）
   *   establishedFacts … 証明済みの事実の一覧 [{ id, items, rel }]（rel: 'parallel' か等式）。キー（key）を直接渡してもよい
   * 戻り値：{ condition, used: [事実のID], all: [{ condition, used }] }。成り立つ条件がなければ null。
   * 四角形が退化・自己交差しているときは成り立たない。④は対角線の交点が図にあり、両方の対角線の内側にあるときだけ。
   */
  function deriveParallelogramCondition(quadrilateral, establishedFacts) {
    const fig = quadrilateral.figure;
    const quad = Q().vertices(quadrilateral.vertices);
    if (!quad || !Q().isSimple(fig, quad)) return null;
    const byKey = {};
    (establishedFacts || []).forEach(function (f, i) {
      const key = f.key || factKey(fig, f.items, f.rel);
      if (key && !(key in byKey)) byKey[key] = f.id != null ? f.id : i;
    });
    const has = function (key) { return key != null && key in byKey; };
    const opp = Q().oppositeSides(quad);
    const par = opp.map(function (pair) { return factKey(fig, pair, 'parallel'); });
    const eqs = opp.map(function (pair) { return factKey(fig, pair, 'eq'); });
    const angs = Q().oppositeAngles(quad).map(function (pair) { return factKey(fig, pair, 'eq'); });
    const halves = (Q().diagonalHalves(fig, quad) || []).map(function (pair) { return factKey(fig, pair, 'eq'); });
    const all = [];
    const add = function (cond, keys) {
      if (keys.length && keys.every(has)) all.push({ condition: cond, used: keys.map(function (k) { return byKey[k]; }) });
    };
    add('PP_PARALLEL_PAIRS', par);
    add('PP_EQUAL_SIDES', eqs);
    add('PP_EQUAL_ANGLES', angs);
    if (halves.length === 2) add('PP_BISECT_DIAGONALS', halves);
    // ⑤：同じ1組の対辺が、平行で、その長さが等しい
    [0, 1].forEach(function (j) {
      if (!all.some(function (a) { return a.condition === 'PP_PARALLEL_EQUAL_PAIR'; })) add('PP_PARALLEL_EQUAL_PAIR', [par[j], eqs[j]]);
    });
    if (!all.length) return null;
    return { condition: all[0].condition, used: all[0].used, all: all };
  }

  // 根拠（evidence）の組から成立条件（PH.validation.deriveCondition の四角形版）
  //   Ver.1.0：ひし形・長方形を証明する問題は、ひし形・長方形の成立条件（証明する四角形は仮定で平行四辺形と分かっている）
  function deriveCondition(p, evidenceList, extra) {
    const facts = (evidenceList || []).map(function (ev) { return { id: ev.id, items: ev.items, rel: ev.rel }; }).concat(extra || []);
    if (!isSpecial(p)) return deriveParallelogramCondition({ figure: p.figure, vertices: p.targetQuadrilateral }, facts);
    const all = S().deriveSpecialCondition({ figure: p.figure, vertices: p.targetQuadrilateral, knownTypes: S().knownTypes(p, p.targetQuadrilateral) }, facts)
      .filter(function (a) { return S().isA(a.type, targetType(p)); });
    if (!all.length) return null;
    const main = all.find(function (a) { return a.condition === part(p).condition; }) || all[0];
    return { condition: main.condition, used: main.used, all: all };
  }

  // 仮定の文から言える事実（ほかの道すじの条件の確認用）。「∠A＝90°」は直角
  function givenFacts(p) {
    return (p.given || []).map(function (g) {
      return S() ? S().parseGivenFact(p.targetQuadrilateral || [], g) : parseFact(g);
    }).filter(Boolean).map(function (f, i) { return { id: 'g' + i, items: f.items, rel: f.rel }; });
  }

  // 成立条件の表示
  function conditionLabel(id) { const c = PH.quadCondition(id); return c ? c.label : ''; }

  // ⑤のまちがい：平行な辺と等しい辺が別の組の対辺（例 AB∥DC と AD＝BC）
  function isMixedPair(p, evidenceList) {
    const fig = p.figure;
    const opp = Q().oppositeSides(p.targetQuadrilateral);
    const keys = evidenceList.map(function (ev) { return evidenceKey(p, ev); });
    const has = function (k) { return keys.indexOf(k) >= 0; };
    return [0, 1].some(function (j) {
      return has(factKey(fig, opp[j], 'parallel')) && has(factKey(fig, opp[1 - j], 'eq'));
    });
  }

  /*
   * 成立条件の判定
   *   correct / alternative（数学的には別の道すじで示せる条件。ミスにしない）/ mixed-pair（⑤で別の組の対辺）
   *   / wrong-condition / invalid-set（集めた根拠から成り立つ条件がない）/ incomplete
   */
  function checkCondition(p, foundIds, conditionId) {
    if (!conditionId) return { ok: false, status: 'incomplete' };
    const ids = foundIds || [];
    const list = evidenceOf(p);
    if (!list.every(function (e) { return ids.indexOf(e.id) >= 0; })) return { ok: false, status: 'incomplete' };
    const evs = ids.map(function (id) { return list.find(function (e) { return e.id === id; }); }).filter(Boolean);
    const r = deriveCondition(p, evs);
    if (!r) return { ok: false, status: 'invalid-set', miss: true };
    if (isSpecial(p)) {
      // ひし形・長方形：問題の道すじの条件が正解。ほかの種類の条件はミス、同じ種類で言える別の条件はミスにしない
      const c = S().CONDITIONS[conditionId];
      if (!c) return { ok: false, status: 'wrong-condition', miss: true };
      if (conditionId === part(p).condition && r.all.some(function (a) { return a.condition === conditionId; })) return { ok: true, status: 'correct', condition: conditionId };
      if (!S().isA(c.type, targetType(p))) return { ok: false, status: 'wrong-type', miss: true, type: c.type };
      if (r.all.some(function (a) { return a.condition === conditionId; }) || (part(p).alternatives || []).indexOf(conditionId) >= 0) {
        return { ok: false, status: 'alternative', miss: false };
      }
      // より特別な種類（正方形）の条件：集めた根拠からは言えない
      if (c.type !== targetType(p)) return { ok: false, status: 'too-specific', miss: true, type: c.type };
      return { ok: false, status: 'wrong-condition', miss: true };
    }
    if (r.all.some(function (a) { return a.condition === conditionId; })) return { ok: true, status: 'correct', condition: conditionId };
    if ((part(p).alternatives || []).indexOf(conditionId) >= 0) return { ok: false, status: 'alternative', miss: false };
    if (conditionId === 'PP_PARALLEL_EQUAL_PAIR' && isMixedPair(p, evs)) return { ok: false, status: 'mixed-pair', miss: true };
    return { ok: false, status: 'wrong-condition', miss: true };
  }

  // ---- 平行を導く（錯角・同位角が等しい → 平行） ---------------------------------------

  function onLine(fig, P, seg) {
    const s = String(seg);
    if (s.indexOf(P) >= 0) return true;
    return (fig.lines || []).some(function (L) { return L.indexOf(P) >= 0 && L.indexOf(s[0]) >= 0 && L.indexOf(s[1]) >= 0; });
  }

  /*
   * 2直線 lines[0]・lines[1] が、等しい2つの角 via で平行と言えるか（type 'alternate' 錯角 / 'corresponding' 同位角）。
   *   2つの角の頂点 P・Q は、それぞれ別の直線の上にあり、角の一方の半直線はその直線にそい、もう一方は直線PQ（横切る直線）にそう。
   *   錯角：横切る直線の半直線が向かい合い（P→Q と Q→P）、平行な直線にそう半直線が反対向き。
   *   同位角：横切る直線の半直線も、平行な直線にそう半直線も、同じ向き。
   * 図の座標は向き（どちら側か）の確認だけに使う。問題がなければ null、あれば理由の文字列
   */
  function checkConverse(fig, lines, via, type) {
    const v = G().vec;
    const names = via.map(function (n) { return String(n).replace(/[∠\s]/g, ''); });
    if (names.length !== 2 || names.some(function (n) { return n.length !== 3; })) return '角の名前が不正';
    const P = names[0][1], Qv = names[1][1];
    if (P === Qv) return '2つの角の頂点が同じ';
    const lineOf = function (X) { return [0, 1].filter(function (i) { return onLine(fig, X, lines[i]); }); };
    const lp = lineOf(P), lq = lineOf(Qv);
    if (lp.length !== 1 || lq.length !== 1 || lp[0] === lq[0]) return '2つの角の頂点が、平行な2直線の上に1つずつない';
    const pts = fig.points;
    const rays = function (name, Vx, other, line) {
      const ends = [name[0], name[2]];
      const along = ends.filter(function (E) { return onLine(fig, E, line); });
      const trans = ends.filter(function (E) {
        return Math.abs((pts[E].x - pts[Vx].x) * (pts[other].y - pts[Vx].y) - (pts[E].y - pts[Vx].y) * (pts[other].x - pts[Vx].x)) < 1;
      });
      if (along.length !== 1 || trans.length !== 1 || along[0] === trans[0]) return null;
      return { L: v.unit(v.sub(pts[along[0]], pts[Vx])), T: v.unit(v.sub(pts[trans[0]], pts[Vx])) };
    };
    const a = rays(names[0], P, Qv, lines[lp[0]]), b = rays(names[1], Qv, P, lines[lq[0]]);
    if (!a || !b) return '角が、平行な直線と横切る直線でできていない';
    const dot = function (x, y) { return x.x * y.x + x.y * y.y; };
    const pq = v.unit(v.sub(pts[Qv], pts[P]));
    if (type === 'alternate') {
      if (!(dot(a.T, pq) > 0 && dot(b.T, pq) < 0)) return '錯角になっていない（横切る直線の向き）';
      if (!(dot(a.L, b.L) < 0)) return '錯角になっていない（平行な直線の向き）';
      return null;
    }
    if (type === 'corresponding') {
      if (!(dot(a.T, b.T) > 0 && dot(a.L, b.L) > 0)) return '同位角になっていない';
      return null;
    }
    return '未定義の角の種類: ' + type;
  }

  // ---- 根拠の判定（ハンター・パズル） ----------------------------------------------------

  function matchEvidence(p, key) {
    if (!key) return null;
    return evidenceOf(p).find(function (ev) { return evidenceKey(p, ev) === key; }) || null;
  }

  // 理由が平行四辺形の性質か
  function isPropertyReason(r) { return !!PROPERTY_REASONS[r]; }

  // 証明する四角形の性質を、証明する前に使おうとした理由か（平行四辺形の性質、ひし形の性質など）
  function isTargetPropertyReason(p, r) {
    if (isPropertyReason(r)) return true;
    return !!SPECIAL_PROPERTY_REASONS[r] && isSpecial(p);
  }

  /*
   * 根拠ではない関係の種類
   *   target-property … 証明する四角形の性質（平行四辺形だと証明してから言える）
   *   known           … 正しいが今回は使わない関係（仮定の平行四辺形の性質・仮定・合同の根拠など）。reasons に言える理由
   *   wrong-equation  … 言えない（図にない関係・同じ直線どうしの平行など）
   */
  function otherStatus(p, key) {
    if (!key) return { status: 'wrong-equation' };
    // 仮定・すでに示した関係・仮定の平行四辺形の性質は「正しいが今回は使わない」（証明する四角形の性質と同じ関係でもよい）
    const known = knownProperties(p).concat(extraFacts(p)).filter(function (f) { return f.key === key; });
    if (known.length) return { status: 'known', reasons: known.map(function (f) { return f.reason; }) };
    if (targetProperties(p).some(function (f) { return f.key === key; })) return { status: 'target-property' };
    return { status: 'wrong-equation' };
  }

  /*
   * 2つの要素（要素キー）が、どちらも証明する四角形の辺・角・対角線（とその半分）か。
   * 正しいが今回は使わない関係のうち、四角形の外の辺・角をふくむもの（p40 の AD∥BC。AD∥EF を導く途中で使う関係）は、
   * 「今回の証明では使わない」ではなく「まずは四角形の辺や角から選ぼう」と案内する
   */
  function isTargetRelation(p, keys) {
    if (!isQuad(p) || !keys || keys.length !== 2) return true;
    const fig = p.figure;
    const quad = p.targetQuadrilateral;
    const names = Q().sides(quad).concat(Q().angles(quad), Q().diagonals(quad));
    (Q().diagonalHalves(fig, quad) || []).forEach(function (pr) { names.push(pr[0], pr[1]); });
    const own = {};
    names.forEach(function (n) { try { own[G().elementKey(fig, n)] = true; } catch (e) { /* 図にない角 */ } });
    return keys.every(function (k) { return !!own[k]; });
  }

  // 正しいが平行四辺形の根拠には使わない関係：仮定の等式・平行、合同の根拠（三角形の部分がある問題）
  function extraFacts(p) {
    const out = [];
    (p.given || []).forEach(function (g) {
      const f = parseFact(g);
      if (f) out.push({ key: factKey(p.figure, f.items, f.rel), reason: 'given' });
    });
    (p.evidence || []).forEach(function (ev) {
      out.push({ key: factKey(p.figure, ev.items, 'eq'), reason: ev.reason });
    });
    // 合同から導いた結論（p35 の ∠ADB＝∠CBD）。平行を導く角として使うが、それ自体は平行四辺形の根拠ではない
    if (p.finalStep) out.push({ key: factKey(p.figure, p.finalStep.items, 'eq'), reason: PH.finalReasonFor(p) });
    ((part(p) && part(p).extraTruths) || []).forEach(function (x) {
      out.push({ key: factKey(p.figure, x.items, x.rel), reason: x.reason });
    });
    return out.filter(function (f) { return f.key; });
  }

  /*
   * 平行四辺形の根拠の判定（ハンター）
   *   keys    : 選んだ2つの要素キー、rel: 'parallel'（∥）か 'eq'（＝）、reasonId: 選んだ理由、foundIds: 見つけた根拠
   *   ctx     : { engine（多段階証明）, isEstablished(eqKey)（平行を導く角の等しさが証明済みか） }
   * 戻り値 status: correct / duplicate / wrong-reason / irrelevant / not-proved / property-unproved / wrong-equation / incomplete
   *   / alternative（別の道すじで言える関係。ミスにしない。alt.text を表示）
   */
  function checkEvidence(p, keys, rel, reasonId, foundIds, ctx) {
    if (!keys || keys.length !== 2 || !keys[0] || !keys[1] || !reasonId) return { status: 'incomplete', miss: false };
    const kind = keys[0].slice(0, 3) === 'ang' ? 'ang' : 'seg';
    const c = ctx || {};
    const key = factKeyFromKeys(p.figure, keys, rel);
    const base = { kind: kind, rel: rel === 'parallel' ? 'parallel' : 'eq' };
    const ev = matchEvidence(p, key);
    const out = function (status, miss, extra) { return Object.assign({ status: status, miss: miss }, base, extra || {}); };
    if (ev) {
      if ((foundIds || []).indexOf(ev.id) >= 0) return out('duplicate', false, { evidence: ev });
      if (ev.fromStep && c.engine && !c.engine.canUse(ev)) return out('not-proved', true, { evidence: ev });
      if (PH.acceptedReasons(ev).indexOf(reasonId) >= 0) {
        // 錯角・同位角から平行を導くときは、その角の等しさが証明済みであること
        if (ev.via && !rightVia(p, ev) && c.isEstablished && !c.isEstablished(viaKey(p, ev))) return out('via-unproved', true, { evidence: ev });
        return out('correct', false, { evidence: ev });
      }
      if (isTargetPropertyReason(p, reasonId) && targetProperties(p).some(function (f) { return f.key === key; })) return out('property-unproved', true, { evidence: ev });
      return out('wrong-reason', true, { evidence: ev });
    }
    // 別の道すじで言える関係（p45 の ∠ABC＝∠BCD など）は、理由によらずミスにしない
    const alt = altRoute(p, key);
    if (alt) return out('alternative', false, { alt: alt });
    const st = otherStatus(p, key);
    if (st.status === 'target-property') return out(isTargetPropertyReason(p, reasonId) ? 'property-unproved' : 'wrong-equation', true);
    if (st.status === 'known') return st.reasons.indexOf(reasonId) >= 0 ? out('irrelevant', false, { outsideQuad: !isTargetRelation(p, keys) }) : out('wrong-reason', true);
    return out('wrong-equation', true);
  }

  /*
   * 平行を導く2つの角が、どちらも仮定の垂線がつくる直角か（p42 の ∠BEF＝∠DFE＝90°。BE⊥AC、DF⊥AC）。
   * そのときは、角の等しさを別に証明しなくても「錯角が等しいから平行」が使える
   */
  function rightVia(p, ev) {
    const RT = PH.rightTriangle;
    if (!ev.via || !RT) return false;
    return ev.via.every(function (n) {
      const pp = RT.perpendicularFor(p, n);
      return !!pp && (p.given || []).indexOf(pp.label) >= 0;
    });
  }

  // 平行四辺形の性質を使う根拠・仮定の平行四辺形のデータの確認（三角形の合同の問題もふくむ。p37〜p39）
  function verifyKnown(p) {
    const errors = [];
    const fig = p.figure;
    (p.knownParallelograms || []).forEach(function (q) {
      if ((p.given || []).indexOf(Q().name(q) + 'は平行四辺形') < 0) errors.push('仮定に平行四辺形が書かれていない: ' + q.join(''));
    });
    knownParallelogramList(p).forEach(function (q) {
      if (!Q().isConvex(fig, q)) errors.push('仮定の平行四辺形が凸四角形ではない: ' + q.join(''));
      propertyFacts(fig, q).forEach(function (f) { if (!holdsInFigure(fig, f.items, f.rel)) errors.push('仮定の平行四辺形の図が正しくない: ' + relText(f.items, f.rel)); });
    });
    // Ver.1.0：仮定のひし形・長方形・正方形の図と、ひし形の性質を使う根拠（p43）
    if (S()) {
      S().knownQuads(p).forEach(function (x) {
        x.types.forEach(function (t) {
          if (t === 'parallelogram') return;
          if (!holdsSpecial(fig, x.vertices, t)) errors.push('仮定の' + S().typeName(t) + 'の図が正しくない: ' + x.vertices.join(''));
        });
      });
      (p.evidence || []).forEach(function (ev) {
        const t = SPECIAL_PROPERTY_REASONS[ev.reason];
        if (!t) return;
        const key = factKey(fig, ev.items, 'eq');
        const ok = S().knownOfType(p, t).some(function (q) {
          if (ev.reason === 'rhombusAngles') return propertyFacts(fig, q).some(function (f) { return f.key === key && f.reason === 'parallelogramAngles'; });
          if (ev.reason === 'rectangleSides') return propertyFacts(fig, q).some(function (f) { return f.key === key && f.reason === 'parallelogramSides'; });
          if (ev.reason === 'rectangleAngles') return specialPropertyFacts(fig, q, 'rectangle').some(function (f) { return f.key === key && G().isAngleName(f.items[0]); });
          return specialPropertyFacts(fig, q, t).some(function (f) { return f.key === key && f.reason === ev.reason; });
        });
        if (!ok) errors.push(ev.id + ': 仮定の' + S().typeName(t) + 'の性質になっていない');
      });
    }
    (p.evidence || []).forEach(function (ev) {
      if (!isPropertyReason(ev.reason)) return;
      const key = factKey(fig, ev.items, 'eq');
      if (!knownProperties(p).some(function (f) { return f.key === key && f.reason === ev.reason; })) errors.push(ev.id + ': 仮定の平行四辺形の性質になっていない');
    });
    return errors;
  }

  // 平行を導く角の等しさの等式キー
  function viaKey(p, ev) {
    const k = keysOf(p.figure, ev.via);
    return V().equationKey(k[0], k[1]);
  }

  // 別の道すじで言える関係（parallelogram.altRoutes の1つ）。なければ null
  function altRoute(p, key) {
    if (!key) return null;
    return ((p.parallelogram && p.parallelogram.altRoutes) || []).find(function (x) { return factKey(p.figure, x.items, 'eq') === key; }) || null;
  }

  // 等式・平行（カード・入力）の種類：evidence / target-property / irrelevant / alternative / wrong-equation（パズル用）
  function equationStatus(p, key) {
    if (matchEvidence(p, key)) return 'evidence';
    if (altRoute(p, key)) return 'alternative';
    const st = otherStatus(p, key).status;
    return st === 'known' ? 'irrelevant' : st;
  }

  // ---- データの検証 -------------------------------------------------------------

  function measureEqual(fig, items) {
    const a = V().measure(fig, items[0]), b = V().measure(fig, items[1]);
    if (a.kind !== b.kind) return false;
    return a.kind === 'ang' ? Math.abs(a.value - b.value) < 0.5 : Math.abs(a.value - b.value) < Math.max(0.5, a.value * 0.005);
  }

  function measureParallel(fig, items) {
    const v = G().vec;
    const d = items.map(function (s) { return v.unit(v.sub(fig.points[s[1]], fig.points[s[0]])); });
    return Math.abs(d[0].x * d[1].y - d[0].y * d[1].x) < 0.005;
  }

  // 図の四角形が、その種類の図形に描かれているか（ひし形：4辺が等しい、長方形：4つの角が90°。データの確認用）
  function holdsSpecial(fig, quad, type) {
    if (type === 'rhombus' || type === 'square') {
      const s = Q().sides(quad);
      if (!s.every(function (x) { return measureEqual(fig, [s[0], x]); })) return false;
    }
    if (type === 'rectangle' || type === 'square') {
      if (!Q().angles(quad).every(function (a) { return Math.abs(V().measure(fig, a).value - 90) < 0.5; })) return false;
    }
    return true;
  }

  // 事実が図の上で成り立つか（データの確認用。ゲームの判定には使わない）
  function holdsInFigure(fig, items, rel) {
    try { return rel === 'parallel' ? measureParallel(fig, items) : measureEqual(fig, items); } catch (e) { return false; }
  }

  /*
   * 平行四辺形の問題データの確認（問題がなければ空配列）
   *   証明する四角形が単純な凸四角形か、結論の表記、根拠（図で選べるか・図の上で成り立つか・理由が正しいか・性質の使い方）、
   *   平行を導く根拠の角が錯角・同位角か、根拠から成立条件が導けるか、ほかの道すじの条件、ヒント、パズルのダミー
   */
  function verify(p) {
    const errors = [];
    const fig = p.figure;
    const pz = part(p);
    if (!pz) return ['parallelogram がない'];
    const quad = Q().vertices(p.targetQuadrilateral);
    if (!quad) return ['targetQuadrilateral が不正'];
    if (!Q().isSimple(fig, quad)) errors.push('証明する四角形が退化・自己交差している');
    else if (!Q().isConvex(fig, quad)) errors.push('証明する四角形が凸四角形ではない');
    if (p.conclusion !== Q().name(quad) + 'は' + PH.quadTypeName(p)) errors.push('結論の表記が targetQuadrilateral と一致しない');
    if (PH.quadConditionOrder(p).indexOf(pz.condition) < 0) errors.push('成立条件が無効: ' + pz.condition);
    if (isSpecial(p)) {
      // ひし形・長方形：証明する四角形は仮定で平行四辺形。条件の種類が結論と同じ。「すべて等しい」の確認の表示
      if (!S()) return errors.concat(['ひし形・長方形の判定（special-quadrilaterals.js）がない']);
      if (S().knownTypes(p, quad).indexOf('parallelogram') < 0) errors.push('証明する四角形が仮定で平行四辺形になっていない');
      if (S().knownTypes(p, quad).indexOf(targetType(p)) >= 0) errors.push('結論の種類が仮定にふくまれている');
      const c = S().CONDITIONS[pz.condition];
      if (c && c.type !== targetType(p)) errors.push('成立条件の種類が結論と合わない: ' + pz.condition);
      if (c && c.definition && !pz.chain) errors.push('「すべて等しい」の確認の表示（chain）がない');
      if (!holdsSpecial(fig, quad, targetType(p))) errors.push('図の四角形が' + PH.quadTypeName(p) + 'になっていない');
    }
    const els = G().getElements(fig);
    const ids = {};
    const steps = {};
    (p.proofSteps || []).forEach(function (s) { steps[s.id] = s; });
    pz.evidence.forEach(function (ev) {
      if (ids[ev.id]) errors.push('根拠IDが重複: ' + ev.id);
      ids[ev.id] = true;
      if ((p.evidence || []).some(function (e) { return e.id === ev.id; })) errors.push(ev.id + ': 合同の根拠とIDが重複');
      const key = evidenceKey(p, ev);
      if (!key) { errors.push(ev.id + ': 関係が作れない'); return; }
      if (ev.label !== relText(ev.items, ev.rel)) errors.push(ev.id + ': label と items が一致しない');
      ev.items.forEach(function (n) {
        let k = null;
        try { k = G().elementKey(fig, n); } catch (e) { /* 下で報告 */ }
        if (!k || !els.byKey[k]) errors.push(ev.id + ': 図で選択できない要素 ' + n);
      });
      if (!PH.REASONS[ev.reason]) errors.push(ev.id + ': 未定義の理由 ' + ev.reason);
      if (!holdsInFigure(fig, ev.items, ev.rel)) errors.push(ev.id + ': 図の上で成り立たない ' + ev.label);
      if ((ev.reason === 'proved') !== !!ev.fromStep) errors.push(ev.id + ': 導いた事実の根拠は reason: proved と fromStep の両方が必要');
      if (ev.fromStep) {
        const s = steps[ev.fromStep];
        if (!s) errors.push(ev.id + ': fromStep のステップがない');
        else if (factKey(fig, s.items || [], s.rel) !== key) errors.push(ev.id + ': 導いた事実と根拠の等式が一致しない');
      } else if (pz.reasons.indexOf(ev.reason) < 0) errors.push(ev.id + ': 理由が選択肢にない');
      if (ev.fromFinal) {
        // 三角形の合同から導いた結論（finalStep）そのもの
        if (!p.finalStep || factKey(fig, p.finalStep.items, 'eq') !== key) errors.push(ev.id + ': fromFinal なのに合同から導いた結論と一致しない');
        if (ev.reason !== PH.finalReasonFor(p)) errors.push(ev.id + ': fromFinal の理由は合同な図形の対応する辺（角）');
      }
      if (ev.reason === 'given' && p.given.indexOf(ev.given || ev.label) < 0) errors.push(ev.id + ': 仮定に書かれていない ' + ev.label);
      if (isPropertyReason(ev.reason)) {
        // 性質は、仮定の平行四辺形のものだけ（証明する四角形の性質を先に使わない）
        if (!knownProperties(p).some(function (f) { return f.key === key && f.reason === ev.reason; })) errors.push(ev.id + ': 仮定の平行四辺形の性質になっていない');
      }
      const rr = PH.REASONS[ev.reason];
      if (rr && rr.rel === 'parallel' && ev.rel !== 'parallel') errors.push(ev.id + ': 平行の理由なのに平行の関係ではない');
      if (CONVERSE_REASONS[ev.reason]) {
        if (!ev.via || ev.via.length !== 2) errors.push(ev.id + ': 平行を導く角（via）がない');
        else {
          const err = checkConverse(fig, ev.items, ev.via, CONVERSE_REASONS[ev.reason]);
          if (err) errors.push(ev.id + ': ' + err);
          if (!holdsInFigure(fig, ev.via, 'eq')) errors.push(ev.id + ': 平行を導く角が図の上で等しくない');
          // その角の等しさは、合同から導いた結論（finalStep）か、ステップの結論であること
          const vk = viaKey(p, ev);
          const fs = p.finalStep ? keysOf(fig, p.finalStep.items) : null;
          const fromFinal = fs && V().equationKey(fs[0], fs[1]) === vk;
          const fromStep = (p.proofSteps || []).some(function (s) { return s.items && factKey(fig, s.items, 'eq') === 'eq:' + vk; });
          if (!fromFinal && !fromStep && !rightVia(p, ev)) errors.push(ev.id + ': 平行を導く角の等しさが証明されていない');
        }
      }
      if (!(p.hints && p.hints[ev.id] && p.hints[ev.id].length === 3)) errors.push(ev.id + ': ヒントが3段階ない');
      // 証明する四角形の性質を「仮定より」などで使っていないか（仮定に書かれた関係はよい）
      if (!ev.fromStep && !isPropertyReason(ev.reason) && ev.reason !== 'given' && !CONVERSE_REASONS[ev.reason] && !ev.fromFinal) {
        errors.push(ev.id + ': 平行四辺形の根拠に使えない理由 ' + ev.reason);
      }
    });
    const derived = deriveCondition(p, pz.evidence);
    if (isSpecial(p)) {
      if (!derived || !derived.all.some(function (a) { return a.condition === pz.condition; })) errors.push('成立条件が根拠と一致しない: ' + (derived && derived.all.map(function (a) { return a.condition; }).join(',')));
    } else if (!derived || derived.condition !== pz.condition || derived.all.length !== 1) errors.push('成立条件が根拠と一致しない: ' + (derived && derived.all.map(function (a) { return a.condition; }).join(',')));
    // ほかの道すじの条件：仮定の関係から本当に言えること
    const gFacts = givenFacts(p);
    (pz.alternatives || []).forEach(function (c) {
      if (PH.quadConditionOrder(p).indexOf(c) < 0) { errors.push('alternatives が無効: ' + c); return; }
      if (c === pz.condition) errors.push('alternatives に正解の条件がある');
      const r = isSpecial(p) ? deriveCondition(p, [], gFacts) : deriveParallelogramCondition({ figure: fig, vertices: quad }, gFacts);
      if (!r || !r.all.some(function (a) { return a.condition === c; })) errors.push('alternatives が仮定から言えない: ' + c);
    });
    if (!(p.hints && p.hints.pcondition && p.hints.pcondition.length === 3)) errors.push('成立条件のヒントが3段階ない');
    // 書き出し（「四角形ABCDにおいて」）。三角形の合同の続きで書く問題（p35）は空でよい
    if (!Array.isArray(pz.intro) || (!pz.intro.length && !PH.hasLemma(p))) errors.push('parallelogram.intro がない');
    const dist = pz.distractors || {};
    (dist.equations || []).forEach(function (label) {
      const f = parseFact(label);
      if (!f) { errors.push('ダミーの形式が不正: ' + label); return; }
      const st = equationStatus(p, factKey(fig, f.items, f.rel));
      if (st === 'evidence' || st === 'irrelevant') errors.push('ダミーが正しい関係になっている: ' + label);
      if (st === 'wrong-equation' && holdsInFigure(fig, f.items, f.rel)) errors.push('ダミーが図の上で成り立って見える: ' + label);
    });
    (dist.reasons || []).forEach(function (r) { if (!PH.REASONS[r]) errors.push('ダミーの理由が未定義: ' + r); });
    return errors;
  }

  PH.PARALLELOGRAM_CONDITION_ORDER = ORDER;
  PH.parallelogram = {
    ORDER: ORDER,
    PROPERTY_REASONS: PROPERTY_REASONS,
    CONVERSE_REASONS: CONVERSE_REASONS,
    isQuad: isQuad,
    isSpecial: isSpecial,
    targetType: targetType,
    SPECIAL_PROPERTY_REASONS: SPECIAL_PROPERTY_REASONS,
    knownParallelogramList: knownParallelogramList,
    specialPropertyFacts: specialPropertyFacts,
    isTargetPropertyReason: isTargetPropertyReason,
    isTargetRelation: isTargetRelation,
    givenFacts: givenFacts,
    conditionLabel: conditionLabel,
    holdsSpecial: holdsSpecial,
    evidenceOf: evidenceOf,
    factKey: factKey,
    factKeyFromKeys: factKeyFromKeys,
    evidenceKey: evidenceKey,
    relText: relText,
    parseFact: parseFact,
    propertyFacts: propertyFacts,
    knownProperties: knownProperties,
    targetProperties: targetProperties,
    deriveParallelogramCondition: deriveParallelogramCondition,
    deriveCondition: deriveCondition,
    isMixedPair: isMixedPair,
    checkCondition: checkCondition,
    checkConverse: checkConverse,
    matchEvidence: matchEvidence,
    isPropertyReason: isPropertyReason,
    checkEvidence: checkEvidence,
    equationStatus: equationStatus,
    altRoute: altRoute,
    viaKey: viaKey,
    rightVia: rightVia,
    verifyKnown: verifyKnown,
    holdsInFigure: holdsInFigure,
    verify: verify,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.parallelogram;
})(typeof window !== 'undefined' ? window : globalThis);
