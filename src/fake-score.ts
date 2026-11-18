import {EventEmitter} from "@dietdev/emitter";
import type {ApiEvents, LeaderboardData, LeaderboardOptions, Score} from "./interfaces.ts";
import {YgFakeLeaderboard, type LeaderboardLanguage} from "./fake/YgFakeLeaderboard.ts";
import {storageKey, type FakePlatform} from "./fake/storage-keys.ts";

type Props = {
  appId: string;
  platform: FakePlatform;
  storage: Pick<Storage, "getItem" | "setItem">;
  language?: LeaderboardLanguage;
};

/** Локальный рейтинг для разработки игр без подключения к бэкенду. */
export class FakeScore extends EventEmitter<ApiEvents> implements Score {
  private readonly leaderboard: YgFakeLeaderboard;
  private readonly props: Props;

  constructor(props: Props) {
    super();
    this.props = props;
    this.leaderboard = new YgFakeLeaderboard(props.appId, props.language, props);
  }

  public async set(score: number, leaderboard: string): Promise<boolean> {
    try {
      const current = this.readScore(leaderboard);
      this.props.storage.setItem(this.key(leaderboard), JSON.stringify(Math.max(current, score)));
      return true;
    } catch {
      this.emit("error", {code: "SET_SCORE_ERROR"});
      return false;
    }
  }

  public async get(leaderboard: string): Promise<{score: number; rank: number}> {
    try {
      return {score: this.readScore(leaderboard), rank: 1};
    } catch {
      this.emit("error", {code: "GET_SCORE_ERROR"});
      return {score: -1, rank: -1};
    }
  }

  public async laeders(leaderboard: string, options: LeaderboardOptions = {}): Promise<LeaderboardData | void> {
    try {
      const data = await this.leaderboard.getEntries(leaderboard, {
        quantityTop: 15,
        includeUser: true,
        quantityAround: 5,
        ...options,
      });
      return {
        userRank: data.userRank,
        entries: data.entries.map(({rank, score, player}) => ({
          rank,
          score,
          name: player.publicName,
          avatar: this.props.platform === "yg" ? player.getAvatarSrcSet("medium") : player.getAvatarSrc("medium"),
          authorized: true,
        })),
      };
    } catch {
      this.emit("error", {code: "LOAD_LEADERBOARD_ERROR"});
    }
  }

  private key(leaderboard: string): string {
    return storageKey(this.props.appId, this.props.platform, `score-${leaderboard}`);
  }

  private readScore(leaderboard: string): number {
    const value = this.props.storage.getItem(this.key(leaderboard));
    const score = value === null ? 0 : Number(JSON.parse(value));
    return Number.isFinite(score) && score >= 0 ? score : 0;
  }
}
