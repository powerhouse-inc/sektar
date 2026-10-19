import { useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { cx, Icon, Lockup } from "../../../../editors/sektar/kit/ui.js";
import { PRODUCTS, type Product } from "./products.js";

// The design system's product switcher: the sidebar lockup is a button; it
// opens a popover listing the products with their app icon, name and one
// line, the current one checked. Picking one goes to that product's home.
export function ProductSwitch({
  product,
  onPick,
}: {
  product: Product;
  /** Drawer: picking a product closes it */
  onPick?: () => void;
}) {
  const navigate = useNavigate();
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

  const pick = (p: Product) => {
    setOpen(false);
    onPick?.();
    if (p.id !== product.id) void navigate({ to: p.home });
  };

  return (
    <div className={cx("sk-product-switch", open && "is-open")} ref={ref}>
      <button
        type="button"
        className="sk-product-switch__btn"
        aria-haspopup="dialog"
        aria-expanded={open}
        title="Switch product"
        onClick={() => setOpen((v) => !v)}
      >
        {/* 30px, as in the design system's product switcher: with the
            chevron beside it, the longest product line still ends under the
            r of Sektar inside a 264px sidebar */}
        <Lockup product={product.name} h={30} />
        <Icon name="chevron-down" className="sk-product-switch__chevron" />
      </button>
      <div
        className="sk-product-switch__menu"
        role="dialog"
        aria-label="Switch product"
      >
        <p className="sk-eyebrow sk-product-switch__eyebrow">Sektar products</p>
        <div className="sk-selector sk-selector--list" aria-label="Product">
          <div className="sk-selector__tiles">
            {PRODUCTS.map((p) => (
              <button
                key={p.id}
                type="button"
                className={cx(
                  "sk-selector__tile",
                  p.id === product.id && "is-active",
                )}
                aria-pressed={p.id === product.id}
                onClick={() => pick(p)}
              >
                <span className="sk-app-icon sk-logo-swap">
                  <img className="sk-logo-swap__light" src={p.icon.light} alt="" />
                  <img className="sk-logo-swap__dark" src={p.icon.dark} alt="" />
                </span>
                <div>
                  <div className="sk-selector__name">{p.name}</div>
                  <div className="sk-selector__meta">{p.lead}</div>
                </div>
                <Icon name="check" size={16} className="sk-product-switch__check" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
