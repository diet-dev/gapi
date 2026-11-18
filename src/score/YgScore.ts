import {
  type ApiEvents,
  type Score,
  type LeaderboardOptions,
  type ScoreReadOptions,
  type LeaderboardData,
  type LeaderboardEntry as IEntry,
} from "../interfaces.ts";
import {YgApi} from "../api/YgApi.ts";
import {createReadCache} from "../utils/readCache.ts";
import type {LeaderboardEntry} from "ysdk";

type Props = {fake: boolean};

export class YgScore extends YgApi<ApiEvents> implements Score {
  constructor(props: Props) {
    super(props);
  }

  private readonly ownCache = createReadCache<{score: number; rank: number}>();
  private readonly tableCache = createReadCache<LeaderboardData>();
  private cacheIdentity: unknown;
  private writes: Promise<boolean> = Promise.resolve(true);
  private lastWrite = -Infinity;
  private readonly writeClock = performance.now.bind(performance);

  private syncCacheIdentity(): void {
    if (this.cacheIdentity === this.playerCacheIdentity) return;
    this.cacheIdentity = this.playerCacheIdentity;
    this.ownCache.invalidate();
    this.tableCache.invalidate();
  }

  private readEntry(leaderboard: string, maxAgeMs: number) {
    this.syncCacheIdentity();
    return this.ownCache.read(JSON.stringify([leaderboard]), maxAgeMs, async () => {
      const sdk = await this.sdk();
      if (!sdk) throw new Error("SDK unavailable");
      try {
        const entry = await sdk.leaderboards.getPlayerEntry(leaderboard);
        return {score: entry.score, rank: entry.rank};
      } catch (error: unknown) {
        if (error && typeof error === "object" && "code" in error && error.code === "LEADERBOARD_PLAYER_NOT_PRESENT") {
          return {score: 0, rank: 0};
        }
        throw error;
      }
    });
  }

  public set(score: number, leaderboard: string): Promise<boolean> {
    const request = this.writes.then(() => this.write(score, leaderboard));
    this.writes = request.catch(() => false);
    return request;
  }

  private async write(score: number, leaderboard: string): Promise<boolean> {
    try {
      const sdk = await this.sdk();
      if (!sdk) throw new Error("SDK unavailable");
      const entry = await this.readEntry(leaderboard, 15_000);
      if (entry.score >= score) return true;
      // Интервал между записями общий для всех таблиц этого экземпляра.
      const delay = 1100 - (this.writeClock() - this.lastWrite);
      if (delay > 0) await new Promise(resolve => setTimeout(resolve, delay));
      this.lastWrite = this.writeClock();
      await sdk.leaderboards.setScore(leaderboard, score);
      this.ownCache.invalidate(JSON.stringify([leaderboard]));
      this.tableCache.invalidate(JSON.stringify([leaderboard]).slice(0, -1) + ",");
      return true;
    } catch {
      this.emit("error", {code: "SET_SCORE_ERROR"});
      return false;
    }
  }

  public async get(leaderboard: string, options: ScoreReadOptions = {}) {
    try {
      return await this.readEntry(leaderboard, options.maxAgeMs ?? 0);
    } catch {
      this.emit("error", {code: "GET_SCORE_ERROR"});
      return {score: -1, rank: -1};
    }
  }

  public async laeders(leaderboard: string, options: LeaderboardOptions = {}) {
    try {
      const sdk = await this.sdk();
      if (!sdk) throw new Error("SDK unavailable");
      this.syncCacheIdentity();
      const {maxAgeMs = 0, ...query} = options;
      const key = JSON.stringify([
        leaderboard,
        query.quantityTop ?? 5,
        query.includeUser ?? false,
        query.quantityAround ?? 5,
      ]);
      return await this.tableCache.read(key, maxAgeMs, async () => {
        const data = await sdk.leaderboards.getEntries(leaderboard, query);
        return {userRank: data.userRank, entries: data.entries.map(decorateEntry)};
      });
    } catch {
      this.emit("error", {code: "LOAD_LEADERBOARD_ERROR"});
    }
  }
}

function decorateEntry(e: LeaderboardEntry): IEntry {
  const permissions = e.player.scopePermissions;
  return {
    rank: e.rank,
    avatar: e.player.getAvatarSrcSet("medium"),
    name: e.player.publicName,
    score: e.score,
    authorized: permissions && permissions.avatar === "allow" && permissions.public_name === "allow",
  };
}
