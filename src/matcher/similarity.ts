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
