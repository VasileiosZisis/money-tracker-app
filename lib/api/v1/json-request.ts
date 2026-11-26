import "server-only";

import type { ApiErrorCode } from "./http";

const maxJsonBytes = 16 * 1024;
const jsonContentType = /^application\/json(?:[ \t]*;[ \t]*charset[ \t]*=[ \t]*(?:utf-8|"utf-8"))?$/i;
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true });

type JsonRequestResult =
  | { ok: true; value: Record<string, unknown> }
  | { ok: false; code: Extract<ApiErrorCode, "INVALID_REQUEST" | "REQUEST_TOO_LARGE" | "UNSUPPORTED_MEDIA_TYPE"> };

function hasDuplicateRootMembers(text: string): boolean {
  // The JSON has already parsed successfully. Skip strings as a unit and decode
  // key spellings so an escaped key cannot hide a duplicate at the root.
  const keys = new Set<string>();
  const tokens = /"(?:[^"\\]|\\.)*"|[[\]{}]/g;
  let depth = 0;
  for (let match = tokens.exec(text); match; match = tokens.exec(text)) {
    const [token] = match;
    if (token === "{" || token === "[") depth++;
    else if (token === "}" || token === "]") depth--;
    else if (depth === 1) {
      let next = match.index + token.length;
      while (/[ \t\r\n]/.test(text.charAt(next))) next++;
      if (text.charAt(next) !== ":") continue;

      const key: string = JSON.parse(token);
      if (keys.has(key)) return true;
      keys.add(key);
    }
  }
  return false;
}

export async function parseApiJsonObject(request: Request): Promise<JsonRequestResult> {
  const type = request.headers.get("content-type");
  const encoding = request.headers.get("content-encoding");
  if (!type || !jsonContentType.test(type) || (encoding !== null && encoding.toLowerCase() !== "identity")) {
    return { ok: false, code: "UNSUPPORTED_MEDIA_TYPE" };
  }

  const declaredLength = request.headers.get("content-length");
  if (declaredLength !== null && !/^[0-9]+$/.test(declaredLength)) {
    return { ok: false, code: "INVALID_REQUEST" };
  }
  const expectedBytes = declaredLength === null ? null : Number(declaredLength);
  if (expectedBytes !== null && expectedBytes > maxJsonBytes) return { ok: false, code: "REQUEST_TOO_LARGE" };
  if (!request.body || request.bodyUsed || request.body.locked) return { ok: false, code: "INVALID_REQUEST" };

  const bytes = new Uint8Array(maxJsonBytes);
  let length = 0;
  const reader = request.body.getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      if (length + value.byteLength > maxJsonBytes) {
        // A stream can delay its cancel hook. Return the rejection without waiting on it.
        void reader.cancel().catch(() => {});
        return { ok: false, code: "REQUEST_TOO_LARGE" };
      }
      bytes.set(value, length);
      length += value.byteLength;
    }

    if (expectedBytes !== null && expectedBytes !== length) return { ok: false, code: "INVALID_REQUEST" };
    const text = utf8.decode(bytes.subarray(0, length));
    const value: unknown = JSON.parse(text);
    if (value === null || typeof value !== "object" || Array.isArray(value) || hasDuplicateRootMembers(text)) {
      return { ok: false, code: "INVALID_REQUEST" };
    }
    return { ok: true, value: value as Record<string, unknown> };
  } catch {
    return { ok: false, code: "INVALID_REQUEST" };
  } finally {
    reader.releaseLock();
  }
}
