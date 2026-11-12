import {type ApiEvents, type Game} from "../interfaces.ts";
import {VkApi} from "../api/VkApi.ts";

type Props = {fake: boolean};

export class VkGame extends VkApi<ApiEvents> implements Game {
  constructor(props: Props) {
    super(props);
  }

  public async ready() {
    try {
      const data = await this.bridgeSend("VKWebAppInit");
      if (!data.result) throw {};
      return true;
    } catch {
      this.emit("error", {code: "READY_ERROR"});
      return false;
    }
  }

  public play() {
    // Отдельный сигнал о начале игрового процесса в этой обёртке не отправляется.
  }

  public stop() {
    // Отдельный сигнал о паузе игрового процесса в этой обёртке не отправляется.
  }

  public async onStop(cb: () => void) {
    await this.bridgeSubscribe(event => {
      if (event.detail.type === "VKWebAppViewHide") {
        cb();
      }
    });
  }

  public async onPlay(cb: () => void) {
    await this.bridgeSubscribe(event => {
      if (event.detail.type === "VKWebAppViewRestore") {
        cb();
      }
    });
  }
}
