import assert from "node:assert/strict";
import {test} from "node:test";
import {FakeScore} from "../src/fake-score.ts";
import {VkGameApi} from "../src/vk.ts";

function setup(appId = "my-game", platform: "vk" | "yg" = "vk", values = new Map<string, string>()) {
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  return new FakeScore({appId, platform, storage});
}

test("локальный рекорд сохраняется между экземплярами и не уменьшается", async () => {
  const values = new Map<string, string>();
  const score = setup("my-game", "vk", values);
  assert.equal(await score.set(250, "score"), true);
  assert.equal(await score.set(100, "score"), true);
  assert.equal((await setup("my-game", "vk", values).get("score")).score, 250);
  assert.equal((await score.get("daily")).score, 0);
  assert.equal((await setup("other", "vk", values).get("score")).score, 0);
  assert.equal((await setup("my-game", "yg", values).get("score")).score, 0);
});

test("рейтинг возвращает общие с Яндексом тестовые профили без fetch и SDK", async t => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {configurable: true, value: {"fake-bridge": {subscribe() {}}}});
  t.after(() =>
    previous ? Object.defineProperty(globalThis, "window", previous) : Reflect.deleteProperty(globalThis, "window"),
  );
  const api = new VkGameApi({fake: true, score: setup()});
  const data = await api.score.laeders("score");
  assert.ok(data);
  assert.equal(data.entries.length, 26);
  assert.ok(data.entries.every(entry => entry.name && entry.avatar && entry.rank > 0));
  assert.ok(data.entries.every(entry => !/ [12]x(?:,|$)/.test(entry.avatar)));
  assert.ok(data.entries.some(entry => entry.rank === data.userRank));
});

test("ошибки хранилища передаются через интерфейс Score", async () => {
  const score = new FakeScore({
    appId: "my-game",
    platform: "vk",
    storage: {
      getItem: () => {
        throw new Error("denied");
      },
      setItem: () => {},
    },
  });
  const errors: string[] = [];
  score.on("error", error => errors.push(error.code));
  assert.deepEqual(await score.get("score"), {score: -1, rank: -1});
  assert.equal(await score.set(100, "score"), false);
  assert.deepEqual(errors, ["GET_SCORE_ERROR", "SET_SCORE_ERROR"]);
});
