import type { EmailMessageOperations } from "document-models/email/v1";
import {
  ExternalIdMismatchError,
  InvalidExternalIdError,
} from "../../gen/message/error.js";

export const emailMessageOperations: EmailMessageOperations = {
  setAccountOperation(state, action) {
    const i = action.input;
    if (i.address !== undefined) state.account.address = i.address;
    if (i.name !== undefined) state.account.name = i.name;
    if (i.provider !== undefined) state.account.provider = i.provider;
  },
  captureMessageOperation(state, action) {
    const i = action.input;
    const externalId = i.externalId.trim();
    if (!/^[a-z0-9_-]+:.+/i.test(externalId))
      throw new InvalidExternalIdError(
        `External id must be namespaced, e.g. gmail:18f3a, got "${i.externalId}"`,
      );
    if (state.externalId && state.externalId !== externalId)
      throw new ExternalIdMismatchError(
        `This document holds ${state.externalId}, not ${externalId}`,
      );
    const mailboxes = (
      list: { address: string; name?: string | null }[] | null | undefined,
    ) =>
      (list ?? []).map((m) => ({ address: m.address, name: m.name ?? null }));
    state.externalId = externalId;
    state.messageId = i.messageId ?? null;
    state.threadId = i.threadId ?? null;
    state.inReplyTo = i.inReplyTo ?? null;
    state.references = [...(i.references ?? [])];
    state.subject = i.subject ?? null;
    state.from = mailboxes(i.from);
    state.to = mailboxes(i.to);
    state.cc = mailboxes(i.cc);
    state.bcc = mailboxes(i.bcc);
    state.replyTo = mailboxes(i.replyTo);
    state.sentAt = i.sentAt ?? null;
    state.receivedAt = i.receivedAt ?? null;
    state.text = i.text ?? null;
    state.html = i.html ?? null;
    state.snippet = i.text
      ? i.text.replace(/\s+/g, " ").trim().slice(0, 160)
      : null;
    state.headers = (i.headers ?? []).map((h) => ({
      key: h.key,
      value: h.value,
    }));
    state.labels = [
      ...new Set((i.labels ?? []).map((l) => l.trim()).filter((l) => l !== "")),
    ];
    state.source = i.source ?? state.source;
    state.capturedAt = i.capturedAt;
  },
  setNotesOperation(state, action) {
    state.notes = action.input.notes ?? null;
  },
};
