/*
 * error-hunt-data.js — 「証明の間違い探し」（Ver.1.1）の30問
 *
 * 証明文はここには書かない。元の問題（source）の正しい証明を js/error-hunt-generator.js が作り、
 * mutation が指す1つのステップだけを間違いに変える。図・仮定・結論も元の問題のものを使う。
 *   id        … 安定した問題ID（記録・URL #/error/play/<id>）
 *   no        … 生徒に見せる番号（01〜30）
 *   unit      … 単元（basic / conclusion / triangle / quadrilateral）
 *   category  … 誤りの種類（PH.errorHunt.CATEGORIES）
 *   mutation  … どのステップを、どう間違えるか（js/error-hunt-generator.js の説明）
 *   explain   … なぜ間違いか（正解後の解説）。hint を書くと、誤りの種類のヒントの代わりに使う
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  PH.ERROR_HUNT_PROBLEMS = [
    // ---- 基本の合同証明（12問） ----
    { id: 'eh-p01-cong', no: '01', unit: 'basic', source: 'p01', category: 'wrongCongruence', difficulty: 1,
      mutation: { target: 'condition', field: 'condition', condition: 'SAS' },
      explain: 'AB＝CB、AD＝CD、BD＝BD は、どれも辺の等しさだね。3組の辺がそれぞれ等しいので、合同条件は「3組の辺がそれぞれ等しい」だよ。等しい角は1つも使っていないね。' },
    { id: 'eh-p04-eq', no: '02', unit: 'basic', source: 'p04', category: 'wrongEquation', difficulty: 1,
      mutation: { target: 'e1', field: 'body', items: ['AB', 'AC'] },
      explain: '仮定で等しいと言えるのは AB と DC だよ。AB と AC が等しいとは限らないね。正しくは「仮定より AB＝DC」。' },
    { id: 'eh-p06-corr', no: '03', unit: 'basic', source: 'p06', category: 'wrongCorrespondence', difficulty: 1,
      mutation: { target: 'conclusion', field: 'body', triangles: ['ABC', 'ACD'] },
      explain: 'AB＝AD より B と D、共通な辺 AC より C と C が対応するね。だから △ABC≡△ADC と書くよ。△ACD だと B と C が対応してしまうね。' },
    { id: 'eh-p07-reason', no: '04', unit: 'basic', source: 'p07', category: 'wrongReason', difficulty: 1,
      mutation: { target: 'e3', field: 'reason', reason: 'vertical' },
      explain: '∠BAC と ∠FDE は、はなれた2つの三角形の角で、対頂角ではないよ。この2つの角が等しいことは仮定に書いてあるね。正しくは「仮定より」。' },
    { id: 'eh-p11-order', no: '05', unit: 'basic', source: 'p11', category: 'wrongLogicalOrder', difficulty: 1,
      mutation: { target: 'e1', field: 'reason', reason: 'correspondingAngles' },
      explain: '「合同な図形の対応する角は等しい」は、△ABC≡△ADC を証明したあとでしか使えないよ。ここではまだ合同を示していないね。∠BAC＝∠DAC は仮定から言えるよ。' },
    { id: 'eh-p12-eq', no: '06', unit: 'basic', source: 'p12', category: 'wrongEquation', difficulty: 1,
      mutation: { target: 'e2', field: 'body', items: ['BM', 'AM'] },
      explain: 'M は辺 BC の中点だから、等しいのは BM と CM だよ。AM が BM と等しいとは限らないね。正しくは「BM＝CM」。' },
    { id: 'eh-p02-reason', no: '07', unit: 'basic', source: 'p02', category: 'wrongReason', difficulty: 1,
      mutation: { target: 'e3', field: 'reason', reason: 'alternate' },
      explain: '∠AOC と ∠BOD は、2本の直線 AB と CD が交わってできる、向かい合った角（対頂角）だよ。平行線もないので、錯角ではないね。' },
    { id: 'eh-p05-cong', no: '08', unit: 'basic', source: 'p05', category: 'wrongCongruence', difficulty: 1,
      mutation: { target: 'condition', field: 'condition', condition: 'ASA' },
      explain: 'AO＝DO、BO＝CO の2組の辺と、その間の角 ∠AOB＝∠DOC が等しいね。だから合同条件は「2組の辺とその間の角がそれぞれ等しい」だよ。' },
    { id: 'eh-p09-corr', no: '09', unit: 'basic', source: 'p09', category: 'wrongCorrespondence', difficulty: 1,
      mutation: { target: 'conclusion', field: 'body', triangles: ['ABO', 'DOC'] },
      explain: 'AO＝DO と ∠OAB＝∠ODC より A と D、対頂角 ∠AOB＝∠DOC より O と O、B と C が対応するね。だから △ABO≡△DCO。△DOC だと B と O が対応してしまうよ。' },
    { id: 'eh-p03-reason', no: '10', unit: 'basic', source: 'p03', category: 'wrongReason', difficulty: 1,
      mutation: { target: 'e2', field: 'reason', reason: 'corresponding' },
      explain: '∠BAO と ∠DCO は、平行線 AB、CD を直線 AC が横切ってできる、反対側の角だから錯角だよ。同位角ではないね。' },
    { id: 'eh-p10-cong', no: '11', unit: 'basic', source: 'p10', category: 'wrongCongruence', difficulty: 1,
      mutation: { target: 'condition', field: 'condition', condition: 'SAS' },
      explain: 'BC＝CE の1組の辺と、その両端の角 ∠ABC＝∠DCE、∠ACB＝∠DEC が等しいね。合同条件は「1組の辺とその両端の角がそれぞれ等しい」だよ。' },
    { id: 'eh-p13-order', no: '12', unit: 'basic', source: 'p13', category: 'wrongLogicalOrder', difficulty: 2,
      mutation: { target: 'e3', field: 'reason', reason: 'correspondingSides' },
      explain: 'AC＝CA は、2つの三角形が共有している辺だから「共通な辺だから」言えるよ。「合同な図形の対応する辺は等しい」は、△ABC≡△CDA を証明したあとでしか使えないね。' },

    // ---- 合同から結論を導く（5問） ----
    { id: 'eh-p16-reason', no: '13', unit: 'conclusion', source: 'p16', category: 'wrongReason', difficulty: 2,
      mutation: { target: 'final', field: 'reason', reason: 'correspondingSides' },
      explain: '結論の ∠BAD＝∠BCD は角の等しさだから、理由は「合同な図形の対応する角は等しいから」だよ。対応する辺ではないね。' },
    { id: 'eh-p17-eq', no: '14', unit: 'conclusion', source: 'p17', category: 'wrongEquation', difficulty: 2,
      mutation: { target: 'final', field: 'body', items: ['AC', 'BO'] },
      explain: '△AOC≡△BOD で、A と B、C と D が対応するので、辺 AC に対応するのは辺 BD だよ。BO ではないね。正しくは「AC＝BD」。' },
    { id: 'eh-p18-corr', no: '15', unit: 'conclusion', source: 'p18', category: 'wrongCorrespondence', difficulty: 2,
      mutation: { target: 'conclusion', field: 'body', triangles: ['ABO', 'DCO'] },
      explain: '錯角 ∠BAO＝∠DCO より A と C、∠ABO＝∠CDO より B と D が対応するね。だから △ABO≡△CDO。△DCO だと A と D が対応してしまうよ。' },
    { id: 'eh-p48-cong', no: '16', unit: 'conclusion', source: 'p48', category: 'wrongCongruence', difficulty: 2,
      mutation: { target: 'condition', field: 'condition', condition: 'SAS' },
      explain: 'OQ＝OR、PQ＝PR、OP＝OP は、どれも辺の等しさだね。3組の辺がそれぞれ等しいので、合同条件は「3組の辺がそれぞれ等しい」だよ。' },
    { id: 'eh-p35-theorem', no: '17', unit: 'conclusion', source: 'p35', category: 'wrongTheorem', difficulty: 2,
      mutation: { target: 'post:s1', field: 'reason', rule: 'parallelAlternateAngles' },
      explain: '「平行線の錯角は等しい」は、平行だと分かっているときに、角が等しいと言える性質だよ。ここは逆に、錯角が等しいことから平行を導くので、「錯角が等しいから（2直線は平行）」を使うよ。' },

    // ---- 三角形の性質・直角三角形（6問） ----
    { id: 'eh-p21-theorem', no: '18', unit: 'triangle', source: 'p21', category: 'wrongTheorem', difficulty: 3,
      mutation: { target: 's:s1', field: 'reason', rule: 'isoscelesConverse' },
      explain: 'AB＝AC（辺）から ∠ABC＝∠ACB（角）を導くので、使うのは「二等辺三角形の底角は等しい」だよ。「2つの角が等しい三角形は二等辺三角形」は、その逆（角から辺）だね。' },
    { id: 'eh-p22-corr', no: '19', unit: 'triangle', source: 'p22', category: 'wrongCorrespondence', difficulty: 2,
      mutation: { target: 'conclusion', field: 'body', triangles: ['MBC', 'NBC'] },
      explain: 'BM＝CN より M と N、∠ABC＝∠ACB より B と C が対応するね。だから △MBC≡△NCB。△NBC だと B と B、C と C が対応してしまうよ。' },
    { id: 'eh-p23-eq', no: '20', unit: 'triangle', source: 'p23', category: 'wrongEquation', difficulty: 3,
      mutation: { target: 's:s1', field: 'body', value: '∠ACD＋90°' },
      explain: '△DCE は正三角形だから、∠DCE＝60° だよ。だから ∠ACE＝∠ACD＋60° になるね。90° ではないよ。' },
    { id: 'eh-p24-order', no: '21', unit: 'triangle', source: 'p24', category: 'wrongLogicalOrder', difficulty: 2,
      mutation: { target: 'e2', field: 'reason', reason: 'correspondingSides' },
      explain: '△ADE は正三角形だから、AD＝AE は「正三角形の3辺は等しいから」言えるよ。合同な図形の性質は、△ABD≡△ACE を示したあとでしか使えないね。' },
    { id: 'eh-p25-cong', no: '22', unit: 'triangle', source: 'p25', category: 'wrongCongruence', difficulty: 2,
      mutation: { target: 'condition', field: 'condition', condition: 'RHA' },
      explain: '直角のほかに、斜辺 BD＝BD と他の1辺 AB＝CB が等しいね。だから「直角三角形の斜辺と他の1辺がそれぞれ等しい」だよ。等しい鋭角は使っていないね。' },
    { id: 'eh-p29-reason', no: '23', unit: 'triangle', source: 'p29', category: 'wrongReason', difficulty: 2,
      mutation: { target: 'e3', field: 'reason', reason: 'vertical' },
      explain: '∠POQ と ∠POR は、点 O でとなり合う角で、対頂角ではないよ。この2つが等しいことは仮定に書いてあるね。正しくは「仮定より」。' },

    // ---- 平行四辺形・特別な平行四辺形（7問） ----
    { id: 'eh-p31-theorem', no: '24', unit: 'quadrilateral', source: 'p31', category: 'wrongTheorem', difficulty: 2,
      mutation: { target: 'q-condition', field: 'condition', condition: 'PP_PARALLEL_PAIRS' },
      explain: '①、②は AB＝DC、AD＝BC で、向かい合う辺の長さが等しいことだね。使える条件は「2組の対辺がそれぞれ等しい」だよ。平行は示していないね。' },
    { id: 'eh-p33-eq', no: '25', unit: 'quadrilateral', source: 'p33', category: 'wrongEquation', difficulty: 2,
      mutation: { target: 'q:q2', field: 'body', items: ['AO', 'BO'] },
      explain: '仮定で等しいのは BO と DO だよ。AO と BO が等しいとは限らないね。正しくは「BO＝DO」。' },
    { id: 'eh-p44-order', no: '26', unit: 'quadrilateral', source: 'p44', category: 'wrongLogicalOrder', difficulty: 2,
      mutation: { target: 'q:q1', field: 'reason', reason: 'rhombusSides' },
      explain: '「ひし形の4辺は等しい」は、四角形ABCDがひし形だと証明できてから使える性質だよ。いまはそれを証明しているところだね。AB＝CD は「平行四辺形の対辺は等しいから」言えるよ。' },
    { id: 'eh-p41-theorem', no: '27', unit: 'quadrilateral', source: 'p41', category: 'wrongTheorem', difficulty: 3,
      mutation: { target: 'q-condition', field: 'condition', text: '1組の対辺が平行で、もう1組の対辺が等しい' },
      explain: '「1組の対辺が平行で、もう1組の対辺が等しい」は、平行四辺形になるための条件ではないよ（台形のこともある）。①、③は同じ組の対辺 EB、DF の関係だから、「1組の対辺が平行で、その長さが等しい」だよ。' },
    { id: 'eh-p37-reason', no: '28', unit: 'quadrilateral', source: 'p37', category: 'wrongReason', difficulty: 2,
      mutation: { target: 'e2', field: 'reason', reason: 'parallelogramDiagonals' },
      explain: 'AB と CD は平行四辺形の向かい合う辺（対辺）だよ。対角線ではないので、理由は「平行四辺形の対辺は等しいから」だね。' },
    { id: 'eh-p45-order', no: '29', unit: 'quadrilateral', source: 'p45', category: 'wrongLogicalOrder', difficulty: 2,
      mutation: { target: 'q:q2', field: 'reason', reason: 'rectangleAngles' },
      explain: '「長方形の角はすべて90°」は、四角形ABCDが長方形だと証明できてから使える性質だよ。いまは長方形であることを証明しているところだね。∠DAB＝∠BCD は「平行四辺形の対角は等しいから」言えるよ。' },
    { id: 'eh-p39-corr', no: '30', unit: 'quadrilateral', source: 'p39', category: 'wrongCorrespondence', difficulty: 2,
      mutation: { target: 'conclusion', field: 'body', triangles: ['AOM', 'CNO'] },
      explain: 'AO＝CO より A と C、対頂角 ∠AOM＝∠CON より O と O が対応するね。だから △AOM≡△CON と書くよ。△CNO だと O と N が対応してしまうよ。' },
  ];
})(typeof window !== 'undefined' ? window : globalThis);
