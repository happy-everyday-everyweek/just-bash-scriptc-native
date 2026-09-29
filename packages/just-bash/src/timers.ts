/**
 * Pre-captured global references.
 *
 * Defense-in-depth replaces dangerous globals with blocking proxies during
 * bash execution. These pre-captured references are taken at module load
 * time (before defense patches are applied) so that just-bash's own
 * infrastructure can use them safely.
 *
 * IMPORTANT: This module must be imported eagerly (at Bash construction time),
 * not lazily during exec(), to ensure the capture happens before patching.
 */
import { DefenseInDepthBox } from "./security/defense-in-depth-box.js";

const nativeSetTimeout = (callback: () => void, delay?: number): unknown =>
  setTimeout(callback, delay);
const nativeClearTimeout = (handle: unknown): void => {
  clearTimeout(handle as unknown as number);
};
const nativeSetInterval = (callback: () => void, delay?: number): unknown =>
  setInterval(callback, delay);
const nativeClearInterval = (handle: unknown): void => {
  clearInterval(handle as unknown as number);
};
};

type TimerCallback = (...args: unknown[]) => unknown;

function bindTimerCallback<T>(callback: T): T {
  if (typeof callback !== "function") return callback;
  return DefenseInDepthBox.bindCurrentContext(callback as TimerCallback) as T;
}

export const _setTimeout = (callback: () => void, delay?: number): unknown => {
  return nativeSetTimeout(bindTimerCallback(callback), delay);
};

export const _clearTimeout = (handle: unknown): void => {
  nativeClearTimeout(handle);
};

const MAX_NATIVE_TIMEOUT_MS = 2_147_483_647;

export interface FiniteTimeoutHandle {
  cleared: boolean;
  remainingMs: number;
  timer: unknown;
}

/**
 * Schedule a configured deadline without overflowing the host timer. Positive
 * Infinity means no deadline; longer finite delays are advanced in native-safe
 * chunks so they retain their actual duration.
 */
export function _setTimeoutIfFinite(
  callback: () => void,
  delay: number,
): FiniteTimeoutHandle | undefined {
  if (delay === Number.POSITIVE_INFINITY) return undefined;
  const boundCallback = bindTimerCallback(callback) as () => void;
  const handle: FiniteTimeoutHandle = {
    cleared: false,
    remainingMs: Math.max(0, delay),
    timer: undefined,
  };
  const schedule = (): void => {
    if (handle.cleared) return;
    const chunk = Math.min(handle.remainingMs, MAX_NATIVE_TIMEOUT_MS);
    handle.timer = nativeSetTimeout(() => {
      if (handle.cleared) return;
      handle.remainingMs -= chunk;
      if (handle.remainingMs > 0) schedule();
      else boundCallback();
    }, chunk);
  };
  schedule();
  return handle;
}

export function _clearFiniteTimeout(
  handle: FiniteTimeoutHandle | undefined,
): void {
  if (!handle) return;
  handle.cleared = true;
  if (handle.timer !== undefined) nativeClearTimeout(handle.timer);
}

export const _setInterval = (callback: () => void, delay?: number): unknown => {
  return nativeSetInterval(bindTimerCallback(callback), delay);
};

export const _clearInterval = (handle: unknown): void => {
  nativeClearInterval(handle);
};

// _SharedArrayBuffer, _Atomics, _performanceNow moved to security/trusted-globals.ts
