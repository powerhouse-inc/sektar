import {
  ChatPanel,
  getHostAiTools,
  useReactorChat,
  type AiConnection,
  type AiGatewayStatus,
  type UseAiGatewayResult,
} from "@powerhousedao/reactor-browser/ai";
import { useState, type FormEvent, type ReactNode } from "react";
import { assistantInstructions } from "../../../../ai/instructions.js";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
} from "../../../../editors/sektar/kit/ui.js";
import { Pane } from "../../../../editors/sektar/kit/workspace.js";

const SUGGESTIONS = [
  "Which invoices are overdue?",
  "Which invoices are still drafts?",
  "What is on my calendar this week?",
];

/** Under the welcome, when the gateway could not say who is asking. */
export function AssistantUnavailable({ message }: { message: string }) {
  return (
    <div className="sk-assistant">
      <Alert tone="warning" title="The assistant is not available">
        {message}
      </Alert>
    </div>
  );
}

/** The conversation as a pane: its input stays put, only the messages scroll. */
export function Conversation({
  connection,
  model,
  trailing,
}: {
  connection: AiConnection;
  model: string;
  /** After Clear in the pane's header */
  trailing?: ReactNode;
}) {
  const chat = useReactorChat(getHostAiTools, {
    connection,
    instructions: assistantInstructions(new Date()),
  });
  return (
    <Pane
      className="sk-assistant sk-assistant__conversation"
      title="Assistant"
      titleDisplay
      flush
      header={
        <>
          <Badge tone="success" dot>
            Ready
          </Badge>
          <span className="sk-caption sk-assistant__model">{model}</span>
        </>
      }
      trailing={
        <>
          <Button
            variant="ghost"
            size="sm"
            onClick={chat.clear}
            disabled={chat.messages.length === 0}
          >
            Clear
          </Button>
          {trailing}
        </>
      }
    >
      <ChatPanel
        chat={chat}
        allowImages
        suggestions={SUGGESTIONS}
        emptyState={
          <p>
            Ask about your invoices, mail, calendar, files or trips, or attach a
            photo of a receipt. Anything that changes your data asks you first.
          </p>
        }
      />
    </Pane>
  );
}

export function KeyCard({
  status,
  gateway,
}: {
  status: AiGatewayStatus;
  gateway: UseAiGatewayResult;
}) {
  const [replacing, setReplacing] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const showForm = !status.configured || replacing;

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(undefined);
    try {
      await action();
      setValue("");
      setReplacing(false);
      setResetting(false);
    } catch (failure) {
      setError(failure instanceof Error ? failure.message : String(failure));
    } finally {
      setBusy(false);
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void run(() => gateway.setKey(value));
  };

  return (
    <Card
      compact
      className="sk-assistant__key"
      title="OpenRouter key"
      actions={
        status.configured ? (
          <Badge tone="success">Configured</Badge>
        ) : (
          <Badge tone="warning">Not configured</Badge>
        )
      }
    >
      {status.configured ? (
        <p className="sk-caption">
          <code>{status.keyHint}</code>
          {status.keySetAt &&
            ` · set ${new Date(status.keySetAt).toLocaleDateString()}`}
        </p>
      ) : (
        <p>The assistant needs an OpenRouter key before it can start.</p>
      )}
      {showForm ? (
        <form className="sk-assistant__key-form" onSubmit={submit}>
          <Field
            label={status.configured ? "New key" : "Key"}
            hint="Tested with OpenRouter, then stored encrypted on the server. It is never shown again."
            error={error}
          >
            <Input
              type="password"
              name="openrouter-key"
              autoComplete="off"
              spellCheck={false}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="sk-or-v1-…"
            />
          </Field>
          <div className="sk-assistant__key-actions">
            <Button
              type="submit"
              variant="primary"
              disabled={busy || value.trim() === ""}
            >
              {busy ? "Testing…" : "Save and test"}
            </Button>
            {replacing && (
              <Button
                variant="ghost"
                disabled={busy}
                onClick={() => {
                  setReplacing(false);
                  setValue("");
                  setError(undefined);
                }}
              >
                Cancel
              </Button>
            )}
          </div>
        </form>
      ) : (
        <div className="sk-assistant__key-actions">
          <Button size="sm" onClick={() => setReplacing(true)}>
            Replace key
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setResetting(true)}>
            Reset key
          </Button>
        </div>
      )}
      {resetting && (
        <Modal
          title="Reset the OpenRouter key?"
          onClose={() => setResetting(false)}
          footer={
            <>
              <Button disabled={busy} onClick={() => setResetting(false)}>
                Cancel
              </Button>
              <Button
                variant="danger"
                disabled={busy}
                onClick={() => void run(gateway.resetKey)}
              >
                Reset key
              </Button>
            </>
          }
        >
          <p>The assistant stops working until a new key is set.</p>
          {error && <p className="sk-hint">{error}</p>}
        </Modal>
      )}
    </Card>
  );
}
