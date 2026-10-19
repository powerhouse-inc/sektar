import type { EditorProps } from "document-model";
import {
  useContacts,
  useExpenseReports,
  useInvoices,
  useAccounts,
} from "../kit/data.js";
import { Badge, Sprite } from "../kit/ui.js";
import { plural } from "../kit/format.js";
import { DriveContents } from "./DriveContents.js";
import { FolderTree } from "./FolderTree.js";

/**
 * The business drive: every record as a document. Left, the folder tree;
 * right, the folder contents — or the selected document's editor, which
 * Connect passes in as children.
 */
export function DriveExplorer({ children }: EditorProps) {
  const showDocumentEditor = !!children;
  const accounts = useAccounts();
  const invoices = useInvoices();
  const reports = useExpenseReports();
  const contacts = useContacts();

  // A selected document renders Connect's toolbar plus its own editor; keep
  // it outside the Sektar-styled region so the toolbar keeps Connect's look.
  if (showDocumentEditor) {
    return (
      <div style={{ display: "flex", minHeight: "100%" }}>
        <div className="sk-app" style={{ background: "transparent" }}>
          <Sprite />
          <div className="sk-drive-tree">
          <FolderTree />
        </div>
        </div>
        <div
          className="sk-grow"
          style={{
            minWidth: 0,
            padding: "var(--sk-space-4)",
            overflowY: "auto",
          }}
        >
          {children}
        </div>
      </div>
    );
  }

  return (
    <div
      className="sk-app"
      style={{ display: "flex", minHeight: "100%", background: "transparent" }}
    >
      <Sprite />
      <div className="sk-drive-tree">
          <FolderTree />
        </div>
      <div
        className="sk-page sk-grow sk-stack sk-stack--4"
        style={{ padding: "var(--sk-space-4)", overflowY: "auto" }}
      >
        <header className="sk-row sk-row--between sk-row--wrap">
          <div className="sk-stack sk-stack--2">
            <div className="sk-eyebrow">Records</div>
            <h2 style={{ fontSize: "var(--sk-text-2xl)" }}>Business drive</h2>
            <p className="sk-small sk-text-secondary">
              Every account, invoice, claim and contact is a document here. Open
              one to see its full history.
            </p>
          </div>
          <div className="sk-row sk-row--2 sk-row--wrap">
            <Badge tone="outline">{plural(accounts.length, "account")}</Badge>
            <Badge tone="outline">{plural(invoices.length, "invoice")}</Badge>
            <Badge tone="outline">{plural(reports.length, "claim")}</Badge>
            <Badge tone="outline">{plural(contacts.length, "contact")}</Badge>
          </div>
        </header>
        <DriveContents />
      </div>
    </div>
  );
}
