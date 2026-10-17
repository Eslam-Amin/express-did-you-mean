import express from 'express';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { didYouMean } from '../src/index.js';

describe('didYouMean Middleware Integration', () => {
  beforeEach(() => {
    process.env.NODE_ENV = 'development';
  });

  it('passes standard routes through without interference', async () => {
    const app = express();
    app.get('/api/v1/users', (_req, res) => res.json({ success: true }));
    app.use(didYouMean());

    const res = await request(app).get('/api/v1/users');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true });
  });

  it('suggests closest match on 404 route with Express stack inspection', async () => {
    const app = express();
    app.get('/api/v1/users', (_req, res) => res.json({ ok: true }));
    app.post('/api/v1/users', (_req, res) => res.json({ ok: true }));
    app.get('/api/v1/users/:id', (_req, res) => res.json({ ok: true }));

    app.use(didYouMean({ threshold: 0.3 }));

    const res = await request(app).get('/api/v1/usr');
    expect(res.status).toBe(404);
    expect(res.body.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toBe('Cannot GET /api/v1/usr');
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThan(0);

    const top = res.body.suggestions[0];
    expect(top.path).toBe('/api/v1/users');
    expect(top.method).toBe('GET');
    expect(top.score).toBeGreaterThan(0.7);
  });

  it('suggests method mismatch when route path exists for other methods', async () => {
    const app = express();
    // Only GET is registered
    app.get('/api/v1/orders', (_req, res) => res.json({ ok: true }));
    app.use(didYouMean());

    // Client makes POST
    const res = await request(app).post('/api/v1/orders');
    expect(res.status).toBe(404);
    expect(res.body.suggestions[0]).toMatchObject({
      method: 'GET',
      path: '/api/v1/orders',
      isMethodMismatch: true,
      score: 1.0,
    });
  });

  it('extracts routes from provided Swagger / OpenAPI document', async () => {
    const app = express();
    const swaggerDoc = {
      openapi: '3.0.0',
      paths: {
        '/api/v1/catalog': {
          get: { summary: 'Product catalog' },
        },
      },
    };

    app.use(
      didYouMean({
        swaggerDoc,
        discoveryStrategy: 'swagger-first',
      })
    );

    const res = await request(app).get('/api/v1/catlog');
    expect(res.status).toBe(404);
    expect(res.body.suggestions[0].path).toBe('/api/v1/catalog');
    expect(res.body.suggestions[0].summary).toBe('Product catalog');
  });

  it('supports custom formatResponse as per prompt design preview', async () => {
    const app = express();
    app.get('/api/v1/users', (_req, res) => res.json({ ok: true }));

    app.use(
      didYouMean({
        maxSuggestions: 3,
        threshold: 0.4,
        formatResponse: (suggestions, req) => ({
          statusCode: 404,
          error: 'Not Found',
          message: `Cannot ${req.method} ${req.path}`,
          didYouMean: suggestions,
        }),
      })
    );

    const res = await request(app).get('/api/v1/usr');
    expect(res.status).toBe(404);
    expect(res.body.statusCode).toBe(404);
    expect(res.body.error).toBe('Not Found');
    expect(res.body.message).toBe('Cannot GET /api/v1/usr');
    expect(res.body.didYouMean).toBeDefined();
    expect(res.body.didYouMean[0].path).toBe('/api/v1/users');
  });

  it('supports custom onNotFound handler', async () => {
    const app = express();
    app.get('/api/items', (_req, res) => res.send('ok'));

    app.use(
      didYouMean({
        onNotFound: (req, res, suggestions) => {
          res.setHeader('X-Custom-404', 'true');
          res.status(404).json({
            custom: true,
            pathReceived: req.path,
            topMatch: suggestions[0]?.path,
          });
        },
      })
    );

    const res = await request(app).get('/api/itm');
    expect(res.status).toBe(404);
    expect(res.headers['x-custom-404']).toBe('true');
    expect(res.body.custom).toBe(true);
    expect(res.body.pathReceived).toBe('/api/itm');
    expect(res.body.topMatch).toBe('/api/items');
  });

  it('renders HTML when client accepts text/html', async () => {
    const app = express();
    app.get('/dashboard/analytics', (_req, res) => res.send('ok'));
    app.use(didYouMean());

    const res = await request(app)
      .get('/dashboard/analytcs')
      .set('Accept', 'text/html');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.text).toContain('404 Not Found');
    expect(res.text).toContain('/dashboard/analytics');
  });

  it('caches discovered routes and supports clearCache()', async () => {
    const app = express();
    app.get('/route-one', (_req, res) => res.send('ok'));

    const middleware = didYouMean();
    app.use(middleware);

    expect(middleware.getCachedRoutes()).toBeNull();

    await request(app).get('/route-on');
    const cached = middleware.getCachedRoutes();
    expect(cached).not.toBeNull();
    expect(cached?.some((r) => r.path === '/route-one')).toBe(true);

    middleware.clearCache();
    expect(middleware.getCachedRoutes()).toBeNull();
  });

  it('supports remote Swagger URL loading', async () => {
    const originalFetch = global.fetch;
    global.fetch = async () =>
      ({
        ok: true,
        json: async () => ({
          openapi: '3.0.0',
          paths: {
            '/api/remote/endpoint': {
              get: { summary: 'Remote endpoint' },
            },
          },
        }),
      } as any);

    try {
      const app = express();
      app.use(
        didYouMean({
          swaggerDoc: 'https://example.com/openapi.json',
        })
      );

      const res = await request(app).get('/api/remote/endpont');
      expect(res.status).toBe(404);
      expect(res.body.suggestions[0].path).toBe('/api/remote/endpoint');
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('passes unexpected errors during discovery/ranking to next(err)', async () => {
    const app = express();
    // Pass invalid swagger file to trigger error
    app.use(
      didYouMean({
        swaggerDoc: 'https://invalid-non-existent-url-domain-999.xyz/spec.json',
      })
    );

    let caughtError: any = null;
    app.use((err: any, _req: any, res: any, _next: any) => {
      caughtError = err;
      res.status(500).json({ caught: true });
    });

    const res = await request(app).get('/api/test');
    expect(res.status).toBe(500);
    expect(caughtError).toBeDefined();
  });
});
