/*
 * sound.js — Web Audio API による短い効果音（音声ファイル不要）
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  let ctx = null;
  let enabled = true;

  function audio() {
    if (ctx) return ctx;
    const AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return null;
    try { ctx = new AC(); } catch (e) { ctx = null; }
    return ctx;
  }

  // 音符列を鳴らす: [周波数Hz, 開始秒, 長さ秒]
  function play(notes, type, volume) {
    if (!enabled) return;
    const ac = audio();
    if (!ac) return;
    try {
      if (ac.state === 'suspended') ac.resume();
      const t0 = ac.currentTime + 0.01;
      notes.forEach(function (n) {
        const osc = ac.createOscillator();
        const gain = ac.createGain();
        osc.type = type || 'sine';
        osc.frequency.value = n[0];
        const start = t0 + n[1];
        const end = start + n[2];
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(volume || 0.08, start + 0.012);
        gain.gain.exponentialRampToValueAtTime(0.0001, end);
        osc.connect(gain).connect(ac.destination);
        osc.start(start);
        osc.stop(end + 0.02);
      });
    } catch (e) { /* 音が鳴らなくても続行 */ }
  }

  const sounds = {
    tap:     function () { play([[880, 0, 0.05]], 'triangle', 0.04); },
    correct: function () { play([[660, 0, 0.09], [990, 0.07, 0.12]], 'sine', 0.07); },
    wrong:   function () { play([[220, 0, 0.12], [185, 0.08, 0.16]], 'triangle', 0.06); },
    // 正しいけれど今回は使わない関係：ブザーより柔らかい「ポロン」（高めの音から少し下がる）
    soft:    function () { play([[784, 0, 0.12], [659, 0.1, 0.2]], 'sine', 0.05); },
    get:     function () { play([[784, 0, 0.08], [988, 0.07, 0.08], [1319, 0.14, 0.18]], 'sine', 0.07); },
    success: function () {
      play([[523, 0, 0.12], [659, 0.11, 0.12], [784, 0.22, 0.12], [1047, 0.33, 0.35]], 'sine', 0.08);
    },
  };

  PH.sound = {
    play: function (name) { if (sounds[name]) sounds[name](); },
    setEnabled: function (on) { enabled = !!on; },
    isEnabled: function () { return enabled; },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.sound;
})(typeof window !== 'undefined' ? window : globalThis);
