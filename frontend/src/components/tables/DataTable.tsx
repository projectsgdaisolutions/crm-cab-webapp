import { type ReactNode, useState, useMemo } from 'react'
import { ChevronLeft, ChevronRight, ChevronsUpDown, ArrowUp, ArrowDown, Inbox } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface Column<T> {
  key: string
  header: string
  render?: (row: T) => ReactNode
  sortable?: boolean
  accessor?: (row: T) => string | number
  className?: string
  width?: string
}

interface DataTableProps<T> {
  columns: Column<T>[]
  data: T[]
  rowKey: (row: T) => string
  pageSize?: number
  onRowClick?: (row: T) => void
  emptyState?: ReactNode
  bulkSelect?: boolean
  onBulkSelect?: (ids: string[]) => void
  initialSort?: { key: string; dir: 'asc' | 'desc' }
}

export function DataTable<T>({
  columns,
  data,
  rowKey,
  pageSize = 10,
  onRowClick,
  emptyState,
  bulkSelect = false,
  onBulkSelect,
  initialSort,
}: DataTableProps<T>) {
  const [page, setPage] = useState(1)
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(initialSort || null)
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const sorted = useMemo(() => {
    if (!sort) return data
    const col = columns.find((c) => c.key === sort.key)
    if (!col) return data
    const accessor = col.accessor || ((row: T) => (row as Record<string, unknown>)[sort.key] as string | number)
    return [...data].sort((a, b) => {
      const av = accessor(a)
      const bv = accessor(b)
      if (av < bv) return sort.dir === 'asc' ? -1 : 1
      if (av > bv) return sort.dir === 'asc' ? 1 : -1
      return 0
    })
  }, [data, sort, columns])

  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const currentPage = Math.min(page, totalPages)
  const paged = sorted.slice((currentPage - 1) * pageSize, currentPage * pageSize)

  const toggleSort = (col: Column<T>) => {
    if (!col.sortable) return
    setSort((prev) => {
      if (prev?.key !== col.key) return { key: col.key, dir: 'asc' }
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' }
      return null
    })
  }

  const allOnPageSelected = paged.every((r) => selected.has(rowKey(r)))
  const togglePage = () => {
    const next = new Set(selected)
    if (allOnPageSelected) {
      paged.forEach((r) => next.delete(rowKey(r)))
    } else {
      paged.forEach((r) => next.add(rowKey(r)))
    }
    setSelected(next)
    onBulkSelect?.(Array.from(next))
  }

  const toggleRow = (id: string) => {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
    onBulkSelect?.(Array.from(next))
  }

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200">
              {bulkSelect && (
                <th className="px-4 py-3 w-10">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected && paged.length > 0}
                    onChange={togglePage}
                    className="rounded border-slate-300 text-teal-600 focus:ring-teal-500/40"
                  />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    'px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider',
                    col.sortable && 'cursor-pointer select-none hover:text-slate-700',
                    col.className,
                  )}
                  style={col.width ? { width: col.width } : undefined}
                  onClick={() => toggleSort(col)}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.header}
                    {col.sortable && (
                      <>
                        {sort?.key === col.key ? (
                          sort.dir === 'asc' ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                        ) : (
                          <ChevronsUpDown className="h-3 w-3 text-slate-300" />
                        )}
                      </>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {paged.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (bulkSelect ? 1 : 0)} className="px-4 py-16 text-center">
                  {emptyState || (
                    <div className="flex flex-col items-center text-slate-400">
                      <Inbox className="h-10 w-10 mb-2" />
                      <p className="text-sm">No records found</p>
                    </div>
                  )}
                </td>
              </tr>
            ) : (
              paged.map((row) => {
                const id = rowKey(row)
                return (
                  <tr
                    key={id}
                    onClick={() => onRowClick?.(row)}
                    className={cn(
                      'hover:bg-slate-50/60 transition-colors',
                      onRowClick && 'cursor-pointer',
                      selected.has(id) && 'bg-teal-50/40',
                    )}
                  >
                    {bulkSelect && (
                      <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.has(id)}
                          onChange={() => toggleRow(id)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500/40"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td key={col.key} className={cn('px-4 py-3 text-sm text-slate-700', col.className)}>
                        {col.render ? col.render(row) : String((row as Record<string, unknown>)[col.key] ?? '')}
                      </td>
                    ))}
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </div>
      {sorted.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-100 flex items-center justify-between text-sm">
          <p className="text-slate-500">
            Showing <span className="font-medium text-slate-700">{(currentPage - 1) * pageSize + 1}</span> to{' '}
            <span className="font-medium text-slate-700">{Math.min(currentPage * pageSize, sorted.length)}</span> of{' '}
            <span className="font-medium text-slate-700">{sorted.length}</span>
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="px-2 text-slate-600">
              Page {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
