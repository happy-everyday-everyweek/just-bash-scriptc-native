/* scriptc probe 003: RuntimeCommandContext chain (dev only, delete after) */
import type {
  Command,
  CommandRegistry,
  ResolvedCommandContext,
  RuntimeCommand,
  RuntimeCommandContext,
} from "../types.js";

function eatRcc(c: RuntimeCommandContext): number {
  return c.fileDescriptors.size;
}
function eatResolved(c: ResolvedCommandContext): number {
  return c.env.size;
}
function eatCmd(c: Command): number {
  return c.name.length;
}
function eatRc(r: RuntimeCommand): number {
  return r.internalOriginalCommand ? 1 : 0;
}
export function probeRccChain(
  c: RuntimeCommandContext,
  r: ResolvedCommandContext,
  cmd: Command,
  rc: RuntimeCommand,
  reg: CommandRegistry,
): number {
  return eatRcc(c) + eatResolved(r) + eatCmd(cmd) + eatRc(rc) + reg.size;
}
export function probeLoader(l: () => Promise<RuntimeCommand>): boolean {
  return l !== undefined;
}