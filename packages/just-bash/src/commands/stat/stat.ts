import { toOctal, toOctalFixed } from "../../utils/radix.js";
import { utf8ByteLength } from "../../encoding.js";
import { rethrowFatalExecutionError } from "../../fatal-execution-error.js";
import { ExecutionLimitError } from "../../interpreter/errors.js";
import type {
  ExecResult,
  RuntimeCommand,
  RuntimeCommandContext,
} from "../../types.js";
import { parseArgs, type FlagsOf } from "../../utils/args.js";
import { formatMode } from "../format-mode.js";
import { hasHelpFlag, showHelp } from "../help.js";

const statHelp = {
  name: "stat",
  summary: "display file or file system status",
  usage: "stat [OPTION]... FILE...",
  options: [
    "-c FORMAT   use the specified FORMAT instead of the default",
    "    --help  display this help and exit",
  ],
};

const argDefs = {
  format: { short: "c", type: "string" as const },
};

export const statCommand: RuntimeCommand = {
  name: "stat",

  async execute(
    args: string[],
    ctx: RuntimeCommandContext,
  ): Promise<ExecResult> {
    if (hasHelpFlag(args)) {
      return showHelp(statHelp);
    }

    const parsed = parseArgs<FlagsOf<typeof argDefs>>("stat", args, argDefs);
    if (!parsed.ok) return parsed.error;

    const format = parsed.result.flags.format ?? null;
    const files = parsed.result.positional;

    if (files.length === 0) {
      return {
        stdout: "",
        stderr: "stat: missing operand\n",
        exitCode: 1,
      };
    }

    let stdout = "";
    let stderr = "";
    let hasError = false;
    let stdoutBytes = 0;
    const maxOutputBytes = Math.min(
      ctx.limits.maxOutputSize,
      ctx.limits.maxStringLength,
    );
    const appendStdout = (value: string): void => {
      const valueBytes = utf8ByteLength(value);
      if (valueBytes > maxOutputBytes - stdoutBytes) {
        throw new ExecutionLimitError(
          `stat: output size limit exceeded (${maxOutputBytes} bytes)`,
          "output_size",
        );
      }
      stdout += value;
      stdoutBytes += valueBytes;
    };

    for (const file of files) {
      const fullPath = ctx.fs.resolvePath(ctx.cwd, file);

      try {
        const stat = await ctx.fs.stat(fullPath);

        if (format) {
          // Handle custom format
          const modeOctal = toOctal(stat.mode);
          const modeStr = formatMode(stat.mode, stat.isDirectory);
          const replacements = new Map<string, string>([
            ["%n", file],
            ["%N", `'${file}'`],
            ["%s", String(stat.size)],
            ["%F", stat.isDirectory ? "directory" : "regular file"],
            ["%a", modeOctal],
            ["%A", modeStr],
            ["%u", "1000"],
            ["%U", "user"],
            ["%g", "1000"],
            ["%G", "group"],
          ]);
          const output = replaceDirectives(format, replacements);
          appendStdout(`${output}\n`);
        } else {
          // Default format
          const modeOctal = toOctalFixed(stat.mode, 4);
          const modeStr = formatMode(stat.mode, stat.isDirectory);
          appendStdout(
            `  File: ${file}\n  Size: ${stat.size}\t\tBlocks: ${Math.ceil(stat.size / 512)}\nAccess: (${modeOctal}/${modeStr})\nModify: ${stat.mtime.toISOString()}\n`,
          );
        }
      } catch (error) {
        rethrowFatalExecutionError(error);
        stderr += `stat: cannot stat '${file}': No such file or directory\n`;
        hasError = true;
      }
    }

    return { stdout, stderr, exitCode: hasError ? 1 : 0 };
  },
};

// formatMode imported from ../format-mode.js

import type { CommandFuzzInfo } from "../fuzz-flags-types.js";

export const flagsForFuzzing: CommandFuzzInfo = {
  name: "stat",
  flags: [
    { flag: "-c", type: "value", valueHint: "format" },
    { flag: "-L", type: "boolean" },
  ],
  needsArgs: true,
};


/**
 * Substitute `%n`-style directives from a lookup table.
 *
 * `String.prototype.replace` with a callback has no static lowering.
 */
function replaceDirectives(
  format: string,
  replacements: Map<string, string>,
): string {
  let out = "";
  let i = 0;
  while (i < format.length) {
    const ch = format.charAt(i);
    if (ch === "%" && i + 1 < format.length) {
      const directive = "%" + format.charAt(i + 1);
      const mapped = replacements.get(directive);
      if (mapped !== undefined) {
        out += mapped;
        i += 2;
        continue;
      }
    }
    out += ch;
    i++;
  }
  return out;
}
