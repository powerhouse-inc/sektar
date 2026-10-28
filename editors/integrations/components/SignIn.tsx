import { dispatchActions } from "@powerhousedao/reactor-browser";
import { actions, type IntegrationDocument } from "document-models/integration";
import { generateId } from "document-model";
import { useEffect, useRef, useState } from "react";
import { providerInfo } from "../../sektar/kit/integrations.js";
import { Button } from "../../sektar/kit/ui.js";
import {
  signInStatus,
  startSignIn,
  useWorkflowRuntimeUrl,
} from "../../sektar/kit/workflow-runtime.js";
import { onRunner } from "./CreateFlow.js";

const POLL_MS = 1500;
const GIVE_UP_MS = 10 * 60 * 1000;

type Phase = "idle" | "waiting" | "done" | "stopped";

/**
 * The sign-in on a card that waits for one. On the computer that runs Sektar
 * it is the button; anywhere else a small "sign in here" for someone who is
 * on that computer through another address (the provider sends the sign-in
 * back to that computer, so from any other device it cannot finish). The
 * provider's page opens in a window; when the switchboard has the token, the
 * card asks the reconciler to look again.
 *
 * A provider that refuses (an account the app does not allow, a cancelled
 * consent) often never sends the browser back, so the switchboard never
 * hears of it: the card stops waiting when the window closes, and Try again
 * and Cancel are there all along.
 */
export function SignIn({ doc }: { doc: IntegrationDocument }) {
  const url = useWorkflowRuntimeUrl();
  const s = doc.state.global;
  const provider = providerInfo(s.provider)?.label ?? "the provider";
  const connectionId = s.resources.connectionId;
  const runner = onRunner();
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const popup = useRef<Window | null>(null);
  // Each attempt's number: a poll of an older attempt does nothing.
  const attempt = useRef(0);

  const stopPolling = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };
  useEffect(() => stopPolling, []);

  if (!connectionId) {
    return (
      <span className="sk-small sk-text-muted">Getting the sign-in ready…</span>
    );
  }

  const stop = (text: string | null) => {
    attempt.current += 1;
    stopPolling();
    setPhase("stopped");
    setMessage(text);
  };

  const cancel = () => {
    popup.current?.close();
    stop(null);
    setPhase("idle");
  };

  const begin = async () => {
    const mine = ++attempt.current;
    stopPolling();
    setMessage(null);
    // Opened now, inside the click, so no popup blocker stops it; a retry
    // reuses the window by name.
    const win = window.open("", "sektar-sign-in", "popup,width=520,height=680");
    popup.current = win;
    try {
      const started = await startSignIn(url, connectionId);
      if (mine !== attempt.current) return;
      if (win) win.location.href = started.authorizationUrl;
      else window.location.assign(started.authorizationUrl);
      setPhase("waiting");
      const until = Date.now() + GIVE_UP_MS;
      const poll = async () => {
        if (mine !== attempt.current) return;
        const state = await signInStatus(url, started.state).catch(() => null);
        if (mine !== attempt.current) return;
        if (state?.status === "OK") {
          setPhase("done");
          await dispatchActions(
            [
              actions.requestCheck({
                id: generateId(),
                requestedAt: new Date().toISOString(),
                requestedBy: "sign-in",
              }),
            ],
            doc.header.id,
          );
          return;
        }
        if (state?.status === "ERROR") {
          stop(state.error ?? `${provider} refused the sign-in`);
          return;
        }
        if (win?.closed) {
          stop("The sign-in window closed before it finished.");
          return;
        }
        if (Date.now() > until) {
          stop("The sign-in took too long.");
          return;
        }
        timer.current = setTimeout(() => void poll(), POLL_MS);
      };
      timer.current = setTimeout(() => void poll(), POLL_MS);
    } catch (e) {
      if (mine !== attempt.current) return;
      win?.close();
      stop(e instanceof Error ? e.message : String(e));
    }
  };

  if (phase === "done") {
    return <span className="sk-small">Signed in. Setting up…</span>;
  }

  if (phase === "waiting") {
    return (
      <div className="sk-intg-waiting" role="status">
        <span className="sk-spinner" aria-hidden="true" />
        <div>
          <div className="sk-intg-waiting__title">Waiting for {provider}</div>
          <div className="sk-small sk-text-muted">
            Finish signing in, in the window that opened.
          </div>
          <div className="sk-intg-waiting__actions">
            <button type="button" onClick={() => void begin()}>
              Try again
            </button>
            <span aria-hidden="true">·</span>
            <button type="button" onClick={cancel}>
              Cancel
            </button>
          </div>
        </div>
      </div>
    );
  }

  const label =
    phase === "stopped"
      ? "Try again"
      : runner
        ? `Sign in with ${provider}`
        : `On ${s.runner?.label ?? "that computer"}? Sign in here`;
  return (
    <div className="sk-stack sk-stack--2 sk-intg-signin-next">
      {message && <span className="sk-small sk-text-danger">{message}</span>}
      {runner || phase === "stopped" ? (
        <Button
          variant={runner ? "primary" : "secondary"}
          size="sm"
          className={phase === "stopped" ? "sk-intg-retry" : undefined}
          onClick={() => void begin()}
        >
          {label}
        </Button>
      ) : (
        <button
          type="button"
          className="sk-btn sk-btn--link sk-btn--sm sk-intg-signin-here"
          onClick={() => void begin()}
        >
          {label}
        </button>
      )}
    </div>
  );
}
