import assert from "node:assert/strict";
import test from "node:test";

import {
  getJioArtistNames,
  getJioArtistText,
  getJioAudioUrl,
  jioTitlesMatch,
} from "../src/services/jioSaavnData.ts";
import { searchSongs } from "../src/services/api.ts";

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
