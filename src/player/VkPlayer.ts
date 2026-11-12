import {type ApiEvents, type Player} from "../interfaces.ts";
import {VkApi} from "../api/VkApi.ts";
import {type UserInfo} from "@vkontakte/vk-bridge";

type Props = {fake: boolean};

export class VkPlayer extends VkApi<ApiEvents> implements Player {
  private userInfo?: UserInfo;

  constructor(props: Props) {
    super(props);
  }

  public async id(): Promise<string> {
    const params = this.launchParams();
    const viewerId = params.vk_user_id || params.viewer_id;

    if (viewerId) {
      return viewerId;
    }
    const user = await this.getUserInfo();
    return user?.id ? String(user.id) : "";
  }

  public async name(): Promise<string> {
    const user = await this.getUserInfo();
    return user ? `${user.first_name} ${user.last_name}` : "";
  }

  public async avatar(size?: "large" | "medium" | "small"): Promise<string> {
    const user = await this.getUserInfo();

    if (!user) {
      return "";
    }
    if (size === "large") {
      return String(user.photo_max_orig);
    }
    if (size === "medium") {
      return String(user.photo_200);
    }
    return String(user.photo_100);
  }

  private async getUserInfo(): Promise<UserInfo | undefined> {
    if (this.userInfo) {
      return this.userInfo;
    }
    try {
      this.userInfo = await this.bridgeSend("VKWebAppGetUserInfo");
      return this.userInfo;
    } catch {
      this.emit("error", {code: "GET_PLAYER_INFO_ERROR"});
      return undefined;
    }
  }
}
