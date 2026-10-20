// Travel glyphs in the design system's icon language: a 24px grid, filled
// geometric shapes in the three icon tones (--sk-icon-1/2/3), no outlines, no
// gradients. The vendored sprite has no plane, bed or cup; these sit beside it
// with their own ids (#ti-*) and render through the same .sk-icon classes.
import { useEffect } from "react";
import type { TripGlyph } from "./trips.js";
import { cx } from "./ui.js";

const t1 = 'style="fill:var(--sk-icon-1)"';
const t2 = 'style="fill:var(--sk-icon-2)"';
const t3 = 'style="fill:var(--sk-icon-3)"';

const GLYPHS: Record<TripGlyph, string> = {
  plane: `<path d="M10.2 3.2c.3-.8 1.5-.8 1.8 0l1.5 5.3 6.7 3.6c.5.3.8.8.8 1.3v.9l-7.5-1.9-.5 4.7 2.3 1.8v1.4l-3.6-.9-.7.2-3.6.7v-1.4l2.3-1.8-.5-4.7-7.5 1.9v-.9c0-.5.3-1 .8-1.3l6.7-3.6z" ${t1}/>
    <path d="M10.6 8.5h1l.9 8.6-1.4 1.1-1.4-1.1z" ${t3}/>`,
  train: `<rect x="5" y="2.5" width="14" height="15" rx="3.5" ${t1}/>
    <rect x="7" y="5" width="10" height="5.5" rx="1.5" ${t2}/>
    <circle cx="8.6" cy="14" r="1.3" ${t3}/><circle cx="15.4" cy="14" r="1.3" ${t3}/>
    <path d="M7.2 17.5h2.4l-1.8 4H5.4zM14.4 17.5h2.4l1.8 4h-2.4z" ${t2}/>`,
  car: `<path d="M5.2 9.2 6.9 5a2 2 0 0 1 1.9-1.3h6.4A2 2 0 0 1 17.1 5l1.7 4.2z" ${t2}/>
    <rect x="2.5" y="9" width="19" height="8" rx="2.5" ${t1}/>
    <circle cx="7" cy="13" r="1.4" ${t3}/><circle cx="17" cy="13" r="1.4" ${t3}/>
    <rect x="4" y="16.5" width="3.5" height="3.5" rx="1" ${t1}/><rect x="16.5" y="16.5" width="3.5" height="3.5" rx="1" ${t1}/>`,
  taxi: `<rect x="9" y="2.5" width="6" height="3" rx="1" ${t3}/>
    <path d="M5.2 10.2 6.9 6a2 2 0 0 1 1.9-1.3h6.4A2 2 0 0 1 17.1 6l1.7 4.2z" ${t2}/>
    <rect x="2.5" y="10" width="19" height="7.5" rx="2.5" ${t1}/>
    <circle cx="7" cy="13.7" r="1.4" ${t3}/><circle cx="17" cy="13.7" r="1.4" ${t3}/>
    <rect x="4" y="17" width="3.5" height="3.5" rx="1" ${t1}/><rect x="16.5" y="17" width="3.5" height="3.5" rx="1" ${t1}/>`,
  bus: `<rect x="4" y="2.5" width="16" height="16" rx="3" ${t1}/>
    <rect x="6" y="5" width="12" height="6" rx="1.2" ${t2}/>
    <circle cx="8" cy="14.8" r="1.3" ${t3}/><circle cx="16" cy="14.8" r="1.3" ${t3}/>
    <rect x="5.5" y="18" width="3" height="3.5" rx="1" ${t1}/><rect x="15.5" y="18" width="3" height="3.5" rx="1" ${t1}/>`,
  ferry: `<path d="M8 5h8v5H8z" ${t2}/><rect x="10" y="2.5" width="4" height="3" rx="1" ${t3}/>
    <path d="M3 10.5h18l-2.4 6.5H5.4z" ${t1}/>
    <path d="M2.5 19.2c1.6 0 2.4-1 3.9-1s2.3 1 3.9 1 2.4-1 3.8-1 2.4 1 3.9 1 2.3-1 3.5-1v2.3c-1.2 0-2 1-3.5 1s-2.5-1-3.9-1-2.3 1-3.8 1-2.4-1-3.9-1-2.3 1-3.9 1z" ${t3}/>`,
  metro: `<circle cx="12" cy="12" r="9.5" ${t1}/>
    <path d="M6.8 16.5V7.5h2.1l3.1 4.4 3.1-4.4h2.1v9h-2.1v-5.6L12 15.1l-3.1-4.2v5.6z" ${t2}/>`,
  parking: `<rect x="3" y="3" width="18" height="18" rx="4" ${t1}/>
    <path d="M9 17V7h4a3.3 3.3 0 0 1 0 6.6h-1.8V17zm2.2-5.3H13a1.4 1.4 0 0 0 0-2.8h-1.8z" ${t2}/>`,
  bed: `<rect x="2.5" y="5" width="3" height="15" rx="1.2" ${t1}/>
    <rect x="5" y="9" width="6" height="4.5" rx="2" ${t3}/>
    <path d="M10 10.5h8.5a3 3 0 0 1 3 3v1.5H10z" ${t2}/>
    <rect x="2.5" y="14.5" width="19" height="3.5" rx="1" ${t1}/>
    <rect x="18.5" y="16" width="3" height="4" rx="1.2" ${t1}/>`,
  meal: `<circle cx="12" cy="12.5" r="7.5" ${t2}/><circle cx="12" cy="12.5" r="4.5" ${t3}/>
    <rect x="1.8" y="4" width="2" height="16" rx="1" ${t1}/>
    <path d="M20.2 4c1.2 0 2 1.5 2 4.5v3h-1v8.5h-2V4z" ${t1}/>`,
  coffee: `<path d="M4 8h13v6.5A5.5 5.5 0 0 1 11.5 20h-2A5.5 5.5 0 0 1 4 14.5z" ${t1}/>
    <path d="M17 9.5h1.5a3 3 0 0 1 0 6H16.5v-2h2a1 1 0 0 0 0-2H17z" ${t2}/>
    <rect x="7" y="3" width="2" height="3.5" rx="1" ${t3}/><rect x="11" y="3" width="2" height="3.5" rx="1" ${t3}/>
    <rect x="3" y="20" width="15" height="1.8" rx=".9" ${t2}/>`,
  ticket: `<path d="M3 7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v2.5a2.5 2.5 0 0 0 0 5V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-2.5a2.5 2.5 0 0 0 0-5z" ${t1}/>
    <rect x="14.5" y="6.5" width="1.6" height="11" rx=".8" ${t3}/>
    <rect x="6.5" y="9" width="6" height="2" rx="1" ${t2}/><rect x="6.5" y="13" width="4" height="2" rx="1" ${t2}/>`,
  desk: `<rect x="2.5" y="10" width="19" height="3" rx="1" ${t1}/>
    <rect x="4" y="12.5" width="2.2" height="8" rx="1" ${t1}/><rect x="17.8" y="12.5" width="2.2" height="8" rx="1" ${t1}/>
    <rect x="7" y="3" width="10" height="6" rx="1.5" ${t2}/><rect x="10.5" y="8.5" width="3" height="2" ${t3}/>`,
  signal: `<rect x="3" y="15" width="3.5" height="6" rx="1" ${t3}/><rect x="8.5" y="11" width="3.5" height="10" rx="1" ${t2}/>
    <rect x="14" y="7" width="3.5" height="14" rx="1" ${t1}/><rect x="19.5" y="3" width="2" height="18" rx="1" ${t1}/>`,
  passport: `<rect x="4.5" y="2.5" width="15" height="19" rx="2.5" ${t1}/>
    <circle cx="12" cy="10" r="3.8" ${t2}/><rect x="8" y="16" width="8" height="2" rx="1" ${t3}/>`,
  shield: `<path d="M12 2.5 20 5.5v6c0 5-3.4 8.6-8 10-4.6-1.4-8-5-8-10v-6z" ${t1}/>
    <path d="M12 5.2 17.5 7.3v4.2c0 3.5-2.3 6-5.5 7.1z" ${t2}/>`,
  bag: `<path d="M8.5 6.5V5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5h-2V5h-3v1.5z" ${t1}/>
    <rect x="3" y="6.5" width="18" height="14" rx="2.5" ${t1}/>
    <rect x="3" y="11" width="18" height="2.4" ${t2}/><rect x="10.5" y="10" width="3" height="4.4" rx="1" ${t3}/>`,
  pin: `<path d="M12 2.5a7 7 0 0 1 7 7c0 5-7 12-7 12s-7-7-7-12a7 7 0 0 1 7-7z" ${t1}/>
    <circle cx="12" cy="9.5" r="3" ${t2}/>`,
};

const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg">${Object.entries(GLYPHS)
  .map(([id, body]) => `<symbol id="ti-${id}" viewBox="0 0 24 24">${body}</symbol>`)
  .join("")}</svg>`;

/** Inlines the travel glyphs once per document; render it next to <Sprite/>. */
export function TripSprite() {
  useEffect(() => {
    if (document.getElementById("sk-trip-sprite")) return;
    const wrap = document.createElement("div");
    wrap.id = "sk-trip-sprite";
    wrap.style.display = "none";
    wrap.innerHTML = SPRITE;
    document.body.insertBefore(wrap, document.body.firstChild);
  }, []);
  return null;
}

export function Glyph({ name, size, className }: { name: TripGlyph; size?: 16 | 20 | 32 | 48; className?: string }) {
  return (
    <svg className={cx("sk-icon", size && `sk-icon--${size}`, className)} aria-hidden="true">
      <use href={`#ti-${name}`} />
    </svg>
  );
}

/** The mint square a glyph sits in, as .sk-icon-tile. */
export function GlyphTile({ name, size = "md", variant }: { name: TripGlyph; size?: "sm" | "md" | "lg"; variant?: "forest" | "round" }) {
  return (
    <span className={cx("sk-icon-tile", size !== "md" && `sk-icon-tile--${size}`, variant && `sk-icon-tile--${variant}`)}>
      <Glyph name={name} size={size === "sm" ? 20 : size === "lg" ? 32 : undefined} />
    </span>
  );
}
