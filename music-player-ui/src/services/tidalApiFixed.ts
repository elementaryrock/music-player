/**
 * Optional Tidal API service.
 *
 * Tidal is a useful metadata/stream source, but it is not required for the
 * rest of the player to work.  The public methods in this module therefore
 * fail closed: an unavailable endpoint returns null/[] instead of making a
 * search or a playback resolution wait for a chain of dead fallbacks.
 */

import {
  TidalQuality,
  TidalSearchResponse,
  TidalSongResponse,
  TidalTrackResponse,
  TidalCoverResponse,
  TidalLyricsResponse,
  convertTidalTrackToTrack,
  Track,
} from "../types/tidal.types";

type TidalEndpointType = "proxy" | "direct";

interface TidalEndpoint {
  url: string;
  type: TidalEndpointType;
  name: string;
  /** Keep browser requests CORS-simple.  Content-Type/User-Agent trigger or
   * are forbidden in browser preflight requests and are not needed for GET. */
  headers: Record<string, string>;
}

interface ConnectionHealth {
  endpoint: string;
  lastSuccess: number | null;
  lastFailure: number | null;
  consecutiveFailures: number;
  isHealthy: boolean;
}

interface ProbeFeatures {
  search: boolean;
  trackById: boolean;
  streaming: boolean;
}

interface EndpointProbe {
  responseTime: number;
  features: ProbeFeatures;
}

// SearchEngine and the track resolver apply their own provider deadlines.  A
// direct caller should get the same bounded behavior instead of inheriting a
// 15 second timeout for every fallback.
const REQUEST_TIMEOUT_MS = 1800;
const OPERATION_TIMEOUT_MS = 2000;
const DIAGNOSTIC_TIMEOUT_MS = 2200;
const ENDPOINT_FAILURE_COOLDOWN_MS = 30_000;
const MAX_ENDPOINT_ATTEMPTS = 2;

const TIDAL_REQUEST_HEADERS = {
  Accept: "application/json",
};

const readViteEnv = (): Record<string, unknown> => {
  try {
    return (
      import.meta as ImportMeta & { env?: Record<string, unknown> }
    ).env ?? {};
  } catch {
    // This keeps the service importable from non-Vite tooling as well.
    return {};
  }
};

const normalizeEndpointUrl = (value: string): string | null => {
  const trimmed = value.trim().replace(/\/+$/, "");
  if (!trimmed) return null;

  // Only explicit HTTP(S) URLs and explicit same-origin proxy paths are
  // accepted.  The old allorigins URL and the legacy DNS-failed host are never
  // part of the default candidate list.
  if (trimmed.startsWith("/")) {
    return trimmed === "/api/tidal-backup" ? null : trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (
      parsed.hostname === "tidal.401658.xyz" ||
      parsed.hostname === "api.allorigins.win"
    ) {
      return null;
    }
    return parsed.toString().replace(/\/+$/, "");
  } catch {
    return null;
  }
};

const readConfiguredEndpointUrls = (): string[] => {
  const configured = readViteEnv().VITE_TIDAL_API_URL;
  if (typeof configured !== "string") return [];

  return configured
    .split(",")
    .map(normalizeEndpointUrl)
    .filter((value): value is string => Boolean(value));
};

const endpointUrls = readConfiguredEndpointUrls()
  .map(normalizeEndpointUrl)
  .filter((value): value is string => Boolean(value))
  .filter((value, index, values) => values.indexOf(value) === index);

// No Tidal endpoint is enabled by default. A configured endpoint can be
// supplied through VITE_TIDAL_API_URL (for example a known good self-hosted
// proxy), and gets at most one bounded fallback attempt. This prevents a
// known redirecting public host from producing browser CORS errors on every
// search while keeping Tidal available for deployments that control a proxy.
const TIDAL_ENDPOINTS: TidalEndpoint[] = endpointUrls.map((url) => ({
  url,
  type: url.startsWith("/") ? "proxy" : "direct",
  name: url.startsWith("/") ? "Configured Tidal Proxy" : "Configured Tidal API",
  headers: TIDAL_REQUEST_HEADERS,
}));

let currentEndpointIndex = 0;

const endpointHealth = new Map<string, ConnectionHealth>();

TIDAL_ENDPOINTS.forEach((endpoint) => {
  endpointHealth.set(endpoint.url, {
    endpoint: endpoint.url,
    lastSuccess: null,
    lastFailure: null,
    consecutiveFailures: 0,
    isHealthy: true,
  });
});

const createError = (message: string, name = "Error"): Error => {
  const error = new Error(message);
  error.name = name;
  return error;
};

const hasStreamingUrl = (data: unknown): boolean => {
  const records = Array.isArray(data) ? data : [data];
  return records.some((record) => {
    if (!record || typeof record !== "object") return false;
    const candidate = record as Record<string, unknown>;
    return typeof candidate.OriginalTrackUrl === "string" &&
      candidate.OriginalTrackUrl.length > 0;
  });
};

const buildApiUrl = (endpoint: TidalEndpoint, path: string): string =>
  `${endpoint.url}${path.startsWith("/") ? path : `/${path}`}`;

/**
 * Fetch JSON with both an AbortController and a Promise race.  The race keeps
 * tests and unusual fetch implementations bounded even when an underlying
 * request does not honor abort immediately.
 */
const fetchJson = async <T>(
  endpoint: TidalEndpoint,
  path: string,
  options: RequestInit = {},
  timeoutMs: number,
): Promise<T> => {
  const controller = new AbortController();
  const sourceSignal = options.signal;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let abortHandler: (() => void) | undefined;

  if (sourceSignal?.aborted) {
    throw createError("The Tidal request was aborted", "AbortError");
  }

  if (sourceSignal) {
    abortHandler = () => controller.abort();
    sourceSignal.addEventListener("abort", abortHandler, { once: true });
  }

  const requestHeaders = new Headers(options.headers);
  requestHeaders.set("Accept", "application/json");
  // All current Tidal calls are GETs.  Do not recreate the old JSON header
  // that caused a browser CORS preflight against the redirecting host.
  requestHeaders.delete("Content-Type");

  const request = fetch(buildApiUrl(endpoint, path), {
    ...options,
    headers: requestHeaders,
    signal: controller.signal,
  });

  const timeout = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(createError("Tidal request timed out", "TimeoutError"));
    }, Math.max(1, timeoutMs));
  });

  try {
    const response = await Promise.race([request, timeout]);

    // A redirect to GitHub (or any other unrelated origin) is a failed
    // provider response, not a usable endpoint.  Refusing redirects also
    // avoids turning a configured proxy into a CORS failure loop.
    if (response.redirected || response.type === "opaqueredirect") {
      throw createError("Tidal endpoint redirected", "RedirectError");
    }

    if (!response.ok) {
      throw createError(
        `Tidal endpoint returned HTTP ${response.status}: ${response.statusText || "Request failed"}`,
        "HttpError",
      );
    }

    return await response.json() as T;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
    if (sourceSignal && abortHandler) {
      sourceSignal.removeEventListener("abort", abortHandler);
    }
  }
};

const updateEndpointHealth = (endpointUrl: string, success: boolean): void => {
  const health = endpointHealth.get(endpointUrl);
  if (!health) return;

  const now = Date.now();
  if (success) {
    health.lastSuccess = now;
    health.consecutiveFailures = 0;
    health.isHealthy = true;
    return;
  }

  health.lastFailure = now;
  health.consecutiveFailures += 1;
  health.isHealthy = false;
};

const endpointCanBeAttempted = (endpoint: TidalEndpoint, force = false): boolean => {
  const health = endpointHealth.get(endpoint.url);
  if (!health || force) return true;

  if (
    health.lastFailure !== null &&
    Date.now() - health.lastFailure < ENDPOINT_FAILURE_COOLDOWN_MS
  ) {
    return false;
  }

  // The circuit is half-open after its cooldown.  A single request is then
  // allowed to prove that the endpoint has recovered.
  health.isHealthy = true;
  return true;
};

const getEndpointCandidates = (force = false): TidalEndpoint[] => {
  const orderedIndices = [
    currentEndpointIndex,
    ...TIDAL_ENDPOINTS.map((_, index) => index),
  ];
  const seen = new Set<number>();

  return orderedIndices
    .filter((index) => {
      if (seen.has(index) || !TIDAL_ENDPOINTS[index]) return false;
      seen.add(index);
      return true;
    })
    .map((index) => TIDAL_ENDPOINTS[index])
    .filter((endpoint): endpoint is TidalEndpoint =>
      Boolean(endpoint) && endpointCanBeAttempted(endpoint, force)
    );
};

const setCurrentEndpoint = (endpoint: TidalEndpoint): void => {
  const index = TIDAL_ENDPOINTS.indexOf(endpoint);
  if (index >= 0) {
    currentEndpointIndex = index;
  }
};

/**
 * Make one bounded request.  Normal application requests skip an endpoint
 * during its cooldown, so repeated searches do not keep hitting a dead host.
 */
const makeRobustRequest = async <T>(
  path: string,
  options: RequestInit = {},
): Promise<T> => {
  const candidates = getEndpointCandidates(false).slice(0, MAX_ENDPOINT_ATTEMPTS);
  if (candidates.length === 0) {
    throw createError("Tidal is unavailable", "TidalUnavailableError");
  }

  const deadline = Date.now() + OPERATION_TIMEOUT_MS;
  let lastError: Error | null = null;

  for (const endpoint of candidates) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;

    try {
      const data = await fetchJson<T>(
        endpoint,
        path,
        options,
        Math.min(REQUEST_TIMEOUT_MS, remaining),
      );
      updateEndpointHealth(endpoint.url, true);
      setCurrentEndpoint(endpoint);
      return data;
    } catch (error) {
      lastError = error instanceof Error ? error : createError("Tidal request failed");
      updateEndpointHealth(endpoint.url, false);
    }
  }

  throw lastError ?? createError("Tidal is unavailable", "TidalUnavailableError");
};

const probeEndpoint = async (
  endpoint: TidalEndpoint,
  timeoutMs: number,
  includeTrackCheck: boolean,
): Promise<EndpointProbe> => {
  const startTime = Date.now();
  const deadline = startTime + timeoutMs;
  const features: ProbeFeatures = {
    search: false,
    trackById: false,
    streaming: false,
  };

  const searchData = await fetchJson<any>(
    endpoint,
    "/search/?s=test&limit=1",
    {},
    Math.max(1, deadline - Date.now()),
  );
  features.search = true;

  const firstTrack = Array.isArray(searchData?.items)
    ? searchData.items[0]
    : undefined;
  if (includeTrackCheck && firstTrack?.id !== undefined && Date.now() < deadline) {
    try {
      const trackData = await fetchJson<any>(
        endpoint,
        `/track/?id=${encodeURIComponent(String(firstTrack.id))}&quality=HIGH`,
        {},
        Math.max(1, deadline - Date.now()),
      );
      features.trackById = true;
      features.streaming = hasStreamingUrl(trackData);
    } catch {
      // Search connectivity is still useful diagnostic information when the
      // optional stream endpoint is unavailable.
    }
  }

  return {
    responseTime: Date.now() - startTime,
    features,
  };
};

/**
 * Probe the configured endpoint(s) explicitly.  Unlike normal requests this
 * bypasses the circuit cooldown because calling a diagnostic function is an
 * intentional request to retry.  It is still limited to two endpoints and a
 * short per-endpoint deadline.
 */
export const testTidalApiConnection = async (): Promise<{
  success: boolean;
  endpoint?: string;
  error?: string;
  diagnostics: Array<{
    endpoint: string;
    success: boolean;
    responseTime?: number;
    error?: string;
    features?: ProbeFeatures;
  }>;
}> => {
  const diagnostics: Array<{
    endpoint: string;
    success: boolean;
    responseTime?: number;
    error?: string;
    features?: ProbeFeatures;
  }> = [];

  const candidates = getEndpointCandidates(true).slice(0, MAX_ENDPOINT_ATTEMPTS);
  for (const endpoint of candidates) {
    const startTime = Date.now();
    try {
      const probe = await probeEndpoint(endpoint, DIAGNOSTIC_TIMEOUT_MS, true);
      updateEndpointHealth(endpoint.url, true);
      setCurrentEndpoint(endpoint);
      diagnostics.push({
        endpoint: endpoint.name,
        success: true,
        responseTime: probe.responseTime,
        features: probe.features,
      });
      return {
        success: true,
        endpoint: endpoint.name,
        diagnostics,
      };
    } catch (error) {
      const failure = error instanceof Error ? error : createError("Tidal request failed");
      updateEndpointHealth(endpoint.url, false);
      diagnostics.push({
        endpoint: endpoint.name,
        success: false,
        responseTime: Date.now() - startTime,
        error: failure.message,
      });
    }
  }

  return {
    success: false,
    error: "No Tidal endpoint is available",
    diagnostics,
  };
};

/**
 * Search for songs.  Tidal being unavailable is a normal optional-provider
 * state, so callers receive null and can continue with another index.
 */
export const searchTidalSongs = async (
  query: string,
  limit = 10,
  offset = 0,
): Promise<TidalSearchResponse | null> => {
  if (!query.trim()) return null;

  try {
    const searchParams = new URLSearchParams({
      s: query,
      limit: String(Math.max(0, limit)),
      offset: String(Math.max(0, offset)),
    });
    return await makeRobustRequest<TidalSearchResponse>(
      `/search/?${searchParams.toString()}`,
    );
  } catch {
    return null;
  }
};

/** Retrieve a song and its streaming URL when the optional endpoint supports it. */
export const getTidalSong = async (
  query: string,
  quality: TidalQuality = "LOSSLESS",
): Promise<TidalSongResponse | null> => {
  if (!query.trim()) return null;

  try {
    const data = await makeRobustRequest<TidalSongResponse | TidalSongResponse[]>(
      `/song/?q=${encodeURIComponent(query)}&quality=${quality}`,
    );
    return Array.isArray(data) ? data[0] ?? null : data ?? null;
  } catch {
    return null;
  }
};

/** Retrieve a track by id and merge the stream URL returned by HiFi-style APIs. */
export const getTidalTrackById = async (
  trackId: number,
  quality: TidalQuality = "LOSSLESS",
  country = "US",
): Promise<TidalTrackResponse | null> => {
  if (!Number.isFinite(trackId)) return null;

  try {
    const data = await makeRobustRequest<any>(
      `/track/?id=${encodeURIComponent(String(trackId))}&quality=${quality}&country=${encodeURIComponent(country)}`,
    );

    if (Array.isArray(data) && data.length >= 2) {
      const trackInfo = data[0];
      const urlObject = data.find((item: any) => item?.OriginalTrackUrl);
      if (urlObject?.OriginalTrackUrl) {
        return {
          ...trackInfo,
          OriginalTrackUrl: urlObject.OriginalTrackUrl,
        } as TidalTrackResponse;
      }
    }

    return data as TidalTrackResponse;
  } catch {
    return null;
  }
};

/** Retrieve cover art metadata when supported by the endpoint. */
export const getTidalCover = async (
  query: string | number,
): Promise<TidalCoverResponse[] | null> => {
  try {
    const queryParam = typeof query === "number"
      ? `id=${encodeURIComponent(String(query))}`
      : `q=${encodeURIComponent(query)}`;
    return await makeRobustRequest<TidalCoverResponse[]>(`/cover/?${queryParam}`);
  } catch {
    return null;
  }
};

/** Retrieve lyrics metadata when supported by the endpoint. */
export const getTidalLyrics = async (
  trackId: number,
): Promise<TidalLyricsResponse | null> => {
  if (!Number.isFinite(trackId)) return null;

  try {
    const data = await makeRobustRequest<TidalLyricsResponse | TidalLyricsResponse[]>(
      `/lyrics/?id=${encodeURIComponent(String(trackId))}`,
    );
    return Array.isArray(data) ? data[0] ?? null : data ?? null;
  } catch {
    return null;
  }
};

/** Search metadata and resolve a bounded set of playable Tidal tracks. */
export const searchAndGetTidalSongs = async (
  query: string,
  quality: TidalQuality = "LOSSLESS",
  limit = 10,
): Promise<Track[]> => {
  const searchResults = await searchTidalSongs(query, limit, 0);
  if (!Array.isArray(searchResults?.items) || searchResults.items.length === 0) {
    return [];
  }

  const tracks: Track[] = [];
  for (const searchTrack of searchResults.items.slice(0, Math.max(0, limit))) {
    try {
      const trackData = await getTidalTrackById(searchTrack.id, quality);
      if (trackData?.OriginalTrackUrl) {
        tracks.push(convertTidalTrackToTrack(searchTrack, trackData.OriginalTrackUrl));
      }
    } catch {
      // A malformed optional-provider item must not reject the whole result.
    }
  }
  return tracks;
};

/** Search and resolve one strictly selected Tidal recording. */
export const searchTidalSongDirect = async (
  query: string,
  quality: TidalQuality = "LOSSLESS",
): Promise<Track | null> => {
  const trackName = query.trim();
  if (!trackName) return null;

  const searchResults = await searchTidalSongs(trackName, 1, 0);
  const firstResult = searchResults?.items?.[0];
  if (!firstResult) return null;

  try {
    const trackData = await getTidalTrackById(firstResult.id, quality);
    if (!trackData?.OriginalTrackUrl) return null;

    const track = convertTidalTrackToTrack(firstResult, trackData.OriginalTrackUrl);
    const lyricsData = await getTidalLyrics(firstResult.id);
    if (lyricsData?.subtitles && typeof btoa === "function") {
      try {
        track.lrcUrl = `data:text/plain;base64,${btoa(lyricsData.subtitles)}`;
      } catch {
        // Lyrics are optional; an encoding failure must not hide the track.
      }
    }
    return track;
  } catch {
    return null;
  }
};

/** Return a snapshot of the optional endpoint circuit state. */
export const getTidalEndpointHealth = (): Array<{
  name: string;
  url: string;
  isHealthy: boolean;
  lastSuccess: Date | null;
  lastFailure: Date | null;
  consecutiveFailures: number;
}> => TIDAL_ENDPOINTS.map((endpoint) => {
  const health = endpointHealth.get(endpoint.url)!;
  return {
    name: endpoint.name,
    url: endpoint.url,
    isHealthy: health.isHealthy,
    lastSuccess: health.lastSuccess ? new Date(health.lastSuccess) : null,
    lastFailure: health.lastFailure ? new Date(health.lastFailure) : null,
    consecutiveFailures: health.consecutiveFailures,
  };
});

/** Clear the circuit so an explicit user retry can probe Tidal again. */
export const resetTidalEndpointHealth = (): void => {
  endpointHealth.forEach((health) => {
    health.isHealthy = true;
    health.consecutiveFailures = 0;
    health.lastSuccess = null;
    health.lastFailure = null;
  });
  currentEndpointIndex = 0;
};

/**
 * Run a bounded diagnostic pass over the configured endpoint(s).  This is an
 * explicit diagnostic operation, so it may bypass the normal cooldown, but it
 * never probes more than two candidates.
 */
export const runTidalDiagnostics = async (): Promise<{
  overall: {
    success: boolean;
    workingEndpoints: number;
    totalEndpoints: number;
    recommendedEndpoint?: string;
    issues: string[];
  };
  endpoints: Array<{
    name: string;
    url: string;
    status: "healthy" | "degraded" | "failed";
    responseTime?: number;
    features: ProbeFeatures;
    lastError?: string;
  }>;
  recommendations: string[];
}> => {
  const endpointResults: Array<{
    name: string;
    url: string;
    status: "healthy" | "degraded" | "failed";
    responseTime?: number;
    features: ProbeFeatures;
    lastError?: string;
  }> = [];
  const candidates = getEndpointCandidates(true).slice(0, MAX_ENDPOINT_ATTEMPTS);

  for (const endpoint of candidates) {
    try {
      const probe = await probeEndpoint(endpoint, DIAGNOSTIC_TIMEOUT_MS, true);
      const status = probe.features.search && probe.features.trackById && probe.features.streaming
        ? "healthy"
        : probe.features.search
          ? "degraded"
          : "failed";
      updateEndpointHealth(endpoint.url, true);
      if (status !== "failed") setCurrentEndpoint(endpoint);
      endpointResults.push({
        name: endpoint.name,
        url: endpoint.url,
        status,
        responseTime: probe.responseTime,
        features: probe.features,
      });
    } catch (error) {
      const failure = error instanceof Error ? error : createError("Tidal request failed");
      updateEndpointHealth(endpoint.url, false);
      endpointResults.push({
        name: endpoint.name,
        url: endpoint.url,
        status: "failed",
        responseTime: undefined,
        features: { search: false, trackById: false, streaming: false },
        lastError: failure.message,
      });
    }
  }

  const workingEndpoints = endpointResults.filter((result) => result.status !== "failed").length;
  const healthyEndpoint = endpointResults.find((result) => result.status === "healthy");
  const degradedEndpoint = endpointResults.find((result) => result.status === "degraded");
  const issues: string[] = [];
  const recommendations: string[] = [];

  if (workingEndpoints === 0) {
    issues.push("Tidal is unavailable");
    recommendations.push("Continue without Tidal or configure a working VITE_TIDAL_API_URL endpoint");
  } else if (workingEndpoints < endpointResults.length) {
    issues.push("Some configured Tidal endpoints are unavailable");
  }

  if (endpointResults.some((result) =>
    result.features.search && result.features.trackById && !result.features.streaming
  )) {
    issues.push("Tidal stream resolution is unavailable");
    recommendations.push("Tidal search works, but another audio provider may be needed for playback");
  }

  return {
    overall: {
      success: workingEndpoints > 0,
      workingEndpoints,
      totalEndpoints: TIDAL_ENDPOINTS.length,
      recommendedEndpoint: healthyEndpoint?.name ?? degradedEndpoint?.name,
      issues,
    },
    endpoints: endpointResults,
    recommendations,
  };
};

/** Reset the circuit and perform one explicit bounded connection check. */
export const autoFixTidalIssues = async (): Promise<{
  success: boolean;
  actionsPerformed: string[];
  remainingIssues: string[];
}> => {
  resetTidalEndpointHealth();
  const actionsPerformed = ["Reset endpoint health status"];
  const connectionTest = await testTidalApiConnection();

  if (connectionTest.success) {
    actionsPerformed.push(`Successfully connected to ${connectionTest.endpoint}`);
    return { success: true, actionsPerformed, remainingIssues: [] };
  }

  return {
    success: false,
    actionsPerformed,
    remainingIssues: [connectionTest.error ?? "No Tidal endpoint is available"],
  };
};

// Export legacy names for compatibility with existing callers.
export const loadTidalSong = searchTidalSongDirect;
export const loadTidalTrackById = getTidalTrackById;

// Make the explicit diagnostic functions available in the browser console.
if (typeof window !== "undefined") {
  (window as any).testTidalConnection = testTidalApiConnection;
  (window as any).getTidalHealth = getTidalEndpointHealth;
  (window as any).resetTidalHealth = resetTidalEndpointHealth;
  (window as any).runTidalDiagnostics = runTidalDiagnostics;
  (window as any).autoFixTidal = autoFixTidalIssues;
}
