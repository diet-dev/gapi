/**
 * Статистика исходов партий и кошелёк подсказок.
 * Локально — BinaryStorage в localStorage, в облаке — GAPI.data.sync:
 * счётчики монотонно растут (MAX_INT), подсказки — [дата траты, остаток],
 * при конфликте устройств целиком побеждает свежая запись (ARR_FIRST_MAX_INT).
 */

import {BinaryStorage} from "@dietdev/binary-storage";
import type {Data, SyncDataStrategy} from "@dietdev/gapi/interfaces.ts";
import {type Game, type Outcome} from "./Game.ts";

export const STATS_STORAGE_KEY = "stats";

export const HINTS_START = 10;

export const statsStorage = new BinaryStorage(STATS_STORAGE_KEY, {
  wins: 0,
  losses: 0,
  draws: 0,
  hints: [0, HINTS_START],
});

export type Stats = ReturnType<typeof statsStorage.get>;

const OUTCOME_KEYS: Record<Outcome, "wins" | "losses" | "draws"> = {
  win: "wins",
  loss: "losses",
  draw: "draws",
};

const SYNC_ITEMS: [keyof Stats, SyncDataStrategy][] = [
  ["wins", "MAX_INT"],
  ["losses", "MAX_INT"],
  ["draws", "MAX_INT"],
  ["hints", "ARR_FIRST_MAX_INT"],
];

export async function syncStats(data: Data): Promise<void> {
  await data.sync(statsStorage, SYNC_ITEMS);
}

/** Остаток подсказок. */
export function hintsLeft(): number {
  return statsStorage.get().hints[1] ?? 0;
}

/** Остаток после траты; дата нужна стратегии ARR_FIRST_MAX_INT — побеждает свежая запись. */
export function nextHints(hints: number[], now: number): [number, number] {
  return [now, Math.max(0, (hints[1] ?? 0) - 1)];
}

/** Списывает одну подсказку. */
export function spendHint(): void {
  statsStorage.upd({hints: nextHints(statsStorage.get().hints, Date.now())});
}

/** Остаток после покупки; дата нужна стратегии ARR_FIRST_MAX_INT — побеждает свежая запись. */
export function grownHints(hints: number[], amount: number, now: number): [number, number] {
  return [now, (hints[1] ?? 0) + amount];
}

/** Начисляет купленные подсказки к запасу. */
export function addHints(amount: number): void {
  if (amount <= 0) return;
  statsStorage.upd({hints: grownHints(statsStorage.get().hints, amount, Date.now())});
}

export function createStatsTracker(deps: {game: Game; data: Data; onStats: (stats: Stats) => void}) {
  const {game, data, onStats} = deps;
  const report = () => onStats(statsStorage.get());

  const sync = async () => {
    await syncStats(data);
    report();
  };

  // Восстановленная из хранилища партия снова эмитит "gameOver" — учитываем
  // только партии, в которых в этой сессии был сделан ход.
  let played = false;
  game.on("move", () => {
    played = true;
  });
  game.on("gameOver", ({outcome}) => {
    if (!played) return;
    played = false;
    statsStorage.inc(OUTCOME_KEYS[outcome]);
    report();
    void sync();
  });

  report();
  void sync();
}
