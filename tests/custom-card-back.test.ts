import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { prepareCardPhoto } from "../src/components/CustomCardBack";
import { backStyle } from "../src/games/deck";
import {
  defaultSkin, isCardPhoto, MAX_CARD_PHOTO_BYTES, pickedSkin, readCustomCardBack,
  saveCustomCardBack, SKINS, subscribeCustomCardBack,
} from "../src/skins";

const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5xkAAAAASUVORK5CYII=";
const key = (id: string) => `cp_card_back_v1:${id}`;

function storageFixture(t: TestContext) {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  const values = new Map<string, string>();
  let blocked = false;
  const win = Object.assign(new EventTarget(), {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => {
        if (blocked) throw new Error("QuotaExceededError");
        values.set(key, value);
      },
      removeItem: (key: string) => {
        if (blocked) throw new Error("SecurityError");
        values.delete(key);
      },
    },
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  t.after(() => {
    if (original) Object.defineProperty(globalThis, "window", original);
    else Reflect.deleteProperty(globalThis, "window");
  });
  return { values, win, block: () => { blocked = true; } };
}

test("photo whitelist rejects external URLs, SVG, CSS, bad base64 and oversized data", () => {
  assert.equal(isCardPhoto(png), true);
  assert.equal(isCardPhoto(`data:image/jpeg;base64,${btoa("\xff\xd8\xff\xe0")}`), true);
  assert.equal(isCardPhoto(`data:image/webp;base64,${btoa("RIFF1234WEBP")}`), true);
  for (const value of [undefined, {}, "https://example.com/photo.jpg", "javascript:alert(1)",
    "data:image/svg+xml;base64,PHN2Zy8+", "url(https://example.com/photo.jpg)",
    "data:image/png;base64,AAAA", png.replace("png", "jpeg"), `${png}\");color:red`,
    "data:image/jpeg;base64,/9j/!", "data:image/jpeg;base64,/9j/" + "A".repeat(MAX_CARD_PHOTO_BYTES),
  ]) assert.equal(isCardPhoto(value), false);
});

test("selection validates MIME and the 5 MB input cap before decoding", async () => {
  for (const type of ["image/gif", "image/svg+xml", "text/plain", ""]) {
    await assert.rejects(prepareCardPhoto({ type, size: 1 } as File), /JPEG, PNG or WebP/);
  }
  await assert.rejects(prepareCardPhoto({ type: "image/png", size: 5 * 1024 * 1024 + 1 } as File), /5 MB/);
});

test("photos are isolated per user and never modify catalog selections", (t) => {
  const { values } = storageFixture(t);
  const skins = Object.freeze({ cards: "back-ruby" });
  saveCustomCardBack("alice", png);
  assert.equal(readCustomCardBack("alice"), png);
  assert.equal(readCustomCardBack("bob"), undefined);
  assert.deepEqual([...values.keys()], [key("alice")]);
  assert.equal(pickedSkin(skins, "cards").id, "back-ruby");
  saveCustomCardBack("alice");
  assert.equal(readCustomCardBack("alice"), undefined);
  assert.equal(pickedSkin(skins, "cards").id, "back-ruby");
  values.set(key("alice"), "https://example.com/private.jpg");
  assert.equal(readCustomCardBack("alice"), undefined);
});

test("same-tab writes and cross-tab changes notify subscribers; unsubscribe cleans up", (t) => {
  const { win, values } = storageFixture(t);
  let calls = 0;
  const stop = subscribeCustomCardBack(() => { calls += 1; });
  t.after(stop);
  saveCustomCardBack("subscriber", png);
  assert.equal(calls, 1);
  values.delete(key("subscriber"));
  win.dispatchEvent(Object.assign(new Event("storage"), { key: key("subscriber") }));
  assert.equal(calls, 2);
  assert.equal(readCustomCardBack("subscriber"), undefined);
  win.dispatchEvent(Object.assign(new Event("storage"), { key: "other-setting" }));
  assert.equal(calls, 2);
  win.dispatchEvent(Object.assign(new Event("storage"), { key: null }));
  assert.equal(calls, 3);
  stop();
  saveCustomCardBack("subscriber", png);
  assert.equal(calls, 3);
});

test("invalid data and failed storage writes/removals preserve the previous photo", (t) => {
  const { block } = storageFixture(t);
  saveCustomCardBack("quota", png);
  assert.throws(() => saveCustomCardBack("quota", "data:text/html,bad"), /valid JPEG/);
  assert.equal(readCustomCardBack("quota"), png);
  block();
  assert.throws(() => saveCustomCardBack("quota", png), /previous back is unchanged/);
  assert.throws(() => saveCustomCardBack("quota"), /previous back is unchanged/);
  assert.equal(readCustomCardBack("quota"), png);
});

test("photo rendering wins over catalog styling and unsafe values fall back", () => {
  const skin = { ...defaultSkin("cards"), backCss: "linear-gradient(red, blue)" };
  const style = backStyle({ ...skin, customBack: png });
  assert.equal(style?.backgroundImage, `url("${png}")`);
  assert.equal(style?.backgroundSize, "cover");
  assert.equal(style?.backgroundPosition, "center");
  assert.deepEqual(backStyle({ ...skin, customBack: "https://example.com/image.jpg" }), backStyle(skin));
});

test("seasonal cards and tables are optional catalog purchases at ordinary prices", () => {
  assert.equal(new Set(SKINS.map(s => s.id)).size, SKINS.length);
  for (const season of ["spring", "diwali", "winter"]) {
    for (const kind of ["cards", "table"] as const) {
      const skin = SKINS.find(s => s.id === `${kind === "cards" ? "back" : "table"}-${season}`)!;
      assert.equal(skin.kind, kind);
      assert.ok(skin.price >= 50 && skin.price <= 120);
      assert.ok(kind === "cards" ? skin.backCss : skin.bg);
      assert.notEqual(defaultSkin(kind).id, skin.id);
    }
  }
});
