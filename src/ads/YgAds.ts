import {type Ads, type AdsEvents} from "../interfaces.ts";
import {YgApi} from "../api/YgApi.ts";

type Props = {fake: boolean};

// После onClose оставляем время для onRewarded, чтобы не завершить показ
// с результатом false раньше подтверждения награды.
const REWARDED_RESOLVE_DELAY_MS = 500;

export class YgAds extends YgApi<AdsEvents> implements Ads {
  constructor(props: Props) {
    super(props);
  }

  private async requireSdk(code: "SHOW_AD_ERROR" | "HIDE_AD_ERROR") {
    const sdk = await this.sdk();
    if (!sdk) {
      this.emit("error", {code});
    }
    return sdk;
  }

  public async showNative() {
    const sdk = await this.requireSdk("SHOW_AD_ERROR");
    if (!sdk) return false;

    return new Promise<boolean>(resolve => {
      sdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => this.emit("show:native", {}),
          onClose: (wasShown: boolean) => {
            this.emit("hide:native", {});
            resolve(wasShown);
          },
          onError: (err: unknown) => {
            resolve(false);
            this.emit("error", {code: "SHOW_AD_ERROR", reason: String(err)});
          },
          onOffline: () => {
            resolve(false);
            this.emit("error", {code: "SHOW_AD_ERROR", reason: "offline"});
          },
        },
      });
    });
  }

  public async showRewarded() {
    const sdk = await this.requireSdk("SHOW_AD_ERROR");
    if (!sdk) return false;

    return new Promise<boolean>(resolve => {
      sdk.adv.showRewardedVideo({
        callbacks: {
          onOpen: () => this.emit("show:rewarded", {}),
          onClose: () => {
            this.emit("hide:rewarded", {});
            setTimeout(() => resolve(false), REWARDED_RESOLVE_DELAY_MS);
          },
          onError: (err: unknown) => {
            resolve(false);
            this.emit("error", {code: "SHOW_AD_ERROR", reason: String(err)});
          },
          onRewarded: () => resolve(true),
        },
      });
    });
  }

  public async showBanner() {
    const sdk = await this.requireSdk("SHOW_AD_ERROR");
    if (!sdk) return false;

    try {
      const result = await sdk.adv.showBannerAdv();
      if (result.reason) {
        this.emit("error", {code: "SHOW_AD_ERROR", reason: result.reason});
        return false;
      }

      this.emit("show:banner", {});
      return true;
    } catch (err: unknown) {
      this.emit("error", {code: "SHOW_AD_ERROR", reason: String(err)});
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
    const sdk = await this.requireSdk("SHOW_AD_ERROR");
    if (!sdk) return false;

    try {
      const data = await sdk.adv.getBannerAdvStatus();
      return data.stickyAdvIsShowing;
    } catch {
      this.emit("error", {code: "SHOW_AD_ERROR"});
      return false;
    }
  }

  public async hideBanner() {
    const sdk = await this.requireSdk("HIDE_AD_ERROR");
    if (!sdk) return false;

    try {
      await sdk.adv.hideBannerAdv();
      this.emit("hide:banner", {});
      return true;
    } catch {
      this.emit("error", {code: "HIDE_AD_ERROR"});
      return false;
    }
  }
}
