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
