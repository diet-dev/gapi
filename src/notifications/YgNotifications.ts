import {type ApiEvents, type Notifications} from "../interfaces.ts";
import {YgApi} from "../api/YgApi.ts";

type Props = {fake: boolean};

// Управление согласием на уведомления в этой реализации не поддерживается.
export class YgNotifications extends YgApi<ApiEvents> implements Notifications {
  constructor(props: Props) {
    super(props);
  }

  public check(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public request(): Promise<boolean> {
    return Promise.resolve(false);
  }

  public disable(): Promise<boolean> {
    return Promise.resolve(false);
  }
}
