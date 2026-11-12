import {browserGlobals} from "./helpers/browser.ts";
import assert from "node:assert/strict";
import {test} from "node:test";
import {init} from "../src/fake-bridge.ts";
import {VkNotifications} from "../src/notifications/VkNotifications.ts";
import {YgNotifications} from "../src/notifications/YgNotifications.ts";

const browser = browserGlobals(globalThis);

browser.window = browser.window ?? {};
init();

test("YgNotifications: в Yandex SDK нет API уведомлений — честный no-op", async () => {
  const n = new YgNotifications({fake: true});
  assert.equal(await n.check(), false);
  assert.equal(await n.request(), false);
  assert.equal(await n.disable(), false);
});

test("VkNotifications (fake): платформа поддерживает уведомления", async () => {
  const n = new VkNotifications({fake: true});
  assert.equal(await n.check(), true);
});

test("VkNotifications (fake): согласие запрашивается и отзывается", async () => {
  const n = new VkNotifications({fake: true});
  assert.equal(await n.request(), true);
  assert.equal(await n.disable(), true);
});

test("VkNotifications: при сбое bridge эмитится SEND_ERROR и конкретный код", async () => {
  browser.window["fake-bridge"] = {
    send: async () => {
      throw new Error("bridge fail");
    },
    supportsAsync: async () => true,
    subscribe: () => {},
  };

  const events: string[] = [];
  const n = new VkNotifications({fake: true});
  n.on("error", e => events.push(e.code));

  assert.equal(await n.request(), false);
  assert.equal(await n.disable(), false);
  assert.deepEqual(events, ["SEND_ERROR", "NOTIFICATIONS_REQUEST_ERROR", "SEND_ERROR", "NOTIFICATIONS_DISABLE_ERROR"]);
});
