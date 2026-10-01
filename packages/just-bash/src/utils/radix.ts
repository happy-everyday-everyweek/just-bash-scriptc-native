/**
 * Radix rendering helpers.
 *
 * `Number.prototype.toString(radix)` and `String.prototype.padStart` have no
 * scriptc lowering, so these walk the digits by hand.
 */

/** Octal rendering of a non-negative integer. */
export function toOctal(n: number): string {
  let v = Math.floor(n);
  if (!(v > 0)) return "0";
  const digits = "01234567";
  let out = "";
  while (v > 0) {
    const d = v % 8;
    out = digits.charAt(d) + out;
    v = (v - d) / 8;
  }
  return out;
}

/** Octal rendering padded with leading zeros to `width` digits. */
export function toOctalFixed(n: number, width: number): string {
  let s = toOctal(n);
  while (s.length < width) s = "0" + s;
  return s;
}

/** Two-digit lowercase hex of a byte value. */
export function toHexLower(n: number): string {
  const digits = "0123456789abcdef";
  const v = Math.floor(n) % 256;
  const hi = (v - (v % 16)) / 16;
  return digits.charAt(hi) + digits.charAt(v % 16);
}
