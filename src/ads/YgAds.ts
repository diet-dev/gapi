import {type Ads, type AdsEvents, type AdOperation, type AdShowResult} from "../interfaces.ts";
import {YgApi} from "../api/YgApi.ts";

type Props = {fake: boolean};

// После onClose оставляем время для onRewarded, чтобы не завершить показ
// с результатом false раньше подтверждения награды.
const REWARDED_RESOLVE_DELAY_MS = 500;

export class YgAds extends YgApi<AdsEvents> implements Ads {
  constructor(props: Props) {
    super(props);
  }

  private async requireSdk(operation: AdOperation) {
    const sdk = await this.sdk();
    if (!sdk) {
      this.emit("error", {code: operation === "hideBanner" ? "HIDE_AD_ERROR" : "SHOW_AD_ERROR", operation});
    }
    return sdk;
  }

  public async showNative(): Promise<AdShowResult> {
    const sdk = await this.requireSdk("showNative");
    if (!sdk) return "error";

    return new Promise<AdShowResult>(resolve => {
      sdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => this.emit("show:native", {}),
          onClose: (wasShown: boolean) => {
            this.emit("hide:native", {});
            resolve(wasShown ? "success" : "error");
          },
          onError: (err: unknown) => {
            resolve("error");
            this.emit("error", {code: "SHOW_AD_ERROR", operation: "showNative", reason: String(err)});
          },
          onOffline: () => {
            resolve("error");
            this.emit("error", {code: "SHOW_AD_ERROR", operation: "showNative", reason: "offline"});
          },
        },
      });
    });
  }

  public async showRewarded(): Promise<AdShowResult> {
    const sdk = await this.requireSdk("showRewarded");
    if (!sdk) return "error";

    return new Promise<AdShowResult>(resolve => {
      sdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => this.emit("show:rewarded", {}),
          onClose: () => {
            this.emit("hide:rewarded", {});
            setTimeout(() => resolve("cancelled"), REWARDED_RESOLVE_DELAY_MS);
          },
          onError: (err: unknown) => {
            resolve("error");
            this.emit("error", {code: "SHOW_AD_ERROR", operation: "showRewarded", reason: String(err)});
          },
          onRewarded: () => resolve("success"),
        },
      });
    });
  }

  public async showBanner() {
    const sdk = await this.requireSdk("showBanner");
    if (!sdk) return false;

    try {
      const result = await sdk.adv.showBannerAdv();
      if (result.reason) {
        this.emit("error", {code: "SHOW_AD_ERROR", operation: "showBanner", reason: result.reason});
        return false;
      }

      this.emit("show:banner", {});
      return true;
    } catch (err: unknown) {
      this.emit("error", {code: "SHOW_AD_ERROR", operation: "showBanner", reason: String(err)});
      return false;
    }
  }

  public checkNative() {
    return this.ok();
  }

  public checkRewarded() {
    return this.ok();
  }

  public async checkBanner() {
    const sdk = await this.requireSdk("checkBanner");
    if (!sdk) return false;

    try {
      const data = await sdk.adv.getBannerAdvStatus();
      return data.stickyAdvIsShowing;
    } catch {
      this.emit("error", {code: "SHOW_AD_ERROR", operation: "checkBanner"});
      return false;
    }
  }

  public async hideBanner() {
    const sdk = await this.requireSdk("hideBanner");
    if (!sdk) return false;

    try {
      await sdk.adv.hideBannerAdv();
      this.emit("hide:banner", {});
      return true;
    } catch {
      this.emit("error", {code: "HIDE_AD_ERROR", operation: "hideBanner"});
      return false;
    }
  }
}
