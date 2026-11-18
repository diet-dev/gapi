import {type ApiEvents, type Score} from "../interfaces.ts";
import {VkApi} from "../api/VkApi.ts";

type Props = {fake: boolean};

export class VkScore extends VkApi<ApiEvents> implements Score {
  constructor(props: Props) {
    super(props);
  }

  public async set(_score: number, _leaderboard: string): Promise<boolean> {
    // Сохранение результата в этой реализации не поддерживается.
    return false;
  }

  public async get(_leaderboard: string) {
    // Чтение результата не поддерживается; возвращается нейтральное значение.
    return {score: 0, rank: 0};
  }

  public async laeders(_leaderboard: string) {
    try {
      // Открывается диалог рейтинга приложения; параметр leaderboard не используется.
      await this.bridgeSend("VKWebAppShowLeaderBoardBox");
    } catch {
      this.emit("error", {code: "SHOW_LEADERBOARD_ERROR"});
    }
  }
}
