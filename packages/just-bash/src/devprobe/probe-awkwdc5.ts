/* scriptc probe: bisect evalExpr typing (dev only) */
import { evalExpr } from "../commands/awk/interpreter/expressions.js";
import type { AwkExpr } from "../commands/awk/ast.js";
import type { AwkRuntimeContext } from "../commands/awk/interpreter/context.js";
import type { AwkValue } from "../commands/awk/interpreter/types.js";

const wrapped = <T>(op: () => Promise<T>): Promise<T> => op();

export async function probeD1(
  ctx: AwkRuntimeContext,
  e: AwkExpr,
): Promise<AwkValue> {
  const v = await evalExpr(ctx, e);
  return v;
}

async function passThrough(
  ctx: AwkRuntimeContext,
  e: AwkExpr,
): Promise<AwkValue> {
  return await evalExpr(ctx, e);
}
export async function probeD2(
  ctx: AwkRuntimeContext,
  e: AwkExpr,
): Promise<AwkValue> {
  return passThrough(ctx, e);
}

export async function probeD3(
  ctx: AwkRuntimeContext,
  e: AwkExpr,
): Promise<AwkValue> {
  const f: () => Promise<AwkValue> = () => evalExpr(ctx, e);
  return f();
}

export async function probeD4(
  ctx: AwkRuntimeContext,
  e: AwkExpr,
): Promise<AwkValue> {
  return wrapped(async () => await evalExpr(ctx, e));
}