import {type Data, type DataStorage, type SyncDataStrategy} from "../interfaces.ts";

type SyncEntry<T> = {
  key: keyof T;
  extKey: string;
  value: unknown;
  extValue: unknown;
  strategy: SyncDataStrategy;
};

const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export class SyncManager<T> {
  private gameStorage: DataStorage<T>;
  private apiProvider: Data;

  constructor(local: DataStorage<T>, remote: Data) {
    this.gameStorage = local;
    this.apiProvider = remote;
  }

  public async sync(items: [keyof T, SyncDataStrategy, string?][], data: Record<string, unknown>) {
    for (const [key, strategy, alias] of items) {
      const value = this.gameStorage.get()[key];
      const extKey = String(alias || key);
      const extValue = data[extKey];

      if (extValue === undefined) {
        await this.remoteSave(extKey, value);
      } else {
        await this.syncItem({key, extKey, value, extValue, strategy});
      }
    }
  }

  private async syncItem(entry: SyncEntry<T>) {
    // Облачное значение может быть JSON-строкой или уже разобранными данными.
    let extValue = entry.extValue;
    if (typeof extValue === "string") {
      try {
        extValue = JSON.parse(extValue);
      } catch {
        this.apiProvider.emit("error", {code: "SYNC_ERROR"});
        return;
      }
    }

    const handler = this.strategies[entry.strategy];
    if (!handler) {
      this.apiProvider.emit("error", {code: "SYNC_ERROR"});
      return;
    }
    await handler({...entry, extValue});
  }

  private readonly strategies: Record<SyncDataStrategy, (entry: SyncEntry<T>) => Promise<void>> = {
    MAX_INT: e => this.syncMaxInt(e),
    MIN_INT_WITHOUT_0: e => this.syncMinIntWithoutZero(e),
    TRUE: e => this.syncTrue(e),
    ARR_MAX_INT: e => this.syncArrMaxInt(e),
    ARR_MIN_INT_WITHOUT_0: e => this.syncArrMinIntWithoutZero(e),
    ARR_FIRST_MAX_INT: e => this.syncArrFirstMaxInt(e),
    DAILY_BONUS: e => this.syncDailyBonus(e),
  };

  private async syncMaxInt({key, extKey, value, extValue}: SyncEntry<T>) {
    if (typeof value !== "number") {
      this.apiProvider.emit("error", {code: "SYNC_ERROR"});
      return;
    }
    if (typeof extValue !== "number") {
      await this.remoteSave(extKey, value);
      return;
    }
    if (extValue > value) {
      await this.localSave(key, extValue);
    } else if (extValue < value) {
      await this.remoteSave(extKey, value);
    }
  }

  // Ноль означает отсутствие значения; сравниваются только два положительных значения.
  private async syncMinIntWithoutZero({key, extKey, value, extValue}: SyncEntry<T>) {
    if (typeof value !== "number") {
      this.apiProvider.emit("error", {code: "SYNC_ERROR"});
      return;
    }
    if (typeof extValue !== "number") {
      await this.remoteSave(extKey, value);
      return;
    }
    if (Math.min(extValue, value) > 0) {
      if (extValue < value) {
        await this.localSave(key, extValue);
      } else if (extValue > value) {
        await this.remoteSave(extKey, value);
      }
    }
  }

  // Подтверждённое значение true сохраняется независимо от второй копии данных.
  private async syncTrue({key, extKey, value, extValue}: SyncEntry<T>) {
    if (typeof extValue !== "boolean") {
      await this.remoteSave(extKey, value);
      return;
    }
    if (extValue === true && value === false) {
      await this.localSave(key, true);
    } else if (extValue === false && value === true) {
      await this.remoteSave(extKey, value);
    }
  }

  private async syncArrMaxInt({key, extKey, value, extValue}: SyncEntry<T>) {
    if (!isNumberArray(value)) {
      this.apiProvider.emit("error", {code: "SYNC_ERROR"});
      return;
    }
    if (!isNumberArray(extValue)) {
      await this.remoteSave(extKey, value);
      return;
    }
    if (sameJson(extValue, value)) {
      return;
    }
    const result: number[] = [];
    const length = Math.max(extValue.length, value.length);
    for (let i = 0; i < length; i++) {
      result[i] = Math.max(value[i] || 0, extValue[i] || 0);
    }
    await this.localSave(key, result);
    await this.remoteSave(extKey, result);
  }

  // Ноль означает отсутствие результата и уступает ненулевому значению.
  private async syncArrMinIntWithoutZero({key, extKey, value, extValue}: SyncEntry<T>) {
    if (!isNumberArray(value)) {
      this.apiProvider.emit("error", {code: "SYNC_ERROR"});
      return;
    }
    if (!isNumberArray(extValue)) {
      await this.remoteSave(extKey, value);
      return;
    }
    if (sameJson(extValue, value)) {
      return;
    }
    const result: number[] = [];
    const length = Math.max(extValue.length, value.length);
    for (let i = 0; i < length; i++) {
      const a: number = value[i] || 0;
      const b: number = extValue[i] || 0;
      result[i] = a && b ? Math.min(a, b) : a || b;
    }
    await this.localSave(key, result);
    await this.remoteSave(extKey, result);
  }

  // Первый элемент определяет приоритет всего массива; поэлементное объединение не применяется.
  private async syncArrFirstMaxInt({key, extKey, value, extValue}: SyncEntry<T>) {
    if (!isNumberArray(value)) {
      this.apiProvider.emit("error", {code: "SYNC_ERROR"});
      return;
    }
    if (!isNumberArray(extValue) || extValue.length === 0) {
      await this.remoteSave(extKey, value);
      return;
    }
    if (sameJson(extValue, value)) {
      return;
    }
    if (value[0] > extValue[0]) {
      await this.remoteSave(extKey, value);
    } else if (value[0] < extValue[0]) {
      await this.localSave(key, extValue);
    }
  }

  // Локальный массив сохраняется, если его первый или последний элемент больше облачного.
  // Иначе принимается облачный массив целиком.
  private async syncDailyBonus({key, extKey, value, extValue}: SyncEntry<T>) {
    if (!isNumberArray(value)) {
      this.apiProvider.emit("error", {code: "SYNC_ERROR"});
      return;
    }
    if (!isNumberArray(extValue)) {
      await this.remoteSave(extKey, value);
      return;
    }
    if (sameJson(extValue, value)) {
      return;
    }
    const first = (arr: number[]): number => (arr.length ? arr[0] : 0);
    const last = (arr: number[]): number => (arr.length ? arr[arr.length - 1] : 0);

    if (first(value) > first(extValue) || last(value) > last(extValue)) {
      await this.remoteSave(extKey, value);
    } else {
      await this.localSave(key, extValue);
    }
  }

  private async remoteSave(extKey: string, value: unknown) {
    await this.apiProvider.set(extKey, JSON.stringify(value));
  }

  private async localSave(key: keyof T, value: unknown) {
    this.gameStorage.upd({[key]: value} as Partial<T>);
  }
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((item: unknown) => typeof item === "number");
}
