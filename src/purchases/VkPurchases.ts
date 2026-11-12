import {type CatalogItem, type Purchases, type PurchasesEvents} from "../interfaces.ts";
import {VkApi} from "../api/VkApi.ts";

type Props = {fake: boolean};

export class VkPurchases extends VkApi<PurchasesEvents> implements Purchases {
  private catalog: CatalogItem[] = [];

  constructor(props: Props) {
    super(props);
  }

  // Каталог товаров для этой реализации задаёт игра.
  public setCatalog(catalog: CatalogItem[]) {
    this.catalog = catalog;
  }

  public async getCatalog() {
    return this.catalog;
  }

  public async purchase(product: CatalogItem, _payload?: string) {
    try {
      const data = await this.bridgeSend("VKWebAppShowOrderBox", {type: "item", item: product.id});
      if (data.status === "success") {
        this.emit("purchase", {id: product.id, token: data.order_id});
        return true;
      }
    } catch {
      this.emit("error", {code: "PURCHASE_ERROR"});
    }
    return false;
  }

  public consume() {
    return this.ok();
  }

  public check() {
    return;
  }
}
