import {browserGlobals} from "./helpers/browser.ts";
import assert from "node:assert/strict";
import {test} from "node:test";
import {VkGameApi} from "../src/vk.ts";
import {GameApiClient, toLeaderboardData} from "../src/backend.ts";

const browser = browserGlobals(globalThis);

const session = (token = "test-token") => ({
  accessToken: token,
  expiresAt: new Date(Date.now() + 86400000).toISOString(),
});
const json = (body: unknown, status = 200, headers = {}) => new Response(JSON.stringify(body), {status, headers});
const client = (send: typeof fetch) =>
  new GameApiClient({
    url: "https://api.example/",
    projectId: "test-vk",
    fetch: send,
    getProof: () => ({launchParams: "vk_app_id=test-app-id&sign=a%2Bb"}),
  });

test("backend is lazy; public reads do not authenticate", async () => {
  const calls: string[] = [];
  const api = client(async (url, init) => {
    calls.push(String(url));
    assert.equal(new Headers(init?.headers).has("Authorization"), false);
    return json({name: "main"});
  });
  assert.deepEqual(calls, []);
  await api.getDescription("main");
  assert.deepEqual(calls, ["https://api.example/v1/projects/test-vk/leaderboards/main"]);
});

test("concurrent protected requests share login and preserve raw VK proof", async () => {
  let auths = 0,
    reads = 0;
  const api = client(async (url, init) => {
    assert.equal(init?.credentials, "omit");
    if (String(url).endsWith("/auth/token")) {
      auths++;
      assert.deepEqual(JSON.parse(String(init?.body)), {proof: {launchParams: "vk_app_id=test-app-id&sign=a%2Bb"}});
      await new Promise(resolve => setImmediate(resolve));
      return json(session());
    }
    reads++;
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
    assert.match(String(url), /includeUser=true/);
    return json({entries: [], userRank: null});
  });
  await Promise.all([api.getEntries("main", {includeUser: true}), api.getEntries("main", {includeUser: true})]);
  assert.equal(auths, 1);
  assert.equal(reads, 1);
});

test("invalid JWT is reauthenticated once, with failed retry reported as an event", async () => {
  let auths = 0,
    reads = 0;
  const errors: string[] = [];
  const api = client(async url => {
    if (String(url).endsWith("/auth/token")) return json(session(`token-${++auths}`));
    reads++;
    return json({error: {code: "TOKEN_INVALID"}}, 401);
  });
  api.on("error", e => errors.push(e.code));
  assert.equal(await api.getPlayerEntry("main"), undefined);
  assert.equal(auths, 2);
  assert.equal(reads, 2);
  assert.deepEqual(errors, ["TOKEN_INVALID"]);
});

test("a removed user is not recreated by retrying authentication", async () => {
  let auths = 0;
  const api = client(async url => {
    if (String(url).endsWith("/auth/token")) {
      auths++;
      return json(session());
    }
    return json({error: {code: "USER_UNAVAILABLE"}}, 401);
  });
  assert.equal(await api.getPlayerEntry("main"), undefined);
  assert.equal(auths, 1);
});

test("missing own score differs from a failed read and a zero score", async () => {
  const errors: string[] = [];
  const api = client(async url =>
    String(url).endsWith("/auth/token")
      ? json(session())
      : json({error: {code: "LEADERBOARD_PLAYER_NOT_PRESENT"}}, 404),
  );
  api.on("error", e => errors.push(e.code));
  assert.equal(await api.getPlayerEntry("main"), null);
  assert.deepEqual(errors, []);
});

test("report POST uses the shared session and returns the saved report id", async () => {
  let auths = 0;
  const payload = {reason: "SDK refusal"};
  const api = client(async (url, init) => {
    if (String(url).endsWith("/auth/token")) {
      auths++;
      return json(session());
    }
    assert.equal(String(url), "https://api.example/v1/projects/test-vk/reports");
    assert.equal(init?.method, "POST");
    assert.equal(new Headers(init.headers).get("Authorization"), "Bearer test-token");
    assert.deepEqual(JSON.parse(String(init.body)), {type: "vk_ad_error", payload});
    return json({reportId: "test-id"}, 201);
  });
  assert.equal(await api.authenticate(), true);
  assert.equal(await api.sendReport("vk_ad_error", payload), "test-id");
  assert.equal(auths, 1);
});

test("report failures are emitted once without a second POST", async () => {
  for (const code of ["RATE_LIMITED", "BACKEND_REQUEST_ERROR", "BACKEND_INVALID_RESPONSE"]) {
    let posts = 0;
    const api = client(async url => {
      if (String(url).endsWith("/auth/token")) return json(session());
      posts++;
      if (code === "RATE_LIMITED") return json({error: {code}}, 429, {"Retry-After": "1"});
      if (code === "BACKEND_REQUEST_ERROR") throw new Error("lost response");
      return json({}, 201);
    });
    const errors: string[] = [];
    api.on("error", e => errors.push(e.code));
    assert.equal(await api.sendReport("diagnostic", null), undefined);
    assert.equal(posts, 1);
    assert.deepEqual(errors, [code]);
  }
});

test("score uses PUT and Bearer; equal results remain successful", async () => {
  const api = client(async (url, init) => {
    if (String(url).endsWith("/auth/token")) return json(session());
    assert.equal(init?.method, "PUT");
    assert.deepEqual(JSON.parse(String(init?.body)), {score: 0});
    assert.equal(new Headers(init?.headers).get("Authorization"), "Bearer test-token");
    assert.match(String(url), /main\/me\/score$/);
    return json({updated: false});
  });
  assert.equal(await api.setScore("main", 0), true);
  assert.equal(await api.setScore("main", -1), false);
});

test("retry-after bounds a safe retry of a best-score write", async () => {
  let writes = 0;
  const api = client(async url => {
    if (String(url).endsWith("/auth/token")) return json(session());
    if (++writes === 1) return json({error: {code: "RATE_LIMITED"}}, 429, {"Retry-After": "1"});
    return json({updated: true});
  });
  assert.equal(await api.setScore("main", 100), true);
  assert.equal(writes, 2);
});

test("network errors and timeout are events rather than unhandled rejections", async () => {
  const errors: string[] = [];
  const api = new GameApiClient({
    url: "https://api.example",
    projectId: "test",
    getProof: () => ({launchParams: "proof"}),
    timeoutMs: 5,
    fetch: async (_url, init) =>
      new Promise((_resolve, reject) => init?.signal?.addEventListener("abort", () => reject(new Error("aborted")))),
  });
  api.on("error", e => errors.push(e.code));
  assert.equal(await api.getDescription("main"), undefined);
  assert.deepEqual(errors, ["BACKEND_REQUEST_ERROR"]);
});

test("leaderboard conversion preserves sparse ranks and handles missing profiles", () => {
  const result = toLeaderboardData({
    entries: [
      {
        rank: 1,
        score: 100,
        extraData: "",
        achievedAt: "",
        player: {userId: "a", name: "A", avatarUrl: "https://avatar.example/a"},
      },
      {rank: 100, score: 0, extraData: "", achievedAt: "", player: {userId: "b", name: null, avatarUrl: null}},
    ],
    userRank: 100,
    ranges: [],
    generatedAt: "",
    leaderboard: {} as never,
  });
  assert.equal(result.userRank, 100);
  assert.equal(result.entries[1].rank, 100);
  assert.equal(result.entries[1].score, 0);
  assert.equal(result.entries[1].name, "");
});

test("best-score retry handles Retry-After hidden by cross-origin CORS", async () => {
  let writes = 0;
  const api = client(async url => {
    if (String(url).endsWith("/auth/token")) return json(session());
    if (++writes === 1) return json({error: {code: "RATE_LIMITED"}}, 429);
    return json({updated: true});
  });
  assert.equal(await api.setScore("main", 42), true);
  assert.equal(writes, 2);
});

test("backend accepts exact safe integers above Int32 and rejects unsafe values", async () => {
  const writes: number[] = [];
  const api = client(async (url, init) => {
    if (String(url).endsWith("/auth/token")) return json(session());
    writes.push(JSON.parse(String(init?.body)).score);
    return json({updated: true});
  });
  assert.equal(await api.setScore("weekly", 95000001000), true);
  assert.equal(await api.setScore("weekly", Number.MAX_SAFE_INTEGER), true);
  for (const value of [Number.MAX_SAFE_INTEGER + 1, 1.5, -1, Infinity]) {
    assert.equal(await api.setScore("weekly", value), false);
  }
  assert.deepEqual(writes, [95000001000, Number.MAX_SAFE_INTEGER]);
});

test("backend flags are public, project scoped and do not request proof or profile", async () => {
  const requests: string[] = [];
  const api = new GameApiClient({
    url: "https://api.example/",
    projectId: "test-vk",
    getProof: () => {
      throw new Error("Proof must not be called");
    },
    getProfile: () => {
      throw new Error("Profile must not be called");
    },
    fetch: async (url, init) => {
      requests.push(String(url));
      assert.equal(new Headers(init?.headers).has("Authorization"), false);
      assert.equal(init?.cache, "no-store");
      return json({enabled: "false", count: "7"});
    },
  });
  assert.deepEqual(await api.getFlags(), {enabled: "false", count: "7"});
  assert.deepEqual(await api.getFlags(), {enabled: "false", count: "7"});
  assert.deepEqual(requests, Array(2).fill("https://api.example/v1/projects/test-vk/flags"));
});

for (const body of [null, [], {enabled: true}, {count: 2}, {nested: {}}]) {
  test(`backend rejects invalid flags: ${JSON.stringify(body)}`, async () => {
    const api = client(async () => json(body));
    const errors: string[] = [];
    api.on("error", error => errors.push(error.code));
    assert.equal(await api.getFlags(), undefined);
    assert.deepEqual(errors, ["BACKEND_INVALID_RESPONSE"]);
  });
}

for (const failure of [false, true]) {
  test(`backend flags integrate with conversion and one session cache (failure=${failure})`, async () => {
    browser.window = {"fake-bridge": {subscribe() {}}};
    let calls = 0;
    const backend = client(async () => {
      calls++;
      return failure ? json({error: {code: "PROJECT_NOT_FOUND"}}, 404) : json({count: "8", enabled: "false"});
    });
    const defaults = {count: 1, enabled: true, title: "normal"};
    const api = new VkGameApi({fake: false, flags: defaults, flagsSource: () => backend.getFlags()});
    const errors: string[] = [];
    api.flags.on("error", error => errors.push(error.code));
    await Promise.all([api.flags.ready(), api.flags.ready()]);
    await api.flags.ready();
    assert.equal(calls, 1);
    assert.deepEqual(api.flags.get(), failure ? defaults : {count: 8, enabled: false, title: "normal"});
    assert.deepEqual(errors, failure ? ["GET_FLAGS_ERROR"] : []);
  });
}
