/* scriptc probe: recursion through generic wrapper (dev only) */
type AwkValue = string | number;

const wrapped = <T>(op: () => Promise<T>): Promise<T> => op();

async function rec(n: number): Promise<AwkValue> {
  if (n <= 0) return "0";
  return wrapped(() => rec(n - 1));
}

export async function probeRec(n: number): Promise<AwkValue> {
  return rec(n);
}

async function recV1(n: number): Promise<AwkValue> {
  if (n <= 0) return "0";
  return wrapped(async () => recV1(n - 1));
}
export async function probeRec1(n: number): Promise<AwkValue> {
  return recV1(n);
}

async function recV2(n: number): Promise<AwkValue> {
  if (n <= 0) return "0";
  const op: () => Promise<AwkValue> = () => recV2(n - 1);
  return wrapped(op);
}
export async function probeRec2(n: number): Promise<AwkValue> {
  return recV2(n);
}