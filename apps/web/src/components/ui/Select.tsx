import type { SelectHTMLAttributes } from "react";

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  id: string;
  label: string;
  options: readonly SelectOption[];
  error?: string;
}

export function Select({ id, label, options, error, ...props }: SelectProps) {
  const messageId = error ? `${id}-error` : undefined;

  return (
    <div className="field">
      <label className="fieldLabel" htmlFor={id}>
        {label}
      </label>
      <select
        className={`control controlSelect${error ? " control-invalid" : ""}`}
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p className="fieldError" id={messageId}>
          {error}
        </p>
      )}
    </div>
  );
}
