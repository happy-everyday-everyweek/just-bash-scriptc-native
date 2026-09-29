/* scriptc probe: optional-chain Date access (dev only) */
export function dm1(s: { mtime?: Date }): number {
  return s.mtime?.getTime() ?? 0;
}
export function dm2(s: { mtime?: Date }): number {
  const d = s.mtime;
  return d ? d.getTime() : 0;
}
export function dm3(d?: Date): number {
  return d?.getTime() ?? 0;
}