import type { Application, Router } from 'express';
import type { HttpMethod, RouteEntry } from '../types.js';

interface ExpressLayer {
  name?: string;
  path?: string;
  route?: {
    path?: string | string[] | RegExp;
    methods?: Record<string, boolean>;
    stack?: ExpressLayer[];
  };
  handle?: {
    stack?: ExpressLayer[];
    _router?: {
      stack?: ExpressLayer[];
    };
    mountpath?: string;
  };
  keys?: Array<{ name: string | number }>;
  regexp?: RegExp & {
    fast_slash?: boolean;
    fast_star?: boolean;
  };
}

/**
 * Extracts a readable path string from an Express layer's regexp and keys.
 */
export function extractPathFromLayerRegexp(
  regexp?: RegExp & { fast_slash?: boolean; fast_star?: boolean },
  keys?: Array<{ name: string | number }>
): string {
  if (!regexp) return '';
  if (regexp.fast_slash) return '';

  let src = regexp.source;

  // Root matcher
  if (src === '^\\/?(?=\\/|$)' || src === '^\\/' || src === '^$') {
    return '';
  }

  // Remove regex anchors and lookaheads:
  // e.g. "^\/api\/?(?=\/|$)" or "^\/api\/?$"
  src = src.replace(/^\^/, '');
  src = src.replace(/\\\/\?\(\?=\\\/\|\$\)/, '');
  src = src.replace(/\\\/\?\$/, '');
  src = src.replace(/\(\?=\\\/\|\$\)/, '');
  src = src.replace(/\/?\$$/, '');

  // If there are captured route parameters, replace with :keyName
  if (keys && keys.length > 0) {
    let keyIndex = 0;
    src = src.replace(/(?:\(\?:)?\(\[\^\\\/\]\+\?\)\)?/g, () => {
      const key = keys[keyIndex++];
      return key ? `:${key.name}` : ':param';
    });
  }

  // Unescape slashes and special regex characters
  src = src.replace(/\\([\\/.+*?()|[\]{}])/g, '$1');

  // Ensure leading slash if non-empty
  if (src && !src.startsWith('/')) {
    src = '/' + src;
  }
  // Trim trailing slash if longer than 1
  if (src.length > 1 && src.endsWith('/')) {
    src = src.slice(0, -1);
  }

  return src;
}

/**
 * Normalizes combined path segments into a clean route path.
 */
function joinPaths(prefix: string, subPath: string): string {
  if (!prefix && !subPath) return '/';
  if (!prefix) return subPath.startsWith('/') ? subPath : '/' + subPath;
  if (!subPath || subPath === '/') return prefix.startsWith('/') ? prefix : '/' + prefix;

  const cleanPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;
  const cleanSub = subPath.startsWith('/') ? subPath : '/' + subPath;
  return `${cleanPrefix}${cleanSub}`;
}

/**
 * Recursively inspects an Express router stack to harvest all registered routes.
 */
function traverseStack(
  stack: ExpressLayer[],
  parentPrefix = '',
  collectedRoutes: Map<string, Set<HttpMethod>>
): void {
  if (!Array.isArray(stack)) return;

  for (const layer of stack) {
    if (!layer) continue;

    // 1. Direct Route Definition (e.g. app.get('/users', ...))
    if (layer.route) {
      const rawPath = layer.route.path;
      const methodsObj = layer.route.methods || {};
      const methods: HttpMethod[] = Object.keys(methodsObj)
        .filter((m) => methodsObj[m] === true && m !== '_all')
        .map((m) => m.toUpperCase() as HttpMethod);

      if (methods.length === 0) continue;

      const paths = Array.isArray(rawPath)
        ? rawPath
        : [rawPath];

      for (const p of paths) {
        let routeStr = '';
        if (typeof p === 'string') {
          routeStr = joinPaths(parentPrefix, p);
        } else if (p instanceof RegExp) {
          routeStr = joinPaths(parentPrefix, extractPathFromLayerRegexp(p));
        } else {
          routeStr = joinPaths(parentPrefix, '');
        }

        if (!collectedRoutes.has(routeStr)) {
          collectedRoutes.set(routeStr, new Set());
        }
        const methodSet = collectedRoutes.get(routeStr)!;
        for (const m of methods) {
          methodSet.add(m);
        }
      }
      continue;
    }

    // 2. Mounted Sub-Router (e.g. app.use('/api', apiRouter))
    if (layer.handle && Array.isArray(layer.handle.stack)) {
      const layerPrefix = extractPathFromLayerRegexp(layer.regexp, layer.keys);
      const combinedPrefix = joinPaths(parentPrefix, layerPrefix);
      traverseStack(layer.handle.stack, combinedPrefix, collectedRoutes);
      continue;
    }

    // 3. Mounted Sub-Application (e.g. app.use('/admin', subApp))
    if (layer.handle && layer.handle._router && Array.isArray(layer.handle._router.stack)) {
      const mountpath = typeof layer.handle.mountpath === 'string'
        ? layer.handle.mountpath
        : extractPathFromLayerRegexp(layer.regexp, layer.keys);
      const combinedPrefix = joinPaths(parentPrefix, mountpath);
      traverseStack(layer.handle._router.stack, combinedPrefix, collectedRoutes);
      continue;
    }
  }
}

/**
 * Extracts all registered routes and their HTTP methods from an Express application, router, or list of sub-applications.
 */
export function extractExpressRoutes(
  appOrRouter: Application | Router | any | Array<Application | Router | any>,
  subApps?: Array<Application | Router | any>
): RouteEntry[] {
  if (!appOrRouter) return [];

  const targets = Array.isArray(appOrRouter) ? [...appOrRouter] : [appOrRouter];
  if (Array.isArray(subApps)) {
    targets.push(...subApps);
  }

  const primary = targets[0];
  if (primary && Array.isArray((primary as any)._subApps)) {
    targets.push(...(primary as any)._subApps);
  }

  const collected = new Map<string, Set<HttpMethod>>();

  for (const target of targets) {
    if (!target) continue;
    const router = target._router || target.router || target;
    const stack = router?.stack;
    const initialPrefix =
      typeof target.mountpath === 'string' && target.mountpath !== '/'
        ? target.mountpath
        : '';

    if (Array.isArray(stack)) {
      traverseStack(stack, initialPrefix, collected);
    }
  }

  const routes: RouteEntry[] = [];
  for (const [routePath, methodsSet] of collected.entries()) {
    routes.push({
      path: routePath || '/',
      methods: Array.from(methodsSet),
      source: 'express',
    });
  }

  return routes;
}
