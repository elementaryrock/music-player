import type { Track } from "../../types/api.types";
import { AppleIcon } from "./AppleIcon";
import { SyncedLyrics } from "./SyncedLyrics";
import "./LyricsDrawer.css";

export interface LyricsDrawerProps {
  open: boolean;
  onClose: () => void;
  track: Track;
  currentTime: number;
  onSeekTo?: (seconds: number) => void;
}

export const LyricsDrawer = ({
  open,
  onClose,
  track,
  currentTime,
  onSeekTo,
}: LyricsDrawerProps) => (
  <>
    <button
      aria-label="Close lyrics"
      aria-hidden={!open}
      className={`apple-lyrics-drawer__backdrop${open ? " is-open" : ""}`}
      onClick={onClose}
      tabIndex={open ? 0 : -1}
      type="button"
    />
    <aside
      aria-hidden={!open}
      aria-label={`Lyrics for ${track.title}`}
      className={`apple-lyrics-drawer${open ? " is-open" : ""}`}
    >
      <div className="apple-lyrics-drawer__topbar">
        <div className="apple-lyrics-drawer__track">
          {track.albumArtUrl ? (
            <img
              alt=""
              className="apple-lyrics-drawer__artwork"
              src={track.albumArtUrl}
            />
          ) : (
            <span className="apple-lyrics-drawer__artwork-fallback" aria-hidden="true">
              <AppleIcon name="music" size={18} />
            </span>
          )}
          <div>
            <p>Lyrics</p>
            <strong>{track.title}</strong>
            <span>{track.artist}</span>
          </div>
        </div>
        <button
          aria-label="Close lyrics drawer"
          className="apple-lyrics-drawer__close"
          onClick={onClose}
          type="button"
        >
          <AppleIcon name="close" size={20} />
        </button>
      </div>
      <SyncedLyrics
        className="apple-lyrics-drawer__lyrics"
        currentTime={currentTime}
        onSeekTo={onSeekTo}
        track={track}
      />
    </aside>
  </>
);

export default LyricsDrawer;
