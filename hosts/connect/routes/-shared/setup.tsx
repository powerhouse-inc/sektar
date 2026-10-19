import { useState } from "react";
import { useSektarDrive } from "../../../../editors/sektar/kit/data.js";
import { seedDemoCompany } from "../../../../editors/sektar/kit/seed.js";
import { Button, Progress } from "../../../../editors/sektar/kit/ui.js";
import splash from "../../../../icons/sektar_splash_2048x1152.png";

const STEPS = [
  "Adding contacts",
  "Opening bank accounts",
  "Writing invoices",
  "Filing expense claims",
  "Importing the bank feed",
  "Matching payments to invoices",
  "Done",
];

/** First run: no business data yet (or the drive has not synced). */
export function SetupState({ what }: { what: string }) {
  const drive = useSektarDrive();
  const [step, setStep] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const busy = step !== null && step !== "Done";
  const progress = step ? ((STEPS.indexOf(step) + 1) / STEPS.length) * 100 : 0;

  return (
    <div
      className="sk-page sk-stack sk-stack--6"
      style={{
        alignItems: "center",
        textAlign: "center",
        // the sides come from the page rule; only the vertical room is ours
        paddingBlock: "var(--sk-space-12)",
      }}
    >
      <img
        src={splash}
        alt="Sektar"
        style={{
          width: "100%",
          maxWidth: 520,
          borderRadius: "var(--sk-radius-2xl)",
          boxShadow: "var(--sk-shadow-md)",
        }}
      />
      <div className="sk-stack sk-stack--2" style={{ maxWidth: 460 }}>
        <h2 style={{ fontSize: "var(--sk-text-3xl)" }}>
          {drive ? `No ${what} yet.` : "Connecting to your books…"}
        </h2>
        <p className="sk-lead" style={{ fontSize: "var(--sk-text-lg)" }}>
          {drive
            ? "Set up the demo company: three months of bank and card activity, invoices in both directions, expense claims and the contacts behind them."
            : "The Sektar drive is not available yet. It appears as soon as the reactor is reachable."}
        </p>
      </div>
      {drive && !busy && (
        <Button
          variant="primary"
          size="lg"
          icon="leaf"
          onClick={() => {
            setError(null);
            setStep(STEPS[0]);
            seedDemoCompany(drive, setStep).catch((e: unknown) => {
              setError(e instanceof Error ? e.message : String(e));
              setStep(null);
            });
          }}
        >
          Set up Juniper Studio
        </Button>
      )}
      {busy && (
        <div className="sk-stack sk-stack--2" style={{ width: 320 }}>
          <Progress value={progress} />
          <span className="sk-caption">{step}…</span>
        </div>
      )}
      {error && <p className="sk-text-danger sk-small">{error}</p>}
    </div>
  );
}
