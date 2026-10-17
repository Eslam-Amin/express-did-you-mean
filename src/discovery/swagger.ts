import fs from 'node:fs';
import path from 'node:path';
import type { HttpMethod, RouteEntry, SwaggerDocInput } from '../types.js';

const VALID_HTTP_METHODS = new Set([
  'get',
  'post',
  'put',
  'delete',
  'patch',
  'options',
  'head',
  'trace',
]);

/**
 * Extracts route entries from an OpenAPI / Swagger document.
 */
export function extractRoutesFromSwaggerObject(
  doc: Record<string, any>
): RouteEntry[] {
  if (!doc || typeof doc !== 'object') {
    return [];
  }

  const routes: RouteEntry[] = [];
  const pathsObj = doc.paths;
  if (!pathsObj || typeof pathsObj !== 'object') {
    return [];
  }

  // Swagger 2.0 basePath support
  let basePath = '';
  if (typeof doc.basePath === 'string' && doc.basePath.trim() !== '' && doc.basePath !== '/') {
    basePath = doc.basePath.trim();
    if (!basePath.startsWith('/')) {
      basePath = '/' + basePath;
    }
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1);
    }
  }

  for (const [rawPath, pathItem] of Object.entries(pathsObj)) {
    if (!pathItem || typeof pathItem !== 'object') {
      continue;
    }

    const fullPath = basePath ? `${basePath}${rawPath.startsWith('/') ? '' : '/'}${rawPath}` : rawPath;
    const methods: HttpMethod[] = [];
    let summary: string | undefined;
    let description: string | undefined;
    let operationId: string | undefined;
    let tags: string[] | undefined;

    for (const [key, value] of Object.entries(pathItem)) {
      const lowerKey = key.toLowerCase();
      if (VALID_HTTP_METHODS.has(lowerKey) && value && typeof value === 'object') {
        const methodUpper = lowerKey.toUpperCase() as HttpMethod;
        methods.push(methodUpper);

        const op = value as Record<string, any>;
        summary = summary || op.summary;
        description = description || op.description;
        operationId = operationId || op.operationId;
        if (Array.isArray(op.tags) && !tags) {
          tags = op.tags;
        }
      }
    }

    if (methods.length > 0) {
      routes.push({
        path: fullPath,
        methods,
        source: 'swagger',
        summary,
        description,
        operationId,
        tags,
      });
    }
  }

  return routes;
}

/**
 * Parses a Swagger / OpenAPI specification from an object, a local file path, or an HTTP(S) URL.
 */
export async function parseSwaggerDoc(
  input: SwaggerDocInput
): Promise<RouteEntry[]> {
  if (!input) return [];

  if (typeof input === 'object') {
    return extractRoutesFromSwaggerObject(input);
  }

  if (typeof input === 'string') {
    const trimmed = input.trim();

    // Check if it is a JSON string directly
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return extractRoutesFromSwaggerObject(parsed);
      } catch {
        // Fall through to file path / url check
      }
    }

    // Check if it's a URL
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      const response = await fetch(trimmed);
      if (!response.ok) {
        throw new Error(
          `Failed to fetch OpenAPI spec from ${trimmed}: HTTP ${response.status} ${response.statusText}`
        );
      }
      const data = await response.json();
      return extractRoutesFromSwaggerObject(data as Record<string, any>);
    }

    // Check if it's a local file path
    const resolvedPath = path.isAbsolute(trimmed)
      ? trimmed
      : path.resolve(process.cwd(), trimmed);

    if (fs.existsSync(resolvedPath)) {
      const content = fs.readFileSync(resolvedPath, 'utf8');
      const parsed = JSON.parse(content);
      return extractRoutesFromSwaggerObject(parsed);
    }

    throw new Error(
      `OpenAPI spec file not found or invalid input: ${input}`
    );
  }

  return [];
}
