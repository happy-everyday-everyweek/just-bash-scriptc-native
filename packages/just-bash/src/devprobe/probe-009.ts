/* scriptc probe 009: error classes + param props deep (dev only, delete after) */
import type { ExecutionLimits } from "../limits.js";
import {
  ExecutionAbortedError,
  ExecutionLimitError,
} from "../interpreter/errors.js";

class E3 extends Error {
  readonly name = "E3";
}

interface M13 {
  p: ExecutionLimitError | undefined;
}
export function p13(x: M13): number {
  return x.p ? 1 : 0;
}

interface M14 {
  e: ExecutionLimitError;
}
export function p14(x: M14): number {
  return x.e ? 1 : 0;
}

interface M15 {
  a: ExecutionAbortedError;
}
export function p15(x: M15): number {
  return x.a ? 1 : 0;
}

interface M16 {
  e: E3 | undefined;
}
export function p16(x: M16): number {
  return x.e ? 1 : 0;
}

class PP {
  constructor(private readonly lim: Required<ExecutionLimits>) {}
  peek(): number {
    return this.lim.maxCommandCount;
  }
}
interface M17 {
  m: PP;
}
export function p17(x: M17): number {
  return x.m.peek();
}