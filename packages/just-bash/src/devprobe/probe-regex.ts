/* scriptc probe: native RegExp support (dev only) */
export function rt(re: RegExp, s: string): boolean {
  return re.test(s);
}
export function rexec(re: RegExp, s: string): string {
  const m = re.exec(s);
  return m ? m[0] : "";
}
export function rnew(p: string): RegExp {
  return new RegExp(p);
}
export function rlit(s: string): boolean {
  return /abc/.test(s);
}
export function rreplace(re: RegExp, s: string): string {
  return s.replace(re, "x");
}