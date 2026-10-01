// temporary union-arm bisect probe v2 (delete after)
import type { FeatureCoverageWriter } from "../types.js";
import {
  VarStore,
  type ResolvedQueryExecutionLimits,
  type UserFuncRecord,
  type QueryEvaluationBudget,
  type EvalContext,
  type EvaluateOptions,
} from "../commands/query-engine/evaluator.js";

interface Z { z: number }

// ---- controls: constructs known to be unsupported (must error if this module lowers) ----
export function pcAssign(): number {
  const o: { x: number } = Object.assign({}, { x: 1 });
  return o.x;
}
export function pcRadix(): string {
  return (255).toString(16);
}
export function pcNested(): number {
  const o = { a: { b: 1 as number | undefined } };
  o.a.b ??= 2;
  return o.a.b;
}
export function pcRx(): number {
  const m = /a/.exec("a");
  return m ? m.index : 0;
}

// ---- singles: one EvalContext member each, union-arm position ----
interface C1 { vars: VarStore }
interface C2 { limits: ResolvedQueryExecutionLimits }
interface C3 { env?: Record<string, string> }
interface C4 { namedArgNames?: string[] }
interface C5 { namedArgValues?: unknown[] }
interface C6 { positionalArgs?: unknown[] }
interface C7 { requireDefenseContext?: boolean }
interface C8 { defenseContextChecked?: boolean }
interface C9 { root?: unknown }
interface C10 { currentPath?: (string | number)[] }
interface C11 { funcs?: Map<string, UserFuncRecord> }
interface C12 { labels?: Set<string> }
interface C13 { coverage?: FeatureCoverageWriter }
interface C14 { budget: QueryEvaluationBudget }

export function t1(v?: C1 | Z): number { return v ? 1 : 0; }
export function t2(v?: C2 | Z): number { return v ? 1 : 0; }
export function t3(v?: C3 | Z): number { return v ? 1 : 0; }
export function t4(v?: C4 | Z): number { return v ? 1 : 0; }
export function t5(v?: C5 | Z): number { return v ? 1 : 0; }
export function t6(v?: C6 | Z): number { return v ? 1 : 0; }
export function t7(v?: C7 | Z): number { return v ? 1 : 0; }
export function t8(v?: C8 | Z): number { return v ? 1 : 0; }
export function t9(v?: C9 | Z): number { return v ? 1 : 0; }
export function t10(v?: C10 | Z): number { return v ? 1 : 0; }
export function t11(v?: C11 | Z): number { return v ? 1 : 0; }
export function t12(v?: C12 | Z): number { return v ? 1 : 0; }
export function t13(v?: C13 | Z): number { return v ? 1 : 0; }
export function t14(v?: C14 | Z): number { return v ? 1 : 0; }

// ---- full clone and the real interface ----
interface F {
  vars: VarStore;
  limits: ResolvedQueryExecutionLimits;
  env?: Record<string, string>;
  namedArgNames?: string[];
  namedArgValues?: unknown[];
  positionalArgs?: unknown[];
  requireDefenseContext?: boolean;
  defenseContextChecked?: boolean;
  root?: unknown;
  currentPath?: (string | number)[];
  funcs?: Map<string, UserFuncRecord>;
  labels?: Set<string>;
  coverage?: FeatureCoverageWriter;
  budget: QueryEvaluationBudget;
}
export function uF(v?: F | Z): number { return v ? 1 : 0; }
export function u0(v?: EvalContext | Z): number { return v ? 1 : 0; }
export function eo1(v?: EvaluateOptions | Z): number { return v ? 1 : 0; }
export function uU3(v?: EvalContext | EvaluateOptions): number { return v ? 1 : 0; }

// ---- record position (member-naming diagnostic path) ----
function __mkCtx(): EvalContext {
  throw new Error("probe");
}
export function uR(v: EvalContext): number { return v ? 1 : 0; }

// ---- swaps: full clone with one suspect member made benign ----
interface S1 { vars: string[]; limits: ResolvedQueryExecutionLimits; env?: Record<string, string>; namedArgNames?: string[]; namedArgValues?: unknown[]; positionalArgs?: unknown[]; requireDefenseContext?: boolean; defenseContextChecked?: boolean; root?: unknown; currentPath?: (string | number)[]; funcs?: Map<string, UserFuncRecord>; labels?: Set<string>; coverage?: FeatureCoverageWriter; budget: QueryEvaluationBudget; }
export function s1(v?: S1 | Z): number { return v ? 1 : 0; }
interface S2 { vars: VarStore; limits: ResolvedQueryExecutionLimits; env?: Record<string, string>; namedArgNames?: string[]; namedArgValues?: unknown[]; positionalArgs?: unknown[]; requireDefenseContext?: boolean; defenseContextChecked?: boolean; root?: unknown; currentPath?: (string | number)[]; funcs?: string[]; labels?: Set<string>; coverage?: FeatureCoverageWriter; budget: QueryEvaluationBudget; }
export function s2(v?: S2 | Z): number { return v ? 1 : 0; }
interface S3 { vars: VarStore; limits: ResolvedQueryExecutionLimits; env?: Record<string, string>; namedArgNames?: string[]; namedArgValues?: unknown[]; positionalArgs?: unknown[]; requireDefenseContext?: boolean; defenseContextChecked?: boolean; root?: unknown; currentPath?: (string | number)[]; funcs?: Map<string, UserFuncRecord>; labels?: string[]; coverage?: FeatureCoverageWriter; budget: QueryEvaluationBudget; }
export function s3(v?: S3 | Z): number { return v ? 1 : 0; }
interface S4 { vars: VarStore; limits: ResolvedQueryExecutionLimits; env?: Record<string, string>; namedArgNames?: string[]; namedArgValues?: unknown[]; positionalArgs?: unknown[]; requireDefenseContext?: boolean; defenseContextChecked?: boolean; root?: unknown; currentPath?: (string | number)[]; funcs?: Map<string, UserFuncRecord>; labels?: Set<string>; coverage?: number; budget: QueryEvaluationBudget; }
export function s4(v?: S4 | Z): number { return v ? 1 : 0; }
interface S5 { vars: VarStore; limits: ResolvedQueryExecutionLimits; env?: string; namedArgNames?: string[]; namedArgValues?: string[]; positionalArgs?: string[]; requireDefenseContext?: boolean; defenseContextChecked?: boolean; root?: string; currentPath?: (string | number)[]; funcs?: Map<string, UserFuncRecord>; labels?: Set<string>; coverage?: FeatureCoverageWriter; budget: QueryEvaluationBudget; }
export function s5(v?: S5 | Z): number { return v ? 1 : 0; }
interface S6 { vars: VarStore; limits: number; env?: Record<string, string>; namedArgNames?: string[]; namedArgValues?: unknown[]; positionalArgs?: unknown[]; requireDefenseContext?: boolean; defenseContextChecked?: boolean; root?: unknown; currentPath?: (string | number)[]; funcs?: Map<string, UserFuncRecord>; labels?: Set<string>; coverage?: FeatureCoverageWriter; budget: QueryEvaluationBudget; }
export function s6(v?: S6 | Z): number { return v ? 1 : 0; }
interface S7 { vars: VarStore; limits: ResolvedQueryExecutionLimits; env?: Record<string, string>; namedArgNames?: string[]; namedArgValues?: unknown[]; positionalArgs?: unknown[]; requireDefenseContext?: boolean; defenseContextChecked?: boolean; root?: unknown; currentPath?: (string | number)[]; funcs?: Map<string, UserFuncRecord>; labels?: Set<string>; coverage?: FeatureCoverageWriter; budget: number; }
export function s7(v?: S7 | Z): number { return v ? 1 : 0; }
interface S8 { vars: VarStore; limits: ResolvedQueryExecutionLimits; env?: Record<string, string>; namedArgNames?: string[]; namedArgValues?: unknown[]; positionalArgs?: unknown[]; requireDefenseContext?: boolean; defenseContextChecked?: boolean; root?: unknown; currentPath?: string; funcs?: Map<string, UserFuncRecord>; labels?: Set<string>; coverage?: FeatureCoverageWriter; budget: QueryEvaluationBudget; }
export function s8(v?: S8 | Z): number { return v ? 1 : 0; }

export function runProbes(): number {
  let n = 0;
  n += t1(); n += t2(); n += t3(); n += t4(); n += t5(); n += t6(); n += t7();
  n += t8(); n += t9(); n += t10(); n += t11(); n += t12(); n += t13(); n += t14();
  n += u0(); n += uF(); n += eo1(); n += uU3();
  n += uR(__mkCtx());
  n += s1(); n += s2(); n += s3(); n += s4(); n += s5(); n += s6(); n += s7(); n += s8();
  n += pcAssign(); n += pcRadix(); n += pcNested(); n += pcRx();
  return n;
}
