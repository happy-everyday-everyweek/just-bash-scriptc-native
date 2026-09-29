/* scriptc probe: matchAll-driven regex rewrite forms (dev only) */

// A1: index read inside for-of over direct matchAll (module fn, re param)
export function firstIdx(re: RegExp, input: string): number {
  for (const m of input.matchAll(re)) {
    return m.index;
  }
  return -1;
}

// B: search / split / replace via native string methods
export function searchVia(re: RegExp, input: string): number {
  return input.search(re);
}
export function splitVia(re: RegExp, input: string): string[] {
  return input.split(re);
}
export function replaceVia(re: RegExp, input: string, rep: string): string {
  return input.replace(re, rep);
}

// C: return row / collect rows
export function firstRow(re: RegExp, input: string): RegExpMatchArray | null {
  for (const m of input.matchAll(re)) {
    return m;
  }
  return null;
}
export function collectRows(re: RegExp, input: string): RegExpMatchArray[] {
  const out: RegExpMatchArray[] = [];
  for (const m of input.matchAll(re)) {
    out.push(m);
  }
  return out;
}

// D: module-level generator over matchAll
export function* rowsGen(
  re: RegExp,
  input: string,
): IterableIterator<RegExpMatchArray> {
  for (const m of input.matchAll(re)) {
    yield m;
  }
}

// E: lastIndex read
export function lastIdxRead(re: RegExp): number {
  return re.lastIndex;
}

// F: class context: this._engine as matchAll arg, row fields inside loop
export class RE3 {
  private readonly _engine: RegExp;
  constructor(p: string) {
    this._engine = new RegExp(p, "g");
  }
  classFirstIdx(input: string): number {
    for (const m of input.matchAll(this._engine)) {
      return m.index;
    }
    return -1;
  }
  pick(input: string, i: number): string {
    for (const m of input.matchAll(this._engine)) {
      const a = m[0];
      const b = m[1];
      const c = m[i];
      return a + "|" + b + "|" + (c === undefined ? "" : c);
    }
    return "";
  }
  groupsTry(input: string): string {
    for (const m of input.matchAll(this._engine)) {
      const g = m.groups;
      if (g === undefined) {
        return "";
      }
      return "has-groups";
    }
    return "";
  }
  buildRecord(input: string): string {
    for (const m of input.matchAll(this._engine)) {
      const idx = m.index;
      const rec: Record<string, string | number> = {};
      rec["0"] = m[0];
      rec["index"] = idx;
      rec["input"] = input;
      const back = rec["0"];
      const backIdx = rec["index"];
      return back + ":" + (typeof backIdx === "number" ? backIdx : 0);
    }
    return "";
  }
  attachProps(input: string): number {
    for (const m of input.matchAll(this._engine)) {
      const row: string[] = [];
      row.push(m[0]);
      const dyn = row as unknown as Record<string, unknown>;
      dyn["index"] = m.index;
      const back = row as unknown as { index?: number };
      const ix = back["index"];
      return ix === undefined ? -1 : ix;
    }
    return -1;
  }
  iterOut(input: string): IterableIterator<RegExpMatchArray> {
    return rowsGen(this._engine, input);
  }
}

// G: transparent passthrough of native matchAll iterator + indirect consumption
export class RE5 {
  private readonly _engine: RegExp;
  constructor(p: string) {
    this._engine = new RegExp(p, "g");
  }
  transOut(input: string): IterableIterator<RegExpMatchArray> {
    return input.matchAll(this._engine);
  }
  consumeDirect(input: string): number {
    let n = 0;
    for (const m of input.matchAll(this._engine)) {
      const idx = m.index ?? 0;
      const g0 = m[0];
      n += idx >= 0 ? 1 : 0;
      if (g0.length >= 0 && m.length >= 1) {
        n += 0;
      }
    }
    return n;
  }
  consumeTrans(input: string): number {
    let n = 0;
    for (const m of this.transOut(input)) {
      const idx = m.index ?? 0;
      const g0 = m[0];
      n += idx >= 0 ? 1 : 0;
      if (g0.length >= 0 && m.length >= 1) {
        n += 0;
      }
      const sl = m.slice(1);
      n += sl.length > 0 ? 1 : 0;
    }
    return n;
  }
}
