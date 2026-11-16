// The choices of how a PDF is read, as form controls: the reading method and
// what recognizes pages. Shared by the Convert dialog (one request) and
// Settings (a source's default). Each choice is a card that says in plain words
// what it does and rates what it trades.
// A local engine this host cannot run is shown with the host's own reason; it
// is never swapped for another. AI is offered only where the host can run it.
import type {
  ConversionCapabilities,
  ConversionProfile,
} from "../../../conversions/contracts.js";
import {
  localOcrOf,
  methodOf,
  READING_METHODS,
  recognitionOf,
  withLanguages,
  withOcrModel,
  withRecognition,
  type LocalOcr,
  type ReadingMethod,
  type RecognitionChoice,
} from "../../../pieces/docture/lib/profile.js";
import { ChoiceCards, type CardChoice } from "../kit/choice-cards.js";
import {
  engineName,
  INTEGRATED_AI_NAME,
  languageName,
  METHOD_FACTS,
  METHOD_HELP,
  METHOD_LABEL,
  methodAvailable,
  ocrModelChoices,
  SCANNER_FACTS,
  SCANNER_HELP,
  type SetupBlocker,
} from "../kit/conversion-model.js";

const needsSetup = (label: string, available: boolean) =>
  available ? label : `${label} (needs setup)`;

/** Whether AI is offered: the host can run it, or it is already chosen and can be undone. */
const aiShown = (
  capabilities: ConversionCapabilities | null,
  chosen: boolean,
): boolean => chosen || capabilities?.ai.availability.status === "available";

/** The reading method. A method the host cannot run is listed, marked, and cannot be picked. */
export function MethodSelect({
  value,
  onChange,
  capabilities,
}: {
  value: ReadingMethod;
  onChange: (value: ReadingMethod) => void;
  capabilities: ConversionCapabilities;
}) {
  const choices = READING_METHODS.filter(
    (method) => method !== "ai" || aiShown(capabilities, value === "ai"),
  ).map((method): CardChoice<ReadingMethod> => {
    const available = methodAvailable(method, capabilities);
    return {
      value: method,
      label: needsSetup(METHOD_LABEL[method], available),
      description: METHOD_HELP[method],
      facts: METHOD_FACTS[method],
      disabled: !available && method !== value,
    };
  });
  return (
    <ChoiceCards
      legend="Method"
      value={value}
      choices={choices}
      columns={choices.length === 4 ? 2 : choices.length}
      onChange={onChange}
    />
  );
}

/**
 * What reads the pages that are pictures, and that scanner's own options
 * under it: its model and the languages it reads. Shown for the methods that
 * scan (Standard and Scan every page); the others have no scanner to choose.
 * `ocr` is the local engine a switch away from the integrated model goes
 * back to.
 */
export function ScannerFields({
  profile,
  onChange,
  capabilities,
  ocr,
}: {
  profile: ConversionProfile;
  onChange: (profile: ConversionProfile) => void;
  capabilities: ConversionCapabilities | null;
  ocr?: LocalOcr;
}) {
  const method = methodOf(profile);
  const recognition = recognitionOf(profile);
  if (!recognition || (method !== "smart" && method !== "ocr")) return null;
  const local = localOcrOf(profile);
  return (
    <div className="sk-convert-scanner">
      <RecognitionSelect
        profile={profile}
        onChange={onChange}
        capabilities={capabilities}
        ocr={ocr}
      />
      {local && capabilities && (
        <ScannerOptions
          ocr={local}
          profile={profile}
          onChange={onChange}
          capabilities={capabilities}
        />
      )}
    </div>
  );
}

function RecognitionSelect({
  profile,
  onChange,
  capabilities,
  ocr,
}: {
  profile: ConversionProfile;
  onChange: (profile: ConversionProfile) => void;
  capabilities: ConversionCapabilities | null;
  ocr?: LocalOcr;
}) {
  const recognition = recognitionOf(profile);
  const engines = capabilities?.ocr ?? [
    { id: "tesseract" as const, label: "Tesseract", availability: null },
    { id: "paddleocr" as const, label: "PaddleOCR", availability: null },
  ];
  const value: RecognitionChoice =
    recognition?.kind === "ai" ? "ai" : (recognition?.engine ?? engines[0].id);
  const choices = engines.map((engine): CardChoice<RecognitionChoice> => {
    const available =
      !engine.availability || engine.availability.status === "available";
    return {
      value: engine.id,
      label: needsSetup(engine.label, available),
      description: SCANNER_HELP[engine.id],
      facts: SCANNER_FACTS[engine.id],
      disabled: !available && engine.id !== value,
    };
  });
  if (methodOf(profile) === "smart" && aiShown(capabilities, value === "ai")) {
    choices.push({
      value: "ai",
      label: needsSetup(
        INTEGRATED_AI_NAME,
        capabilities?.ai.availability.status === "available",
      ),
      description: SCANNER_HELP.ai,
      facts: SCANNER_FACTS.ai,
    });
  }
  return (
    <ChoiceCards
      legend="Scanner"
      value={value}
      choices={choices}
      onChange={(choice) => {
        if (choice === "ai") {
          onChange(withRecognition(profile, "ai"));
          return;
        }
        // Coming back from the model, the languages are the ones picked before.
        const languages = ocr?.engine === choice ? ocr.languages : undefined;
        onChange(withRecognition(profile, choice, languages));
      }}
    />
  );
}

/** The chosen local scanner's model and languages, for those it offers. */
function ScannerOptions({
  ocr,
  profile,
  onChange,
  capabilities,
}: {
  ocr: LocalOcr;
  profile: ConversionProfile;
  onChange: (profile: ConversionProfile) => void;
  capabilities: ConversionCapabilities;
}) {
  const engine = capabilities.ocr.find((each) => each.id === ocr.engine);
  const models = engine?.models ?? [];
  const installed = engine?.languages ?? [];
  const modelShown = models.length > 0 || ocr.model !== undefined;
  const languagesShown = installed.length > 0;
  if (!modelShown && !languagesShown) return null;
  return (
    <div className="sk-convert-scanner__options">
      {modelShown && (
        <ModelSelect
          ocr={ocr}
          models={models}
          onChange={(model) => onChange(withOcrModel(profile, model))}
        />
      )}
      {languagesShown && (
        <LanguageChoices
          ocr={ocr}
          installed={installed}
          onChange={(languages) => onChange(withLanguages(profile, languages))}
        />
      )}
    </div>
  );
}

/**
 * The scanner's model, from faster to more accurate. With none chosen the
 * host uses the first it lists, so that one shows as chosen until another
 * is picked.
 */
function ModelSelect({
  ocr,
  models,
  onChange,
}: {
  ocr: LocalOcr;
  models: readonly string[];
  onChange: (model: string) => void;
}) {
  const value = ocr.model ?? models.at(0) ?? "";
  const offered = models.includes(value) ? models : [...models, value];
  const choices = ocrModelChoices(offered).map(
    ({ id, label, description, facts }): CardChoice<string> =>
      models.includes(id)
        ? { value: id, label, description, facts }
        : {
            value: id,
            label: `${label} (not offered)`,
            description: "This host doesn't have it. Pick another.",
          },
  );
  return (
    <ChoiceCards
      legend="Speed and accuracy"
      value={value}
      choices={choices}
      scale={["Faster", "More accurate"]}
      onChange={onChange}
    />
  );
}

/**
 * The languages the scanner reads: every one the host has, and any the
 * profile names that it lacks. A profile keeps at least one.
 */
function LanguageChoices({
  ocr,
  installed,
  onChange,
}: {
  ocr: LocalOcr;
  installed: readonly string[];
  onChange: (languages: string[]) => void;
}) {
  const codes = [...new Set([...installed, ...ocr.languages])];
  return (
    <fieldset className="sk-field sk-convert-languages">
      <legend className="sk-label">Languages</legend>
      <span className="sk-hint">The languages your PDFs are written in.</span>
      <div className="sk-convert-languages__choices">
        {codes.map((code) => (
          <label key={code} className="sk-chip-toggle">
            <input
              type="checkbox"
              className="sk-sr-only"
              checked={ocr.languages.includes(code)}
              disabled={ocr.languages.length === 1 && ocr.languages[0] === code}
              onChange={(event) =>
                onChange(
                  event.target.checked
                    ? [...ocr.languages, code]
                    : ocr.languages.filter((each) => each !== code),
                )
              }
            />
            <span>
              {languageName(code)}
              {installed.includes(code) ? "" : " (not installed)"}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The scanner's name, with its model or its one language. */
function scannerName(
  scanner: NonNullable<ReturnType<typeof recognitionOf>>,
  capabilities: ConversionCapabilities | null,
): string {
  if (scanner.kind === "ai") return INTEGRATED_AI_NAME;
  const name = engineName(scanner.engine, capabilities);
  const model =
    scanner.model ??
    capabilities?.ocr.find((engine) => engine.id === scanner.engine)?.models.at(0);
  const detail =
    scanner.engine === "tesseract"
      ? scanner.languages.length === 1
        ? languageName(scanner.languages[0])
        : undefined
      : model && ocrModelChoices([model])[0].label;
  return detail ? `${name} · ${detail}` : name;
}

/**
 * The scanner from Settings, as one conversion uses it: named, not chosen.
 * When it reads several languages, this PDF may read fewer of them.
 */
export function AppScanner({
  app,
  profile,
  onLanguages,
  capabilities,
}: {
  app: ConversionProfile;
  profile: ConversionProfile;
  onLanguages: (languages: string[]) => void;
  capabilities: ConversionCapabilities | null;
}) {
  const scanner = recognitionOf(app);
  if (!scanner) return null;
  const local = localOcrOf(app);
  const chosen = localOcrOf(profile)?.languages ?? local?.languages ?? [];
  return (
    <section className="sk-convert-scanner sk-convert-app-scanner" aria-label="Scanner">
      <div className="sk-convert-app-scanner__head">
        <span className="sk-label">Scanner</span>
        <span className="sk-convert-app-scanner__name">
          {scannerName(scanner, capabilities)}
        </span>
      </div>
      {local && local.languages.length > 1 && (
        <fieldset className="sk-field sk-convert-languages">
          <legend className="sk-label">Languages in this PDF</legend>
          <div className="sk-convert-languages__choices">
            {local.languages.map((code) => (
              <label key={code} className="sk-chip-toggle">
                <input
                  type="checkbox"
                  className="sk-sr-only"
                  checked={chosen.includes(code)}
                  disabled={chosen.length === 1 && chosen[0] === code}
                  onChange={(event) =>
                    onLanguages(
                      event.target.checked
                        ? local.languages.filter(
                            (each) => each === code || chosen.includes(each),
                          )
                        : chosen.filter((each) => each !== code),
                    )
                  }
                />
                <span>{languageName(code)}</span>
              </label>
            ))}
          </div>
        </fieldset>
      )}
      <p className="sk-caption">
        From Settings → Document conversion. To use another scanner
        {local ? ", model or language" : ""}, change it there.
      </p>
    </section>
  );
}

/** Why the chosen profile cannot run on this host, and what to set up. */
export function BlockerList({
  blockers,
}: {
  blockers: readonly SetupBlocker[];
}) {
  if (blockers.length === 0) return null;
  return (
    <ul className="sk-convert-setup" role="alert">
      {blockers.map((blocker, at) => (
        <li key={at}>
          <strong>{blocker.what} needs setup.</strong> {blocker.reason}{" "}
          {blocker.setup}
        </li>
      ))}
    </ul>
  );
}
