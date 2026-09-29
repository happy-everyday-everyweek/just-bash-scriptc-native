/* scriptc probe 006: ExecutionScope feature bisect (dev only, delete after) */

class E1 extends Error {
  e1 = 1;
}
class E2 extends Error {
  e2 = 2;
}

type Cl = () => void | Promise<void>;

interface S1 {
  callbacks: Array<Cl>;
}
export function q1(x: S1): number {
  return x.callbacks.length;
}

interface S2 {
  reg(cleanup: Cl): () => void;
}
export function q2(x: S2): number {
  x.reg(() => {});
  return 1;
}

interface S3 {
  p: E1 | E2 | undefined;
}
export function q3(x: S3): number {
  return x.p ? 1 : 0;
}

interface S4 {
  reserve(
    kind: string | number,
    bytes?: number | string,
    site?: string,
  ): { release(): void };
}
export function q4(x: S4): number {
  x.reserve(1).release();
  return 1;
}

class Mini {
  private readonly a = new Map<string, number>();
  private b = 0;
  private readonly cbs: Array<() => void> = [];
  constructor(
    private readonly lim: number,
    private readonly sig: string | undefined = undefined,
  ) {}
  get used(): number {
    return this.b;
  }
  charge(n = 1, site = "x"): number {
    return this.b + n + this.a.size + site.length;
  }
  rex(cb: () => void): () => void {
    this.cbs.push(cb);
    return cb;
  }
}
interface S5 {
  m: Mini;
}
export function q5(x: S5): number {
  return x.m.used + x.m.charge();
}