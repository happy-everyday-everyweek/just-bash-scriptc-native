/**
 * SECURITY: Pre-captured references to dangerous globals.
 *
 * These are captured at module load time (before defense-in-depth patches)
 * so that just-bash infrastructure can use them. They bypass all defense
 * protections.
 *
 * DO NOT import these from command implementations unless absolutely
 * necessary (e.g., Python WASM worker IPC). Any import from this module
 * should be reviewed for security implications.
 */
export const _SharedArrayBuffer: unknown = undefined;
export const _Atomics: unknown = undefined;
export const _performanceNow: () => number = performance.now.bind(performance);
export class _Headers {
  private hk: string[] = [];
  private hv: string[] = [];
  private hlk: string[] = [];
  constructor(init?: unknown) {}
  set(k: string, v: string): void {
    const lk = k.toLowerCase();
    const i = this.hlk.indexOf(lk);
    if (i === -1) {
      this.hk.push(k);
      this.hv.push(v);
      this.hlk.push(lk);
    } else {
      this.hv[i] = v;
    }
  }
  has(k: string): boolean {
    return this.hlk.indexOf(k.toLowerCase()) !== -1;
  }
  get(k: string): string | undefined {
    const i = this.hlk.indexOf(k.toLowerCase());
    return i === -1 ? undefined : this.hv[i];
  }
  delete(k: string): void {
    const lk = k.toLowerCase();
    const i = this.hlk.indexOf(lk);
    if (i === -1) return;
    const nk: string[] = [];
    const nv: string[] = [];
    const nl: string[] = [];
    for (let j = 0; j < this.hk.length; j++) {
      if (j !== i) {
        nk.push(this.hk[j]);
        nv.push(this.hv[j]);
        nl.push(this.hlk[j]);
      }
    }
    this.hk = nk;
    this.hv = nv;
    this.hlk = nl;
  }
}
/** Internal capability revocation; never expose this constructor to commands. */
export class _Proxy {
  constructor(_target: unknown, _handler: object) {}
}
