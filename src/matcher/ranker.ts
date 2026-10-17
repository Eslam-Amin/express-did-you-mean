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

export interface RankerOptions {
  threshold?: number;
  maxSuggestions?: number;
  algorithm?: SimilarityAlgorithm;
  caseSensitive?: boolean;
  excludeRoutes?: (string | RegExp)[];
  includeMethods?: HttpMethod[];
  includeMethodMismatches?: boolean;
}

/**
 * Computes path similarity using the selected algorithm.
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
 * Finds and ranks the closest matching routes for a given request.
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
