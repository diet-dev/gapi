import {type ApiEvents, type Auth} from "../interfaces.ts";
import {VkApi} from "../api/VkApi.ts";

type Props = {fake: boolean};

export class VkAuth extends VkApi<ApiEvents> implements Auth {
  constructor(props: Props) {
    super(props);
  }

  public check() {
    return this.ok();
  }

  public async start() {}
}
