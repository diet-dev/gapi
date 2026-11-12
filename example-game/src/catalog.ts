/**
 * Игра задаёт этот каталог для VK в обоих режимах, для Яндекса — только в режиме разработки.
 * В обычном режиме каталог Яндекса загружается через SDK.
 */

import type {CatalogItem} from "@dietdev/gapi/interfaces.ts";

type HintPack = {
  id: string;
  amount: number;
  title: string;
  description: string;
};

const PACKS: HintPack[] = [
  {id: "hints_5", amount: 5, title: "Горстка подсказок", description: "+5 подсказок к запасу"},
  {id: "hints_15", amount: 15, title: "Пакет подсказок", description: "+15 подсказок к запасу"},
  {id: "hints_40", amount: 40, title: "Мешок подсказок", description: "+40 подсказок к запасу"},
];

const PRICES: Record<string, {vk: string; yg: string}> = {
  hints_5: {vk: "7 голосов", yg: "9 YAN"},
  hints_15: {vk: "19 голосов", yg: "24 YAN"},
  hints_40: {vk: "45 голосов", yg: "49 YAN"},
};

function packToItem(pack: HintPack, isYandex: boolean): CatalogItem {
  return {
    id: pack.id,
    title: pack.title,
    price: PRICES[pack.id][isYandex ? "yg" : "vk"],
    description: pack.description,
    currencyCode: "",
    currencyImage: "",
  };
}

export function catalogFor(isYandex: boolean): CatalogItem[] {
  return PACKS.map(pack => packToItem(pack, isYandex));
}

/** Число подсказок в товаре: id вида «hints_15». Незнакомые товары — 0. */
export function hintsInProduct(id: string): number {
  const match = /^hints_(\d+)$/.exec(id);
  return match ? Number(match[1]) : 0;
}
