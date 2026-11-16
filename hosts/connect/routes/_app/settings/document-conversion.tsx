import { createFileRoute } from "@tanstack/react-router";
import { ConversionSettings } from "../../-shared/conversion-settings.js";

export const Route = createFileRoute("/_app/settings/document-conversion")({
  staticData: { settings: { label: "Document conversion", order: 80 } },
  component: ConversionSettings,
});
