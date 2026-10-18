# Music Player UI

An Apple-inspired React 19 music player built with TypeScript and Vite. The
Browse view uses global metadata discovery (Tidal and iTunes by default), then
resolves a selected recording to a verified Tidal stream with strict JioSaavn
fallback. Two bundled MP3 tracks keep the player useful offline while working
on search or provider connectivity.

## Requirements

- Node.js **22.14.0** (the repository root `.nvmrc` pins the version)
- npm 10 or newer
- Docker 24 or newer for the container workflow (optional)

No API keys or environment variables are required. Metadata, stream resolution,
and lyrics use public endpoints at runtime; the app does not make network
requests during module import.

## Setup

From the repository root:

```sh
nvm install
nvm use
npm ci --prefix music-player-ui
```

On systems without `nvm`, install Node 22.14.0 manually and verify it with
`node --version` before running `npm ci`.

## Run locally

Start the Vite development server:

```sh
npm --prefix music-player-ui run dev
```

Open the URL printed by Vite (normally `http://localhost:5173`). To expose the
development server to a container or another device:

```sh
npm --prefix music-player-ui run dev -- --host 0.0.0.0
```

The production preview server is available after a build:

```sh
npm --prefix music-player-ui run build
npm --prefix music-player-ui run preview -- --host 0.0.0.0
```

## Test and lint

The single offline test command is:

```sh
make test
```

It runs the deterministic Node smoke tests in
`music-player-ui/scripts/smoke.test.mjs`; no network access or test service is
needed. The older Jest-style files are retained as historical source tests and
are not claimed as part of this command.

Run the checks used for a production build:

```sh
npm --prefix music-player-ui run lint
npm --prefix music-player-ui run build
```

The TypeScript build intentionally excludes the historical `src/**/__tests__`
files because this project uses the offline Node smoke runner rather than a
Jest dependency.

## Docker build and deploy

Build the reproducible production image from the repository root:

```sh
docker build -t music-player-ui:local .
```

Run it locally:

```sh
docker run --rm --name music-player-ui -p 4173:4173 music-player-ui:local
```

For a deployment target with Docker, push the same image to its registry and
start it with port `4173` exposed. For a static host, run
`npm --prefix music-player-ui run build` and publish the generated
`music-player-ui/dist` directory.

## Playback flow

- **BrowseShell** owns search, navigation, queue selection, and the compact
  player controls.
- **ImmersivePlayer** provides the full-screen artwork, ambient palette,
  transport controls, quality/source metadata, and synced lyrics.
- **LyricsDrawer** loads provided LRC data first and then public LRCLIB data;
  selecting a lyric line seeks the shared audio element.
- A single audio element is owned by `App.tsx`, so compact controls, immersive
  controls, queue changes, and lyric seeking always share time, duration,
  playback, and volume state.
