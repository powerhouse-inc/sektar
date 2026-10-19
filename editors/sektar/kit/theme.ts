import { useTheme } from "@powerhousedao/reactor-browser";
import { useEffect } from "react";

/**
 * Bridges Connect's theme to the design system's. Connect writes `.dark` on
 * the root; the Sektar tokens read `data-theme="dark"` (and fall back to
 * `prefers-color-scheme` when the attribute is absent). Mirroring Connect's
 * resolved choice onto the attribute keeps both in step, so `tokens.css` is
 * vendored unmodified. "System" removes the attribute, which is the design
 * system's own auto mode and matches what Connect resolves.
 */
export function useSektarTheme() {
  const { theme, isSystem } = useTheme();
  useEffect(() => {
    const root = document.documentElement;
    if (isSystem) root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", theme);
  }, [theme, isSystem]);
}
