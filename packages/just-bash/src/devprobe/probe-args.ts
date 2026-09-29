/* scriptc probe: parseArgs family (dev only, delete after) */
import { parseArgs } from "../utils/args.js";

const defs = {
  verbose: { short: "v", long: "verbose", type: "boolean" as const },
  count: { short: "n", long: "count", type: "number" as const, default: 10 },
  name: { short: "N", long: "name", type: "string" as const },
};

export function probeArgs(args: string[]): string {
  const r = parseArgs("cmd", args, defs);
  if (!r.ok) {
    return "ERR:" + r.error.exitCode;
  }
  const { flags } = r.result;
  let out = String(flags.count);
  if (flags.verbose) out += ":v";
  if (flags.name !== undefined) out += ":" + flags.name;
  out += ":" + r.result.positional.length;
  return out;
}