import type {SDK} from "ysdk";
import type {ApiEvents} from "../src/interfaces.ts";
import {browserGlobals} from "./helpers/browser.ts";
import assert from "node:assert/strict";
import {test} from "node:test";
import {bridge, init} from "../src/fake-bridge.ts";
import {VkAds} from "../src/ads/VkAds.ts";
import {YgAds} from "../src/ads/YgAds.ts";

const browser = browserGlobals(globalThis);

browser.window = browser.window ?? {};
init();

// Подменяет fake-bridge на платформу, у которой все методы падают.
function failBridge() {
  browser.window["fake-bridge"] = {
    send: async () => {
      throw new Error("bridge fail");
    },
    supportsAsync: async () => true,
    subscribe: () => {},
  };
}

test("VkAds: при сбое bridge showNative возвращает false и эмитит SEND_ERROR + SHOW_AD_ERROR", async () => {
  failBridge();
  const ads = new VkAds({fake: true});
  const events: string[] = [];
  ads.on("error", e => events.push(e.code));

  assert.deepEqual(await ads.showNative(), "error");
  assert.deepEqual(events, ["SEND_ERROR", "SHOW_AD_ERROR"]);
});

test("VkAds: при сбое bridge check* возвращают false и эмитят SHOW_AD_ERROR", async () => {
  failBridge();
  const ads = new VkAds({fake: true});
  const events: string[] = [];
  ads.on("error", e => events.push(e.code));

  assert.equal(await ads.checkNative(), false);
  assert.equal(await ads.checkRewarded(), false);
  assert.equal(await ads.checkBanner(), false);
  assert.deepEqual(events, [
    "SEND_ERROR",
    "SHOW_AD_ERROR",
    "SEND_ERROR",
    "SHOW_AD_ERROR",
    "SEND_ERROR",
    "SHOW_AD_ERROR",
  ]);
});

test("VkAds: при сбое bridge hideBanner возвращает false и эмитит SEND_ERROR + HIDE_AD_ERROR", async () => {
  failBridge();
  const ads = new VkAds({fake: true});
  const events: string[] = [];
  ads.on("error", e => events.push(e.code));

  assert.equal(await ads.hideBanner(), false);
  assert.deepEqual(events, ["SEND_ERROR", "HIDE_AD_ERROR"]);
});

test("fake-bridge: все рекламные методы возвращают { result: true }", async () => {
  browser.window["fake-bridge"] = undefined;
  init();

  assert.deepEqual(await bridge.send("VKWebAppShowNativeAds", {ad_format: "interstitial"}), {result: true});
  assert.deepEqual(await bridge.send("VKWebAppCheckNativeAds", {ad_format: "reward"}), {result: true});
  assert.deepEqual(await bridge.send("VKWebAppShowBannerAd", {banner_location: "top"}), {result: true});
  assert.deepEqual(await bridge.send("VKWebAppCheckBannerAd"), {result: true});
  assert.deepEqual(await bridge.send("VKWebAppHideBannerAd"), {result: true});
});

test("VkAds (fake): показ и проверка рекламы успешны, события идут парами", async () => {
  browser.window["fake-bridge"] = undefined;
  init();
  const ads = new VkAds({fake: true});
  const events: string[] = [];
  ads.on("show:native", () => events.push("show:native"));
  ads.on("hide:native", () => events.push("hide:native"));

  assert.deepEqual(await ads.showNative(), "success");
  assert.equal(await ads.checkBanner(), true);
  assert.deepEqual(events, ["show:native", "hide:native"]);
});

test("YgAds: при недоступном SDK методы возвращают false и эмитят коды ошибок", async () => {
  browser.window["fake-ysdk"] = undefined;
  const ads = new YgAds({fake: true});
  const events: string[] = [];
  ads.on("error", e => events.push(e.code));

  assert.deepEqual(await ads.showNative(), "error");
  assert.deepEqual(await ads.showRewarded(), "error");
  assert.equal(await ads.showBanner(), false);
  assert.equal(await ads.checkBanner(), false);
  assert.equal(await ads.hideBanner(), false);
  assert.deepEqual(events, ["SHOW_AD_ERROR", "SHOW_AD_ERROR", "SHOW_AD_ERROR", "SHOW_AD_ERROR", "HIDE_AD_ERROR"]);
});

test("YgAds: showNative — wasShown определяет результат, события идут парами", async () => {
  browser.window["fake-ysdk"] = {
    adv: {
      showFullscreenAdv: (opts: Parameters<SDK["adv"]["showFullscreenAdv"]>[0]) => {
        opts?.callbacks?.onOpen?.();
        opts?.callbacks?.onClose?.(true);
      },
    },
  };
  const ads = new YgAds({fake: true});
  const events: string[] = [];
  ads.on("show:native", () => events.push("show:native"));
  ads.on("hide:native", () => events.push("hide:native"));

  assert.deepEqual(await ads.showNative(), "success");
  assert.deepEqual(events, ["show:native", "hide:native"]);
});

test("YgAds: showRewarded — onRewarded даёт true даже если onClose раньше", async () => {
  browser.window["fake-ysdk"] = {
    adv: {
      showRewardedVideo: (opts: Parameters<SDK["adv"]["showRewardedVideo"]>[0]) => {
        opts?.callbacks?.onOpen?.();
        opts?.callbacks?.onClose?.();
        setTimeout(() => opts?.callbacks?.onRewarded?.(), 50);
      },
    },
  };
  const ads = new YgAds({fake: true});

  assert.deepEqual(await ads.showRewarded(), "success");
});

test("YgAds: showRewarded — без onRewarded метод ждёт окно и возвращает false", async () => {
  browser.window["fake-ysdk"] = {
    adv: {
      showRewardedVideo: (opts: Parameters<SDK["adv"]["showRewardedVideo"]>[0]) => {
        opts?.callbacks?.onClose?.();
      },
    },
  };
  const ads = new YgAds({fake: true});

  assert.deepEqual(await ads.showRewarded(), "cancelled");
});

test("YgAds: showNative — onOffline разрешает промис с false и ошибкой (не висит)", async () => {
  browser.window["fake-ysdk"] = {
    adv: {
      showFullscreenAdv: (opts: Parameters<SDK["adv"]["showFullscreenAdv"]>[0]) => {
        opts?.callbacks?.onOffline?.();
      },
    },
  };
  const ads = new YgAds({fake: true});
  const reasons: ApiEvents["error"][] = [];
  ads.on("error", e => reasons.push(e));

  const result = await Promise.race([
    ads.showNative(),
    new Promise((_, reject) => setTimeout(() => reject(new Error("промис завис")), 1000)),
  ]);

  assert.deepEqual(result, "error");
  assert.deepEqual(reasons, [{code: "SHOW_AD_ERROR", reason: "offline"}]);
});

test("YgAds: showBanner — при reject платформы возвращается false с ошибкой, без throw", async () => {
  browser.window["fake-ysdk"] = {
    adv: {
      showBannerAdv: () => Promise.reject(new Error("banner fail")),
    },
  };
  const ads = new YgAds({fake: true});
  const events: ApiEvents["error"][] = [];
  ads.on("error", e => events.push(e));

  assert.equal(await ads.showBanner(), false);
  assert.deepEqual(events, [{code: "SHOW_AD_ERROR", reason: "Error: banner fail"}]);
});

test("YgAds: showBanner — успех даёт true и show:banner", async () => {
  browser.window["fake-ysdk"] = {
    adv: {
      showBannerAdv: () => Promise.resolve({}),
    },
  };
  const ads = new YgAds({fake: true});
  let shown = 0;
  ads.on("show:banner", () => shown++);

  assert.equal(await ads.showBanner(), true);
  assert.equal(shown, 1);
});

test("YgAds: hideBanner и checkBanner — reject платформы не выбрасывается наружу", async () => {
  browser.window["fake-ysdk"] = {
    adv: {
      hideBannerAdv: () => Promise.reject(new Error("hide fail")),
      getBannerAdvStatus: () => Promise.reject(new Error("status fail")),
    },
  };
  const ads = new YgAds({fake: true});
  const events: string[] = [];
  ads.on("error", e => events.push(e.code));

  assert.equal(await ads.hideBanner(), false);
  assert.equal(await ads.checkBanner(), false);
  assert.deepEqual(events, ["HIDE_AD_ERROR", "SHOW_AD_ERROR"]);
});

for (const cancelled of [true, false]) {
  test(`VkAds: отказ пользователя=${cancelled} отличается от технического сбоя`, async () => {
    browser.window["fake-bridge"] = {
      subscribe: () => {},
      send: async () => {
        throw {
          error_type: "client_error",
          error_data: {error_code: cancelled ? 4 : 20, error_reason: cancelled ? "User denied" : "No ads"},
        };
      },
    };
    const ads = new VkAds({fake: true});
    const events: string[] = [];
    const errors: ApiEvents["error"][] = [];
    ads.on("show:rewarded", () => events.push("show"));
    ads.on("hide:rewarded", () => events.push("hide"));
    ads.on("error", error => {
      events.push(error.code);
      errors.push(error);
    });
    assert.deepEqual(await ads.showRewarded(), cancelled ? "cancelled" : "error");
    assert.deepEqual(
      events,
      cancelled ? ["show", "SEND_ERROR", "hide"] : ["show", "SEND_ERROR", "hide", "SHOW_AD_ERROR"],
    );
    if (!cancelled) assert.deepEqual(errors.at(-1), {code: "SHOW_AD_ERROR", reason: "No ads"});
  });
}

for (const format of ["native", "rewarded"] as const) {
  test(`VkAds: ${format} без показа не означает отмену`, async () => {
    browser.window["fake-bridge"] = {subscribe: () => {}, send: async () => ({result: false})};
    const ads = new VkAds({fake: true});
    assert.deepEqual(await (format === "native" ? ads.showNative() : ads.showRewarded()), "error");
  });
}

test("VkAds: native не сообщает отмену даже при коде 4", async () => {
  browser.window["fake-bridge"] = {
    subscribe: () => {},
    send: async () => {
      throw {error_type: "client_error", error_data: {error_code: 4, error_reason: "User denied"}};
    },
  };
  assert.deepEqual(await new VkAds({fake: true}).showNative(), "error");
});

test("YgAds: ошибка и последующее закрытие не означают отмену", async () => {
  browser.window["fake-ysdk"] = {
    adv: {
      showRewardedVideo: (opts: Parameters<SDK["adv"]["showRewardedVideo"]>[0]) => {
        opts?.callbacks?.onError?.(new Error("offline"));
        opts?.callbacks?.onClose?.();
      },
    },
  };
  assert.deepEqual(await new YgAds({fake: true}).showRewarded(), "error");
});
