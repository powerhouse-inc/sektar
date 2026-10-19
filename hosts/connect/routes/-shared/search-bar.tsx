import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { money, plural } from "../../../../editors/sektar/kit/format.js";
import {
  hitTarget,
  KIND_LABEL,
  useGlobalSearch,
  type SearchHit,
} from "../../../../editors/sektar/kit/search.js";
import { cx, Icon, type IconName } from "../../../../editors/sektar/kit/ui.js";
import { useSearch } from "./search.js";

// The design system's top-bar search: a pill input group with the shortcut
// hint, as in the "Forms" and "App shell" sections of the spec. Results open
// as a menu under it (grouped by kind), walkable with the arrow keys; Cmd/Ctrl+K
// (or "/") focuses it from anywhere; Enter goes to the full results page.

const ICON: Record<string, IconName> = {
  invoice: "invoice",
  contact: "customers",
  expense: "wallet",
  account: "bank",
  transaction: "transactions",
};
const PER_GROUP = 4;
const LIMIT = 12;

const keyOf = (h: SearchHit) => `${h.document_id}:${h.entity_id}`;

function shortcutLabel() {
  if (typeof navigator === "undefined") return "Ctrl K";
  return /Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K";
}

export function SearchBar({
  autoFocus,
  onClose,
}: {
  /** Focus the field (the phone top bar opens it on demand) */
  autoFocus?: boolean;
  /** Escape on an empty field: the phone sheet closes */
  onClose?: () => void;
} = {}) {
  const { query, setQuery } = useSearch();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (st) => st.location.pathname });
  const { grouped, hits, active, isLoading } = useGlobalSearch(query, LIMIT);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const showDropdown = open && active && pathname !== "/search";

  // The rows in render order; the "see all" row sits at index visible.length.
  const visible = useMemo(
    () => grouped.flatMap(([, list]) => list.slice(0, PER_GROUP)),
    [grouped],
  );
  const indexOf = useMemo(
    () => new Map(visible.map((h, i) => [keyOf(h), i])),
    [visible],
  );
  const last = visible.length;

  useEffect(() => setCursor(-1), [query]);
  useEffect(() => {
    if (autoFocus) inputRef.current?.focus();
  }, [autoFocus]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = inputRef.current;
      if (!el) return;
      const target = e.target as HTMLElement | null;
      const typing = !!target?.closest(
        "input, textarea, select, [contenteditable]",
      );
      if ((e.key === "k" || e.key === "K") && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        el.focus();
        el.select();
        setOpen(true);
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        el.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const close = () => {
    setOpen(false);
    inputRef.current?.blur();
  };
  const go = (hit: SearchHit) => {
    const t = hitTarget(hit);
    close();
    void navigate({ to: t.to, search: t.search } as never);
  };
  const goAll = () => {
    close();
    void navigate({ to: "/search" });
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    switch (e.key) {
      case "ArrowDown":
        if (!showDropdown) return;
        e.preventDefault();
        setCursor((c) => Math.min(c + 1, last));
        break;
      case "ArrowUp":
        if (!showDropdown) return;
        e.preventDefault();
        setCursor((c) => Math.max(c - 1, -1));
        break;
      case "Enter":
        if (cursor >= 0 && cursor < last) go(visible[cursor]);
        else if (query.trim()) goAll();
        break;
      case "Escape":
        if (open && query) setOpen(false);
        else {
          setQuery("");
          setOpen(false);
          onClose?.();
        }
        break;
      default:
        break;
    }
  };

  const activeId =
    cursor >= 0 && cursor < last
      ? `sk-hit-${keyOf(visible[cursor])}`
      : cursor === last
        ? "sk-hit-all"
        : undefined;

  return (
    <div className="sk-topbar__search sk-relative">
      <div
        className={cx("sk-input-group sk-search", showDropdown && "is-open")}
        role="combobox"
        aria-expanded={showDropdown}
        aria-haspopup="listbox"
        aria-controls="sk-search-results"
      >
        <Icon name="search" />
        <input
          ref={inputRef}
          className="sk-input"
          type="text"
          inputMode="search"
          enterKeyHint="search"
          autoComplete="off"
          spellCheck={false}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder="Search transactions, invoices, customers…"
          aria-label="Search"
          aria-autocomplete="list"
          aria-activedescendant={activeId}
        />
        {query ? (
          <button
            type="button"
            className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon"
            aria-label="Clear search"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
          >
            <Icon name="close" size={16} mono />
          </button>
        ) : (
          <kbd className="sk-hide-mobile" aria-hidden="true">
            {shortcutLabel()}
          </kbd>
        )}
      </div>

      {showDropdown && (
        <ul
          className="sk-menu sk-search-results"
          id="sk-search-results"
          role="listbox"
          aria-label="Search results"
        >
          {hits.length === 0 ? (
            <li className="sk-menu__item sk-text-muted" aria-disabled="true">
              <Icon name={isLoading ? "search" : "info"} mono />
              {isLoading ? "Searching…" : `No matches for “${query}”`}
            </li>
          ) : (
            grouped.map(([kind, list]) => (
              <li key={kind} role="group" aria-label={KIND_LABEL[kind] ?? kind}>
                <div className="sk-eyebrow sk-search-results__group">
                  {KIND_LABEL[kind] ?? kind}
                </div>
                <ul className="sk-search-results__list">
                  {list.slice(0, PER_GROUP).map((h) => {
                    const i = indexOf.get(keyOf(h)) ?? -1;
                    const isActive = i === cursor;
                    return (
                      <li key={keyOf(h)}>
                        <button
                          type="button"
                          id={`sk-hit-${keyOf(h)}`}
                          role="option"
                          aria-selected={isActive}
                          className={cx(
                            "sk-menu__item",
                            isActive && "is-active",
                          )}
                          onMouseDown={(e) => e.preventDefault()}
                          onMouseEnter={() => setCursor(i)}
                          onClick={() => go(h)}
                        >
                          <Icon name={ICON[h.kind] ?? "folder"} />
                          <span className="sk-grow sk-truncate">
                            <span className="sk-weight-medium">{h.title}</span>
                            {h.subtitle && (
                              <span className="sk-text-muted">
                                {" "}
                                · {h.subtitle}
                              </span>
                            )}
                          </span>
                          {h.amount !== null && (
                            <span
                              className={cx(
                                "sk-tabular sk-small sk-text-secondary",
                                h.kind === "transaction" &&
                                  h.amount > 0 &&
                                  "sk-amount--in",
                              )}
                            >
                              {money(h.amount, "EUR", {
                                signed: h.kind === "transaction",
                              })}
                            </span>
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))
          )}
          <li className="sk-menu__sep" role="separator" />
          <li>
            <button
              type="button"
              id="sk-hit-all"
              role="option"
              aria-selected={cursor === last}
              className={cx(
                "sk-menu__item sk-text-brand",
                cursor === last && "is-active",
              )}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setCursor(last)}
              onClick={goAll}
            >
              <Icon name="arrow-right" mono />
              <span className="sk-grow">
                See all{" "}
                {hits.length >= LIMIT ? "results" : plural(hits.length, "result")}
              </span>
              <kbd aria-hidden="true">↵</kbd>
            </button>
          </li>
        </ul>
      )}
    </div>
  );
}
