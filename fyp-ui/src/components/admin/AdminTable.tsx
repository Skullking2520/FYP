import type { ReactNode } from "react";

type Column<T> = {
  header: string;
  render: (row: T) => ReactNode;
  className?: string;
};

type AdminTableProps<T> = {
  columns: Column<T>[];
  data: T[];
  emptyLabel?: string;
};

export function AdminTable<T>({ columns, data, emptyLabel = "No records" }: AdminTableProps<T>) {
  return (
    <div className="overflow-x-auto rounded-2xl border bg-white shadow-sm">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
            {columns.map((column) => (
              <th key={column.header} className="px-4 py-3">
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-6 text-center text-slate-500">
                {emptyLabel}
              </td>
            </tr>
          ) : (
            data.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t">
                {columns.map((column) => (
                  <td key={column.header} className={`px-4 py-3 align-top ${column.className ?? ""}`}>
                    {column.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
