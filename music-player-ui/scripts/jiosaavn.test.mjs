import assert from "node:assert/strict";
import test from "node:test";

import {
  buildJioSearchQueries,
  getJioArtistNames,
  getJioArtistText,
  getJioAudioUrl,
  getJioPlayableArtistNames,
  isJioVersionSafe,
  jioArtistMatchScore,
  jioTitlesMatch,
} from "../src/services/jioSaavnData.ts";
import { searchSongs } from "../src/services/api.ts";
import { resolveTrackStream } from "../src/services/trackResolver.ts";

const documentedSong = {
  name: "Ignite",
  duration: 220,
  artists: {
    primary: [{ name: "K-391" }],
    featured: [{ name: "Alan Walker" }],
    all: [{ name: "K-391" }, { name: "Alan Walker" }],
  },
  downloadUrl: [
    { quality: "48kbps", url: "https://audio.example.test/48.mp4" },
    { quality: "320kbps", url: "https://audio.example.test/320.mp4" },
  ],
};

test("normalizes documented JioSaavn artist collections", () => {
  assert.deepEqual(getJioArtistNames(documentedSong), ["K-391", "Alan Walker"]);
  assert.equal(getJioArtistText(documentedSong), "K-391, Alan Walker");
});

test("keeps composer credits out of strict playback artist matching", () => {
  const cover = {
    name: "Cheap Thrills",
    duration: 212,
    language: "instrumental",
    album: { name: "Cheap Thrills Instrumental Cover" },
    artists: {
      primary: [{ name: "Karaoke Stars", role: "primary_artists" }],
      featured: [],
      all: [
        { name: "Sia Furler", role: "music" },
        { name: "Karaoke Stars", role: "singer" },
      ],
    },
    downloadUrl: [{ quality: "320kbps", url: "https://audio.example.test/cover.mp4" }],
  };

  assert.deepEqual(getJioPlayableArtistNames(cover), ["Karaoke Stars"]);
  assert.equal(jioArtistMatchScore("Sia", getJioPlayableArtistNames(cover)), 0);
  assert.equal(isJioVersionSafe("Cheap Thrills", cover), false);
});

test("builds bounded Jio title/artist query variants", () => {
  const queries = buildJioSearchQueries({
    title: 'Cheap Thrills (From "This Is Acting")',
    artist: "Sia",
    album: "This Is Acting",
  });

  assert.deepEqual(queries.slice(0, 4), [
    'Cheap Thrills (From "This Is Acting") Sia',
    'Sia Cheap Thrills (From "This Is Acting")',
    'Cheap Thrills (From "This Is Acting") Sia This Is Acting',
    'Cheap Thrills (From "This Is Acting")',
  ]);
  assert.ok(queries.includes("Cheap Thrills Sia"));
  assert.ok(queries.length <= 6);
});

test("selects the highest quality documented JioSaavn download URL", () => {
  assert.equal(getJioAudioUrl(documentedSong), "https://audio.example.test/320.mp4");
});

test("keeps compatibility with legacy flat artist and URL fields", () => {
  assert.equal(
    getJioArtistText({ primaryArtists: "The Goo Goo Dolls" }),
    "The Goo Goo Dolls",
  );
  assert.equal(
    getJioAudioUrl({ downloadUrl: [{ quality: "320kbps", link: "https://audio.example.test/song.mp4" }] }),
    "https://audio.example.test/song.mp4",
  );
});

test("matches harmless soundtrack catalog suffixes without accepting versions", () => {
  assert.equal(jioTitlesMatch('Kesariya (From "Brahmastra")', "Kesariya"), true);
  assert.equal(jioTitlesMatch('Naatu Naatu (From "RRR")', 'Naatu Naatu'), true);
  assert.equal(jioTitlesMatch('Tum Hi Ho (From &quot;Aashiqui 2&quot;)', 'Tum Hi Ho'), true);
  assert.equal(jioTitlesMatch("Halo (Live)", "Halo"), false);
  assert.equal(jioTitlesMatch("Believer (Remix)", "Believer"), false);
  assert.equal(
    jioTitlesMatch(
      "Believer",
      "Believer (Originally Perfomed By Imagine Dragons) (Melody Karaoke Version)",
    ),
    false,
  );
});

test("maps the documented nested artist response before strict playback matching", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(JSON.stringify({
    success: true,
    data: {
      total: 1,
      start: 1,
      results: [documentedSong],
    },
  }), {
    headers: { "content-type": "application/json" },
  });

  try {
    const result = await searchSongs("Ignite", 0, 1);
    assert.equal(result.results[0].primaryArtists, "K-391, Alan Walker");
    assert.equal(result.results[0].artist, "K-391, Alan Walker");
    assert.equal(result.results[0].downloadUrl[1].url, "https://audio.example.test/320.mp4");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("resolves a later Jio query variant to a full-length download before preview", async () => {
  const calls = [];
  const canonicalSong = {
    id: "cheap-thrills-sia",
    name: "Cheap Thrills",
    duration: 212,
    language: "english",
    album: { name: "This Is Acting" },
    artists: {
      primary: [{ name: "Sia", role: "primary_artists" }],
      featured: [],
      all: [
        { name: "Sia", role: "primary_artists" },
        { name: "Greg Kurstin", role: "music" },
      ],
    },
    downloadUrl: [
      { quality: "48kbps", url: "https://audio.example.test/cheap-48.mp4" },
      { quality: "320kbps", url: "https://audio.example.test/cheap-320.mp4" },
    ],
  };

  const resolved = await resolveTrackStream(
    {
      title: "Cheap Thrills",
      artist: "Sia",
      primaryArtist: "Sia",
      album: "This Is Acting",
      duration: 212,
      audioCandidates: [{
        source: "itunes",
        url: "https://audio.example.test/cheap-preview.m4a",
        isPreview: true,
        title: "Cheap Thrills",
        artist: "Sia",
        duration: 212,
      }],
      isPreview: true,
    },
    {
      jioPages: 1,
      dependencies: {
        searchTidal: async () => null,
        getTidalTrackById: async () => null,
        searchJioSaavn: async (query, page) => {
          calls.push({ query, page });
          return query === "Sia Cheap Thrills"
            ? { results: [canonicalSong] }
            : { results: [] };
        },
      },
    },
  );

  assert.ok(resolved);
  assert.equal(resolved.source, "jiosaavn");
  assert.equal(resolved.isPreview, false);
  assert.equal(resolved.url, "https://audio.example.test/cheap-320.mp4");
  assert.ok(calls.some(({ query }) => query === "Cheap Thrills Sia"));
  assert.ok(calls.some(({ query }) => query === "Sia Cheap Thrills"));
  assert.equal(resolved.providerMetadata?.provider, "jiosaavn");
  assert.equal(resolved.providerMetadata?.providerId, "cheap-thrills-sia");
});

test("leaves a legitimate Sia preview-only when Jio only has cover/instrumental aliases", async () => {
  const cover = {
    id: "cheap-thrills-cover",
    name: "Cheap Thrills",
    duration: 212,
    language: "instrumental",
    album: { name: "Cheap Thrills Instrumental Cover" },
    artists: {
      primary: [{ name: "Karaoke Stars", role: "primary_artists" }],
      featured: [],
      all: [{ name: "Sia Furler", role: "music" }],
    },
    downloadUrl: [{ quality: "320kbps", url: "https://audio.example.test/cover.mp4" }],
  };

  const resolved = await resolveTrackStream(
    {
      title: "Cheap Thrills",
      artist: "Sia",
      primaryArtist: "Sia",
      duration: 212,
      audioCandidates: [{
        source: "itunes",
        url: "https://audio.example.test/cheap-preview.m4a",
        isPreview: true,
        title: "Cheap Thrills",
        artist: "Sia",
        duration: 212,
      }],
      isPreview: true,
    },
    {
      jioPages: 1,
      dependencies: {
        searchTidal: async () => null,
        getTidalTrackById: async () => null,
        searchJioSaavn: async () => ({ results: [cover] }),
      },
    },
  );

  assert.ok(resolved);
  assert.equal(resolved.source, "itunes");
  assert.equal(resolved.isPreview, true);
  assert.equal(resolved.url, "https://audio.example.test/cheap-preview.m4a");
});
