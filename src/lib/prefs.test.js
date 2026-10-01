import { expect, it } from "vitest";
import { createPrefs, PREFS_KEY } from "./prefs.svelte.js";
import { createStorage } from "./storage.js";
import { memoryBackend } from "../test-utils.js";

it("shows real avatars by default", () => {
  expect(createPrefs({ storage: createStorage(memoryBackend()) }).realAvatars).toBe(true);
});

it("persists the avatar switch", () => {
  const backend = memoryBackend();
  const prefs = createPrefs({ storage: createStorage(backend) });
  prefs.realAvatars = false;
  expect(JSON.parse(backend.map.get(PREFS_KEY))).toEqual({ realAvatars: false });
  expect(createPrefs({ storage: createStorage(backend) }).realAvatars).toBe(false);
});

it("ignores malformed saved preferences", () => {
  const storage = createStorage(memoryBackend({ [PREFS_KEY]: '{"realAvatars":"no"}' }));
  expect(createPrefs({ storage }).realAvatars).toBe(true);
});
