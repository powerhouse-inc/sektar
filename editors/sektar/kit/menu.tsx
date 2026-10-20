// A popover menu on a trigger: the design system's .sk-menu, opened by a
// button, closed by a pick, a click outside or Escape.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cx, Icon, type IconName } from "./ui.js";

export type MenuItem = {
  label: ReactNode;
  icon?: IconName;
  active?: boolean;
  danger?: boolean;
  /** Shown, not pickable: an action that does not apply right now */
  disabled?: boolean;
  /** Starts a group: a separator (unless first) and this heading above the item */
  section?: string;
  onSelect: () => void;
};

export function Menu({
  items,
  trigger,
  align = "end",
  label,
}: {
  items: MenuItem[];
  /** Renders the trigger; gets the open state and the toggle */
  trigger: (open: boolean, toggle: () => void) => ReactNode;
  align?: "start" | "end";
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);
  return (
    <div className={cx("sk-menu-host", open && "is-open")} ref={ref}>
      {trigger(open, () => setOpen((v) => !v))}
      {open && (
        <ul
          className={cx("sk-menu sk-menu--popover", `sk-menu--${align}`)}
          role="menu"
          aria-label={label}
        >
          {items.map((it, i) => (
            <li key={i} className={it.section ? "sk-menu__group" : undefined}>
              {it.section && (
                <>
                  {i > 0 && <hr className="sk-menu__sep" />}
                  <span className="sk-menu__heading">{it.section}</span>
                </>
              )}
              <button
                type="button"
                role="menuitem"
                className={cx(
                  "sk-menu__item",
                  it.active && "is-active",
                  it.danger && "sk-menu__item--danger",
                )}
                aria-checked={it.active}
                disabled={it.disabled}
                onClick={() => {
                  setOpen(false);
                  it.onSelect();
                }}
              >
                {it.icon && <Icon name={it.icon} mono />}
                <span className="sk-grow">{it.label}</span>
                {it.active && <Icon name="check" size={16} mono />}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
