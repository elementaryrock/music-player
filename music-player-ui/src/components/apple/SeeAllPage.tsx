import { AppleIcon } from "./AppleIcon";
import { Artwork, type Tone } from "./Artwork";
import {
  getAlbumLabel,
  getAlbumTitle,
  getArtworkUrl,
  type MediaItem,
} from "./mediaItems";

export type SeeAllVariant = "songs" | "albums";

export interface SeeAllPageProps {
  title: string;
  note?: string;
  variant: SeeAllVariant;
  items: MediaItem[];
  onBack: () => void;
  /** Plays a song or opens an album, depending on the variant. */
  onSelectItem: (item: MediaItem) => void;
}

const ROW_TONES: Tone[] = ["coral", "blue", "mint", "lavender", "sunset", "peach"];
const ALBUM_TONES: Tone[] = ["coral", "blue", "mint", "lavender", "sunset"];

/**
 * The full listing behind a shelf's "See All" button. It reuses the browse
 * surface's own row and card styles so the transition reads as the same
 * product rather than a separate screen.
 */
export function SeeAllPage({
  title,
  note,
  variant,
  items,
  onBack,
  onSelectItem,
}: SeeAllPageProps) {
  const isAlbums = variant === "albums";

  return (
    <section className="apple-see-all-page" aria-label={title}>
      <button type="button" className="apple-album-back" onClick={onBack}>
        <AppleIcon name="arrow-left" size={18} />
        <span>Back</span>
      </button>

      <header className="apple-see-all-header">
        <span className="apple-overline">{isAlbums ? "ALBUMS" : "SONGS"}</span>
        <h1>{title}</h1>
        {note && <p>{note}</p>}
      </header>

      {items.length === 0 ? (
        <div className="apple-album-empty">
          <AppleIcon name="music" size={22} />
          <span>There is nothing to show here yet.</span>
        </div>
      ) : isAlbums ? (
        <div className="apple-album-grid">
          {items.map((item, index) => (
            <button
              key={`album-${String(item.id)}`}
              type="button"
              className="apple-album-card"
              onClick={() => onSelectItem(item)}
            >
              <Artwork
                src={getArtworkUrl(item)}
                title={getAlbumTitle(item)}
                tone={ALBUM_TONES[index % ALBUM_TONES.length]}
                className="apple-artwork--album"
              />
              <span className="apple-album-copy">
                <strong>{getAlbumTitle(item)}</strong>
                <small>{item.artist}</small>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <div className="apple-viral-grid">
          {items.map((item, index) => (
            <button
              key={String(item.id)}
              type="button"
              className="apple-viral-row"
              onClick={() => onSelectItem(item)}
            >
              <span className="apple-track-number">
                {String(index + 1).padStart(2, "0")}
              </span>
              <Artwork
                src={getArtworkUrl(item)}
                title={item.title}
                tone={ROW_TONES[index % ROW_TONES.length]}
                className="apple-artwork--row"
              />
              <span className="apple-track-copy">
                <strong>{item.title}</strong>
                <small>{item.artist}</small>
              </span>
              <span className="apple-track-album">{getAlbumLabel(item)}</span>
              <span className="apple-track-action">
                <AppleIcon name="play" size={14} />
              </span>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

export default SeeAllPage;
