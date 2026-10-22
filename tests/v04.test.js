// 証明ハンター Ver.0.4 のテスト（解答レベル3段階・チャレンジの等式入力・数学キーパッド・レベル別の保存と移行）
// 実行: npm test
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');

require('../js/problems.js');
require('../js/geometry.js');
require('../js/validation.js');
require('../js/angle-expression.js');
require('../js/proof-rules.js');
require('../js/proof-engine.js');
require('../js/hints.js');
require('../js/storage.js');
require('../js/game.js');
require('../js/math-keypad.js');
require('../js/puzzle.js');

const PH = globalThis.PH;
const val = PH.validation;
const geo = PH.geometry;
const KP = PH.mathKeypad;
const TYPES = { easy: 'fill', standard: 'build', challenge: 'challenge' };

// 配置をまとめて入れる（チャレンジの等式は文字列で入力）
function fill(z, placement) {
  z.slots.forEach((s) => {
    if (placement[s.id] == null) return;
    z.selectSlot(s.id);
    const ok = s.input ? z.setInput(placement[s.id]) : z.place(placement[s.id]);
    assert.equal(ok, true, s.id + ' ' + placement[s.id]);
  });
}

function permutations(a) {
  if (a.length <= 1) return [a];
  return a.flatMap((x, i) => permutations(a.slice(0, i).concat(a.slice(i + 1))).map((r) => [x].concat(r)));
}

// ---- 解答レベル ---------------------------------------------------------------------

test('3つの解答レベルが定義され、表示名・説明・形式が正しい', () => {
  assert.deepEqual(PH.PUZZLE_LEVELS.map((l) => [l.id, l.label, l.type]), [
    ['easy', 'おてがる', 'fill'], ['standard', 'スタンダード', 'build'], ['challenge', 'チャレンジ', 'challenge'],
  ]);
  assert.equal(PH.getPuzzleLevel('standard').desc, '等式と理由を組み立てよう！');
  assert.equal(PH.getPuzzleLevel('???').id, 'easy');
});

// 多段階証明（STAGE 7。proofSteps あり）は根拠の行の数がちがうので、v07.test.js で同じ内容を確かめる
const SINGLE = PH.problems.filter((p) => !p.proofSteps);
// 全問題（多段階証明をのぞく）× 3レベル：正しい証明でクリア・根拠の順番の入れかえ・合同条件の誤り
SINGLE.forEach((p) => {
  Object.keys(TYPES).forEach((level) => {
    test(p.id + '（' + level + '）: 正しい証明でクリアでき、根拠の順番を入れかえても正解・合同条件の誤りでクリアできない', () => {
      const type = TYPES[level];
      const reasons = p.evidence.map((ev) => PH.puzzleUtil.reasonText(ev));
      permutations([0, 1, 2]).forEach((order) => {
        const z = new PH.Puzzle(p, type);
        fill(z, z.solution(order));
        // おてがるは理由が表示済みなので、同じ理由の行どうしの入れかえだけが正解
        const valid = type !== 'fill' || order.every((evIndex, row) => reasons[evIndex] === reasons[row]);
        assert.equal(z.check().status, valid ? 'clear' : 'wrong', order.join(''));
        if (valid) assert.equal(z.stars, 3);
      });
      const z = new PH.Puzzle(p, type);
      const sol = z.solution();
      const other = z.cards.cond.find((c) => c.cond !== p.congruence);
      fill(z, Object.assign({}, sol, { cond: other.id }));
      const r = z.check();
      assert.equal(r.status, 'wrong');
      assert.equal(r.result.slotStatus.cond, 'ng');
    });
  });
});

test('どのレベルでも、根拠にならない等式ではクリアできない', () => {
  PH.problems.forEach((p) => {
    // 図の上の辺の組から、根拠でない（まちがいの）等式を1つ探す
    const segs = geo.getElements(p.figure).segments;
    let wrong = null;
    for (let i = 0; i < segs.length && !wrong; i++) {
      for (let j = i + 1; j < segs.length && !wrong; j++) {
        if (val.equationStatus(p, [segs[i].key, segs[j].key]) === 'wrong-equation') wrong = [segs[i].name, segs[j].name];
      }
    }
    assert.ok(wrong, p.id);
    Object.values(TYPES).forEach((type) => {
      const z = new PH.Puzzle(p, type);
      const sol = z.solution();
      const eqSlot = z.eqSlotId(0);
      let placement;
      if (type === 'challenge') placement = Object.assign({}, sol, { [eqSlot]: wrong.join('=') });
      else {
        const evEq = p.evidence.map((ev) => val.equationKey(...ev.items.map((n) => geo.elementKey(p.figure, n))));
        placement = Object.assign({}, sol, { [eqSlot]: z.cards.eq.find((c) => !evEq.includes(c.eq)).id });
      }
      fill(z, placement);
      const r = z.check();
      assert.equal(r.status, 'wrong', p.id + ' ' + type);
      assert.equal(r.result.slotStatus[eqSlot], 'ng');
    });
  });
});

test('チャレンジでは等式カードを表示しない（理由・合同条件はカード）', () => {
  PH.problems.forEach((p) => {
    const z = new PH.Puzzle(p, 'challenge');
    assert.equal(z.cards.eq.length, 0);
    assert.ok(z.cards.reason.length >= 3);
    assert.equal(z.cards.cond.length, 3);
    z.selectSlot('e0');
    assert.deepEqual(z.cardsForActive(), []);
    assert.ok(z.slot('e0').input);
    assert.ok(!z.slot('r0').input);
  });
});

// ---- チャレンジの判定 -----------------------------------------------------------------

function challenge(id) {
  const p = PH.getProblem(id);
  const z = new PH.Puzzle(p, 'challenge');
  return { p, z, sol: z.solution() };
}

test('チャレンジ：頂点の対応順が合っていない等式は「対応順が合っていないよ」で正解にしない（ミスにもしない）', () => {
  // 正しい対応順：p01 △ABD≡△CBD（A↔C、B↔B、D↔D）
  const order = (id, a, b) => val.correspondenceOrder(PH.getProblem(id), [a, b]);
  assert.equal(order('p01', 'AB', 'CB'), 'ok');
  assert.equal(order('p01', 'BA', 'BC'), 'ok');
  assert.equal(order('p01', 'CB', 'AB'), 'ok');          // 左右を入れかえても対応は合っている
  assert.equal(order('p01', 'AB', 'BC'), 'order');
  assert.equal(order('p01', 'BD', 'BD'), 'ok');
  assert.equal(order('p01', 'BD', 'DB'), 'order');       // 共通な辺も、B↔B・D↔D の順に書く
  assert.equal(order('p04', 'BC', 'CB'), 'ok');          // △ABC≡△DCB は B↔C
  assert.equal(order('p04', 'BC', 'BC'), 'order');
  assert.equal(order('p02', '∠AOC', '∠BOD'), 'ok');
  assert.equal(order('p02', '∠COA', '∠DOB'), 'ok');
  assert.equal(order('p02', '∠AOC', '∠DOB'), 'order');
  assert.equal(order('p03', '∠BAC', '∠DCA'), 'ok');      // 一直線上の別名（O は AC 上）
  assert.equal(order('p03', '∠CAB', '∠DCA'), 'order');
  assert.equal(order('p14', '∠BAE', '∠CAD'), 'ok');
  assert.equal(order('p14', '∠BAE', '∠DAC'), 'order');

  let { z, sol } = challenge('p01');
  fill(z, Object.assign({}, sol, { e0: 'AB=BC' }));
  let r = z.check();
  assert.equal(r.status, 'wrong');
  assert.equal(r.result.slotStatus.e0, 'ng');
  assert.equal(r.result.slotStatus.r0, 'ok');
  assert.match(r.result.messages[0].text, /^対応順が合っていないよ/);
  assert.equal(z.misses, 0);                               // ミスにしない
  fill(z, { e0: 'BA=BC' });
  assert.equal(z.check().status, 'clear');
  assert.equal(z.stars, 3);

  // 理由も誤っているときは、両方を知らせる（理由の誤りだけミス）
  ({ z, sol } = challenge('p01'));
  fill(z, Object.assign({}, sol, { e0: 'AB=BC', r0: z.cards.reason.find((c) => c.reason === 'common').id }));
  r = z.check();
  assert.equal(r.result.slotStatus.e0, 'ng');
  assert.equal(r.result.slotStatus.r0, 'ng');
  assert.equal(z.misses, 1);

  // 穴埋め・組み立てのカードは正しい対応順で書かれているので影響しない
  ['fill', 'build'].forEach((type) => {
    const zz = new PH.Puzzle(PH.getProblem('p01'), type);
    fill(zz, zz.solution());
    assert.equal(zz.check().status, 'clear');
  });
});

test('チャレンジ：等式の左右・辺の向き・角の別表記・一直線上の点による角の別名を同じ等式として判定', () => {
  let { z, sol } = challenge('p01');
  fill(z, Object.assign({}, sol, { e0: 'CB=AB', e1: 'DA=DC', e2: 'DB=DB' }));
  assert.equal(z.check().status, 'clear');

  ({ z, sol } = challenge('p01'));
  fill(z, Object.assign({}, sol, { e0: 'BA=BC' }));
  assert.equal(z.check().status, 'clear');

  ({ z, sol } = challenge('p02'));
  fill(z, Object.assign({}, sol, { e2: '∠DOB=∠COA' }));                 // ∠AOC＝∠BOD
  assert.equal(z.check().status, 'clear');

  ({ z, sol } = challenge('p03'));
  fill(z, Object.assign({}, sol, { e1: '∠BAC=∠DCA', e2: '∠DBA=∠BDC' })); // ∠BAO＝∠DCO（O は AC 上）、∠ABO＝∠CDO
  assert.equal(z.check().status, 'clear');

  ({ z, sol } = challenge('p14'));
  fill(z, Object.assign({}, sol, { e2: '∠DAE=∠EAD' }));                 // 共通な角 ∠A（∠BAE＝∠CAD）
  assert.equal(z.check().status, 'clear');
});

test('チャレンジ：Ver.0.4 の判定メッセージ（理由の誤り・重複・結論から導く関係・まちがい・合同条件）', () => {
  let { z, sol } = challenge('p01');
  const common = z.cards.reason.find((c) => c.reason === 'common');
  fill(z, Object.assign({}, sol, { r0: common.id }));                     // AB＝CB に「共通な辺だから」
  let r = z.check();
  assert.equal(r.result.slotStatus.r0, 'ng');
  assert.equal(r.result.slotStatus.e0, 'ok');
  assert.equal(r.result.messages[0].text, '等式は合っているよ！ 理由をもう一度考えてみよう。');

  ({ z, sol } = challenge('p01'));
  fill(z, Object.assign({}, sol, { r1: sol.r0, e1: 'CB=AB' }));           // 同じ根拠を2回
  r = z.check();
  assert.ok(r.result.messages.some((m) => m.text === '同じ根拠が2回使われているよ！'));

  ({ z, sol } = challenge('p01'));
  fill(z, Object.assign({}, sol, { e0: '∠BAD=∠BCD' }));                   // 結論から導かれる関係
  r = z.check();
  assert.equal(r.result.slotStatus.e0, 'ng');
  assert.ok(r.result.messages.some((m) => m.text === 'それは合同が証明できてから使える関係だよ！'));

  ({ z, sol } = challenge('p01'));
  fill(z, Object.assign({}, sol, { e0: 'AB=AD' }));                       // まちがいの等式
  r = z.check();
  assert.ok(r.result.messages.some((m) => m.text === 'その2つが等しいと言えるか、図と仮定を確認しよう。'));

  ({ z, sol } = challenge('p01'));
  fill(z, Object.assign({}, sol, { cond: z.cards.cond.find((c) => c.cond === 'SAS').id }));
  r = z.check();
  assert.ok(r.result.messages.some((m) => m.text === '3つの根拠と合同条件の関係を確認しよう。'));
});

test('チャレンジ：平行線が2組ある問題では、どちらの平行線の錯角かを区別する（p13）', () => {
  const { z, sol } = challenge('p13');
  const g2 = z.cards.reason.find((c) => c.text.startsWith('AD∥BC'));
  fill(z, Object.assign({}, sol, { r0: g2.id }));   // ∠BAC＝∠DCA は AB∥DC の錯角
  assert.equal(z.check().result.slotStatus.r0, 'ng');
});

test('チャレンジ：図の上で角にならない入力・存在しない辺でもエラーにならず不正解になる', () => {
  let { z, sol } = challenge('p03');
  fill(z, Object.assign({}, sol, { e1: '∠OAC=∠OCA' }));     // O と C は A から見て同じ向き（角にならない）
  let r = z.check();
  assert.equal(r.result.slotStatus.e1, 'ng');
  ({ z, sol } = challenge('p01'));
  fill(z, Object.assign({}, sol, { e0: 'AC=BD' }));          // AC は図にかかれていない線分
  r = z.check();
  assert.equal(r.result.slotStatus.e0, 'ng');
});

test('チャレンジ：不正な入力は入らない・入力欄を切りかえても他の欄はこわれない', () => {
  const { z } = challenge('p02');
  z.selectSlot('e0');
  ['', 'AB', 'AB=C', 'AB=∠CDE', 'XY=ZW', 'AA=BO', '∠AOO=∠BOD', '<script>', null, undefined, '∠ABCD=∠EFGH'].forEach((bad) => {
    assert.equal(z.setInput(bad), false, String(bad));
  });
  assert.equal(z.setInput('ao = bo'), true);                 // 小文字・空白
  assert.equal(z.inputs.e0, 'AO=BO');
  z.selectSlot('e1');
  assert.equal(z.setInput('ＣＯ＝ＤＯ'), true);               // 全角
  assert.equal(z.inputs.e1, 'CO=DO');
  assert.equal(z.inputs.e0, 'AO=BO');
  z.selectSlot('e0');
  z.clearActive();
  assert.equal(z.inputs.e0, undefined);
  assert.equal(z.inputs.e1, 'CO=DO');
});

test('チャレンジ：同じ誤りのまま答え合わせをくり返してもミスは増えない（表記を変えただけでも同じ誤り）', () => {
  const { z, sol } = challenge('p01');
  fill(z, Object.assign({}, sol, { e0: 'AB=AD' }));
  z.check();
  assert.equal(z.misses, 1);
  fill(z, { e0: 'AD=BA' });
  z.check();
  assert.equal(z.misses, 1);
  fill(z, { e0: 'CB=CD' });
  z.check();
  assert.equal(z.misses, 2);
});

test('チャレンジのヒント：考え方 → 図の強調 → 正しい等式の表示。等式は自動で入力しない', () => {
  const { z } = challenge('p01');
  const h1 = z.useHint();
  assert.equal(h1.level, 1);
  assert.deepEqual(h1.focus, []);
  const h2 = z.useHint();
  assert.equal(h2.level, 2);
  assert.ok(h2.focus.length > 0);
  const h3 = z.useHint();
  assert.match(h3.text, /AB＝CB を使おう/);
  assert.deepEqual(z.inputs, {});
  assert.equal(z.useHint().isNew, false);
  assert.equal(z.hintsUsed, 3);
});

// ---- 数学キーパッド ---------------------------------------------------------------------

test('キーパッド：図にある頂点記号だけを使う', () => {
  assert.deepEqual(KP.lettersOf(PH.getProblem('p01').figure), ['A', 'B', 'C', 'D']);
  assert.deepEqual(KP.lettersOf(PH.getProblem('p02').figure), ['A', 'B', 'C', 'D', 'O']);
  const kp = KP.create(['A', 'B', 'C', 'D']);
  kp.setKind('seg');
  assert.equal(kp.press('O'), false);
  assert.equal(kp.press('Z'), false);
});

test('キーパッド：辺の等式・角の等式を入力でき、不完全なときは決定できない', () => {
  const kp = KP.create(['A', 'B', 'C', 'D', 'E', 'F']);
  assert.equal(kp.complete(), false);
  assert.equal(kp.press('A'), false);              // 種類を選ぶまでは入力できない
  kp.setKind('seg');
  assert.equal(kp.display(), '＿＿＝＿＿');
  kp.press('A');
  assert.equal(kp.display(), 'A＿＝＿＿');
  kp.press('B');                                   // 左辺が終わると、＝を押さなくても右辺へ進む
  assert.equal(kp.display(), 'AB＝＿＿');
  assert.equal(kp.complete(), false);
  assert.equal(kp.value(), null);
  assert.equal(kp.pressEq(), false);               // ＝ボタンは不要（押しても何も変わらない）
  kp.press('C');
  assert.equal(kp.display(), 'AB＝C＿');
  assert.equal(kp.complete(), false);
  kp.press('D');
  assert.equal(kp.complete(), true);
  assert.equal(kp.value(), 'AB=CD');

  kp.setKind('ang');                               // 種類を変えると入力はリセット
  assert.equal(kp.display(), '∠＿＿＿＝∠＿＿＿');
  ['A', 'B', 'C', 'D', 'E', 'F'].forEach((c) => assert.equal(kp.press(c), true));   // 6文字だけで入力完了
  assert.equal(kp.value(), '∠ABC=∠DEF');
  assert.equal(kp.press('A'), false);              // それ以上は入らない
  // キーボードの = を押しても同じ結果になる
  kp.clear();
  ['A', 'B', 'C'].forEach((c) => kp.press(c));
  kp.pressEq();
  ['D', 'E', 'F'].forEach((c) => kp.press(c));
  assert.equal(kp.value(), '∠ABC=∠DEF');
});

test('キーパッド：同じ辺・角の中で同じ文字は使えない', () => {
  const kp = KP.create(['A', 'B', 'C']);
  kp.setKind('seg');
  kp.press('A');
  assert.equal(kp.press('A'), false);              // AA は線分にならない
  kp.setKind('ang');
  kp.press('A'); kp.press('B');
  assert.equal(kp.press('B'), false);              // 頂点と端の点が同じ角は作れない
  assert.equal(kp.press('A'), false);
});

test('キーパッド：1文字削除・すべて消す・決定ずみの等式の読みこみ', () => {
  const kp = KP.create(['A', 'B', 'C', 'D']);
  kp.setKind('seg');
  ['A', 'B', 'C'].forEach((c) => kp.press(c));
  kp.backspace();
  assert.equal(kp.display(), 'AB＝＿＿');
  kp.backspace();                                  // ＝をまたいで、左辺の最後の文字を消す
  assert.equal(kp.display(), 'A＿＝＿＿');
  assert.equal(kp.press('C'), true);               // 左辺に入る
  assert.equal(kp.display(), 'AC＝＿＿');
  kp.backspace();
  kp.backspace();
  assert.equal(kp.isEmpty(), true);
  kp.clear();
  assert.equal(kp.isEmpty(), true);
  assert.equal(kp.backspace(), false);
  assert.equal(kp.load('cd = ab'), true);
  assert.equal(kp.value(), 'CD=AB');
  assert.equal(kp.load('XY=AB'), false);           // 図にない文字
});

test('キーパッド：文字列の正規化（小文字・全角・空白・< を ∠）と、不正な文字列でエラーにならない', () => {
  const L = ['A', 'B', 'C', 'D', 'E', 'F', 'O'];
  assert.equal(KP.parse('ab=cd', L).value, 'AB=CD');
  assert.equal(KP.parse(' ＡＢ ＝ ＣＤ ', L).value, 'AB=CD');
  assert.equal(KP.parse('∠abc=∠def', L).value, '∠ABC=∠DEF');
  assert.equal(KP.parse('<ABC=<DEF', L).value, '∠ABC=∠DEF');
  [undefined, null, 123, {}, '', '=', 'AB==CD', 'AB=CDE', 'AB=∠CDE', '∠AB=∠CD', 'A B C', '<img src=x>', 'AB=QQ', 'ＡＡ＝ＢＣ']
    .forEach((bad) => assert.equal(KP.parse(bad, L), null, String(bad)));
  // 表示用のHTMLは文字をエスケープする
  const kp = KP.create(['A', 'B', '<']);
  assert.ok(!KP.render(kp).includes('<script'));
});

// ---- 保存・移行 -------------------------------------------------------------------------

function withFakeStorage(initial, fn) {
  const mem = { [PH.storage.KEY]: initial };
  const fake = { getItem: (k) => (k in mem ? mem[k] : null), setItem: (k, v) => { mem[k] = String(v); } };
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { value: fake, configurable: true, writable: true });
  PH.storage._reset();
  try { fn(mem); } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
    PH.storage._reset();
  }
}

const V03 = JSON.stringify({
  version: 3,
  problems: { p01: { cleared: true, bestStars: 3, minMisses: 0 } },
  puzzleProblems: {
    p01: { cleared: true, bestStars: 2, minMisses: 1 },   // Ver.0.3 では穴埋め → おてがる
    p08: { cleared: true, bestStars: 3, minMisses: 0 },   // Ver.0.3 では組み立て → スタンダード
    p05: { cleared: false, bestStars: 0, minMisses: null },
  },
  lastProblemId: 'p01', lastPuzzleProblemId: 'p08', lastMode: 'puzzle', sound: true,
});

test('Ver.0.3 の記録を移行：穴埋め→おてがる、組み立て→スタンダード、チャレンジは未クリア', () => {
  withFakeStorage(V03, (mem) => {
    assert.deepEqual(PH.storage.getProblem('p01', 'puzzle:easy'), { cleared: true, bestStars: 2, minMisses: 1 });
    assert.equal(PH.storage.getProblem('p01', 'puzzle:standard').cleared, false);
    assert.equal(PH.storage.getProblem('p08', 'puzzle:standard').bestStars, 3);
    assert.equal(PH.storage.getProblem('p08', 'puzzle:easy').cleared, false);
    assert.equal(PH.storage.getProblem('p05', 'puzzle:easy').cleared, false);        // 未クリアは移行しない
    PH.problems.forEach((p) => assert.equal(PH.storage.getProblem(p.id, 'puzzle:challenge').cleared, false));
    // ハンター・旧記録は変わらない
    assert.equal(PH.storage.getProblem('p01').bestStars, 3);
    assert.equal(PH.storage.getProblem('p01', 'puzzle').bestStars, 2);
    assert.equal(PH.storage.getPuzzleLevel(), 'easy');
    assert.deepEqual(PH.storage.getLastPlay(), { mode: 'puzzle', id: 'p08' });
    PH.storage.setPuzzleLevel('challenge');
    const saved = JSON.parse(mem[PH.storage.KEY]);
    assert.ok(saved.version >= 4);
    assert.equal(saved.puzzleMigrated, true);
    assert.equal(saved.puzzleProblems.p01.bestStars, 2);                              // 旧データは消さない
    assert.equal(saved.puzzleLevels.easy.p01.bestStars, 2);
    assert.deepEqual(saved.puzzleLevels.challenge, {});
    assert.equal(saved.puzzleLevel, 'challenge');
  });
});

test('移行は1回だけ（くり返し読みこんでも二重に移行せず、新しい記録を上書きしない）', () => {
  withFakeStorage(V03, (mem) => {
    PH.storage.recordClear('p01', 3, 0, 'puzzle:easy');   // 移行後におてがるで★3
    PH.storage._reset();                                  // 読みこみ直し
    assert.equal(PH.storage.getProblem('p01', 'puzzle:easy').bestStars, 3);
    // 旧記録が残っていても、移行ずみなので再び移行しない
    const d = JSON.parse(mem[PH.storage.KEY]);
    delete d.puzzleLevels.standard.p08;
    mem[PH.storage.KEY] = JSON.stringify(d);
    PH.storage._reset();
    assert.equal(PH.storage.getProblem('p08', 'puzzle:standard').cleared, false);
  });
});

test('解答レベルごとに評価・ステージ集計・復習対象が独立する', () => {
  withFakeStorage(null, () => {
    assert.equal(PH.storage.getPuzzleLevel(), 'easy');                               // 初期値
    PH.storage.recordClear('p01', 3, 0, 'puzzle:easy');
    PH.storage.recordClear('p01', 2, 1, 'puzzle:standard');
    PH.storage.recordClear('p04', 1, 5, 'puzzle:challenge');
    assert.equal(PH.storage.stageStats(1, 'puzzle:easy').stars, 3);
    assert.equal(PH.storage.stageStats(1, 'puzzle:standard').stars, 2);
    assert.equal(PH.storage.stageStats(1, 'puzzle:challenge').cleared, 1);
    assert.ok(!PH.storage.isReviewTarget('p01', 'puzzle:easy'));
    assert.ok(PH.storage.isReviewTarget('p01', 'puzzle:standard'));
    assert.ok(PH.storage.isReviewTarget('p01', 'puzzle:challenge'));
    assert.equal(PH.storage.reviewProblems('puzzle:easy').length, PH.problems.length - 1);
    assert.equal(PH.storage.getProblem('p01').cleared, false);                       // ハンターには影響しない
    assert.equal(PH.storage.setPuzzleLevel('expert'), false);
    assert.equal(PH.storage.getPuzzleLevel(), 'easy');
  });
});

test('壊れた保存データでも安全に読みこむ', () => {
  withFakeStorage(JSON.stringify({ puzzleLevels: { easy: [1], standard: 'x' }, puzzleLevel: 'hard', puzzleProblems: 7 }), () => {
    assert.equal(PH.storage.getPuzzleLevel(), 'easy');
    assert.equal(PH.storage.getProblem('p01', 'puzzle:easy').cleared, false);
    PH.storage.recordClear('p02', 3, 0, 'puzzle:standard');
    assert.equal(PH.storage.getProblem('p02', 'puzzle:standard').bestStars, 3);
  });
});

test('LocalStorage が使えない環境でも解答レベル・記録が動く', () => {
  const desc = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', { get() { throw new Error('denied'); }, configurable: true });
  PH.storage._reset();
  try {
    PH.storage.setPuzzleLevel('standard');
    assert.equal(PH.storage.getPuzzleLevel(), 'standard');
    PH.storage.recordClear('p03', 2, 1, 'puzzle:standard');
    assert.equal(PH.storage.getProblem('p03', 'puzzle:standard').bestStars, 2);
  } finally {
    if (desc) Object.defineProperty(globalThis, 'localStorage', desc);
    else delete globalThis.localStorage;
    PH.storage._reset();
  }
});

test('全問題の根拠（evidence の書き方）は、どれも頂点の対応順が合っている', () => {
  PH.problems.forEach((p) => {
    p.evidence.forEach((ev) => {
      assert.equal(val.correspondenceOrder(p, ev.items), 'ok', p.id + ' ' + ev.label);
    });
  });
});

test('上位の解答レベルで★★★を取ると、同じ問題の下位レベルも★★★になる', () => {
  withFakeStorage(null, () => {
    const S = PH.storage;
    // チャレンジで★★★ → おてがる・スタンダードも★★★
    let r = S.recordClear('p01', 3, 0, 'puzzle:challenge');
    assert.deepEqual(r.lowered, ['easy', 'standard']);
    ['easy', 'standard', 'challenge'].forEach((lv) => {
      const rec = S.getProblem('p01', 'puzzle:' + lv);
      assert.equal(rec.cleared, true, lv);
      assert.equal(rec.bestStars, 3, lv);
    });
    assert.equal(S.getProblem('p02', 'puzzle:easy').cleared, false);          // ほかの問題は変わらない
    assert.equal(S.getProblem('p01').cleared, false);                          // ハンターは変わらない

    // スタンダードで★★★ → おてがるだけ。チャレンジは変わらない
    S.recordClear('p02', 2, 1, 'puzzle:easy');
    r = S.recordClear('p02', 3, 0, 'puzzle:standard');
    assert.deepEqual(r.lowered, ['easy']);
    assert.equal(S.getProblem('p02', 'puzzle:easy').bestStars, 3);
    assert.equal(S.getProblem('p02', 'puzzle:easy').minMisses, 0);
    assert.equal(S.getProblem('p02', 'puzzle:challenge').cleared, false);

    // ★★以下では下位レベルは変わらない。すでに★★★なら lowered に入らない
    r = S.recordClear('p03', 2, 1, 'puzzle:challenge');
    assert.deepEqual(r.lowered, []);
    assert.equal(S.getProblem('p03', 'puzzle:easy').cleared, false);
    r = S.recordClear('p02', 3, 0, 'puzzle:challenge');
    assert.deepEqual(r.lowered, []);

    // おてがるで★★★でも上位レベルは変わらない
    S.recordClear('p05', 3, 0, 'puzzle:easy');
    assert.equal(S.getProblem('p05', 'puzzle:standard').cleared, false);
    assert.equal(S.stageStats(PH.getProblem('p01').stage, 'puzzle:easy').stars >= 3, true);
  });
});
