/* scriptc probe: row attach + consumption forms (dev only) */

// A1: Object.assign onto array
export function attachAssign(): string {
  const row: string[] = ["a"];
  Object.assign(row, { index: 3 });
  const back = row as unknown as { index?: number };
  const ix = back["index"];
  return ix === undefined ? "none" : "" + ix;
}

// A2: Object.defineProperty
export function attachDefine(): string {
  const row: string[] = ["a"];
  Object.defineProperty(row, "index", {
    value: 3,
    writable: true,
    configurable: true,
  });
  const back = row as unknown as { index?: number };
  const ix = back["index"];
  return ix === undefined ? "none" : "" + ix;
}

// A3: narrow record cast then write field
export function attachNarrow(): string {
  const row: string[] = ["a"];
  const dyn = row as unknown as { index?: number };
  dyn.index = 3;
  const ix = dyn["index"];
  return ix === undefined ? "none" : "" + ix;
}

// A4: narrow record cast, write full field set
export function attachFull(): string {
  const row: string[] = ["a"];
  const dyn = row as unknown as {
    index?: number;
    input?: string;
    groups?: Record<string, string>;
  };
  dyn.index = 3;
  dyn.input = "x";
  const g: Record<string, string> = {};
  g["y"] = "1";
  dyn.groups = g;
  const ix = dyn.index;
  return ix === undefined ? "none" : "" + ix;
}

// A5: cast to RegExpExecArray then write/read
export function attachExecArray(): string {
  const row: string[] = ["a"];
  const ex = row as unknown as RegExpExecArray;
  ex.index = 3;
  const ix = ex.index;
  return ix === undefined ? "none" : "" + ix;
}

// A6: intersection type array
export function attachIntersect(): string {
  const row = [] as unknown as string[] & { index?: number };
  row.push("a");
  row.index = 3;
  const ix = row.index;
  return ix === undefined ? "none" : "" + ix;
}

// B1/B2: consumption via string-receiver matchAll over class-held RegExp
export class RX {
  private readonly _native: RegExp;
  constructor(p: string, f: string) {
    this._native = new RegExp(p, f);
  }
  get native(): RegExp {
    return this._native;
  }
  useNative(input: string): number {
    const rn = this.native;
    let last = -1;
    for (const m of input.matchAll(rn)) {
      const idx = m.index ?? -1;
      if (idx >= 0) {
        last = idx;
      }
    }
    return last;
  }
  useNativeInline(input: string): number {
    let last = -1;
    for (const m of input.matchAll(this.native)) {
      const idx = m.index ?? -1;
      if (idx >= 0) {
        last = idx;
      }
    }
    return last;
  }
}

// B3/B4: exec result index read: direct vs dict
export function execIndexDirect(re: RegExp, s: string): number {
  const m = re.exec(s);
  if (m === null) {
    return -1;
  }
  return m.index ?? -1;
}

export function execIndexViaDict(re: RegExp, s: string): number {
  const m = re.exec(s);
  if (m === null) {
    return -1;
  }
  const rec = m as unknown as Record<string, number>;
  const ix = rec["index"];
  return ix === undefined ? -1 : ix;
}

// B5: s.match single result via dict
export function matchIndexViaDict(re: RegExp, s: string): number {
  const m = s.match(re);
  if (m === null) {
    return -1;
  }
  const rec = m as unknown as Record<string, number>;
  const ix = rec["index"];
  return ix === undefined ? -1 : ix;
}