/*
 * special-quadrilaterals.js — 特別な平行四辺形（ひし形・長方形・正方形）の分類・成立条件・包含関係（Ver.1.0。DOMに依存しない）
 *
 * 図形の種類（QUADRILATERAL_TYPES）と包含関係
 *   ひし形・長方形は平行四辺形である。正方形は、ひし形でも長方形でもある（したがって平行四辺形でもある）。
 *   implied(type)  … その種類だと分かれば言える種類（自分と、より一般的な種類）。正方形 → 正方形・ひし形・長方形・平行四辺形
 *   isA(type, sup) … type の図形は sup であるといえるか（ひし形は平行四辺形：true／平行四辺形はひし形：false）
 *   上位（より一般的）の種類から、下位（より特別）の種類へは、成立条件がなければ変換しない。
 *
 * 成立条件（PH.SPECIAL_CONDITIONS）。「平行四辺形で…」の条件は、平行四辺形であることが前提（前提がなければ成り立たない）
 *   ひし形   rhombusDefinition（4つの辺がすべて等しい）/ rhombusAdjacentEqual（平行四辺形で、となり合う2辺が等しい）
 *            / rhombusDiagonalPerpendicular（平行四辺形で、対角線が垂直に交わる）
 *   長方形   rectangleDefinition（4つの角がすべて等しい）/ rectangleOneRightAngle（平行四辺形で、1つの角が直角）
 *            / rectangleDiagonalsEqual（平行四辺形で、対角線の長さが等しい）
 *   正方形   squareDefinition（4つの辺がすべて等しく、4つの角がすべて等しい）/ squareRectangleAdjacent（長方形で、となり合う2辺が等しい）
 *            / squareRhombusRightAngle（ひし形で、1つの角が直角）/ squareDiagonals（平行四辺形で、対角線の長さが等しく、垂直に交わる）
 *
 * 2つの使い方
 *   1. 性質の記号（atoms）による分類（段位認定の「四角形の名前」の問題）：
 *        guaranteedTypes(base, atoms) … base（分かっている種類）と atoms から必ず言える種類の一覧
 *        classify(base, atoms)        … 必ず言える、最も特別な種類（正方形 ＞ ひし形・長方形 ＞ 平行四辺形）
 *   2. 図の事実（等式・直角）による成立条件の判定（ハンター・パズル）：
 *        deriveSpecialCondition({ figure, vertices, knownTypes }, facts) … 成り立つ成立条件の一覧
 *        facts … [{ id, items, rel }]（rel：'eq' 等しい／'right' 直角（items は角1つ））。key を直接渡してもよい
 *        「4つの辺がすべて等しい」は、辺の等式をつないで（AB＝DC、AD＝BC、AB＝AD → AB＝BC＝CD＝DA）判定する
 *
 * 仮定に書く四角形の種類は「四角形ABCDはひし形」の形（knownTypes(p) で読む）。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  function G() { return PH.geometry; }
  function Q() { return PH.quadrilateral; }
  function V() { return PH.validation; }

  const QUADRILATERAL_TYPES = { parallelogram: '平行四辺形', rhombus: 'ひし形', rectangle: '長方形', square: '正方形' };
  const TYPE_ORDER = ['parallelogram', 'rhombus', 'rectangle', 'square'];
  // すぐ上の（より一般的な）種類
  const PARENTS = { parallelogram: [], rhombus: ['parallelogram'], rectangle: ['parallelogram'], square: ['rhombus', 'rectangle'] };
  // 特別さの段階（大きいほど特別）
  const LEVEL = { parallelogram: 1, rhombus: 2, rectangle: 2, square: 3 };

  // 性質の記号（段位認定の問題文・分類に使う）
  const ATOMS = {
    adjacentSidesEqual: { text: 'となり合う2辺が等しい' },
    allSidesEqual: { text: '4つの辺がすべて等しい' },
    oneRightAngle: { text: '1つの角が直角' },
    allAnglesEqual: { text: '4つの角がすべて等しい' },
    diagonalsEqual: { text: '対角線の長さが等しい' },
    diagonalsPerpendicular: { text: '対角線が垂直に交わる' },
  };

  /*
   * 成立条件。type：その条件で言える種類、premise：前提の種類（null は前提なし）、atoms：必要な性質
   *   label … 選択肢の表示、proof … 証明文の書き方（「…ので」の前）
   */
  const CONDITIONS = {
    rhombusDefinition:            { type: 'rhombus', premise: null, atoms: ['allSidesEqual'], label: '4つの辺がすべて等しい', definition: true },
    rhombusAdjacentEqual:         { type: 'rhombus', premise: 'parallelogram', atoms: ['adjacentSidesEqual'], label: '平行四辺形で、となり合う2辺が等しい' },
    rhombusDiagonalPerpendicular: { type: 'rhombus', premise: 'parallelogram', atoms: ['diagonalsPerpendicular'], label: '平行四辺形で、対角線が垂直に交わる' },
    rectangleDefinition:          { type: 'rectangle', premise: null, atoms: ['allAnglesEqual'], label: '4つの角がすべて等しい', definition: true },
    rectangleOneRightAngle:       { type: 'rectangle', premise: 'parallelogram', atoms: ['oneRightAngle'], label: '平行四辺形で、1つの角が直角' },
    rectangleDiagonalsEqual:      { type: 'rectangle', premise: 'parallelogram', atoms: ['diagonalsEqual'], label: '平行四辺形で、対角線の長さが等しい' },
    squareDefinition:             { type: 'square', premise: null, atoms: ['allSidesEqual', 'allAnglesEqual'], label: '4つの辺と角がすべて等しい', definition: true },
    squareRectangleAdjacent:      { type: 'square', premise: 'rectangle', atoms: ['adjacentSidesEqual'], label: '長方形で、となり合う2辺が等しい' },
    squareRhombusRightAngle:      { type: 'square', premise: 'rhombus', atoms: ['oneRightAngle'], label: 'ひし形で、1つの角が直角' },
    squareDiagonals:              { type: 'square', premise: 'parallelogram', atoms: ['diagonalsEqual', 'diagonalsPerpendicular'], label: '平行四辺形で、対角線の長さが等しく、垂直に交わる' },
  };
  const CONDITION_ORDER = Object.keys(CONDITIONS);
  // ハンター・パズルで選ぶ成立条件（ひし形・長方形を証明する問題。正方形の証明は今回あつかわない）
  const PROOF_CONDITION_ORDER = ['rhombusDefinition', 'rhombusAdjacentEqual', 'rhombusDiagonalPerpendicular',
    'rectangleDefinition', 'rectangleOneRightAngle', 'rectangleDiagonalsEqual'];

  // その種類の図形が必ずもつ性質
  const TYPE_ATOMS = {
    parallelogram: [],
    rhombus: ['adjacentSidesEqual', 'allSidesEqual', 'diagonalsPerpendicular'],
    rectangle: ['oneRightAngle', 'allAnglesEqual', 'diagonalsEqual'],
    square: [],
  };

  // ---- 包含関係 -------------------------------------------------------------------

  function isType(t) { return Object.prototype.hasOwnProperty.call(QUADRILATERAL_TYPES, t); }

  // その種類だと分かれば言える種類（自分をふくむ。下位 → 上位の向きだけ）
  function implied(type) {
    const out = [];
    (function visit(t) {
      if (!isType(t) || out.indexOf(t) >= 0) return;
      out.push(t);
      PARENTS[t].forEach(visit);
    })(type);
    return out.sort(function (a, b) { return TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b); });
  }

  function isA(type, sup) { return implied(type).indexOf(sup) >= 0; }

  // 種類の一覧を、包含関係で閉じる
  function closeTypes(types) {
    const out = [];
    (types || []).forEach(function (t) { implied(t).forEach(function (x) { if (out.indexOf(x) < 0) out.push(x); }); });
    return out.sort(function (a, b) { return TYPE_ORDER.indexOf(a) - TYPE_ORDER.indexOf(b); });
  }

  // 最も特別な種類（同じ段階が2つ（ひし形と長方形）なら、それは正方形として閉じているはず）
  function mostSpecific(types) {
    const list = closeTypes(types);
    if (!list.length) return null;
    if (list.indexOf('rhombus') >= 0 && list.indexOf('rectangle') >= 0) return 'square';
    return list.reduce(function (a, b) { return LEVEL[b] > LEVEL[a] ? b : a; });
  }

  // ---- 性質の記号による分類（段位認定） -----------------------------------------------------

  /*
   * base（分かっている種類。'quadrilateral' か null はただの四角形）と atoms から、必ず言える種類の一覧。
   * 成立条件をくり返し使い、それ以上ふえなくなるまで閉じる。前提（平行四辺形など）がない条件は使わない。
   */
  function guaranteedTypes(base, atoms) {
    let types = isType(base) ? implied(base) : [];
    let have = (atoms || []).slice();
    const addAtoms = function () {
      types.forEach(function (t) { TYPE_ATOMS[t].forEach(function (a) { if (have.indexOf(a) < 0) have.push(a); }); });
      // 4つの辺がすべて等しい → となり合う2辺も等しい。4つの角がすべて等しい（すべて直角）→ 1つの角が直角
      if (have.indexOf('allSidesEqual') >= 0 && have.indexOf('adjacentSidesEqual') < 0) have.push('adjacentSidesEqual');
      if (have.indexOf('allAnglesEqual') >= 0 && have.indexOf('oneRightAngle') < 0) have.push('oneRightAngle');
    };
    let changed = true;
    let guard = 0;
    while (changed && guard++ < 20) {
      changed = false;
      addAtoms();
      CONDITION_ORDER.forEach(function (id) {
        const c = CONDITIONS[id];
        if (types.indexOf(c.type) >= 0) return;
        if (c.premise && types.indexOf(c.premise) < 0) return;
        if (!c.atoms.every(function (a) { return have.indexOf(a) >= 0; })) return;
        types = closeTypes(types.concat([c.type]));
        changed = true;
      });
      // ひし形でも長方形でもある → 正方形
      if (types.indexOf('rhombus') >= 0 && types.indexOf('rectangle') >= 0 && types.indexOf('square') < 0) {
        types = closeTypes(types.concat(['square']));
        changed = true;
      }
    }
    return types;
  }

  function classify(base, atoms) { return mostSpecific(guaranteedTypes(base, atoms)); }

  // その分類を言うのに使える成立条件（base と atoms から、その条件1回で type が言える）
  function conditionsFor(base, atoms, type) {
    const types = isType(base) ? implied(base) : [];
    const have = (atoms || []).slice();
    return CONDITION_ORDER.filter(function (id) {
      const c = CONDITIONS[id];
      return c.type === type && (!c.premise || types.indexOf(c.premise) >= 0) && c.atoms.every(function (a) { return have.indexOf(a) >= 0; });
    });
  }

  // ---- 図の事実による成立条件の判定（ハンター・パズル） ---------------------------------------------

  // 仮定の文「四角形ABCDはひし形」から、分かっている四角形と種類
  function parseTypeText(text) {
    const m = /^四角形([A-Z]{4})は(平行四辺形|ひし形|長方形|正方形)$/.exec(String(text));
    if (!m) return null;
    const type = TYPE_ORDER.find(function (t) { return QUADRILATERAL_TYPES[t] === m[2]; });
    return { vertices: m[1].split(''), type: type };
  }

  // 四角形の頂点の並び（回転・逆回り）を同じものとみなすキー
  function quadKey(q) {
    const v = Q().vertices(q);
    if (!v) return null;
    const cands = [];
    for (let i = 0; i < 4; i++) {
      const r = v.slice(i).concat(v.slice(0, i));
      cands.push(r.join(''));
      cands.push(r.slice().reverse().join(''));
    }
    return cands.sort()[0];
  }

  // 問題の仮定から分かっている四角形の種類（包含関係で閉じた種類の一覧）: [{ vertices, types }]
  function knownQuads(p) {
    const byKey = {};
    const add = function (vertices, type) {
      const k = quadKey(vertices);
      if (!k) return;
      if (!byKey[k]) byKey[k] = { vertices: Q().vertices(vertices), types: [] };
      byKey[k].types = closeTypes(byKey[k].types.concat([type]));
    };
    (p.knownParallelograms || []).forEach(function (q) { add(q, 'parallelogram'); });
    (p.given || []).forEach(function (g) {
      const t = parseTypeText(g);
      if (t) add(t.vertices, t.type);
    });
    return Object.keys(byKey).map(function (k) { return byKey[k]; });
  }

  // 四角形 q について、仮定から分かっている種類
  function knownTypes(p, q) {
    const k = quadKey(q);
    const hit = knownQuads(p).find(function (x) { return quadKey(x.vertices) === k; });
    return hit ? hit.types.slice() : [];
  }

  // 仮定で、その種類（以上に特別）だと分かっている四角形の一覧
  function knownOfType(p, type) {
    return knownQuads(p).filter(function (x) { return x.types.indexOf(type) >= 0; }).map(function (x) { return x.vertices; });
  }

  // 「∠A」（四角形の頂点1文字）を、四角形の角の名前（∠DAB）に
  function quadAngleName(q, name) {
    const s = String(name).replace(/[∠\s]/g, '');
    if (s.length === 3) return '∠' + s;
    const v = Q().vertices(q);
    const i = v ? v.indexOf(s) : -1;
    return i >= 0 ? Q().angles(v)[i] : null;
  }

  // 事実のキー（等式は parallelogram.factKey と同じ 'eq:…'、直角は 'right:' + 角のキー）
  function factKey(fig, items, rel) {
    if (rel === 'right') {
      try { return 'right:' + G().elementKey(fig, items[0]); } catch (e) { return null; }
    }
    return PH.parallelogram.factKey(fig, items, rel);
  }

  // 仮定の文から事実（「∠A＝90°」「∠DAB＝90°」は直角、「AB＝AD」は等式）
  function parseGivenFact(q, text) {
    const s = String(text);
    const m = /^(∠[A-Z]{1,3})＝90°$/.exec(s);
    if (m) {
      const n = quadAngleName(q, m[1]);
      return n ? { rel: 'right', items: [n] } : null;
    }
    return PH.parallelogram.parseFact(s);
  }

  // 要素のつながり（等式で結ばれた辺・角の組）。union-find
  function unionFind() {
    const parent = {};
    const find = function (x) {
      if (parent[x] == null) parent[x] = x;
      while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
      return x;
    };
    return { find: find, union: function (a, b) { parent[find(a)] = find(b); } };
  }

  /*
   * 図の事実から、四角形の成立条件を導く。
   *   quad … { figure, vertices, knownTypes（仮定で分かっている種類。平行四辺形の前提に使う） }
   *   facts … [{ id, items, rel }]（rel：'eq'／'right'）
   * 戻り値：[{ condition, type, used: [事実のID] }]（成り立つ条件すべて）。四角形が退化・自己交差していれば空
   */
  function deriveSpecialCondition(quad, facts) {
    const fig = quad.figure;
    const v = Q().vertices(quad.vertices);
    if (!v || !Q().isSimple(fig, v)) return [];
    const types = closeTypes(quad.knownTypes || []);
    const isPara = types.indexOf('parallelogram') >= 0;
    const list = (facts || []).map(function (f, i) {
      return { id: f.id != null ? f.id : i, rel: f.rel || 'eq', key: f.key || factKey(fig, f.items, f.rel || 'eq'), items: f.items };
    }).filter(function (f) { return f.key; });
    const keyOf = function (n) { return G().elementKey(fig, n); };
    const sides = Q().sides(v).map(keyOf);
    const angs = Q().angles(v).map(keyOf);
    const diags = Q().diagonals(v);
    const uf = unionFind();
    const eqFacts = list.filter(function (f) { return f.rel === 'eq'; });
    eqFacts.forEach(function (f) {
      const k = f.items.map(keyOf);
      uf.union(k[0], k[1]);
    });
    const allSame = function (keys) { return keys.every(function (k) { return uf.find(k) === uf.find(keys[0]); }); };
    // つながりに使った事実（4つの要素のどれかをふくむ等式。つないだ組に関係するもの）
    const usedFor = function (keys) {
      const root0 = uf.find(keys[0]);
      return eqFacts.filter(function (f) { return uf.find(f.items.map(keyOf)[0]) === root0; }).map(function (f) { return f.id; });
    };
    const rights = list.filter(function (f) { return f.rel === 'right'; });
    const rightAt = function (angKey) { return rights.find(function (f) { return f.key === 'right:' + angKey; }); };
    const out = [];
    const add = function (condition, used) { out.push({ condition: condition, type: CONDITIONS[condition].type, used: used }); };
    // ひし形
    if (allSame(sides)) add('rhombusDefinition', usedFor(sides));
    if (isPara) {
      const adj = [0, 1, 2, 3].map(function (i) { return [sides[i], sides[(i + 1) % 4]]; }).find(function (pr) { return uf.find(pr[0]) === uf.find(pr[1]); });
      if (adj) add('rhombusAdjacentEqual', usedFor(adj));
    }
    // 長方形：4つの角がすべて等しい（等式でつながる）か、4つとも直角
    const allRight = angs.every(function (k) { return rightAt(k) || angs.some(function (k2) { return uf.find(k2) === uf.find(k) && rightAt(k2); }); });
    if (allSame(angs) || allRight) add('rectangleDefinition', allSame(angs) ? usedFor(angs) : rights.map(function (f) { return f.id; }));
    if (isPara) {
      const r = angs.map(function (k) { return rightAt(k); }).find(Boolean);
      if (r) add('rectangleOneRightAngle', [r.id]);
      const dk = factKey(fig, diags, 'eq');
      const d = eqFacts.find(function (f) { return f.key === dk; });
      if (d) add('rectangleDiagonalsEqual', [d.id]);
    }
    return out;
  }

  // ---- データの確認 -----------------------------------------------------------------

  // 段位認定の分類の問題と、成立条件の表の整合性（問題がなければ空配列）
  function verifyTables() {
    const errors = [];
    CONDITION_ORDER.forEach(function (id) {
      const c = CONDITIONS[id];
      if (!isType(c.type)) errors.push(id + ': 種類が不正');
      if (c.premise && !isType(c.premise)) errors.push(id + ': 前提の種類が不正');
      c.atoms.forEach(function (a) { if (!ATOMS[a]) errors.push(id + ': 性質が不正 ' + a); });
      // その条件だけで、その種類が言える
      if (!isA(classify(c.premise, c.atoms), c.type)) errors.push(id + ': 条件から種類が言えない');
      // 前提（平行四辺形など）がなければ言えない
      if (c.premise && isA(classify(null, c.atoms) || 'none', c.type)) errors.push(id + ': 前提がなくても言えてしまう');
    });
    return errors;
  }

  PH.QUADRILATERAL_TYPES = QUADRILATERAL_TYPES;
  PH.SPECIAL_CONDITIONS = CONDITIONS;
  PH.specialQuad = {
    TYPES: QUADRILATERAL_TYPES,
    TYPE_ORDER: TYPE_ORDER,
    PARENTS: PARENTS,
    ATOMS: ATOMS,
    TYPE_ATOMS: TYPE_ATOMS,
    CONDITIONS: CONDITIONS,
    CONDITION_ORDER: CONDITION_ORDER,
    PROOF_CONDITION_ORDER: PROOF_CONDITION_ORDER,
    typeName: function (t) { return QUADRILATERAL_TYPES[t] || '四角形'; },
    isType: isType,
    implied: implied,
    isA: isA,
    closeTypes: closeTypes,
    mostSpecific: mostSpecific,
    guaranteedTypes: guaranteedTypes,
    classify: classify,
    conditionsFor: conditionsFor,
    parseTypeText: parseTypeText,
    quadKey: quadKey,
    knownQuads: knownQuads,
    knownTypes: knownTypes,
    knownOfType: knownOfType,
    quadAngleName: quadAngleName,
    factKey: factKey,
    parseGivenFact: parseGivenFact,
    deriveSpecialCondition: deriveSpecialCondition,
    verifyTables: verifyTables,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.specialQuad;
})(typeof window !== 'undefined' ? window : globalThis);
