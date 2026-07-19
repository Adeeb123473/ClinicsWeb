import type { ReactNode } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Skeleton } from "./Skeleton";
import { EmptyState } from "./EmptyState";
import { cn } from "../utils/cn";

export interface Column<T> {
  key: string;
  header: ReactNode;
  render: (row: T) => ReactNode;
  className?: string;
  headerClassName?: string;
}

export interface TableProps<T> {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T) => string;
  isLoading?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: ReactNode;
  onRowClick?: (row: T) => void;
}

/** Generic data table with built-in loading skeletons and empty state. */
export function Table<T>({
  columns,
  rows,
  rowKey,
  isLoading,
  emptyTitle = "Nothing here yet",
  emptyDescription,
  emptyAction,
  onRowClick,
}: TableProps<T>) {
  const reduce = useReducedMotion();

  if (isLoading) {
    return (
      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-soft">
        <div className="space-y-3 p-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />;
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-soft">
      <table className="w-full min-w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
            {columns.map((col) => (
              <th key={col.key} className={cn("px-4 py-3", col.headerClassName)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <motion.tbody
          initial="hidden"
          animate="visible"
          variants={{ visible: { transition: { staggerChildren: reduce ? 0 : 0.03 } } }}
        >
          {rows.map((row) => (
            <motion.tr
              key={rowKey(row)}
              variants={{ hidden: { opacity: 0, y: reduce ? 0 : 6 }, visible: { opacity: 1, y: 0 } }}
              transition={{ duration: 0.2 }}
              onClick={onRowClick ? () => onRowClick(row) : undefined}
              className={cn(
                "border-b border-slate-50 text-slate-700 last:border-0",
                onRowClick && "cursor-pointer transition-colors hover:bg-slate-50",
              )}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn("px-4 py-3 align-middle", col.className)}>
                  {col.render(row)}
                </td>
              ))}
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  );
}
