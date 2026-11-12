import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {clearAppStorage, FALLBACK_APP_ID, storageKey} from "../src/fake/storage-keys.ts";

function makeStorage(entries: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(entries));
  return {
    get length() {
      return map.size;
    },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as Storage;
}

describe("storageKey", () => {
  it("собирает ключ из id проекта, платформы и суффикса", () => {
    assert.equal(storageKey("tic-tac-toe", "yg", "data"), "tic-tac-toe__yg__data");
    assert.equal(storageKey("tic-tac-toe", "yg", "score-draws"), "tic-tac-toe__yg__score-draws");
    assert.equal(storageKey("other-game", "vk", "draws"), "other-game__vk__draws");
  });

  it("разные проекты не пересекаются даже на одной платформе", () => {
    assert.notEqual(storageKey("other-game", "yg", "data"), storageKey("tic-tac-toe", "yg", "data"));
  });

  it("fallback-id даёт общий неймспейс с явным префиксом", () => {
    assert.equal(storageKey(FALLBACK_APP_ID, "yg", "auth-time"), "gapi-fake__yg__auth-time");
  });
});

describe("clearAppStorage", () => {
  it("стирает ключи своего id на обеих платформах, чужие и безнеймспейсные не трогает", () => {
    const storage = makeStorage({
      "tic-tac-toe__yg__data": "{}",
      "tic-tac-toe__yg__score-draws": "7",
      "tic-tac-toe__vk__draws": "5",
      "other-game__yg__data": "{}",
      "gapi-fake__yg__data": "{}",
      unrelated: "1",
    });
    clearAppStorage(storage, "tic-tac-toe");
    assert.equal(storage.length, 3);
    assert.equal(storage.getItem("tic-tac-toe__yg__data"), null);
    assert.equal(storage.getItem("tic-tac-toe__yg__score-draws"), null);
    assert.equal(storage.getItem("tic-tac-toe__vk__draws"), null);
    assert.equal(storage.getItem("other-game__yg__data"), "{}");
    assert.equal(storage.getItem("gapi-fake__yg__data"), "{}");
    assert.equal(storage.getItem("unrelated"), "1");
  });

  it("пустое хранилище — не падает", () => {
    const storage = makeStorage();
    clearAppStorage(storage, "tic-tac-toe");
    assert.equal(storage.length, 0);
  });
});
