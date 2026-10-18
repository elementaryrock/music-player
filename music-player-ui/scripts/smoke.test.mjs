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
  const searchEngine = await readSource("src/services/searchEngine.ts");
  const tidal = await readSource("src/services/tidalApiFixed.ts");
  const tidalFacade = await readSource("src/services/tidalApi.ts");
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
  assert.match(app, /const resolutionRequestRef = useRef\(0\)/);
  assert.match(app, /const isCurrentResolution = \(\) =>/);
  assert.match(app, /verifiedPreview = resolved\.source === "itunes" && resolved\.isPreview === true/);
  assert.match(app, /verifiedFull/);
  assert.match(app, /streamResolution: resolved/);
  assert.match(app, /isPreview: resolvedPreview/);
  assert.match(app, /isPreview: result\.isPreview/);
  assert.match(searchEngine, /const results = await Promise\.allSettled\(searchTasks\.map/);
  assert.match(searchEngine, /if \(result\.status === 'fulfilled'\)/);
  assert.match(searchEngine, /Optional provider failures are isolated from the other indexes/);
  assert.match(searchEngine, /if \(response === null\)\s*\{/);
  assert.match(tidal, /const endpointUrls = readConfiguredEndpointUrls\(\)/);
  assert.doesNotMatch(tidal, /const DEFAULT_TIDAL_ENDPOINT/);
  assert.match(tidalFacade, /Keep the separate HiFi diagnostic module lazy/);
  assert.doesNotMatch(tidalFacade, /Enhanced Tidal API with HiFi endpoint loaded/);
  assert.match(app, /sources: \["jiosaavn"\]/);
  assert.match(app, /if \(results\.length === 0\)/);
  assert.match(app, /Preview only/);
  assert.match(app, /PREVIEW_FALLBACK_DURATION_SECONDS = 30/);
  assert.match(app, /initialPlaybackDuration/);
  assert.match(app, /mediaPlaybackDuration/);
  assert.match(app, /app-playback-state--\$\{playbackState\(currentTrack\)\}/);
  assert.match(app, /src=\{currentTrack\?\.audioSrc/);
});

test("a newer selection invalidates stale or aborted stream resolutions", async () => {
  const app = await readSource("src/App.tsx");

  assert.match(app, /const resolutionRequestRef = useRef\(0\)/);
  assert.match(app, /const requestId = resolutionRequestRef\.current \+ 1/);
  assert.match(app, /resolutionRequestRef\.current = requestId/);
  assert.match(app, /resolutionAbortRef\.current\?\.abort\(\)/);
  assert.match(app, /const isCurrentResolution = \(\) =>/);
  assert.match(app, /generation !== mediaGenerationRef\.current/);

  const resolutionAwait = app.indexOf("const resolved = await resolveTrackStream");
  const staleGuard = app.indexOf("if (!isCurrentResolution()) return;", resolutionAwait);
  const commit = app.indexOf("commitTrack(resolvedTrack, true)", staleGuard);
  assert.ok(resolutionAwait >= 0, "the selected result must await strict resolution");
  assert.ok(staleGuard > resolutionAwait, "stale results must be ignored after resolution settles");
  assert.ok(commit > staleGuard, "a stale result must be checked before committing playback");

  const commitTrack = app.indexOf("const commitTrack = useCallback");
  const invalidation = app.indexOf("invalidatePendingResolution();", commitTrack);
  assert.ok(invalidation > commitTrack, "newer queue/selection commits must abort older resolution");
});

test("the app waits for media readiness and owns immersive scroll cleanup", async () => {
  const app = await readSource("src/App.tsx");
  const immersive = await readSource("src/components/apple/ImmersivePlayer.tsx");
  const immersiveStyles = await readSource("src/components/apple/ImmersivePlayer.css");
  const syncedLyrics = await readSource("src/components/apple/SyncedLyrics.tsx");
  const browseStyles = await readSource("src/components/apple/BrowseShell.css");

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
  assert.match(immersiveStyles, /width:\s*min\(100%, 31rem, 48dvh\)/);
  assert.match(syncedLyrics, /const lyricsScrollRef = useRef/);
  assert.match(syncedLyrics, /scrollContainer\.scrollTo/);
  assert.doesNotMatch(syncedLyrics, /scrollIntoView/);
  assert.match(browseStyles, /background:\s*var\(--apple-accent\)/);
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
