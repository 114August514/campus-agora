import type { TextareaHTMLAttributes } from "react";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  id: string;
  label: string;
  error?: string;
  hint?: string;
}

export function Textarea({
  id,
  label,
  error,
  hint,
  rows = 12,
  ...props
}: TextareaProps) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="field">
      <label className="fieldLabel" htmlFor={id}>
        {label}
      </label>
      <textarea
        className={`control controlTextarea${error ? " control-invalid" : ""}`}
        id={id}
        rows={rows}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        {...props}
      />
      {error ? (
        <p className="fieldError" id={messageId}>
          {error}
        </p>
      ) : hint ? (
        <p className="fieldHint" id={messageId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}
