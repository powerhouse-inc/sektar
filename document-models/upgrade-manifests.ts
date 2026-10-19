/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { UpgradeManifest } from "document-model";
import { bankAccountUpgradeManifest } from "document-models/bank-account/upgrades";
import { contactUpgradeManifest } from "document-models/contact/upgrades";
import { expenseReportUpgradeManifest } from "document-models/expense-report/upgrades";
import { invoiceUpgradeManifest } from "document-models/invoice/upgrades";
import { originalSourceCollectionUpgradeManifest } from "document-models/original-source-collection/upgrades";
import { originalSourceQueueUpgradeManifest } from "document-models/original-source-queue/upgrades";

export const upgradeManifests: UpgradeManifest<readonly number[]>[] = [
  bankAccountUpgradeManifest,
  contactUpgradeManifest,
  expenseReportUpgradeManifest,
  invoiceUpgradeManifest,
  originalSourceCollectionUpgradeManifest,
  originalSourceQueueUpgradeManifest,
];
