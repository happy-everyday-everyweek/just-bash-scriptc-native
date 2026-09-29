/* scriptc probe: native-row return + groups read (dev only) */

// C1: return the native row from a matchAll loop
export function nfExec(
  re: RegExp,
  input: string,
  from: number,
): RegExpExecArray | null {
  for (const m of input.matchAll(re)) {
    const idx = m.index ?? -1;
    if (idx < from) {
      continue;
    }
    return m;
  }
  return null;
}

// C3: read named groups inside the loop (dynamic regex)
export function readGroups(re: RegExp, input: string): string {
  for (const m of input.matchAll(re)) {
    const g = m.groups;
    if (g === undefined) {
      return "";
    }
    const v = g["year"];
    return v === undefined ? "" : v;
  }
  return "";
}

// C10: mini exec with own lastIndex semantics
export class NFExec {
  private readonly _engine: RegExp;
  private readonly _global: boolean;
  private _lastIndex = 0;
  constructor(p: string, flags: string) {
    let f = "g";
    if (flags.includes("i")) f += "i";
    if (flags.includes("m")) f += "m";
    if (flags.includes("s")) f += "s";
    if (flags.includes("u")) f += "u";
    this._engine = new RegExp(p, f);
    this._global = flags.includes("g");
  }
  get lastIndex(): number {
    return this._lastIndex;
  }
  set lastIndex(v: number) {
    this._lastIndex = v;
  }
  exec(input: string): RegExpExecArray | null {
    const startFrom = this._global ? this._lastIndex : 0;
    for (const m of input.matchAll(this._engine)) {
      const idx = m.index ?? -1;
      if (idx < startFrom) {
        continue;
      }
      if (this._global) {
        const len = m[0].length;
        const end = idx + len;
        this._lastIndex = len === 0 ? end + 1 : end;
      }
      return m;
    }
    if (this._global) {
      this._lastIndex = 0;
    }
    return null;
  }
}