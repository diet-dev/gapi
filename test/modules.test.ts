import type {ApiEvents} from "../src/interfaces.ts";
import {browserGlobals} from "./helpers/browser.ts";
import assert from "node:assert/strict";
import {test} from "node:test";
import {init} from "../src/fake-bridge.ts";
import {VkEnv} from "../src/env/VkEnv.ts";
import {VkData} from "../src/data/VkData.ts";
import {VkGame} from "../src/game/VkGame.ts";
import {VkPlayer} from "../src/player/VkPlayer.ts";
import {VkPurchases} from "../src/purchases/VkPurchases.ts";
import {VkScore} from "../src/score/VkScore.ts";
import {VkShortcut} from "../src/shortcut/VkShortcut.ts";

const browser = browserGlobals(globalThis);

browser.window = browser.window ?? {};
init();

// Эмулирует ошибку моста для проверки обработки сбоев в модулях.
function failBridge() {
  browser.window["fake-bridge"] = {
    send: async () => {
      throw new Error("bridge fail");
    },
    supportsAsync: async () => true,
    subscribe: () => {},
  };
}

function collect(emit: (cb: (e: ApiEvents["error"]) => void) => void): string[] {
  const events: string[] = [];
  emit(e => events.push(e.code));
  return events;
}

test("Аудит VkEnv: при сбое bridge возвращаются дефолты и эмитятся коды", async () => {
  failBridge();
  const env = new VkEnv({fake: true});
  const events = collect(cb => env.on("error", cb));

  assert.equal(await env.lang(), "ru");
  assert.equal(await env.appId(), "");
  assert.equal(await env.platform(), "unknown");
  assert.equal(await env.theme(), "light");
  assert.deepEqual(events, ["SEND_ERROR", "GET_THEME_ERROR"]);
});

test("Аудит VkGame: при сбое bridge ready возвращает false и эмитит READY_ERROR", async () => {
  failBridge();
  const game = new VkGame({fake: true});
  const events = collect(cb => game.on("error", cb));

  assert.equal(await game.ready(), false);
  assert.deepEqual(events, ["SEND_ERROR", "READY_ERROR"]);
});

test("Аудит VkPlayer: при сбое bridge name возвращает пустую строку и эмитит GET_PLAYER_INFO_ERROR", async () => {
  failBridge();
  const player = new VkPlayer({fake: true});
  const events = collect(cb => player.on("error", cb));

  assert.equal(await player.name(), "");
  assert.deepEqual(events, ["SEND_ERROR", "GET_PLAYER_INFO_ERROR"]);
});

test("Аудит VkData: при сбое bridge get возвращает {} и эмитятся коды", async () => {
  failBridge();
  const data = new VkData({fake: true});
  const events = collect(cb => data.on("error", cb));

  assert.deepEqual(await data.get(["k"]), {});
  assert.equal(await data.set("k", "v"), false);
  assert.deepEqual(events, ["SEND_ERROR", "GET_DATA_ERROR", "SEND_ERROR", "SET_DATA_ERROR"]);
});

test("Аудит VkScore: при сбое bridge laeders эмитит SHOW_LEADERBOARD_ERROR", async () => {
  failBridge();
  const score = new VkScore({fake: true});
  const events = collect(cb => score.on("error", cb));

  await score.laeders("top");
  assert.deepEqual(events, ["SEND_ERROR", "SHOW_LEADERBOARD_ERROR"]);
});

test("Аудит VkPurchases: при сбое bridge purchase возвращает false и эмитит PURCHASE_ERROR", async () => {
  failBridge();
  const purchases = new VkPurchases({fake: true});
  const events = collect(cb => purchases.on("error", cb));

  assert.equal(
    await purchases.purchase({
      id: "p1",
      title: "Test",
      price: "1",
      description: "",
      currencyCode: "",
      currencyImage: "",
    }),
    false,
  );
  assert.deepEqual(events, ["SEND_ERROR", "PURCHASE_ERROR"]);
});

test("Аудит VkShortcut: при сбое bridge check/show возвращают false и эмитят коды", async () => {
  failBridge();
  const shortcut = new VkShortcut({fake: true});
  const events = collect(cb => shortcut.on("error", cb));

  assert.equal(await shortcut.check(), false);
  assert.equal(await shortcut.show(), false);
  assert.deepEqual(events, ["SEND_ERROR", "SHORTCUT_CHECK_ERROR", "SEND_ERROR", "SHORTCUT_SHOW_ERROR"]);
});

test("VkScore.set возвращает false для неподдерживаемой записи", async () => {
  assert.equal(await new VkScore({fake: true}).set(100, "score"), false);
});
