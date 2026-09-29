/* probe entry: run regex2 checks (dev only, delete after) */
import {
  collectViaForOf,
  getOrBuild,
  getOrBuildKeys,
  REx,
} from "./probe-regex2.js";

function main(): void {
  const a = getOrBuild("foo", "i");
  const b = getOrBuild("foo", "i");
  const shared = a === b ? 1 : 0;
  const k1 = getOrBuildKeys("bar", "");
  const k2 = getOrBuildKeys("bar", "");
  const shared2 = k1 === k2 ? 1 : 0;
  const re = new REx("(o+)", "g");
  const n1 = re.execCount("foobooo");
  const re2 = new REx("(?<year>\\d{4})-(?<month>\\d{2})", "");
  const y = re2.groupProbe("2024-01");
  const y2 = re2.copyGroups("2024-01");
  const re3 = new REx("o", "g");
  const n3 = re3.matchAllVia("foo o o");
  const n4 = collectViaForOf("foobooo");
  console.log(
    "SHARED=" +
      shared +
      " SHARED2=" +
      shared2 +
      " N1=" +
      n1 +
      " Y=" +
      y +
      " Y2=" +
      y2 +
      " N3=" +
      n3 +
      " N4=" +
      n4,
  );
}
void main();
