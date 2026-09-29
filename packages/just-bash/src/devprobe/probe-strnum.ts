/* scriptc probe: number-to-string variants (dev only, delete after) */
export function s1(n: number): string {
  return `${n}`;
}
export function s2(n: number): string {
  return "" + n;
}
export function s3(n: number): string {
  return String(n);
}
export function s4(s: string): string {
  return `${s}!`;
}