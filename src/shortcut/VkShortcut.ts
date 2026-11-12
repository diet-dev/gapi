import {type ApiEvents, type Shortcut, type ShortcutCheckResult, type ShortcutShowResult} from "../interfaces.ts";
import {VkApi} from "../api/VkApi.ts";

type Props = {fake: boolean};

function isUserDenied(error: unknown): boolean {
  if (!error || typeof error !== "object" || !("error_data" in error)) return false;
  const data = error.error_data;
  return (
    !!data &&
    typeof data === "object" &&
    "error_reason" in data &&
    typeof data.error_reason === "string" &&
    data.error_reason.trim().toLowerCase() === "user denied"
  );
}

export class VkShortcut extends VkApi<ApiEvents> implements Shortcut {
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
      if (!(await this.bridgeSupports("VKWebAppAddToHomeScreenInfo"))) return {status: "unsupported"};
      const data = await this.bridgeSend("VKWebAppAddToHomeScreenInfo");
      if (typeof data?.is_feature_supported !== "boolean" || typeof data?.is_added_to_home_screen !== "boolean") {
        throw new Error("Invalid shortcut check response");
      }
      if (!data.is_feature_supported) return {status: "unsupported"};
      return {status: data.is_added_to_home_screen ? "already_added" : "available"};
    } catch (error) {
      this.emit("error", {code: "SHORTCUT_CHECK_ERROR"});
      return {status: "error", error};
    }
  }

  public async showResult(): Promise<ShortcutShowResult> {
    try {
      const data = await this.bridgeSend("VKWebAppAddToHomeScreen");
      if (typeof data?.result !== "boolean") throw new Error("Invalid shortcut prompt response");
      return {status: data.result ? "accepted" : "not_accepted"};
    } catch (error) {
      if (isUserDenied(error)) return {status: "not_accepted"};
      this.emit("error", {code: "SHORTCUT_SHOW_ERROR"});
      return {status: "error", error};
    }
  }
}
