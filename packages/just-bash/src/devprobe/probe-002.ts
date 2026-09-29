/* scriptc shape probe 002 (dev only, delete after) */

interface Rec {
  kind: string;
  elements: Map<string, string>;
}

interface SetOpt {
  s?: Set<string>;
}
export function probeSetOpt(x: SetOpt): number {
  return x.s ? x.s.size : 0;
}

interface ArrNumOpt {
  a?: number[];
}
export function probeArrNumOpt(x: ArrNumOpt): number {
  return x.a ? x.a.length : 0;
}

interface ArrRecOpt {
  a?: Rec[];
}
export function probeArrRecOpt(x: ArrRecOpt): number {
  return x.a ? x.a.length : 0;
}

interface MapNumArr {
  m: Map<number, number[]>;
}
export function probeMapNumArr(x: MapNumArr): number {
  return x.m.size;
}

interface WrapArr {
  a: Array<{ cells: Map<string, string | undefined> }>;
}
export function probeWrapArr(x: WrapArr): number {
  return x.a.length;
}

interface WrapSetArrOpt {
  a?: Array<{ cells: Set<string> }>;
}
export function probeWrapSetArrOpt(x: WrapSetArrOpt): number {
  return x.a ? x.a.length : 0;
}

interface MapNumRec {
  m: Map<number, { members: number[] }>;
}
export function probeMapNumRec(x: MapNumRec): number {
  return x.m.size;
}

class LocalThing {
  cells: Map<string, string> = new Map();
}
interface ClassArr {
  a: LocalThing[];
}
export function probeClassArr(x: ClassArr): number {
  return x.a.length;
}