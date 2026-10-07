/**
 * Simple, deterministic SVG illustrations of found items, made from the
 * category icon and a color. Used for the demo school's "photos" and the setup
 * wizard's preview card.
 *
 * Synthetic on purpose: no real photos, no people, nothing to license. They are
 * NOT valid data for evaluating the matching engine later (SPEC Section 7 uses
 * real photos for that).
 */
import type { Category, Color } from "@/lib/domain/types";
import { CATEGORY_ICON, COLOR_HEX } from "@/lib/domain/visuals";

// Pale backdrops, a step deeper than the app's tinted panels so the picture
// reads as a photo on both the light and the dark theme.
const BACKGROUNDS = ["#dfe7fb", "#e9e3f8", "#dcecf7", "#f7ecd6", "#e0f1e7"];

/** A small stable hash so the same inputs always draw the same picture. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function demoItemSvg(category: Category, color: Color, variant = 0): string {
  const h = hash(`${category}:${color}:${variant}`);
  const bg = BACKGROUNDS[h % BACKGROUNDS.length];
  const rotate = (h % 25) - 12;
  const scale = 10 + ((h >> 5) % 3);
  const light = color === "white" || color === "silver" || color === "beige" || color === "yellow";
  const stroke = light ? "#4b5563" : "#1f2328";
  const fill = color === "multicolor" ? "url(#multi)" : COLOR_HEX[color];
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400" width="400" height="400">`,
    `<defs><linearGradient id="multi" x1="0" y1="0" x2="1" y2="1">`,
    `<stop offset="0" stop-color="#dc2626"/><stop offset=".33" stop-color="#eab308"/><stop offset=".66" stop-color="#16a34a"/><stop offset="1" stop-color="#2563eb"/>`,
    `</linearGradient></defs>`,
    `<rect width="400" height="400" fill="${bg}"/>`,
    `<ellipse cx="200" cy="335" rx="125" ry="16" fill="#000000" opacity="0.08"/>`,
    `<g transform="translate(200 195) rotate(${rotate}) scale(${scale}) translate(-12 -12)">`,
    `<path d="${CATEGORY_ICON[category]}" fill="${fill}" fill-opacity="0.9" stroke="${stroke}" stroke-width="0.9" stroke-linejoin="round" stroke-linecap="round"/>`,
    `</g></svg>`,
  ].join("");
}

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
