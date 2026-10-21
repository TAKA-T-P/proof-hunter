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
    common:        { label: '共通な辺だから',         short: '共通な辺', proof: '共通な辺だから' },
    commonAngle:   { label: '共通な角だから',         short: '共通な角', proof: '共通な角だから' },
    vertical:      { label: '対頂角だから',           short: '対頂角',   proof: '対頂角は等しいから' },
    alternate:     { label: '平行線の錯角だから',     short: '錯角',     proof: '平行線の錯角は等しいから' },
    corresponding: { label: '平行線の同位角だから',   short: '同位角',   proof: '平行線の同位角は等しいから' },
  };

  // 三角形の合同条件（中学数学の標準的な表現）
  PH.CONDITIONS = {
    SSS: { label: '3組の辺がそれぞれ等しい' },
    SAS: { label: '2組の辺とその間の角がそれぞれ等しい' },
    ASA: { label: '1組の辺とその両端の角がそれぞれ等しい' },
  };
  PH.CONDITION_ORDER = ['SSS', 'SAS', 'ASA'];

  PH.problems = [
    // ------------------------------------------------------------------
    {
      id: 'p01',
      number: '01',
      title: '共通な辺を見つけろ！',
      difficulty: 1,
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
      learningPoints: [
        '平行線の錯角を見つける。',
        '1組の辺とその両端の角という合同条件を理解する。',
      ],
    },
  ];

  PH.getProblem = function (id) {
    return PH.problems.find(function (p) { return p.id === id; }) || null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH;
})(typeof window !== 'undefined' ? window : globalThis);
