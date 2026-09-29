/* scriptc probe 005: InterpreterContext member bisect (dev only, delete after) */
import type { InterpreterContext, InterpreterState } from "../interpreter/types.js";
import type { IFileSystem } from "../fs/interface.js";
import type { CommandRegistry } from "../types.js";
import type { ExecutionScope } from "../execution-scope.js";

interface M1 {
  state: InterpreterState;
}
export function p1(x: M1): number {
  return x.state.commandCount;
}

interface M2 {
  fs: IFileSystem;
}
export function p2(x: M2): number {
  return x.fs ? 1 : 0;
}

interface M3 {
  commands: CommandRegistry;
}
export function p3(x: M3): number {
  return x.commands.size;
}

interface M4 {
  executionScope: ExecutionScope;
}
export function p4(x: M4): number {
  return x.executionScope.outputBytesUsed;
}

interface M5 {
  state: InterpreterState;
  fs: IFileSystem;
}
export function p5(x: M5): number {
  return x.state.commandCount + (x.fs ? 1 : 0);
}

interface M6 {
  execFn: (script: string, options?: string, flag?: boolean) => Promise<number>;
}
export function p6(x: M6): number {
  x.execFn("a", "b", false);
  return 1;
}

export function pCtx(x: InterpreterContext): number {
  return x.state.commandCount;
}