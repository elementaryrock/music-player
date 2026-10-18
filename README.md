# Music Player

The runnable app is in [`music-player-ui/`](music-player-ui/). It is a React
19 + TypeScript + Vite player with global metadata discovery, strict Tidal-first
stream resolution, synced lyrics, and bundled local tracks for offline playback.

## Setup

The repository pins Node.js 22.14.0 in [`.nvmrc`](.nvmrc). From this directory:

```sh
nvm install
nvm use
npm ci --prefix music-player-ui
```

Without `nvm`, install Node 22.14.0 manually before running the same `npm ci`.
No API keys or `.env` file are required.

## Run

```sh
npm --prefix music-player-ui run dev
```

Vite prints the local URL, normally `http://localhost:5173`.

## Test, lint, and build

The offline test command is:

```sh
make test
```

For the production checks:

```sh
npm --prefix music-player-ui run lint
npm --prefix music-player-ui run build
```

The test command runs the deterministic Node smoke, lyric-rendering, and
JioSaavn adapter tests. Historical Jest-style tests remain in the source tree
but are not part of the configured test runner.

## Deploy

Build and run the reproducible Docker image:

```sh
docker build -t music-player-ui:local .
docker run --rm -p 4173:4173 music-player-ui:local
```

For a static deployment, publish `music-player-ui/dist` after
`npm --prefix music-player-ui run build`. See
[`music-player-ui/README.md`](music-player-ui/README.md) for the full playback
flow and local development details.
