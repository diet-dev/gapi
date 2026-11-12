import {serverTime} from "../utils/serverTime.ts";
import {VkApi} from "../api/VkApi.ts";
import {
  type ApiEvents,
  type Environment,
  type ServerTimeProvider,
  SUPPORTED_LANGUAGES,
  type Language,
} from "../interfaces.ts";

type Props = {fake: boolean; serverTime?: ServerTimeProvider};

export class VkEnv extends VkApi<ApiEvents> implements Environment {
  public readonly defaultLang: Language = "ru";
  public readonly YG = false;
  public readonly VK = true;
  public readonly STORE: "vk" | "yg" = "vk";

  private readonly readServerTime: ServerTimeProvider;

  constructor(props: Props) {
    super(props);
    this.readServerTime = props.serverTime ?? serverTime;
  }

  public async serverTime(forceSync?: boolean): Promise<number | undefined> {
    try {
      const time = await this.readServerTime(forceSync);
      if (typeof time !== "number" || !Number.isFinite(time) || time <= 0 || time > Number.MAX_SAFE_INTEGER) {
        throw new Error("Invalid server time");
      }
      return time;
    } catch (error: unknown) {
      this.emit("error", {
        code: "GET_SERVER_TIME_ERROR",
        reason: error instanceof Error ? error.message : String(error),
      });
      return undefined;
    }
  }

  public async lang(): Promise<Language> {
    const params = this.launchParams();
    const lang = params.vk_language || params.language || this.defaultLang;
    // Сохраняем совместимость с числовыми кодами языка в параметрах запуска.
    if (/^\d+$/.test(lang)) return ["0", "1", "2"].includes(lang) ? "ru" : "en";
    if (lang === "ua") return "uk";
    if (lang === "kz") return "kk";
    return SUPPORTED_LANGUAGES.includes(lang as Language) ? (lang as Language) : this.defaultLang;
  }

  public async appId(): Promise<string> {
    const params = this.launchParams();
    return params.vk_app_id || params.api_id || "";
  }

  public async platform(): Promise<string> {
    const params = this.launchParams();
    return params.vk_platform || params.platform || "unknown";
  }

  public async payload() {
    return {...this.launchParams()};
  }

  public async isMobile() {
    const platform = await this.platform();
    // Используем ширину экрана: размер iframe не позволяет определить тип устройства.
    return (
      platform.includes("mobile") ||
      platform === "html5_android" ||
      platform === "html5_ios" ||
      ((platform === "web" || platform.includes("desktop")) &&
        isNarrowScreen(typeof window !== "undefined" ? window.screen?.width : undefined))
    );
  }

  public async isDesktop() {
    const platform = await this.platform();
    return (
      (platform === "web" || platform.includes("desktop")) &&
      !isNarrowScreen(typeof window !== "undefined" ? window.screen?.width : undefined)
    );
  }

  public async theme() {
    try {
      const data = await this.bridgeSend("VKWebAppGetConfig");
      return data?.appearance === "dark" ? "dark" : "light";
    } catch {
      this.emit("error", {code: "GET_THEME_ERROR"});
      return "light";
    }
  }
}

function isNarrowScreen(width = 0): boolean {
  return width > 0 && width < 768;
}
