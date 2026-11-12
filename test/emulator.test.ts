import assert from "node:assert/strict";
import {describe, it} from "node:test";
import gapiPlatformEmulator from "../src/emulator/index.ts";

type FakeRes = {
  statusCode: number | undefined;
  headers: Record<string, string>;
  body: string | undefined;
  ended: boolean;
  nextCalled: boolean;
  setHeader(name: string, value: string): void;
  end(chunk?: string): void;
};

function makeRes(): FakeRes {
  const res: FakeRes = {
    statusCode: undefined,
    headers: {},
    body: undefined,
    ended: false,
    nextCalled: false,
    setHeader(name, value) {
      res.headers[name.toLowerCase()] = value;
    },
    end(chunk) {
      res.ended = true;
      res.body = chunk;
    },
  };
  return res;
}

type Middleware = (req: {url?: string}, res: FakeRes, next: () => void) => void;

// Обработчик ожидает завершения асинхронной обработки запроса перед проверкой ответа.
function plug(transformRequest?: (url: string) => Promise<{code: string} | null>) {
  const middlewares: Middleware[] = [];
  const plugin = gapiPlatformEmulator();
  const configureServer = plugin.configureServer as unknown as (server: unknown) => void;
  configureServer({
    middlewares: {use: (fn: unknown) => middlewares.push(fn as Middleware)},
    transformRequest,
    config: {logger: {error: (_message: string) => {}}},
  });
  assert.equal(middlewares.length, 1);
  return async (url: string): Promise<FakeRes> => {
    const res = makeRes();
    middlewares[0]({url}, res, () => (res.nextCalled = true));
    await new Promise(resolve => setImmediate(resolve));
    return res;
  };
}

describe("emulator-плагин", () => {
  it("dev-only плагин; без override — alias на модуль из пакета, с override — alias не добавляется", () => {
    const plugin = gapiPlatformEmulator();
    assert.equal(plugin.name, "gapi-platform-emulator");
    assert.equal(plugin.apply, "serve");
    const configHook = plugin.config as unknown as (config: unknown, env: unknown) => unknown;
    const env = {command: "serve", mode: "development"};

    const config = configHook({}, env) as {resolve: {alias: {find: string; replacement: string}[]}};
    assert.deepEqual(config.resolve.alias, [
      {find: "/platform/platform.js", replacement: "@dietdev/gapi/emulator/platform.js"},
    ]);

    const overridden = configHook(
      {resolve: {alias: [{find: "/platform/platform.js", replacement: "/own/platform.ts"}]}},
      env,
    );
    assert.equal(overridden, undefined);
  });

  it("страница / — эмулятор, конфиг до platform.js, скрипт в родителе", async () => {
    const handle = plug();
    for (const url of ["/", "/?x=1"]) {
      const res = await handle(url);
      assert.equal(res.nextCalled, false);
      assert.match(res.headers["content-type"] ?? "", /text\/html/);
      assert.match(res.body!, /<title>Platform Emulator<\/title>/);
      assert.match(res.body!, /<link rel="icon" type="image\/svg\+xml" href="data:image\/svg\+xml,/);
      const configAt = res.body!.indexOf('window["gapi-platform-config"] = {};');
      const scriptAt = res.body!.indexOf('<script type="module" src="/platform/platform.js">');
      assert.ok(configAt >= 0 && scriptAt > configAt, "конфиг должен идти перед platform.js");
    }
  });

  it("/game переписывается на /index.html и уходит дальше по цепочке", () => {
    const middlewares: Middleware[] = [];
    const plugin = gapiPlatformEmulator();
    const configureServer = plugin.configureServer as unknown as (server: unknown) => void;
    configureServer({middlewares: {use: (fn: unknown) => middlewares.push(fn as Middleware)}});
    const res = makeRes();
    const req = {url: "/game?yandex"};
    middlewares[0](req, res, () => (res.nextCalled = true));
    assert.equal(req.url, "/index.html?yandex");
    assert.equal(res.nextCalled, true);
    assert.equal(res.ended, false);
  });

  it("/index.html даёт 302 на /game с сохранением query", () => {
    const middlewares: Middleware[] = [];
    const plugin = gapiPlatformEmulator();
    const configureServer = plugin.configureServer as unknown as (server: unknown) => void;
    configureServer({middlewares: {use: (fn: unknown) => middlewares.push(fn as Middleware)}});
    const res = makeRes();
    middlewares[0]({url: "/index.html?yandex"}, res, () => (res.nextCalled = true));
    assert.equal(res.statusCode, 302);
    assert.equal(res.headers.location, "/game?yandex");
    assert.equal(res.nextCalled, false);
  });

  it("опции плагина попадают в title и в инжект конфига с экранированием", async () => {
    const middlewares: Middleware[] = [];
    const plugin = gapiPlatformEmulator({
      name: "Моя игра </script>",
      vk: {width: 500},
    });
    const configureServer = plugin.configureServer as unknown as (server: unknown) => void;
    configureServer({middlewares: {use: (fn: unknown) => middlewares.push(fn as Middleware)}});
    const res = makeRes();
    middlewares[0]({url: "/"}, res, () => (res.nextCalled = true));

    assert.match(res.body!, /<title>Platform Emulator — Моя игра &lt;\/script&gt;<\/title>/);
    assert.ok(
      res.body!.includes('window["gapi-platform-config"] = {"name":"Моя игра \\u003c/script>","vk":{"width":500}};'),
    );
    assert.ok(!res.body!.includes("Моя игра </script>"), "сырой </script> в JSON недопустим");
  });

  it("скрипт площадки отдаётся через transformRequest", async () => {
    let requested: string | undefined;
    const handle = plug(async url => {
      requested = url;
      return {code: "console.info('transformed')"};
    });
    const res = await handle("/platform/platform.js");
    assert.equal(requested, "/platform/platform.js");
    assert.match(res.headers["content-type"] ?? "", /text\/javascript/);
    assert.equal(res.body, "console.info('transformed')");
  });

  it("пустой ответ transformRequest даёт 404, ошибка — 500", async () => {
    const handle = plug(async () => null);
    assert.equal((await handle("/platform/platform.js")).statusCode, 404);

    const failing = plug(async () => {
      throw new Error("boom");
    });
    assert.equal((await failing("/platform/platform.js")).statusCode, 500);
  });

  it("чужие URL передаются дальше по цепочке middleware", async () => {
    const handle = plug();
    const res = await handle("/game/some-asset.png");
    assert.equal(res.nextCalled, true);
    assert.equal(res.ended, false);
  });
});
