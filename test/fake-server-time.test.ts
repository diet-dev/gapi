import assert from "node:assert/strict";
import {test} from "node:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {serverTime} from "../src/utils/serverTime.ts";
import {YandexGameApi} from "../src/yandex.ts";

test("fake SDK содержит рабочий метод serverTime", async () => {
  const source = readFileSync(new URL("../src/fake-ysdk.ts", import.meta.url), "utf8");
  const body = source.match(/serverTime: function \(\): number \{([\s\S]*?)\n {4}\}/)?.[1];
  assert.ok(body);
  const fakeServerTime = runInNewContext("(function () {" + body + "})", {serverTime});
  const api = new YandexGameApi({fake: true});
  Object.defineProperty(api.env, "sdk", {value: async () => ({serverTime: fakeServerTime})});
  const first = await api.env.serverTime();
  const second = await api.env.serverTime();
  assert.ok(first !== undefined && first > 0 && second !== undefined && second >= first);
});
