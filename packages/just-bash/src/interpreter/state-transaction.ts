import { copyMap, copySet } from "../utils/bytes.js";
import { cloneArrays } from "./helpers/array.js";
import type { CompletionSpec, InterpreterState, ShellArray } from "./types.js";

function cloneCompletionSpec(
  spec: CompletionSpec | undefined,
): CompletionSpec | undefined {
  return spec
    ? {
        ...spec,
        options: spec.options ? [...spec.options] : undefined,
        actions: spec.actions ? [...spec.actions] : undefined,
      }
    : undefined;
}

function cloneCompletionSpecs(
  specs: Map<string, CompletionSpec>,
): Map<string, CompletionSpec> {
  const cloned = new Map<string, CompletionSpec>();
  for (const [name, spec] of specs) {
    const copy = cloneCompletionSpec(spec);
    if (copy) cloned.set(name, copy);
  }
  return cloned;
}

/**
 * Copy the fd alias groups, preserving the sharing structure: descriptors
 * that shared one Set in the original must share one Set in the copy, or the
 * subshell's reads would only move some of the aliases.
 */
function cloneFdAliases(
  aliases: Map<number, number[]>,
): Map<number, number[]> {
  // Group identity in the copy must mirror the original sharing: assign each
  // distinct group (by shared first-seen member) one shared array copy.
  const groupIndexByFd = new Map<number, number>();
  let groupCount = 0;
  for (const [fd, group] of aliases) {
    let idx = -1;
    for (const member of group) {
      const found = groupIndexByFd.get(member);
      if (found !== undefined) {
        idx = found;
        break;
      }
    }
    if (idx === -1) {
      idx = groupCount;
      groupCount += 1;
    }
    groupIndexByFd.set(fd, idx);
  }
  const copyByIndex = new Map<number, number[]>();
  const cloned = new Map<number, number[]>();
  for (const [fd, group] of aliases) {
    const idx = groupIndexByFd.get(fd) ?? 0;
    let copy = copyByIndex.get(idx);
    if (!copy) {
      copy = [];
      for (const member of group) copy.push(member);
      copyByIndex.set(idx, copy);
    }
    cloned.set(fd, copy);
  }
  return cloned;
}

function cloneLocalArrayScopes(
  scopes: Array<{ cells: Map<string, ShellArray | undefined> }> | undefined,
): Array<{ cells: Map<string, ShellArray | undefined> }> | undefined {
  if (!scopes) return undefined;
  return scopes.map((scope) => {
    const cells = new Map<string, ShellArray | undefined>();
    for (const [name, array] of scope.cells) {
      cells.set(
        name,
        array
          ? { kind: array.kind, elements: copyMap(array.elements) }
          : undefined,
      );
    }
    return { cells };
  });
}

function cloneLocalVarStack(
  stack: Map<string, Array<{ value: string | undefined; scopeIndex: number }>>,
): Map<string, Array<{ value: string | undefined; scopeIndex: number }>> {
  const cloned = new Map<
    string,
    Array<{ value: string | undefined; scopeIndex: number }>
  >();
  for (const [name, entries] of stack) {
    const copiedEntries: Array<{
      value: string | undefined;
      scopeIndex: number;
    }> = [];
    for (const entry of entries) {
      copiedEntries.push({ value: entry.value, scopeIndex: entry.scopeIndex });
    }
    cloned.set(name, copiedEntries);
  }
  return cloned;
}

/**
 * Install an isolated copy of mutable shell namespace state and return an
 * idempotent rollback. Process-wide accounting and PID allocation deliberately
 * remain shared with the parent execution.
 */
export function beginIsolatedShellState(state: InterpreterState): () => void {
  const saved = {
    env: state.env,
    arrays: state.arrays,
    cwd: state.cwd,
    previousDir: state.previousDir,
    lastExitCode: state.lastExitCode,
    lastArg: state.lastArg,
    currentLine: state.currentLine,
    options: state.options,
    shoptOptions: state.shoptOptions,
    fileDescriptors: state.fileDescriptors,
    inputFds: state.inputFds,
    fdAliases: state.fdAliases,
    closedStandardFds: state.closedStandardFds,
    nextFd: state.nextFd,
    readonlyVars: state.readonlyVars,
    associativeArrays: state.associativeArrays,
    namerefs: state.namerefs,
    boundNamerefs: state.boundNamerefs,
    invalidNamerefs: state.invalidNamerefs,
    integerVars: state.integerVars,
    lowercaseVars: state.lowercaseVars,
    uppercaseVars: state.uppercaseVars,
    exportedVars: state.exportedVars,
    tempExportedVars: state.tempExportedVars,
    localExportedVars: state.localExportedVars,
    declaredVars: state.declaredVars,
    localScopes: state.localScopes,
    localArrayScopes: state.localArrayScopes,
    localVarDepth: state.localVarDepth,
    localVarStack: state.localVarStack,
    fullyUnsetLocals: state.fullyUnsetLocals,
    tempEnvBindings: state.tempEnvBindings,
    mutatedTempEnvVars: state.mutatedTempEnvVars,
    accessedTempEnvVars: state.accessedTempEnvVars,
    functions: state.functions,
    callDepth: state.callDepth,
    sourceDepth: state.sourceDepth,
    callLineStack: state.callLineStack,
    funcNameStack: state.funcNameStack,
    sourceStack: state.sourceStack,
    currentSource: state.currentSource,
    inCondition: state.inCondition,
    loopDepth: state.loopDepth,
    parentHasLoopContext: state.parentHasLoopContext,
    errexitSafe: state.errexitSafe,
    directoryStack: state.directoryStack,
    hashTable: state.hashTable,
    completionSpecs: state.completionSpecs,
    defaultCompletionSpec: state.defaultCompletionSpec,
    emptyCompletionSpec: state.emptyCompletionSpec,
    groupStdin: state.groupStdin,
    groupStdinSourceFd: state.groupStdinSourceFd,
    bashPid: state.bashPid,
    expansionExitCode: state.expansionExitCode,
    expansionStderr: state.expansionStderr,
  };

  state.env = copyMap(state.env);
  state.arrays = cloneArrays(state.arrays);
  state.options = { ...state.options };
  state.shoptOptions = { ...state.shoptOptions };
  state.fileDescriptors = copyMap(state.fileDescriptors);
  // Travels with the descriptor table it classifies.
  state.inputFds = copySet(state.inputFds);
  state.fdAliases = cloneFdAliases(state.fdAliases);
  state.closedStandardFds = copySet(state.closedStandardFds);
  state.readonlyVars = copySet(state.readonlyVars);
  state.associativeArrays = copySet(state.associativeArrays);
  state.namerefs = copySet(state.namerefs);
  state.boundNamerefs = copySet(state.boundNamerefs);
  state.invalidNamerefs = copySet(state.invalidNamerefs);
  state.integerVars = copySet(state.integerVars);
  state.lowercaseVars = copySet(state.lowercaseVars);
  state.uppercaseVars = copySet(state.uppercaseVars);
  state.exportedVars = copySet(state.exportedVars);
  state.tempExportedVars = copySet(state.tempExportedVars);
  state.localExportedVars = state.localExportedVars?.map((entry) => ({
    vars: copySet(entry.vars),
  }));
  state.declaredVars = copySet(state.declaredVars);
  state.localScopes = state.localScopes.map((scope) => ({
    cells: copyMap(scope.cells),
  }));
  state.localArrayScopes = cloneLocalArrayScopes(state.localArrayScopes);
  state.localVarDepth = copyMap(state.localVarDepth);
  state.localVarStack = cloneLocalVarStack(state.localVarStack);
  state.fullyUnsetLocals = copyMap(state.fullyUnsetLocals);
  state.tempEnvBindings = state.tempEnvBindings?.map((bindings) => ({
    cells: copyMap(bindings.cells),
  }));
  state.mutatedTempEnvVars = copySet(state.mutatedTempEnvVars);
  state.accessedTempEnvVars = copySet(state.accessedTempEnvVars);
  state.functions = copyMap(state.functions);
  state.callLineStack = state.callLineStack
    ? [...state.callLineStack]
    : undefined;
  state.funcNameStack = state.funcNameStack
    ? [...state.funcNameStack]
    : undefined;
  state.sourceStack = state.sourceStack ? [...state.sourceStack] : undefined;
  state.directoryStack = state.directoryStack
    ? [...state.directoryStack]
    : undefined;
  state.hashTable = copyMap(state.hashTable);
  state.completionSpecs = cloneCompletionSpecs(state.completionSpecs);
  state.defaultCompletionSpec = cloneCompletionSpec(
    state.defaultCompletionSpec,
  );
  state.emptyCompletionSpec = cloneCompletionSpec(state.emptyCompletionSpec);

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    state.env = saved.env;
    state.arrays = saved.arrays;
    state.cwd = saved.cwd;
    state.previousDir = saved.previousDir;
    state.lastExitCode = saved.lastExitCode;
    state.lastArg = saved.lastArg;
    state.currentLine = saved.currentLine;
    state.options = saved.options;
    state.shoptOptions = saved.shoptOptions;
    state.fileDescriptors = saved.fileDescriptors;
    state.inputFds = saved.inputFds;
    state.fdAliases = saved.fdAliases;
    state.closedStandardFds = saved.closedStandardFds;
    state.nextFd = saved.nextFd;
    state.readonlyVars = saved.readonlyVars;
    state.associativeArrays = saved.associativeArrays;
    state.namerefs = saved.namerefs;
    state.boundNamerefs = saved.boundNamerefs;
    state.invalidNamerefs = saved.invalidNamerefs;
    state.integerVars = saved.integerVars;
    state.lowercaseVars = saved.lowercaseVars;
    state.uppercaseVars = saved.uppercaseVars;
    state.exportedVars = saved.exportedVars;
    state.tempExportedVars = saved.tempExportedVars;
    state.localExportedVars = saved.localExportedVars;
    state.declaredVars = saved.declaredVars;
    state.localScopes = saved.localScopes;
    state.localArrayScopes = saved.localArrayScopes;
    state.localVarDepth = saved.localVarDepth;
    state.localVarStack = saved.localVarStack;
    state.fullyUnsetLocals = saved.fullyUnsetLocals;
    state.tempEnvBindings = saved.tempEnvBindings;
    state.mutatedTempEnvVars = saved.mutatedTempEnvVars;
    state.accessedTempEnvVars = saved.accessedTempEnvVars;
    state.functions = saved.functions;
    state.callDepth = saved.callDepth;
    state.sourceDepth = saved.sourceDepth;
    state.callLineStack = saved.callLineStack;
    state.funcNameStack = saved.funcNameStack;
    state.sourceStack = saved.sourceStack;
    state.currentSource = saved.currentSource;
    state.inCondition = saved.inCondition;
    state.loopDepth = saved.loopDepth;
    state.parentHasLoopContext = saved.parentHasLoopContext;
    state.errexitSafe = saved.errexitSafe;
    state.directoryStack = saved.directoryStack;
    state.hashTable = saved.hashTable;
    state.completionSpecs = saved.completionSpecs;
    state.defaultCompletionSpec = saved.defaultCompletionSpec;
    state.emptyCompletionSpec = saved.emptyCompletionSpec;
    state.groupStdin = saved.groupStdin;
    state.groupStdinSourceFd = saved.groupStdinSourceFd;
    state.bashPid = saved.bashPid;
    state.expansionExitCode = saved.expansionExitCode;
    state.expansionStderr = saved.expansionStderr;
  };
}
