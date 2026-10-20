import assert from "node:assert/strict";
import test from "node:test";

import {
  dedupeByAlbum,
  getAlbumLabel,
  getAlbumTitle,
  getArtworkUrl,
  isSearchResult,
} from "../src/components/apple/mediaItems.ts";

const track = (id, title, artist, album, albumArtUrl) => ({
  id,
  title,
  artist,
  album,
  albumArtUrl,
  audioSrc: "",
});

const result = (id, title, artist, album, artworkUrl) => ({
  id,
  title,
  artist,
  album,
  artworkUrl,
  imageUrl: artworkUrl,
  source: "itunes",
  confidence: 1,
});

test("reads artwork from either a queued track or a metadata result", () => {
  assert.equal(
    getArtworkUrl(track("a", "Song", "Artist", "Album", "/cover.jpg")),
    "/cover.jpg",
  );
  assert.equal(
    getArtworkUrl(result("b", "Song", "Artist", "Album", "https://cover.test/a.jpg")),
    "https://cover.test/a.jpg",
  );
  assert.equal(isSearchResult(result("b", "Song", "Artist", "Album", "x")), true);
  assert.equal(isSearchResult(track("a", "Song", "Artist", "Album", "x")), false);
});

test("labels a track without an album as a single", () => {
  assert.equal(getAlbumLabel(track("a", "Song", "Artist", undefined, "x")), "Single");
  assert.equal(getAlbumLabel(track("a", "Song", "Artist", "Album", "x")), "Album");
});

test("uses the track title when an item has no album name", () => {
  assert.equal(getAlbumTitle(track("a", "Song", "Artist", undefined, "x")), "Song");
  assert.equal(getAlbumTitle(track("a", "Song", "Artist", "Album", "x")), "Album");
});

test("keeps one entry per album when a shelf lists albums", () => {
  const items = [
    track("a", "First", "Artist", "Record One", "1.jpg"),
    track("b", "Second", "Artist", "Record One", "1.jpg"),
    track("c", "Third", "Artist", "Record Two", "2.jpg"),
    track("d", "Fourth", "Artist", undefined, "3.jpg"),
  ];

  const unique = dedupeByAlbum(items);

  assert.equal(unique.length, 3);
  assert.deepEqual(unique.map((item) => item.title), ["First", "Third", "Fourth"]);
});

test("treats album names that differ only in punctuation as the same release", () => {
  const items = [
    track("a", "First", "Artist", "÷ (Divide)", "1.jpg"),
    track("b", "Second", "Artist", "÷ Divide", "1.jpg"),
    track("c", "Third", "Artist", "Midnights", "2.jpg"),
  ];

  assert.equal(dedupeByAlbum(items).length, 2);
});
