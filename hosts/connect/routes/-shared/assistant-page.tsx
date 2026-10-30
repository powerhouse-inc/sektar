import { useUser } from "@powerhousedao/reactor-browser";
import type {
  AiGatewayAccess,
  UseAiGatewayResult,
} from "@powerhousedao/reactor-browser/ai";
import { useEffect, useState } from "react";
import { useMediaQuery } from "../../../../editors/original-source-collection-editor/components/useMediaQuery.js";
import {
  Button,
  EmptyState,
  More,
  SidePanel,
} from "../../../../editors/sektar/kit/ui.js";
import { Pane } from "../../../../editors/sektar/kit/workspace.js";
import { AssistantSidebar } from "./assistant-sidebar.js";
import { Conversation } from "./assistant.js";

/** Where the shell's sidebar becomes a drawer (_app.tsx, app.css). */
const NARROW = "(max-width: 1063px)";
const SIDE_TITLE = "Setup and progress";
const SEEN_ADMIN = "sk:assistant-admin";

function seenAdmin(): boolean {
  try {
    return localStorage.getItem(SEEN_ADMIN) === "1";
  } catch {
    return false;
  }
}

/**
 * Whether the page is the assistant's. The gateway's answer takes a moment on
 * every visit, so a browser that last saw an admin keeps the empty panes up
 * meanwhile instead of the welcome flashing past. That is a layout hint only:
 * nothing of the assistant shows before the gateway has said admin.
 */
export function useShowsAssistant(state: AiGatewayAccess | undefined): boolean {
  const signedIn = useUser() !== undefined;
  useEffect(() => {
    try {
      if (state?.access === "admin") localStorage.setItem(SEEN_ADMIN, "1");
      // Asked before the sign-in has loaded, an admin is told none as well
      if (state?.access === "none" && signedIn) {
        localStorage.removeItem(SEEN_ADMIN);
      }
    } catch {
      // only a hint: without storage the welcome shows first
    }
  }, [state, signedIn]);
  return state?.access === "admin" || (state === undefined && seenAdmin());
}

/**
 * The welcome page for an admin, on the design system's panes: the
 * conversation fills what the top bar leaves, its input fixed at the bottom,
 * with the sidebar in a pane beside it. Where the shell has no room for that
 * (its own breakpoint) the same sidebar opens as a sheet from the three dots.
 */
export function AssistantPage({ gateway }: { gateway: UseAiGatewayResult }) {
  const narrow = useMediaQuery(NARROW);
  const [sheet, setSheet] = useState(false);
  // Growing past the breakpoint: the pane is back, the sheet goes
  useEffect(() => {
    if (!narrow) setSheet(false);
  }, [narrow]);

  const state = gateway.gateway;
  if (state?.access !== "admin") {
    return (
      <div
        className="sk-workspace sk-workspace--panes sk-assistant-page"
        aria-busy="true"
      />
    );
  }

  const more = narrow ? (
    <More
      aria-label={`Open ${SIDE_TITLE.toLowerCase()}`}
      aria-haspopup="dialog"
      aria-expanded={sheet}
      onClick={() => setSheet(true)}
    />
  ) : undefined;
  const sidebar = <AssistantSidebar status={state.status} gateway={gateway} />;

  return (
    <div className="sk-workspace sk-workspace--panes sk-workspace--two sk-assistant-page">
      {gateway.connection ? (
        <Conversation
          connection={gateway.connection}
          model={state.status.model}
          trailing={more}
        />
      ) : (
        <Pane
          className="sk-assistant sk-assistant__conversation"
          title="Assistant"
          titleDisplay
          flush
          trailing={more}
        >
          <EmptyState
            icon="settings"
            title="No key yet"
            action={
              narrow && (
                <Button variant="primary" onClick={() => setSheet(true)}>
                  Add the key
                </Button>
              )
            }
          >
            The assistant needs an OpenRouter key before it can start.
          </EmptyState>
        </Pane>
      )}
      {narrow ? (
        sheet && (
          <SidePanel title={SIDE_TITLE} onClose={() => setSheet(false)}>
            {sidebar}
          </SidePanel>
        )
      ) : (
        <Pane
          className="sk-assistant-page__side"
          title={SIDE_TITLE}
          titleDisplay
        >
          {sidebar}
        </Pane>
      )}
    </div>
  );
}
