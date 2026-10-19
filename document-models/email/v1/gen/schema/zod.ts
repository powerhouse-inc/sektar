/* eslint-disable @typescript-eslint/no-empty-object-type */
/* eslint-disable @typescript-eslint/no-unused-vars */
import * as z from "zod";
import type {
  AddAttachmentInput,
  AddLabelsInput,
  ArchiveInput,
  CaptureMessageInput,
  CapturedHeaderInput,
  CapturedMailboxInput,
  EmailAttachment,
  EmailHeader,
  EmailState,
  EmailStatus,
  MailAccount,
  Mailbox,
  MarkReadInput,
  MarkUnreadInput,
  RemoveAttachmentInput,
  RemoveLabelsInput,
  SetAccountInput,
  SetFlaggedInput,
  SetNotesInput,
  UnarchiveInput,
} from "./types.js";

type Properties<T> = Required<{
  [K in keyof T]: z.ZodType<T[K]>;
}>;

type definedNonNullAny = {};

export const isDefinedNonNullAny = (v: any): v is definedNonNullAny =>
  v !== undefined && v !== null;

export const definedNonNullAnySchema = z
  .any()
  .refine((v) => isDefinedNonNullAny(v));

export const EmailStatusSchema = z.enum(["ARCHIVED", "INBOX"]);

export function AddAttachmentInputSchema(): z.ZodObject<
  Properties<AddAttachmentInput>
> {
  return z.object({
    contentId: z.string().nullish(),
    fileName: z.string(),
    id: z.string(),
    inline: z.boolean().nullish(),
    mimeType: z.string().nullish(),
    ref: z.custom<`attachment://v${number}:${string}`>((val) =>
      /^attachment:\/\/v\d+:.+$/.test(val as string),
    ),
    sizeBytes: z.number().nullish(),
  });
}

export function AddLabelsInputSchema(): z.ZodObject<
  Properties<AddLabelsInput>
> {
  return z.object({
    labels: z.array(z.string()),
  });
}

export function ArchiveInputSchema(): z.ZodObject<Properties<ArchiveInput>> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function CaptureMessageInputSchema(): z.ZodObject<
  Properties<CaptureMessageInput>
> {
  return z.object({
    bcc: z.array(z.lazy(() => CapturedMailboxInputSchema())).nullish(),
    capturedAt: z.iso.datetime(),
    cc: z.array(z.lazy(() => CapturedMailboxInputSchema())).nullish(),
    externalId: z.string(),
    from: z.array(z.lazy(() => CapturedMailboxInputSchema())),
    headers: z.array(z.lazy(() => CapturedHeaderInputSchema())).nullish(),
    html: z.string().nullish(),
    inReplyTo: z.string().nullish(),
    labels: z.array(z.string()).nullish(),
    messageId: z.string().nullish(),
    receivedAt: z.iso.datetime().nullish(),
    references: z.array(z.string()).nullish(),
    replyTo: z.array(z.lazy(() => CapturedMailboxInputSchema())).nullish(),
    sentAt: z.iso.datetime().nullish(),
    source: z.string().nullish(),
    subject: z.string().nullish(),
    text: z.string().nullish(),
    threadId: z.string().nullish(),
    to: z.array(z.lazy(() => CapturedMailboxInputSchema())).nullish(),
  });
}

export function CapturedHeaderInputSchema(): z.ZodObject<
  Properties<CapturedHeaderInput>
> {
  return z.object({
    key: z.string(),
    value: z.string(),
  });
}

export function CapturedMailboxInputSchema(): z.ZodObject<
  Properties<CapturedMailboxInput>
> {
  return z.object({
    address: z.string(),
    name: z.string().nullish(),
  });
}

export function EmailAttachmentSchema(): z.ZodObject<
  Properties<EmailAttachment>
> {
  return z.object({
    __typename: z.literal("EmailAttachment").optional(),
    contentId: z.string().nullish(),
    fileName: z.string(),
    id: z.string(),
    inline: z.boolean(),
    mimeType: z.string().nullish(),
    ref: z.custom<`attachment://v${number}:${string}`>((val) =>
      /^attachment:\/\/v\d+:.+$/.test(val as string),
    ),
    sizeBytes: z.number().nullish(),
  });
}

export function EmailHeaderSchema(): z.ZodObject<Properties<EmailHeader>> {
  return z.object({
    __typename: z.literal("EmailHeader").optional(),
    key: z.string(),
    value: z.string(),
  });
}

export function EmailStateSchema(): z.ZodObject<Properties<EmailState>> {
  return z.object({
    __typename: z.literal("EmailState").optional(),
    account: z.lazy(() => MailAccountSchema()),
    attachments: z.array(z.lazy(() => EmailAttachmentSchema())),
    bcc: z.array(z.lazy(() => MailboxSchema())),
    capturedAt: z.iso.datetime().nullish(),
    cc: z.array(z.lazy(() => MailboxSchema())),
    externalId: z.string().nullish(),
    flagged: z.boolean(),
    from: z.array(z.lazy(() => MailboxSchema())),
    headers: z.array(z.lazy(() => EmailHeaderSchema())),
    html: z.string().nullish(),
    inReplyTo: z.string().nullish(),
    labels: z.array(z.string()),
    messageId: z.string().nullish(),
    notes: z.string().nullish(),
    read: z.boolean(),
    receivedAt: z.iso.datetime().nullish(),
    references: z.array(z.string()),
    replyTo: z.array(z.lazy(() => MailboxSchema())),
    sentAt: z.iso.datetime().nullish(),
    snippet: z.string().nullish(),
    source: z.string().nullish(),
    status: EmailStatusSchema,
    subject: z.string().nullish(),
    text: z.string().nullish(),
    threadId: z.string().nullish(),
    to: z.array(z.lazy(() => MailboxSchema())),
  });
}

export function MailAccountSchema(): z.ZodObject<Properties<MailAccount>> {
  return z.object({
    __typename: z.literal("MailAccount").optional(),
    address: z.string().nullish(),
    name: z.string().nullish(),
    provider: z.string().nullish(),
  });
}

export function MailboxSchema(): z.ZodObject<Properties<Mailbox>> {
  return z.object({
    __typename: z.literal("Mailbox").optional(),
    address: z.string(),
    name: z.string().nullish(),
  });
}

export function MarkReadInputSchema(): z.ZodObject<Properties<MarkReadInput>> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function MarkUnreadInputSchema(): z.ZodObject<
  Properties<MarkUnreadInput>
> {
  return z.object({
    _: z.boolean().nullish(),
  });
}

export function RemoveAttachmentInputSchema(): z.ZodObject<
  Properties<RemoveAttachmentInput>
> {
  return z.object({
    id: z.string(),
  });
}

export function RemoveLabelsInputSchema(): z.ZodObject<
  Properties<RemoveLabelsInput>
> {
  return z.object({
    labels: z.array(z.string()),
  });
}

export function SetAccountInputSchema(): z.ZodObject<
  Properties<SetAccountInput>
> {
  return z.object({
    address: z.string().nullish(),
    name: z.string().nullish(),
    provider: z.string().nullish(),
  });
}

export function SetFlaggedInputSchema(): z.ZodObject<
  Properties<SetFlaggedInput>
> {
  return z.object({
    flagged: z.boolean(),
  });
}

export function SetNotesInputSchema(): z.ZodObject<Properties<SetNotesInput>> {
  return z.object({
    notes: z.string().nullish(),
  });
}

export function UnarchiveInputSchema(): z.ZodObject<
  Properties<UnarchiveInput>
> {
  return z.object({
    _: z.boolean().nullish(),
  });
}
