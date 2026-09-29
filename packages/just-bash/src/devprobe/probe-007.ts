/* scriptc probe 007: ExecutionScope deep features (dev only, delete after) */
class E1 extends Error {
  e1 = 1;
}
class E2 extends Error {
  e2 = 2;
}

interface Lease {
  release(): void;
}

class Deep {
  private counters = new Map<string, number>();
  private poisoned: E1 | E2 | undefined;
  private closed = false;
  private readonly startedAt = Date.now();
  private readonly cleanupCallbacks: Array<() => void | Promise<void>> = [];
  constructor(
    private readonly max: number,
    private readonly sig: string | undefined = undefined,
  ) {}

  consume(kind: string, count: number = 1, site: string = kind): number {
    return (this.counters.get(kind) ?? 0) + count + site.length;
  }
  enterDepth(
    kind: string,
    maximumOrSite: number | string = this.max,
    maybeSite?: string,
  ): Lease {
    let released = false;
    const site =
      typeof maximumOrSite === "string" ? maximumOrSite : (maybeSite ?? kind);
    return {
      release: () => {
        if (released) return;
        released = true;
        void site;
      },
    };
  }
  reg(cb: () => void | Promise<void>): () => void {
    this.cleanupCallbacks.push(cb);
    const index = this.cleanupCallbacks.indexOf(cb);
    if (index >= 0) this.cleanupCallbacks.splice(index, 1);
    return cb;
  }
  private fail(error: E1 | E2): never {
    this.poisoned ??= error;
    throw this.poisoned;
  }
  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    const errs: unknown[] = [];
    await Promise.resolve();
    if (errs.length > 0) {
      this.fail(new E1());
    }
  }
  get used(): number {
    return this.counters.size + this.cleanupCallbacks.length;
  }
}
export function deepUse(x: Deep): number {
  return x.used + x.consume("a");
}