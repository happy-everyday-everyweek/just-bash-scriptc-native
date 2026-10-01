import { hexFromBytes } from "../utils/radix.js";
import { parseIntRadix } from "../utils/num-parse.js";
/**
 * Shared utilities for filesystem implementations
 */

import type {
  BufferEncoding,
  ReadFileOptions,
  WriteFileOptions,
} from "./interface.js";

export type FileContent = string | Uint8Array;

// Text encoder/decoder for encoding conversions
const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

/**
 * Helper to convert content to Uint8Array
 */
export function toBuffer(
  content: FileContent,
  encoding?: BufferEncoding,
): Uint8Array {
  if (content instanceof Uint8Array) {
    return content;
  }

  if (encoding === "base64") {
    return Uint8Array.from(atob(content), (c) => c.charCodeAt(0));
  }
  if (encoding === "hex") {
    const bytes = new Uint8Array(content.length / 2);
    for (let i = 0; i < content.length; i += 2) {
      bytes[i / 2] = parseIntRadix(content.slice(i, i + 2), 16);
    }
    return bytes;
  }
  if (encoding === "binary" || encoding === "latin1") {
    // Use chunked approach for large strings to avoid performance issues
    const chunkSize = 65536; // 64KB chunks
    if (content.length <= chunkSize) {
      return Uint8Array.from(content, (c) => c.charCodeAt(0));
    }
    const result = new Uint8Array(content.length);
    for (let i = 0; i < content.length; i++) {
      result[i] = content.charCodeAt(i);
    }
    return result;
  }
  // Default to UTF-8 for text content
  return textEncoder.encode(content);
}

/**
 * Helper to convert Uint8Array to string with encoding
 */
export function fromBuffer(
  buffer: Uint8Array,
  encoding?: BufferEncoding | null,
): string {
  if (encoding === "base64") {
    // Use chunked String.fromCharCode to avoid RangeError on large buffers.
    // The spread operator (...buffer) creates one argument per byte and crashes
    // on buffers larger than ~100KB due to call stack limits.
    if (typeof Buffer !== "undefined") {
      return Buffer.from(buffer).toString("base64");
    }
    const chunkSize = 65536;
    let binary = "";
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.subarray(i, i + chunkSize);
      binary += String.fromCharCode(...chunk);
    }
    return btoa(binary);
  }
  if (encoding === "hex") {
    return hexFromBytes(buffer);
  }
  if (encoding === "binary" || encoding === "latin1") {
    // Use Buffer if available (Node.js) - much more efficient and avoids spread operator limits
    if (typeof Buffer !== "undefined") {
      return Buffer.from(buffer).toString(encoding);
    }

    // Browser fallback - String.fromCharCode(...buffer) fails with buffers > ~100KB
    const chunkSize = 65536; // 64KB chunks
    if (buffer.length <= chunkSize) {
      return String.fromCharCode(...buffer);
    }
    let result = "";
    for (let i = 0; i < buffer.length; i += chunkSize) {
      const chunk = buffer.subarray(i, i + chunkSize);
      result += String.fromCharCode(...chunk);
    }
    return result;
  }
  // Default to UTF-8 for text content
  return decodeUtf8Bytes(buffer);
}

/**
 * Helper to get encoding from options
 */
export function getEncoding(
  options?: ReadFileOptions | WriteFileOptions | BufferEncoding | string | null,
): BufferEncoding | undefined {
  if (options === null || options === undefined) {
    return undefined;
  }
  if (typeof options === "string") {
    return options as BufferEncoding;
  }
  return options.encoding ?? undefined;
}

/**
 * Decode UTF-8 bytes by hand (`TextDecoder.decode` has no scriptc lowering).
 * Invalid sequences are replaced with U+FFFD, matching the forgiving decoder.
 */
function decodeUtf8Bytes(buffer: Uint8Array): string {
  let out = "";
  let i = 0;
  while (i < buffer.length) {
    const b0 = buffer[i];
    if (b0 < 0x80) {
      out += String.fromCharCode(b0);
      i += 1;
    } else if (b0 < 0xc0) {
      out += "\uFFFD";
      i += 1;
    } else if (b0 < 0xe0) {
      if (i + 1 >= buffer.length) {
        out += "\uFFFD";
        i += 1;
      } else {
        const cp = ((b0 & 0x1f) << 6) | (buffer[i + 1] & 0x3f);
        out += String.fromCodePoint(cp);
        i += 2;
      }
    } else if (b0 < 0xf0) {
      if (i + 2 >= buffer.length) {
        out += "\uFFFD";
        i += 1;
      } else {
        const cp =
          ((b0 & 0x0f) << 12) |
          ((buffer[i + 1] & 0x3f) << 6) |
          (buffer[i + 2] & 0x3f);
        out += String.fromCodePoint(cp);
        i += 3;
      }
    } else {
      if (i + 3 >= buffer.length) {
        out += "\uFFFD";
        i += 1;
      } else {
        const cp =
          ((b0 & 0x07) << 18) |
          ((buffer[i + 1] & 0x3f) << 12) |
          ((buffer[i + 2] & 0x3f) << 6) |
          (buffer[i + 3] & 0x3f);
        out += String.fromCodePoint(cp);
        i += 4;
      }
    }
  }
  return out;
}
