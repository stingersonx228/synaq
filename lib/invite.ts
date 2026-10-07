// Server-only: builds the class join link and its QR code as an inline SVG string.
import QRCode from "qrcode";

export interface Invite {
  joinUrl: string;
  qrSvg: string;
}

/** Origin of the current request, e.g. "https://synaq-pi.vercel.app". */
export function requestOrigin(headers: Headers): string {
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function buildInvite(code: string, origin: string): Promise<Invite> {
  const joinUrl = `${origin}/?code=${encodeURIComponent(code)}#join`;
  // Dark modules on white: phone cameras read high-contrast codes fastest, also off a projector.
  const qrSvg = await QRCode.toString(joinUrl, {
    type: "svg",
    margin: 2,
    errorCorrectionLevel: "M",
    color: { dark: "#0b0d12", light: "#ffffff" },
  });
  return { joinUrl, qrSvg };
}
