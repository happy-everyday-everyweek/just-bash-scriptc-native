/* scriptc probe: regex rewrite candidates (dev only) */
export interface CompiledPattern {
  source: string;
  flags: string;
}

const cache = new Map<string, CompiledPattern>();
const order: string[] = [];

export function getOrBuild(pattern: string, flags: string): CompiledPattern {
  const key = flags + " " + pattern;
  const hit = cache.get(key);
  if (hit !== undefined) {
    return hit;
  }
  const made: CompiledPattern = { source: pattern, flags: flags };
  if (cache.size >= 4) {
    const oldest = order.shift();
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  order.push(key);
  cache.set(key, made);
  return made;
}

export function getOrBuildKeys(pattern: string, flags: string): CompiledPattern {
  const key = flags + " " + pattern;
  const hit = cache.get(key);
  if (hit !== undefined) {
    return hit;
  }
  const made: CompiledPattern = { source: pattern, flags: flags };
  if (cache.size >= 4) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) {
      cache.delete(oldest);
    }
  }
  cache.set(key, made);
  return made;
}

export class REx {
  private readonly _engine: RegExp;
  private _last = 0;
  constructor(pattern: string, flags: string) {
    let f = "g";
    if (flags.includes("i")) f += "i";
    if (flags.includes("m")) f += "m";
    if (flags.includes("s")) f += "s";
    if (flags.includes("u")) f += "u";
    this._engine = new RegExp(pattern, f);
  }
  execCount(input: string): number {
    let pos = 0;
    let count = 0;
    while (true) {
      this._engine.lastIndex = pos;
      const m = this._engine.exec(input);
      if (m === null) {
        break;
      }
      count++;
      pos = m.index + m[0].length;
      if (m[0].length === 0) {
        pos++;
      }
      if (pos > input.length) {
        break;
      }
    }
    return count;
  }
  singleExec(input: string): number {
    this._last = 0;
    this._engine.lastIndex = this._last;
    const m = this._engine.exec(input);
    if (m === null) {
      this._last = 0;
      return -1;
    }
    const start = m.index;
    let end = m.index + m[0].length;
    this._last = end;
    if (m[0].length === 0) {
      this._last = end + 1;
    }
    return start;
  }
  groupProbe(input: string): string {
    this._engine.lastIndex = 0;
    const m = this._engine.exec(input);
    if (m === null || m.groups === undefined) {
      return "";
    }
    const g = m.groups;
    if (Object.prototype.hasOwnProperty.call(g, "year")) {
      const v = g["year"];
      if (v !== undefined) {
        return v;
      }
    }
    return "";
  }
  copyGroups(input: string): string {
    this._engine.lastIndex = 0;
    const m = this._engine.exec(input);
    if (m === null || m.groups === undefined) {
      return "";
    }
    const src = m.groups;
    const safe: Record<string, string> = Object.create(null);
    for (const name of Object.keys(src)) {
      const v = src[name];
      if (v !== undefined) {
        safe[name] = v;
      }
    }
    const parts: string[] = [];
    for (const name of Object.keys(safe)) {
      parts.push(name + "=" + safe[name]);
    }
    return parts.join(",");
  }
  matchAllVia(input: string): number {
    let n = 0;
    const it = genMatches(this._engine, input);
    let step = it.next();
    while (step.done !== true) {
      n++;
      step = it.next();
    }
    return n;
  }
}

function* genMatches(
  re: RegExp,
  input: string,
): IterableIterator<RegExpMatchArray> {
  let pos = 0;
  re.lastIndex = 0;
  while (true) {
    re.lastIndex = pos;
    const m = re.exec(input);
    if (m === null) {
      break;
    }
    yield m;
    pos = m.index + m[0].length;
    if (m[0].length === 0) {
      pos++;
    }
    if (pos > input.length) {
      break;
    }
  }
}

export function collectViaForOf(input: string): number {
  const re = new RegExp("o+", "g");
  let n = 0;
  for (const _m of genMatches(re, input)) {
    n++;
  }
  return n;
}
