/**
 * Shared types for provider-independent metadata discovery and stream
 * resolution.  Keeping these types separate from a provider response makes it
 * possible to add another metadata index without coupling it to an audio API.
 */

export type DiscoveryProvider = "tidal" | "itunes" | "jiosaavn";
/**
 * iTunes is included only for its short preview candidate. The resolver marks
 * those results with `isPreview` so callers never mistake the Apple sample
 * for a full Tidal/JioSaavn stream.
 */
export type AudioProvider = "tidal" | "jiosaavn" | "itunes";

export type StreamQuality = "hi-res" | "lossless" | "high" | "standard";

export interface ProviderMetadata {
  provider: DiscoveryProvider;
  providerId?: string | number;
  rank?: number;
  popularity?: number;
  isrc?: string;
  sourceUrl?: string;
  raw?: unknown;
}

export interface AudioCandidate {
  source: AudioProvider;
  url: string;
  quality?: StreamQuality;
  /** True only for a provider's limited preview/sample URL. */
  isPreview?: boolean;
  /** Optional identity copied from the metadata result for strict matching. */
  title?: string;
  artist?: string;
  duration?: number;
  isrc?: string;
  providerId?: string | number;
  matchConfidence?: number;
  providerMetadata?: ProviderMetadata;
}

/** Provider-neutral metadata returned by a discovery adapter. */
export interface UnifiedTrackMetadata {
  id: string;
  title: string;
  artist: string;
  primaryArtist: string;
  album?: string;
  artworkUrl?: string;
  duration?: number;
  explicit?: boolean;
  popularity?: number;
  rank?: number;
  isrc?: string;
  /** iTunes' short sample, when one is available. */
  previewUrl?: string;
  isPreview?: boolean;
  metadataProvider: DiscoveryProvider;
  providerMetadata: ProviderMetadata;
  audioCandidates?: AudioCandidate[];
}

export interface TrackResolutionInput {
  id?: string | number;
  title: string;
  artist: string;
  primaryArtist?: string;
  album?: string;
  duration?: number;
  isrc?: string;
  providerMetadata?: ProviderMetadata;
  audioCandidates?: AudioCandidate[];
  previewUrl?: string;
  isPreview?: boolean;
}

export interface ResolvedTrackStream {
  /** URL ready to pass to an HTMLAudioElement. */
  url: string;
  /** Alias used by existing Track consumers. */
  audioSrc: string;
  source: AudioProvider;
  quality: StreamQuality;
  qualityLabel: "Hi-Res" | "Lossless" | "High Quality" | "Standard";
  /** Confidence in the metadata-to-stream match, in the range 0..1. */
  matchConfidence: number;
  /** Confidence in the selected stream including provider quality, in 0..1. */
  confidence: number;
  matchedBy: "isrc" | "title-artist-duration";
  /** True when `url` is a limited preview rather than a full stream. */
  isPreview: boolean;
  providerId?: string | number;
  providerMetadata?: ProviderMetadata;
}
