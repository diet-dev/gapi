import {type ApiEvents, type Notifications} from "../interfaces.ts";
import {VkApi} from "../api/VkApi.ts";

type Props = {fake: boolean};

// При ошибке отправки запроса возникают два события error:
// SEND_ERROR от базового адаптера и код конкретной операции от этого модуля.
export class VkNotifications extends VkApi<ApiEvents> implements Notifications {
  constructor(props: Props) {
    super(props);
  }

  public async check(): Promise<boolean> {
    try {
      return (
        (await this.bridgeSupports("VKWebAppAllowNotifications")) &&
        (await this.bridgeSupports("VKWebAppDenyNotifications"))
      );
    } catch {
      return false;
    }
  }

  public async request(): Promise<boolean> {
    try {
      const data = await this.bridgeSend("VKWebAppAllowNotifications");
      return data.result;
    } catch {
      this.emit("error", {code: "NOTIFICATIONS_REQUEST_ERROR"});
      return false;
    }
  }

  public async disable(): Promise<boolean> {
    try {
      const data = await this.bridgeSend("VKWebAppDenyNotifications");
      return data.result;
    } catch {
      this.emit("error", {code: "NOTIFICATIONS_DISABLE_ERROR"});
      return false;
    }
  }
}
