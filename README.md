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

## Backend status and playlist imports

This version is intentionally frontend-first: the browser owns playback and
temporary queue state, while metadata and stream resolution use public runtime
endpoints. That is enough for a personal/local player and for trying the
product, but it is not equivalent to a production music service backend. A
backend becomes important for user accounts, cross-device playlist persistence,
OAuth token storage/refresh, provider rate-limit handling, and a controlled
server-side proxy for providers that are not browser-safe.

The app now supports a backend-free import path. Use the **Import playlist**
action to paste or upload a Spotify, YouTube Music, Apple Music/iTunes, CSV,
JSON, or M3U export. Imported track metadata is stored locally in the browser,
appears in the queue under its playlist name, and is matched through the
existing strict resolver when you press play. The app does not scrape provider
websites, access private libraries anonymously, or store provider credentials.

Direct private-library sync is a separate OAuth integration:

- Spotify requires an app and OAuth scopes for reading a user's playlists and
  playlist items. See the [Spotify playlist documentation](https://developer.spotify.com/documentation/web-api/concepts/playlists).
- YouTube/YouTube Music playlist access uses the [YouTube Data API playlist
  items endpoint](https://developers.google.com/youtube/v3/docs/playlistItems/list)
  with Google authorization for private/user data.
- Apple Music library and playlist access requires Apple Music API/MusicKit
  developer-token and user-authorization setup. See [Apple Music API](https://developer.apple.com/documentation/applemusicapi)
  and [MusicKit on the Web](https://developer.apple.com/documentation/musickitjs).

Those integrations should use a backend (or a carefully designed PKCE-only
client flow where the provider permits it); provider client secrets and refresh
tokens must never be committed to this repository or exposed in the browser.

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
