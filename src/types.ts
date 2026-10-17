import type { Request, Response, NextFunction } from 'express';

/**
 * Standard HTTP methods supported by Express and OpenAPI.
 */
export type HttpMethod =
  | 'GET'
  | 'POST'
  | 'PUT'
  | 'DELETE'
  | 'PATCH'
  | 'OPTIONS'
  | 'HEAD'
  | (string & {});

/**
 * Discovered route entry representing an available endpoint in the application.
 */
export interface RouteEntry {
  /** The route path template, e.g. '/api/v1/users/:id' or '/api/v1/users' */
  path: string;
  /** Supported HTTP methods for this path */
  methods: HttpMethod[];
  /** Discovery source of this route */
  source: 'swagger' | 'express' | 'manual';
  /** Optional summary from Swagger/OpenAPI */
  summary?: string;
  /** Optional description from Swagger/OpenAPI */
  description?: string;
  /** Optional operationId from Swagger/OpenAPI */
  operationId?: string;
  /** Optional tags from Swagger/OpenAPI */
  tags?: string[];
}

/**
 * A suggested route returned to the client when a 404 occurs.
 */
export interface RouteSuggestion {
  /** The HTTP method of the suggested route */
  method: HttpMethod;
  /** The route path template */
  path: string;
  /** Fuzzy similarity score from 0.0 (no match) to 1.0 (exact match) */
  score: number;
  /** True if the path matches the requested route exactly or structurally, but the HTTP method differs */
  isMethodMismatch: boolean;
  /** Optional summary from OpenAPI spec */
  summary?: string;
  /** Optional description from OpenAPI spec */
  description?: string;
}

/**
 * Available string similarity algorithms.
 */
export type SimilarityAlgorithm = 'levenshtein' | 'jaro-winkler' | 'dice' | 'hybrid';

/**
 * Strategy for discovering routes across the application.
 */
export type RouteDiscoveryStrategy =
  | 'swagger-first'
  | 'swagger-only'
  | 'express-only'
  | 'combine';

/**
 * Swagger / OpenAPI specification input.
 * Can be a parsed JavaScript/JSON object, a local file path, or an HTTP(S) URL.
 */
export type SwaggerDocInput = Record<string, any> | string;

/**
 * Custom response formatting function.
 */
export type FormatResponseFn = (
  suggestions: RouteSuggestion[],
  req: Request
) => any;

/**
 * Custom handler called when a 404 route is intercepted.
 */
export type OnNotFoundHandler = (
  req: Request,
  res: Response,
  suggestions: RouteSuggestion[],
  next: NextFunction
) => void;

/**
 * Configuration options for the `didYouMean` Express middleware.
 */
export interface DidYouMeanOptions {
  /**
   * Swagger 2.0 or OpenAPI 3.x specification.
   * Can be a parsed object, path to a local JSON file, or URL.
   */
  swaggerDoc?: SwaggerDocInput;

  /**
   * Route discovery strategy.
   * @default 'swagger-first'
   */
  discoveryStrategy?: RouteDiscoveryStrategy;

  /**
   * Maximum number of suggestions to return.
   * @default 3
   */
  maxSuggestions?: number;

  /**
   * Minimum similarity threshold (0.0 to 1.0) for a route to be suggested.
   * @default 0.4
   */
  threshold?: number;

  /**
   * Similarity algorithm to use.
   * @default 'hybrid'
   */
  algorithm?: SimilarityAlgorithm;

  /**
   * Explicitly enable or disable the middleware.
   */
  enabled?: boolean | ((req: Request) => boolean);

  /**
   * List of environment names where the middleware should be active.
   */
  enabledEnvironments?: string[];

  /**
   * HTTP status code to return when route is not found.
   * @default 404
   */
  statusCode?: number;

  /**
   * Custom response formatter function.
   */
  formatResponse?: FormatResponseFn;

  /**
   * Custom handler for complete control over the response, headers, or forwarding.
   */
  onNotFound?: OnNotFoundHandler;

  /**
   * Routes or regex patterns to exclude from suggestions.
   */
  excludeRoutes?: (string | RegExp)[];

  /**
   * Filter which HTTP methods should be included in suggestions.
   */
  includeMethods?: HttpMethod[];

  /**
   * Whether route path comparison should be case-sensitive.
   * @default false
   */
  caseSensitive?: boolean;

  /**
   * Whether to cache discovered routes in memory.
   * @default true
   */
  cacheRoutes?: boolean;

  /**
   * Prioritize endpoints that exist on the exact requested path but with different HTTP methods.
   * @default true
   */
  includeMethodMismatches?: boolean;

  /**
   * Optional array of mounted Express sub-applications to inspect.
   */
  subApps?: Array<any>;
}
