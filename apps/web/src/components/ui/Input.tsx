import type { InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  id: string;
  label: string;
  /** Rendered as text and linked with aria-describedby, so the failure never
   * depends on colour alone. */
  error?: string;
  hint?: string;
}

export function Input({ id, label, error, hint, ...props }: InputProps) {
  const messageId = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  return (
    <div className="field">
      <label className="fieldLabel" htmlFor={id}>
        {label}
      </label>
      <input
        className={`control${error ? " control-invalid" : ""}`}
        id={id}
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
