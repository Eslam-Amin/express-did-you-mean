import type {
  HttpMethod,
  RouteEntry,
  RouteSuggestion,
  SimilarityAlgorithm,
} from '../types.js';
import {
  calculateSegmentSimilarity,
  canonicalizeRoutePattern,
  matchesParameterizedRoute,
  normalizePath,
} from './path-normalizer.js';
import {
  diceSimilarity,
  jaroWinklerSimilarity,
  levenshteinSimilarity,
} from './similarity.js';

/**
 * Options configuring the route ranking and fuzzy matching engine.
 */
export interface RankerOptions {
  /**
   * Minimum similarity threshold (0.0 to 1.0) required to include a route suggestion.
   * @default 0.4
   */
  threshold?: number;

  /**
   * Maximum number of suggestions to return.
   * @default 3
   */
  maxSuggestions?: number;

  /**
   * Similarity algorithm to use for scoring path closeness.
   * @default 'hybrid'
   */
  algorithm?: SimilarityAlgorithm;

  /**
   * Whether route path comparisons should be case-sensitive.
   * @default false
   */
  caseSensitive?: boolean;

  /**
   * Route patterns or regular expressions to exclude from suggestions.
   */
  excludeRoutes?: (string | RegExp)[];

  /**
   * Whitelist of HTTP methods to consider for suggestions.
   */
  includeMethods?: HttpMethod[];

  /**
   * Whether to prioritize routes that match the exact requested path but differ in HTTP method.
   * @default true
   */
  includeMethodMismatches?: boolean;
}

/**
 * Computes path similarity between an incoming request path and a registered route pattern.
 *
 * @param requestPath - Concrete path from the client request.
 * @param routePattern - Registered route pattern template.
 * @param algorithm - String similarity algorithm ('hybrid', 'levenshtein', 'jaro-winkler', or 'dice').
 * @param caseSensitive - Whether path casing should be strictly evaluated.
 * @returns Normalized similarity score from 0.0 to 1.0.
 *
 * @example
 * ```typescript
 * const score = computePathSimilarity('/api/usr', '/api/users', 'hybrid'); // ~0.88
 * ```
 */
export function computePathSimilarity(
  requestPath: string,
  routePattern: string,
  algorithm: SimilarityAlgorithm = 'hybrid',
  caseSensitive = false
): number {
  const normReq = normalizePath(requestPath, caseSensitive);
  const normRoute = canonicalizeRoutePattern(normalizePath(routePattern, caseSensitive));

  if (normReq === normRoute) {
    return 1.0;
  }

  // Check structural parameterized match (e.g. /users/123 vs /users/:id)
  if (matchesParameterizedRoute(normReq, normRoute, caseSensitive)) {
    return 0.98;
  }

  switch (algorithm) {
    case 'levenshtein': {
      const charSim = levenshteinSimilarity(normReq, normRoute);
      const segSim = calculateSegmentSimilarity(
        normReq,
        normRoute,
        levenshteinSimilarity,
        caseSensitive
      );
      return 0.5 * charSim + 0.5 * segSim;
    }
    case 'jaro-winkler': {
      const charSim = jaroWinklerSimilarity(normReq, normRoute);
      const segSim = calculateSegmentSimilarity(
        normReq,
        normRoute,
        jaroWinklerSimilarity,
        caseSensitive
      );
      return 0.4 * charSim + 0.6 * segSim;
    }
    case 'dice': {
      const charSim = diceSimilarity(normReq, normRoute);
      const segSim = calculateSegmentSimilarity(
        normReq,
        normRoute,
        diceSimilarity,
        caseSensitive
      );
      return 0.5 * charSim + 0.5 * segSim;
    }
    case 'hybrid':
    default: {
      const jaro = jaroWinklerSimilarity(normReq, normRoute);
      const lev = levenshteinSimilarity(normReq, normRoute);
      const seg = calculateSegmentSimilarity(
        normReq,
        normRoute,
        jaroWinklerSimilarity,
        caseSensitive
      );
      return 0.5 * seg + 0.3 * jaro + 0.2 * lev;
    }
  }
}

/**
 * Checks if a route path should be excluded based on exclusion rules.
 *
 * @param path - The route path to evaluate.
 * @param exclusions - Array of exact path strings or RegExp patterns.
 * @returns True if the path matches any exclusion rule.
 */
function isExcluded(path: string, exclusions?: (string | RegExp)[]): boolean {
  if (!exclusions || exclusions.length === 0) return false;
  return exclusions.some((pattern) => {
    if (typeof pattern === 'string') {
      return path === pattern || normalizePath(path) === normalizePath(pattern);
    }
    if (pattern instanceof RegExp) {
      return pattern.test(path);
    }
    return false;
  });
}

/**
 * Finds and ranks the closest matching routes for an unregistered request.
 * Prioritizes exact path matches under different HTTP methods, followed by highest similarity scores.
 *
 * @param requestMethod - The HTTP method of the incoming request (e.g. 'GET', 'POST').
 * @param requestPath - The requested URL path (e.g. '/api/v1/usr').
 * @param routes - List of available RouteEntry endpoints discovered from Swagger/Express.
 * @param options - Configuration options for threshold, limit, and algorithm.
 * @returns Sorted array of RouteSuggestion objects meeting the threshold criteria.
 *
 * @example
 * ```typescript
 * const suggestions = rankRoutes('GET', '/api/v1/usr', routes, { maxSuggestions: 3, threshold: 0.4 });
 * ```
 */
export function rankRoutes(
  requestMethod: string,
  requestPath: string,
  routes: RouteEntry[],
  options: RankerOptions = {}
): RouteSuggestion[] {
  const {
    threshold = 0.4,
    maxSuggestions = 3,
    algorithm = 'hybrid',
    caseSensitive = false,
    excludeRoutes = [],
    includeMethods,
    includeMethodMismatches = true,
  } = options;

  const reqMethodUpper = (requestMethod || 'GET').toUpperCase() as HttpMethod;
  const normReqPath = normalizePath(requestPath, caseSensitive);

  const suggestions: RouteSuggestion[] = [];

  for (const route of routes) {
    if (isExcluded(route.path, excludeRoutes)) {
      continue;
    }

    const normRoutePath = normalizePath(route.path, caseSensitive);
    const isExactPathMatch =
      normReqPath === normRoutePath ||
      matchesParameterizedRoute(normReqPath, route.path, caseSensitive);

    // Filter route methods if includeMethods specified
    const availableMethods = route.methods
      .map((m) => m.toUpperCase() as HttpMethod)
      .filter((m) => !includeMethods || includeMethods.includes(m));

    if (availableMethods.length === 0) {
      continue;
    }

    if (isExactPathMatch) {
      const hasMatchingMethod = availableMethods.includes(reqMethodUpper);

      if (hasMatchingMethod) {
        suggestions.push({
          method: reqMethodUpper,
          path: route.path,
          score: 1.0,
          isMethodMismatch: false,
          summary: route.summary,
          description: route.description,
        });
      } else if (includeMethodMismatches) {
        for (const method of availableMethods) {
          suggestions.push({
            method,
            path: route.path,
            score: 1.0,
            isMethodMismatch: true,
            summary: route.summary,
            description: route.description,
          });
        }
      }
      continue;
    }

    const pathSimilarity = computePathSimilarity(
      requestPath,
      route.path,
      algorithm,
      caseSensitive
    );

    if (pathSimilarity < threshold) {
      continue;
    }

    for (const method of availableMethods) {
      const isSameMethod = method === reqMethodUpper;
      const score = isSameMethod
        ? Math.min(1.0, pathSimilarity + 0.05)
        : Math.max(0, pathSimilarity * 0.9);

      if (score >= threshold) {
        suggestions.push({
          method,
          path: route.path,
          score: Math.round(score * 1000) / 1000,
          isMethodMismatch: false,
          summary: route.summary,
          description: route.description,
        });
      }
    }
  }

  const seen = new Set<string>();
  const uniqueSuggestions = suggestions.filter((s) => {
    const key = `${s.method} ${s.path}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  uniqueSuggestions.sort((a, b) => {
    if (a.isMethodMismatch !== b.isMethodMismatch) {
      return a.isMethodMismatch ? -1 : 1;
    }
    if (b.score !== a.score) {
      return b.score - a.score;
    }
    const aMethodMatch = a.method === reqMethodUpper;
    const bMethodMatch = b.method === reqMethodUpper;
    if (aMethodMatch !== bMethodMatch) {
      return aMethodMatch ? -1 : 1;
    }
    return a.path.length - b.path.length;
  });

  return uniqueSuggestions.slice(0, maxSuggestions);
}
