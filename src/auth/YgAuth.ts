import {type ApiEvents, type Auth} from "../interfaces.ts";
import {YgApi} from "../api/YgApi.ts";
import {logger} from "../log.ts";

const log = logger.child("auth:yandex");

type Props = {fake: boolean};

export class YgAuth extends YgApi<ApiEvents> implements Auth {
  constructor(props: Props) {
    super(props);
  }

  public async check() {
    try {
      const sdk = await this.sdk();
      const player = sdk && (await this.getPlayer());
      return Boolean(player && player.isAuthorized());
    } catch (err) {
      log.error(err);
    }
    return false;
  }

  public async start() {
    const sdk = await this.sdk();

    if (!sdk) {
      this.emit("error", {code: "AUTH_ERROR", reason: "SDK"});
      return;
    }
    const player = await this.getPlayer();

    if (player && player.isAuthorized() === false) {
      await sdk.auth.openAuthDialog();
      await this.getPlayer(true);
    }
  }

  public async signature(): Promise<string | null> {
    try {
      const sdk = await this.sdk();
      if (!sdk) {
        this.emit("error", {code: "GET_PLAYER_SIGNATURE_ERROR", reason: "SDK"});
        return null;
      }
      // Подписанный ответ — Signature, его нельзя записывать в кеш обычного Player.
      const signed = await sdk.getPlayer({signed: true});
      if (!signed || typeof signed.signature !== "string" || !signed.signature) {
        this.emit("error", {code: "GET_PLAYER_SIGNATURE_ERROR", reason: "EMPTY_SIGNATURE"});
        return null;
      }
      return signed.signature;
    } catch {
      this.emit("error", {code: "GET_PLAYER_SIGNATURE_ERROR"});
      return null;
    }
  }
}
