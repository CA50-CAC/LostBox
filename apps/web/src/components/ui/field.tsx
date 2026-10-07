/**
 * Form fields with a visible label, optional help text, and an error message
 * that screen readers announce with the field (aria-describedby).
 */
import type { ComponentProps, ReactNode } from "react";

export const inputClass =
  "block w-full min-h-11 rounded-xl border border-border-input bg-background px-3.5 py-2 text-base text-foreground transition-colors placeholder:text-muted/80 hover:border-accent focus:border-accent aria-[invalid=true]:border-danger";

interface FieldProps {
  id: string;
  label: string;
  help?: ReactNode;
  error?: string;
  optional?: string;
  children: (describedBy: string | undefined, invalid: boolean) => ReactNode;
}

export function Field({ id, label, help, error, optional, children }: FieldProps) {
  const helpId = help ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [helpId, errorId].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[0.95rem] font-medium">
        {label}
        {optional ? <span className="ml-1 font-normal text-muted">({optional})</span> : null}
      </label>
      {children(describedBy, Boolean(error))}
      {help ? (
        <p id={helpId} className="text-sm text-muted">
          {help}
        </p>
      ) : null}
      {error ? (
        <p id={errorId} className="text-sm font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function TextInput({
  id,
  label,
  help,
  error,
  optional,
  className,
  ...props
}: Omit<ComponentProps<"input">, "id"> & { id: string; label: string; help?: ReactNode; error?: string; optional?: string }) {
  return (
    <Field id={id} label={label} help={help} error={error} optional={optional}>
      {(describedBy, invalid) => (
        <input
          id={id}
          className={className ?? inputClass}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...props}
        />
      )}
    </Field>
  );
}

export function TextArea({
  id,
  label,
  help,
  error,
  optional,
  ...props
}: Omit<ComponentProps<"textarea">, "id"> & { id: string; label: string; help?: ReactNode; error?: string; optional?: string }) {
  return (
    <Field id={id} label={label} help={help} error={error} optional={optional}>
      {(describedBy, invalid) => (
        <textarea
          id={id}
          className={`${inputClass} min-h-24`}
          aria-describedby={describedBy}
          aria-invalid={invalid || undefined}
          {...props}
        />
      )}
    </Field>
  );
}

export function Select({
  id,
  label,
  help,
  error,
  optional,
  children,
  ...props
}: Omit<ComponentProps<"select">, "id"> & { id: string; label: string; help?: ReactNode; error?: string; optional?: string }) {
  return (
    <Field id={id} label={label} help={help} error={error} optional={optional}>
      {(describedBy, invalid) => (
        <select id={id} className={inputClass} aria-describedby={describedBy} aria-invalid={invalid || undefined} {...props}>
          {children}
        </select>
      )}
    </Field>
  );
}

/** A hidden field bots fill in and people never see. Submissions with it filled are dropped. */
export function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] h-px w-px overflow-hidden">
      <label>
        Leave this empty
        <input type="text" name="website" tabIndex={-1} autoComplete="off" />
      </label>
    </div>
  );
}
