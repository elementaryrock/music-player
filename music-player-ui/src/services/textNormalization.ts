/**
 * Shared text normalization for metadata matching.
 *
 * Search keys, album matching and provider comparisons must agree on how a
 * title is folded, so the normalization lives in one module that every
 * metadata service can depend on without pulling in a provider client.
 */
export const normalizeSearchText = (value: unknown): string =>
  (typeof value === "string" ? value : value == null ? "" : String(value))
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[’'`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
