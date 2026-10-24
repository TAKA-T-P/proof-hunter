/*
 * storage.js — 学習進捗の保存（LocalStorage）
 *
 * LocalStorage が使えない（プライベートモード等）場合はメモリ上だけで動作し、
 * ゲームの進行は妨げない。
 *
 * 保存形式（キー proofHunter.v1。Ver.0.1・0.2 のデータをそのまま読める）
 *   {
 *     version: 4,
 *     problems:       { p01: { cleared, bestStars, minMisses }, ... },   // ハンターモード（Ver.0.1〜）
 *     puzzleProblems: { p01: {...}, ... },     // Ver.0.3 の証明パズルの記録（移行元。消さずに残す）
 *     puzzleLevels: {                          // Ver.0.4〜：解答レベルごとの証明パズルの記録
 *       easy: { p01: {...} }, standard: { ... }, challenge: { ... }
 *     },
 *     puzzleLevel: 'easy' | 'standard' | 'challenge',   // 選んでいる解答レベル（初期値 easy）
 *     puzzleMigrated: true,                    // Ver.0.3 の記録を移行ずみ（二重に移行しない）
 *     lastProblemId, lastPuzzleProblemId, lastMode: 'hunter' | 'puzzle', sound,
 *     rankCertification: {                     // 段位認定（ハンター・パズルの記録とは独立）
 *       format: 2,                             // Ver.0.8：コース別の記録
 *       tracks: {                              // コースごとの記録（基本の合同証明・総合証明は完全に独立）
 *         basic: <コースの記録>, comprehensive: <コースの記録>,
 *       },
 *       legacy: <コースの記録> | null,         // Ver.0.6〜0.7 の段位認定の記録（そのまま残す。新しいコースには変換しない）
 *     }
 *     <コースの記録> = {
 *       criteriaVersion,                       // いまの最高記録の認定基準のバージョン
 *       questionPoolVersion,                   // Ver.0.9：最後に挑戦したときの出題範囲のバージョン（基準は変わらないので記録は引き継ぐ）
 *       best: { rank, rankName, effectiveScore, correct, maxCombo, at } | null,   // 同じ基準での最高記録（null は未認定）
 *       bestCorrect, bestEffectiveScore, bestCombo,
 *       playCount,                             // 挑戦回数（最後まで終えた回数）
 *       lastResult: { correct, misses, passes, effectiveScore, rank, rankName, maxCombo, criteriaVersion, completedAt },
 *       lastReview: [ ... ],                   // 直近1回分の誤答・パス（振り返り用。上限あり）
 *       previous: [ { criteriaVersion, best } ],   // 基準が変わる前の最高記録（比べずに残す。最大3件）
 *     }
 *     errorHunt: {                             // Ver.1.1：証明の間違い探し（ほかのモードの記録とは独立）
 *       problems: { 'eh-p01-cong': { completed, solvedByUser, bestStars, minMisses, attempts }, ... },
 *       lastId,                                // 最後に挑戦した問題
 *       challenge: {                           // Ver.1.2：ランダム5問チャレンジ（コースごとに完全に独立。段位認定の記録とも別）
 *         basic: <チャレンジの記録>, comprehensive: <チャレンジの記録>,
 *       },
 *     }
 *     <チャレンジの記録> = {
 *       bestScore,                             // 最高得点（0〜100）。null は未挑戦（0点と区別する）
 *       playCount,                             // 挑戦回数（5問を最後まで終えた回数。途中終了は数えない）
 *       lastResult: { score, correct, wrong, total, seed, completedAt, newBest,
 *                     items: [{ no, baseId, variantId, category, target, selected, correct }] } | null,   // 直近1回（振り返り用）
 *       recentVariants: { <ベース問題ID>: [バリエーションID（新しい順・最大3つ）] },   // 同じ間違いが続かないようにする少量の履歴
 *       lastBases: [ベース問題ID],              // 直近のチャレンジで出題したベース問題
 *     }
 *   }
 *   Ver.0.7 までの rankCertification（コースの記録の形そのもの）は、読みこむときに legacy へ移す（1回だけ。保存すると新しい形になる）。
 *   記録はモードごと・解答レベルごとに別々。古いデータに無い項目は空として読み、過去のプレイ内容は推測で補わない。
 *   関数の mode 引数は 'hunter'（省略時）、'puzzle:easy' / 'puzzle:standard' / 'puzzle:challenge'、
 *   または 'puzzle'（Ver.0.3 の記録そのもの。互換のため）。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const KEY = 'proofHunter.v1';

  const VERSION = 6;
  const LEVELS = ['easy', 'standard', 'challenge'];
  const TRACK_IDS = ['basic', 'comprehensive'];     // 段位認定のコース（Ver.0.8。js/rank-tracks.js）

  /*
   * Ver.0.3 の各問題の形式（移行用に固定した表）。
   * problems.js の puzzle.type を後で変えても、過去の記録が別のレベルへ移らないよう、ここでは問題データを参照しない。
   *   fill（穴埋め）→ おてがる、build（組み立て）→ スタンダード。チャレンジへは移行しない。
   */
  const V03_TYPES = {
    p01: 'fill', p04: 'fill', p06: 'fill', p02: 'fill', p05: 'fill', p09: 'fill', p03: 'fill',
    p08: 'build', p10: 'build', p07: 'build', p11: 'build', p12: 'build', p13: 'build', p14: 'build', p15: 'build',
  };

  function blankLevels() { return { easy: {}, standard: {}, challenge: {} }; }

  function blank() {
    return {
      version: VERSION, problems: {}, puzzleProblems: {}, puzzleLevels: blankLevels(), puzzleLevel: 'easy',
      puzzleMigrated: false, lastProblemId: null, lastPuzzleProblemId: null, lastMode: null, sound: true,
      rankCertification: blankCert(),
      errorHunt: blankErrorHunt(),
    };
  }

  // 段位認定の記録全体（コースごとの記録と、Ver.0.7 までの記録）
  function blankCert() {
    const tracks = {};
    TRACK_IDS.forEach(function (id) { tracks[id] = blankRank(); });
    return { format: 2, tracks: tracks, legacy: null };
  }

  // 挑戦したことがある記録か（未挑戦の空の記録は legacy に残さない）
  function hasRankData(r) { return !!(r.best || r.playCount > 0 || r.lastResult); }

  /*
   * 保存されていた段位認定の記録を読む。
   *   Ver.0.8 の形（tracks あり）… コースごとに安全な値にそろえる。legacy はそのまま残す
   *   Ver.0.6〜0.7 の形（tracks なし）… legacy に移す（新しいコースは未認定から）。壊れた値・未挑戦なら legacy なし
   */
  function cleanCert(r) {
    const out = blankCert();
    if (!isObj(r)) return out;
    if (isObj(r.tracks)) {
      TRACK_IDS.forEach(function (id) { out.tracks[id] = cleanRank(r.tracks[id]); });
      const lg = isObj(r.legacy) ? cleanRank(r.legacy) : null;
      out.legacy = lg && hasRankData(lg) ? lg : null;
      return out;
    }
    const old = cleanRank(r);
    out.legacy = hasRankData(old) ? old : null;
    return out;
  }

  function blankRank() {
    return {
      criteriaVersion: null, questionPoolVersion: null, best: null, bestCorrect: 0, bestEffectiveScore: 0, bestCombo: 0,
      playCount: 0, lastResult: null, lastReview: [], previous: [],
    };
  }

  function num(v, def) { return typeof v === 'number' && isFinite(v) && v >= 0 ? v : def; }

  // 段位認定の記録を安全な値にそろえる（壊れた値は初期値）
  function cleanRank(r) {
    const out = blankRank();
    if (!isObj(r)) return out;
    out.criteriaVersion = typeof r.criteriaVersion === 'number' ? r.criteriaVersion : null;
    out.questionPoolVersion = typeof r.questionPoolVersion === 'number' ? r.questionPoolVersion : null;
    if (isObj(r.best) && typeof r.best.rank === 'number') {
      out.best = {
        rank: r.best.rank, rankName: String(r.best.rankName || ''), effectiveScore: num(r.best.effectiveScore, 0),
        correct: num(r.best.correct, 0), maxCombo: num(r.best.maxCombo, 0), at: typeof r.best.at === 'string' ? r.best.at : null,
      };
    }
    out.bestCorrect = num(r.bestCorrect, 0);
    out.bestEffectiveScore = num(r.bestEffectiveScore, 0);
    out.bestCombo = num(r.bestCombo, 0);
    out.playCount = Math.floor(num(r.playCount, 0));
    out.lastResult = isObj(r.lastResult) ? r.lastResult : null;
    out.lastReview = Array.isArray(r.lastReview) ? r.lastReview.filter(isObj) : [];
    out.previous = Array.isArray(r.previous) ? r.previous.filter(isObj).slice(0, 3) : [];
    return out;
  }

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  // ---- 証明の間違い探し（Ver.1.1） ----
  function blankErrorRecord() { return { completed: false, solvedByUser: false, bestStars: 0, minMisses: null, attempts: 0 }; }

  // 1問分の記録を安全な値にそろえる（壊れた値は未挑戦）
  function cleanErrorRecord(r) {
    const out = blankErrorRecord();
    if (!isObj(r)) return out;
    const stars = Math.round(Number(r.bestStars));
    out.completed = r.completed === true;
    out.solvedByUser = out.completed && r.solvedByUser === true;
    out.bestStars = out.completed && stars >= 1 && stars <= 3 ? stars : 0;
    out.minMisses = out.solvedByUser && typeof r.minMisses === 'number' && r.minMisses >= 0 ? r.minMisses : null;
    out.attempts = Math.floor(num(r.attempts, 0));
    return out;
  }

  function blankErrorHunt() { return { problems: {}, lastId: null, challenge: blankChallenges() }; }

  function cleanErrorHunt(r) {
    const out = blankErrorHunt();
    if (!isObj(r)) return out;
    if (isObj(r.problems)) Object.keys(r.problems).forEach(function (id) { if (isObj(r.problems[id])) out.problems[id] = cleanErrorRecord(r.problems[id]); });
    out.lastId = typeof r.lastId === 'string' ? r.lastId : null;
    const ch = isObj(r.challenge) ? r.challenge : {};
    CHALLENGE_IDS.forEach(function (id) { out.challenge[id] = cleanChallenge(ch[id]); });
    return out;
  }

  // ---- ランダム5問チャレンジ（Ver.1.2。コース basic / comprehensive） ----
  const CHALLENGE_IDS = ['basic', 'comprehensive'];
  const RECENT_KEEP = 3;

  function blankChallenge() { return { bestScore: null, playCount: 0, lastResult: null, recentVariants: {}, lastBases: [] }; }
  function blankChallenges() {
    const out = {};
    CHALLENGE_IDS.forEach(function (id) { out[id] = blankChallenge(); });
    return out;
  }

  function strList(v, max) { return Array.isArray(v) ? v.filter(function (x) { return typeof x === 'string'; }).slice(0, max) : []; }
  function score100(v) { return typeof v === 'number' && isFinite(v) && v >= 0 && v <= 100 ? Math.round(v) : null; }

  // チャレンジの記録を安全な値にそろえる（壊れた値は未挑戦）
  function cleanChallenge(r) {
    const out = blankChallenge();
    if (!isObj(r)) return out;
    out.bestScore = score100(r.bestScore);
    out.playCount = Math.floor(num(r.playCount, 0));
    if (isObj(r.lastResult) && score100(r.lastResult.score) !== null && Array.isArray(r.lastResult.items)) {
      const lr = r.lastResult;
      out.lastResult = {
        score: score100(lr.score), correct: Math.floor(num(lr.correct, 0)), wrong: Math.floor(num(lr.wrong, 0)), total: Math.floor(num(lr.total, 0)),
        seed: typeof lr.seed === 'number' ? lr.seed : null, completedAt: typeof lr.completedAt === 'string' ? lr.completedAt : null, newBest: lr.newBest === true,
        items: lr.items.filter(function (it) { return isObj(it) && typeof it.baseId === 'string' && typeof it.variantId === 'string'; }).slice(0, 10).map(function (it) {
          return {
            no: Math.floor(num(it.no, 0)), baseId: it.baseId, variantId: it.variantId, category: typeof it.category === 'string' ? it.category : null,
            target: typeof it.target === 'string' ? it.target : null, selected: typeof it.selected === 'string' ? it.selected : null, correct: it.correct === true,
          };
        }),
      };
    }
    if (isObj(r.recentVariants)) {
      Object.keys(r.recentVariants).forEach(function (id) {
        const l = strList(r.recentVariants[id], RECENT_KEEP);
        if (l.length) out.recentVariants[id] = l;
      });
    }
    out.lastBases = strList(r.lastBases, 10);
    return out;
  }

  // モードごとの記録の入れ物
  function records(mode) {
    const d = load();
    if (typeof mode === 'string' && mode.indexOf('puzzle:') === 0) {
      const level = mode.slice(7);
      return LEVELS.indexOf(level) >= 0 ? d.puzzleLevels[level] : {};
    }
    return mode === 'puzzle' ? d.puzzleProblems : d.problems;
  }

  /*
   * Ver.0.3 の記録を解答レベルへ移行する（1回だけ。移行先に記録があればそちらを残す）。
   * 元の puzzleProblems は消さない。
   */
  function migratePuzzle(d) {
    if (d.puzzleMigrated) return;
    Object.keys(d.puzzleProblems).forEach(function (id) {
      const rec = d.puzzleProblems[id];
      const level = V03_TYPES[id] === 'fill' ? 'easy' : V03_TYPES[id] === 'build' ? 'standard' : null;
      if (!level || !isObj(rec) || !rec.cleared) return;
      if (!isObj(d.puzzleLevels[level][id])) d.puzzleLevels[level][id] = Object.assign({}, rec);
    });
    d.puzzleMigrated = true;
  }

  let data = null;

  function backend() {
    try {
      return root.localStorage || null;
    } catch (e) {
      return null;
    }
  }

  function load() {
    if (data) return data;
    data = blank();
    try {
      const ls = backend();
      const raw = ls && ls.getItem(KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') {
          data.problems = isObj(parsed.problems) ? parsed.problems : {};
          data.puzzleProblems = isObj(parsed.puzzleProblems) ? parsed.puzzleProblems : {};
          const pl = isObj(parsed.puzzleLevels) ? parsed.puzzleLevels : {};
          LEVELS.forEach(function (lv) { data.puzzleLevels[lv] = isObj(pl[lv]) ? pl[lv] : {}; });
          data.puzzleLevel = LEVELS.indexOf(parsed.puzzleLevel) >= 0 ? parsed.puzzleLevel : 'easy';
          data.puzzleMigrated = parsed.puzzleMigrated === true;
          data.lastProblemId = typeof parsed.lastProblemId === 'string' ? parsed.lastProblemId : null;
          data.lastPuzzleProblemId = typeof parsed.lastPuzzleProblemId === 'string' ? parsed.lastPuzzleProblemId : null;
          data.lastMode = parsed.lastMode === 'puzzle' || parsed.lastMode === 'hunter' ? parsed.lastMode : null;
          data.sound = parsed.sound !== false;
          data.rankCertification = cleanCert(parsed.rankCertification);
          data.errorHunt = cleanErrorHunt(parsed.errorHunt);     // Ver.1.1。古いデータには無いので空から
          data.version = VERSION;
        }
      }
    } catch (e) { /* 壊れたデータは無視 */ }
    migratePuzzle(data);
    return data;
  }

  function save() {
    try {
      const ls = backend();
      if (ls) ls.setItem(KEY, JSON.stringify(load()));
      return true;
    } catch (e) {
      return false;
    }
  }

  // 1問分の記録。壊れた値や古い形式でも安全な値にそろえて返す
  function getProblem(id, mode) {
    const r = records(mode)[id];
    if (!r || typeof r !== 'object') return { cleared: false, bestStars: 0, minMisses: null };
    const stars = Math.round(Number(r.bestStars));
    return {
      cleared: !!r.cleared,
      bestStars: stars >= 0 && stars <= 3 ? stars : 0,
      minMisses: typeof r.minMisses === 'number' && r.minMisses >= 0 ? r.minMisses : null,
    };
  }

  function merge(id, stars, misses, mode) {
    const prev = getProblem(id, mode);
    const next = {
      cleared: true,
      bestStars: Math.max(prev.bestStars || 0, stars),
      minMisses: prev.minMisses == null ? misses : Math.min(prev.minMisses, misses),
    };
    records(mode)[id] = next;
    return { prev: prev, next: next };
  }

  /*
   * クリアを記録。最高評価・最少ミスを更新した場合 improved: true
   * 証明パズルで★★★なら、同じ問題の下位の解答レベルも★★★にする
   * （例：チャレンジで★★★ → おてがる・スタンダードも★★★）。新たに★★★になった下位レベルを lowered に返す
   */
  function recordClear(id, stars, misses, mode) {
    const m = merge(id, stars, misses, mode);
    const lowered = [];
    if (stars === 3 && typeof mode === 'string' && mode.indexOf('puzzle:') === 0) {
      const at = LEVELS.indexOf(mode.slice(7));
      LEVELS.slice(0, Math.max(at, 0)).forEach(function (lv) {
        const r = merge(id, 3, misses, 'puzzle:' + lv);
        if (r.prev.bestStars < 3 || !r.prev.cleared) lowered.push(lv);
      });
    }
    save();
    return { improved: !m.prev.cleared || stars > (m.prev.bestStars || 0), record: m.next, lowered: lowered };
  }

  // ---- ステージ・復習（PH.problems を参照して集計） --------------------------

  function stageStats(stageId, mode) {
    const list = PH.stageProblems(stageId);
    const recs = list.map(function (p) { return getProblem(p.id, mode); });
    const cleared = recs.filter(function (r) { return r.cleared; }).length;
    return {
      total: list.length,
      cleared: cleared,
      stars: recs.reduce(function (sum, r) { return sum + (r.cleared ? r.bestStars : 0); }, 0),
      maxStars: list.length * 3,
      complete: list.length > 0 && cleared === list.length,
      problems: list,
      records: recs,
    };
  }

  // 復習対象：未クリア、または最高評価が★★以下の問題（★★★は対象外）
  function isReviewTarget(id, mode) {
    const r = getProblem(id, mode);
    return !r.cleared || r.bestStars < 3;
  }

  function reviewProblems(mode) {
    return PH.problems.filter(function (p) { return isReviewTarget(p.id, mode); });
  }

  // 証明パズルの解答レベル
  function getPuzzleLevel() { return load().puzzleLevel; }
  function setPuzzleLevel(level) {
    if (LEVELS.indexOf(level) < 0) return false;
    load().puzzleLevel = level;
    save();
    return true;
  }

  // 最後にプレイした問題（モードごと）と、最後にプレイしたモード
  function setLastProblem(id, mode) {
    const d = load();
    if (typeof mode === 'string' && mode.indexOf('puzzle') === 0) mode = 'puzzle';
    if (mode === 'puzzle') d.lastPuzzleProblemId = id;
    else d.lastProblemId = id;
    d.lastMode = mode === 'puzzle' ? 'puzzle' : 'hunter';
    save();
  }

  function getLastProblem(mode) {
    const d = load();
    return mode === 'puzzle' ? d.lastPuzzleProblemId : d.lastProblemId;
  }

  // 「つづきから」の行き先。Ver.0.2 以前のデータ（lastMode なし）はハンターモードとして扱う
  function getLastPlay() {
    const d = load();
    const mode = d.lastMode || (d.lastProblemId ? 'hunter' : null);
    if (!mode) return null;
    const id = getLastProblem(mode);
    return id ? { mode: mode, id: id } : null;
  }

  function hasHistory() {
    const d = load();
    return !!(d.lastProblemId || d.lastPuzzleProblemId) ||
      Object.keys(d.problems).length > 0 || Object.keys(d.puzzleProblems).length > 0 ||
      LEVELS.some(function (lv) { return Object.keys(d.puzzleLevels[lv]).length > 0; }) ||
      Object.keys(d.errorHunt.problems).length > 0;
  }

  // ---- 段位認定（Ver.0.6。Ver.0.8 からコース別） -------------------------------------------

  function trackId(track) { return TRACK_IDS.indexOf(track) >= 0 ? track : 'basic'; }

  // コースの記録（track を省略すると基本の合同証明）
  function getRank(track) { return load().rankCertification.tracks[trackId(track)]; }

  // Ver.0.7 までの段位認定の記録（なければ null）
  function getRankLegacy() { return load().rankCertification.legacy; }

  /*
   * 段位認定の結果を記録する（最後まで終えた挑戦だけ。途中終了は記録しない）。
   *   最高記録は同じ認定基準（criteriaVersion）の中で比べる。基準が変わっていたら、それまでの最高記録は previous に移して残す。
   *   最高段位は下がらない。認定時の段位名を保存するので、あとで基準を変えても過去の認定は変わらない。
   *   戻り値 { newRecord（最高段位を更新）, bestScore（有効正解数を更新）, ... }
   */
  function recordRank(result, track) {
    const d = load();
    // コース：引数 → 結果の track → 基本の合同証明。ほかのコースの記録には反映しない
    const r = d.rankCertification.tracks[trackId(track || (result && result.track))];
    const ver = result.criteriaVersion;
    if (r.criteriaVersion !== null && r.criteriaVersion !== ver && r.best) {
      r.previous.unshift({ criteriaVersion: r.criteriaVersion, best: r.best });
      r.previous = r.previous.slice(0, 3);
      r.best = null; r.bestCorrect = 0; r.bestEffectiveScore = 0; r.bestCombo = 0;
    }
    r.criteriaVersion = ver;
    if (typeof result.questionPoolVersion === 'number') r.questionPoolVersion = result.questionPoolVersion;
    const at = new Date().toISOString();
    const prevBest = r.best;
    const newRecord = !prevBest || result.rank > prevBest.rank ||
      (result.rank === prevBest.rank && result.effectiveScore > prevBest.effectiveScore);
    if (newRecord) {
      r.best = { rank: result.rank, rankName: result.rankName, effectiveScore: result.effectiveScore,
        correct: result.correct, maxCombo: result.maxCombo, at: at };
    }
    const out = {
      newRecord: newRecord && !!prevBest,          // 初めての挑戦は「自己ベスト更新」とは言わない
      firstTime: !prevBest,
      bestCorrect: result.correct > r.bestCorrect,
      bestCombo: result.maxCombo > r.bestCombo,
    };
    r.bestCorrect = Math.max(r.bestCorrect, result.correct);
    r.bestEffectiveScore = Math.max(r.bestEffectiveScore, result.effectiveScore);
    r.bestCombo = Math.max(r.bestCombo, result.maxCombo);
    r.playCount++;
    r.lastResult = {
      correct: result.correct, misses: result.misses, passes: result.passes, answered: result.answered,
      effectiveScore: result.effectiveScore, rank: result.rank, rankName: result.rankName, maxCombo: result.maxCombo,
      criteriaVersion: ver, questionPoolVersion: typeof result.questionPoolVersion === 'number' ? result.questionPoolVersion : null,
      completedAt: at, newRecord: out.newRecord,
    };
    r.lastReview = (result.wrongs || []).slice(0, 40);
    save();
    return out;
  }

  // ---- 証明の間違い探し（Ver.1.1） -------------------------------------------------

  function getErrorRecord(id) { return cleanErrorRecord(load().errorHunt.problems[id]); }

  /*
   * 1問の結果を記録する。result = { stars, misses, solvedByUser }
   *   最高★は下がらない。正解を確認しただけ（solvedByUser: false）は★1で、あとで自力で正解すれば高い評価に更新できる。
   *   最少ミスは自力で正解したときだけ。戻り値 { improved, firstTime（初めての記録）, record }
   */
  function recordError(id, result) {
    const d = load();
    const prev = getErrorRecord(id);
    const stars = result.solvedByUser ? Math.max(1, Math.min(3, result.stars)) : 1;
    const next = {
      completed: true,
      solvedByUser: prev.solvedByUser || !!result.solvedByUser,
      bestStars: Math.max(prev.bestStars, stars),
      minMisses: result.solvedByUser ? (prev.minMisses == null ? result.misses : Math.min(prev.minMisses, result.misses)) : prev.minMisses,
      attempts: prev.attempts + 1,
    };
    d.errorHunt.problems[id] = next;
    d.errorHunt.lastId = id;
    save();
    return { improved: !prev.completed || next.bestStars > prev.bestStars, firstTime: !prev.completed, record: next };
  }

  // 苦手な問題：まだ自力で正解していない、または★★以下（★★★は対象外）
  function isErrorReviewTarget(id) {
    const r = getErrorRecord(id);
    return !r.solvedByUser || r.bestStars < 3;
  }

  // ---- ランダム5問チャレンジ（Ver.1.2） ---------------------------------------------

  function challengeId(id) { return CHALLENGE_IDS.indexOf(id) >= 0 ? id : null; }

  // コースの記録（コピー）。知らないコースは未挑戦の記録
  function getErrorChallenge(course) {
    const id = challengeId(course);
    return id ? cleanChallenge(JSON.parse(JSON.stringify(load().errorHunt.challenge[id]))) : blankChallenge();
  }

  // 抽選に使う履歴（そのコースだけ。じっくり練習・ほかのコースとは混ぜない）
  function getErrorChallengeHistory(course) {
    const r = getErrorChallenge(course);
    return { recentVariants: r.recentVariants, lastBases: r.lastBases };
  }

  /*
   * チャレンジの結果を記録する（5問を最後まで終えたときだけ。途中終了では呼ばない）。
   *   result = ChallengeSession#result()。そのコース以外・段位認定・じっくり練習の記録は変えない。
   *   戻り値 { newBest（自己ベスト更新。初挑戦は false）, firstTime, bestScore }
   */
  function recordErrorChallenge(course, result) {
    const id = challengeId(course || (result && result.course));
    if (!id || !result) return null;
    const c = load().errorHunt.challenge[id];
    const score = score100(result.score) || 0;
    const firstTime = c.bestScore === null;
    const newBest = !firstTime && score > c.bestScore;
    c.bestScore = firstTime ? score : Math.max(c.bestScore, score);
    c.playCount++;
    const items = (result.items || []).slice(0, 10);
    c.lastResult = {
      score: score, correct: result.correct, wrong: result.wrong, total: result.total, seed: result.seed,
      completedAt: new Date().toISOString(), newBest: newBest,
      items: items.map(function (it) {
        return { no: it.no, baseId: it.baseId, variantId: it.variantId, category: it.category, target: it.target, selected: it.selected, correct: it.correct === true };
      }),
    };
    items.forEach(function (it) {
      const prev = c.recentVariants[it.baseId] || [];
      c.recentVariants[it.baseId] = [it.variantId].concat(prev.filter(function (v) { return v !== it.variantId; })).slice(0, RECENT_KEEP);
    });
    c.lastBases = items.map(function (it) { return it.baseId; });
    save();
    return { newBest: newBest, firstTime: firstTime, bestScore: c.bestScore };
  }

  function getSound() { return load().sound !== false; }
  function setSound(on) { load().sound = !!on; save(); }

  // テスト用
  function _reset() { data = null; }

  PH.storage = {
    KEY: KEY,
    getProblem: getProblem,
    stageStats: stageStats,
    isReviewTarget: isReviewTarget,
    reviewProblems: reviewProblems,
    recordClear: recordClear,
    setLastProblem: setLastProblem,
    getLastProblem: getLastProblem,
    getLastPlay: getLastPlay,
    getPuzzleLevel: getPuzzleLevel,
    setPuzzleLevel: setPuzzleLevel,
    PUZZLE_LEVEL_IDS: LEVELS,
    hasHistory: hasHistory,
    getSound: getSound,
    setSound: setSound,
    getRank: getRank,
    getRankLegacy: getRankLegacy,
    recordRank: recordRank,
    RANK_TRACKS: TRACK_IDS,
    getErrorRecord: getErrorRecord,
    recordError: recordError,
    isErrorReviewTarget: isErrorReviewTarget,
    ERROR_CHALLENGE_IDS: CHALLENGE_IDS,
    getErrorChallenge: getErrorChallenge,
    getErrorChallengeHistory: getErrorChallengeHistory,
    recordErrorChallenge: recordErrorChallenge,
    _reset: _reset,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.storage;
})(typeof window !== 'undefined' ? window : globalThis);
