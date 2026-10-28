import { useSetPHAppConfig } from "@powerhousedao/reactor-browser";
import type { EditorProps } from "document-model";
import { Sprite } from "../sektar/kit/ui.js";
import { IntegrationsPage } from "./components/IntegrationsPage.js";
import { editorConfig } from "./config.js";

/**
 * The Integrations drive app: the accounts Sektar keeps in sync (mail, bank,
 * calendar), each one an integration document in this drive. The page shows
 * them as cards and creates new ones; the reconciler on the runner builds the
 * workflows behind them. Connect's document editor stays out of the way: the
 * card and its detail are that view.
 */
export default function Editor(_props: EditorProps) {
  useSetPHAppConfig(editorConfig);
  return (
    <div className="sk-app sk-integrations-app" style={{ background: "transparent" }}>
      <Sprite />
      <IntegrationsPage />
    </div>
  );
}
