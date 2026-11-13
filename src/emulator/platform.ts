import type {FakeWindow} from "../fake/window.ts";
/**
 * Скрипт страницы эмулятора по адресу /; игра размещается в дочернем iframe.
 * Плагин передаёт конфигурацию через window["gapi-platform-config"].
 */

import "./platform.css";
import {switchPlatformSearch, vkGameSearch} from "./platform-url.ts";
import {clearAppStorage, resolveAppId} from "../fake/storage-keys.ts";
import {logger} from "../log.ts";

const log = logger.child("emulator");

export type Props = {
  /** Идентификатор игры для разделения сохранений в localStorage. */
  id?: string;
  name?: string;
  yandex?: {
    banner?: {
      portrait?: "bottom" | "top" | "off";
      landscape?: "right" | "bottom" | "top" | "off";
      desktop?: "on" | "off";
      api?: "on" | "off";
    };
  };
  vk?: {
    width?: number;
    height?: number;
    widescreen?: "on" | "off";
    controls?: "top" | "over";
  };
};

declare global {
  interface Window {
    "gapi-platform-config"?: Props;
    clearStorage?: () => void;
  }
}

export const init = (props: Props) => {
  const platformId: string = platform();
  const deviceType: "mobile" | "desktop" = "ontouchstart" in window ? "mobile" : "desktop";

  log.info(`площадка: ${platformId}, устройство: ${deviceType}`);
  if (props.name) log.info(`name: ${props.name}`);

  addClass(`${platformId}-${deviceType}`);

  window.clearApiStorage = () => clearAppStorage(window.localStorage, resolveAppId());

  const iframe = document.createElement("iframe");
  attr("frameborder", "0", iframe);
  attr("src", `/game${platformId === "vk" ? vkGameSearch(location.search, deviceType) : location.search}`, iframe);
  iframe.classList.add("iframe-1");
  append(iframe);

  window.clearStorage = () => iframe.contentWindow?.clearStorage?.();

  const header = div("header");
  append(div("title", props.name || "Название"), header);
  append(
    platformId === "screenshot"
      ? div("platform", `Платформа: ${PLATFORM_NAMES[platformId] ?? platformId}`)
      : platformSelect(platformId),
    header,
  );
  if (platformId === "yandex" && deviceType === "desktop") {
    append(fullscreenButton(), header);
  }
  append(header);

  if (platformId === "yandex" && deviceType === "mobile") {
    autoFullscreen(iframe);
  }

  const banner = div("banner");
  on("click", banner, () => alert("Переход по рекламе!"));
  append(banner);

  if (platformId === "vk" && deviceType === "desktop") {
    const w: number = props.vk?.width || 630;
    const h: number = props.vk?.height || 760;
    attr("style", [`--w: ${w}px`, `--h: ${h}px`].join("; "));
    append(vkDesktopShell());
    append(iframeSizeFooter(iframe), header);
  }

  (window as FakeWindow).showBanner = showProps => {
    if (platformId === "yandex") {
      if (deviceType === "desktop") {
        // В эмуляторе видимость бокового баннера ограничена медиазапросом в platform.css.
        if (!matchMedia("(min-width: 1241px)").matches) {
          log.info("стики-баннер скрыт: окно уже 1240px (так и на площадке)");
        }
        addClass("banner-right");
      } else {
        if (window.innerHeight > window.innerWidth) {
          addClass("banner-" + (props.yandex?.banner?.portrait || "bottom"));
        } else {
          addClass("banner-" + (props.yandex?.banner?.landscape || "right"));
        }
      }
    } else if (platformId === "vk" && deviceType !== "desktop") {
      addClass("banner-" + (showProps?.banner_location || "top"));
    }
  };

  (window as FakeWindow).hideBanner = () => {
    document.body.classList.forEach(name => {
      if (name.indexOf("banner") !== -1) {
        document.body.classList.remove(name);
      }
    });
  };
};

function vkDesktopShell(): HTMLElement {
  const shell = div("vk-shell");
  shell.setAttribute("aria-hidden", "true");
  const topbar = div("vk-topbar");
  const content = div("vk-topbar-content");
  for (const name of ["logo", "search", "notifications", "music", "profile"]) {
    append(div(`vk-placeholder vk-placeholder-${name}`), content);
  }
  append(content, topbar);
  append(topbar, shell);

  const sidebar = div("vk-sidebar");
  for (let index = 0; index < 19; index++) {
    if ([11, 13, 17].includes(index)) append(div("vk-sidebar-divider"), sidebar);
    const row = div("vk-sidebar-row");
    append(div("vk-placeholder vk-sidebar-icon"), row);
    append(div("vk-placeholder vk-sidebar-label"), row);
    append(row, sidebar);
  }
  append(sidebar, shell);
  return shell;
}

function iframeSizeFooter(iframe: HTMLIFrameElement): HTMLElement {
  const footer = document.createElement("footer");
  footer.className = "iframe-size";
  const update = () => {
    footer.textContent = `Размер iframe: ${iframe.clientWidth} × ${iframe.clientHeight} px`;
  };
  const observer = new ResizeObserver(update);
  observer.observe(iframe);
  update();
  return footer;
}

function platform(): "yandex" | "vk" | "custom" | "screenshot" {
  if (location.search.includes("screenshot")) return "screenshot";
  if (location.search.includes("?yandex")) return "yandex";
  if (location.search.includes("?custom")) return "custom";
  if (location.search.includes("?vk")) return "vk";
  return "yandex";
}

const PLATFORM_NAMES: Record<string, string> = {
  yandex: "YG",
  vk: "VK",
  custom: "Custom",
  screenshot: "Screenshot",
};

/** Режим custom выбирается через URL и не включён в меню. */
const DROPDOWN_PLATFORMS = ["yandex", "vk"];

// Меню добавляется в body, чтобы iframe не перекрывал его из-за порядка наложения элементов.
function platformSelect(current: string): HTMLElement {
  const root = div("platform", "Платформа:");
  const button = document.createElement("button");
  button.type = "button";
  addClass("platform-button", button);
  button.textContent = `${PLATFORM_NAMES[current] ?? current} ▾`;
  const menu = div("platform-menu");

  const close = () => menu.classList.remove("open");
  const open = () => {
    const rect = button.getBoundingClientRect();
    menu.style.left = `${rect.left}px`;
    menu.style.top = `${rect.bottom + 4}px`;
    menu.classList.add("open");
  };
  const toggle = () => (menu.classList.contains("open") ? close() : open());

  for (const id of DROPDOWN_PLATFORMS) {
    const item = div("platform-item", PLATFORM_NAMES[id]);
    if (id === current) addClass("active", item);
    on("click", item, () => {
      close();
      if (id !== current) {
        location.assign(location.pathname + switchPlatformSearch(location.search, id) + location.hash);
      }
    });
    append(item, menu);
  }

  on("click", button, toggle);
  document.addEventListener("click", event => {
    if (event.target instanceof Node && !menu.contains(event.target) && event.target !== button) close();
  });
  document.addEventListener("keydown", event => {
    if (event.key === "Escape") close();
  });

  append(button, root);
  append(menu);
  return root;
}

type FullscreenDoc = Document & {
  webkitFullscreenElement?: Element | null;
  webkitExitFullscreen?: () => Promise<void> | void;
};

type FullscreenEl = HTMLElement & {
  webkitRequestFullscreen?: () => Promise<void> | void;
};

const isFullscreen = (doc: FullscreenDoc): boolean => !!(doc.fullscreenElement || doc.webkitFullscreenElement);

function toggleFullscreen(): void {
  const doc = document as FullscreenDoc;
  if (isFullscreen(doc)) {
    const exit = doc.exitFullscreen || doc.webkitExitFullscreen;
    if (exit) Promise.resolve(exit.call(doc)).catch(() => {});
  } else {
    requestFullscreen();
  }
}

function requestFullscreen(): void {
  const el = document.documentElement as FullscreenEl;
  // Учитываем вариант API с префиксом WebKit; отказ в переходе не мешает работе эмулятора.
  const request = el.requestFullscreen || el.webkitRequestFullscreen;
  if (!request) return;
  Promise.resolve(request.call(el)).catch(() => {});
}

function fullscreenButton(): HTMLElement {
  const button = document.createElement("button");
  button.type = "button";
  addClass("fullscreen-button", button);
  const sync = () => {
    const active = isFullscreen(document as FullscreenDoc);
    button.classList.toggle("exit", active);
    button.title = active ? "Выйти из полноэкранного режима" : "Полноэкранный режим";
  };
  on("click", button, toggleFullscreen);
  document.addEventListener("fullscreenchange", sync);
  document.addEventListener("webkitfullscreenchange", sync);
  sync();
  return button;
}

function autoFullscreen(iframe: HTMLIFrameElement): void {
  const tryFullscreen = () => {
    if (!isFullscreen(document as FullscreenDoc)) requestFullscreen();
  };

  // Полноэкранный режим запрашивается по пользовательскому жесту — завершению касания.
  // Подписка сохраняется, чтобы после выхода можно было повторить запрос следующим касанием.
  window.addEventListener("pointerup", tryFullscreen);

  // События из iframe не всплывают в родительское окно, поэтому подписываемся на оба окна.
  iframe.addEventListener("load", () => {
    iframe.contentWindow?.addEventListener("pointerup", tryFullscreen);
  });
}

function div(className: string, html?: string): HTMLElement {
  const div = document.createElement("DIV");
  div.className = className;
  if (html) div.innerHTML = html;
  return div;
}

function append(element: HTMLElement, target: HTMLElement = document.body): void {
  target.appendChild(element);
}

function addClass(className: string, target: HTMLElement = document.body): void {
  target.classList.add(className);
}

function attr(name: string, value: string, target: HTMLElement = document.body): void {
  target.setAttribute(name, value);
}

function on(name: "click", target: HTMLElement = document.body, cb?: (event: MouseEvent) => void): void {
  if (cb) target.addEventListener(name, cb);
}

// Плагин размещает конфигурацию до загрузки скрипта; при её отсутствии используются значения по умолчанию.
init(window["gapi-platform-config"] ?? {});
