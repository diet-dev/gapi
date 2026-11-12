import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {switchPlatformSearch, vkGameSearch} from "../src/emulator/platform-url.ts";

describe("switchPlatformSearch", () => {
  it("заменяет существующий токен площадки", () => {
    assert.equal(switchPlatformSearch("?vk", "yandex"), "?yandex");
    assert.equal(switchPlatformSearch("?yandex", "vk"), "?vk");
    assert.equal(switchPlatformSearch("?custom", "vk"), "?vk");
  });

  it("сохраняет остальные параметры при замене", () => {
    assert.equal(switchPlatformSearch("?vk&foo=1", "yandex"), "?yandex&foo=1");
    assert.equal(switchPlatformSearch("?foo=1&vk", "yandex"), "?foo=1&yandex");
  });

  it("добавляет токен, если площадки в query нет", () => {
    assert.equal(switchPlatformSearch("", "yandex"), "?yandex");
    assert.equal(switchPlatformSearch("?foo=1", "vk"), "?foo=1?vk");
  });

  it("не трогает параметры вида ?yandex=1 и слова в значениях", () => {
    assert.equal(switchPlatformSearch("?vk=1", "yandex"), "?vk=1?yandex");
    assert.equal(switchPlatformSearch("?src=yandex", "vk"), "?src=yandex?vk");
  });
});

describe("vkGameSearch", () => {
  it("передаёт платформу, язык и тестовый ID в URL iframe", () => {
    assert.equal(vkGameSearch("?vk&learning", "desktop"), "?vk&learning&platform=web&language=ru&viewer_id=1");
    assert.equal(vkGameSearch("?vk", "mobile"), "?vk&platform=html5_mobile&language=ru&viewer_id=1");
  });
  it("сохраняет явно заданные параметры обоих форматов", () => {
    const legacy = "?vk&platform=html5_ios&language=3&viewer_id=42";
    assert.equal(vkGameSearch(legacy, "desktop"), legacy);
    const modern = "?vk&vk_platform=mobile_android&vk_language=en&vk_user_id=42";
    assert.equal(vkGameSearch(modern, "desktop"), modern);
  });
});
