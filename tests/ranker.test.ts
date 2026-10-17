import { describe, expect, it } from 'vitest';
import { rankRoutes } from '../src/matcher/ranker.js';
import type { RouteEntry } from '../src/types.js';

describe('Route Ranking & Fuzzy Matching Engine', () => {
  const sampleRoutes: RouteEntry[] = [
    {
      path: '/api/v1/users',
      methods: ['GET', 'POST'],
      source: 'express',
      summary: 'Users endpoint',
    },
    {
      path: '/api/v1/users/:id',
      methods: ['GET', 'PUT', 'DELETE'],
      source: 'express',
    },
    {
      path: '/api/v1/user-profiles',
      methods: ['GET'],
      source: 'express',
    },
    {
      path: '/api/v1/products',
      methods: ['GET', 'POST'],
      source: 'swagger',
    },
    {
      path: '/internal/health',
      methods: ['GET'],
      source: 'express',
    },
  ];

  it('prioritizes exact path with mismatched HTTP method', () => {
    // Client made a DELETE /api/v1/users, which only has GET and POST
    const suggestions = rankRoutes('DELETE', '/api/v1/users', sampleRoutes);

    expect(suggestions.length).toBeGreaterThan(0);
    const top = suggestions[0];
    expect(top.path).toBe('/api/v1/users');
    expect(top.isMethodMismatch).toBe(true);
    expect(['GET', 'POST']).toContain(top.method);
    expect(top.score).toBe(1.0);
  });

  it('suggests closest match for typos in route path', () => {
    // Typo: /api/v1/usr instead of /api/v1/users
    const suggestions = rankRoutes('GET', '/api/v1/usr', sampleRoutes, {
      threshold: 0.5,
    });

    expect(suggestions.length).toBeGreaterThan(0);
    const match = suggestions.find((s) => s.path === '/api/v1/users');
    expect(match).toBeDefined();
    expect(match?.method).toBe('GET');
    expect(match?.score).toBeGreaterThan(0.7);
  });

  it('matches parameterized routes for concrete IDs', () => {
    // Request with ID: /api/v1/users/42
    const suggestions = rankRoutes('GET', '/api/v1/users/42', sampleRoutes);

    expect(suggestions.length).toBeGreaterThan(0);
    const top = suggestions[0];
    expect(top.path).toBe('/api/v1/users/:id');
    expect(top.method).toBe('GET');
    expect(top.score).toBeGreaterThan(0.9);
  });

  it('respects maxSuggestions limit', () => {
    const suggestions = rankRoutes('GET', '/api/v1/u', sampleRoutes, {
      maxSuggestions: 2,
      threshold: 0.1,
    });

    expect(suggestions.length).toBeLessThanOrEqual(2);
  });

  it('filters out routes below similarity threshold', () => {
    const suggestions = rankRoutes('GET', '/completely/different/path', sampleRoutes, {
      threshold: 0.8,
    });

    expect(suggestions).toEqual([]);
  });

  it('excludes routes defined in excludeRoutes (strings and regexes)', () => {
    const suggestions = rankRoutes('GET', '/internal/heal', sampleRoutes, {
      excludeRoutes: ['/internal/health'],
      threshold: 0.3,
    });

    expect(suggestions.find((s) => s.path === '/internal/health')).toBeUndefined();

    const regexSuggestions = rankRoutes('GET', '/internal/heal', sampleRoutes, {
      excludeRoutes: [/^\/internal\//],
      threshold: 0.3,
    });
    expect(regexSuggestions.find((s) => s.path === '/internal/health')).toBeUndefined();
  });

  it('filters by includeMethods when specified', () => {
    const suggestions = rankRoutes('GET', '/api/v1/users', sampleRoutes, {
      includeMethods: ['GET'],
    });

    for (const s of suggestions) {
      expect(s.method).toBe('GET');
    }
  });

  it('supports selecting different similarity algorithms', () => {
    const levSuggestions = rankRoutes('GET', '/api/v1/usr', sampleRoutes, {
      algorithm: 'levenshtein',
      threshold: 0.4,
    });
    expect(levSuggestions.length).toBeGreaterThan(0);

    const jwSuggestions = rankRoutes('GET', '/api/v1/usr', sampleRoutes, {
      algorithm: 'jaro-winkler',
      threshold: 0.4,
    });
    expect(jwSuggestions.length).toBeGreaterThan(0);

    const diceSuggestions = rankRoutes('GET', '/api/v1/usr', sampleRoutes, {
      algorithm: 'dice',
      threshold: 0.4,
    });
    expect(diceSuggestions.length).toBeGreaterThan(0);
  });

  it('respects includeMethodMismatches: false', () => {
    const suggestions = rankRoutes('DELETE', '/api/v1/users', sampleRoutes, {
      includeMethodMismatches: false,
    });
    // /api/v1/users only has GET and POST, so with includeMethodMismatches disabled, it shouldn't be suggested as a mismatch
    const methodMismatch = suggestions.find(
      (s) => s.path === '/api/v1/users' && s.isMethodMismatch
    );
    expect(methodMismatch).toBeUndefined();
  });

  it('respects caseSensitive option', () => {
    const insensitive = rankRoutes('GET', '/API/V1/USERS', sampleRoutes, {
      caseSensitive: false,
    });
    expect(insensitive.some((s) => s.path === '/api/v1/users')).toBe(true);

    const sensitive = rankRoutes('GET', '/API/V1/USERS', sampleRoutes, {
      caseSensitive: true,
      threshold: 0.9,
    });
    expect(sensitive.find((s) => s.path === '/api/v1/users')).toBeUndefined();
  });

  it('preserves Swagger summary in suggestion metadata', () => {
    const suggestions = rankRoutes('GET', '/api/v1/usr', sampleRoutes);
    const usersMatch = suggestions.find((s) => s.path === '/api/v1/users');
    expect(usersMatch?.summary).toBe('Users endpoint');
  });
});
