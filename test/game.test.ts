import assert from "node:assert/strict";
import {test} from "node:test";

import {
  bestMove,
  botMove,
  outcomeOf,
  parseSerialized,
  place,
  serializeState,
  winnerOf,
} from "../example-game/src/Game.ts";

test("place ставит фигуру в указанную клетку", () => {
  assert.equal(place("---------", 4, "X"), "----X----");
  assert.equal(place("----X----", 0, "O"), "O---X----");
});

test("winnerOf находит победную линию", () => {
  assert.equal(winnerOf("XXX------"), "X");
  assert.equal(winnerOf("--O-O-O--"), "O");
  assert.equal(winnerOf("X-------X"), null);
});

test("outcomeOf различает win, loss, draw и незавершённую партию", () => {
  assert.equal(outcomeOf("XXX------", "X"), "win");
  assert.equal(outcomeOf("XXX------", "O"), "loss");
  assert.equal(outcomeOf("XOXXOOOXX", "X"), "draw");
  assert.equal(outcomeOf("XOXXOOOXX", "O"), "draw");
  assert.equal(outcomeOf("X--------", "X"), null);
});

test("бот выигрывает, если может", () => {
  assert.equal(botMove("XX-O-----", "X"), 2);
});

test("бот блокирует угрозу соперника", () => {
  assert.equal(botMove("XX-O-----", "O"), 2);
});

test("бот занимает центр, если он свободен", () => {
  assert.equal(botMove("X--------", "O"), 4);
});

test("бот идёт в угол, если центр занят", () => {
  const move = botMove("----X----", "O");
  assert.ok([0, 2, 6, 8].includes(move), `ожидали угол, получено ${move}`);
});

test("бот всегда ходит в свободную клетку", () => {
  const boards = ["---------", "XO-------", "XOX-O----", "O-XO-X---", "XOXOXO---"];
  for (const board of boards) {
    assert.equal(board.length, 9);
    for (const mark of ["X", "O"] as const) {
      const move = botMove(board, mark);
      assert.notEqual(move, -1);
      assert.equal(board[move], "-", `ход в занятую клетку: ${board}, ${mark} → ${move}`);
    }
  }
});

test("подсказка выигрывает немедленно", () => {
  assert.equal(bestMove("XX-O-----", "X"), 2);
  assert.equal(bestMove("X-X-O-O--", "X"), 1);
});

test("подсказка блокирует немедленную угрозу", () => {
  assert.equal(bestMove("OO-X-----", "X"), 2);
});

test("подсказка не даёт проиграть: на противоположных углах O спасает только центр", () => {
  // 6 из 7 ходов O здесь проигрывают, единственная ничья — центр
  assert.equal(bestMove("X-------X", "O"), 4);
});

test("подсказка никогда не выбирает проигрыш, пока есть не-проигрышный ход", () => {
  const LINES: [number, number, number][] = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  const winner = (b: string): string | null => {
    for (const [a, c, d] of LINES) if (b[a] !== "-" && b[a] === b[c] && b[c] === b[d]) return b[a];
    return null;
  };
  // Оценка позиции для проверки выбранного подсказкой хода.
  const score = (board: string, mark: "X" | "O", depth: number): number => {
    const w = winner(board);
    if (w !== null) return w === mark ? 10 - depth : depth - 10;
    if (!board.includes("-")) return 0;
    let best = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== "-") continue;
      const other: "X" | "O" = mark === "X" ? "O" : "X";
      best = Math.max(best, -score(board.slice(0, i) + mark + board.slice(i + 1), other, depth + 1));
    }
    return best;
  };

  const seen = new Set<string>();
  const walk = (board: string, mark: "X" | "O"): void => {
    if (winner(board) !== null || !board.includes("-") || seen.has(board)) return;
    seen.add(board);
    let bestAvailable = -Infinity;
    for (let i = 0; i < 9; i++) {
      if (board[i] !== "-") continue;
      const other: "X" | "O" = mark === "X" ? "O" : "X";
      bestAvailable = Math.max(bestAvailable, -score(board.slice(0, i) + mark + board.slice(i + 1), other, 1));
    }
    if (bestAvailable >= 0) {
      // При наличии хода без поражения подсказка должна выбрать один из таких ходов.
      const chosen = bestMove(board, mark);
      const chosenScore = -score(board.slice(0, chosen) + mark + board.slice(chosen + 1), mark === "X" ? "O" : "X", 1);
      assert.ok(chosenScore >= 0, `в позиции ${board} ход ${mark}→${chosen} проигрывает (${chosenScore})`);
    }
    for (let i = 0; i < 9; i++) {
      if (board[i] !== "-") continue;
      walk(board.slice(0, i) + mark + board.slice(i + 1), mark === "X" ? "O" : "X");
    }
  };
  walk("---------", "X");
  assert.ok(seen.size > 1000, `обойдено слишком мало позиций: ${seen.size}`);
});

test("подсказка детерминирована: на пустом поле берёт первую клетку", () => {
  // При оптимальной игре обеих сторон любой первый ход ведёт к ничьей; выбирается первая клетка.
  assert.equal(bestMove("---------", "X"), 0);
});

test("идеальная игра подсказок из каждого первого хода приводит к ничьей", () => {
  for (const first of [0, 1, 2, 3, 4]) {
    let board = place("---------", first, "X");
    let mark: "X" | "O" = "O";
    while (winnerOf(board) === null && board.includes("-")) {
      const move = bestMove(board, mark);
      assert.notEqual(move, -1, `позиция ${board}, фигура ${mark}`);
      board = place(board, move, mark);
      mark = mark === "X" ? "O" : "X";
    }
    assert.equal(winnerOf(board), null, `после первого хода ${first} кто-то выиграл: ${board}`);
  }
});

test("serializeState/parseSerialized обратимы", () => {
  assert.equal(serializeState("XO-------", "X"), "XO-------/X");
  assert.deepEqual(parseSerialized("XO-------/X"), {board: "XO-------", turn: "X"});
  const finished = "X-OXXO--O/X"; // победили O, ход переходит X
  const parsed = parseSerialized(finished);
  assert.equal(serializeState(parsed.board, parsed.turn), finished);
});

test("parseSerialized принимает завершённые позиции", () => {
  assert.doesNotThrow(() => parseSerialized("X-OXXO--O/X")); // победили O при равенстве фигур
  assert.doesNotThrow(() => parseSerialized("XXXOO----/O")); // победили X
  assert.doesNotThrow(() => parseSerialized("XOXOXOXOX/O")); // ничья
});

test("parseSerialized бросает на битой строке", () => {
  assert.throws(() => parseSerialized("XO------/O")); // мало символов
  assert.throws(() => parseSerialized("XO-------X/")); // разделитель не на своём месте
  assert.throws(() => parseSerialized("xo-------/X")); // недопустимые символы поля
  assert.throws(() => parseSerialized("XO-------/Q")); // недопустимый символ хода
  assert.throws(() => parseSerialized("O--------/X")); // O не может ходить первой
  assert.throws(() => parseSerialized("XX-------/O")); // разрыв в фигуры больше 1 недопустим
  assert.throws(() => parseSerialized("X--------/X")); // ход не соответствует раскладке
  assert.throws(() => parseSerialized("OXXXOX--O/O")); // победили O, но последним ходил X
});
