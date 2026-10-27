// The design system's workspace pattern: flat panes side by side, each with a
// header and a scrolling body, divided by hairlines. Under 640px of container
// width the panes become a push navigation (`data-level` says which one
// shows; a `--parent` pane is a level-0 chooser). Collapse and drill state is
// React state here; the classes and attributes are the design system's.
import type { CSSProperties, ReactNode, Ref, RefObject } from "react";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { cx, Icon } from "./ui.js";

/** Whether the workspace around a pane shows its panes one at a time. */
const StackedContext = createContext(false);

/**
 * Whether the panes are stacked: the stylesheet sets `--sk-stacked: 1` on
 * them in the narrow state (components.css, app.css). Read on every resize of
 * the workspace, after the container queries have applied.
 */
function useStacked(ref: RefObject<HTMLDivElement | null>): boolean {
  const [stacked, setStacked] = useState(false);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const read = () => {
      const pane = el.querySelector(":scope > .sk-pane");
      setStacked(
        pane !== null &&
          getComputedStyle(pane).getPropertyValue("--sk-stacked").trim() ===
            "1",
      );
    };
    read();
    const observer = new ResizeObserver(read);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);
  return stacked;
}

export function Workspace({
  level,
  hasParent,
  className,
  style,
  children,
}: {
  /** Which pane shows when the panes are stacked (0 = the parent chooser) */
  level: number;
  /** The first pane is a level-0 chooser, hidden side by side */
  hasParent?: boolean;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  const root = useRef<HTMLDivElement>(null);
  const stacked = useStacked(root);
  return (
    <div
      ref={root}
      className={cx(
        "sk-workspace sk-workspace--panes sk-workspace--stack",
        hasParent && "sk-workspace--has-parent",
        className,
      )}
      data-level={level}
      data-stacked={stacked ? "" : undefined}
      style={style}
    >
      <StackedContext.Provider value={stacked}>
        {children}
      </StackedContext.Provider>
    </div>
  );
}

export function Pane({
  side,
  parent,
  grow,
  collapsed,
  onToggle,
  title,
  titleDisplay,
  /** Shown only while collapsed, for a pane whose header is a control */
  collapsedTitle,
  count,
  onBack,
  backLabel,
  header,
  trailing,
  flush,
  tall,
  className,
  bodyClassName,
  bodyRef,
  children,
}: {
  /** Which edge the collapse chevron points at */
  side?: "start" | "end";
  parent?: boolean;
  grow?: number;
  collapsed?: boolean;
  onToggle?: () => void;
  title?: ReactNode;
  titleDisplay?: boolean;
  collapsedTitle?: ReactNode;
  count?: number;
  /** Stacked: the back button in the header */
  onBack?: () => void;
  backLabel?: string;
  /** Anything else in the header after the title: a switch, a selector */
  header?: ReactNode;
  /** Pinned to the right, before the collapse chevron: a menu, actions */
  trailing?: ReactNode;
  flush?: boolean;
  tall?: boolean;
  className?: string;
  bodyClassName?: string;
  /** The scrolling body, for a window over a long list */
  bodyRef?: Ref<HTMLDivElement>;
  children?: ReactNode;
}) {
  // Stacked, a pane is a whole screen: a collapse chosen side by side is kept
  // for when the panes are side by side again, never shown as a strip (its
  // header lost the back button and its content to the strip's title).
  const stacked = useContext(StackedContext);
  const showCollapsed = Boolean(collapsed) && !stacked;
  return (
    <section
      className={cx(
        "sk-pane",
        side && `sk-pane--${side}`,
        parent && "sk-pane--parent",
        showCollapsed && "is-collapsed",
        className,
      )}
      style={grow ? ({ "--sk-pane-grow": grow } as CSSProperties) : undefined}
    >
      <header
        className={cx("sk-pane__header", tall && "sk-pane__header--tall")}
      >
        {onBack && (
          <button
            type="button"
            className="sk-pane__back"
            aria-label={backLabel ?? "Back"}
            onClick={onBack}
          >
            <Icon name="chevron-right" />
          </button>
        )}
        {onToggle && side === "end" && (
          <PaneToggle collapsed={showCollapsed} onToggle={onToggle} />
        )}
        {collapsedTitle && (
          <h2 className="sk-pane__title sk-pane__title--collapsed-only">
            {collapsedTitle}
          </h2>
        )}
        {title && (
          <h2
            className={cx(
              "sk-pane__title",
              titleDisplay && "sk-pane__title--display",
            )}
          >
            {title}
          </h2>
        )}
        {count !== undefined && <span className="sk-pane__count">{count}</span>}
        {header}
        {(trailing || (onToggle && side !== "end")) && (
          <span className="sk-pane__spacer" />
        )}
        {trailing}
        {onToggle && side !== "end" && (
          <PaneToggle collapsed={showCollapsed} onToggle={onToggle} />
        )}
      </header>
      <div
        ref={bodyRef}
        className={cx(
          "sk-pane__body",
          flush && "sk-pane__body--flush",
          bodyClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

function PaneToggle({
  collapsed,
  onToggle,
}: {
  collapsed?: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      className="sk-pane__toggle"
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand" : "Collapse"}
      onClick={onToggle}
    >
      <Icon name="chevron-right" />
    </button>
  );
}

/** The pane header's switch: the current choice, with a chevron that drills to the chooser when stacked. */
export function PaneSwitch({
  label,
  onClick,
  ariaLabel,
}: {
  label: ReactNode;
  onClick: () => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      className="sk-pane__switch"
      aria-label={ariaLabel}
      onClick={onClick}
    >
      <h2 className="sk-pane__title">{label}</h2>
      <Icon name="chevron-down" />
    </button>
  );
}

/** A foldable section inside a pane body. */
export function PaneSection({
  title,
  count,
  collapsed,
  onToggle,
  children,
}: {
  title: ReactNode;
  count?: number;
  collapsed?: boolean;
  onToggle?: () => void;
  children: ReactNode;
}) {
  return (
    <section className={cx("sk-pane__section", collapsed && "is-collapsed")}>
      <header className="sk-pane__section-header" onClick={onToggle}>
        {onToggle && (
          <button
            type="button"
            className="sk-pane__toggle"
            aria-expanded={!collapsed}
            aria-label={`Toggle ${typeof title === "string" ? title : "section"}`}
          >
            <Icon name="chevron-right" />
          </button>
        )}
        <span className="sk-pane__section-title">{title}</span>
        {count !== undefined && <span className="sk-pane__count">{count}</span>}
      </header>
      <div className="sk-pane__section-body">{children}</div>
    </section>
  );
}

/** The design system's sub-bar above a workspace. */
export function SubBar({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return <div className={cx("sk-subbar", className)}>{children}</div>;
}
