/**
 * Numeric parsing helpers with hand-rolled, lowering-friendly implementations.
 *
 * scriptc cannot lower parseInt / parseFloat / Number.* (stdlib gaps), so the
 * port uses these. Behavior matches the decimal forms used across the shell:
 * optional leading whitespace and sign, then the longest numeric prefix.
 */

function isWhitespaceCode(c: number): boolean {
  return (
    c === 32 || c === 9 || c === 10 || c === 13 || c === 12 || c === 11
  );
}

/** Decimal integer parse; Number.parseInt(text, 10) semantics. */
export function parseIntDecimal(text: string): number {
  let i = 0;
  const len = text.length;
  while (i < len && isWhitespaceCode(text.charCodeAt(i))) i++;
  let sign = 1;
  if (i < len) {
    const c = text.charCodeAt(i);
    if (c === 45) {
      sign = -1;
      i++;
    } else if (c === 43) {
      i++;
    }
  }
  let value = 0;
  let any = false;
  while (i < len) {
    const c = text.charCodeAt(i);
    if (c < 48 || c > 57) break;
    value = value * 10 + (c - 48);
    any = true;
    i++;
  }
  if (!any) return Number.NaN;
  return sign * value;
}

/** Decimal float parse; parseFloat(text) semantics (leading-number prefix). */
export function parseFloatDecimal(text: string): number {
  let i = 0;
  const len = text.length;
  while (i < len && isWhitespaceCode(text.charCodeAt(i))) i++;
  let sign = 1;
  if (i < len) {
    const c = text.charCodeAt(i);
    if (c === 45) {
      sign = -1;
      i++;
    } else if (c === 43) {
      i++;
    }
  }
  let intPart = 0;
  let intDigits = 0;
  while (i < len) {
    const c = text.charCodeAt(i);
    if (c < 48 || c > 57) break;
    intPart = intPart * 10 + (c - 48);
    intDigits++;
    i++;
  }
  let fracPart = 0;
  let fracDigits = 0;
  if (i < len && text.charCodeAt(i) === 46) {
    i++;
    while (i < len) {
      const c = text.charCodeAt(i);
      if (c < 48 || c > 57) break;
      fracPart = fracPart * 10 + (c - 48);
      fracDigits++;
      i++;
    }
  }
  if (intDigits === 0 && fracDigits === 0) return Number.NaN;
  let value = intPart;
  let scale = 1;
  for (let k = 0; k < fracDigits; k++) scale = scale * 10;
  value = value + fracPart / scale;
  if (i < len) {
    const e = text.charCodeAt(i);
    if (e === 101 || e === 69) {
      let j = i + 1;
      let esign = 1;
      if (j < len) {
        const c2 = text.charCodeAt(j);
        if (c2 === 45) {
          esign = -1;
          j++;
        } else if (c2 === 43) {
          j++;
        }
      }
      let exp = 0;
      let expAny = false;
      while (j < len) {
        const c2 = text.charCodeAt(j);
        if (c2 < 48 || c2 > 57) break;
        exp = exp * 10 + (c2 - 48);
        expAny = true;
        j++;
      }
      if (expAny) {
        let factor = 1;
        for (let k = 0; k < exp; k++) factor = factor * 10;
        if (esign === 1) value = value * factor;
        else value = value / factor;
      }
    }
  }
  return sign * value;
}

function digitValue(c: number): number {
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 97 && c <= 122) return c - 97 + 10;
  if (c >= 65 && c <= 90) return c - 65 + 10;
  return -1;
}

/** Integer parse for an explicit radix (2-36); Number.parseInt(text, radix). */
export function parseIntRadix(text: string, radix: number): number {
  let i = 0;
  const len = text.length;
  while (i < len && isWhitespaceCode(text.charCodeAt(i))) i++;
  let sign = 1;
  if (i < len) {
    const c = text.charCodeAt(i);
    if (c === 45) {
      sign = -1;
      i++;
    } else if (c === 43) {
      i++;
    }
  }
  if (
    radix === 16 &&
    i + 1 < len &&
    text.charCodeAt(i) === 48 &&
    (text.charCodeAt(i + 1) === 120 || text.charCodeAt(i + 1) === 88)
  ) {
    i += 2;
  }
  let value = 0;
  let any = false;
  while (i < len) {
    const d = digitValue(text.charCodeAt(i));
    if (d < 0 || d >= radix) break;
    value = value * radix + d;
    any = true;
    i++;
  }
  if (!any) return Number.NaN;
  return sign * value;
}

const RADIX_DIGITS = "0123456789abcdefghijklmnopqrstuvwxyz";

/** Non-negative integer value to its base-n string (2-36). */
export function uintToStringBase(value: number, radix: number): string {
  if (value <= 0) return "0";
  let v = value;
  let out = "";
  while (v > 0) {
    const d = Math.floor(v % radix);
    out = RADIX_DIGITS.slice(d, d + 1) + out;
    v = Math.floor(v / radix);
  }
  return out;
}

/** Signed integer to base-n string (2-36). */
export function intToStringBase(value: number, radix: number): string {
  if (value < 0) return "-" + uintToStringBase(-value, radix);
  return uintToStringBase(value, radix);
}