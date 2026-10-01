import { _clearTimeout, _setTimeout } from "../../timers.js";
import type {
  ExecResult,
  RuntimeCommand,
  RuntimeCommandContext,
} from "../../types.js";
import { parseDuration } from "../duration.js";
import { hasHelpFlag, showHelp } from "../help.js";

const sleepHelp = {
  name: "sleep",
  summary: "delay for a specified amount of time",
  usage: "sleep NUMBER[SUFFIX]",
  description: `Pause for NUMBER seconds. SUFFIX may be:
  s - seconds (default)
  m - minutes
  h - hours
  d - days

NUMBER may be a decimal number.`,
  options: ["    --help display this help and exit"],
};

/** Maximum sleep duration: 1 hour (prevents DoS via indefinite blocking) */
const MAX_SLEEP_MS = 3_600_000;

export const sleepCommand: RuntimeCommand = {
  name: "sleep",

  async execute(
    args: string[],
    ctx: RuntimeCommandContext,
  ): Promise<ExecResult> {
    if (hasHelpFlag(args)) {
      return showHelp(sleepHelp);
    }

    if (args.length === 0) {
      return {
        stdout: "",
        stderr: "sleep: missing operand\n",
        exitCode: 1,
      };
    }

    // Parse all arguments and sum durations (like GNU sleep)
    let totalMs = 0;
    for (const arg of args) {
      const ms = parseDuration(arg);
      if (ms === null) {
        return {
          stdout: "",
          stderr: `sleep: invalid time interval '${arg}'\n`,
          exitCode: 1,
        };
      }
      totalMs += ms;
    }

    // Cap to prevent indefinite blocking
    if (totalMs > MAX_SLEEP_MS) {
      totalMs = MAX_SLEEP_MS;
    }

    // Check if already aborted before sleeping
    if (ctx.signal?.aborted) {
      return { stdout: "", stderr: "", exitCode: 0 };
    }

    // Use mock sleep if available in context, otherwise real setTimeout
    if (ctx.sleep) {
      const sleepFn = ctx.sleep as unknown as (ms: number) => Promise<void>;
      const sleepPromise = Promise.resolve(sleepFn(totalMs));
      if (ctx.signal) {
        const sigA = ctx.signal as unknown as {
          aborted: boolean;
          addEventListener: (
            t: string,
            h: () => void,
            o: { once: boolean },
          ) => void;
          removeEventListener: (t: string, h: () => void) => void;
        };
        let onAbort: (() => void) | undefined;
        const abortPromise = new Promise<void>((resolve) => {
          onAbort = resolve;
          sigA.addEventListener("abort", onAbort, { once: true });
          if (sigA.aborted) resolve();
        });
        try {
          await Promise.race([sleepPromise, abortPromise]);
        } finally {
          if (onAbort) {
            sigA.removeEventListener("abort", onAbort);
          }
        }
      } else {
        await sleepPromise;
      }
    } else if (ctx.signal) {
      // Abort-aware sleep: resolve early if the signal fires.
      // Named handler so we can remove it when the timer resolves normally.
      await new Promise<void>((resolve) => {
        const sigB = ctx.signal as unknown as {
          aborted: boolean;
          addEventListener: (
            t: string,
            h: () => void,
            o: { once: boolean },
          ) => void;
          removeEventListener: (t: string, h: () => void) => void;
        };
        const setT = _setTimeout as unknown as (
          fn: () => void,
          ms: number,
        ) => number;
        const clearT = _clearTimeout as unknown as (h: number) => void;
        const timer = setT(() => {
          sigB.removeEventListener("abort", onAbort);
          resolve();
        }, totalMs);
        const onAbort = () => {
          clearT(timer);
          resolve();
        };
        sigB.addEventListener("abort", onAbort, { once: true });
      });
    } else {
      await new Promise((resolve) => _setTimeout(() => resolve(undefined), totalMs));
    }

    return { stdout: "", stderr: "", exitCode: 0 };
  },
};

import type { CommandFuzzInfo } from "../fuzz-flags-types.js";

export const flagsForFuzzing: CommandFuzzInfo = {
  name: "sleep",
  flags: [],
  needsArgs: true,
};
