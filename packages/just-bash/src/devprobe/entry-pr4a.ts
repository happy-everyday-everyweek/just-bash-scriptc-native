/* probe entry: run regex4a candidate checks (dev only, delete after) */
import {
  callSpread,
  passTest,
  scanNamed,
  UserRegexA,
  UserRegexB,
} from "./probe-regex4a.js";

function main(): void {
  let pass = 0;
  let fail = 0;

  // T1: matchAll (self-built rows) + row index/length/[1]
  const re1 = new UserRegexA("(o+)", "g");
  let n1 = 0;
  let lastIdx = -1;
  let lastLen = 0;
  let lastG1 = "";
  for (const m of re1.matchAll("foobooo")) {
    n1++;
    lastIdx = m.index ?? -1;
    lastLen = m.length;
    const g = m[1];
    lastG1 = g === undefined ? "" : g;
  }
  if (n1 === 2 && lastIdx === 4 && lastLen === 2 && lastG1 === "ooo") {
    pass++;
  } else {
    fail++;
    console.log("T1-FAIL n1=" + n1 + " idx=" + lastIdx + " len=" + lastLen + " g1=" + lastG1);
  }

  // T2: named groups via manual dict
  const re2 = new UserRegexA("(?<year>\\d{4})-(?<month>\\d{2})", "");
  let img = -1;
  let full2 = "";
  let yVal = "";
  let moVal = "";
  for (const m of re2.matchAll("x2024-01y")) {
    img = m.index ?? -1;
    full2 = m[0];
    const gs = m.groups;
    if (gs !== undefined) {
      const yv = gs["year"];
      const mv = gs["month"];
      yVal = yv === undefined ? "" : yv;
      moVal = mv === undefined ? "" : mv;
    }
  }
  if (img === 1 && full2 === "2024-01" && yVal === "2024" && moVal === "01") {
    pass++;
  } else {
    fail++;
    console.log("T2-FAIL idx=" + img + " full=" + full2 + " y=" + yVal + " mo=" + moVal);
  }

  // T3: pass-through read after transfer
  const re3 = new RegExp("(\\d+)", "g");
  const r3 = passTest(re3, "ab123cd");
  if (r3 === "123:2:2") {
    pass++;
  } else {
    fail++;
    console.log("T3-FAIL got=" + r3);
  }

  // T4: spread call
  const r4 = callSpread((head, ...rest) => head + ":" + ("" + rest.length) + ":" + ("" + rest[1]));
  if (r4 === "head:3:1") {
    pass++;
  } else {
    fail++;
    console.log("T4-FAIL got=" + r4);
  }

  // T5: execFrom filter
  const re5 = new UserRegexA("o", "g");
  const e1 = re5.execFrom("foobar", 0);
  const e2 = re5.execFrom("foobar", 2);
  const e3 = re5.execFrom("foobar", 99);
  if (e1 === 1 && e2 === 2 && e3 === -1) {
    pass++;
  } else {
    fail++;
    console.log("T5-FAIL e1=" + e1 + " e2=" + e2 + " e3=" + e3);
  }

  // T6: scanNamed sanity
  const sn = scanNamed("((a)(?<x>b))\\\\(?<z>\\d+)\\[");
  const snx = sn.dict["x"] ?? -1;
  const snz = sn.dict["z"] ?? -1;
  if (sn.names.length === 2) {
    pass++;
    console.log("T6-INFO x=" + snx + " z=" + snz);
  } else {
    fail++;
    console.log("T6-FAIL x=" + snx + " z=" + snz + " names=" + sn.names.length);
  }

  // T7: raw passthrough rows via non-matchAll name
  const re7 = new UserRegexA("(\\d)", "g");
  let n7 = 0;
  for (const m of re7.matchAllX("a1b2")) {
    const ix7 = m.index ?? -1;
    n7 += ix7 >= 0 ? 1 : 0;
  }
  if (n7 === 2) {
    pass++;
  } else {
    fail++;
    console.log("T7-FAIL n7=" + n7);
  }

  // T8: passthrough matchAll class (B)
  const re8 = new UserRegexB("(\\d+)", "g");
  let n8 = 0;
  let lastIx8 = -1;
  let g08 = "";
  for (const m of re8.matchAll("a1b22")) {
    n8++;
    lastIx8 = m.index ?? -1;
    g08 = m[0];
  }
  if (n8 === 2 && lastIx8 === 3 && g08 === "22") {
    pass++;
  } else {
    fail++;
    console.log("T8-FAIL n8=" + n8 + " ix=" + lastIx8 + " g0=" + g08);
  }

  console.log("PASS=" + pass + " FAIL=" + fail);
}
void main();