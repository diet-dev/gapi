/**
 * Крестики-нолики 3×3 на канвасе: человек против бота.
 * Единственный DOM-элемент, известный игре, — переданный ей канвас.
 */

import {type Scene, Animations} from "./Animation.ts";
import {HintAnimation} from "./HintAnimation.ts";
import {drawMark} from "./drawMark.ts";

export type Mark = "X" | "O";
export type FirstMove = "human" | "computer" | "alternate" | "random";
export type Outcome = "win" | "loss" | "draw";
export type GameOverResult = {outcome: Outcome};
/** Аргумент события "move": строка сериализации позиции после хода. */
export type MoveEvent = {state: string};
/** Аргумент события "newGame": строка сериализации свежей позиции. */
export type NewGameEvent = {state: string};
/** Аргумент события "undo": строка сериализации позиции после отката. */
export type UndoEvent = {state: string};

export type Props = {
  /** Кто начинает партию: человек, бот, поочерёдно или случайно. */
  firstMove: FirstMove;
  /** Вызывается в конце партии наряду с событием "gameOver". */
  onGameOver?: (result: GameOverResult) => void;
  /** Вызывается после каждого хода наряду с событием "move". */
  onMove?: (event: MoveEvent) => void;
  /** Вызывается при старте новой партии наряду с событием "newGame". */
  onNewGame?: (event: NewGameEvent) => void;
};

type GameEvents = {
  gameOver: GameOverResult;
  move: MoveEvent;
  newGame: NewGameEvent;
  undo: MoveEvent;
};

/** Победные линии; клетки пронумерованы по строкам слева направо, сверху вниз. */
export const LINES: readonly (readonly [number, number, number])[] = [
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  [0, 4, 8],
  [2, 4, 6],
];

const OTHER: Record<Mark, Mark> = {X: "O", O: "X"};

/** Поставить фигуру в клетку index (0–8), вернув новое поле. */
export function place(board: string, index: number, mark: Mark): string {
  return board.slice(0, index) + mark + board.slice(index + 1);
}

/** Фигура соперника. */
export function other(mark: Mark): Mark {
  return OTHER[mark];
}

/** Собрана ли победная линия у mark. */
export function hasWin(board: string, mark: Mark): boolean {
  return LINES.some(([a, b, c]) => board[a] === mark && board[b] === mark && board[c] === mark);
}

/** Победитель, если линия собрана. */
export function winnerOf(board: string): Mark | null {
  if (hasWin(board, "X")) return "X";
  if (hasWin(board, "O")) return "O";
  return null;
}

/** Поле заполнено полностью. */
export function isFull(board: string): boolean {
  return !board.includes("-");
}

/** Исход партии с точки зрения человека; null — партия ещё не завершена. */
export function outcomeOf(board: string, humanMark: Mark): Outcome | null {
  const w = winnerOf(board);
  if (w) return w === humanMark ? "win" : "loss";
  return isFull(board) ? "draw" : null;
}

/** Свободные клетки, слева направо и сверху вниз. */
export function freeCells(board: string): number[] {
  const free: number[] = [];
  for (let i = 0; i < 9; i++) if (board[i] === "-") free.push(i);
  return free;
}

/**
 * Ход бота: выиграть → заблокировать → центр → случайный угол → случайная клетка.
 * Возвращает индекс клетки; на полном поле вернёт -1 (в игре не возникает).
 */
export function botMove(board: string, mark: Mark): number {
  const free = freeCells(board);

  const winning = (m: Mark): number => {
    for (const i of free) if (winnerOf(place(board, i, m)) === m) return i;
    return -1;
  };

  let move = winning(mark);
  if (move < 0) move = winning(other(mark));
  if (move < 0 && board[4] === "-") move = 4;
  if (move < 0) {
    const corners = [0, 2, 6, 8].filter(i => board[i] === "-");
    if (corners.length > 0) move = corners[Math.floor(Math.random() * corners.length)];
  }
  if (move < 0 && free.length > 0) move = free[Math.floor(Math.random() * free.length)];
  return move;
}

/**
 * Полный перебор выбирает ход с наиболее быстрой победой или наиболее поздним поражением.
 * При одинаковой оценке выбирается первая клетка по порядку.
 */
export function bestMove(board: string, mark: Mark): number {
  let best = -1;
  let bestScore = -Infinity;
  for (const i of freeCells(board)) {
    const score = -negamax(place(board, i, mark), other(mark), 1);
    if (score > bestScore) {
      bestScore = score;
      best = i;
    }
  }
  return best;
}

/** Оценка позиции стороны mark, которой сейчас ходить: +10−d при победе, d−10 при поражении, 0 — ничья. */
function negamax(board: string, mark: Mark, depth: number): number {
  const w = winnerOf(board);
  if (w) return w === mark ? 10 - depth : depth - 10;
  if (isFull(board)) return 0;
  let best = -Infinity;
  for (const i of freeCells(board)) {
    best = Math.max(best, -negamax(place(board, i, mark), other(mark), depth + 1));
  }
  return best;
}

/**
 * Формат: 9 символов поля ("X"/"O"/"-") + "/" + символ следующего хода, например "XO-XXO---/X".
 * В завершённой партии сохраняется сторона, которой принадлежал бы следующий ход.
 */
export function serializeState(board: string, turn: Mark): string {
  return `${board}/${turn}`;
}

/**
 * Разбирает строку сериализации. Бросает Error при некорректном формате или невозможной позиции:
 * неверный формат, недопустимые символы, X начал, но фигур у O больше (или разрыв
 * больше 1), победитель сделал не последний ход, ход не соответствует раскладке.
 */
export function parseSerialized(s: string): {board: string; turn: Mark} {
  if (s.length !== 11 || s[9] !== "/") {
    throw new Error("Строка должна быть вида '........./X' — 11 символов с разделителем '/'");
  }
  const board = s.slice(0, 9);
  const turn = s[10];
  if (!/^[XO-]{9}$/.test(board)) throw new Error("Поле содержит недопустимые символы: допустимы только X, O и '-'");
  if (turn !== "X" && turn !== "O") throw new Error("Символ хода должен быть 'X' или 'O'");

  const x = countMark(board, "X");
  const o = countMark(board, "O");
  if (x < o || x - o > 1) throw new Error("Невозможная раскладка фигур");
  // X начинает партию, поэтому победитель обязан сделать последний ход
  if (hasWin(board, "X") && x !== o + 1) throw new Error("Победили X, но последний ход был не у X");
  if (hasWin(board, "O") && x !== o) throw new Error("Победили O, но последний ход был не у O");
  // У незавершённой позиции "чей ход" однозначно выводится из раскладки
  const expected: Mark = x === o ? "X" : "O";
  if (turn !== expected) throw new Error(`Ход не соответствует раскладке: ожидался '${expected}'`);
  return {board, turn};
}

function countMark(board: string, mark: Mark): number {
  let n = 0;
  for (const c of board) if (c === mark) n++;
  return n;
}

export type Palette = {
  bg: string;
  grid: string;
  x: string;
  o: string;
  overlay: string;
  overlayText: string;
};

export const LIGHT: Palette = {
  bg: "#f4f4f4",
  grid: "#3b3b3b",
  x: "#1565c0",
  o: "#c62828",
  overlay: "rgba(0, 0, 0, 0.55)",
  overlayText: "#ffffff",
};

export const DARK: Palette = {
  bg: "#121212",
  grid: "#d4d4d4",
  x: "#64b5f6",
  o: "#ef9a9a",
  overlay: "rgba(0, 0, 0, 0.6)",
  overlayText: "#ffffff",
};

export type Geometry = {boardSize: number; cell: number; offsetX: number; offsetY: number};

const BOT_DELAY_MS = 450;
const OVERLAY_TEXT: Record<Outcome, string> = {win: "WIN", loss: "LOSS", draw: "DRAW"};

export class Game {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private props: Props;
  private handlers: {[E in keyof GameEvents]: Set<(event: GameEvents[E]) => void>} = {
    gameOver: new Set(),
    move: new Set(),
    newGame: new Set(),
    undo: new Set(),
  };
  private mode: FirstMove;
  private nextStarter: "human" | "computer" = "human";
  private board = "---------";
  private turn: Mark = "X";
  private humanMark: Mark = "X";
  private phase: "playing" | "over" = "playing";
  private outcome: Outcome | null = null;
  /** Позиция до последнего хода человека — то, куда откатывает undo; null = откатывать нечего. */
  private undoState: string | null = null;
  /** Подсказка уже показана для текущей позиции: повторный запрос не тратит подсказку. */
  private hintShown = false;
  private readonly animations = new Animations();
  private botTimer: ReturnType<typeof setTimeout> | undefined;
  private dirty = true;
  private darkQuery: MediaQueryList;
  private resizeObserver: ResizeObserver;

  constructor(canvas: HTMLCanvasElement, props: Props) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.props = props;
    this.mode = props.firstMove;
    if (this.mode === "computer") this.nextStarter = "computer";

    this.darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
    this.darkQuery.addEventListener("change", () => {
      this.dirty = true;
    });

    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(canvas);
    canvas.addEventListener("pointerdown", e => this.handlePointerDown(e));

    this.resize();
    this.newGame();

    // Цикл requestAnimationFrame перерисовывает поле при изменениях или активных анимациях.
    const loop = () => {
      if (this.dirty || this.animations.active) {
        this.dirty = false;
        this.render();
      }
      requestAnimationFrame(loop);
    };
    loop();
  }

  /**
   * Начинает новую партию и снимает блокировку поля; отменяет запланированный ход бота.
   * Наряду с ней срабатывает событие "newGame" со свежей позицией.
   */
  newGame() {
    this.cancelBot();
    this.clearHint();
    let starter: "human" | "computer";
    if (this.mode === "random") {
      starter = Math.random() < 0.5 ? "human" : "computer";
    } else {
      starter = this.nextStarter;
      if (this.mode === "alternate") this.nextStarter = starter === "human" ? "computer" : "human";
    }
    this.board = "---------";
    this.turn = "X"; // начинающий всегда играет X
    this.humanMark = starter === "human" ? "X" : "O";
    this.phase = "playing";
    this.outcome = null;
    this.undoState = null;
    this.dirty = true;
    this.emitNewGame({state: this.serialize()});
    if (starter === "computer") this.scheduleBot();
  }

  /** Строка поля и следующего хода в формате serializeState(). */
  serialize(): string {
    return serializeState(this.board, this.turn);
  }

  /**
   * Восстанавливает партию из строки сериализации и снимает блокировку поля.
   * Человеком становится та сторона, чей ход указан в строке: партия продолжается
   * ходом человека. Завершённая позиция в строке сразу завершает партию —
   * с блокировкой, оверлеем и событием "gameOver". Бросает Error при некорректной строке.
   */
  deserialize(s: string) {
    const {board, turn} = parseSerialized(s);
    this.cancelBot();
    this.clearHint();
    this.board = board;
    this.turn = turn;
    this.humanMark = turn;
    this.outcome = outcomeOf(board, turn);
    this.phase = this.outcome ? "over" : "playing";
    this.undoState = null;
    this.dirty = true;
    if (this.outcome) this.emitGameOver({outcome: this.outcome});
  }

  /** Подписка на событие: "gameOver" — конец партии, "move" — чей-либо ход, "newGame" — новая партия, "undo" — отмена последнего хода человека. */
  on<E extends keyof GameEvents>(event: E, handler: (event: GameEvents[E]) => void) {
    this.handlers[event].add(handler);
  }

  /** Отмена подписки на событие. */
  off<E extends keyof GameEvents>(event: E, handler: (event: GameEvents[E]) => void) {
    this.handlers[event].delete(handler);
  }

  private emitGameOver(result: GameOverResult) {
    this.props.onGameOver?.(result);
    for (const handler of this.handlers.gameOver) handler(result);
  }

  private emitMove(event: MoveEvent) {
    this.props.onMove?.(event);
    for (const handler of this.handlers.move) handler(event);
  }

  private emitNewGame(event: NewGameEvent) {
    this.props.onNewGame?.(event);
    for (const handler of this.handlers.newGame) handler(event);
  }

  private emitUndo(event: MoveEvent) {
    for (const handler of this.handlers.undo) handler(event);
  }

  private botMark(): Mark {
    return other(this.humanMark);
  }

  private scheduleBot() {
    this.botTimer = setTimeout(() => {
      this.botTimer = undefined;
      if (this.phase !== "playing" || this.turn === this.humanMark) return;
      const index = botMove(this.board, this.turn);
      if (index >= 0) this.applyMove(index);
    }, BOT_DELAY_MS);
  }

  private cancelBot() {
    if (this.botTimer !== undefined) {
      clearTimeout(this.botTimer);
      this.botTimer = undefined;
    }
  }

  /** Есть ли что откатывать: партия идёт и человек уже сделал ход. */
  canUndo(): boolean {
    return this.phase === "playing" && this.undoState !== null;
  }

  /**
   * Откатывает последний ход человека вместе с ответом бота: партия продолжается
   * с позиции до этого хода, ходить снова человек. Запланированный, но ещё не
   * сделанный ход бота отменяется. Доступность проверяет canUndo().
   */
  undo(): void {
    if (!this.canUndo()) return;
    const saved = this.undoState!;
    this.undoState = null;
    // Позиция до хода человека никогда не завершена: из неё человек сделал ход
    this.deserialize(saved);
    this.emitUndo({state: this.serialize()});
  }

  /** Можно ли показать подсказку: партия идёт и ход человека. */
  canHint(): boolean {
    return this.phase === "playing" && this.turn === this.humanMark;
  }

  /**
   * Показывает подсказку — идеальный ход человека, найденный полным перебором.
   * Повторный запрос по той же позиции игнорируется. Возвращает, была ли
   * показана подсказка: тратить её стоит только при true.
   */
  hint(): boolean {
    if (this.hintShown || !this.canHint()) return false;
    const index = bestMove(this.board, this.humanMark);
    if (index < 0) return false;
    this.hintShown = true;
    this.animations.cancel();
    this.animations.add(new HintAnimation(index, this.humanMark));
    this.dirty = true;
    return true;
  }

  private clearHint() {
    this.hintShown = false;
    this.animations.cancel();
  }

  /** Совершает ход текущей стороной, затем передаёт ход или завершает партию. */
  private applyMove(index: number) {
    this.clearHint();
    // Сохранённая позиция позволяет отменить ход человека вместе с последующим ответом бота.
    if (this.turn === this.humanMark) this.undoState = this.serialize();
    this.board = place(this.board, index, this.turn);
    this.outcome = outcomeOf(this.board, this.humanMark);
    // Даже в завершённой партии формат сохранения требует указать сторону следующего хода.
    this.turn = other(this.turn);
    this.dirty = true;
    this.emitMove({state: this.serialize()});
    if (this.outcome) {
      this.phase = "over";
      this.emitGameOver({outcome: this.outcome});
      return;
    }
    if (this.turn === this.botMark()) this.scheduleBot();
  }

  private handlePointerDown(e: PointerEvent) {
    if (this.phase !== "playing" || this.turn === this.botMark()) return;
    const rect = this.canvas.getBoundingClientRect();
    const g = this.geometry(rect.width, rect.height);
    const col = Math.floor((e.clientX - rect.left - g.offsetX) / g.cell);
    const row = Math.floor((e.clientY - rect.top - g.offsetY) / g.cell);
    if (col < 0 || col > 2 || row < 0 || row > 2) return;
    const index = row * 3 + col;
    if (this.board[index] !== "-") return;
    this.applyMove(index);
  }

  private resize() {
    const dpr = window.devicePixelRatio || 1;
    const {clientWidth: w, clientHeight: h} = this.canvas;
    if (w === 0 || h === 0) return;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.dirty = true;
  }

  /** Квадратное поле с отступами, вписанное в канвас; координаты в CSS-пикселях. */
  private geometry(w: number, h: number): Geometry {
    const boardSize = Math.min(w, h) * 0.92;
    return {
      boardSize,
      cell: boardSize / 3,
      offsetX: (w - boardSize) / 2,
      offsetY: (h - boardSize) / 2,
    };
  }

  private render() {
    const {ctx} = this;
    const w = this.canvas.clientWidth;
    const h = this.canvas.clientHeight;
    const p = this.darkQuery.matches ? DARK : LIGHT;
    ctx.fillStyle = p.bg;
    ctx.fillRect(0, 0, w, h);
    const g = this.geometry(w, h);

    ctx.strokeStyle = p.grid;
    ctx.lineWidth = Math.max(1, g.cell * 0.05);
    ctx.lineCap = "round";
    ctx.beginPath();
    for (const t of [1, 2]) {
      const x = g.offsetX + g.cell * t;
      const y = g.offsetY + g.cell * t;
      ctx.moveTo(x, g.offsetY);
      ctx.lineTo(x, g.offsetY + g.boardSize);
      ctx.moveTo(g.offsetX, y);
      ctx.lineTo(g.offsetX + g.boardSize, y);
    }
    ctx.stroke();

    for (let i = 0; i < 9; i++) {
      if (this.board[i] === "-") continue;
      const mark = this.board[i] as Mark;
      const cx = g.offsetX + (i % 3) * g.cell + g.cell / 2;
      const cy = g.offsetY + Math.floor(i / 3) * g.cell + g.cell / 2;
      drawMark(ctx, mark, cx, cy, g.cell, mark === "X" ? p.x : p.o);
    }

    const scene: Scene = {geometry: g, palette: p, humanMark: this.humanMark};
    this.animations.frame(ctx, scene, performance.now());

    if (this.phase === "over" && this.outcome) {
      ctx.fillStyle = p.overlay;
      ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = p.overlayText;
      ctx.font = `bold ${Math.round(g.boardSize / 5)}px sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(OVERLAY_TEXT[this.outcome], w / 2, h / 2);
    }
  }
}
