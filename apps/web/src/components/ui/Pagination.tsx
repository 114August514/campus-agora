import { ChevronLeft, ChevronRight, ICON_DEFAULTS } from "../icons";
import { Button } from "./Button";

/**
 * Page-based paging matching the API's envelope. Lists are always paged; the
 * performance budget forbids rendering an unbounded list.
 */
export function Pagination({
  page,
  totalItems,
  totalPages,
  onPageChange,
}: {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  onPageChange: (page: number) => void;
}) {
  return (
    <nav className="pagination" aria-label="分页">
      <Button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        aria-label="上一页"
      >
        <ChevronLeft {...ICON_DEFAULTS} size={16} aria-hidden="true" />
        上一页
      </Button>
      <span className="paginationStatus">
        第 {page} / {Math.max(totalPages, 1)} 页，共 {totalItems} 条
      </span>
      <Button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        aria-label="下一页"
      >
        下一页
        <ChevronRight {...ICON_DEFAULTS} size={16} aria-hidden="true" />
      </Button>
    </nav>
  );
}
