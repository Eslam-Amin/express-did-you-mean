import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { discoverRoutesAsync, discoverRoutesSync } from './discovery/index.js';
import { defaultFormatResponse, renderHtml404 } from './formatters/index.js';
import { rankRoutes } from './matcher/ranker.js';
import type { DidYouMeanOptions, RouteEntry } from './types.js';

export interface DidYouMeanMiddleware extends RequestHandler {
  /**
   * Manually clears the internal route cache, forcing a re-discovery on the next request.
   */
  clearCache: () => void;

  /**
   * Returns the currently cached routes, if any.
   */
  getCachedRoutes: () => RouteEntry[] | null;
}

/**
 * Determines whether the middleware is enabled based on configuration and environment variables.
 */
export function isMiddlewareEnabled(
  options: DidYouMeanOptions,
  req: Request
): boolean {
  // 1. Explicit functional toggle: (req) => boolean
  if (typeof options.enabled === 'function') {
    return Boolean(options.enabled(req));
  }

  // 2. Explicit boolean toggle
  if (typeof options.enabled === 'boolean') {
    return options.enabled;
  }

  const currentEnv = (process.env.NODE_ENV || 'development').trim();

  // 3. Explicit list of enabled environments
  if (Array.isArray(options.enabledEnvironments) && options.enabledEnvironments.length > 0) {
    return options.enabledEnvironments.includes(currentEnv);
  }

  // 4. Default: Active only in non-production environments
  return currentEnv !== 'production';
}
