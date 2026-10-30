import { getPHStore, useDrives } from "@powerhousedao/reactor-browser";
import { useAiGateway } from "@powerhousedao/reactor-browser/ai";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import artDark from "../../../../editors/sektar/design/shapes/sektar-growth-four-column-combined-dark.svg";
import artLight from "../../../../editors/sektar/design/shapes/sektar-growth-four-column-combined-light.svg";
import { Button } from "../../../../editors/sektar/kit/ui.js";
import { AssistantPage, useShowsAssistant } from "../-shared/assistant-page.js";
import { AssistantUnavailable } from "../-shared/assistant.js";
import { driveFor, PRODUCTS } from "../-shared/products.js";

export const Route = createFileRoute("/_app/productivity")({
  head: () => ({ meta: [{ title: "Productivity Center · Sektar" }] }),
  component: Welcome,
});

const product = PRODUCTS.find((p) => p.id === "productivity")!;

/**
 * Productivity Center. An admin gets the assistant as the whole page; the
 * gateway answers nobody else, and they see the first-run welcome: nothing
 * here yet but the way in.
 */
function Welcome() {
  const drives = useDrives();
  const navigate = useNavigate();
  // The Workflows drive is the switchboard's (seeded by its workflows plugin,
  // bound to Workflow Studio); the host attaches it as a remote at boot, so
  // it arrives once the switchboard answers.
  const found = driveFor(drives, product);
  const ready = found?.drive.header.meta?.preferredEditor === product.drive.editor;
  useRetirePlaceholder(drives, ready);
  const gateway = useAiGateway();
  const assistant = useShowsAssistant(gateway.gateway);
  // Only the gateway's failure stays on the welcome, as a note under it
  const unavailable =
    gateway.gateway?.access === "error" ? gateway.gateway.message : undefined;

  const openDrive = () => {
    if (!found) return;
    void navigate({
      to: "/d/$driveSlug/{-$nodeSlug}",
      params: { driveSlug: found.param },
    });
  };

  if (assistant) return <AssistantPage gateway={gateway} />;

  return (
    <div
      className="sk-page sk-stack sk-stack--6"
      style={{
        alignItems: "center",
        textAlign: "center",
        // the sides come from the page rule; only the vertical room is ours
        paddingBlock:
          unavailable === undefined
            ? "var(--sk-space-12)"
            : "var(--sk-space-6)",
      }}
    >
      <div
        className="sk-logo-swap"
        aria-hidden="true"
        style={{
          width: "100%",
          maxWidth: unavailable === undefined ? 420 : 240,
        }}
      >
        <img className="sk-logo-swap__light" src={artLight} alt="" style={{ width: "100%" }} />
        <img className="sk-logo-swap__dark" src={artDark} alt="" style={{ width: "100%" }} />
      </div>
      <div className="sk-stack sk-stack--2" style={{ maxWidth: 460 }}>
        <p className="sk-eyebrow">Sektar · {product.name}</p>
        <h1 style={{ fontSize: "var(--sk-text-3xl)" }}>Welcome</h1>
        <p className="sk-lead" style={{ fontSize: "var(--sk-text-lg)" }}>
          {product.lead} There is nothing here yet; the workflows behind it
          live in their own drive.
        </p>
      </div>
      <Button
        variant="primary"
        size="lg"
        icon="folder"
        onClick={openDrive}
        disabled={!found}
        aria-busy={drives !== undefined && !found}
      >
        Open workflows drive
      </Button>
      {drives !== undefined && !found && (
        <p className="sk-caption">
          Connecting to the workflows drive… it appears once the switchboard
          answers.
        </p>
      )}
      {unavailable !== undefined && (
        <AssistantUnavailable message={unavailable} />
      )}
    </div>
  );
}

/**
 * Stores from before the drive was attached from the switchboard hold the
 * local placeholder an earlier build created (id "workflows", no drive app,
 * nothing in it). Once the real drive is there, that empty placeholder goes,
 * so the slug points at one drive again. Nothing with content is touched.
 */
function useRetirePlaceholder(
  drives: ReturnType<typeof useDrives>,
  ready: boolean,
) {
  const done = useRef(false);
  useEffect(() => {
    if (!ready || done.current) return;
    const placeholder = drives?.find(
      (d) =>
        d.header.id === product.drive.slug &&
        !d.header.meta?.preferredEditor &&
        // only a legacy drive has a node list; a reactor-drive is never the placeholder
        Array.isArray(d.state.global.nodes) &&
        d.state.global.nodes.length === 0,
    );
    if (!placeholder) return;
    done.current = true;
    // By id, on the reactor itself: the client resolves a name as id-or-slug
    // and refuses "workflows" as ambiguous (the placeholder's id is the real
    // drive's slug). The placeholder is local, so there is no remote to drop.
    const module = getPHStore()?.reactorClientModule;
    if (!module || module.kind !== "browser") return;
    module.reactor
      .deleteDocument(placeholder.header.id, module.signer)
      .catch((e: unknown) => {
        console.warn("[sektar] could not retire the placeholder drive", e);
      });
  }, [drives, ready]);
}
