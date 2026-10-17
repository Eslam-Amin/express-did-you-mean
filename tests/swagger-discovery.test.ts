import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  extractRoutesFromSwaggerObject,
  parseSwaggerDoc,
  parseSwaggerDocSync,
} from '../src/discovery/swagger.js';

describe('Swagger / OpenAPI Route Discovery', () => {
  it('extracts paths and methods from OpenAPI 3.0 document', () => {
    const doc = {
      openapi: '3.0.0',
      info: { title: 'Test API', version: '1.0' },
      paths: {
        '/users': {
          get: { summary: 'List users', operationId: 'getUsers', tags: ['Users'] },
          post: { summary: 'Create user', description: 'Creates a new user' },
        },
        '/users/{id}': {
          get: { summary: 'Get user by id' },
          delete: { summary: 'Delete user' },
        },
      },
    };

    const routes = extractRoutesFromSwaggerObject(doc);
    expect(routes).toHaveLength(2);

    const usersRoute = routes.find((r) => r.path === '/users');
    expect(usersRoute).toBeDefined();
    expect(usersRoute?.methods).toEqual(['GET', 'POST']);
    expect(usersRoute?.source).toBe('swagger');
    expect(usersRoute?.summary).toBe('List users');
    expect(usersRoute?.tags).toEqual(['Users']);

    const userByIdRoute = routes.find((r) => r.path === '/users/{id}');
    expect(userByIdRoute).toBeDefined();
    expect(userByIdRoute?.methods).toEqual(['GET', 'DELETE']);
  });

  it('handles Swagger 2.0 basePath correctly', () => {
    const doc = {
      swagger: '2.0',
      basePath: '/api/v1',
      paths: {
        '/products': {
          get: { summary: 'List products' },
        },
      },
    };

    const routes = extractRoutesFromSwaggerObject(doc);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe('/api/v1/products');
    expect(routes[0].methods).toEqual(['GET']);
  });

  it('parses JSON string representation of OpenAPI spec', async () => {
    const jsonStr = JSON.stringify({
      openapi: '3.0.1',
      paths: {
        '/health': {
          get: { summary: 'Health check' },
        },
      },
    });

    const routes = await parseSwaggerDoc(jsonStr);
    expect(routes).toHaveLength(1);
    expect(routes[0].path).toBe('/health');
    expect(routes[0].methods).toEqual(['GET']);
  });

  it('parses local OpenAPI JSON file path synchronously and asynchronously', async () => {
    const tempFile = path.resolve(__dirname, 'temp-spec.json');
    fs.writeFileSync(
      tempFile,
      JSON.stringify({
        openapi: '3.0.0',
        paths: {
          '/orders': {
            post: { summary: 'Create order' },
          },
        },
      })
    );

    try {
      const syncRoutes = parseSwaggerDocSync(tempFile);
      expect(syncRoutes).toHaveLength(1);
      expect(syncRoutes[0].path).toBe('/orders');
      expect(syncRoutes[0].methods).toEqual(['POST']);

      const asyncRoutes = await parseSwaggerDoc(tempFile);
      expect(asyncRoutes).toHaveLength(1);
      expect(asyncRoutes[0].path).toBe('/orders');
    } finally {
      if (fs.existsSync(tempFile)) {
        fs.unlinkSync(tempFile);
      }
    }
  });

  it('fetches remote OpenAPI spec via HTTP URL', async () => {
    const mockSpec = {
      openapi: '3.0.0',
      paths: {
        '/remote-users': {
          get: { summary: 'Remote users endpoint' },
        },
      },
    };

    const originalFetch = global.fetch;
    global.fetch = async () =>
      ({
        ok: true,
        json: async () => mockSpec,
      } as any);

    try {
      const routes = await parseSwaggerDoc('https://api.example.com/openapi.json');
      expect(routes).toHaveLength(1);
      expect(routes[0].path).toBe('/remote-users');
      expect(routes[0].methods).toEqual(['GET']);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('throws error when remote URL fetch fails', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () =>
      ({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      } as any);

    try {
      await expect(
        parseSwaggerDoc('https://api.example.com/missing.json')
      ).rejects.toThrow('Failed to fetch OpenAPI spec from');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('throws error when local file path does not exist', async () => {
    await expect(
      parseSwaggerDoc('./non-existent-spec-file-123.json')
    ).rejects.toThrow('OpenAPI spec file not found or invalid input');
  });

  it('gracefully handles empty or malformed spec objects', () => {
    expect(extractRoutesFromSwaggerObject({} as any)).toEqual([]);
    expect(extractRoutesFromSwaggerObject(null as any)).toEqual([]);
    expect(parseSwaggerDocSync('')).toEqual([]);
  });
});
