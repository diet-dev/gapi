import assert from "node:assert/strict";
import {test} from "node:test";
import "../src/fake/showFakeAd.ts";
import {bridge} from "../src/fake-bridge.ts";

for (const format of ["interstitial", "reward"] as const) {
  test(`fake-bridge выбирает изображение для ${format}`, async t => {
    const images: {src: string}[] = [];
    class ElementStub {
      style: Record<string, string> = {};
      innerHTML = "";
      innerText = "";
      appendChild() {}
      removeChild() {}
    }
    class ImageStub extends ElementStub {
      src = "";
      constructor() {
        super();
        images.push(this);
      }
    }
    for (const [name, value] of Object.entries({
      document: {body: new ElementStub(), createElement: () => new ElementStub()},
      Image: ImageStub,
    })) {
      const previous = Object.getOwnPropertyDescriptor(globalThis, name);
      Object.defineProperty(globalThis, name, {configurable: true, value});
      t.after(() => {
        if (previous) Object.defineProperty(globalThis, name, previous);
        else Reflect.deleteProperty(globalThis, name);
      });
    }
    t.mock.timers.enable({apis: ["setInterval"]});
    const pending = bridge.send("VKWebAppShowNativeAds", {ad_format: format});
    await new Promise(resolve => setImmediate(resolve));
    for (let i = 0; i < 30; i++) t.mock.timers.tick(100);
    assert.deepEqual(await pending, {result: true});
    assert.equal(images.length, 1);
    assert.equal(new URL(images[0].src).pathname.split("/").pop(), format === "reward" ? "rw.svg" : "native.svg");
  });
}
