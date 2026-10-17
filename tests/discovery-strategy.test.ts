import express from 'express';
import { describe, expect, it } from 'vitest';
import { discoverRoutesSync, mergeRouteEntries } from '../src/discovery/index.js';
import type { RouteEntry } from '../src/types.js';

describe('Route Discovery Strategies & Merging', () => {
  const swaggerDoc = {
    openapi: '3.0.0',
    paths: {
      '/api/users': {
        get: { summary: 'List users from Swagger' },
      },
      '/api/swagger-exclusive': {
        post: { summary: 'Only in Swagger' },
      },
    },
  };

  function createTestApp() {
    const app = express();
    app.get('/api/users', (_req, res) => res.send('ok'));
    app.post('/api/users', (_req, res) => res.send('ok'));
    app.get('/api/express-exclusive', (_req, res) => res.send('ok'));
    return app;
  }

  it('merges RouteEntry lists while preserving metadata', () => {
    const primary: RouteEntry[] = [
      {
        path: '/users',
        methods: ['GET'],
        source: 'swagger',
        summary: 'Primary summary',
      },
    ];
    const secondary: RouteEntry[] = [
      {
        path: '/users',
        methods: ['POST', 'GET'],
        source: 'express',
      },
      {
        path: '/posts',
        methods: ['GET'],
        source: 'express',
      },
    ];

    const merged = mergeRouteEntries(primary, secondary);
    expect(merged).toHaveLength(2);

    const users = merged.find((r) => r.path === '/users');
    expect(users?.methods.sort()).toEqual(['GET', 'POST']);
    expect(users?.summary).toBe('Primary summary');
    expect(users?.source).toBe('swagger');

    const posts = merged.find((r) => r.path === '/posts');
    expect(posts?.methods).toEqual(['GET']);
    expect(posts?.source).toBe('express');
  });

  it('strategy: swagger-first supplements missing routes from Express', () => {
    const app = createTestApp();
    const routes = discoverRoutesSync(app, {
      swaggerDoc,
      discoveryStrategy: 'swagger-first',
    });

    // Should contain /api/users, /api/swagger-exclusive, and supplemented /api/express-exclusive
    const paths = routes.map((r) => r.path);
    expect(paths).toContain('/api/users');
    expect(paths).toContain('/api/swagger-exclusive');
    expect(paths).toContain('/api/express-exclusive');

    // /api/users should have merged methods: GET from Swagger & POST from Express
    const users = routes.find((r) => r.path === '/api/users');
    expect(users?.methods.sort()).toEqual(['GET', 'POST']);
    expect(users?.summary).toBe('List users from Swagger');
  });

  it('strategy: swagger-only excludes routes registered only in Express', () => {
    const app = createTestApp();
    const routes = discoverRoutesSync(app, {
      swaggerDoc,
      discoveryStrategy: 'swagger-only',
    });

    const paths = routes.map((r) => r.path);
    expect(paths).toContain('/api/users');
    expect(paths).toContain('/api/swagger-exclusive');
    expect(paths).not.toContain('/api/express-exclusive');
  });

  it('strategy: express-only excludes routes defined only in Swagger', () => {
    const app = createTestApp();
    const routes = discoverRoutesSync(app, {
      swaggerDoc,
      discoveryStrategy: 'express-only',
    });

    const paths = routes.map((r) => r.path);
    expect(paths).toContain('/api/users');
    expect(paths).toContain('/api/express-exclusive');
    expect(paths).not.toContain('/api/swagger-exclusive');
  });

  it('strategy: combine merges all routes from both sources', () => {
    const app = createTestApp();
    const routes = discoverRoutesSync(app, {
      swaggerDoc,
      discoveryStrategy: 'combine',
    });

    const paths = routes.map((r) => r.path);
    expect(paths).toContain('/api/users');
    expect(paths).toContain('/api/swagger-exclusive');
    expect(paths).toContain('/api/express-exclusive');
  });
});
