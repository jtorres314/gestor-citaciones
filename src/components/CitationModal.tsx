import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  FileText, 
  FileCode, 
  Copy, 
  Check, 
  FileDown, 
  Mail, 
  MessageCircle, 
  Pencil, 
  User, 
  MapPin, 
  Calendar, 
  Clock, 
  Briefcase,
  AlertTriangle
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

interface CitationModalProps {
  isOpen: boolean;
  citation: Citacion | null;
  config: InvestigatorConfig;
  customTemplateBuffer?: ArrayBuffer;
  onClose: () => void;
  onEdit?: (citation: Citacion) => void;
  onDownloadDocx?: (citation: Citacion) => void;
  conflictNames?: string[];
}

export const CitationModal: React.FC<CitationModalProps> = ({
  isOpen,
  citation,
  config,
  onClose,
  onEdit,
  onDownloadDocx,
  conflictNames = []
}) => {
  const [activeTab, setActiveTab] = useState<'fpj35' | 'whatsapp'>('fpj35');
  const [copied, setCopied] = useState(false);

  if (!isOpen || !citation) return null;

  const whatsappText = generateWhatsAppMessage(citation, config);
  const urgency: UrgencyInfo = analyzeCitationUrgency(citation);
  const hasConflict = conflictNames && conflictNames.length > 0;

  const handleCopyWhatsApp = async () => {
    try {
      await navigator.clipboard.writeText(whatsappText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error("Error al copiar texto al portapapeles:", e);
    }
  };

  const handleOpenOutlook = () => {
    const url = getOutlook365Url(citation, config);
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleOpenWhatsApp = () => {
    if (citation.telefono && citation.telefono.trim()) {
      const cleanPhone = citation.telefono.replace(/\D/g, '');
      window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(whatsappText)}`, '_blank', 'noopener,noreferrer');
    } else {
      handleCopyWhatsApp();
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-fgn-border overflow-hidden flex flex-col max-h-[92vh]"
      >
        {/* MODAL HEADER */}
        <div className="bg-fgn-blue text-white px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center border-b-4 border-fgn-gold shrink-0">
          <div className="flex items-center gap-2.5 sm:gap-3 min-w-0">
            <div className="bg-fgn-gold/20 p-2 rounded-lg border border-fgn-gold/30 shrink-0">
              <FileText size={20} className="text-fgn-gold" />
            </div>
            <div className="min-w-0">
              <h3 className="text-xs sm:text-sm font-bold uppercase tracking-widest truncate">
                Citación Judicial • {citation.nombre}
              </h3>
              <p className="text-[9px] sm:text-[10px] text-blue-200 font-mono flex items-center gap-2 mt-0.5">
                <span>Orden: <strong>{citation.orden || 'Sin Orden'}</strong></span>
                <span>•</span>
                <span>NUNC: <strong>{citation.nunc || 'Sin NUNC'}</strong></span>
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-white cursor-pointer shrink-0 ml-2"
            title="Cerrar modal"
          >
            <X size={20} />
          </button>
        </div>

        {/* CONFLICT & URGENCY ALERTS */}
        {(hasConflict || urgency.isUrgent) && (
          <div className="px-4 sm:px-6 pt-3 pb-0 space-y-2">
            {hasConflict && (
              <div className="p-2.5 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2.5 text-xs text-red-800">
                <AlertTriangle size={16} className="text-red-600 shrink-0 mt-0.5" />
                <div>
                  <strong className="font-bold uppercase tracking-wider block text-[11px]">Conflicto de Horario Detectado:</strong>
                  <p className="text-[10px] leading-relaxed mt-0.5">
                    Coincide exactamente en fecha ({citation.fecha}) y hora ({citation.hora}) con: <strong>{conflictNames.join(', ')}</strong>.
                  </p>
                </div>
              </div>
            )}
            {urgency.status === 'past_due_unattended' && (
              <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg flex items-center gap-2 text-[11px] text-amber-900 font-medium">
                <Clock size={14} className="text-amber-600 shrink-0" />
                <span>Esta citación ya superó su fecha programada sin registrar asistencia formal.</span>
              </div>
            )}
          </div>
        )}

        {/* TABS SELECTOR */}
        <div className="bg-bg-gray px-3 sm:px-6 pt-2.5 pb-0 border-b border-fgn-border flex gap-2 shrink-0 overflow-x-auto">
          <button 
            onClick={() => setActiveTab('fpj35')}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-t font-bold text-[10px] sm:text-xs tracking-wider uppercase flex items-center gap-1.5 border-t border-x transition-all shrink-0 cursor-pointer ${activeTab === 'fpj35' ? 'bg-white text-fgn-blue border-fgn-border border-b-white -mb-px shadow-sm' : 'text-text-muted hover:text-fgn-blue border-transparent'}`}
          >
            <FileCode size={14} /> Formato Oficial FPJ-35
          </button>
          <button 
            onClick={() => setActiveTab('whatsapp')}
            className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-t font-bold text-[10px] sm:text-xs tracking-wider uppercase flex items-center gap-1.5 border-t border-x transition-all shrink-0 cursor-pointer ${activeTab === 'whatsapp' ? 'bg-white text-fgn-blue border-fgn-border border-b-white -mb-px shadow-sm' : 'text-text-muted hover:text-fgn-blue border-transparent'}`}
          >
            <Copy size={14} /> Mensaje Texto / WhatsApp
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-4">
          {activeTab === 'fpj35' ? (
            <div className="bg-white border border-fgn-border p-4 sm:p-6 rounded-lg space-y-5 text-xs text-text-main shadow-inner font-sans">
              
              {/* ENCABEZADO SIMULADO FPJ-35 */}
              <div className="border border-slate-300 rounded overflow-hidden">
                <div className="bg-fgn-blue text-white p-3 text-center border-b border-slate-300">
                  <p className="font-bold text-[11px] sm:text-xs uppercase tracking-widest">FISCALÍA GENERAL DE LA NACIÓN</p>
                  <p className="text-[9px] sm:text-[10px] text-fgn-gold uppercase font-semibold mt-0.5">POLICÍA JUDICIAL • FORMATO CITACIÓN (FPJ-35)</p>
                </div>

                {/* TABLA NUNC */}
                <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-2 text-[10px]">
                  <div className="col-span-12 md:col-span-8">
                    <span className="font-bold text-slate-500 uppercase block">NUNC (21 dígitos):</span>
                    <span className="font-mono font-bold text-fgn-blue text-xs">{citation.nunc || citation.orden || '---------------------'}</span>
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <span className="font-bold text-slate-500 uppercase block">Dpto / Mpio:</span>
                    <span className="font-bold text-slate-800">{citation.ciudad || config.municipio || 'Cartagena'}</span>
                  </div>
                  <div className="col-span-6 md:col-span-2">
                    <span className="font-bold text-slate-500 uppercase block">Fecha / Hora:</span>
                    <span className="font-mono font-bold text-slate-800">
                      {citation.fecha || '---'} {citation.hora ? formatTimeAMPM(citation.hora) : ''}
                    </span>
                  </div>
                </div>

                {/* 1. DATOS DESTINATARIO */}
                <div className="p-4 space-y-2.5 border-b border-slate-200">
                  <p className="font-bold text-fgn-blue text-[10px] uppercase border-b pb-1">1. DATOS DEL DESTINATARIO (CITADO)</p>
                  <div className="grid grid-cols-12 gap-2.5 text-[11px]">
                    <div className="col-span-12">
                      <span className="text-slate-500 font-medium">Señor(a):</span> <strong className="uppercase text-fgn-blue">{citation.nombre}{citation.identificacion && citation.identificacion.trim() ? ` con CC ${citation.identificacion.trim()}` : ''}</strong>
                    </div>
                    <div className="col-span-12 md:col-span-8">
                      <span className="text-slate-500 font-medium">Dirección:</span> <span>{citation.direccion || 'Dirección no especificada'}</span>
                    </div>
                    <div className="col-span-12 md:col-span-4">
                      <span className="text-slate-500 font-medium">Teléfono:</span> <span>{citation.telefono || '---'}</span>
                    </div>
                    {citation.correo && (
                      <div className="col-span-12">
                        <span className="text-slate-500 font-medium">Correo Electrónico:</span> <span className="font-mono text-slate-800">{citation.correo}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. DILIGENCIA Y COMPARECENCIA */}
                <div className="p-4 space-y-2.5 border-b border-slate-200 bg-slate-50/50">
                  <p className="font-bold text-fgn-blue text-[10px] uppercase border-b pb-1">2. COMPARECENCIA Y OBJETO DE LA CITACIÓN</p>
                  <div className="grid grid-cols-12 gap-2.5 text-[11px]">
                    <div className="col-span-12 md:col-span-6">
                      <span className="text-slate-500 font-medium block">Fecha Diligencia:</span>
                      <strong className="text-slate-800">{citation.fecha ? formatDateES(citation.fecha) : '---'}</strong>
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <span className="text-slate-500 font-medium block">Hora Diligencia:</span>
                      <strong className="text-fgn-blue">{citation.hora ? formatTimeAMPM(citation.hora) : '---'}</strong>
                    </div>
                    <div className="col-span-12">
                      <span className="text-slate-500 font-medium block">Lugar e Instalaciones:</span>
                      <span className="text-slate-800">{citation.instalaciones || config.instalaciones} - {citation.direccionInstalaciones || config.direccionInstalaciones}</span>
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <span className="text-slate-500 font-medium block">Motivo:</span>
                      <span className="font-bold text-fgn-blue uppercase">{citation.motivo || 'Entrevista'}</span>
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <span className="text-slate-500 font-medium block">¿Requiere Abogado?:</span>
                      <span className="font-bold text-slate-800">{citation.requiereAbogado || 'NO'}</span>
                    </div>
                    <div className="col-span-12">
                      <span className="text-slate-500 font-medium block">Observaciones:</span>
                      <p className="text-[11px] text-slate-700 italic bg-white p-2.5 rounded border border-slate-200 mt-1">
                        {citation.observaciones || 'Sin observaciones adicionales.'}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. PERSONA QUE REALIZA LA CITACIÓN */}
                <div className="p-4 space-y-2.5">
                  <p className="font-bold text-fgn-blue text-[10px] uppercase border-b pb-1">3. SERVIDOR QUE REALIZA LA CITACIÓN</p>
                  <div className="grid grid-cols-12 gap-2 text-[11px]">
                    <div className="col-span-12 md:col-span-6">
                      <span className="text-slate-500 font-medium block">Funcionario:</span>
                      <strong>{citation.investigador_creador || config.investigador}</strong>
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <span className="text-slate-500 font-medium block">Unidad / Entidad:</span>
                      <span>{citation.grupoInvestigador || config.grupoInvestigador} ({citation.entidadInvestigador || config.entidadInvestigador})</span>
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <span className="text-slate-500 font-medium block">Contacto Telefónico:</span>
                      <span className="font-mono">{citation.telefono_creador || config.telefono}</span>
                    </div>
                    <div className="col-span-12 md:col-span-6">
                      <span className="text-slate-500 font-medium block">Fiscalía / Causa:</span>
                      <span>Fiscal {citation.fiscal || '17 Local'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="bg-emerald-50 border border-emerald-200 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider flex items-center gap-1.5">
                    <MessageCircle size={14} className="text-emerald-600" /> Formato de Mensaje Estructurado
                  </span>
                  <button
                    onClick={handleCopyWhatsApp}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${copied ? 'bg-emerald-700 text-white shadow-sm' : 'bg-white text-emerald-800 border border-emerald-300 hover:bg-emerald-100'}`}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? '¡Copiado!' : 'Copiar Texto'}</span>
                  </button>
                </div>

                <div className="bg-white p-4 rounded-lg border border-emerald-200 text-xs text-slate-800 whitespace-pre-wrap font-sans leading-relaxed shadow-2xs">
                  {whatsappText}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* MODAL FOOTER ACTION BUTTONS */}
        <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-fgn-border flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            {onEdit && (
              <button
                onClick={() => {
                  onClose();
                  onEdit(citation);
                }}
                className="px-3 py-2 bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Editar datos de la citación"
              >
                <Pencil size={14} /> <span>Editar</span>
              </button>
            )}

            <button
              onClick={handleOpenWhatsApp}
              className="px-3 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Abrir WhatsApp con el mensaje"
            >
              <MessageCircle size={14} /> <span>WhatsApp</span>
            </button>

            <button
              onClick={handleOpenOutlook}
              className="px-3 py-2 bg-[#0078D4] text-white hover:bg-sky-700 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Redactar en Microsoft 365 Outlook"
            >
              <Mail size={14} /> <span>Outlook 365</span>
            </button>

            {onDownloadDocx && (
              <button
                onClick={() => onDownloadDocx(citation)}
                className="px-3 py-2 bg-fgn-blue text-white hover:bg-slate-900 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs"
                title="Descargar documento oficial Word FPJ-35"
              >
                <FileDown size={14} /> <span>Word (.docx)</span>
              </button>
            )}
          </div>

          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-lg text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
          >
            Cerrar
          </button>
        </div>
      </motion.div>
    </div>
  );
};
