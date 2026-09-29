/* probe entry: run regex4c checks (dev only, delete after) */
import { nfExec, NFExec, readGroups } from "./probe-regex4c.js";

function main(): void {
  let pass = 0;
  let fail = 0;

  const re1 = new RegExp("(o+)", "g");
  const r1 = nfExec(re1, "foobooo", 0);
  if (r1 !== null && r1[0] === "oo") {
    pass++;
  } else {
    fail++;
    console.log("C1-1=" + (r1 === null ? "null" : r1[0]));
  }
  const r2 = nfExec(re1, "foobooo", 3);
  if (r2 !== null && r2[0] === "ooo") {
    pass++;
  } else {
    fail++;
    console.log("C1-2=" + (r2 === null ? "null" : r2[0]));
  }

  const r3 = readGroups(new RegExp("(?<year>\\d{4})-(?<month>\\d{2})"), "x2024-01");
  if (r3 === "2024") {
    pass++;
  } else {
    fail++;
    console.log("C3=" + r3);
  }

  const fe = new NFExec("(o+)", "g");
  const e1 = fe.exec("foobooo");
  const l1 = fe.lastIndex;
  const e2 = fe.exec("foobooo");
  const l2 = fe.lastIndex;
  const g01 = e1 === null ? "" : e1[0];
  const g02 = e2 === null ? "" : e2[0];
  if (g01 === "oo" && l1 === 3 && g02 === "ooo" && l2 === 7) {
    pass++;
  } else {
    fail++;
    console.log("C10 g1=" + g01 + " l1=" + l1 + " g2=" + g02 + " l2=" + l2);
  }

  console.log("PASS=" + pass + " FAIL=" + fail);
}
void main();