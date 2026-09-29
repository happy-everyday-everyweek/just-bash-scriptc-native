/* scriptc probe: defense-context generic + undefined arm (dev only) */
type AwkValue = number | string | undefined;

async function outer<T>(op: () => Promise<T>): Promise<T> {
  return op();
}

async function evalExpr(): Promise<AwkValue> {
  return 1;
}

export async function probe1(): Promise<AwkValue> {
  return outer(() => evalExpr());
}

export async function probe2(): Promise<AwkValue> {
  return outer<AwkValue>(() => evalExpr());
}

export async function probe3(): Promise<number> {
  return outer(async () => 1);
}

async function wrapped<T>(op: () => Promise<T>): Promise<T> {
  return outer(op);
}

export async function probe4(): Promise<AwkValue> {
  return wrapped(() => evalExpr());
}

async function wrappedV(op: () => Promise<AwkValue>): Promise<AwkValue> {
  return outer(op);
}

export async function probe5(): Promise<AwkValue> {
  return wrappedV(() => evalExpr());
}

export async function probe6(): Promise<string> {
  return outer(async () => "x");
}

export async function probe7(): Promise<number | string> {
  return outer(async () => (1 as number | string));
}

export async function probe8(): Promise<AwkValue> {
  return outer(async () => (undefined as AwkValue));
}