/**
 * Normalizes a URL path for consistent routing comparison.
 * - Strips query strings (`?key=val`) and hash fragments (`#section`).
 * - Collapses consecutive forward slashes (e.g. `//api///users` -> `/api/users`).
 * - Trims trailing slash (unless the path is the root `/`).
 * - Normalizes OpenAPI parameter brackets `{param}` to Express format `:param`.
 * - Handles optional case normalization.
 *
 * @param path - The raw URL path string to normalize.
 * @param caseSensitive - Whether path casing should be preserved (default: false).
 * @returns The normalized path string.
 *
 * @example
 * ```typescript
 * normalizePath('//api///users/?page=1#top'); // '/api/users'
 * ```
 */
export function normalizePath(path: string, caseSensitive = false): string {
  if (!path) return '/';

  let cleaned = path;

  // Remove query parameters and hash fragments
  const queryIndex = cleaned.indexOf('?');
  if (queryIndex !== -1) {
    cleaned = cleaned.slice(0, queryIndex);
  }
  const hashIndex = cleaned.indexOf('#');
  if (hashIndex !== -1) {
    cleaned = cleaned.slice(0, hashIndex);
  }

  // Collapse consecutive slashes into single slash
  cleaned = cleaned.replace(/\/+/g, '/');

  // Ensure path starts with a slash
  if (!cleaned.startsWith('/')) {
    cleaned = '/' + cleaned;
  }

  // Remove trailing slash if path length > 1 (keep '/' intact)
  if (cleaned.length > 1 && cleaned.endsWith('/')) {
    cleaned = cleaned.slice(0, -1);
  }

  if (!caseSensitive) {
    cleaned = cleaned.toLowerCase();
  }

  return cleaned;
}

/**
 * Normalizes OpenAPI style path parameters `{param}` into Express-style `:param`.
 *
 * @param pattern - Route pattern containing parameters (e.g. `/users/{userId}/posts/{postId}`).
 * @returns Canonicalized route pattern with Express `:param` placeholders.
 *
 * @example
 * ```typescript
 * canonicalizeRoutePattern('/users/{userId}'); // '/users/:userId'
 * ```
 */
export function canonicalizeRoutePattern(pattern: string): string {
  return pattern.replace(/\{([a-zA-Z0-9_]+)\}/g, ':$1');
}

/**
 * Splits a normalized path into individual non-empty segment strings.
 *
 * @param path - The URL path to decompose into segments.
 * @param caseSensitive - Whether segment casing should be preserved.
 * @returns Array of individual path segment strings.
 *
 * @example
 * ```typescript
 * splitSegments('/api/v1/users/:id'); // ['api', 'v1', 'users', ':id']
 * ```
 */
export function splitSegments(path: string, caseSensitive = false): string[] {
  const normalized = normalizePath(path, caseSensitive);
  if (normalized === '/') return [];
  return normalized.split('/').filter(Boolean);
}

/**
 * Checks if a route segment represents a parameter or wildcard placeholder.
 * Recognizes `:id`, `{userId}`, or wildcard `*`.
 *
 * @param segment - The path segment string to inspect.
 * @returns True if the segment is a dynamic placeholder, false otherwise.
 *
 * @example
 * ```typescript
 * isParamSegment(':userId'); // true
 * isParamSegment('users');   // false
 * ```
 */
export function isParamSegment(segment: string): boolean {
  return (
    segment.startsWith(':') ||
    (segment.startsWith('{') && segment.endsWith('}')) ||
    segment === '*'
  );
}

/**
 * Checks whether an incoming request path matches a parameterized route pattern structurally.
 *
 * @param requestPath - Concrete request path (e.g. `/api/v1/users/123`).
 * @param routePattern - Target route template (e.g. `/api/v1/users/:id`).
 * @param caseSensitive - Whether comparison should be case-sensitive.
 * @returns True if every non-param segment matches and every param segment has a corresponding value.
 *
 * @example
 * ```typescript
 * matchesParameterizedRoute('/api/v1/users/42', '/api/v1/users/:id'); // true
 * ```
 */
export function matchesParameterizedRoute(
  requestPath: string,
  routePattern: string,
  caseSensitive = false
): boolean {
  const reqSegments = splitSegments(requestPath, caseSensitive);
  const routeCanonical = canonicalizeRoutePattern(routePattern);
  const routeSegments = splitSegments(routeCanonical, caseSensitive);

  if (reqSegments.length !== routeSegments.length) {
    return false;
  }

  for (let i = 0; i < routeSegments.length; i++) {
    const routeSeg = routeSegments[i];
    const reqSeg = reqSegments[i];

    if (isParamSegment(routeSeg)) {
      if (!reqSeg || reqSeg.trim() === '') return false;
      continue;
    }

    if (routeSeg !== reqSeg) {
      return false;
    }
  }

  return true;
}

/**
 * Calculates segment-by-segment similarity between a request path and a route template.
 * Parameterized segments in the route pattern match any non-empty request segment with high similarity.
 *
 * @param requestPath - Concrete request path to evaluate.
 * @param routePattern - Target route template.
 * @param segmentSimFn - Underlying string similarity function for comparing individual segments.
 * @param caseSensitive - Whether segment comparison should be case-sensitive.
 * @returns Similarity score between 0.0 and 1.0.
 *
 * @example
 * ```typescript
 * const score = calculateSegmentSimilarity('/api/usr/42', '/api/users/:id', levenshteinSimilarity);
 * ```
 */
export function calculateSegmentSimilarity(
  requestPath: string,
  routePattern: string,
  segmentSimFn: (a: string, b: string) => number,
  caseSensitive = false
): number {
  const reqSegments = splitSegments(requestPath, caseSensitive);
  const routeCanonical = canonicalizeRoutePattern(routePattern);
  const routeSegments = splitSegments(routeCanonical, caseSensitive);

  if (reqSegments.length === 0 && routeSegments.length === 0) {
    return 1.0;
  }

  const maxLen = Math.max(reqSegments.length, routeSegments.length);
  if (maxLen === 0) return 1.0;

  const lengthPenalty = Math.abs(reqSegments.length - routeSegments.length) / maxLen;

  let totalScore = 0;
  const minLen = Math.min(reqSegments.length, routeSegments.length);

  for (let i = 0; i < minLen; i++) {
    const rSeg = reqSegments[i];
    const tSeg = routeSegments[i];

    if (isParamSegment(tSeg)) {
      totalScore += 0.95;
    } else {
      totalScore += segmentSimFn(rSeg, tSeg);
    }
  }

  const averageSegmentScore = totalScore / maxLen;
  const finalScore = Math.max(0, averageSegmentScore * (1 - lengthPenalty * 0.3));

  return Math.min(1.0, finalScore);
}
