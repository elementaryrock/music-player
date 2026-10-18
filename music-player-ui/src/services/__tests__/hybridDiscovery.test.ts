import {
  createTrackDedupeKey,
  mergeSearchResults,
  normalizeSearchText,
  type SearchResult,
} from "../searchEngine";
import { mapITunesSongToMetadata } from "../itunesApi";
import { matchTrackMetadata, resolveTrackStream } from "../trackResolver";

describe("hybrid metadata discovery", () => {
  it("normalizes accents and keeps version labels meaningful", () => {
    expect(normalizeSearchText("Beyoncé — Halo")).toBe("beyonce halo");
    expect(createTrackDedupeKey("Song!", "Artist")).toBe(
      createTrackDedupeKey("song", "artist")
    );
    expect(createTrackDedupeKey("Song (Live)", "Artist")).not.toBe(
      createTrackDedupeKey("Song", "Artist")
    );
  });

  it("maps iTunes metadata and upgrades artwork", () => {
    const mapped = mapITunesSongToMetadata(
      {
        trackId: 42,
        trackName: "Halo",
        artistName: "Beyoncé",
        collectionName: "I Am... Sasha Fierce",
        artworkUrl100: "https://img.example.test/100x100bb.jpg",
        trackTimeMillis: 261000,
        trackExplicitness: "explicit",
        isrc: "us-s1z-99-00001",
      },
      3
    );

    expect(mapped).toMatchObject({
      id: "42",
      title: "Halo",
      artist: "Beyoncé",
      album: "I Am... Sasha Fierce",
      artworkUrl: "https://img.example.test/1000x1000bb.jpg",
      duration: 261,
      explicit: true,
      isrc: "USS1Z9900001",
      metadataProvider: "itunes",
      rank: 3,
    });
  });

  it("deduplicates providers while retaining the strongest metadata", () => {
    const base: SearchResult = {
      id: "itunes-1",
      title: "Halo",
      artist: "Beyonce",
      primaryArtist: "Beyonce",
      source: "itunes",
      duration: 261,
      rank: 0,
      popularity: 40,
      confidence: 0.5,
      providerMetadata: { provider: "itunes", providerId: 1 },
      providers: [{ provider: "itunes", providerId: 1 }],
    };
    const tidal: SearchResult = {
      ...base,
      id: "tidal-7",
      source: "tidal",
      popularity: 90,
      providerMetadata: { provider: "tidal", providerId: 7 },
      providers: [{ provider: "tidal", providerId: 7 }],
      audioUrl: "https://audio.example.test/halo.flac",
    };
    const remix: SearchResult = {
      ...base,
      id: "jio-remix",
      title: "Halo (Live)",
      source: "jiosaavn",
      providerMetadata: { provider: "jiosaavn", providerId: "remix" },
    };

    const ranked = mergeSearchResults([base, remix, tidal], "Halo by Beyonce");
    expect(ranked).toHaveLength(2);
    expect(ranked[0]).toMatchObject({ source: "tidal", audioUrl: tidal.audioUrl });
    expect(ranked[0].providers).toHaveLength(2);
    expect(ranked[1].title).toContain("Live");
    expect(ranked[0].confidence).toBeGreaterThan(ranked[1].confidence);
  });
});

describe("strict stream resolution", () => {
  const requested = {
    title: "Halo",
    artist: "Beyonce",
    duration: 261,
    isrc: "USS1Z9900001",
  };

  it("resolves Tidal by ISRC before falling back", async () => {
    const searchTidal = async (query: string) => ({
      limit: 5,
      offset: 0,
      totalNumberOfItems: 1,
      items: query === requested.isrc
        ? [{
            id: 7,
            title: "Halo",
            duration: 261,
            isrc: requested.isrc,
            artist: { name: "Beyonce" },
          }]
        : [],
    });
    const getTidalTrackById = async () => ({ OriginalTrackUrl: "https://audio.example.test/halo.flac" });
    const searchJioSaavn = jest.fn(async () => ({ results: [] }));

    const resolved = await resolveTrackStream(requested, {
      timeoutMs: 100,
      dependencies: { searchTidal, getTidalTrackById, searchJioSaavn },
    });

    expect(resolved).toMatchObject({
      source: "tidal",
      quality: "hi-res",
      matchedBy: "isrc",
      url: "https://audio.example.test/halo.flac",
    });
    expect(searchJioSaavn).not.toHaveBeenCalled();
  });

  it("rejects same-title candidates with the wrong duration", () => {
    expect(
      matchTrackMetadata(requested, {
        title: "Halo",
        artist: "Beyonce",
        duration: 275,
      }).matched
    ).toBe(false);
    expect(
      matchTrackMetadata(requested, {
        title: "Halo",
        artist: "Beyonce Tribute",
        duration: 261,
      }).matched
    ).toBe(false);
  });

  it("uses JioSaavn only for a strict metadata fallback", async () => {
    const resolved = await resolveTrackStream(
      { title: "Halo", artist: "Beyonce", duration: 261 },
      {
        timeoutMs: 100,
        dependencies: {
          searchTidal: async () => ({ items: [], limit: 5, offset: 0, totalNumberOfItems: 0 }),
          getTidalTrackById: async () => null,
          searchJioSaavn: async () => ({
            results: [{
              id: "jio-1",
              name: "Halo",
              primaryArtists: "Beyonce",
              duration: "264",
              downloadUrl: [{ link: "https://audio.example.test/halo.mp3" }],
            }],
          }),
        },
      }
    );

    expect(resolved).toMatchObject({
      source: "jiosaavn",
      quality: "standard",
      matchedBy: "title-artist-duration",
    });
  });
});
