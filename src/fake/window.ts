import type {VKBridge, RequestProps} from "@vkontakte/vk-bridge";
import type {SDK} from "ysdk";

export type FakeWindow = Window & {
  "fake-bridge"?: Pick<VKBridge, "send" | "subscribe" | "supportsAsync">;
  "fake-ysdk"?: SDK;
  showBanner?: (props?: RequestProps<"VKWebAppShowBannerAd">) => void;
  hideBanner?: () => void;
  logout?: () => void;
  YaGames?: typeof YaGames;
};
