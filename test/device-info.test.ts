import assert from "node:assert/strict";
import {test} from "node:test";
import {YgEnv} from "../src/env/YgEnv.ts";
import {VkEnv} from "../src/env/VkEnv.ts";
import {makeFakeDeviceInfo} from "../src/fake/deviceInfo.ts";

const desktop = {userAgent: "Mozilla/5.0 (X11; Linux x86_64)", platform: "Linux x86_64", maxTouchPoints: 0};

for (const [type, device] of [
  ["desktop", desktop],
  ["desktop", {...desktop, maxTouchPoints: 10}],
  ["mobile", {...desktop, userAgent: "Mozilla/5.0 (Linux; Android 13) Mobile"}],
  ["mobile", {...desktop, userAgent: "Mozilla/5.0 (iPhone) Mobile"}],
  ["tablet", {...desktop, userAgent: "Mozilla/5.0 (Linux; Android 13)"}],
  ["tablet", {...desktop, platform: "MacIntel", maxTouchPoints: 5}],
  ["tv", {...desktop, userAgent: "Mozilla/5.0 SMART-TV Tizen"}],
] as const) {
  test(`fake deviceInfo: ${type}, ${device.userAgent}, ${device.maxTouchPoints}`, async () => {
    const deviceInfo = makeFakeDeviceInfo(device);
    assert.equal(deviceInfo.type, type);
    assert.equal(deviceInfo.isDesktop(), type === "desktop");
    assert.equal(deviceInfo.isMobile(), type === "mobile");
    assert.equal(deviceInfo.isTablet(), type === "tablet");
    assert.equal(deviceInfo.isTV(), type === "tv");
    const env = new YgEnv({fake: true});
    Object.defineProperty(env, "sdk", {value: async () => ({deviceInfo})});
    assert.equal(await env.isDesktop(), type === "desktop");
    assert.equal(await env.isMobile(), type === "mobile");
  });
}

for (const type of ["desktop", "mobile", "tablet", "tv"]) {
  test(`production Yandex: ${type} определяется по SDK без вызова deviceInfo helpers`, async () => {
    const env = new YgEnv({fake: false});
    const forbidden = () => {
      throw new Error("deviceInfo helper must not be required");
    };
    Object.defineProperty(env, "sdk", {
      value: async () => ({deviceInfo: {type, isDesktop: forbidden, isMobile: forbidden}}),
    });
    assert.equal(await env.platform(), type);
    assert.equal(await env.isDesktop(), type === "desktop");
    assert.equal(await env.isMobile(), type === "mobile");
  });
}

test("Yandex: отсутствующие SDK или deviceInfo не ломают запуск", async () => {
  for (const sdk of [undefined, {}, {deviceInfo: {}}]) {
    const env = new YgEnv({fake: false});
    Object.defineProperty(env, "sdk", {value: async () => sdk});
    assert.equal(await env.platform(), "unknown");
    assert.equal(await env.isDesktop(), false);
    assert.equal(await env.isMobile(), false);
  }
});

for (const platform of [
  "desktop_web",
  "desktop_web_messenger",
  "desktop_app_messenger",
  "html5_desktop",
  "mobile_web",
  "mobile_android",
  "mobile_iphone",
  "mobile_ipad",
  "html5_android",
  "html5_ios",
  "html5_mobile",
]) {
  test(`production VK: ${platform}`, async t => {
    launchUrl(t, `?vk_platform=${platform}`);
    const env = new VkEnv({fake: false});
    Object.defineProperty(env, "bridgeSend", {value: async () => ({vk_platform: platform})});
    assert.equal(await env.platform(), platform);
    assert.equal(await env.isDesktop(), platform.includes("desktop"));
    assert.equal(await env.isMobile(), !platform.includes("desktop"));
  });
}

test("Yandex: сбой определения типа возвращает безопасные значения и событие ошибки", async () => {
  const env = new YgEnv({fake: false});
  const errors: string[] = [];
  env.on("error", event => errors.push(event.code));
  Object.defineProperty(env, "sdk", {
    value: async () => {
      throw new Error("SDK unavailable");
    },
  });
  assert.equal(await env.isDesktop(), false);
  assert.equal(await env.isMobile(), false);
  assert.deepEqual(errors, ["GET_ENV_ERROR", "GET_ENV_ERROR"]);
});

for (const [search, platform, desktop, mobile] of [
  ["?platform=web", "web", true, false],
  ["?platform=html5_desktop", "html5_desktop", true, false],
  ["?platform=html5_android", "html5_android", false, true],
  ["?platform=html5_ios", "html5_ios", false, true],
  ["?platform=html5_mobile", "html5_mobile", false, true],
  ["?vk_platform=desktop_web", "desktop_web", true, false],
]) {
  test(`VK Games: launch URL ${search} works without the forbidden Mini Apps method`, async t => {
    useBrowserGlobals(t);
    const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
    Object.defineProperty(globalThis, "location", {configurable: true, value: {search}});
    t.after(() =>
      previous
        ? Object.defineProperty(globalThis, "location", previous)
        : Reflect.deleteProperty(globalThis, "location"),
    );
    const env = new VkEnv({fake: false});
    let calls = 0;
    Object.defineProperty(env, "bridgeSend", {
      value: async () => {
        calls++;
        throw {
          error_type: "api_error",
          error_data: {error_code: 15, error_msg: "Access denied: this method is not allowed for games"},
        };
      },
    });
    assert.equal(await env.platform(), platform);
    assert.equal(await env.isDesktop(), desktop);
    assert.equal(await env.isMobile(), mobile);
    assert.equal(calls, 0, "device detection must not call the method forbidden for games");
  });
}

for (const [width, desktop] of [
  [390, false],
  [767, false],
  [768, true],
  [1920, true],
] as const) {
  test(`VK web: screen width ${width} guards desktop detection`, async t => {
    useBrowserGlobals(t);
    const previousLocation = Object.getOwnPropertyDescriptor(globalThis, "location");
    const previousScreen = Object.getOwnPropertyDescriptor(globalThis, "screen");
    Object.defineProperty(globalThis, "location", {configurable: true, value: {search: "?platform=web"}});
    Object.defineProperty(globalThis, "screen", {configurable: true, value: {width}});
    t.after(() => {
      void (previousLocation
        ? Object.defineProperty(globalThis, "location", previousLocation)
        : Reflect.deleteProperty(globalThis, "location"));
      void (previousScreen
        ? Object.defineProperty(globalThis, "screen", previousScreen)
        : Reflect.deleteProperty(globalThis, "screen"));
    });
    const env = new VkEnv({fake: false});
    assert.equal(await env.isDesktop(), desktop);
    assert.equal(await env.isMobile(), !desktop);
  });
}

function useBrowserGlobals(t: {after(fn: () => void): void}): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", {
    configurable: true,
    value: {
      get location() {
        return globalThis.location;
      },
      get screen() {
        return globalThis.screen;
      },
    },
  });
  t.after(() =>
    previous ? Object.defineProperty(globalThis, "window", previous) : Reflect.deleteProperty(globalThis, "window"),
  );
}

function launchUrl(t: {after(fn: () => void): void}, search: string): void {
  useBrowserGlobals(t);
  const previous = Object.getOwnPropertyDescriptor(globalThis, "location");
  Object.defineProperty(globalThis, "location", {configurable: true, value: {search}});
  t.after(() =>
    previous ? Object.defineProperty(globalThis, "location", previous) : Reflect.deleteProperty(globalThis, "location"),
  );
}
