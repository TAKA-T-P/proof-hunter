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
  };

  // 結論の種類（Ver.0.5）。conclusionType がない問題は三角形の合同
  PH.CONCLUSION_TYPES = ['triangleCongruence', 'equalSide', 'equalAngle', 'isoscelesTriangle'];
  PH.conclusionType = function (p) { return p.conclusionType || 'triangleCongruence'; };
  // 合同を示したあと、対応する辺・角の等しさを導く問題か（三角形選択・最終結論のステップがある）
  PH.hasFinalStep = function (p) { return PH.conclusionType(p) !== 'triangleCongruence' && !!p.finalStep; };
  // 途中で示す（または結論の）三角形の合同の表記 '△ABD≡△CBD'
  PH.congruenceText = function (p) { return '△' + p.triangles[0].join('') + '≡△' + p.triangles[1].join(''); };
  // 最終結論の理由（辺なら対応する辺、角なら対応する角）
  PH.finalReasonFor = function (p) { return p.finalStep.relationType === 'angle' ? 'correspondingAngles' : 'correspondingSides'; };

  // 三角形の合同条件（中学数学の標準的な表現）
  PH.CONDITIONS = {
    SSS: { label: '3組の辺がそれぞれ等しい' },
    SAS: { label: '2組の辺とその間の角がそれぞれ等しい' },
    ASA: { label: '1組の辺とその両端の角がそれぞれ等しい' },
  };
  PH.CONDITION_ORDER = ['SSS', 'SAS', 'ASA'];

  // ステージ（問題の stage で参照）
  PH.STAGES = [
    { id: 1, title: 'はじめての証明',     theme: '仮定・共通な辺を使って証明しよう！' },
    { id: 2, title: '対頂角を見つけろ！', theme: '対頂角と、辺・角の組み合わせを見抜こう！' },
    { id: 3, title: '平行線を使いこなせ！', theme: '平行線の錯角・同位角を見つけよう！' },
    { id: 4, title: '合同条件を見極めろ！', theme: '3つの合同条件を使い分けよう！' },
    { id: 5, title: '証明マスターへの道', theme: 'いろいろな根拠を組み合わせよう！' },
    { id: 6, title: '合同から結論を導け！', theme: 'どの三角形を合同にする？ 合同から辺・角の等しさを証明しよう！' },
    { id: 7, title: '証明をつなげろ！', theme: '新しい根拠を導き、それを使って証明を完成させよう！' },
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
      number: '02',
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
      number: '03',
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
      number: '04',
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
      number: '06',
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
      number: '05',
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
      number: '08',
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
      number: '10',
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
      number: '07',
      title: '離れた三角形の対応を見抜け！',
      difficulty: 2,
      stage: 4,
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
      number: '11',
      title: '共通な辺と両端の角',
      difficulty: 2,
      stage: 4,
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
      number: '12',
      title: '中点と3組の辺',
      difficulty: 2,
      stage: 4,
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
      stage: 5,
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
      stage: 5,
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
      stage: 5,
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
      stage: 6,
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
      stage: 6,
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
      stage: 6,
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
      stage: 6,
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
      stage: 6,
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
      number: '21',
      title: '二等辺三角形の底角を使おう！',
      difficulty: 2,
      stage: 7,
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
        e3: stepHints('さっき導いた角の等しさを、根拠に使おう。', '∠ABDと∠ACEに注目しよう！', '∠ABD＝∠ACE。底角が等しいことから導いたね！', ['∠ABD', '∠ACE']),
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
      number: '22',
      title: '二等辺三角形になることを証明！',
      difficulty: 3,
      stage: 7,
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
        e3: stepHints('さっき導いた角の等しさを、根拠に使おう。', '∠MBCと∠NCBに注目しよう！', '∠MBC＝∠NCB。底角が等しいことから導いたね！', ['∠MBC', '∠NCB']),
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
    {
      id: 'p23',
      number: '23',
      title: '正三角形の60°を使おう！',
      difficulty: 3,
      stage: 7,
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
          '2つの角を合わせた角だから「角の和」を使おう！', ['∠ACD', '∠DCE']),
        s2: stepHints('∠BCDは、どの2つの角に分けられるかな？', '∠BCD＝∠BCA＋∠ACD。∠BCAは正三角形の角だね。',
          '2つの角を合わせた角だから「角の和」を使おう！', ['∠BCA', '∠ACD']),
        s3: stepHints('2つの式を見比べてみよう。', '右辺に共通する部分はないかな？', '2つの式の右辺は同じだから、左辺どうしが等しいね！', ['∠ACE', '∠BCD']),
        e1: stepHints('正三角形の性質を使おう。', '△ABCの辺ACと辺BCに注目しよう！', 'AC＝BC。正三角形の3辺は等しいね！', ['AC', 'BC']),
        e2: stepHints('もう1つの正三角形にも注目しよう。', '△DCEの辺CEと辺CDに注目しよう！', 'CE＝CD。正三角形の3辺は等しいね！', ['CE', 'CD']),
        e3: stepHints('式を比べて導いた角の等しさを使おう。', '∠ACEと∠BCDに注目しよう！', '∠ACE＝∠BCD。2つの式を比べて導いたね！', ['∠ACE', '∠BCD']),
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
      number: '24',
      title: '三段論法で合同を証明！',
      difficulty: 3,
      stage: 7,
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
          '大きい角から小さい角を引いた角だから「角の差」を使おう！', ['∠BAC', '∠DAC']),
        s2: stepHints('∠CAEは、どんな角の差で表せるかな？', '∠CAE＝∠DAE－∠DAC。∠DAEは正三角形の角だね。',
          '大きい角から小さい角を引いた角だから「角の差」を使おう！', ['∠DAE', '∠DAC']),
        s3: stepHints('2つの式を見比べてみよう。', '右辺に共通する部分はないかな？', '2つの式の右辺は同じだから、左辺どうしが等しいね！', ['∠BAD', '∠CAE']),
        e1: stepHints('正三角形の性質を使おう。', '△ABCの辺ABと辺ACに注目しよう！', 'AB＝AC。正三角形の3辺は等しいね！', ['AB', 'AC']),
        e2: stepHints('もう1つの正三角形にも注目しよう。', '△ADEの辺ADと辺AEに注目しよう！', 'AD＝AE。正三角形の3辺は等しいね！', ['AD', 'AE']),
        e3: stepHints('式を比べて導いた角の等しさを使おう。', '∠BADと∠CAEに注目しよう！', '∠BAD＝∠CAE。2つの式を比べて導いたね！', ['∠BAD', '∠CAE']),
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
