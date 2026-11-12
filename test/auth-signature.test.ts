import {browserGlobals} from "./helpers/browser.ts";
import assert from "node:assert/strict";
import {test} from "node:test";
import {YgAuth} from "../src/auth/YgAuth.ts";

const browser = browserGlobals(globalThis);

browser.window = browser.window ?? {};

test("YgAuth.signature возвращает непрозрачную подпись и не заменяет Player", async () => {
  let ordinary = 0;
  let signed = 0;
  const player = {isAuthorized: () => true};
  browser.window["fake-ysdk"] = {
    getPlayer: async (options?: {signed?: boolean}) => {
      if (options?.signed) {
        signed++;
        return {signature: "signature.payload"};
      }
      ordinary++;
      return player;
    },
  };
  const auth = new YgAuth({fake: true});
  assert.equal(await auth.check(), true);
  assert.equal(await auth.signature(), "signature.payload");
  assert.equal(await auth.check(), true);
  assert.equal(ordinary, 1);
  assert.equal(signed, 1);
});

test("YgAuth.signature сообщает об ошибках через error и возвращает null", async () => {
  const auth = new YgAuth({fake: true});
  const errors: string[] = [];
  auth.on("error", event => errors.push(event.code));
  browser.window["fake-ysdk"] = undefined;
  assert.equal(await auth.signature(), null);
  browser.window["fake-ysdk"] = {getPlayer: async () => ({signature: ""})};
  assert.equal(await auth.signature(), null);
  browser.window["fake-ysdk"] = {
    getPlayer: async () => {
      throw new Error("SDK failed");
    },
  };
  assert.equal(await auth.signature(), null);
  assert.deepEqual(errors, Array(3).fill("GET_PLAYER_SIGNATURE_ERROR"));
});
