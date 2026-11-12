import {type DataStorage, type SyncDataStrategy, type ApiEvents, type Data} from "../interfaces.ts";
import {VkApi} from "../api/VkApi.ts";
import {SyncManager} from "./SyncManager.ts";

type Props = {fake: boolean};

export class VkData extends VkApi<ApiEvents> implements Data {
  constructor(props: Props) {
    super(props);
  }

  public async set(key: string, value: string): Promise<void> {
    try {
      await this.bridgeSend("VKWebAppStorageSet", {key, value});
    } catch {
      this.emit("error", {code: "SET_DATA_ERROR"});
    }
  }

  public async get(keys?: string[]) {
    try {
      const data = await this.bridgeSend("VKWebAppStorageGet", {keys: keys || []});
      return prepare(data.keys);
    } catch {
      this.emit("error", {code: "GET_DATA_ERROR"});
      return {};
    }
  }

  public async sync<T>(storage: DataStorage<T>, items: [keyof T, SyncDataStrategy, string?][]) {
    // Имена ключей в облаке могут отличаться от локальных.
    const data = await this.get(items.map(i => (i[2] || i[0]) as string));

    await new SyncManager(storage, this).sync(items, data);
  }
}

function prepare(keys: {key: string; value: string}[]): Record<string, string> {
  return keys.reduce<Record<string, string>>((acc, cur) => {
    if (cur.value !== "") {
      acc[cur.key] = cur.value;
    }
    return acc;
  }, {});
}
