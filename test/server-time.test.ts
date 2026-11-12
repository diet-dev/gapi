import assert from "node:assert/strict";
import {test} from "node:test";
import {createMonotonicClock} from "../src/utils/serverTime.ts";
import {YandexGameApi} from "../src/yandex.ts";
import {VkGameApi} from "../src/vk.ts";
import {VkEnv} from "../src/env/VkEnv.ts";

const timestamp = 1793738963707;

test("монотонные часы сохраняют функции и origin при последующей подмене", () => {
  const performance = {
    timeOrigin: timestamp,
    tick: 100,
    now() {
      return this.tick;
    },
  };
  const clock = createMonotonicClock(performance, () => 0);
  assert.equal(clock(), timestamp + 100);
  performance.timeOrigin = 1;
  performance.now = () => 0;
  performance.tick = 150;
  assert.equal(clock(), timestamp + 150);
  performance.tick = 120;
  assert.equal(clock(), timestamp + 150);
});

test("без timeOrigin дата устройства используется только при инициализации", () => {
  let tick = 50;
  let wall = timestamp;
  let calls = 0;
  const clock = createMonotonicClock({now: () => tick}, () => {
    calls++;
    return wall;
  });
  assert.equal(clock(), timestamp);
  wall = 0;
  tick = 100;
  assert.equal(clock(), timestamp + 50);
  assert.equal(calls, 1);
});

test("VK предоставляет async serverTime, устойчивый к подмене globals после импорта", async () => {
  const before = await new VkEnv({fake: false}).serverTime();
  const dateNow = Date.now;
  const descriptor = Object.getOwnPropertyDescriptor(globalThis, "performance");
  try {
    Date.now = () => 0;
    Object.defineProperty(globalThis, "performance", {configurable: true, value: {now: () => 0, timeOrigin: 0}});
    const vk = await new VkEnv({fake: false}).serverTime();
    assert.ok(before !== undefined && vk !== undefined);
    assert.ok(vk >= before);
    assert.ok(vk - before < 10000);
  } finally {
    Date.now = dateNow;
    if (descriptor) Object.defineProperty(globalThis, "performance", descriptor);
    else Reflect.deleteProperty(globalThis, "performance");
  }
});

test("Yandex serverTime берёт актуальное время SDK и сохраняет контекст метода", async () => {
  const sdk = {
    time: timestamp,
    serverTime() {
      return this.time;
    },
  };
  const api = new YandexGameApi({fake: false});
  Object.defineProperty(api.env, "sdk", {value: async () => sdk});
  assert.equal(await api.env.serverTime(), timestamp);
  sdk.time += 1000;
  assert.equal(await api.env.serverTime(true), timestamp + 1000);
});

test("ошибка SDK или неверное время дают undefined и GET_SERVER_TIME_ERROR", async () => {
  for (const sdk of [
    undefined,
    {},
    {serverTime: () => 0},
    {serverTime: () => NaN},
    {
      serverTime: () => {
        throw Error("SDK error");
      },
    },
  ]) {
    const api = new YandexGameApi({fake: false});
    const events: string[] = [];
    api.env.on("error", event => events.push(event.code));
    Object.defineProperty(api.env, "sdk", {value: async () => sdk});
    assert.equal(await api.env.serverTime(), undefined);
    assert.deepEqual(events, ["GET_SERVER_TIME_ERROR"]);
  }
});

test("VK получает источник времени через конструктор и передаёт forceSync", async () => {
  const flags: Array<boolean | undefined> = [];
  const api = new VkGameApi({
    fake: false,
    serverTime: async force => {
      flags.push(force);
      return timestamp;
    },
  });
  assert.equal("serverTime" in api, false);
  assert.equal(await api.env.serverTime(), timestamp);
  assert.equal(await api.env.serverTime(true), timestamp);
  assert.deepEqual(flags, [undefined, true]);
});

test("VK сообщает об ошибке провайдера через env и не подменяет её локальными часами", async () => {
  for (const read of [
    async () => undefined,
    async () => NaN,
    async () => 0,
    async () => Infinity,
    async () => Number.MAX_SAFE_INTEGER + 1,
    async () => {
      throw new Error("offline");
    },
  ]) {
    const api = new VkGameApi({fake: false, serverTime: read});
    const codes: string[] = [];
    api.env.on("error", event => codes.push(event.code));
    assert.equal(await api.env.serverTime(), undefined);
    assert.deepEqual(codes, ["GET_SERVER_TIME_ERROR"]);
  }
});
