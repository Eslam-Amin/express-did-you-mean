import type { Application, Request } from 'express';
import type { DidYouMeanOptions, HttpMethod, RouteDiscoveryStrategy, RouteEntry } from '../types.js';
import { extractExpressRoutes } from './express.js';
import { parseSwaggerDoc, parseSwaggerDocSync } from './swagger.js';

export * from './express.js';
export * from './swagger.js';

/**
 * Merges two lists of RouteEntry objects, deduplicating paths and combining HTTP methods.
 * Items in `primary` take priority for metadata such as summary, description, and source.
 *
 * @param primary - Primary route list (e.g. from Swagger/OpenAPI).
 * @param secondary - Secondary route list (e.g. from Express router stack).
 * @returns Merged array of unique RouteEntry definitions.
 *
 * @example
 * ```typescript
 * const combined = mergeRouteEntries(swaggerRoutes, expressRoutes);
 * ```
 */
export function mergeRouteEntries(
  primary: RouteEntry[],
  secondary: RouteEntry[]
): RouteEntry[] {
  const map = new Map<string, RouteEntry>();

  for (const r of primary) {
    map.set(r.path, {
      ...r,
      methods: [...r.methods],
    });
  }

  for (const s of secondary) {
    if (map.has(s.path)) {
      const existing = map.get(s.path)!;
      const combinedMethods = new Set<HttpMethod>([
        ...existing.methods,
        ...s.methods,
      ]);
      existing.methods = Array.from(combinedMethods);
      if (!existing.summary && s.summary) existing.summary = s.summary;
      if (!existing.description && s.description) existing.description = s.description;
    } else {
      map.set(s.path, {
        ...s,
        methods: [...s.methods],
      });
    }
  }

  return Array.from(map.values());
}

/**
 * Synchronously discovers routes across Swagger specs and Express router stacks according to the requested strategy.
 *
 * @param app - Express Application instance or Router.
 * @param options - Middleware options containing swaggerDoc and discoveryStrategy.
 * @returns Array of discovered RouteEntry items.
 *
 * @example
 * ```typescript
 * const routes = discoverRoutesSync(app, { swaggerDoc: spec, discoveryStrategy: 'swagger-first' });
 * ```
 */
export function discoverRoutesSync(
  app: Application | any,
  options: DidYouMeanOptions = {}
): RouteEntry[] {
  const strategy: RouteDiscoveryStrategy = options.discoveryStrategy || 'swagger-first';
  const hasSwaggerDoc = Boolean(options.swaggerDoc);

  let swaggerRoutes: RouteEntry[] = [];
  if (hasSwaggerDoc && strategy !== 'express-only') {
    swaggerRoutes = parseSwaggerDocSync(options.swaggerDoc!);
  }

  if (strategy === 'swagger-only') {
    return swaggerRoutes;
  }

  const expressRoutes = extractExpressRoutes(app, options.subApps);

  if (strategy === 'express-only') {
    return expressRoutes;
  }

  if (strategy === 'combine') {
    return mergeRouteEntries(swaggerRoutes, expressRoutes);
  }

  // Default: 'swagger-first'
  if (swaggerRoutes.length > 0) {
    return mergeRouteEntries(swaggerRoutes, expressRoutes);
  }

  return expressRoutes;
}

/**
 * Asynchronously discovers routes across Swagger specs (supporting remote URLs) and Express router stacks.
 *
 * @param app - Express Application instance or Router.
 * @param options - Middleware options containing swaggerDoc and discoveryStrategy.
 * @returns Promise resolving to an array of discovered RouteEntry items.
 *
 * @example
 * ```typescript
 * const routes = await discoverRoutesAsync(app, { swaggerDoc: 'https://api.example.com/spec.json' });
 * ```
 */
export async function discoverRoutesAsync(
  app: Application | any,
  options: DidYouMeanOptions = {}
): Promise<RouteEntry[]> {
  const strategy: RouteDiscoveryStrategy = options.discoveryStrategy || 'swagger-first';
  const hasSwaggerDoc = Boolean(options.swaggerDoc);

  let swaggerRoutes: RouteEntry[] = [];
  if (hasSwaggerDoc && strategy !== 'express-only') {
    swaggerRoutes = await parseSwaggerDoc(options.swaggerDoc!);
  }

  if (strategy === 'swagger-only') {
    return swaggerRoutes;
  }

  const expressRoutes = extractExpressRoutes(app, options.subApps);

  if (strategy === 'express-only') {
    return expressRoutes;
  }

  if (strategy === 'combine') {
    return mergeRouteEntries(swaggerRoutes, expressRoutes);
  }

  // Default: 'swagger-first'
  if (swaggerRoutes.length > 0) {
    return mergeRouteEntries(swaggerRoutes, expressRoutes);
  }

  return expressRoutes;
}
