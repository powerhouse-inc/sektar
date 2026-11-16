import type { PHDocument } from "document-model";
import type { IProcessorHostModule } from "@powerhousedao/reactor-api";
import type { ConversionSettings } from "../contracts.js";
import type { WorkflowBinding } from "./settings-store.js";
import type { NativeRun } from "./run-view.js";
export interface Caller {
  identity: string;
  address: string | undefined;
}
export const ANONYMOUS = "anonymous";
export const callerOf = (address: string | undefined): Caller => ({
  identity: address?.toLowerCase() ?? ANONYMOUS,
  address,
});
export interface AccessPort {
  canManageSettings(caller: Caller): Promise<boolean>;
  canRead(caller: Caller, id: string): Promise<boolean>;
  canWrite(caller: Caller, id: string): Promise<boolean>;
}
export interface DocumentReader {
  get(id: string): Promise<PHDocument>;
  getIncomingRelationships(
    id: string,
    type: string,
    view: undefined,
    paging: { cursor: string; limit: number },
  ): Promise<{ results: readonly PHDocument[] }>;
  drives: {
    listNodes(
      drive: string,
      folder: undefined,
      paging: { cursor: string; limit: number },
    ): Promise<{
      results: readonly { id: string; kind: string; documentType?: string }[];
      nextCursor?: string;
    }>;
  };
}
export type AttachmentReader = Pick<
  IProcessorHostModule["attachments"],
  "download"
>;
/** Request credentials are forwarded only to this host's native runtime, never stored. */
export interface WorkflowPort {
  ensure(
    settings: ConversionSettings,
    caller: Caller,
    grant: string | undefined,
    existing: WorkflowBinding | undefined,
  ): Promise<WorkflowBinding>;
  validateBinding(binding: WorkflowBinding): Promise<void>;
  assertSetup(): void;
  disable(workflowId: string): Promise<void>;
  fire(
    workflowId: string,
    payload: unknown,
    authorization?: string,
  ): Promise<string>;
  runs(workflowId: string, authorization?: string): Promise<NativeRun[]>;
  run(id: string, authorization?: string): Promise<NativeRun | null>;
  cancel(id: string, authorization?: string): Promise<void>;
}
