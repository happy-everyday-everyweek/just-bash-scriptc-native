/* scriptc probe: real import generic (dev only) */
import { awaitWithDefenseContext } from "../security/defense-context.js";

type AwkValue = number | string | undefined;

async function evalExpr(): Promise<AwkValue> {
  return 1;
}

function withDefenseContext<T>(
  flag: boolean | undefined,
  phase: string,
  op: () => Promise<T>,
): Promise<T> {
  return awaitWithDefenseContext<T>(flag, "awk", phase, op);
}

export async function probeR(): Promise<AwkValue> {
  return withDefenseContext(undefined, "x", () => evalExpr());
}

export async function probeR2(): Promise<void> {
  await withDefenseContext(undefined, "y", async () => {});
}
