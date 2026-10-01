import { expect, it } from "vitest";
import { avatarFor, EYE_COLORS, HAIR_COLORS, HAIR_STYLES, SKINS } from "./avatar.js";

it("is deterministic and ignores case", () => {
  expect(avatarFor("Steve")).toEqual(avatarFor("Steve"));
  expect(avatarFor("Steve")).toEqual(avatarFor("steve"));
});

it("only uses the fixed palettes and hair styles", () => {
  const look = avatarFor("Kai_Builds");
  expect(SKINS.some(([skin, shade, mouth]) => skin === look.skin && shade === look.shade && mouth === look.mouth)).toBe(true);
  expect(HAIR_COLORS).toContain(look.hair);
  expect(EYE_COLORS).toContain(look.eye);
  expect(HAIR_STYLES).toContainEqual(look.hairRects);
});

it("gives different players visibly different heads", () => {
  const names = ["Steve", "Alex", "Notch_01", "Kai_Builds", "Griefer99", "Miner_42", "Luna", "Builder", "Redstone", "Creeper_Fan",
    "Ender", "Pixel", "Bao", "Xiao_Ming", "Rui", "Moss", "Cobble", "Lapis", "Quartz", "Amethyst"];
  const looks = new Set(names.map((name) => JSON.stringify(avatarFor(name))));
  expect(looks.size).toBeGreaterThanOrEqual(12);
});
