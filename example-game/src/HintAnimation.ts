import type {Mark} from "./Game.ts";
import {type Scene, Animation} from "./Animation.ts";
import {drawMark} from "./drawMark.ts";

const FADE_IN_MS = 250;
const PULSE_MS = 1500;
/** Две пульсации укладываются в PULSE_MS, затем свечение держится ровно. */
const PULSE_CYCLES = 2;
const GHOST_ALPHA = 0.35;
const GLOW_ALPHA = 0.18;

/**
 * Подсказка: призрачная фигура игрока и пульсирующее свечение клетки,
 * затем ровное свечение. Сохраняется до отмены при изменении позиции или новой партии.
 */
export class HintAnimation extends Animation {
  private readonly cell: number;
  private readonly mark: Mark;

  constructor(cell: number, mark: Mark) {
    super();
    this.cell = cell;
    this.mark = mark;
  }

  protected alive(): boolean {
    return true;
  }

  draw(ctx: CanvasRenderingContext2D, scene: Scene): void {
    const {geometry, palette} = scene;
    const color = this.mark === "X" ? palette.x : palette.o;

    const cx = geometry.offsetX + (this.cell % 3) * geometry.cell + geometry.cell / 2;
    const cy = geometry.offsetY + Math.floor(this.cell / 3) * geometry.cell + geometry.cell / 2;
    const inset = geometry.cell * 0.08;
    const size = geometry.cell - inset * 2;

    const pulse = this.age < PULSE_MS ? 0.5 - 0.5 * Math.cos((2 * Math.PI * PULSE_CYCLES * this.age) / PULSE_MS) : 0;
    ctx.globalAlpha = GLOW_ALPHA * (1 + pulse);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.roundRect(cx - size / 2, cy - size / 2, size, size, geometry.cell * 0.14);
    ctx.fill();

    ctx.globalAlpha = GHOST_ALPHA * Math.min(1, this.age / FADE_IN_MS);
    drawMark(ctx, this.mark, cx, cy, geometry.cell, color);
    ctx.globalAlpha = 1;
  }
}
