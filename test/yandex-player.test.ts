import {browserGlobals} from "./helpers/browser.ts";
import assert from "node:assert/strict";
import {test} from "node:test";
import {YgAuth} from "../src/auth/YgAuth.ts";
import {YgFakePlayer} from "../src/fake/YgFakePlayer.ts";
import {storageKey} from "../src/fake/storage-keys.ts";
import type {YandexSignedPlayerPayload} from "../src/yandex.ts";
import {authorizedYandexPlayerPayload, guestYandexPlayerPayload} from "./fixtures/yandex-player.ts";

const browser = browserGlobals(globalThis);

test("getMode эмулятора согласован с isAuthorized при входе, выходе и между играми", () => {
  const original = browser.window;
  const values = new Map<string, string>();
  browser.window = {localStorage: {getItem: (key: string) => values.get(key) ?? null}};
  try {
    const player = new YgFakePlayer(false, "first-game");
    const other = new YgFakePlayer(false, "other-game");
    assert.equal(player.isAuthorized(), false);
    assert.equal(player.getMode(), "lite");
    values.set(storageKey("first-game", "yg", "auth-time"), "1800000000000");
    assert.equal(player.isAuthorized(), true);
    assert.equal(player.getMode(), "");
    assert.equal(other.isAuthorized(), false);
    assert.equal(other.getMode(), "lite");
    values.delete(storageKey("first-game", "yg", "auth-time"));
    assert.equal(player.isAuthorized(), false);
    assert.equal(player.getMode(), "lite");
    assert.equal(new YgFakePlayer(true, "first-game").signature, "signed");
  } finally {
    browser.window = original;
  }
});

test("подпись доступна гостю, не подтверждает вход и не подменяет обычный Player", async () => {
  const original = browser.window;
  let current: YandexSignedPlayerPayload = guestYandexPlayerPayload;
  let ordinaryCalls = 0;
  let signedCalls = 0;
  let dialogs = 0;
  browser.window = {
    "fake-ysdk": {
      getPlayer: async (options?: {signed?: boolean}) => {
        if (options?.signed) {
          signedCalls++;
          return {signature: current.data.mode === "lite" ? "unverified-guest-proof" : "unverified-account-proof"};
        }
        ordinaryCalls++;
        const data = current.data;
        return {isAuthorized: () => data.mode !== "lite"};
      },
      auth: {
        openAuthDialog: async () => {
          dialogs++;
          current = authorizedYandexPlayerPayload;
        },
      },
    },
  };
  try {
    const auth = new YgAuth({fake: true});
    assert.equal(await auth.check(), false);
    assert.equal(await auth.signature(), "unverified-guest-proof");
    assert.equal(await auth.check(), false);
    assert.equal(dialogs, 0);
    assert.equal(ordinaryCalls, 1);
    await auth.start();
    assert.equal(dialogs, 1);
    assert.equal(await auth.check(), true);
    assert.equal(await auth.signature(), "unverified-account-proof");
    assert.equal(await auth.check(), true);
    assert.equal(ordinaryCalls, 2);
    assert.equal(signedCalls, 2);
  } finally {
    browser.window = original;
  }
});
