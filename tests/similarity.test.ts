import { describe, expect, it } from 'vitest';
import {
  diceSimilarity,
  jaroSimilarity,
  jaroWinklerSimilarity,
  levenshteinDistance,
  levenshteinSimilarity,
} from '../src/matcher/similarity.js';

describe('Similarity Algorithms', () => {
  describe('Levenshtein Distance & Similarity', () => {
    it('calculates distance correctly for exact matches', () => {
      expect(levenshteinDistance('users', 'users')).toBe(0);
      expect(levenshteinSimilarity('users', 'users')).toBe(1.0);
    });

    it('handles empty strings', () => {
      expect(levenshteinDistance('', '')).toBe(0);
      expect(levenshteinSimilarity('', '')).toBe(1.0);
      expect(levenshteinDistance('users', '')).toBe(5);
      expect(levenshteinSimilarity('users', '')).toBe(0.0);
      expect(levenshteinDistance('', 'users')).toBe(5);
      expect(levenshteinSimilarity('', 'users')).toBe(0.0);
    });

    it('calculates single edit distance', () => {
      // substitution
      expect(levenshteinDistance('user', 'uses')).toBe(1);
      expect(levenshteinSimilarity('user', 'uses')).toBe(0.75);

      // insertion
      expect(levenshteinDistance('user', 'users')).toBe(1);
      expect(levenshteinSimilarity('user', 'users')).toBe(0.8);

      // deletion
      expect(levenshteinDistance('users', 'user')).toBe(1);
      expect(levenshteinSimilarity('users', 'user')).toBe(0.8);
    });

    it('calculates multi-character distance', () => {
      expect(levenshteinDistance('kitten', 'sitting')).toBe(3);
      expect(levenshteinSimilarity('kitten', 'sitting')).toBeCloseTo(1 - 3 / 7, 4);
    });
  });

  describe('Jaro & Jaro-Winkler Similarity', () => {
    it('returns 1.0 for identical strings', () => {
      expect(jaroSimilarity('api/v1/users', 'api/v1/users')).toBe(1.0);
      expect(jaroWinklerSimilarity('api/v1/users', 'api/v1/users')).toBe(1.0);
    });

    it('returns 0.0 for completely different strings', () => {
      expect(jaroSimilarity('abc', 'xyz')).toBe(0.0);
      expect(jaroWinklerSimilarity('abc', 'xyz')).toBe(0.0);
    });

    it('gives prefix bonus in Jaro-Winkler', () => {
      const s1 = 'users_list';
      const s2 = 'users_detail';
      const jaro = jaroSimilarity(s1, s2);
      const jw = jaroWinklerSimilarity(s1, s2);
      expect(jw).toBeGreaterThan(jaro);
    });

    it('handles transposition differences', () => {
      const score = jaroWinklerSimilarity('martha', 'marhta');
      expect(score).toBeGreaterThan(0.9);
    });
  });

  describe('Sørensen-Dice Coefficient', () => {
    it('returns 1.0 for identical strings', () => {
      expect(diceSimilarity('authentication', 'authentication')).toBe(1.0);
    });

    it('handles short strings', () => {
      expect(diceSimilarity('a', 'a')).toBe(1.0);
      expect(diceSimilarity('a', 'b')).toBe(0.0);
    });

    it('evaluates bigram matches correctly', () => {
      // 'night' bigrams: ni, ig, gh, ht (4)
      // 'nacht' bigrams: na, ac, ch, ht (4)
      // intersection: ht (1)
      // dice = 2 * 1 / (4 + 4) = 0.25
      expect(diceSimilarity('night', 'nacht')).toBe(0.25);
    });
  });
});
