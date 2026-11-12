import {EventEmitter} from "@dietdev/emitter";
import type {ApiEvents, FlagDefaults, FlagValues, Flags, FlagsSource} from "../interfaces.ts";

function parseFlag(value: unknown, fallback: string | number | boolean): string | number | boolean {
  if (typeof value !== "string") return fallback;
  if (typeof fallback === "string") return value;
  const text = value.trim();
  if (typeof fallback === "boolean") {
    if (text === "true" || text === "1") return true;
    if (text === "false" || text === "0") return false;
    return fallback;
  }
  const number = Number(text);
  return text && Number.isFinite(number) ? number : fallback;
}

export class FlagsModule<T extends FlagDefaults> extends EventEmitter<ApiEvents> implements Flags<T> {
  private values: FlagValues<T>;
  private readonly loaded: Promise<boolean>;

  constructor(defaults: T, load?: FlagsSource) {
    super();
    const initial = {...defaults};
    this.values = initial as unknown as FlagValues<T>;
    this.loaded =
      load && Object.keys(initial).length
        ? Promise.resolve().then(async () => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            try {
              const strings = Object.fromEntries(Object.entries(initial).map(([key, value]) => [key, String(value)]));
              const remote = await Promise.race([
                load(strings),
                new Promise<never>((_, reject) => {
                  timer = setTimeout(() => reject(new Error("Flags loading timed out")), 2000);
                }),
              ]);
              if (!remote || typeof remote !== "object" || Array.isArray(remote)) {
                throw new Error("Invalid flags response");
              }
              this.values = Object.fromEntries(
                Object.entries(initial).map(([key, fallback]) => [
                  key,
                  Object.prototype.hasOwnProperty.call(remote, key) ? parseFlag(remote[key], fallback) : fallback,
                ]),
              ) as FlagValues<T>;
              return true;
            } catch (error: unknown) {
              this.emit("error", {
                code: "GET_FLAGS_ERROR",
                reason: error instanceof Error ? error.message : String(error),
              });
              return false;
            } finally {
              clearTimeout(timer);
            }
          })
        : Promise.resolve(true);
  }

  public get(): FlagValues<T> {
    return this.values;
  }

  public ready(): Promise<boolean> {
    return this.loaded;
  }
}
