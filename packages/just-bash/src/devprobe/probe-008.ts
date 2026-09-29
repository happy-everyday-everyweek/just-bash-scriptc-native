/* scriptc probe 008: Required<> + error classes (dev only, delete after) */
import type { ExecutionLimits } from "../limits.js";
import {
  ExecutionAbortedError,
  ExecutionLimitError,
} from "../interpreter/errors.js";

interface M8 {
  limits: Required<ExecutionLimits>;
}
export function p8(x: M8): number {
  return x.limits.maxCommandCount;
}

interface M10 {
  p: ExecutionLimitError | ExecutionAbortedError | undefined;
}
export function p10(x: M10): number {
  return x.p ? 1 : 0;
}