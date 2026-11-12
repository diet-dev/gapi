/**
 * Ключи сохранений содержат идентификатор игры и платформу: <id>__<платформа>__<ключ>.
 * Плагин передаёт id из своих параметров через window["gapi-app-id"], чтобы игры
 * с одинаковым origin не перезаписывали сохранения друг друга.
 */

import {logger} from "../log.ts";

const log = logger.child("fake");

export type FakePlatform = "yg" | "vk";

/** id по умолчанию, когда проект не передал свой. */
export const FALLBACK_APP_ID = "gapi-fake";

declare global {
  interface Window {
    "gapi-app-id"?: string;
    clearApiStorage?: () => void;
  }
}

export function storageKey(appId: string, platform: FakePlatform, key: string): string {
  return `${appId}__${platform}__${key}`;
}

export function resolveAppId(): string {
  return window["gapi-app-id"] ?? FALLBACK_APP_ID;
}

export function warnIfNoAppId(): void {
  if (!window["gapi-app-id"]) {
    log.warn(
      'window["gapi-app-id"] не задан: передайте id проекта в gapiPlatformEmulator({ id }) — ' +
        `ключи localStorage получат общий префикс "${FALLBACK_APP_ID}" и будут конфликтовать между проектами`,
    );
  }
}

export function clearAppStorage(storage: Storage, appId: string): void {
  const prefix = `${appId}__`;
  const doomed: string[] = [];
  for (let i = 0; i < storage.length; i++) {
    const key = storage.key(i);
    if (key?.startsWith(prefix)) doomed.push(key);
  }
  for (const key of doomed) {
    storage.removeItem(key);
  }
}

export function attachClearApiStorage(): void {
  // При одинаковых origin и идентификаторе игры оба окна очищают одни и те же сохранения.
  window.clearApiStorage = () => clearAppStorage(window.localStorage, resolveAppId());
}
