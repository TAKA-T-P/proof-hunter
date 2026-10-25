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

  // 正解の「ピコーン」：短い高い音（ピ）のあと、さらに高い音を長めに響かせる（コーン）。
  // 1オクターブ上の三角波を小さく重ねて、明るく澄んだ音にする（段位認定・ランダムチャレンジの正解）
  function pikon() {
    play([[1319, 0, 0.07], [1976, 0.065, 0.42]], 'sine', 0.075);
    play([[2638, 0, 0.05], [3951, 0.065, 0.25]], 'triangle', 0.012);
  }

  const sounds = {
    tap:     function () { play([[880, 0, 0.05]], 'triangle', 0.04); },
    correct: pikon,                                                                           // ランダム5問チャレンジの正解
    wrong:   function () { play([[220, 0, 0.12], [185, 0.08, 0.16]], 'triangle', 0.06); },
    // 正しいけれど今回は使わない関係：ブザーより柔らかい「ポロン」（高めの音から少し下がる）
    soft:    function () { play([[784, 0, 0.12], [659, 0.1, 0.2]], 'sine', 0.05); },
    get:     function () { play([[784, 0, 0.08], [988, 0.07, 0.08], [1319, 0.14, 0.18]], 'sine', 0.07); },
    success: function () {
      play([[523, 0, 0.12], [659, 0.11, 0.12], [784, 0.22, 0.12], [1047, 0.33, 0.35]], 'sine', 0.08);
    },
    // ---- 段位認定（Ver.0.6）。どれも短く、音量は控えめ ----
    count:   function () { play([[660, 0, 0.08]], 'square', 0.03); },                       // カウントダウン
    start:   function () { play([[880, 0, 0.08], [1320, 0.07, 0.16]], 'square', 0.035); },  // START
    rankOk:  pikon,                                                                           // 正解（「ピコーン」。次の問題を待たずに鳴り終わる長さ）
    rankNg:  function () { play([[247, 0, 0.1]], 'triangle', 0.05); },                       // 不正解・パス
    combo:   function () { play([[988, 0, 0.06], [1319, 0.05, 0.06], [1568, 0.1, 0.12]], 'sine', 0.05); },
    zone:    function () { play([[523, 0, 0.08], [784, 0.07, 0.08], [1047, 0.14, 0.14]], 'square', 0.03); },
    warn:    function () { play([[1047, 0, 0.06], [1047, 0.12, 0.06]], 'sine', 0.035); },    // 残り10秒
    timeup:  function () { play([[784, 0, 0.12], [523, 0.1, 0.12], [392, 0.2, 0.3]], 'triangle', 0.06); },
    certify: function () {                                                                    // 段位認定
      play([[523, 0, 0.1], [659, 0.09, 0.1], [784, 0.18, 0.1], [1047, 0.27, 0.3]], 'sine', 0.06);
    },
    record:  function () {                                                                    // 自己ベスト更新
      play([[784, 0, 0.08], [988, 0.07, 0.08], [1175, 0.14, 0.08], [1568, 0.21, 0.3]], 'sine', 0.06);
    },
  };

  PH.sound = {
    play: function (name) { if (sounds[name]) sounds[name](); },
    setEnabled: function (on) { enabled = !!on; },
    isEnabled: function () { return enabled; },
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.sound;
})(typeof window !== 'undefined' ? window : globalThis);
