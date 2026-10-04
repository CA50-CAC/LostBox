/**
 * QR codes, drawn as SVG on the server. No external QR service: the join link
 * never leaves our server, and the code works offline and in print.
 *
 * `uqr` turns text into a grid of dark and light squares (with error
 * correction, so a scuffed poster still scans). We draw the grid ourselves as
 * one SVG path, black on white with a 4-square quiet zone (the margin scanners
 * need), so it prints sharply at any size.
 */
import { encode } from "uqr";

/** The link students scan: the home page with the code filled in. */
export function joinLink(appUrl: string, joinCode: string): string {
  return `${appUrl.replace(/\/+$/, "")}/?code=${encodeURIComponent(joinCode)}`;
}

const QUIET_ZONE = 4;

function escapeXml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}

/** The dark squares, row by row, as `[x, y, width]` runs (adjacent squares merged). */
export function qrRuns(text: string): { size: number; runs: Array<[number, number, number]> } {
  // Error correction "M" recovers about 15% damage: a good fit for a printed poster.
  const { data, size } = encode(text, { ecc: "M", border: 0 });
  const runs: Array<[number, number, number]> = [];
  data.forEach((row, y) => {
    for (let x = 0; x < size; x++) {
      if (!row[x]) continue;
      let w = 1;
      while (x + w < size && row[x + w]) w++;
      runs.push([x, y, w]);
      x += w - 1;
    }
  });
  return { size, runs };
}

/**
 * A standalone SVG document. `label` becomes the accessible name (<title>).
 * Sized by the viewBox, so CSS decides how big it is.
 */
export function qrSvg(text: string, label: string): string {
  const { size, runs } = qrRuns(text);
  const total = size + QUIET_ZONE * 2;
  const d = runs.map(([x, y, w]) => `M${x + QUIET_ZONE} ${y + QUIET_ZONE}h${w}v1h-${w}z`).join("");
  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" role="img" shape-rendering="crispEdges">` +
    `<title>${escapeXml(label)}</title>` +
    `<rect width="${total}" height="${total}" fill="#fff"/>` +
    `<path fill="#000" d="${d}"/>` +
    `</svg>`
  );
}
