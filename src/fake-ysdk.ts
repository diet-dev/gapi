import type {FakeWindow} from "./fake/window.ts";
/** Эмуляция используемых методов Yandex Games SDK. */

import type * as ysdk from "ysdk";
import {showFakeAd} from "./fake/showFakeAd.ts";
import {YgFakeLeaderboard, type LeaderboardLanguage} from "./fake/YgFakeLeaderboard.ts";
import {YgFakePlayer} from "./fake/YgFakePlayer.ts";
import {onToggleTab} from "./fake/onToggleTab.ts";
import {attachClearApiStorage, resolveAppId, storageKey, warnIfNoAppId} from "./fake/storage-keys.ts";
import {logger} from "./log.ts";
import {serverTime} from "./utils/serverTime.ts";
import {makeFakeDeviceInfo} from "./fake/deviceInfo.ts";

const log = logger.child("fake-ysdk");

const id = setTimeout(() => {
  log.warn("Возможно нет вызова READY");
}, 10 * 1000);

type Events = "game_api_pause" | "game_api_resume";

const handlers: Partial<Record<Events, Array<() => void>>> = {};

onToggleTab(visible => {
  const arr = handlers[visible ? "game_api_resume" : "game_api_pause"];

  if (arr) {
    arr.forEach(h => h());
  }
});

export const makeFakeYSDK = (): ysdk.SDK => {
  const appId = resolveAppId();
  return {
    EVENTS: {
      EXIT: "EXIT",
      HISTORY_BACK: "HISTORY_BACK",
      ACCOUNT_SELECTION_DIALOG_OPENED: "ACCOUNT_SELECTION_DIALOG_OPENED",
      ACCOUNT_SELECTION_DIALOG_CLOSED: "ACCOUNT_SELECTION_DIALOG_CLOSED",
    },
    adv: {
      getBannerAdvStatus: function (): Promise<{reason?: ysdk.StickyAdvError; stickyAdvIsShowing: boolean}> {
        return Promise.resolve({stickyAdvIsShowing: true});
      },
      hideBannerAdv: async function (): Promise<{stickyAdvIsShowing: boolean}> {
        (window.parent as FakeWindow | undefined)?.hideBanner?.();
        return {stickyAdvIsShowing: true};
      },
      showBannerAdv: function (): Promise<{reason?: ysdk.StickyAdvError}> {
        return new Promise(resolve => {
          (window.parent as FakeWindow | undefined)?.showBanner?.();
          resolve({});
        });
      },
      showFullscreenAdv: function (opts?: {
        callbacks?: {
          onClose?: (wasShown: boolean) => void;
          onError?: (error: Error) => void;
          onOffline?: () => void;
          onOpen?: () => void;
        };
      }): void {
        opts?.callbacks?.onOpen?.();

        setTimeout(() => {
          if (location.search.includes("noads")) {
            opts?.callbacks?.onError?.(new Error("noads"));
          } else {
            showFakeAd(1500, success => {
              opts?.callbacks?.onClose?.(success);
            });
          }
        }, 100);
      },
      showRewardedVideo: function (opts?: {
        callbacks?: {
          onClose?: () => void;
          onError?: (error: Error) => void;
          onOpen?: () => void;
          onRewarded?: () => void;
        };
      }): void {
        opts?.callbacks?.onOpen?.();

        showFakeAd(
          2500,
          success => {
            if (success) {
              opts?.callbacks?.onRewarded?.();
            } else {
              opts?.callbacks?.onClose?.();
            }
          },
          true,
        );
      },
    },
    auth: {
      openAuthDialog: function (): Promise<void> {
        if (window.confirm("Сымитировать вход?")) {
          localStorage.setItem(storageKey(appId, "yg", "auth-time"), String(Date.now()));
        }
        return Promise.resolve();
      },
    },
    clipboard: {
      writeText: function (_text: string): void {
        throw new Error("Function not implemented.");
      },
    },
    deviceInfo: makeFakeDeviceInfo(navigator),
    environment: {i18n: {lang: lang(), tld: lang()}} as ysdk.Environment,
    features: {
      GameplayAPI: {
        start: function (): void {},
        stop: function (): void {},
      },
      LoadingAPI: {
        ready: function (): void {
          clearTimeout(id);
        },
      },
      GamesAPI: {
        getAllGames: function (): Promise<{games: ysdk.Game[]; developerURL: string}> {
          throw new Error("Function getAllGames not implemented.");
        },
        getGameByID: function (_id: number): Promise<{game?: ysdk.Game; isAvailable: boolean}> {
          throw new Error("Function getGameByID not implemented.");
        },
      },
    },
    feedback: {
      canReview: function (): Promise<{reason?: ysdk.FeedbackError; value: boolean}> {
        throw new Error("Function not implemented.");
      },
      requestReview: function (): Promise<{feedbackSent: boolean}> {
        throw new Error("Function not implemented.");
      },
    },
    leaderboards: new YgFakeLeaderboard(appId, lang()),
    multiplayer: {} as ysdk.Multiplayer,
    payments: {
      consumePurchase: function (_token: string): Promise<void> {
        return Promise.resolve();
      },
      getCatalog: function (): Promise<ysdk.Product[]> {
        throw new Error("Function not implemented.");
      },
      getPurchases: function (): Promise<ysdk.Purchase[]> {
        return Promise.resolve([]);
      },
      purchase: function (opts?: {developerPayload?: string; id: string}): Promise<ysdk.Purchase> {
        if (!window.confirm(`Купить ${opts?.id ?? "товар"}?`)) {
          // Отмена покупки отклоняет Promise.
          return Promise.reject(new Error("Покупка отменена"));
        }
        return Promise.resolve({
          productID: opts?.id ?? "",
          purchaseToken: `fake-${Date.now()}`,
        } as ysdk.Purchase);
      },
    },
    screen: {
      fullscreen: {
        STATUS_OFF: "off",
        STATUS_ON: "on",
        status: "off",
        exit: function (): Promise<void> {
          throw new Error("Function not implemented.");
        },
        request: function (): Promise<void> {
          throw new Error("Function not implemented.");
        },
      },
    },
    shortcut: {
      canShowPrompt: function (): Promise<{canShow: boolean}> {
        return Promise.resolve({canShow: true});
      },
      showPrompt: async function (): Promise<{outcome: "accepted" | "rejected"}> {
        const res = window.confirm("Добавить иконку на рабочий стол?");
        return {outcome: res ? "accepted" : "rejected"};
      },
    },
    dispatchEvent: function (_eventName: ysdk.SdkEventName, _detail?: object): Promise<unknown> {
      throw new Error("Function dispatchEvent not implemented.");
    },
    getFlags: function (params?: ysdk.GetFlagsParams): Promise<Record<string, string>> {
      return Promise.resolve({...params?.defaultFlags});
    },
    getLeaderboards: function (): Promise<ysdk.Leaderboards> {
      throw new Error("Function getLeaderboards not implemented.");
    },
    getPayments: function <TSigned extends boolean = false>(_opts?: {
      signed?: TSigned;
    }): Promise<ysdk.Payments<TSigned>> {
      throw new Error("Function getPayments not implemented.");
    },
    getPlayer: function <TSigned extends boolean = false>(opts?: {
      signed?: TSigned;
    }): Promise<TSigned extends true ? ysdk.Signature : ysdk.Player> {
      return Promise.resolve(new YgFakePlayer(opts?.signed ?? false, appId)) as unknown as Promise<
        TSigned extends true ? ysdk.Signature : ysdk.Player
      >;
    },
    getStorage: function (): Promise<ysdk.SafeStorage> {
      throw new Error("Function getStorage not implemented.");
    },
    isAvailableMethod: function (_methodName: string): Promise<boolean> {
      throw new Error("Function not implemented.");
    },
    off: function (_event: Events, _observer: () => void): void {
      throw new Error("Function not implemented.");
    },
    on: function (event: Events, observer: () => void): () => void {
      if (!handlers[event]) handlers[event] = [];
      handlers[event].push(observer);
      return () => {};
    },
    onEvent: function (_eventName: ysdk.SdkEventName, _listener: () => void): () => void {
      throw new Error("Function not implemented.");
    },
    serverTime: function (): number {
      return serverTime();
    },
  };
};

function lang(): LeaderboardLanguage {
  const value = new URLSearchParams(location.search).get("lang");
  switch (value) {
    case "en":
    case "es":
    case "tr":
    case "de":
      return value;
    default:
      return "ru";
  }
}

export function init() {
  warnIfNoAppId();
  attachClearApiStorage();
  (window as FakeWindow)["fake-ysdk"] = makeFakeYSDK();
}

(window as FakeWindow).logout = () => {
  localStorage.removeItem(storageKey(resolveAppId(), "yg", "auth-time"));
};
