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
