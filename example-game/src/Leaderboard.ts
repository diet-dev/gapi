/**
 * Кнопка и окно рейтинга используют данные GAPI.score.laeders().
 * В реализации VK этот метод открывает диалог площадки и не возвращает записи,
 * поэтому для неё окно рейтинга демоигры отключено.
 */

import {injectStyles} from "./injectStyles.ts";
import type {Score} from "@dietdev/gapi/interfaces.ts";

const LEADERBOARD_NAME = "rating";
const STYLE_ID = "example-leaderboard-styles";

export type Props = {
  score: Score;
  /** Показывать ли кнопку (YG — да, VK — нет). */
  active: boolean;
};

const TROPHY = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path fill="currentColor" d="M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z"/>
  </svg>`;

const CLOSE = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"/>
  </svg>`;

/** Медаль для топ-3: цветной круг с номером места. */
function medal(rank: number): string {
  const colors: Record<number, [string, string]> = {
    1: ["#fdd835", "#f9a825"],
    2: ["#b0bec5", "#90a4ae"],
    3: ["#e07a5f", "#c16850"],
  };
  const [fill, ring] = colors[rank] ?? ["#9e9e9e", "#757575"];
  return `
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="10" fill="${fill}" />
      <circle cx="12" cy="12" r="8.4" fill="none" stroke="${ring}" stroke-width="1.6" />
      <text x="12" y="16.2" text-anchor="middle" font-size="11" font-weight="700" fill="#121212" font-family="sans-serif">${rank}</text>
    </svg>`;
}

function leaderboardStyles(): string {
  return `
    .lb-button {
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
    .lb-button svg { width: 20px; height: 20px; }
    .lb-button:hover { background: #1565c0; color: #fff; }
    .lb-button:active { transform: translateY(1px) scale(0.96); }
    .lb-button:focus-visible { outline: 2px solid #64b5f6; outline-offset: 3px; }

    .lb-overlay {
      position: fixed;
      inset: 0;
      z-index: 999;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0, 0, 0, 0.55);
    }
    .lb-modal {
      width: min(92vw, 360px);
      max-height: min(80vh, 520px);
      display: flex;
      flex-direction: column;
      background: #161616;
      border: 1px solid #2c2c2c;
      border-radius: 14px;
      box-shadow: 0 12px 40px rgba(0, 0, 0, 0.5);
      animation: lb-in 150ms ease-out;
    }
    @keyframes lb-in {
      from { opacity: 0; transform: translateY(8px) scale(0.98); }
      to { opacity: 1; transform: none; }
    }
    .lb-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 12px 14px 10px 16px;
      border-bottom: 1px solid #2c2c2c;
    }
    .lb-title {
      margin: 0;
      font: 700 16px/1 sans-serif;
      color: #fefefe;
      letter-spacing: 0.03em;
    }
    .lb-close {
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
    .lb-close svg { width: 16px; height: 16px; }
    .lb-close:hover { background: #2c2c2c; color: #fefefe; }
    .lb-close:focus-visible { outline: 2px solid #64b5f6; outline-offset: 2px; }

    .lb-body {
      margin: 0;
      padding: 8px;
      list-style: none;
      overflow-y: auto;
      scrollbar-width: thin;
      scrollbar-color: #2c2c2c transparent;
    }
    .lb-row {
      display: grid;
      grid-template-columns: 26px 30px 1fr auto;
      align-items: center;
      gap: 10px;
      padding: 7px 10px;
      border-radius: 9px;
    }
    .lb-row.me { background: rgba(100, 181, 246, 0.1); outline: 1px solid rgba(100, 181, 246, 0.45); }
    .lb-rank {
      display: inline-flex;
      justify-content: center;
      font: 700 13px/1 sans-serif;
      color: #9e9e9e;
      font-variant-numeric: tabular-nums;
    }
    .lb-rank svg { width: 24px; height: 24px; }
    .lb-avatar {
      display: inline-flex;
      width: 30px;
      height: 30px;
      border-radius: 50%;
    }
    .lb-name {
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
      font: 500 14px/1 sans-serif;
      color: #e0e0e0;
    }
    .lb-score {
      font: 700 14px/1 sans-serif;
      color: #fefefe;
      font-variant-numeric: tabular-nums;
    }

    .lb-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 34px 16px;
      font: 500 13px/1.4 sans-serif;
      color: #9e9e9e;
    }
    .lb-spinner {
      width: 28px;
      height: 28px;
      border: 3px solid #2c2c2c;
      border-top-color: #64b5f6;
      border-radius: 50%;
      animation: lb-spin 800ms linear infinite;
    }
    @keyframes lb-spin { to { transform: rotate(360deg); } }
    .lb-error { color: #ef9a9a; }
  `;
}

/** Строка рейтинга: место, аватар, имя, очки. */
function rowHtml(entry: {rank: number; avatar: string; name: string; score: number}, userRank: number): string {
  const place =
    entry.rank <= 3
      ? `<span class="lb-rank">${medal(entry.rank)}</span>`
      : `<span class="lb-rank">${entry.rank}</span>`;
  const name = entry.name || "Без имени";
  return `
    <li class="lb-row${entry.rank === userRank ? " me" : ""}">
      ${place}
      <img class="lb-avatar" srcset="${escapeHtml(entry.avatar)}" alt="" width="30" height="30" />
      <span class="lb-name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      <span class="lb-score">${entry.score.toLocaleString("ru-RU")}</span>
    </li>`;
}

function escapeHtml(text: string): string {
  return text.replace(/[&<>"]/g, ch => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;"})[ch]!);
}

export class Leaderboard {
  private readonly score: Score;
  private open = false;
  private overlay?: HTMLElement;
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === "Escape") this.overlay?.querySelector(".lb-close")!.dispatchEvent(new Event("click"));
  };

  constructor(parent: HTMLElement, props: Props) {
    this.score = props.score;
    if (!props.active) return;

    injectStyles(STYLE_ID, leaderboardStyles());
    const button = document.createElement("button");
    button.type = "button";
    button.className = "lb-button";
    button.title = "Лидерборд";
    button.setAttribute("aria-label", "Открыть лидерборд");
    button.innerHTML = TROPHY;
    button.addEventListener("click", () => this.show());
    parent.appendChild(button);
  }

  private async show(): Promise<void> {
    if (this.open) return;
    this.open = true;

    const overlay = document.createElement("div");
    overlay.className = "lb-overlay";
    overlay.innerHTML = `
      <div class="lb-modal" role="dialog" aria-modal="true" aria-label="Лидерборд">
        <div class="lb-head">
          <h2 class="lb-title">Лидерборд</h2>
          <button type="button" class="lb-close" aria-label="Закрыть">${CLOSE}</button>
        </div>
        <div class="lb-body"><div class="lb-state"><div class="lb-spinner"></div></div></div>
      </div>`;
    document.body.appendChild(overlay);
    this.overlay = overlay;

    overlay.querySelector(".lb-close")!.addEventListener("click", () => this.hide());
    overlay.addEventListener("click", event => {
      if (event.target === overlay) this.hide();
    });
    document.addEventListener("keydown", this.onKeyDown);

    const data = await this.score.laeders(LEADERBOARD_NAME);
    if (!this.open) return;

    const body = overlay.querySelector(".lb-body")!;
    body.innerHTML = data?.entries.length
      ? data.entries.map(entry => rowHtml(entry, data.userRank)).join("")
      : '<div class="lb-state"><span class="lb-error">Не удалось загрузить лидерборд</span></div>';
  }

  private hide(): void {
    this.open = false;
    document.removeEventListener("keydown", this.onKeyDown);
    this.overlay?.remove();
    this.overlay = undefined;
  }
}
