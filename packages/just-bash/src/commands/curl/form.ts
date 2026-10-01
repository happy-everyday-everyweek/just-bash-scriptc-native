import { toHexLower } from "../../utils/radix.js";
/**
 * Form data handling for curl command
 */

import type { FormField } from "./types.js";

/** Uppercase hex pair -> lowercase (no `toLowerCase` on escapes). */
function lowerHexPair(pair: string): string {
  const lower = "0123456789abcdef";
  const upper = "0123456789ABCDEF";
  let out = "";
  for (let k = 0; k < pair.length; k++) {
    const idx = upper.indexOf(pair.charAt(k));
    out += idx >= 0 ? lower.charAt(idx) : pair.charAt(k);
  }
  return out;
}

/**
 * curl's --data-urlencode flavour of encodeURIComponent.
 *
 * Written as one scan: `String.prototype.replace` with a callback has no
 * static lowering, and the original chained three of them.
 */
export function encodeCurlData(value: string): string {
  const encoded = encodeURIComponent(value);
  let out = "";
  let i = 0;
  while (i < encoded.length) {
    const ch = encoded.charAt(i);
    if (ch === "!") {
      out += "%21";
      i++;
      continue;
    }
    if (ch === "'") {
      out += "%27";
      i++;
      continue;
    }
    if (ch === "(") {
      out += "%28";
      i++;
      continue;
    }
    if (ch === ")") {
      out += "%29";
      i++;
      continue;
    }
    if (ch === "*") {
      out += "%2a";
      i++;
      continue;
    }
    if (ch === "%" && i + 2 < encoded.length) {
      const pair = encoded.slice(i + 1, i + 3);
      out += pair === "20" ? "+" : "%" + lowerHexPair(pair);
      i += 3;
      continue;
    }
    out += ch;
    i++;
  }
  return out;
}

/**
 * URL-encode form data in curl's --data-urlencode format
 * Supports: name=content, =content, content. The `@file` / `name@file` forms
 * are detected in parseOptions and deferred to execute time (see resolveData).
 */
export function encodeFormData(input: string): string {
  // Check for name=value format
  const eqIndex = input.indexOf("=");
  if (eqIndex >= 0) {
    const name = input.slice(0, eqIndex);
    const value = input.slice(eqIndex + 1);
    const encoded = encodeCurlData(value);
    return name ? `${name}=${encoded}` : encoded;
  }
  // Plain value
  return encodeCurlData(input);
}

/**
 * Parse -F/--form field specification
 * Supports: name=value, name=@file, name=<file, name=value;type=mime
 */
export function parseFormField(spec: string): FormField | null {
  const eqIndex = spec.indexOf("=");
  if (eqIndex < 0) return null;

  const name = spec.slice(0, eqIndex);
  let value = spec.slice(eqIndex + 1);
  let filename: string | undefined;
  let contentType: string | undefined;

  // Check for ;type= suffix
  const typeMatch = value.match(/;type=([^;]+)$/);
  if (typeMatch) {
    contentType = typeMatch[1];
    value = value.slice(0, -typeMatch[0].length);
  }

  // Check for ;filename= suffix
  const filenameMatch = value.match(/;filename=([^;]+)/);
  if (filenameMatch) {
    filename = filenameMatch[1];
    value = value.replace(filenameMatch[0], "");
  }

  // @ means file upload, < means file content
  if (value.startsWith("@") || value.startsWith("<")) {
    filename = filename ?? value.slice(1).split("/").pop();
    // Value will be replaced with file content in execute
  }

  return { name, value, filename, contentType };
}

/**
 * Generate multipart form data body and boundary
 */
export function generateMultipartBody(
  fields: FormField[],
  fileContents: Map<string, string>,
): { body: string; boundary: string } {
  const boundary = `----CurlFormBoundary${String(Date.now())}`;
  const parts: string[] = [];

  for (const field of fields) {
    let value = field.value;

    // Replace file references with content
    if (value.startsWith("@") || value.startsWith("<")) {
      const filePath = value.slice(1);
      value = fileContents.get(filePath) ?? "";
    }

    let part = `--${boundary}\r\n`;
    if (field.filename) {
      part += `Content-Disposition: form-data; name="${field.name}"; filename="${field.filename}"\r\n`;
      if (field.contentType) {
        part += `Content-Type: ${field.contentType}\r\n`;
      }
    } else {
      part += `Content-Disposition: form-data; name="${field.name}"\r\n`;
    }
    part += `\r\n${value}\r\n`;
    parts.push(part);
  }

  parts.push(`--${boundary}--\r\n`);
  return { body: parts.join(""), boundary };
}
