import { createFileRoute } from "@tanstack/react-router";
import { OpenDrive } from "../../-shared/drive-link.js";

// A link in the settings menu: it opens the Backfills drive's own page.
export const Route = createFileRoute("/_app/settings/backfills")({
  staticData: { settings: { label: "Backfills", order: 70 } },
  component: () => <OpenDrive slug="backfills" label="Backfills" />,
});
