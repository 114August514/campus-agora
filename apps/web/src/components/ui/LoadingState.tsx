import { ICON_DEFAULTS, Loader2 } from "../icons";

/** `role="status"` so assistive technology announces the wait. */
export function LoadingState({ label = "正在加载" }: { label?: string }) {
  return (
    <div className="stateBlock" role="status">
      <Loader2 {...ICON_DEFAULTS} className="stateSpinner" aria-hidden="true" />
      <p className="stateTitle">{label}</p>
    </div>
  );
}
