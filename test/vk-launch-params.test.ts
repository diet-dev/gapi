import assert from "node:assert/strict";
import {test} from "node:test";
import {VkEnv} from "../src/env/VkEnv.ts";
import {VkPlayer} from "../src/player/VkPlayer.ts";
import {vkGameSearch} from "../src/emulator/platform-url.ts";

function browser(t: {after(fn: () => void): void}, search: string) {
  const old = Object.getOwnPropertyDescriptor(globalThis, "window");
  const location = {search};
  Object.defineProperty(globalThis, "window", {configurable: true, value: {location, screen: {width: 1920}}});
  t.after(() =>
    old ? Object.defineProperty(globalThis, "window", old) : Reflect.deleteProperty(globalThis, "window"),
  );
  return location;
}

for (const [search, id, appId, lang] of [
  ["?platform=web&api_id=test-app-id&viewer_id=123&language=en&custom=a%20b", "123", "test-app-id", "en"],
  ["?vk_platform=desktop_web&vk_app_id=test-app-id&vk_user_id=456&vk_language=es", "456", "test-app-id", "es"],
]) {
  test(`общий источник параметров: ${search.split("&")[0]}`, async t => {
    browser(t, search);
    const env = new VkEnv({fake: false});
    const player = new VkPlayer({fake: false});
    let calls = 0;
    const forbidden = async () => {
      calls++;
      throw new Error("method is not allowed for games");
    };
    Object.defineProperty(env, "bridgeSend", {value: forbidden});
    Object.defineProperty(player, "bridgeSend", {value: forbidden});
    assert.equal(await env.isDesktop(), true);
    assert.equal(await env.appId(), appId);
    assert.equal(await env.lang(), lang);
    assert.equal(await player.id(), id);
    const payload = await env.payload();
    assert.deepEqual(payload, Object.fromEntries(new URLSearchParams(search)));
    payload.platform = "mobile_web";
    assert.equal(await env.isDesktop(), true);
    assert.equal(calls, 0);
  });
}

test("параметры читаются из URL без переименования", async t => {
  const location = browser(t, "?platform=web&api_id=10&viewer_id=20&language=ua&tag=one&tag=two&__proto__=safe");
  const env = new VkEnv({fake: false});
  assert.equal(await env.appId(), "10");
  assert.equal(await env.lang(), "uk");
  assert.equal((await env.payload()).tag, "two");
  assert.equal(Object.getPrototypeOf(await env.payload()), Object.prototype);
  assert.equal(Object.getOwnPropertyDescriptor(await env.payload(), "__proto__")?.value, "safe");
  location.search = "?platform=html5_android&api_id=11&language=kz";
  assert.equal(await env.appId(), "11");
  assert.equal(await env.lang(), "kk");
  assert.equal(await env.isMobile(), true);
  assert.equal((await env.payload()).viewer_id, undefined);
});

test("fake читает параметры из URL без обращений к Bridge", async t => {
  const location = browser(t, "?platform=web&api_id=10&language=en");
  const env = new VkEnv({fake: true});
  Object.defineProperty(env, "bridgeSend", {
    value: async () => {
      throw new Error("Bridge must not be called");
    },
  });
  assert.equal(await env.appId(), "10");
  assert.equal(await env.platform(), "web");
  assert.equal(await env.lang(), "en");
  location.search = "?platform=html5_mobile&language=es";
  assert.equal(await env.platform(), "html5_mobile");
  assert.equal(await env.lang(), "es");
});

test("без ID в параметрах профиль использует только GetUserInfo", async t => {
  browser(t, "");
  const player = new VkPlayer({fake: false});
  Object.defineProperty(player, "bridgeSend", {
    value: async (method: string) => {
      assert.equal(method, "VKWebAppGetUserInfo");
      return {id: 789};
    },
  });
  assert.equal(await player.id(), "789");
});

for (const search of ["", "?custom=keep", "?api_id=test-app-id"]) {
  test(`VK Games: отсутствующие параметры ${search || "(empty)"} не вызывают Bridge`, async t => {
    browser(t, search);
    const env = new VkEnv({fake: false});
    const calls: string[] = [];
    const errors: string[] = [];
    env.on("error", error => errors.push(error.code));
    Object.defineProperty(env, "bridgeSend", {
      value: async (method: string) => {
        calls.push(method);
        throw new Error("method is not allowed for games");
      },
    });
    assert.equal(await env.platform(), "unknown");
    assert.equal(await env.isDesktop(), false);
    assert.equal(await env.isMobile(), false);
    assert.equal(await env.lang(), "ru");
    assert.equal(await env.appId(), search.includes("api_id") ? "test-app-id" : "");
    assert.deepEqual(await env.payload(), Object.fromEntries(new URLSearchParams(search)));
    assert.deepEqual(calls, []);
    assert.deepEqual(errors, []);
  });
}

for (const device of ["desktop", "mobile"] as const) {
  test(`эмулятор ${device} передаёт параметры через URL без Bridge`, async t => {
    browser(t, vkGameSearch("?vk", device));
    const env = new VkEnv({fake: true});
    const player = new VkPlayer({fake: true});
    for (const instance of [env, player]) {
      Object.defineProperty(instance, "bridgeSend", {
        value: async () => {
          throw new Error("Bridge must not be called");
        },
      });
    }
    assert.equal(await env.platform(), device === "desktop" ? "web" : "html5_mobile");
    assert.equal(await env.isDesktop(), device === "desktop");
    assert.equal(await env.isMobile(), device === "mobile");
    assert.equal(await env.lang(), "ru");
    assert.equal(await player.id(), "1");
  });
}

for (const [language, expected] of [
  ["0", "ru"],
  ["1", "ru"],
  ["2", "ru"],
  ["3", "en"],
]) {
  test(`старый числовой язык ${language}`, async t => {
    browser(t, `?platform=web&language=${language}`);
    assert.equal(await new VkEnv({fake: false}).lang(), expected);
  });
}
