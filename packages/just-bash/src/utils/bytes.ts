/**
 * Byte and container helpers.
 *
 * `Uint8Array.from`, `Array.from`, the `Map`/`Set` copy constructors and
 * `Set.prototype.values` have no scriptc lowering, so these walk the elements
 * by hand instead.
 */

/** Latin1-shaped string (one char = one byte) to bytes. */
export function bytesFromLatin1(s: string): Uint8Array {
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

/** Copy a `Map<string, string>` (the copy constructor has no lowering). */
export function copyStringMap(src: Map<string, string>): Map<string, string> {
  const out = new Map<string, string>();
  src.forEach((value, key) => {
    out.set(key, value);
  });
  return out;
}

/** Copy a `Set<string>` (the copy constructor has no lowering). */
export function copyStringSet(src: Set<string>): Set<string> {
  const out = new Set<string>();
  src.forEach((value) => {
    out.add(value);
  });
  return out;
}

/** Build a string set from an array. */
export function stringSetFrom(values: string[]): Set<string> {
  const out = new Set<string>();
  for (const v of values) out.add(v);
  return out;
}

/** Split a string into single-character entries. */
export function charsOf(s: string): string[] {
  const out: string[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charAt(i));
  return out;
}

/** Copy a `Set<T>` (the copy constructor has no lowering). */
export function copySet<T>(src: Set<T>): Set<T> {
  const out = new Set<T>();
  src.forEach((value) => {
    out.add(value);
  });
  return out;
}

/** Copy a `Map<K, V>` (the copy constructor has no lowering). */
export function copyMap<K, V>(src: Map<K, V>): Map<K, V> {
  const out = new Map<K, V>();
  src.forEach((value, key) => {
    out.set(key, value);
  });
  return out;
}

/** Build a set from an array of values. */
export function setFromArray<T>(values: T[]): Set<T> {
  const out = new Set<T>();
  for (const v of values) out.add(v);
  return out;
}

/** Keys of a map as an array (`Map.prototype.keys` has no lowering). */
export function mapKeys<K, V>(src: Map<K, V> | undefined): K[] {
  const out: K[] = [];
  if (src === undefined) return out;
  src.forEach((_value, key) => {
    out.push(key);
  });
  return out;
}
