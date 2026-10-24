/*
 * error-hunt-variants.js — 「証明の間違い探し」の誤りバリエーション（Ver.1.2。DOM非依存）
 *
 * 同じ証明でも、毎回ちがう場所・種類の間違いを出す。証明全文はコピーして持たない。
 * Ver.1.1 の30問（js/error-hunt-data.js）を「ベース問題」とし、その mutation を最初のバリエーション 'original' として扱う
 * （問題ID・★評価の記録はベース問題単位のまま）。ここには、追加のバリエーション（どのステップを、どう間違えるか）と解説だけを書く。
 *   variantId      … ベース問題の中で安定したID（'<ステップ>-<種類>'）。記録・振り返りに使う
 *   category       … 誤りの種類（PH.errorHunt.CATEGORIES）
 *   mutation       … js/error-hunt-generator.js と同じ形
 *   requiredTopics … （省略可）間違いを見抜くのに、元の問題以外に必要な知識
 *   explain        … なぜ間違いか（振り返り・正解画面の解説）
 *
 * 出題できるコース（基本の合同証明 basic / 総合証明 comprehensive）は、ステージ番号ではなく必要な知識（topics）で決める。
 *   必要な知識 ＝ 元の問題の topics（PH.rankTracks.problemTopics）
 *              ∪ 間違いに使った理由・合同条件・推論ルール・成立条件の topics（自動）∪ バリエーションの requiredTopics
 *   コースの allowedTopics（js/rank-tracks.js。段位認定と同じ）にすべてふくまれるときだけ、そのコースで出題する。
 *
 *   PH.errorVariants.list(baseId)           … ベース問題のバリエーション（'original' が最初）
 *   PH.errorVariants.def(baseId, variantId) … 1つのバリエーションの問題データ（ErrorHuntGame・build・verify にそのまま渡せる）
 *   PH.errorVariants.topics(def)            … 必要な知識
 *   PH.errorVariants.courses(def)           … 出題できるコース ['basic', 'comprehensive']
 *   PH.errorVariants.all()                  … すべてのバリエーション（開発者用の確認画面・テスト）
 *   PH.errorVariants.practice(baseId)       … じっくり練習で開くバリエーション（直前と同じものは避ける）
 *   PH.errorVariants.verifyAll()            … すべてのバリエーションの検証（空なら正しい）
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  PH.ERROR_HUNT_VARIANTS = {
    // ---- 基本の合同証明 ----
    'eh-p01-cong': [
      { variantId: 'e1-reason', category: 'wrongReason', mutation: { target: 'e1', field: 'reason', reason: 'common' },
        explain: 'AB と CB は、△ABD と △CBD が共有している辺ではなく、別々の辺だよ。AB＝CB は仮定に書いてあるので、正しくは「仮定より AB＝CB」。' },
      { variantId: 'e2-eq', category: 'wrongEquation', mutation: { target: 'e2', field: 'body', items: ['AD', 'AB'] },
        explain: '仮定で等しいと言えるのは AD と CD だよ。AD と AB が等しいとは限らないね。正しくは「仮定より AD＝CD」。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABD', 'CDB'] },
        explain: 'AB＝CB、AD＝CD より A と C、共通な辺 BD より B と B、D と D が対応するね。だから △ABD≡△CBD。△CDB だと B と D が入れかわってしまうよ。' },
    ],
    'eh-p04-eq': [
      { variantId: 'e3-reason', category: 'wrongReason', mutation: { target: 'e3', field: 'reason', reason: 'given' },
        explain: 'BC＝CB は仮定には書いていないよ。BC は △ABC と △DCB が共有している辺だから、正しくは「共通な辺だから BC＝CB」。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'ASA' },
        explain: 'AB＝DC、AC＝DB、BC＝CB は、どれも辺の等しさだね。3組の辺がそれぞれ等しいので、合同条件は「3組の辺がそれぞれ等しい」だよ。角は1つも使っていないね。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABC', 'DBC'] },
        explain: 'AB＝DC、AC＝DB より、A と D、B と C、C と B が対応するね。だから △ABC≡△DCB と書くよ。△DBC だと B と B、C と C が対応してしまうね。' },
    ],
    'eh-p06-corr': [
      { variantId: 'e2-reason', category: 'wrongReason', mutation: { target: 'e2', field: 'reason', reason: 'vertical' },
        explain: '∠BAC と ∠DAC は、点 A でとなり合う角で、対頂角ではないよ。この2つの角が等しいことは仮定に書いてあるね。正しくは「仮定より」。' },
      { variantId: 'e3-eq', category: 'wrongEquation', mutation: { target: 'e3', field: 'body', items: ['AC', 'BC'] },
        explain: '2つの三角形が共有している辺は AC だけだよ。AC と BC が等しいとは限らないね。正しくは「共通な辺だから AC＝AC」。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'SSS' },
        explain: '② ∠BAC＝∠DAC は角の等しさだね。AB と AC の2組の辺と、その間の角 ∠BAC＝∠DAC が等しいので、合同条件は「2組の辺とその間の角がそれぞれ等しい」だよ。' },
    ],
    'eh-p07-reason': [
      { variantId: 'e1-eq', category: 'wrongEquation', mutation: { target: 'e1', field: 'body', items: ['AB', 'DE'] },
        explain: '仮定で等しいのは AB と DF だよ。AB と DE が等しいとは書いていないね（仮定では AC＝DE）。正しくは「仮定より AB＝DF」。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'ASA' },
        explain: '等しい辺は AB＝DF、AC＝DE の2組、等しい角は ∠BAC＝∠FDE の1組だね。角はその2辺の間の角なので、合同条件は「2組の辺とその間の角がそれぞれ等しい」だよ。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABC', 'DEF'] },
        explain: 'AB＝DF より B と F、AC＝DE より C と E が対応するね。だから △ABC≡△DFE。△DEF だと B と E、C と F が対応してしまうよ。' },
    ],
    'eh-p11-order': [
      { variantId: 'e2-reason', category: 'wrongReason', mutation: { target: 'e2', field: 'reason', reason: 'vertical' },
        explain: '∠BCA と ∠DCA は、点 C でとなり合う角で、対頂角ではないよ。この2つの角が等しいことは仮定に書いてあるね。正しくは「仮定より」。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'SAS' },
        explain: '①、②は角、③は辺の等しさだね。等しい辺 AC の両端の角 ∠BAC＝∠DAC、∠BCA＝∠DCA が等しいので、合同条件は「1組の辺とその両端の角がそれぞれ等しい」だよ。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABC', 'CDA'] },
        explain: '∠BAC＝∠DAC より A と A、∠BCA＝∠DCA より C と C、残りの B と D が対応するね。だから △ABC≡△ADC。△CDA だと A と C が入れかわってしまうよ。' },
    ],
    'eh-p12-eq': [
      { variantId: 'e1-reason', category: 'wrongReason', mutation: { target: 'e1', field: 'reason', reason: 'common' },
        explain: 'AB と AC は別々の辺で、2つの三角形が共有している辺ではないよ。AB＝AC は仮定に書いてあるので、正しくは「仮定より AB＝AC」。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'SAS' },
        explain: 'AB＝AC、BM＝CM、AM＝AM は、どれも辺の等しさだね。3組の辺がそれぞれ等しいので、合同条件は「3組の辺がそれぞれ等しい」だよ。等しい角は使っていないね。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABM', 'AMC'] },
        explain: 'AB＝AC より B と C、BM＝CM と共通な辺 AM より M と M が対応するね。だから △ABM≡△ACM。△AMC だと B と M、M と C が対応してしまうよ。' },
    ],
    'eh-p02-reason': [
      { variantId: 'e1-eq', category: 'wrongEquation', mutation: { target: 'e1', field: 'body', items: ['AO', 'DO'] },
        explain: '仮定で等しいのは AO と BO だよ。AO と DO が等しいとは限らないね。正しくは「仮定より AO＝BO」。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'ASA' },
        explain: '等しい辺は AO＝BO、CO＝DO の2組で、等しい角は対頂角の1組だけだね。その角は2辺の間の角なので、合同条件は「2組の辺とその間の角がそれぞれ等しい」だよ。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['AOC', 'DOB'] },
        explain: 'AO＝BO より A と B、CO＝DO より C と D が対応するね。だから △AOC≡△BOD。△DOB だと A と D、C と B が対応してしまうよ。' },
    ],
    'eh-p05-cong': [
      { variantId: 'e3-reason', category: 'wrongReason', mutation: { target: 'e3', field: 'reason', reason: 'given' },
        explain: '∠AOB＝∠DOC は仮定には書いていないよ。2本の直線 AC と BD が交わってできる向かい合った角だから、正しくは「対頂角は等しいから」。' },
      { variantId: 'e2-eq', category: 'wrongEquation', mutation: { target: 'e2', field: 'body', items: ['BO', 'DO'] },
        explain: '仮定で等しいのは BO と CO だよ。BO と DO が等しいとは限らないね。正しくは「仮定より BO＝CO」。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABO', 'CDO'] },
        explain: 'AO＝DO より A と D、BO＝CO より B と C が対応するね。だから △ABO≡△DCO。△CDO だと A と C、B と D が対応してしまうよ。' },
    ],
    'eh-p09-corr': [
      { variantId: 'e3-reason', category: 'wrongReason', mutation: { target: 'e3', field: 'reason', reason: 'alternate' },
        explain: '∠AOB と ∠DOC は、2本の直線が交わってできる向かい合った角（対頂角）だよ。錯角ではないし、平行線も仮定にないね。正しくは「対頂角は等しいから」。' },
      { variantId: 'e2-order', category: 'wrongLogicalOrder', mutation: { target: 'e2', field: 'reason', reason: 'correspondingAngles' },
        explain: '「合同な図形の対応する角は等しい」は、△ABO≡△DCO を証明したあとでしか使えないよ。ここではまだ合同を示していないね。∠OAB＝∠ODC は仮定から言えるよ。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'SAS' },
        explain: '等しい辺は AO＝DO の1組だけで、②、③は角の等しさだね。辺 AO の両端の角が等しいので、合同条件は「1組の辺とその両端の角がそれぞれ等しい」だよ。' },
    ],
    'eh-p03-reason': [
      { variantId: 'e1-eq', category: 'wrongEquation', mutation: { target: 'e1', field: 'body', items: ['AB', 'CO'] },
        explain: '仮定で等しいのは AB と CD だよ。AB と CO が等しいとは限らないね。正しくは「仮定より AB＝CD」。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'SAS' },
        explain: '等しい辺は AB＝CD の1組だけで、②、③は角の等しさだね。辺 AB の両端の角が等しいので、合同条件は「1組の辺とその両端の角がそれぞれ等しい」だよ。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABO', 'DCO'] },
        explain: '錯角 ∠BAO＝∠DCO より A と C、∠ABO＝∠CDO より B と D が対応するね。だから △ABO≡△CDO。△DCO だと A と D、B と C が対応してしまうよ。' },
    ],
    'eh-p10-cong': [
      { variantId: 'e2-reason', category: 'wrongReason', mutation: { target: 'e2', field: 'reason', reason: 'alternate' },
        explain: '∠ABC と ∠DCE は、平行線 AB、DC を直線 BE が横切ってできる、同じ側・同じ位置の角だから同位角だよ。錯角ではないね。' },
      { variantId: 'e1-eq', category: 'wrongEquation', mutation: { target: 'e1', field: 'body', items: ['CA', 'CE'] },
        explain: '仮定で等しいのは BC と CE だよ。CA と CE が等しいとは限らないね。正しくは「仮定より BC＝CE」。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABC', 'DEC'] },
        explain: '同位角 ∠ABC＝∠DCE より B と C、∠ACB＝∠DEC より C と E が対応するね。だから △ABC≡△DCE。△DEC だと B と E、C と C が対応してしまうよ。' },
    ],
    'eh-p13-order': [
      { variantId: 'e1-reason', category: 'wrongReason', mutation: { target: 'e1', field: 'reason', reason: 'corresponding' },
        explain: '∠BAC と ∠DCA は、平行線 AB、DC を直線 AC が横切ってできる、反対側の角だから錯角だよ。同位角ではないね。' },
      { variantId: 'e2-eq', category: 'wrongEquation', mutation: { target: 'e2', field: 'body', items: ['∠BCA', '∠CDA'] },
        explain: 'AD∥BC で、直線 AC がつくる錯角は ∠BCA と ∠DAC だよ。∠CDA は錯角ではないね。正しくは「∠BCA＝∠DAC」。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABC', 'DCA'] },
        explain: '∠BAC＝∠DCA より A と C、∠BCA＝∠DAC より C と A、残りの B と D が対応するね。だから △ABC≡△CDA。△DCA だと A と D、B と C が対応してしまうよ。' },
    ],

    // ---- 合同から結論を導く ----
    'eh-p16-reason': [
      { variantId: 'e1-order', category: 'wrongLogicalOrder', mutation: { target: 'e1', field: 'reason', reason: 'correspondingSides' },
        explain: '「合同な図形の対応する辺は等しい」は、△ABD≡△CBD を証明したあとでしか使えないよ。ここではまだ合同を示していないね。AB＝CB は仮定から言えるよ。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'ASA' },
        explain: 'AB＝CB、AD＝CD、BD＝BD は、どれも辺の等しさだね。3組の辺がそれぞれ等しいので、合同条件は「3組の辺がそれぞれ等しい」だよ。' },
      { variantId: 'final-eq', category: 'wrongEquation', mutation: { target: 'final', field: 'body', items: ['∠BAD', '∠CBD'] },
        explain: '△ABD≡△CBD で A と C が対応するので、∠BAD に対応するのは ∠BCD だよ。∠CBD に対応するのは ∠ABD だね。正しくは「∠BAD＝∠BCD」。' },
    ],
    'eh-p17-eq': [
      { variantId: 'final-reason', category: 'wrongReason', mutation: { target: 'final', field: 'reason', reason: 'correspondingAngles' },
        explain: '結論の AC＝BD は辺の等しさだから、理由は「合同な図形の対応する辺は等しいから」だよ。対応する角ではないね。' },
      { variantId: 'e2-order', category: 'wrongLogicalOrder', mutation: { target: 'e2', field: 'reason', reason: 'correspondingSides' },
        explain: '「合同な図形の対応する辺は等しい」は、△AOC≡△BOD を証明したあとでしか使えないよ。ここではまだ合同を示していないね。CO＝DO は仮定から言えるよ。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'ASA' },
        explain: '等しい辺は AO＝BO、CO＝DO の2組で、等しい角は対頂角 ∠AOC＝∠BOD の1組だね。その角は2辺の間の角なので、合同条件は「2組の辺とその間の角がそれぞれ等しい」だよ。' },
    ],
    'eh-p18-corr': [
      { variantId: 'final-eq', category: 'wrongEquation', mutation: { target: 'final', field: 'body', items: ['AO', 'BO'] },
        explain: '△ABO≡△CDO で A と C、O と O が対応するので、辺 AO に対応するのは辺 CO だよ。BO は同じ △ABO の辺だね。正しくは「AO＝CO」。' },
      { variantId: 'e2-reason', category: 'wrongReason', mutation: { target: 'e2', field: 'reason', reason: 'corresponding' },
        explain: '∠BAO と ∠DCO は、平行線 AB、CD を直線 AC が横切ってできる、反対側の角だから錯角だよ。同位角ではないね。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'SAS' },
        explain: '等しい辺は AB＝CD の1組だけで、②、③は角の等しさだね。辺 AB の両端の角が等しいので、合同条件は「1組の辺とその両端の角がそれぞれ等しい」だよ。' },
    ],
    'eh-p48-cong': [
      { variantId: 'e1-eq', category: 'wrongEquation', mutation: { target: 'e1', field: 'body', items: ['OQ', 'QP'] },
        explain: '点 O を中心とする円の半径は OQ と OR だよ。QP は点 Q を中心とする円の半径だから、OQ と等しいとは限らないね。正しくは「OQ＝OR」。' },
      { variantId: 'final-reason', category: 'wrongReason', mutation: { target: 'final', field: 'reason', reason: 'correspondingSides' },
        explain: '結論の ∠POQ＝∠POR は角の等しさだから、理由は「合同な図形の対応する角は等しいから」だよ。対応する辺ではないね。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['POQ', 'ROP'] },
        explain: '共通な辺 OP より O と O、P と P、OQ＝OR より Q と R が対応するね。だから △POQ≡△POR。△ROP だと P と R、Q と P が対応してしまうよ。' },
    ],
    'eh-p35-theorem': [
      { variantId: 'e2-reason', category: 'wrongReason', mutation: { target: 'e2', field: 'reason', reason: 'corresponding' },
        explain: '∠ABD と ∠CDB は、平行線 AB、DC を直線 BD が横切ってできる、反対側の角だから錯角だよ。同位角ではないね。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABD', 'CBD'] },
        explain: 'AB＝CD より A と C、錯角 ∠ABD＝∠CDB より B と D、D と B が対応するね。だから △ABD≡△CDB。△CBD だと B と B、D と D が対応してしまうよ。' },
      { variantId: 'final-reason', category: 'wrongReason', mutation: { target: 'final', field: 'reason', reason: 'correspondingSides' },
        explain: '∠ADB＝∠CBD は角の等しさだから、理由は「合同な図形の対応する角は等しいから」だよ。対応する辺ではないね。' },
    ],

    // ---- 三角形の性質・直角三角形 ----
    'eh-p21-theorem': [
      { variantId: 'e1-eq', category: 'wrongEquation', mutation: { target: 'e1', field: 'body', items: ['BD', 'EA'] },
        explain: '仮定で等しいのは BD と CE だよ。BD と EA が等しいとは限らないね。正しくは「仮定より BD＝CE」。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'ASA' },
        explain: '等しい辺は BD＝CE、AB＝AC の2組で、等しい角は ∠ABD＝∠ACE の1組だね。その角は2辺の間の角なので、合同条件は「2組の辺とその間の角がそれぞれ等しい」だよ。' },
      { variantId: 'final-reason', category: 'wrongReason', mutation: { target: 'final', field: 'reason', reason: 'correspondingAngles' },
        explain: '結論の AD＝AE は辺の等しさだから、理由は「合同な図形の対応する辺は等しいから」だよ。対応する角ではないね。' },
    ],
    'eh-p22-corr': [
      { variantId: 's1-theorem', category: 'wrongTheorem', mutation: { target: 's:s1', field: 'reason', rule: 'isoscelesConverse' },
        explain: 'AB＝AC（辺）から ∠ABC＝∠ACB（角）を導くので、使うのは「二等辺三角形の底角は等しい」だよ。「2つの角が等しい三角形は二等辺三角形」は、その逆（角から辺）だね。' },
      { variantId: 'post-theorem', category: 'wrongTheorem', mutation: { target: 'post:s2', field: 'reason', rule: 'isoscelesBaseAngles' },
        explain: 'ここは ∠DCB＝∠DBC（角）から「△DBC は二等辺三角形」を導くので、使うのは「2つの角が等しい三角形は二等辺三角形」だよ。「二等辺三角形の底角は等しい」は逆向き（辺から角）だね。' },
      { variantId: 'final-reason', category: 'wrongReason', mutation: { target: 'final', field: 'reason', reason: 'correspondingSides' },
        explain: '∠DCB＝∠DBC は角の等しさだから、理由は「合同な図形の対応する角は等しいから」だよ。対応する辺ではないね。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'ASA' },
        explain: '等しい辺は BM＝CN、BC＝CB の2組で、等しい角は ∠MBC＝∠NCB の1組だね。その角は2辺の間の角なので、合同条件は「2組の辺とその間の角がそれぞれ等しい」だよ。' },
    ],
    'eh-p23-eq': [
      { variantId: 's2-theorem', category: 'wrongTheorem', mutation: { target: 's:s2', field: 'reason', rule: 'angleSubtraction' },
        explain: '∠BCD＝∠BCA＋∠ACD は、2つの角をたした式だから「角の和」だよ。「角の差」ではないね。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'ASA' },
        explain: '等しい辺は AC＝BC、CE＝CD の2組で、等しい角は ∠ACE＝∠BCD の1組だね。その角は2辺の間の角なので、合同条件は「2組の辺とその間の角がそれぞれ等しい」だよ。' },
      { variantId: 'final-reason', category: 'wrongReason', mutation: { target: 'final', field: 'reason', reason: 'correspondingAngles' },
        explain: '結論の AE＝BD は辺の等しさだから、理由は「合同な図形の対応する辺は等しいから」だよ。対応する角ではないね。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ACE', 'BDC'] },
        explain: 'AC＝BC より A と B、∠ACE＝∠BCD より C と C、CE＝CD より E と D が対応するね。だから △ACE≡△BCD。△BDC だと C と D、E と C が対応してしまうよ。' },
    ],
    'eh-p24-order': [
      { variantId: 's1-theorem', category: 'wrongTheorem', mutation: { target: 's:s1', field: 'reason', rule: 'angleAddition' },
        explain: '∠BAD＝∠BAC－∠DAC は、大きい角から角をひいた式だから「角の差」だよ。「角の和」ではないね。' },
      { variantId: 's2-eq', category: 'wrongEquation', mutation: { target: 's:s2', field: 'body', value: '60°＋∠DAC' },
        explain: '∠CAE は ∠DAE から ∠DAC をひいた角だよ。∠DAE＝60° だから、∠CAE＝60°－∠DAC になるね。たし算ではないよ。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'SSS' },
        explain: '⑤ ∠BAD＝∠CAE は角の等しさだね。等しい辺 AB＝AC、AD＝AE の2組と、その間の角が等しいので、合同条件は「2組の辺とその間の角がそれぞれ等しい」だよ。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABD', 'AEC'] },
        explain: 'AB＝AC より B と C、AD＝AE より D と E が対応するね。だから △ABD≡△ACE。△AEC だと B と E、D と C が対応してしまうよ。' },
    ],
    'eh-p25-cong': [
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'SAS' },
        explain: '直角 ∠BAD は、辺 AB と AD の間の角だよ。BD と AB の間の角ではないので、「2組の辺とその間の角」にはならないね。直角三角形で、斜辺 BD と他の1辺 AB が等しいので「直角三角形の斜辺と他の1辺がそれぞれ等しい」。' },
      { variantId: 'e3-eq', category: 'wrongEquation', mutation: { target: 'e3', field: 'body', items: ['AB', 'DC'] },
        explain: '仮定で等しいのは AB と CB だよ。AB と DC が等しいとは限らないね。正しくは「仮定より AB＝CB」。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['ABD', 'CDB'] },
        explain: '直角 ∠BAD＝∠BCD より A と C、共通な斜辺 BD と AB＝CB より B と B、D と D が対応するね。だから △ABD≡△CBD。△CDB だと B と D が入れかわってしまうよ。' },
    ],
    'eh-p29-reason': [
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'RHS' },
        explain: '等しい辺は斜辺 PO だけで、③は鋭角 ∠POQ＝∠POR の等しさだね。だから合同条件は「直角三角形の斜辺と1つの鋭角がそれぞれ等しい」だよ。他の1辺が等しいことは示していないね。' },
      { variantId: 'final-reason', category: 'wrongReason', mutation: { target: 'final', field: 'reason', reason: 'correspondingAngles' },
        explain: '結論の PQ＝PR は辺の等しさだから、理由は「合同な図形の対応する辺は等しいから」だよ。対応する角ではないね。' },
      { variantId: 'conclusion-corr', category: 'wrongCorrespondence', mutation: { target: 'conclusion', field: 'body', triangles: ['POQ', 'RPO'] },
        explain: '共通な斜辺 PO より P と P、O と O、直角 ∠PQO＝∠PRO より Q と R が対応するね。だから △POQ≡△POR。△RPO だと P と R、O と P、Q と O が対応してしまうよ。' },
    ],

    // ---- 平行四辺形・特別な平行四辺形 ----
    'eh-p31-theorem': [
      { variantId: 'q1-eq', category: 'wrongEquation', mutation: { target: 'q:q1', field: 'body', items: ['AB', 'AD'] },
        explain: '仮定で等しいのは向かい合う辺 AB と DC だよ。となり合う辺 AB と AD が等しいとは限らないね。正しくは「仮定より AB＝DC」。' },
      { variantId: 'q2-order', category: 'wrongLogicalOrder', mutation: { target: 'q:q2', field: 'reason', reason: 'parallelogramSides' },
        explain: '「平行四辺形の対辺は等しい」は、四角形ABCDが平行四辺形だと分かってから使える性質だよ。いまはそれを証明しているところだね。AD＝BC は仮定から言えるよ。' },
    ],
    'eh-p33-eq': [
      { variantId: 'q1-order', category: 'wrongLogicalOrder', mutation: { target: 'q:q1', field: 'reason', reason: 'parallelogramDiagonals' },
        explain: '「平行四辺形の対角線はそれぞれの中点で交わる」は、四角形ABCDが平行四辺形だと分かってから使える性質だよ。いまはそれを証明しているところだね。AO＝CO は仮定から言えるよ。' },
      { variantId: 'condition-theorem', category: 'wrongTheorem', mutation: { target: 'q-condition', field: 'condition', condition: 'PP_EQUAL_SIDES' },
        explain: '①、②の AO＝CO、BO＝DO は、対角線が交点 O で半分ずつに分けられていることだね。四角形の辺の長さではないよ。使える条件は「対角線がそれぞれの中点で交わる」だよ。' },
    ],
    'eh-p44-order': [
      { variantId: 'q3-reason', category: 'wrongReason', mutation: { target: 'q:q3', field: 'reason', reason: 'parallelogramSides' },
        explain: 'AB と AD はとなり合う辺で、向かい合う辺（対辺）ではないよ。平行四辺形のとなり合う辺は等しいとは限らないね。AB＝AD は仮定から言えるよ。' },
      { variantId: 'q2-reason', category: 'wrongReason', mutation: { target: 'q:q2', field: 'reason', reason: 'parallelogramDiagonals' },
        explain: 'AD と BC は平行四辺形の向かい合う辺（対辺）だよ。対角線ではないので、理由は「平行四辺形の対辺は等しいから」だね。' },
    ],
    'eh-p41-theorem': [
      { variantId: 'q1-reason', category: 'wrongReason', mutation: { target: 'q:q1', field: 'reason', reason: 'parallelogramSides' },
        explain: '①は EB∥DF（平行）を言う行だよ。平行であることを言うには「平行四辺形の対辺は平行だから（AB∥DC）」を使うね。「対辺は等しい」は長さの性質だよ。' },
      { variantId: 's1-theorem', category: 'wrongTheorem', mutation: { target: 'qs:s1', field: 'reason', rule: 'parallelogramOppositeSidesParallel' },
        explain: '②は AB＝DC（長さが等しい）を言う行だから、使うのは「平行四辺形の対辺は等しい」だよ。「対辺は平行」からは、長さが等しいことは言えないね。' },
      { variantId: 'condition-theorem', category: 'wrongTheorem', mutation: { target: 'q-condition', field: 'condition', condition: 'PP_EQUAL_SIDES' },
        explain: '①、③は、同じ組の対辺 EB と DF が平行で、長さも等しいことだね。もう1組の対辺 BF と ED が等しいことは示していないので、「2組の対辺がそれぞれ等しい」は使えないよ。正しくは「1組の対辺が平行で、その長さが等しい」。' },
    ],
    'eh-p37-reason': [
      { variantId: 'e3-reason', category: 'wrongReason', mutation: { target: 'e3', field: 'reason', reason: 'corresponding' },
        explain: '∠ABE と ∠CDF は、平行線 AB、DC を対角線 BD が横切ってできる、反対側の角だから錯角だよ。同位角ではないね。' },
      { variantId: 'e1-eq', category: 'wrongEquation', mutation: { target: 'e1', field: 'body', items: ['BE', 'FC'] },
        explain: '仮定で等しいのは BE と DF だよ。BE と FC が等しいとは限らないね。正しくは「仮定より BE＝DF」。' },
      { variantId: 'condition-cong', category: 'wrongCongruence', mutation: { target: 'condition', field: 'condition', condition: 'ASA' },
        explain: '等しい辺は BE＝DF、AB＝CD の2組で、等しい角は ∠ABE＝∠CDF の1組だね。その角は2辺の間の角なので、合同条件は「2組の辺とその間の角がそれぞれ等しい」だよ。' },
    ],
    'eh-p45-order': [
      { variantId: 'q3-reason', category: 'wrongReason', mutation: { target: 'q:q3', field: 'reason', reason: 'parallelogramSides' },
        explain: '∠ABC＝∠CDA は角の等しさで、向かい合う角（対角）だね。理由は「平行四辺形の対角は等しいから」だよ。「対辺は等しい」は辺の長さの性質だね。' },
      { variantId: 'condition-theorem', category: 'wrongTheorem', mutation: { target: 'q-condition', field: 'condition', condition: 'rhombusDefinition' },
        explain: '①〜③で分かったのは、4つの角がすべて 90° で等しいことだね。辺の長さは示していないので「4つの辺がすべて等しい」は使えないよ。長方形になる条件は「4つの角がすべて等しい」。' },
    ],
    'eh-p39-corr': [
      { variantId: 'e1-reason', category: 'wrongReason', mutation: { target: 'e1', field: 'reason', reason: 'parallelogramSides' },
        explain: 'AO と CO は対角線 AC を交点 O で分けた長さで、平行四辺形の辺ではないよ。理由は「平行四辺形の対角線はそれぞれの中点で交わるから」だね。' },
      { variantId: 'e3-reason', category: 'wrongReason', mutation: { target: 'e3', field: 'reason', reason: 'alternate' },
        explain: '∠AOM と ∠CON は、直線 AC と MN が点 O で交わってできる向かい合った角（対頂角）だよ。錯角ではないね。' },
      { variantId: 'final-reason', category: 'wrongReason', mutation: { target: 'final', field: 'reason', reason: 'correspondingAngles' },
        explain: '結論の AM＝CN は辺の等しさだから、理由は「合同な図形の対応する辺は等しいから」だよ。対応する角ではないね。' },
    ],
  };

  // ---- バリエーションの問題データ ----------------------------------------------------

  const ORIGINAL = 'original';

  function base(id) { return PH.getErrorProblem(id); }

  // ベース問題（Ver.1.1 の1問）と、1つのバリエーションを合わせた問題データ。
  // id・no・unit・source はベース問題のまま（★評価はベース問題単位）。category・mutation・explain・hint はバリエーションのもの
  function make(b, v) {
    return Object.assign({}, b, {
      variantId: v.variantId,
      category: v.category,
      mutation: v.mutation,
      explain: v.explain,
      hint: v.hint,
      requiredTopics: v.requiredTopics || [],
      key: b.id + '/' + v.variantId,
    });
  }

  function list(baseId) {
    const b = base(baseId);
    if (!b) return [];
    const extra = PH.ERROR_HUNT_VARIANTS[baseId] || [];
    return [make(b, { variantId: ORIGINAL, category: b.category, mutation: b.mutation, explain: b.explain, hint: b.hint, requiredTopics: b.requiredTopics })]
      .concat(extra.map(function (v) { return make(b, v); }));
  }

  function def(baseId, variantId) {
    return list(baseId).find(function (d) { return d.variantId === (variantId || ORIGINAL); }) || null;
  }

  function all() {
    return PH.ERROR_HUNT_PROBLEMS.reduce(function (out, b) { return out.concat(list(b.id)); }, []);
  }

  // じっくり練習：問題を開くたびにバリエーションを1つ選ぶ（直前にその問題で出したものは、ほかに候補があれば避ける）。
  // 履歴はメモリ上だけ（チャレンジの履歴とは混ぜない）。random は 0〜1 を返す関数（テスト用。省略時 Math.random）
  const lastPractice = {};
  function practice(baseId, random) {
    const vs = list(baseId);
    if (!vs.length) return null;
    const cands = vs.length > 1 ? vs.filter(function (d) { return d.variantId !== lastPractice[baseId]; }) : vs;
    const d = cands[Math.min(cands.length - 1, Math.floor((random || Math.random)() * cands.length))];
    lastPractice[baseId] = d.variantId;
    return d;
  }

  // ---- 必要な知識とコース ---------------------------------------------------------

  // 段位認定と同じ対応表（js/rank-tracks.js）。間違いに使った理由・合同条件・推論ルールも、見抜くのに必要な知識
  const REASON_TOPIC = {
    given: ['given'], common: ['common'], commonAngle: ['common'], vertical: ['vertical'],
    alternate: ['alternate'], corresponding: ['corresponding'],
    correspondingSides: ['congruenceConsequence'], correspondingAngles: ['congruenceConsequence'],
    isoscelesBaseAngles: ['isosceles'], equilateralSides: ['equilateral'],
    squareSides: ['square'], squareAngle: ['square'], perpendicular: ['rightTriangle'],
    parallelogramSides: ['parallelogramProperties'], parallelogramParallel: ['parallelogramProperties'],
    parallelogramAngles: ['parallelogramProperties'], parallelogramDiagonals: ['parallelogramProperties', 'diagonalBisector'],
    alternateConverse: ['parallelConverse'], correspondingConverse: ['parallelConverse'],
    rhombusSides: ['rhombus'], rhombusAngles: ['rhombus'], rectangleSides: ['rectangle'], rectangleAngles: ['rectangle'],
    midpoint: ['given'], construction: ['given'],
  };
  const CONDITION_TOPIC = {
    SSS: ['basicCongruence'], SAS: ['basicCongruence'], ASA: ['basicCongruence'],
    RHA: ['rightTriangle', 'rightTriangleRHA'], RHS: ['rightTriangle', 'rightTriangleRHS'],
  };
  const RULE_TOPIC = {
    isoscelesBaseAngles: ['isosceles'], isoscelesConverse: ['isosceles'],
    angleAddition: ['angleExpressions'], angleSubtraction: ['angleExpressions'],
    parallelogramOppositeSidesParallel: ['parallelogramProperties'], parallelogramOppositeSidesEqual: ['parallelogramProperties'],
    parallelogramOppositeAnglesEqual: ['parallelogramProperties'], alternateAnglesParallel: ['parallelConverse'],
    parallelAlternateAngles: ['alternate', 'parallelogramProperties'],
  };

  function addAll(set, items) { (items || []).forEach(function (t) { if (set.indexOf(t) < 0) set.push(t); }); return set; }

  // 間違いそのものに必要な知識（未知の理由・ルールは 'unknown:…' にして、どのコースにも入れない）
  function mutationTopics(d) {
    const m = d.mutation;
    const out = [];
    if (m.field === 'reason' && m.rule) addAll(out, RULE_TOPIC[m.rule] || ['unknown:' + m.rule]);
    else if (m.field === 'reason') addAll(out, REASON_TOPIC[m.reason] || ['unknown:' + m.reason]);
    if (m.field === 'condition') {
      if (CONDITION_TOPIC[m.condition]) addAll(out, CONDITION_TOPIC[m.condition]);
      else if (/^rhombus/.test(m.condition || '')) addAll(out, ['rhombus']);
      else if (/^rectangle/.test(m.condition || '')) addAll(out, ['rectangle']);
      else addAll(out, ['parallelogramConditions']);      // 平行四辺形の成立条件（text の「成立条件ではない文」もふくむ）
    }
    if (m.triangles) addAll(out, ['triangleCorrespondence']);
    return out;
  }

  function topics(d) {
    const out = PH.rankTracks.problemTopics(PH.getProblem(d.source)).slice();
    addAll(out, mutationTopics(d));
    addAll(out, d.requiredTopics);
    return out;
  }

  function courses(d) {
    const t = topics(d);
    return PH.rankTracks.ORDER.filter(function (id) { return PH.rankTracks.allows(id, { requiredTopics: t }); });
  }

  // ---- 検証 -------------------------------------------------------------------

  function verifyAll() {
    const errors = [];
    Object.keys(PH.ERROR_HUNT_VARIANTS).forEach(function (id) {
      if (!base(id)) errors.push('ベース問題がない ' + id);
    });
    PH.ERROR_HUNT_PROBLEMS.forEach(function (b) {
      const vs = list(b.id);
      const ids = {}, shapes = {};
      vs.forEach(function (d) {
        const tag = d.key;
        if (ids[d.variantId]) errors.push(tag + ': バリエーションIDの重複');
        ids[d.variantId] = true;
        // 同じベース問題で、同じステップを同じ内容に変えるバリエーションは1つだけ
        const shape = JSON.stringify(d.mutation);
        if (shapes[shape]) errors.push(tag + ': 同じ間違いのバリエーションがある（' + shapes[shape] + '）');
        shapes[shape] = d.variantId;
        PH.errorHunt.verify(d).forEach(function (e) { errors.push(tag + ' ' + e); });
        if (!courses(d).length) errors.push(tag + ': 出題できるコースがない（' + topics(d).join(',') + '）');
      });
    });
    return errors;
  }

  PH.errorVariants = {
    ORIGINAL: ORIGINAL,
    list: list,
    def: def,
    all: all,
    practice: practice,
    topics: topics,
    mutationTopics: mutationTopics,
    courses: courses,
    verifyAll: verifyAll,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.errorVariants;
})(typeof window !== 'undefined' ? window : globalThis);
