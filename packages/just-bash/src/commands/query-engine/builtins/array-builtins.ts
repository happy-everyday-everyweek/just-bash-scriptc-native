/**
 * Array-related jq builtins
 *
 * Handles array manipulation functions like sort, sort_by, group_by, max, min, add, etc.
 */

import { mergeToNullPrototype } from "../../../helpers/env.js";
import { ExecutionLimitError as QueryExecutionLimitError } from "../../../interpreter/errors.js";
import type { EvalContext } from "../evaluator.js";
import type { AstNode } from "../parser.js";
import { isSafeKey, safeSet, nullPrototypeMerge } from "../safe-object.js";
import type { QueryValue } from "../value-operations.js";

type EvalFn = (
  value: QueryValue,
  ast: AstNode,
  ctx: EvalContext,
) => QueryValue[];

type EvalWithPartialFn = (
  value: QueryValue,
  ast: AstNode,
  ctx: EvalContext,
) => QueryValue[];

type CompareFn = (a: QueryValue, b: QueryValue) => number;
type IsTruthyFn = (v: QueryValue) => boolean;
type ContainsDeepFn = (a: QueryValue, b: QueryValue) => boolean;
function cloneQArr(src: QueryValue[]): QueryValue[] {
  const out: QueryValue[] = [];
  for (let i = 0; i < src.length; i++) out.push(src[i]);
  return out;
}

function assertResultCapacity(
  ctx: EvalContext,
  current: number,
  additional = 1,
): void {
  const maxElements = ctx.limits.maxArrayElements;
  if (additional < 0 || current > maxElements - additional) {
    throw new QueryExecutionLimitError(
      `query result element limit exceeded (${maxElements})`,
      "array_elements",
    );
  }
}

/**
 * Handle array builtins that need evaluate function for arguments.
 * Returns null if the builtin name is not an array builtin handled here.
 */
export function evalArrayBuiltin(
  value: QueryValue,
  name: string,
  args: AstNode[],
  ctx: EvalContext,
  evaluate: EvalFn,
  evaluateWithPartialResults: EvalWithPartialFn,
  compareJq: CompareFn,
  isTruthy: IsTruthyFn,
  containsDeep: ContainsDeepFn,
): QueryValue[] | null {
  switch (name) {
    case "sort":
      if (Array.isArray(value)) {
        const sv = cloneQArr(value as QueryValue[]);
        sv.sort(compareJq);
        return [sv];
      }
      return [null];

    case "sort_by": {
      if (!Array.isArray(value) || args.length === 0) return [null];
      const sorted = cloneQArr(value as QueryValue[]);
      sorted.sort((a, b) => {
        const aKey = evaluate(a, args[0], ctx)[0];
        const bKey = evaluate(b, args[0], ctx)[0];
        return compareJq(aKey, bKey);
      });
      return [sorted];
    }

    case "bsearch": {
      if (!Array.isArray(value)) {
        const typeName =
          value === null
            ? "null"
            : typeof value === "object"
              ? "object"
              : typeof value;
        throw new Error(
          `${typeName} (${JSON.stringify(value)}) cannot be searched from`,
        );
      }
      if (args.length === 0) return [null];
      const targets = evaluate(value, args[0], ctx);
      // Handle generator args - each target produces its own search result
      return targets.map((target) => {
        // Binary search: return index if found, or -insertionPoint-1 if not
        let lo = 0;
        let hi = value.length;
        while (lo < hi) {
          const mid = (lo + hi) >>> 1;
          const cmp = compareJq(value[mid], target);
          if (cmp < 0) {
            lo = mid + 1;
          } else {
            hi = mid;
          }
        }
        // Check if we found an exact match
        if (lo < value.length && compareJq(value[lo], target) === 0) {
          return lo;
        }
        // Not found: return negative insertion point
        return -lo - 1;
      });
    }

    case "unique_by": {
      if (!Array.isArray(value) || args.length === 0) return [null];
      const uvKeys2: string[] = [];
      const uvPairs: { item: QueryValue; key: QueryValue }[] = [];
      for (const item of value) {
        const keyVal = evaluate(item, args[0], ctx)[0];
        const keyStr = JSON.stringify(keyVal);
        if (uvKeys2.indexOf(keyStr) === -1) {
          uvKeys2.push(keyStr);
          uvPairs.push({ item, key: keyVal });
        }
      }
      // Sort by key value and return items
      uvPairs.sort((a, b) => compareJq(a.key, b.key));
      const outU: QueryValue[] = [];
      for (let i = 0; i < uvPairs.length; i++) {
        outU.push(uvPairs[i].item);
      }
      return [outU];
    }

    case "group_by": {
      if (!Array.isArray(value) || args.length === 0) return [null];
      const gbKeys: string[] = [];
      const gbGroups: QueryValue[][] = [];
      for (const item of value) {
        const key = JSON.stringify(evaluate(item, args[0], ctx)[0]);
        const gi = gbKeys.indexOf(key);
        if (gi === -1) {
          gbKeys.push(key);
          const g0: QueryValue[] = [];
          g0.push(item);
          gbGroups.push(g0);
        } else {
          gbGroups[gi].push(item);
        }
      }
      const outGb: QueryValue[] = [];
      for (let i = 0; i < gbGroups.length; i++) {
        outGb.push(gbGroups[i]);
      }
      return [outGb];
    }

    case "max":
      if (Array.isArray(value) && value.length > 0) {
        const mv = value as QueryValue[];
        let bestMax: QueryValue = mv[0];
        for (let i = 1; i < mv.length; i++) {
          if (compareJq(mv[i], bestMax) > 0) bestMax = mv[i];
        }
        return [bestMax];
      }
      return [null];

    case "max_by": {
      if (!Array.isArray(value) || value.length === 0 || args.length === 0)
        return [null];
      const mbv = value as QueryValue[];
      let bestMb: QueryValue = mbv[0];
      let bestMbKey = evaluate(mbv[0], args[0], ctx)[0];
      for (let i = 1; i < mbv.length; i++) {
        const candKey = evaluate(mbv[i], args[0], ctx)[0];
        if (compareJq(candKey, bestMbKey) > 0) {
          bestMb = mbv[i];
          bestMbKey = candKey;
        }
      }
      return [bestMb];
    }

    case "min":
      if (Array.isArray(value) && value.length > 0) {
        const mnv = value as QueryValue[];
        let bestMin: QueryValue = mnv[0];
        for (let i = 1; i < mnv.length; i++) {
          if (compareJq(mnv[i], bestMin) < 0) bestMin = mnv[i];
        }
        return [bestMin];
      }
      return [null];

    case "min_by": {
      if (!Array.isArray(value) || value.length === 0 || args.length === 0)
        return [null];
      const mnbv = value as QueryValue[];
      let bestMnb: QueryValue = mnbv[0];
      let bestMnbKey = evaluate(mnbv[0], args[0], ctx)[0];
      for (let i = 1; i < mnbv.length; i++) {
        const candKeyM = evaluate(mnbv[i], args[0], ctx)[0];
        if (compareJq(candKeyM, bestMnbKey) < 0) {
          bestMnb = mnbv[i];
          bestMnbKey = candKeyM;
        }
      }
      return [bestMnb];
    }

    case "add": {
      // Helper to add an array of values
      const addValues = (arr: QueryValue[]): QueryValue => {
        // jq filters out null values for add
        const filtered: QueryValue[] = arr.filter((x) => x !== null);
        if (filtered.length === 0) return null;
        if (filtered.every((x) => typeof x === "number")) {
          let sum = 0;
          for (let i = 0; i < filtered.length; i++) {
            sum = sum + (filtered[i] as number);
          }
          return sum;
        }
        if (filtered.every((x) => typeof x === "string")) {
          return filtered.join("");
        }
        if (filtered.every((x) => Array.isArray(x))) {
          const flatOut: QueryValue[] = [];
          for (let i = 0; i < filtered.length; i++) {
            const sub = filtered[i] as QueryValue[];
            for (let j = 0; j < sub.length; j++) flatOut.push(sub[j]);
          }
          return flatOut;
        }
        if (
          filtered.every((x) => x && typeof x === "object" && !Array.isArray(x))
        ) {
          // Use null-prototype to prevent prototype pollution from user-controlled JSON
          let accObj: Record<string, unknown> = {};
          for (let i = 0; i < filtered.length; i++) {
            accObj = nullPrototypeMerge(accObj, filtered[i] as object);
          }
          return accObj;
        }
        return null;
      };

      // Handle add(expr) - collect values from generator and add them
      if (args.length >= 1) {
        const collected = evaluate(value, args[0], ctx);
        return [addValues(collected)];
      }
      // Existing behavior for add (no args) - add array elements
      if (Array.isArray(value)) {
        return [addValues(value)];
      }
      return [null];
    }

    case "any": {
      if (args.length >= 2) {
        // any(generator; condition) - lazy evaluation with short-circuit
        // Evaluate generator lazily, return true if any passes condition
        try {
          const genValues = evaluateWithPartialResults(value, args[0], ctx);
          for (const v of genValues) {
            const cond = evaluate(v, args[1], ctx);
            if (cond.some(isTruthy)) return [true];
          }
        } catch (e) {
          // Always re-throw execution limit errors
          if ((e as Error).name === "ExecutionLimitError") throw e;
          // Error occurred but we might have found a truthy value already
        }
        return [false];
      }
      if (args.length === 1) {
        if (Array.isArray(value)) {
          return [
            value.some((item) => isTruthy(evaluate(item, args[0], ctx)[0])),
          ];
        }
        return [false];
      }
      if (Array.isArray(value)) return [value.some(isTruthy)];
      return [false];
    }

    case "all": {
      if (args.length >= 2) {
        // all(generator; condition) - lazy evaluation with short-circuit
        // Evaluate generator lazily, return false if any fails condition
        try {
          const genValues = evaluateWithPartialResults(value, args[0], ctx);
          for (const v of genValues) {
            const cond = evaluate(v, args[1], ctx);
            if (!cond.some(isTruthy)) return [false];
          }
        } catch (e) {
          // Always re-throw execution limit errors
          if ((e as Error).name === "ExecutionLimitError") throw e;
          // Error occurred but we might have found a falsy value already
        }
        return [true];
      }
      if (args.length === 1) {
        if (Array.isArray(value)) {
          return [
            value.every((item) => isTruthy(evaluate(item, args[0], ctx)[0])),
          ];
        }
        return [true];
      }
      if (Array.isArray(value)) return [value.every(isTruthy)];
      return [true];
    }

    case "select": {
      if (args.length === 0) return [value];
      const conds = evaluate(value, args[0], ctx);
      return conds.some(isTruthy) ? [value] : [];
    }

    case "map": {
      if (args.length === 0 || !Array.isArray(value)) return [null];
      assertResultCapacity(ctx, 0, value.length);
      const results: QueryValue[] = [];
      for (const item of value) {
        const mapped = evaluate(item, args[0], ctx);
        assertResultCapacity(ctx, results.length, mapped.length);
        for (const mappedValue of mapped) results.push(mappedValue);
      }
      return [results];
    }

    case "map_values": {
      if (args.length === 0) return [null];
      if (Array.isArray(value)) {
        assertResultCapacity(ctx, 0, value.length);
        const result: QueryValue[] = [];
        for (const item of value) {
          const mapped = evaluate(item, args[0], ctx);
          assertResultCapacity(ctx, result.length, mapped.length);
          for (const mappedValue of mapped) result.push(mappedValue);
        }
        return [result];
      }
      if (value && typeof value === "object") {
        // Use null-prototype for additional safety
        const result: Record<string, unknown> = Object.create(null);
        const keys = Object.keys(value);
        assertResultCapacity(ctx, 0, keys.length);
        for (const k of keys) {
          // Defense against prototype pollution
          if (!isSafeKey(k)) continue;
          // @banned-pattern-ignore: Object.keys returns own properties only
          const v = (value as Record<string, unknown>)[k];
          const mapped = evaluate(v, args[0], ctx);
          if (mapped.length > 0) safeSet(result, k, mapped[0]);
        }
        return [result];
      }
      return [null];
    }

    case "has": {
      if (args.length === 0) return [false];
      const keys = evaluate(value, args[0], ctx);
      const key = keys[0];
      if (Array.isArray(value) && typeof key === "number") {
        return [key >= 0 && key < value.length];
      }
      if (value && typeof value === "object" && typeof key === "string") {
        return [Object.hasOwn(value, key)];
      }
      return [false];
    }

    case "in": {
      if (args.length === 0) return [false];
      const objs = evaluate(value, args[0], ctx);
      const obj = objs[0];
      if (Array.isArray(obj) && typeof value === "number") {
        return [value >= 0 && value < obj.length];
      }
      if (obj && typeof obj === "object" && typeof value === "string") {
        return [Object.hasOwn(obj, value)];
      }
      return [false];
    }

    case "contains": {
      if (args.length === 0) return [false];
      const others = evaluate(value, args[0], ctx);
      return [containsDeep(value, others[0])];
    }

    case "inside": {
      if (args.length === 0) return [false];
      const others = evaluate(value, args[0], ctx);
      return [containsDeep(others[0], value)];
    }

    default:
      return null;
  }
}
