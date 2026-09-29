/* scriptc probe: candidate regex inner forms, provider side (dev only) */

export interface NamedScanResult {
  dict: Record<string, number>;
  names: string[];
}

export function scanNamed(pattern: string): NamedScanResult {
  const dict: Record<string, number> = {};
  const names: string[] = [];
  let groupNo = 0;
  const n = pattern.length;
  let i = 0;
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
    if (c === "(") {
      if (pattern[i + 1] === "?") {
        const t = pattern[i + 2];
        if (t === "<") {
          const t3 = pattern[i + 3];
          if (t3 === "=" || t3 === "!") {
            i++;
            continue;
          }
          const close = pattern.indexOf(">", i + 3);
          if (close !== -1) {
            const name = pattern.slice(i + 3, close);
            groupNo++;
            dict[name] = groupNo;
            names.push(name);
            i = close + 1;
            continue;
          }
          i++;
          continue;
        }
        i++;
        continue;
      }
      groupNo++;
      i++;
      continue;
    }
    i++;
  }
  return { dict: dict, names: names };
}

export class UserRegexA {
  private readonly _engine: RegExp;
  private readonly _namedDict: Record<string, number>;
  private readonly _namedNames: string[];
  private _lastIndex = 0;
  constructor(pattern: string, flags: string) {
    let f = "g";
    if (flags.includes("i")) f += "i";
    if (flags.includes("m")) f += "m";
    if (flags.includes("s")) f += "s";
    if (flags.includes("u")) f += "u";
    this._engine = new RegExp(pattern, f);
    const scan = scanNamed(pattern);
    this._namedDict = scan.dict;
    this._namedNames = scan.names;
  }
  get lastIndex(): number {
    return this._lastIndex;
  }
  set lastIndex(v: number) {
    this._lastIndex = v;
  }
  *#rawRows(input: string): IterableIterator<RegExpMatchArray> {
    for (const m of input.matchAll(this._engine)) {
      yield m;
    }
  }
  *#rows(input: string): IterableIterator<RegExpMatchArray> {
    for (const m of input.matchAll(this._engine)) {
      const idx = m.index ?? -1;
      const full = m[0];
      const count = m.length - 1;
      const row: string[] = [];
      row.push(full);
      for (let i = 1; i <= count; i++) {
        const g = m[i];
        row.push(g === undefined ? (null as unknown as string) : g);
      }
      const rec = row as unknown as Record<string, unknown>;
      rec["index"] = idx;
      rec["input"] = input;
      if (this._namedNames.length > 0) {
        const gmap: Record<string, string> = Object.create(null);
        for (let k = 0; k < this._namedNames.length; k++) {
          const name = this._namedNames[k];
          const gi = this._namedDict[name];
          if (gi !== undefined) {
            const v = row[gi];
            if (v !== null && v !== undefined) {
              gmap[name] = v;
            }
          }
        }
        rec["groups"] = gmap;
      }
      yield row as unknown as RegExpMatchArray;
    }
  }
  matchAll(input: string): IterableIterator<RegExpMatchArray> {
    return this.#rows(input);
  }
  matchAllX(input: string): IterableIterator<RegExpMatchArray> {
    return this.#rawRows(input);
  }
  execFrom(input: string, from: number): number {
    for (const m of input.matchAll(this._engine)) {
      const idx = m.index ?? -1;
      if (idx >= from) {
        return idx;
      }
    }
    return -1;
  }
}

export class UserRegexB {
  private readonly _engine: RegExp;
  constructor(pattern: string, flags: string) {
    let f = "g";
    if (flags.includes("i")) f += "i";
    if (flags.includes("m")) f += "m";
    if (flags.includes("s")) f += "s";
    if (flags.includes("u")) f += "u";
    this._engine = new RegExp(pattern, f);
  }
  matchAll(input: string): IterableIterator<RegExpMatchArray> {
    return input.matchAll(this._engine);
  }
}

export function passTest(re: RegExp, input: string): string {
  for (const m of input.matchAll(re)) {
    const a = m[0];
    const i0 = m.index ?? -1;
    const c = m.length;
    return a + ":" + i0 + ":" + c;
  }
  return "";
}

export function callSpread(
  fn: (head: string, ...rest: (string | number)[]) => string,
): string {
  const args: (string | number)[] = ["x", 1, "y"];
  return fn("head", ...args);
}