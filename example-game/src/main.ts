/// <reference types="vite/client" />

import type {GameApi} from "@dietdev/gapi/interfaces.ts";
import {catalogFor} from "./catalog.ts";
import {createApp} from "./createApp";
import {STORAGE_KEY} from "./createGame.ts";
import {STATS_STORAGE_KEY} from "./stats.ts";

const IS_YANDEX = location.host.includes("yandex") || location.search.includes("yandex");
const DEVELOPMENT = import.meta.env.DEV;

function getFakePlatformSdk() {
  if (IS_YANDEX) {
    return import("@dietdev/gapi/fake/ysdk");
  }
  return import("@dietdev/gapi/fake/bridge");
}

function getSdkWrapper(): Promise<GameApi> {
  const props = {fake: DEVELOPMENT};

  if (IS_YANDEX) {
    return import("@dietdev/gapi/yandex").then(m => new m.YandexGameApi(props));
  }
  return import("@dietdev/gapi/vk").then(m => new m.VkGameApi(props));
}

/** Для VK игра задаёт каталог всегда; для Яндекса — только в режиме разработки. */
function needCatalog(development: boolean, isYandex: boolean): boolean {
  return !isYandex || development;
}

async function main() {
  if (DEVELOPMENT) {
    (await getFakePlatformSdk()).init();

    // Очистка объединяет данные fake SDK с сохранённой партией и статистикой игры.
    window.clearStorage = () => {
      window.clearApiStorage?.();
      localStorage.removeItem(STATS_STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
    };
  }
  window.GAPI = await getSdkWrapper();
  if (needCatalog(DEVELOPMENT, IS_YANDEX)) {
    GAPI.purchases.setCatalog(catalogFor(IS_YANDEX));
  }

  await createApp();
}

main().catch(console.error);
