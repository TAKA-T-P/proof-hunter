/*
 * problems.js — 問題データ・理由・合同条件の定義
 *
 * 問題を追加するときは PH.problems に1件追加するだけでよい。
 * 判定ロジック（validation.js）は問題固有の if 文を持たず、このデータを参照する。
 * 書式の詳細は README.md「問題データの追加方法」を参照。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  // 等しい理由の選択肢。label: 選択肢表示 / short: スロット表示 / proof: 証明文での書き方
  PH.REASONS = {
    given:         { label: '仮定より',               short: '仮定より', proof: '仮定より' },
    common:        { label: '共通な辺より',           short: '共通な辺', proof: '共通な辺だから' },
    commonAngle:   { label: '共通な角より',           short: '共通な角', proof: '共通な角だから' },
    vertical:      { label: '対頂角より',             short: '対頂角',   proof: '対頂角は等しいから' },
    alternate:     { label: '平行線の錯角より',       short: '錯角',     proof: '平行線の錯角は等しいから' },
    corresponding: { label: '平行線の同位角より',     short: '同位角',   proof: '平行線の同位角は等しいから' },
    // Ver.0.5：合同を示したあとの「最終結論」専用の理由（根拠を集める段階では使えない）
    correspondingSides:  { label: '合同な図形の対応する辺より', short: '対応する辺', proof: '合同な図形の対応する辺は等しいから', finalOnly: true },
    correspondingAngles: { label: '合同な図形の対応する角より', short: '対応する角', proof: '合同な図形の対応する角は等しいから', finalOnly: true },
    // Ver.0.7：定理を1ステップで使う理由と、導いた等式（前のステップで証明した事実）を根拠に使う理由
    isoscelesBaseAngles: { label: '二等辺三角形の底角より', short: '底角', proof: '二等辺三角形の底角は等しいから' },
    equilateralSides:    { label: '正三角形の辺より',       short: '正三角形', proof: '正三角形の3辺は等しいから' },
    proved:              { label: '導いた等式より',         short: '導いた等式', proof: '導いた等式より', meta: true },
    // Ver.0.8：直角であることの理由（rightOnly：直角の確認だけで選ぶ）と、正方形の辺
    perpendicular:       { label: '垂直な2直線がつくる角より', short: '垂直', proof: '垂直な2直線がつくる角だから', rightOnly: true },
    squareAngle:         { label: '正方形の角より',         short: '正方形の角', proof: '正方形の角だから', rightOnly: true },
    squareSides:         { label: '正方形の辺より',         short: '正方形の辺', proof: '正方形の4辺は等しいから' },
    // Ver.0.9：平行四辺形の性質（平行四辺形だと分かっている四角形にだけ使える。quadOnly：四角形の根拠だけで選ぶ）と、
    //          平行を導く理由（錯角・同位角が等しい → 2直線は平行）。rel: 'parallel' は平行の関係（AB∥DC）の理由
    parallelogramSides:     { label: '平行四辺形の対辺は等しい', short: '平行四辺形の対辺', proof: '平行四辺形の対辺は等しいから', quadOnly: true },
    parallelogramParallel:  { label: '平行四辺形の対辺は平行', short: '平行四辺形の対辺（平行）', proof: '平行四辺形の対辺は平行だから', quadOnly: true, rel: 'parallel' },
    parallelogramAngles:    { label: '平行四辺形の対角は等しい', short: '平行四辺形の対角', proof: '平行四辺形の対角は等しいから', quadOnly: true },
    parallelogramDiagonals: { label: '平行四辺形の対角線はそれぞれの中点で交わる', short: '平行四辺形の対角線', proof: '平行四辺形の対角線はそれぞれの中点で交わるから', quadOnly: true },
    alternateConverse:      { label: '錯角が等しいから（平行）', short: '錯角が等しい', proof: '錯角が等しいから', quadOnly: true, rel: 'parallel' },
    correspondingConverse:  { label: '同位角が等しいから（平行）', short: '同位角が等しい', proof: '同位角が等しいから', quadOnly: true, rel: 'parallel' },
    // Ver.1.0：ひし形の性質（仮定でひし形と分かっている四角形にだけ使える）と、中点
    rhombusSides:  { label: 'ひし形の4辺は等しい', short: 'ひし形の辺', proof: 'ひし形の4辺は等しいから' },
    rhombusAngles: { label: 'ひし形の対角は等しい', short: 'ひし形の対角', proof: 'ひし形の対角は等しいから' },
    midpoint:      { label: '中点より', short: '中点', proof: '中点だから' },
    // 作図で等しい半径の円をかいたことから等しい線分（p48。仮定に作図のしかたが書かれているので「仮定より」でもよい）
    construction:  { label: '作図より', short: '作図', proof: '作図より' },
    // 長方形の性質（仮定で長方形と分かっている四角形にだけ使える。p46）
    rectangleSides:  { label: '長方形の対辺は等しい', short: '長方形の対辺', proof: '長方形の対辺は等しいから' },
    rectangleAngles: { label: '長方形の4つの角は等しい', short: '長方形の角', proof: '長方形の角はすべて90°だから' },
  };

  // 結論の種類（Ver.0.5）。conclusionType がない問題は三角形の合同
  PH.CONCLUSION_TYPES = ['triangleCongruence', 'equalSide', 'equalAngle', 'isoscelesTriangle', 'parallelogram', 'parallelLines', 'rhombus', 'rectangle', 'perpendicular'];
  PH.conclusionType = function (p) { return p.conclusionType || 'triangleCongruence'; };
  // 合同を示したあと、対応する辺・角の等しさを導く問題か（三角形選択・最終結論のステップがある）
  PH.hasFinalStep = function (p) { return PH.conclusionType(p) !== 'triangleCongruence' && !!p.finalStep; };
  // 途中で示す（または結論の）三角形の合同の表記 '△ABD≡△CBD'
  PH.congruenceText = function (p) { return '△' + p.triangles[0].join('') + '≡△' + p.triangles[1].join(''); };
  // 最終結論の理由（辺なら対応する辺、角なら対応する角）
  PH.finalReasonFor = function (p) { return p.finalStep.relationType === 'angle' ? 'correspondingAngles' : 'correspondingSides'; };
  // Ver.0.9：結論が「四角形…は平行四辺形」の問題（js/parallelogram-rules.js）。
  //   hasLemma … 平行四辺形の根拠を集める前に、三角形の合同を示す部分（triangles・evidence・congruence・finalStep）がある
  //   Ver.1.0：結論が「四角形…はひし形」「…は長方形」の問題（conclusionType 'rhombus'・'rectangle'）も四角形の問題。
  //     四角形の部分のデータは、どの種類でも parallelogram（根拠・成立条件）に書く。成立条件は js/special-quadrilaterals.js
  PH.QUAD_CONCLUSIONS = ['parallelogram', 'rhombus', 'rectangle'];
  PH.isQuadProblem = function (p) { return !!p && PH.QUAD_CONCLUSIONS.indexOf(PH.conclusionType(p)) >= 0; };
  // 証明する四角形の種類（'parallelogram'・'rhombus'・'rectangle'。四角形の問題でなければ null）
  PH.quadType = function (p) { return PH.isQuadProblem(p) ? PH.conclusionType(p) : null; };
  PH.QUAD_TYPE_NAMES = { parallelogram: '平行四辺形', rhombus: 'ひし形', rectangle: '長方形', square: '正方形' };
  PH.quadTypeName = function (p) { return PH.QUAD_TYPE_NAMES[PH.quadType(p)] || '四角形'; };
  // 四角形の成立条件の表示（平行四辺形の5つの条件と、ひし形・長方形の条件）
  PH.quadCondition = function (id) {
    return PH.PARALLELOGRAM_CONDITIONS[id] || (PH.SPECIAL_CONDITIONS && PH.SPECIAL_CONDITIONS[id]) || null;
  };
  // 問題ごとの成立条件の選択肢（平行四辺形は5つ。ひし形・長方形は、ひし形の3つと長方形の3つ）
  //   Ver.1.0：問題ごとに parallelogram.choices があればそれ（p44・p45 は「4つの辺／4つの角／4つの辺と角がすべて等しい」の3択）
  PH.quadConditionOrder = function (p) {
    if (PH.quadType(p) === 'parallelogram' || !PH.specialQuad) return PH.PARALLELOGRAM_CONDITION_ORDER.slice();
    if (p.parallelogram && p.parallelogram.choices) return p.parallelogram.choices.slice();
    return PH.specialQuad.PROOF_CONDITION_ORDER.slice();
  };
  PH.hasLemma = function (p) { return PH.isQuadProblem(p) && Array.isArray(p.triangles) && p.triangles.length === 2; };
  // 三角形の合同を示す部分がある問題か（平行四辺形だけの問題は、三角形・合同条件がない）
  //   Ver.1.0：合同を使わずに結論を導く問題（p50。2つの角が等しいので二等辺三角形）も、三角形の合同の部分がない
  PH.isGoalOnly = function (p) { return !!p && PH.conclusionType(p) === 'isoscelesTriangle' && !p.triangles; };
  PH.hasCongruence = function (p) { return !PH.isGoalOnly(p) && (!PH.isQuadProblem(p) || PH.hasLemma(p)); };

  // 三角形の合同条件（中学数学の標準的な表現）
  PH.CONDITIONS = {
    SSS: { label: '3組の辺がそれぞれ等しい' },
    SAS: { label: '2組の辺とその間の角がそれぞれ等しい' },
    ASA: { label: '1組の辺とその両端の角がそれぞれ等しい' },
    // Ver.0.8：直角三角形の合同条件（2つの三角形が直角三角形であることが前提。js/right-triangle.js で判定）
    RHA: { label: '直角三角形の斜辺と1つの鋭角がそれぞれ等しい', right: true },
    RHS: { label: '直角三角形の斜辺と他の1辺がそれぞれ等しい', right: true },
  };
  // Ver.0.9：平行四辺形になるための条件（成立条件）。判定は js/parallelogram-rules.js
  PH.PARALLELOGRAM_CONDITIONS = {
    PP_PARALLEL_PAIRS:      { label: '2組の対辺がそれぞれ平行', no: '①', definition: true },
    PP_EQUAL_SIDES:         { label: '2組の対辺がそれぞれ等しい', no: '②' },
    PP_EQUAL_ANGLES:        { label: '2組の対角がそれぞれ等しい', no: '③' },
    PP_BISECT_DIAGONALS:    { label: '対角線がそれぞれの中点で交わる', no: '④' },
    PP_PARALLEL_EQUAL_PAIR: { label: '1組の対辺が平行で、その長さが等しい', no: '⑤' },
  };
  PH.CONDITION_ORDER = ['SSS', 'SAS', 'ASA'];
  PH.RIGHT_CONDITION_ORDER = ['SSS', 'SAS', 'ASA', 'RHA', 'RHS'];
  // 直角三角形の合同条件で証明する問題か（Ver.0.8）
  PH.isRightProblem = function (p) { return !!(p && PH.CONDITIONS[p.congruence] && PH.CONDITIONS[p.congruence].right); };
  // 問題ごとの合同条件の選択肢：直角三角形の問題は5つ、それ以外は従来の3つ
  PH.conditionOrder = function (p) { return PH.isRightProblem(p) ? PH.RIGHT_CONDITION_ORDER : PH.CONDITION_ORDER; };
  // 根拠の表示（直角の確認は「∠ABC＝∠DEF＝90°」。label は2つの角の等式のまま）
  PH.evidenceText = function (ev) { return ev.role === 'right' ? ev.label + '＝90°' : ev.label; };
  /*
   * その根拠の理由として正しいと認める理由。標準の理由（ev.reason）に加えて：
   *   垂直から言える直角（perpendicular）は、仮定に「BD⊥AC」と書かれているので「仮定より」も正しい
   */
  //   Ver.1.0：中点から言える等しい線分（midpoint）も、仮定に「MはADの中点」と書かれているので「仮定より」も正しい。
  //            ev.alsoReasons … ほかにも正しい理由（ひし形の対角は、ひし形が平行四辺形なので「平行四辺形の対角は等しい」でもよい）
  PH.acceptedReasons = function (ev) {
    const base = ev.reason === 'perpendicular' ? ['perpendicular', 'given'] : ev.reason === 'midpoint' ? ['midpoint', 'given']
      : ev.reason === 'construction' ? ['construction', 'given'] : [ev.reason];
    return base.concat(ev.alsoReasons || []);
  };

  // ステージ（問題の stage で参照）
  PH.STAGES = [
    { id: 1, title: 'はじめての証明',     theme: '仮定・共通な辺を使って、3つの合同条件で証明しよう！' },
    { id: 2, title: '対頂角を見つけろ！', theme: '対頂角と、辺・角の組み合わせを見抜こう！' },
    { id: 3, title: '平行線を使いこなせ！', theme: '平行線の錯角・同位角を見つけよう！' },
    { id: 4, title: '証明マスターへの道', theme: 'いろいろな根拠を組み合わせよう！' },
    { id: 5, title: '合同から結論を導け！', theme: 'どの三角形を合同にする？ 合同から辺・角の等しさを証明しよう！' },
    { id: 6, title: '二等辺三角形・正三角形を攻略せよ！', theme: '二等辺三角形・正三角形の性質を使って新しい根拠を導き、証明をつなげよう！' },
    { id: 7, title: '直角三角形を攻略せよ！', theme: '直角を確かめ、斜辺を見つけて、直角三角形の合同条件を使いこなそう！' },
    { id: 8, title: '平行四辺形を利用せよ！', theme: '平行四辺形の性質（対辺・対角線）を使って、三角形の合同を証明しよう！' },
    { id: 9, title: '平行四辺形を証明せよ！', theme: '何を示せば平行四辺形といえる？ 5つの成立条件から逆算して根拠を集めよう！' },
    { id: 10, title: '特別な平行四辺形', theme: 'ひし形・長方形の性質を使い、証明を完成させよう！' },
  ];

  // 合同条件を選ぶときのヒント（問題データから呼び出す共通文）
  function sssHints() {
    return [
      { text: '集めた根拠は「辺」かな？「角」かな？ それぞれ何組あるか数えてみよう。' },
      { text: '集めた3つの根拠は、どれも辺が等しいことだね。' },
      { text: '「3組の辺がそれぞれ等しい」を選ぼう！' },
    ];
  }
  function sasHints(angle, sides) {
    return [
      { text: '集めた根拠は、辺が何組、角が何組かな？' },
      { text: '等しい角' + angle + 'は、' + sides + 'の「間」にあるかな？' },
      { text: '2組の辺と、その間の角が等しいね。「2組の辺とその間の角がそれぞれ等しい」を選ぼう！' },
    ];
  }
  function asaHints(angles, side) {
    return [
      { text: '集めた根拠は、辺が何組、角が何組かな？' },
      { text: '等しい角' + angles + 'は、' + side + 'の「両端」にあるかな？' },
      { text: '1組の辺と、その両端の角が等しいね。「1組の辺とその両端の角がそれぞれ等しい」を選ぼう！' },
    ];
  }
  // Ver.0.8：直角三角形の合同条件
  function rhsHints() {
    return [
      { text: '直角三角形のどの辺が斜辺かな？ 集めた根拠を確認しよう。' },
      { text: '直角のほかに、斜辺と、もう1組の対応する辺が等しいね。' },
      { text: '斜辺と他の1辺がそれぞれ等しい、という条件を使おう！「直角三角形の斜辺と他の1辺がそれぞれ等しい」を選ぼう！' },
    ];
  }
  function rhaHints() {
    return [
      { text: '斜辺のほかに、等しい角はないかな？' },
      { text: '直角ではない方の角（鋭角）が等しいね。' },
      { text: '斜辺と1つの鋭角がそれぞれ等しい、という条件を使おう！「直角三角形の斜辺と1つの鋭角がそれぞれ等しい」を選ぼう！' },
    ];
  }
  // 直角の確認・斜辺のヒント（Ver.0.8）
  function rightHints(where, reasonText, label, focus) {
    return [
      { text: '2つの三角形の中に90°の角はあるかな？' },
      { text: where, focus: focus },
      { text: 'この2つの角が直角であることを確認しよう。' + reasonText + ' ' + label + '＝90° だね！', focus: focus },
    ];
  }
  function hypHints(where, last, focus) {
    return [
      { text: '直角三角形のどの辺が斜辺かな？ 斜辺は、直角に向かい合う辺だよ。' },
      { text: where, focus: focus },
      { text: last, focus: focus },
    ];
  }

  PH.problems = [
    // ------------------------------------------------------------------
    {
      id: 'p01',
      number: '01',
      title: '共通な辺を見つけろ！',
      difficulty: 1,
      stage: 1,
      statement: '四角形ABCDで、AB＝CB、AD＝CDのとき、△ABD≡△CBDであることを証明しよう。',
      given: ['AB＝CB', 'AD＝CD'],
      conclusion: '△ABD≡△CBD',
      // 対応順に並べた2つの三角形（A↔C, B↔B, D↔D）
      triangles: [['A', 'B', 'D'], ['C', 'B', 'D']],
      figure: {
        viewBox: [0, 0, 400, 400],
        points: {
          A: { x: 150, y: 45,  label: [0, -22] },
          B: { x: 40,  y: 200, label: [-22, 0] },
          C: { x: 150, y: 355, label: [0, 24] },
          D: { x: 340, y: 200, label: [22, 0] },
        },
        lines: [],                       // 3点以上が一直線上に並ぶ線（角の同一性判定に使用）
        segments: ['AB', 'AD', 'CB', 'CD', 'BD'],
        angles: ['BAD', 'ABD', 'ADB', 'BCD', 'CBD', 'CDB'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical'],
      evidence: [
        { id: 'e1', items: ['AB', 'CB'], reason: 'given',  label: 'AB＝CB', mark: 1 },
        { id: 'e2', items: ['AD', 'CD'], reason: 'given',  label: 'AD＝CD', mark: 2 },
        { id: 'e3', items: ['BD', 'BD'], reason: 'common', label: 'BD＝BD', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'SSS',
      proof: { intro: '△ABDと△CBDにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'fill', distractors: { equations: ['AB＝AD', 'CB＝CD', 'AD＝BD'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定に書かれていることは、そのまま根拠に使えるよ。' },
          { text: '仮定の「AB＝CB」を図で探してみよう。辺ABと辺CBをタップ！', focus: ['AB', 'CB'] },
          { text: 'AB＝CB。仮定より等しいね！', focus: ['AB', 'CB'] },
        ],
        e2: [
          { text: '仮定にはもう1つ、等しい辺が書かれているよ。' },
          { text: '辺ADと辺CDに注目してみよう！', focus: ['AD', 'CD'] },
          { text: 'AD＝CD。仮定より等しいね！', focus: ['AD', 'CD'] },
        ],
        e3: [
          { text: '2つの三角形に共通する辺はないかな？' },
          { text: '辺BDに注目してみよう！ 同じ辺を2回タップすると「共通な辺」になるよ。', focus: ['BD'] },
          { text: 'BD＝BD。共通な辺だから等しいね！', focus: ['BD'] },
        ],
        congruence: [
          { text: '集めた根拠は「辺」かな？「角」かな？ それぞれ何組あるか数えてみよう。' },
          { text: '集めた3つの根拠は、どれも辺が等しいことだね。' },
          { text: '「3組の辺がそれぞれ等しい」を選ぼう！' },
        ],
      },
      explanation: '2つの三角形に共通する辺は、必ず長さが等しくなります。仮定から2組の辺が見つかったら、共通な辺がないか探してみましょう！',
      learningPoints: [
        '仮定から等しい辺を見つける。',
        '2つの三角形に共通する辺を見つける。',
        '3組の辺が等しいことから合同を証明する。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p02',
      number: '07',
      title: '対頂角を見つけろ！',
      difficulty: 1,
      stage: 2,
      statement: '線分ABと線分CDが点Oで交わっている。AO＝BO、CO＝DOのとき、△AOC≡△BODであることを証明しよう。',
      given: ['AO＝BO', 'CO＝DO'],
      conclusion: '△AOC≡△BOD',
      triangles: [['A', 'O', 'C'], ['B', 'O', 'D']],
      figure: {
        viewBox: [0, 0, 400, 400],
        points: {
          A: { x: 90,  y: 60,  label: [-16, -16] },
          B: { x: 310, y: 340, label: [16, 16] },
          C: { x: 60,  y: 240, label: [-22, 4] },
          D: { x: 340, y: 160, label: [22, -4] },
          O: { x: 200, y: 200, label: [8, 34] },
        },
        lines: [['A', 'O', 'B'], ['C', 'O', 'D']],
        segments: ['AO', 'BO', 'CO', 'DO', 'AC', 'BD'],
        angles: ['AOC', 'BOD', 'AOD', 'BOC', 'OAC', 'OCA', 'OBD', 'ODB'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical', 'alternate'],
      evidence: [
        { id: 'e1', items: ['AO', 'BO'], reason: 'given',      label: 'AO＝BO',      mark: 1 },
        { id: 'e2', items: ['CO', 'DO'], reason: 'given',      label: 'CO＝DO',      mark: 2 },
        { id: 'e3', items: ['∠AOC', '∠BOD'], reason: 'vertical', label: '∠AOC＝∠BOD', mark: 1 },
      ],
      // 正しいが、今回の証明ルートでは使わない関係（ミスにしない）
      extraTruths: [
        { items: ['∠AOD', '∠BOC'], reason: 'vertical' },
      ],
      congruence: 'SAS',
      proof: { intro: '△AOCと△BODにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'fill', distractors: { equations: ['AO＝CO', 'BO＝DO', '∠AOC＝∠AOD', '∠OAC＝∠OBD'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定に書かれていることは、そのまま根拠に使えるよ。' },
          { text: '辺AOと辺BOに注目してみよう！', focus: ['AO', 'BO'] },
          { text: 'AO＝BO。仮定より等しいね！', focus: ['AO', 'BO'] },
        ],
        e2: [
          { text: '仮定にはもう1つ、等しい辺が書かれているよ。' },
          { text: '辺COと辺DOに注目してみよう！', focus: ['CO', 'DO'] },
          { text: 'CO＝DO。仮定より等しいね！', focus: ['CO', 'DO'] },
        ],
        e3: [
          { text: '2本の線分が交わってできる角に注目しよう。' },
          { text: '点Oのまわりの∠AOCと∠BODを比べてみよう！', focus: ['∠AOC', '∠BOD'] },
          { text: '∠AOC＝∠BOD。対頂角だから等しいね！', focus: ['∠AOC', '∠BOD'] },
        ],
        congruence: [
          { text: '集めた根拠は、辺が何組、角が何組かな？' },
          { text: '等しい角∠AOCは、辺AOと辺COの「間」にあるかな？' },
          { text: '2組の辺と、その間の角が等しいね。「2組の辺とその間の角がそれぞれ等しい」を選ぼう！' },
        ],
      },
      explanation: '2本の直線が交わるとき、対頂角は等しくなります。2組の辺が等しいとわかったら、その間の角に注目しましょう！',
      learningPoints: [
        '対頂角が等しいことを見つける。',
        '2組の辺とその間の角の関係を理解する。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p03',
      number: '10',
      title: '平行線の角を見抜け！',
      difficulty: 2,
      stage: 3,
      statement: 'AB∥CD、AB＝CDである。線分ACとBDの交点をOとするとき、△ABO≡△CDOであることを証明しよう。',
      given: ['AB∥CD', 'AB＝CD'],
      conclusion: '△ABO≡△CDO',
      triangles: [['A', 'B', 'O'], ['C', 'D', 'O']],
      figure: {
        viewBox: [0, 0, 420, 370],
        points: {
          A: { x: 80,  y: 70,  label: [-16, -16] },
          B: { x: 350, y: 70,  label: [16, -16] },
          C: { x: 330, y: 300, label: [16, 18] },
          D: { x: 60,  y: 300, label: [-16, 18] },
          O: { x: 205, y: 185, label: [34, 2] },
        },
        lines: [['A', 'O', 'C'], ['B', 'O', 'D']],
        segments: ['AB', 'CD', 'AO', 'CO', 'BO', 'DO'],
        angles: ['BAO', 'ABO', 'DCO', 'CDO', 'AOB', 'COD', 'AOD', 'BOC'],
        // 平行を表す矢印（等しい辺の印とは別の表示）。向きは [始点, 終点]
        parallel: [['A', 'B'], ['D', 'C']],
      },
      reasons: ['given', 'vertical', 'alternate', 'corresponding'],
      evidence: [
        { id: 'e1', items: ['AB', 'CD'], reason: 'given', label: 'AB＝CD', mark: 1 },
        { id: 'e2', items: ['∠BAO', '∠DCO'], reason: 'alternate', label: '∠BAO＝∠DCO', mark: 1,
          proofReason: 'AB∥CDより、平行線の錯角は等しいから' },
        { id: 'e3', items: ['∠ABO', '∠CDO'], reason: 'alternate', label: '∠ABO＝∠CDO', mark: 2,
          proofReason: 'AB∥CDより、平行線の錯角は等しいから' },
      ],
      extraTruths: [
        { items: ['∠AOB', '∠COD'], reason: 'vertical' },
        { items: ['∠AOD', '∠BOC'], reason: 'vertical' },
      ],
      congruence: 'ASA',
      proof: { intro: '△ABOと△CDOにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'fill', distractors: { equations: ['AB＝AO', 'AO＝CO', '∠BAO＝∠AOB'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定に書かれている「等しい辺」はどれかな？' },
          { text: '辺ABと辺CDに注目してみよう！', focus: ['AB', 'CD'] },
          { text: 'AB＝CD。仮定より等しいね！', focus: ['AB', 'CD'] },
        ],
        e2: [
          { text: 'AB∥CD だから、平行線と交わる線分ACに注目しよう。' },
          { text: '∠BAOと∠DCOを比べてみよう！', focus: ['∠BAO', '∠DCO'] },
          { text: '∠BAO＝∠DCO。平行線の錯角だから等しいね！', focus: ['∠BAO', '∠DCO'] },
        ],
        e3: [
          { text: 'AB∥CD だから、平行線と交わる線分BDにも注目しよう。' },
          { text: '∠ABOと∠CDOを比べてみよう！', focus: ['∠ABO', '∠CDO'] },
          { text: '∠ABO＝∠CDO。平行線の錯角だから等しいね！', focus: ['∠ABO', '∠CDO'] },
        ],
        congruence: [
          { text: '集めた根拠は、辺が何組、角が何組かな？' },
          { text: '等しい角∠BAOと∠ABOは、辺ABの「両端」にあるかな？' },
          { text: '1組の辺と、その両端の角が等しいね。「1組の辺とその両端の角がそれぞれ等しい」を選ぼう！' },
        ],
      },
      explanation: '平行線があったら、平行線と交わる直線に注目して錯角を探しましょう。等しい辺ABの両端にある角が、2組とも錯角で等しくなっています。',
      learningPoints: [
        '平行線の錯角を見つける。',
        '1組の辺とその両端の角という合同条件を理解する。',
      ],
    },

    // ==================================================================
    // Ver.0.2 追加問題（ステージ順に並べ替えるので、ここでの順番はステージ内の順番）
    // ==================================================================

    // ---- STAGE 1 ------------------------------------------------------
    {
      id: 'p04',
      number: '02',
      title: '重なった三角形を見抜け！',
      difficulty: 1,
      stage: 1,
      statement: 'AB＝DC、AC＝DBのとき、△ABC≡△DCBであることを証明しよう。',
      given: ['AB＝DC', 'AC＝DB'],
      conclusion: '△ABC≡△DCB',
      // A↔D, B↔C, C↔B（BとCが入れかわる）
      triangles: [['A', 'B', 'C'], ['D', 'C', 'B']],
      figure: {
        viewBox: [0, 0, 400, 340],
        points: {
          A: { x: 130, y: 60,  label: [0, -22] },
          D: { x: 270, y: 60,  label: [0, -22] },
          B: { x: 50,  y: 300, label: [-20, 8] },
          C: { x: 350, y: 300, label: [20, 8] },
        },
        lines: [],
        segments: ['AB', 'AC', 'DB', 'DC', 'BC'],
        angles: ['BAC', 'BDC', 'ABD', 'DBC', 'ACD', 'ACB'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical'],
      evidence: [
        { id: 'e1', items: ['AB', 'DC'], reason: 'given',  label: 'AB＝DC', mark: 1 },
        { id: 'e2', items: ['AC', 'DB'], reason: 'given',  label: 'AC＝DB', mark: 2 },
        { id: 'e3', items: ['BC', 'CB'], reason: 'common', label: 'BC＝CB', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'SSS',
      proof: { intro: '△ABCと△DCBにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'fill', distractors: { equations: ['AB＝AC', 'AC＝BC', 'AB＝DB'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定に書かれている等しい辺から探してみよう。' },
          { text: '辺ABと辺DCに注目！', focus: ['AB', 'DC'] },
          { text: 'AB＝DC。仮定より等しいね！', focus: ['AB', 'DC'] },
        ],
        e2: [
          { text: '仮定にはもう1組、等しい辺があるよ。' },
          { text: '辺ACと辺DBに注目！ 2本は図の中で交わっているね。', focus: ['AC', 'DB'] },
          { text: 'AC＝DB。仮定より等しいね！', focus: ['AC', 'DB'] },
        ],
        e3: [
          { text: '△ABCと△DCBの両方にふくまれる辺はどれかな？' },
          { text: '辺BCに注目！ 同じ辺を2回タップしよう。', focus: ['BC'] },
          { text: 'BC＝CB。共通な辺だから等しいね！', focus: ['BC'] },
        ],
        congruence: sssHints(),
      },
      explanation: '2つの三角形が重なっているときは、1つずつ取り出して見てみよう。△ABCと△DCBでは、頂点Bと頂点Cの対応が入れかわる（B↔C、C↔B）ことに注意しましょう。',
      learningPoints: [
        '重なった図から2つの三角形を見分ける。',
        '共通な辺BCを見つける。',
        '頂点の対応（A↔D、B↔C、C↔B）を確かめる。',
      ],
    },

    {
      id: 'p06',
      number: '03',
      title: '間の角を見つけろ！',
      difficulty: 1,
      stage: 1,
      statement: 'AB＝AD、∠BAC＝∠DACのとき、△ABC≡△ADCであることを証明しよう。',
      given: ['AB＝AD', '∠BAC＝∠DAC'],
      conclusion: '△ABC≡△ADC',
      triangles: [['A', 'B', 'C'], ['A', 'D', 'C']],
      figure: {
        viewBox: [0, 0, 400, 350],
        points: {
          A: { x: 200, y: 40,  label: [0, -22] },
          B: { x: 50,  y: 300, label: [-18, 12] },
          D: { x: 350, y: 300, label: [18, 12] },
          C: { x: 200, y: 250, label: [0, 28] },
        },
        lines: [],
        segments: ['AB', 'AD', 'AC', 'BC', 'DC'],
        angles: ['BAC', 'DAC', 'ABC', 'ADC', 'ACB', 'ACD'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical'],
      evidence: [
        { id: 'e1', items: ['AB', 'AD'], reason: 'given',  label: 'AB＝AD', mark: 1 },
        { id: 'e2', items: ['∠BAC', '∠DAC'], reason: 'given', label: '∠BAC＝∠DAC', mark: 1 },
        { id: 'e3', items: ['AC', 'AC'], reason: 'common', label: 'AC＝AC', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'SAS',
      proof: { intro: '△ABCと△ADCにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'fill', distractors: { equations: ['AB＝AC', 'BC＝AC', '∠ABC＝∠BAC', '∠ACB＝∠ACD'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定から等しい辺を探そう。' },
          { text: '辺ABと辺ADに注目！', focus: ['AB', 'AD'] },
          { text: 'AB＝AD。仮定より等しいね！', focus: ['AB', 'AD'] },
        ],
        e2: [
          { text: '仮定には等しい角も書かれているよ。「角選択」に切り替えよう。' },
          { text: '頂点Aにある∠BACと∠DACに注目！', focus: ['∠BAC', '∠DAC'] },
          { text: '∠BAC＝∠DAC。仮定より等しいね！', focus: ['∠BAC', '∠DAC'] },
        ],
        e3: [
          { text: '△ABCと△ADCの両方にふくまれる辺はどれかな？' },
          { text: '辺ACに注目！ 同じ辺を2回タップしよう。', focus: ['AC'] },
          { text: 'AC＝AC。共通な辺だから等しいね！', focus: ['AC'] },
        ],
        congruence: sasHints('∠BAC', '辺ABと辺AC'),
      },
      explanation: '仮定に角が出てきたら「角選択」で探そう。仮定の辺ABと共通な辺ACの「間」にある角が∠BACなので、2組の辺とその間の角が等しいといえます。',
      learningPoints: [
        '仮定から等しい角を見つける。',
        '共通な辺を見つける。',
        '等しい角が2組の辺の「間の角」かどうかを確かめる。',
      ],
    },

    // ---- STAGE 2 ------------------------------------------------------
    {
      id: 'p05',
      number: '08',
      title: '上下の三角形と対頂角',
      difficulty: 1,
      stage: 2,
      statement: '線分ADと線分BCが点Oで交わっている。AO＝DO、BO＝COのとき、△ABO≡△DCOであることを証明しよう。',
      given: ['AO＝DO', 'BO＝CO'],
      conclusion: '△ABO≡△DCO',
      triangles: [['A', 'B', 'O'], ['D', 'C', 'O']],
      figure: {
        viewBox: [0, 0, 400, 380],
        points: {
          A: { x: 90,  y: 60,  label: [-16, -14] },
          B: { x: 330, y: 100, label: [18, -12] },
          D: { x: 310, y: 320, label: [16, 18] },
          C: { x: 70,  y: 280, label: [-18, 14] },
          O: { x: 200, y: 190, label: [34, 4] },
        },
        lines: [['A', 'O', 'D'], ['B', 'O', 'C']],
        segments: ['AO', 'DO', 'BO', 'CO', 'AB', 'CD'],
        angles: ['AOB', 'DOC', 'AOC', 'BOD', 'OAB', 'OBA', 'ODC', 'OCD'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical', 'alternate'],
      evidence: [
        { id: 'e1', items: ['AO', 'DO'], reason: 'given', label: 'AO＝DO', mark: 1 },
        { id: 'e2', items: ['BO', 'CO'], reason: 'given', label: 'BO＝CO', mark: 2 },
        { id: 'e3', items: ['∠AOB', '∠DOC'], reason: 'vertical', label: '∠AOB＝∠DOC', mark: 1 },
      ],
      extraTruths: [
        { items: ['∠AOC', '∠BOD'], reason: 'vertical' },
      ],
      congruence: 'SAS',
      proof: { intro: '△ABOと△DCOにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'fill', distractors: { equations: ['AO＝BO', 'AB＝AO', '∠AOB＝∠AOC', '∠OAB＝∠ODC'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定から等しい辺を探そう。' },
          { text: '辺AOと辺DOに注目！', focus: ['AO', 'DO'] },
          { text: 'AO＝DO。仮定より等しいね！', focus: ['AO', 'DO'] },
        ],
        e2: [
          { text: '仮定にはもう1組、等しい辺があるよ。' },
          { text: '辺BOと辺COに注目！', focus: ['BO', 'CO'] },
          { text: 'BO＝CO。仮定より等しいね！', focus: ['BO', 'CO'] },
        ],
        e3: [
          { text: '2本の線分が交わってできる角に注目しよう。' },
          { text: '点Oの上と下にある∠AOBと∠DOCを比べてみよう！', focus: ['∠AOB', '∠DOC'] },
          { text: '∠AOB＝∠DOC。対頂角だから等しいね！', focus: ['∠AOB', '∠DOC'] },
        ],
        congruence: sasHints('∠AOB', '辺AOと辺BO'),
      },
      explanation: '交点Oのまわりで向かい合う角が対頂角です。今回は上と下の三角形なので、∠AOBと向かい合うのは∠DOCです。2組の辺AO・BOの「間」にある角になっています。',
      learningPoints: [
        '上下に向かい合う三角形で対頂角を見つける。',
        '頂点の対応（A↔D、B↔C、O↔O）を確かめる。',
      ],
    },

    {
      id: 'p09',
      number: '09',
      title: '辺と両端の角を見抜け！',
      difficulty: 2,
      stage: 2,
      statement: '線分ADと線分BCが点Oで交わっている。AO＝DO、∠OAB＝∠ODCのとき、△ABO≡△DCOであることを証明しよう。',
      given: ['AO＝DO', '∠OAB＝∠ODC'],
      conclusion: '△ABO≡△DCO',
      triangles: [['A', 'B', 'O'], ['D', 'C', 'O']],
      figure: {
        viewBox: [0, 0, 400, 370],
        points: {
          A: { x: 50,  y: 170, label: [-20, 0] },
          D: { x: 350, y: 210, label: [20, 0] },
          B: { x: 250, y: 50,  label: [0, -22] },
          C: { x: 150, y: 330, label: [0, 24] },
          O: { x: 200, y: 190, label: [30, -16] },
        },
        lines: [['A', 'O', 'D'], ['B', 'O', 'C']],
        segments: ['AO', 'DO', 'BO', 'CO', 'AB', 'CD'],
        angles: ['OAB', 'ODC', 'AOB', 'DOC', 'AOC', 'BOD', 'OBA', 'OCD'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical', 'alternate'],
      evidence: [
        { id: 'e1', items: ['AO', 'DO'], reason: 'given', label: 'AO＝DO', mark: 1 },
        { id: 'e2', items: ['∠OAB', '∠ODC'], reason: 'given', label: '∠OAB＝∠ODC', mark: 1 },
        { id: 'e3', items: ['∠AOB', '∠DOC'], reason: 'vertical', label: '∠AOB＝∠DOC', mark: 2 },
      ],
      extraTruths: [
        { items: ['∠AOC', '∠BOD'], reason: 'vertical' },
      ],
      congruence: 'ASA',
      proof: { intro: '△ABOと△DCOにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'fill', distractors: { equations: ['AB＝AO', 'BO＝CO', '∠AOB＝∠AOC', '∠OBA＝∠OCD'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定から等しい辺を探そう。' },
          { text: '辺AOと辺DOに注目！', focus: ['AO', 'DO'] },
          { text: 'AO＝DO。仮定より等しいね！', focus: ['AO', 'DO'] },
        ],
        e2: [
          { text: '仮定には等しい角も書かれているよ。「角選択」に切り替えよう。' },
          { text: '∠OABと∠ODCに注目！', focus: ['∠OAB', '∠ODC'] },
          { text: '∠OAB＝∠ODC。仮定より等しいね！', focus: ['∠OAB', '∠ODC'] },
        ],
        e3: [
          { text: '2本の線分が交わってできる角に注目しよう。' },
          { text: '点Oのまわりの∠AOBと∠DOCを比べてみよう！', focus: ['∠AOB', '∠DOC'] },
          { text: '∠AOB＝∠DOC。対頂角だから等しいね！', focus: ['∠AOB', '∠DOC'] },
        ],
        congruence: asaHints('∠OABと∠AOB', '辺AO'),
      },
      explanation: '辺が1組、角が2組そろったら、2つの角が等しい辺の「両端」にあるかを確かめよう。∠OABは辺AOの端A、∠AOBは辺AOの端Oにある角です。仮定にAB∥DCはないので、錯角は使えません。',
      learningPoints: [
        '仮定の角と対頂角を組み合わせる。',
        '1組の辺とその両端の角という合同条件を使う。',
      ],
    },

    // ---- STAGE 3 ------------------------------------------------------
    {
      id: 'p08',
      number: '11',
      title: '平行線と共通な辺',
      difficulty: 2,
      stage: 3,
      statement: '四角形ABCDで、AD∥BC、AD＝CBである。対角線ACをひくとき、△ADC≡△CBAであることを証明しよう。',
      given: ['AD∥BC', 'AD＝CB'],
      conclusion: '△ADC≡△CBA',
      triangles: [['A', 'D', 'C'], ['C', 'B', 'A']],
      figure: {
        viewBox: [0, 0, 410, 350],
        points: {
          A: { x: 110, y: 70,  label: [-14, -18] },
          D: { x: 350, y: 70,  label: [16, -18] },
          B: { x: 60,  y: 300, label: [-16, 16] },
          C: { x: 300, y: 300, label: [16, 16] },
        },
        lines: [],
        segments: ['AD', 'BC', 'AB', 'DC', 'AC'],
        angles: ['DAC', 'CAB', 'BCA', 'ACD', 'ADC', 'ABC'],
        parallel: [['A', 'D'], ['B', 'C']],
      },
      reasons: ['given', 'common', 'alternate', 'corresponding'],
      evidence: [
        { id: 'e1', items: ['AD', 'CB'], reason: 'given', label: 'AD＝CB', mark: 1 },
        { id: 'e2', items: ['∠DAC', '∠BCA'], reason: 'alternate', label: '∠DAC＝∠BCA', mark: 1,
          proofReason: 'AD∥BCより、平行線の錯角は等しいから' },
        { id: 'e3', items: ['AC', 'CA'], reason: 'common', label: 'AC＝CA', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'SAS',
      proof: { intro: '△ADCと△CBAにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'build', distractors: { equations: ['AD＝AC', 'AB＝DC', '∠ADC＝∠DAC'], reasons: ['vertical'] } },
      hints: {
        e1: [
          { text: '仮定から等しい辺を探そう。' },
          { text: '辺ADと辺CBに注目！', focus: ['AD', 'CB'] },
          { text: 'AD＝CB。仮定より等しいね！', focus: ['AD', 'CB'] },
        ],
        e2: [
          { text: 'AD∥BCだから、平行線と交わる対角線ACに注目しよう。' },
          { text: '∠DACと∠BCAを比べてみよう！', focus: ['∠DAC', '∠BCA'] },
          { text: '∠DAC＝∠BCA。平行線の錯角だから等しいね！', focus: ['∠DAC', '∠BCA'] },
        ],
        e3: [
          { text: '△ADCと△CBAの両方にふくまれる辺はどれかな？' },
          { text: '対角線ACに注目！ 同じ辺を2回タップしよう。', focus: ['AC'] },
          { text: 'AC＝CA。共通な辺だから等しいね！', focus: ['AC'] },
        ],
        congruence: sasHints('∠DAC', '辺ADと辺AC'),
      },
      explanation: '平行線があったら、平行線と交わる直線（ここでは対角線AC）に注目して錯角を探そう。仮定はAD∥BCだけなので、ABとDCが平行かどうかはまだ分かりません。',
      learningPoints: [
        '平行線の錯角を見つける。',
        '共通な辺と組み合わせて「2組の辺とその間の角」を使う。',
      ],
    },

    {
      id: 'p10',
      number: '12',
      title: '同位角を2組見つけろ！',
      difficulty: 2,
      stage: 3,
      statement: '3点B、C、Eはこの順に一直線上にある。AB∥DC、AC∥DE、BC＝CEのとき、△ABC≡△DCEであることを証明しよう。',
      given: ['AB∥DC', 'AC∥DE', 'BC＝CE'],
      conclusion: '△ABC≡△DCE',
      triangles: [['A', 'B', 'C'], ['D', 'C', 'E']],
      figure: {
        viewBox: [0, 0, 420, 340],
        points: {
          A: { x: 100, y: 100, label: [-8, -22] },
          D: { x: 270, y: 100, label: [8, -22] },
          B: { x: 40,  y: 300, label: [-16, 16] },
          C: { x: 210, y: 300, label: [0, 24] },
          E: { x: 380, y: 300, label: [16, 16] },
        },
        lines: [['B', 'C', 'E']],
        segments: ['AB', 'AC', 'BC', 'CE', 'DC', 'DE'],
        angles: ['ABC', 'ACB', 'ACD', 'DCE', 'DEC', 'BAC', 'CDE'],
        // 1組目 AB∥DC（矢印1つ）、2組目 AC∥DE（矢印2つ）
        parallel: [['B', 'A', 1], ['C', 'D', 1], ['A', 'C', 2], ['D', 'E', 2]],
      },
      reasons: ['given', 'vertical', 'alternate', 'corresponding'],
      evidence: [
        { id: 'e1', items: ['BC', 'CE'], reason: 'given', label: 'BC＝CE', mark: 1 },
        { id: 'e2', items: ['∠ABC', '∠DCE'], reason: 'corresponding', label: '∠ABC＝∠DCE', mark: 1,
          parallelGroup: 1, proofReason: 'AB∥DCより、平行線の同位角は等しいから' },
        { id: 'e3', items: ['∠ACB', '∠DEC'], reason: 'corresponding', label: '∠ACB＝∠DEC', mark: 2,
          parallelGroup: 2, proofReason: 'AC∥DEより、平行線の同位角は等しいから' },
      ],
      extraTruths: [
        { items: ['∠BAC', '∠ACD'], reason: 'alternate' },
        { items: ['∠ACD', '∠CDE'], reason: 'alternate' },
        // 錯角を2回使うと言える（∠BAC＝∠ACD＝∠CDE）。結論を使わずに言える関係なのでミスにしない
        { items: ['∠BAC', '∠CDE'], reason: 'alternate' },
      ],
      congruence: 'ASA',
      proof: { intro: '△ABCと△DCEにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'build', distractors: { equations: ['AB＝BC', 'AC＝CE', 'AB＝DC', '∠ABC＝∠ACB', '∠BAC＝∠DCE'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定から等しい辺を探そう。' },
          { text: '辺BCと辺CEに注目！', focus: ['BC', 'CE'] },
          { text: 'BC＝CE。仮定より等しいね！', focus: ['BC', 'CE'] },
        ],
        e2: [
          { text: 'AB∥DCだから、平行線と交わる直線BEに注目しよう。' },
          { text: '∠ABCと∠DCEを比べてみよう！ 同じ位置にある角だね。', focus: ['∠ABC', '∠DCE'] },
          { text: '∠ABC＝∠DCE。平行線の同位角だから等しいね！', focus: ['∠ABC', '∠DCE'] },
        ],
        e3: [
          { text: 'もう1組の平行線AC∥DEにも注目しよう。' },
          { text: '∠ACBと∠DECを比べてみよう！', focus: ['∠ACB', '∠DEC'] },
          { text: '∠ACB＝∠DEC。平行線の同位角だから等しいね！', focus: ['∠ACB', '∠DEC'] },
        ],
        congruence: asaHints('∠ABCと∠ACB', '辺BC'),
      },
      explanation: '平行線が2組あるときは、それぞれの平行線ごとに同位角・錯角を探そう。直線BEの上で同じ位置にある角が同位角です。∠BAC＝∠ACDのような錯角も見つかりますが、今回は辺BCの両端の角を使います。',
      learningPoints: [
        '平行線の同位角を見つける。',
        '2組の平行線をそれぞれ使い分ける。',
        '1組の辺とその両端の角を使う。',
      ],
    },

    // ---- STAGE 4 ------------------------------------------------------
    {
      id: 'p07',
      number: '04',
      title: '離れた三角形の対応を見抜け！',
      difficulty: 1,
      stage: 1,
      statement: 'AB＝DF、AC＝DE、∠BAC＝∠FDEのとき、△ABC≡△DFEであることを証明しよう。',
      given: ['AB＝DF', 'AC＝DE', '∠BAC＝∠FDE'],
      conclusion: '△ABC≡△DFE',
      triangles: [['A', 'B', 'C'], ['D', 'F', 'E']],
      figure: {
        viewBox: [0, 0, 420, 340],
        points: {
          A: { x: 60,  y: 80,  label: [-18, -8] },
          B: { x: 40,  y: 300, label: [-16, 16] },
          C: { x: 180, y: 235, label: [0, 24] },
          D: { x: 360, y: 80,  label: [18, -8] },
          F: { x: 380, y: 300, label: [16, 16] },
          E: { x: 240, y: 235, label: [0, 24] },
        },
        lines: [],
        segments: ['AB', 'BC', 'CA', 'DF', 'FE', 'ED'],
        angles: ['BAC', 'ABC', 'ACB', 'FDE', 'DFE', 'DEF'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical'],
      evidence: [
        { id: 'e1', items: ['AB', 'DF'], reason: 'given', label: 'AB＝DF', mark: 1 },
        { id: 'e2', items: ['AC', 'DE'], reason: 'given', label: 'AC＝DE', mark: 2 },
        { id: 'e3', items: ['∠BAC', '∠FDE'], reason: 'given', label: '∠BAC＝∠FDE', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'SAS',
      proof: { intro: '△ABCと△DFEにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'build', distractors: { equations: ['AB＝DE', 'AC＝DF', 'BC＝FE', '∠ABC＝∠FDE'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定から等しい辺を探そう。' },
          { text: '辺ABと辺DFに注目！', focus: ['AB', 'DF'] },
          { text: 'AB＝DF。仮定より等しいね！', focus: ['AB', 'DF'] },
        ],
        e2: [
          { text: '仮定にはもう1組、等しい辺があるよ。' },
          { text: '辺ACと辺DEに注目！', focus: ['AC', 'DE'] },
          { text: 'AC＝DE。仮定より等しいね！', focus: ['AC', 'DE'] },
        ],
        e3: [
          { text: '仮定には等しい角もあるよ。「角選択」に切り替えよう。' },
          { text: '∠BACと∠FDEに注目！', focus: ['∠BAC', '∠FDE'] },
          { text: '∠BAC＝∠FDE。仮定より等しいね！', focus: ['∠BAC', '∠FDE'] },
        ],
        congruence: sasHints('∠BAC', '辺ABと辺AC'),
      },
      explanation: '2つの三角形が離れていて向きもちがうときは、「三角形を確認」で頂点の対応（A↔D、B↔F、C↔E）を確かめよう。結論の△ABC≡△DFEの文字の順番が、そのまま対応を表しています。',
      learningPoints: [
        '結論の文字の順番から頂点の対応を読み取る。',
        '仮定だけで「2組の辺とその間の角」がそろうことを確かめる。',
      ],
    },

    {
      id: 'p11',
      number: '05',
      title: '共通な辺と両端の角',
      difficulty: 1,
      stage: 1,
      statement: '∠BAC＝∠DAC、∠BCA＝∠DCAのとき、△ABC≡△ADCであることを証明しよう。',
      given: ['∠BAC＝∠DAC', '∠BCA＝∠DCA'],
      conclusion: '△ABC≡△ADC',
      triangles: [['A', 'B', 'C'], ['A', 'D', 'C']],
      figure: {
        viewBox: [0, 0, 420, 380],
        points: {
          A: { x: 40,  y: 190, label: [-20, 0] },
          C: { x: 380, y: 190, label: [20, 0] },
          B: { x: 250, y: 60,  label: [0, -22] },
          D: { x: 250, y: 320, label: [0, 24] },
        },
        lines: [],
        segments: ['AB', 'AD', 'CB', 'CD', 'AC'],
        angles: ['BAC', 'DAC', 'BCA', 'DCA', 'ABC', 'ADC'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical'],
      evidence: [
        { id: 'e1', items: ['∠BAC', '∠DAC'], reason: 'given', label: '∠BAC＝∠DAC', mark: 1 },
        { id: 'e2', items: ['∠BCA', '∠DCA'], reason: 'given', label: '∠BCA＝∠DCA', mark: 2 },
        { id: 'e3', items: ['AC', 'AC'], reason: 'common', label: 'AC＝AC', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'ASA',
      proof: { intro: '△ABCと△ADCにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'build', distractors: { equations: ['∠BAC＝∠BCA', '∠BAC＝∠DCA', 'AB＝AD', 'AB＝CB'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定には等しい角が書かれているよ。「角選択」で探そう。' },
          { text: '頂点Aの∠BACと∠DACに注目！', focus: ['∠BAC', '∠DAC'] },
          { text: '∠BAC＝∠DAC。仮定より等しいね！', focus: ['∠BAC', '∠DAC'] },
        ],
        e2: [
          { text: '仮定にはもう1組、等しい角があるよ。' },
          { text: '頂点Cの∠BCAと∠DCAに注目！', focus: ['∠BCA', '∠DCA'] },
          { text: '∠BCA＝∠DCA。仮定より等しいね！', focus: ['∠BCA', '∠DCA'] },
        ],
        e3: [
          { text: '△ABCと△ADCの両方にふくまれる辺はどれかな？' },
          { text: '辺ACに注目！ 同じ辺を2回タップしよう。', focus: ['AC'] },
          { text: 'AC＝AC。共通な辺だから等しいね！', focus: ['AC'] },
        ],
        congruence: asaHints('∠BACと∠BCA', '辺AC'),
      },
      explanation: '角が2組と辺が1組のときは「1組の辺とその両端の角」を考えよう。共通な辺ACの両端A・Cにある角が、それぞれ等しくなっています。',
      learningPoints: [
        '仮定から等しい角を2組見つける。',
        '共通な辺と組み合わせて「1組の辺とその両端の角」を使う。',
      ],
    },

    {
      id: 'p12',
      number: '06',
      title: '中点と3組の辺',
      difficulty: 1,
      stage: 1,
      statement: 'AB＝AC、点Mは辺BCの中点である。このとき、△ABM≡△ACMであることを証明しよう。',
      given: ['AB＝AC', 'Mは辺BCの中点'],
      conclusion: '△ABM≡△ACM',
      triangles: [['A', 'B', 'M'], ['A', 'C', 'M']],
      figure: {
        viewBox: [0, 0, 400, 370],
        points: {
          A: { x: 200, y: 40,  label: [0, -22] },
          B: { x: 50,  y: 320, label: [-18, 10] },
          C: { x: 350, y: 320, label: [18, 10] },
          M: { x: 200, y: 320, label: [0, 26] },
        },
        lines: [['B', 'M', 'C']],
        segments: ['AB', 'AC', 'BM', 'MC', 'AM'],
        angles: ['BAM', 'CAM', 'ABM', 'ACM', 'AMB', 'AMC'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical'],
      evidence: [
        { id: 'e1', items: ['AB', 'AC'], reason: 'given', label: 'AB＝AC', mark: 1 },
        { id: 'e2', items: ['BM', 'CM'], reason: 'given', label: 'BM＝CM', mark: 2,
          proofReason: '仮定より、Mは辺BCの中点だから' },
        { id: 'e3', items: ['AM', 'AM'], reason: 'common', label: 'AM＝AM', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'SSS',
      proof: { intro: '△ABMと△ACMにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'build', distractors: { equations: ['AB＝AM', 'BM＝AM', '∠ABM＝∠ACM'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定から等しい辺を探そう。' },
          { text: '辺ABと辺ACに注目！', focus: ['AB', 'AC'] },
          { text: 'AB＝AC。仮定より等しいね！', focus: ['AB', 'AC'] },
        ],
        e2: [
          { text: '「中点」は、線分をちょうど2等分する点のことだよ。' },
          { text: '辺BMと辺CMに注目！ Mは辺BCの中点だね。', focus: ['BM', 'CM'] },
          { text: 'BM＝CM。仮定（Mは辺BCの中点）より等しいね！', focus: ['BM', 'CM'] },
        ],
        e3: [
          { text: '△ABMと△ACMの両方にふくまれる辺はどれかな？' },
          { text: '辺AMに注目！ 同じ辺を2回タップしよう。', focus: ['AM'] },
          { text: 'AM＝AM。共通な辺だから等しいね！', focus: ['AM'] },
        ],
        congruence: sssHints(),
      },
      explanation: '「Mは辺BCの中点」という仮定は、BM＝CMということを表しています。言葉で書かれた仮定は、等しい辺や角に読みかえよう。∠ABM＝∠ACMは見た目では等しそうでも、まだ根拠には使えません。',
      learningPoints: [
        '「中点」の仮定を等しい辺に読みかえる。',
        '共通な辺と合わせて3組の辺をそろえる。',
      ],
    },

    // ---- STAGE 5 ------------------------------------------------------
    {
      id: 'p13',
      number: '13',
      title: '2組の平行線と対角線',
      difficulty: 3,
      stage: 4,
      statement: '四角形ABCDで、AB∥DC、AD∥BCである。対角線ACをひくとき、△ABC≡△CDAであることを証明しよう。',
      given: ['AB∥DC', 'AD∥BC'],
      conclusion: '△ABC≡△CDA',
      triangles: [['A', 'B', 'C'], ['C', 'D', 'A']],
      figure: {
        viewBox: [0, 0, 420, 350],
        points: {
          A: { x: 110, y: 60,  label: [-14, -18] },
          B: { x: 360, y: 60,  label: [16, -18] },
          C: { x: 310, y: 300, label: [16, 16] },
          D: { x: 60,  y: 300, label: [-16, 16] },
        },
        lines: [],
        segments: ['AB', 'BC', 'CD', 'DA', 'AC'],
        angles: ['BAC', 'CAD', 'DCA', 'ACB', 'ABC', 'ADC'],
        // 1組目 AB∥DC（矢印1つ）、2組目 AD∥BC（矢印2つ）
        parallel: [['A', 'B', 1], ['D', 'C', 1], ['D', 'A', 2], ['C', 'B', 2]],
      },
      reasons: ['given', 'common', 'alternate', 'corresponding'],
      evidence: [
        { id: 'e1', items: ['∠BAC', '∠DCA'], reason: 'alternate', label: '∠BAC＝∠DCA', mark: 1,
          parallelGroup: 1, proofReason: 'AB∥DCより、平行線の錯角は等しいから' },
        { id: 'e2', items: ['∠BCA', '∠DAC'], reason: 'alternate', label: '∠BCA＝∠DAC', mark: 2,
          parallelGroup: 2, proofReason: 'AD∥BCより、平行線の錯角は等しいから' },
        { id: 'e3', items: ['AC', 'CA'], reason: 'common', label: 'AC＝CA', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'ASA',
      proof: { intro: '△ABCと△CDAにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'build', distractors: { equations: ['AB＝AC', 'AB＝CD', '∠ABC＝∠BAC'], reasons: ['vertical'] } },
      hints: {
        e1: [
          { text: 'AB∥DCだから、平行線と交わる対角線ACに注目しよう。' },
          { text: '∠BACと∠DCAを比べてみよう！', focus: ['∠BAC', '∠DCA'] },
          { text: '∠BAC＝∠DCA。平行線の錯角だから等しいね！', focus: ['∠BAC', '∠DCA'] },
        ],
        e2: [
          { text: 'もう1組の平行線AD∥BCにも注目しよう。' },
          { text: '∠BCAと∠DACを比べてみよう！', focus: ['∠BCA', '∠DAC'] },
          { text: '∠BCA＝∠DAC。平行線の錯角だから等しいね！', focus: ['∠BCA', '∠DAC'] },
        ],
        e3: [
          { text: '△ABCと△CDAの両方にふくまれる辺はどれかな？' },
          { text: '対角線ACに注目！ 同じ辺を2回タップしよう。', focus: ['AC'] },
          { text: 'AC＝CA。共通な辺だから等しいね！', focus: ['AC'] },
        ],
        congruence: asaHints('∠BACと∠BCA', '辺AC'),
      },
      explanation: '平行線が2組あるときは、どちらの平行線の錯角かを区別しよう。∠BAC＝∠DCAはAB∥DC、∠BCA＝∠DACはAD∥BCから言えます。この合同から、平行四辺形の向かい合う辺が等しいことが分かります。',
      learningPoints: [
        '2組の平行線それぞれの錯角を見つける。',
        '共通な辺と合わせて「1組の辺とその両端の角」を使う。',
      ],
    },

    {
      id: 'p14',
      number: '14',
      title: '共通な角を見つけろ！',
      difficulty: 3,
      stage: 4,
      statement: '点Dは辺AB上、点Eは辺AC上にある。AB＝AC、AD＝AEのとき、△ABE≡△ACDであることを証明しよう。',
      given: ['AB＝AC', 'AD＝AE'],
      conclusion: '△ABE≡△ACD',
      triangles: [['A', 'B', 'E'], ['A', 'C', 'D']],
      figure: {
        viewBox: [0, 0, 400, 360],
        points: {
          A: { x: 200,   y: 40,    label: [0, -22] },
          B: { x: 70,    y: 320,   label: [-16, 14] },
          C: { x: 330,   y: 320,   label: [16, 14] },
          D: { x: 145.4, y: 157.6, label: [-22, -4] },
          E: { x: 254.6, y: 157.6, label: [22, -4] },
        },
        lines: [['A', 'D', 'B'], ['A', 'E', 'C']],
        // AB・AC は途中に点があるので、D〜B、E〜C の部分をタップすると辺全体が選ばれる
        segments: ['AD', { name: 'AB', hit: ['D', 'B'] }, 'AE', { name: 'AC', hit: ['E', 'C'] }, 'BE', 'CD'],
        angles: ['BAC', 'ABE', 'ACD', 'ADC', 'BDC', 'AEB', 'CEB'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical'],
      evidence: [
        { id: 'e1', items: ['AB', 'AC'], reason: 'given', label: 'AB＝AC', mark: 1 },
        { id: 'e2', items: ['AE', 'AD'], reason: 'given', label: 'AE＝AD', mark: 2 },
        { id: 'e3', items: ['∠BAE', '∠CAD'], reason: 'commonAngle', label: '∠BAE＝∠CAD', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'SAS',
      proof: { intro: '△ABEと△ACDにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'build', distractors: { equations: ['AD＝AB', 'AE＝EC', 'BE＝CD', '∠ABE＝∠ACD'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定から等しい辺を探そう。' },
          { text: '辺ABと辺ACに注目！ 点D・Eより先の部分をタップすると、辺全体が選べるよ。', focus: ['AB', 'AC'] },
          { text: 'AB＝AC。仮定より等しいね！', focus: ['AB', 'AC'] },
        ],
        e2: [
          { text: '仮定にはもう1組、等しい辺があるよ。' },
          { text: '辺AEと辺ADに注目！', focus: ['AE', 'AD'] },
          { text: 'AE＝AD。仮定より等しいね！', focus: ['AE', 'AD'] },
        ],
        e3: [
          { text: '△ABEと△ACDは、どちらも頂点Aの角をふくんでいるよ。' },
          { text: '頂点Aの角に注目！「角選択」で同じ角を2回タップしよう。', focus: ['∠BAC'] },
          { text: '∠BAE＝∠CAD。共通な角だから等しいね！', focus: ['∠BAC'] },
        ],
        congruence: sasHints('∠BAE', '辺ABと辺AE'),
      },
      explanation: '2つの三角形が重なっているとき、頂点の角が両方の三角形にふくまれていることがあります。∠BAEと∠CADは名前はちがっても同じ角（共通な角）です。',
      learningPoints: [
        '重なった三角形から共通な角を見つける。',
        '名前がちがっても同じ角であることに気づく。',
        '2組の辺とその間の角を使う。',
      ],
    },

    {
      id: 'p15',
      number: '15',
      title: '3つの理由を組み合わせろ！',
      difficulty: 3,
      stage: 4,
      statement: '線分ADと線分BCが点Oで交わっている。AB∥CD、AO＝DOのとき、△ABO≡△DCOであることを証明しよう。',
      given: ['AB∥CD', 'AO＝DO'],
      conclusion: '△ABO≡△DCO',
      triangles: [['A', 'B', 'O'], ['D', 'C', 'O']],
      figure: {
        viewBox: [0, 0, 400, 370],
        points: {
          A: { x: 70,  y: 60,  label: [-16, -14] },
          B: { x: 250, y: 60,  label: [16, -14] },
          D: { x: 330, y: 320, label: [16, 16] },
          C: { x: 150, y: 320, label: [-16, 16] },
          O: { x: 200, y: 190, label: [32, -6] },
        },
        lines: [['A', 'O', 'D'], ['B', 'O', 'C']],
        segments: ['AB', 'CD', 'AO', 'DO', 'BO', 'CO'],
        angles: ['BAO', 'ABO', 'CDO', 'DCO', 'AOB', 'DOC', 'AOC', 'BOD'],
        parallel: [['A', 'B'], ['C', 'D']],
      },
      reasons: ['given', 'vertical', 'alternate', 'corresponding'],
      evidence: [
        { id: 'e1', items: ['AO', 'DO'], reason: 'given', label: 'AO＝DO', mark: 1 },
        { id: 'e2', items: ['∠BAO', '∠CDO'], reason: 'alternate', label: '∠BAO＝∠CDO', mark: 1,
          proofReason: 'AB∥CDより、平行線の錯角は等しいから' },
        { id: 'e3', items: ['∠AOB', '∠DOC'], reason: 'vertical', label: '∠AOB＝∠DOC', mark: 2 },
      ],
      extraTruths: [
        { items: ['∠ABO', '∠DCO'], reason: 'alternate' },
        { items: ['∠AOC', '∠BOD'], reason: 'vertical' },
      ],
      congruence: 'ASA',
      proof: { intro: '△ABOと△DCOにおいて' },
      // 証明パズル：形式（fill＝穴埋め / build＝組み立て）とダミーカード。正解は evidence・congruence を使う
      puzzle: { type: 'build', distractors: { equations: ['AO＝BO', 'AB＝CD', '∠BAO＝∠ABO'], reasons: [] } },
      hints: {
        e1: [
          { text: '仮定から等しい辺を探そう。' },
          { text: '辺AOと辺DOに注目！', focus: ['AO', 'DO'] },
          { text: 'AO＝DO。仮定より等しいね！', focus: ['AO', 'DO'] },
        ],
        e2: [
          { text: 'AB∥CDだから、平行線と交わる線分ADに注目しよう。' },
          { text: '∠BAOと∠CDOを比べてみよう！', focus: ['∠BAO', '∠CDO'] },
          { text: '∠BAO＝∠CDO。平行線の錯角だから等しいね！', focus: ['∠BAO', '∠CDO'] },
        ],
        e3: [
          { text: '2本の線分が交わってできる角に注目しよう。' },
          { text: '点Oのまわりの∠AOBと∠DOCを比べてみよう！', focus: ['∠AOB', '∠DOC'] },
          { text: '∠AOB＝∠DOC。対頂角だから等しいね！', focus: ['∠AOB', '∠DOC'] },
        ],
        congruence: asaHints('∠BAOと∠AOB', '辺AO'),
      },
      explanation: '仮定・平行線の錯角・対頂角という3種類の理由を組み合わせる問題です。辺AOの両端A・Oにある角がそれぞれ等しくなります。∠ABO＝∠DCOも錯角で等しいですが、今回は辺AOの両端の角を使います。',
      learningPoints: [
        '仮定・錯角・対頂角を組み合わせる。',
        '等しい辺の両端にある角を選ぶ。',
      ],
    },
  ];

  // ==================================================================
  // Ver.0.5 追加問題（STAGE 6）：結論が辺・角の等しさの問題
  //   図は既存の問題の図データをそのまま共有する（座標の二重管理をしない）。
  //   triangles は「途中で示す合同」（正解の唯一の基準）、finalStep は合同から導く最終結論。
  //   puzzle.distractors.triangles … おてがるの「三角形の組」のダミー（'ABD/CDB' = △ABDと△CDB）
  //   puzzle.distractors.finals    … 最終結論のカードのダミー（正しいが結論ではない関係／等しくない関係）
  // ==================================================================
  function figureOf(id) {
    return PH.problems.find(function (p) { return p.id === id; }).figure;
  }
  function partName(n) { return /^∠/.test(n) ? n : '辺' + n; }

  // 三角形を選ぶヒント（3段階目で正しい組と対応を見せるが、自動では確定しない）
  function triangleHints(items, t1, t2) {
    const what = items.map(partName).join('と');
    const pairs = [0, 1, 2].map(function (i) { return t1[i] + '↔' + t2[i]; }).join('、');
    return [
      { text: '結論の' + what + 'は、どの三角形にふくまれているかな？' },
      { text: '結論で等しいと示したい' + what + 'を、別々の三角形に見つけよう！', focus: items },
      { text: '合同にする三角形の候補は △' + t1.join('') + 'と△' + t2.join('') + '。対応する頂点は ' + pairs + ' だよ。', focus: items },
    ];
  }
  // 最終結論のヒント
  function finalHints(items, kind) {
    const what = items.map(partName).join('と');
    const w = kind === 'angle' ? '角' : '辺';
    return [
      { text: '合同な三角形で、対応する辺や角にはどんな性質があるかな？' },
      { text: '結論の' + what + 'を、合同な三角形の対応関係で確認しよう！', focus: items },
      { text: '「合同な図形の対応する' + w + 'は等しい」という性質を使おう！', focus: items },
    ];
  }

  PH.problems.push(
    // ------------------------------------------------------------------
    {
      id: 'p16',
      number: '16',
      title: '合同から角の等しさを証明！',
      difficulty: 2,
      stage: 5,
      statement: '四角形ABCDで、AB＝CB、AD＝CDのとき、∠BAD＝∠BCDであることを証明しよう。',
      given: ['AB＝CB', 'AD＝CD'],
      conclusion: '∠BAD＝∠BCD',
      conclusionType: 'equalAngle',
      // 途中で示す合同（対応順。A↔C、B↔B、D↔D）
      triangles: [['A', 'B', 'D'], ['C', 'B', 'D']],
      figure: figureOf('p01'),
      reasons: ['given', 'common', 'vertical'],
      evidence: [
        { id: 'e1', items: ['AB', 'CB'], reason: 'given',  label: 'AB＝CB', mark: 1 },
        { id: 'e2', items: ['AD', 'CD'], reason: 'given',  label: 'AD＝CD', mark: 2 },
        { id: 'e3', items: ['BD', 'BD'], reason: 'common', label: 'BD＝BD', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'SSS',
      finalStep: { relationType: 'angle', items: ['∠BAD', '∠BCD'], reason: 'correspondingAngles', label: '∠BAD＝∠BCD' },
      proof: { intro: '△ABDと△CBDにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['∠BAD＝∠BCD', 'AB＝AD', 'CB＝CD'],     // 結論（まだ根拠に使えない）もダミーに入れる
          reasons: [],
          triangles: ['ABD/CDB', 'ABD/BCD'],
          finals: ['∠ABD＝∠CBD', '∠BAD＝∠ABD'],
        },
      },
      hints: {
        triangleSelection: triangleHints(['∠BAD', '∠BCD'], ['A', 'B', 'D'], ['C', 'B', 'D']),
        e1: [
          { text: '仮定に書かれていることは、そのまま根拠に使えるよ。' },
          { text: '辺ABと辺CBに注目してみよう！', focus: ['AB', 'CB'] },
          { text: 'AB＝CB。仮定より等しいね！', focus: ['AB', 'CB'] },
        ],
        e2: [
          { text: '仮定にはもう1つ、等しい辺が書かれているよ。' },
          { text: '辺ADと辺CDに注目してみよう！', focus: ['AD', 'CD'] },
          { text: 'AD＝CD。仮定より等しいね！', focus: ['AD', 'CD'] },
        ],
        e3: [
          { text: '2つの三角形に共通する辺はないかな？' },
          { text: '辺BDに注目してみよう！ 同じ辺を2回タップすると「共通な辺」になるよ。', focus: ['BD'] },
          { text: 'BD＝BD。共通な辺だから等しいね！', focus: ['BD'] },
        ],
        congruence: sssHints(),
        finalStep: finalHints(['∠BAD', '∠BCD'], 'angle'),
      },
      explanation: '∠BADと∠BCDは、△ABDと△CBDの対応する角です。まず△ABD≡△CBDを「3組の辺がそれぞれ等しい」で証明し、合同な図形の対応する角は等しいことから結論を導きます。',
      learningPoints: [
        '結論の角をふくむ2つの三角形を見つける。',
        '合同を証明してから、対応する角が等しいことを使う。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p17',
      number: '17',
      title: '対頂角から辺の等しさへ！',
      difficulty: 2,
      stage: 5,
      statement: '線分ABと線分CDが点Oで交わっている。AO＝BO、CO＝DOのとき、AC＝BDであることを証明しよう。',
      given: ['AO＝BO', 'CO＝DO'],
      conclusion: 'AC＝BD',
      conclusionType: 'equalSide',
      triangles: [['A', 'O', 'C'], ['B', 'O', 'D']],
      figure: figureOf('p02'),
      reasons: ['given', 'common', 'vertical', 'alternate'],
      evidence: [
        { id: 'e1', items: ['AO', 'BO'], reason: 'given',      label: 'AO＝BO',      mark: 1 },
        { id: 'e2', items: ['CO', 'DO'], reason: 'given',      label: 'CO＝DO',      mark: 2 },
        { id: 'e3', items: ['∠AOC', '∠BOD'], reason: 'vertical', label: '∠AOC＝∠BOD', mark: 1 },
      ],
      extraTruths: [
        { items: ['∠AOD', '∠BOC'], reason: 'vertical' },
      ],
      congruence: 'SAS',
      finalStep: { relationType: 'side', items: ['AC', 'BD'], reason: 'correspondingSides', label: 'AC＝BD' },
      proof: { intro: '△AOCと△BODにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['AC＝BD', 'AO＝CO', '∠OAC＝∠OBD'],
          reasons: [],
          triangles: ['AOC/DOB', 'AOC/OBD'],
          finals: ['∠OAC＝∠OBD', 'AC＝CO'],
        },
      },
      hints: {
        triangleSelection: triangleHints(['AC', 'BD'], ['A', 'O', 'C'], ['B', 'O', 'D']),
        e1: [
          { text: '仮定に書かれていることは、そのまま根拠に使えるよ。' },
          { text: '辺AOと辺BOに注目してみよう！', focus: ['AO', 'BO'] },
          { text: 'AO＝BO。仮定より等しいね！', focus: ['AO', 'BO'] },
        ],
        e2: [
          { text: '仮定にはもう1つ、等しい辺が書かれているよ。' },
          { text: '辺COと辺DOに注目してみよう！', focus: ['CO', 'DO'] },
          { text: 'CO＝DO。仮定より等しいね！', focus: ['CO', 'DO'] },
        ],
        e3: [
          { text: '2本の線分が交わってできる角に注目しよう。' },
          { text: '点Oのまわりの∠AOCと∠BODを比べてみよう！', focus: ['∠AOC', '∠BOD'] },
          { text: '∠AOC＝∠BOD。対頂角だから等しいね！', focus: ['∠AOC', '∠BOD'] },
        ],
        congruence: sasHints('∠AOC', '辺AOと辺CO'),
        finalStep: finalHints(['AC', 'BD'], 'side'),
      },
      explanation: '辺ACと辺BDは、△AOCと△BODの対応する辺です。対頂角を使って△AOC≡△BODを証明すれば、合同な図形の対応する辺は等しいので AC＝BD が言えます。',
      learningPoints: [
        '結論の辺をふくむ2つの三角形を見つける。',
        '合同を証明してから、対応する辺が等しいことを使う。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p18',
      number: '18',
      title: '平行線から対応する辺へ！',
      difficulty: 2,
      stage: 5,
      statement: 'AB∥CD、AB＝CDである。線分ACとBDの交点をOとするとき、AO＝COであることを証明しよう。',
      given: ['AB∥CD', 'AB＝CD'],
      conclusion: 'AO＝CO',
      conclusionType: 'equalSide',
      triangles: [['A', 'B', 'O'], ['C', 'D', 'O']],
      figure: figureOf('p03'),
      reasons: ['given', 'vertical', 'alternate', 'corresponding'],
      evidence: [
        { id: 'e1', items: ['AB', 'CD'], reason: 'given', label: 'AB＝CD', mark: 1 },
        { id: 'e2', items: ['∠BAO', '∠DCO'], reason: 'alternate', label: '∠BAO＝∠DCO', mark: 1,
          proofReason: 'AB∥CDより、平行線の錯角は等しいから' },
        { id: 'e3', items: ['∠ABO', '∠CDO'], reason: 'alternate', label: '∠ABO＝∠CDO', mark: 2,
          proofReason: 'AB∥CDより、平行線の錯角は等しいから' },
      ],
      extraTruths: [
        { items: ['∠AOB', '∠COD'], reason: 'vertical' },
        { items: ['∠AOD', '∠BOC'], reason: 'vertical' },
      ],
      congruence: 'ASA',
      finalStep: { relationType: 'side', items: ['AO', 'CO'], reason: 'correspondingSides', label: 'AO＝CO' },
      proof: { intro: '△ABOと△CDOにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['AO＝CO', 'AB＝AO', '∠BAO＝∠AOB'],
          reasons: [],
          triangles: ['ABO/DCO', 'ABO/COD'],
          finals: ['BO＝DO', 'AO＝BO'],
        },
      },
      hints: {
        triangleSelection: triangleHints(['AO', 'CO'], ['A', 'B', 'O'], ['C', 'D', 'O']),
        e1: [
          { text: '仮定に書かれている「等しい辺」はどれかな？' },
          { text: '辺ABと辺CDに注目してみよう！', focus: ['AB', 'CD'] },
          { text: 'AB＝CD。仮定より等しいね！', focus: ['AB', 'CD'] },
        ],
        e2: [
          { text: 'AB∥CD だから、平行線と交わる線分ACに注目しよう。' },
          { text: '∠BAOと∠DCOを比べてみよう！', focus: ['∠BAO', '∠DCO'] },
          { text: '∠BAO＝∠DCO。平行線の錯角だから等しいね！', focus: ['∠BAO', '∠DCO'] },
        ],
        e3: [
          { text: 'AB∥CD だから、平行線と交わる線分BDにも注目しよう。' },
          { text: '∠ABOと∠CDOを比べてみよう！', focus: ['∠ABO', '∠CDO'] },
          { text: '∠ABO＝∠CDO。平行線の錯角だから等しいね！', focus: ['∠ABO', '∠CDO'] },
        ],
        congruence: asaHints('∠BAOと∠ABO', '辺AB'),
        finalStep: finalHints(['AO', 'CO'], 'side'),
      },
      explanation: '辺AOと辺COは、△ABOと△CDOの対応する辺です。錯角を2組見つけて△ABO≡△CDOを証明すれば、合同な図形の対応する辺は等しいので AO＝CO（OはACの中点）が言えます。',
      learningPoints: [
        '結論の辺AO・COをふくむ三角形を見つける。',
        '合同を証明してから、対応する辺が等しいことを使う。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p19',
      number: '19',
      title: '共通な辺から別の辺の等しさへ！',
      difficulty: 3,
      stage: 5,
      statement: '四角形ABCDで、AD∥BC、AD＝CBである。対角線ACをひくとき、DC＝BAであることを証明しよう。',
      given: ['AD∥BC', 'AD＝CB'],
      conclusion: 'DC＝BA',
      conclusionType: 'equalSide',
      triangles: [['A', 'D', 'C'], ['C', 'B', 'A']],
      figure: figureOf('p08'),
      reasons: ['given', 'common', 'alternate', 'corresponding'],
      evidence: [
        { id: 'e1', items: ['AD', 'CB'], reason: 'given', label: 'AD＝CB', mark: 1 },
        { id: 'e2', items: ['∠DAC', '∠BCA'], reason: 'alternate', label: '∠DAC＝∠BCA', mark: 1,
          proofReason: 'AD∥BCより、平行線の錯角は等しいから' },
        { id: 'e3', items: ['AC', 'CA'], reason: 'common', label: 'AC＝CA', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'SAS',
      finalStep: { relationType: 'side', items: ['DC', 'BA'], reason: 'correspondingSides', label: 'DC＝BA' },
      proof: { intro: '△ADCと△CBAにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['DC＝BA', 'AD＝AC', '∠ADC＝∠DAC'],
          reasons: ['vertical'],
          triangles: ['ADC/ABC', 'ADC/CAB'],
          finals: ['∠ADC＝∠CBA', 'DC＝AC'],
        },
      },
      hints: {
        triangleSelection: triangleHints(['DC', 'BA'], ['A', 'D', 'C'], ['C', 'B', 'A']),
        e1: [
          { text: '仮定から等しい辺を探そう。' },
          { text: '辺ADと辺CBに注目！', focus: ['AD', 'CB'] },
          { text: 'AD＝CB。仮定より等しいね！', focus: ['AD', 'CB'] },
        ],
        e2: [
          { text: 'AD∥BCだから、平行線と交わる対角線ACに注目しよう。' },
          { text: '∠DACと∠BCAを比べてみよう！', focus: ['∠DAC', '∠BCA'] },
          { text: '∠DAC＝∠BCA。平行線の錯角だから等しいね！', focus: ['∠DAC', '∠BCA'] },
        ],
        e3: [
          { text: '2つの三角形の両方にふくまれる辺はどれかな？' },
          { text: '対角線ACに注目！ 同じ辺を2回タップしよう。', focus: ['AC'] },
          { text: 'AC＝CA。共通な辺だから等しいね！', focus: ['AC'] },
        ],
        congruence: sasHints('∠DAC', '辺ADと辺AC'),
        finalStep: finalHints(['DC', 'BA'], 'side'),
      },
      explanation: '辺DCと辺BAは、対角線ACで分けた△ADCと△CBAの対応する辺です。頂点の対応（A↔C、D↔B、C↔A）に気をつけて合同を証明すると、合同な図形の対応する辺は等しいので DC＝BA が言えます。',
      learningPoints: [
        '対角線で分けた2つの三角形の、頂点の対応を正しく読む。',
        '合同を証明してから、対応する辺が等しいことを使う。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p20',
      number: '20',
      title: '平行四辺形型の図から角の等しさへ！',
      difficulty: 3,
      stage: 5,
      statement: '四角形ABCDで、AB∥DC、AD∥BCである。対角線ACをひくとき、∠ABC＝∠CDAであることを証明しよう。',
      given: ['AB∥DC', 'AD∥BC'],
      conclusion: '∠ABC＝∠CDA',
      conclusionType: 'equalAngle',
      triangles: [['A', 'B', 'C'], ['C', 'D', 'A']],
      figure: figureOf('p13'),
      reasons: ['given', 'common', 'alternate', 'corresponding'],
      evidence: [
        { id: 'e1', items: ['∠BAC', '∠DCA'], reason: 'alternate', label: '∠BAC＝∠DCA', mark: 1,
          parallelGroup: 1, proofReason: 'AB∥DCより、平行線の錯角は等しいから' },
        { id: 'e2', items: ['∠BCA', '∠DAC'], reason: 'alternate', label: '∠BCA＝∠DAC', mark: 2,
          parallelGroup: 2, proofReason: 'AD∥BCより、平行線の錯角は等しいから' },
        { id: 'e3', items: ['AC', 'CA'], reason: 'common', label: 'AC＝CA', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'ASA',
      finalStep: { relationType: 'angle', items: ['∠ABC', '∠CDA'], reason: 'correspondingAngles', label: '∠ABC＝∠CDA' },
      proof: { intro: '△ABCと△CDAにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['∠ABC＝∠CDA', 'AB＝AC', '∠ABC＝∠BAC'],
          reasons: ['vertical'],
          triangles: ['ABC/ADC', 'ABC/CAD'],
          finals: ['AB＝CD', '∠ABC＝∠BAC'],
        },
      },
      hints: {
        triangleSelection: triangleHints(['∠ABC', '∠CDA'], ['A', 'B', 'C'], ['C', 'D', 'A']),
        e1: [
          { text: 'AB∥DCだから、平行線と交わる対角線ACに注目しよう。' },
          { text: '∠BACと∠DCAを比べてみよう！', focus: ['∠BAC', '∠DCA'] },
          { text: '∠BAC＝∠DCA。平行線の錯角だから等しいね！', focus: ['∠BAC', '∠DCA'] },
        ],
        e2: [
          { text: 'もう1組の平行線AD∥BCにも注目しよう。' },
          { text: '∠BCAと∠DACを比べてみよう！', focus: ['∠BCA', '∠DAC'] },
          { text: '∠BCA＝∠DAC。平行線の錯角だから等しいね！', focus: ['∠BCA', '∠DAC'] },
        ],
        e3: [
          { text: '2つの三角形の両方にふくまれる辺はどれかな？' },
          { text: '対角線ACに注目！ 同じ辺を2回タップしよう。', focus: ['AC'] },
          { text: 'AC＝CA。共通な辺だから等しいね！', focus: ['AC'] },
        ],
        congruence: asaHints('∠BACと∠BCA', '辺AC'),
        finalStep: finalHints(['∠ABC', '∠CDA'], 'angle'),
      },
      explanation: '∠ABCと∠CDAは、対角線ACで分けた△ABCと△CDAの対応する角です。2組の平行線の錯角と共通な辺で合同を証明すると、合同な図形の対応する角は等しいので ∠ABC＝∠CDA（平行四辺形の向かい合う角は等しい）が言えます。',
      learningPoints: [
        '結論の角をふくむ2つの三角形と、頂点の対応を見つける。',
        '合同を証明してから、対応する角が等しいことを使う。',
      ],
    }
  );

  // ==================================================================
  // Ver.0.7 追加問題（STAGE 7）：多段階証明（定理の適用・角の式の比較・導いた事実の再利用）
  //   教材「証明練習プリント」の 二等辺三角形①③・三角形の合同証明⑦⑧ をもとにした（図の座標は作り直し、
  //   仮定・結論・証明の流れは原本の模範解答どおり。数値は npm test で検証）。
  //   proofSteps：stage 'pre' は根拠を集める前、'post' は最終結論のあとに解くステップ（js/proof-engine.js）。
  //   evidence の fromStep：そのステップで導いた事実を合同の根拠に使う（reason: 'proved'）。
  // ==================================================================
  function stepHints(a, b, c, focus) {
    return [{ text: a }, { text: b, focus: focus || [] }, { text: c, focus: focus || [] }];
  }

  PH.problems.push(
    // ------------------------------------------------------------------
    {
      id: 'p21',
      number: '23',
      title: '二等辺三角形の底角を使おう！',
      difficulty: 2,
      stage: 6,
      statement: '△ABCは AB＝AC の二等辺三角形で、点D、Eは辺BC上の点で、BD＝CE である。このとき、AD＝AE であることを証明しよう。',
      given: ['AB＝AC', 'BD＝CE'],
      conclusion: 'AD＝AE',
      conclusionType: 'equalSide',
      triangles: [['A', 'B', 'D'], ['A', 'C', 'E']],
      figure: {
        viewBox: [0, 0, 400, 360],
        points: {
          A: { x: 200, y: 45,  label: [0, -20] },
          B: { x: 50,  y: 320, label: [-18, 14] },
          C: { x: 350, y: 320, label: [18, 14] },
          D: { x: 140, y: 320, label: [0, 24] },
          E: { x: 260, y: 320, label: [0, 24] },
        },
        lines: [['B', 'D', 'E', 'C']],
        segments: ['AB', 'AC', 'AD', 'AE', 'BD', 'DE', 'EC'],
        angles: ['ABD', 'ACE', 'BAD', 'CAE', 'DAE', 'ADB', 'AEC', 'ADE', 'AED'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical', 'proved'],
      proofSteps: [
        { id: 's1', type: 'theorem', stage: 'pre', rule: 'isoscelesBaseAngles', premise: ['AB', 'AC'], premiseLabel: 'AB＝AC',
          items: ['∠ABC', '∠ACB'], label: '∠ABC＝∠ACB', short: '底角が等しい', dependsOn: [] },
      ],
      evidence: [
        { id: 'e1', items: ['BD', 'CE'], reason: 'given', label: 'BD＝CE', mark: 1 },
        { id: 'e2', items: ['AB', 'AC'], reason: 'given', label: 'AB＝AC', mark: 2 },
        { id: 'e3', items: ['∠ABD', '∠ACE'], reason: 'proved', fromStep: 's1', label: '∠ABD＝∠ACE', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'SAS',
      finalStep: { relationType: 'side', items: ['AD', 'AE'], reason: 'correspondingSides', label: 'AD＝AE' },
      proof: { intro: '△ABDと△ACEにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['AD＝AE', 'AB＝AD', 'BD＝DE'],
          reasons: ['vertical'],
          triangles: ['ABD/AEC', 'ABD/CAE'],
          finals: ['∠ADB＝∠AEC', 'AD＝BD'],
        },
      },
      hints: {
        triangleSelection: [
          { text: '結論の辺ADと辺AEは、どの三角形にふくまれているかな？' },
          { text: '辺ADをふくむ三角形と、辺AEをふくむ三角形を見つけよう！', focus: ['AD', 'AE'] },
          { text: '△ABDと△ACEに注目しよう。対応する頂点は A↔A、B↔C、D↔E だよ。', focus: ['AD', 'AE'] },
        ],
        s1: stepHints('どんな図形の性質が使えるかな？', '2辺が等しい三角形には、角についてどんな性質があるかな？',
          '「二等辺三角形の底角は等しい」という性質を使おう！', ['∠ABD', '∠ACE']),
        e1: stepHints('仮定から等しい辺を探そう。', '辺BDと辺CEに注目しよう！', 'BD＝CE。仮定より等しいね！', ['BD', 'CE']),
        e2: stepHints('仮定にはもう1つ、等しい辺があるよ。', '辺ABと辺ACに注目しよう！', 'AB＝AC。仮定より等しいね！', ['AB', 'AC']),
        e3: stepHints('2つの三角形で、等しい角はないかな？ 図形の性質を使って説明できるよ。', '∠ABDと∠ACEに注目しよう！', '∠ABDと∠ACEを選んで「詳しい理由を説明する」を押そう！ 二等辺三角形の底角を使うよ。', ['∠ABD', '∠ACE']),
        congruence: sasHints('∠ABD', '辺ABと辺BD'),
        finalStep: [
          { text: '合同な三角形で、対応する辺や角にはどんな性質があるかな？' },
          { text: '結論の辺ADと辺AEを、合同な三角形の対応関係で確認しよう！', focus: ['AD', 'AE'] },
          { text: '「合同な図形の対応する辺は等しい」という性質を使おう！', focus: ['AD', 'AE'] },
        ],
      },
      explanation: 'AB＝ACの二等辺三角形では、底角∠ABC＝∠ACBが等しくなります。DはBC上の点なので∠ABD＝∠ABC、∠ACE＝∠ACBです。導いたこの角の等しさを根拠に使って△ABD≡△ACEを証明し、対応する辺からAD＝AEが言えます。',
      learningPoints: [
        'AB＝ACより、二等辺三角形の底角は等しい（定理を1ステップで使う）。',
        '導いた角の等しさを、合同の根拠に使う。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p22',
      number: '24',
      title: '二等辺三角形になることを証明！',
      difficulty: 3,
      stage: 6,
      statement: '△ABCは AB＝AC の二等辺三角形である。辺AB、AC上に BM＝CN となる点M、Nをとり、MCとNBの交点をDとする。このとき、△DBCは二等辺三角形であることを証明しよう。',
      given: ['AB＝AC', 'BM＝CN'],
      conclusion: '△DBCは二等辺三角形',
      conclusionType: 'isoscelesTriangle',
      triangles: [['M', 'B', 'C'], ['N', 'C', 'B']],
      figure: {
        viewBox: [0, 0, 400, 360],
        points: {
          A: { x: 200, y: 40,  label: [0, -20] },
          B: { x: 60,  y: 320, label: [-18, 14] },
          C: { x: 340, y: 320, label: [18, 14] },
          M: { x: 116, y: 208, label: [-22, 0] },
          N: { x: 284, y: 208, label: [22, 0] },
          D: { x: 200, y: 250, label: [0, -20] },
        },
        lines: [['A', 'M', 'B'], ['A', 'N', 'C'], ['M', 'D', 'C'], ['N', 'D', 'B']],
        segments: ['AM', 'MB', 'AN', 'NC', 'BC', 'MD', 'DC', 'ND', 'DB'],
        angles: ['MBC', 'NCB', 'DBC', 'DCB', 'BMC', 'CNB', 'BDC'],
        parallel: [],
      },
      reasons: ['given', 'common', 'vertical', 'proved'],
      proofSteps: [
        { id: 's1', type: 'theorem', stage: 'pre', rule: 'isoscelesBaseAngles', premise: ['AB', 'AC'], premiseLabel: 'AB＝AC',
          items: ['∠ABC', '∠ACB'], label: '∠ABC＝∠ACB', short: '底角が等しい', dependsOn: [] },
        { id: 's2', type: 'theorem', stage: 'post', rule: 'isoscelesConverse', premise: ['∠DBC', '∠DCB'], premiseLabel: '∠DCB＝∠DBC',
          triangle: 'DBC', label: '△DBCは二等辺三角形', short: '二等辺三角形になる', dependsOn: ['final'] },
      ],
      evidence: [
        { id: 'e1', items: ['BM', 'CN'], reason: 'given', label: 'BM＝CN', mark: 1 },
        { id: 'e2', items: ['BC', 'CB'], reason: 'common', label: 'BC＝CB', mark: 'common' },
        { id: 'e3', items: ['∠MBC', '∠NCB'], reason: 'proved', fromStep: 's1', label: '∠MBC＝∠NCB', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'SAS',
      finalStep: { relationType: 'angle', items: ['∠DCB', '∠DBC'], reason: 'correspondingAngles', label: '∠DCB＝∠DBC' },
      proof: { intro: '△MBCと△NCBにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['∠DCB＝∠DBC', 'BM＝BC', '∠MBC＝∠MCB'],
          reasons: ['vertical'],
          triangles: ['MBC/NBC', 'MBC/CNB'],
          finals: ['NB＝MC', '∠DCB＝∠MBC'],
        },
      },
      hints: {
        triangleSelection: [
          { text: '△DBCが二等辺三角形になるには、どの2つの角が等しければいいかな？' },
          { text: '∠DBCと∠DCBをふくむ、2つの三角形を見つけよう！', focus: ['∠DBC', '∠DCB'] },
          { text: '△MBCと△NCBに注目しよう。対応する頂点は M↔N、B↔C、C↔B だよ。', focus: ['∠DBC', '∠DCB'] },
        ],
        s1: stepHints('どんな図形の性質が使えるかな？', '2辺が等しい三角形には、角についてどんな性質があるかな？',
          '「二等辺三角形の底角は等しい」という性質を使おう！', ['∠MBC', '∠NCB']),
        e1: stepHints('仮定から等しい辺を探そう。', '辺BMと辺CNに注目しよう！', 'BM＝CN。仮定より等しいね！', ['BM', 'CN']),
        e2: stepHints('2つの三角形に共通する辺はないかな？', '辺BCに注目！ 同じ辺を2回タップしよう。', 'BC＝CB。共通な辺だから等しいね！', ['BC']),
        e3: stepHints('2つの三角形で、等しい角はないかな？ 図形の性質を使って説明できるよ。', '∠MBCと∠NCBに注目しよう！', '∠MBCと∠NCBを選んで「詳しい理由を説明する」を押そう！ 二等辺三角形の底角を使うよ。', ['∠MBC', '∠NCB']),
        congruence: sasHints('∠MBC', '辺MBと辺BC'),
        finalStep: [
          { text: '合同な三角形で、対応する辺や角にはどんな性質があるかな？' },
          { text: '∠DCBと∠DBCを、合同な三角形の対応関係で確認しよう！（∠DCB＝∠MCB、∠DBC＝∠NBC）', focus: ['∠DCB', '∠DBC'] },
          { text: '「合同な図形の対応する角は等しい」という性質を使おう！', focus: ['∠DCB', '∠DBC'] },
        ],
        s2: stepHints('∠DCB＝∠DBC が分かったね。△DBCはどんな三角形かな？', '2つの角が等しい三角形には、どんな性質があったかな？',
          '「2つの角が等しい三角形は二等辺三角形である」を使おう！', ['∠DBC', '∠DCB']),
      },
      explanation: 'AB＝ACから底角∠ABC＝∠ACBを導き、それを根拠に△MBC≡△NCBを証明します。合同な図形の対応する角は等しいので∠DCB＝∠DBC。さらに「2つの角が等しい三角形は二等辺三角形」から、△DBCは二等辺三角形だと言えます。',
      learningPoints: [
        '導いた角の等しさを合同の根拠に使い、合同から新しい角の等しさを導く。',
        '2つの角が等しい三角形は二等辺三角形である（二等辺三角形になるための条件）。',
      ],
    },

    // ------------------------------------------------------------------
    // Ver.1.0 追加（STAGE 6 の3問目）：合同を使わず、2つの角が等しいことから二等辺三角形を示す（PH.isGoalOnly）
    //   根拠は「等しい2つの角」1つだけ（∠FAC＝∠ACF。「詳しい理由を説明する」で錯角・折り返し・角をつなぐのステップを解く）
    //   → 後半のステップ「2つの角が等しい三角形は二等辺三角形」
    {
      id: 'p50',
      number: '25',
      title: '長方形を折り返すと？',
      difficulty: 3,
      stage: 6,
      statement: '長方形ABCDを対角線ACで折り、折り返した辺ECとADの交点をFとする。このとき、△AFCは二等辺三角形であることを証明しよう。',
      given: ['四角形ABCDは長方形', '長方形ABCDを対角線ACで折り返した（Bが移った点がE）'],
      conclusion: '△AFCは二等辺三角形',
      conclusionType: 'isoscelesTriangle',
      goalPrompt: '二等辺三角形であることを示すには、△AFCのどの角とどの角が等しいことを言えばよいかな？ 2つの角を選んで「詳しい理由を説明する」を押そう。',
      fold: { line: 'AC', from: 'B', to: 'E' },
      figure: {
        viewBox: [0, 0, 480, 360],
        points: {
          A: { x: 60,     y: 150,   label: [-18, 2] },
          B: { x: 60,     y: 320,   label: [-16, 18] },
          C: { x: 420,    y: 320,   label: [14, 18] },
          D: { x: 420,    y: 150,   label: [14, -12] },
          E: { x: 191.28, y: 41.99, label: [4, -14] },
          F: { x: 280.14, y: 150,   label: [4, -14] },
        },
        lines: [['A', 'F', 'D'], ['E', 'F', 'C']],
        segments: ['AB', 'BC', 'AF', 'FD', 'DC', 'AE', 'EF', 'FC', 'AC'],
        dashed: ['AB', 'BC'],
        angles: ['FAC', 'ACF', 'ACB', 'AFC', 'CAB'],
        parallel: [],
      },
      reasons: ['proved'],
      evidence: [
        { id: 'e1', items: ['∠FAC', '∠ACF'], reason: 'proved', fromStep: 's3', label: '∠FAC＝∠ACF', mark: 1 },
      ],
      extraTruths: [],
      proofSteps: [
        { id: 's1', type: 'theorem', rule: 'parallelAlternateAngles', quad: 'ABCD', lines: ['AD', 'BC'], premiseLabel: 'AD∥BC',
          lead: '四角形ABCDは長方形で AD∥BC だから、', items: ['∠ACB', '∠FAC'], label: '∠ACB＝∠FAC', short: '平行線の錯角', dependsOn: [],
          proofText: 'AD∥BCより、平行線の錯角は等しいから、' },
        { id: 's2', type: 'theorem', rule: 'foldAngles', items: ['∠ACB', '∠ACF'], premiseLabel: 'ACで折り返した',
          lead: '対角線ACで折り返したので、', label: '∠ACB＝∠ACF', short: '折り返した角', dependsOn: [],
          proofText: 'ACで折り返したので、' },
        { id: 's3', type: 'theorem', rule: 'angleTransitive', premiseLabel: '∠ACB＝∠FAC、∠ACB＝∠ACF',
          lead: '∠ACB＝∠FAC、∠ACB＝∠ACF だから、', items: ['∠FAC', '∠ACF'], label: '∠FAC＝∠ACF', short: '角をつなぐ', dependsOn: ['s1', 's2'],
          proofText: '{s1}、{s2}より、' },
        { id: 's4', type: 'theorem', stage: 'post', rule: 'isoscelesConverse', premise: ['∠FAC', '∠ACF'], triangle: 'FAC', premiseLabel: '∠FAC＝∠ACF',
          label: '△AFCは二等辺三角形', short: '二等辺三角形', dependsOn: ['s3'] },
      ],
      proof: { intro: '長方形ABCDを対角線ACで折り返したとき、' },
      puzzle: { type: 'build', distractors: { equations: [], reasons: [] } },
      hints: {
        e1: [
          { text: '二等辺三角形であることを示すには、2つの角が等しいことを言えばいいね。△AFCの角に注目しよう。' },
          { text: '△AFCの∠FACと∠ACFが等しいことを示そう！', focus: ['∠FAC', '∠ACF'] },
          { text: '∠FACと∠ACFを選んで「詳しい理由を説明する」を押そう！', focus: ['∠FAC', '∠ACF'] },
        ],
        s1: stepHints('長方形の対辺は平行だね。AD∥BC と、それに交わる直線ACに注目しよう。', '∠ACBと∠FACは錯角だね。',
          '平行線の錯角は等しいから ∠ACB＝∠FAC！', ['∠ACB', '∠FAC']),
        s2: stepHints('折り返す前の∠ACBは、折り返したあと、どの角に重なるかな？', '∠ACBを、ACで折り返すと∠ACFに重なるね。',
          '折り返した角は等しいから ∠ACB＝∠ACF！', ['∠ACB', '∠ACF']),
        s3: stepHints('∠ACB＝∠FAC、∠ACB＝∠ACF。どちらにも∠ACBが出てくるね。', '同じ角に等しい2つの角の関係は？',
          '同じ角に等しい2つの角は等しいから ∠FAC＝∠ACF！', ['∠FAC', '∠ACF']),
        s4: stepHints('△AFCの2つの角∠FACと∠ACFが等しいことが分かったね。', '2つの角が等しい三角形は、どんな三角形かな？',
          '2つの角が等しい三角形は二等辺三角形だから、△AFCは二等辺三角形！', ['∠FAC', '∠ACF']),
      },
      explanation: 'AD∥BCより、平行線の錯角は等しいので ∠ACB＝∠FAC。ACで折り返したので ∠ACB＝∠ACF。よって ∠FAC＝∠ACF。2つの角が等しいので、△AFCは二等辺三角形です（三角形の合同は使いません）。',
      learningPoints: [
        '二等辺三角形であることは、2つの角が等しいことから示せる（合同を使わなくてよい）。',
        '平行線の錯角と、折り返した角の等しさを、同じ角（∠ACB）でつなぐ。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p23',
      number: '26',
      title: '正三角形の60°を使おう！',
      difficulty: 3,
      stage: 6,
      statement: '△ABCと△DCEはともに正三角形である。このとき、AE＝BD であることを証明しよう。',
      given: ['△ABCは正三角形', '△DCEは正三角形'],
      conclusion: 'AE＝BD',
      conclusionType: 'equalSide',
      equilateral: ['ABC', 'DCE'],
      triangles: [['A', 'C', 'E'], ['B', 'C', 'D']],
      figure: {
        viewBox: [0, 0, 400, 380],
        points: {
          A: { x: 101.5, y: 163.4, label: [-6, -20] },
          B: { x: 40,    y: 330,   label: [-18, 12] },
          C: { x: 215,   y: 300,   label: [0, 26] },
          D: { x: 330.8, y: 199.4, label: [10, -18] },
          E: { x: 360,   y: 350,   label: [18, 12] },
        },
        lines: [],
        segments: ['AB', 'BC', 'CA', 'CD', 'CE', 'DE', 'AE', 'BD'],
        angles: ['ACE', 'BCD', 'ACD', 'DCE', 'BCA'],
        parallel: [],
      },
      reasons: ['given', 'common', 'equilateralSides', 'proved'],
      proofSteps: [
        { id: 's1', type: 'expression', rule: 'angleAddition', target: '∠ACE', parts: '∠ACD＋∠DCE', value: '∠ACD＋60°',
          premiseLabel: '△DCEは正三角形', label: '∠ACE＝∠ACD＋∠DCE＝∠ACD＋60°', short: '∠ACEの式', dependsOn: [] },
        { id: 's2', type: 'expression', rule: 'angleAddition', target: '∠BCD', parts: '∠BCA＋∠ACD', value: '∠ACD＋60°',
          premiseLabel: '△ABCは正三角形', label: '∠BCD＝∠BCA＋∠ACD＝∠ACD＋60°', short: '∠BCDの式', dependsOn: [] },
        { id: 's3', type: 'compare', items: ['∠ACE', '∠BCD'], label: '∠ACE＝∠BCD', short: '式を比べる', dependsOn: ['s1', 's2'],
          distractors: ['∠ACE＝∠ACD', '∠BCD＝∠DCE'] },
      ],
      evidence: [
        { id: 'e1', items: ['AC', 'BC'], reason: 'equilateralSides', label: 'AC＝BC', mark: 1 },
        { id: 'e2', items: ['CE', 'CD'], reason: 'equilateralSides', label: 'CE＝CD', mark: 2 },
        { id: 'e3', items: ['∠ACE', '∠BCD'], reason: 'proved', fromStep: 's3', label: '∠ACE＝∠BCD', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'SAS',
      finalStep: { relationType: 'side', items: ['AE', 'BD'], reason: 'correspondingSides', label: 'AE＝BD' },
      proof: { intro: '△ACEと△BCDにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['AE＝BD', 'AC＝CE', '∠ACD＝∠DCE'],
          reasons: ['given'],
          triangles: ['ACE/BDC', 'ACE/CBD'],
          finals: ['∠CAE＝∠CBD', 'AE＝CE'],
        },
      },
      hints: {
        triangleSelection: [
          { text: '結論の辺AEと辺BDは、どの三角形にふくまれているかな？' },
          { text: '辺AEをふくむ三角形と、辺BDをふくむ三角形を見つけよう！', focus: ['AE', 'BD'] },
          { text: '△ACEと△BCDに注目しよう。対応する頂点は A↔B、C↔C、E↔D だよ。', focus: ['AE', 'BD'] },
        ],
        s1: stepHints('∠ACEは、どの2つの角に分けられるかな？', '∠ACE＝∠ACD＋∠DCE。∠DCEは正三角形の角だね。',
          '∠DCE＝60°だから、∠ACE＝∠ACD＋60° だね！ 2つの角を合わせた角（角の和）だよ。', ['∠ACD', '∠DCE']),
        s2: stepHints('∠BCDは、どの2つの角に分けられるかな？', '∠BCD＝∠BCA＋∠ACD。∠BCAは正三角形の角だね。',
          '∠BCA＝60°だから、∠BCD＝∠ACD＋60° だね！ 2つの角を合わせた角（角の和）だよ。', ['∠BCA', '∠ACD']),
        s3: stepHints('2つの式を見比べてみよう。', '右辺に共通する部分はないかな？', '2つの式の右辺は同じだから、左辺どうしが等しいね！', ['∠ACE', '∠BCD']),
        e1: stepHints('正三角形の性質を使おう。', '△ABCの辺ACと辺BCに注目しよう！', 'AC＝BC。正三角形の3辺は等しいね！', ['AC', 'BC']),
        e2: stepHints('もう1つの正三角形にも注目しよう。', '△DCEの辺CEと辺CDに注目しよう！', 'CE＝CD。正三角形の3辺は等しいね！', ['CE', 'CD']),
        e3: stepHints('2つの辺の間の角は等しいかな？ 角の式を使って説明できるよ。', '∠ACEと∠BCDに注目しよう！', '∠ACEと∠BCDを選んで「詳しい理由を説明する」を押そう！ 2つの角を式で表して比べるよ。', ['∠ACE', '∠BCD']),
        congruence: sasHints('∠ACE', '辺ACと辺CE'),
        finalStep: [
          { text: '合同な三角形で、対応する辺や角にはどんな性質があるかな？' },
          { text: '結論の辺AEと辺BDを、合同な三角形の対応関係で確認しよう！', focus: ['AE', 'BD'] },
          { text: '「合同な図形の対応する辺は等しい」という性質を使おう！', focus: ['AE', 'BD'] },
        ],
      },
      explanation: '∠ACE＝∠ACD＋∠DCE＝∠ACD＋60°、∠BCD＝∠BCA＋∠ACD＝∠ACD＋60°。2つの式の右辺が同じなので∠ACE＝∠BCD（三段論法）。正三角形の辺AC＝BC、CE＝CDと合わせて△ACE≡△BCDを証明し、AE＝BDが言えます。',
      learningPoints: [
        '角の和を使って、2つの角を同じ式で表す。',
        '同じ式に等しい2つの角は等しい（三段論法）。導いた角を合同の根拠に使う。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p24',
      number: '27',
      title: '三段論法で合同を証明！',
      difficulty: 3,
      stage: 6,
      statement: '△ABCと△ADEは正三角形で、点Dは辺BC上にある。このとき、BD＝CE であることを証明しよう。',
      given: ['△ABCは正三角形', '△ADEは正三角形'],
      conclusion: 'BD＝CE',
      conclusionType: 'equalSide',
      equilateral: ['ABC', 'ADE'],
      triangles: [['A', 'B', 'D'], ['A', 'C', 'E']],
      figure: {
        viewBox: [0, 0, 460, 370],
        points: {
          A: { x: 185, y: 96.2,  label: [-8, -20] },
          B: { x: 50,  y: 330,   label: [-18, 12] },
          C: { x: 320, y: 330,   label: [10, 22] },
          D: { x: 240, y: 330,   label: [0, 24] },
          E: { x: 415, y: 165.5, label: [18, -6] },
        },
        lines: [['B', 'D', 'C']],
        segments: ['AB', 'AC', 'AD', 'AE', 'DE', 'CE', 'BD', 'DC'],
        angles: ['BAD', 'CAE', 'DAC', 'BAC', 'DAE', 'ABD', 'ACE', 'ADB', 'AEC'],
        parallel: [],
      },
      reasons: ['given', 'common', 'equilateralSides', 'proved'],
      proofSteps: [
        { id: 's1', type: 'expression', rule: 'angleSubtraction', target: '∠BAD', parts: '∠BAC－∠DAC', value: '60°－∠DAC',
          premiseLabel: '△ABCは正三角形', label: '∠BAD＝∠BAC－∠DAC＝60°－∠DAC', short: '∠BADの式', dependsOn: [] },
        { id: 's2', type: 'expression', rule: 'angleSubtraction', target: '∠CAE', parts: '∠DAE－∠DAC', value: '60°－∠DAC',
          premiseLabel: '△ADEは正三角形', label: '∠CAE＝∠DAE－∠DAC＝60°－∠DAC', short: '∠CAEの式', dependsOn: [] },
        { id: 's3', type: 'compare', items: ['∠BAD', '∠CAE'], label: '∠BAD＝∠CAE', short: '式を比べる', dependsOn: ['s1', 's2'],
          distractors: ['∠BAD＝∠DAC', '∠CAE＝∠DAC'] },
      ],
      evidence: [
        { id: 'e1', items: ['AB', 'AC'], reason: 'equilateralSides', label: 'AB＝AC', mark: 1 },
        { id: 'e2', items: ['AD', 'AE'], reason: 'equilateralSides', label: 'AD＝AE', mark: 2 },
        { id: 'e3', items: ['∠BAD', '∠CAE'], reason: 'proved', fromStep: 's3', label: '∠BAD＝∠CAE', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'SAS',
      finalStep: { relationType: 'side', items: ['BD', 'CE'], reason: 'correspondingSides', label: 'BD＝CE' },
      proof: { intro: '△ABDと△ACEにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['BD＝CE', 'AB＝AD', '∠BAD＝∠DAC'],
          reasons: ['given'],
          triangles: ['ABD/AEC', 'ABD/CAE'],
          finals: ['∠ADB＝∠AEC', 'BD＝AD'],
        },
      },
      hints: {
        triangleSelection: [
          { text: '結論の辺BDと辺CEは、どの三角形にふくまれているかな？' },
          { text: '辺BDをふくむ三角形と、辺CEをふくむ三角形を見つけよう！', focus: ['BD', 'CE'] },
          { text: '△ABDと△ACEに注目しよう。対応する頂点は A↔A、B↔C、D↔E だよ。', focus: ['BD', 'CE'] },
        ],
        s1: stepHints('∠BADは、どんな角の差で表せるかな？', '∠BAD＝∠BAC－∠DAC。∠BACは正三角形の角だね。',
          '∠BAC＝60°だから、∠BAD＝60°－∠DAC だね！ 大きい角から小さい角を引いた角（角の差）だよ。', ['∠BAC', '∠DAC']),
        s2: stepHints('∠CAEは、どんな角の差で表せるかな？', '∠CAE＝∠DAE－∠DAC。∠DAEは正三角形の角だね。',
          '∠DAE＝60°だから、∠CAE＝60°－∠DAC だね！ 大きい角から小さい角を引いた角（角の差）だよ。', ['∠DAE', '∠DAC']),
        s3: stepHints('2つの式を見比べてみよう。', '右辺に共通する部分はないかな？', '2つの式の右辺は同じだから、左辺どうしが等しいね！', ['∠BAD', '∠CAE']),
        e1: stepHints('正三角形の性質を使おう。', '△ABCの辺ABと辺ACに注目しよう！', 'AB＝AC。正三角形の3辺は等しいね！', ['AB', 'AC']),
        e2: stepHints('もう1つの正三角形にも注目しよう。', '△ADEの辺ADと辺AEに注目しよう！', 'AD＝AE。正三角形の3辺は等しいね！', ['AD', 'AE']),
        e3: stepHints('2つの辺の間の角は等しいかな？ 角の式を使って説明できるよ。', '∠BADと∠CAEに注目しよう！', '∠BADと∠CAEを選んで「詳しい理由を説明する」を押そう！ 2つの角を式で表して比べるよ。', ['∠BAD', '∠CAE']),
        congruence: sasHints('∠BAD', '辺ABと辺AD'),
        finalStep: [
          { text: '合同な三角形で、対応する辺や角にはどんな性質があるかな？' },
          { text: '結論の辺BDと辺CEを、合同な三角形の対応関係で確認しよう！', focus: ['BD', 'CE'] },
          { text: '「合同な図形の対応する辺は等しい」という性質を使おう！', focus: ['BD', 'CE'] },
        ],
      },
      explanation: '∠BAD＝∠BAC－∠DAC＝60°－∠DAC、∠CAE＝∠DAE－∠DAC＝60°－∠DAC。右辺が同じなので∠BAD＝∠CAE（三段論法）。正三角形の辺AB＝AC、AD＝AEと合わせて△ABD≡△ACEを証明し、BD＝CEが言えます。',
      learningPoints: [
        '角の差を使って、2つの角を同じ式で表す。',
        '2つの式を比べて導いた角の等しさを、合同の根拠に使う。',
      ],
    }
  );

  // ==================================================================
  // Ver.0.8 追加問題（STAGE 8）：直角三角形の合同条件
  //   p25・p26 は新しい2つの合同条件の入門。p27〜p30 は教材「証明練習プリント」の
  //   二等辺三角形と直角三角形 ⑤〜⑧ をもとにした（図の座標は作り直し、仮定・結論・証明の流れは原本の模範解答どおり）。
  //   evidence の role: 'right' … 2つの三角形の直角（直角三角形であることの確認。表示は「∠ABC＝∠DEF＝90°」）
  //     斜辺・他の1辺・鋭角の区別は、直角の位置から自動で求める（js/right-triangle.js。データに二重に書かない）。
  //   figure.rightMarks … 図にかかれている直角の印（仮定・垂線の直角だけ。正方形の角など、導く直角は最初は表示しない）
  //   perpendicular … 垂直な2直線（{ a, b, label }。label は仮定の書き方）、square … 正方形（頂点の順）
  // ==================================================================
  PH.problems.push(
    // ------------------------------------------------------------------
    {
      id: 'p25',
      number: '28',
      title: '斜辺と他の1辺を見つけろ！',
      difficulty: 1,
      stage: 7,
      statement: '四角形ABCDで、∠BAD＝∠BCD＝90°、AB＝CB のとき、△ABD≡△CBD であることを証明しよう。',
      given: ['∠BAD＝∠BCD＝90°', 'AB＝CB'],
      conclusion: '△ABD≡△CBD',
      triangles: [['A', 'B', 'D'], ['C', 'B', 'D']],
      figure: {
        viewBox: [0, 0, 400, 400],
        points: {
          A: { x: 130, y: 78.76,  label: [0, -22] },
          B: { x: 60,  y: 200,    label: [-22, 0] },
          C: { x: 130, y: 321.24, label: [0, 26] },
          D: { x: 340, y: 200,    label: [22, 0] },
        },
        lines: [],
        segments: ['AB', 'AD', 'CB', 'CD', 'BD'],
        angles: ['BAD', 'BCD', 'ABD', 'CBD', 'ADB', 'CDB'],
        parallel: [],
        rightMarks: ['BAD', 'BCD'],
      },
      reasons: ['given', 'common', 'vertical'],
      evidence: [
        { id: 'e1', role: 'right', items: ['∠BAD', '∠BCD'], reason: 'given', label: '∠BAD＝∠BCD', mark: 'right' },
        { id: 'e2', items: ['BD', 'BD'], reason: 'common', label: 'BD＝BD', mark: 'common' },
        { id: 'e3', items: ['AB', 'CB'], reason: 'given', label: 'AB＝CB', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'RHS',
      proof: { intro: '△ABDと△CBDにおいて' },
      puzzle: { type: 'fill', distractors: { equations: ['AB＝AD', 'AD＝BD', '∠ABD＝∠CDB'], reasons: ['vertical'] } },
      hints: {
        e1: rightHints('仮定の「∠BAD＝∠BCD＝90°」を図で探そう。∠BADと∠BCDをタップ！', '仮定より', '∠BAD＝∠BCD', ['∠BAD', '∠BCD']),
        e2: hypHints('△ABDでも△CBDでも、直角に向かい合う辺は辺BDだね。同じ辺を2回タップしよう！',
          'BD＝BD。共通な辺が斜辺になっているね！', ['BD']),
        e3: stepHints('斜辺と、もう1組の対応する辺を探そう！', '仮定の「AB＝CB」に注目しよう！',
          'AB＝CB。仮定より等しい、斜辺ではない方の辺（他の1辺）だね！', ['AB', 'CB']),
        congruence: rhsHints(),
      },
      explanation: '直角三角形で、直角に向かい合う辺を「斜辺」といいます。△ABDと△CBDはどちらも直角三角形で、斜辺BDは共通、他の1辺はAB＝CBなので、「直角三角形の斜辺と他の1辺がそれぞれ等しい」で合同が言えます。',
      learningPoints: [
        '仮定の90°から、2つの三角形が直角三角形であることを確かめる。',
        '直角に向かい合う辺が斜辺。共通な辺が斜辺になることもある。',
        '斜辺と他の1辺がそれぞれ等しい → 直角三角形の合同条件。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p26',
      number: '29',
      title: '斜辺と1つの鋭角で合同！',
      difficulty: 1,
      stage: 7,
      statement: '線分ADと線分BCが点Oで交わっている。∠ABO＝∠DCO＝90°、AO＝DO のとき、△ABO≡△DCO であることを証明しよう。',
      given: ['∠ABO＝∠DCO＝90°', 'AO＝DO'],
      conclusion: '△ABO≡△DCO',
      triangles: [['A', 'B', 'O'], ['D', 'C', 'O']],
      figure: {
        viewBox: [0, 0, 400, 380],
        points: {
          A: { x: 70,  y: 90,  label: [-18, -12] },
          B: { x: 70,  y: 190, label: [-22, 4] },
          O: { x: 200, y: 190, label: [12, -14] },
          C: { x: 330, y: 190, label: [22, 4] },
          D: { x: 330, y: 290, label: [18, 14] },
        },
        lines: [['A', 'O', 'D'], ['B', 'O', 'C']],
        segments: ['AB', 'BO', 'OC', 'CD', 'AO', 'OD'],
        angles: ['ABO', 'DCO', 'AOB', 'DOC', 'BAO', 'CDO'],
        parallel: [],
        rightMarks: ['ABO', 'DCO'],
      },
      reasons: ['given', 'common', 'vertical'],
      evidence: [
        { id: 'e1', role: 'right', items: ['∠ABO', '∠DCO'], reason: 'given', label: '∠ABO＝∠DCO', mark: 'right' },
        { id: 'e2', items: ['AO', 'DO'], reason: 'given', label: 'AO＝DO', mark: 1 },
        { id: 'e3', items: ['∠AOB', '∠DOC'], reason: 'vertical', label: '∠AOB＝∠DOC', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'RHA',
      proof: { intro: '△ABOと△DCOにおいて' },
      puzzle: { type: 'fill', distractors: { equations: ['AB＝BO', 'AO＝BO', '∠BAO＝∠DOC'], reasons: [] } },
      hints: {
        e1: rightHints('仮定の「∠ABO＝∠DCO＝90°」を図で探そう。∠ABOと∠DCOをタップ！', '仮定より', '∠ABO＝∠DCO', ['∠ABO', '∠DCO']),
        e2: hypHints('△ABOで直角∠ABOに向かい合う辺はAO、△DCOではDOだね。',
          'AO＝DO。仮定より、斜辺どうしが等しいね！', ['AO', 'DO']),
        e3: stepHints('斜辺のほかに、等しい角はないかな？', '直角ではない方の角（鋭角）に注目しよう！ 点Oのまわりの角はどうかな？',
          '∠AOB＝∠DOC。対頂角は等しいね！', ['∠AOB', '∠DOC']),
        congruence: rhaHints(),
      },
      explanation: '△ABOと△DCOはどちらも直角三角形です。斜辺AO＝DO（仮定）と、鋭角∠AOB＝∠DOC（対頂角）が等しいので、「直角三角形の斜辺と1つの鋭角がそれぞれ等しい」で合同が言えます。',
      learningPoints: [
        '直角三角形の斜辺は、直角に向かい合う辺。',
        '直角ではない角（鋭角）の等しさは、対頂角などの理由で見つける。',
        '斜辺と1つの鋭角がそれぞれ等しい → 直角三角形の合同条件。',
      ],
    },

    // ------------------------------------------------------------------
    // Ver.1.0 追加（STAGE 7 の3問目）：共通な角を鋭角に使う、直角三角形の斜辺と1つの鋭角
    {
      id: 'p49',
      number: '30',
      title: '共通な角と斜辺',
      difficulty: 2,
      stage: 7,
      statement: '右の図で、OA＝OB、∠ACO＝∠BDO＝90°であるとき、△OAC≡△OBD であることを証明しよう。',
      given: ['OA＝OB', '∠ACO＝∠BDO＝90°'],
      conclusion: '△OAC≡△OBD',
      triangles: [['O', 'A', 'C'], ['O', 'B', 'D']],
      figure: {
        viewBox: [0, 0, 470, 360],
        points: {
          O: { x: 40,     y: 320,    label: [-16, 18] },
          A: { x: 287.11, y: 31.32,  label: [6, -14] },
          B: { x: 420,    y: 320,    label: [12, 18] },
          C: { x: 287.11, y: 320,    label: [4, 22] },
          D: { x: 200.69, y: 132.27, label: [-20, -10] },
        },
        lines: [['O', 'D', 'A'], ['O', 'C', 'B']],
        segments: ['OD', { name: 'OA', hit: ['D', 'A'] }, 'OC', { name: 'OB', hit: ['C', 'B'] }, 'AC', 'BD'],
        angles: ['ACO', 'BDO', 'AOC', 'OAC', 'OBD'],
        parallel: [],
        rightMarks: ['ACO', 'BDO'],
      },
      reasons: ['given', 'commonAngle', 'common', 'vertical', 'perpendicular'],
      evidence: [
        { id: 'e1', role: 'right', items: ['∠ACO', '∠BDO'], reason: 'given', label: '∠ACO＝∠BDO', mark: 'right' },
        { id: 'e2', items: ['OA', 'OB'], reason: 'given', label: 'OA＝OB', mark: 1 },
        { id: 'e3', items: ['∠AOC', '∠BOD'], reason: 'commonAngle', label: '∠AOC＝∠BOD', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'RHA',
      proof: { intro: '△OACと△OBDにおいて' },
      puzzle: { type: 'build', distractors: { equations: ['OA＝AC', '∠OAC＝∠AOC', 'AC＝OC'], reasons: ['vertical'] } },
      hints: {
        e1: rightHints('仮定に直角が書かれているね。∠ACO と ∠BDO に注目しよう。', '仮定より', '∠ACO＝∠BDO', ['∠ACO', '∠BDO']),
        e2: hypHints('△OACで直角∠ACOに向かい合う辺はOA、△OBDではOBだね。', 'OA＝OB。仮定より等しいね！ 斜辺どうしが等しいよ。', ['OA', 'OB']),
        e3: stepHints('斜辺のほかに、等しい鋭角はないかな？', '∠AOCと∠BODは、どちらも点Oの角だね。同じ角かな？',
          '∠AOC＝∠BOD。共通な角だね！ 点Oの角を2回タップしよう。', ['∠AOC']),
        congruence: rhaHints(),
      },
      explanation: '△OACと△OBDで、仮定より ∠ACO＝∠BDO＝90°、OA＝OB（斜辺）、∠AOC＝∠BOD は共通な角（鋭角）。直角三角形の斜辺と1つの鋭角がそれぞれ等しいので △OAC≡△OBD です。',
      learningPoints: [
        '2つの直角三角形が重なっているとき、共通な角を鋭角として使う。',
        '直角に向かい合う辺（斜辺）を、それぞれの三角形で見つける。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p27',
      number: '31',
      title: '二等辺三角形にひいた垂線',
      difficulty: 2,
      stage: 7,
      statement: 'AB＝AC である△ABCの頂点B、Cから辺AC、ABに垂線をひき、その交点をそれぞれD、Eとする。このとき、△EBC≡△DCB であることを証明しよう。',
      given: ['AB＝AC', 'BD⊥AC', 'CE⊥AB'],
      conclusion: '△EBC≡△DCB',
      triangles: [['E', 'B', 'C'], ['D', 'C', 'B']],
      figure: {
        viewBox: [0, 0, 400, 370],
        points: {
          A: { x: 200,    y: 50,     label: [0, -20] },
          B: { x: 70,     y: 330,    label: [-18, 14] },
          C: { x: 330,    y: 330,    label: [18, 14] },
          D: { x: 283.89, y: 230.69, label: [20, -4] },
          E: { x: 116.11, y: 230.69, label: [-20, -4] },
        },
        lines: [['A', 'E', 'B'], ['A', 'D', 'C']],
        segments: ['AE', 'EB', 'AD', 'DC', 'BC', 'BD', 'CE'],
        angles: ['BEC', 'CDB', 'EBC', 'DCB'],
        parallel: [],
        rightMarks: ['BEC', 'CDB'],
      },
      perpendicular: [{ a: 'BD', b: 'AC', label: 'BD⊥AC' }, { a: 'CE', b: 'AB', label: 'CE⊥AB' }],
      reasons: ['given', 'common', 'perpendicular', 'proved'],
      proofSteps: [
        { id: 's1', type: 'theorem', stage: 'pre', rule: 'isoscelesBaseAngles', premise: ['AB', 'AC'], premiseLabel: 'AB＝AC',
          items: ['∠ABC', '∠ACB'], label: '∠ABC＝∠ACB', short: '底角が等しい', dependsOn: [] },
      ],
      evidence: [
        { id: 'e1', role: 'right', items: ['∠BEC', '∠CDB'], reason: 'perpendicular', label: '∠BEC＝∠CDB', mark: 'right' },
        { id: 'e2', items: ['BC', 'CB'], reason: 'common', label: 'BC＝CB', mark: 'common' },
        { id: 'e3', items: ['∠EBC', '∠DCB'], reason: 'proved', fromStep: 's1', label: '∠EBC＝∠DCB', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'RHA',
      proof: { intro: '△EBCと△DCBにおいて' },
      puzzle: { type: 'build', distractors: { equations: ['BE＝BC', '∠EBC＝∠ECB', 'BD＝BC'], reasons: ['vertical'] } },
      hints: {
        s1: stepHints('どんな図形の性質が使えるかな？', '2辺が等しい三角形には、角についてどんな性質があるかな？',
          '「二等辺三角形の底角は等しい」という性質を使おう！', ['∠EBC', '∠DCB']),
        e1: rightHints('垂直な線に注目しよう！ BD⊥AC、CE⊥ABだね。', '垂直な2直線がつくる角だから', '∠BEC＝∠CDB', ['∠BEC', '∠CDB']),
        e2: hypHints('△EBCでも△DCBでも、直角に向かい合う辺は辺BCだね。同じ辺を2回タップしよう！',
          'BC＝CB。共通な辺が斜辺になっているね！', ['BC']),
        e3: stepHints('斜辺のほかに、等しい角はないかな？', '直角ではない方の角（鋭角）に注目しよう！ 二等辺三角形の底角を使って説明できるよ。',
          '∠EBCと∠DCBを選んで「詳しい理由を説明する」を押そう！', ['∠EBC', '∠DCB']),
        congruence: rhaHints(),
      },
      explanation: 'BD⊥AC、CE⊥ABなので∠BEC＝∠CDB＝90°で、△EBCと△DCBは直角三角形です。斜辺BCは共通。AB＝ACの二等辺三角形の底角から∠EBC＝∠DCBが言えるので、「直角三角形の斜辺と1つの鋭角がそれぞれ等しい」で△EBC≡△DCBです。',
      learningPoints: [
        '垂直な2直線がつくる角は90°。垂線から直角三角形を見つける。',
        '二等辺三角形の底角を、直角三角形の鋭角として使う。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p28',
      number: '32',
      title: '正方形と正三角形',
      difficulty: 3,
      stage: 7,
      statement: '正方形ABCDの辺AD、AB上にそれぞれ点E、Fをとると、△CEFが正三角形になった。このとき、∠ECD＝∠FCB であることを証明しよう。',
      given: ['四角形ABCDは正方形', '△CEFは正三角形'],
      conclusion: '∠ECD＝∠FCB',
      conclusionType: 'equalAngle',
      square: ['ABCD'],
      equilateral: ['CEF'],
      triangles: [['C', 'E', 'D'], ['C', 'F', 'B']],
      figure: {
        viewBox: [0, 0, 400, 370],
        points: {
          A: { x: 60,     y: 40,     label: [-18, -12] },
          B: { x: 60,     y: 320,    label: [-18, 14] },
          C: { x: 340,    y: 320,    label: [18, 14] },
          D: { x: 340,    y: 40,     label: [18, -12] },
          E: { x: 264.97, y: 40,     label: [0, -18] },
          F: { x: 60,     y: 244.97, label: [-20, 0] },
        },
        lines: [['A', 'E', 'D'], ['A', 'F', 'B']],
        segments: ['AE', 'ED', 'AF', 'FB', 'BC', 'CD', 'CE', 'CF', 'EF'],
        angles: ['CDE', 'CBF', 'ECD', 'FCB', 'ECF', 'CED', 'CFB'],
        parallel: [],
      },
      reasons: ['given', 'common', 'squareSides', 'squareAngle', 'equilateralSides'],
      evidence: [
        { id: 'e1', role: 'right', items: ['∠CDE', '∠CBF'], reason: 'squareAngle', label: '∠CDE＝∠CBF', mark: 'right' },
        { id: 'e2', items: ['CE', 'CF'], reason: 'equilateralSides', label: 'CE＝CF', mark: 2 },
        { id: 'e3', items: ['CD', 'CB'], reason: 'squareSides', label: 'CD＝CB', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'RHS',
      finalStep: { relationType: 'angle', items: ['∠ECD', '∠FCB'], reason: 'correspondingAngles', label: '∠ECD＝∠FCB' },
      proof: { intro: '△CEDと△CFBにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['CD＝DE', '∠CDE＝∠ECF', 'FB＝CB'],
          reasons: ['vertical'],
          triangles: ['CED/CBF', 'CED/FBC'],
          finals: ['∠ECD＝∠ECF', '∠CED＝∠ECD'],
        },
      },
      hints: {
        triangleSelection: [
          { text: '結論の∠ECDと∠FCBは、どの三角形にふくまれているかな？' },
          { text: '∠ECDをふくむ三角形と、∠FCBをふくむ三角形を見つけよう！', focus: ['∠ECD', '∠FCB'] },
          { text: '△CEDと△CFBに注目しよう。対応する頂点は C↔C、E↔F、D↔B だよ。', focus: ['∠ECD', '∠FCB'] },
        ],
        e1: rightHints('正方形の角に注目しよう！', '正方形の角だから', '∠CDE＝∠CBF', ['∠CDE', '∠CBF']),
        e2: hypHints('△CEDで直角∠CDEに向かい合う辺はCE、△CFBではCFだね。どちらも正三角形CEFの辺だよ。',
          'CE＝CF。正三角形の3辺は等しいね！', ['CE', 'CF']),
        e3: stepHints('斜辺と、もう1組の対応する辺を探そう！', '正方形の辺に注目しよう！ 辺CDと辺CBはどうかな？',
          'CD＝CB。正方形の4辺は等しいね！', ['CD', 'CB']),
        congruence: rhsHints(),
        finalStep: [
          { text: '合同な三角形で、対応する辺や角にはどんな性質があるかな？' },
          { text: '結論の∠ECDと∠FCBを、合同な三角形の対応関係で確認しよう！', focus: ['∠ECD', '∠FCB'] },
          { text: '「合同な図形の対応する角は等しい」という性質を使おう！', focus: ['∠ECD', '∠FCB'] },
        ],
      },
      explanation: '正方形の角だから∠CDE＝∠CBF＝90°で、△CEDと△CFBは直角三角形です。斜辺CE＝CF（正三角形の辺）、他の1辺CD＝CB（正方形の辺）なので、「直角三角形の斜辺と他の1辺がそれぞれ等しい」で△CED≡△CFB。対応する角から∠ECD＝∠FCBが言えます。',
      learningPoints: [
        '正方形の角は90°、正方形の4辺は等しい。',
        '正三角形の辺を斜辺として使い、直角三角形の合同から角の等しさを導く。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p29',
      number: '33',
      title: '角の二等分線と垂線',
      difficulty: 2,
      stage: 7,
      statement: '∠XOYの二等分線上の点Pから、辺OX、OYに垂線をひき、その交点をそれぞれQ、Rとする。このとき、PQ＝PR であることを証明しよう。',
      given: ['∠POQ＝∠POR', 'PQ⊥OX', 'PR⊥OY'],
      conclusion: 'PQ＝PR',
      conclusionType: 'equalSide',
      triangles: [['P', 'O', 'Q'], ['P', 'O', 'R']],
      figure: {
        viewBox: [0, 0, 400, 370],
        points: {
          O: { x: 40,     y: 330,    label: [-16, 10] },
          X: { x: 252.12, y: 77.21,  label: [12, -10] },
          Y: { x: 370,    y: 330,    label: [16, 10] },
          P: { x: 275.64, y: 220.12, label: [18, -4] },
          Q: { x: 191.47, y: 149.49, label: [-16, -12] },
          R: { x: 275.64, y: 330,    label: [0, 24] },
        },
        lines: [['O', 'Q', 'X'], ['O', 'R', 'Y']],
        segments: ['OQ', 'QX', 'OR', 'RY', 'OP', 'PQ', 'PR'],
        angles: ['PQO', 'PRO', 'POQ', 'POR', 'OPQ', 'OPR'],
        parallel: [],
        rightMarks: ['PQO', 'PRO'],
      },
      perpendicular: [{ a: 'PQ', b: 'OX', label: 'PQ⊥OX' }, { a: 'PR', b: 'OY', label: 'PR⊥OY' }],
      reasons: ['given', 'common', 'perpendicular', 'vertical'],
      evidence: [
        { id: 'e1', role: 'right', items: ['∠PQO', '∠PRO'], reason: 'perpendicular', label: '∠PQO＝∠PRO', mark: 'right' },
        { id: 'e2', items: ['PO', 'PO'], reason: 'common', label: 'PO＝PO', mark: 'common' },
        { id: 'e3', items: ['∠POQ', '∠POR'], reason: 'given', label: '∠POQ＝∠POR', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'RHA',
      finalStep: { relationType: 'side', items: ['PQ', 'PR'], reason: 'correspondingSides', label: 'PQ＝PR' },
      proof: { intro: '△POQと△PORにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['PQ＝OQ', '∠POQ＝∠OPQ', 'OQ＝QX'],
          reasons: ['vertical'],
          triangles: ['POQ/ORP', 'POQ/OPR'],
          finals: ['OQ＝PR', 'PQ＝OP'],
        },
      },
      hints: {
        triangleSelection: [
          { text: '結論の辺PQと辺PRは、どの三角形にふくまれているかな？' },
          { text: '辺PQをふくむ三角形と、辺PRをふくむ三角形を見つけよう！', focus: ['PQ', 'PR'] },
          { text: '△POQと△PORに注目しよう。対応する頂点は P↔P、O↔O、Q↔R だよ。', focus: ['PQ', 'PR'] },
        ],
        e1: rightHints('垂直な線に注目しよう！ PQ⊥OX、PR⊥OYだね。', '垂直な2直線がつくる角だから', '∠PQO＝∠PRO', ['∠PQO', '∠PRO']),
        e2: hypHints('△POQでも△PORでも、直角に向かい合う辺は辺POだね。同じ辺を2回タップしよう！',
          'PO＝PO。共通な辺が斜辺になっているね！', ['PO']),
        e3: stepHints('斜辺のほかに、等しい角はないかな？', '直角ではない方の角（鋭角）に注目しよう！ 点Pは∠XOYの二等分線上にあるね。',
          '∠POQ＝∠POR。仮定（角の二等分線）より等しいね！', ['∠POQ', '∠POR']),
        congruence: rhaHints(),
        finalStep: [
          { text: '合同な三角形で、対応する辺や角にはどんな性質があるかな？' },
          { text: '結論の辺PQと辺PRを、合同な三角形の対応関係で確認しよう！', focus: ['PQ', 'PR'] },
          { text: '「合同な図形の対応する辺は等しい」という性質を使おう！', focus: ['PQ', 'PR'] },
        ],
      },
      explanation: 'PQ⊥OX、PR⊥OYなので∠PQO＝∠PRO＝90°。斜辺POは共通で、OPは∠XOYの二等分線なので∠POQ＝∠POR。「直角三角形の斜辺と1つの鋭角がそれぞれ等しい」で△POQ≡△PORとなり、対応する辺からPQ＝PRが言えます（角の二等分線上の点から、角の2辺までの距離は等しい）。',
      learningPoints: [
        '垂線から直角三角形を見つけ、共通な斜辺を使う。',
        '角の二等分線は、2つの鋭角が等しいことを表す。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p30',
      number: '34',
      title: '直角二等辺三角形と三段論法',
      difficulty: 3,
      stage: 7,
      statement: '△ABCは∠BAC＝90°、AB＝AC の直角二等辺三角形である。頂点Aを通り辺BCと交わる直線ℓに、頂点B、Cから垂線をひき、ℓとの交点をそれぞれD、Eとする。このとき、△ABD≡△CAE であることを証明しよう。',
      given: ['∠BAC＝90°', 'AB＝AC', 'BD⊥ℓ', 'CE⊥ℓ'],
      conclusion: '△ABD≡△CAE',
      triangles: [['A', 'B', 'D'], ['C', 'A', 'E']],
      figure: {
        viewBox: [0, 0, 440, 336],
        points: {
          A: { x: 220,    y: 50,     label: [0, -20] },
          B: { x: 40,     y: 230,    label: [-18, 10] },
          C: { x: 400,    y: 230,    label: [18, 10] },
          D: { x: 256.79, y: 151.09, label: [20, -6] },
          E: { x: 298.91, y: 266.79, label: [-20, 8] },
        },
        lines: [['A', 'D', 'E']],
        segments: ['AB', 'AC', 'BC', 'AD', 'DE', 'BD', 'CE'],
        angles: ['ADB', 'CEA', 'ABD', 'CAE', 'DAB'],
        parallel: [],
        rightMarks: ['BAC', 'ADB', 'CEA'],
        // 直線ℓ（A・D・E を通る）を E の先までのばして、名前「ℓ」をつける（飾り。タップできない）
        rays: [{ from: 'A', through: 'E', extend: 34, label: 'ℓ' }],
      },
      perpendicular: [{ a: 'BD', b: 'AE', label: 'BD⊥ℓ' }, { a: 'CE', b: 'AE', label: 'CE⊥ℓ' }],
      reasons: ['given', 'common', 'perpendicular', 'proved'],
      proofSteps: [
        { id: 's1', type: 'expression', rule: 'triangleAngleSum', target: '∠ABD', parts: '180°－∠ADB－∠DAB', value: '90°－∠DAB',
          premiseLabel: '△ABDで、∠ADB＝90°', note: '△ABDの内角の和は180°、∠ADB＝90°',
          label: '∠ABD＝180°－(90°＋∠DAB)＝90°－∠DAB', short: '∠ABDの式', dependsOn: [] },
        { id: 's2', type: 'expression', rule: 'angleSubtraction', target: '∠CAE', parts: '∠BAC－∠DAB', value: '90°－∠DAB',
          premiseLabel: '∠BAC＝90°', note: '∠BAC＝90°',
          label: '∠CAE＝∠BAC－∠DAB＝90°－∠DAB', short: '∠CAEの式', dependsOn: [] },
        { id: 's3', type: 'compare', items: ['∠ABD', '∠CAE'], label: '∠ABD＝∠CAE', short: '式を比べる', dependsOn: ['s1', 's2'],
          distractors: ['∠ABD＝∠DAB', '∠CAE＝∠DAB'] },
      ],
      evidence: [
        { id: 'e1', role: 'right', items: ['∠ADB', '∠CEA'], reason: 'perpendicular', label: '∠ADB＝∠CEA', mark: 'right' },
        { id: 'e2', items: ['AB', 'CA'], reason: 'given', label: 'AB＝CA', mark: 1 },
        { id: 'e3', items: ['∠ABD', '∠CAE'], reason: 'proved', fromStep: 's3', label: '∠ABD＝∠CAE', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'RHA',
      proof: { intro: '△ABDと△CAEにおいて' },
      puzzle: { type: 'build', distractors: { equations: ['BD＝AD', 'AB＝BC', '∠ABD＝∠DAB'], reasons: ['vertical'] } },
      hints: {
        s1: stepHints('△ABDの3つの角の和は何度かな？', '∠ADB＝90°だね。∠ABDを、∠DABを使って表そう。',
          '三角形の内角の和は180°だから、∠ABD＝180°－90°－∠DAB＝90°－∠DAB だね！', ['∠ABD', '∠DAB']),
        s2: stepHints('∠BAC＝90°だね。∠CAEは、どんな角の差で表せるかな？', '∠CAE＝∠BAC－∠DAB だね。',
          '∠BAC＝90°だから、∠CAE＝90°－∠DAB だね！ 大きい角から小さい角を引いた角（角の差）だよ。', ['∠CAE', '∠DAB']),
        s3: stepHints('2つの式を見比べてみよう。', '右辺に共通する部分はないかな？', '2つの式の右辺は同じだから、左辺どうしが等しいね！', ['∠ABD', '∠CAE']),
        e1: rightHints('垂直な線に注目しよう！ BD⊥ℓ、CE⊥ℓだね。', '垂直な2直線がつくる角だから', '∠ADB＝∠CEA', ['∠ADB', '∠CEA']),
        e2: hypHints('△ABDで直角∠ADBに向かい合う辺はAB、△CAEではCAだね。',
          'AB＝CA。仮定より、斜辺どうしが等しいね！', ['AB', 'CA']),
        e3: stepHints('斜辺のほかに、等しい角はないかな？', '直角ではない方の角（鋭角）に注目しよう！ ∠ABDと∠CAEは、角の式を使って説明できるよ。',
          '∠ABDと∠CAEを選んで「詳しい理由を説明する」を押そう！ 2つの角を式で表して比べるよ。', ['∠ABD', '∠CAE']),
        congruence: rhaHints(),
      },
      explanation: '△ABDの内角の和から∠ABD＝180°－(90°＋∠DAB)＝90°－∠DAB、∠BAC＝90°から∠CAE＝90°－∠DAB。右辺が同じなので∠ABD＝∠CAE（三段論法）。BD⊥ℓ、CE⊥ℓから∠ADB＝∠CEA＝90°、斜辺AB＝CA（仮定）と合わせて、「直角三角形の斜辺と1つの鋭角がそれぞれ等しい」で△ABD≡△CAEです。',
      learningPoints: [
        '三角形の内角の和・角の差を使って、2つの角を同じ式で表す。',
        '三段論法で導いた鋭角の等しさを、直角三角形の合同に使う。',
      ],
    }
  );

  // ==================================================================
  // Ver.0.9 追加問題（STAGE 10。はじめは STAGE 9）：平行四辺形になることの証明
  //   教材「証明練習プリント」の 平行四辺形 ③④（5つの成立条件）・⑦（対角線の中点）をもとにした
  //   （図の座標は作り直し、仮定・結論・証明の流れは原本の模範解答どおり）。
  //   conclusionType: 'parallelogram' … 結論は「四角形…は平行四辺形」。targetQuadrilateral が証明する四角形（周に沿った順）
  //   parallelogram … 平行四辺形の根拠（evidence。2つ）と成立条件（condition）。根拠の rel: 'parallel' は平行の関係（AB∥DC）、
  //     via … 錯角・同位角から平行を導くときの、等しい2つの角。alternatives … ほかの道すじで示せる成立条件（選んでもミスにしない）
  //   （p35 は Ver.0.9 の見直しで、結論を「AD∥BC」にして STAGE 6 へ移した）
  //   p36 は仮定の平行四辺形（knownParallelograms）の性質と中点（midpoints）を使う多段階証明（proofSteps）。
  //   evidence: [] … 三角形の合同を示す部分がない問題（平行四辺形の根拠は parallelogram.evidence）
  // ==================================================================
  function ppHints(a, b, c, focus) {
    return [{ text: a }, { text: b, focus: focus || [] }, { text: c, focus: focus || [] }];
  }

  PH.problems.push(
    // ------------------------------------------------------------------
    {
      id: 'p31',
      number: '38',
      title: '2組の対辺を見つけろ！',
      difficulty: 1,
      stage: 9,
      statement: '四角形ABCDで、AB＝DC、AD＝BC のとき、四角形ABCDは平行四辺形であることを証明しよう。',
      given: ['AB＝DC', 'AD＝BC'],
      conclusion: '四角形ABCDは平行四辺形',
      conclusionType: 'parallelogram',
      targetQuadrilateral: ['A', 'B', 'C', 'D'],
      figure: {
        viewBox: [0, 0, 460, 330],
        points: {
          A: { x: 120, y: 60,  label: [-8, -20] },
          B: { x: 40,  y: 280, label: [-18, 14] },
          C: { x: 340, y: 280, label: [16, 16] },
          D: { x: 420, y: 60,  label: [12, -18] },
        },
        lines: [],
        segments: ['AB', 'BC', 'CD', 'DA'],
        angles: ['DAB', 'ABC', 'BCD', 'CDA'],
        parallel: [],
      },
      reasons: [],
      evidence: [],
      parallelogram: {
        intro: ['四角形ABCDにおいて'],
        reasons: ['given', 'parallelogramSides', 'parallelogramParallel'],
        evidence: [
          { id: 'q1', items: ['AB', 'DC'], reason: 'given', label: 'AB＝DC', mark: 1 },
          { id: 'q2', items: ['AD', 'BC'], reason: 'given', label: 'AD＝BC', mark: 2 },
        ],
        condition: 'PP_EQUAL_SIDES',
        alternatives: [],
        distractors: { equations: ['AB＝BC', 'AD＝DC', 'AB∥DC'], reasons: [] },
      },
      puzzle: { type: 'fill', distractors: { equations: [], reasons: [] } },
      hints: {
        q1: ppHints('向かい合う辺（対辺）に注目しよう！ 仮定に書かれている等しい辺はどれかな？',
          '仮定の「AB＝DC」を図で探そう。辺ABと辺DCをタップ！', 'AB＝DC。仮定より等しいね！', ['AB', 'DC']),
        q2: ppHints('もう1組の対辺はどれかな？', '辺ADと辺BCに注目しよう！', 'AD＝BC。仮定より等しいね！', ['AD', 'BC']),
        pcondition: [
          { text: '向かい合う辺に注目しよう！ 集めた2つの根拠は、どの辺とどの辺の関係かな？' },
          { text: '2組の対辺がそれぞれ等しいことを示せないかな？' },
          { text: 'AB＝DC、AD＝BC が言えれば、平行四辺形の成立条件が使えるよ！「2組の対辺がそれぞれ等しい」を選ぼう！' },
        ],
      },
      explanation: '四角形ABCDの向かい合う辺（対辺）は、ABとDC、ADとBCの2組です。仮定から2組の対辺がそれぞれ等しいので、平行四辺形になるための条件「2組の対辺がそれぞれ等しい」が使えます。「平行四辺形の対辺は等しい」は、平行四辺形だと分かってから使える性質なので、ここでは使えません。',
      learningPoints: [
        '四角形の対辺（向かい合う辺）を見つける。',
        '2組の対辺がそれぞれ等しい四角形は平行四辺形である（成立条件）。',
        '「平行四辺形の対辺は等しい」（性質）とは、推論の向きが逆であることに注意する。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p32',
      number: '39',
      title: '2組の対角を見つけろ！',
      difficulty: 1,
      stage: 9,
      statement: '四角形ABCDで、∠A＝∠C、∠B＝∠D のとき、四角形ABCDは平行四辺形であることを証明しよう。',
      given: ['∠A＝∠C', '∠B＝∠D'],
      conclusion: '四角形ABCDは平行四辺形',
      conclusionType: 'parallelogram',
      targetQuadrilateral: ['A', 'B', 'C', 'D'],
      figure: {
        viewBox: [0, 0, 450, 340],
        points: {
          A: { x: 100, y: 70,  label: [-10, -20] },
          B: { x: 50,  y: 290, label: [-18, 14] },
          C: { x: 350, y: 290, label: [16, 16] },
          D: { x: 400, y: 70,  label: [14, -18] },
        },
        lines: [],
        segments: ['AB', 'BC', 'CD', 'DA'],
        angles: ['DAB', 'ABC', 'BCD', 'CDA'],
        parallel: [],
      },
      reasons: [],
      evidence: [],
      parallelogram: {
        intro: ['四角形ABCDにおいて'],
        reasons: ['given', 'parallelogramAngles', 'alternate'],
        evidence: [
          { id: 'q1', items: ['∠DAB', '∠BCD'], reason: 'given', given: '∠A＝∠C', label: '∠DAB＝∠BCD', mark: 1 },
          { id: 'q2', items: ['∠ABC', '∠CDA'], reason: 'given', given: '∠B＝∠D', label: '∠ABC＝∠CDA', mark: 2 },
        ],
        condition: 'PP_EQUAL_ANGLES',
        alternatives: [],
        distractors: { equations: ['∠DAB＝∠ABC', '∠BCD＝∠CDA', 'AB＝BC'], reasons: [] },
      },
      puzzle: { type: 'fill', distractors: { equations: [], reasons: [] } },
      hints: {
        q1: ppHints('向かい合う角（対角）に注目しよう！ ∠A と向かい合う角はどれかな？',
          '∠A（∠DAB）と ∠C（∠BCD）に注目しよう！ 角の内側をタップしよう。', '∠DAB＝∠BCD。仮定の ∠A＝∠C だね！', ['∠DAB', '∠BCD']),
        q2: ppHints('もう1組の対角はどれかな？', '∠B（∠ABC）と ∠D（∠CDA）に注目しよう！', '∠ABC＝∠CDA。仮定の ∠B＝∠D だね！', ['∠ABC', '∠CDA']),
        pcondition: [
          { text: '向かい合う角（対角）に注目しよう！ 集めた根拠は、どの角とどの角の関係かな？' },
          { text: '2組の対角がそれぞれ等しいことを示せないかな？' },
          { text: '∠A＝∠C、∠B＝∠D が言えれば、「2組の対角がそれぞれ等しい」が使えるよ！' },
        ],
      },
      explanation: '四角形ABCDの対角（向かい合う角）は、∠Aと∠C、∠Bと∠Dの2組です。仮定から2組の対角がそれぞれ等しいので、平行四辺形になるための条件「2組の対角がそれぞれ等しい」が使えます。∠Aと∠Bのような隣り合う角と取りちがえないようにしましょう。',
      learningPoints: [
        '四角形の対角（向かい合う角）を見つける。',
        '2組の対角がそれぞれ等しい四角形は平行四辺形である（成立条件）。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p33',
      number: '40',
      title: '対角線の中点を見抜け！',
      difficulty: 1,
      stage: 9,
      statement: '四角形ABCDの対角線ACとBDの交点をOとする。AO＝CO、BO＝DO のとき、四角形ABCDは平行四辺形であることを証明しよう。',
      given: ['AO＝CO', 'BO＝DO'],
      conclusion: '四角形ABCDは平行四辺形',
      conclusionType: 'parallelogram',
      targetQuadrilateral: ['A', 'B', 'C', 'D'],
      figure: {
        viewBox: [0, 0, 460, 330],
        points: {
          A: { x: 120, y: 60,  label: [-8, -20] },
          B: { x: 40,  y: 290, label: [-18, 14] },
          C: { x: 340, y: 290, label: [16, 16] },
          D: { x: 420, y: 60,  label: [12, -18] },
          O: { x: 230, y: 175, label: [0, -22] },
        },
        lines: [['A', 'O', 'C'], ['B', 'O', 'D']],
        segments: ['AB', 'BC', 'CD', 'DA', 'AO', 'OC', 'BO', 'OD'],
        angles: ['AOB', 'BOC', 'COD', 'DOA'],
        parallel: [],
      },
      reasons: [],
      evidence: [],
      parallelogram: {
        intro: ['四角形ABCDにおいて', '対角線ACとBDの交点をOとする。'],
        reasons: ['given', 'vertical', 'parallelogramDiagonals'],
        evidence: [
          { id: 'q1', items: ['AO', 'CO'], reason: 'given', label: 'AO＝CO', mark: 1 },
          { id: 'q2', items: ['BO', 'DO'], reason: 'given', label: 'BO＝DO', mark: 2 },
        ],
        condition: 'PP_BISECT_DIAGONALS',
        alternatives: [],
        distractors: { equations: ['AO＝BO', 'AO＝DO', 'AC＝BD'], reasons: [] },
      },
      puzzle: { type: 'fill', distractors: { equations: [], reasons: [] } },
      hints: {
        q1: ppHints('対角線が交わる点Oに注目しよう！', '対角線ACは、点Oで AO と CO に分かれるね。辺AOと辺COをタップ！', 'AO＝CO。仮定より等しいね！', ['AO', 'CO']),
        q2: ppHints('もう1本の対角線BDにも注目しよう！', 'BO と DO に注目しよう！', 'BO＝DO。仮定より等しいね！', ['BO', 'DO']),
        pcondition: [
          { text: '対角線が交わる点に注目しよう！' },
          { text: 'それぞれの対角線が2等分されているか調べよう！' },
          { text: 'AO＝CO、BO＝DOなら、対角線がそれぞれの中点で交わるね！' },
        ],
      },
      explanation: '対角線ACとBDの交点Oについて、AO＝CO なので O は AC の中点、BO＝DO なので O は BD の中点です。対角線がそれぞれの中点で交わるので、四角形ABCDは平行四辺形です。',
      learningPoints: [
        '四角形の対角線と、その交点を見つける。',
        '対角線がそれぞれの中点で交わる四角形は平行四辺形である（成立条件）。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p34',
      number: '41',
      title: '2組の対辺の平行を見つけろ！',
      difficulty: 1,
      stage: 9,
      statement: '四角形ABCDで、AB∥DC、AD∥BC のとき、四角形ABCDは平行四辺形であることを証明しよう。',
      given: ['AB∥DC', 'AD∥BC'],
      conclusion: '四角形ABCDは平行四辺形',
      conclusionType: 'parallelogram',
      targetQuadrilateral: ['A', 'B', 'C', 'D'],
      figure: {
        viewBox: [0, 0, 480, 330],
        points: {
          A: { x: 150, y: 60,  label: [-8, -20] },
          B: { x: 40,  y: 290, label: [-18, 14] },
          C: { x: 330, y: 290, label: [16, 16] },
          D: { x: 440, y: 60,  label: [12, -18] },
        },
        lines: [],
        segments: ['AB', 'BC', 'CD', 'DA'],
        angles: ['DAB', 'ABC', 'BCD', 'CDA'],
        // 仮定の AB∥DC（矢印1つ）と AD∥BC（矢印2つ）
        parallel: [['B', 'A', 1], ['C', 'D', 1], ['A', 'D', 2], ['B', 'C', 2]],
      },
      reasons: [],
      evidence: [],
      parallelogram: {
        intro: ['四角形ABCDにおいて'],
        reasons: ['given', 'parallelogramSides', 'parallelogramParallel'],
        evidence: [
          { id: 'q1', items: ['AB', 'DC'], rel: 'parallel', reason: 'given', label: 'AB∥DC', mark: 1 },
          { id: 'q2', items: ['AD', 'BC'], rel: 'parallel', reason: 'given', label: 'AD∥BC', mark: 2 },
        ],
        condition: 'PP_PARALLEL_PAIRS',
        alternatives: [],
        distractors: { equations: ['AB＝DC', 'AD＝BC', 'AB＝AD'], reasons: [] },
      },
      puzzle: { type: 'fill', distractors: { equations: [], reasons: [] } },
      hints: {
        q1: ppHints('仮定に書かれている平行な辺はどれかな？',
          '辺ABと辺DCに注目しよう！ 2つの辺を選んだら、「＝」を「∥」に切りかえよう。', 'AB∥DC。仮定より平行だね！', ['AB', 'DC']),
        q2: ppHints('もう1組の対辺はどうかな？', '辺ADと辺BCを選んで「∥」にしよう！', 'AD∥BC。仮定より平行だね！', ['AD', 'BC']),
        pcondition: [
          { text: '集めた2つの根拠は、どんな関係かな？' },
          { text: 'AB∥DC と AD∥BC。2組の対辺がどちらも平行だね。' },
          { text: '「2組の対辺がそれぞれ平行」を選ぼう！ これは平行四辺形の定義そのものだよ。' },
        ],
      },
      explanation: '「2組の対辺がそれぞれ平行な四角形」は、平行四辺形の定義です。仮定から AB∥DC、AD∥BC なので、四角形ABCDは平行四辺形です。平行（∥）の関係を根拠にするときは、2つの辺を選んでから「＝⇔∥」で切りかえます。',
      learningPoints: [
        '平行の関係（∥）を根拠にする。',
        '2組の対辺がそれぞれ平行な四角形は平行四辺形である（定義）。',
      ],
    },

    // ------------------------------------------------------------------
    // Ver.1.0 追加（STAGE 5 の6問目）：角の二等分線の作図が正しいことの証明（作図から OQ＝OR、PQ＝PR → △POQ≡△POR → ∠POQ＝∠POR）
    {
      id: 'p48',
      number: '21',
      rankKey: 'p48',          // 段位認定：p29 と合同の式（△POQ≡△POR）が同じなので、ミニ問題をまとめないように区別する
      title: '角の二等分線の作図',
      difficulty: 2,
      stage: 5,
      statement: '∠AOBの二等分線を、次のように作図した。点Oを中心とする円をかき、OA、OBとの交点をQ、Rとする。Q、Rを中心とする等しい半径の円をかき、その交点をPとする。このとき、OPが∠AOBの二等分線であること（∠POQ＝∠POR）を証明しよう。',
      given: ['OQ＝OR（点Oを中心とする円の半径）', 'PQ＝PR（Q、Rを中心とする等しい半径の円）'],
      conclusion: '∠POQ＝∠POR',
      conclusionType: 'equalAngle',
      triangles: [['P', 'O', 'Q'], ['P', 'O', 'R']],
      figure: {
        viewBox: [0, 0, 500, 340],
        points: {
          O: { x: 40,     y: 300,    label: [-16, 18] },
          A: { x: 317.86, y: 12.26,  label: [10, -6] },
          B: { x: 470,    y: 300,    label: [12, 18] },
          Q: { x: 144.2,  y: 192.1,  label: [-20, -8] },
          R: { x: 190,    y: 300,    label: [4, 22] },
          P: { x: 316.15, y: 182.78, label: [14, -28] },
        },
        lines: [['O', 'Q', 'A'], ['O', 'R', 'B']],
        segments: ['OQ', 'QA', 'OR', 'RB', 'OP', 'PQ', 'PR'],
        angles: ['POQ', 'POR', 'OQP', 'ORP', 'OPQ', 'OPR'],
        parallel: [],
        // PQ・PR は実際の作図ではひかない線なので破線。コンパスの跡（Oを中心とする円、Q・Rを中心とする円）をかく
        dashed: ['PQ', 'PR'],
        rays: [{ from: 'O', through: 'P', extend: 70 }],
        compassArcs: [
          { center: 'O', through: 'Q', around: ['Q', 'R'], pad: 12 },
          { center: 'Q', through: 'P', around: ['P'], pad: 14 },
          { center: 'R', through: 'P', around: ['P'], pad: 14 },
        ],
      },
      reasons: ['construction', 'common', 'vertical', 'alternate'],
      evidence: [
        { id: 'e1', items: ['OQ', 'OR'], reason: 'construction', label: 'OQ＝OR', mark: 1, proofReason: '作図より（点Oを中心とする円の半径）' },
        { id: 'e2', items: ['PQ', 'PR'], reason: 'construction', label: 'PQ＝PR', mark: 2, proofReason: '作図より（Q、Rを中心とする等しい半径の円）' },
        { id: 'e3', items: ['OP', 'OP'], reason: 'common', label: 'OP＝OP', mark: 3 },
      ],
      extraTruths: [],
      congruence: 'SSS',
      finalStep: { relationType: 'angle', items: ['∠POQ', '∠POR'], reason: 'correspondingAngles', label: '∠POQ＝∠POR' },
      proof: { intro: '△POQと△PORにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['OQ＝PQ', '∠OQP＝∠OPQ', 'OP＝PQ'],
          reasons: ['vertical'],
          triangles: ['POQ/ROP', 'POQ/OPR'],
          finals: ['∠OQP＝∠ORP', 'OQ＝OR'],
        },
      },
      hints: {
        triangleSelection: triangleHints(['∠POQ', '∠POR'], ['P', 'O', 'Q'], ['P', 'O', 'R']),
        e1: stepHints('作図で、同じ半径の円をかいたところはどこかな？', '点Oを中心とする円の上に、QとRがあるね。', 'OQ＝OR。作図より（同じ円の半径）等しいね！', ['OQ', 'OR']),
        e2: stepHints('点Pは、どのようにしてとった点かな？', 'Q、Rを中心とする等しい半径の円の交点がPだね。PQとPRを比べよう。', 'PQ＝PR。作図より（等しい半径）等しいね！', ['PQ', 'PR']),
        e3: stepHints('2つの三角形が共有している辺はないかな？', '辺OPは、両方の三角形の辺だね。', 'OP＝OP。共通な辺だね！ 辺OPを2回タップしよう。', ['OP']),
        congruence: sssHints(),
        finalStep: finalHints(['∠POQ', '∠POR'], 'angle'),
      },
      explanation: '△POQと△PORで、作図より OQ＝OR（点Oを中心とする円の半径）、PQ＝PR（Q、Rを中心とする等しい半径の円）、OPは共通。3組の辺がそれぞれ等しいので △POQ≡△POR。合同な図形の対応する角は等しいので ∠POQ＝∠POR。よって、OPは∠AOBの二等分線です。',
      learningPoints: [
        '作図で、同じ半径の円をかいたところから、等しい辺を見つける。',
        '合同な図形の対応する角から、角の二等分線であることを示す。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p35',
      number: '22',
      title: '合同から平行を導け！',
      difficulty: 3,
      stage: 5,
      statement: '四角形ABCDで、AB∥DC、AB＝DC である。対角線BDをひくとき、AD∥BC であることを証明しよう。',
      given: ['AB∥DC', 'AB＝DC'],
      conclusion: 'AD∥BC',
      // 結論が「2直線が平行」（Ver.0.9）：合同から錯角の等しさを導き、最後に「錯角が等しいから平行」（後半のステップ）
      conclusionType: 'parallelLines',
      triangles: [['A', 'B', 'D'], ['C', 'D', 'B']],
      figure: {
        viewBox: [0, 0, 460, 330],
        points: {
          A: { x: 130, y: 60,  label: [-8, -20] },
          B: { x: 40,  y: 290, label: [-18, 14] },
          C: { x: 330, y: 290, label: [16, 16] },
          D: { x: 420, y: 60,  label: [12, -18] },
        },
        lines: [],
        segments: ['AB', 'BC', 'CD', 'DA', 'BD'],
        angles: ['ABD', 'CDB', 'ADB', 'CBD', 'DAB', 'BCD'],
        // 仮定の AB∥DC（矢印1つ）
        parallel: [['B', 'A', 1], ['C', 'D', 1]],
      },
      reasons: ['given', 'common', 'alternate', 'vertical'],
      proofSteps: [
        { id: 's1', type: 'theorem', stage: 'post', rule: 'alternateAnglesParallel', premise: ['∠ADB', '∠CBD'], premiseLabel: '∠ADB＝∠CBD',
          lines: ['AD', 'BC'], label: 'AD∥BC', short: '平行を導く', dependsOn: ['final'] },
      ],
      evidence: [
        { id: 'e1', items: ['AB', 'CD'], reason: 'given', label: 'AB＝CD', mark: 1 },
        { id: 'e2', items: ['∠ABD', '∠CDB'], reason: 'alternate', label: '∠ABD＝∠CDB', mark: 1,
          parallelGroup: 1, proofReason: 'AB∥DCより、平行線の錯角は等しいから' },
        { id: 'e3', items: ['BD', 'DB'], reason: 'common', label: 'BD＝DB', mark: 'common' },
      ],
      extraTruths: [],
      congruence: 'SAS',
      finalStep: { relationType: 'angle', items: ['∠ADB', '∠CBD'], reason: 'correspondingAngles', label: '∠ADB＝∠CBD' },
      proof: { intro: '△ABDと△CDBにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['AB＝BD', 'AD＝AB', '∠ABD＝∠ADB'],
          reasons: ['vertical'],
          triangles: ['ABD/CBD', 'ABD/DCB'],
          finals: ['∠ABD＝∠CDB', 'AD＝AB'],
        },
      },
      hints: {
        triangleSelection: [
          { text: 'AD∥BC を示すには、どの2つの角が等しければよいかな？ 対角線BDに注目しよう。' },
          { text: '錯角 ∠ADB と ∠CBD をふくむ、2つの三角形を見つけよう！', focus: ['∠ADB', '∠CBD'] },
          { text: '△ABDと△CDBに注目しよう。対応する頂点は A↔C、B↔D、D↔B だよ。', focus: ['∠ADB', '∠CBD'] },
        ],
        e1: stepHints('仮定から等しい辺を探そう。', '辺ABと辺CDに注目しよう！', 'AB＝CD。仮定より等しいね！', ['AB', 'CD']),
        e2: stepHints('AB∥DC だから、平行線と交わる直線BDに注目しよう。', '∠ABDと∠CDBを比べてみよう！ 錯角だね。', '∠ABD＝∠CDB。平行線の錯角だから等しいね！', ['∠ABD', '∠CDB']),
        e3: stepHints('2つの三角形に共通する辺はないかな？', '辺BDに注目！ 同じ辺を2回タップしよう。', 'BD＝DB。共通な辺だから等しいね！', ['BD']),
        congruence: sasHints('∠ABD', '辺ABと辺BD'),
        finalStep: [
          { text: '合同な三角形で、対応する角にはどんな性質があるかな？' },
          { text: 'AD∥BC を示すのに使う角 ∠ADB と ∠CBD を、合同な三角形の対応関係で確認しよう！', focus: ['∠ADB', '∠CBD'] },
          { text: '「合同な図形の対応する角は等しい」という性質を使おう！', focus: ['∠ADB', '∠CBD'] },
        ],
        s1: stepHints('∠ADB＝∠CBD が分かったね。この2つの角は、直線ADとBCが直線BDと交わってできる、どんな角かな？',
          '∠ADB と ∠CBD は錯角だね。錯角が等しいと、2直線はどうなるかな？',
          '「錯角が等しいから、2直線は平行」を使おう！（「平行線の錯角は等しい」とは逆の向きの推論だよ）', ['∠ADB', '∠CBD']),
      },
      explanation: 'AB∥DCより錯角 ∠ABD＝∠CDB。AB＝CD、BD＝DB と合わせて △ABD≡△CDB（2組の辺とその間の角）です。合同な図形の対応する角は等しいので ∠ADB＝∠CBD。これは直線AD・BCと直線BDがつくる錯角なので、錯角が等しいから AD∥BC です。',
      learningPoints: [
        '平行を示すために、どの錯角が等しければよいかを考え、合同な三角形を見つける。',
        '合同な図形の対応する角は等しいことから、錯角の等しさを導く。',
        '錯角が等しいならば、2直線は平行である（「平行線の錯角は等しい」の逆）。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p36',
      number: '42',
      title: '平行四辺形の性質を使え！',
      difficulty: 3,
      stage: 9,
      statement: '平行四辺形ABCDの対角線ACとBDの交点をOとし、線分OB、ODの中点をそれぞれE、Fとする。このとき、四角形AECFは平行四辺形であることを証明しよう。',
      given: ['四角形ABCDは平行四辺形', 'Oは対角線ACとBDの交点', 'E、Fはそれぞれ線分OB、ODの中点'],
      conclusion: '四角形AECFは平行四辺形',
      conclusionType: 'parallelogram',
      targetQuadrilateral: ['A', 'E', 'C', 'F'],
      // 仮定で平行四辺形と分かっている四角形（その性質は使える）と、仮定の中点
      knownParallelograms: [['A', 'B', 'C', 'D']],
      midpoints: [{ point: 'E', of: 'OB' }, { point: 'F', of: 'OD' }],
      figure: {
        viewBox: [0, 0, 540, 340],
        points: {
          A: { x: 150, y: 60,  label: [-8, -20] },
          B: { x: 40,  y: 300, label: [-18, 14] },
          C: { x: 390, y: 300, label: [16, 16] },
          D: { x: 500, y: 60,  label: [12, -18] },
          O: { x: 270, y: 180, label: [2, -20] },
          E: { x: 155, y: 240, label: [-20, 2] },
          F: { x: 385, y: 120, label: [18, 0] },
        },
        lines: [['A', 'O', 'C'], ['B', 'E', 'O', 'F', 'D']],
        segments: ['AB', 'BC', 'CD', 'DA', 'AE', 'EC', 'CF', 'FA', 'AO', 'OC', 'BE', 'EO', 'OF', 'FD'],
        angles: ['AOE', 'COF'],
        parallel: [],
      },
      reasons: [],
      evidence: [],
      proofSteps: [
        { id: 's1', type: 'theorem', rule: 'parallelogramDiagonalsBisect', quad: 'ABCD', premiseLabel: '四角形ABCDは平行四辺形',
          lead: '四角形ABCDは平行四辺形だから、', items: ['OB', 'OD'], label: 'OB＝OD', short: '対角線の性質', dependsOn: [],
          proofText: '平行四辺形の対角線はそれぞれの中点で交わるから、' },
        { id: 's2', type: 'theorem', rule: 'halfSegments', premise: ['OB', 'OD'], premiseLabel: 'OB＝OD',
          lead: 'OB＝OD で、E、Fはそれぞれ OB、OD の中点だから、', items: ['OE', 'OF'], label: 'OE＝OF', short: '中点で半分', dependsOn: ['s1'],
          proofText: '仮定より OE＝1/2OB、OF＝1/2OD であるから、{s1}より、' },
      ],
      parallelogram: {
        intro: ['四角形AECFにおいて、対角線ACとEFは点Oで交わる。'],
        reasons: ['given', 'parallelogramDiagonals', 'parallelogramSides', 'vertical'],
        evidence: [
          { id: 'q1', items: ['OA', 'OC'], reason: 'parallelogramDiagonals', label: 'OA＝OC', mark: 1 },
          { id: 'q2', items: ['OE', 'OF'], reason: 'proved', fromStep: 's2', label: 'OE＝OF', mark: 2 },
        ],
        condition: 'PP_BISECT_DIAGONALS',
        alternatives: [],
        distractors: { equations: ['AE＝CF', 'OA＝OE', 'AE∥CF'], reasons: [] },
      },
      puzzle: { type: 'build', distractors: { equations: [], reasons: [] } },
      hints: {
        q1: ppHints('四角形ABCDは平行四辺形だね。対角線ACに注目しよう。',
          '点Oは対角線ACとBDの交点だね。OA と OC を比べよう！', 'OA＝OC。平行四辺形の対角線はそれぞれの中点で交わるからだね！', ['OA', 'OC']),
        q2: ppHints('四角形AECFのもう1本の対角線 EF は、点Oで2等分されているかな？',
          'OE と OF に注目しよう！ OE＝1/2OB、OF＝1/2OD だね。', 'OE と OF を選んで「詳しい理由を説明する」を押そう！ 平行四辺形の性質と中点を使って説明するよ。', ['OE', 'OF']),
        s1: stepHints('四角形ABCDは平行四辺形だね。対角線について、どんな性質があったかな？', '平行四辺形の対角線は、それぞれの中点で交わるよ。',
          '「平行四辺形の対角線はそれぞれの中点で交わる」を使おう！ OB＝OD だね。', ['OB', 'OD']),
        s2: stepHints('E、Fは、それぞれ OB、OD の中点だね。', 'OE＝1/2OB、OF＝1/2OD。OB＝OD だから…？',
          '等しい線分の半分の長さは等しいね！ OE＝OF だよ。', ['OE', 'OF']),
        pcondition: [
          { text: '四角形AECFの対角線はどれとどれかな？' },
          { text: '対角線ACとEFは、点Oでそれぞれ2等分されているかな？' },
          { text: 'OA＝OC、OE＝OF なので、「対角線がそれぞれの中点で交わる」を選ぼう！' },
        ],
      },
      explanation: '四角形ABCDは平行四辺形なので、平行四辺形の性質から OA＝OC、OB＝OD です。E、FはOB、ODの中点なので OE＝1/2OB、OF＝1/2OD、OB＝OD より OE＝OF。四角形AECFの対角線ACとEFは、それぞれ点Oで2等分されるので、「対角線がそれぞれの中点で交わる」から四角形AECFは平行四辺形です。',
      learningPoints: [
        '平行四辺形だと分かっている四角形（仮定）の性質を使って、新しい事実を導く。',
        '証明したい四角形の性質を、平行四辺形だと分かる前に使わない。',
        '対角線がそれぞれの中点で交わる四角形は平行四辺形である（成立条件）。',
      ],
    }
  );

  // ==================================================================
  // Ver.0.9 追加問題（STAGE 9「平行四辺形を利用せよ！」）：平行四辺形の性質を使う三角形の合同
  //   p37 … 教材「証明練習プリント」平行四辺形①（＝「証明トレーニング冊子」⑮）
  //   p38 … 同②（直角三角形の合同）、p39 … 「証明トレーニング冊子」⑯
  //   knownParallelograms … 仮定で平行四辺形と分かっている四角形。根拠の理由に平行四辺形の性質（対辺・対角線）が使える
  // ==================================================================
  // 平行四辺形ABCDの平行の印（AB∥DC は矢印1つ、AD∥BC は矢印2つ）
  const PARA_ARROWS = [['B', 'A', 1], ['C', 'D', 1], ['A', 'D', 2], ['B', 'C', 2]];

  PH.problems.push(
    // ------------------------------------------------------------------
    {
      id: 'p37',
      number: '35',
      title: '平行四辺形の対辺と錯角',
      difficulty: 2,
      stage: 8,
      statement: '平行四辺形ABCDの対角線BD上に、BE＝DF となるように点E、Fをとる。このとき、△ABE≡△CDF であることを証明しよう。',
      given: ['四角形ABCDは平行四辺形', 'BE＝DF'],
      conclusion: '△ABE≡△CDF',
      triangles: [['A', 'B', 'E'], ['C', 'D', 'F']],
      knownParallelograms: [['A', 'B', 'C', 'D']],
      figure: {
        viewBox: [0, 0, 500, 330],
        points: {
          A: { x: 130,   y: 60,    label: [-8, -20] },
          B: { x: 40,    y: 290,   label: [-18, 14] },
          C: { x: 370,   y: 290,   label: [16, 16] },
          D: { x: 460,   y: 60,    label: [12, -18] },
          E: { x: 157.6, y: 225.6, label: [4, 24] },
          F: { x: 342.4, y: 124.4, label: [-4, -20] },
        },
        lines: [['B', 'E', 'F', 'D']],
        segments: ['AB', 'BC', 'CD', 'DA', 'BE', 'EF', 'FD', 'AE', 'CF'],
        angles: ['ABE', 'CDF', 'BAE', 'DCF', 'AEB', 'CFD'],
        parallel: PARA_ARROWS,
      },
      reasons: ['given', 'parallelogramSides', 'alternate', 'vertical'],
      evidence: [
        { id: 'e1', items: ['BE', 'DF'], reason: 'given', label: 'BE＝DF', mark: 1 },
        { id: 'e2', items: ['AB', 'CD'], reason: 'parallelogramSides', label: 'AB＝CD', mark: 2 },
        { id: 'e3', items: ['∠ABE', '∠CDF'], reason: 'alternate', label: '∠ABE＝∠CDF', mark: 1,
          parallelGroup: 1, proofReason: 'AB∥DCより、平行線の錯角は等しいから' },
      ],
      extraTruths: [],
      congruence: 'SAS',
      proof: { intro: '△ABEと△CDFにおいて' },
      puzzle: { type: 'build', distractors: { equations: ['AB＝BE', '∠ABE＝∠BAE', 'AD＝AB'], reasons: ['vertical'] } },
      hints: {
        e1: stepHints('仮定から等しい辺を探そう。', '辺BEと辺DFに注目しよう！', 'BE＝DF。仮定より等しいね！', ['BE', 'DF']),
        e2: stepHints('四角形ABCDは平行四辺形だね。平行四辺形の辺には、どんな性質があったかな？', '辺ABと辺CDは、向かい合う辺（対辺）だね。',
          'AB＝CD。平行四辺形の対辺は等しいね！', ['AB', 'CD']),
        e3: stepHints('平行四辺形の対辺は平行だね。AB∥DC と、それに交わる直線BDに注目しよう。', '∠ABEと∠CDFを比べてみよう！ 錯角だね。',
          '∠ABE＝∠CDF。AB∥DCより、平行線の錯角は等しいね！', ['∠ABE', '∠CDF']),
        congruence: sasHints('∠ABE', '辺ABと辺BE'),
      },
      explanation: '四角形ABCDは平行四辺形なので、平行四辺形の対辺は等しく AB＝CD、対辺は平行なので AB∥DC から錯角 ∠ABE＝∠CDF です。仮定の BE＝DF と合わせて、2組の辺とその間の角がそれぞれ等しいので △ABE≡△CDF です。',
      learningPoints: [
        '平行四辺形の性質（対辺は等しい・対辺は平行）を、合同の根拠に使う。',
        '平行四辺形の対辺が平行であることから、錯角を見つける。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p38',
      number: '36',
      title: '平行四辺形にひいた垂線',
      difficulty: 3,
      stage: 8,
      statement: '平行四辺形ABCDの対角線AC上に、頂点B、Dからひいた垂線をそれぞれBE、DFとする。このとき、AE＝CF であることを証明しよう。',
      given: ['四角形ABCDは平行四辺形', 'BE⊥AC', 'DF⊥AC'],
      conclusion: 'AE＝CF',
      conclusionType: 'equalSide',
      triangles: [['A', 'B', 'E'], ['C', 'D', 'F']],
      knownParallelograms: [['A', 'B', 'C', 'D']],
      figure: {
        viewBox: [0, 0, 500, 330],
        points: {
          A: { x: 120,    y: 60,     label: [-8, -20] },
          B: { x: 40,     y: 290,    label: [-18, 14] },
          C: { x: 380,    y: 290,    label: [16, 16] },
          D: { x: 460,    y: 60,     label: [12, -18] },
          E: { x: 189.26, y: 121.27, label: [20, -6] },
          F: { x: 310.74, y: 228.73, label: [-20, 8] },
        },
        lines: [['A', 'E', 'F', 'C']],
        segments: ['AB', 'BC', 'CD', 'DA', 'AE', 'EF', 'FC', 'BE', 'DF'],
        angles: ['AEB', 'CFD', 'BAE', 'DCF', 'ABE', 'CDF'],
        parallel: PARA_ARROWS,
        rightMarks: ['AEB', 'CFD'],
      },
      perpendicular: [{ a: 'BE', b: 'AC', label: 'BE⊥AC' }, { a: 'DF', b: 'AC', label: 'DF⊥AC' }],
      reasons: ['given', 'parallelogramSides', 'alternate', 'perpendicular', 'vertical'],
      evidence: [
        { id: 'e1', role: 'right', items: ['∠AEB', '∠CFD'], reason: 'perpendicular', label: '∠AEB＝∠CFD', mark: 'right' },
        { id: 'e2', items: ['AB', 'CD'], reason: 'parallelogramSides', label: 'AB＝CD', mark: 1 },
        { id: 'e3', items: ['∠BAE', '∠DCF'], reason: 'alternate', label: '∠BAE＝∠DCF', mark: 1,
          parallelGroup: 1, proofReason: 'AB∥DCより、平行線の錯角は等しいから' },
      ],
      extraTruths: [],
      congruence: 'RHA',
      finalStep: { relationType: 'side', items: ['AE', 'CF'], reason: 'correspondingSides', label: 'AE＝CF' },
      proof: { intro: '△ABEと△CDFにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['AE＝BE', 'AB＝BE', '∠BAE＝∠ABE'],
          reasons: ['vertical'],
          triangles: ['ABE/CFD', 'ABE/DCF'],
          finals: ['∠BAE＝∠DCF', 'AE＝EF'],
        },
      },
      hints: {
        triangleSelection: triangleHints(['AE', 'CF'], ['A', 'B', 'E'], ['C', 'D', 'F']),
        e1: rightHints('垂直な線に注目しよう！ BE⊥AC、DF⊥AC だね。', '垂直な2直線がつくる角だから', '∠AEB＝∠CFD', ['∠AEB', '∠CFD']),
        e2: hypHints('△ABEで直角∠AEBに向かい合う辺はAB、△CDFではCDだね。',
          'AB＝CD。平行四辺形の対辺は等しいから、斜辺どうしが等しいね！', ['AB', 'CD']),
        e3: stepHints('斜辺のほかに、等しい角はないかな？', 'AB∥DC だから、直線ACと交わってできる錯角に注目しよう！',
          '∠BAE＝∠DCF。平行線の錯角は等しいね！', ['∠BAE', '∠DCF']),
        congruence: rhaHints(),
        finalStep: finalHints(['AE', 'CF'], 'side'),
      },
      explanation: 'BE⊥AC、DF⊥AC より ∠AEB＝∠CFD＝90°。平行四辺形の対辺は等しいので AB＝CD（斜辺）、AB∥DC より錯角 ∠BAE＝∠DCF（鋭角）。直角三角形の斜辺と1つの鋭角がそれぞれ等しいので △ABE≡△CDF。合同な図形の対応する辺は等しいので AE＝CF です。',
      learningPoints: [
        '垂線から直角三角形を見つけ、平行四辺形の対辺を斜辺として使う。',
        '平行四辺形の対辺が平行であることから錯角を見つけ、直角三角形の合同条件を使う。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p39',
      number: '37',
      title: '対角線の交点を通る直線',
      difficulty: 3,
      stage: 8,
      statement: '平行四辺形ABCDの対角線の交点Oを通る直線が、辺AB、DCと交わる点をそれぞれM、Nとする。このとき、AM＝CN であることを証明しよう。',
      given: ['四角形ABCDは平行四辺形', 'Oは対角線の交点', 'MはAB上、NはDC上（MNはOを通る）'],
      conclusion: 'AM＝CN',
      conclusionType: 'equalSide',
      triangles: [['A', 'O', 'M'], ['C', 'O', 'N']],
      knownParallelograms: [['A', 'B', 'C', 'D']],
      figure: {
        viewBox: [0, 0, 520, 330],
        points: {
          A: { x: 120, y: 60,    label: [-8, -20] },
          B: { x: 40,  y: 290,   label: [-18, 14] },
          C: { x: 400, y: 290,   label: [16, 16] },
          D: { x: 480, y: 60,    label: [12, -18] },
          O: { x: 260, y: 175,   label: [0, 28] },
          M: { x: 92,  y: 140.5, label: [-22, 0] },
          N: { x: 428, y: 209.5, label: [22, 4] },
        },
        lines: [['A', 'M', 'B'], ['D', 'N', 'C'], ['A', 'O', 'C'], ['B', 'O', 'D'], ['M', 'O', 'N']],
        segments: ['AM', 'MB', 'BC', 'CN', 'ND', 'DA', 'AO', 'OC', 'BO', 'OD', 'MO', 'ON'],
        angles: ['OAM', 'OCN', 'AOM', 'CON', 'AMO', 'CNO'],
        parallel: PARA_ARROWS,
      },
      reasons: ['given', 'parallelogramDiagonals', 'alternate', 'vertical', 'parallelogramSides'],
      evidence: [
        { id: 'e1', items: ['AO', 'CO'], reason: 'parallelogramDiagonals', label: 'AO＝CO', mark: 1 },
        { id: 'e2', items: ['∠OAM', '∠OCN'], reason: 'alternate', label: '∠OAM＝∠OCN', mark: 1,
          parallelGroup: 1, proofReason: 'AB∥DCより、平行線の錯角は等しいから' },
        { id: 'e3', items: ['∠AOM', '∠CON'], reason: 'vertical', label: '∠AOM＝∠CON', mark: 2 },
      ],
      // 錯角（AB∥DC と直線MN）でも言える。結論を使わずに言える関係なのでミスにしない
      extraTruths: [{ items: ['∠AMO', '∠CNO'], reason: 'alternate' }],
      congruence: 'ASA',
      finalStep: { relationType: 'side', items: ['AM', 'CN'], reason: 'correspondingSides', label: 'AM＝CN' },
      proof: { intro: '△AOMと△CONにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['AO＝AM', '∠OAM＝∠AOM', 'AM＝MB'],
          reasons: ['given'],
          triangles: ['AOM/CNO', 'AOM/OCN'],
          finals: ['∠OAM＝∠OCN', 'AM＝AO'],
        },
      },
      hints: {
        triangleSelection: triangleHints(['AM', 'CN'], ['A', 'O', 'M'], ['C', 'O', 'N']),
        e1: stepHints('平行四辺形の対角線には、どんな性質があったかな？', '点Oは対角線ACとBDの交点だね。AOとCOを比べよう！',
          'AO＝CO。平行四辺形の対角線はそれぞれの中点で交わるね！', ['AO', 'CO']),
        e2: stepHints('AB∥DC だから、直線ACと交わってできる錯角に注目しよう。', '∠OAMと∠OCNを比べてみよう！',
          '∠OAM＝∠OCN。平行線の錯角は等しいね！', ['∠OAM', '∠OCN']),
        e3: stepHints('2本の直線が点Oで交わってできる角に注目しよう。', '∠AOMと∠CONを比べてみよう！', '∠AOM＝∠CON。対頂角は等しいね！', ['∠AOM', '∠CON']),
        congruence: asaHints('∠OAMと∠AOM', '辺AO'),
        finalStep: finalHints(['AM', 'CN'], 'side'),
      },
      explanation: '平行四辺形の対角線はそれぞれの中点で交わるので AO＝CO。AB∥DCより錯角 ∠OAM＝∠OCN、対頂角 ∠AOM＝∠CON。1組の辺とその両端の角がそれぞれ等しいので △AOM≡△CON。合同な図形の対応する辺は等しいので AM＝CN です。',
      learningPoints: [
        '平行四辺形の対角線の性質（それぞれの中点で交わる）を、合同の根拠に使う。',
        '錯角・対頂角と組み合わせて、1組の辺とその両端の角を見つける。',
      ],
    }
  );

  // ==================================================================
  // Ver.0.9 追加問題（STAGE 10「平行四辺形を証明せよ！」）
  //   p40 … 教材「証明練習プリント」平行四辺形⑤（2つの平行四辺形）
  //   p41 … 同⑥（＝「証明トレーニング冊子」⑱。線分の差）
  //   p42 … 「証明トレーニング冊子」⑲（合同証明 → 平行四辺形になることの証明）
  //   根拠の fromFinal … 三角形の合同から導いた結論（finalStep）そのものを平行四辺形の根拠に使う（証明文ではその番号を使う）
  //   via が仮定の垂線の直角どうし（p42 の ∠BEF＝∠DFE＝90°）のときは、その角の等しさは証明しなくてよい
  // ==================================================================
  PH.problems.push(
    // ------------------------------------------------------------------
    {
      id: 'p40',
      number: '43',
      title: '2つの平行四辺形をつなげ！',
      difficulty: 3,
      stage: 9,
      statement: '右の図で、四角形ABCD、BEFCはともに平行四辺形である。このとき、四角形AEFDは平行四辺形であることを証明しよう。',
      given: ['四角形ABCDは平行四辺形', '四角形BEFCは平行四辺形'],
      conclusion: '四角形AEFDは平行四辺形',
      conclusionType: 'parallelogram',
      targetQuadrilateral: ['A', 'E', 'F', 'D'],
      knownParallelograms: [['A', 'B', 'C', 'D'], ['B', 'E', 'F', 'C']],
      figure: {
        viewBox: [0, 0, 420, 330],
        points: {
          A: { x: 110, y: 50,  label: [-8, -18] },
          D: { x: 330, y: 50,  label: [8, -18] },
          B: { x: 150, y: 150, label: [-6, -16] },
          C: { x: 370, y: 150, label: [18, 4] },
          E: { x: 90,  y: 290, label: [-14, 18] },
          F: { x: 310, y: 290, label: [14, 18] },
        },
        lines: [],
        segments: ['AB', 'BC', 'CD', 'DA', 'BE', 'EF', 'FC', 'AE', 'DF'],
        angles: ['DAB', 'ABC', 'EBC', 'BEF'],
        parallel: [],
      },
      reasons: [],
      evidence: [],
      proofSteps: [
        { id: 's1', type: 'theorem', rule: 'parallelogramOppositeSidesParallel', quad: 'ABCD', premiseLabel: '四角形ABCDは平行四辺形',
          lead: '四角形ABCDは平行四辺形だから、', items: ['AD', 'BC'], rel: 'parallel', label: 'AD∥BC', short: 'ABCDの対辺（平行）', dependsOn: [],
          proofText: '平行四辺形ABCDの対辺は平行だから、' },
        { id: 's2', type: 'theorem', rule: 'parallelogramOppositeSidesParallel', quad: 'BEFC', premiseLabel: '四角形BEFCは平行四辺形',
          lead: '四角形BEFCは平行四辺形だから、', items: ['BC', 'EF'], rel: 'parallel', label: 'BC∥EF', short: 'BEFCの対辺（平行）', dependsOn: [],
          proofText: '平行四辺形BEFCの対辺は平行だから、' },
        { id: 's3', type: 'theorem', rule: 'parallelTransitive', premiseLabel: 'AD∥BC、BC∥EF',
          lead: 'AD∥BC、BC∥EF だから、', items: ['AD', 'EF'], rel: 'parallel', label: 'AD∥EF', short: '平行をつなぐ', dependsOn: ['s1', 's2'],
          proofText: '{s1}、{s2}より、' },
        { id: 's4', type: 'theorem', rule: 'parallelogramOppositeSidesEqual', quad: 'ABCD', premiseLabel: '四角形ABCDは平行四辺形',
          lead: '四角形ABCDは平行四辺形だから、', items: ['AD', 'BC'], label: 'AD＝BC', short: 'ABCDの対辺（長さ）', dependsOn: [],
          proofText: '平行四辺形ABCDの対辺は等しいから、' },
        { id: 's5', type: 'theorem', rule: 'parallelogramOppositeSidesEqual', quad: 'BEFC', premiseLabel: '四角形BEFCは平行四辺形',
          lead: '四角形BEFCは平行四辺形だから、', items: ['BC', 'EF'], label: 'BC＝EF', short: 'BEFCの対辺（長さ）', dependsOn: [],
          proofText: '平行四辺形BEFCの対辺は等しいから、' },
        { id: 's6', type: 'theorem', rule: 'equalTransitive', premiseLabel: 'AD＝BC、BC＝EF',
          lead: 'AD＝BC、BC＝EF だから、', items: ['AD', 'EF'], label: 'AD＝EF', short: '長さをつなぐ', dependsOn: ['s4', 's5'],
          proofText: '{s4}、{s5}より、' },
      ],
      parallelogram: {
        intro: ['四角形AEFDにおいて'],
        reasons: ['given', 'parallelogramSides', 'parallelogramParallel'],
        evidence: [
          { id: 'q1', items: ['AD', 'EF'], rel: 'parallel', reason: 'proved', fromStep: 's3', label: 'AD∥EF', mark: 1 },
          { id: 'q2', items: ['AD', 'EF'], reason: 'proved', fromStep: 's6', label: 'AD＝EF', mark: 1 },
        ],
        condition: 'PP_PARALLEL_EQUAL_PAIR',
        alternatives: [],
        distractors: { equations: ['AE＝DF', 'AE∥DF', 'AB＝BE'], reasons: [] },
      },
      puzzle: { type: 'build', distractors: { equations: [], reasons: [] } },
      hints: {
        q1: ppHints('四角形AEFDの辺ADとEFは、どちらも辺BCと平行かな？', 'AD∥BC（平行四辺形ABCD）と BC∥EF（平行四辺形BEFC）に注目しよう。',
          '辺ADと辺EFを選んで「∥」にし、「詳しい理由を説明する」を押そう！', ['AD', 'EF']),
        q2: ppHints('辺ADと辺EFの長さは、どちらも辺BCと等しいかな？', 'AD＝BC（平行四辺形ABCD）と BC＝EF（平行四辺形BEFC）に注目しよう。',
          '辺ADと辺EFを選んで「詳しい理由を説明する」を押そう！', ['AD', 'EF']),
        s1: stepHints('四角形ABCDは平行四辺形だね。対辺について、どんな性質があったかな？', '平行四辺形の対辺は平行だね。', '「平行四辺形の対辺は平行」を使おう！', ['AD', 'BC']),
        s2: stepHints('四角形BEFCも平行四辺形だね。', '平行四辺形の対辺は平行だね。', '「平行四辺形の対辺は平行」を使おう！', ['BC', 'EF']),
        s3: stepHints('AD∥BC、BC∥EF。ADとEFは、どちらもBCと平行だね。', '同じ直線に平行な2直線の関係は？', '同じ直線に平行な2直線は平行だから、AD∥EF！', ['AD', 'EF']),
        s4: stepHints('四角形ABCDの対辺の長さについて、どんな性質があったかな？', '平行四辺形の対辺は等しいね。', '「平行四辺形の対辺は等しい」を使おう！', ['AD', 'BC']),
        s5: stepHints('四角形BEFCの対辺の長さは？', '平行四辺形の対辺は等しいね。', '「平行四辺形の対辺は等しい」を使おう！', ['BC', 'EF']),
        s6: stepHints('AD＝BC、BC＝EF。ADとEFは、どちらもBCと等しいね。', '同じ辺に等しい2つの辺の関係は？', '同じ辺に等しい2つの辺は等しいから、AD＝EF！', ['AD', 'EF']),
        pcondition: [
          { text: '集めた2つの根拠は、どちらも辺ADと辺EFについての関係だね。' },
          { text: 'AD∥EF で AD＝EF。同じ1組の対辺が、平行で長さも等しいね。' },
          { text: '「1組の対辺が平行で、その長さが等しい」を選ぼう！' },
        ],
      },
      explanation: '平行四辺形ABCDより AD∥BC、AD＝BC、平行四辺形BEFCより BC∥EF、BC＝EF。AD と EF はどちらも BC と平行で長さも等しいので、AD∥EF、AD＝EF。1組の対辺が平行で、その長さが等しいので、四角形AEFDは平行四辺形です。',
      learningPoints: [
        '2つの平行四辺形の性質を、共通な辺（BC）でつなぐ。',
        '同じ直線に平行な2直線は平行、同じ辺に等しい2つの辺は等しい。',
        '1組の対辺が平行で、その長さが等しい四角形は平行四辺形である。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p41',
      number: '44',
      title: '対辺から等しい長さをひくと？',
      difficulty: 3,
      stage: 9,
      statement: '平行四辺形ABCDの辺AB、DC上に、AE＝FC となる点E、Fをそれぞれとる。このとき、四角形BFDEは平行四辺形であることを証明しよう。',
      given: ['四角形ABCDは平行四辺形', 'AE＝FC'],
      conclusion: '四角形BFDEは平行四辺形',
      conclusionType: 'parallelogram',
      targetQuadrilateral: ['B', 'F', 'D', 'E'],
      knownParallelograms: [['A', 'B', 'C', 'D']],
      figure: {
        viewBox: [0, 0, 500, 330],
        points: {
          A: { x: 120, y: 60,  label: [-8, -20] },
          B: { x: 40,  y: 290, label: [-18, 14] },
          C: { x: 380, y: 290, label: [16, 16] },
          D: { x: 460, y: 60,  label: [12, -18] },
          E: { x: 96,  y: 129, label: [-20, 0] },
          F: { x: 404, y: 221, label: [20, 0] },
        },
        lines: [['A', 'E', 'B'], ['D', 'F', 'C']],
        segments: ['AE', 'EB', 'BC', 'CF', 'FD', 'DA', 'BF', 'DE'],
        angles: ['EBF', 'FDE', 'BFD', 'DEB'],
        parallel: [],
      },
      reasons: [],
      evidence: [],
      proofSteps: [
        { id: 's1', type: 'theorem', rule: 'parallelogramOppositeSidesEqual', quad: 'ABCD', premiseLabel: '四角形ABCDは平行四辺形',
          lead: '四角形ABCDは平行四辺形だから、', items: ['AB', 'DC'], label: 'AB＝DC', short: '対辺の長さ', dependsOn: [],
          proofText: '平行四辺形の対辺は等しいから、' },
        { id: 's2', type: 'theorem', rule: 'segmentSubtraction', premise: ['AB', 'DC'], subtract: ['AE', 'FC'], premiseLabel: 'AB＝DC、AE＝FC',
          // 理由ではなく、EB・DF をほかの線分の長さで表す式を選ぶ（choices の先頭が正解）
          lead: 'AB＝DC、AE＝FC で、', choiceNote: 'EB と DF を、ほかの線分の長さで表すと？',
          choices: ['EB＝AB－AE、DF＝DC－FC', 'EB＝AB＋AE、DF＝DC＋FC', 'EB＝AE－AB、DF＝FC－DC'],
          items: ['EB', 'DF'], label: 'EB＝DF', short: '長さの差', dependsOn: ['s1'],
          proofText: '仮定より AE＝FC、また EB＝AB－AE、DF＝DC－FC だから、{s1}より、' },
      ],
      parallelogram: {
        intro: ['四角形BFDEにおいて'],
        reasons: ['given', 'parallelogramParallel', 'parallelogramSides', 'alternateConverse'],
        evidence: [
          { id: 'q1', items: ['EB', 'DF'], rel: 'parallel', reason: 'parallelogramParallel', label: 'EB∥DF', mark: 1,
            proofReason: '平行四辺形の対辺は平行だから（AB∥DC）' },
          { id: 'q2', items: ['EB', 'DF'], reason: 'proved', fromStep: 's2', label: 'EB＝DF', mark: 1 },
        ],
        condition: 'PP_PARALLEL_EQUAL_PAIR',
        alternatives: [],
        distractors: { equations: ['BF＝DE', 'AE＝EB', 'BF∥DE'], reasons: [] },
      },
      puzzle: { type: 'build', distractors: { equations: [], reasons: [] } },
      hints: {
        q1: ppHints('辺EBは辺ABの一部、辺DFは辺DCの一部だね。ABとDCはどんな関係かな？', '平行四辺形の対辺は平行だから AB∥DC。だから EB∥DF だね。',
          '辺EBと辺DFを選んで「∥」にし、「平行四辺形の対辺は平行」を選ぼう！', ['EB', 'DF']),
        q2: ppHints('辺EBと辺DFの長さは等しいかな？', 'EB＝AB－AE、DF＝DC－FC だね。',
          '辺EBと辺DFを選んで「詳しい理由を説明する」を押そう！ 平行四辺形の性質と仮定を使うよ。', ['EB', 'DF']),
        s1: stepHints('四角形ABCDは平行四辺形だね。対辺の長さについて、どんな性質があったかな？', '平行四辺形の対辺は等しいね。', '「平行四辺形の対辺は等しい」を使おう！ AB＝DC だね。', []),
        s2: stepHints('AB＝DC と AE＝FC が分かっているね。', 'EB＝AB－AE、DF＝DC－FC。等しい長さから等しい長さをひくと？',
          'EB＝AB－AE、DF＝DC－FC だね。AB＝DC、AE＝FC だから、EB＝DF！', ['EB', 'DF']),
        pcondition: [
          { text: '集めた2つの根拠は、どちらも辺EBと辺DFについての関係だね。' },
          { text: 'EB∥DF で EB＝DF。同じ1組の対辺が、平行で長さも等しいね。' },
          { text: '「1組の対辺が平行で、その長さが等しい」を選ぼう！' },
        ],
      },
      explanation: '平行四辺形の対辺は等しいので AB＝DC、仮定より AE＝FC。EB＝AB－AE、DF＝DC－FC なので EB＝DF。また AB∥DC なので EB∥DF。1組の対辺が平行で、その長さが等しいので、四角形BFDEは平行四辺形です。',
      learningPoints: [
        '等しい線分から等しい線分をひいた残りは等しい。',
        '平行四辺形の対辺の一部どうしも平行である（EB∥DF）。',
        '1組の対辺が平行で、その長さが等しい四角形は平行四辺形である。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p42',
      number: '45',
      title: '合同から平行四辺形へ！',
      difficulty: 3,
      stage: 9,
      statement: '平行四辺形ABCDで、頂点B、Dから対角線ACに垂線BE、DFをひく。このとき、四角形BFDEは平行四辺形であることを証明しよう。',
      given: ['四角形ABCDは平行四辺形', 'BE⊥AC', 'DF⊥AC'],
      conclusion: '四角形BFDEは平行四辺形',
      conclusionType: 'parallelogram',
      targetQuadrilateral: ['B', 'F', 'D', 'E'],
      knownParallelograms: [['A', 'B', 'C', 'D']],
      // 平行四辺形の根拠を集める前に、△ABE≡△CDF（直角三角形の斜辺と1つの鋭角）から BE＝DF を導く
      triangles: [['A', 'B', 'E'], ['C', 'D', 'F']],
      figure: {
        viewBox: [0, 0, 500, 330],
        points: {
          A: { x: 120,    y: 60,     label: [-8, -20] },
          B: { x: 40,     y: 290,    label: [-18, 14] },
          C: { x: 380,    y: 290,    label: [16, 16] },
          D: { x: 460,    y: 60,     label: [12, -18] },
          E: { x: 189.26, y: 121.27, label: [6, -20] },
          F: { x: 310.74, y: 228.73, label: [-6, 26] },
        },
        lines: [['A', 'E', 'F', 'C']],
        segments: ['AB', 'BC', 'CD', 'DA', 'AE', 'EF', 'FC', 'BE', 'DF', 'BF', 'DE'],
        angles: ['AEB', 'CFD', 'BAE', 'DCF', 'BEF', 'DFE', 'ABE', 'CDF'],
        parallel: PARA_ARROWS,
        rightMarks: ['AEB', 'CFD'],
      },
      perpendicular: [{ a: 'BE', b: 'AC', label: 'BE⊥AC' }, { a: 'DF', b: 'AC', label: 'DF⊥AC' }],
      reasons: ['given', 'parallelogramSides', 'alternate', 'perpendicular', 'vertical'],
      evidence: [
        { id: 'e1', role: 'right', items: ['∠AEB', '∠CFD'], reason: 'perpendicular', label: '∠AEB＝∠CFD', mark: 'right' },
        { id: 'e2', items: ['AB', 'CD'], reason: 'parallelogramSides', label: 'AB＝CD', mark: 1 },
        { id: 'e3', items: ['∠BAE', '∠DCF'], reason: 'alternate', label: '∠BAE＝∠DCF', mark: 1,
          parallelGroup: 1, proofReason: 'AB∥DCより、平行線の錯角は等しいから' },
      ],
      extraTruths: [],
      congruence: 'RHA',
      finalStep: { relationType: 'side', items: ['BE', 'DF'], reason: 'correspondingSides', label: 'BE＝DF' },
      proof: { intro: '△ABEと△CDFにおいて' },
      parallelogram: {
        intro: [],
        reasons: ['given', 'correspondingSides', 'alternateConverse', 'parallelogramSides', 'parallelogramParallel', 'alternate'],
        evidence: [
          { id: 'q1', items: ['BE', 'DF'], reason: 'correspondingSides', fromFinal: true, label: 'BE＝DF', mark: 2 },
          { id: 'q2', items: ['BE', 'FD'], rel: 'parallel', reason: 'alternateConverse', via: ['∠BEF', '∠DFE'], label: 'BE∥FD', mark: 1,
            proofReason: '∠BEF＝∠DFE＝90°より、錯角が等しいから' },
        ],
        condition: 'PP_PARALLEL_EQUAL_PAIR',
        alternatives: [],
        distractors: { equations: ['BF＝DE', 'BF∥DE', 'BE＝EF'], reasons: [] },
      },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['AE＝BE', 'AB＝BE', '∠BAE＝∠ABE'],
          reasons: ['vertical'],
          triangles: ['ABE/CFD', 'ABE/DCF'],
          finals: ['∠BAE＝∠DCF', 'BE＝EF'],
        },
      },
      hints: {
        triangleSelection: [
          { text: '四角形BFDEが平行四辺形になるには、BE と DF について何が言えればよいかな？' },
          { text: '辺BEをふくむ三角形と、辺DFをふくむ三角形を見つけよう！', focus: ['BE', 'DF'] },
          { text: '△ABEと△CDFに注目しよう。対応する頂点は A↔C、B↔D、E↔F だよ。', focus: ['BE', 'DF'] },
        ],
        e1: rightHints('垂直な線に注目しよう！ BE⊥AC、DF⊥AC だね。', '垂直な2直線がつくる角だから', '∠AEB＝∠CFD', ['∠AEB', '∠CFD']),
        e2: hypHints('△ABEで直角∠AEBに向かい合う辺はAB、△CDFではCDだね。',
          'AB＝CD。平行四辺形の対辺は等しいから、斜辺どうしが等しいね！', ['AB', 'CD']),
        e3: stepHints('斜辺のほかに、等しい角はないかな？', 'AB∥DC だから、直線ACと交わってできる錯角に注目しよう！',
          '∠BAE＝∠DCF。平行線の錯角は等しいね！', ['∠BAE', '∠DCF']),
        congruence: rhaHints(),
        finalStep: finalHints(['BE', 'DF'], 'side'),
        q1: ppHints('合同から導いた関係を使おう！', 'BE と DF は、合同な三角形の対応する辺だね。', 'BE＝DF。合同な図形の対応する辺は等しいね！', ['BE', 'DF']),
        q2: ppHints('BE と FD は平行かな？ 直線ACと交わってできる角に注目しよう。', '∠BEF と ∠DFE は、どちらも90°の錯角だね。',
          '錯角が等しいから BE∥FD だね！ 辺BEと辺FDを選んで「∥」にし、「錯角が等しいから」を選ぼう。', ['∠BEF', '∠DFE']),
        pcondition: [
          { text: '集めた2つの根拠は、どちらも辺BEと辺FDについての関係だね。' },
          { text: 'BE＝DF で BE∥FD。同じ1組の対辺が、平行で長さも等しいね。' },
          { text: '「1組の対辺が平行で、その長さが等しい」を選ぼう！' },
        ],
      },
      explanation: 'BE⊥AC、DF⊥AC より ∠AEB＝∠CFD＝90°、平行四辺形の対辺は等しいので AB＝CD、AB∥DC より錯角 ∠BAE＝∠DCF。直角三角形の斜辺と1つの鋭角がそれぞれ等しいので △ABE≡△CDF、合同な図形の対応する辺は等しいので BE＝DF。また ∠BEF＝∠DFE＝90° で錯角が等しいので BE∥FD。1組の対辺が平行で、その長さが等しいので、四角形BFDEは平行四辺形です。',
      learningPoints: [
        '合同から導いた辺の等しさを、平行四辺形の根拠に使う。',
        '垂線がつくる直角どうしは錯角として等しいので、2直線は平行になる。',
        '1組の対辺が平行で、その長さが等しい四角形は平行四辺形である。',
      ],
    }
  );

  // ==================================================================
  // Ver.1.0 追加問題（STAGE 11「特別な平行四辺形」）
  //   p43 … ひし形と直角三角形の合同（RHA。ひし形の4辺・対角の性質）
  //   p44 … ひし形になることの証明（4つの辺がすべて等しい）
  //   p45 … 長方形になることの証明（隣り合う角の和 → 4つの角がすべて等しい）
  //   chain … 「4つの辺（角）がすべて等しい」の確認の表示（入力はさせない）
  //   choices … 成立条件の選択肢（4つの辺／4つの角／4つの辺と角がすべて等しい の3択）
  //   （はじめの Ver.1.0 の p45 角の二等分線・p47 中点と合同・p48 対角線と合同は、証明方法が複数あり複雑なので削除した）
  // ==================================================================
  // ひし形（1辺210、∠B＝64°）
  const RH = {
    A: { x: 132.06, y: 91.25, label: [-8, -20] },
    B: { x: 40,     y: 280,   label: [-18, 14] },
    C: { x: 250,    y: 280,   label: [12, 18] },
    D: { x: 342.06, y: 91.25, label: [12, -16] },
  };
  // 長方形（平行四辺形で、図は長方形に描く）
  const RE = {
    A: { x: 80,  y: 60,  label: [-16, -14] },
    B: { x: 80,  y: 250, label: [-16, 18] },
    C: { x: 400, y: 250, label: [14, 18] },
    D: { x: 400, y: 60,  label: [14, -14] },
  };
  function pts(base, extra) { return Object.assign({}, base, extra || {}); }

  PH.problems.push(
    // ------------------------------------------------------------------
    {
      id: 'p43',
      number: '46',
      title: 'ひし形と直角三角形の合同',
      difficulty: 2,
      stage: 10,
      statement: 'ひし形ABCDの頂点Aから、辺BC、CDにそれぞれ垂線AH、AKをひく。このとき、△ABH≡△ADK であることを証明しよう。',
      given: ['四角形ABCDはひし形', 'AH⊥BC', 'AK⊥CD'],
      conclusion: '△ABH≡△ADK',
      triangles: [['A', 'B', 'H'], ['A', 'D', 'K']],
      figure: {
        viewBox: [0, 0, 400, 320],
        points: pts(RH, {
          H: { x: 132.06, y: 280,    label: [2, 22] },
          K: { x: 301.7,  y: 173.99, label: [18, 8] },
        }),
        lines: [['B', 'H', 'C'], ['C', 'K', 'D']],
        segments: ['AB', 'BH', 'HC', 'CK', 'KD', 'DA', 'AH', 'AK'],
        angles: ['AHB', 'AKD', 'ABH', 'ADK', 'BAH', 'DAK'],
        parallel: [],
        rightMarks: ['AHB', 'AKD'],
      },
      perpendicular: [{ a: 'AH', b: 'BC', label: 'AH⊥BC' }, { a: 'AK', b: 'CD', label: 'AK⊥CD' }],
      reasons: ['given', 'rhombusSides', 'rhombusAngles', 'parallelogramAngles', 'perpendicular', 'vertical'],
      evidence: [
        { id: 'e1', role: 'right', items: ['∠AHB', '∠AKD'], reason: 'perpendicular', label: '∠AHB＝∠AKD', mark: 'right' },
        { id: 'e2', items: ['AB', 'AD'], reason: 'rhombusSides', label: 'AB＝AD', mark: 1 },
        // ひし形は平行四辺形なので「平行四辺形の対角は等しい」でもよい
        { id: 'e3', items: ['∠ABH', '∠ADK'], reason: 'rhombusAngles', alsoReasons: ['parallelogramAngles'], label: '∠ABH＝∠ADK', mark: 1 },
      ],
      extraTruths: [],
      congruence: 'RHA',
      proof: { intro: '△ABHと△ADKにおいて' },
      puzzle: { type: 'build', distractors: { equations: ['AB＝AH', '∠BAH＝∠ABH', 'BH＝HC'], reasons: ['vertical'] } },
      hints: {
        e1: [
          { text: '直角三角形に注目しよう！ AH⊥BC、AK⊥CD だね。' },
          { text: '垂直な線がつくる角 ∠AHB と ∠AKD に注目しよう。', focus: ['∠AHB', '∠AKD'] },
          { text: '垂直な2直線がつくる角だから、∠AHB＝∠AKD＝90° だね！', focus: ['∠AHB', '∠AKD'] },
        ],
        e2: [
          { text: '斜辺と、等しい鋭角を見つけよう！ まずは斜辺。斜辺は直角に向かい合う辺だよ。' },
          { text: '△ABHで直角∠AHBに向かい合う辺はAB、△ADKではADだね。', focus: ['AB', 'AD'] },
          { text: 'ひし形の辺の性質を使おう！ ひし形の4辺は等しいから AB＝AD だね！', focus: ['AB', 'AD'] },
        ],
        e3: [
          { text: '斜辺と、等しい鋭角を見つけよう！' },
          { text: '∠ABHと∠ADKは、ひし形ABCDの向かい合う角（対角）∠Bと∠Dだね。', focus: ['∠ABH', '∠ADK'] },
          { text: 'ひし形の対角の性質を使おう！ ひし形の対角は等しいから ∠ABH＝∠ADK だね！', focus: ['∠ABH', '∠ADK'] },
        ],
        congruence: rhaHints(),
      },
      explanation: 'AH⊥BC、AK⊥CD より ∠AHB＝∠AKD＝90°。ひし形の4辺は等しいので AB＝AD（斜辺）、ひし形の対角は等しいので ∠ABH＝∠ADK（鋭角）。直角三角形の斜辺と1つの鋭角がそれぞれ等しいので △ABH≡△ADK です。',
      learningPoints: [
        'ひし形の性質（4辺が等しい・対角が等しい）を、直角三角形の合同の根拠に使う。',
        '垂線から直角三角形を見つけ、斜辺と鋭角を確かめる。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p44',
      number: '47',
      title: '隣り合う2辺が等しい平行四辺形',
      difficulty: 1,
      stage: 10,
      statement: '四角形ABCDは平行四辺形である。AB＝AD のとき、四角形ABCDはひし形であることを証明しよう。',
      given: ['四角形ABCDは平行四辺形', 'AB＝AD'],
      conclusion: '四角形ABCDはひし形',
      conclusionType: 'rhombus',
      targetQuadrilateral: ['A', 'B', 'C', 'D'],
      knownParallelograms: [['A', 'B', 'C', 'D']],
      figure: {
        viewBox: [0, 0, 400, 320],
        points: pts(RH),
        lines: [],
        segments: ['AB', 'BC', 'CD', 'DA'],
        angles: ['DAB', 'ABC', 'BCD', 'CDA'],
        parallel: PARA_ARROWS,
      },
      reasons: [],
      evidence: [],
      parallelogram: {
        intro: ['平行四辺形ABCDにおいて'],
        reasons: ['given', 'parallelogramSides', 'parallelogramAngles', 'rhombusSides'],
        evidence: [
          { id: 'q1', items: ['AB', 'CD'], reason: 'parallelogramSides', label: 'AB＝CD', mark: 1 },
          { id: 'q2', items: ['AD', 'BC'], reason: 'parallelogramSides', label: 'AD＝BC', mark: 1 },
          { id: 'q3', items: ['AB', 'AD'], reason: 'given', label: 'AB＝AD', mark: 1 },
        ],
        condition: 'rhombusDefinition',
        alternatives: [],
        choices: ['rhombusDefinition', 'rectangleDefinition', 'squareDefinition'],
        chain: 'AB＝BC＝CD＝DA',
        distractors: { equations: ['AB＝BC', 'AC＝BD', '∠DAB＝∠ABC'], reasons: [] },
      },
      puzzle: { type: 'fill', distractors: { equations: [], reasons: [] } },
      hints: {
        q1: ppHints('平行四辺形の対辺にはどんな性質があるかな？', 'AB＝CD、AD＝BCを確認しよう！ まずは辺ABと辺CD。',
          'AB＝CD。平行四辺形の対辺は等しいね！', ['AB', 'CD']),
        q2: ppHints('平行四辺形の対辺にはどんな性質があるかな？', 'AB＝CD、AD＝BCを確認しよう！ 次は辺ADと辺BC。',
          'AD＝BC。平行四辺形の対辺は等しいね！', ['AD', 'BC']),
        q3: ppHints('仮定のAB＝ADと組み合わせて4辺の長さを比べよう！', '仮定に書かれている等しい辺はどれかな？ 辺ABと辺ADに注目しよう。',
          'AB＝AD。仮定より等しいね！', ['AB', 'AD']),
        pcondition: [
          { text: '仮定のAB＝ADと組み合わせて4辺の長さを比べよう！' },
          { text: 'AB＝CD、AD＝BC、AB＝AD から、AB＝BC＝CD＝DA だね。' },
          { text: '4つの辺がすべて等しいね。「4つの辺がすべて等しい」を選ぼう！' },
        ],
      },
      explanation: '平行四辺形の対辺は等しいので AB＝CD、AD＝BC。仮定より AB＝AD。これらから AB＝BC＝CD＝DA となり、4つの辺がすべて等しいので、四角形ABCDはひし形です。',
      learningPoints: [
        '平行四辺形の対辺の性質と仮定を組み合わせて、4つの辺の長さを比べる。',
        '4つの辺がすべて等しい四角形はひし形である（ひし形の定義）。',
        '「ひし形の4辺は等しい」は、ひし形だと分かってから使える性質であることに注意する。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p45',
      number: '48',
      title: '1つの直角から長方形へ',
      difficulty: 1,
      stage: 10,
      statement: '平行四辺形ABCDで、∠A＝90°である。このとき、四角形ABCDは長方形であることを証明しよう。',
      given: ['四角形ABCDは平行四辺形', '∠A＝90°'],
      conclusion: '四角形ABCDは長方形',
      conclusionType: 'rectangle',
      targetQuadrilateral: ['A', 'B', 'C', 'D'],
      knownParallelograms: [['A', 'B', 'C', 'D']],
      figure: {
        viewBox: [0, 0, 480, 310],
        points: pts(RE),
        lines: [],
        segments: ['AB', 'BC', 'CD', 'DA'],
        angles: ['DAB', 'ABC', 'BCD', 'CDA'],
        parallel: PARA_ARROWS,
        rightMarks: ['DAB'],
      },
      reasons: [],
      evidence: [],
      proofSteps: [
        { id: 's1', type: 'theorem', rule: 'parallelogramAdjacentSupplementary', quad: 'ABCD', premise: ['∠DAB', '∠ABC'],
          premiseLabel: '∠A＝90°',
          // 書き出しには理由（隣り合う角の和）を書かない（答えになるため）
          lead: '仮定より ∠A＝90° で、',
          items: ['∠DAB', '∠ABC'], label: '∠DAB＝∠ABC＝90°', short: '隣り合う角の和', dependsOn: [],
          proofText: '平行四辺形の隣り合う角の和は180°だから ∠A＋∠B＝180°。仮定より ∠A＝90° なので ∠B＝90°。よって、' },
      ],
      parallelogram: {
        intro: ['平行四辺形ABCDにおいて'],
        reasons: ['given', 'parallelogramAngles', 'parallelogramSides'],
        evidence: [
          { id: 'q1', items: ['∠DAB', '∠ABC'], reason: 'proved', fromStep: 's1', label: '∠DAB＝∠ABC', mark: 1 },
          { id: 'q2', items: ['∠DAB', '∠BCD'], reason: 'parallelogramAngles', label: '∠DAB＝∠BCD', mark: 1 },
          { id: 'q3', items: ['∠ABC', '∠CDA'], reason: 'parallelogramAngles', label: '∠ABC＝∠CDA', mark: 1 },
        ],
        condition: 'rectangleDefinition',
        alternatives: [],
        choices: ['rhombusDefinition', 'rectangleDefinition', 'squareDefinition'],
        chain: '∠A＝∠B＝∠C＝∠D＝90°',
        distractors: { equations: ['AB＝BC', 'AB＝AD', 'AD＝DC'], reasons: [] },
      },
      puzzle: { type: 'fill', distractors: { equations: [], reasons: [] } },
      hints: {
        q1: ppHints('平行四辺形の隣り合う角の和は？', '∠A＝90°なら、∠Bは何度かな？ ∠DABと∠ABCに注目しよう。',
          '∠DABと∠ABCを選んで「詳しい理由を説明する」を押そう！', ['∠DAB', '∠ABC']),
        q2: ppHints('さらに対角の等しさを使って、残りの角も求めよう！', '∠Aと∠Cは、平行四辺形の対角だね。',
          '∠DAB＝∠BCD。平行四辺形の対角は等しいね！', ['∠DAB', '∠BCD']),
        q3: ppHints('さらに対角の等しさを使って、残りの角も求めよう！', '∠Bと∠Dは、平行四辺形の対角だね。',
          '∠ABC＝∠CDA。平行四辺形の対角は等しいね！', ['∠ABC', '∠CDA']),
        s1: stepHints('平行四辺形の隣り合う角の和は？', '∠A＋∠B＝180°で ∠A＝90° だから、∠B＝180°－90°＝90°。',
          '「平行四辺形の隣り合う角の和は180°」を使おう！', ['∠DAB', '∠ABC']),
        pcondition: [
          { text: '集めた3つの根拠で、4つの角を比べよう！' },
          { text: '∠A＝∠B＝90°、∠A＝∠C、∠B＝∠D から、∠A＝∠B＝∠C＝∠D＝90° だね。' },
          { text: '4つの角がすべて等しいね。「4つの角がすべて等しい」を選ぼう！' },
        ],
      },
      explanation: '平行四辺形の隣り合う角の和は180°なので ∠A＋∠B＝180°。∠A＝90° なので ∠B＝90°。平行四辺形の対角は等しいので ∠C＝∠A＝90°、∠D＝∠B＝90°。4つの角がすべて等しい（すべて90°）ので、四角形ABCDは長方形です。',
      learningPoints: [
        '平行四辺形の隣り合う角の和は180°（∠A＝90° なら ∠B＝90°）。',
        '平行四辺形の対角の性質で、残りの角も90°と分かる。',
        '4つの角がすべて等しい四角形は長方形である（長方形の定義）。',
      ],
    }
  );


  // ==================================================================
  // Ver.1.0 追加問題（STAGE 11）：長方形・ひし形の対角線の性質を、三角形の合同で証明する
  //   合同を示せる三角形の組が複数あるので、使う三角形を問題文で指定する（三角形を選ぶ段階では、指定された組を選ぶ）
  //   p46 … 長方形の対角線は等しい（△ABC≡△DCB。2組の辺とその間の角）→ AC＝DB
  //   p47 … ひし形の対角線は垂直に交わる（△ABO≡△ADO。3組の辺）→ ∠AOB＝∠AOD → ∠AOB＋∠AOD＝180° だから 90° → AC⊥BD
  // ==================================================================
  PH.problems.push(
    // ------------------------------------------------------------------
    {
      id: 'p46',
      number: '49',
      rankKey: 'p46',          // 段位認定：p04 と合同の式（△ABC≡△DCB）が同じなので、ミニ問題をまとめないように区別する
      title: '長方形の対角線の長さ',
      difficulty: 2,
      stage: 10,
      statement: '長方形ABCDの対角線の長さが等しいこと（AC＝DB）を、△ABCと△DCBの合同を使って証明しよう。',
      given: ['四角形ABCDは長方形'],
      conclusion: 'AC＝DB',
      conclusionType: 'equalSide',
      triangles: [['A', 'B', 'C'], ['D', 'C', 'B']],
      figure: {
        viewBox: [0, 0, 480, 310],
        points: pts(RE),
        lines: [],
        segments: ['AB', 'BC', 'CD', 'DA', 'AC', 'BD'],
        angles: ['ABC', 'DCB', 'BAC', 'CDB', 'ACB', 'DBC'],
        parallel: PARA_ARROWS,
      },
      reasons: ['given', 'rectangleSides', 'rectangleAngles', 'parallelogramSides', 'vertical'],
      evidence: [
        // 長方形は平行四辺形なので「平行四辺形の対辺は等しい」でもよい
        { id: 'e1', items: ['AB', 'DC'], reason: 'rectangleSides', alsoReasons: ['parallelogramSides'], label: 'AB＝DC', mark: 1 },
        { id: 'e2', items: ['∠ABC', '∠DCB'], reason: 'rectangleAngles', label: '∠ABC＝∠DCB', mark: 1, proofReason: '長方形の角はすべて90°だから' },
        { id: 'e3', items: ['BC', 'CB'], reason: 'common', label: 'BC＝CB', mark: 2 },
      ],
      extraTruths: [],
      congruence: 'SAS',
      finalStep: { relationType: 'side', items: ['AC', 'DB'], reason: 'correspondingSides', label: 'AC＝DB' },
      proof: { intro: '長方形ABCDで、△ABCと△DCBにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['AB＝BC', '∠BAC＝∠ACB', 'AC＝BC'],
          reasons: ['vertical'],
          triangles: ['ABC/CDB', 'ABC/DBC'],
          finals: ['∠BAC＝∠CDB', 'AB＝DC'],
        },
      },
      hints: {
        triangleSelection: [
          { text: '問題文で指定された三角形を使おう！ △ABCと△DCBだよ。' },
          { text: '対角線ACは△ABCに、対角線DBは△DCBにふくまれているね。', focus: ['AC', 'BD'] },
          { text: '△ABCと△DCBを選ぼう。対応する頂点は A↔D、B↔C、C↔B だよ。', focus: ['AC', 'BD'] },
        ],
        e1: stepHints('長方形の辺にはどんな性質があるかな？', '辺ABと辺DCは、長方形の向かい合う辺（対辺）だね。', 'AB＝DC。長方形の対辺は等しいね！', ['AB', 'DC']),
        e2: stepHints('長方形の角にはどんな性質があるかな？', '∠ABCと∠DCBは、どちらも長方形の角だね。', '∠ABC＝∠DCB（どちらも90°）。長方形の4つの角は等しいね！', ['∠ABC', '∠DCB']),
        e3: stepHints('2つの三角形が共有している辺はないかな？', '辺BCは、両方の三角形の辺だね。', 'BC＝CB。共通な辺だね！ 辺BCを2回タップしよう。', ['BC']),
        congruence: sasHints('∠ABCと∠DCB', '辺ABと辺BC'),
        finalStep: finalHints(['AC', 'DB'], 'side'),
      },
      explanation: '△ABCと△DCBで、長方形の対辺は等しいので AB＝DC、長方形の角はすべて90°なので ∠ABC＝∠DCB、BCは共通。2組の辺とその間の角がそれぞれ等しいので △ABC≡△DCB。合同な図形の対応する辺は等しいので AC＝DB。長方形の対角線の長さは等しくなります。',
      learningPoints: [
        '長方形の性質（対辺が等しい・4つの角が90°）を、三角形の合同の根拠に使う。',
        '合同な図形の対応する辺から、長方形の対角線の長さが等しいことを示す。',
      ],
    },

    // ------------------------------------------------------------------
    {
      id: 'p47',
      number: '50',
      title: 'ひし形の対角線は垂直',
      difficulty: 3,
      stage: 10,
      statement: 'ひし形ABCDの対角線の交点をOとする。対角線が垂直に交わること（AC⊥BD）を、△ABOと△ADOの合同を使って証明しよう。',
      given: ['四角形ABCDはひし形', 'Oは対角線ACとBDの交点'],
      conclusion: 'AC⊥BD',
      conclusionType: 'perpendicular',
      triangles: [['A', 'B', 'O'], ['A', 'D', 'O']],
      figure: {
        viewBox: [0, 0, 400, 320],
        points: pts(RH, { O: { x: 191.03, y: 185.63, label: [16, 18] } }),
        lines: [['A', 'O', 'C'], ['B', 'O', 'D']],
        segments: ['AB', 'BC', 'CD', 'DA', 'AO', 'OC', 'BO', 'OD'],
        angles: ['AOB', 'AOD', 'BAO', 'DAO', 'ABO', 'ADO'],
        parallel: [],
      },
      reasons: ['given', 'rhombusSides', 'parallelogramDiagonals', 'parallelogramSides', 'vertical'],
      evidence: [
        { id: 'e1', items: ['AB', 'AD'], reason: 'rhombusSides', label: 'AB＝AD', mark: 1 },
        { id: 'e2', items: ['BO', 'DO'], reason: 'parallelogramDiagonals', label: 'BO＝DO', mark: 2,
          proofReason: 'ひし形は平行四辺形なので、対角線はそれぞれの中点で交わるから' },
        { id: 'e3', items: ['AO', 'AO'], reason: 'common', label: 'AO＝AO', mark: 3 },
      ],
      extraTruths: [],
      congruence: 'SSS',
      finalStep: { relationType: 'angle', items: ['∠AOB', '∠AOD'], reason: 'correspondingAngles', label: '∠AOB＝∠AOD' },
      proofSteps: [
        { id: 's1', type: 'theorem', stage: 'post', rule: 'linearPairRightAngle', premise: ['∠AOB', '∠AOD'], lines: ['AC', 'BD'],
          premiseLabel: '∠AOB＝∠AOD', lead: '∠AOB＝∠AOD で、',
          label: 'AC⊥BD', short: '90°を導く', dependsOn: ['final'],
          proofText: '∠AOB＋∠AOD＝180° だから、∠AOB＝∠AOD＝90°。よって、' },
      ],
      proof: { intro: 'ひし形ABCDで、△ABOと△ADOにおいて' },
      puzzle: {
        type: 'build',
        distractors: {
          equations: ['AB＝AO', '∠ABO＝∠BAO', 'AO＝BO'],
          reasons: ['vertical'],
          triangles: ['ABO/DAO', 'ABO/ODA'],
          finals: ['∠BAO＝∠DAO', 'AO＝BO'],
        },
      },
      hints: {
        triangleSelection: [
          { text: '問題文で指定された三角形を使おう！ △ABOと△ADOだよ。' },
          { text: '∠AOBは△ABOに、∠AODは△ADOにふくまれているね。', focus: ['∠AOB', '∠AOD'] },
          { text: '△ABOと△ADOを選ぼう。対応する頂点は A↔A、B↔D、O↔O だよ。', focus: ['∠AOB', '∠AOD'] },
        ],
        e1: stepHints('ひし形の辺にはどんな性質があるかな？', '辺ABと辺ADを比べよう。', 'AB＝AD。ひし形の4辺は等しいね！', ['AB', 'AD']),
        e2: stepHints('ひし形は平行四辺形でもあるね。対角線にはどんな性質があったかな？', 'BOとDOを比べよう。',
          'BO＝DO。平行四辺形の対角線はそれぞれの中点で交わるね！', ['BO', 'DO']),
        e3: stepHints('2つの三角形が共有している辺はないかな？', '辺AOは、両方の三角形の辺だね。', 'AO＝AO。共通な辺だね！ 辺AOを2回タップしよう。', ['AO']),
        congruence: sssHints(),
        finalStep: finalHints(['∠AOB', '∠AOD'], 'angle'),
        s1: stepHints('∠AOBと∠AODを合わせると、何度かな？', '∠AOB＋∠AOD＝180°（一直線）で、∠AOB＝∠AOD だね。',
          '∠AOB＝∠AOD＝90° だから、AC⊥BD！', ['∠AOB', '∠AOD']),
      },
      explanation: '△ABOと△ADOで、ひし形の4辺は等しいので AB＝AD、ひし形は平行四辺形なので対角線はそれぞれの中点で交わり BO＝DO、AOは共通。3組の辺がそれぞれ等しいので △ABO≡△ADO、合同な図形の対応する角は等しいので ∠AOB＝∠AOD。∠AOB＋∠AOD＝180° なので ∠AOB＝90°。よって AC⊥BD。ひし形の対角線は垂直に交わります。',
      learningPoints: [
        'ひし形の性質（4辺が等しい）と、平行四辺形の対角線の性質を合同の根拠に使う。',
        '一直線をつくる2つの角が等しければ、どちらも90°（2直線は垂直）。',
      ],
    }
  );

  // ステージ順に並べる（同じステージ内は上に書いた順。sort は安定ソート）
  PH.problems.sort(function (a, b) { return a.stage - b.stage; });

  PH.getStage = function (id) {
    return PH.STAGES.find(function (s) { return s.id === Number(id); }) || null;
  };

  PH.stageProblems = function (stageId) {
    return PH.problems.filter(function (p) { return p.stage === Number(stageId); });
  };

  PH.getProblem = function (id) {
    return PH.problems.find(function (p) { return p.id === id; }) || null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH;
})(typeof window !== 'undefined' ? window : globalThis);
