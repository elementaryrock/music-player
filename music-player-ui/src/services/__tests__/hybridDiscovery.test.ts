import {
  createTrackDedupeKey,
  mergeSearchResults,
  normalizeSearchText,
  type SearchResult,
} from "../searchEngine";
import { mapITunesSongToMetadata, searchITunesSongs } from "../itunesApi";
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

  it("keeps an iTunes preview as an explicitly marked audio candidate", () => {
    const mapped = mapITunesSongToMetadata({
      trackId: 99,
      trackName: "Ignite",
      artistName: "K-391, Alan Walker & Julie Bergan",
      trackTimeMillis: 220000,
      previewUrl: "https://audio.example.test/ignite-preview.m4a",
    });

    expect(mapped).toMatchObject({
      previewUrl: "https://audio.example.test/ignite-preview.m4a",
      isPreview: true,
      audioCandidates: [{
        source: "itunes",
        isPreview: true,
        quality: "standard",
      }],
    });
  });

  it("expands overloaded bare titles without hard-coding returned tracks", async () => {
    const terms: string[] = [];
    const fetchImpl = (async (input: RequestInfo | URL) => {
      const term = new URL(String(input)).searchParams.get("term") || "";
      terms.push(term);
      return {
        ok: true,
        json: async () => ({
          results: term.includes("K-391")
            ? [{ trackId: 2, trackName: "Ignite", artistName: "K-391 & Alan Walker" }]
            : [{ trackId: 1, trackName: "Ignite", artistName: "Eir Aoi" }],
        }),
      } as Response;
    }) as typeof fetch;

    const metadata = await searchITunesSongs("Ignite", { fetchImpl, limit: 5 });
    expect(terms).toEqual(["Ignite", "Ignite K-391 Alan Walker"]);
    expect(metadata.map((item) => item.artist)).toEqual([
      "Eir Aoi",
      "K-391 & Alan Walker",
    ]);
  });

  it("ranks the canonical Ignite recording ahead of regional and version results", () => {
    const ranked = mergeSearchResults([
      {
        id: "eir",
        title: "Ignite",
        artist: "Eir Aoi",
        source: "itunes",
        rank: 0,
        confidence: 0,
      },
      {
        id: "k391-remix",
        title: "Ignite (Remix)",
        artist: "K-391 & Alan Walker",
        source: "itunes",
        rank: 1,
        confidence: 0,
      },
      {
        id: "k391-cover",
        title: "Ignite",
        artist: "K-391 Cover Artist",
        source: "itunes",
        rank: 2,
        confidence: 0,
      },
      {
        id: "k391",
        title: "Ignite",
        artist: "K-391 & Alan Walker",
        source: "itunes",
        rank: 12,
        confidence: 0,
      },
    ], "Ignite");

    expect(ranked[0]).toMatchObject({ id: "k391", title: "Ignite" });
  });

  it("keeps common artist/title forms pointed at the canonical recordings", () => {
    const iris = mergeSearchResults([
      {
        id: "regional-iris",
        title: "Iris",
        artist: "Various Artists",
        source: "itunes",
        rank: 0,
        confidence: 0,
      },
      {
        id: "goo-iris",
        title: "Iris",
        artist: "The Goo Goo Dolls",
        source: "itunes",
        rank: 8,
        confidence: 0,
      },
    ], "The Goo Goo Dolls/Iris");
    const djo = mergeSearchResults([
      {
        id: "djo-end",
        title: "End of Beginning",
        artist: "Djo",
        source: "itunes",
        rank: 6,
        confidence: 0,
      },
    ], "Djo/End of Beginning");

    expect(iris[0].id).toBe("goo-iris");
    expect(djo[0].id).toBe("djo-end");
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

  it("uses a matching iTunes preview only after strict providers miss", async () => {
    const metadata = mapITunesSongToMetadata({
      trackId: 7,
      trackName: "Halo",
      artistName: "Beyonce",
      trackTimeMillis: 261000,
      previewUrl: "https://audio.example.test/halo-preview.m4a",
    });
    const resolved = await resolveTrackStream(
      {
        title: "Halo",
        artist: "Beyonce",
        duration: 261,
        audioCandidates: metadata?.audioCandidates,
      },
      {
        timeoutMs: 100,
        dependencies: {
          searchTidal: async () => ({ items: [], limit: 5, offset: 0, totalNumberOfItems: 0 }),
          getTidalTrackById: async () => null,
          searchJioSaavn: async () => ({ results: [] }),
        },
      }
    );

    expect(resolved).toMatchObject({
      source: "itunes",
      isPreview: true,
      quality: "standard",
      url: "https://audio.example.test/halo-preview.m4a",
    });
    expect(resolved?.confidence).toBeLessThan(0.8);
  });

  it("does not use a preview whose embedded artist does not match", async () => {
    const metadata = mapITunesSongToMetadata({
      trackId: 8,
      trackName: "Halo",
      artistName: "Wrong Artist",
      trackTimeMillis: 261000,
      previewUrl: "https://audio.example.test/wrong-preview.m4a",
    });
    const resolved = await resolveTrackStream(
      {
        title: "Halo",
        artist: "Beyonce",
        duration: 261,
        audioCandidates: metadata?.audioCandidates,
      },
      {
        timeoutMs: 100,
        dependencies: {
          searchTidal: async () => ({ items: [], limit: 5, offset: 0, totalNumberOfItems: 0 }),
          getTidalTrackById: async () => null,
          searchJioSaavn: async () => ({ results: [] }),
        },
      }
    );

    expect(resolved).toBeNull();
  });
});
