// Ответы рейтингов — JSON-данные; structuredClone недоступен в Safari 12.
function copy<T>(value: T): T {
  return value === undefined ? value : JSON.parse(JSON.stringify(value));
}

type Entry<T> = {at: number; value?: T; ready: boolean; pending?: Promise<T>};

// Кеш живёт только в экземпляре клиента; ошибки и ответы до инвалидирования не сохраняются.
export function createReadCache<T>(now: () => number = () => performance.now()) {
  const entries = new Map<string, Entry<T>>();
  return {
    async read(key: string, maxAgeMs: number, load: () => Promise<T>): Promise<T> {
      let entry = entries.get(key);
      if (entry?.pending) return copy(await entry.pending);
      if (entry?.ready && maxAgeMs > 0 && now() - entry.at < maxAgeMs) return copy(entry.value!);
      entry = {at: now(), ready: false};
      if (entries.size >= 128 && !entries.has(key)) entries.delete(entries.keys().next().value!);
      entries.set(key, entry);
      const current = entry;
      current.pending = Promise.resolve().then(load);
      try {
        const value = await current.pending;
        if (entries.get(key) === current) {
          current.value = copy(value);
          current.ready = true;
        }
        return copy(value);
      } catch (error) {
        if (entries.get(key) === current) entries.delete(key);
        throw error;
      } finally {
        current.pending = undefined;
      }
    },
    invalidate(prefix = "") {
      for (const key of entries.keys()) if (key.startsWith(prefix)) entries.delete(key);
    },
  };
}
