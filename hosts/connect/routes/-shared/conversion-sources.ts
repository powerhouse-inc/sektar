import type { DocumentDriveDocument } from "@powerhousedao/shared/document-drive";
import type { ConversionScope } from "../../../../conversions/contracts.js";
import {
  mailAccountKey,
  scopeKey,
} from "../../../../editors/sektar/kit/conversion-model.js";
import type { MailAccount } from "../../../../editors/sektar/kit/mail-index.js";

/** A Files drive or a mailbox whose PDFs can be converted. */
export interface ConversionSource {
  key: string;
  scope: ConversionScope;
  label: string;
}

/** The address the mail index gives mail that names no account. */
const UNKNOWN_ACCOUNT = "unknown";

const driveName = (drive: DocumentDriveDocument) =>
  drive.header.name || drive.state.global.name || drive.header.slug;

/** A scope by its ids, for one no drive or mailbox here names. */
export const scopeLabel = (scope: ConversionScope) =>
  scope.kind === "files"
    ? `Files · ${scope.driveId}`
    : `Mail · ${scope.account}`;

/** Files and mailboxes available for an existing-PDF batch. */
export function sourcesOf(input: {
  files: DocumentDriveDocument | undefined;
  mail: DocumentDriveDocument | undefined;
  accounts: readonly MailAccount[];
}): ConversionSource[] {
  const { files, mail, accounts } = input;
  const sources: ConversionSource[] = [];
  const add = (scope: ConversionScope, label: string) => {
    const key = scopeKey(scope);
    if (!sources.some((source) => source.key === key)) {
      sources.push({ key, scope, label });
    }
  };
  if (files) {
    // A drive called Files is just "Files", not "Files · Files".
    const name = driveName(files);
    add(
      { kind: "files", driveId: files.header.id },
      name.trim().toLowerCase() === "files" ? "Files" : `Files · ${name}`,
    );
  }
  for (const account of accounts) {
    if (!mail) break;
    // The mail index lists mail that names no account under "unknown".
    const address = account.address === UNKNOWN_ACCOUNT ? "" : account.address;
    add(
      {
        kind: "mail",
        driveId: mail.header.id,
        account: mailAccountKey(address),
      },
      `Mail · ${account.name || address || "no account"}`,
    );
  }
  return sources;
}
