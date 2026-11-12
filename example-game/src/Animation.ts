/** Анимации обновляются и рисуются в общем цикле requestAnimationFrame игры. */

import type {Geometry, Mark, Palette} from "./Game.ts";

/** Геометрия поля, палитра и фигура человека для отрисовки анимаций. */
export type Scene = {
  geometry: Geometry;
  palette: Palette;
  /** Фигура человека для отображения подсказки. */
  humanMark: Mark;
};

export abstract class Animation {
  private bornAt: number | null = null;
  /** Время в миллисекундах с первого кадра анимации. */
  protected age = 0;

  /** Метод alive() определяет, нужно ли продолжать анимацию после обновления времени. */
  tick(now: number): boolean {
    if (this.bornAt === null) this.bornAt = now;
    this.age = now - this.bornAt;
    return this.alive();
  }

  abstract draw(ctx: CanvasRenderingContext2D, scene: Scene): void;

  protected abstract alive(): boolean;
}

/** Управляет активными анимациями; отмена применяется ко всему списку. */
export class Animations {
  private items = new Set<Animation>();

  add(animation: Animation): void {
    this.items.add(animation);
  }

  cancel(): void {
    this.items.clear();
  }

  get active(): boolean {
    return this.items.size > 0;
  }

  /** Завершённые анимации удаляются до отрисовки текущего кадра. */
  frame(ctx: CanvasRenderingContext2D, scene: Scene, now: number): void {
    if (!this.active) return;
    for (const animation of this.items) {
      if (!animation.tick(now)) this.items.delete(animation);
    }
    for (const animation of this.items) animation.draw(ctx, scene);
  }
}
