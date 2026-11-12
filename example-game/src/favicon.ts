/**
 * Динамическая фавиконка: SVG-иконка текущей позиции, обновляется на каждом
 * ходу и перерисовывается при смене светлой/тёмной темы (prefers-color-scheme).
 */

import {DARK, LIGHT, type Game, type Palette} from "./Game.ts";

const SIZE = 64;
/** Поле с отступами — как на канвасе: 92% от размера иконки. */
const BOARD = SIZE * 0.92;
const CELL = BOARD / 3;
const OFFSET = (SIZE - BOARD) / 2;

const num = (n: number): string => String(Math.round(n * 100) / 100);

/** SVG-разметка позиции (первые 9 символов сериализации) в заданной палитре. */
function stateToSvg(board: string, p: Palette): string {
  const grid: string[] = [];
  for (const t of [1, 2]) {
    const x = OFFSET + CELL * t;
    const y = OFFSET + CELL * t;
    grid.push(`M ${num(x)} ${num(OFFSET)} V ${num(OFFSET + BOARD)}`);
    grid.push(`M ${num(OFFSET)} ${num(y)} H ${num(OFFSET + BOARD)}`);
  }

  const marks: string[] = [];
  for (let i = 0; i < 9; i++) {
    const mark = board[i];
    if (mark !== "X" && mark !== "O") continue;
    const cx = OFFSET + (i % 3) * CELL + CELL / 2;
    const cy = OFFSET + Math.floor(i / 3) * CELL + CELL / 2;
    if (mark === "X") {
      const r = CELL * 0.28;
      marks.push(
        `<path d="M ${num(cx - r)} ${num(cy - r)} L ${num(cx + r)} ${num(cy + r)} M ${num(cx + r)} ${num(cy - r)} L ${num(cx - r)} ${num(cy + r)}" stroke="${p.x}"/>`,
      );
    } else {
      marks.push(`<circle cx="${num(cx)}" cy="${num(cy)}" r="${num(CELL * 0.3)}" stroke="${p.o}"/>`);
    }
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">` +
    `<rect width="${SIZE}" height="${SIZE}" fill="${p.bg}"/>` +
    `<path d="${grid.join(" ")}" stroke="${p.grid}" stroke-width="${num(CELL * 0.05)}" stroke-linecap="round" fill="none"/>` +
    `<g fill="none" stroke-width="${num(CELL * 0.09)}" stroke-linecap="round">${marks.join("")}</g>` +
    "</svg>"
  );
}

/** Подключает фавиконку к игре: стартовый рендер, обновление на ходах, реакция на смену темы. */
export function attachFavicon(game: Game): void {
  const link =
    document.querySelector<HTMLLinkElement>('link[rel="icon"]') ??
    document.head.appendChild(document.createElement("link"));
  link.rel = "icon";
  link.type = "image/svg+xml";

  const darkQuery = window.matchMedia("(prefers-color-scheme: dark)");
  let state = game.serialize();

  const render = () => {
    const p = darkQuery.matches ? DARK : LIGHT;
    link.href = `data:image/svg+xml,${encodeURIComponent(stateToSvg(state.slice(0, 9), p))}`;
  };

  game.on("move", event => {
    state = event.state;
    render();
  });
  darkQuery.addEventListener("change", render);
  render();
}
