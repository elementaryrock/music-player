import assert from "node:assert/strict";
import test from "node:test";

import {
  lookupAlbum,
  mapITunesSongToAlbumTrack,
} from "../src/services/albumLookup.ts";

const jsonResponse = (payload) => ({
  ok: true,
  status: 200,
  json: async () => payload,
});

const collection = {
  wrapperType: "collection",
  collectionId: 1440833068,
  collectionName: "After Hours",
  collectionArtistName: "The Weeknd",
  artistName: "The Weeknd",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/cover100x100bb.jpg",
  trackCount: 14,
  releaseDate: "2020-03-20T07:00:00Z",
  primaryGenreName: "Pop",
  copyright: "2020 The Weeknd",
};

const track = (trackNumber, trackName, extra = {}) => ({
  wrapperType: "track",
  trackId: 1000 + trackNumber,
  trackName,
  collectionId: 1440833068,
  collectionName: "After Hours",
  artistName: "The Weeknd",
  artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/cover100x100bb.jpg",
  trackTimeMillis: 200_000 + trackNumber * 1_000,
  trackNumber,
  discNumber: 1,
  previewUrl: `https://audio.example.test/${trackNumber}.m4a`,
  ...extra,
});

test("resolves an album by collection id and orders its tracks", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    return jsonResponse({
      resultCount: 3,
      results: [
        collection,
        track(2, "After Hours"),
        track(1, "Blinding Lights"),
      ],
    });
  };

  const detail = await lookupAlbum(
    { title: "After Hours", artist: "The Weeknd", collectionId: 1440833068 },
    { fetchImpl },
  );

  assert.ok(detail);
  assert.equal(detail.title, "After Hours");
  assert.equal(detail.artist, "The Weeknd");
  assert.equal(detail.year, 2020);
  assert.equal(detail.genre, "Pop");
  assert.equal(detail.catalogTrackCount, 14);
  assert.equal(detail.tracks.length, 2);
  assert.deepEqual(
    detail.tracks.map((item) => item.trackNumber),
    [1, 2],
  );
  assert.equal(requested.length, 1);
  assert.match(requested[0], /itunes\.apple\.com\/lookup/);
});

test("searches for the album when no collection id is known", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    if (url.includes("entity=album")) {
      return jsonResponse({
        resultCount: 1,
        results: [
          {
            wrapperType: "collection",
            collectionId: 1440833068,
            collectionName: "After Hours",
            collectionArtistName: "The Weeknd",
          },
        ],
      });
    }
    return jsonResponse({ resultCount: 2, results: [collection, track(1, "Blinding Lights")] });
  };

  const detail = await lookupAlbum(
    { title: "After Hours", artist: "The Weeknd" },
    { fetchImpl },
  );

  assert.ok(detail);
  assert.equal(detail.tracks.length, 1);
  assert.equal(requested.length, 2);
  assert.match(requested[0], /itunes\.apple\.com\/search/);
  assert.match(requested[1], /itunes\.apple\.com\/lookup/);
});

test("falls back to the song index when the album index has no match", async () => {
  const requested = [];
  const fetchImpl = async (url) => {
    requested.push(url);
    if (url.includes("entity=album")) {
      return jsonResponse({ resultCount: 0, results: [] });
    }
    if (url.includes("entity=song")) {
      return jsonResponse({
        resultCount: 1,
        results: [track(1, "Blinding Lights")],
      });
    }
    return jsonResponse({ resultCount: 2, results: [collection, track(1, "Blinding Lights")] });
  };

  const detail = await lookupAlbum(
    { title: "After Hours", artist: "The Weeknd" },
    { fetchImpl },
  );

  assert.ok(detail);
  assert.equal(detail.tracks.length, 1);
  assert.equal(requested.length, 3);
  assert.match(requested[1], /entity=song/);
});

test("returns null when the catalog does not know the album", async () => {
  const fetchImpl = async () => jsonResponse({ resultCount: 0, results: [] });

  const detail = await lookupAlbum(
    { title: "Nonexistent Album", artist: "Nobody" },
    { fetchImpl },
  );

  assert.equal(detail, null);
});

test("survives a provider failure instead of throwing", async () => {
  const fetchImpl = async () => {
    throw new Error("network down");
  };

  const detail = await lookupAlbum(
    { title: "After Hours", artist: "The Weeknd" },
    { fetchImpl },
  );

  assert.equal(detail, null);
});

test("maps a catalog song into an album track", () => {
  const mapped = mapITunesSongToAlbumTrack(
    {
      trackId: 1499378108,
      trackName: "Blinding Lights",
      artistName: "The Weeknd",
      collectionName: "After Hours",
      artworkUrl100: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/6f/bc/e6/cover100x100bb.jpg",
      trackTimeMillis: 200_100,
      trackNumber: 1,
      discNumber: 1,
      previewUrl: "https://audio.example.test/1.m4a",
      isrc: "USUG11900306",
    },
    { title: "After Hours", artist: "The Weeknd" },
  );

  assert.ok(mapped);
  assert.equal(mapped.id, "itunes_1499378108");
  assert.equal(mapped.title, "Blinding Lights");
  assert.equal(mapped.album, "After Hours");
  assert.equal(mapped.duration, 200);
  assert.equal(mapped.trackNumber, 1);
  assert.equal(mapped.previewUrl, "https://audio.example.test/1.m4a");
  assert.equal(mapped.isrc, "USUG11900306");
  assert.equal(mapped.source, "itunes");
});
