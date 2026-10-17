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

/**
 * Creates an Express 404 "Did-You-Mean" middleware.
 *
 * @example
 * ```typescript
 * import express from 'express';
 * import { didYouMean } from 'express-did-you-mean';
 *
 * const app = express();
 * // ... routes ...
 *
 * app.use(didYouMean({
 *   swaggerDoc: swaggerSpec,
 *   maxSuggestions: 3,
 *   threshold: 0.4
 * }));
 * ```
 */
export function didYouMean(options: DidYouMeanOptions = {}): DidYouMeanMiddleware {
  const {
    threshold = 0.4,
    maxSuggestions = 3,
    algorithm = 'hybrid',
    caseSensitive = false,
    statusCode = 404,
    cacheRoutes = true,
    excludeRoutes = [],
    includeMethods,
    includeMethodMismatches = true,
    formatResponse,
    onNotFound,
  } = options;

  let cachedRoutes: RouteEntry[] | null = null;
  let discoveryPromise: Promise<RouteEntry[]> | null = null;

  const middleware = (async (
    req: Request,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    // Zero-overhead guardrail: If disabled (e.g. in Production), pass to next 404 immediately
    if (!isMiddlewareEnabled(options, req)) {
      return next();
    }

    try {
      let routes: RouteEntry[];

      if (cacheRoutes && cachedRoutes) {
        routes = cachedRoutes;
      } else {
        const isRemoteSwagger =
          typeof options.swaggerDoc === 'string' &&
          (options.swaggerDoc.startsWith('http://') ||
            options.swaggerDoc.startsWith('https://'));

        if (isRemoteSwagger) {
          if (!discoveryPromise) {
            discoveryPromise = discoverRoutesAsync(req.app, options);
          }
          routes = await discoveryPromise;
        } else {
          routes = discoverRoutesSync(req.app, options);
        }

        if (cacheRoutes) {
          cachedRoutes = routes;
        }
      }

      // Rank candidate routes against the incoming requested method and path
      const suggestions = rankRoutes(req.method, req.path, routes, {
        threshold,
        maxSuggestions,
        algorithm,
        caseSensitive,
        excludeRoutes,
        includeMethods,
        includeMethodMismatches,
      });

      // Delegate to custom onNotFound handler if provided
      if (typeof onNotFound === 'function') {
        return onNotFound(req, res, suggestions, next);
      }

      // Check for custom formatter
      if (typeof formatResponse === 'function') {
        const customPayload = formatResponse(suggestions, req);
        res.status(statusCode).json(customPayload);
        return;
      }

      // Check content negotiation: HTML vs JSON
      const acceptsHtml = req.accepts && req.accepts('html') && !req.accepts('json');
      if (acceptsHtml) {
        res.status(statusCode).type('html').send(renderHtml404(suggestions, req));
        return;
      }

      // Default JSON response
      const payload = defaultFormatResponse(suggestions, req);
      res.status(statusCode).json(payload);
    } catch (error) {
      // If error occurs during discovery or ranking, do not crash; pass to error handler
      next(error);
    }
  }) as DidYouMeanMiddleware;

  middleware.clearCache = () => {
    cachedRoutes = null;
    discoveryPromise = null;
  };

  middleware.getCachedRoutes = () => cachedRoutes;

  return middleware;
}
