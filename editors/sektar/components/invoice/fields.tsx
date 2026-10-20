// The invoice editor's fields. Each commits on blur or Enter and restores on
// Escape, so typing never dispatches a half-written value. Locked (an issued
// invoice) they read as plain text: what was invoiced is fixed.
import { useEffect, useRef, useState, type ReactNode } from "react";
import { fromDateInput, toDateInput } from "../../kit/format.js";
import { fmtNumber, parseNumber } from "../../kit/invoice.js";
import { cx } from "../../kit/ui.js";

/** A draft that follows the document while it is not being edited. */
function useCommit<T>(value: T, toText: (v: T) => string) {
  const [draft, setDraft] = useState(() => toText(value));
  const editing = useRef(false);
  const text = toText(value);
  useEffect(() => {
    if (!editing.current) setDraft(text);
  }, [text]);
  return {
    draft,
    setDraft,
    begin: () => {
      editing.current = true;
    },
    end: () => {
      editing.current = false;
    },
    reset: () => {
      editing.current = false;
      setDraft(text);
    },
  };
}

type Common = {
  label: string;
  hint?: ReactNode;
  locked?: boolean;
  className?: string;
  required?: boolean;
};

function Shell({
  label,
  hint,
  required,
  className,
  children,
  error,
}: Common & { children: ReactNode; error?: string | null }) {
  return (
    <label className={cx("sk-field", error && "sk-field--error", className)}>
      <span className={cx("sk-label", required && "sk-label--required")}>{label}</span>
      {children}
      {(error || hint) && <span className="sk-hint">{error ?? hint}</span>}
    </label>
  );
}

/** A locked field: the label over the value, or a quiet dash. */
export function ReadField({ label, value, className }: { label: string; value: ReactNode; className?: string }) {
  return (
    <div className={cx("sk-field sk-inv-read", className)}>
      <span className="sk-label">{label}</span>
      <span className="sk-inv-read__value">{value || <span className="sk-text-muted">—</span>}</span>
    </div>
  );
}

export function TextField({
  value,
  onCommit,
  placeholder,
  multiline,
  mono,
  upper,
  display,
  ...common
}: Common & {
  value: string | null | undefined;
  onCommit: (next: string | null) => void;
  placeholder?: string;
  multiline?: boolean;
  mono?: boolean;
  upper?: boolean;
  /** How the locked field reads, when not as stored (an IBAN in groups) */
  display?: ReactNode;
}) {
  const c = useCommit(value ?? null, (v) => v ?? "");
  if (common.locked) return <ReadField label={common.label} value={display ?? value} className={common.className} />;
  const commit = () => {
    c.end();
    const next = c.draft.trim() ? c.draft.trim() : null;
    if (next !== (value ?? null)) onCommit(upper && next ? next.toUpperCase() : next);
  };
  const props = {
    value: c.draft,
    placeholder,
    onFocus: c.begin,
    onBlur: commit,
    onChange: (e: { target: { value: string } }) => c.setDraft(e.target.value),
    onKeyDown: (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      if (e.key === "Escape") {
        c.reset();
        (e.target as HTMLElement).blur();
      }
      if (e.key === "Enter" && !multiline) (e.target as HTMLElement).blur();
    },
  };
  return (
    <Shell {...common}>
      {multiline ? (
        <textarea className="sk-textarea" rows={3} {...props} />
      ) : (
        <input className={cx("sk-input", mono && "sk-font-mono")} {...props} />
      )}
    </Shell>
  );
}

export function NumberField({
  value,
  onCommit,
  placeholder,
  suffix,
  min,
  ...common
}: Common & {
  value: number | null | undefined;
  onCommit: (next: number | null) => void;
  placeholder?: string;
  suffix?: ReactNode;
  min?: number;
}) {
  const c = useCommit(value ?? null, (v) => fmtNumber(v));
  const [error, setError] = useState<string | null>(null);
  if (common.locked)
    return (
      <ReadField
        label={common.label}
        value={value === null || value === undefined ? null : (<>{fmtNumber(value)} {suffix}</>)}
        className={common.className}
      />
    );
  const commit = () => {
    c.end();
    const raw = c.draft.trim();
    const next = raw ? parseNumber(raw) : null;
    if (raw && next === null) {
      setError("Not a number");
      return;
    }
    if (next !== null && min !== undefined && next < min) {
      setError(`At least ${min}`);
      return;
    }
    setError(null);
    if (next !== (value ?? null)) onCommit(next);
  };
  return (
    <Shell {...common} error={error}>
      <span className={cx("sk-input-group", suffix ? "sk-inv-suffix" : undefined)}>
        <input
          className="sk-input sk-inv-num"
          inputMode="decimal"
          value={c.draft}
          placeholder={placeholder}
          onFocus={c.begin}
          onBlur={commit}
          onChange={(e) => c.setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              c.reset();
              setError(null);
              e.currentTarget.blur();
            }
            if (e.key === "Enter") e.currentTarget.blur();
          }}
        />
        {suffix && <span className="sk-inv-suffix__text">{suffix}</span>}
      </span>
    </Shell>
  );
}

export function DateField({
  value,
  onCommit,
  readValue,
  ...common
}: Common & {
  value: string | null | undefined;
  onCommit: (next: string | null) => void;
  /** How the locked field reads */
  readValue?: ReactNode;
}) {
  if (common.locked)
    return <ReadField label={common.label} value={readValue} className={common.className} />;
  return (
    <Shell {...common}>
      <input
        type="date"
        className="sk-input"
        value={toDateInput(value)}
        onChange={(e) => {
          const next = e.target.value ? fromDateInput(e.target.value) : null;
          if (toDateInput(next) !== toDateInput(value)) onCommit(next);
        }}
      />
    </Shell>
  );
}

export function SelectField<T extends string>({
  value,
  options,
  onChange,
  readValue,
  ...common
}: Common & {
  value: T | "";
  options: readonly { value: T | ""; label: string }[];
  onChange: (next: T | "") => void;
  readValue?: ReactNode;
}) {
  if (common.locked)
    return (
      <ReadField
        label={common.label}
        value={readValue ?? options.find((o) => o.value === value)?.label}
        className={common.className}
      />
    );
  return (
    <Shell {...common}>
      <select className="sk-select" value={value} onChange={(e) => onChange(e.target.value as T | "")}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Shell>
  );
}

/** A section of the details pane: a heading, a caption, then the content. */
export function Section({
  id,
  title,
  caption,
  count,
  actions,
  flags,
  children,
}: {
  id: string;
  title: ReactNode;
  caption?: ReactNode;
  count?: number;
  actions?: ReactNode;
  /** Checks that point here: a count in the heading */
  flags?: number;
  children: ReactNode;
}) {
  return (
    <section className="sk-file-section sk-inv-section" id={`inv-${id}`} data-section={id}>
      <header className="sk-inv-section__header">
        <span className="sk-file-section__header">
          <h3 className="sk-file-section__title">
            {title}
            {count !== undefined && <span className="sk-pane__count">{count}</span>}
            {!!flags && (
              <span className="sk-inv-flag" title={`${flags} to check`}>
                {flags}
              </span>
            )}
          </h3>
          {caption && <span className="sk-caption">{caption}</span>}
        </span>
        {actions && <span className="sk-inv-section__actions">{actions}</span>}
      </header>
      {children}
    </section>
  );
}
