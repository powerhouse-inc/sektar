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

/**
 * The sign-in on a card that waits for one. On the computer that runs Sektar
 * it is the button; anywhere else a small "sign in here" for someone who is
 * on that computer through another address (the provider sends the sign-in
 * back to that computer, so from any other device it cannot finish). The
 * provider's page opens in a window; when the switchboard has the token, the
 * card asks the reconciler to look again.
 */
export function SignIn({ doc }: { doc: IntegrationDocument }) {
  const url = useWorkflowRuntimeUrl();
  const s = doc.state.global;
  const provider = providerInfo(s.provider)?.label ?? "the provider";
  const connectionId = s.resources.connectionId;
  const runner = onRunner();
  const [phase, setPhase] = useState<"idle" | "waiting" | "done" | "error">(
    "idle",
  );
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  if (!connectionId) {
    return (
      <span className="sk-small sk-text-muted">Getting the sign-in ready…</span>
    );
  }

  const begin = async () => {
    setError(null);
    // Opened now, inside the click, so no popup blocker stops it.
    const popup = window.open(
      "",
      "sektar-sign-in",
      "popup,width=520,height=680",
    );
    try {
      const started = await startSignIn(url, connectionId);
      if (popup) popup.location.href = started.authorizationUrl;
      else window.location.assign(started.authorizationUrl);
      setPhase("waiting");
      const until = Date.now() + GIVE_UP_MS;
      const poll = async () => {
        const attempt = await signInStatus(url, started.state).catch(
          () => null,
        );
        if (attempt?.status === "OK") {
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
        if (attempt?.status === "ERROR" || Date.now() > until) {
          setPhase("error");
          setError(attempt?.error ?? "The sign-in did not finish");
          return;
        }
        timer.current = setTimeout(() => void poll(), POLL_MS);
      };
      timer.current = setTimeout(() => void poll(), POLL_MS);
    } catch (e) {
      popup?.close();
      setPhase("error");
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  if (phase === "done") {
    return <span className="sk-small">Signed in. Setting up…</span>;
  }
  return (
    <div className="sk-stack sk-stack--2">
      {runner ? (
        <Button
          variant="primary"
          size="sm"
          onClick={() => void begin()}
          disabled={phase === "waiting"}
        >
          {phase === "waiting"
            ? "Waiting for Google…"
            : `Sign in with ${provider}`}
        </Button>
      ) : (
        <button
          type="button"
          className="sk-btn sk-btn--link sk-btn--sm sk-intg-signin-here"
          onClick={() => void begin()}
          disabled={phase === "waiting"}
        >
          {phase === "waiting"
            ? "Waiting for the sign-in…"
            : `On ${s.runner?.label ?? "that computer"}? Sign in here`}
        </button>
      )}
      {error && <span className="sk-small sk-text-danger">{error}</span>}
    </div>
  );
}
