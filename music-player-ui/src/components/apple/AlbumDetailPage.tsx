import { useEffect, useMemo, useRef } from "react";
import type { AlbumDetail, AlbumTrack } from "../../services/albumLookup";
import { formatTime } from "../../utils/lyrics";
import { AppleIcon } from "./AppleIcon";
import { Artwork, type Tone } from "./Artwork";
import "./AlbumDetailPage.css";

export type AlbumPageStatus = "loading" | "ready" | "error";

export interface AlbumDetailPageProps {
  album: AlbumDetail | null;
  tracks: AlbumTrack[];
  status: AlbumPageStatus;
  error: string | null;
  /** Id of the track that is currently loaded in the player. */
  currentTrackId?: string | number;
  isPlaying?: boolean;
  onBack: () => void;
  onSelectTrack: (track: AlbumTrack) => void;
}

const TRACK_TONES: Tone[] = ["coral", "blue", "mint", "lavender", "sunset", "peach"];

const totalDuration = (tracks: AlbumTrack[]): number =>
  tracks.reduce((sum, track) => sum + (track.duration ?? 0), 0);

const formatTotalDuration = (seconds: number): string => {
  if (!Number.isFinite(seconds) || seconds <= 0) return "";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} hr ${remainder} min` : `${hours} hr`;
};

const formatCount = (count: number, singular: string): string =>
  `${count} ${count === 1 ? singular : `${singular}s`}`;

/**
 * The album page. It replaces the browse surface with the full track list of
 * one album and keeps every row playable through the app's normal resolution
 * path.
 */
export function AlbumDetailPage({
  album,
  tracks,
  status,
  error,
  currentTrackId,
  isPlaying,
  onBack,
  onSelectTrack,
}: AlbumDetailPageProps) {
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus to the album title so keyboard and screen-reader users land on
  // the new page instead of the browse content they just left. The scroll is
  // handled by the page that opened this view.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [album?.id]);

  const meta = useMemo(() => {
    if (!album) return "";
    const parts: string[] = [];
    if (album.year) parts.push(String(album.year));
    if (album.genre) parts.push(album.genre);
    parts.push(formatCount(tracks.length, "song"));
    const duration = formatTotalDuration(totalDuration(tracks));
    if (duration) parts.push(duration);
    return parts.join(" · ");
  }, [album, tracks]);

  const title = album?.title ?? "Album";
  const artist = album?.artist ?? "";

  return (
    <section className="apple-album-page" aria-label={`${title} album`}>
      <button type="button" className="apple-album-back" onClick={onBack}>
        <AppleIcon name="arrow-left" size={18} />
        <span>Back to browse</span>
      </button>

      <header className="apple-album-hero">
        <Artwork
          src={album?.artworkUrl}
          title={title}
          tone="lavender"
          className="apple-artwork--album-hero"
        />
        <div className="apple-album-hero-copy">
          <span className="apple-overline">ALBUM</span>
          <h1 ref={headingRef} tabIndex={-1}>{title}</h1>
          {artist && <p className="apple-album-hero-artist">{artist}</p>}
          {meta && <p className="apple-album-hero-meta">{meta}</p>}
          <div className="apple-album-hero-actions">
            <button
              type="button"
              className="apple-album-play"
              onClick={() => tracks[0] && onSelectTrack(tracks[0])}
              disabled={tracks.length === 0}
            >
              <AppleIcon name="play" size={14} />
              <span>Play album</span>
            </button>
            {album?.copyright && (
              <span className="apple-album-copyright">{album.copyright}</span>
            )}
          </div>
        </div>
      </header>

      <div className="apple-section-heading apple-section-heading--compact">
        <div>
          <span className="apple-overline">TRACKS</span>
          <h2>
            {status === "loading"
              ? "Loading tracks…"
              : `${formatCount(tracks.length, "song")}`}
          </h2>
        </div>
      </div>

      {status === "loading" && (
        <div className="apple-album-empty" aria-live="polite">
          <span className="apple-loading-dot" />
          Finding every track in this album
        </div>
      )}

      {status === "error" && (
        <div className="apple-album-empty apple-album-empty--error" role="alert">
          <AppleIcon name="music" size={22} />
          <span>{error ?? "We couldn't load this album's track list."}</span>
        </div>
      )}

      {status === "ready" && tracks.length === 0 && (
        <div className="apple-album-empty">
          <AppleIcon name="music" size={22} />
          <span>No tracks are available for this album yet.</span>
        </div>
      )}

      {tracks.length > 0 && (
        <ol className="apple-album-track-list">
          {tracks.map((track, index) => {
            const isCurrent = currentTrackId !== undefined && String(currentTrackId) === track.id;
            return (
              <li key={track.id} className={isCurrent ? "is-current" : undefined}>
                <button
                  type="button"
                  className="apple-album-track"
                  aria-current={isCurrent ? "true" : undefined}
                  onClick={() => onSelectTrack(track)}
                >
                  <span className="apple-album-track-number">
                    {track.trackNumber ?? index + 1}
                  </span>
                  <Artwork
                    src={track.artworkUrl ?? album?.artworkUrl}
                    title={track.title}
                    tone={TRACK_TONES[index % TRACK_TONES.length]}
                    className="apple-artwork--row"
                  />
                  <span className="apple-track-copy">
                    <strong>{track.title}</strong>
                    <small>{track.artist}</small>
                  </span>
                  <span className="apple-album-track-duration">
                    {track.duration ? formatTime(track.duration) : "--:--"}
                  </span>
                  <span className="apple-track-action">
                    <AppleIcon name={isCurrent && isPlaying ? "pause" : "play"} size={14} />
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export default AlbumDetailPage;
