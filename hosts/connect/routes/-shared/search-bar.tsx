import { useEffect, useRef } from "react";
import { Icon } from "../../../../editors/sektar/kit/ui.js";
import { useSearch } from "./search.js";

// The design system's top-bar search: a pill input group with the shortcut
// hint, as in the "Forms" and "App shell" sections of the spec. For now it
// filters the page in view (Mail, Files, …, through the search context);
// the cross-document results menu is off until advanced search works.
// Cmd/Ctrl+K (or "/") focuses it from anywhere.

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
  const inputRef = useRef<HTMLInputElement>(null);

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
      } else if (e.key === "/" && !typing) {
        e.preventDefault();
        el.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") inputRef.current?.blur();
    if (e.key === "Escape") {
      if (query) setQuery("");
      else {
        inputRef.current?.blur();
        onClose?.();
      }
    }
  };

  return (
    <div className="sk-topbar__search sk-relative">
      <div className="sk-input-group sk-search">
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
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Filter this page…"
          aria-label="Filter this page"
        />
        {query ? (
          <button
            type="button"
            className="sk-btn sk-btn--ghost sk-btn--sm sk-btn--icon"
            aria-label="Clear"
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
    </div>
  );
}
