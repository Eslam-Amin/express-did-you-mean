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
