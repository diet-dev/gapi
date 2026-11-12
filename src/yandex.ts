import {FlagsModule} from "./flags/FlagsModule.ts";
import type {FlagDefaults, FlagsOptions} from "./interfaces.ts";
import {type GameApi} from "./interfaces.ts";
import {YgPurchases} from "./purchases/YgPurchases.ts";
import {YgGame} from "./game/YgGame.ts";
import {YgAds} from "./ads/YgAds.ts";
import {YgAuth} from "./auth/YgAuth.ts";
import {YgData} from "./data/YgData.ts";
import {YgPlayer} from "./player/YgPlayer.ts";
import {YgScore} from "./score/YgScore.ts";
import {YgShortcut} from "./shortcut/YgShortcut.ts";
import {YgNotifications} from "./notifications/YgNotifications.ts";
import {YgEnv} from "./env/YgEnv.ts";

type Props<TFlags extends FlagDefaults> = FlagsOptions<TFlags> & {fake: boolean};

export class YandexGameApi<TFlags extends FlagDefaults = {}> implements GameApi<TFlags> {
  public readonly flags: FlagsModule<TFlags>;
  public readonly env: YgEnv;
  public readonly ads: YgAds;
  public readonly auth: YgAuth;
  public readonly data: YgData;
  public readonly player: YgPlayer;
  public readonly purchases: YgPurchases;
  public readonly score: YgScore;
  public readonly shortcut: YgShortcut;
  public readonly notifications: YgNotifications;
  public readonly game: YgGame;

  constructor(props: Props<TFlags>) {
    this.env = new YgEnv(props);
    this.flags = new FlagsModule(
      props.flags ?? ({} as TFlags),
      props.fake
        ? undefined
        : (props.flagsSource ??
            (async defaults => {
              const sdk = await this.env.sdk();
              if (!sdk) throw new Error("Yandex SDK unavailable");
              return sdk.getFlags({defaultFlags: defaults});
            })),
    );
    this.ads = new YgAds(props);
    this.auth = new YgAuth(props);
    this.data = new YgData(props);
    this.player = new YgPlayer(props);
    this.purchases = new YgPurchases(props);
    this.score = new YgScore(props);
    this.shortcut = new YgShortcut(props);
    this.notifications = new YgNotifications(props);
    this.game = new YgGame(props);
  }
}

export type {
  YandexPlayerMode,
  YandexPlayerScopePermissions,
  YandexSignedPlayerData,
  YandexSignedPlayerPayload,
} from "./auth/yandex-player.ts";

export type {FlagDefaults, FlagValues, Flags, FlagsSource} from "./interfaces.ts";

export type {ShortcutCheckResult, ShortcutShowResult} from "./interfaces.ts";
