export interface AmbientPalette {
  primary: string;
  secondary: string;
  accent: string;
}

const DEFAULT_PALETTE: AmbientPalette = {
  primary: "#3b2d6d",
  secondary: "#14284a",
  accent: "#a95cff",
};

const clamp = (value: number, minimum: number, maximum: number): number =>
  Math.min(maximum, Math.max(minimum, value));

const componentToHex = (value: number): string =>
  Math.round(clamp(value, 0, 255)).toString(16).padStart(2, "0");

const rgbToHex = (red: number, green: number, blue: number): string =>
  `#${componentToHex(red)}${componentToHex(green)}${componentToHex(blue)}`;

const hslToHex = (hue: number, saturation: number, lightness: number): string => {
  const saturationValue = saturation / 100;
  const lightnessValue = lightness / 100;
  const chroma = (1 - Math.abs(2 * lightnessValue - 1)) * saturationValue;
  const hueSection = ((hue % 360) + 360) % 360 / 60;
  const intermediate = chroma * (1 - Math.abs((hueSection % 2) - 1));
  const match = lightnessValue - chroma / 2;
  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSection < 1) {
    red = chroma;
    green = intermediate;
  } else if (hueSection < 2) {
    red = intermediate;
    green = chroma;
  } else if (hueSection < 3) {
    green = chroma;
    blue = intermediate;
  } else if (hueSection < 4) {
    green = intermediate;
    blue = chroma;
  } else if (hueSection < 5) {
    red = intermediate;
    blue = chroma;
  } else {
    red = chroma;
    blue = intermediate;
  }

  return rgbToHex((red + match) * 255, (green + match) * 255, (blue + match) * 255);
};

const hashString = (value: string): number => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
};

/** A stable palette for artwork that cannot be sampled (or is not available). */
export const getDeterministicPalette = (seed: string): AmbientPalette => {
  const hash = hashString(seed || "music");
  const hue = hash % 360;
  const secondaryHue = (hue + 42 + ((hash >>> 8) % 70)) % 360;

  return {
    primary: hslToHex(hue, 52, 25 + ((hash >>> 16) % 12)),
    secondary: hslToHex(secondaryHue, 50, 16 + ((hash >>> 20) % 12)),
    accent: hslToHex((hue + 150) % 360, 78, 62),
  };
};

const paletteCache = new Map<string, AmbientPalette>();

const loadImage = (source: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    if (typeof Image === "undefined") {
      reject(new Error("Image APIs are unavailable"));
      return;
    }

    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Artwork could not be sampled"));
    image.src = source;
  });

/**
 * Extract a small average palette without adding an image-processing
 * dependency. CORS failures and browser limitations intentionally fall back
 * to a deterministic palette rather than affecting playback UI.
 */
export const extractArtworkPalette = async (
  source: string | undefined,
  fallbackSeed = "music",
): Promise<AmbientPalette> => {
  const fallback = getDeterministicPalette(fallbackSeed);
  if (!source) {
    return fallback;
  }

  const cached = paletteCache.get(source);
  if (cached) {
    return cached;
  }

  try {
    const image = await loadImage(source);
    const canvas = document.createElement("canvas");
    const size = 16;
    canvas.width = size;
    canvas.height = size;
    const context = canvas.getContext("2d", { willReadFrequently: true });

    if (!context || image.naturalWidth === 0 || image.naturalHeight === 0) {
      return fallback;
    }

    context.drawImage(image, 0, 0, size, size);
    const { data } = context.getImageData(0, 0, size, size);
    let redTotal = 0;
    let greenTotal = 0;
    let blueTotal = 0;
    let weightTotal = 0;

    for (let index = 0; index < data.length; index += 4) {
      const alpha = data[index + 3] / 255;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];
      const brightness = (red + green + blue) / (255 * 3);
      const saturation = (Math.max(red, green, blue) - Math.min(red, green, blue)) / 255;
      const weight = alpha * (0.5 + saturation) * (0.45 + brightness);

      redTotal += red * weight;
      greenTotal += green * weight;
      blueTotal += blue * weight;
      weightTotal += weight;
    }

    if (weightTotal === 0) {
      return fallback;
    }

    const red = redTotal / weightTotal;
    const green = greenTotal / weightTotal;
    const blue = blueTotal / weightTotal;
    const primary = rgbToHex(red * 0.75, green * 0.75, blue * 0.75);
    const secondary = rgbToHex(red * 0.38, green * 0.38, blue * 0.55);
    const accent = rgbToHex(
      clamp(red * 1.35 + 22, 0, 255),
      clamp(green * 1.22 + 18, 0, 255),
      clamp(blue * 1.42 + 28, 0, 255),
    );
    const palette = { primary, secondary, accent };
    paletteCache.set(source, palette);
    return palette;
  } catch {
    return fallback;
  }
};

export const defaultAmbientPalette = DEFAULT_PALETTE;
