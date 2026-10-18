/** Stable integration entry point for strict audio resolution. */
export {
  artistSimilarity,
  getTidalIsrc,
  matchTrackMetadata,
  normalizeIsrc,
  normalizeProviderText,
  normalizeTrackArtist,
  normalizeTrackTitle,
  resolveAudioStream,
  resolveStreamForTrack,
  resolveTrackStream,
} from "./trackResolver";
export type {
  ResolvableTrack,
  ResolveTrackStreamOptions,
  StrictMatch,
  TrackResolverDependencies,
} from "./trackResolver";
export type { ResolvedTrackStream } from "../types/discovery.types";
