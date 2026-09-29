/* scriptc probe: numeric helpers (dev only, delete after) */
import {
  parseFloatDecimal,
  parseIntDecimal,
  parseIntRadix,
} from "../utils/num-parse.js";

export function probeNum(s: string): number {
  return parseIntDecimal(s) + parseFloatDecimal(s);
}

export function probeNum2(): number {
  return parseIntDecimal("  -42abc") + parseFloatDecimal("3.14e2xyz");
}

export function probeNum3(): number {
  return parseIntRadix("1F", 16) + parseIntRadix("777", 8) + parseIntRadix("0xA", 16);
}