type PerformanceClock = {now(): number; timeOrigin?: number};

export function createMonotonicClock(
  source: PerformanceClock | undefined = globalThis.performance,
  wallNow: () => number = Date.now.bind(Date),
): () => number {
  const round = Math.round;
  const max = Math.max;
  if (!source || typeof source.now !== "function") return () => round(wallNow());
  const readNow = source.now.bind(source);
  const origin =
    typeof source.timeOrigin === "number" && Number.isFinite(source.timeOrigin) && source.timeOrigin > 0
      ? source.timeOrigin
      : wallNow() - readNow();
  let last = round(origin + readNow());
  // Ссылки и начало отсчёта сохраняются до возможной подмены globals приложением.
  return () => (last = max(last, round(origin + readNow())));
}

// Это часы устройства с монотонным ходом, а не доверенное время внешнего сервера.
export const serverTime = createMonotonicClock();
