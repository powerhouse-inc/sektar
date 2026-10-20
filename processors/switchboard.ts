/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { ProcessorFactoryBuilder } from "@powerhousedao/reactor-browser";
import { emailIndexFactoryBuilder } from "processors/email-index";
import { keyIndexFactoryBuilder } from "processors/key-index";
import { oscIndexFactoryBuilder } from "processors/osc-index";
import { searchIndexFactoryBuilder } from "processors/search-index";

export const processorFactoryBuilders: ProcessorFactoryBuilder[] = [
  searchIndexFactoryBuilder,
  oscIndexFactoryBuilder,
  keyIndexFactoryBuilder,
  emailIndexFactoryBuilder,
];
