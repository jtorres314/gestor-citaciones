import React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { PageSizeOption } from '../types';

interface PaginationControlsProps {
  totalItems: number;
  currentPage: number;
  pageSize: PageSizeOption;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: PageSizeOption) => void;
  itemLabel?: string;
}

export const PaginationControls: React.FC<PaginationControlsProps> = ({
  totalItems,
  currentPage,
  pageSize,
  onPageChange,
  onPageSizeChange,
  itemLabel = 'citaciones'
}) => {
  if (totalItems === 0) return null;

  const isAll = pageSize === 'todos';
  const numericPageSize = isAll ? totalItems : pageSize;
  const totalPages = isAll ? 1 : Math.ceil(totalItems / numericPageSize);

  const startIdx = isAll ? 1 : (currentPage - 1) * numericPageSize + 1;
  const endIdx = isAll ? totalItems : Math.min(currentPage * numericPageSize, totalItems);

  // Generate page numbers with window
  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1);
    }
    const pages: (number | string)[] = [];
    pages.push(1);
    if (currentPage > 3) {
      pages.push('...');
    }
    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (currentPage < totalPages - 2) {
      pages.push('...');
    }
    pages.push(totalPages);
    return pages;
  };

  const pageSizeOptions: PageSizeOption[] = [10, 20, 50, 'todos'];

  return (
    <div className="bg-slate-50 border-t border-fgn-border/60 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs">
      {/* Left: Page Size Selector & Count Info */}
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-text-muted font-bold uppercase tracking-wider text-[10px]">
          Mostrar:
        </span>
        <div className="inline-flex rounded-lg border border-fgn-border bg-white p-0.5 shadow-2xs">
          {pageSizeOptions.map((opt) => {
            const isActive = pageSize === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => onPageSizeChange(opt)}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase rounded transition-colors ${
                  isActive
                    ? 'bg-fgn-blue text-white shadow-xs'
                    : 'text-slate-600 hover:text-fgn-blue hover:bg-slate-100'
                }`}
              >
                {opt === 'todos' ? 'Todos' : opt}
              </button>
            );
          })}
        </div>
        <span className="text-slate-500 font-mono text-[11px]">
          {isAll ? (
            <>Mostrando los <strong>{totalItems}</strong> {itemLabel}</>
          ) : (
            <>
              Mostrando <strong>{startIdx}</strong>–<strong>{endIdx}</strong> de <strong>{totalItems}</strong> {itemLabel}
            </>
          )}
        </span>
      </div>

      {/* Right: Navigation Controls (Only shown when not 'todos' and totalPages > 1) */}
      {!isAll && totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Primera página"
          >
            <ChevronsLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Página anterior"
          >
            <ChevronLeft size={14} />
          </button>

          <div className="flex items-center gap-1 mx-1">
            {getPageNumbers().map((p, idx) => {
              if (p === '...') {
                return (
                  <span key={`ellipsis-${idx}`} className="px-1.5 text-slate-400 font-bold">
                    …
                  </span>
                );
              }
              const isCurrent = p === currentPage;
              return (
                <button
                  key={`page-${p}`}
                  type="button"
                  onClick={() => onPageChange(p as number)}
                  className={`min-w-[28px] h-7 px-1.5 text-[11px] font-bold rounded transition-colors ${
                    isCurrent
                      ? 'bg-fgn-blue text-white shadow-2xs'
                      : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {p}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Página siguiente"
          >
            <ChevronRight size={14} />
          </button>
          <button
            type="button"
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none transition-colors"
            title="Última página"
          >
            <ChevronsRight size={14} />
          </button>
        </div>
      )}
    </div>
  );
};
