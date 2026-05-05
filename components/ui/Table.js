'use client';

/**
 * @param {{
 *   columns: Array<{ key: string, label: string, render?: (row: any) => React.ReactNode }>,
 *   rows: any[],
 *   loading?: boolean,
 *   emptyText?: string,
 *   className?: string
 * }} props
 */
export default function Table({ columns, rows, loading, emptyText = '暫無資料', className = '' }) {
  return (
    <div className={`table-wrapper ${className}`}>
      <table className="data-table">
        <thead>
          <tr>
            {columns.map(col => (
              <th key={col.key}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr><td colSpan={columns.length} className="table-loading">載入中…</td></tr>
          ) : rows.length === 0 ? (
            <tr><td colSpan={columns.length} className="table-empty">{emptyText}</td></tr>
          ) : (
            rows.map((row, i) => (
              <tr key={row.id ?? i}>
                {columns.map(col => (
                  <td key={col.key}>
                    {col.render ? col.render(row) : row[col.key]}
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
