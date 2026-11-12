import assert from "node:assert/strict";
import {describe, it} from "node:test";
import {avatarDataUri} from "../src/fake/avatars.ts";

describe("avatarDataUri", () => {
  it("даёт SVG с фотографией WebP и запрошенным размером", () => {
    const uri = avatarDataUri("Евгений М.", 200);
    assert.match(uri, /^data:image\/svg\+xml,/);
    const svg = decodeURIComponent(uri);
    assert.match(svg, /width="200" height="200"/);
    const photo = /href="data:image\/webp;base64,([^"]+)"/.exec(svg);
    assert.ok(photo);
    const bytes = Buffer.from(photo[1], "base64");
    assert.equal(bytes.toString("ascii", 0, 4), "RIFF");
    assert.equal(bytes.toString("ascii", 8, 12), "WEBP");
  });

  it("один seed — одно лицо, разные seed — разные лица", () => {
    assert.equal(avatarDataUri("Евгений М.", 100), avatarDataUri("Евгений М.", 100));
    assert.notEqual(avatarDataUri("Евгений М.", 100), avatarDataUri("Ольга Ч.", 100));
  });
});

it("выбирает портреты только из заданной группы для всех размеров SDK", async () => {
  const {avatarPhotos} = await import("../src/fake/avatar-photos.ts");
  for (const gender of ["male", "female"] as const) {
    const allowed = avatarPhotos.filter(photo => photo.gender === gender).map(photo => photo.uri);
    for (let seed = 0; seed < 30; seed++) {
      for (const size of [100, 200, 400, 800]) {
        const svg = decodeURIComponent(avatarDataUri(String(seed), size, gender));
        assert.ok(allowed.some(uri => svg.includes(`href="${uri}"`)));
      }
    }
  }
});

it("рейтинг связывает женское и мужское имя с соответствующей группой портретов", async () => {
  const {YgFakeLeaderboard} = await import("../src/fake/YgFakeLeaderboard.ts");
  const originalRandom = Math.random;
  try {
    for (const [index, name, gender] of [
      [0, "Владислав В.", "male"],
      [13, "Ольга Ч.", "female"],
    ] as const) {
      Math.random = () => (index + 0.5) / 22;
      const data = await new YgFakeLeaderboard("test").getEntries("score", {quantityTop: 1});
      const player = data.entries[0].player;
      assert.equal(player.publicName, name);
      assert.equal(player.getAvatarSrc("medium"), avatarDataUri(name, 200, gender, 0));
      assert.equal(
        player.getAvatarSrcSet("medium"),
        `${avatarDataUri(name, 200, gender, 0)} 1x, ${avatarDataUri(name, 400, gender, 0)} 2x`,
      );
    }
  } finally {
    Math.random = originalRandom;
  }
});

it("рейтинг проходит портреты каждой группы по кругу без преждевременных повторов", async () => {
  const {YgFakeLeaderboard} = await import("../src/fake/YgFakeLeaderboard.ts");
  const {avatarPhotos} = await import("../src/fake/avatar-photos.ts");
  const data = await new YgFakeLeaderboard("test").getEntries("score", {quantityTop: 20, quantityAround: 10});
  const seen = {male: new Set<string>(), female: new Set<string>()};
  const firstNames = data.entries.slice(0, 22).map(entry => entry.player.publicName);
  assert.equal(new Set(firstNames).size, 22);
  for (const entry of data.entries) {
    const uri = entry.player.getAvatarSrc("medium");
    const svg = decodeURIComponent(uri);
    const photo = avatarPhotos.find(photo => svg.includes(`href="${photo.uri}"`));
    assert.ok(photo);
    const group = photo.gender;
    const size = avatarPhotos.filter(photo => photo.gender === group).length;
    if (seen[group].size === size) seen[group].clear();
    assert.ok(!seen[group].has(uri), "портрет повторился до завершения круга");
    seen[group].add(uri);
    assert.equal(entry.player.getAvatarSrc("medium"), uri);
    assert.equal(entry.player.getAvatarSrcSet("medium"), `${uri} 1x, ${entry.player.getAvatarSrc("large")} 2x`);
  }
});

it("английская выдача использует имена латиницей и сохраняет пол портретов", async () => {
  const {YgFakeLeaderboard} = await import("../src/fake/YgFakeLeaderboard.ts");
  const originalRandom = Math.random;
  try {
    for (const [index, name, gender] of [
      [0, "Daniel W.", "male"],
      [13, "Olivia C.", "female"],
    ] as const) {
      Math.random = () => (index + 0.5) / 22;
      const data = await new YgFakeLeaderboard("test", "en").getEntries("score", {quantityTop: 20});
      assert.equal(data.entries[0].player.publicName, name);
      assert.equal(data.entries[0].player.getAvatarSrc("medium"), avatarDataUri(name, 200, gender, 0));
      for (const entry of data.entries) {
        assert.match(entry.player.publicName, /^[A-Za-z .]+$/);
        assert.equal(entry.player.lang, "en");
      }
    }
  } finally {
    Math.random = originalRandom;
  }
});

for (const [language, maleName, femaleName] of [
  ["es", "Daniel G.", "Olivia C."],
  ["tr", "Deniz Y.", "Ayşe K."],
  ["de", "Daniel W.", "Clara S."],
] as const) {
  it(`каталог ${language} использует локальные имена и соответствующие портреты`, async () => {
    const {YgFakeLeaderboard} = await import("../src/fake/YgFakeLeaderboard.ts");
    const originalRandom = Math.random;
    try {
      for (const [index, name, gender] of [
        [0, maleName, "male"],
        [13, femaleName, "female"],
      ] as const) {
        Math.random = () => (index + 0.5) / 22;
        const data = await new YgFakeLeaderboard("test", language).getEntries("score", {quantityTop: 20});
        const player = data.entries[0].player;
        assert.equal(player.publicName, name);
        assert.equal(player.getAvatarSrc("medium"), avatarDataUri(name, 200, gender, 0));
        assert.equal(new Set(data.entries.slice(0, 22).map(entry => entry.player.publicName)).size, 22);
        for (const entry of data.entries) {
          assert.equal(entry.player.lang, language);
          assert.doesNotMatch(entry.player.publicName, /[А-Яа-яЁё]/);
        }
      }
    } finally {
      Math.random = originalRandom;
    }
  });
}

it("встроенные портреты соответствуют контрольным суммам манифеста", async () => {
  const {readFile} = await import("node:fs/promises");
  const {createHash} = await import("node:crypto");
  const {avatarPhotos} = await import("../src/fake/avatar-photos.ts");
  const assets = new URL("../assets/fake-avatars/", import.meta.url);
  const manifest = JSON.parse(await readFile(new URL("manifest.json", assets), "utf8"));
  assert.equal(avatarPhotos.length, manifest.avatars.length);
  for (const [index, avatar] of manifest.avatars.entries()) {
    const bytes = Buffer.from(avatarPhotos[index].uri.split(",")[1], "base64");
    assert.equal(createHash("sha256").update(bytes).digest("hex"), avatar.sha256);
    assert.deepEqual(avatarPhotos[index], {
      gender: avatar.gender,
      uri: `data:image/webp;base64,${bytes.toString("base64")}`,
    });
  }
});
