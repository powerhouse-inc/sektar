import { createFileRoute } from "@tanstack/react-router";
import { OpenDrive } from "../../-shared/drive-link.js";

// A link in the settings menu: it opens the Workflows drive's own page.
export const Route = createFileRoute("/_app/settings/workflows")({
  staticData: { settings: { label: "Workflows", order: 60 } },
  component: () => <OpenDrive slug="workflows" label="Workflows" />,
});
