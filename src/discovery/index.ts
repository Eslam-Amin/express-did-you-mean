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
