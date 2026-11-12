import {type ApiEvents, type Game} from "../interfaces.ts";
import {YgApi} from "../api/YgApi.ts";

type Props = {fake: boolean};

export class YgGame extends YgApi<ApiEvents> implements Game {
  constructor(props: Props) {
    super(props);
  }

  public async ready() {
    try {
      const sdk = await this.sdk();
      if (!sdk) throw {};
      sdk.features?.LoadingAPI.ready();
      return true;
    } catch {
      this.emit("error", {code: "READY_ERROR"});
      return false;
    }
  }

  public async play() {
    const sdk = await this.sdk();
    if (!sdk) return;
    sdk.features?.GameplayAPI.start();
  }

  public async stop() {
    const sdk = await this.sdk();
    if (!sdk) return;
    sdk.features?.GameplayAPI.stop();
  }

  public async onStop(cb: () => void) {
    const sdk = await this.sdk();
    if (!sdk) return;
    sdk.on("game_api_pause", () => {
      sdk.features?.GameplayAPI.stop();
      cb();
    });
  }

  public async onPlay(cb: () => void) {
    const sdk = await this.sdk();
    if (!sdk) return;
    sdk.on("game_api_resume", () => {
      sdk.features?.GameplayAPI.start();
      cb();
    });
  }
}
