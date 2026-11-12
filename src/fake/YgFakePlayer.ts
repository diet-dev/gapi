import type * as ysdk from "ysdk";
import {storageKey} from "./storage-keys.ts";
import {avatarDataUri} from "./avatars.ts";

export class YgFakePlayer<_TSigneg> implements ysdk.Player {
  public signature: string = "";

  private appId: string;

  constructor(signed: boolean, appId: string) {
    this.signature = signed ? "signed" : "";
    this.appId = appId;
  }

  public getData<T extends string>(keys?: readonly T[]): Promise<Partial<Record<T, ysdk.Serializable>>> {
    const json = this.__getStorageItem("data");
    if (json) {
      const data = parsePlayerData(json);
      if (keys) {
        const result: Partial<Record<T, ysdk.Serializable>> = {};

        for (const key of keys) {
          result[key] = data[key];
        }
        return Promise.resolve(result);
      }
      return Promise.resolve(data as Partial<Record<T, ysdk.Serializable>>);
    }
    return Promise.resolve({});
  }

  public getIDsPerGame(): Promise<Array<{appID: number; userID: string}>> {
    throw new Error("Method not implemented.");
  }

  public getMode(): "" | "lite" {
    return this.isAuthorized() ? "" : "lite";
  }

  public getName(): string {
    return "";
  }

  public getPayingStatus(): "not_paying" | "partially_paying" | "paying" | "unknown" {
    throw new Error("Method not implemented.");
  }

  public getPhoto(size: "large" | "medium" | "small"): string {
    const pixels = {small: 100, medium: 200, large: 400}[size];
    return avatarDataUri(this.getUniqueID(), pixels);
  }

  public getStats<T extends string>(_keys?: readonly T[]): Promise<Partial<Record<T, number>>> {
    throw new Error("Method not implemented.");
  }

  public getUniqueID(): string {
    return "Unique-Player-ID";
  }

  public incrementStats<T extends Record<number | string, number>>(_stats: T): Promise<ysdk.IncrementedStats<T>> {
    throw new Error("Method not implemented.");
  }

  public isAuthorized(): boolean {
    const fakeAuthTime = Number(window.localStorage.getItem(storageKey(this.appId, "yg", "auth-time"))) || 0;
    return fakeAuthTime > 0;
  }

  public setData(data: Record<string, ysdk.Serializable>, _flush?: boolean): Promise<void> {
    // Обновляются переданные ключи с сохранением остальных данных; flush игнорируется.
    const current = parsePlayerData(this.__getStorageItem("data") || "{}");
    this.__setStorageItem("data", JSON.stringify({...current, ...data}));
    return Promise.resolve();
  }

  public setStats(_stats: Record<number | string, number>): Promise<void> {
    throw new Error("Method not implemented.");
  }

  private __getStorageItem(name: string) {
    return window.localStorage.getItem(storageKey(this.appId, "yg", name));
  }

  private __setStorageItem(name: string, value: string): void {
    window.localStorage.setItem(storageKey(this.appId, "yg", name), value);
  }
}

function parsePlayerData(json: string): Record<string, ysdk.Serializable> {
  const data: unknown = JSON.parse(json);
  if (!isDataRecord(data)) throw new Error("Invalid player data");
  return data;
}

function isDataRecord(value: unknown): value is Record<string, ysdk.Serializable> {
  return (
    typeof value === "object" && value !== null && !Array.isArray(value) && Object.values(value).every(isSerializable)
  );
}

function isSerializable(value: unknown): value is ysdk.Serializable {
  return (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    (Array.isArray(value) ? value.every(isSerializable) : isDataRecord(value))
  );
}
