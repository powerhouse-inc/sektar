/**
 * WARNING: DO NOT EDIT
 * This file is auto-generated and updated by codegen
 */
import type { UpgradeManifest } from "document-model";
import { bankAccountUpgradeManifest } from "document-models/bank-account/upgrades";
import { contactUpgradeManifest } from "document-models/contact/upgrades";
import { emailUpgradeManifest } from "document-models/email/upgrades";
import { expenseReportUpgradeManifest } from "document-models/expense-report/upgrades";
import { fileUpgradeManifest } from "document-models/file/upgrades";
import { invoiceUpgradeManifest } from "document-models/invoice/upgrades";
import { originalSourceCollectionUpgradeManifest } from "document-models/original-source-collection/upgrades";
import { originalSourceQueueUpgradeManifest } from "document-models/original-source-queue/upgrades";
import { tripUpgradeManifest } from "document-models/trip/upgrades";

export const upgradeManifests: UpgradeManifest<readonly number[]>[] = [
  bankAccountUpgradeManifest,
  contactUpgradeManifest,
  emailUpgradeManifest,
  expenseReportUpgradeManifest,
  fileUpgradeManifest,
  invoiceUpgradeManifest,
  originalSourceCollectionUpgradeManifest,
  originalSourceQueueUpgradeManifest,
  tripUpgradeManifest,
];
