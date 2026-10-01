// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { expect, test } from "vitest";

const srcDir = fileURLToPath(new URL(".", import.meta.url));
const svelteFiles = readdirSync(srcDir, { recursive: true })
  .filter((file) => file.endsWith(".svelte"))
  .map((file) => join(srcDir, file));

function markup(file) {
  // Ignore the component's <style> block; only markup matters here.
  return readFileSync(file, "utf8").replace(/<style[\s\S]*?<\/style>/g, "");
}

test("finds the Svelte sources", () => {
  expect(svelteFiles.length).toBeGreaterThan(0);
});

test.each(svelteFiles)("%s has no static style attribute (blocked by the CSP)", (file) => {
  expect(markup(file)).not.toMatch(/\sstyle\s*=\s*["']/);
});

test.each(svelteFiles)("%s does not use {@html}", (file) => {
  expect(markup(file)).not.toContain("{@html");
});
