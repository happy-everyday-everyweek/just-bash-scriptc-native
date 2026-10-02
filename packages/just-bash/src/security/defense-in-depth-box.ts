/**
 * Defense-in-depth box — static-build implementation.
 *
 * Upstream this module is a ~2400 line machine that patches host globals
 * (Proxy + Reflect + `Object.defineProperties`), tracks an execution context
 * with `AsyncLocalStorage`, captures host `node:module` internals, and revokes
 * capabilities on a `WeakMap`. None of that has a lowering in a statically
 * compiled build, and none of it can protect anything there either: a compiled
 * program patches no host globals and has no async context store.
 *
 * What remains is the public surface the rest of the code base relies on, with
 * every entry point behaving as the upstream code does when no context store
 * exists: the callback runs directly, "in sandbox context" is never true, and
 * there is no execution id to hand out. Callers that need an entry point other
 * than the class statics (which a compiled call site cannot reach through the
 * class value) import the module-level functions below.
 */

import type { DefenseInDepthConfig, SecurityViolation } from "./types.js";

export type { SecurityViolation };

/**
 * Raised when an operation is refused by the defense box. The violation record
 * mirrors the shape callers pass in; synthesized failures carry the message.
 */
export class SecurityViolationError extends Error {
  readonly violation: SecurityViolation | undefined;

  constructor(message: string, violation?: SecurityViolation) {
    super(message);
    this.name = "SecurityViolationError";
    this.violation = violation;
  }
}

/** Handle returned by `activate()`; running through it is a plain call. */
export interface StaticDefenseHandle {
  run(fn: () => Promise<unknown>): Promise<unknown>;
  deactivate(): void;
}

let boxInstance: DefenseInDepthBox | null = null;

/** Singleton lookup, reachable without touching the class value. */
export function getDefenseBoxInstance(
  _config?: DefenseInDepthConfig | boolean,
): DefenseInDepthBox {
  if (boxInstance === null) {
    boxInstance = new DefenseInDepthBox();
  }
  return boxInstance;
}

/** The box API, kept whole so call sites and type positions keep working. */
export class DefenseInDepthBox {
  constructor(_config?: DefenseInDepthConfig | boolean) {}

  static getInstance(
    config?: DefenseInDepthConfig | boolean,
  ): DefenseInDepthBox {
    return getDefenseBoxInstance(config);
  }

  static resetInstance(): void {
    boxInstance = null;
  }

  static isInSandboxedContext(): boolean {
    return false;
  }

  static getCurrentExecutionId(): string | undefined {
    return undefined;
  }

  static bindCurrentContext<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => TResult,
  ): (...args: TArgs) => TResult {
    return fn;
  }

  static runTrusted<T>(fn: () => T): T {
    return fn();
  }

  static async runTrustedAsync<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  static async runUntrustedAsync<T>(fn: () => Promise<T>): Promise<T> {
    return fn();
  }

  isEnabled(): boolean {
    return false;
  }

  isActive(): boolean {
    return false;
  }

  activate(): StaticDefenseHandle {
    let deactivated = false;
    return {
      run: (fn: () => Promise<unknown>): Promise<unknown> => {
        if (deactivated) {
          return Promise.reject(
            new Error(
              "DefenseInDepthBox handle is deactivated and cannot run new work",
            ),
          );
        }
        return fn();
      },
      deactivate: (): void => {
        deactivated = true;
      },
    };
  }

  deactivate(): void {}

  forceDeactivate(): void {}

  getViolations(): SecurityViolation[] {
    const none: SecurityViolation[] = [];
    return none;
  }
}

/** True while an execution context is active — never, in this build. */
export function defenseIsInSandboxedContext(): boolean {
  return false;
}

/** Current execution id — there is none, in this build. */
export function defenseCurrentExecutionId(): string | undefined {
  return undefined;
}

/** Module-level twin of the `runTrusted` static. */
export function runTrusted<T>(fn: () => T): T {
  return fn();
}

/** Module-level twin of the `runTrustedAsync` static. */
export function runTrustedAsync<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

/** Module-level twin of the `runUntrustedAsync` static. */
export function runUntrustedAsync<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

/** Module-level twin of the `bindCurrentContext` static. */
export function bindCurrentContext<TArgs extends unknown[], TResult>(
  fn: (...args: TArgs) => TResult,
): (...args: TArgs) => TResult {
  return fn;
}

/** Result-typed trusted entry point. */
export function runTrustedTask<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}

/** Result-typed untrusted entry point. */
export function runUntrustedTask<T>(fn: () => Promise<T>): Promise<T> {
  return fn();
}
