import assert from "node:assert/strict";
import {test} from "node:test";
import {YgEnv} from "../src/env/YgEnv.ts";

for (const [name, browser, expected] of [
  ["без window", undefined, "light"],
  ["без matchMedia", {}, "light"],
  ["с нефункциональным matchMedia", {matchMedia: true}, "light"],
  ["со светлой темой", {matchMedia: () => ({matches: false})}, "light"],
  [
    "с тёмной темой",
    {
      matchMedia: (query: string) => {
        assert.equal(query, "(prefers-color-scheme: dark)");
        return {matches: true};
      },
    },
    "dark",
  ],
] as const) {
  test(`YgEnv.theme ${name}`, async t => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
    Object.defineProperty(globalThis, "window", {configurable: true, value: browser});
    t.after(() => {
      if (previous) Object.defineProperty(globalThis, "window", previous);
      else Reflect.deleteProperty(globalThis, "window");
    });
    assert.equal(await new YgEnv({fake: false}).theme(), expected);
  });
}
