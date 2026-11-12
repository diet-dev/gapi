import {type Emitter as EventEmitter} from "@dietdev/emitter";

export type {Emitter, EventMap, Listener} from "@dietdev/emitter";

export type FlagDefaults = Record<string, string | number | boolean>;
type WidenFlag<T> = T extends boolean ? boolean : T extends number ? number : string;
export type FlagValues<T extends FlagDefaults> = {readonly [K in keyof T]: WidenFlag<T[K]>};
export type FlagsSource = (defaults: Record<string, string>) => Promise<Record<string, string> | undefined>;
export type FlagsOptions<T extends FlagDefaults> = ({flags: T} | ({} extends T ? {flags?: T} : never)) & {
  flagsSource?: FlagsSource;
};

export interface Flags<T extends FlagDefaults = {}> extends EventEmitter<ApiEvents> {
  get(): FlagValues<T>;
  ready(): Promise<boolean>;
}

export interface GameApi<TFlags extends FlagDefaults = {}> {
  readonly flags: Flags<TFlags>;
  readonly env: Environment;
  readonly game: Game;
  readonly ads: Ads;
  readonly auth: Auth;
  readonly data: Data;
  readonly player: Player;
  readonly purchases: Purchases;
  readonly score: Score;
  readonly shortcut: Shortcut;
  readonly notifications: Notifications;
}

// Environment

export const SUPPORTED_LANGUAGES = ["ru", "uk", "en", "be", "pt", "es", "kk"] as const;
export type Language = (typeof SUPPORTED_LANGUAGES)[number];

export type ServerTimeProvider = (forceSync?: boolean) => number | undefined | Promise<number | undefined>;

export interface Environment extends EventEmitter<ApiEvents> {
  serverTime(forceSync?: boolean): Promise<number | undefined>;
  readonly defaultLang: string;
  lang(): Promise<Language>;
  appId(): Promise<string>;
  platform(): Promise<string>;
  payload(): Promise<string | Record<string, string> | null>;
  isMobile(): Promise<boolean>;
  isDesktop(): Promise<boolean>;
  theme(): Promise<"light" | "dark">;
  readonly YG: boolean;
  readonly VK: boolean;
  // readonly MY: boolean;
  readonly STORE: "vk" | "yg";
}

// Game

export interface Game extends EventEmitter<ApiEvents> {
  ready(): Promise<boolean>;
  play(): void;
  stop(): void;
  onStop(cb: () => void): void;
  onPlay(cb: () => void): void;
}

// Ads

export interface Ads extends EventEmitter<AdsEvents> {
  showNative(): Promise<boolean>;
  showRewarded(): Promise<boolean>;
  showBanner(): Promise<boolean>;

  checkNative(): Promise<boolean>;
  checkRewarded(): Promise<boolean>;
  checkBanner(): Promise<boolean>;

  hideBanner(): Promise<boolean>;
}

export interface AdsEvents extends ApiEvents {
  "show:native": {};
  "hide:native": {};
  "show:rewarded": {};
  "hide:rewarded": {};
  "show:banner": {};
  "hide:banner": {};
}

// Auth

export interface Auth extends EventEmitter<ApiEvents> {
  check(): Promise<boolean>;
  start(): Promise<void>;
  signature?(): Promise<string | null>;
}

// Data

export interface Data extends EventEmitter<ApiEvents> {
  set(key: string, value: string, flush?: boolean): Promise<void>;
  get(keys?: string[]): Promise<Record<string, unknown>>;
  sync<T>(storage: DataStorage<T>, items: [keyof T, SyncDataStrategy, string?][]): Promise<void>;
}

export interface DataStorage<T> {
  get(): T;
  upd(state: Partial<T>): void;
}

export type SyncDataStrategy =
  | "MAX_INT"
  | "MIN_INT_WITHOUT_0"
  | "TRUE"
  | "ARR_MAX_INT"
  | "ARR_MIN_INT_WITHOUT_0"
  | "ARR_FIRST_MAX_INT"
  | "DAILY_BONUS";

// Player

export interface Player extends EventEmitter<ApiEvents> {
  id(): Promise<string>;
  name(): Promise<string>;
  avatar(size?: "large" | "medium" | "small"): Promise<string>;
}

// Purchases

export interface CatalogItem {
  id: string;
  title: string;
  price: string;
  description: string;
  currencyCode: string;
  currencyImage: string;
}

export interface Purchases extends EventEmitter<PurchasesEvents> {
  getCatalog(): Promise<CatalogItem[]>;
  setCatalog(catalog: CatalogItem[]): void;
  purchase(product: CatalogItem, payload?: string): Promise<boolean>;
  consume(token: string): Promise<boolean>;
  check(): void;
}

export interface PurchasesEvents extends ApiEvents {
  purchase: {id: string; token: string};
}

// Score

export interface Score extends EventEmitter<ApiEvents> {
  set(score: number, leaderboard: string): Promise<void>;
  get(leaderboard: string, options?: ScoreReadOptions): Promise<{score: number; rank: number}>;
  laeders(leaderboard: string, options?: LeaderboardOptions): Promise<LeaderboardData | void>;
  // profile(profile: { name: string; avatar: string }): Promise<void>;
}

export type ScoreReadOptions = {maxAgeMs?: number};

export type LeaderboardOptions = ScoreReadOptions & {
  quantityTop?: number;
  includeUser?: boolean;
  quantityAround?: number;
};

export type LeaderboardData = {userRank: number; entries: LeaderboardEntry[]};

export type LeaderboardEntry = {
  rank: number;
  avatar: string;
  name: string;
  score: number;
  authorized: boolean;
};

// Shortcut

export type ShortcutCheckResult =
  {status: "available" | "unavailable" | "unsupported" | "already_added"} | {status: "error"; error: unknown};

export type ShortcutShowResult = {status: "accepted" | "not_accepted"} | {status: "error"; error: unknown};

export interface Shortcut extends EventEmitter<ApiEvents> {
  checkResult(): Promise<ShortcutCheckResult>;
  showResult(): Promise<ShortcutShowResult>;
  check(): Promise<boolean>;
  show(): Promise<boolean>;
}

// Notifications

export interface Notifications extends EventEmitter<ApiEvents> {
  check(): Promise<boolean>;
  request(): Promise<boolean>;
  disable(): Promise<boolean>;
}

// Events

export interface ApiError {
  code: string;
  reason?: string;
}

export interface ApiEvents {
  error: ApiError;
}

// Отдельный HTTP-клиент игрового сервера, не зависящий от SDK платформы.
export type BackendProfile = {name?: string | null; avatarUrl?: string | null};
export type BackendProof = {launchParams: string} | {signature: string};
export type BackendEntry = {
  rank: number;
  score: number;
  extraData: string;
  achievedAt: string;
  player: {userId: string; name: string | null; avatarUrl: string | null};
};
export type BackendDescription = {
  name: string;
  title: Record<string, string>;
  default: boolean;
  sortOrder: "ASC" | "DESC";
  scoreFormat: {type: "numeric" | "time"; decimalOffset: number};
  scoreBounds: {min: number; max: number};
  scoreType?: "int32" | "int64";
};
export type BackendEntries = {
  entries: BackendEntry[];
  userRank: number | null;
  ranges: {startRank: number; size: number}[];
  leaderboard: BackendDescription;
  generatedAt: string;
};
export type BackendEntriesOptions = ScoreReadOptions & {
  quantityTop?: number;
  includeUser?: boolean;
  quantityAround?: number;
};
export interface GameBackend extends EventEmitter<ApiEvents> {
  authenticate(): Promise<boolean>;
  getFlags(): Promise<Record<string, string> | undefined>;
  getDescription(board: string): Promise<BackendDescription | undefined>;
  setScore(board: string, score: number, extraData?: string): Promise<boolean>;
  getPlayerEntry(board: string, options?: ScoreReadOptions): Promise<BackendEntry | null | undefined>;
  getEntries(board: string, options?: BackendEntriesOptions): Promise<BackendEntries | undefined>;
}
