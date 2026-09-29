import { BoundedStringBuilder } from "../../bounded-builder.js";
import type { RegexLike } from "../../regex/index.js";
import { ExecutionLimitError } from "../errors.js";
import type { InterpreterContext } from "../types.js";

/** Build a regex replacement prospectively without an unbounded host replace. */
export function applyPatternReplacementBounded(
  ctx: InterpreterContext,
  value: string,
  regex: RegexLike,
  replacement: string,
  replaceAll: boolean,
): string {
  const output = new BoundedStringBuilder(
    ctx.limits.maxStringLength,
    "pattern replacement",
    () =>
      new ExecutionLimitError(
        `pattern replacement: string length limit exceeded (${ctx.limits.maxStringLength} bytes)`,
        "string_length",
      ),
  );
  const scope = ctx.executionScope;
  let lastIndex = 0;
  const rnRaw = regex.native;
  const rn = rnRaw.flags.includes("g")
    ? rnRaw
    : new RegExp(rnRaw.source, rnRaw.flags + "g");

  for (const m of value.matchAll(rn)) {
    const idx = m.index ?? 0;
    const full = m[0];
    scope.consumeLimited(
      "pattern_operations",
      1,
      ctx.limits.maxGlobOperations,
      "pattern replacement",
    );
    // A global greedy pattern can report a second empty match at EOF. Bash
    // does not apply another replacement there.
    if (replaceAll && full.length === 0 && idx === value.length) {
      break;
    }
    output.append(value.slice(lastIndex, idx));
    output.append(replacement);
    lastIndex = idx + full.length;

    if (!replaceAll) break;
    if (full.length === 0) {
      // Preserve the previous implementation's progress rule; the eager
      // matchAll drain advances the engine past the empty match by itself.
      lastIndex++;
    }
  }

  output.append(value.slice(lastIndex));
  return output.build();
}
