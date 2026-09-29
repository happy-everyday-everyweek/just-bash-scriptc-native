/* scriptc shape probe (dev only, delete after) — 14 specimen shapes */

interface KnownBad {
  m?: Map<string, string>;
}
export function probeKnownBad(x: KnownBad): number {
  return x.m ? x.m.size : 0;
}

interface ReqMap {
  m: Map<string, string>;
}
export function probeReqMap(x: ReqMap): number {
  return x.m.size;
}

interface ReqSet {
  s: Set<string>;
}
export function probeReqSet(x: ReqSet): number {
  return x.s.size;
}

interface Rec {
  kind: string;
  elements: Map<string, string>;
}
interface MapRec {
  m: Map<string, Rec>;
}
export function probeMapRec(x: MapRec): number {
  return x.m.size;
}

interface MapSet {
  m: Map<number, Set<number>>;
}
export function probeMapSet(x: MapSet): number {
  return x.m.size;
}

interface MapVU {
  m: Map<string, string | undefined>;
}
export function probeMapVU(x: MapVU): number {
  return x.m.size;
}

interface MapArrRec {
  m: Map<string, Array<{ value: string | undefined; scopeIndex: number }>>;
}
export function probeMapArrRec(x: MapArrRec): number {
  return x.m.size;
}

interface ArrMap {
  a: Map<string, string>[];
}
export function probeArrMap(x: ArrMap): number {
  return x.a.length;
}

interface ArrSet {
  a: Set<string>[];
}
export function probeArrSet(x: ArrSet): number {
  return x.a.length;
}

interface ArrRec {
  a: Rec[];
}
export function probeArrRec(x: ArrRec): number {
  return x.a.length;
}

interface Sig {
  s?: AbortSignal;
}
export function probeSig(x: Sig): boolean {
  return x.s !== undefined;
}

interface NullNum {
  n: number | null;
}
export function probeNullNum(x: NullNum): number {
  return x.n ?? 0;
}

interface RecU {
  r?: Rec;
}
export function probeRecU(x: RecU): number {
  return x.r ? x.r.kind.length : 0;
}

export function probeBuild(): ReqMap {
  return { m: new Map() };
}
