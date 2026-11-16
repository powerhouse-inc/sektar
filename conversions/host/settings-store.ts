import {
  modelPreparationSchema,
  preparationActive,
  type ModelPreparation,
} from "../models/contracts.js";
import { sql, type Kysely } from "kysely";
import {
  APP_CONVERSION_KEY,
  conversionSettingsSchema,
  conversionBatchPreviewSchema,
  conversionProfileSchema,
  type ConversionSettings,
  type ConversionBatchPreview,
  type ConversionProfile,
} from "../contracts.js";
import { defaultSettings } from "./settings.js";

interface SettingsRow {
  settings_key: string;
  needs_review: boolean;
  revision: number;
  activation: string;
  profile: string;
  limits: string;
  authorizing_identity: string;
  updated_at: string;
  automatic_since: string | null;
}
export interface WorkflowBinding {
  scope_key: string;
  workflow_id: string;
  authorizer: string;
  grant: string | null;
}
interface PreviewRow {
  id: string;
  owner: string;
  preview: string;
  profile: string | null;
}
interface BatchRequest {
  id: string;
  preview_id: string;
  workflow_id: string;
  owner: string;
  created_at: string;
}
interface PreparationRow {
  id: string;
  owner: string;
  fingerprint: string;
  view: string;
  updated_at: string;
}
export interface SettingsDatabase {
  conversion_model_preparations: PreparationRow;
  conversion_policies: { scope_key: string; scope: string };
  conversion_settings: SettingsRow;
  conversion_workflows: WorkflowBinding;
  conversion_workflow_previews: PreviewRow;
  conversion_workflow_batches: BatchRequest;
}

/** Settings and immutable submission metadata only. The native runtime owns every run. */
export class SettingsStore {
  constructor(readonly db: Kysely<SettingsDatabase>) {}
  async initialize(): Promise<void> {
    await this.db.schema
      .createTable("conversion_model_preparations")
      .ifNotExists()
      .addColumn("id", "varchar(512)", (c) => c.primaryKey())
      .addColumn("owner", "varchar(512)", (c) => c.notNull())
      .addColumn("fingerprint", "varchar(64)", (c) => c.notNull())
      .addColumn("view", "text", (c) => c.notNull())
      .addColumn("updated_at", "varchar(40)", (c) => c.notNull())
      .execute();
    for (const row of await this.db
      .selectFrom("conversion_model_preparations")
      .selectAll()
      .execute()) {
      const parsed = modelPreparationSchema.safeParse(JSON.parse(row.view));
      if (!parsed.success) {
        await this.db
          .deleteFrom("conversion_model_preparations")
          .where("id", "=", row.id)
          .execute();
        continue;
      }
      const view = parsed.data;
      if (preparationActive(view))
        await this.updatePreparation({
          ...view,
          updatedAt: new Date().toISOString(),
          progress: { ...view.progress, phase: "failed" },
          error: {
            code: "interrupted",
            message:
              "The host restarted before setup finished. Retry to continue with the files already verified.",
            retryable: true,
          },
        });
    }
    await this.db.schema
      .createTable("conversion_settings")
      .ifNotExists()
      .addColumn("settings_key", "varchar(16)", (c) => c.primaryKey())
      .addCheckConstraint(
        "conversion_settings_singleton",
        sql`settings_key = 'app'`,
      )
      .addColumn("needs_review", "boolean", (c) => c.notNull())
      .addColumn("revision", "integer", (c) => c.notNull())
      .addColumn("activation", "varchar(16)", (c) => c.notNull())
      .addColumn("profile", "text", (c) => c.notNull())
      .addColumn("limits", "text", (c) => c.notNull())
      .addColumn("authorizing_identity", "varchar(512)", (c) => c.notNull())
      .addColumn("updated_at", "varchar(40)", (c) => c.notNull())
      .addColumn("automatic_since", "varchar(40)")
      .execute();
    await this.db.schema
      .createTable("conversion_policies")
      .ifNotExists()
      .addColumn("scope_key", "varchar(1200)", (c) => c.primaryKey())
      .addColumn("scope", "text", (c) => c.notNull())
      .addColumn("revision", "integer", (c) => c.notNull())
      .addColumn("activation", "varchar(16)", (c) => c.notNull())
      .addColumn("profile", "text", (c) => c.notNull())
      .addColumn("limits", "text", (c) => c.notNull())
      .addColumn("authorizing_identity", "varchar(512)", (c) => c.notNull())
      .addColumn("updated_at", "varchar(40)", (c) => c.notNull())
      .addColumn("automatic_since", "varchar(40)")
      .execute();
    await this.db.schema
      .createTable("conversion_workflows")
      .ifNotExists()
      .addColumn("scope_key", "varchar(1200)", (c) => c.primaryKey())
      .addColumn("workflow_id", "varchar(512)", (c) => c.notNull().unique())
      .addColumn("authorizer", "varchar(512)", (c) => c.notNull())
      .addColumn("grant", "text")
      .execute();
    await this.db.schema
      .createTable("conversion_workflow_previews")
      .ifNotExists()
      .addColumn("id", "varchar(512)", (c) => c.primaryKey())
      .addColumn("owner", "varchar(512)", (c) => c.notNull())
      .addColumn("preview", "text", (c) => c.notNull())
      .addColumn("profile", "text")
      .execute();
    await this.db.schema
      .createTable("conversion_workflow_batches")
      .ifNotExists()
      .addColumn("id", "varchar(512)", (c) => c.primaryKey())
      .addColumn("preview_id", "varchar(512)", (c) => c.notNull())
      .addColumn("workflow_id", "varchar(512)", (c) => c.notNull())
      .addColumn("owner", "varchar(512)", (c) => c.notNull())
      .addColumn("created_at", "varchar(40)", (c) => c.notNull())
      .execute();
    const legacy = await this.db
      .selectFrom("conversion_policies")
      .select("scope_key")
      .limit(1)
      .executeTakeFirst();
    const initial = defaultSettings(new Date().toISOString());
    await this.db
      .insertInto("conversion_settings")
      .values(
        settingsRow(
          legacy
            ? { ...initial, activation: "off", needsReview: true }
            : initial,
        ),
      )
      .onConflict((c) => c.column("settings_key").doNothing())
      .execute();
  }
  async settings(): Promise<ConversionSettings> {
    const row = await this.db
      .selectFrom("conversion_settings")
      .selectAll()
      .where("settings_key", "=", APP_CONVERSION_KEY)
      .executeTakeFirstOrThrow();
    return settingsOf(row);
  }
  async putSettings(
    settings: ConversionSettings,
    expectedRevision: number,
    binding?: WorkflowBinding,
    preparation?: ModelPreparation,
  ): Promise<boolean> {
    return this.db.transaction().execute(async (transaction) => {
      const saved = await transaction
        .updateTable("conversion_settings")
        .set(settingsRow(settings))
        .where("settings_key", "=", APP_CONVERSION_KEY)
        .where("revision", "=", expectedRevision)
        .returning("settings_key")
        .executeTakeFirst();
      if (!saved) return false;
      if (binding) await new SettingsStore(transaction).putBinding(binding);
      if (preparation)
        await new SettingsStore(transaction).updatePreparation(preparation);
      return true;
    });
  }
  async preparation(id: string) {
    const row = await this.db
      .selectFrom("conversion_model_preparations")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row
      ? {
          owner: row.owner,
          fingerprint: row.fingerprint,
          view: modelPreparationSchema.parse(JSON.parse(row.view)),
        }
      : null;
  }
  async preparations(owner: string) {
    const rows = await this.db
      .selectFrom("conversion_model_preparations")
      .selectAll()
      .where("owner", "=", owner)
      .orderBy("updated_at", "desc")
      .limit(100)
      .execute();
    return rows.map((row) =>
      modelPreparationSchema.parse(JSON.parse(row.view)),
    );
  }
  async createPreparation(
    owner: string,
    fingerprint: string,
    view: ModelPreparation,
  ) {
    await this.db
      .insertInto("conversion_model_preparations")
      .values({
        id: view.id,
        owner,
        fingerprint,
        view: JSON.stringify(view),
        updated_at: view.updatedAt,
      })
      .execute();
    const history = await this.db
      .selectFrom("conversion_model_preparations")
      .selectAll()
      .orderBy("updated_at", "desc")
      .execute();
    for (const row of history.slice(100)) {
      if (
        !preparationActive(modelPreparationSchema.parse(JSON.parse(row.view)))
      )
        await this.db
          .deleteFrom("conversion_model_preparations")
          .where("id", "=", row.id)
          .execute();
    }
  }
  async updatePreparation(view: ModelPreparation): Promise<void> {
    await this.db
      .updateTable("conversion_model_preparations")
      .set({ view: JSON.stringify(view), updated_at: view.updatedAt })
      .where("id", "=", view.id)
      .execute();
  }
  appBinding() {
    return this.binding(APP_CONVERSION_KEY);
  }
  binding(key: string) {
    return this.db
      .selectFrom("conversion_workflows")
      .selectAll()
      .where("scope_key", "=", key)
      .executeTakeFirst();
  }
  bindingForWorkflow(id: string) {
    return this.db
      .selectFrom("conversion_workflows")
      .selectAll()
      .where("workflow_id", "=", id)
      .executeTakeFirst();
  }
  bindings() {
    return this.db.selectFrom("conversion_workflows").selectAll().execute();
  }
  async putBinding(binding: WorkflowBinding): Promise<void> {
    await this.db
      .insertInto("conversion_workflows")
      .values(binding)
      .onConflict((c) => c.column("scope_key").doUpdateSet(binding))
      .execute();
  }
  async savePreview(
    owner: string,
    preview: ConversionBatchPreview,
    profile?: ConversionProfile,
  ): Promise<void> {
    await this.db
      .insertInto("conversion_workflow_previews")
      .values({
        id: preview.id,
        owner,
        preview: JSON.stringify(preview),
        profile: profile ? JSON.stringify(profile) : null,
      })
      .execute();
  }
  async preview(id: string) {
    const row = await this.db
      .selectFrom("conversion_workflow_previews")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
    return row
      ? {
          owner: row.owner,
          preview: conversionBatchPreviewSchema.parse(JSON.parse(row.preview)),
          profile: row.profile
            ? conversionProfileSchema.parse(JSON.parse(row.profile))
            : undefined,
        }
      : null;
  }
  async saveBatch(request: BatchRequest): Promise<boolean> {
    return !!(await this.db
      .insertInto("conversion_workflow_batches")
      .values(request)
      .onConflict((c) => c.column("id").doNothing())
      .returning("id")
      .executeTakeFirst());
  }
  batch(id: string) {
    return this.db
      .selectFrom("conversion_workflow_batches")
      .selectAll()
      .where("id", "=", id)
      .executeTakeFirst();
  }
}
function settingsRow(settings: ConversionSettings): SettingsRow {
  return {
    settings_key: APP_CONVERSION_KEY,
    needs_review: settings.needsReview,
    revision: settings.revision,
    activation: settings.activation,
    profile: JSON.stringify(settings.profile),
    limits: JSON.stringify(settings.limits),
    authorizing_identity: settings.authorizingIdentity,
    updated_at: settings.updatedAt,
    automatic_since: settings.automaticSince,
  };
}
function settingsOf(row: SettingsRow): ConversionSettings {
  const profile: unknown = JSON.parse(row.profile);
  const limits: unknown = JSON.parse(row.limits);
  return conversionSettingsSchema.parse({
    needsReview: row.needs_review,
    revision: row.revision,
    activation: row.activation,
    profile,
    limits,
    authorizingIdentity: row.authorizing_identity,
    updatedAt: row.updated_at,
    automaticSince: row.automatic_since,
  });
}
