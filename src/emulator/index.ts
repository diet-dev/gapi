/**
 * В режиме разработки отдаёт страницу эмулятора по адресу / и игру в iframe по /game.
 * Скрипт страницы обрабатывается Vite, чтобы потребитель мог заменить его через alias.
 * Собственные структурные типы позволяют использовать плагин без привязки
 * к конкретной версии типов Vite в проекте игры.
 */

import type {Props} from "./platform.ts";

export type {Props};

type ConfigPatch = {
  resolve?: {alias?: {find: string; replacement: string}[]};
};

type UserConfigLike = {
  resolve?: {alias?: {find: string; replacement: string}[] | Record<string, string>};
};

type ConfigResult = ConfigPatch | undefined | void;

type DevServerLike = {
  middlewares: {
    use: (fn: (req: {url?: string}, res: ServerResponseLike, next: () => void) => void) => void;
  };
  transformRequest: (url: string) => Promise<{code: string} | null>;
  config: {logger: {error: (message: string) => void}};
};

type ServerResponseLike = {
  statusCode?: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: string) => void;
};

type VitePluginLike = {
  name: string;
  apply?: "serve" | "build";
  config?: (config: UserConfigLike, env: unknown) => ConfigResult;
  configureServer?: (server: DevServerLike) => void;
  transformIndexHtml?: (html: string) => string;
};

/** URL страницы-обёртки: эмулятор — то, что разработчик видит, открыв dev-сервер. */
const PAGE_PATH = "/";
/** URL игры без обёртки; содержимое /index.html обрабатывается Vite. */
const GAME_PATH = "/game";
/** URL скрипта площадки, подключаемого в родителе. */
const SCRIPT_PATH = "/platform/platform.js";
/** По умолчанию загружается скрипт из собранного пакета. */
const DEFAULT_SCRIPT_MODULE = "@dietdev/gapi/emulator/platform.js";
/** Конфигурация страницы эмулятора передаётся через window. */
const CONFIG_GLOBAL = "gapi-platform-config";
/** Идентификатор игры разделяет сохранения разных игр в localStorage. */
const APP_ID_GLOBAL = "gapi-app-id";

const escapeHtml = (text: string): string =>
  text.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

/** Экранирование < не позволяет строкам JSON закрыть HTML-элемент script. */
const serializeConfig = (props: object): string => JSON.stringify(props).replaceAll("<", "\\u003c");

const FAVICON_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">' +
  '<rect x="5" y="25" width="22" height="4.5" rx="2.25" fill="#868e96"/>' +
  '<rect x="14" y="13" width="4" height="13" rx="1.5" fill="#343a40"/>' +
  '<circle cx="16" cy="10" r="7" fill="#e03131"/>' +
  '<circle cx="13.5" cy="7.5" r="2" fill="#ffffff" opacity=".35"/>' +
  "</svg>";

const faviconHref = (svg: string): string => `data:image/svg+xml,${encodeURIComponent(svg)}`;

const pageHtml = (
  title: string,
  faviconLink: string,
  configScript: string,
  appIdScript: string,
): string => `<!doctype html>
<html lang="ru">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${title}</title>
    ${faviconLink}
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
      }
      iframe {
        display: block;
        width: 100%;
        height: 100%;
        border: 0;
      }
    </style>
    ${configScript}
    ${appIdScript}
    <script type="module" src="${SCRIPT_PATH}"></script>
  </head>
  <body>
  </body>
</html>
`;

/** Идентификатор игры передаётся в обе страницы для доступа к одним сохранениям. */
export default function gapiPlatformEmulator(props: Props = {}): VitePluginLike {
  const title = props.name ? `Platform Emulator — ${escapeHtml(props.name)}` : "Platform Emulator";
  const configScript = `<script>window["${CONFIG_GLOBAL}"] = ${serializeConfig(props)};</script>`;
  const appIdScript = props.id
    ? `<script>window["${APP_ID_GLOBAL}"] = ${JSON.stringify(props.id).replaceAll("<", "\\u003c")};</script>`
    : "";
  const faviconLink = `<link rel="icon" type="image/svg+xml" href="${faviconHref(FAVICON_SVG)}" />`;
  const html = pageHtml(title, faviconLink, configScript, appIdScript);

  return {
    name: "gapi-platform-emulator",
    apply: "serve",
    transformIndexHtml(indexHtml) {
      if (!appIdScript) return indexHtml;
      return indexHtml.replace("<head>", `<head>\n    ${appIdScript}`);
    },
    config(userConfig): ConfigResult {
      // Сохраняем пользовательский alias: добавленный плагином мог бы получить приоритет.
      const alias = userConfig.resolve?.alias ?? [];
      const entries = Array.isArray(alias)
        ? alias
        : Object.entries(alias).map(([find, replacement]) => ({find, replacement}));
      const overridden = entries.some(entry => entry.find === SCRIPT_PATH);
      if (overridden) return;

      return {
        resolve: {
          alias: [{find: SCRIPT_PATH, replacement: DEFAULT_SCRIPT_MODULE}],
        },
      };
    },
    configureServer(server: DevServerLike) {
      server.middlewares.use((req, res, next) => {
        const rawUrl = req.url ?? "";
        const path = rawUrl.split("?")[0];
        if (path !== PAGE_PATH && path !== GAME_PATH && path !== "/index.html" && path !== SCRIPT_PATH) {
          next();
          return;
        }
        if (path === SCRIPT_PATH) {
          // Обработка через Vite сохраняет пользовательский alias и преобразования модуля.
          server.transformRequest(SCRIPT_PATH).then(
            result => {
              if (!result) {
                res.statusCode = 404;
                res.end();
                return;
              }
              res.setHeader("Content-Type", "text/javascript");
              res.end(result.code);
            },
            error => {
              server.config.logger.error(`[gapi-platform-emulator] не удалось отдать ${SCRIPT_PATH}: ${error}`);
              res.statusCode = 500;
              res.end();
            },
          );
          return;
        }
        if (path === "/index.html") {
          // Перенаправляем на /game, чтобы у страницы игры был один адрес.
          res.statusCode = 302;
          res.setHeader("Location", `${GAME_PATH}${rawUrl.slice("/index.html".length)}`);
          res.end();
          return;
        }
        if (path === GAME_PATH) {
          // Передаём HTML в Vite, сохраняя горячую перезагрузку и обработку transformIndexHtml.
          req.url = `/index.html${rawUrl.slice(GAME_PATH.length)}`;
          next();
          return;
        }
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(html);
      });
    },
  };
}
