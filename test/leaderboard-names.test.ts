import assert from "node:assert/strict";
import {test} from "node:test";
import {YgScore} from "../src/score/YgScore.ts";
import {FakeScore} from "../src/fake-score.ts";
import {YandexGameApi} from "../src/yandex.ts";
import {browserGlobals} from "./helpers/browser.ts";

test("публичный API Яндекса преобразует рейтинг SDK и сообщает об ошибке загрузки", async context => {
  const browser = browserGlobals(globalThis);
  const previous = browser.window;
  context.after(() => {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "window");
    else browser.window = previous;
  });
  const calls: unknown[][] = [];
  const sizes: string[] = [];
  let failed = false;
  browser.window = {
    "fake-ysdk": {
      leaderboards: {
        getEntries: async (name: string, options: unknown) => {
          calls.push([name, options]);
          if (failed) throw new Error("SDK unavailable");
          return {
            userRank: 42,
            entries: [
              {
                rank: 42,
                score: 1234,
                player: {
                  publicName: "Player",
                  getAvatarSrcSet: (size: string) => {
                    sizes.push(size);
                    return "avatar.png 1x";
                  },
                  scopePermissions: {avatar: "allow", public_name: "allow"},
                },
              },
            ],
          };
        },
      },
    },
  };
  const api = new YandexGameApi({fake: true});
  const errors: string[] = [];
  api.score.on("error", error => errors.push(error.code));
  const options = {quantityTop: 15, includeUser: true, quantityAround: 5};
  assert.deepEqual(await api.score.laeders("weekly", options), {
    userRank: 42,
    entries: [{rank: 42, score: 1234, name: "Player", avatar: "avatar.png 1x", authorized: true}],
  });
  assert.deepEqual(sizes, ["medium"]);
  failed = true;
  assert.equal(await api.score.laeders("weekly", options), undefined);
  assert.deepEqual(calls, [
    ["weekly", options],
    ["weekly", options],
  ]);
  assert.deepEqual(errors, ["LOAD_LEADERBOARD_ERROR"]);
});

test("Яндекс передаёт имя таблицы во всех операциях и параметры выборки", async () => {
  const api = new YgScore({fake: true});
  const calls: unknown[][] = [];
  Object.defineProperty(api, "sdk", {
    value: async () => ({
      leaderboards: {
        getPlayerEntry: async (name: string) => {
          calls.push(["get", name]);
          return {score: 50, rank: 3};
        },
        setScore: async (name: string, score: number) => {
          calls.push(["set", name, score]);
        },
        getEntries: async (name: string, options: unknown) => {
          calls.push(["entries", name, options]);
          return {userRank: 0, entries: []};
        },
      },
    }),
  });
  await api.set(100, "weekly");
  await api.get("score");
  await api.laeders("weekly", {quantityTop: 15, includeUser: true, quantityAround: 5});
  assert.deepEqual(calls, [
    ["get", "weekly"],
    ["set", "weekly", 100],
    ["get", "score"],
    ["entries", "weekly", {quantityTop: 15, includeUser: true, quantityAround: 5}],
  ]);
});

test("локальные именованные таблицы возвращают независимые результаты", async () => {
  const values = new Map<string, string>();
  const score = new FakeScore({
    appId: "test",
    platform: "vk",
    storage: {
      getItem: key => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
    },
  });
  assert.equal((await score.laeders("weekly"))?.entries.length, 0);
  await score.set(100, "weekly");
  await score.set(900, "monthly");
  assert.equal((await score.laeders("weekly"))?.entries[0].score, 100);
  assert.equal((await score.laeders("monthly"))?.entries[0].score, 900);
  assert.equal((await score.get("score")).score, 0);

  for (const leaderboard of ["weekly", "score"]) {
    const top = await score.laeders(leaderboard, {quantityTop: 1, includeUser: false});
    assert.ok(top);
    assert.equal(top.userRank, 0);
    assert.ok(top.entries.length > 0);
    assert.ok((await score.laeders(leaderboard, {includeUser: true}))!.userRank > 0);
  }
  assert.equal((await score.laeders("weekly"))?.userRank, 1);
});

test("первая запись Яндекса: отсутствие игрока считается пустым результатом", async () => {
  const api = new YgScore({fake: true});
  const values = new Map<string, number>();
  Object.defineProperty(api, "sdk", {
    value: async () => ({
      leaderboards: {
        getPlayerEntry: async (name: string) => {
          if (!values.has(name)) throw {code: "LEADERBOARD_PLAYER_NOT_PRESENT"};
          return {score: values.get(name), rank: 1};
        },
        setScore: async (name: string, score: number) => {
          values.set(name, score);
        },
      },
    }),
  });
  assert.deepEqual(await api.get("weekly"), {score: 0, rank: 0});
  await api.set(95000001000, "weekly");
  assert.deepEqual(await api.get("weekly"), {score: 95000001000, rank: 1});
  assert.deepEqual(await api.get("score"), {score: 0, rank: 0});
});
