// The sync glyphs in the design system's icon language: a 24px grid, filled
// geometric shapes in the icon tones, no outlines. The vendored sprite has no
// circular arrows; these sit beside it with their own ids (#si-*) and render
// through the same .sk-icon classes, so a button turns them monochrome.
//   sync         two circular arrows: the folder-sync actions
//   folder-sync  the design system's folder with a sync badge notched into
//                its corner: a folder that is mapped to disk
import { useEffect } from "react";
import { cx } from "./ui.js";

export type SyncGlyphName = "sync" | "folder-sync";

const t1 = 'style="fill:var(--sk-icon-1)"';
const t2 = 'style="fill:var(--sk-icon-2)"';
const t3 = 'style="fill:var(--sk-icon-3)"';

const GLYPHS: Record<SyncGlyphName, string> = {
  sync: `<path d="M3.92 9.06A8.6 8.6 0 0 1 18.39 6.25L16.53 7.92A6.1 6.1 0 0 0 6.27 9.91z" ${t1}/>
  <path d="M19.77 4.5 19.24 10.72 14.81 9.29z" ${t3}/>
  <path d="M20.08 14.94A8.6 8.6 0 0 1 5.61 17.75L7.47 16.08A6.1 6.1 0 0 0 17.73 14.09z" ${t1}/>
  <path d="M4.23 19.5 4.76 13.28 9.19 14.71z" ${t3}/>`,
  // The folder is i-folder's two shapes, with a round notch where the badge sits.
  "folder-sync": `<mask id="si-folder-sync-notch"><rect width="24" height="24" fill="#fff"/><circle cx="17.6" cy="16.6" r="7" fill="#000"/></mask>
  <g mask="url(#si-folder-sync-notch)">
    <path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h4.2c.6 0 1.2.3 1.6.7l1.5 1.3h5.7A2.5 2.5 0 0 1 21 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z" ${t1}/>
    <rect x="3" y="10" width="18" height="10" rx="2.5" ${t2}/>
  </g>
  <path d="M12.89 14.4A5.2 5.2 0 0 1 21.08 12.74L19.61 14.37A3 3 0 0 0 14.88 15.33z" ${t1}/>
  <path d="M21.91 11.47 21.64 15.89 18.56 15.45z" ${t1}/>
  <path d="M22.31 18.8A5.2 5.2 0 0 1 14.12 20.46L15.59 18.83A3 3 0 0 0 20.32 17.87z" ${t1}/>
  <path d="M13.29 21.73 13.56 17.31 16.64 17.75z" ${t1}/>`,
};

const SPRITE = `<svg xmlns="http://www.w3.org/2000/svg">${Object.entries(GLYPHS)
  .map(([id, body]) => `<symbol id="si-${id}" viewBox="0 0 24 24">${body}</symbol>`)
  .join("")}</svg>`;

/** Inlines the sync glyphs once per document; render it next to <Sprite/>. */
export function SyncSprite() {
  useEffect(() => {
    if (document.getElementById("sk-sync-sprite")) return;
    const wrap = document.createElement("div");
    wrap.id = "sk-sync-sprite";
    // Zero-sized, not display:none: a mask in an undisplayed sprite does not apply.
    wrap.style.cssText = "position:absolute;width:0;height:0;overflow:hidden";
    wrap.setAttribute("aria-hidden", "true");
    wrap.innerHTML = SPRITE;
    document.body.insertBefore(wrap, document.body.firstChild);
  }, []);
  return null;
}

export function SyncGlyph({ name = "sync", size, className }: { name?: SyncGlyphName; size?: 16 | 20 | 32 | 48; className?: string }) {
  return (
    <svg className={cx("sk-icon", size && `sk-icon--${size}`, className)} aria-hidden="true">
      <use href={`#si-${name}`} />
    </svg>
  );
}
