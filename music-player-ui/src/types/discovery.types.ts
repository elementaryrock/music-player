/**
 * Shared types for provider-independent metadata discovery and stream
 * resolution.  Keeping these types separate from a provider response makes it
 * possible to add another metadata index without coupling it to an audio API.
 */

export type DiscoveryProvider = "tidal" | "itunes" | "jiosaavn";
export type AudioProvider = "tidal" | "jiosaavn";

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
  providerId?: string | number;
  providerMetadata?: ProviderMetadata;
}
