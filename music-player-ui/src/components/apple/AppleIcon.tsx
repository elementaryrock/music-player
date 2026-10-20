import type { ReactNode } from "react";

export type AppleIconName =
  | "arrow-left"
  | "chevron-down"
  | "close"
  | "heart"
  | "more"
  | "pause"
  | "play"
  | "skip-back"
  | "skip-forward"
  | "sparkles"
  | "volume-1"
  | "volume-2"
  | "volume-x"
  | "music";

interface AppleIconProps {
  name: AppleIconName;
  size?: number;
  strokeWidth?: number;
  filled?: boolean;
  className?: string;
}

const iconPaths: Record<AppleIconName, ReactNode> = {
  "arrow-left": <path d="M19.5 12H4.5M10.8 5.5 4.3 12l6.5 6.5" />,
  "chevron-down": <path d="m5 8 7 8 7-8" />,
  close: <path d="m6 6 12 12M18 6 6 18" />,
  heart: (
    <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78L12 21.23l8.84-8.84a5.5 5.5 0 0 0 0-7.78Z" />
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="19" cy="12" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  pause: (
    <>
      <path d="M8 5v14M16 5v14" />
    </>
  ),
  play: <path d="m8 5 11 7-11 7V5Z" />,
  "skip-back": <path d="m18 5-9 7 9 7V5ZM6 5v14" />,
  "skip-forward": <path d="m6 5 9 7-9 7V5Zm12 0v14" />,
  sparkles: (
    <>
      <path d="m12 3 1.4 5.6L19 10l-5.6 1.4L12 17l-1.4-5.6L5 10l5.6-1.4L12 3Z" />
      <path d="m19 15 .6 2.4L22 18l-2.4.6L19 21l-.6-2.4L16 18l2.4-.6L19 15Z" />
    </>
  ),
  "volume-1": (
    <>
      <path d="M4 10v4h4l5 4V6L8 10H4Z" />
      <path d="M17 9.5a4 4 0 0 1 0 5" />
    </>
  ),
  "volume-2": (
    <>
      <path d="M4 10v4h4l5 4V6L8 10H4Z" />
      <path d="M17 8a6 6 0 0 1 0 8M20 5a10 10 0 0 1 0 14" />
    </>
  ),
  "volume-x": (
    <>
      <path d="M4 10v4h4l5 4V6L8 10H4Z" />
      <path d="m17 10 4 4m0-4-4 4" />
    </>
  ),
  music: (
    <>
      <path d="M9 18V5l10-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="16" cy="16" r="3" />
    </>
  ),
};

export const AppleIcon = ({
  name,
  size = 24,
  strokeWidth = 1.8,
  filled = false,
  className,
}: AppleIconProps) => (
  <svg
    aria-hidden="true"
    className={className}
    fill={filled && name === "heart" ? "currentColor" : "none"}
    height={size}
    viewBox="0 0 24 24"
    width={size}
    xmlns="http://www.w3.org/2000/svg"
  >
    <g
      fill={filled && name === "heart" ? "currentColor" : "none"}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
    >
      {iconPaths[name]}
    </g>
  </svg>
);
