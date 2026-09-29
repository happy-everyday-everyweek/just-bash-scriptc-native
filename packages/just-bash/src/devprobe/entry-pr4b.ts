/* probe entry: run regex4b attach/consumption checks (dev only, delete after) */
import {
  attachAssign,
  attachDefine,
  attachExecArray,
  attachFull,
  attachIntersect,
  attachNarrow,
  execIndexDirect,
  execIndexViaDict,
  matchIndexViaDict,
  RX,
} from "./probe-regex4b.js";

function main(): void {
  let pass = 0;
  let fail = 0;

  const a1 = attachAssign();
  if (a1 === "3") {
    pass++;
  } else {
    fail++;
    console.log("A1-ASSIGN=" + a1);
  }
  const a2 = attachDefine();
  if (a2 === "3") {
    pass++;
  } else {
    fail++;
    console.log("A2-DEFINE=" + a2);
  }
  const a3 = attachNarrow();
  if (a3 === "3") {
    pass++;
  } else {
    fail++;
    console.log("A3-NARROW=" + a3);
  }
  const a4 = attachFull();
  if (a4 === "3") {
    pass++;
  } else {
    fail++;
    console.log("A4-FULL=" + a4);
  }
  const a5 = attachExecArray();
  if (a5 === "3") {
    pass++;
  } else {
    fail++;
    console.log("A5-EXECARR=" + a5);
  }
  const a6 = attachIntersect();
  if (a6 === "3") {
    pass++;
  } else {
    fail++;
    console.log("A6-INTERSECT=" + a6);
  }

  const rx = new RX("(o+)", "g");
  const c1 = rx.useNative("foobooo");
  if (c1 === 4) {
    pass++;
  } else {
    fail++;
    console.log("B1-USE-NATIVE=" + c1);
  }
  const c2 = rx.useNativeInline("foobooo");
  if (c2 === 4) {
    pass++;
  } else {
    fail++;
    console.log("B2-USE-INLINE=" + c2);
  }

  const s1 = execIndexDirect(new RegExp("(\\d+)", "g"), "ab123");
  if (s1 === 2) {
    pass++;
  } else {
    fail++;
    console.log("B3-EXEC-DIRECT=" + s1);
  }
  const s2 = execIndexViaDict(new RegExp("(\\d+)", "g"), "ab123");
  if (s2 === 2) {
    pass++;
  } else {
    fail++;
    console.log("B4-EXEC-DICT=" + s2);
  }
  const s3 = matchIndexViaDict(new RegExp("(\\d+)", "g"), "ab123");
  if (s3 === 2) {
    pass++;
  } else {
    fail++;
    console.log("B5-MATCH-DICT=" + s3);
  }

  console.log("PASS=" + pass + " FAIL=" + fail);
}
void main();