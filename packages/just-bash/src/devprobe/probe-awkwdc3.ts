/* scriptc probe: faithful clone of awaitWithDefenseContext chain (dev only) */
type AwkValue = number | string | undefined;

async function evalExpr(): Promise<AwkValue> {
  return 1;
}

function assertDefenseContext(
  flag: boolean | undefined,
  component: string,
  phase: string,
): void {
  if (flag && !component) throw new Error(phase);
}

async function cloneWdc<T>(
  flag: boolean | undefined,
  component: string,
  phase: string,
  op: () => Promise<T>,
): Promise<T> {
  assertDefenseContext(flag, component, phase + " pre");
  const result = await op();
  assertDefenseContext(flag, component, phase + " post");
  return result;
}

const wrapped = <T>(
  flag: boolean | undefined,
  phase: string,
  op: () => Promise<T>,
): Promise<T> => cloneWdc(flag, "awk", phase, op);

export async function probeC(): Promise<AwkValue> {
  return wrapped(undefined, "x", () => evalExpr());
}

export async function probeC2(): Promise<void> {
  await wrapped(undefined, "y", async () => {});
}
