# @dietdev/gapi

TypeScript-обёртка над VK Bridge и Yandex Games SDK для браузерных игр. Она даёт одинаковые методы для рекламы, профиля игрока, облачных сохранений, покупок и других возможностей площадок.

Игра выбирает одну из двух реализаций — `VkGameApi` или `YandexGameApi`. Дальше работает с её модулями: `api.ads`, `api.data`, `api.player` и т. д. Различия площадок остаются там, где общего поведения нет: например, VK-модуль рейтингов открывает диалог площадки, а модуль Яндекса возвращает записи таблицы.

Для локальной разработки есть заглушки SDK, Vite-плагин эмулятора и демонстрационная игра «Крестики-нолики».

## Установка

```sh
pnpm add @dietdev/gapi
```

Пакет использует ES-модули и рассчитан на выполнение в браузере. Подключайте нужную точку входа; импорта из корня `@dietdev/gapi` нет.

| Импорт                      | Назначение                                     |
| --------------------------- | ---------------------------------------------- |
| `@dietdev/gapi/vk`          | `VkGameApi` — реализация для VK                |
| `@dietdev/gapi/yandex`      | `YandexGameApi` — реализация для Яндекс Игр    |
| `@dietdev/gapi/fake/bridge` | Инициализация заглушки VK Bridge               |
| `@dietdev/gapi/fake/ysdk`   | Инициализация заглушки Yandex Games SDK        |
| `@dietdev/gapi/fake/score`  | `FakeScore` — локальный рейтинг                |
| `@dietdev/gapi/emulator`    | Vite-плагин страницы эмулятора                 |
| `@dietdev/gapi/backend`     | `GameApiClient` — HTTP-клиент игрового сервера |
| `@dietdev/gapi/interfaces`  | Общие интерфейсы, типы и поддерживаемые языки  |

## Подключение площадки

### Яндекс Игры

```ts
import {YandexGameApi} from "@dietdev/gapi/yandex";

const api = new YandexGameApi({fake: false});

api.game.on("error", error => console.error("game:", error.code));

// Вызывайте после загрузки ресурсов и подготовки интерфейса игры.
if (await api.game.ready()) {
  console.log(await api.player.name());
  await api.game.play();
}
```

В обычном режиме обёртка загружает `/sdk.js` и вызывает `YaGames.init()`. Игра должна запускаться в окружении, где этот путь отдаёт SDK Яндекса. Для запуска на localhost используйте fake-режим, описанный ниже.

### VK

```ts
import {VkGameApi} from "@dietdev/gapi/vk";

const api = new VkGameApi({fake: false});

api.game.on("error", error => console.error("game:", error.code));

if (await api.game.ready()) {
  console.log(await api.player.name());
}
```

`game.ready()` отправляет `VKWebAppInit`. Идентификаторы приложения и игрока, язык и платформа читаются из параметров URL запуска.

Создавайте один экземпляр API на страницу. Выбор площадки остаётся за приложением: библиотека не определяет её автоматически. В следующих примерах `api` — уже созданный экземпляр одной из реализаций.

## Модули и различия площадок

| Модуль          | Для чего нужен                                                      | Особенности реализации                                                                                                        |
| --------------- | ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `game`          | Готовность, начало и остановка игрового процесса, подписки на паузу | В VK `play()` и `stop()` ничего не отправляют; подписки используют события скрытия и восстановления приложения                |
| `ads`           | Полноэкранная реклама, rewarded-реклама и баннер                    | `showNative()` означает interstitial-показ, а не рекламную карточку внутри интерфейса                                         |
| `auth`          | Проверка входа и авторизация                                        | В VK `check()` возвращает `true`, `start()` ничего не делает; в Яндексе используются методы SDK                               |
| `player`        | ID, имя и аватар                                                    | При недоступном профиле методы могут возвращать пустые строки                                                                 |
| `data`          | Облачные значения и синхронизация с локальным хранилищем            | `set()` принимает строки; `get()` возвращает объект со значениями типа `unknown`                                              |
| `purchases`     | Каталог, покупка и обработка незавершённых покупок                  | Каталог VK задаёт игра; в Яндексе он загружается через SDK                                                                    |
| `score`         | Запись результата, своя запись и рейтинг                            | В VK `set()` ничего не сохраняет, `get()` возвращает `{score: 0, rank: 0}`, `laeders()` открывает диалог без возврата записей |
| `shortcut`      | Проверка и предложение добавить ярлык                               | Есть булевы методы и методы с подробными статусами                                                                            |
| `notifications` | Согласие на уведомления                                             | В Яндексе все методы возвращают `false`; в VK вызываются методы Bridge                                                        |
| `env`           | Язык, тема, параметры запуска, устройство и время                   | Формат `payload()` и источник времени зависят от площадки                                                                     |
| `flags`         | Типизированная конфигурация игры                                    | Значения по умолчанию доступны сразу; удалённые значения загружаются один раз                                                 |

Эти ограничения относятся к текущей реализации библиотеки. Одинаковое имя метода не означает, что обе площадки поддерживают одинаковые операции.

Для кода, общего для обеих площадок, используйте интерфейс `GameApi`. Типы модулей и результатов доступны из той же точки входа:

```ts
import type {GameApi, Score, LeaderboardData, ShortcutCheckResult} from "@dietdev/gapi/interfaces";
```

Для методов конкретной площадки используйте тип `VkGameApi` или `YandexGameApi`.

## Ошибки

На ошибки подписываются у конкретного модуля. Общего события `api.on("error", ...)` нет.

```ts
api.ads.on("error", ({code, reason}) => {
  console.error("ads:", code, reason);
});

api.data.on("error", ({code}) => {
  console.error("data:", code);
});
```

Большинство операций при сбое отправляют `error` и возвращают `false`, пустые данные или `undefined`. Проверяйте результат метода. Например, ошибка записи через `data.set()` сообщается событием: его `Promise<void>` не подтверждает успешное сохранение.

При сбое запроса VK модуль может отправить два события: `SEND_ERROR` от базового адаптера и собственный код, например `SHOW_AD_ERROR`.

Обработка ошибок пока не полностью единообразна: исключение SDK из `auth.start()` или установки подписки `game.onStop()` / `game.onPlay()` может отклонить Promise. Обрабатывайте такие вызовы через `try/catch` на стороне игры.

## Жизненный цикл и реклама

`game.ready()` сообщает площадке о готовности игры. `game.play()` и `game.stop()` обозначают начало и остановку игрового процесса; сами игровой цикл и звук они не останавливают.

```ts
await api.game.onStop(() => {
  // Остановите игровой цикл и звук средствами своей игры.
});

await api.game.onPlay(() => {
  // Возобновите игровой цикл и звук средствами своей игры.
});
```

Показы рекламы возвращают `Promise<boolean>`. Награду выдавайте только после `true` от `showRewarded()`:

```ts
const rewarded = await api.ads.showRewarded();
if (rewarded) {
  // Выдайте награду средствами своей игры.
}

await api.ads.showNative();
await api.ads.showBanner();
await api.ads.hideBanner();
```

Для реакции на показ есть события `show:native`, `hide:native`, `show:rewarded`, `hide:rewarded`, `show:banner`, `hide:banner`. Они передаются от обёртки; обработку паузы, звука и интерфейса выполняет игра. У VK событие начала полноэкранного показа отправляется перед запросом к Bridge.

`checkNative()`, `checkRewarded()` и `checkBanner()` доступны на обеих реализациях, но не гарантируют будущий показ. В Яндексе первые два метода сейчас всегда возвращают `true`, а `checkBanner()` проверяет, отображается ли баннер.

## Авторизация и профиль

```ts
const authorized = await api.auth.check();
if (!authorized) {
  await api.auth.start();
}

console.log(await api.player.id());
console.log(await api.player.name());
console.log(await api.player.avatar("medium"));
```

`avatar()` принимает `"small"`, `"medium"` или `"large"`; по умолчанию используется `"small"`. Для Яндекса после диалога входа обёртка обновляет кеш игрока. В VK отдельного диалога входа эта реализация не открывает.

У `YandexGameApi` также есть `auth.signature(): Promise<string | null>` — непрозрачная подпись профиля для проверки на своём сервере. Её наличие не означает, что игрок авторизован: подпись может быть доступна гостю. Метод не проверяет подпись и не открывает диалог входа. Fake SDK не выдаёт действительную подпись для сервера.

## Облачные сохранения

```ts
await api.data.set("level", "3", true);

const saved = await api.data.get(["level"]);
if (typeof saved.level === "string") {
  const level = Number(saved.level);
  if (Number.isFinite(level)) console.log("Сохранённый уровень:", level);
}
```

Сериализацию объектов выполняет игра: передавайте в `set()` результат `JSON.stringify()` и проверяйте данные после чтения. Третий аргумент `flush` используется Яндексом для немедленной отправки изменений; VK его не использует. Яндекс-модуль сейчас читает все данные игрока независимо от массива ключей в `get()`.

### Синхронизация локальных и облачных значений

`data.sync()` принимает локальное хранилище с методами `get()` и `upd(patch)`. Привязки к конкретной библиотеке хранения нет:

```ts
let progress = {level: 1, unlocked: false, bestTimes: [0, 0, 0]};

const storage = {
  get: () => progress,
  upd: (patch: Partial<typeof progress>) => {
    progress = {...progress, ...patch};
  },
};

await api.data.sync(storage, [
  ["level", "MAX_INT"],
  ["unlocked", "TRUE"],
  ["bestTimes", "ARR_MIN_INT_WITHOUT_0", "best-times"],
]);
```

Каждая строка задаёт локальный ключ, стратегию и необязательное имя ключа в облаке. В примере `bestTimes` хранится в облаке под именем `best-times`. Если облачного значения нет, туда записывается локальное. Облачные строки разбираются как JSON.

| Стратегия               | Правило                                                                                                                           |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| `MAX_INT`               | Выбирается большее число                                                                                                          |
| `MIN_INT_WITHOUT_0`     | Выбирается меньшее число, только если оба значения положительные; при нуле синхронизация этой пары не выполняется                 |
| `TRUE`                  | Если одна из двух булевых копий равна `true`, сохраняется `true`                                                                  |
| `ARR_MAX_INT`           | Поэлементный максимум; отсутствующий элемент считается нулём                                                                      |
| `ARR_MIN_INT_WITHOUT_0` | Поэлементный минимум без нулей: ненулевое значение имеет приоритет над нулём                                                      |
| `ARR_FIRST_MAX_INT`     | Целиком выбирается массив с большим первым элементом; при равенстве первых элементов записи остаются без изменений                |
| `DAILY_BONUS`           | Локальный массив записывается в облако, если его первый или последний элемент больше облачного; иначе принимается облачный массив |

Синхронизация одноразовая: повторный вызов и сохранение локального состояния на диск организует игра. Для числовых стратегий передавайте числа, для массивных — массивы чисел. Метод не разрешает произвольные конфликты объектов.

## Флаги конфигурации

```ts
import {YandexGameApi} from "@dietdev/gapi/yandex";

const api = new YandexGameApi({
  fake: false,
  flags: {hintsEnabled: true, difficulty: "normal", bonus: 3},
});

api.flags.on("error", ({code}) => console.error(code));

const loaded = await api.flags.ready();
const {hintsEnabled, difficulty, bonus} = api.flags.get();
```

Ключи и типы выводятся из значений по умолчанию. Допустимы `boolean`, `number` и `string`. Неизвестный ключ, объект или массив в конфигурации вызывает ошибку TypeScript. Результат `get()` доступен только для чтения на уровне типов.

До завершения загрузки `get()` возвращает значения по умолчанию. `ready()` возвращает `true` при успешной загрузке или отсутствии удалённого источника; при ошибке или таймауте в 2 секунды возвращает `false`, сохраняет значения по умолчанию и отправляет `GET_FLAGS_ERROR`. Повторных запросов нет; для чтения актуального объекта снова вызывайте `get()`.

Источники значений:

- **Яндекс, обычный режим** — `sdk.getFlags()`, если не передан `flagsSource`.
- **VK, обычный режим** — только переданные значения по умолчанию, если не передан `flagsSource`.
- **Обе площадки, fake-режим** — только значения по умолчанию; удалённый источник игнорируется.

`flagsSource` — функция `(defaults: Record<string, string>) => Promise<Record<string, string> | undefined>`. Она имеет приоритет над SDK и получает значения по умолчанию в строковом виде. Например, можно передать `flagsSource: () => backend.getFlags()`, где `backend` — `GameApiClient`, описанный ниже.

Из удалённых строк булевы значения принимают `"true"`, `"false"`, `"1"`, `"0"`, числа — непустую строку с конечным числом. Отсутствующие и некорректные значения заменяются соответствующими значениями по умолчанию; неизвестные ключи игнорируются.

## Рейтинги

Для Яндекса доступны запись результата, собственная запись и выборка таблицы:

```ts
await api.score.set(1200, "score");
const own = await api.score.get("score");
const table = await api.score.laeders("score", {
  quantityTop: 10,
  includeUser: true,
  quantityAround: 3,
});

if (table) {
  console.log(table.userRank);
  console.table(table.entries);
}
```

Метод называется **`laeders`**, с этой опечаткой в публичном API. Метода `leaders` нет.

`get()` возвращает `{score, rank}`: отсутствие записи в Яндексе даёт `{score: 0, rank: 0}`, ошибка чтения — `{score: -1, rank: -1}` и событие `GET_SCORE_ERROR`. `laeders()` при ошибке возвращает `undefined`. Яндекс-модуль записывает только результат, который больше существующего, и последовательно отправляет записи с интервалом не менее 1100 мс для всех таблиц экземпляра.

`get()` и `laeders()` поддерживают `maxAgeMs` в миллисекундах. По умолчанию это `0` — запрос свежих данных. Одновременные одинаковые чтения объединяются; ошибки не кешируются, успешная запись сбрасывает кеш соответствующей таблицы. `maxAgeMs` не передаётся площадке.

В VK эта реализация не читает и не записывает очки. Для локальной разработки можно подставить `FakeScore` через параметр `score` конструктора; для серверного рейтинга нужен собственный адаптер или отдельное использование `GameApiClient`.

## Покупки

Подпишитесь на `purchase` **до** вызова `purchase()` или `check()`. Данные покупки приходят через событие, а не через возвращаемый результат метода:

```ts
api.purchases.on("purchase", ({id, token}) => {
  void fulfillPurchase(id, token).catch(console.error);
});

async function fulfillPurchase(id: string, token: string) {
  await grantPurchaseOnce(id, token);
  const consumed = await api.purchases.consume(token);
  if (!consumed) console.error("Покупка пока не отмечена обработанной:", token);
}

await api.purchases.check();
const catalog = await api.purchases.getCatalog();
if (catalog[0]) await api.purchases.purchase(catalog[0]);
```

`grantPurchaseOnce` в примере — функция вашей игры: она выдаёт товар, сохраняет результат и предотвращает повторную выдачу по тому же токену. `check()` может снова сообщить о покупке, которая ещё не обработана. Сначала выдавайте товар, затем вызывайте `consume()`; обработчики событий библиотека не ожидает.

Для VK задайте каталог через `setCatalog()` до чтения `getCatalog()`. Товар содержит `id`, `title`, `description`, `price`, `currencyCode`, `currencyImage`; при покупке в Bridge передаётся его `id`. В этой реализации VK `consume()` возвращает `true` без запроса, а `check()` ничего не делает.

В обычном режиме Яндекса `setCatalog()` не подменяет каталог SDK. Параметр `payload` метода `purchase(product, payload?)` в обеих реализациях сейчас не используется.

## Окружение, ярлык и уведомления

Используйте `env.STORE` (`"vk"` или `"yg"`), чтобы различить реализации; `env.platform()` возвращает значение площадки, формат которого не унифицирован. Для проверки устройства есть `isMobile()` и `isDesktop()`.

- `env.lang()` возвращает `ru`, `uk`, `en`, `be`, `pt`, `es` или `kk`. Для неподдержанного языка используется `ru`.
- `env.theme()` возвращает `"light"` или `"dark"`: в VK тема читается через Bridge, в Яндексе — через `matchMedia` браузера.
- `env.appId()` возвращает ID приложения, `env.payload()` — исходные параметры URL в VK или payload SDK в Яндексе.
- `env.serverTime()` возвращает время в миллисекундах Unix. В Яндексе это время SDK; при сбое возвращается `undefined` и отправляется `GET_SERVER_TIME_ERROR`. В VK по умолчанию используются часы устройства на основе Performance API — доверенным серверным временем они не являются. Собственный источник можно передать в `new VkGameApi({fake: false, serverTime})`.

Для ярлыка есть простая проверка и подробные результаты:

```ts
const availability = await api.shortcut.checkResult();
if (availability.status === "available") {
  const result = await api.shortcut.showResult();
  console.log(result.status);
}
```

`checkResult()` различает `available`, `unavailable`, `unsupported`, `already_added`, `error`. `showResult()` возвращает `accepted`, `not_accepted` или `error`; в последнем случае исходная ошибка находится в поле `error`. Булевы `check()` и `show()` возвращают `true` только для `available` и `accepted` соответственно.

`notifications.check()` проверяет поддержку операций согласия, а не наличие согласия игрока. Для запроса и отзыва используются `request()` и `disable()`; в Яндексе все три метода возвращают `false`.

## Локальная разработка

### Страница эмулятора в Vite

```ts
// vite.config.ts
import {defineConfig} from "vite";
import gapiPlatformEmulator from "@dietdev/gapi/emulator";

export default defineConfig({
  plugins: [gapiPlatformEmulator({id: "my-game", name: "Моя игра"})],
});
```

Плагин работает только с dev-сервером: `/` открывает страницу площадки с игрой в iframe, `/game` — игру без обёртки. Площадка выбирается через меню или URL `/?vk` и `/?yandex`.

Плагин не инициализирует fake SDK за игру. В точке входа сначала вызовите `init()` соответствующей заглушки, затем создайте API с `fake: true`. Пример для приложения на Vite:

```ts
import {VkGameApi} from "@dietdev/gapi/vk";
import {YandexGameApi} from "@dietdev/gapi/yandex";

const isYandex = /(?:[?&])yandex(?:&|$)/.test(location.search);
const fake = import.meta.env.DEV;

if (fake) {
  const sdk = isYandex ? await import("@dietdev/gapi/fake/ysdk") : await import("@dietdev/gapi/fake/bridge");
  sdk.init();
}

const api = isYandex ? new YandexGameApi({fake}) : new VkGameApi({fake});
await api.game.ready();
```

Это пример выбора по URL для эмулятора. В опубликованной игре выбирайте реализацию по настройкам своей сборки или окружения размещения.

Параметр `id` разделяет сохранения разных игр в `localStorage`. Для эмулятора и локального рейтинга используйте одинаковый `id`. Без Vite-плагина задайте `window["gapi-app-id"]` до инициализации заглушки; без идентификатора используется общий префикс `gapi-fake`.

Fake SDK реализуют только часть методов и предназначены для проверки игрового сценария без площадки. Работа в fake-режиме не подтверждает доступность рекламы, платежей или других возможностей на настоящей площадке.

### Локальный рейтинг для VK

После инициализации fake Bridge:

```ts
import {VkGameApi} from "@dietdev/gapi/vk";
import {FakeScore} from "@dietdev/gapi/fake/score";

const api = new VkGameApi({
  fake: true,
  score: new FakeScore({appId: "my-game", platform: "vk", storage: localStorage}),
});

await api.score.set(1200, "weekly");
console.log(await api.score.laeders("weekly"));
```

`FakeScore` хранит максимальный результат отдельно для каждой игры, площадки и таблицы. Таблица `score` содержит демонстрационных игроков; другие таблицы показывают только сохранённую запись текущего игрока. Портреты встроены в пакет и не требуют загрузки с внешнего сервера. [Исходники портретов, происхождение и обновление набора](assets/fake-avatars/README.md).

## Клиент игрового сервера

`GameApiClient` — отдельный HTTP-клиент с фиксированным протоколом. Серверная реализация в пакет не входит. Клиент не подключается к `api.score` автоматически.

```ts
import {GameApiClient, toLeaderboardData} from "@dietdev/gapi/backend";

const backend = new GameApiClient({
  url: "https://api.example.com",
  projectId: "my-game",
  getProof: () => ({launchParams: location.search.slice(1)}),
});

backend.on("error", ({code}) => console.error("backend:", code));

const saved = await backend.setScore("weekly", 1200);
const entries = await backend.getEntries("weekly", {quantityTop: 10, includeUser: true});
if (entries) console.table(toLeaderboardData(entries).entries);
```

Здесь `url` — адрес вашего сервера; `api.example.com` приведён как пример. Для VK `getProof` передаёт исходную строку параметров запуска без `?`, для Яндекса — `{signature}`, полученную через `auth.signature()`. Проверку доказательства выполняет сервер. Опциональный `getProfile` передаёт `{name, avatarUrl}` при авторизации.

Все маршруты начинаются с `/v1/projects/{projectId}`:

| Метод клиента                        | HTTP-запрос                          | Требует авторизации                                          |
| ------------------------------------ | ------------------------------------ | ------------------------------------------------------------ |
| `authenticate()`                     | `POST /auth/token`                   | Обменивает `{proof, profile?}` на `{accessToken, expiresAt}` |
| `getFlags()`                         | `GET /flags`                         | Нет                                                          |
| `getDescription(board)`              | `GET /leaderboards/{board}`          | Нет                                                          |
| `setScore(board, score, extraData?)` | `PUT /leaderboards/{board}/me/score` | Да                                                           |
| `getPlayerEntry(board, options?)`    | `GET /leaderboards/{board}/me`       | Да                                                           |
| `getEntries(board, options?)`        | `GET /leaderboards/{board}/entries`  | Если `includeUser: true`                                     |

`expiresAt` — строка даты, которую понимает `Date.parse`. Защищённые операции сами получают JWT; он хранится в памяти экземпляра. Публичные чтения не запускают авторизацию. `getFlags()` ожидает объект строк; типы остальных ответов экспортируются из `/backend` и описаны в [общих интерфейсах](src/interfaces.ts).

При ошибке клиент отправляет `error`: `setScore()` и `authenticate()` возвращают `false`, чтения — `undefined`. У `getPlayerEntry()` значение `null` означает отсутствие записи, а `undefined` — сбой чтения. Запись принимает неотрицательные безопасные целые числа JavaScript; пределы конкретной таблицы задаёт сервер.

Для чтений рейтингов поддерживается `maxAgeMs`, как в Яндекс-модуле. Можно передать собственный `fetch` и `timeoutMs` (по умолчанию 15 секунд).

## Разработка библиотеки

Для разработки используйте Node.js 24 и pnpm 9.15.1: тесты выполняются непосредственно из TypeScript-файлов средствами Node.js. Библиотека и демоигра входят в общий workspace.

```sh
pnpm install --frozen-lockfile
pnpm --filter example-game dev
```

[Демоигра](example-game/) использует исходники библиотеки напрямую. Для проверок и сборки:

```sh
pnpm lint
pnpm format:check
pnpm typecheck
pnpm test
pnpm build
pnpm --filter example-game build
```

`pnpm lint:fix` и `pnpm format` исправляют оформление. ESLint и Prettier настроены на основе Google TypeScript Style (`gts`). `pnpm prepublishOnly` запускает линтер, проверку форматирования, типов, тесты и сборку библиотеки.
