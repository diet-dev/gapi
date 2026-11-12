import {defineConfig} from "vite";
import path from "node:path";
import gapiPlatformEmulator from "../src/emulator/index.ts";

export default defineConfig({
  plugins: [gapiPlatformEmulator({id: "tic-tac-toe", name: "Tic-Tac-Toe"})],
  resolve: {
    alias: [
      // Используем исходник скрипта эмулятора, чтобы изменения были видны без сборки библиотеки.
      {
        find: "/platform/platform.js",
        replacement: path.resolve(import.meta.dirname, "../src/emulator/platform.ts"),
      },
      {find: "@dietdev/gapi/vk", replacement: path.resolve(import.meta.dirname, "../src/vk.ts")},
      {find: "@dietdev/gapi/yandex", replacement: path.resolve(import.meta.dirname, "../src/yandex.ts")},
      {find: "@dietdev/gapi/fake/bridge", replacement: path.resolve(import.meta.dirname, "../src/fake-bridge.ts")},
      {find: "@dietdev/gapi/fake/ysdk", replacement: path.resolve(import.meta.dirname, "../src/fake-ysdk.ts")},
    ],
  },
  server: {
    fs: {
      // Разрешаем Vite читать исходники библиотеки вне каталога демоигры.
      allow: [import.meta.dirname, path.resolve(import.meta.dirname, "..", "src")],
    },
  },
});
