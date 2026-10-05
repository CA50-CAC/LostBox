import { describe, expect, it } from "vitest";
import { encode } from "uqr";
import { joinLink, qrRuns, qrSvg } from "./qr";

describe("joinLink", () => {
  it("points at the home page with the code filled in", () => {
    expect(joinLink("https://lostbox.example.org", "ABCD2345")).toBe("https://lostbox.example.org/?code=ABCD2345");
    expect(joinLink("https://lostbox.example.org/", "ABCD2345")).toBe("https://lostbox.example.org/?code=ABCD2345");
  });
});

describe("qrSvg", () => {
  const link = joinLink("https://lostbox.example.org", "ABCD2345");

  it("draws exactly the squares the encoder produced", () => {
    const { size, runs } = qrRuns(link);
    const drawn = Array.from({ length: size }, () => Array<boolean>(size).fill(false));
    for (const [x, y, w] of runs) for (let i = 0; i < w; i++) drawn[y][x + i] = true;
    expect(drawn).toEqual(encode(link, { ecc: "M", border: 0 }).data);
  });

  it("is black on white with a 4-square quiet zone, and labelled", () => {
    const { size } = qrRuns(link);
    const svg = qrSvg(link, "QR code for Demo & Co");
    expect(svg).toContain(`viewBox="0 0 ${size + 8} ${size + 8}"`);
    expect(svg).toContain('fill="#fff"');
    expect(svg).toContain('fill="#000"');
    expect(svg).toContain("<title>QR code for Demo &amp; Co</title>");
    expect(svg).toContain('role="img"');
  });

  it("is deterministic, and a new join code gives a different picture", () => {
    expect(qrSvg(link, "x")).toBe(qrSvg(link, "x"));
    expect(qrSvg(joinLink("https://lostbox.example.org", "WXYZ6789"), "x")).not.toBe(qrSvg(link, "x"));
  });

  it("can't be used to inject markup through the label", () => {
    expect(qrSvg(link, '"><script>alert(1)</script>')).not.toContain("<script>");
  });
});
