import type {Product} from "ysdk";
import {YgApi} from "../api/YgApi.ts";
import {type CatalogItem, type Purchases, type PurchasesEvents} from "../interfaces.ts";

type Props = {fake: boolean};

export class YgPurchases extends YgApi<PurchasesEvents> implements Purchases {
  private catalog: CatalogItem[] = [];

  constructor(props: Props) {
    super(props);
  }

  // В обычном режиме каталог загружается через SDK;
  // заданный игрой каталог используется только в fake-режиме.
  public setCatalog(catalog: CatalogItem[]) {
    this.catalog = catalog;
  }

  public async getCatalog() {
    if (this.props.fake && this.catalog.length) return this.catalog;
    try {
      const sdk = await this.sdk();
      if (!sdk) throw {reason: "SDK"};
      return (await sdk.payments.getCatalog()).map(product);
    } catch {
      this.emit("error", {code: "GET_CATALOG_ERROR"});
      return [];
    }
  }

  // Данные успешной покупки передаются через событие purchase.
  public async purchase(product: CatalogItem, _payload?: string) {
    try {
      const sdk = await this.sdk();
      if (!sdk) throw {};
      const purchase = await sdk.payments.purchase({id: product.id});
      this.emit("purchase", {id: purchase.productID, token: purchase.purchaseToken});
      return true;
    } catch {
      this.emit("error", {code: "PURCHASE_ERROR"});
      return false;
    }
  }

  public async consume(token: string) {
    try {
      const sdk = await this.sdk();
      if (!sdk) throw {};
      await sdk.payments.consumePurchase(token);
      return true;
    } catch {
      this.emit("error", {code: "CONSUME_PURCHASE_ERROR"});
    }
    return false;
  }

  public async check(): Promise<void> {
    try {
      const sdk = await this.sdk();
      if (!sdk) throw {};
      const purchases = await sdk.payments.getPurchases();
      purchases.forEach(p => this.emit("purchase", {id: p.productID, token: p.purchaseToken}));
    } catch {
      this.emit("error", {code: "GET_PURCHASES_ERROR"});
    }
  }
}

function product(p: Product): CatalogItem {
  return {
    id: p.id,
    title: p.title,
    price: p.price,
    description: p.description,
    currencyCode: p.priceCurrencyCode,
    currencyImage: p.getPriceCurrencyImage("medium"),
  };
}
