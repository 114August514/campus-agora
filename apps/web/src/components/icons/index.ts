/**
 * The single entry point for icons. Pages and features import from here, never
 * from `lucide-react` directly and never by hand-writing SVG, so the icon set
 * and its stroke weight stay consistent across the product.
 */
export {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  History,
  Inbox,
  Loader2,
  MessageSquareWarning,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
} from "lucide-react";

/** Rounded outline at 2px, per docs/engineering/development.md. */
export const ICON_DEFAULTS = {
  strokeWidth: 2,
  size: 20,
} as const;
