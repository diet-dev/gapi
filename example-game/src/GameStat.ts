/** Строка числа побед, ничьих и поражений над игровым полем. */

import {injectStyles} from "./injectStyles.ts";
import {type Stats} from "./stats.ts";

const STYLE_ID = "example-game-stat-styles";
const LABEL_CLASS = "example-game-stat";

function statText(stats: Stats): string {
  return `Победы ${stats.wins} · Ничьи ${stats.draws} · Поражения ${stats.losses}`;
}

function gameStatStyles(className: string): string {
  return `
    .${className} {
      /* Высота совпадает с кнопкой лидерборда в той же строке */
      box-sizing: border-box;
      min-height: 34px;
      display: flex;
      align-items: center;
      margin: 13px 0;
      padding: 0 18px;
      width: fit-content;
      border: 1px solid #1565c0;
      border-radius: 8px;
      background: #121212;
      color: #cfcfcf;
      font: 500 13px/1 sans-serif;
      letter-spacing: 0.05em;
    }
    @media (prefers-color-scheme: dark) {
      .${className} {
        border-color: #64b5f6;
        color: #bdbdbd;
      }
    }
  `;
}

export class GameStat {
  private readonly element: HTMLParagraphElement;

  constructor(parent: HTMLElement) {
    injectStyles(STYLE_ID, gameStatStyles(LABEL_CLASS));
    this.element = document.createElement("p");
    this.element.className = LABEL_CLASS;
    parent.appendChild(this.element);
  }

  render(stats: Stats): void {
    this.element.textContent = statText(stats);
  }
}
