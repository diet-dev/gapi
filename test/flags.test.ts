import {browserGlobals} from "./helpers/browser.ts";
import assert from "node:assert/strict";
import {test} from "node:test";
import type {SDK, GetFlagsParams} from "ysdk";
import type {GameApi} from "../src/interfaces.ts";
import {YandexGameApi} from "../src/yandex.ts";
import {VkGameApi} from "../src/vk.ts";

const browser = browserGlobals(globalThis);

browser.window = {"fake-bridge": {subscribe() {}}};

const defaults = {enabled: true, count: 2, title: "normal"};

// Проверяется tsc; код с намеренными ошибками не выполняется.
function _checkTypes() {
  const api = new YandexGameApi({fake: true, flags: {enabled: true, count: 2, title: "normal"} as const});
  const common: GameApi<typeof defaults> = api;
  const enabled: boolean = common.flags.get().enabled;
  const count: number = common.flags.get().count;
  const title: string = common.flags.get().title;
  // @ts-expect-error неизвестный флаг
  void api.flags.get().missing;
  // @ts-expect-error число не становится строкой
  const wrong: string = api.flags.get().count;
  // @ts-expect-error конфигурация доступна только для чтения
  api.flags.get().enabled = false;
  // @ts-expect-error литерал true расширяется до boolean
  const literal: true = api.flags.get().enabled;
  // @ts-expect-error массивы не поддерживаются
  new YandexGameApi({fake: true, flags: {list: [1, 2]}});
  // @ts-expect-error null не поддерживается
  new YandexGameApi({fake: true, flags: {value: null}});
  // @ts-expect-error у экземпляра без конфигурации нет флагов
  void new YandexGameApi({fake: true}).flags.get().enabled;
  // @ts-expect-error явный тип требует соответствующих дефолтов
  new YandexGameApi<typeof defaults>({fake: true});
  return [enabled, count, title, wrong, literal];
}

test("Яндекс загружает флаги автоматически один раз и преобразует значения по дефолтам", async () => {
  const api = new YandexGameApi({fake: false, flags: defaults});
  let calls = 0;
  let finish!: (value: Record<string, string>) => void;
  api.env.sdk = async () =>
    ({
      getFlags: async (params?: GetFlagsParams) => {
        calls++;
        assert.deepEqual(params, {defaultFlags: {enabled: "true", count: "2", title: "normal"}});
        return new Promise(resolve => {
          finish = resolve;
        });
      },
    }) as unknown as SDK;
  assert.deepEqual(api.flags.get(), defaults);
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(calls, 1);
  const pending = api.flags.ready();
  assert.equal(api.flags.ready(), pending);
  finish({enabled: "false", count: "3.5", title: "hard", unknown: "ignored"});
  assert.deepEqual(await Promise.all([pending, api.flags.ready()]), [true, true]);
  assert.deepEqual(api.flags.get(), {enabled: false, count: 3.5, title: "hard"});
  await api.flags.ready();
  assert.equal(calls, 1);
});

for (const [raw, expected] of [
  ["true", true],
  ["1", true],
  ["false", false],
  ["0", false],
  [" yes ", false],
]) {
  test(`булев флаг ${JSON.stringify(raw)}`, async () => {
    const api = new YandexGameApi({fake: false, flags: {value: false}});
    api.env.sdk = async () => ({getFlags: async () => ({value: raw})}) as unknown as SDK;
    await api.flags.ready();
    assert.equal(api.flags.get().value, expected);
  });
}

for (const raw of ["", " ", "NaN", "Infinity", "abc"]) {
  test(`невалидное число ${JSON.stringify(raw)} сохраняет только свой дефолт`, async () => {
    const api = new YandexGameApi({fake: false, flags: defaults});
    api.env.sdk = async () => ({getFlags: async () => ({count: raw, title: "changed"})}) as unknown as SDK;
    await api.flags.ready();
    assert.deepEqual(api.flags.get(), {...defaults, title: "changed"});
  });
}

test("нулевые и отрицательные числа, пустая строка и отсутствующий флаг", async () => {
  const api = new YandexGameApi({fake: false, flags: {zero: 1, negative: 1, text: "fallback", missing: true}});
  api.env.sdk = async () => ({getFlags: async () => ({zero: "0", negative: " -2.5 ", text: ""})}) as unknown as SDK;
  await api.flags.ready();
  assert.deepEqual(api.flags.get(), {zero: 0, negative: -2.5, text: "", missing: true});
});

for (const failure of ["reject", "missing-sdk", "invalid-response"]) {
  test(`при ${failure} ready завершается с дефолтами и событием ошибки`, async () => {
    const api = new YandexGameApi({fake: false, flags: defaults});
    const errors: string[] = [];
    api.flags.on("error", error => errors.push(error.code));
    api.env.sdk = async () => {
      if (failure === "missing-sdk") return undefined;
      return {
        getFlags: async () => {
          if (failure === "reject") throw new Error("offline");
          return null;
        },
      } as unknown as SDK;
    };
    assert.equal(await api.flags.ready(), false);
    assert.equal(await api.flags.ready(), false);
    assert.deepEqual(api.flags.get(), defaults);
    assert.deepEqual(errors, ["GET_FLAGS_ERROR"]);
  });
}

for (const Api of [YandexGameApi, VkGameApi]) {
  test(`${Api.name}: fake-режим возвращает только дефолты без вызовов SDK`, async () => {
    const initial = {...defaults};
    const api = new Api({fake: true, flags: initial});
    if ("sdk" in api.env) {
      api.env.sdk = async () => {
        throw new Error("SDK must not be called");
      };
    }
    initial.count = 999;
    assert.equal(await api.flags.ready(), true);
    assert.deepEqual(api.flags.get(), defaults);
  });
  test(`${Api.name}: конфигурация необязательна`, async () => {
    const api = new Api({fake: true});
    await api.flags.ready();
    assert.deepEqual(api.flags.get(), {});
  });
}

for (const Api of [VkGameApi]) {
  test(`${Api.name}: production использует дефолты без SDK`, async () => {
    const api = new Api({fake: false, flags: defaults});
    if ("sdk" in api.env) {
      api.env.sdk = async () => {
        throw new Error("SDK must not be called");
      };
    }
    await api.flags.ready();
    assert.deepEqual(api.flags.get(), defaults);
  });
}

test("отдельные экземпляры имеют независимые загрузки и значения", async () => {
  const first = new YandexGameApi({fake: false, flags: defaults});
  const second = new YandexGameApi({fake: false, flags: defaults});
  first.env.sdk = async () => ({getFlags: async () => ({count: "4"})}) as unknown as SDK;
  second.env.sdk = async () => ({getFlags: async () => ({count: "5"})}) as unknown as SDK;
  await Promise.all([first.flags.ready(), second.flags.ready()]);
  assert.equal(first.flags.get().count, 4);
  assert.equal(second.flags.get().count, 5);
});

test("без объявленных флагов Яндекс не запускает запрос SDK", async () => {
  const api = new YandexGameApi({fake: false});
  api.env.sdk = async () => {
    throw new Error("SDK must not be called");
  };
  await api.flags.ready();
  assert.deepEqual(api.flags.get(), {});
});

for (const Api of [YandexGameApi, VkGameApi]) {
  test(`${Api.name}: внешний источник используется один раз в production`, async () => {
    let calls = 0;
    const api = new Api({
      fake: false,
      flags: defaults,
      flagsSource: async strings => {
        calls++;
        assert.deepEqual(strings, {enabled: "true", count: "2", title: "normal"});
        return {count: "7", enabled: "0"};
      },
    });
    if ("sdk" in api.env) {
      api.env.sdk = async () => {
        throw new Error("SDK must not be called");
      };
    }
    await Promise.all([api.flags.ready(), api.flags.ready()]);
    assert.deepEqual(api.flags.get(), {...defaults, count: 7, enabled: false});
    assert.equal(calls, 1);
  });
  test(`${Api.name}: fake игнорирует даже явно переданный источник`, async () => {
    const api = new Api({
      fake: true,
      flags: defaults,
      flagsSource: async () => {
        throw new Error("Source must not be called");
      },
    });
    const errors: string[] = [];
    api.flags.on("error", error => errors.push(error.code));
    await api.flags.ready();
    assert.deepEqual(api.flags.get(), defaults);
    assert.deepEqual(errors, []);
  });
}

for (const lateFailure of [false, true]) {
  test(`таймаут флагов сохраняет дефолты и игнорирует поздний ${lateFailure ? "отказ" : "ответ"}`, async t => {
    t.mock.timers.enable({apis: ["setTimeout"]});
    let resolve!: (value: Record<string, string>) => void;
    let reject!: (error: Error) => void;
    const remote = new Promise<Record<string, string>>((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const api = new VkGameApi({fake: false, flags: defaults, flagsSource: () => remote});
    const errors: string[] = [];
    api.flags.on("error", error => errors.push(error.code));
    const pending = api.flags.ready();
    await Promise.resolve();
    t.mock.timers.tick(2000);
    assert.equal(await pending, false);
    assert.deepEqual(api.flags.get(), defaults);
    if (lateFailure) {
      reject(new Error("late failure"));
    } else {
      resolve({count: "999"});
    }
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(await api.flags.ready(), false);
    assert.deepEqual(api.flags.get(), defaults);
    assert.deepEqual(errors, ["GET_FLAGS_ERROR"]);
  });
}
