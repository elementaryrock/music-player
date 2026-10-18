import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const readSource = (relativePath) => readFile(resolve(root, relativePath), "utf8");

test("the app keeps discovery and stream resolution separate", async () => {
  const resolver = await readSource("src/services/trackResolver.ts");
  const metadata = await readSource("src/services/metadataDiscovery.ts");
  const app = await readSource("src/App.tsx");

  assert.match(resolver, /export const resolveTrackStream/);
  assert.match(resolver, /const tidal = await tryTidal/);
  assert.match(resolver, /return tryJioSaavn/);
  assert.match(metadata, /searchGlobalTracks/);
  assert.match(app, /sources: \["tidal", "itunes"\]/);
  assert.match(app, /resolveTrackStream\(metadataTrack/);
  assert.match(app, /src=\{currentTrack\?\.audioSrc/);
});

test("the production build has a pinned, reproducible dependency manifest", async () => {
  const packageJson = JSON.parse(await readSource("package.json"));
  const lockfile = await readSource("package-lock.json");

  assert.equal(packageJson.scripts.test, "node --test scripts/smoke.test.mjs");
  assert.match(lockfile, /\"lockfileVersion\"\s*:\s*\d+/);
});
