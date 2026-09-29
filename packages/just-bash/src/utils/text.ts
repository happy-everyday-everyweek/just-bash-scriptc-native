/**
 * Unicode code point to string helper (scriptc has no String.fromCodePoint).
 */
export function codePointToString(codePoint: number): string {
  if (codePoint <= 0xffff) return String.fromCharCode(codePoint);
  const value = codePoint - 0x10000;
  return String.fromCharCode(0xd800 + (value >> 10), 0xdc00 + (value & 0x3ff));
}
