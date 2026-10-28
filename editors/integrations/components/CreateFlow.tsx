import {
  addDocument,
  dispatchActions,
  useSelectedDrive,
} from "@powerhousedao/reactor-browser";
import type {
  IntegrationAccess,
  IntegrationKind,
  IntervalUnit,
} from "document-models/integration";
import { generateId } from "document-model";
import { useMemo, useState, type ReactNode } from "react";
import {
  accessOptions,
  createActions,
  defaultChoices,
  defaultName,
  defaultSince,
  INTEGRATION_TYPE,
  INTERVALS,
  KINDS,
  kindInfo,
  providerInfo,
  providersFor,
  setupSummary,
  type AccessOption,
  type CreateChoices,
} from "../../sektar/kit/integrations.js";
import {
  Alert,
  Badge,
  Button,
  Field,
  Icon,
  Input,
  Select,
  Steps,
  Switch,
} from "../../sektar/kit/ui.js";

/** The flow's steps, as they appear in the hash (`#add`, `#add/connect`, …). */
export const STEPS = [
  "add",
  "add/connect",
  "add/how-much",
  "add/name",
] as const;
export type CreateStep = (typeof STEPS)[number];

const TITLES = ["What to bring in", "Connect", "How much", "Name and create"];

/**
 * Whether this browser runs on the computer that fetches (the runner): only
 * there can the provider's sign-in come back (to 127.0.0.1). A loopback page
 * is the runner's own; anything else (the phone, the tunnel) hands the
 * sign-in over. Step 3 of the pilot asks the switchboard instead.
 */
function onRunner(): boolean {
  return ["localhost", "127.0.0.1", "[::1]"].includes(window.location.hostname);
}

/**
 * Creating an integration, in the user's words (design system: Patterns ·
 * Integrations · Create): what to bring in; connecting the account, with what
 * Sektar may do there chosen first, so nobody wonders about their data in the
 * steps after; how much; a name. Create writes only the integration document:
 * the reconciler on the runner does the rest, after the sign-in there.
 */
export function CreateFlow({
  step,
  go,
  onDone,
}: {
  step: CreateStep;
  go: (step: CreateStep) => void;
  onDone: () => void;
}) {
  const now = useMemo(() => new Date(), []);
  const runner = useMemo(onRunner, []);
  const [drive] = useSelectedDrive();
  const [kind, setKind] = useState<IntegrationKind | null>(null);
  const [choices, setChoices] = useState<CreateChoices | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A reload or a deep link past a step without its choice starts over.
  const wanted = STEPS.indexOf(step);
  const at = choices ? wanted : kind ? Math.min(wanted, 1) : 0;
  const patch = (p: Partial<CreateChoices>) =>
    setChoices((c) => (c ? { ...c, ...p } : c));

  const pickKind = (k: IntegrationKind) => {
    if (k !== kind) setChoices(null);
    setKind(k);
    go("add/connect");
  };
  const pickProvider = (provider: string) => {
    if (!kind) return;
    setChoices((c) =>
      c && c.provider === provider ? c : defaultChoices(kind, provider, now),
    );
  };

  const create = async () => {
    if (!choices || !drive) return;
    setBusy(true);
    setError(null);
    try {
      const name =
        choices.name.trim() || defaultName(choices.kind, choices.provider);
      const node = await addDocument(drive.header.id, name, INTEGRATION_TYPE);
      await dispatchActions(createActions(choices, now, generateId()), node.id);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  let body: ReactNode;
  if (at === 0) {
    body = (
      <Panel
        title="What do you want to bring in?"
        lead="Pick one. You can add more integrations later."
      >
        <div className="sk-intg-tiles">
          {KINDS.map((k) => (
            <Tile
              key={k.kind}
              disabled={!k.available}
              selected={kind === k.kind}
              onClick={() => pickKind(k.kind)}
              mark={<Icon name={k.icon} />}
              title={k.label}
              lead={k.lead}
              badge={k.available ? undefined : "Coming soon"}
            />
          ))}
        </div>
      </Panel>
    );
  } else if (at === 1 && kind) {
    const info = kindInfo(kind);
    const provider = providerInfo(choices?.provider);
    body = (
      <Panel
        title={`Connect your ${info?.label.toLowerCase() ?? "account"}`}
        lead="Where it is, and what Sektar may do there. You choose this before anything is set up."
        back={() => go("add")}
      >
        <div className="sk-intg-tiles">
          {providersFor(kind).map((p) => (
            <Tile
              key={p.id}
              disabled={!p.available}
              selected={choices?.provider === p.id}
              onClick={() => pickProvider(p.id)}
              mark={p.mark || <Icon name={info?.icon ?? "sync"} />}
              title={p.label}
              lead={p.lead}
              badge={p.available ? undefined : p.badge}
            />
          ))}
        </div>
        {choices && provider && (
          <>
            <AccessChoice
              options={accessOptions(choices.provider)}
              value={choices.access}
              onChange={(access) => patch({ access })}
            />
            <SignIn runner={runner} provider={provider.label} />
            <Footer
              back={() => go("add")}
              next={() => go("add/how-much")}
              nextLabel="Continue"
            />
          </>
        )}
      </Panel>
    );
  } else if (at === 2 && choices) {
    const history = choices.history;
    const interval = `${choices.every.value}-${choices.every.unit}`;
    body = (
      <Panel
        title="How much?"
        lead="You can change all of this later."
        back={() => go("add/connect")}
      >
        <div className="sk-intg-row">
          <div>
            <div className="sk-integration__label">Calendars</div>
            <div className="sk-integration__meta">
              All calendars you own. You can pick specific ones after signing
              in.
            </div>
          </div>
        </div>
        <div className="sk-intg-row">
          <div>
            <div className="sk-integration__label">Changes as they happen</div>
            <div className="sk-integration__meta">
              New, moved and cancelled events
            </div>
          </div>
          <Switch
            checked={choices.live}
            onChange={(live) => patch({ live })}
            label="Live updates"
          />
        </div>
        {choices.live && (
          <Field label="Check every">
            <Select
              value={interval}
              onChange={(e) => {
                const found = INTERVALS.find(
                  (i) => `${i.value}-${i.unit}` === e.target.value,
                );
                if (found)
                  patch({
                    every: {
                      value: found.value,
                      unit: found.unit as IntervalUnit,
                    },
                  });
              }}
              style={{ maxWidth: 240 }}
            >
              {INTERVALS.map((i) => (
                <option
                  key={`${i.value}-${i.unit}`}
                  value={`${i.value}-${i.unit}`}
                >
                  {i.label}
                </option>
              ))}
            </Select>
          </Field>
        )}
        <fieldset className="sk-stack sk-stack--3 sk-intg-fieldset">
          <legend className="sk-label">Older events</legend>
          <label className="sk-check">
            <input
              type="radio"
              name="intg-history"
              checked={history.kind === "none"}
              onChange={() => patch({ history: { kind: "none" } })}
            />{" "}
            None, only from today
          </label>
          <label className="sk-check sk-intg-since">
            <input
              type="radio"
              name="intg-history"
              checked={history.kind === "since"}
              onChange={() =>
                patch({
                  history: {
                    kind: "since",
                    date:
                      history.kind === "since"
                        ? history.date
                        : defaultSince(now),
                  },
                })
              }
            />{" "}
            Since
            <Input
              type="date"
              size="sm"
              value={
                history.kind === "since" ? history.date : defaultSince(now)
              }
              max={now.toISOString().slice(0, 10)}
              onChange={(e) =>
                patch({ history: { kind: "since", date: e.target.value } })
              }
              aria-label="Since"
            />
          </label>
          <label className="sk-check">
            <input
              type="radio"
              name="intg-history"
              checked={history.kind === "everything"}
              onChange={() => patch({ history: { kind: "everything" } })}
            />{" "}
            Everything in the account
          </label>
          <span className="sk-hint">Each includes the next 12 months.</span>
        </fieldset>
        <Summary text={setupSummary(choices, now)} />
        <Footer
          back={() => go("add/connect")}
          next={() => go("add/name")}
          nextLabel="Continue"
        />
      </Panel>
    );
  } else if (at === 3 && choices) {
    body = (
      <Panel
        title="Name it"
        lead="As it appears on the Integrations page."
        back={() => go("add/how-much")}
      >
        <Field label="Name">
          <Input
            value={choices.name}
            onChange={(e) => patch({ name: e.target.value })}
            placeholder={defaultName(choices.kind, choices.provider)}
            maxLength={80}
          />
        </Field>
        <Summary text={setupSummary(choices, now)} />
        {!runner && (
          <p className="sk-small sk-text-muted">
            After Create, finish the sign-in on the computer that runs Sektar.
            Until then the card says it is waiting.
          </p>
        )}
        {error && (
          <Alert tone="danger" title="Could not create the integration">
            {error}
          </Alert>
        )}
        <Footer
          back={() => go("add/how-much")}
          next={() => void create()}
          nextLabel={busy ? "Creating…" : "Create"}
          disabled={busy || !drive}
        />
      </Panel>
    );
  }

  const done = (i: number) =>
    i === 0
      ? kindInfo(kind)?.label
      : i === 1 && choices
        ? `${providerInfo(choices.provider)?.label ?? ""} · ${choices.access === "READ_WRITE" ? "read and write" : "read only"}`
        : undefined;

  return (
    <div className="sk-intg-create">
      <div className="sk-intg-create__steps">
        <Steps
          steps={TITLES.map((title, i) => ({
            title,
            desc: i < at ? done(i) : undefined,
          }))}
          current={at}
        />
      </div>
      <div className="sk-intg-create__phone-step sk-small sk-text-muted">
        Step {at + 1} of {STEPS.length} · {TITLES[at]}
      </div>
      {body}
    </div>
  );
}

/** What Sektar may do with the account: the options side by side, with what each allows and rules out. */
function AccessChoice({
  options,
  value,
  onChange,
}: {
  options: AccessOption[];
  value: IntegrationAccess;
  onChange: (access: IntegrationAccess) => void;
}) {
  if (options.length === 0) return null;
  return (
    <fieldset className="sk-intg-fieldset sk-stack sk-stack--3">
      <legend className="sk-label sk-mb-1">What Sektar may do</legend>
      <div className="sk-intg-access">
        {options.map((o) => (
          <label
            key={o.access}
            className={
              value === o.access
                ? "sk-intg-access__option is-selected"
                : "sk-intg-access__option"
            }
          >
            <span className="sk-intg-access__head">
              <input
                type="radio"
                name="intg-access"
                checked={value === o.access}
                onChange={() => onChange(o.access)}
              />
              <span className="sk-weight-medium">{o.label}</span>
              {o.recommended && <Badge tone="success">Recommended</Badge>}
            </span>
            <ul className="sk-intg-access__list">
              {o.can.map((c) => (
                <li key={c}>
                  <Icon name="check" size={16} mono className="sk-intg-yes" />
                  {c}
                </li>
              ))}
              {o.cannot.map((c) => (
                <li key={c} className="sk-text-muted">
                  <Icon name="close" size={16} mono className="sk-intg-no" />
                  {c}
                </li>
              ))}
            </ul>
            <span className="sk-caption sk-text-muted">{o.permission}</span>
          </label>
        ))}
      </div>
      <span className="sk-hint">
        The provider asks you to confirm exactly this on its own sign-in screen.
        You can change it later; Sektar then asks you to sign in again.
      </span>
    </fieldset>
  );
}

/**
 * The connection itself. On the computer that runs Sektar this is the
 * sign-in; anywhere else it is handed over, and the card asks for it there.
 */
function SignIn({ runner, provider }: { runner: boolean; provider: string }) {
  if (runner) {
    return (
      <div className="sk-intg-signin">
        <div>
          <div className="sk-integration__label">Sign in</div>
          <div className="sk-integration__meta">
            A {provider} window opens; you come back here after.
          </div>
        </div>
        <Button
          variant="secondary"
          disabled
          title="Arrives in the next pilot step"
        >
          Sign in with {provider}
        </Button>
        <p className="sk-hint" style={{ gridColumn: "1 / -1", margin: 0 }}>
          Signing in arrives in the next pilot step. Continue for now: the card
          asks you to sign in.
        </p>
      </div>
    );
  }
  return (
    <div className="sk-intg-signin sk-intg-signin--handoff">
      <Icon name="monitor" />
      <div>
        <div className="sk-integration__label">
          You sign in on the computer that runs Sektar
        </div>
        <div className="sk-integration__meta">
          {provider} sends the sign-in back to that computer, so it has to
          happen there; your sign-in never passes through Sektar. Set the rest
          up here now: the next time you open Sektar on that computer, it asks
          you to sign in, and then everything starts.
        </div>
      </div>
    </div>
  );
}

function Panel({
  title,
  lead,
  back,
  children,
}: {
  title: string;
  lead?: string;
  back?: () => void;
  children: ReactNode;
}) {
  return (
    <section className="sk-card sk-stack sk-stack--6 sk-intg-create__panel">
      {back && (
        <button
          type="button"
          className="sk-btn sk-btn--ghost sk-btn--sm sk-intg-create__back"
          onClick={back}
        >
          <Icon name="chevron-right" size={16} className="sk-intg-flip" /> Back
        </button>
      )}
      <div>
        <h2 className="sk-h3" style={{ margin: 0 }}>
          {title}
        </h2>
        {lead && <p className="sk-small sk-text-muted sk-mt-1">{lead}</p>}
      </div>
      {children}
    </section>
  );
}

function Tile({
  mark,
  title,
  lead,
  badge,
  selected,
  disabled,
  onClick,
}: {
  mark: ReactNode;
  title: string;
  lead: string;
  badge?: string;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={["sk-action-tile", "sk-intg-tile", selected && "is-selected"]
        .filter(Boolean)
        .join(" ")}
      disabled={disabled}
      aria-pressed={selected}
      onClick={onClick}
    >
      <span className="sk-avatar sk-avatar--square sk-avatar--lg">{mark}</span>
      <span>{title}</span>
      <span className="sk-caption sk-text-muted sk-intg-tile__lead">
        {lead}
      </span>
      {badge && <Badge tone="outline">{badge}</Badge>}
    </button>
  );
}

function Summary({ text }: { text: string }) {
  return (
    <div className="sk-intg-summary sk-small">
      <b>What happens next.</b> {text}
    </div>
  );
}

function Footer({
  back,
  next,
  nextLabel,
  disabled,
}: {
  back: () => void;
  next: () => void;
  nextLabel: string;
  disabled?: boolean;
}) {
  return (
    <div className="sk-row sk-row--between">
      <Button variant="ghost" onClick={back}>
        Back
      </Button>
      <Button variant="primary" onClick={next} disabled={disabled}>
        {nextLabel}
      </Button>
    </div>
  );
}
