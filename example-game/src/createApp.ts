import {createGame} from "./createGame.ts";
import {Button} from "./Button.ts";
import {GameStat} from "./GameStat.ts";
import {Leaderboard} from "./Leaderboard.ts";
import {Shop} from "./Shop.ts";
import {hintsInProduct} from "./catalog.ts";
import {addHints, hintsLeft, spendHint, statsStorage, syncStats} from "./stats.ts";

/** Отмена хода доступна после просмотра rewarded-рекламы. */
const VIDEO_AD_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      fill-rule="evenodd"
      d="M6 5h12a4 4 0 0 1 4 4v6a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V9a4 4 0 0 1 4-4zm3.5 2.5v9l7-4.5z"
    />
  </svg>`;

const HINT_ICON = `
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 2a7 7 0 0 0-4 12.74c.62.44 1 1.16 1 1.93V17h6v-.33c0-.77.38-1.49 1-1.93A7 7 0 0 0 12 2zm-3 17h6v1a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2z"
    />
  </svg>`;

const hintLabel = (hints: number): string => `Подсказка · ${hints}`;

export async function createApp() {
  const app = document.querySelector<HTMLDivElement>("#app")!;
  app.innerHTML = "";
  const statRow = document.createElement("div");
  statRow.style.cssText = "display:flex; align-items:center; justify-content:center; gap:10px;";
  app.appendChild(statRow);
  new Shop(statRow, {purchases: GAPI.purchases});
  const gameStat = new GameStat(statRow);
  new Leaderboard(statRow, {score: GAPI.score, active: GAPI.env.YG});
  const canvas = document.createElement("canvas");
  app.appendChild(canvas);

  const game = createGame(canvas, {
    data: GAPI.data,
    onStats: stats => gameStat.render(stats),
  });

  const actionsRow = document.createElement("div");
  actionsRow.style.cssText = "display:flex; align-items:center; justify-content:center; gap:12px;";
  app.appendChild(actionsRow);

  const undoButton = new Button(actionsRow, {
    label: "Отмена хода",
    icon: VIDEO_AD_ICON,
    disabled: true,
    onClick: async () => {
      if ((await GAPI.ads.showRewarded()) !== "cancelled") game.undo();
    },
  });
  new Button(actionsRow, {
    label: "Новая игра",
    onClick: () => {
      game.newGame();
      void GAPI.ads.showNative();
    },
  });
  const hintButton = new Button(actionsRow, {
    label: hintLabel(hintsLeft()),
    icon: HINT_ICON,
    disabled: true,
    onClick: () => {
      // Списываем подсказку только после успешного показа, чтобы повторный запрос не уменьшал остаток.
      if (!game.hint()) return;
      spendHint();
      void syncStats(GAPI.data);
    },
  });

  const syncUndo = () => undoButton.setDisabled(!game.canUndo());
  game.on("move", syncUndo);
  game.on("newGame", syncUndo);
  game.on("gameOver", syncUndo);
  game.on("undo", syncUndo);

  const syncHintButton = () => hintButton.setDisabled(!game.canHint() || hintsLeft() === 0);
  game.on("move", syncHintButton);
  game.on("newGame", syncHintButton);
  game.on("gameOver", syncHintButton);
  game.on("undo", syncHintButton);
  // Начальное состояние кнопки учитывает восстановленную партию.
  syncHintButton();
  // Подписка обновляет остаток подсказок и после синхронизации облачных данных.
  statsStorage.on("write", () => hintButton.setLabel(hintLabel(hintsLeft())));

  // Начисляем подсказки до подтверждения обработки покупки через consume.
  // Один обработчик обслуживает новые покупки и покупки, найденные методом check.
  GAPI.purchases.on("purchase", ({id, token}) => {
    addHints(hintsInProduct(id));
    void syncStats(GAPI.data);
    void GAPI.purchases.consume(token);
  });
  GAPI.purchases.check();

  await GAPI.game.ready();

  void GAPI.ads.showBanner();
}
