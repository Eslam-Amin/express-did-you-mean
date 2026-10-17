import express from 'express';
import request from 'supertest';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { didYouMean, isMiddlewareEnabled } from '../src/index.js';

describe('Environment Guardrails', () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  describe('isMiddlewareEnabled', () => {
    it('is enabled by default in development environment', () => {
      process.env.NODE_ENV = 'development';
      expect(isMiddlewareEnabled({}, {} as any)).toBe(true);
    });

    it('is disabled by default in production environment', () => {
      process.env.NODE_ENV = 'production';
      expect(isMiddlewareEnabled({}, {} as any)).toBe(false);
    });

    it('respects explicit boolean enabled: true in production', () => {
      process.env.NODE_ENV = 'production';
      expect(isMiddlewareEnabled({ enabled: true }, {} as any)).toBe(true);
    });

    it('respects explicit boolean enabled: false in development', () => {
      process.env.NODE_ENV = 'development';
      expect(isMiddlewareEnabled({ enabled: false }, {} as any)).toBe(false);
    });

    it('respects functional predicate toggle', () => {
      const fn = (req: any) => req.headers['x-debug'] === '1';
      expect(
        isMiddlewareEnabled(
          { enabled: fn },
          { headers: { 'x-debug': '1' } } as any
        )
      ).toBe(true);
      expect(
        isMiddlewareEnabled(
          { enabled: fn },
          { headers: { 'x-debug': '0' } } as any
        )
      ).toBe(false);
    });

    it('respects enabledEnvironments whitelist', () => {
      process.env.NODE_ENV = 'staging';
      expect(
        isMiddlewareEnabled(
          { enabledEnvironments: ['staging', 'preview'] },
          {} as any
        )
      ).toBe(true);

      process.env.NODE_ENV = 'production';
      expect(
        isMiddlewareEnabled(
          { enabledEnvironments: ['staging', 'preview'] },
          {} as any
        )
      ).toBe(false);
    });
  });

  describe('Production Transparent No-Op Behavior', () => {
    it('immediately calls next() without executing router inspection in production', async () => {
      process.env.NODE_ENV = 'production';

      const app = express();
      app.get('/api/users', (_req, res) => res.json({ ok: true }));

      // Attach didYouMean
      app.use(didYouMean());

      // Standard fallback 404 handler after didYouMean
      app.use((_req, res) => {
        res.status(404).send('Standard Production 404');
      });

      const res = await request(app).get('/api/usr');
      expect(res.status).toBe(404);
      expect(res.text).toBe('Standard Production 404');
    });

    it('intercepts and suggests in development', async () => {
      process.env.NODE_ENV = 'development';

      const app = express();
      app.get('/api/users', (_req, res) => res.json({ ok: true }));

      app.use(didYouMean());

      const res = await request(app).get('/api/usr');
      expect(res.status).toBe(404);
      expect(res.body.error).toBe('Not Found');
      expect(res.body.suggestions).toBeDefined();
      expect(res.body.suggestions[0].path).toBe('/api/users');
    });
  });
});
