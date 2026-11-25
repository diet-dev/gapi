import {Api} from "./api/Api.ts";
import {createReadCache} from "./utils/readCache.ts";
import type {
  ApiEvents,
  BackendDescription,
  BackendEntries,
  BackendEntriesOptions,
  BackendEntry,
  BackendProfile,
  BackendProof,
  GameBackend,
  LeaderboardData,
  ScoreReadOptions,
} from "./interfaces.ts";

export type {
  BackendDescription,
  BackendEntries,
  BackendEntriesOptions,
  BackendEntry,
  BackendProfile,
  BackendProof,
  GameBackend,
} from "./interfaces.ts";

export type GameApiClientOptions = {
  url: string;
  projectId: string;
  getProof: () => BackendProof | Promise<BackendProof>;
  getProfile?: () => BackendProfile | undefined | Promise<BackendProfile | undefined>;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
};
type Session = {accessToken: string; expiresAt: number};
class RequestError extends Error {
  public readonly code: string;
  public readonly status: number;
  public readonly retryAfter: number;
  constructor(code: string, status = 0, retryAfter = 0) {
    super(code);
    this.code = code;
    this.status = status;
    this.retryAfter = retryAfter;
  }
}

export function toLeaderboardData(data: BackendEntries): LeaderboardData {
  return {
    userRank: data.userRank ?? 0,
    entries: data.entries.map(entry => ({
      rank: entry.rank,
      score: entry.score,
      name: entry.player.name ?? "",
      avatar: entry.player.avatarUrl ?? "",
      authorized: Boolean(entry.player.name && entry.player.avatarUrl),
    })),
  };
}

export class GameApiClient extends Api<ApiEvents> implements GameBackend {
  private readonly ownCache = createReadCache<BackendEntry | null>();
  private readonly tableCache = createReadCache<BackendEntries>();
  private readonly base: string;
  private readonly send: typeof globalThis.fetch;
  private session?: Session;
  private pendingAuth?: Promise<Session>;

  private readonly options: GameApiClientOptions;

  constructor(options: GameApiClientOptions) {
    super({fake: false});
    this.options = options;
    this.base = `${options.url.replace(/\/$/, "")}/v1/projects/${encodeURIComponent(options.projectId)}`;
    this.send = options.fetch ?? ((input, init) => globalThis.fetch(input, init));
  }

  public authenticate(): Promise<boolean> {
    return this.perform(async () => {
      await this.login();
      return true;
    }, false);
  }

  public sendReport(type: string, payload: unknown): Promise<string | undefined> {
    return this.perform(async () => {
      const result = await this.request<{reportId?: unknown} | null>(
        "/reports",
        {method: "POST", body: JSON.stringify({type, payload})},
        true,
      );
      if (typeof result?.reportId !== "string" || !result.reportId) {
        throw new RequestError("BACKEND_INVALID_RESPONSE");
      }
      return result.reportId;
    }, undefined);
  }

  public getFlags(): Promise<Record<string, string> | undefined> {
    return this.perform(async () => {
      const data = await this.request<unknown>("/flags");
      if (
        !data ||
        typeof data !== "object" ||
        Array.isArray(data) ||
        Object.values(data).some(value => typeof value !== "string")
      ) {
        throw new RequestError("BACKEND_INVALID_RESPONSE");
      }
      return data as Record<string, string>;
    }, undefined);
  }

  public getDescription(board: string): Promise<BackendDescription | undefined> {
    return this.perform(() => this.request(this.boardPath(board)), undefined);
  }

  public setScore(board: string, score: number, extraData?: string): Promise<boolean> {
    return this.perform(async () => {
      if (!Number.isSafeInteger(score) || score < 0) {
        throw new RequestError("SCORE_OUT_OF_RANGE");
      }
      await this.request(
        `${this.boardPath(board)}/me/score`,
        {
          method: "PUT",
          body: JSON.stringify({score, ...(extraData === undefined ? {} : {extraData})}),
        },
        true,
        true,
      );
      this.ownCache.invalidate(JSON.stringify([board]));
      this.tableCache.invalidate(JSON.stringify([board]).slice(0, -1) + ",");
      return true;
    }, false);
  }

  public getPlayerEntry(board: string, options: ScoreReadOptions = {}): Promise<BackendEntry | null | undefined> {
    return this.perform(async () => {
      await this.login();
      return this.ownCache.read(JSON.stringify([board]), options.maxAgeMs ?? 0, async () => {
        try {
          return await this.request<BackendEntry>(`${this.boardPath(board)}/me`, {}, true);
        } catch (error) {
          if (error instanceof RequestError && error.code === "LEADERBOARD_PLAYER_NOT_PRESENT") return null;
          throw error;
        }
      });
    }, undefined);
  }

  public getEntries(board: string, options: BackendEntriesOptions = {}): Promise<BackendEntries | undefined> {
    const query = new URLSearchParams();
    if (options.quantityTop !== undefined) query.set("quantityTop", String(options.quantityTop));
    if (options.includeUser !== undefined) query.set("includeUser", String(options.includeUser));
    if (options.includeUser && options.quantityAround !== undefined) {
      query.set("quantityAround", String(options.quantityAround));
    }
    return this.perform(async () => {
      if (options.includeUser) await this.login();
      const key = JSON.stringify([board, query.toString()]);
      return this.tableCache.read(key, options.maxAgeMs ?? 0, () =>
        this.request<BackendEntries>(`${this.boardPath(board)}/entries?${query}`, {}, options.includeUser === true),
      );
    }, undefined);
  }

  private boardPath(board: string): string {
    return `/leaderboards/${encodeURIComponent(board)}`;
  }

  private async perform<T>(operation: () => Promise<T>, fallback: T): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      this.emit("error", {code: error instanceof RequestError ? error.code : "BACKEND_REQUEST_ERROR"});
      return fallback;
    }
  }

  private login(): Promise<Session> {
    if (this.session && this.session.expiresAt > Date.now() + 5000) return Promise.resolve(this.session);
    if (this.pendingAuth) return this.pendingAuth;
    this.pendingAuth = (async () => {
      const proof = await this.options.getProof();
      const profile = await this.options.getProfile?.();
      const result = await this.exchange<{accessToken: string; expiresAt: string}>("/auth/token", {
        method: "POST",
        body: JSON.stringify({proof, ...(profile === undefined ? {} : {profile})}),
      });
      const expiresAt = Date.parse(result.expiresAt);
      if (!result.accessToken || !Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
        throw new RequestError("BACKEND_INVALID_RESPONSE");
      }
      this.ownCache.invalidate();
      this.tableCache.invalidate();
      this.session = {accessToken: result.accessToken, expiresAt};
      return this.session;
    })().finally(() => {
      this.pendingAuth = undefined;
    });
    return this.pendingAuth;
  }

  private async request<T>(path: string, init: RequestInit = {}, authorized = false, retryWrite = false): Promise<T> {
    let retriedAuth = false,
      retriedRate = false;
    for (;;) {
      const session = authorized ? await this.login() : undefined;
      try {
        return await this.exchange<T>(path, init, session?.accessToken);
      } catch (error) {
        if (
          error instanceof RequestError &&
          authorized &&
          error.status === 401 &&
          ["TOKEN_INVALID", "AUTH_REQUIRED"].includes(error.code) &&
          !retriedAuth
        ) {
          retriedAuth = true;
          if (this.session === session) this.session = undefined;
          continue;
        }
        // Лучшая запись идемпотентна; быстрые ходы могут упереться в секундный лимит.
        if (
          error instanceof RequestError &&
          retryWrite &&
          error.status === 429 &&
          !retriedRate &&
          error.retryAfter > 0 &&
          error.retryAfter <= 5
        ) {
          retriedRate = true;
          await new Promise(resolve => setTimeout(resolve, error.retryAfter * 1000));
          continue;
        }
        throw error;
      }
    }
  }

  private async exchange<T>(path: string, init: RequestInit, token?: string): Promise<T> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.timeoutMs ?? 15000);
    try {
      const headers = new Headers();
      if (init.body !== undefined) headers.set("Content-Type", "application/json");
      if (token) headers.set("Authorization", `Bearer ${token}`);
      const response = await this.send(this.base + path, {
        ...init,
        headers,
        signal: controller.signal,
        credentials: "omit",
        cache: "no-store",
      });
      const body = await response.json();
      if (!response.ok) {
        throw new RequestError(
          body?.error?.code ?? "BACKEND_HTTP_ERROR",
          response.status,
          Number(response.headers.get("Retry-After") ?? "1"),
        );
      }
      return body as T;
    } finally {
      clearTimeout(timer);
    }
  }
}
