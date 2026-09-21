import React, { useState, useMemo } from 'react';
import { motion } from 'motion/react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  AlertTriangle, 
  Flame, 
  UserCheck, 
  UserX, 
  Eye, 
  FileDown, 
  Mail, 
  MessageCircle, 
  CheckCircle,
  Filter,
  Users,
  CalendarDays,
  CalendarRange,
  ListOrdered,
  Trash2,
  Zap,
  Sparkles
} from 'lucide-react';
import { Citacion, InvestigatorConfig } from '../types';
import { 
  formatDateES, 
  formatTimeAMPM, 
  getTodayDateStr, 
  analyzeCitationUrgency,
  detectScheduleConflicts,
  generateWhatsAppMessage,
  getOutlook365Url
} from '../services/citationService';
import { ConflictResolutionModal } from './ConflictResolutionModal';

interface JudicialCalendarProps {
  citations: Citacion[];
  config: InvestigatorConfig;
  onViewCitation: (citation: Citacion) => void;
  onEditCitation?: (citation: Citacion) => void;
  onDownloadDocx?: (citation: Citacion) => void;
  onMarkAttendance?: (id: string, status: 'asistio' | 'no_asistio' | null) => void;
  onDeleteCitation?: (id: string, name: string) => void;
  onUpdateCitation?: (updated: Citacion) => Promise<void> | void;
}

type CalendarViewMode = 'month' | 'week' | 'day';

export const JudicialCalendar: React.FC<JudicialCalendarProps> = ({
  citations,
  config,
  onViewCitation,
  onEditCitation,
  onDownloadDocx,
  onMarkAttendance,
  onDeleteCitation,
  onUpdateCitation
}) => {
  const [viewMode, setViewMode] = useState<CalendarViewMode>('month');
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [selectedDayStr, setSelectedDayStr] = useState<string>(getTodayDateStr());
  const [filterFiscal, setFilterFiscal] = useState<string>('all');
  const [filterState, setFilterState] = useState<string>('all');
  const [resolutionCitation, setResolutionCitation] = useState<Citacion | null>(null);

  const conflictMap = useMemo(() => detectScheduleConflicts(citations), [citations]);

  // Unique fiscals for filter dropdown
  const fiscalList = useMemo(() => {
    const list = new Set<string>();
    citations.forEach(c => {
      if (c.fiscal && c.fiscal.trim()) list.add(c.fiscal.trim());
    });
    return Array.from(list).sort();
  }, [citations]);

  // Filtered citations based on user selections
  const filteredCitations = useMemo(() => {
    return citations.filter(c => {
      if (filterFiscal !== 'all' && c.fiscal !== filterFiscal) return false;
      if (filterState === 'urgent' && !analyzeCitationUrgency(c).isUrgent) return false;
      if (filterState === 'conflict' && (!conflictMap.get(c.id) || conflictMap.get(c.id)!.length === 0)) return false;
      if (filterState === 'attended' && c.asistencia !== 'asistio') return false;
      if (filterState === 'unattended' && c.asistencia !== 'no_asistio') return false;
      return true;
    });
  }, [citations, filterFiscal, filterState, conflictMap]);

  // Map of date string -> citations array
  const citationsByDate = useMemo(() => {
    const map = new Map<string, Citacion[]>();
    for (const c of filteredCitations) {
      if (!c.fecha) continue;
      if (!map.has(c.fecha)) {
        map.set(c.fecha, []);
      }
      map.get(c.fecha)!.push(c);
    }
    // Sort each day's citations by time
    for (const [, list] of map.entries()) {
      list.sort((a, b) => (a.hora || '').localeCompare(b.hora || ''));
    }
    return map;
  }, [filteredCitations]);

  // Overall analytics stats
  const stats = useMemo(() => {
    const todayStr = getTodayDateStr();
    let todayCount = 0;
    let conflictCount = 0;
    let urgentCount = 0;
    let pastDueCount = 0;

    for (const c of citations) {
      if (c.fecha === todayStr) todayCount++;
      const urg = analyzeCitationUrgency(c);
      if (urg.status === 'past_due_unattended') pastDueCount++;
      if (urg.isUrgent) urgentCount++;
      if (conflictMap.has(c.id) && conflictMap.get(c.id)!.length > 0) conflictCount++;
    }

    return { todayCount, conflictCount, urgentCount, pastDueCount, total: citations.length };
  }, [citations, conflictMap]);

  // Month Navigation calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"
  ];

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday
  // Adjust so Monday is 0
  const adjustedFirstDay = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const prevMonthDays = new Date(year, month, 0).getDate();

  const handlePrev = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month - 1, 1));
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(currentDate.getDate() - 7);
      setCurrentDate(next);
    } else {
      const next = new Date(currentDate);
      next.setDate(currentDate.getDate() - 1);
      setCurrentDate(next);
      setSelectedDayStr(next.toISOString().split('T')[0]);
    }
  };

  const handleNext = () => {
    if (viewMode === 'month') {
      setCurrentDate(new Date(year, month + 1, 1));
    } else if (viewMode === 'week') {
      const next = new Date(currentDate);
      next.setDate(currentDate.getDate() + 7);
      setCurrentDate(next);
    } else {
      const next = new Date(currentDate);
      next.setDate(currentDate.getDate() + 1);
      setCurrentDate(next);
      setSelectedDayStr(next.toISOString().split('T')[0]);
    }
  };

  const handleGoToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDayStr(getTodayDateStr());
  };

  // Build month calendar grid cells
  const calendarCells = useMemo(() => {
    const cells = [];

    // Previous month filler days
    for (let i = adjustedFirstDay - 1; i >= 0; i--) {
      const dayNum = prevMonthDays - i;
      const prevMonth = month === 0 ? 11 : month - 1;
      const prevYear = month === 0 ? year - 1 : year;
      const dateStr = `${prevYear}-${String(prevMonth + 1).padStart(2, '0')}-${String(dayNum).padStart(2, '0')}`;
      cells.push({
        dayNum,
        dateStr,
        isCurrentMonth: false,
        citations: citationsByDate.get(dateStr) || []
      });
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: true,
        citations: citationsByDate.get(dateStr) || []
      });
    }

    // Next month filler days
    const remaining = 42 - cells.length;
    for (let i = 1; i <= remaining; i++) {
      const nextMonth = month === 11 ? 0 : month + 1;
      const nextYear = month === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonth + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      cells.push({
        dayNum: i,
        dateStr,
        isCurrentMonth: false,
        citations: citationsByDate.get(dateStr) || []
      });
    }

    return cells;
  }, [year, month, daysInMonth, adjustedFirstDay, prevMonthDays, citationsByDate]);

  // Citations for currently selected day
  const selectedDayCitations = useMemo(() => {
    return citationsByDate.get(selectedDayStr) || [];
  }, [citationsByDate, selectedDayStr]);

  const todayStr = getTodayDateStr();

  return (
    <div className="space-y-6">
      {/* STATS & SUMMARY DASHBOARD BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-fgn-border p-3.5 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Diligencias Hoy</span>
            <Flame size={16} className="text-amber-500" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-fgn-blue mt-1 font-mono">
            {stats.todayCount}
          </p>
          <span className="text-[9px] text-slate-400 font-medium">Programadas para hoy</span>
        </div>

        <div className={`p-3.5 rounded-xl border shadow-2xs ${stats.conflictCount > 0 ? 'bg-red-50/70 border-red-200' : 'bg-white border-fgn-border'}`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-red-700 uppercase tracking-wider">Cruces de Horario</span>
            <AlertTriangle size={16} className={stats.conflictCount > 0 ? 'text-red-600' : 'text-slate-300'} />
          </div>
          <p className={`text-xl sm:text-2xl font-black mt-1 font-mono ${stats.conflictCount > 0 ? 'text-red-700' : 'text-slate-700'}`}>
            {stats.conflictCount}
          </p>
          <span className="text-[9px] text-red-600/80 font-medium">Citas en misma fecha y hora</span>
        </div>

        <div className="bg-white border border-fgn-border p-3.5 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Urgentes / &lt;36h</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-amber-700 mt-1 font-mono">
            {stats.urgentCount}
          </p>
          <span className="text-[9px] text-slate-400 font-medium">Atención prioritaria</span>
        </div>

        <div className="bg-white border border-fgn-border p-3.5 rounded-xl shadow-2xs">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Total Agendadas</span>
            <Users size={16} className="text-fgn-blue" />
          </div>
          <p className="text-xl sm:text-2xl font-black text-fgn-blue mt-1 font-mono">
            {stats.total}
          </p>
          <span className="text-[9px] text-slate-400 font-medium">En el sistema activo</span>
        </div>
      </div>

      {/* CALENDAR CONTROLS & HEADER */}
      <div className="bg-white border border-fgn-border rounded-xl p-4 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* MONTH / TITLE NAVIGATION */}
          <div className="flex items-center gap-3">
            <div className="p-2 bg-fgn-blue/10 rounded-lg text-fgn-blue">
              <CalendarIcon size={20} />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-fgn-blue uppercase tracking-tight flex items-center gap-2">
                <span>{monthNames[month]} {year}</span>
              </h2>
              <p className="text-[10px] text-slate-500 font-medium">
                Agenda Oficial de Citaciones y Diligencias de Policía Judicial
              </p>
            </div>
          </div>

          {/* VIEW SWITCHER & DATE CONTROLS */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleGoToday}
              className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Hoy
            </button>

            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                onClick={handlePrev}
                className="p-1.5 hover:bg-white rounded-md text-slate-700 transition-all cursor-pointer"
                title="Anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handleNext}
                className="p-1.5 hover:bg-white rounded-md text-slate-700 transition-all cursor-pointer"
                title="Siguiente"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <div className="flex items-center bg-slate-100 rounded-lg p-0.5 border border-slate-200">
              <button
                onClick={() => setViewMode('month')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${viewMode === 'month' ? 'bg-fgn-blue text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <CalendarRange size={13} /> <span>Mes</span>
              </button>
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold uppercase transition-all cursor-pointer flex items-center gap-1 ${viewMode === 'day' ? 'bg-fgn-blue text-white shadow-2xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                <ListOrdered size={13} /> <span>Día / Agenda</span>
              </button>
            </div>
          </div>
        </div>

        {/* FILTERS BAR */}
        <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-1">
              <Filter size={12} /> Filtrar:
            </span>

            {/* Fiscal filter */}
            <select
              value={filterFiscal}
              onChange={(e) => setFilterFiscal(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-fgn-blue"
            >
              <option value="all">Todas las Fiscalías</option>
              {fiscalList.map(f => (
                <option key={f} value={f}>Fiscalía {f}</option>
              ))}
            </select>

            {/* State filter */}
            <select
              value={filterState}
              onChange={(e) => setFilterState(e.target.value)}
              className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 outline-none focus:border-fgn-blue"
            >
              <option value="all">Todos los Estados</option>
              <option value="conflict">⚠️ Solo Cruces de Horario</option>
              <option value="urgent">🔥 Diligencias Urgentes</option>
              <option value="attended">✅ Asistió</option>
              <option value="unattended">❌ No Asistió</option>
            </select>
          </div>

          <div className="flex items-center gap-2 text-[10px] text-slate-500 font-medium">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> Programada
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Cruce / Vencida
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> Asistió
            </span>
          </div>
        </div>
      </div>

      {/* MONTH VIEW GRID */}
      {viewMode === 'month' && (
        <div className="bg-white border border-fgn-border rounded-xl overflow-hidden shadow-sm">
          {/* DAY NAMES HEADER */}
          <div className="grid grid-cols-7 bg-fgn-blue text-white text-[10px] sm:text-xs font-bold uppercase tracking-widest text-center py-2.5 border-b border-fgn-blue/30">
            <div>Lun</div>
            <div>Mar</div>
            <div>Mié</div>
            <div>Jue</div>
            <div>Vie</div>
            <div>Sáb</div>
            <div>Dom</div>
          </div>

          {/* CELLS GRID */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {calendarCells.map((cell, idx) => {
              const isToday = cell.dateStr === todayStr;
              const isSelected = cell.dateStr === selectedDayStr;
              const hasCitations = cell.citations.length > 0;
              const dayConflicts = cell.citations.some(c => conflictMap.has(c.id) && conflictMap.get(c.id)!.length > 0);

              return (
                <div
                  key={`${cell.dateStr}-${idx}`}
                  onClick={() => {
                    setSelectedDayStr(cell.dateStr);
                    if (cell.citations.length > 0) {
                      // Keep on selected
                    }
                  }}
                  className={`min-h-[90px] sm:min-h-[110px] p-1.5 sm:p-2 transition-all cursor-pointer flex flex-col justify-between ${cell.isCurrentMonth ? 'bg-white' : 'bg-slate-50/50 text-slate-400'} ${isSelected ? 'ring-2 ring-fgn-blue ring-inset bg-blue-50/30' : 'hover:bg-slate-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-[10px] sm:text-xs font-bold rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center font-mono ${isToday ? 'bg-amber-400 text-amber-950 font-black shadow-xs' : cell.isCurrentMonth ? 'text-slate-700' : 'text-slate-400'}`}>
                      {cell.dayNum}
                    </span>

                    {hasCitations && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded-full ${dayConflicts ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-fgn-blue'}`}>
                        {cell.citations.length}
                      </span>
                    )}
                  </div>

                  {/* CITATION MINI BADGES */}
                  <div className="space-y-1 mt-1 overflow-hidden flex-1">
                    {cell.citations.slice(0, 3).map((cit) => {
                      const isCitConflict = conflictMap.has(cit.id) && conflictMap.get(cit.id)!.length > 0;
                      return (
                        <div
                          key={cit.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewCitation(cit);
                          }}
                          className={`text-[9px] truncate px-1.5 py-0.5 rounded font-medium transition-transform hover:scale-[1.02] cursor-pointer flex items-center gap-1 ${cit.asistencia === 'asistio' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : isCitConflict ? 'bg-red-100 text-red-800 border border-red-300 font-bold' : 'bg-blue-50 text-fgn-blue border border-blue-100'}`}
                          title={`${cit.hora ? formatTimeAMPM(cit.hora) : ''} - ${cit.nombre}`}
                        >
                          <span className="font-mono font-bold shrink-0">{cit.hora?.slice(0, 5)}</span>
                          <span className="truncate">{cit.nombre}</span>
                        </div>
                      );
                    })}

                    {cell.citations.length > 3 && (
                      <p className="text-[8px] font-bold text-slate-500 text-center">
                        +{cell.citations.length - 3} más
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SELECTED DAY / AGENDA DETAILS PANEL */}
      <div className="bg-white border border-fgn-border rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-fgn-border pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-fgn-gold/20 text-fgn-blue rounded-lg">
              <CalendarDays size={18} />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-fgn-blue uppercase">
                Diligencias del {formatDateES(selectedDayStr)}
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">
                {selectedDayCitations.length === 1 
                  ? '1 citación programada para esta fecha' 
                  : `${selectedDayCitations.length} citaciones programadas para esta fecha`}
              </p>
            </div>
          </div>

          <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-3 py-1.5 rounded-lg border border-slate-200 w-fit">
            {selectedDayStr}
          </span>
        </div>

        {selectedDayCitations.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <CalendarIcon size={36} className="mx-auto text-slate-300" />
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
              No hay citaciones programadas para este día
            </p>
            <p className="text-[11px] text-slate-400">
              Haga clic en otro día del calendario o use los filtros para explorar otras fechas.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {selectedDayCitations.map((p) => {
              const urgency = analyzeCitationUrgency(p);
              const conflicts = conflictMap.get(p.id) || [];
              const hasConflict = conflicts.length > 0;
              const msg = generateWhatsAppMessage(p, config);

              return (
                <div
                  key={p.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${hasConflict ? 'bg-red-50/60 border-red-300' : 'bg-slate-50/60 border-slate-200 hover:border-fgn-blue/50'}`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2.5">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-bold text-fgn-blue uppercase">
                          {p.nombre}{p.identificacion && p.identificacion.trim() ? ` con CC ${p.identificacion.trim()}` : ''}
                        </span>

                        {hasConflict && (
                          <button
                            onClick={() => setResolutionCitation(p)}
                            className="inline-flex items-center gap-1 text-[9px] font-black bg-red-600 hover:bg-red-700 text-white px-2 py-0.5 rounded uppercase shadow-2xs transition-all cursor-pointer animate-pulse"
                            title="Haga clic para ver posibles soluciones al cruce"
                          >
                            <AlertTriangle size={10} /> Cruce de Horario • Resolver
                          </button>
                        )}

                        <span className={`inline-flex items-center gap-1 text-[9px] font-bold px-2 py-0.5 rounded border ${urgency.badgeBgClass} ${urgency.badgeColorClass}`}>
                          {urgency.badgeLabel}
                        </span>
                      </div>

                      <p className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                        <span>Orden OPJ: <strong className="font-mono text-slate-800">{p.orden}</strong></span>
                        {p.nunc && <span>• NUNC: <strong className="font-mono">{p.nunc}</strong></span>}
                        {p.fiscal && <span>• Fiscal: <strong>{p.fiscal}</strong></span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-2 self-start">
                      <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-lg border border-slate-200 shadow-2xs">
                        <Clock size={14} className="text-fgn-gold" />
                        <span className="text-xs font-bold font-mono text-fgn-blue">
                          {p.hora ? formatTimeAMPM(p.hora) : 'Sin Hora'}
                        </span>
                      </div>

                      {/* QUICK DELETE ON CARD HEADER */}
                      {onDeleteCitation && (
                        <button
                          onClick={() => onDeleteCitation(p.id, p.nombre)}
                          className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-200 cursor-pointer"
                          title="Eliminar esta citación"
                        >
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {hasConflict && (
                    <div className="p-2.5 bg-red-100/90 border border-red-300 rounded-lg text-[10px] text-red-950 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle size={14} className="text-red-600 shrink-0" />
                        <span><strong>Conflicto detectado:</strong> Coincide en la misma hora con: {conflicts.join(', ')}.</span>
                      </div>
                      <button
                        onClick={() => setResolutionCitation(p)}
                        className="px-2.5 py-1 bg-red-700 hover:bg-red-800 text-white rounded text-[10px] font-bold transition-all shadow-2xs flex items-center justify-center gap-1 cursor-pointer shrink-0"
                      >
                        <Zap size={11} /> <span>Ver Soluciones al Cruce</span>
                      </button>
                    </div>
                  )}

                  {/* QUICK ACTION BUTTONS */}
                  <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/60">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <button
                        onClick={() => onViewCitation(p)}
                        className="px-3 py-1.5 bg-pink-50 text-pink-700 hover:bg-pink-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-pink-200 cursor-pointer"
                      >
                        <Eye size={13} /> <span>Ver FPJ-35</span>
                      </button>

                      {onEditCitation && (
                        <button
                          onClick={() => onEditCitation(p)}
                          className="px-3 py-1.5 bg-amber-50 text-amber-900 hover:bg-amber-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-amber-200 cursor-pointer"
                        >
                          <span>Editar</span>
                        </button>
                      )}

                      {Boolean(p.telefono && p.telefono.trim()) && (
                        <button
                          onClick={() => window.open(`https://wa.me/${p.telefono!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')}
                          className="px-3 py-1.5 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <MessageCircle size={13} /> <span>WhatsApp</span>
                        </button>
                      )}

                      <button
                        onClick={() => window.open(getOutlook365Url(p, config), '_blank')}
                        className="px-3 py-1.5 bg-[#0078D4] text-white hover:bg-sky-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <Mail size={13} /> <span>Outlook 365</span>
                      </button>

                      {onDownloadDocx && (
                        <button
                          onClick={() => onDownloadDocx(p)}
                          className="px-3 py-1.5 bg-fgn-blue text-white hover:bg-black rounded-lg text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <FileDown size={13} /> <span>Word (.docx)</span>
                        </button>
                      )}

                      {onDeleteCitation && (
                        <button
                          onClick={() => onDeleteCitation(p.id, p.nombre)}
                          className="px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-red-100 hover:text-red-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1 border border-slate-200 cursor-pointer"
                          title="Eliminar citación"
                        >
                          <Trash2 size={13} /> <span>Eliminar</span>
                        </button>
                      )}
                    </div>

                    {/* Attendance toggles in calendar */}
                    {onMarkAttendance && (
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => onMarkAttendance(p.id, p.asistencia === 'asistio' ? null : 'asistio')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 border cursor-pointer ${p.asistencia === 'asistio' ? 'bg-green-600 text-white border-green-600 shadow-2xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-green-50 hover:text-green-700'}`}
                          title="Marcar Asistencia"
                        >
                          <UserCheck size={12} /> <span>Asistió</span>
                        </button>
                        <button
                          onClick={() => onMarkAttendance(p.id, p.asistencia === 'no_asistio' ? null : 'no_asistio')}
                          className={`px-2.5 py-1 rounded text-[11px] font-bold transition-all flex items-center gap-1 border cursor-pointer ${p.asistencia === 'no_asistio' ? 'bg-red-600 text-white border-red-600 shadow-2xs' : 'bg-white text-slate-600 border-slate-200 hover:bg-red-50 hover:text-red-700'}`}
                          title="Marcar No Asistió"
                        >
                          <UserX size={12} /> <span>No Asistió</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* CONFLICT RESOLUTION MODAL */}
      <ConflictResolutionModal
        isOpen={Boolean(resolutionCitation)}
        citation={resolutionCitation}
        allCitations={citations}
        config={config}
        onClose={() => setResolutionCitation(null)}
        onUpdateCitation={async (updated) => {
          if (onUpdateCitation) {
            await onUpdateCitation(updated);
          }
        }}
        onDeleteCitation={(id, name) => {
          if (onDeleteCitation) {
            onDeleteCitation(id, name);
          }
        }}
        onEditFullCitation={(cit) => {
          if (onEditCitation) {
            onEditCitation(cit);
          }
        }}
      />
    </div>
  );
};
