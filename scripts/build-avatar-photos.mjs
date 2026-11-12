import {readFile, writeFile} from "node:fs/promises";
import {createHash} from "node:crypto";

const assets = new URL("../assets/fake-avatars/", import.meta.url);
const manifest = JSON.parse(await readFile(new URL("manifest.json", assets), "utf8"));
const files = new Set();
const lines = [
  "// Создано командой pnpm run avatars:build. Источники: assets/fake-avatars/.",
  "// Изображения встроены, чтобы не загружать их отдельными сетевыми запросами.",
  "// Происхождение изображений и промпты: assets/fake-avatars/README.md.",
  'export const avatarPhotos: readonly {gender: "male" | "female"; uri: string}[] = [',
];
for (const avatar of manifest.avatars) {
  if (!/^(man|woman)-[a-z-]+-256\.webp$/.test(avatar.file) || files.has(avatar.file)) {
    throw Error(`Invalid or duplicate filename: ${avatar.file}`);
  }
  files.add(avatar.file);
  if (!["male", "female"].includes(avatar.gender) || avatar.width !== 256 || avatar.height !== 256) {
    throw Error(`Invalid metadata: ${avatar.file}`);
  }
  const bytes = await readFile(new URL(avatar.file, assets));
  if (bytes.toString("ascii", 0, 4) !== "RIFF" || bytes.toString("ascii", 8, 12) !== "WEBP") {
    throw Error(`Not a WebP: ${avatar.file}`);
  }
  if (createHash("sha256").update(bytes).digest("hex") !== avatar.sha256) {
    throw Error(`SHA-256 mismatch: ${avatar.file}`);
  }
  lines.push(
    `  // ${avatar.file.replace(/\.webp$/, "")}`,
    "  {",
    `    gender: "${avatar.gender}",`,
    `    uri: "data:image/webp;base64,${bytes.toString("base64")}",`,
    "  },",
  );
}
if (!files.size) throw Error("Avatar manifest is empty");
lines.push("];", "");
await writeFile(new URL("../src/fake/avatar-photos.ts", import.meta.url), lines.join("\n"));
console.log(`Embedded ${files.size} avatars.`);
