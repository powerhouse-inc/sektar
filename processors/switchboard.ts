/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { ProcessorFactoryBuilder } from "@powerhousedao/reactor-browser";
import { emailIndexFactoryBuilder } from "processors/email-index";
import { filesIndexFactoryBuilder } from "processors/files-index";
import { financeIndexFactoryBuilder } from "processors/finance-index";
import { folderSyncFactoryBuilder } from "processors/folder-sync";
import { keyIndexFactoryBuilder } from "processors/key-index";
import { oscIndexFactoryBuilder } from "processors/osc-index";
import { searchIndexFactoryBuilder } from "processors/search-index";
import { tripIndexFactoryBuilder } from "processors/trip-index";

export const processorFactoryBuilders: ProcessorFactoryBuilder[] = [
  searchIndexFactoryBuilder,
  oscIndexFactoryBuilder,
  keyIndexFactoryBuilder,
  emailIndexFactoryBuilder,
  filesIndexFactoryBuilder,
  folderSyncFactoryBuilder,
  financeIndexFactoryBuilder,
  tripIndexFactoryBuilder,
];
