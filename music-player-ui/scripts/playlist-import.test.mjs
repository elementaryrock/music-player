import assert from "node:assert/strict";
import test from "node:test";

import { parsePlaylistImport } from "../src/services/playlistImport.ts";

test("imports Spotify-shaped JSON and deduplicates tracks", () => {
  const result = parsePlaylistImport({
    name: "Road trip",
    tracks: {
      items: [
        { track: { name: "First Song", artists: [{ name: "Ava" }], album: { name: "Road" }, duration_ms: 180000 } },
        { track: { name: "First Song", artists: [{ name: "Ava" }], album: { name: "Road" } } },
        { track: { name: "Second Song", artists: [{ name: "Milo" }] } },
      ],
    },
  });

  assert.equal(result.source, "spotify");
  assert.equal(result.playlistName, "Road trip");
  assert.equal(result.entries.length, 2);
  assert.equal(result.entries[0].duration, 180);
});

test("imports quoted CSV rows and reports malformed rows", () => {
  const result = parsePlaylistImport(
    'title,artist,album,duration\n"Song, With Comma","The Artist","An Album",03:05\n"Broken,The Artist,Album,200',
    { fileName: "playlist.csv", playlistName: "CSV Mix" },
  );

  assert.equal(result.source, "csv");
  assert.equal(result.playlistName, "CSV Mix");
  assert.equal(result.entries[0].title, "Song, With Comma");
  assert.equal(result.entries[0].duration, 185);
  assert.ok(result.skippedCount >= 1);
  assert.ok(result.warnings.some((warning) => warning.includes("unterminated")));
});

test("imports M3U metadata without treating bare URLs as track titles", () => {
  const result = parsePlaylistImport(
    "#EXTM3U\n#PLAYLIST:Focus\n#EXTINF:212,Sia - Cheap Thrills\nhttps://example.test/cheap-thrills.mp3\nhttps://example.test/missing.mp3",
    { fileName: "focus.m3u8" },
  );

  assert.equal(result.source, "m3u");
  assert.equal(result.playlistName, "Focus");
  assert.equal(result.entries.length, 1);
  assert.equal(result.entries[0].artist, "Sia");
  assert.equal(result.entries[0].title, "Cheap Thrills");
  assert.ok(result.skippedCount >= 1);
});

test("unsupported and empty imports are structured instead of throwing", () => {
  const empty = parsePlaylistImport("");
  const unsupported = parsePlaylistImport("not a playlist", { format: "xml" });

  assert.equal(empty.entries.length, 0);
  assert.match(empty.error, /No playlist data/);
  assert.equal(unsupported.entries.length, 0);
  assert.match(unsupported.error, /not supported/);
});
