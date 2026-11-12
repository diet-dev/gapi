// Функции отделены от platform.ts, который обращается к DOM при импорте.

/**
 * Маркер площадки — имя yandex, vk или custom без значения, после ? или &,
 * перед & либо концом строки. Параметры вида yandex=1 остаются без изменений.
 * При отсутствии маркера добавляется ?имя, даже если в строке уже есть ?:
 * такой формат маркера используется эмулятором и зафиксирован тестами.
 */
export function switchPlatformSearch(search: string, platformId: string): string {
  const token = /([?&])(?:yandex|vk|custom)(?=&|$)/;
  const replaced = search.replace(token, `$1${platformId}`);
  if (replaced !== search) return replaced;
  return search ? `${search}?${platformId}` : `?${platformId}`;
}

export function vkGameSearch(search: string, device: "desktop" | "mobile"): string {
  const params = new URLSearchParams(search);
  const additions: string[] = [];
  if (!params.has("platform") && !params.has("vk_platform")) {
    additions.push(`platform=${device === "desktop" ? "web" : "html5_mobile"}`);
  }
  if (!params.has("language") && !params.has("vk_language")) additions.push("language=ru");
  if (!params.has("viewer_id") && !params.has("vk_user_id")) additions.push("viewer_id=1");
  return additions.length ? `${search}${search ? "&" : "?"}${additions.join("&")}` : search;
}
