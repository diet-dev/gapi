import {FlagsModule} from "./flags/FlagsModule.ts";
import type {FlagDefaults, FlagsOptions} from "./interfaces.ts";
import {type GameApi, type Score, type ServerTimeProvider} from "./interfaces.ts";
import {VkPurchases} from "./purchases/VkPurchases.ts";
import {VkGame} from "./game/VkGame.ts";
import {VkAds} from "./ads/VkAds.ts";
import {VkAuth} from "./auth/VkAuth.ts";
import {VkData} from "./data/VkData.ts";
import {VkPlayer} from "./player/VkPlayer.ts";
import {VkScore} from "./score/VkScore.ts";
import {VkShortcut} from "./shortcut/VkShortcut.ts";
import {VkNotifications} from "./notifications/VkNotifications.ts";
import {VkEnv} from "./env/VkEnv.ts";

type Props<TFlags extends FlagDefaults> = FlagsOptions<TFlags> & {
  fake: boolean;
  score?: Score;
  serverTime?: ServerTimeProvider;
};

export class VkGameApi<TFlags extends FlagDefaults = {}> implements GameApi<TFlags> {
  public readonly flags: FlagsModule<TFlags>;
  public readonly env: VkEnv;
  public readonly ads: VkAds;
  public readonly auth: VkAuth;
  public readonly data: VkData;
  public readonly player: VkPlayer;
  public readonly purchases: VkPurchases;
  public readonly score: Score;
  public readonly shortcut: VkShortcut;
  public readonly notifications: VkNotifications;
  public readonly game: VkGame;

  constructor(props: Props<TFlags>) {
    this.env = new VkEnv(props);
    this.flags = new FlagsModule(props.flags ?? ({} as TFlags), props.fake ? undefined : props.flagsSource);
    this.ads = new VkAds(props);
    this.auth = new VkAuth(props);
    this.data = new VkData(props);
    this.player = new VkPlayer(props);
    this.purchases = new VkPurchases(props);
    this.score = props.score ?? new VkScore(props);
    this.shortcut = new VkShortcut(props);
    this.notifications = new VkNotifications(props);
    this.game = new VkGame(props);
  }
}

export type {FlagDefaults, FlagValues, Flags, FlagsSource} from "./interfaces.ts";

export type {ShortcutCheckResult, ShortcutShowResult} from "./interfaces.ts";
