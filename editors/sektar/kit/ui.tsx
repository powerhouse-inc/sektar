// React wrappers over the Sektar design system (editors/sektar/design/*.css).
// Every component renders the design system's `sk-*` classes and consumes
// semantic tokens only, so light/dark comes from the theme and nothing here
// depends on Connect's Tailwind utilities — the ground for the component
// library that the design-system refactor will absorb.
import type {
  CSSProperties,
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import { sprite } from "../design/icons.js";
import { marks } from "../design/marks.js";
import type { BadgeTone } from "./format.js";
import { initials } from "./format.js";
import { useSektarTheme } from "./theme.js";

export const cx = (...parts: (string | false | null | undefined)[]) =>
  parts.filter(Boolean).join(" ");

/* ------------------------------------------------------------------ icons */

export type IconName =
  | "dashboard"
  | "growth"
  | "transactions"
  | "invoice"
  | "card"
  | "wallet"
  | "customers"
  | "reports"
  | "trends"
  | "pie"
  | "tax"
  | "bank"
  | "cart"
  | "shield"
  | "folder"
  | "mail"
  | "calendar"
  | "bell"
  | "upload"
  | "download"
  | "settings"
  | "help"
  | "search"
  | "plus"
  | "plus-circle"
  | "leaf"
  | "sun"
  | "moon"
  | "monitor"
  | "chevron-right"
  | "chevron-down"
  | "arrow-right"
  | "arrow-up-right"
  | "arrow-down-right"
  | "check"
  | "close"
  | "menu"
  | "info"
  | "check-circle"
  | "copy";

function inject(id: string, svg: string) {
  if (document.getElementById(id)) return;
  const wrap = document.createElement("div");
  wrap.id = id;
  wrap.style.display = "none";
  wrap.innerHTML = svg;
  document.body.insertBefore(wrap, document.body.firstChild);
}

/**
 * The design system's runtime for a Sektar region: inlines the icon and brand
 * sprites once per document (`<Icon>` and `<Lockup>` reference them by id)
 * and keeps the design system's theme attribute in step with Connect's.
 * Render it once at the root of every `.sk-app` region.
 */
export function Sprite() {
  useSektarTheme();
  useEffect(() => {
    inject("sk-icon-sprite", sprite);
    inject("sk-marks-sprite", marks);
  }, []);
  return null;
}

/* ------------------------------------------------------------------ brand */

/**
 * The live brand lockup: symbol + wordmark from marks.svg, the product name as
 * real text (`--product`: single line, sized for app chrome). `h` is the
 * wordmark height, the lockup's only size knob.
 */
export function Lockup({
  product,
  h = 34,
  variant = "product",
  className,
  as: Tag = "span",
  ...rest
}: {
  product?: string;
  h?: number;
  variant?: "product" | "stacked" | "plain";
  className?: string;
  as?: "span" | "a" | "div";
} & Record<string, unknown>) {
  return (
    <Tag
      className={cx(
        "sk-lockup",
        variant === "product" && "sk-lockup--product",
        variant === "stacked" && "sk-lockup--stacked",
        !product && "sk-lockup--no-tagline",
        className,
      )}
      style={{ "--sk-lockup-h": `${h}px` } as CSSProperties}
      aria-label={product ? `Sektar ${product}` : "Sektar"}
      {...rest}
    >
      <svg className="sk-lockup__symbol" aria-hidden="true">
        <use href="#sektar-symbol" />
      </svg>
      <svg className="sk-lockup__wordmark" aria-hidden="true">
        <use href="#sektar-wordmark" />
      </svg>
      {product && <span className="sk-lockup__tagline">{product}</span>}
    </Tag>
  );
}

export function Icon({
  name,
  size,
  mono = false,
  className,
}: {
  name: IconName;
  size?: 16 | 20 | 24 | 32 | 48;
  mono?: boolean;
  className?: string;
}) {
  return (
    <svg
      className={cx(
        "sk-icon",
        size && size !== 24 && `sk-icon--${size}`,
        mono && "sk-icon--mono",
        className,
      )}
      aria-hidden="true"
    >
      <use href={`#i-${name}`} />
    </svg>
  );
}

export function IconTile({
  name,
  size = "md",
  variant,
  className,
}: {
  name: IconName;
  size?: "sm" | "md" | "lg";
  variant?: "forest" | "outline" | "round";
  className?: string;
}) {
  return (
    <span
      className={cx(
        "sk-icon-tile",
        size !== "md" && `sk-icon-tile--${size}`,
        variant && `sk-icon-tile--${variant}`,
        className,
      )}
    >
      <Icon name={name} size={size === "sm" ? 20 : size === "lg" ? 32 : 24} />
    </span>
  );
}

/* ---------------------------------------------------------------- buttons */

type ButtonVariant =
  | "default"
  | "primary"
  | "secondary"
  | "soft"
  | "ghost"
  | "sage"
  | "danger"
  | "inverse"
  | "link";

export function Button({
  variant = "default",
  size,
  pill,
  block,
  icon,
  iconOnly,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "lg";
  pill?: boolean;
  block?: boolean;
  icon?: IconName;
  iconOnly?: boolean;
}) {
  return (
    <button
      type="button"
      className={cx(
        "sk-btn",
        variant !== "default" && `sk-btn--${variant}`,
        size && `sk-btn--${size}`,
        pill && "sk-btn--pill",
        block && "sk-btn--block",
        iconOnly && "sk-btn--icon",
        className,
      )}
      {...rest}
    >
      {icon && <Icon name={icon} />}
      {children}
    </button>
  );
}

/* ----------------------------------------------------------------- badges */

export function Badge({
  tone = "outline",
  dot,
  pill,
  children,
  className,
}: {
  tone?: BadgeTone;
  dot?: boolean;
  pill?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "sk-badge",
        tone !== "neutral" && `sk-badge--${tone}`,
        tone === "neutral" && "sk-text-muted",
        dot && "sk-badge--dot",
        pill && "sk-badge--pill",
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A signed change, up in Sage, down in neutral (never red). */
export function Delta({
  value,
  suffix = "%",
}: {
  value: number;
  suffix?: string;
}) {
  const up = value >= 0;
  return (
    <span className={cx("sk-delta", up ? "sk-delta--up" : "sk-delta--down")}>
      <Icon name={up ? "arrow-up-right" : "arrow-down-right"} size={16} mono />
      {Math.abs(value)}
      {suffix}
    </span>
  );
}

export function Amount({
  value,
  children,
  className,
}: {
  value: number;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cx(
        "sk-tabular",
        value > 0 ? "sk-amount--in" : "sk-amount--out",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({
  name,
  src,
  size,
  variant,
  square,
  ring,
  children,
}: {
  name: string | null | undefined;
  /** Picture (ENS / Renown profile); falls back to initials. */
  src?: string | null;
  size?: "sm" | "lg";
  variant?: "forest" | "sage" | "brand" | "group";
  square?: boolean;
  /** Sage ring, e.g. the signed-in user */
  ring?: boolean;
  /** Replaces the initials (e.g. an icon for a group avatar) */
  children?: ReactNode;
}) {
  return (
    <span
      className={cx(
        "sk-avatar",
        size && `sk-avatar--${size}`,
        variant && `sk-avatar--${variant}`,
        square && "sk-avatar--square",
        ring && "sk-avatar--ring",
      )}
      aria-hidden="true"
    >
      {src ? (
        <img src={src} alt="" referrerPolicy="no-referrer" />
      ) : (
        (children ?? initials(name))
      )}
    </span>
  );
}

/* ------------------------------------------------------------------ cards */

export function Card({
  children,
  className,
  variant,
  title,
  actions,
  footer,
  compact,
}: {
  children?: ReactNode;
  className?: string;
  variant?: "flat" | "elevated" | "subtle" | "mint" | "forest" | "interactive";
  title?: ReactNode;
  actions?: ReactNode;
  footer?: ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={cx(
        "sk-card",
        variant && `sk-card--${variant}`,
        compact && "sk-card--compact",
        className,
      )}
    >
      {(title || actions) && (
        <header className="sk-card__header">
          {title && <h3 className="sk-card__title">{title}</h3>}
          {actions && <div className="sk-card__actions">{actions}</div>}
        </header>
      )}
      {children}
      {footer && <footer className="sk-card__footer">{footer}</footer>}
    </section>
  );
}

/** KPI tile: icon, label, Fraunces value, delta and a sparkline. */
export function Stat({
  icon,
  label,
  value,
  delta,
  foot,
  spark,
}: {
  icon: IconName;
  label: string;
  value: ReactNode;
  delta?: number;
  foot?: ReactNode;
  spark?: number[];
}) {
  return (
    <div className="sk-card sk-stat">
      <IconTile name={icon} />
      <div style={{ minWidth: 0 }}>
        <div className="sk-stat__label">{label}</div>
        <div className="sk-stat__value">
          {value}
          {delta !== undefined && <Delta value={delta} />}
        </div>
      </div>
      {spark && spark.length > 1 && <Sparkline points={spark} />}
      {foot && <div className="sk-stat__foot">{foot}</div>}
    </div>
  );
}

export function Sparkline({ points }: { points: number[] }) {
  const w = 100;
  const h = 32;
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const coords = points.map((p, i) => [
    (i / (points.length - 1)) * w,
    h - 2 - ((p - min) / span) * (h - 4),
  ]);
  const line = coords
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
  const area = `0,${h} ${line} ${w},${h}`;
  return (
    <svg
      className="sk-stat__spark"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="sk-spark-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="var(--sk-chart-2)" stopOpacity="0.35" />
          <stop offset="1" stopColor="var(--sk-chart-2)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon className="sk-spark-area" points={area} />
      <polyline className="sk-spark-line" points={line} fill="none" />
    </svg>
  );
}

/* ------------------------------------------------------------------ nav */

export function Tabs<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: ReactNode; count?: number }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="sk-tabs" role="tablist">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          role="tab"
          aria-selected={o.value === value}
          className={cx("sk-tab", o.value === value && "is-active")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
          {o.count !== undefined && (
            <span className="sk-tab__count">{o.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: readonly { value: T; label: ReactNode }[];
  onChange: (value: T) => void;
}) {
  return (
    <div className="sk-segmented">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={o.value === value}
          className={cx("sk-segmented__item", o.value === value && "is-active")}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/**
 * The design system's page header: title, a Fraunces-light lead, actions on
 * the right and, optionally, a piece of brand art behind the title row
 * (hidden on narrow screens by the design system).
 */
export function PageHeader({
  eyebrow,
  title,
  lead,
  actions,
  art,
  display,
}: {
  eyebrow?: string;
  title: ReactNode;
  lead?: ReactNode;
  actions?: ReactNode;
  /** Light/dark SVG pair, e.g. a composition shape */
  art?: { light: string; dark: string };
  /** Display size for the title (the dashboard greeting) */
  display?: boolean;
}) {
  return (
    <header className="sk-page-header">
      <div>
        {eyebrow && <div className="sk-eyebrow sk-mb-2">{eyebrow}</div>}
        <h1
          className={cx(
            "sk-page-header__title",
            display ? "sk-display" : "sk-h1",
          )}
        >
          {title}
        </h1>
        {lead && <p className="sk-page-header__lead">{lead}</p>}
      </div>
      {art && (
        <div className="sk-page-header__art sk-logo-swap" aria-hidden="true">
          <img className="sk-logo-swap__light" src={art.light} alt="" />
          <img className="sk-logo-swap__dark" src={art.dark} alt="" />
        </div>
      )}
      {actions && <div className="sk-page-header__actions">{actions}</div>}
    </header>
  );
}

/** Detail header for a record: avatar or icon, name, sub line, tags, actions. */
export function DetailHeader({
  media,
  name,
  sub,
  tags,
  actions,
}: {
  media?: ReactNode;
  name: ReactNode;
  sub?: ReactNode;
  tags?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <header className="sk-detail-header">
      {media ?? <span />}
      <div style={{ minWidth: 0 }}>
        <h2 className="sk-detail-header__name">{name}</h2>
        {sub && <div className="sk-detail-header__sub">{sub}</div>}
        {tags && <div className="sk-detail-header__tags">{tags}</div>}
      </div>
      {actions && <div className="sk-detail-header__actions">{actions}</div>}
    </header>
  );
}

/** A strip of labelled facts (issued · due · terms), separated by hairlines. */
export function MetaStrip({
  items,
}: {
  items: { label: string; value: ReactNode; icon?: IconName }[];
}) {
  return (
    <ul className="sk-meta">
      {items.map((it) => (
        <li key={it.label} className="sk-meta__item">
          {it.icon && <IconTile name={it.icon} size="sm" />}
          <div style={{ minWidth: 0 }}>
            <div className="sk-meta__label">{it.label}</div>
            <div className="sk-meta__value">{it.value}</div>
          </div>
        </li>
      ))}
    </ul>
  );
}

/** Filter pills with counts. */
export function Pills<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: readonly { value: T; label: ReactNode; count?: number }[];
  onChange: (value: T) => void;
  label?: string;
}) {
  return (
    <ul className="sk-pills" role="group" aria-label={label}>
      {options.map((o) => (
        <li key={o.value}>
          <button
            type="button"
            className={cx("sk-pill", o.value === value && "is-active")}
            aria-pressed={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {o.label}
            {o.count !== undefined && (
              <span className="sk-pill__count">{o.count}</span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

/**
 * The responsive selector: a row of tiles (icon, name, meta) that becomes a
 * compact trigger with a count and a menu when the tiles do not fit — the
 * design system's `data-sk-selector`, as React state. `list` renders the
 * one-per-row variant used for navigation.
 */
export function Selector<T extends string>({
  value,
  options,
  onChange,
  label,
  list,
}: {
  value: T;
  options: readonly {
    value: T;
    name: ReactNode;
    meta?: ReactNode;
    icon?: IconName;
    /** In place of the icon: any small leading element, e.g. a file-type tile */
    media?: ReactNode;
  }[];
  onChange: (value: T) => void;
  label?: string;
  list?: boolean;
}) {
  const root = useRef<HTMLDivElement>(null);
  const tiles = useRef<HTMLDivElement>(null);
  const [compact, setCompact] = useState(false);
  const [open, setOpen] = useState(false);
  // The open menu fits the screen below its top edge and scrolls past that
  // (a message with dozens of attachments made it taller than the screen).
  const menu = useRef<HTMLDivElement>(null);
  const [menuMax, setMenuMax] = useState<number | undefined>(undefined);
  useLayoutEffect(() => {
    if (!open || !menu.current) {
      setMenuMax(undefined);
      return;
    }
    const fit = () => {
      const top = menu.current?.getBoundingClientRect().top ?? 0;
      setMenuMax(Math.max(160, Math.floor(window.innerHeight - top - 12)));
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, [open]);
  useLayoutEffect(() => {
    if (list || !root.current || !tiles.current) return;
    const el = root.current;
    const row = tiles.current;
    const fit = () => setCompact(row.scrollWidth > el.clientWidth + 1);
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [list, options]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
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
  const current: (typeof options)[number] | undefined =
    options.find((o) => o.value === value) ?? options[0];
  const tile = (o: (typeof options)[number]) => (
    <>
      {o.media ?? (o.icon && <IconTile name={o.icon} size="sm" />)}
      <div>
        <div className="sk-selector__name">{o.name}</div>
        {o.meta && <div className="sk-selector__meta">{o.meta}</div>}
      </div>
    </>
  );
  return (
    <div
      ref={root}
      className={cx(
        "sk-selector",
        list && "sk-selector--list",
        compact && "is-compact",
        open && "is-open",
      )}
      aria-label={label}
    >
      <div ref={tiles} className="sk-selector__tiles" role="tablist">
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="tab"
            className={cx(
              "sk-selector__tile",
              o.value === value && "is-active",
            )}
            aria-pressed={o.value === value}
            aria-selected={o.value === value}
            onClick={() => onChange(o.value)}
          >
            {tile(o)}
          </button>
        ))}
      </div>
      {!list && (
        <div className="sk-selector__compact">
          <button
            type="button"
            className="sk-selector__trigger"
            aria-haspopup="listbox"
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="sk-selector__current">
              {current && tile(current)}
            </span>
            <span className="sk-selector__count">{options.length}</span>
            <Icon name="chevron-down" className="sk-selector__chevron" />
          </button>
          <div
            ref={menu}
            className="sk-selector__menu"
            role="listbox"
            style={menuMax ? { maxHeight: menuMax } : undefined}
          >
            {options.map((o) => (
              <button
                key={o.value}
                type="button"
                role="option"
                aria-selected={o.value === value}
                className={cx(
                  "sk-selector__option",
                  o.value === value && "is-active",
                )}
                onClick={() => {
                  onChange(o.value);
                  setOpen(false);
                }}
              >
                {tile(o)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ forms */

export function Field({
  label,
  hint,
  required,
  error,
  children,
  className,
  style,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <label
      className={cx("sk-field", error && "sk-field--error", className)}
      style={style}
    >
      <span className={cx("sk-label", required && "sk-label--required")}>
        {label}
      </span>
      {children}
      {(error || hint) && <span className="sk-hint">{error ?? hint}</span>}
    </label>
  );
}

export function Input({
  className,
  size,
  ...rest
}: Omit<InputHTMLAttributes<HTMLInputElement>, "size"> & {
  size?: "sm" | "lg";
}) {
  return (
    <input
      className={cx("sk-input", size && `sk-input--${size}`, className)}
      {...rest}
    />
  );
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cx("sk-select", className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={cx("sk-textarea", className)} rows={3} {...rest} />
  );
}

export function Switch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="sk-switch">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
      />
      <span />
    </label>
  );
}

export function SearchBox({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <label className="sk-input-group sk-search">
      <Icon name="search" />
      <input
        className="sk-input"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? "Search…"}
      />
    </label>
  );
}

/* ----------------------------------------------------------------- tables */

/**
 * A table. `stack` opts into the design system's phone layout (rows become
 * two-line cards: description and amount, then date and category) — only for
 * tables with that column order; the others scroll sideways in their wrap.
 */
export function Table({
  children,
  compact,
  striped,
  stack,
  className,
}: {
  children: ReactNode;
  compact?: boolean;
  striped?: boolean;
  stack?: boolean;
  className?: string;
}) {
  return (
    <div className={cx("sk-table-wrap", className)}>
      <table
        className={cx(
          "sk-table",
          compact && "sk-table--compact",
          striped && "sk-table--striped",
          stack && "sk-table--stack",
        )}
      >
        {children}
      </table>
    </div>
  );
}

/**
 * A list row. Plain: icon · title/meta · value · chevron. `rich`: the design
 * system's rich row — title, sub lines, tags, an aside column (time, amount,
 * badge) and a selected state; the one the boards use.
 */
export function ListItem({
  icon,
  title,
  meta,
  value,
  onClick,
  chevron,
  rich,
  sub,
  tags,
  aside,
  selected,
  extra,
  drill,
  leading,
}: {
  icon?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  value?: ReactNode;
  onClick?: () => void;
  chevron?: boolean;
  rich?: boolean;
  /** Secondary lines under the title (rich rows) */
  sub?: ReactNode | ReactNode[];
  /** Badges under the sub lines (rich rows) */
  tags?: ReactNode;
  /** Right column: a time, an amount, a badge (rich rows) */
  aside?: ReactNode;
  selected?: boolean;
  /** Anything else inside the body, e.g. a progress row */
  extra?: ReactNode;
  /**
   * Stacked workspace: the level this row leads to. The design system shows
   * the drill chevron only on rows that carry data-sk-drill.
   */
  drill?: number;
  /** Before the avatar: a checkbox, say (rich rows) */
  leading?: ReactNode;
}) {
  const subs = Array.isArray(sub) ? sub : sub ? [sub] : [];
  const body = rich ? (
    <>
      {leading}
      {icon}
      <div className="sk-list-item__body">
        <div className="sk-list-item__title">{title}</div>
        {subs.map((line, i) => (
          <div key={i} className="sk-list-item__sub">
            {line}
          </div>
        ))}
        {tags && <div className="sk-list-item__tags">{tags}</div>}
        {extra}
      </div>
      {aside && <div className="sk-list-item__aside">{aside}</div>}
      {chevron && <Icon name="chevron-right" className="sk-drill-chevron" />}
    </>
  ) : (
    <>
      {icon}
      <span className="sk-list-item__body">
        <span className="sk-list-item__title">{title}</span>
        {meta && <span className="sk-list-item__meta">{meta}</span>}
      </span>
      {value && <span className="sk-list-item__value">{value}</span>}
      {chevron && (
        <Icon
          name="chevron-right"
          size={16}
          mono
          className="sk-list-item__chevron"
        />
      )}
    </>
  );
  const className = cx(
    "sk-list-item",
    rich && "sk-list-item--rich",
    selected && "is-selected",
  );
  return onClick ? (
    <button
      type="button"
      className={className}
      aria-current={selected ? "true" : undefined}
      data-sk-drill={drill}
      onClick={onClick}
    >
      {body}
    </button>
  ) : (
    <div className={className} data-sk-drill={drill}>
      {body}
    </div>
  );
}

/** Activity feed: icon · text (bold subject) · time. */
export function Feed({
  items,
}: {
  items: {
    key: string;
    icon: IconName;
    text: ReactNode;
    sub?: ReactNode;
    time?: ReactNode;
  }[];
}) {
  return (
    <ul className="sk-feed">
      {items.map((it) => (
        <li key={it.key} className="sk-feed__item">
          <span className="sk-feed__icon">
            <Icon name={it.icon} />
          </span>
          <div>
            <div className="sk-feed__text">{it.text}</div>
            {it.sub && <div className="sk-feed__sub">{it.sub}</div>}
          </div>
          {it.time && <span className="sk-feed__time">{it.time}</span>}
        </li>
      ))}
    </ul>
  );
}

/** Stepper: done · current · upcoming, with an optional date per step. */
export function Steps({
  steps,
  current,
  failed,
}: {
  steps: { title: ReactNode; desc?: ReactNode; meta?: ReactNode }[];
  /** Index of the current step; everything before it is done */
  current: number;
  /** Index of a step that ended the flow (rendered as current, with a danger dot) */
  failed?: number;
}) {
  return (
    <ol className="sk-steps">
      {steps.map((st, i) => {
        const done = i < current;
        const now = i === current;
        return (
          <li
            key={i}
            className={cx(
              "sk-step",
              done && "sk-step--done",
              now && "sk-step--current",
            )}
            style={
              failed === i
                ? ({
                    "--sk-primary": "var(--sk-danger)",
                  } as CSSProperties)
                : undefined
            }
          >
            <span className="sk-step__dot">
              <Icon name="check" mono />
            </span>
            <div>
              <div className="sk-step__title">{st.title}</div>
              {st.desc && <div className="sk-step__desc">{st.desc}</div>}
            </div>
            {st.meta && <span className="sk-step__meta">{st.meta}</span>}
          </li>
        );
      })}
    </ol>
  );
}

/** Attachment chip with a file-type tile. */
export function Chip({
  name,
  meta,
  kind,
  onClick,
}: {
  name: ReactNode;
  meta?: ReactNode;
  kind?: "pdf" | "doc" | "xls" | "img";
  onClick?: () => void;
}) {
  const Tag = onClick ? "button" : "span";
  return (
    <Tag
      className="sk-chip"
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      <span
        className={cx(
          "sk-file-type sk-file-type--sm",
          kind && `sk-file-type--${kind}`,
        )}
      >
        {(kind ?? "file").toUpperCase()}
      </span>
      <span className="sk-chip__name">{name}</span>
      {meta && <span className="sk-chip__meta">{meta}</span>}
    </Tag>
  );
}

/** A progress bar with its value beside it. */
export function ProgressRow({
  value,
  label,
  variant,
}: {
  value: number;
  label?: ReactNode;
  variant?: "forest" | "mint";
}) {
  return (
    <div className="sk-progress-row">
      <Progress value={value} variant={variant} />
      <span className="sk-progress-row__value">
        {label ?? `${Math.round(value)}%`}
      </span>
    </div>
  );
}

/** The design system's hero card: a photo with the Forest gradient and a line. */
export function HeroCard({
  image,
  children,
  className,
  style,
}: {
  image: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      className={cx("sk-card sk-card--hero", className)}
      style={{ backgroundImage: `url(${image})`, ...style }}
    >
      {children}
    </div>
  );
}

/**
 * The promo card with a banner (the sidebar "Upgrade to Pro" reference): the
 * four-column growth art bleeds into the tinted zone, the body stays plain.
 */
export function PromoCard({
  art,
  title,
  children,
  action,
}: {
  art: { light: string; dark: string };
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="sk-card sk-card--promo sk-card--compact sk-logo-swap">
      <div className="sk-card__banner" aria-hidden="true">
        <img className="sk-logo-swap__light" src={art.light} alt="" />
        <img className="sk-logo-swap__dark" src={art.dark} alt="" />
      </div>
      <h3 className="sk-h4">{title}</h3>
      {children && (
        <p className="sk-small sk-text-secondary sk-mt-1">{children}</p>
      )}
      {action && <div className="sk-mt-3">{action}</div>}
    </div>
  );
}

/** The overflow-menu button (three dots). */
export function More(props: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className="sk-more" aria-label="More" {...props} />
  );
}

export function ActionTile({
  icon,
  label,
  hint,
  onClick,
}: {
  icon: IconName;
  label: string;
  hint?: string;
  onClick: () => void;
}) {
  return (
    <button type="button" className="sk-action-tile" onClick={onClick}>
      <IconTile name={icon} size="sm" />
      <span className="sk-weight-medium">{label}</span>
      {hint && <span className="sk-caption">{hint}</span>}
    </button>
  );
}

/* ------------------------------------------------------------------ charts */

export function Progress({
  value,
  variant,
}: {
  value: number;
  variant?: "forest" | "mint";
}) {
  return (
    <div
      className={cx("sk-progress", variant && `sk-progress--${variant}`)}
      role="progressbar"
      aria-valuenow={value}
    >
      <div
        className="sk-progress__bar"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

export function Ring({
  value,
  label,
  size,
  small,
}: {
  value: number;
  label?: ReactNode;
  size?: number;
  /** The design system's compact ring (64px, thin track) */
  small?: boolean;
}) {
  return (
    <div
      className={cx("sk-ring", small && "sk-ring--sm")}
      style={
        {
          "--sk-ring-value": value,
          ...(size ? { "--sk-ring-size": `${size}px` } : {}),
        } as CSSProperties
      }
    >
      <span className="sk-ring__label">{label ?? `${Math.round(value)}%`}</span>
    </div>
  );
}

/**
 * Bar chart (CSS only): one group per label, up to three series side by side,
 * or stacked (`stacked`: the first value is the soft base, the second the
 * strong top). `axis` adds the design system's value axis with `ticks` labels
 * from top to bottom.
 */
export function Bars({
  groups,
  height = 200,
  stacked,
  axis,
  ticks = 5,
  format = (v) => String(Math.round(v)),
}: {
  groups: { label: string; values: number[] }[];
  height?: number;
  stacked?: boolean;
  axis?: boolean;
  ticks?: number;
  format?: (v: number) => string;
}) {
  const max = Math.max(
    1,
    ...groups.map((g) =>
      stacked ? g.values.reduce((s, v) => s + v, 0) : Math.max(...g.values),
    ),
  );
  const style = { "--sk-bars-h": `${height}px` } as CSSProperties;
  const chart = (
    <div className={cx("sk-bars", stacked && "sk-bars--stacked")} style={style}>
      {groups.map((g) => (
        <div key={g.label} className="sk-bars__group">
          {(stacked ? [...g.values].reverse() : g.values).map((v, i) => (
            <div
              key={i}
              className={cx(
                "sk-bars__bar",
                stacked
                  ? i === g.values.length - 1 && "sk-bars__bar--soft"
                  : i === 1 && "sk-bars__bar--2",
                !stacked && i === 2 && "sk-bars__bar--3",
              )}
              style={{ "--v": `${(v / max) * 100}%` } as CSSProperties}
              title={`${g.label}: ${format(v)}`}
            />
          ))}
          <span className="sk-bars__label">{g.label}</span>
        </div>
      ))}
    </div>
  );
  if (!axis) return chart;
  const labels = Array.from({ length: ticks + 1 }, (_, i) =>
    format((max * (ticks - i)) / ticks),
  );
  return (
    <div className="sk-bars-wrap" style={style}>
      <div className="sk-bars-axis" aria-hidden="true">
        {labels.map((l, i) => (
          <span key={i}>{l}</span>
        ))}
      </div>
      {chart}
    </div>
  );
}

export function Donut({
  slices,
  value,
  label,
  size = 160,
}: {
  slices: { value: number; color?: string }[];
  value: ReactNode;
  label?: ReactNode;
  size?: number;
}) {
  const total = slices.reduce((s, x) => s + x.value, 0) || 1;
  let acc = 0;
  const stops = slices
    .map((s, i) => {
      const from = (acc / total) * 100;
      acc += s.value;
      const to = (acc / total) * 100;
      return `${s.color ?? `var(--sk-chart-${(i % 6) + 1})`} ${from.toFixed(2)}% ${to.toFixed(2)}%`;
    })
    .join(", ");
  return (
    <div
      className="sk-donut"
      style={
        {
          "--sk-donut-stops": stops,
          "--sk-donut-size": `${size}px`,
        } as CSSProperties
      }
    >
      <div className="sk-donut__center">
        <div className="sk-donut__value">{value}</div>
        {label && <div className="sk-donut__label">{label}</div>}
      </div>
    </div>
  );
}

export function Legend({
  items,
}: {
  items: { label: string; value?: ReactNode; color?: string }[];
}) {
  return (
    <ul className="sk-legend">
      {items.map((it, i) => (
        <li key={it.label}>
          <span
            className="sk-legend__swatch"
            style={{ background: it.color ?? `var(--sk-chart-${(i % 6) + 1})` }}
          />
          <span>{it.label}</span>
          {it.value !== undefined && (
            <span className="sk-ml-auto sk-tabular sk-text-muted">
              {it.value}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

/* ------------------------------------------------------------- feedback */

export function Alert({
  tone,
  title,
  children,
  actions,
}: {
  tone?: "success" | "warning" | "danger";
  title?: ReactNode;
  children?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className={cx("sk-alert", tone && `sk-alert--${tone}`)} role="status">
      <Icon
        name={
          tone === "danger"
            ? "info"
            : tone === "warning"
              ? "bell"
              : tone === "success"
                ? "check-circle"
                : "info"
        }
        size={20}
      />
      <div className="sk-grow">
        {title && <div className="sk-alert__title">{title}</div>}
        {children}
      </div>
      {actions}
    </div>
  );
}

export function EmptyState({
  icon = "leaf",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: ReactNode;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="sk-empty">
      <IconTile name={icon} size="lg" variant="round" />
      <div className="sk-empty__title">{title}</div>
      {children && <p className="sk-text-muted">{children}</p>}
      {action}
    </div>
  );
}

export function Skeleton({
  width,
  height = 16,
  circle,
}: {
  width?: number | string;
  height?: number;
  circle?: boolean;
}) {
  return (
    <div
      className={cx("sk-skeleton", circle && "sk-skeleton--circle")}
      style={{ width: width ?? "100%", height }}
    />
  );
}

/* --------------------------------------------------------------- overlays */

/** Escape closes the topmost overlay. Captured on the document so a host
 * shortcut handler further down cannot swallow the key first. */
function useEscape(onClose: () => void) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey, { capture: true });
    return () =>
      document.removeEventListener("keydown", onKey, { capture: true });
  }, [onClose]);
}

/** Right-hand drawer for detail and creation flows. */
export function SidePanel({
  eyebrow,
  title,
  subtitle,
  badge,
  onClose,
  children,
  footer,
}: {
  /** Record type ("Invoice", "Contact"); alone, the header is a slim bar
   * and the body's detail header carries the name. */
  eyebrow?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  badge?: ReactNode;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
}) {
  useEscape(onClose);
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="sk-overlay"
        onClick={onClose}
        style={{ border: 0, padding: 0 }}
      />
      <aside className="sk-panel sk-page" role="dialog" aria-modal="true">
        <header
          className={cx(
            "sk-panel__header",
            eyebrow && !title && "sk-panel__header--slim",
          )}
        >
          {eyebrow && !title ? (
            <div className="sk-eyebrow">{eyebrow}</div>
          ) : (
            <div className="sk-stack sk-stack--2">
              {eyebrow && <div className="sk-eyebrow">{eyebrow}</div>}
              <div className="sk-row sk-row--2">
                <h3
                  className="sk-h3"
                  style={{ fontSize: "var(--sk-text-2xl)" }}
                >
                  {title}
                </h3>
                {badge}
              </div>
              {subtitle && (
                <div className="sk-text-muted sk-small">{subtitle}</div>
              )}
            </div>
          )}
          <Button
            variant="ghost"
            iconOnly
            icon="close"
            aria-label="Close"
            onClick={onClose}
          />
        </header>
        <div className="sk-panel__body">{children}</div>
        {footer && <footer className="sk-panel__footer">{footer}</footer>}
      </aside>
    </>
  );
}

export function Modal({
  title,
  children,
  footer,
  onClose,
}: {
  title: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onClose: () => void;
}) {
  useEscape(onClose);
  return (
    <>
      <button
        type="button"
        aria-label="Close"
        className="sk-overlay"
        onClick={onClose}
        style={{ border: 0, padding: 0 }}
      />
      <div
        className="sk-modal sk-page"
        role="dialog"
        aria-modal="true"
        style={{
          position: "fixed",
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
          zIndex: "var(--sk-z-modal)",
        }}
      >
        <h3 className="sk-modal__title">{title}</h3>
        <div className="sk-modal__body">{children}</div>
        {footer && <div className="sk-modal__footer">{footer}</div>}
      </div>
    </>
  );
}

export function Toast({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div
      className="sk-toast"
      role="status"
      style={{
        position: "fixed",
        right: 24,
        bottom: 24,
        zIndex: "var(--sk-z-toast)",
      }}
    >
      <Icon name="check-circle" size={20} />
      <span>{children}</span>
      {action}
    </div>
  );
}

/** Key/value rows for detail views (the design system's `.sk-kv`). */
export function Dl({
  rows,
  tight,
}: {
  rows: { label: string; value: ReactNode }[];
  tight?: boolean;
}) {
  return (
    <dl className={cx("sk-kv", tight && "sk-kv--tight")}>
      {rows.map((r) => (
        <Fragment key={r.label}>
          <dt>{r.label}</dt>
          <dd>{r.value}</dd>
        </Fragment>
      ))}
    </dl>
  );
}
