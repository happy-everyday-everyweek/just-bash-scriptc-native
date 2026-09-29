/* scriptc probe 004: InterpreterState after P2 (dev only, delete after) */
import type { InterpreterContext, InterpreterState } from "../interpreter/types.js";

function eat(s: InterpreterState): number {
  return (
    s.commandCount +
    s.arrays.size +
    s.fileDescriptors.size +
    s.inputFds.size +
    s.fdAliases.size +
    s.localScopes.length +
    s.readonlyVars.size +
    s.localVarStack.size +
    s.completionSpecs.size
  );
}
export function probeState(ctx: InterpreterContext): number {
  let total = eat(ctx.state) + ctx.state.exportedVars.size;
  const teb = ctx.state.tempEnvBindings;
  if (teb) {
    total += teb.length;
  }
  return total;
}