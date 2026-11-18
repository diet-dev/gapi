import {type DataStorage, type SyncDataStrategy, type ApiEvents, type Data} from "../interfaces.ts";
import {YgApi} from "../api/YgApi.ts";
import {SyncManager} from "./SyncManager.ts";

type Props = {fake: boolean};

export class YgData extends YgApi<ApiEvents> implements Data {
  constructor(props: Props) {
    super(props);
  }

  public async set(key: string, value: string, flush?: boolean): Promise<boolean> {
    try {
      const player = await this.getPlayer();
      if (!player) {
        this.emit("error", {code: "SET_DATA_ERROR"});
        return false;
      }
      // SDK обновляет переданные ключи, сохраняя остальные облачные данные.
      // flush определяет, нужно ли сразу отправить изменения на сервер.
      await player.setData({[key]: value}, flush);
      return true;
    } catch {
      this.emit("error", {code: "SET_DATA_ERROR"});
      return false;
    }
  }

  public async get(_keys?: string[]) {
    try {
      const player = await this.getPlayer();
      if (!player) {
        this.emit("error", {code: "GET_DATA_ERROR"});
        return {};
      }
      return await player.getData();
    } catch {
      this.emit("error", {code: "GET_DATA_ERROR"});
      return {};
    }
  }

  public async sync<T>(storage: DataStorage<T>, items: [keyof T, SyncDataStrategy, string?][]) {
    try {
      const player = await this.getPlayer();
      if (!player) {
        this.emit("error", {code: "SYNC_ERROR"});
        return;
      }
      const data = await player.getData();
      if (!data) {
        this.emit("error", {code: "SYNC_ERROR"});
        return;
      }

      await new SyncManager(storage, this).sync(items, data);
    } catch {
      this.emit("error", {code: "SYNC_ERROR"});
    }
  }
}
