/**
 * Navigation and traversal jq builtins
 *
 * Handles recurse, recurse_down, walk, transpose, combinations, parent, parents, root.
 */

import { ExecutionLimitError } from "../../../interpreter/errors.js";
import type { EvalContext } from "../evaluator.js";
import type { AstNode } from "../parser.js";
import { asQueryRecord, isSafeKey, safeSet } from "../safe-object.js";
import type { QueryValue } from "../value-operations.js";

type EvalFn = (
  value: QueryValue,
  ast: AstNode,
  ctx: EvalContext,
) => QueryValue[];

type IsTruthyFn = (v: QueryValue) => boolean;
type GetValueAtPathFn = (
  obj: QueryValue,
  path: (string | number)[],
) => QueryValue;

// Recursive forward reference for evalBuiltin
type EvalBuiltinFn = (
  value: QueryValue,
  name: string,
  args: AstNode[],
  ctx: EvalContext,
) => QueryValue[];

function resourceLimits(ctx: EvalContext): {
  maxDepth: number;
  maxResults: number;
  maxIterations: number;
} {
  const maxIterations = ctx.limits.maxIterations;
  return {
    maxDepth: ctx.limits.maxDepth,
    maxResults: ctx.limits.maxArrayElements,
    maxIterations,
  };
}

function throwTraversalLimit(message: string): never {
  throw new ExecutionLimitError(message, "array_elements");
}

function checkedProduct(values: number[], limit: number): number {
  let product = 1;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error("combinations requires finite array lengths");
    }
    if (value !== 0 && product > Math.floor(limit / value)) {
      throwTraversalLimit(`query combination limit exceeded (${limit})`);
    }
    product *= value;
  }
  return product;
}

/**
 * Handle navigation builtins that need evaluate function for arguments.
 * Returns null if the builtin name is not a navigation builtin handled here.
 */
function elemRead(x: unknown, i: number): QueryValue {
  const a = x as QueryValue[];
  const hits: QueryValue[] = [];
  for (let j = 0; j < a.length; j++) {
    if (j === i) hits.push(a[j]);
  }
  return hits.length > 0 ? hits[0] : undefined;
}

export function evalNavigationBuiltin(
  value: QueryValue,
  name: string,
  args: AstNode[],
  ctx: EvalContext,
  evaluate: EvalFn,
  isTruthy: IsTruthyFn,
  getValueAtPath: GetValueAtPathFn,
  evalBuiltin: EvalBuiltinFn,
): QueryValue[] | null {
  switch (name) {
    case "recurse": {
      const results: QueryValue[] = [];
      const limits = resourceLimits(ctx);
      const condExpr = args.length >= 2 ? args[1] : null;
      const stack: Array<{ value: QueryValue; depth: number }> = [
        { value, depth: 0 },
      ];
      let iterations = 0;
      while (stack.length > 0) {
        const entry = stack.pop();
        if (!entry) break;
        if (++iterations > limits.maxIterations) {
          throw new ExecutionLimitError(
            `query iteration limit exceeded (${limits.maxIterations})`,
            "iterations",
          );
        }
        if (entry.depth > limits.maxDepth) {
          throw new ExecutionLimitError(
            `query depth limit exceeded (${limits.maxDepth})`,
            "recursion",
          );
        }
        // Check condition if provided (recurse(f; cond))
        if (condExpr) {
          const condResults = evaluate(entry.value, condExpr, ctx);
          if (!condResults.some(isTruthy)) continue;
        }
        if (results.length >= limits.maxResults) {
          throwTraversalLimit(
            `query result element limit exceeded (${limits.maxResults})`,
          );
        }
        results.push(entry.value);

        let next: QueryValue[] = [];
        if (args.length === 0) {
          if (Array.isArray(entry.value)) {
            next = entry.value;
          } else if (entry.value && typeof entry.value === "object") {
            next = Object.keys(entry.value).map((key) => {
              // @banned-pattern-ignore: Object.keys returns own properties only
              return (entry.value as Record<string, unknown>)[key];
            });
          }
        } else {
          next = evaluate(entry.value, args[0], ctx).filter(
            (item) => item !== null && item !== undefined,
          );
        }
        if (stack.length > limits.maxResults - next.length) {
          throwTraversalLimit(
            `query traversal queue limit exceeded (${limits.maxResults})`,
          );
        }
        for (let i = next.length - 1; i >= 0; i--) {
          stack.push({ value: next[i], depth: entry.depth + 1 });
        }
      }
      return results;
    }

    case "recurse_down":
      return evalBuiltin(value, "recurse", args, ctx);

    case "walk": {
      if (args.length === 0) return [value];
      const limits = resourceLimits(ctx);
      const scheduled: object[] = [];
      const transformedKeys: object[] = [];
      const transformedVals: QueryValue[] = [];
      const stack: Array<{
        value: QueryValue;
        depth: number;
        expanded: boolean;
      }> = [{ value, depth: 0, expanded: false }];
      let rootResult: QueryValue = value;
      let iterations = 0;
      while (stack.length > 0) {
        const frame = stack.pop();
        if (!frame) break;
        if (++iterations > limits.maxIterations) {
          throw new ExecutionLimitError(
            `query iteration limit exceeded (${limits.maxIterations})`,
            "iterations",
          );
        }
        if (frame.depth > limits.maxDepth) {
          throw new ExecutionLimitError(
            `query depth limit exceeded (${limits.maxDepth})`,
            "recursion",
          );
        }
        const container =
          frame.value !== null && typeof frame.value === "object"
            ? (frame.value as object)
            : null;
        if (!frame.expanded && container) {
          if (scheduled.indexOf(container) !== -1) continue;
          scheduled.push(container);
          stack.push({ value: frame.value, depth: frame.depth, expanded: true });
          const record = asQueryRecord(frame.value);
          const children: QueryValue[] = [];
          if (Array.isArray(frame.value)) {
            const fv = frame.value as QueryValue[];
            for (let i = 0; i < fv.length; i++) children.push(fv[i]);
          } else if (record) {
            const ks = Object.keys(record);
            for (let i = 0; i < ks.length; i++) children.push(record[ks[i]]);
          }
          if (stack.length > limits.maxResults - children.length) {
            throwTraversalLimit(
              `query traversal queue limit exceeded (${limits.maxResults})`,
            );
          }
          for (let i = children.length - 1; i >= 0; i--) {
            stack.push({
              value: children[i],
              depth: frame.depth + 1,
              expanded: false,
            });
          }
          continue;
        }

        let childResult: QueryValue = frame.value;
        if (Array.isArray(frame.value)) {
          const fv2 = frame.value as QueryValue[];
          const mapped2: QueryValue[] = [];
          for (let i = 0; i < fv2.length; i++) {
            const child = fv2[i];
            if (child !== null && typeof child === "object") {
              const ti = transformedKeys.indexOf(child as object);
              mapped2.push(ti === -1 ? child : transformedVals[ti]);
            } else {
              mapped2.push(child);
            }
          }
          childResult = mapped2;
        } else if (container) {
          const objectResult: Record<string, unknown> = Object.create(null);
          const record = asQueryRecord(frame.value);
          const recKeys = record ? Object.keys(record) : [];
          for (let ri = 0; ri < recKeys.length; ri++) {
            const key = recKeys[ri];
            if (!isSafeKey(key)) continue;
            const child = record ? record[key] : undefined;
            let mappedChild: QueryValue = child;
            if (child !== null && typeof child === "object") {
              const ti2 = transformedKeys.indexOf(child as object);
              mappedChild = ti2 === -1 ? child : transformedVals[ti2];
            }
            safeSet(objectResult, key, mappedChild);
          }
          childResult = objectResult;
        }
        const evaluated = evaluate(childResult, args[0], ctx)[0];
        if (container) {
          const ti3 = transformedKeys.indexOf(container);
          if (ti3 === -1) {
            transformedKeys.push(container);
            transformedVals.push(evaluated);
          } else {
            transformedVals[ti3] = evaluated;
          }
        }
        if (frame.depth === 0) rootResult = evaluated;
      }
      return [rootResult];
    }

    case "transpose": {
      if (!Array.isArray(value)) return [null];
      if (value.length === 0) return [[]];
      const limits = resourceLimits(ctx);
      let maxLen = 0;
      for (const row of value) {
        if (Array.isArray(row)) maxLen = Math.max(maxLen, row.length);
      }
      checkedProduct([value.length, maxLen], limits.maxResults);
      const result: QueryValue[][] = [];
      for (let i = 0; i < maxLen; i++) {
        result.push(value.map((row) => (Array.isArray(row) ? row[i] : null)));
      }
      return [result];
    }

    case "combinations": {
      // Generate Cartesian product of arrays
      // combinations with no args: input is array of arrays, generate all combinations
      // combinations(n): generate n-length combinations from input array
      if (args.length > 0) {
        // combinations(n) - n-tuples from input array
        const ns = evaluate(value, args[0], ctx);
        const n = ns[0] as number;
        if (!Array.isArray(value)) return [];
        if (!Number.isFinite(n) || !Number.isSafeInteger(n) || n < 0) {
          throw new Error(
            "combinations length must be a finite non-negative integer",
          );
        }
        const limits = resourceLimits(ctx);
        if (n > limits.maxDepth || n > limits.maxResults) {
          throw new ExecutionLimitError(
            `query depth limit exceeded (${limits.maxDepth})`,
            "recursion",
          );
        }
        if (n === 0) {
          if (limits.maxResults < 1) {
            throwTraversalLimit("query combination limit exceeded (0)");
          }
          return [[]];
        }
        const resultCount = checkedProduct(
          Array.from({ length: n }, () => value.length),
          limits.maxResults,
        );
        if (resultCount === 0) return [];
        const results: QueryValue[][] = [];
        const indexes = new Array<number>(n).fill(0);
        for (let produced = 0; produced < resultCount; produced++) {
          const combo1: QueryValue[] = [];
          for (let ci = 0; ci < indexes.length; ci++) {
            combo1.push(elemRead(value, indexes[ci]));
          }
          results.push(combo1);
          for (let position = n - 1; position >= 0; position--) {
            indexes[position] = indexes[position] + 1;
            if (indexes[position] < value.length) break;
            indexes[position] = 0;
          }
        }
        return results;
      }
      // combinations with no args - Cartesian product of array of arrays
      if (!Array.isArray(value)) return [];
      if (value.length === 0) {
        if (resourceLimits(ctx).maxResults < 1) {
          throwTraversalLimit("query combination limit exceeded (0)");
        }
        return [[]];
      }
      // Check all elements are arrays
      for (const arr of value) {
        if (!Array.isArray(arr)) return [];
      }
      const limits = resourceLimits(ctx);
      const arrays = value as QueryValue[][];
      if (arrays.length > limits.maxDepth) {
        throw new ExecutionLimitError(
          `query depth limit exceeded (${limits.maxDepth})`,
          "recursion",
        );
      }
      const resultCount = checkedProduct(
        arrays.map((array) => array.length),
        limits.maxResults,
      );
      if (resultCount === 0) return [];
      const results: QueryValue[][] = [];
      const indexes = new Array<number>(arrays.length).fill(0);
      for (let produced = 0; produced < resultCount; produced++) {
        const combo2: QueryValue[] = [];
        for (let ci = 0; ci < indexes.length; ci++) {
          const subArrN = elemRead(arrays, ci) as unknown as QueryValue[];
          combo2.push(elemRead(subArrN, indexes[ci]));
        }
        results.push(combo2);
        for (let position = arrays.length - 1; position >= 0; position--) {
          indexes[position] = indexes[position] + 1;
          if (indexes[position] < arrays[position].length) break;
          indexes[position] = 0;
        }
      }
      return results;
    }

    // Navigation operators
    case "parent": {
      if (ctx.root === undefined || ctx.currentPath === undefined) return [];
      const path = ctx.currentPath;
      if (path.length === 0) return []; // At root, no parent

      // Get levels argument (default: 1)
      const levels =
        args.length > 0 ? (evaluate(value, args[0], ctx)[0] as number) : 1;

      if (levels >= 0) {
        // Positive: go up n levels
        if (levels > path.length) return []; // Beyond root
        const parentPath = path.slice(0, path.length - levels);
        return [getValueAtPath(ctx.root, parentPath)];
      } else {
        // Negative: index from root (-1 = root, -2 = one below root, etc.)
        // -1 means path length 0 (root)
        // -2 means path length 1 (one level below root)
        const targetLen = -levels - 1;
        if (targetLen >= path.length) return [value]; // Beyond current
        const parentPath = path.slice(0, targetLen);
        return [getValueAtPath(ctx.root, parentPath)];
      }
    }

    case "parents": {
      if (ctx.root === undefined || ctx.currentPath === undefined) return [[]];
      const path = ctx.currentPath;
      const parents: QueryValue[] = [];
      // Build array of parents from immediate parent to root
      for (let i = path.length - 1; i >= 0; i--) {
        parents.push(getValueAtPath(ctx.root, path.slice(0, i)));
      }
      return [parents];
    }

    case "root":
      return ctx.root !== undefined ? [ctx.root] : [];

    default:
      return null;
  }
}
