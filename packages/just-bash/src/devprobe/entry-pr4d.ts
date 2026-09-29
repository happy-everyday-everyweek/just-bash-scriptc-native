/* probe entry: run regex4d checks (dev only, delete after) */
import {
  collectMatches,
  groupBuildProbe,
  hasUnsupportedAssertion,
  NFExec,
  pushNullCast,
  readGroupByIndex,
} from "./probe-regex4d.js";

function main(): void {
  let pass = 0;
  let fail = 0;

  const h1a = hasUnsupportedAssertion("(?=x)");
  const h1b = hasUnsupportedAssertion("a(?<=b)");
  const h1c = hasUnsupportedAssertion("(?:x)(y)");
  const h1d = hasUnsupportedAssertion("[(?=]");
  if (h1a === true && h1b === true && h1c === false && h1d === false) {
    pass++;
  } else {
    fail++;
    console.log(
      "H1 a=" + h1a + " b=" + h1b + " c=" + h1c + " d=" + h1d,
    );
  }

  const h2 = readGroupByIndex(
    new RegExp("(?<year>\\d{4})-(?<month>\\d{2})", "g"),
    "x2024-01",
  );
  if (h2 === "2024") {
    pass++;
  } else {
    fail++;
    console.log("H2=" + h2);
  }

  const h3 = groupBuildProbe(
    new RegExp("(?<year>\\d{4})-(?<month>\\d{2})", "g"),
    "x2024-01",
  );
  if (h3 === "2024") {
    pass++;
  } else {
    fail++;
    console.log("H3=" + h3);
  }

  const h4 = pushNullCast(new RegExp("a(b)?", "g"), "a");
  if (h4 === "null") {
    pass++;
  } else {
    fail++;
    console.log("H4=" + h4);
  }

  const h5 = collectMatches(new RegExp("o", "g"), "foobar");
  if (h5.length === 2 && h5[0] === "o" && h5[1] === "o") {
    pass++;
  } else {
    fail++;
    console.log("H5 len=" + h5.length);
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
    console.log("H6 g1=" + g01 + " l1=" + l1 + " g2=" + g02 + " l2=" + l2);
  }

  const t1 = fe.test("xyz");
  const l3 = fe.lastIndex;
  const s1 = fe.search("xxo");
  if (t1 === false && l3 === 0 && s1 === 2) {
    pass++;
  } else {
    fail++;
    console.log("H7 t1=" + t1 + " l3=" + l3 + " s1=" + s1);
  }

  console.log("PASS=" + pass + " FAIL=" + fail);
}
void main();