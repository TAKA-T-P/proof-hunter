/*
 * storage.js — 学習進捗の保存（LocalStorage）
 *
 * LocalStorage が使えない（プライベートモード等）場合はメモリ上だけで動作し、
 * ゲームの進行は妨げない。
 *
 * 保存形式（キー proofHunter.v1。Ver.0.1・0.2 のデータをそのまま読める）
 *   {
 *     version: 3,
 *     problems:       { p01: { cleared, bestStars, minMisses }, ... },   // ハンターモード（Ver.0.1〜）
 *     puzzleProblems: { p01: { cleared, bestStars, minMisses }, ... },   // 証明パズル（Ver.0.3〜）
 *     lastProblemId, lastPuzzleProblemId, lastMode: 'hunter' | 'puzzle', sound
 *   }
 *   記録はモードごとに別々。古いデータに無い項目は空として読み、過去のプレイ内容は推測で補わない。
 *   関数の mode 引数は 'hunter'（省略時）または 'puzzle'。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const KEY = 'proofHunter.v1';

  const VERSION = 3;

  function blank() {
    return {
      version: VERSION, problems: {}, puzzleProblems: {},
      lastProblemId: null, lastPuzzleProblemId: null, lastMode: null, sound: true,
    };
  }

  function isObj(v) { return !!v && typeof v === 'object' && !Array.isArray(v); }

  // モードごとの記録の入れ物
  function records(mode) {
    const d = load();
    return mode === 'puzzle' ? d.puzzleProblems : d.problems;
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
          data.lastProblemId = typeof parsed.lastProblemId === 'string' ? parsed.lastProblemId : null;
          data.lastPuzzleProblemId = typeof parsed.lastPuzzleProblemId === 'string' ? parsed.lastPuzzleProblemId : null;
          data.lastMode = parsed.lastMode === 'puzzle' || parsed.lastMode === 'hunter' ? parsed.lastMode : null;
          data.sound = parsed.sound !== false;
          data.version = VERSION;
        }
      }
    } catch (e) { /* 壊れたデータは無視 */ }
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

  // クリアを記録。最高評価・最少ミスを更新した場合 improved: true
  function recordClear(id, stars, misses, mode) {
    const prev = getProblem(id, mode);
    const next = {
      cleared: true,
      bestStars: Math.max(prev.bestStars || 0, stars),
      minMisses: prev.minMisses == null ? misses : Math.min(prev.minMisses, misses),
    };
    records(mode)[id] = next;
    save();
    return { improved: !prev.cleared || stars > (prev.bestStars || 0), record: next };
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

  // 最後にプレイした問題（モードごと）と、最後にプレイしたモード
  function setLastProblem(id, mode) {
    const d = load();
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
      Object.keys(d.problems).length > 0 || Object.keys(d.puzzleProblems).length > 0;
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
    hasHistory: hasHistory,
    getSound: getSound,
    setSound: setSound,
    _reset: _reset,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.storage;
})(typeof window !== 'undefined' ? window : globalThis);
