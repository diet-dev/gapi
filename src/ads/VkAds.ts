import {type Ads, type AdsEvents} from "../interfaces.ts";
import {VkApi} from "../api/VkApi.ts";

type Props = {fake: boolean};

const nativeProps = {ad_format: "interstitial" as const};
const rewardedProps = {ad_format: "reward" as const};

type ShowMethod = "VKWebAppShowNativeAds";
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
    method: ShowMethod,
    props: AdProps,
    events: {show: "show:native" | "show:rewarded"; hide: "hide:native" | "hide:rewarded"},
  ): Promise<boolean> {
    this.emit(events.show, {});

    try {
      const data = await this.bridgeSend(method, props);
      this.emit(events.hide, {});
      return !!(data && data.result);
    } catch {
      this.emit(events.hide, {});
      this.emit("error", {code: "SHOW_AD_ERROR"});
      return false;
    }
  }

  private async sendCheck(method: CheckMethod, props?: AdProps): Promise<boolean> {
    try {
      const data = await this.bridgeSend(method, props);
      return !!(data && data.result);
    } catch {
      this.emit("error", {code: "SHOW_AD_ERROR"});
      return false;
    }
  }

  public async showNative(): Promise<boolean> {
    return this.sendShow("VKWebAppShowNativeAds", nativeProps, {show: "show:native", hide: "hide:native"});
  }

  public async showRewarded(): Promise<boolean> {
    return this.sendShow("VKWebAppShowNativeAds", rewardedProps, {show: "show:rewarded", hide: "hide:rewarded"});
  }

  public async showBanner(): Promise<boolean> {
    try {
      const data = await this.bridgeSend("VKWebAppShowBannerAd", {banner_location: "top" as const});
      if (data.result) {
        this.emit("show:banner", {});
      }
      return !!(data && data.result);
    } catch {
      this.emit("error", {code: "SHOW_AD_ERROR"});
      return false;
    }
  }

  public checkNative(): Promise<boolean> {
    return this.sendCheck("VKWebAppCheckNativeAds", nativeProps);
  }

  public checkRewarded(): Promise<boolean> {
    return this.sendCheck("VKWebAppCheckNativeAds", rewardedProps);
  }

  public checkBanner(): Promise<boolean> {
    return this.sendCheck("VKWebAppCheckBannerAd");
  }

  public async hideBanner(): Promise<boolean> {
    try {
      await this.bridgeSend("VKWebAppHideBannerAd");
      this.emit("hide:banner", {});
      return true;
    } catch {
      this.emit("error", {code: "HIDE_AD_ERROR"});
      return false;
    }
  }
}
