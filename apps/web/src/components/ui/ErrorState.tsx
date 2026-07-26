import { AlertCircle, ICON_DEFAULTS } from "../icons";
import { Button } from "./Button";

/**
 * `role="alert"` because a failed load is not something the user asked to see.
 * A retry is offered whenever the caller can retry.
 */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="stateBlock stateBlock-error" role="alert">
      <AlertCircle
        {...ICON_DEFAULTS}
        size={24}
        className="stateIcon"
        aria-hidden="true"
      />
      <p className="stateTitle">{message}</p>
      {onRetry && <Button onClick={onRetry}>重试</Button>}
    </div>
  );
}
