import {type ApiEvents, type Player} from "../interfaces.ts";
import {YgApi} from "../api/YgApi.ts";

type Props = {fake: boolean};

export class YgPlayer extends YgApi<ApiEvents> implements Player {
  constructor(props: Props) {
    super(props);
  }

  public async id() {
    const player = await this.getPlayer();
    return player ? player.getUniqueID() : "";
  }

  public async name() {
    const player = await this.getPlayer();
    return player ? player.getName() : "";
  }

  public async avatar(size?: "large" | "medium" | "small") {
    const player = await this.getPlayer();
    return player ? player.getPhoto(size || "small") : "";
  }
}
