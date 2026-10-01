// temporary union-arm bisect probe (delete after)
import type { FeatureCoverageWriter } from "../types.js";
import {
  VarStore,
  type ResolvedQueryExecutionLimits,
  type UserFuncRecord,
  type QueryEvaluationBudget,
} from "../commands/query-engine/evaluator.js";

interface Z { z: number }
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
