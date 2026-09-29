/* scriptc probe: narrowed Date getTime (dev only) */
interface St {
  mtime: Date;
}

export function dl(s: St | undefined): number {
  const d = s ? s.mtime : undefined;
  return d ? d.getTime() : 0;
}

export function dl2(s: St | undefined): number {
  const m = s ? s.mtime.getTime() : 0;
  return m;
}

export function dl3(s: St): number {
  return s.mtime.getTime();
}