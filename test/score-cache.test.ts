import assert from "node:assert/strict";
import {test} from "node:test";
import {createReadCache} from "../src/utils/readCache.ts";
import {YgScore} from "../src/score/YgScore.ts";
import {GameApiClient} from "../src/backend.ts";

test("кеш учитывает возраст, явную свежесть и защищает данные от изменения вызывающим", async () => {
  let now = 0,
    reads = 0;
  const cache = createReadCache<{rank: number}>(() => now);
  const load = async () => ({rank: ++reads});
  const first = await cache.read("weekly", 30000, load);
  first.rank = 999;
  now = 29999;
  assert.equal((await cache.read("weekly", 30000, load)).rank, 1);
  now = 30000;
  assert.equal((await cache.read("weekly", 30000, load)).rank, 2);
  assert.equal((await cache.read("weekly", 0, load)).rank, 3);
});

test("одинаковые запросы объединяются, ошибки не кешируются, старый ответ после записи не восстанавливает кеш", async () => {
  const cache = createReadCache<number>();
  let finish!: (value: number) => void,
    reads = 0;
  const load = () => {
    reads++;
    return new Promise<number>(resolve => {
      finish = resolve;
    });
  };
  const first = cache.read("weekly", 1000, load);
  const second = cache.read("weekly", 0, load);
  await Promise.resolve();
  assert.equal(reads, 1);
  cache.invalidate("weekly");
  assert.equal(await cache.read("weekly", 1000, async () => 2), 2);
  finish(1);
  assert.deepEqual(await Promise.all([first, second]), [1, 1]);
  assert.equal(await cache.read("weekly", 1000, async () => 3), 2);
  await assert.rejects(
    cache.read("error", 1000, async () => {
      throw Error("offline");
    }),
  );
  assert.equal(await cache.read("error", 1000, async () => 4), 4);
});

test("Яндекс: проверка перед записью использует свежий кеш, запись сбрасывает запись и все выборки таблицы", async () => {
  const api = new YgScore({fake: true});
  let ownReads = 0,
    tableReads = 0,
    remote = 10;
  const queries: unknown[] = [];
  Object.defineProperty(api, "sdk", {
    value: async () => ({
      leaderboards: {
        getPlayerEntry: async () => {
          ownReads++;
          return {score: remote, rank: 3};
        },
        setScore: async (_name: string, score: number) => {
          remote = score;
        },
        getEntries: async (_name: string, options: unknown) => {
          queries.push(options);
          tableReads++;
          return {userRank: 3, entries: []};
        },
      },
    }),
  });
  await api.get("weekly");
  await api.get("weekly", {maxAgeMs: 30000});
  await api.laeders("weekly", {quantityTop: 15, maxAgeMs: 120000});
  await api.laeders("weekly", {maxAgeMs: 120000, quantityTop: 15});
  await api.laeders("weekly", {quantityTop: 5, maxAgeMs: 120000});
  assert.equal(ownReads, 1);
  assert.equal(tableReads, 2);
  assert.deepEqual(queries[0], {quantityTop: 15});
  await api.set(20, "weekly");
  assert.equal(ownReads, 1);
  assert.equal((await api.get("weekly", {maxAgeMs: 30000})).score, 20);
  assert.equal(ownReads, 2);
  await api.laeders("weekly", {quantityTop: 15, maxAgeMs: 120000});
  await api.laeders("weekly", {quantityTop: 5, maxAgeMs: 120000});
  assert.equal(tableReads, 4);
});

test("Яндекс: ошибки не кешируются, смена пользователя сбрасывает кеш", async () => {
  const api = new YgScore({fake: true});
  let owner = {},
    fail = true,
    reads = 0;
  Object.defineProperty(api, "playerCacheIdentity", {get: () => owner});
  Object.defineProperty(api, "sdk", {
    value: async () => ({
      leaderboards: {
        getPlayerEntry: async () => {
          reads++;
          if (fail) throw Error("offline");
          return {score: 10, rank: reads};
        },
      },
    }),
  });
  assert.equal((await api.get("weekly", {maxAgeMs: 30000})).score, -1);
  fail = false;
  assert.equal((await api.get("weekly", {maxAgeMs: 30000})).rank, 2);
  owner = {};
  assert.equal((await api.get("weekly", {maxAgeMs: 30000})).rank, 3);
});

test("собственный API: кеш и объединение чтений, сброс после успешной записи", async () => {
  let ownReads = 0,
    tableReads = 0;
  const response = (value: unknown) => new Response(JSON.stringify(value));
  const api = new GameApiClient({
    url: "https://api.example",
    projectId: "test",
    getProof: () => ({launchParams: "test"}),
    fetch: async (url, init) => {
      const path = new URL(String(url)).pathname;
      if (path.endsWith("/auth/token")) {
        return response({accessToken: "test", expiresAt: new Date(Date.now() + 3600000).toISOString()});
      }
      if (init?.method === "PUT") return response({});
      if (path.endsWith("/me")) {
        ownReads++;
        return response({score: 10, rank: ownReads});
      }
      tableReads++;
      return response({entries: [], userRank: 1});
    },
  });
  await Promise.all([api.getPlayerEntry("weekly", {maxAgeMs: 30000}), api.getPlayerEntry("weekly", {maxAgeMs: 30000})]);
  assert.equal(ownReads, 1);
  await api.getEntries("weekly", {maxAgeMs: 120000, includeUser: true});
  await api.getEntries("weekly", {maxAgeMs: 120000, includeUser: true});
  assert.equal(tableReads, 1);
  await api.setScore("weekly", 20);
  await api.getPlayerEntry("weekly", {maxAgeMs: 30000});
  await api.getEntries("weekly", {maxAgeMs: 120000, includeUser: true});
  assert.equal(ownReads, 2);
  assert.equal(tableReads, 2);
});
