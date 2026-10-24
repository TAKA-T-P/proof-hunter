/*
 * rank-config.js — 段位認定モード（Ver.0.6）の設定・得点計算・段位判定
 *
 * 段位の数値・制限時間・出題割合などは、すべてここに集める（画面や判定処理に直接書かない）。
 * 認定基準を変えるときは grades を直し、criteriaVersion を1つ上げる
 * （保存した最高段位は基準のバージョンごとに比べるので、過去の認定が意図せず変わらない）。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  const config = {
    criteriaVersion: 2,          // 認定基準のバージョン（暫定版。2：誤答は時間ペナルティ、段位は正解数で判定）
    // 出題範囲（ミニ問題の集まり）のバージョン。認定基準は変えずに問題が増えたとき上げる（記録には残すが、最高段位は比べ続ける）
    //   1：Ver.0.8（2コース）／ 2：Ver.0.9（総合証明に平行四辺形を追加）／ 3：Ver.1.0（総合証明にひし形・長方形・四角形の分類を追加）
    questionPoolVersion: 3,
    timeLimitMs: 120000,         // 制限時間 120秒
    countdown: ['3', '2', '1', 'START！'],
    countdownStepMs: 650,        // カウントダウン1つの長さ
    warnSeconds: 30,             // この秒数以下でタイマーをオレンジに
    dangerSeconds: 10,           // この秒数以下で赤に
    selectZoneCount: 10,         // 1〜10問目：セレクトゾーン（すべて選択式）
    inputRatio: 0.6,             // 11問目以降（チャレンジゾーン）：記号入力の問題の割合
    // 解答箇所の数の割合（1か所 70%・2か所 25%・3か所 5%）
    // 解答箇所の数の割合。テンポを上げるため、解答箇所は1つだけ（2〜3か所の問題は出さない）
    blankWeights: { 1: 1 },
    // 序盤は易しい問題から（n 問目までの難易度の上限）
    difficultyCaps: [{ upTo: 3, max: 1 }, { upTo: 10, max: 2 }],
    recentAvoid: 12,             // 直近この問数に出た問題は、なるべく出さない
    // カテゴリごとの出題の重み（Ver.0.7 で追加した「定理・三段論法」は、既存のバランスを崩さないよう半分）
    // Ver.0.8：コース（基本・総合）ごとの重みは js/rank-tracks.js の categoryWeights。これはコースを指定しないときの値
    categoryWeights: { eq: 1, reason: 1, cond: 1, corr: 1, final: 1, theorem: 0.5, right: 0.5, para: 0.5, quad: 0.5 },
    feedbackMs: 500,             // 正解・不正解の表示時間（Ver.1.0 で 0.3秒 → 0.5秒。表示中は残り時間が減らない）
    // 誤答（パスをふくむ）のペナルティ：n 回目の誤答で制限時間を 4×n 秒へらす（4秒、8秒、12秒…とだんだん重くなる）
    penaltyStepMs: 4000,
    missWeight: 0,               // 正解数からの減点はしない（有効正解数 ＝ 正解数）
    reviewLimit: 40,             // 振り返り用に保存する誤答の上限（直近1回分）
    combos: [
      { n: 3, text: 'NICE！' },
      { n: 5, text: 'GREAT！' },
      { n: 10, text: 'EXCELLENT！' },
      { n: 15, text: 'AMAZING！' },
    ],
    // 21段階の認定（必要な有効正解数。rank は内部のランク番号）
    grades: [
      { rank: 0, name: '10級', min: 0 },
      { rank: 1, name: '9級', min: 1 },
      { rank: 2, name: '8級', min: 2 },
      { rank: 3, name: '7級', min: 3 },
      { rank: 4, name: '6級', min: 4 },
      { rank: 5, name: '5級', min: 5 },
      { rank: 6, name: '4級', min: 6 },
      { rank: 7, name: '3級', min: 7 },
      { rank: 8, name: '2級', min: 8 },
      { rank: 9, name: '1級', min: 9 },
      { rank: 10, name: '初段', min: 10 },
      { rank: 11, name: '二段', min: 11 },
      { rank: 12, name: '三段', min: 12 },
      { rank: 13, name: '四段', min: 13 },
      { rank: 14, name: '五段', min: 14 },
      { rank: 15, name: '六段', min: 15 },
      { rank: 16, name: '七段', min: 16 },
      { rank: 17, name: '八段', min: 17 },
      { rank: 18, name: '九段', min: 18 },
      { rank: 19, name: '十段', min: 19 },
      { rank: 20, name: '皆伝', min: 20 },
    ],
    // 認定演出の段階（ランク番号の範囲）
    tiers: [
      { from: 0, to: 9, id: 'kyu' },      // 10級〜1級：シンプル
      { from: 10, to: 14, id: 'medal' },  // 初段〜五段：メダル
      { from: 15, to: 19, id: 'gold' },   // 六段〜十段：ゴールド
      { from: 20, to: 20, id: 'crown' },  // 皆伝：王冠
    ],
  };

  // n 回目の誤答のペナルティ（ミリ秒）と、m 回誤答したときの合計
  function penaltyFor(n) { return n > 0 ? config.penaltyStepMs * n : 0; }
  function totalPenalty(m) { return m > 0 ? config.penaltyStepMs * m * (m + 1) / 2 : 0; }

  // 有効正解数（段位の判定に使う数。missWeight が 0 なら正解数そのもの。0未満にならない）
  function effectiveScore(correct, misses) {
    const v = Math.max(0, correct - misses * config.missWeight);
    return Math.round(v * 10) / 10;
  }

  // 有効正解数から認定する段位（条件を満たす最も高いもの）
  function gradeFor(score) {
    let g = config.grades[0];
    config.grades.forEach(function (x) { if (score >= x.min && x.rank >= g.rank) g = x; });
    return g;
  }

  function gradeByRank(rank) {
    return config.grades.find(function (g) { return g.rank === rank; }) || null;
  }

  // 次の段位と、あと何ポイント必要か（最高段位なら null）
  function nextGrade(score) {
    const cur = gradeFor(score);
    const nxt = config.grades.filter(function (g) { return g.rank > cur.rank; })
      .sort(function (a, b) { return a.rank - b.rank; })[0];
    if (!nxt) return null;
    return { grade: nxt, need: Math.round((nxt.min - score) * 10) / 10 };
  }

  function tierFor(rank) {
    return (config.tiers.find(function (t) { return rank >= t.from && rank <= t.to; }) || config.tiers[0]).id;
  }

  // 連続正解数に対応する演出（ちょうどその数に達したときだけ）
  function comboText(n) {
    const c = config.combos.find(function (x) { return x.n === n; });
    return c ? c.text : null;
  }

  PH.rankConfig = config;
  PH.rank = {
    config: config,
    effectiveScore: effectiveScore,
    penaltyFor: penaltyFor,
    totalPenalty: totalPenalty,
    gradeFor: gradeFor,
    gradeByRank: gradeByRank,
    nextGrade: nextGrade,
    tierFor: tierFor,
    comboText: comboText,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.rank;
})(typeof window !== 'undefined' ? window : globalThis);
