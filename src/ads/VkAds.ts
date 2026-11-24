import {type Ads, type AdsEvents, type AdShowResult} from "../interfaces.ts";
import {VkApi} from "../api/VkApi.ts";
import type {ErrorData} from "@vkontakte/vk-bridge";

type Props = {fake: boolean};

const nativeProps = {ad_format: "interstitial" as const};
const rewardedProps = {ad_format: "reward" as const};

type CheckMethod = "VKWebAppCheckNativeAds" | "VKWebAppCheckBannerAd";
type AdProps = typeof nativeProps | typeof rewardedProps;

export class VkAds extends VkApi<AdsEvents> implements Ads {
  constructor(props: Props) {
    super(props);

    this.bridgeSubscribe(event => {
      if (event.detail.type === "VKWebAppBannerAdClosedByUser") {
        this.emit("hide:banner", {code: "AD_CLOSE_BY_USER"});
      }
    });
  }

  // У Bridge нет события открытия этой рекламы, поэтому show:* отправляется до запроса.
  // Парный hide:* отправляется и при ошибке, чтобы игра могла завершить ожидание рекламы.
  private async sendShow(
    operation: "showNative" | "showRewarded",
    props: AdProps,
    events: {show: "show:native" | "show:rewarded"; hide: "hide:native" | "hide:rewarded"},
  ): Promise<AdShowResult> {
    this.emit(events.show, {});

    try {
      const data = await this.bridgeSend("VKWebAppShowNativeAds", props);
      this.emit(events.hide, {});
      return data?.result ? "success" : "error";
    } catch (error: unknown) {
      this.emit(events.hide, {});
      const failure = error as Partial<ErrorData> | null;
      if (
        props.ad_format === "reward" &&
        failure?.error_type === "client_error" &&
        failure.error_data?.error_code === 4
      ) {
        return "cancelled";
      }
      const reason = failure?.error_type === "client_error" ? failure.error_data?.error_reason : String(error);
      this.emit("error", {code: "SHOW_AD_ERROR", operation, reason});
      return "error";
    }
  }

  private async sendCheck(
    operation: "checkNative" | "checkRewarded" | "checkBanner",
    method: CheckMethod,
    props?: AdProps,
  ): Promise<boolean> {
    try {
      const data = await this.bridgeSend(method, props);
      return !!(data && data.result);
    } catch {
      this.emit("error", {code: "SHOW_AD_ERROR", operation});
      return false;
    }
  }

  public async showNative(): Promise<AdShowResult> {
    return this.sendShow("showNative", nativeProps, {show: "show:native", hide: "hide:native"});
  }

  public async showRewarded(): Promise<AdShowResult> {
    return this.sendShow("showRewarded", rewardedProps, {show: "show:rewarded", hide: "hide:rewarded"});
  }

  public async showBanner(): Promise<boolean> {
    try {
      const data = await this.bridgeSend("VKWebAppShowBannerAd", {banner_location: "top" as const});
      if (data.result) {
        this.emit("show:banner", {});
      }
      return !!(data && data.result);
    } catch {
      this.emit("error", {code: "SHOW_AD_ERROR", operation: "showBanner"});
      return false;
    }
  }

  public checkNative(): Promise<boolean> {
    return this.sendCheck("checkNative", "VKWebAppCheckNativeAds", nativeProps);
  }

  public checkRewarded(): Promise<boolean> {
    return this.sendCheck("checkRewarded", "VKWebAppCheckNativeAds", rewardedProps);
  }

  public checkBanner(): Promise<boolean> {
    return this.sendCheck("checkBanner", "VKWebAppCheckBannerAd");
  }

  public async hideBanner(): Promise<boolean> {
    try {
      await this.bridgeSend("VKWebAppHideBannerAd");
      this.emit("hide:banner", {});
      return true;
    } catch {
      this.emit("error", {code: "HIDE_AD_ERROR", operation: "hideBanner"});
      return false;
    }
  }
}
