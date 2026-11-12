import type {Mark} from "./Game.ts";

/** Крест или ноль с центром (cx, cy); cell — размер клетки. */
export function drawMark(
  ctx: CanvasRenderingContext2D,
  mark: Mark,
  cx: number,
  cy: number,
  cell: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(2, cell * 0.09);
  ctx.beginPath();
  if (mark === "X") {
    const r = cell * 0.28;
    ctx.moveTo(cx - r, cy - r);
    ctx.lineTo(cx + r, cy + r);
    ctx.moveTo(cx + r, cy - r);
    ctx.lineTo(cx - r, cy + r);
  } else {
    ctx.arc(cx, cy, cell * 0.3, 0, Math.PI * 2);
  }
  ctx.stroke();
}
