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
