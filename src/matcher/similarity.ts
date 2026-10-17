/**
 * Computes Levenshtein edit distance between two strings using an optimized O(min(m, n)) space algorithm.
 */
export function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  if (a.length < b.length) {
    const tmp = a;
    a = b;
    b = tmp;
  }

  const bLen = b.length;
  let prevRow = new Array<number>(bLen + 1);
  let currRow = new Array<number>(bLen + 1);

  for (let j = 0; j <= bLen; j++) {
    prevRow[j] = j;
  }

  for (let i = 0; i < a.length; i++) {
    currRow[0] = i + 1;
    const aChar = a[i];

    for (let j = 0; j < bLen; j++) {
      const bChar = b[j];
      const cost = aChar === bChar ? 0 : 1;
      currRow[j + 1] = Math.min(
        currRow[j] + 1,       // insertion
        prevRow[j + 1] + 1,   // deletion
        prevRow[j] + cost     // substitution
      );
    }

    const swap = prevRow;
    prevRow = currRow;
    currRow = swap;
  }

  return prevRow[bLen];
}

/**
 * Normalized Levenshtein similarity score between 0.0 (completely different) and 1.0 (exact match).
 */
export function levenshteinSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  const maxLen = Math.max(a.length, b.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshteinDistance(a, b);
  return Math.max(0, 1 - dist / maxLen);
}

/**
 * Computes Jaro similarity score between two strings (0.0 to 1.0).
 */
export function jaroSimilarity(s1: string, s2: string): number {
  if (s1 === s2) return 1.0;
  const len1 = s1.length;
  const len2 = s2.length;
  if (len1 === 0 || len2 === 0) return 0.0;

  const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
  const s1Matches = new Array<boolean>(len1);
  const s2Matches = new Array<boolean>(len2);

  let matches = 0;
  for (let i = 0; i < len1; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, len2);

    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < len1; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) {
      k++;
    }
    if (s1[i] !== s2[k]) {
      transpositions++;
    }
    k++;
  }

  return (
    (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) /
    3
  );
}

/**
 * Computes Jaro-Winkler similarity score with prefix scaling (0.0 to 1.0).
 * Gives higher scores to strings that share a common prefix.
 */
export function jaroWinklerSimilarity(s1: string, s2: string, prefixScale = 0.1): number {
  const jaro = jaroSimilarity(s1, s2);
  if (jaro === 0 || jaro === 1.0) return jaro;

  let prefix = 0;
  const maxPrefix = Math.min(4, Math.min(s1.length, s2.length));
  for (let i = 0; i < maxPrefix; i++) {
    if (s1[i] === s2[i]) {
      prefix++;
    } else {
      break;
    }
  }

  return Math.min(1.0, jaro + prefix * prefixScale * (1.0 - jaro));
}
