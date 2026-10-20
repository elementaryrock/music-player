import { useEffect, useState } from "react";

export type Tone = "coral" | "lavender" | "mint" | "blue" | "sunset" | "peach";

const getInitials = (value: string, fallback = "♪") => {
  const initials = value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  return initials || fallback;
};

export interface ArtworkProps {
  src?: string;
  title: string;
  tone?: Tone;
  className?: string;
  initials?: string;
}

/**
 * Cover art with a deterministic gradient fallback so a broken or missing
 * image still reads as a designed tile instead of an empty box.
 */
export function Artwork({
  src,
  title,
  tone = "lavender",
  className = "",
  initials,
}: ArtworkProps) {
  const [imageAvailable, setImageAvailable] = useState(Boolean(src));

  useEffect(() => {
    setImageAvailable(Boolean(src));
  }, [src]);

  return (
    <div className={`apple-artwork apple-artwork--${tone} ${className}`.trim()}>
      {src && imageAvailable ? (
        <img
          src={src}
          alt={`${title} artwork`}
          loading="lazy"
          onError={() => setImageAvailable(false)}
        />
      ) : (
        <span aria-hidden="true">{initials || getInitials(title)}</span>
      )}
    </div>
  );
}
