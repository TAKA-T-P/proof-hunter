/*
 * storage.js — 学習進捗の保存（LocalStorage）
 *
 * LocalStorage が使えない（プライベートモード等）場合はメモリ上だけで動作し、
 * ゲームの進行は妨げない。
 *
 * 保存形式（キー proofHunter.v1。Ver.0.1 のデータをそのまま読める）
 *   { version: 2, problems: { p01: { cleared, bestStars, minMisses }, ... }, lastProblemId, sound }
 *   version は Ver.0.2 で追加（Ver.0.1 のデータには無い）。過去のプレイ内容は推測で補わない。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const KEY = 'proofHunter.v1';

  const VERSION = 2;

  function blank() {
    return { version: VERSION, problems: {}, lastProblemId: null, sound: true };
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
          data.problems = parsed.problems && typeof parsed.problems === 'object' ? parsed.problems : {};
          data.lastProblemId = parsed.lastProblemId || null;
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
  function getProblem(id) {
    const r = load().problems[id];
    if (!r || typeof r !== 'object') return { cleared: false, bestStars: 0, minMisses: null };
    const stars = Math.round(Number(r.bestStars));
    return {
      cleared: !!r.cleared,
      bestStars: stars >= 0 && stars <= 3 ? stars : 0,
      minMisses: typeof r.minMisses === 'number' && r.minMisses >= 0 ? r.minMisses : null,
    };
  }

  // クリアを記録。最高評価・最少ミスを更新した場合 improved: true
  function recordClear(id, stars, misses) {
    const d = load();
    const prev = getProblem(id);
    const next = {
      cleared: true,
      bestStars: Math.max(prev.bestStars || 0, stars),
      minMisses: prev.minMisses == null ? misses : Math.min(prev.minMisses, misses),
    };
    d.problems[id] = next;
    save();
    return { improved: !prev.cleared || stars > (prev.bestStars || 0), record: next };
  }

  // ---- ステージ・復習（PH.problems を参照して集計） --------------------------

  function stageStats(stageId) {
    const list = PH.stageProblems(stageId);
    const records = list.map(function (p) { return getProblem(p.id); });
    const cleared = records.filter(function (r) { return r.cleared; }).length;
    return {
      total: list.length,
      cleared: cleared,
      stars: records.reduce(function (sum, r) { return sum + (r.cleared ? r.bestStars : 0); }, 0),
      maxStars: list.length * 3,
      complete: list.length > 0 && cleared === list.length,
      problems: list,
      records: records,
    };
  }

  // 復習対象：未クリア、または最高評価が★★以下の問題（★★★は対象外）
  function isReviewTarget(id) {
    const r = getProblem(id);
    return !r.cleared || r.bestStars < 3;
  }

  function reviewProblems() {
    return PH.problems.filter(function (p) { return isReviewTarget(p.id); });
  }

  function setLastProblem(id) {
    load().lastProblemId = id;
    save();
  }

  function getLastProblem() { return load().lastProblemId; }

  function hasHistory() {
    const d = load();
    return !!d.lastProblemId || Object.keys(d.problems).length > 0;
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
    hasHistory: hasHistory,
    getSound: getSound,
    setSound: setSound,
    _reset: _reset,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.storage;
})(typeof window !== 'undefined' ? window : globalThis);
