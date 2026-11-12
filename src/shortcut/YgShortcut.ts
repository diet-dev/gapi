import {type ApiEvents, type Shortcut, type ShortcutCheckResult, type ShortcutShowResult} from "../interfaces.ts";
import {YgApi} from "../api/YgApi.ts";

type Props = {fake: boolean};

export class YgShortcut extends YgApi<ApiEvents> implements Shortcut {
  constructor(props: Props) {
    super(props);
  }

  public async check(): Promise<boolean> {
    return (await this.checkResult()).status === "available";
  }

  public async show(): Promise<boolean> {
    return (await this.showResult()).status === "accepted";
  }

  public async checkResult(): Promise<ShortcutCheckResult> {
    try {
      const sdk = await this.sdk();
      if (!sdk) throw new Error("Shortcut SDK unavailable");
      const data = await sdk.shortcut.canShowPrompt();
      if (typeof data?.canShow !== "boolean") throw new Error("Invalid shortcut check response");
      return {status: data.canShow ? "available" : "unavailable"};
    } catch (error) {
      this.emit("error", {code: "SHORTCUT_CHECK_ERROR"});
      return {status: "error", error};
    }
  }

  public async showResult(): Promise<ShortcutShowResult> {
    try {
      const sdk = await this.sdk();
      if (!sdk) throw new Error("Shortcut SDK unavailable");
      const data = await sdk.shortcut.showPrompt();
      if (data?.outcome !== "accepted" && data?.outcome !== "rejected") {
        throw new Error("Invalid shortcut prompt response");
      }
      return {status: data.outcome === "accepted" ? "accepted" : "not_accepted"};
    } catch (error) {
      this.emit("error", {code: "SHORTCUT_SHOW_ERROR"});
      return {status: "error", error};
    }
  }
}
