/**
 * Магазин загружает товары через GAPI.purchases.getCatalog() и запускает покупку.
 * Начисление подсказок обрабатывается в createApp.ts по событию purchase.
 */

import {injectStyles} from "./injectStyles.ts";
import type {CatalogItem, Purchases} from "@dietdev/gapi/interfaces.ts";

const STYLE_ID = "example-shop-styles";

export type Props = {
  purchases: Purchases;
};

const CART = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M7 18c-1.1 0-1.99.9-1.99 2S5.9 22 7 22s2-.9 2-2-.9-2-2-2zM1 2v2h2l3.6 7.59-1.35 2.45c-.16.28-.25.61-.25.96 0 1.1.9 2 2 2h12v-2H7.42c-.14 0-.25-.11-.25-.25l.03-.12.9-1.63h7.45c.75 0 1.41-.41 1.75-1.03l3.58-6.49c.08-.14.12-.31.12-.48 0-.55-.45-1-1-1H5.21l-.94-2H1zm16 16c-1.1 0-1.99.9-1.99 2s.89 2 1.99 2 2-.9 2-2-.9-2-2-2z"/>
  </svg>`;

const CLOSE = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;

function shopStyles(): string {
  return `
    .shop-button {
      appearance: none;
      box-sizing: border-box;
      flex: none;
      width: 34px;
      height: 34px;
      padding: 0;
      border: 1px solid #1565c0;
      border-radius: 8px;
      background: #121212;
      color: #64b5f6;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background-color 150ms, color 150ms, transform 100ms;
    }
    .shop-button svg { width: 20px; height: 20px; }
    .shop-button:hover { background: #1565c0; color: #fff; }
    .shop-button:active { transform: translateY(1px) scale(0.96); }
    .shop-button:focus-visible { outline: 2px solid #64b5f6; outline-offset: 3px; }

    .shop-overlay {
      position: fixed;
      inset: 0;
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0, 0, 0, 0.55);
    }
    .shop-modal {
      width: min(92vw, 360px);
      max-height: min(80vh, 520px);
      display: flex;
      flex-direction: column;
      background: #161616;
      border: 1px solid #2c2c2c;
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      animation: shop-in 150ms ease-out;
    }
    @keyframes shop-in {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: none; }
    }
    .shop-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px 10px 16px;
      border-bottom: 1px solid #2c2c2c;
    }
    .shop-title {
      margin: 0;
      font: 700 16px/1 sans-serif;
      color: #fefefe;
      letter-spacing: 0.03em;
    }
    .shop-close {
      appearance: none;
      width: 28px;
      height: 28px;
      padding: 0;
      border: none;
      border-radius: 8px;
      background: none;
      color: #9e9e9e;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      transition: background-color 150ms, color 150ms;
    }
    .shop-close svg { width: 16px; height: 16px; }
    .shop-close:hover { background: #2c2c2c; color: #fefefe; }
    .shop-close:focus-visible { outline: 2px solid #64b5f6; outline-offset: 2px; }

    .shop-body {
      padding: 8px;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #2c2c2c transparent;
    }
    .shop-card {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 10px 12px;
      border: 1px solid #2c2c2c;
      border-radius: 10px;
      margin-bottom: 8px;
    }
    .shop-card:last-child { margin-bottom: 0; }
    .shop-info {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 0;
    }
    .shop-name {
      font: 700 14px/1 sans-serif;
      color: #fefefe;
    }
    .shop-desc {
      font: 400 12px/1.3 sans-serif;
      color: #9e9e9e;
    }
    .shop-buy {
      appearance: none;
      flex: none;
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 9px 12px;
      border: none;
      border-radius: 9px;
      background: #1565c0;
      color: #fff;
      font: 700 13px/1 sans-serif;
      white-space: nowrap;
      cursor: pointer;
      transition: background-color 150ms, transform 100ms;
    }
    .shop-buy img { width: 14px; height: 14px; }
    .shop-buy:hover { background: #1976d2; }
    .shop-buy:active { transform: translateY(1px) scale(0.98); }
    .shop-buy:disabled { opacity: 0.45; cursor: default; }
    .shop-buy:focus-visible { outline: 2px solid #64b5f6; outline-offset: 2px; }

    .shop-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 34px 16px;
      font: 500 13px/1.4 sans-serif;
      color: #9e9e9e;
    }
    .shop-spinner {
      width: 28px;
      height: 28px;
      border: 3px solid #2c2c2c;
      border-top-color: #64b5f6;
      border-radius: 50%;
      animation: shop-spin 800ms linear infinite;
    }
    @keyframes shop-spin { to { transform: rotate(360deg); } }
    .shop-error { color: #ef9a9a; }
  `;
}

/** Карточка товара: название, описание и кнопка покупки с ценой. */
function cardHtml(item: CatalogItem): string {
  const currency = item.currencyImage
    ? `<img class="shop-currency" src="${escapeHtml(item.currencyImage)}" alt="" width="14" height="14" />`
    : "";
  return `
    <div class="shop-card">
      <div class="shop-info">
        <span class="shop-name">${escapeHtml(item.title)}</span>
        <span class="shop-desc">${escapeHtml(item.description)}</span>
      </div>
      <button type="button" class="shop-buy" data-id="${escapeHtml(item.id)}">${currency}${escapeHtml(item.price)}</button>
    </div>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[ch]!);
}

export class Shop {
  private readonly purchases: Purchases;
  private open = false;
  private overlay?: HTMLElement;
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.overlay?.querySelector(".shop-close")!.dispatchEvent(new Event("click"));
  };

  constructor(parent: HTMLElement, props: Props) {
    this.purchases = props.purchases;

    injectStyles(STYLE_ID, shopStyles());
    const button = document.createElement("button");
    button.type = "button";
    button.className = "shop-button";
    button.title = "Магазин";
    button.setAttribute("aria-label", "Открыть магазин");
    button.innerHTML = CART;
    button.addEventListener("click", () => this.show());
    parent.appendChild(button);
  }

  private async show(): Promise<void> {
    if (this.open) return;
    this.open = true;

    const overlay = document.createElement("div");
    overlay.className = "shop-overlay";
    overlay.innerHTML = `
      <div class="shop-modal" role="dialog" aria-modal="true" aria-label="Магазин">
        <div class="shop-head">
          <h2 class="shop-title">Магазин</h2>
          <button type="button" class="shop-close" aria-label="Закрыть">${CLOSE}</button>
        </div>
        <div class="shop-body"><div class="shop-state"><div class="shop-spinner"></div></div></div>
      </div>`;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    overlay.querySelector(".shop-close")!.addEventListener("click", () => this.hide());
    overlay.addEventListener("click", event => {
      if (event.target === overlay) this.hide();
    });
    document.addEventListener("keydown", this.onKeyDown);

    const catalog = await this.purchases.getCatalog();
    if (!this.open) return;

    const body = overlay.querySelector(".shop-body")!;
    body.innerHTML = catalog.length
      ? catalog.map(cardHtml).join("")
      : '<div class="shop-state"><span class="shop-error">Каталог недоступен</span></div>';

    body.querySelectorAll<HTMLButtonElement>(".shop-buy").forEach(button => {
      const product = catalog.find(item => item.id === button.dataset.id)!;
      button.addEventListener("click", () => this.buy(product, button));
    });
  }

  private async buy(product: CatalogItem, button: HTMLButtonElement): Promise<void> {
    button.disabled = true;
    try {
      await this.purchases.purchase(product);
    } finally {
      button.disabled = false;
    }
  }

  private hide(): void {
    this.open = false;
    document.removeEventListener("keydown", this.onKeyDown);
    this.overlay?.remove();
    this.overlay = undefined;
  }
}
