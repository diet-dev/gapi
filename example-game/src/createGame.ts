/**
 * Сохраняет партию после ходов, начала новой партии и отмены хода.
 * При загрузке страницы восстанавливает состояние из localStorage.
 * Статистика исходов хранится отдельно в stats.ts.
 */

import type {Data} from "@dietdev/gapi/interfaces.ts";
import {Game, type MoveEvent, type NewGameEvent, type UndoEvent} from "./Game.ts";
import {attachFavicon} from "./favicon.ts";
import {createStatsTracker, type Stats} from "./stats.ts";

export const STORAGE_KEY = "tic-tac-toe";

// Доступ к localStorage может быть запрещён браузером; тогда игра работает без сохранений.
function loadState(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function saveState(state: string) {
  try {
    localStorage.setItem(STORAGE_KEY, state);
  } catch {
    console.warn("Хранилище localStorage недоступно!");
  }
}

function clearState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    console.warn("Хранилище localStorage недоступно!");
  }
}

/** Создаёт игру на канвасе: восстанавливает сохранённую партию и включает автосохранение ходов. */
export function createGame(canvas: HTMLCanvasElement, deps: {data: Data; onStats: (stats: Stats) => void}): Game {
  const game = new Game(canvas, {firstMove: "human"});
  const save = ({state}: MoveEvent | NewGameEvent | UndoEvent) => saveState(state);
  game.on("move", save);
  game.on("newGame", save);
  game.on("undo", save);

  createStatsTracker({game, data: deps.data, onStats: deps.onStats});

  const saved = loadState();
  if (saved !== null) {
    try {
      game.deserialize(saved);
    } catch {
      // Некорректное сохранение удаляется, чтобы следующая загрузка не повторяла ошибку.
      clearState();
      console.warn(`Не удалось восстановить партию из "${saved}", начинаем новую`);
    }
  }
  attachFavicon(game);
  return game;
}
