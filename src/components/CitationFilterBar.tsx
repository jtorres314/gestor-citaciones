import React from 'react';
import { Search, Filter, X, RotateCcw, Calendar, Building, FileCheck2, UserCheck2, Tag } from 'lucide-react';
import { CitacionFilters } from '../types';

interface CitationFilterBarProps {
  filters: CitacionFilters;
  onFilterChange: (filters: CitacionFilters) => void;
  fiscalOptions: string[];
  showEstadoFilter?: boolean;
  showInformeFilter?: boolean;
  showAsistenciaFilter?: boolean;
  totalCount: number;
  filteredCount: number;
  placeholderSearch?: string;
}

export const CitationFilterBar: React.FC<CitationFilterBarProps> = ({
  filters,
  onFilterChange,
  fiscalOptions,
  showEstadoFilter = false,
  showInformeFilter = false,
  showAsistenciaFilter = false,
  totalCount,
  filteredCount,
  placeholderSearch = "BUSCAR POR NOMBRE, CÉDULA, No. ORDEN O MOTIVO..."
}) => {
  const isFiltered = Boolean(
    filters.searchTerm.trim() ||
    filters.fiscal !== 'todos' ||
    filters.fechaFiltro !== 'todas' ||
    (filters.fechaFiltro === 'rango' && (filters.fechaDesde || filters.fechaHasta)) ||
    (showEstadoFilter && filters.estado && filters.estado !== 'todos') ||
    (showInformeFilter && filters.informe && filters.informe !== 'todos') ||
    (showAsistenciaFilter && filters.asistencia && filters.asistencia !== 'todas')
  );

  const handleReset = () => {
    onFilterChange({
      searchTerm: '',
      fiscal: 'todos',
      fechaFiltro: 'todas',
      fechaDesde: '',
      fechaHasta: '',
      estado: 'todos',
      asistencia: 'todas',
      informe: 'todos'
    });
  };

  return (
    <div className="bg-white rounded-xl border border-fgn-border p-4 shadow-2xs space-y-3">
      {/* Top row: Search input + active filter badges + Reset */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder={placeholderSearch}
            value={filters.searchTerm}
            onChange={(e) => onFilterChange({ ...filters, searchTerm: e.target.value })}
            className="w-full bg-slate-50 border border-fgn-border rounded-lg py-2 pl-9 pr-8 text-xs font-semibold text-fgn-blue placeholder:text-slate-400 outline-none focus:bg-white focus:border-fgn-blue focus:ring-1 focus:ring-fgn-blue transition-all uppercase"
          />
          {filters.searchTerm && (
            <button
              type="button"
              onClick={() => onFilterChange({ ...filters, searchTerm: '' })}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 rounded"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex items-center justify-between md:justify-end gap-2 shrink-0">
          <div className="text-[11px] font-mono px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-lg text-slate-700">
            <strong>{filteredCount}</strong> de <strong>{totalCount}</strong> registros
          </div>

          {isFiltered && (
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg transition-colors uppercase tracking-wider"
              title="Restablecer todos los filtros"
            >
              <RotateCcw size={13} /> Limpiar Filtros
            </button>
          )}
        </div>
      </div>

      {/* Second row: Filter dropdowns */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2.5 pt-1 border-t border-slate-100 text-xs">
        {/* Despacho Fiscal */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
            <Building size={11} className="text-slate-400" /> Despacho Fiscal
          </label>
          <select
            value={filters.fiscal}
            onChange={(e) => onFilterChange({ ...filters, fiscal: e.target.value })}
            className="w-full bg-white border border-fgn-border rounded-md px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none focus:border-fgn-blue"
          >
            <option value="todos">Todos los despachos</option>
            {fiscalOptions.map((fisc) => (
              <option key={fisc} value={fisc}>
                Fiscal {fisc}
              </option>
            ))}
          </select>
        </div>

        {/* Fecha de comparecencia */}
        <div className="flex flex-col gap-1">
          <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
            <Calendar size={11} className="text-slate-400" /> Fecha Citación
          </label>
          <select
            value={filters.fechaFiltro}
            onChange={(e) => onFilterChange({ 
              ...filters, 
              fechaFiltro: e.target.value as any,
              fechaDesde: e.target.value !== 'rango' ? '' : filters.fechaDesde,
              fechaHasta: e.target.value !== 'rango' ? '' : filters.fechaHasta,
            })}
            className="w-full bg-white border border-fgn-border rounded-md px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none focus:border-fgn-blue"
          >
            <option value="todas">Todas las fechas</option>
            <option value="hoy">Para el día de Hoy</option>
            <option value="semana">Próximos 7 días</option>
            <option value="mes">Este mes</option>
            <option value="rango">Rango de fechas específico...</option>
          </select>
        </div>

        {/* Estado (if enabled) */}
        {showEstadoFilter && (
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
              <Tag size={11} className="text-slate-400" /> Estado Citación
            </label>
            <select
              value={filters.estado || 'todos'}
              onChange={(e) => onFilterChange({ ...filters, estado: e.target.value as any })}
              className="w-full bg-white border border-fgn-border rounded-md px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none focus:border-fgn-blue"
            >
              <option value="todos">Todos los estados</option>
              <option value="pendiente">Pendientes / Generadas</option>
              <option value="citado">Citados / Notificados</option>
            </select>
          </div>
        )}

        {/* Informe (if enabled) */}
        {showInformeFilter && (
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
              <FileCheck2 size={11} className="text-slate-400" /> Estado de Informe
            </label>
            <select
              value={filters.informe || 'todos'}
              onChange={(e) => onFilterChange({ ...filters, informe: e.target.value as any })}
              className="w-full bg-white border border-fgn-border rounded-md px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none focus:border-fgn-blue"
            >
              <option value="todos">Todos los informes</option>
              <option value="si">Con Informe Realizado</option>
              <option value="no">Sin Informe (Marcado No)</option>
              <option value="sin_marcar">Sin Marcar / Pendiente</option>
            </select>
          </div>
        )}

        {/* Asistencia (if enabled) */}
        {showAsistenciaFilter && (
          <div className="flex flex-col gap-1">
            <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider flex items-center gap-1">
              <UserCheck2 size={11} className="text-slate-400" /> Asistencia
            </label>
            <select
              value={filters.asistencia || 'todas'}
              onChange={(e) => onFilterChange({ ...filters, asistencia: e.target.value as any })}
              className="w-full bg-white border border-fgn-border rounded-md px-2.5 py-1.5 text-xs text-slate-700 font-medium outline-none focus:border-fgn-blue"
            >
              <option value="todas">Todas las asistencias</option>
              <option value="asistio">Asistió a la Diligencia</option>
              <option value="no_asistio">No Asistió</option>
              <option value="sin_marcar">Pendiente / Sin Registrar</option>
            </select>
          </div>
        )}

        {/* Date range inputs if 'rango' selected */}
        {filters.fechaFiltro === 'rango' && (
          <div className="flex items-center gap-1.5 sm:col-span-2">
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                Desde
              </label>
              <input
                type="date"
                value={filters.fechaDesde || ''}
                onChange={(e) => onFilterChange({ ...filters, fechaDesde: e.target.value })}
                className="w-full bg-white border border-fgn-border rounded-md px-2 py-1 text-xs text-slate-700 outline-none focus:border-fgn-blue"
              />
            </div>
            <div className="flex-1 flex flex-col gap-1">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-wider">
                Hasta
              </label>
              <input
                type="date"
                value={filters.fechaHasta || ''}
                onChange={(e) => onFilterChange({ ...filters, fechaHasta: e.target.value })}
                className="w-full bg-white border border-fgn-border rounded-md px-2 py-1 text-xs text-slate-700 outline-none focus:border-fgn-blue"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
