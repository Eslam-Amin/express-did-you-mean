import { describe, expect, it } from 'vitest';
import {
  calculateSegmentSimilarity,
  canonicalizeRoutePattern,
  isParamSegment,
  matchesParameterizedRoute,
  normalizePath,
  splitSegments,
} from '../src/matcher/path-normalizer.js';
import { levenshteinSimilarity } from '../src/matcher/similarity.js';

describe('Path Normalizer', () => {
  describe('normalizePath', () => {
    it('strips query parameters and hashes', () => {
      expect(normalizePath('/api/v1/users?page=1&limit=10')).toBe('/api/v1/users');
      expect(normalizePath('/api/v1/users#section-2')).toBe('/api/v1/users');
      expect(normalizePath('/api/v1/users?search=ok#header')).toBe('/api/v1/users');
    });

    it('collapses multiple consecutive slashes', () => {
      expect(normalizePath('//api///v1////users//')).toBe('/api/v1/users');
    });

    it('trims trailing slashes unless root', () => {
      expect(normalizePath('/users/')).toBe('/users');
      expect(normalizePath('/')).toBe('/');
      expect(normalizePath('')).toBe('/');
    });

    it('handles case-insensitivity by default', () => {
      expect(normalizePath('/API/V1/Users')).toBe('/api/v1/users');
      expect(normalizePath('/API/V1/Users', true)).toBe('/API/V1/Users');
    });
  });

  describe('canonicalizeRoutePattern', () => {
    it('converts OpenAPI {param} syntax to Express :param syntax', () => {
      expect(canonicalizeRoutePattern('/users/{id}')).toBe('/users/:id');
      expect(canonicalizeRoutePattern('/orgs/{orgId}/users/{userId}')).toBe(
        '/orgs/:orgId/users/:userId'
      );
    });

    it('leaves Express :param syntax intact', () => {
      expect(canonicalizeRoutePattern('/users/:id')).toBe('/users/:id');
    });
  });

  describe('splitSegments & isParamSegment', () => {
    it('splits paths into clean segments', () => {
      expect(splitSegments('/api/v1/users/:id')).toEqual(['api', 'v1', 'users', ':id']);
      expect(splitSegments('/')).toEqual([]);
    });

    it('identifies parameter placeholders', () => {
      expect(isParamSegment(':id')).toBe(true);
      expect(isParamSegment('{userId}')).toBe(true);
      expect(isParamSegment('*')).toBe(true);
      expect(isParamSegment('users')).toBe(false);
    });
  });

  describe('matchesParameterizedRoute', () => {
    it('matches dynamic parameters with concrete values', () => {
      expect(matchesParameterizedRoute('/api/users/123', '/api/users/:id')).toBe(true);
      expect(matchesParameterizedRoute('/api/users/abc-def-456', '/api/users/{userId}')).toBe(
        true
      );
    });

    it('returns false when segment count differs', () => {
      expect(matchesParameterizedRoute('/api/users/123/posts', '/api/users/:id')).toBe(false);
      expect(matchesParameterizedRoute('/api/users', '/api/users/:id')).toBe(false);
    });

    it('returns false when non-parameter segments differ', () => {
      expect(matchesParameterizedRoute('/api/admins/123', '/api/users/:id')).toBe(false);
    });
  });

  describe('calculateSegmentSimilarity', () => {
    it('returns 1.0 for matching routes', () => {
      const score = calculateSegmentSimilarity(
        '/api/v1/users',
        '/api/v1/users',
        levenshteinSimilarity
      );
      expect(score).toBe(1.0);
    });

    it('rewards matching parameters', () => {
      const score = calculateSegmentSimilarity(
        '/api/v1/users/42',
        '/api/v1/users/:id',
        levenshteinSimilarity
      );
      expect(score).toBeGreaterThan(0.9);
    });

    it('handles typo in one segment while matching others', () => {
      const score = calculateSegmentSimilarity(
        '/api/v1/usr/42',
        '/api/v1/users/:id',
        levenshteinSimilarity
      );
      expect(score).toBeGreaterThan(0.7);
    });
  });
});
