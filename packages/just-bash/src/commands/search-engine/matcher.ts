/**
 * Core content matching logic for search commands
 */

import {
  ExecutionAbortedError,
  ExecutionLimitError,
} from "../../interpreter/errors.js";
import type { UserRegex } from "../../regex/index.js";
import type { PreFilter } from "./regex.js";

/**
 * Substring fast-path check: returns true if at least one needle is present
 * in the line, meaning the regex *might* match. False means provably no match.
 *
 * For case-insensitive filters, the line is lowercased once per call. Both the
 * needles and the line are compared in lowercase.
 */
/** Ensure a RegExp carries the global flag (matchAll requires it). */
function ensureGlobalRegex(re: RegExp): RegExp {
  return re.flags.includes("g") ? re : new RegExp(re.source, re.flags + "g");
}

function preFilterMatches(preFilter: PreFilter, line: string): boolean {
  const haystack = preFilter.ignoreCase ? line.toLowerCase() : line;
  const needles = preFilter.needles;
  for (let i = 0; i < needles.length; i++) {
    if (haystack.indexOf(needles[i]) !== -1) return true;
  }
  return false;
}

/**
 * Apply a replacement pattern using capture data from a regex match.
 * Supports: $& (full match), $1-$N (numbered groups), $<name> (named groups)
 */
function applyReplacement(
  replacement: string,
  full: string,
  values: string[],
  named: Record<string, string>,
): string {
  const parts: string[] = [];
  let i = 0;
  while (i < replacement.length) {
    const ch = replacement[i];
    if (ch === "$" && i + 1 < replacement.length) {
      const nx = replacement[i + 1];
      if (nx === "&") {
        parts.push(full);
        i += 2;
        continue;
      }
      if (nx === "<") {
        const close = replacement.indexOf(">", i + 2);
        if (close !== -1 && close > i + 2) {
          const name = replacement.slice(i + 2, close);
          const v = named[name];
          parts.push(v === undefined ? "" : v);
          i = close + 1;
          continue;
        }
      }
      const code = replacement.charCodeAt(i + 1);
      if (code >= 48 && code <= 57) {
        let j = i + 1;
        let num = 0;
        while (j < replacement.length) {
          const c2 = replacement.charCodeAt(j);
          if (c2 < 48 || c2 > 57) {
            break;
          }
          num = num * 10 + (c2 - 48);
          j++;
        }
        const v = values[num];
        parts.push(v === undefined ? "" : v);
        i = j;
        continue;
      }
    }
    parts.push(ch);
    i++;
  }
  return parts.join("");
}

/**
 * Apply a replacement template to every non-empty match of `re` in `input`.
 * Empty matches are skipped to avoid double replacement with patterns like .*
 * and to mirror the previous String.replace-callback behavior.
 */
function replaceWithTemplate(
  input: string,
  re: RegExp,
  template: string,
  namedDict: Record<string, number>,
): string {
  const parts: string[] = [];
  const namedNames = Object.keys(namedDict);
  let last = 0;
  const reG = ensureGlobalRegex(re);
  for (const m of input.matchAll(reG)) {
    const idx = m.index ?? 0;
    const full = m[0];
    parts.push(input.slice(last, idx));
    if (full.length > 0) {
      const values: string[] = [];
      values.push(full);
      const cnt = m.length;
      for (let gi = 1; gi < cnt; gi++) {
        const g = m[gi];
        values.push(g === undefined ? "" : g);
      }
      const namedValues: Record<string, string> = Object.create(null);
      for (let k = 0; k < namedNames.length; k++) {
        const nm = namedNames[k];
        const gi2 = namedDict[nm];
        if (gi2 !== undefined) {
          const gv = m[gi2];
          if (gv !== undefined) {
            namedValues[nm] = gv;
          }
        }
      }
      parts.push(applyReplacement(template, full, values, namedValues));
      last = idx + full.length;
    }
  }
  parts.push(input.slice(last));
  return parts.join("");
}

export interface SearchOptions {
  /** Select non-matching lines */
  invertMatch?: boolean;
  /** Print line number with output lines */
  showLineNumbers?: boolean;
  /** Print only a count of matching lines */
  countOnly?: boolean;
  /** Count individual matches instead of lines (--count-matches) */
  countMatches?: boolean;
  /** Filename prefix for output (empty string for no prefix) */
  filename?: string;
  /** Show only the matching parts of lines */
  onlyMatching?: boolean;
  /** Print NUM lines of leading context */
  beforeContext?: number;
  /** Print NUM lines of trailing context */
  afterContext?: number;
  /** Stop after NUM matches (0 = unlimited) */
  maxCount?: number;
  /** Separator between context groups (default: --) */
  contextSeparator?: string;
  /** Show column number of first match */
  showColumn?: boolean;
  /** Output each match separately (vimgrep format) */
  vimgrep?: boolean;
  /** Show byte offset of each match */
  showByteOffset?: boolean;
  /** Replace matched text with this string */
  replace?: string | null;
  /** Print all lines (matches use :, non-matches use -) */
  passthru?: boolean;
  /** Enable multiline matching (patterns can span lines) */
  multiline?: boolean;
  /** If \K was used, this is the capture group index containing the "real" match */
  kResetGroup?: number;
  /**
   * Optional substring fast-path: skip RE2 entirely for lines where no needle
   * is present. Pre-computed by buildRegex from the source pattern.
   */
  preFilter?: PreFilter | null;
  /** Maximum synchronous matching/formatting work units. */
  maxWork?: number;
  /** Maximum retained match objects. */
  maxMatches?: number;
  /** Cooperative cancellation signal checked during long scans. */
  signal?: AbortSignal;
}

export interface SearchResult {
  /** The formatted output string */
  output: string;
  /** Whether any matches were found */
  matched: boolean;
  /** Number of matches found */
  matchCount: number;
}

/**
 * Search content for regex matches and format output
 *
 * Handles:
 * - Count only mode (-c)
 * - Line numbers (-n)
 * - Invert match (-v)
 * - Only matching (-o)
 * - Context lines (-A, -B, -C)
 * - Max count (-m)
 */
export function searchContent(
  content: string,
  regex: UserRegex,
  options: SearchOptions = {},
): SearchResult {
  const {
    invertMatch = false,
    showLineNumbers = false,
    countOnly = false,
    countMatches = false,
    filename = "",
    onlyMatching = false,
    beforeContext = 0,
    afterContext = 0,
    maxCount = 0,
    contextSeparator = "--",
    showColumn = false,
    vimgrep = false,
    showByteOffset = false,
    replace = null,
    passthru = false,
    multiline = false,
    kResetGroup,
    preFilter,
    maxWork,
    maxMatches,
    signal,
  } = options;

  // Multiline mode: search entire content as one string
  if (multiline) {
    return searchContentMultiline(content, regex, {
      invertMatch,
      showLineNumbers,
      countOnly,
      countMatches,
      filename,
      onlyMatching,
      beforeContext,
      afterContext,
      maxCount,
      contextSeparator,
      showColumn,
      showByteOffset,
      replace,
      kResetGroup,
      preFilter,
      maxWork,
      maxMatches,
      signal,
    });
  }

  let work = 0;
  const chargeWork = (amount = 1): void => {
    if (signal?.aborted) throw new ExecutionAbortedError();
    work += amount;
    if (maxWork !== undefined && work > maxWork) {
      throw new ExecutionLimitError(
        `search: matching work limit exceeded (${maxWork})`,
        "iterations",
      );
    }
  };
  const pushOutput = (lines: string[], value: string): void => {
    if (maxMatches !== undefined && lines.length >= maxMatches) {
      throw new ExecutionLimitError(
        `search: result limit exceeded (${maxMatches})`,
        "array_elements",
      );
    }
    lines.push(value);
  };

  let prospectiveLineCount = 1;
  for (let index = 0; index < content.length; index++) {
    if ((index & 1023) === 0) chargeWork();
    if (content.charCodeAt(index) === 10) {
      prospectiveLineCount++;
      if (maxMatches !== undefined && prospectiveLineCount > maxMatches) {
        throw new ExecutionLimitError(
          `search: line limit exceeded (${maxMatches})`,
          "array_elements",
        );
      }
    }
  }

  const lines = content.split("\n");
  const lineCount = lines.length;
  // Handle trailing empty line from split if content ended with newline
  const lastIdx =
    lineCount > 0 && lines[lineCount - 1] === "" ? lineCount - 1 : lineCount;

  // Fast path: count only mode
  if (countOnly || countMatches) {
    let matchCount = 0;
    // --count --only-matching behaves like --count-matches
    const shouldCountMatches = (countMatches || onlyMatching) && !invertMatch;
    for (let i = 0; i < lastIdx; i++) {
      chargeWork();
      const line = lines[i];
      // Pre-filter: skip lines that can't contain any required literal.
      // For invertMatch=true (-vc), a no-match line still counts, so we
      // can't skip it — only short-circuit when not inverting.
      if (preFilter && !invertMatch && !preFilterMatches(preFilter, line)) {
        continue;
      }
      if (shouldCountMatches) {
        // Count individual matches on the line
        const rnC = ensureGlobalRegex(regex.native);
        for (const match of line.matchAll(rnC)) {
          chargeWork();
          matchCount++;
        }
      } else {
        // Count lines (with matches, or without matches if inverted)
        if (regex.test(line) !== invertMatch) {
          matchCount++;
        }
      }
    }
    const countStr = filename
      ? `${filename}:${matchCount}`
      : String(matchCount);
    return { output: `${countStr}\n`, matched: matchCount > 0, matchCount };
  }

  // Fast path: no context needed (most common case)
  if (beforeContext === 0 && afterContext === 0 && !passthru) {
    const outputLines: string[] = [];
    let hasMatch = false;
    let matchCount = 0;
    let byteOffset = 0; // Track cumulative byte offset

    for (let i = 0; i < lastIdx; i++) {
      chargeWork();
      // Check if we've reached maxCount
      if (maxCount > 0 && matchCount >= maxCount) break;

      const line = lines[i];
      // Substring pre-filter: when no extracted needle is present, the
      // regex provably cannot match. String.indexOf is ~50x faster than
      // regex scans for short inputs, so we skip the regex for the bulk
      // of unmatching lines.
      const rn = ensureGlobalRegex(regex.native);
      let firstIndex = -1;
      if (preFilter && !preFilterMatches(preFilter, line)) {
        // firstIndex stays -1 → matches stays false
      } else {
        for (const probe of line.matchAll(rn)) {
          firstIndex = probe.index ?? -1;
          break;
        }
      }
      const matches = firstIndex >= 0;
      if (matches !== invertMatch) {
        hasMatch = true;
        matchCount++;
        if (onlyMatching) {
          const namedDict = regex.namedGroupIndex;
          const namedNames = Object.keys(namedDict);
          for (const match of line.matchAll(rn)) {
            chargeWork();
            const idx = match.index ?? -1;
            // If \K was used, extract from the capture group instead of full match
            const rawMatch =
              kResetGroup !== undefined ? (match[kResetGroup] ?? "") : match[0];
            let matchText = rawMatch;
            if (replace !== null) {
              const full = match[0];
              const values: string[] = [];
              values.push(full);
              const cnt = match.length;
              for (let gi = 1; gi < cnt; gi++) {
                const g = match[gi];
                values.push(g === undefined ? "" : g);
              }
              const namedValues: Record<string, string> = Object.create(null);
              for (let k = 0; k < namedNames.length; k++) {
                const nm = namedNames[k];
                const gi2 = namedDict[nm];
                if (gi2 !== undefined) {
                  const gv = match[gi2];
                  if (gv !== undefined) {
                    namedValues[nm] = gv;
                  }
                }
              }
              matchText = applyReplacement(replace, full, values, namedValues);
            }
            let prefix = filename ? `${filename}:` : "";
            if (showByteOffset) prefix += `${byteOffset + idx}:`;
            if (showLineNumbers) prefix += `${i + 1}:`;
            if (showColumn) prefix += `${idx + 1}:`;
            pushOutput(outputLines, prefix + matchText);
          }
        } else if (vimgrep) {
          // Vimgrep mode: output each match separately with full line
          for (const match of line.matchAll(rn)) {
            chargeWork();
            const idx = match.index ?? -1;
            let prefix = filename ? `${filename}:` : "";
            if (showByteOffset) prefix += `${byteOffset + idx}:`;
            if (showLineNumbers) prefix += `${i + 1}:`;
            if (showColumn) prefix += `${idx + 1}:`;
            pushOutput(outputLines, prefix + line);
          }
        } else {
          // First match position captured by the probe scan above.
          const column = firstIndex >= 0 ? firstIndex + 1 : 1;
          // Apply replacement if specified
          let outputLine = line;
          if (replace !== null) {
            // Manual replacement loop that skips empty matches (ripgrep behavior)
            outputLine = replaceWithTemplate(line, rn, replace, regex.namedGroupIndex);
          }

          let prefix = filename ? `${filename}:` : "";
          if (showByteOffset)
            prefix += `${byteOffset + (firstIndex >= 0 ? firstIndex : 0)}:`;
          if (showLineNumbers) prefix += `${i + 1}:`;
          if (showColumn) prefix += `${column}:`;
          pushOutput(outputLines, prefix + outputLine);
        }
      }

      // Update byte offset for next line (+1 for newline)
      byteOffset += line.length + 1;
    }

    return {
      output: outputLines.length > 0 ? `${outputLines.join("\n")}\n` : "",
      matched: hasMatch,
      matchCount,
    };
  }

  // Passthru mode: print all lines, matches use :, non-matches use -
  if (passthru) {
    const outputLines: string[] = [];
    let hasMatch = false;
    let matchCount = 0;

    for (let i = 0; i < lastIdx; i++) {
      chargeWork();
      const line = lines[i];
      let matches: boolean;
      if (preFilter && !preFilterMatches(preFilter, line)) {
        matches = false;
      } else {
        matches = regex.test(line);
      }
      const isMatch = matches !== invertMatch;

      if (isMatch) {
        hasMatch = true;
        matchCount++;
      }

      // Separator: : for matches, - for non-matches
      const sep = isMatch ? ":" : "-";

      let prefix = filename ? `${filename}${sep}` : "";
      if (showLineNumbers) prefix += `${i + 1}${sep}`;
      pushOutput(outputLines, prefix + line);
    }

    return {
      output: outputLines.length > 0 ? `${outputLines.join("\n")}\n` : "",
      matched: hasMatch,
      matchCount,
    };
  }

  // Slow path: context lines needed
  const outputLines: string[] = [];
  let matchCount = 0;
  const printedLines = new Set<number>();
  let lastPrintedLine = -1;

  // First pass: find all matching lines (respecting maxCount)
  const matchingLineNumbers: number[] = [];
  for (let i = 0; i < lastIdx; i++) {
    chargeWork();
    // Check if we've reached maxCount
    if (maxCount > 0 && matchCount >= maxCount) break;
    const line = lines[i];
    let matches: boolean;
    if (preFilter && !preFilterMatches(preFilter, line)) {
      matches = false;
      } else {
      matches = regex.test(line);
    }
    if (matches !== invertMatch) {
      if (
        maxMatches !== undefined &&
        matchingLineNumbers.length >= maxMatches
      ) {
        throw new ExecutionLimitError(
          `search: match limit exceeded (${maxMatches})`,
          "array_elements",
        );
      }
      matchingLineNumbers.push(i);
      matchCount++;
    }
  }

  // Second pass: output with context
  for (let passIdx = 0; passIdx < matchingLineNumbers.length; passIdx++) {
    const lineNum = 0 + matchingLineNumbers[passIdx];
    chargeWork();
    const contextStart = Math.max(0, lineNum - beforeContext);

    // Add separator if there's a gap between this group and the last printed line
    if (lastPrintedLine >= 0 && contextStart > lastPrintedLine + 1) {
      pushOutput(outputLines, contextSeparator);
    }

    // Before context
    for (let i = contextStart; i < lineNum; i++) {
      chargeWork();
      if (!printedLines.has(i)) {
        printedLines.add(i);
        lastPrintedLine = i;
        let outputLine = lines[i];
        if (showLineNumbers) outputLine = `${i + 1}-${outputLine}`;
        if (filename) outputLine = `${filename}-${outputLine}`;
        pushOutput(outputLines, outputLine);
      }
    }

    // The matching line
    if (!printedLines.has(lineNum)) {
      printedLines.add(lineNum);
      lastPrintedLine = lineNum;
      const line = lines[lineNum] as string;

      if (onlyMatching) {
        const rnCtx = ensureGlobalRegex(regex.native);
        for (const match of line.matchAll(rnCtx)) {
          chargeWork();
          const idx = match.index ?? -1;
          // If \K was used, extract from the capture group instead of full match
          const rawMatch =
            kResetGroup !== undefined ? (match[kResetGroup] ?? "") : match[0];
          const matchText = replace !== null ? replace : rawMatch;
          let prefix = filename ? `${filename}:` : "";
          if (showLineNumbers) prefix += `${lineNum + 1}:`;
          if (showColumn) prefix += `${idx + 1}:`;
          pushOutput(outputLines, prefix + matchText);
        }
      } else {
        let outputLine = line;
        if (showLineNumbers) outputLine = `${lineNum + 1}:${outputLine}`;
        if (filename) outputLine = `${filename}:${outputLine}`;
        pushOutput(outputLines, outputLine);
      }
    }

    // After context
    const maxAfter = Math.min(lastIdx - 1, lineNum + afterContext);
    for (let i = lineNum + 1; i <= maxAfter; i++) {
      chargeWork();
      if (!printedLines.has(i)) {
        printedLines.add(i);
        lastPrintedLine = i;
        let outputLine = lines[i];
        if (showLineNumbers) outputLine = `${i + 1}-${outputLine}`;
        if (filename) outputLine = `${filename}-${outputLine}`;
        pushOutput(outputLines, outputLine);
      }
    }
  }

  return {
    output: outputLines.length > 0 ? `${outputLines.join("\n")}\n` : "",
    matched: matchCount > 0,
    matchCount,
  };
}

/**
 * Multiline search - searches entire content as one string
 * Patterns can match across line boundaries (e.g., 'foo\nbar')
 */
function searchContentMultiline(
  content: string,
  regex: UserRegex,
  options: {
    invertMatch: boolean;
    showLineNumbers: boolean;
    countOnly: boolean;
    countMatches: boolean;
    filename: string;
    onlyMatching: boolean;
    beforeContext: number;
    afterContext: number;
    maxCount: number;
    contextSeparator: string;
    showColumn: boolean;
    showByteOffset: boolean;
    replace: string | null;
    kResetGroup?: number;
    preFilter?: PreFilter | null;
    maxWork?: number;
    maxMatches?: number;
    signal?: AbortSignal;
  },
): SearchResult {
  const {
    invertMatch,
    showLineNumbers,
    countOnly,
    countMatches,
    filename,
    onlyMatching,
    beforeContext,
    afterContext,
    maxCount,
    contextSeparator,
    showColumn,
    showByteOffset,
    replace,
    kResetGroup,
    preFilter,
    maxWork,
    maxMatches,
    signal,
  } = options;

  let work = 0;
  const chargeWork = (amount = 1): void => {
    if (signal?.aborted) throw new ExecutionAbortedError();
    work += amount;
    if (maxWork !== undefined && work > maxWork) {
      throw new ExecutionLimitError(
        `search: matching work limit exceeded (${maxWork})`,
        "iterations",
      );
    }
  };

  // File-level preFilter: if no needle appears anywhere in the content, no line can match.
  // Only safe when not inverting — an invert-match scan must check every line.
  if (preFilter && !invertMatch && !preFilterMatches(preFilter, content)) {
    if (countOnly || countMatches) {
      const countStr = filename ? `${filename}:0` : "0";
      return { output: `${countStr}\n`, matched: false, matchCount: 0 };
    }
    return { output: "", matched: false, matchCount: 0 };
  }

  // Build line offset map: lineOffsets[i] = byte offset where line i starts
  const lineOffsets: number[] = [0];
  for (let i = 0; i < content.length; i++) {
    if ((i & 1023) === 0) chargeWork();
    if (content[i] === "\n") {
      if (maxMatches !== undefined && lineOffsets.length >= maxMatches) {
        throw new ExecutionLimitError(
          `search: line index limit exceeded (${maxMatches})`,
          "array_elements",
        );
      }
      lineOffsets.push(i + 1);
    }
  }

  const lines = content.split("\n");
  const lineCount = lines.length;
  const lastIdx =
    lineCount > 0 && lines[lineCount - 1] === "" ? lineCount - 1 : lineCount;

  // Helper: convert byte offset to line number (0-indexed)
  const getLineIndex = (byteOffset: number): number => {
    let low = 0;
    let high = lineOffsets.length;
    while (low < high) {
      const middle = low + Math.floor((high - low) / 2);
      if (lineOffsets[middle] <= byteOffset) {
        low = middle + 1;
      } else {
        high = middle;
      }
    }
    return Math.max(0, low - 1);
  };

  // Helper: get column within line (1-indexed)
  const getColumn = (byteOffset: number): number => {
    const lineIdx = getLineIndex(byteOffset);
    return byteOffset - lineOffsets[lineIdx] + 1;
  };

  // Count modes do not need to retain every match. Regex matches are ordered
  // by start offset, so a single high-water mark is sufficient to count the
  // union of lines touched by matches without a potentially huge Set.
  if (countOnly || countMatches) {
    let individualMatchCount = 0;
    let matchedLineCount = 0;
    let lastMatchedLine = -1;

    const rnCount = ensureGlobalRegex(regex.native);
    for (const match of content.matchAll(rnCount)) {
      chargeWork();
      if (maxCount > 0 && individualMatchCount >= maxCount) break;
      individualMatchCount++;
      if (!countMatches) {
        const idx = match.index ?? -1;
        const startLine = getLineIndex(idx);
        const endLine = getLineIndex(idx + Math.max(0, match[0].length - 1));
        const firstNewLine = Math.max(startLine, lastMatchedLine + 1);
        if (firstNewLine <= endLine) {
          matchedLineCount += endLine - firstNewLine + 1;
          lastMatchedLine = endLine;
        }
      }
    }

    const matchCount = countMatches
      ? invertMatch
        ? 0
        : individualMatchCount
      : invertMatch
        ? lastIdx - matchedLineCount
        : matchedLineCount;
    const countStr = filename
      ? `${filename}:${matchCount}`
      : String(matchCount);
    return { output: `${countStr}\n`, matched: matchCount > 0, matchCount };
  }

  // First pass: find all match spans
  const matchSpans: Array<{
    startLine: number;
    endLine: number;
    byteOffset: number;
    column: number;
    matchText: string;
  }> = [];

  const rnSpans = ensureGlobalRegex(regex.native);
  for (const match of content.matchAll(rnSpans)) {
    chargeWork();
    if (maxCount > 0 && matchSpans.length >= maxCount) break;
    if (maxMatches !== undefined && matchSpans.length >= maxMatches) {
      throw new ExecutionLimitError(
        `search: match limit exceeded (${maxMatches})`,
        "array_elements",
      );
    }
    const idx = match.index ?? -1;
    const startLine = getLineIndex(idx);
    const endLine = getLineIndex(idx + Math.max(0, match[0].length - 1));
    // If \K was used, extract from the capture group instead of full match
    const extractedMatch =
      kResetGroup !== undefined ? (match[kResetGroup] ?? "") : match[0];
    matchSpans.push({
      startLine,
      endLine,
      byteOffset: idx,
      column: getColumn(idx),
      matchText: extractedMatch,
    });
  }

  // Inverted match: output lines not part of any match
  if (invertMatch) {
    const matchedLines = new Set<number>();
    for (const span of matchSpans) {
      for (let i = span.startLine; i <= span.endLine; i++) {
        chargeWork();
        matchedLines.add(i);
      }
    }

    const outputLines: string[] = [];
    for (let i = 0; i < lastIdx; i++) {
      chargeWork();
      if (!matchedLines.has(i)) {
        let line = lines[i];
        if (showLineNumbers) line = `${i + 1}:${line}`;
        if (filename) line = `${filename}:${line}`;
        outputLines.push(line);
      }
    }

    return {
      output: outputLines.length > 0 ? `${outputLines.join("\n")}\n` : "",
      matched: outputLines.length > 0,
      matchCount: outputLines.length,
    };
  }

  // No matches found
  if (matchSpans.length === 0) {
    return { output: "", matched: false, matchCount: 0 };
  }

  // Output with context
  const printedLines = new Set<number>();
  let lastPrintedLine = -1;
  const outputLines: string[] = [];

  for (const span of matchSpans) {
    chargeWork();
    const contextStart = Math.max(0, span.startLine - beforeContext);
    const contextEnd = Math.min(lastIdx - 1, span.endLine + afterContext);

    // Add separator if there's a gap
    if (lastPrintedLine >= 0 && contextStart > lastPrintedLine + 1) {
      outputLines.push(contextSeparator);
    }

    // Before context
    for (let i = contextStart; i < span.startLine; i++) {
      chargeWork();
      if (!printedLines.has(i)) {
        printedLines.add(i);
        lastPrintedLine = i;
        let line = lines[i];
        if (showLineNumbers) line = `${i + 1}-${line}`;
        if (filename) line = `${filename}-${line}`;
        outputLines.push(line);
      }
    }

    // Match lines
    if (onlyMatching) {
      // Output only the matched text
      const matchText = replace !== null ? replace : span.matchText;
      let prefix = filename ? `${filename}:` : "";
      if (showByteOffset) prefix += `${span.byteOffset}:`;
      if (showLineNumbers) prefix += `${span.startLine + 1}:`;
      if (showColumn) prefix += `${span.column}:`;
      outputLines.push(prefix + matchText);
      // Mark lines as printed to handle context correctly
      for (let i = span.startLine; i <= span.endLine; i++) {
        chargeWork();
        printedLines.add(i);
        lastPrintedLine = i;
      }
    } else {
      // Output full lines containing the match
      for (let i = span.startLine; i <= span.endLine && i < lastIdx; i++) {
        chargeWork();
        if (!printedLines.has(i)) {
          printedLines.add(i);
          lastPrintedLine = i;
          let line = lines[i];
          // Apply replacement if specified (for the first line of the match)
          if (replace !== null && i === span.startLine) {
            line = regex.replace(line, replace);
          }
          let prefix = filename ? `${filename}:` : "";
          if (showByteOffset && i === span.startLine)
            prefix += `${span.byteOffset}:`;
          if (showLineNumbers) prefix += `${i + 1}:`;
          if (showColumn && i === span.startLine) prefix += `${span.column}:`;
          outputLines.push(prefix + line);
        }
      }
    }

    // After context
    for (let i = span.endLine + 1; i <= contextEnd; i++) {
      chargeWork();
      if (!printedLines.has(i)) {
        printedLines.add(i);
        lastPrintedLine = i;
        let line = lines[i];
        if (showLineNumbers) line = `${i + 1}-${line}`;
        if (filename) line = `${filename}-${line}`;
        outputLines.push(line);
      }
    }
  }

  return {
    output: outputLines.length > 0 ? `${outputLines.join("\n")}\n` : "",
    matched: true,
    matchCount: matchSpans.length,
  };
}
