import { getConnectReactorTools } from "@powerhousedao/connect/ai-tools";
import {
  ChatPanel,
  useReactorChat,
  type AiConnection,
  type AiGatewayStatus,
  type UseAiGatewayResult,
} from "@powerhousedao/reactor-browser/ai";
import { useState, type FormEvent } from "react";
import {
  Alert,
  Badge,
  Button,
  Card,
  Field,
  Input,
  Modal,
} from "../../../../editors/sektar/kit/ui.js";

const INSTRUCTIONS = [
  "You are the assistant inside Sektar, a business suite for small companies: finance, mail, calendar, files and workflows.",
  "Sektar keeps each of these in its own drive, so look through the drives to find what the user means.",
  "When the user attaches a photo of a receipt or an invoice, read it: name the merchant, the date and the total, and say so if a figure is unreadable.",
  "Answer in the user's language, in a few plain sentences.",
].join(" ");

const SUGGESTIONS = ["Which drives do I have?", "What can you do for me?"];

/**
 * The assistant on the welcome page. The page only mounts this for an admin;
 * the gateway refuses everyone else, so there is nothing to show them.
 */
export function AssistantPanel({ gateway }: { gateway: UseAiGatewayResult }) {
  const { gateway: state, connection } = gateway;
  if (state?.access === "error") {
    return (
      <div className="sk-assistant">
        <Alert tone="warning" title="The assistant is not available">
          {state.message}
        </Alert>
      </div>
    );
  }
  if (state?.access !== "admin") return null;
  return (
    <div className="sk-assistant sk-stack sk-stack--4">
      {connection && (
        <Conversation connection={connection} model={state.status.model} />
      )}
      <KeyCard status={state.status} gateway={gateway} />
    </div>
  );
}

function Conversation({
  connection,
  model,
}: {
  connection: AiConnection;
  model: string;
}) {
  const chat = useReactorChat(getConnectReactorTools, {
    connection,
    instructions: INSTRUCTIONS,
  });
  return (
    <Card
      className="sk-assistant__conversation"
      title="Assistant"
      actions={
        <>
          <Badge tone="success" dot>
            Ready
          </Badge>
          <span className="sk-caption sk-assistant__model">{model}</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={chat.clear}
            disabled={chat.messages.length === 0}
          >
            Clear
          </Button>
        </>
      }
    >
      <ChatPanel
        chat={chat}
        allowImages
        suggestions={SUGGESTIONS}
        emptyState={
          <p>
            Ask about your drives and documents, or attach a photo of a receipt.
            Anything that changes your data asks you first.
          </p>
        }
      />
    </Card>
  );
}

function KeyCard({
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
