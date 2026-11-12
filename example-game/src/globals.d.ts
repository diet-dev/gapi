/**
 * Экземпляр GameApi создаётся в main.ts.
 * Объявление var делает его доступным как GAPI и window.GAPI.
 */
import type {GameApi} from "@dietdev/gapi/interfaces.ts";

declare global {
  var GAPI: GameApi;

  interface Window {
    /** Очистка сохранений fake SDK для текущего идентификатора игры. */
    clearApiStorage?: () => void;
    /** Очистка данных fake SDK, сохранённой партии и статистики в режиме разработки. */
    clearStorage?: () => void;
  }
}
