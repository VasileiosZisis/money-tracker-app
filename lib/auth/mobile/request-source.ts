import "server-only";

import { isIP } from "node:net";

declare const trustedSourceBrand: unique symbol;
export type TrustedMobileRequestSource = { readonly [trustedSourceBrand]: true };

type MobileRequestSourceResult =
  | { status: "identified"; source: TrustedMobileRequestSource }
  | { status: "source_unavailable" };

const sourceGroups = new WeakMap<TrustedMobileRequestSource, string>();

function normalizeSource(address: string): string | null {
  if (address.length > 45 || address.includes("%")) return null;
  const version = isIP(address);
  if (version === 4) return `ipv4:${address}`;
  if (version !== 6) return null;

  // WHATWG normalization translates embedded dotted IPv4 to IPv6 words.
  const canonical = new URL(`http://[${address}]/`).hostname.slice(1, -1);
  const [left, right] = canonical.split("::");
  const parseWords = (part: string) => part ? part.split(":").map((word) => Number.parseInt(word, 16)) : [];
  const leading = parseWords(left);
  const trailing = right === undefined ? [] : parseWords(right);
  const words = [...leading, ...Array<number>(8 - leading.length - trailing.length).fill(0), ...trailing];

  if (words.slice(0, 5).every((word) => word === 0) && words[5] === 0xffff) {
    return `ipv4:${words[6] >>> 8}.${words[6] & 255}.${words[7] >>> 8}.${words[7] & 255}`;
  }
  return `ipv6/64:${words.slice(0, 4).map((word) => word.toString(16)).join(":")}`;
}

export function identifyMobileRequestSource(headers: Pick<Headers, "get">): MobileRequestSourceResult {
  const environment = process.env.VERCEL_ENV;
  if (process.env.VERCEL !== "1" || (environment !== "production" && environment !== "preview")) {
    return { status: "source_unavailable" };
  }

  // Trust this header only for requests that passed through the documented Vercel ingress.
  const address = headers.get("x-vercel-forwarded-for");
  const group = address === null ? null : normalizeSource(address);
  if (group === null) return { status: "source_unavailable" };

  const source = Object.freeze({}) as TrustedMobileRequestSource;
  sourceGroups.set(source, group);
  return { status: "identified", source };
}

export function readTrustedMobileSourceGroup(source: TrustedMobileRequestSource): string | undefined {
  return sourceGroups.get(source);
}
