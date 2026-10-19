/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { EditorModule } from "document-model";
import { lazy } from "react";

/** Document editor module for the "sektar/invoice" document type */
export const InvoiceEditor: EditorModule = {
  Component: lazy(() => import("./editor.js")),
  documentTypes: ["sektar/invoice"],
  config: {
    id: "invoice-editor",
    name: "invoice-editor",
  },
};
