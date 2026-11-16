// A choice of one, as cards that are all visible at once: each names the
// choice, rates what it trades in dots or a word, and says what it does. The
// cards are native radios, so Tab reaches the group and the arrow keys move
// between them.
import { useId, type CSSProperties } from "react";
import type { ChoiceFact } from "./conversion-model.js";
import { cx } from "./ui.js";

export type CardChoice<T extends string> = {
  value: T;
  label: string;
  description?: string;
  facts?: readonly ChoiceFact[];
  /** Shown, not pickable */
  disabled?: boolean;
};

const LEVELS = 5;

export function ChoiceCards<T extends string>({
  legend,
  value,
  choices,
  onChange,
  columns = choices.length,
  scale,
}: {
  legend: string;
  value: T;
  choices: readonly CardChoice<T>[];
  onChange: (value: T) => void;
  /** Cards per row where there is room; they stack where there is not */
  columns?: number;
  /** What the cards run from and to, in their order: ["Faster", "More accurate"] */
  scale?: readonly [string, string];
}) {
  const id = useId();
  return (
    <fieldset className="sk-choice-cards">
      <legend className="sk-label">{legend}</legend>
      <div className="sk-choice-cards__room">
        {scale && (
          <div className="sk-choice-cards__scale" aria-hidden="true">
            <span>← {scale[0]}</span>
            <span>{scale[1]} →</span>
          </div>
        )}
        <div
          className="sk-choice-cards__grid"
          data-columns={Math.min(columns, 4)}
          style={{ "--sk-choice-columns": columns } as CSSProperties}
        >
          {choices.map((choice, at) => {
            const key = `${id}-${at}`;
            return (
              <label
                key={choice.value}
                className={cx(
                  "sk-choice-card",
                  choice.disabled && "is-disabled",
                )}
              >
                <input
                  type="radio"
                  className="sk-sr-only"
                  name={id}
                  value={choice.value}
                  checked={choice.value === value}
                  disabled={choice.disabled}
                  aria-labelledby={`${key}-name`}
                  aria-describedby={
                    [
                      choice.facts?.length ? `${key}-facts` : "",
                      choice.description ? `${key}-text` : "",
                    ]
                      .filter(Boolean)
                      .join(" ") || undefined
                  }
                  onChange={() => onChange(choice.value)}
                />
                <span className="sk-choice-card__head">
                  <span className="sk-choice-card__name" id={`${key}-name`}>
                    {choice.label}
                  </span>
                  <span className="sk-choice-card__tick" aria-hidden="true">
                    <svg width="12" height="12" viewBox="0 0 12 12">
                      <path d="M2.5 6.2l2.3 2.3 4.7-4.9" />
                    </svg>
                  </span>
                </span>
                {choice.facts && choice.facts.length > 0 && (
                  <span className="sk-choice-card__facts" id={`${key}-facts`}>
                    {choice.facts.map((fact) => (
                      <Fact key={fact.label} fact={fact} />
                    ))}
                  </span>
                )}
                {choice.description && (
                  <span className="sk-choice-card__text" id={`${key}-text`}>
                    {choice.description}
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>
    </fieldset>
  );
}

function Fact({ fact }: { fact: ChoiceFact }) {
  return (
    <span className="sk-choice-card__fact">
      <span>{fact.label}</span>
      {"text" in fact ? (
        <span>{fact.text}</span>
      ) : (
        <span
          className="sk-choice-card__dots"
          role="img"
          aria-label={`${fact.level} of ${LEVELS}`}
        >
          {Array.from({ length: LEVELS }, (_, at) => (
            <i key={at} className={at < fact.level ? "is-on" : undefined} />
          ))}
        </span>
      )}
    </span>
  );
}
