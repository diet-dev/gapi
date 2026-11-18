import {EventEmitter} from "@dietdev/emitter";
import type {ApiEvents, SyncDataStrategy} from "../src/interfaces.ts";
import {browserGlobals} from "./helpers/browser.ts";
import assert from "node:assert/strict";
import {test} from "node:test";
import {SyncManager} from "../src/data/SyncManager.ts";
import {type Data, type DataStorage} from "../src/interfaces.ts";
import {YgData} from "../src/data/YgData.ts";
import {YgApi} from "../src/api/YgApi.ts";
import {VkData} from "../src/data/VkData.ts";

const browser = browserGlobals(globalThis);

browser.window = browser.window ?? {};

function makeStorage<T extends object>(state: T): DataStorage<T> & {state: T} {
  return {
    state,
    get: () => state,
    upd: (patch: Partial<T>) => Object.assign(state, patch),
  };
}

// Отложенная запись позволяет проверить, что sync дожидается сохранения данных.
class Cloud extends EventEmitter<ApiEvents> implements Data {
  saved: Record<string, string> = {};
  errors: string[] = [];
  flushed: Promise<void>[] = [];

  constructor() {
    super();
    this.on("error", event => this.errors.push(event.code));
  }

  set(key: string, value: string): Promise<boolean> {
    const pending = new Promise<void>(resolve => setTimeout(resolve, 0));
    this.flushed.push(pending);
    return pending.then(() => {
      this.saved[key] = value;
      return true;
    });
  }

  async get(): Promise<Record<string, unknown>> {
    return {};
  }
  async sync(): Promise<void> {}
}

function makeCloud() {
  return new Cloud();
}

function makeManager<T extends object>(local: T, cloud: Data) {
  return new SyncManager(makeStorage(local), cloud);
}

test("S1: MAX_INT — облако больше, локаль обновляется; локаль больше, облако получает её", async () => {
  const cloud = makeCloud();
  const local = {level: 3};
  await makeManager(local, cloud).sync([["level", "MAX_INT"]], {level: "9"});
  assert.equal(local.level, 9);
  assert.deepEqual(cloud.saved, {});

  const cloud2 = makeCloud();
  const local2 = {level: 7};
  await makeManager(local2, cloud2).sync([["level", "MAX_INT"]], {level: "2"});
  assert.equal(local2.level, 7);
  assert.deepEqual(cloud2.saved, {level: "7"});
});

test("S1: MAX_INT — нечисловое облако перезаписывается локальным", async () => {
  const cloud = makeCloud();
  const local = {level: 5};
  await makeManager(local, cloud).sync([["level", "MAX_INT"]], {level: '"oops"'});
  assert.equal(local.level, 5);
  assert.deepEqual(cloud.saved, {level: "5"});
});

test("S1: MIN_INT_WITHOUT_0 — меньшее ненулевое побеждает", async () => {
  const cloud = makeCloud();
  const local = {attempts: 5};
  await makeManager(local, cloud).sync([["attempts", "MIN_INT_WITHOUT_0"]], {attempts: "1"});
  assert.equal(local.attempts, 1);
  assert.deepEqual(cloud.saved, {});

  const cloud2 = makeCloud();
  const local2 = {attempts: 2};
  await makeManager(local2, cloud2).sync([["attempts", "MIN_INT_WITHOUT_0"]], {attempts: "4"});
  assert.equal(local2.attempts, 2);
  assert.deepEqual(cloud2.saved, {attempts: "2"});
});

test("S1: TRUE — прилипающее истинное значение", async () => {
  const cloud = makeCloud();
  const local = {purchased: false};
  await makeManager(local, cloud).sync([["purchased", "TRUE"]], {purchased: "true"});
  assert.equal(local.purchased, true);
  assert.deepEqual(cloud.saved, {});

  const cloud2 = makeCloud();
  const local2 = {purchased: true};
  await makeManager(local2, cloud2).sync([["purchased", "TRUE"]], {purchased: "false"});
  assert.equal(local2.purchased, true);
  assert.deepEqual(cloud2.saved, {purchased: "true"});
});

test("S1: ARR_MAX_INT — поэлементный максимум в обе стороны", async () => {
  const cloud = makeCloud();
  const local = {scores: [1, 5]};
  await makeManager(local, cloud).sync([["scores", "ARR_MAX_INT"]], {scores: "[3,2,4]"});
  assert.deepEqual(local.scores, [3, 5, 4]);
  assert.deepEqual(cloud.saved, {scores: "[3,5,4]"});
});

test("S1: ARR_MIN_INT_WITHOUT_0 — поэлементный минимум, 0 — «значения нет»", async () => {
  const cloud = makeCloud();
  // Лучшее время по уровням: меньше — лучше, 0 — рекорда ещё нет.
  const local = {times: [90, 0, 300]};
  await makeManager(local, cloud).sync([["times", "ARR_MIN_INT_WITHOUT_0"]], {times: "[120,200,0,50]"});
  assert.deepEqual(local.times, [90, 200, 300, 50]);
  assert.deepEqual(cloud.saved, {times: "[90,200,300,50]"});
});

test("S1: ARR_MIN_INT_WITHOUT_0 — без облачного значения отправляет локальное", async () => {
  const cloud = makeCloud();
  const local = {times: [90]};
  await makeManager(local, cloud).sync([["times", "ARR_MIN_INT_WITHOUT_0"]], {});
  assert.deepEqual(cloud.saved, {times: "[90]"});
});

test("S1: ARR_FIRST_MAX_INT — облако с большим первым элементом побеждает целиком (багфикс)", async () => {
  const cloud = makeCloud();
  const local = {run: [2, 9]};
  await makeManager(local, cloud).sync([["run", "ARR_FIRST_MAX_INT"]], {run: "[5,1]"});
  assert.deepEqual(local.run, [5, 1]);
  assert.deepEqual(cloud.saved, {});
});

test("S1: ARR_FIRST_MAX_INT — локаль с большим первым элементом уходит в облако (багфикс)", async () => {
  const cloud = makeCloud();
  const local = {run: [7, 0]};
  await makeManager(local, cloud).sync([["run", "ARR_FIRST_MAX_INT"]], {run: "[3,3]"});
  assert.deepEqual(local.run, [7, 0]);
  assert.deepEqual(cloud.saved, {run: "[7,0]"});
});

test("S1: DAILY_BONUS — облачный массив новее, локаль обновляется значением (багфикс)", async () => {
  const cloud = makeCloud();
  const local = {bonus: [1, 100]};
  await makeManager(local, cloud).sync([["bonus", "DAILY_BONUS"]], {bonus: "[2,200]"});
  assert.deepEqual(local.bonus, [2, 200]);
  assert.deepEqual(cloud.saved, {});
});

test("S1: DAILY_BONUS — локаль новее, облако получает её", async () => {
  const cloud = makeCloud();
  const local = {bonus: [3, 300]};
  await makeManager(local, cloud).sync([["bonus", "DAILY_BONUS"]], {bonus: "[1,50]"});
  assert.deepEqual(local.bonus, [3, 300]);
  assert.deepEqual(cloud.saved, {bonus: "[3,300]"});
});

test("S1: алиас облачного ключа — облако читается и пишется по алиасу (багфикс)", async () => {
  const cloud = makeCloud();
  const local = {level: 3};
  await makeManager(local, cloud).sync([["level", "MAX_INT", "cloud_level"]], {cloud_level: "9"});
  assert.equal(local.level, 9);
  assert.deepEqual(cloud.saved, {});
});

test("S1: нет облачного значения — локаль уходит в облако", async () => {
  const cloud = makeCloud();
  const local = {level: 4};
  await makeManager(local, cloud).sync([["level", "MAX_INT"]], {});
  assert.equal(local.level, 4);
  assert.deepEqual(cloud.saved, {level: "4"});
});

test("S1: записи в облако завершаются до конца sync (нет floating promises)", async () => {
  const cloud = makeCloud();
  const local = {level: 7};
  await makeManager(local, cloud).sync([["level", "MAX_INT"]], {level: "2"});
  assert.deepEqual(cloud.saved, {level: "7"});
});

test("S1: непарсируемый JSON — SYNC_ERROR через apiProvider, без throw, без записей", async () => {
  const cloud = makeCloud();
  const local = {level: 3};
  await makeManager(local, cloud).sync([["level", "MAX_INT"]], {level: "{oops"});
  assert.equal(local.level, 3);
  assert.deepEqual(cloud.saved, {});
  assert.deepEqual(cloud.errors, ["SYNC_ERROR"]);
});

test("S1: незнакомая стратегия — SYNC_ERROR, данные не трогаются", async () => {
  const cloud = makeCloud();
  const local = {level: 3};
  await makeManager(local, cloud).sync([["level", "UNKNOWN" as SyncDataStrategy]], {level: "9"});
  assert.equal(local.level, 3);
  assert.deepEqual(cloud.saved, {});
  assert.deepEqual(cloud.errors, ["SYNC_ERROR"]);
});

test("S1: уже распарсенное значение (не строка) обрабатывается как значение", async () => {
  const cloud = makeCloud();
  const local = {level: 3};
  await makeManager(local, cloud).sync([["level", "MAX_INT"]], {level: 9});
  assert.equal(local.level, 9);
  assert.deepEqual(cloud.saved, {});
});

// Кеш игрока общий для экземпляров YgApi, поэтому его нужно сбросить при замене SDK.
function stubYsdk(player: ReturnType<typeof spyPlayer>) {
  Reflect.set(YgApi, "player", undefined);
  browser.window["fake-ysdk"] = {getPlayer: () => player};
}

function spyPlayer(data: Record<string, unknown> = {}, opts: {rejectSet?: boolean; rejectGet?: boolean} = {}) {
  const player = {
    stored: {...data},
    lastSetArgs: [] as [Record<string, unknown>, boolean | undefined][],
    setData: async (d: Record<string, unknown>, flush?: boolean) => {
      if (opts.rejectSet) throw new Error("setData fail");
      player.lastSetArgs.push([d, flush]);
      Object.assign(player.stored, d);
    },
    getData: async () => {
      if (opts.rejectGet) throw new Error("getData fail");
      return {...player.stored};
    },
  };
  return player;
}

test("S2: YgData.get — при недоступном SDK возвращается {} и эмитится GET_DATA_ERROR (не boolean)", async () => {
  Reflect.set(YgApi, "player", undefined);
  browser.window["fake-ysdk"] = undefined;
  const data = new YgData({fake: true});
  const errors: string[] = [];
  data.on("error", e => errors.push(e.code));

  assert.deepEqual(await data.get(), {});
  assert.deepEqual(errors, ["GET_DATA_ERROR"]);
});

test("S2: YgData.set — setData вызывается ровно с { [key]: value } и flush (SDK сам мёржит)", async () => {
  const player = spyPlayer({other: "keep"});
  stubYsdk(player);
  const data = new YgData({fake: true});

  assert.equal(await data.set("level", "9", true), true);

  assert.deepEqual(player.lastSetArgs, [[{level: "9"}, true]]);
});

test("S2: YgData.set — reject setData не выбрасывается наружу, эмитится SET_DATA_ERROR", async () => {
  const player = spyPlayer({}, {rejectSet: true});
  stubYsdk(player);
  const data = new YgData({fake: true});
  const errors: string[] = [];
  data.on("error", e => errors.push(e.code));

  assert.equal(await data.set("level", "9"), false);
  assert.deepEqual(errors, ["SET_DATA_ERROR"]);
});

test("S2: YgData.get — reject getData не выбрасывается наружу, возвращается {}", async () => {
  const player = spyPlayer({}, {rejectGet: true});
  stubYsdk(player);
  const data = new YgData({fake: true});
  const errors: string[] = [];
  data.on("error", e => errors.push(e.code));

  assert.deepEqual(await data.get(), {});
  assert.deepEqual(errors, ["GET_DATA_ERROR"]);
});

test("S2: YgData.set/get — при недоступном SDK эмитятся коды без throw", async () => {
  Reflect.set(YgApi, "player", undefined);
  browser.window["fake-ysdk"] = undefined;
  const data = new YgData({fake: true});
  const errors: string[] = [];
  data.on("error", e => errors.push(e.code));

  assert.equal(await data.set("level", "9"), false);
  assert.deepEqual(await data.get(), {});
  assert.deepEqual(errors, ["SET_DATA_ERROR", "GET_DATA_ERROR"]);
});

test("S2: YgData.sync — при недоступном SDK эмитится SYNC_ERROR (не молчание)", async () => {
  Reflect.set(YgApi, "player", undefined);
  browser.window["fake-ysdk"] = undefined;
  const data = new YgData({fake: true});
  const errors: string[] = [];
  data.on("error", e => errors.push(e.code));

  await data.sync({get: () => ({level: 0}), upd: () => {}}, [["level", "MAX_INT"]]);
  assert.deepEqual(errors, ["SYNC_ERROR"]);
});

test("S2: fake YgFakePlayer.setData мёржит, а не перезаписывает (пара data.set не теряет ключи)", async () => {
  const store: Record<string, string> = {};
  browser.window.localStorage = {
    getItem: (k: string) => store[k] ?? null,
    setItem: (k: string, v: string) => (store[k] = v),
    removeItem: (k: string) => delete store[k],
  };
  const {YgFakePlayer} = await import("../src/fake/YgFakePlayer.ts");
  const player = new YgFakePlayer(false, "test");

  await player.setData({a: "1"});
  await player.setData({b: "2"});

  const result = await player.getData();
  assert.equal(result.a, "1");
  assert.equal(result.b, "2");
});

test("S3: VkData.sync — облако запрашивается и сопоставляется по алиасам ключей", async () => {
  const requested: string[][] = [];
  browser.window["fake-bridge"] = {
    send: async (method: string, props?: {keys?: string[]}) => {
      if (method === "VKWebAppStorageGet") {
        requested.push(props?.keys ?? []);
        return {
          keys: (props?.keys ?? []).map((k: string) => ({
            key: k,
            value: k === "cloud_level" ? "9" : "",
          })),
        };
      }
      if (method === "VKWebAppStorageSet") {
        return {result: true};
      }
      return {};
    },
    supportsAsync: async () => true,
    subscribe: () => {},
  };

  const local = {level: 3};
  const storage = makeStorage(local);
  const data = new VkData({fake: true});

  await data.sync(storage, [["level", "MAX_INT", "cloud_level"]]);

  const other = {level: 4};
  await data.sync(makeStorage(other), [["level", "MAX_INT", "cloud_level"]]);
  assert.deepEqual(requested, [["cloud_level"], ["cloud_level"]]);
  assert.equal(local.level, 9);
  assert.equal(other.level, 9);
});

test("синхронизация отклоняет локальное значение неверного типа без записи в облако", async () => {
  const cloud = makeCloud();
  const local = {level: "not-a-number"};
  await makeManager(local, cloud).sync([["level", "MAX_INT"]], {level: "9"});
  assert.equal(local.level, "not-a-number");
  assert.deepEqual(cloud.saved, {});
  assert.deepEqual(cloud.errors, ["SYNC_ERROR"]);
});

test("числовая стратегия не переносит нечисловые элементы из облачного массива", async () => {
  const cloud = makeCloud();
  const local = {scores: [1, 5]};
  await makeManager(local, cloud).sync([["scores", "ARR_MAX_INT"]], {scores: '["100",2]'});
  assert.deepEqual(local.scores, [1, 5]);
  assert.deepEqual(cloud.saved, {scores: "[1,5]"});
});

test("YgData синхронизирует каждое переданное хранилище, не удерживая первое", async () => {
  stubYsdk(spyPlayer({level: "9"}));
  const data = new YgData({fake: true});
  const first = {level: 3};
  const second = {level: 4};
  await data.sync(makeStorage(first), [["level", "MAX_INT"]]);
  await data.sync(makeStorage(second), [["level", "MAX_INT"]]);
  assert.equal(first.level, 9);
  assert.equal(second.level, 9);
});

test("YgData сообщает об ошибке, если в fake-хранилище вместо объекта сохранён массив", async () => {
  browser.window.localStorage = {getItem: () => "[]"};
  const {YgFakePlayer} = await import("../src/fake/YgFakePlayer.ts");
  Reflect.set(YgApi, "player", undefined);
  browser.window["fake-ysdk"] = {getPlayer: async () => new YgFakePlayer(false, "test")};
  const data = new YgData({fake: true});
  const errors: string[] = [];
  data.on("error", event => errors.push(event.code));
  assert.deepEqual(await data.get(), {});
  assert.deepEqual(errors, ["GET_DATA_ERROR"]);
});

test("VkData.set возвращает true после успешной записи", async () => {
  const calls: unknown[] = [];
  browser.window["fake-bridge"] = {
    send: async (method: string, props: unknown) => {
      calls.push([method, props]);
      return {result: true};
    },
    subscribe: () => {},
    supportsAsync: async () => true,
  };
  assert.equal(await new VkData({fake: true}).set("level", "9"), true);
  assert.deepEqual(calls, [["VKWebAppStorageSet", {key: "level", value: "9"}]]);
});
