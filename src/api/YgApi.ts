import type {FakeWindow} from "../fake/window.ts";
import {type ApiEvents} from "../interfaces.ts";
import {Api} from "./Api.ts";
import type {SDK, Player} from "ysdk";
import {loadScript} from "../utils/loadScript.ts";

type Props = {fake: boolean};

export class YgApi<T extends ApiEvents> extends Api<T> {
  private static sdkPromise?: Promise<SDK>;
  private static player?: Player | null;

  constructor(props: Props) {
    super(props);
  }

  public async sdk(): Promise<SDK | undefined> {
    if (this.props.fake) {
      return (window as FakeWindow)["fake-ysdk"];
    }

    try {
      if (!YgApi.sdkPromise) {
        YgApi.sdkPromise = YgApi.loadSdk();
      }
      // await нужен, чтобы отклонение Promise обрабатывалось в этом catch.
      return await YgApi.sdkPromise;
    } catch {
      this.emit("error", {code: "GET_SDK_ERROR"});
      return undefined;
    }
  }

  private static loadSdk(): Promise<SDK> {
    return new Promise<SDK>((resolve, reject) => {
      loadScript("/sdk.js", (success: boolean) => {
        const YaGames = (window as FakeWindow).YaGames;

        if (success && YaGames && typeof YaGames.init === "function") {
          YaGames.init({signed: false})
            .then(resolve)
            .catch(() => reject({code: "SDK_INIT_ERROR"}));
        } else {
          reject({code: "SDK_LODA_ERROR"});
        }
      });
    });
  }

  protected get playerCacheIdentity(): unknown {
    return YgApi.player;
  }

  protected async getPlayer(force: boolean = false): Promise<Player | null> {
    if (!YgApi.player || force) {
      try {
        const sdk = await this.sdk();
        if (sdk) YgApi.player = await sdk.getPlayer();
      } catch {
        this.emit("error", {code: "GET_PLAYER_ERROR"});
      }
    }
    return YgApi.player ?? null;
  }
}
