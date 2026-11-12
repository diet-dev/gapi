import type * as ysdk from "ysdk";
import {storageKey, type FakePlatform} from "./storage-keys.ts";
import {avatarDataUri, type AvatarGender} from "./avatars.ts";

export type LeaderboardLanguage = "ru" | "en" | "es" | "tr" | "de";

type LocalLeaderboard = {storage: Pick<Storage, "getItem" | "setItem">; platform: FakePlatform};

export class YgFakeLeaderboard implements ysdk.YLeaderboards {
  private appId: string;
  private readonly language: LeaderboardLanguage;

  private readonly local?: LocalLeaderboard;

  constructor(appId: string, language: LeaderboardLanguage = "ru", local?: LocalLeaderboard) {
    this.local = local;
    this.appId = appId;
    this.language = language;
  }

  public getDescription(_leaderboardName: string): Promise<ysdk.LeaderboardDescription> {
    throw new Error("Method not implemented.");
  }

  public async getEntries(
    leaderboardName: string,
    opts?: ysdk.GetLeaderboardEntriesOpts,
  ): Promise<ysdk.LeaderboardEntriesData> {
    // В эмуляторе таблица доступна без проверки авторизации.
    let maxScore: number = 10000000;
    const localizedPlayers = players.map(player => ({
      ...player,
      name: this.language === "ru" ? player.name : player.names[this.language],
    }));
    const availablePlayers = [...localizedPlayers];
    const avatarIndexes = {male: 0, female: 0, any: 0};
    const nextPlayer = (): FakePlayer => {
      if (!availablePlayers.length) availablePlayers.push(...localizedPlayers);
      const [player] = availablePlayers.splice(random(0, availablePlayers.length - 1), 1);
      const group = player.gender ?? "any";
      return {...player, avatarIndex: avatarIndexes[group]++};
    };

    const result: ysdk.LeaderboardEntriesData = {
      entries: [
        ...Array.from({length: opts?.quantityTop || 5}).map((_, index) => {
          maxScore = maxScore - Math.floor(Math.random() * 10000);
          return fakeEntry(index + 1, maxScore, nextPlayer(), this.language);
        }),
        ...Array.from({length: (opts?.quantityAround || 10) * 2 + 1}).map((_, index) => {
          maxScore = maxScore - Math.floor(Math.random() * 1000000);
          return fakeEntry(index + 10000, Math.max(0, maxScore), nextPlayer(), this.language);
        }),
      ],
      leaderboard: {
        appID: "165633",
        default: true,
        title: {
          be: "Рэйтынг",
          en: "Rating",
          kk: "Рейтинг",
          ru: "Рейтинг",
          tr: "Değerlendirme",
          uk: "Рейтинг",
          uz: "Reyting",
        },
        description: {
          invert_sort_order: false,
          score_format: {
            options: {
              decimal_offset: 0,
            },
          },
          type: "numberic",
        },
        name: "",
      },
      ranges: [{start: 0, size: 10}],
      userRank: random(4, 10),
    };
    if (leaderboardName !== "score") {
      const value = this.storage().getItem(this.scoreKey(leaderboardName));
      const score = value === null ? 0 : Number(JSON.parse(value));
      result.entries =
        score > 0 ? [fakeEntry(1, score, {name: this.language === "ru" ? "Вы" : "You"}, this.language)] : [];
      result.userRank = score > 0 ? 1 : 0;
    }
    if (!opts?.includeUser) result.userRank = 0;
    result.leaderboard.name = leaderboardName;
    return result;
  }

  public async getPlayerEntry(leaderboardName: string): Promise<ysdk.LeaderboardEntry> {
    if (!this.checkAuth()) {
      throw {code: "NOT_AUTH"};
    }
    const score = this.storage().getItem(this.scoreKey(leaderboardName));
    return fakeEntry(1, score ? Number(JSON.parse(score)) || 0 : 0, {name: ""}, this.language);
  }

  public async setScore(leaderboardName: string, score: number, _extraData?: string): Promise<void> {
    this.storage().setItem(this.scoreKey(leaderboardName), JSON.stringify(score));
  }

  private storage(): Pick<Storage, "getItem" | "setItem"> {
    return this.local?.storage ?? localStorage;
  }

  private scoreKey(name: string): string {
    return storageKey(this.appId, this.local?.platform ?? "yg", `score-${name}`);
  }

  private checkAuth(): boolean {
    const fakeAuthTime = Number(localStorage.getItem(storageKey(this.appId, "yg", "auth-time"))) || 0;
    return fakeAuthTime > 0;
  }
}

type FakePlayer = {name: string; gender?: AvatarGender; avatarIndex?: number};

function fakeEntry(
  rank: number,
  score: number,
  player: FakePlayer,
  language: LeaderboardLanguage = "ru",
): ysdk.LeaderboardEntry {
  const {name, gender, avatarIndex} = player;
  // Для srcset используются изображения с плотностью пикселей 1× и 2×.
  const avatar = (pixels: number): string => avatarDataUri(name, pixels, gender, avatarIndex);
  return {
    extraData: "",
    formattedScore: "",
    player: {
      lang: language,
      publicName: name,
      scopePermissions: {
        avatar: "",
        public_name: "",
      },
      uniqueID: "",
      getAvatarSrc: (size: "large" | "medium" | "small"): string => {
        return avatar({small: 100, medium: 200, large: 400}[size]);
      },
      getAvatarSrcSet: (size: "large" | "medium" | "small"): string => {
        const pixels = {small: 100, medium: 200, large: 400}[size];
        return `${avatar(pixels)} 1x, ${avatar(pixels * 2)} 2x`;
      },
    },
    rank: rank,
    score: score,
  };
}

const players: readonly (FakePlayer & {names: Record<Exclude<LeaderboardLanguage, "ru">, string>})[] = [
  {
    name: "Владислав В.",
    names: {en: "Daniel W.", es: "Daniel G.", tr: "Deniz Y.", de: "Daniel W."},
    gender: "male",
  },
  {
    name: "Сергей Волков",
    names: {en: "Michael Brown", es: "Miguel García", tr: "Mehmet Yılmaz", de: "Michael Müller"},
    gender: "male",
  },
  {name: "Дмитрий", names: {en: "James", es: "Javier", tr: "Emre", de: "Jonas"}, gender: "male"},
  {
    name: "Валерий Орлов",
    names: {en: "David Miller", es: "David López", tr: "Mustafa Kaya", de: "David Schneider"},
    gender: "male",
  },
  {name: "Семён К.", names: {en: "Thomas K.", es: "Tomás R.", tr: "Ahmet K.", de: "Thomas K."}, gender: "male"},
  {
    name: "Евгений М.",
    names: {en: "Oliver M.", es: "Alejandro M.", tr: "Mert D.", de: "Oliver M."},
    gender: "male",
  },
  {
    name: "Андрей Коновалов",
    names: {en: "Andrew Wilson", es: "Andrés Martín", tr: "Burak Demir", de: "Andreas Fischer"},
    gender: "male",
  },
  {name: "Артур", names: {en: "Arthur", es: "Arturo", tr: "Arda", de: "Arthur"}, gender: "male"},
  {name: "Вадим Р.", names: {en: "William R.", es: "Pablo R.", tr: "Kerem A.", de: "Paul R."}, gender: "male"},
  {
    name: "Алексей Соколов",
    names: {en: "Alex Morgan", es: "Carlos Sánchez", tr: "Ali Şahin", de: "Alexander Weber"},
    gender: "male",
  },
  {name: "Анна", names: {en: "Anna", es: "Ana", tr: "Elif", de: "Anna"}, gender: "female"},
  {name: "Виктор Р.", names: {en: "Victor R.", es: "Víctor R.", tr: "Can Y.", de: "Viktor R."}, gender: "male"},
  {
    name: "Екатерина Морозова",
    names: {en: "Emily Parker", es: "Lucía Fernández", tr: "Zeynep Yıldız", de: "Emily Wagner"},
    gender: "female",
  },
  {name: "Ольга Ч.", names: {en: "Olivia C.", es: "Olivia C.", tr: "Ayşe K.", de: "Clara S."}, gender: "female"},
  {name: "Lana", names: {en: "Lana", es: "Elena", tr: "Ece", de: "Lena"}, gender: "female"},
  {
    name: "Маргарита Семёнова",
    names: {en: "Charlotte Evans", es: "Carmen Ruiz", tr: "Fatma Çelik", de: "Charlotte Becker"},
    gender: "female",
  },
  {
    name: "Наталья К.",
    names: {en: "Natalie K.", es: "Natalia K.", tr: "Selin A.", de: "Natalie K."},
    gender: "female",
  },
  {name: "Светлана", names: {en: "Sophie", es: "Sofía", tr: "İrem", de: "Sophie"}, gender: "female"},
  {
    name: "Мария Лебедева",
    names: {en: "Mary Bennett", es: "María López", tr: "Merve Demir", de: "Marie Hoffmann"},
    gender: "female",
  },
  {name: "Елена В.", names: {en: "Helen W.", es: "Isabel V.", tr: "Esra Y.", de: "Hannah W."}, gender: "female"},
  {name: "Sofia", names: {en: "Sofia", es: "Paula", tr: "Derya", de: "Sofia"}, gender: "female"},
  {
    name: "Ирина Павлова",
    names: {en: "Emma Taylor", es: "Laura Moreno", tr: "Aylin Şahin", de: "Emma Schulz"},
    gender: "female",
  },
];

function random(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
