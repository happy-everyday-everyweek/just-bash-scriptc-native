/* scriptc probe: real evalExpr through local wrapper (dev only) */
import { evalExpr } from "../commands/awk/interpreter/expressions.js";
import type { AwkExpr } from "../commands/awk/ast.js";
import type { AwkRuntimeContext } from "../commands/awk/interpreter/context.js";
import type { AwkValue } from "../commands/awk/interpreter/types.js";

const wrapped = <T>(op: () => Promise<T>): Promise<T> => op();

export async function probeD(
  ctx: AwkRuntimeContext,
  e: AwkExpr,
): Promise<AwkValue> {
  return wrapped(() => evalExpr(ctx, e));
}