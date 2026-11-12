import {type ApiEvents, type Environment, SUPPORTED_LANGUAGES, type Language} from "../interfaces.ts";
import {YgApi} from "../api/YgApi.ts";

type Props = {fake: boolean};

export class YgEnv extends YgApi<ApiEvents> implements Environment {
  public readonly defaultLang: Language = "ru";
  public readonly YG = true;
  public readonly VK = false;
  public readonly STORE: "vk" | "yg" = "yg";

  constructor(props: Props) {
    super(props);
  }

  public async serverTime(_forceSync?: boolean): Promise<number | undefined> {
    try {
      const sdk = await this.sdk();
      if (!sdk || typeof sdk.serverTime !== "function") throw new Error("SDK serverTime unavailable");
      const time = sdk.serverTime();
      if (!Number.isSafeInteger(time) || time <= 0) throw new Error("Invalid SDK serverTime");
      return time;
    } catch {
      this.emit("error", {code: "GET_SERVER_TIME_ERROR"});
      return undefined;
    }
  }

  public async lang() {
    const sdk = await this.sdk();
    const lang = sdk ? sdk.environment.i18n.lang : this.defaultLang;
    return SUPPORTED_LANGUAGES.includes(lang as Language) ? (lang as Language) : this.defaultLang;
  }

  public async appId() {
    const sdk = await this.sdk();
    return sdk ? String(sdk.environment.app.id) : "";
  }

  public async platform(): Promise<string> {
    try {
      const sdk = await this.sdk();
      return sdk?.deviceInfo?.type || "unknown";
    } catch {
      this.emit("error", {code: "GET_ENV_ERROR"});
      return "unknown";
    }
  }

  public async payload() {
    const sdk = await this.sdk();
    return sdk ? sdk.environment.payload : null;
  }

  public async isMobile() {
    return (await this.platform()) === "mobile";
  }

  public async isDesktop() {
    return (await this.platform()) === "desktop";
  }

  public async theme() {
    if (
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches
    ) {
      return "dark";
    }
    return "light";
  }
}
