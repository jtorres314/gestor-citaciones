import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  AlertTriangle, 
  Clock, 
  Calendar, 
  ArrowRight, 
  CheckCircle2, 
  Trash2, 
  Pencil, 
  Sparkles, 
  X, 
  Users, 
  CalendarDays,
  ShieldAlert,
  Zap,
  Check
} from 'lucide-react';
import { Citacion, InvestigatorConfig } from '../types';
import { formatDateES, formatTimeAMPM } from '../services/citationService';

interface ConflictResolutionModalProps {
  isOpen: boolean;
  citation: Citacion | null;
  allCitations: Citacion[];
  config: InvestigatorConfig;
  onClose: () => void;
  onUpdateCitation: (updated: Citacion) => Promise<void> | void;
  onDeleteCitation: (id: string, name: string) => void;
  onEditFullCitation: (citation: Citacion) => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  isOpen,
  citation,
  allCitations,
  config,
  onClose,
  onUpdateCitation,
  onDeleteCitation,
  onEditFullCitation
}) => {
  const [selectedNewTime, setSelectedNewTime] = useState<string>('');
  const [selectedNewDate, setSelectedNewDate] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);

  // Find all citations on the same day that clash with this citation's exact hour
  const conflictingCitations = useMemo(() => {
    if (!citation || !citation.fecha || !citation.hora) return [];
    return allCitations.filter(c => 
      c.id !== citation.id && 
      c.fecha === citation.fecha && 
      c.hora === citation.hora
    );
  }, [citation, allCitations]);

  // All citations on this same day
  const sameDayCitations = useMemo(() => {
    if (!citation || !citation.fecha) return [];
    return allCitations.filter(c => c.fecha === citation.fecha);
  }, [citation, allCitations]);

  // Occupied hours on this day
  const occupiedTimes = useMemo(() => {
    const set = new Set<string>();
    sameDayCitations.forEach(c => {
      if (c.hora) set.add(c.hora.slice(0, 5));
    });
    return set;
  }, [sameDayCitations]);

  // Calculate smart available free time slots for this day
  const suggestedFreeSlots = useMemo(() => {
    const standardSlots = [
      '08:00', '08:30', '09:00', '09:30', '10:00', '10:30',
      '11:00', '11:30', '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30'
    ];

    return standardSlots.filter(slot => !occupiedTimes.has(slot));
  }, [occupiedTimes]);

  // Check if it looks like a duplicate citation (same or very similar name/NUNC/order)
  const duplicateCandidates = useMemo(() => {
    if (!citation) return [];
    const normName = (citation.nombre || '').toLowerCase().trim();
    return conflictingCitations.filter(c => {
      const otherNorm = (c.nombre || '').toLowerCase().trim();
      const sameName = normName.length > 3 && (otherNorm.includes(normName) || normName.includes(otherNorm));
      const sameOrden = citation.orden && c.orden && citation.orden.trim() === c.orden.trim();
      const sameNunc = citation.nunc && c.nunc && citation.nunc.trim() === c.nunc.trim();
      return sameName || sameOrden || sameNunc;
    });
  }, [citation, conflictingCitations]);

  // Calculate next business day
  const nextBusinessDayStr = useMemo(() => {
    if (!citation?.fecha) return '';
    try {
      const parts = citation.fecha.split('-');
      if (parts.length === 3) {
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        d.setDate(d.getDate() + 1);
        // If Saturday (6), move to Monday
        if (d.getDay() === 6) d.setDate(d.getDate() + 2);
        // If Sunday (0), move to Monday
        if (d.getDay() === 0) d.setDate(d.getDate() + 1);
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
      }
    } catch {
      // fallback
    }
    return '';
  }, [citation]);

  // Set default selected time when modal opens
  React.useEffect(() => {
    if (citation) {
      setSelectedNewDate(citation.fecha || '');
      if (suggestedFreeSlots.length > 0) {
        setSelectedNewTime(suggestedFreeSlots[0]);
      } else {
        setSelectedNewTime(citation.hora || '10:00');
      }
    }
  }, [citation, suggestedFreeSlots]);

  if (!isOpen || !citation) return null;

  const handleApplyNewTime = async (time: string, date?: string) => {
    if (!citation) return;
    setIsSaving(true);
    try {
      await onUpdateCitation({
        ...citation,
        hora: time,
        fecha: date || citation.fecha
      });
      onClose();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="bg-white rounded-2xl shadow-2xl border border-red-200 max-w-2xl w-full overflow-hidden my-6"
        >
          {/* HEADER */}
          <div className="bg-gradient-to-r from-red-600 via-red-700 to-rose-700 text-white p-5 flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-white/15 rounded-xl border border-white/20 mt-0.5">
                <AlertTriangle size={24} className="text-amber-300" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest text-red-200 bg-red-900/40 px-2 py-0.5 rounded inline-block">
                  Asistente de Resolución de Cruces
                </span>
                <h2 className="text-base sm:text-lg font-black uppercase tracking-tight text-white mt-1">
                  Soluciones al Conflicto de Horario
                </h2>
                <p className="text-xs text-red-100 font-medium mt-0.5">
                  Diligencia para el {formatDateES(citation.fecha || '')} a las {formatTimeAMPM(citation.hora || '')}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>

          {/* BODY */}
          <div className="p-5 sm:p-6 space-y-6 max-h-[75vh] overflow-y-auto">
            
            {/* DIAGNOSTIC CARD */}
            <div className="bg-red-50/80 border border-red-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between text-xs font-bold text-red-900">
                <span className="flex items-center gap-1.5 uppercase">
                  <ShieldAlert size={15} className="text-red-600" /> Citación en conflicto:
                </span>
                <span className="font-mono bg-white px-2 py-0.5 rounded border border-red-200 text-red-700">
                  {formatTimeAMPM(citation.hora || '')}
                </span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-red-100 space-y-1">
                <p className="text-xs font-bold text-slate-800 uppercase">{citation.nombre}</p>
                <p className="text-[11px] text-slate-600">
                  Orden OPJ: <strong className="font-mono">{citation.orden}</strong> • Fiscal: <strong>{citation.fiscal}</strong>
                  {citation.nunc ? ` • NUNC: ${citation.nunc}` : ''}
                </p>
              </div>

              <div className="pt-2 border-t border-red-200/60">
                <p className="text-[11px] font-bold text-red-900 mb-1.5 flex items-center gap-1">
                  <Users size={13} /> Choca en la misma hora con ({conflictingCitations.length}):
                </p>
                <div className="space-y-1.5">
                  {conflictingCitations.map(conf => (
                    <div key={conf.id} className="bg-white/80 p-2.5 rounded-lg border border-red-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                      <div>
                        <span className="font-bold text-slate-800 uppercase block">{conf.nombre}</span>
                        <span className="text-[10px] text-slate-500 font-mono">OPJ: {conf.orden} • Fiscal: {conf.fiscal}</span>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => onDeleteCitation(conf.id, conf.nombre)}
                          className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-800 rounded text-[10px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                          title="Eliminar esta otra citación"
                        >
                          <Trash2 size={11} /> Eliminar
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* DUPLICATE DETECTION NOTICE */}
            {duplicateCandidates.length > 0 && (
              <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-amber-900 font-bold text-xs uppercase">
                  <Sparkles size={15} className="text-amber-600" />
                  <span>Detección de Registro Duplicado o Repetido</span>
                </div>
                <p className="text-xs text-amber-800 leading-relaxed">
                  El sistema detectó que las citaciones que cruzan corresponden al mismo ciudadano o al mismo número de orden/caso. La solución más recomendada es eliminar uno de los dos registros duplicados.
                </p>
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    onClick={() => {
                      onDeleteCitation(citation.id, citation.nombre);
                      onClose();
                    }}
                    className="px-3.5 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={13} /> Eliminar ESTA citación
                  </button>
                  {duplicateCandidates.map(dup => (
                    <button
                      key={dup.id}
                      onClick={() => {
                        onDeleteCitation(dup.id, dup.nombre);
                        onClose();
                      }}
                      className="px-3.5 py-2 bg-slate-800 hover:bg-black text-white rounded-lg text-xs font-bold transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <Trash2 size={13} /> Eliminar la otra ({dup.nombre.slice(0, 20)}...)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* SOLUTION 1: REPROGRAM TO A FREE TIME SLOT */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-blue-100 text-fgn-blue rounded-lg">
                    <Zap size={15} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                    Solución 1: Reajustar a un Horario Libre del Mismo Día
                  </h3>
                </div>
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                  Recomendado
                </span>
              </div>

              <p className="text-[11px] text-slate-500">
                Seleccione uno de los intervalos horarios disponibles sin diligencias programadas para el <strong>{formatDateES(citation.fecha || '')}</strong>:
              </p>

              {suggestedFreeSlots.length > 0 ? (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 pt-1">
                  {suggestedFreeSlots.slice(0, 8).map((slot) => (
                    <button
                      key={slot}
                      onClick={() => setSelectedNewTime(slot)}
                      className={`p-2 rounded-lg text-xs font-bold font-mono transition-all border text-center cursor-pointer flex items-center justify-center gap-1.5 ${selectedNewTime === slot ? 'bg-fgn-blue text-white border-fgn-blue shadow-2xs' : 'bg-white text-slate-700 border-slate-200 hover:border-fgn-blue hover:bg-blue-50/50'}`}
                    >
                      {selectedNewTime === slot && <Check size={12} />}
                      <span>{formatTimeAMPM(slot)}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <p className="text-xs text-amber-700 italic">
                  Todos los horarios estándar de este día tienen citaciones. Seleccione una hora personalizada abajo.
                </p>
              )}

              <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-200">
                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <span className="text-[11px] text-slate-600 font-bold">Hora personalizada:</span>
                  <input
                    type="time"
                    value={selectedNewTime}
                    onChange={(e) => setSelectedNewTime(e.target.value)}
                    className="px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800 outline-none focus:border-fgn-blue"
                  />
                </div>

                <button
                  disabled={!selectedNewTime || isSaving}
                  onClick={() => handleApplyNewTime(selectedNewTime)}
                  className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 size={14} />
                  <span>Aplicar {formatTimeAMPM(selectedNewTime)}</span>
                </button>
              </div>
            </div>

            {/* SOLUTION 2: MOVE TO NEXT BUSINESS DAY */}
            {nextBusinessDayStr && (
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-indigo-100 text-indigo-700 rounded-lg">
                    <CalendarDays size={15} />
                  </div>
                  <h3 className="text-xs font-bold text-slate-800 uppercase tracking-tight">
                    Solución 2: Reprogramar al Siguiente Día Hábil
                  </h3>
                </div>

                <p className="text-[11px] text-slate-500">
                  Mover la diligencia al día <strong>{formatDateES(nextBusinessDayStr)}</strong> a las <strong>{formatTimeAMPM(citation.hora || '08:30')}</strong>:
                </p>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1">
                  <span className="text-xs font-mono font-bold text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
                    {nextBusinessDayStr} • {formatTimeAMPM(citation.hora || '08:30')}
                  </span>

                  <button
                    disabled={isSaving}
                    onClick={() => handleApplyNewTime(citation.hora || '08:30', nextBusinessDayStr)}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Calendar size={14} />
                    <span>Mover al {formatDateES(nextBusinessDayStr)}</span>
                  </button>
                </div>
              </div>
            )}

            {/* SOLUTION 3 & 4: MANUAL EDIT & DIRECT DELETE */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => {
                  onClose();
                  onEditFullCitation(citation);
                }}
                className="p-3 bg-white hover:bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Pencil size={15} className="text-amber-600" />
                <span>Abrir Editor Completo de Datos</span>
              </button>

              <button
                onClick={() => {
                  onDeleteCitation(citation.id, citation.nombre);
                  onClose();
                }}
                className="p-3 bg-white hover:bg-red-50 border border-red-200 rounded-xl text-xs font-bold text-red-700 transition-all flex items-center justify-center gap-2 cursor-pointer shadow-2xs"
              >
                <Trash2 size={15} className="text-red-600" />
                <span>Eliminar Definitivamente Citación</span>
              </button>
            </div>

          </div>

          {/* FOOTER */}
          <div className="bg-slate-50 px-6 py-3.5 border-t border-slate-200 flex justify-end">
            <button
              onClick={onClose}
              className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cerrar
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
