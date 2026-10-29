/**
 * Who is on screen, as a bank sees an end user: the public address the request
 * came from and the browser's User-Agent. A bank fetch that carries both is the
 * person's own (PSD2 RTS Art. 36(5)(a)) and does not use one of the four
 * unattended fetches a connection gets a day.
 *
 * The address is the first entry of X-Forwarded-For: the published site's edge
 * (Portle) sets it, and Connect's proxy passes it on. A request with no such
 * header, or one from a private or loopback address (Vetra on localhost, the
 * LAN), names no address: a bank refuses those, and they are not where the
 * person is on the internet.
 */
import type { IncomingHttpHeaders } from "node:http";

export interface OnScreen {
  ipAddress: string;
  userAgent: string;
}

const first = (value: string | string[] | undefined): string | undefined =>
  (Array.isArray(value) ? value[0] : value)?.split(",")[0]?.trim() || undefined;

/** A loopback, private, link-local or shared (CGNAT) address. */
export function isPrivateAddress(ip: string): boolean {
  const v4 = /^(?:::ffff:)?(\d+)\.(\d+)\.(\d+)\.(\d+)$/i.exec(ip);
  if (v4) {
    const [a, b] = [Number(v4[1]), Number(v4[2])];
    return (
      a === 10 ||
      a === 127 ||
      a === 0 ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 169 && b === 254) ||
      (a === 100 && b >= 64 && b <= 127)
    );
  }
  const v6 = ip.toLowerCase();
  return v6 === "::1" || v6 === "::" || /^f[cd]/.test(v6) || /^fe[89ab]/.test(v6);
}

/** The person on screen, or null when the request names no public address. */
export function onScreenOf(headers: IncomingHttpHeaders): OnScreen | null {
  const ipAddress = first(headers["x-forwarded-for"]);
  const userAgent = first(headers["user-agent"]);
  if (!ipAddress || !userAgent || isPrivateAddress(ipAddress)) return null;
  return { ipAddress, userAgent };
}
