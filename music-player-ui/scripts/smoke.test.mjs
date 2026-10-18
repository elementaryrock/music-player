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
  assert.match(resolver, /const jio = await tryJioSaavn/);
  assert.match(resolver, /return tryITunesPreview/);
  assert.match(resolver, /candidate\.source !== "itunes"/);
  assert.match(resolver, /candidate\.isPreview !== true/);
  assert.match(metadata, /searchGlobalTracks/);
  assert.match(app, /sources: \["tidal", "itunes"\]/);
  assert.match(app, /resolveTrackStream\(metadataTrack/);
  assert.match(app, /resolved\.isPreview \|\| resolved\.source === "itunes"/);
  assert.match(app, /streamResolution: resolved/);
  assert.match(app, /isPreview: resolvedPreview/);
  assert.match(app, /isPreview: result\.isPreview/);
  assert.match(app, /Preview only/);
  assert.match(app, /src=\{currentTrack\?\.audioSrc/);
});

test("the app waits for media readiness and owns immersive scroll cleanup", async () => {
  const app = await readSource("src/App.tsx");
  const immersive = await readSource("src/components/apple/ImmersivePlayer.tsx");
  const immersiveStyles = await readSource("src/components/apple/ImmersivePlayer.css");

  assert.match(app, /addEventListener\("loadedmetadata"/);
  assert.match(app, /addEventListener\("canplay"/);
  assert.match(app, /audio\.load\(\)/);
  assert.match(app, /event\.key !== "Escape"/);
  assert.match(app, /body\.style\.overflow = "hidden"/);
  assert.match(app, /body\.style\.overflow = previousBodyOverflow/);
  assert.match(app, /onClose=\{handleCloseImmersive\}/);
  assert.match(immersive, /className="apple-immersive-player__icon-button-label">Back/);
  assert.match(immersiveStyles, /height:\s*100dvh/);
  assert.match(immersiveStyles, /\.apple-immersive-player__content[\s\S]*?overflow:\s*hidden/);
  assert.match(immersiveStyles, /\.apple-immersive-player__lyrics[\s\S]*?overflow:\s*hidden/);
  assert.match(immersiveStyles, /@media \(max-width: 900px\)[\s\S]*?flex-direction:\s*column/);
});

test("the production build has a pinned, reproducible dependency manifest", async () => {
  const packageJson = JSON.parse(await readSource("package.json"));
  const lockfile = await readSource("package-lock.json");

  assert.equal(packageJson.scripts.dev, "node node_modules/vite/bin/vite.js");
  assert.equal(
    packageJson.scripts.build,
    "node node_modules/typescript/bin/tsc -b && node node_modules/vite/bin/vite.js build",
  );
  assert.equal(packageJson.scripts.lint, "node node_modules/eslint/bin/eslint.js .");
  assert.equal(packageJson.scripts.preview, "node node_modules/vite/bin/vite.js preview");
  assert.equal(
    packageJson.scripts.test,
    "node --test scripts/smoke.test.mjs scripts/lyrics.test.mjs scripts/jiosaavn.test.mjs",
  );
  assert.match(lockfile, /\"lockfileVersion\"\s*:\s*\d+/);
});
