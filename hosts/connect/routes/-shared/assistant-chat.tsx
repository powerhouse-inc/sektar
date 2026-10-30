import type { AiConnection } from "@powerhousedao/reactor-browser/ai";
import {
  createContext,
  lazy,
  Suspense,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// The conversation belongs to the tab, not to the welcome page: an answer
// keeps coming, an approval keeps waiting and the composer keeps its text
// while the user is on another screen. The shell therefore holds it, and the
// page only shows it, by putting the held DOM into its pane (React cannot move
// a mounted tree between parents, and ChatPanel keeps the composer to itself).
// It is plain component state: a reload clears it. Nothing runs here until
// the page has an admin's connection: the page asks the gateway, the shell
// never does, and everyone else gets the empty holder.

/** The held conversation's DOM, for as long as the tab lives. */
export interface ChatSlots {
  panel: HTMLElement;
  clear: HTMLElement;
}

const HELD_CLASS = "sk-assistant__held";

const HeldChat = lazy(async () => ({
  default: (await import("./assistant.js")).HeldChat,
}));

const HolderContext = createContext<
  { slots: ChatSlots; hold: (connection: AiConnection) => void } | undefined
>(undefined);

function heldElement() {
  const element = document.createElement("div");
  element.className = HELD_CLASS;
  return element;
}

/** Around the shell: everything under it shares the tab's one conversation. */
export function AssistantChatHolder({ children }: { children: ReactNode }) {
  const [connection, setConnection] = useState<AiConnection>();
  const [holder] = useState(() => ({
    slots: { panel: heldElement(), clear: heldElement() },
    hold: setConnection,
  }));
  const release = useCallback(() => setConnection(undefined), []);
  return (
    <HolderContext.Provider value={holder}>
      {children}
      {connection && (
        <Suspense fallback={null}>
          <HeldChat
            connection={connection}
            slots={holder.slots}
            release={release}
          />
        </Suspense>
      )}
    </HolderContext.Provider>
  );
}

/**
 * For a conversation that must find a holder: the shell's, or, in another
 * Connect that mounts this package's routes under its own layout, one of its
 * own, which ends with the page.
 */
export function WithChatHolder({ children }: { children: ReactNode }) {
  return useContext(HolderContext) ? (
    children
  ) : (
    <AssistantChatHolder>{children}</AssistantChatHolder>
  );
}

/** Shows a held element here; it lives on when this unmounts. */
function Slot({ element }: { element: HTMLElement }) {
  const place = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    place.current?.append(element);
    // Out of the page a list forgets its scroll; ChatPanel's place is the end
    const list = element.querySelector(".ph-chat-list");
    if (list) list.scrollTop = list.scrollHeight;
    return () => element.remove();
  }, [element]);
  return <div ref={place} className={HELD_CLASS} />;
}

/** Starts the conversation on first use, and shows it wherever this is called. */
export function useHeldChat(connection: AiConnection) {
  const holder = useContext(HolderContext);
  if (!holder) throw new Error("useHeldChat needs a WithChatHolder");
  const { slots, hold } = holder;
  useLayoutEffect(() => hold(connection), [hold, connection]);
  return {
    panel: <Slot element={slots.panel} />,
    clear: <Slot element={slots.clear} />,
  };
}
