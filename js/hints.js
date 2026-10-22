/*
 * hints.js — 段階式ヒント
 *
 * 対象の選び方：
 *   根拠収集中   … 問題データの順で「まだ見つけていない根拠」の最初のもの（直角三角形の問題は、今集めている欄の根拠）
 *   合同条件選択 … hints.congruence（Ver.0.9：平行四辺形の根拠 … hints.q1 など、成立条件 … hints.pcondition）
 *   三角形の選択 … hints.triangleSelection、最終結論 … hints.finalStep（Ver.0.5。最終段階でも自動では答えを入れない）
 * 同じ対象には 1→2→3 段階の順に表示。最終段階は繰り返し表示できる（回数は増えない）。
 */
(function (root) {
  'use strict';
  const PH = root.PH = root.PH || {};

  function targetId(problem, game) {
    if (game.phase === 'triangle') return 'triangleSelection';   // Ver.0.5：証明する三角形を選ぶ
    if ((game.phase === 'step' || game.phase === 'post') && game.stepId) return game.stepId;   // Ver.0.7：多段階証明のステップ
    if (game.phase === 'final') return 'finalStep';              // Ver.0.5：合同から結論を導く
    if (game.phase === 'congruence') return 'congruence';
    // Ver.0.9：平行四辺形の根拠（まだ見つけていない最初のもの）と成立条件
    if (game.phase === 'qcondition') return 'pcondition';
    if (game.phase === 'qcollect') {
      const q = game.quadEvidence().find(function (e) { return game.qfound.indexOf(e.id) < 0; });
      return q ? q.id : null;
    }
    if (game.phase !== 'collect') return null;
    // Ver.0.8：直角三角形の問題は、今集めている欄（直角・斜辺・他の1辺・鋭角）の根拠
    if (game.isRight && game.isRight() && game.role) {
      const ev = PH.rightTriangle.evidenceForRole(problem, game.role);
      if (ev && game.found.indexOf(ev.id) < 0) return ev.id;
    }
    const next = problem.evidence.find(function (e) { return game.found.indexOf(e.id) < 0; });
    return next ? next.id : null;
  }

  // 次に表示するヒント（状態は変更しない）
  function next(problem, game) {
    const id = targetId(problem, game);
    if (!id) return null;
    const list = (problem.hints && problem.hints[id]) || [];
    if (!list.length) return null;
    const current = game.hintLevels[id] || 0;
    const level = Math.min(current + 1, list.length);
    const item = list[level - 1];
    const focus = (item.focus || []).map(function (n) {
      return PH.geometry.elementKey(problem.figure, n);
    });
    return {
      targetId: id,
      level: level,
      max: list.length,
      text: item.text,
      focus: focus,
      isNew: level > current,
    };
  }

  // ヒントのポップアップを表示する（DOM）
  function show(popup, hint, hintsUsed) {
    if (!popup) return;
    if (!hint) {
      popup.querySelector('.hint-level').textContent = 'ヒント';
      popup.querySelector('.hint-text').textContent = '今はヒントはないよ。';
    } else {
      popup.querySelector('.hint-level').textContent = 'ヒント ' + hint.level + '/' + hint.max;
      popup.querySelector('.hint-text').textContent = hint.text;
    }
    popup.querySelector('.hint-count').textContent = 'ヒント使用：' + hintsUsed + '回';
    popup.hidden = false;
    popup.classList.remove('pop');
    void popup.offsetWidth; // アニメーションを再開
    popup.classList.add('pop');
  }

  function hide(popup) {
    if (popup) popup.hidden = true;
  }

  PH.hints = { targetId: targetId, next: next, show: show, hide: hide };

  if (typeof module !== 'undefined' && module.exports) module.exports = PH.hints;
})(typeof window !== 'undefined' ? window : globalThis);
