/* scriptc probe: final forms for user-regex v2 (dev only) */

// H1: escape-aware unsupported-assertion scanner
export function hasUnsupportedAssertion(pattern: string): boolean {
  let i = 0;
  const n = pattern.length;
  let inClass = false;
  while (i < n) {
    const c = pattern[i];
    if (c === "\\") {
      i += 2;
      continue;
    }
    if (inClass) {
      if (c === "]") {
        inClass = false;
      }
      i++;
      continue;
    }
    if (c === "[") {
      inClass = true;
      i++;
      continue;
    }
    if (c === "(" && pattern[i + 1] === "?") {
      const t = pattern[i + 2];
      if (t === "=" || t === "!") {
        return true;
      }
      if (t === "<") {
        const t3 = pattern[i + 3];
        if (t3 === "=" || t3 === "!") {
          return true;
        }
      }
    }
    i++;
  }
  return false;
}

// H2: numbered group fetch inside the loop
export function readGroupByIndex(re: RegExp, input: string): string {
  for (const m of input.matchAll(re)) {
    const v = m[1];
    return v === undefined ? "" : v;
  }
  return "";
}

// H3: build groups object manually + read back
export function groupBuildProbe(re: RegExp, input: string): string {
  for (const m of input.matchAll(re)) {
    const g: Record<string, string> = Object.create(null);
    const y = m[1];
    const mo = m[2];
    if (y !== undefined && y !== null) {
      g["year"] = y;
    }
    if (mo !== undefined && mo !== null) {
      g["month"] = mo;
    }
    const got = g["year"];
    return got === undefined ? "" : got;
  }
  return "";
}

// H4: null-cast push into string[] + read back
export function pushNullCast(re: RegExp, input: string): string {
  for (const m of input.matchAll(re)) {
    const row: string[] = [];
    row.push(m[0]);
    row.push(m[1] === undefined ? (null as unknown as string) : m[1]);
    const v = row[1];
    return v === null ? "null" : v;
  }
  return "";
}

// H5: collect all matches (global)
export function collectMatches(re: RegExp, input: string): string[] {
  const out: string[] = [];
  for (const m of input.matchAll(re)) {
    out.push(m[0]);
  }
  return out;
}

// H6: mini exec with own lastIndex semantics (incl. non-global)
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
  test(input: string): boolean {
    if (this._global) {
      this._lastIndex = 0;
    }
    return input.search(this._engine) >= 0;
  }
  search(input: string): number {
    return input.search(this._engine);
  }
}