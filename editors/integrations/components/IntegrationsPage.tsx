import { Button, EmptyState, PageHeader } from "../../sektar/kit/ui.js";
import growthDark from "../../sektar/design/shapes/sektar-growth-four-column-combined-dark.svg";
import growthLight from "../../sektar/design/shapes/sektar-growth-four-column-combined-light.svg";

/**
 * The Integrations page (design system: Patterns · Integrations). Grouped
 * cards per kind once there are integrations; until then, what an
 * integration is and the way to add one.
 */
export function IntegrationsPage() {
  const add = (
    <Button variant="primary" icon="plus">
      Add integration
    </Button>
  );
  return (
    <div className="sk-page sk-stack sk-stack--8">
      <PageHeader
        title="Integrations"
        lead="Your mail, bank accounts and calendars, kept up to date in Sektar."
        art={{ light: growthLight, dark: growthDark }}
        actions={add}
      />
      <EmptyState icon="sync" title="Nothing connected yet" action={add}>
        Pick an account and how far back to go. Sektar brings in what is
        there and keeps it up to date.
      </EmptyState>
    </div>
  );
}
