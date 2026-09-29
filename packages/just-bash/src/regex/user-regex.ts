/**
 * UserRegex - Centralized regex handling for user-provided patterns
 *
 * This module provides a single point of control for all user-provided regex
 * execution. The engine is the platform's native RegExp; matching is driven
 * by eager `String.prototype.matchAll` drains so every call site stays on the
 * statically-compilable surface, and compiled (pattern, flags) pairs are
 * cached and shared between identical constructions.
 *
 * All user-provided regex patterns should go through this module.
 * Internal patterns (those we control) can use ConstantRegex for the same interface.
 */

import { BoundedStringBuilder } from "../bounded-builder.js";
import { ExecutionLimitError } from "../interpreter/errors.js";

const DEFAULT_MAX_REGEX_RESULTS = 1_000_000;
const DEFAULT_MAX_REGEX_OUTPUT_BYTES = 64 * 1024 * 1024;

export interface UserRegexLimits {
  maxResults?: number;
  maxOutputBytes?: number;
  signal?: { aborted: boolean };
}

/**
 * Type for replacement callback functions.
 * Matches the signature of String.prototype.replace callback.
 */
export type ReplaceCallback = (
  match: string,
  ...args: (string | number | Record<string, string>)[]
) => string;

/**
 * Common interface for regex wrappers.
 * Both UserRegex (for user patterns) and ConstantRegex (for internal patterns) implement this.
 */
export interface RegexLike {
  test(input: string): boolean;
  exec(input: string): RegExpExecArray | null;
  match(input: string): RegExpMatchArray | null;
  replace(input: string, replacement: string | ReplaceCallback): string;
  split(input: string, limit?: number): string[];
  search(input: string): number;
  matchAll(input: string): IterableIterator<RegExpMatchArray>;
  readonly native: RegExp;
  readonly source: string;
  readonly flags: string;
  readonly global: boolean;
  readonly ignoreCase: boolean;
  readonly multiline: boolean;
  lastIndex: number;
}

/**
 * Convert string flags to the set of matching-relevant native flags.
 * The wrapper handles 'g' itself; 'd' and 'y' are not part of the engine's
 * matching behavior here and are ignored, mirroring the historical engine.
 */
function matchingFlags(flags: string): string {
  let f = "";
  if (flags.includes("i")) {
    f += "i";
  }
  if (flags.includes("m")) {
    f += "m";
  }
  if (flags.includes("s")) {
    f += "s";
  }
  if (flags.includes("u")) {
    f += "u";
  }
  return f;
}

/**
 * Reject lookahead / lookbehind assertions with the historical message.
 * RE2 (the previous engine) could not support them; the rejection is kept so
 * rejected patterns behave identically.
 */
function hasUnsupportedAssertion(pattern: string): boolean {
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

interface NamedScanResult {
  dict: Record<string, number>;
  names: string[];
}

/**
 * Scan a pattern for named capture groups and their group numbers.
 * Skips escaped characters and character classes. Non-capturing groups
 * (?: ...) do not take a number; lookaround was rejected before this runs.
 */
function scanNamedGroups(pattern: string): NamedScanResult {
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

/**
 * A compiled (pattern, matching-flags) pair. Immutable and shared between
 * UserRegex instances built from the same pattern and matching flags.
 * Keyed on the normalized matching flags because 'g' and 'd' are handled by
 * the UserRegex wrapper, not the engine.
 */
interface CompiledPattern {
  source: string;
  engineFlags: string;
  namedDict: Record<string, number>;
  namedNames: string[];
}

// Patterns are user-controlled and unbounded in length, so oversized ones are
// compiled but not retained — the cache holds at most 256 entries.
const COMPILED_CACHE_MAX = 256;
const COMPILED_CACHE_MAX_PATTERN_LENGTH = 1024;
const compiledCache = new Map<string, CompiledPattern>();
const compiledOrder: string[] = [];

function compilePattern(pattern: string, flags: string): CompiledPattern {
  const mf = matchingFlags(flags);
  if (pattern.length > COMPILED_CACHE_MAX_PATTERN_LENGTH) {
    const scanLong = scanNamedGroups(pattern);
    return {
      source: pattern,
      engineFlags: "g" + mf,
      namedDict: scanLong.dict,
      namedNames: scanLong.names,
    };
  }
  const key = mf + " " + pattern;
  const cached = compiledCache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  const scan = scanNamedGroups(pattern);
  const compiled: CompiledPattern = {
    source: pattern,
    engineFlags: "g" + mf,
    namedDict: scan.dict,
    namedNames: scan.names,
  };
  if (compiledCache.size >= COMPILED_CACHE_MAX) {
    const oldest = compiledOrder.shift();
    if (oldest !== undefined) {
      compiledCache.delete(oldest);
    }
  }
  compiledOrder.push(key);
  compiledCache.set(key, compiled);
  return compiled;
}

/**
 * A wrapper around native RegExp that provides a RegExp-compatible interface.
 * Matching is driven by `String.prototype.matchAll` drains; per-instance
 * state (lastIndex, limits, AbortSignal) stays on each UserRegex.
 */
export class UserRegex implements RegexLike {
  private readonly _re2: CompiledPattern;
  private readonly _pattern: string;
  private readonly _flags: string;
  private readonly _global: boolean;
  private readonly _ignoreCase: boolean;
  private readonly _multiline: boolean;
  private readonly _engine: RegExp;
  private readonly _namedDict: Record<string, number>;
  private readonly _namedNames: string[];
  private _lastIndex = 0;
  // Cache native RegExp for compatibility - created lazily
  private _nativeRegex: RegExp | null = null;
  private readonly maxResults: number;
  private readonly maxOutputBytes: number;
  private readonly signal?: { aborted: boolean };

  constructor(pattern: string, flags = "", limits: UserRegexLimits = {}) {
    this._pattern = pattern;
    this._flags = flags;
    this._global = flags.includes("g");
    this._ignoreCase = flags.includes("i");
    this._multiline = flags.includes("m");
    this.maxResults = limits.maxResults ?? DEFAULT_MAX_REGEX_RESULTS;
    this.maxOutputBytes =
      limits.maxOutputBytes ?? DEFAULT_MAX_REGEX_OUTPUT_BYTES;
    this.signal = limits.signal;
    if (
      !Number.isSafeInteger(this.maxResults) ||
      this.maxResults < 0 ||
      !Number.isSafeInteger(this.maxOutputBytes) ||
      this.maxOutputBytes < 0
    ) {
      throw new Error("invalid regular expression limits");
    }

    if (hasUnsupportedAssertion(pattern)) {
      throw new SyntaxError(
        `Invalid regular expression: /${pattern}/: Lookahead (?=, ?!) and lookbehind (?<=, ?<!) assertions are not supported in this environment because the regex engine uses RE2 for ReDoS protection. RE2 guarantees linear-time matching but cannot support these features.`,
      );
    }

    const compiled = compilePattern(pattern, flags);
    // Validate the pattern up front — throws a SyntaxError on bad syntax.
    const engine = new RegExp(compiled.source, compiled.engineFlags);
    this._re2 = compiled;
    this._engine = engine;
    this._namedDict = compiled.namedDict;
    this._namedNames = compiled.namedNames;
  }

  private assertResultCount(count: number): void {
    if (this.signal?.aborted) throw new Error("regular expression aborted");
    if (count > this.maxResults) {
      throw new ExecutionLimitError(
        `regular expression result limit exceeded (${this.maxResults})`,
        "array_elements",
      );
    }
  }

  private expandReplacementFromValues(
    values: string[],
    replacement: string,
  ): string {
    const output = new BoundedStringBuilder(
      this.maxOutputBytes,
      "regular expression replacement",
    );
    const groupCount = values.length - 1;
    for (let index = 0; index < replacement.length; index++) {
      const char = replacement[index];
      if (char === "\\" && index + 1 < replacement.length) {
        output.append(replacement[++index]);
        continue;
      }
      if (char !== "$" || index + 1 >= replacement.length) {
        output.append(char);
        continue;
      }
      if (replacement[index + 1] === "{") {
        const end = replacement.indexOf("}", index + 2);
        if (end !== -1) {
          const name = replacement.slice(index + 2, end);
          const groupIndex = this._namedDict[name];
          if (groupIndex !== undefined) {
            const gv = values[groupIndex];
            output.append(gv === undefined ? "" : gv);
            index = end;
            continue;
          }
        }
      }
      const firstCode = replacement.charCodeAt(index + 1);
      if (firstCode >= 48 && firstCode <= 57) {
        let end = index + 1;
        let group = 0;
        while (end < replacement.length) {
          const code = replacement.charCodeAt(end);
          if (code < 48 || code > 57) {
            break;
          }
          const candidate = group * 10 + (code - 48);
          if (candidate > groupCount) {
            break;
          }
          group = candidate;
          end++;
        }
        const gv = values[group];
        output.append(gv === undefined ? "" : gv);
        index = end - 1;
        continue;
      }
      output.append(char);
    }
    return output.build();
  }

  /**
   * Test if the pattern matches the input string.
   */
  test(input: string): boolean {
    // Reset lastIndex for global regexes to ensure consistent behavior
    if (this._global) {
      this._lastIndex = 0;
    }
    return input.search(this._engine) >= 0;
  }

  /**
   * Execute the pattern against the input string.
   * Returns match array with capture groups, or null if no match.
   */
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

  /**
   * Match the input string against the pattern.
   * With global flag, returns all matches. Without, returns first match with groups.
   */
  match(input: string): RegExpMatchArray | null {
    // Reset lastIndex for consistent behavior
    if (this._global) {
      this._lastIndex = 0;
    }

    if (!this._global) {
      // Non-global: return first match with groups (same as exec)
      return this.exec(input);
    }

    // Global: return all matches without groups
    const matches: string[] = [];
    for (const m of input.matchAll(this._engine)) {
      this.assertResultCount(matches.length + 1);
      matches.push(m[0]);
    }

    return matches.length > 0
      ? (matches as unknown as RegExpMatchArray)
      : null;
  }

  /**
   * Replace matches in the input string.
   * @param input - The string to search in
   * @param replacement - A string or callback function
   */
  replace(input: string, replacement: string | ReplaceCallback): string {
    // Reset lastIndex for global regexes
    if (this._global) {
      this._lastIndex = 0;
    }

    if (typeof replacement === "string") {
      const output = new BoundedStringBuilder(
        this.maxOutputBytes,
        "regular expression replacement",
      );
      let lastEnd = 0;
      let count = 0;
      for (const m of input.matchAll(this._engine)) {
        this.assertResultCount(++count);
        const start = m.index ?? -1;
        const full = m[0];
        const end = start + full.length;
        const cnt = m.length;
        const values: string[] = [];
        values.push(full);
        for (let gi = 1; gi < cnt; gi++) {
          const g = m[gi];
          values.push(g === undefined ? "" : g);
        }
        output.append(input.slice(lastEnd, start));
        output.append(this.expandReplacementFromValues(values, replacement));
        lastEnd = end;
        const nxt = end > start ? end : end + 1;
        if (!this._global) {
          break;
        }
        if (nxt > input.length) {
          break;
        }
      }
      output.append(input.slice(lastEnd));
      return output.build();
    }

    // Callback replacement. Each iteration uses a fresh matchAll drain, so a
    // callback that re-enters this same UserRegex instance cannot corrupt the
    // iteration state.
    const result = new BoundedStringBuilder(
      this.maxOutputBytes,
      "regular expression replacement",
    );
    let lastEnd = 0;
    let matchCount = 0;
    for (const m of input.matchAll(this._engine)) {
      this.assertResultCount(++matchCount);
      const start = m.index ?? -1;
      const full = m[0];
      const end = start + full.length;
      const cnt = m.length;
      result.append(input.slice(lastEnd, start));

      // Build callback arguments
      const args: (string | number | Record<string, string>)[] = [];
      for (let gi = 1; gi < cnt; gi++) {
        const g = m[gi];
        args.push(g === undefined ? (null as unknown as string) : g);
      }
      args.push(start);
      args.push(input);
      if (this._namedNames.length > 0) {
        // Use Object.create(null) to prevent prototype pollution from names like __proto__
        const groups: Record<string, string> = Object.create(null);
        for (let k = 0; k < this._namedNames.length; k++) {
          const name = this._namedNames[k];
          const gi2 = this._namedDict[name];
          if (gi2 !== undefined) {
            const gv = m[gi2];
            if (gv !== undefined) {
              groups[name] = gv;
            }
          }
        }
        args.push(groups);
      }

      const matchStart = start;
      const matchEnd = end;
      result.append(replacement(full, ...args));

      lastEnd = matchEnd;
      const nxt = matchEnd > matchStart ? matchEnd : matchEnd + 1;
      if (!this._global) {
        break;
      }
      if (nxt > input.length) {
        break;
      }
    }

    result.append(input.slice(lastEnd));
    return result.build();
  }

  /**
   * Split the input string by the pattern.
   * JS split semantics: at most `limit` elements.
   */
  split(input: string, limit?: number): string[] {
    if (limit === 0) {
      return [];
    }
    const effectiveLimit =
      limit === undefined || limit < 0
        ? this.maxResults
        : Math.min(limit, this.maxResults);
    const result: string[] = [];
    let lastEnd = 0;
    let searchFrom = 0;
    for (const m of input.matchAll(this._engine)) {
      const start = m.index ?? -1;
      if (start < searchFrom) {
        continue;
      }
      if (result.length >= effectiveLimit) {
        break;
      }
      this.assertResultCount(result.length + 1);
      result.push(input.slice(lastEnd, start));
      const end = start + m[0].length;
      lastEnd = end;
      searchFrom = end > start ? end : end + 1;
    }
    if (result.length < effectiveLimit) result.push(input.slice(lastEnd));
    return result;
  }

  /**
   * Search for the pattern in the input string.
   * Returns the index of the first match, or -1 if not found.
   */
  search(input: string): number {
    return input.search(this._engine);
  }

  /**
   * Get all matches using an iterator (for global regexes).
   */
  matchAll(input: string): IterableIterator<RegExpMatchArray> {
    return this.#rows(input);
  }

  *#rows(input: string): IterableIterator<RegExpMatchArray> {
    if (!this._global) {
      throw new Error("matchAll requires global flag");
    }
    this._lastIndex = 0;
    let count = 0;
    for (const m of input.matchAll(this._engine)) {
      count++;
      this.assertResultCount(count);
      yield m;
    }
  }

  /**
   * Named capture groups of the compiled pattern: name -> group number.
   */
  get namedGroupIndex(): Record<string, number> {
    return this._namedDict;
  }

  /**
   * Get the underlying RegExp object.
   * Creates a native RegExp lazily for compatibility with code that needs it.
   */
  get native(): RegExp {
    if (this._nativeRegex === null) {
      this._nativeRegex = new RegExp(this._pattern, this._flags);
    }
    return this._nativeRegex;
  }

  /**
   * Get the pattern string.
   */
  get source(): string {
    return this._pattern;
  }

  /**
   * Get the flags string.
   */
  get flags(): string {
    return this._flags;
  }

  /**
   * Check if this is a global regex.
   */
  get global(): boolean {
    return this._global;
  }

  /**
   * Check if this is a case-insensitive regex.
   */
  get ignoreCase(): boolean {
    return this._ignoreCase;
  }

  /**
   * Check if this is a multiline regex.
   */
  get multiline(): boolean {
    return this._multiline;
  }

  /**
   * Get/set lastIndex for global regexes.
   */
  get lastIndex(): number {
    return this._lastIndex;
  }

  set lastIndex(value: number) {
    this._lastIndex = value;
  }
}

/**
 * Create a UserRegex from a pattern string and flags.
 * This is the primary entry point for user-provided regex patterns.
 *
 * @param pattern - The regex pattern string
 * @param flags - Optional regex flags (g, i, m, s, u)
 * @returns A UserRegex instance
 * @throws Error if the pattern is invalid
 */
export function createUserRegex(
  pattern: string,
  flags = "",
  limits: UserRegexLimits = {},
): UserRegex {
  return new UserRegex(pattern, flags, limits);
}

/**
 * A wrapper around native RegExp for constant/internal patterns.
 * Use this for patterns we control (not user-provided).
 * Implements the same interface as UserRegex for consistency.
 */
export class ConstantRegex implements RegexLike {
  private readonly _regex: RegExp;

  constructor(regex: RegExp) {
    this._regex = regex;
  }

  test(input: string): boolean {
    return input.search(this._regex) >= 0;
  }

  exec(input: string): RegExpExecArray | null {
    return this._regex.exec(input);
  }

  match(input: string): RegExpMatchArray | null {
    return input.match(this._regex);
  }

  replace(input: string, replacement: string | ReplaceCallback): string {
    return input.replace(
      this._regex,
      replacement as (substring: string, ...args: unknown[]) => string,
    );
  }

  split(input: string, limit?: number): string[] {
    return input.split(this._regex, limit);
  }

  search(input: string): number {
    return input.search(this._regex);
  }

  matchAll(input: string): IterableIterator<RegExpMatchArray> {
    return this.#rows(input);
  }

  *#rows(input: string): IterableIterator<RegExpMatchArray> {
    if (!this._regex.global) {
      throw new Error("matchAll requires global flag");
    }
    // Use a fresh clone so iteration always starts at index 0.
    const fresh = new RegExp(this._regex.source, this._regex.flags);
    for (const m of input.matchAll(fresh)) {
      yield m;
    }
  }

  get native(): RegExp {
    return this._regex;
  }

  get source(): string {
    return this._regex.source;
  }

  get flags(): string {
    return this._regex.flags;
  }

  get global(): boolean {
    return this._regex.global;
  }

  get ignoreCase(): boolean {
    return this._regex.ignoreCase;
  }

  get multiline(): boolean {
    return this._regex.multiline;
  }

  get lastIndex(): number {
    return this._regex.lastIndex;
  }

  set lastIndex(_value: number) {
    // Native RegExp lastIndex writes are not available on this platform;
    // the wrapper keeps its own state instead, so this is a no-op.
  }
}