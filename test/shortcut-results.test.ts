import assert from "node:assert/strict";
import {test} from "node:test";
import {VkShortcut} from "../src/shortcut/VkShortcut.ts";
import {YgShortcut} from "../src/shortcut/YgShortcut.ts";

const state = globalThis as unknown as {window: Record<string, unknown>};
state.window = state.window ?? {};

function vk(send: () => Promise<unknown>, supported = true) {
  state.window["fake-bridge"] = {send, supportsAsync: async () => supported};
  return new VkShortcut({fake: true});
}
function yg(shortcut: unknown) {
  state.window["fake-ysdk"] = {shortcut};
  return new YgShortcut({fake: true});
}

test("shortcut VK distinguishes availability, unsupported and already added", async () => {
  assert.deepEqual(await vk(async () => assert.fail("unsupported must not send"), false).checkResult(), {
    status: "unsupported",
  });
  for (const [supported, added, status] of [
    [true, false, "available"],
    [true, true, "already_added"],
    [false, false, "unsupported"],
  ] as const) {
    const api = vk(async () => ({is_feature_supported: supported, is_added_to_home_screen: added}));
    assert.deepEqual(await api.checkResult(), {status});
    assert.equal(await api.check(), status === "available");
  }
});

test("shortcut VK distinguishes declined prompts, SDK errors and malformed responses", async () => {
  for (const accepted of [true, false]) {
    const api = vk(async () => ({result: accepted}));
    assert.deepEqual(await api.showResult(), {status: accepted ? "accepted" : "not_accepted"});
    assert.equal(await api.show(), accepted);
  }
  const denial = {error_data: {error_reason: "User denied"}};
  assert.deepEqual(
    await vk(async () => {
      throw denial;
    }).showResult(),
    {status: "not_accepted"},
  );
  const error = new Error("connection failed");
  const api = vk(async () => {
    throw error;
  });
  assert.deepEqual(await api.checkResult(), {status: "error", error});
  assert.deepEqual(await api.showResult(), {status: "error", error});
  assert.equal(await api.show(), false);
  assert.equal((await vk(async () => ({})).checkResult()).status, "error");
  assert.equal((await vk(async () => ({})).showResult()).status, "error");
});

test("shortcut Yandex preserves unknown availability reason and rejected outcome", async () => {
  for (const available of [true, false]) {
    const api = yg({canShowPrompt: async () => ({canShow: available})});
    assert.deepEqual(await api.checkResult(), {status: available ? "available" : "unavailable"});
    assert.equal(await api.check(), available);
  }
  for (const outcome of ["accepted", "rejected"]) {
    const api = yg({showPrompt: async () => ({outcome})});
    assert.deepEqual(await api.showResult(), {status: outcome === "accepted" ? "accepted" : "not_accepted"});
    assert.equal(await api.show(), outcome === "accepted");
  }
});

test("shortcut Yandex reports original errors and rejects malformed SDK replies", async () => {
  const error = new Error("SDK failed");
  const api = yg({
    canShowPrompt: async () => {
      throw error;
    },
    showPrompt: async () => {
      throw error;
    },
  });
  assert.deepEqual(await api.checkResult(), {status: "error", error});
  assert.deepEqual(await api.showResult(), {status: "error", error});
  assert.equal(await api.check(), false);
  assert.equal(await api.show(), false);
  const malformed = yg({canShowPrompt: async () => ({}), showPrompt: async () => ({outcome: "unknown"})});
  assert.equal((await malformed.checkResult()).status, "error");
  assert.equal((await malformed.showResult()).status, "error");
  delete state.window["fake-ysdk"];
  assert.equal((await api.checkResult()).status, "error");
  assert.equal((await api.showResult()).status, "error");
});
