/**
 * Normalizes a URL path for consistent routing comparison.
 * - Strips query strings (?key=val) and hash fragments (#section)
 * - Collapses consecutive forward slashes (e.g. //api///users -> /api/users)
 * - Trims trailing slash (unless the path is simply '/')
 * - Normalizes OpenAPI parameter brackets {param} to Express format :param
 * - Handles optional case normalization
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
 * Normalizes OpenAPI style path parameters {param} into Express-style :param.
 */
export function canonicalizeRoutePattern(pattern: string): string {
  // Convert /users/{userId}/posts/{postId} -> /users/:userId/posts/:postId
  return pattern.replace(/\{([a-zA-Z0-9_]+)\}/g, ':$1');
}

/**
 * Splits a normalized path into individual non-empty segment strings.
 * E.g. '/api/v1/users/:id' -> ['api', 'v1', 'users', ':id']
 */
export function splitSegments(path: string, caseSensitive = false): string[] {
  const normalized = normalizePath(path, caseSensitive);
  if (normalized === '/') return [];
  return normalized.split('/').filter(Boolean);
}

/**
 * Checks if a route segment represents a parameter placeholder.
 * E.g. ':id', ':userId(\\d+)', '{id}', '*'
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
 * Example:
 *   request: '/api/v1/users/123'
 *   route:   '/api/v1/users/:id'
 * Returns true if every non-param segment matches and every param segment has a corresponding value.
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
