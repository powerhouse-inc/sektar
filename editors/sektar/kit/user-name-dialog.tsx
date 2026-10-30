import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Button, Field, Icon, Input, Lockup } from "./ui.js";
import { cleanUserName } from "./user-name.js";

/**
 * Asks for the user's name: the design system's sign-in dialog (site.html), a
 * native <dialog> around `.sk-modal`, full screen on a phone (user-name.css).
 * showModal() makes the page behind it inert and keeps the focus inside.
 *
 * Without `onCancel` it welcomes a new user and stays until there is a name;
 * with it, the user changes the name they have.
 */
export function UserNameDialog({
  name = "",
  onSave,
  onCancel,
}: {
  name?: string;
  onSave: (name: string) => void;
  onCancel?: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [value, setValue] = useState(name);
  const clean = cleanUserName(value);

  useEffect(() => {
    if (!dialog.current?.open) dialog.current?.showModal();
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (clean) onSave(clean);
  };

  return (
    <dialog
      ref={dialog}
      className="sk-name-dialog"
      aria-labelledby={titleId}
      // Escape and a phone's back gesture close a dialog: the welcome reopens.
      onClose={() => (onCancel ? onCancel() : dialog.current?.showModal())}
    >
      <form className="sk-modal sk-page" onSubmit={submit}>
        <Lockup variant="plain" h={28} className="sk-name-dialog__brand" />
        <h3 className="sk-modal__title" id={titleId}>
          {onCancel ? "Change your name" : "Welcome to Sektar"}
        </h3>
        {!onCancel && (
          <p className="sk-modal__body">
            Good to have you here. What should we call you?
          </p>
        )}
        <Field label="Your name">
          <Input
            name="user-name"
            autoComplete="name"
            autoCapitalize="words"
            enterKeyHint="done"
            maxLength={80}
            value={value}
            onChange={(event) => setValue(event.target.value)}
          />
        </Field>
        <div className="sk-modal__footer">
          {onCancel && (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          )}
          <Button type="submit" variant="primary" disabled={!clean}>
            {onCancel ? (
              "Save"
            ) : (
              <>
                Continue <Icon name="arrow-right" />
              </>
            )}
          </Button>
        </div>
        <p className="sk-caption">
          Your name is saved in this browser, and the assistant uses it to
          address you.
        </p>
      </form>
    </dialog>
  );
}
