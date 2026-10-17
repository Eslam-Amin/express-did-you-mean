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
