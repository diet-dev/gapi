import type {ApiEvents, PurchasesEvents} from "../src/interfaces.ts";
import {browserGlobals} from "./helpers/browser.ts";
import assert from "node:assert/strict";
import {test} from "node:test";
import {init} from "../src/fake-bridge.ts";
import {VkPurchases} from "../src/purchases/VkPurchases.ts";
import {YgPurchases} from "../src/purchases/YgPurchases.ts";

const browser = browserGlobals(globalThis);

browser.window = browser.window ?? {};
init();

function collect(emit: (cb: (e: ApiEvents["error"]) => void) => void): string[] {
  const events: string[] = [];
  emit(e => events.push(e.code));
  return events;
}

function setConfirm(answer: boolean) {
  browser.confirm = () => answer;
}

function setFakeYsdk(payments: unknown) {
  browser.window["fake-ysdk"] = {payments};
}

const CATALOG = [
  {
    id: "hints_5",
    title: "Горстка подсказок",
    price: "7 голосов",
    description: "+5",
    currencyCode: "",
    currencyImage: "",
  },
];

test("VkPurchases: setCatalog наполняет getCatalog, покупка в fake-bridge эмитит purchase", async () => {
  setConfirm(true);
  const purchases = new VkPurchases({fake: true});
  const events = collect(cb => purchases.on("error", cb));
  const purchased: PurchasesEvents["purchase"][] = [];
  purchases.on("purchase", p => purchased.push(p));

  purchases.setCatalog(CATALOG);
  assert.deepEqual(await purchases.getCatalog(), CATALOG);
  assert.equal(await purchases.purchase(CATALOG[0]), true);
  assert.equal(purchased.length, 1);
  assert.equal(purchased[0].id, "hints_5");
  assert.ok(purchased[0].token);
  assert.deepEqual(events, []);
});

test("VkPurchases: отказ в fake-bridge возвращает false и эмитит PURCHASE_ERROR", async () => {
  setConfirm(false);
  const purchases = new VkPurchases({fake: true});
  const events = collect(cb => purchases.on("error", cb));
  const purchased: PurchasesEvents["purchase"][] = [];
  purchases.on("purchase", p => purchased.push(p));

  assert.equal(await purchases.purchase(CATALOG[0]), false);
  assert.deepEqual(purchased, []);
  assert.deepEqual(events, ["SEND_ERROR", "PURCHASE_ERROR"]);
});

test("YgPurchases: в fake setCatalog подменяет каталог SDK", async () => {
  setFakeYsdk({
    getCatalog: async () => {
      throw new Error("SDK каталог недоступен");
    },
  });
  const purchases = new YgPurchases({fake: true});
  const events = collect(cb => purchases.on("error", cb));

  purchases.setCatalog(CATALOG);
  assert.deepEqual(await purchases.getCatalog(), CATALOG);
  assert.deepEqual(events, []);
});

test("YgPurchases: без setCatalog в fake каталог пустой и эмитит GET_CATALOG_ERROR", async () => {
  setFakeYsdk({
    getCatalog: async () => {
      throw new Error("SDK каталог недоступен");
    },
  });
  const purchases = new YgPurchases({fake: true});
  const events = collect(cb => purchases.on("error", cb));

  assert.deepEqual(await purchases.getCatalog(), []);
  assert.deepEqual(events, ["GET_CATALOG_ERROR"]);
});

test("YgPurchases: покупка и consume в fake идут через sdk.payments", async () => {
  const consumed: string[] = [];
  setFakeYsdk({
    purchase: async (opts: {id: string}) => ({productID: opts.id, purchaseToken: "tok-1"}),
    consumePurchase: async (token: string) => {
      consumed.push(token);
    },
  });
  const purchases = new YgPurchases({fake: true});
  const purchased: PurchasesEvents["purchase"][] = [];
  purchases.on("purchase", p => purchased.push(p));

  assert.equal(await purchases.purchase(CATALOG[0]), true);
  assert.deepEqual(purchased, [{id: "hints_5", token: "tok-1"}]);
  assert.equal(await purchases.consume("tok-1"), true);
  assert.deepEqual(consumed, ["tok-1"]);
});
