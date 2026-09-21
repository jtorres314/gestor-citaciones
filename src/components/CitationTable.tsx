import React from 'react';
import { 
  Eye, 
  Pencil, 
  FileDown, 
  CheckCircle, 
  MessageCircle, 
  Mail, 
  Copy, 
  Check, 
  Trash2, 
  FileCheck, 
  FileX, 
  UserCheck, 
  UserX, 
  Calendar, 
  Clock, 
  AlertTriangle,
  Flame
} from 'lucide-react';
import { Citacion, InvestigatorConfig } from '../types';
import { 
  formatDateES, 
  formatTimeAMPM, 
  generateWhatsAppMessage, 
  getOutlook365Url,
  analyzeCitationUrgency,
  UrgencyInfo
} from '../services/citationService';

interface CitationTableProps {
  citations: Citacion[];
  mode: 'pendientes' | 'citados' | 'historial';
  config: InvestigatorConfig;
  selectedIds?: string[];
  onToggleSelect?: (id: string) => void;
  onSelectAll?: (checked: boolean) => void;
  onView: (citation: Citacion) => void;
  onEdit: (citation: Citacion) => void;
  onDownloadDocx: (citation: Citacion) => void;
  onMoveToCitado?: (citation: Citacion) => void;
  onDelete: (id: string, name: string) => void;
  onMarkAttendance?: (id: string, status: 'asistio' | 'no_asistio' | null) => void;
  onMarkReport?: (id: string, status: 'si' | 'no' | null) => void;
  copiedId?: string | null;
  onCopyText: (text: string, citation: Citacion) => void;
  conflictMap?: Map<string, string[]>;
}

export const CitationTable: React.FC<CitationTableProps> = ({
  citations,
  mode,
  config,
  selectedIds = [],
  onToggleSelect,
  onSelectAll,
  onView,
  onEdit,
  onDownloadDocx,
  onMoveToCitado,
  onDelete,
  onMarkAttendance,
  onMarkReport,
  copiedId,
  onCopyText,
  conflictMap
}) => {
  const isAllSelected = citations.length > 0 && citations.every(c => selectedIds.includes(c.id));

  return (
    <div className="divide-y divide-fgn-border/30">
      {citations.map((p) => {
        const urgency: UrgencyInfo = analyzeCitationUrgency(p);
        const conflicts = conflictMap?.get(p.id) || [];
        const hasConflict = conflicts.length > 0;
        const msg = generateWhatsAppMessage(p, config);

        return (
          <div key={p.id} className="group hover:bg-slate-50/70 transition-colors">
            {/* DESKTOP & TABLET TABLE ROW */}
            <div className="hidden md:grid px-6 py-3.5 grid-cols-12 gap-3 items-center min-w-[960px]">
              {mode === 'pendientes' && onToggleSelect && (
                <div className="col-span-1 flex items-center justify-center">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-fgn-border text-fgn-blue focus:ring-fgn-blue cursor-pointer"
                    checked={selectedIds.includes(p.id)}
                    onChange={() => onToggleSelect(p.id)}
                  />
                </div>
              )}

              {/* PARTICIPANTE */}
              <div className={mode === 'pendientes' ? 'col-span-3' : 'col-span-3'}>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <p className="text-xs font-bold text-fgn-blue uppercase">
                    {p.nombre}{p.identificacion && p.identificacion.trim() ? ` con CC ${p.identificacion.trim()}` : ''}
                  </p>
                  {hasConflict && (
                    <span 
                      className="inline-flex items-center gap-0.5 text-[9px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 uppercase tracking-tighter" 
                      title={`Cruce de horario con: ${conflicts.join(', ')}`}
                    >
                      <AlertTriangle size={10} className="shrink-0" /> Cruce
                    </span>
                  )}
                  {urgency.status === 'past_due_unattended' && (
                    <span 
                      className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300"
                      title="Fecha vencida sin registro de asistencia"
                    >
                      <Clock size={10} /> Vencida
                    </span>
                  )}
                  {urgency.status === 'today' && (
                    <span 
                      className="inline-flex items-center gap-0.5 text-[9px] font-black bg-amber-300 text-amber-950 px-1.5 py-0.5 rounded shadow-2xs animate-pulse"
                      title="Diligencia programada para hoy"
                    >
                      <Flame size={10} /> ¡HOY!
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 mt-0.5">
                  {p.fiscal && (
                    <p className="text-[10px] text-slate-400 font-medium uppercase">
                      Fiscalía {p.fiscal}
                    </p>
                  )}
                  {p.motivo && (
                    <span className="text-[9px] text-slate-400 font-medium uppercase">
                      • {p.motivo}
                    </span>
                  )}
                </div>
              </div>

              {/* ORDEN OPJ */}
              <div className="col-span-1 font-mono text-[11px] text-text-muted uppercase">
                {p.orden || '---'}
              </div>

              {/* FECHA Y HORA */}
              <div className={mode === 'citados' ? 'col-span-2' : 'col-span-3'}>
                <div className="font-mono text-[11px] text-fgn-blue flex flex-col">
                  <span>{p.fecha ? formatDateES(p.fecha).toUpperCase() : '---'}</span>
                  {p.hora && <span className="text-[10px] text-fgn-gold font-bold">{formatTimeAMPM(p.hora)}</span>}
                </div>
              </div>

              {/* CITADOS MODE: INFORME Y ASISTENCIA COLUMNS */}
              {mode === 'citados' && onMarkReport && onMarkAttendance && (
                <>
                  <div className="col-span-1 flex items-center justify-center gap-1.5">
                    <button 
                      onClick={() => onMarkReport(p.id, p.informe === 'si' ? null : 'si')}
                      className={`p-1.5 rounded transition-all border shrink-0 ${p.informe === 'si' ? 'bg-fgn-blue text-white border-fgn-blue shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-fgn-blue hover:border-fgn-blue cursor-pointer'}`}
                      title={p.informe === 'si' ? 'Informe Realizado (Clic para desmarcar)' : 'Marcar con Informe'}
                    >
                      <FileCheck size={14} />
                    </button>
                    <button 
                      onClick={() => onMarkReport(p.id, p.informe === 'no' ? null : 'no')}
                      className={`p-1.5 rounded transition-all border shrink-0 ${p.informe === 'no' ? 'bg-slate-500 text-white border-slate-500 shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-slate-500 hover:border-slate-500 cursor-pointer'}`}
                      title={p.informe === 'no' ? 'Marcado Sin Informe (Clic para desmarcar)' : 'Marcar Sin Informe'}
                    >
                      <FileX size={14} />
                    </button>
                  </div>

                  <div className="col-span-2 flex items-center justify-center gap-1.5">
                    <button 
                      onClick={() => onMarkAttendance(p.id, p.asistencia === 'asistio' ? null : 'asistio')}
                      className={`p-1.5 rounded transition-all border shrink-0 ${p.asistencia === 'asistio' ? 'bg-green-600 text-white border-green-600 shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-green-500 hover:border-green-500 cursor-pointer'}`}
                      title={p.asistencia === 'asistio' ? 'Asistió (Clic para desmarcar)' : 'Marcar Asistió'}
                    >
                      <UserCheck size={14} />
                    </button>
                    <button 
                      onClick={() => onMarkAttendance(p.id, p.asistencia === 'no_asistio' ? null : 'no_asistio')}
                      className={`p-1.5 rounded transition-all border shrink-0 ${p.asistencia === 'no_asistio' ? 'bg-red-600 text-white border-red-600 shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-red-500 hover:border-red-500 cursor-pointer'}`}
                      title={p.asistencia === 'no_asistio' ? 'No Asistió (Clic para desmarcar)' : 'Marcar No Asistió'}
                    >
                      <UserX size={14} />
                    </button>
                  </div>
                </>
              )}

              {/* ACTIONS COLUMN */}
              <div className={`${mode === 'citados' ? 'col-span-3' : 'col-span-4'} flex items-center justify-end gap-1 flex-nowrap`}>
                <button 
                  onClick={() => onView(p)}
                  className="p-1.5 text-pink-600 hover:bg-pink-50 rounded transition-all cursor-pointer shrink-0"
                  title="Ver Citación Completa FPJ-35"
                >
                  <Eye size={15} />
                </button>
                <button 
                  onClick={() => onEdit(p)}
                  className="p-1.5 text-amber-600 hover:bg-amber-50 rounded transition-all cursor-pointer shrink-0"
                  title="Editar Datos de la Citación"
                >
                  <Pencil size={15} />
                </button>
                <button 
                  onClick={() => onDownloadDocx(p)}
                  className="p-1.5 text-blue-700 hover:bg-blue-50 rounded transition-all cursor-pointer shrink-0"
                  title="Descargar Formato Word FPJ-35 (.docx)"
                >
                  <FileDown size={15} />
                </button>
                {mode === 'pendientes' && onMoveToCitado && (
                  <button 
                    onClick={() => onMoveToCitado(p)}
                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all cursor-pointer shrink-0"
                    title="Marcar como Citado (Mover a Citados)"
                  >
                    <CheckCircle size={15} />
                  </button>
                )}
                {Boolean(p.telefono && p.telefono.trim()) && (
                  <button 
                    onClick={() => window.open(`https://wa.me/${p.telefono!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')}
                    className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded transition-all cursor-pointer shrink-0"
                    title="Enviar citación por WhatsApp"
                  >
                    <MessageCircle size={15} />
                  </button>
                )}
                <button 
                  onClick={() => window.open(getOutlook365Url(p, config), '_blank')}
                  className="p-1.5 text-[#0078D4] hover:bg-sky-50 rounded transition-all cursor-pointer shrink-0"
                  title="Redactar correo en Microsoft 365 Outlook Web"
                >
                  <Mail size={15} />
                </button>
                <button 
                  onClick={() => onCopyText(msg, p)} 
                  className={`p-1.5 rounded transition-all cursor-pointer shrink-0 ${copiedId === p.id ? 'bg-green-600 text-white' : 'text-green-600 hover:bg-green-50'}`}
                  title="Copiar Texto WhatsApp"
                >
                  {copiedId === p.id ? <Check size={15} /> : <Copy size={15} />}
                </button>
                <button 
                  onClick={() => onDelete(p.id, p.nombre)} 
                  className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer shrink-0" 
                  title="Eliminar Citación"
                >
                  <Trash2 size={15} />
                </button>
              </div>
            </div>

            {/* MOBILE & TABLET CARD */}
            <div className="block md:hidden p-3.5 space-y-2.5">
              <div className="flex items-start justify-between gap-2.5">
                <div className="flex items-start gap-2.5 flex-1 min-w-0">
                  {mode === 'pendientes' && onToggleSelect && (
                    <label className="p-1 -m-1 cursor-pointer flex items-center justify-center">
                      <input 
                        type="checkbox" 
                        className="w-4 h-4 mt-0.5 rounded border-fgn-border text-fgn-blue focus:ring-fgn-blue shrink-0 cursor-pointer"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => onToggleSelect(p.id)}
                      />
                    </label>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-fgn-blue uppercase leading-snug break-words">
                      {p.nombre}
                    </p>
                    <div className="flex flex-wrap items-center gap-1.5 mt-1">
                      {p.identificacion && p.identificacion.trim() && (
                        <span className="font-mono text-[10px] font-semibold text-slate-700 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                          CC: {p.identificacion.trim()}
                        </span>
                      )}
                      {p.fiscal && (
                        <span className="text-[10px] text-slate-600 font-medium uppercase bg-blue-50/70 text-blue-900 px-1.5 py-0.5 rounded border border-blue-100">
                          F. {p.fiscal}
                        </span>
                      )}
                      {hasConflict && (
                        <span className="text-[9px] font-black bg-red-100 text-red-700 px-1.5 py-0.5 rounded border border-red-200 uppercase">
                          ⚠️ Cruce
                        </span>
                      )}
                      {urgency.status === 'past_due_unattended' && (
                        <span 
                          className="inline-flex items-center gap-0.5 text-[9px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300"
                          title="Fecha vencida sin registro de asistencia"
                        >
                          <Clock size={10} /> Vencida
                        </span>
                      )}
                      {urgency.status === 'today' && (
                        <span 
                          className="inline-flex items-center gap-0.5 text-[9px] font-black bg-amber-300 text-amber-950 px-1.5 py-0.5 rounded shadow-2xs animate-pulse"
                          title="Diligencia programada para hoy"
                        >
                          <Flame size={10} /> ¡HOY!
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button 
                    onClick={() => window.open(getOutlook365Url(p, config), '_blank')}
                    className="p-1.5 text-[#0078D4] bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-200 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                    title="Redactar en Microsoft 365 Outlook Web"
                  >
                    <Mail size={15} />
                  </button>
                  {Boolean(p.telefono && p.telefono.trim()) && (
                    <button 
                      onClick={() => window.open(`https://wa.me/${p.telefono!.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank')}
                      className="p-1.5 text-emerald-600 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-200 transition-all cursor-pointer flex items-center justify-center shadow-2xs"
                      title="Enviar por WhatsApp"
                    >
                      <MessageCircle size={15} />
                    </button>
                  )}
                  <span className="font-mono text-[10px] font-bold text-slate-800 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                    {p.orden}
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-between text-[11px] bg-slate-50 px-2.5 py-2 rounded-lg border border-slate-200 font-mono">
                <div className="flex items-center gap-1.5 text-slate-700">
                  <Calendar size={12} className="text-slate-400" />
                  <span>{p.fecha ? formatDateES(p.fecha).toUpperCase() : '---'}</span>
                </div>
                {p.hora && (
                  <div className="flex items-center gap-1 text-fgn-blue font-bold">
                    <Clock size={12} className="text-fgn-gold" />
                    <span>{formatTimeAMPM(p.hora)}</span>
                  </div>
                )}
              </div>

              {/* CITADOS MODE: INFORME & ASISTENCIA MOBILE CONTROLS */}
              {mode === 'citados' && onMarkReport && onMarkAttendance && (
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px]">
                    <span className="font-bold text-slate-500 uppercase text-[9px] block mb-1.5 tracking-wider">Informe:</span>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => onMarkReport(p.id, p.informe === 'si' ? null : 'si')}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-all border cursor-pointer ${p.informe === 'si' ? 'bg-fgn-blue text-white border-fgn-blue shadow-2xs' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'}`}
                      >
                        <FileCheck size={12} /> <span>Con</span>
                      </button>
                      <button
                        onClick={() => onMarkReport(p.id, p.informe === 'no' ? null : 'no')}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-all border cursor-pointer ${p.informe === 'no' ? 'bg-slate-700 text-white border-slate-700 shadow-2xs' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'}`}
                      >
                        <FileX size={12} /> <span>Sin</span>
                      </button>
                    </div>
                  </div>

                  <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 text-[11px]">
                    <span className="font-bold text-slate-500 uppercase text-[9px] block mb-1.5 tracking-wider">Asistencia:</span>
                    <div className="grid grid-cols-2 gap-1">
                      <button
                        onClick={() => onMarkAttendance(p.id, p.asistencia === 'asistio' ? null : 'asistio')}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-all border cursor-pointer ${p.asistencia === 'asistio' ? 'bg-green-600 text-white border-green-600 shadow-2xs' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'}`}
                      >
                        <UserCheck size={12} /> <span>Sí</span>
                      </button>
                      <button
                        onClick={() => onMarkAttendance(p.id, p.asistencia === 'no_asistio' ? null : 'no_asistio')}
                        className={`py-1.5 px-1 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-all border cursor-pointer ${p.asistencia === 'no_asistio' ? 'bg-red-600 text-white border-red-600 shadow-2xs' : 'bg-white text-slate-500 border-slate-300 hover:bg-slate-100'}`}
                      >
                        <UserX size={12} /> <span>No</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* MOBILE & TABLET ACTION BUTTONS */}
              <div className="grid grid-cols-2 gap-1.5 pt-1 border-t border-slate-100">
                <button 
                  onClick={() => onEdit(p)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-amber-800 bg-amber-50 hover:bg-amber-100 rounded-lg border border-amber-300 font-bold transition-all cursor-pointer"
                >
                  <Pencil size={14} /> <span>Editar</span>
                </button>

                <button 
                  onClick={() => {
                    if (p.telefono && p.telefono.trim()) {
                      window.open(`https://wa.me/${p.telefono.replace(/\D/g, '')}?text=${encodeURIComponent(msg)}`, '_blank');
                    } else {
                      onCopyText(msg, p);
                    }
                  }} 
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg border border-emerald-300 font-bold transition-all cursor-pointer"
                >
                  <MessageCircle size={14} /> <span>WhatsApp</span>
                </button>

                <button 
                  onClick={() => onDownloadDocx(p)}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-lg border border-indigo-300 font-bold transition-all cursor-pointer"
                >
                  <FileDown size={14} /> <span>Word (.docx)</span>
                </button>

                <button 
                  onClick={() => window.open(getOutlook365Url(p, config), '_blank')}
                  className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-[#0078D4] bg-sky-50 hover:bg-sky-100 rounded-lg border border-sky-300 font-bold transition-all cursor-pointer"
                >
                  <Mail size={14} /> <span>Outlook 365</span>
                </button>

                <button 
                  onClick={() => onCopyText(msg, p)} 
                  className={`flex items-center justify-center gap-1.5 px-3 py-2 text-xs rounded-lg border font-bold transition-all cursor-pointer ${copiedId === p.id ? 'bg-green-600 text-white border-green-600 shadow-xs' : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border-slate-300'}`}
                >
                  {copiedId === p.id ? <Check size={14} /> : <Copy size={14} />}
                  <span>{copiedId === p.id ? 'Copiado' : 'Copiar Texto'}</span>
                </button>

                {mode === 'pendientes' && onMoveToCitado && (
                  <button 
                    onClick={() => onMoveToCitado(p)}
                    className="flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-blue-800 bg-blue-50 hover:bg-blue-100 rounded-lg border border-blue-300 font-bold transition-all cursor-pointer"
                  >
                    <CheckCircle size={14} /> <span>Marcar Citado</span>
                  </button>
                )}

                <button 
                  onClick={() => onView(p)}
                  className="flex items-center justify-center gap-1 px-3 py-2 text-xs text-pink-700 bg-pink-50 hover:bg-pink-100 rounded-lg border border-pink-300 font-bold transition-all cursor-pointer"
                >
                  <Eye size={14} /> <span>Ver Citación</span>
                </button>

                <div className={mode === 'citados' ? 'col-span-2' : ''}>
                  <button 
                    onClick={() => onDelete(p.id, p.nombre)} 
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 rounded-lg border border-red-200 transition-all cursor-pointer font-bold"
                  >
                    <Trash2 size={14} /> <span>Eliminar</span>
                  </button>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};
