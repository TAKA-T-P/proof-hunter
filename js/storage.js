/*
 * storage.js — 学習進捗の保存（LocalStorage）
 *
 * LocalStorage が使えない（プライベートモード等）場合はメモリ上だけで動作し、
 * ゲームの進行は妨げない。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};
  const KEY = 'proofHunter.v1';

  function blank() {
    return { problems: {}, lastProblemId: null, sound: true };
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

  function getProblem(id) {
    return load().problems[id] || { cleared: false, bestStars: 0, minMisses: null };
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
