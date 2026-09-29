/* scriptc probe: Date accessors (dev only) */
export function d1(d: Date): number {
  return d.getTime();
}
export function d2(d: Date): number {
  return +d;
}
export function d3(d: Date): number {
  return Number(d);
}
export function d4(d: Date): number {
  return d.valueOf();
}
export function d5(d: Date): string {
  return d.toISOString();
}
export function d6(): number {
  return Date.now();
}
export function d7(d: Date): number {
  return d.getUTCFullYear();
}