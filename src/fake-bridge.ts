import type {FakeWindow} from "./fake/window.ts";
import type {AnyRequestMethodName, RequestProps, RequestIdProp} from "@vkontakte/vk-bridge";
import type {AnyReceiveMethodName, ReceiveData, VKBridgeSubscribeHandler} from "@vkontakte/vk-bridge";
import {avatarDataUri} from "./fake/avatars.ts";
import {attachClearApiStorage, resolveAppId, storageKey, warnIfNoAppId} from "./fake/storage-keys.ts";
import {logger} from "./log.ts";

const log = logger.child("fake-bridge");

async function sendRequest(method: AnyRequestMethodName, props?: unknown): Promise<unknown> {
  if (method === "VKWebAppInit") {
    const data = {result: true} as ReceiveData<"VKWebAppInit">;
    return Promise.resolve(data);
  }
  if (method === "VKWebAppShowNativeAds") {
    if (typeof document !== "undefined") {
      const {showFakeAd} = await import("./fake/showFakeAd.ts");
      const rewarded =
        typeof props === "object" && props !== null && "ad_format" in props && props.ad_format === "reward";
      return new Promise<{result: boolean}>(resolve => {
        showFakeAd(3000, result => resolve({result}), rewarded);
      });
    }
    return Promise.resolve({result: true});
  }
  if (method === "VKWebAppCheckNativeAds" || method === "VKWebAppCheckBannerAd") {
    return Promise.resolve({result: true});
  }
  if (method === "VKWebAppShowBannerAd") {
    (window.parent as FakeWindow | undefined)?.showBanner?.(props as RequestProps<"VKWebAppShowBannerAd"> | undefined);
    return Promise.resolve({result: true});
  }
  if (method === "VKWebAppHideBannerAd") {
    (window.parent as FakeWindow | undefined)?.hideBanner?.();
    return Promise.resolve({result: true});
  }
  if (method === "VKWebAppShowInviteBox") {
    confirm("Пригласить друзей?");
    return;
  }
  if (method === "VKWebAppShowLeaderBoardBox") {
    alert("Список лидеров.");
    return;
  }
  if (method === "VKWebAppShowOrderBox") {
    const {item} = props as RequestProps<"VKWebAppShowOrderBox">;
    if (!confirm(`Купить ${item}?`)) {
      // Отмена покупки отклоняет Promise.
      return Promise.reject(new Error("Покупка отменена"));
    }
    return Promise.resolve({status: "success", order_id: String(Date.now())});
  }
  if (method === "VKWebAppGetUserInfo") {
    const seed = "Алексей Соколов";
    return Promise.resolve({
      id: 1,
      first_name: "Алексей",
      last_name: "Соколов",
      photo_100: avatarDataUri(seed, 100, "male"),
      photo_200: avatarDataUri(seed, 200, "male"),
    });
  }
  if (method === "VKWebAppGetConfig") {
    return Promise.resolve({appearance: "light"});
  }
  if (method === "VKWebAppStorageGet") {
    // При недоступном localStorage эмулятор возвращает пустой список ключей.
    if (typeof localStorage !== "undefined") {
      const requested = (props as {keys?: string[]} | undefined)?.keys;
      const prefix = storageKey(resolveAppId(), "vk", "");
      const keys: {key: string; value: string}[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const full = localStorage.key(i);
        if (!full || !full.startsWith(prefix)) continue;
        const key = full.slice(prefix.length);
        if (requested && !requested.includes(key)) continue;
        keys.push({key, value: localStorage.getItem(full) ?? ""});
      }
      return Promise.resolve({keys});
    }
    return Promise.resolve({keys: []});
  }
  if (method === "VKWebAppStorageSet") {
    const {key, value} = props as RequestProps<"VKWebAppStorageSet">;
    window.localStorage.setItem(storageKey(resolveAppId(), "vk", key), value);
    return Promise.resolve({});
  }
  if (method === "VKWebAppAllowNotifications" || method === "VKWebAppDenyNotifications") {
    return Promise.resolve({result: true});
  }
  log.warn("Не известный метод:", method);
  return Promise.resolve({});
}

export const bridge = {
  send: <K extends AnyRequestMethodName>(
    method: K,
    props?: RequestProps<K> & RequestIdProp,
  ): Promise<K extends AnyReceiveMethodName ? ReceiveData<K> : void> => {
    // Диспетчер выбирает ответ по методу; TypeScript не сужает здесь условный тип K.
    return sendRequest(method, props) as Promise<K extends AnyReceiveMethodName ? ReceiveData<K> : void>;
  },

  supportsAsync: async (method: string): Promise<boolean> => {
    // Для этих методов эмулятор сообщает о поддержке через supportsAsync.
    const supported = ["VKWebAppAllowNotifications", "VKWebAppDenyNotifications"];
    return supported.includes(method);
  },

  subscribe: (_listener: VKBridgeSubscribeHandler): void => {},
};

export function init() {
  warnIfNoAppId();
  attachClearApiStorage();
  (window as FakeWindow)["fake-bridge"] = bridge;
}
