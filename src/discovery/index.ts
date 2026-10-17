import type { Application, Request } from 'express';
import type { DidYouMeanOptions, HttpMethod, RouteDiscoveryStrategy, RouteEntry } from '../types.js';
import { extractExpressRoutes } from './express.js';
import { parseSwaggerDoc, parseSwaggerDocSync } from './swagger.js';

export * from './express.js';
export * from './swagger.js';

/**
 * Merges two lists of RouteEntry objects, deduplicating paths and combining methods.
 * Items in primary have priority for metadata (summary, description, source).
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
 * Discovers routes synchronously according to the requested strategy.
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
 * Discovers routes asynchronously (supports remote URL Swagger specs).
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
