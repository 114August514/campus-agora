import { ICON_DEFAULTS, Loader2 } from "../icons";

/**
 * `<output>` carries an implicit `status` role, so assistive technology
 * announces the wait without a hand-written role attribute.
 */
export function LoadingState({ label = "正在加载" }: { label?: string }) {
  return (
    <output className="stateBlock">
      <Loader2 {...ICON_DEFAULTS} className="stateSpinner" aria-hidden="true" />
      <p className="stateTitle">{label}</p>
    </output>
  );
}
