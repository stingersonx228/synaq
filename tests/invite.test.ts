import { describe, expect, it } from "vitest";
import { buildInvite, requestOrigin } from "../lib/invite";
import { codeFromParam } from "../lib/schemas";

describe("requestOrigin", () => {
  it("uses forwarded host and protocol on Vercel", () => {
    const h = new Headers({ "x-forwarded-host": "synaq-pi.vercel.app", "x-forwarded-proto": "https", host: "internal" });
    expect(requestOrigin(h)).toBe("https://synaq-pi.vercel.app");
  });
  it("falls back to host, with http for localhost", () => {
    expect(requestOrigin(new Headers({ host: "localhost:3000" }))).toBe("http://localhost:3000");
    expect(requestOrigin(new Headers({ host: "example.kz" }))).toBe("https://example.kz");
  });
});

describe("buildInvite", () => {
  it("links to the landing page with the code prefilled and renders a QR SVG", async () => {
    const { joinUrl, qrSvg } = await buildInvite("K7M2QX", "https://synaq-pi.vercel.app");
    expect(joinUrl).toBe("https://synaq-pi.vercel.app/?code=K7M2QX#join");
    expect(qrSvg.startsWith("<svg")).toBe(true);
    expect(qrSvg).toContain('viewBox="0 0');
    expect(qrSvg).not.toMatch(/<script/i);
  });
});

describe("codeFromParam", () => {
  it.each([
    ["K7M2QX", "K7M2QX"],
    [" k7m2qx ", "K7M2QX"],
    ["OOOOOO", ""],
    ["K7M2Q", ""],
    ["<script>", ""],
    [undefined, ""],
    [["K7M2QX"], ""],
  ])("%j → %j", (raw, expected) => {
    expect(codeFromParam(raw)).toBe(expected);
  });
});
