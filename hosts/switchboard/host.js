// @ts-check
import config from "../../powerhouse.config.json" with { type: "json" };

/** @satisfies {PHHost} */
export default {
  name: "sektar-switchboard",

  runner: {
    module: "@powerhousedao/ph-cli/runners/switchboard",
    port: config.reactor?.port ?? 4001, // referenced — single value store

    // THE COMPOSITION — the switchboard defaults, each line removable (a
    // curated API deletes what it does not serve). Presence is activation.
    plugins: [
      "@powerhousedao/switchboard/plugins/mcp",
      "@powerhousedao/switchboard/plugins/attachments",
      // Portle: the publication gate (`portleReadiness`) and, later, the
      // relay tunnel. Presence is activation; it takes no config.
      "@powerhousedao/portle/switchboard",
      // Workflows: the runtime AND the drive it serves (seeded here, opens in
      // Workflow Studio). The connect host attaches this same drive through
      // its own workflows plugin — one link, declared on both ends.
      {
        module: "@powerhousedao/switchboard/plugins/workflows",
        // The id is pinned: without one the plugin derives it from the
        // project path (workflows-<hash>) and announces that id, while the
        // drive that already holds the workflows was created as
        // workflows-36baa6c1 under an earlier hash. Seeding keys on the slug
        // and would find it, but Connect attaches the announced id and got a
        // 404 for a drive that does not exist.
        config: {
          drive: { slug: "workflows", name: "Workflows", id: "workflows-36baa6c1" },
        },
      },
    ],
  },

  // `auth` is read from powerhouse.config.json by the server itself.
  // `protocol` is SINGLE-SOURCED: this references the same connect.reactor
  // block of powerhouse.config.json that the connect host receives via its
  // config — one store for the replay/admission consensus, projected here
  // onto the server's REACTOR_* / CREATE_SIGNATURE_POLICY env. A pre-set env
  // var contradicting it fails boot by name.
  reactor: {
    protocol: config.connect?.reactor ?? {},
    // The drive this switchboard serves. The cli/desktop compounds read this
    // list and point Connect at it (as a remote client / remote drive), so
    // the drive is OWNED in exactly one place.
    drives: [
      {
        slug: "sektar",
        name: "Sektar",
        preferredEditor: "sektar",
        icon: "./icons/sektar_symbol_64x64.png",
      },
      // Mail: captured emails (sektar/email), opened by the Mail workspace.
      // Since 2026-10-26 this is a reactor-drive (children are drive/child
      // relationships, not a node list in the document); the id pins the
      // seeding to the converted drive so a boot never creates a legacy one.
      {
        id: "HRsIHuMMTdmjgCdy9QGWyx96zOFByPo787oBQcEt9f4",
        slug: "mail",
        name: "Mail",
        preferredEditor: "email-workspace",
        icon: "./icons/sektar_symbol_64x64.png",
      },
      // Backfills: Original Source Queues (distyra/original-source-queue),
      // defined in the Backfills workspace and walked by workflows on the
      // For Every trigger, which reach the queue through this switchboard.
      {
        slug: "backfills",
        name: "Backfills",
        preferredEditor: "backfills",
        icon: "./icons/sektar_symbol_64x64.png",
      },
      // Files: any document or file, opened by the Files drive app.
      {
        slug: "files",
        name: "Files",
        preferredEditor: "files",
        icon: "./icons/sektar_symbol_64x64.png",
      },
      // Trips: business trips (sektar/trip), opened by the Trips drive app.
      {
        slug: "trips",
        name: "Trips",
        preferredEditor: "trips",
        icon: "./icons/sektar_symbol_64x64.png",
      },
    ],
  },
};
