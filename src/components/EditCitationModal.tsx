import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Save, User, FileText, Calendar, 
  AlertCircle, Clock 
} from 'lucide-react';
import { Citacion } from '../types';

interface EditCitationModalProps {
  isOpen: boolean;
  citation: any | null;
  onClose: () => void;
  onSave: (updatedCitation: any) => Promise<void> | void;
}

// Helper para normalizar horas a formato estricto 24H (HH:mm) para <input type="time" />
export const normalizeToTimeInput = (val: any): string => {
  if (val === null || val === undefined) return '';
  let str = String(val).trim();
  if (!str) return '';

  // Limpiar posibles repeticiones de am/pm (ej: "11:30 AM AM" -> "11:30 AM")
  str = str.replace(/\b(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)\s+(am|pm|a\.?\s*m\.?|p\.?\s*m\.?)\b/gi, '$1');

  // 1. Formato 12-horas con AM/PM (ej: "11:30 AM", "2:30 PM", "08:15 am", "11:30 a. m.", "04:00 p.m.")
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(?:(a\.?\s*m\.?|am)|(p\.?\s*m\.?|pm))$/i);
  if (ampmMatch) {
    let hour = parseInt(ampmMatch[1], 10);
    const minute = ampmMatch[2];
    const isPM = Boolean(ampmMatch[4]);
    const isAM = Boolean(ampmMatch[3]);

    if (isPM) {
      if (hour < 12) hour += 12;
    } else if (isAM) {
      if (hour === 12) hour = 0;
    }
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  // 2. Formato 24-horas estándar "HH:mm" o "HH:mm:ss"
  const time24Match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (time24Match) {
    const hh = time24Match[1].padStart(2, '0');
    const mm = time24Match[2];
    return `${hh}:${mm}`;
  }

  // 3. Fracción decimal serial de Excel (ej: 0.479166666666667)
  if (/^0\.\d+$/.test(str)) {
    const totalSeconds = Math.round(parseFloat(str) * 24 * 3600);
    const hour = Math.floor(totalSeconds / 3600);
    const minute = Math.floor((totalSeconds % 3600) / 60);
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
  }

  // 4. Extracción genérica en caso de texto mixto
  const genericMatch = str.match(/(\d{1,2}):(\d{2})/);
  if (genericMatch) {
    let hour = parseInt(genericMatch[1], 10);
    const minute = genericMatch[2];
    const isPM = /p\.?\s*m\.?|pm|tarde|noche/i.test(str);
    const isAM = /a\.?\s*m\.?|am|mañana/i.test(str);
    if (isPM && hour < 12) hour += 12;
    if (isAM && hour === 12) hour = 0;
    return `${String(hour).padStart(2, '0')}:${minute}`;
  }

  return '';
};

// Helper para normalizar fechas a formato estricto ISO (YYYY-MM-DD) para <input type="date" />
export const normalizeToDateInput = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';

  // 1. ISO YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // 2. DD/MM/YYYY o DD-MM-YYYY o DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmyMatch) {
    let day = dmyMatch[1].padStart(2, '0');
    let month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) year = '20' + year;
    if (parseInt(month, 10) > 12 && parseInt(day, 10) <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    return `${year}-${month}-${day}`;
  }

  // 3. Texto en español ej: "23 de Septiembre del 2026"
  const SPANISH_MONTHS: Record<string, string> = {
    ene: '01', enero: '01',
    feb: '02', febrero: '02',
    mar: '03', marzo: '03',
    abr: '04', abril: '04',
    may: '05', mayo: '05',
    jun: '06', junio: '06',
    jul: '07', julio: '07',
    ago: '08', agosto: '08',
    sep: '09', sept: '09', septiembre: '09', setiembre: '09',
    oct: '10', octubre: '10',
    nov: '11', noviembre: '11',
    dic: '12', diciembre: '12'
  };
  const textMatch = str.match(/^(\d{1,2})\s*(?:de|\-|\/)\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)\s*(?:del?|\-|\/)?\s*(\d{2,4})/i);
  if (textMatch) {
    let day = textMatch[1].padStart(2, '0');
    let monthName = textMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let year = textMatch[3];
    if (year.length === 2) year = '20' + year;
    const month = SPANISH_MONTHS[monthName.slice(0, 3)] || SPANISH_MONTHS[monthName];
    if (month) return `${year}-${month}-${day}`;
  }

  // 4. Serial numérico de Excel
  if (/^\d{4,5}(\.\d+)?$/.test(str)) {
    const num = parseFloat(str);
    const date = new Date(Math.round((num - 25569) * 86400 * 1000));
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }

  const parsed = new Date(str);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return '';
};

// Formatear hora a visualización 12h AM/PM
export const formatTimeDisplay = (time24: string): string => {
  if (!time24) return '';
  const match = time24.match(/^(\d{1,2}):(\d{2})/);
  if (!match) return time24;
  let hour = parseInt(match[1], 10);
  const minute = match[2];
  const ampm = hour >= 12 ? 'PM' : 'AM';
  hour = hour % 12;
  if (hour === 0) hour = 12;
  return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
};

export const EditCitationModal: React.FC<EditCitationModalProps> = ({
  isOpen,
  citation,
  onClose,
  onSave
}) => {
  const [formData, setFormData] = useState({
    nombre: '',
    identificacion: '',
    genero: 'Femenino',
    direccion: '',
    telefono: '',
    correo: '',
    nunc: '',
    orden: '',
    fiscal: '17 Local',
    delito: '',
    fecha: '',
    hora: '',
    motivo: 'Entrevista',
    requiereAbogado: 'NO',
    observaciones: ''
  });

  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (citation) {
      const rawHora = citation.hora || citation.horaExpedicion || citation.hora_citacion || citation.time || '';
      const rawFecha = citation.fecha || citation.fechaExpedicion || citation.fecha_citacion || citation.date || '';

      setFormData({
        nombre: citation.nombre || '',
        identificacion: citation.identificacion || citation.cedula || '',
        genero: citation.genero || 'Femenino',
        direccion: citation.direccion || '',
        telefono: citation.telefono || '',
        correo: citation.correo || '',
        nunc: citation.nunc || '',
        orden: citation.orden || citation.opj || citation.ot || '',
        fiscal: citation.fiscal || '17 Local',
        delito: citation.delito || '',
        fecha: normalizeToDateInput(rawFecha) || rawFecha,
        hora: normalizeToTimeInput(rawHora) || rawHora,
        motivo: citation.motivo || 'Entrevista',
        requiereAbogado: citation.requiereAbogado || 'NO',
        observaciones: citation.observaciones || ''
      });
      setErrorMsg(null);
    }
  }, [citation, isOpen]);

  if (!isOpen || !citation) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre?.trim() || !formData.orden?.trim()) {
      setErrorMsg('Por favor complete al menos el Nombre del citado y el Número de Orden a Policía Judicial.');
      return;
    }

    try {
      setIsSaving(true);
      await onSave({
        ...citation,
        ...formData,
        nombre: formData.nombre.trim(),
        identificacion: (formData.identificacion || '').trim(),
        cedula: (formData.identificacion || '').trim(),
        orden: (formData.orden || '').trim(),
        nunc: (formData.nunc || '').trim(),
        fiscal: (formData.fiscal || '').trim(),
        delito: (formData.delito || '').trim(),
        fecha: formData.fecha,
        hora: formData.hora
      });
      setIsSaving(false);
      onClose();
    } catch (err) {
      console.error('Error al guardar modificaciones de la citación:', err);
      setIsSaving(false);
      setErrorMsg('Ocurrió un error al actualizar los datos de la citación.');
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-2 sm:p-4">
        <motion.div
          initial={{ scale: 0.95, opacity: 0, y: 10 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 10 }}
          className="bg-white rounded-xl shadow-2xl max-w-4xl w-full border border-fgn-border overflow-hidden flex flex-col max-h-[94vh]"
        >
          {/* MODAL HEADER */}
          <div className="bg-fgn-blue text-white px-4 sm:px-6 py-3.5 flex justify-between items-center border-b-4 border-fgn-gold shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center text-fgn-gold">
                <FileText size={18} />
              </div>
              <div>
                <h3 className="text-xs sm:text-sm font-bold uppercase tracking-wider flex items-center gap-2">
                  <span>Modificar Citación (FPJ-35)</span>
                  <span className="text-[10px] bg-fgn-gold text-slate-950 px-2 py-0.5 rounded font-black tracking-normal">
                    EDICIÓN
                  </span>
                </h3>
                <p className="text-[10px] text-slate-300 font-mono">
                  {formData.nombre ? formData.nombre.toUpperCase() : 'CITADO'} • ORDEN: {formData.orden || 'S/O'}
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isSaving}
              className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-white cursor-pointer shrink-0 disabled:opacity-50"
            >
              <X size={18} />
            </button>
          </div>

          {/* ERROR NOTIFICATION BANNER */}
          {errorMsg && (
            <div className="bg-red-50 border-b border-red-200 px-4 py-2.5 text-xs font-semibold text-red-800 flex items-center gap-2 shrink-0">
              <AlertCircle size={15} className="text-red-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* FORM BODY - IDÉNTICO AL FORMULARIO MANUAL */}
          <form id="edit-citation-form" onSubmit={handleSubmit} className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-8">
            <div className="flex items-center justify-between border-b border-fgn-border pb-3">
              <h2 className="text-sm font-bold text-fgn-blue uppercase tracking-widest flex items-center gap-2">
                <FileText size={18} className="text-fgn-blue" /> Formulario Oficial de Citación (FPJ-35)
              </h2>
              <span className="text-[10px] font-bold text-fgn-gold bg-fgn-blue/10 px-3 py-1 rounded border border-fgn-gold/30 uppercase tracking-widest">
                Formato Estándar Policía Judicial
              </span>
            </div>

            {/* SECCIÓN 1: DATOS DEL CITADO */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-fgn-blue uppercase tracking-wider flex items-center gap-2 border-l-4 border-fgn-gold pl-2">
                <User size={14} /> 1. Datos del Destinatario (Citado)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-8">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    Nombre Completo *
                  </label>
                  <input 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue uppercase" 
                    placeholder="NOMBRES Y APELLIDOS"
                    value={formData.nombre} 
                    onChange={(e) => setFormData({...formData, nombre: e.target.value})} 
                    required
                  />
                </div>
                <div className="md:col-span-4">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    Documento / C.C.
                  </label>
                  <input 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue font-mono" 
                    placeholder="Ej: 1.047.888.999"
                    value={formData.identificacion} 
                    onChange={(e) => setFormData({...formData, identificacion: e.target.value})} 
                  />
                </div>

                <div className="md:col-span-4">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    Dirección de Residencia
                  </label>
                  <input 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                    placeholder="Barrio, Calle, Transversal, Casa"
                    value={formData.direccion} 
                    onChange={(e) => setFormData({...formData, direccion: e.target.value})} 
                  />
                </div>
                <div className="md:col-span-3">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    Teléfono / Celular
                  </label>
                  <input 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue font-mono" 
                    placeholder="300 000 0000"
                    value={formData.telefono} 
                    onChange={(e) => setFormData({...formData, telefono: e.target.value})} 
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    Correo Electrónico
                  </label>
                  <input 
                    type="email"
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                    placeholder="correo@ejemplo.com"
                    value={formData.correo} 
                    onChange={(e) => setFormData({...formData, correo: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 2: PROCESO PENAL & NOTICIA CRIMINAL */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-fgn-blue uppercase tracking-wider flex items-center gap-2 border-l-4 border-fgn-gold pl-2">
                <FileText size={14} /> 2. Proceso Penal & Noticia Criminal (NUNC)
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    NUNC (Noticia Criminal - 21 dígitos)
                  </label>
                  <input 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded font-mono text-xs font-bold text-fgn-blue outline-none focus:border-fgn-blue" 
                    placeholder="Ej: 130016001128202600123"
                    maxLength={21}
                    value={formData.nunc} 
                    onChange={(e) => setFormData({...formData, nunc: e.target.value})} 
                  />
                </div>
                <div className="md:col-span-5">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    No. Orden OPJ / Caso *
                  </label>
                  <input 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded font-mono text-xs font-bold outline-none focus:border-fgn-blue" 
                    placeholder="Ej: OPJ-123-2026"
                    value={formData.orden} 
                    onChange={(e) => setFormData({...formData, orden: e.target.value})} 
                    required
                  />
                </div>

                <div className="md:col-span-6">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    Fiscalía Asignada
                  </label>
                  <input 
                    placeholder="ej: 17 Local Cartagena" 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                    value={formData.fiscal} 
                    onChange={(e) => setFormData({...formData, fiscal: e.target.value})} 
                  />
                </div>
                <div className="md:col-span-6">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    Delito del Caso
                  </label>
                  <input 
                    placeholder="ej: Hurto Calificado, Estafa..." 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue font-medium" 
                    value={formData.delito} 
                    onChange={(e) => setFormData({...formData, delito: e.target.value})} 
                  />
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: CITACIÓN & REQUERIMIENTO */}
            <div className="space-y-4">
              <h3 className="text-xs font-bold text-fgn-blue uppercase tracking-wider flex items-center gap-2 border-l-4 border-fgn-gold pl-2">
                <Calendar size={14} /> 3. Comparecencia & Objeto de la Cita
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-6">
                  <label className="text-[9px] font-bold text-fgn-blue uppercase tracking-widest mb-1 block">
                    Fecha Comparecencia *
                  </label>
                  <input 
                    type="date" 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue cursor-pointer" 
                    value={formData.fecha} 
                    onChange={(e) => setFormData({...formData, fecha: e.target.value})} 
                    required
                  />
                </div>
                <div className="md:col-span-6">
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[9px] font-bold text-fgn-blue uppercase tracking-widest block">
                      Hora Comparecencia *
                    </label>
                    {formData.hora && (
                      <span className="text-[10px] font-mono font-bold text-fgn-blue bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                        {formatTimeDisplay(formData.hora)}
                      </span>
                    )}
                  </div>
                  <input 
                    type="time" 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue cursor-pointer" 
                    value={formData.hora} 
                    onChange={(e) => setFormData({...formData, hora: e.target.value})} 
                    required
                  />
                </div>

                <div className="md:col-span-8">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    Motivo / Objeto de la Diligencia
                  </label>
                  <select 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue cursor-pointer" 
                    value={formData.motivo} 
                    onChange={(e) => setFormData({...formData, motivo: e.target.value})}
                  >
                    <option value="Entrevista">Entrevista</option>
                    <option value="Interrogatorio">Interrogatorio</option>
                  </select>
                </div>
                <div className="md:col-span-4">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    ¿Requiere Abogado?
                  </label>
                  <select 
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue cursor-pointer" 
                    value={formData.requiereAbogado} 
                    onChange={(e) => setFormData({...formData, requiereAbogado: e.target.value})}
                  >
                    <option value="NO">NO</option>
                    <option value="SI">SI</option>
                  </select>
                </div>

                <div className="md:col-span-12">
                  <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                    Observaciones / Anexos Requeridos
                  </label>
                  <textarea 
                    rows={2}
                    className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue resize-none" 
                    value={formData.observaciones} 
                    onChange={(e) => setFormData({...formData, observaciones: e.target.value})} 
                  />
                </div>
              </div>
            </div>
          </form>

          {/* MODAL FOOTER */}
          <div className="px-6 py-4 bg-slate-50 border-t border-fgn-border flex items-center justify-between gap-3 shrink-0">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-5 py-2.5 bg-white border border-fgn-border text-text-muted font-bold rounded text-xs uppercase tracking-wider hover:bg-slate-100 transition-all cursor-pointer disabled:opacity-50"
            >
              Cancelar
            </button>

            <button
              type="submit"
              form="edit-citation-form"
              disabled={isSaving || !formData.nombre || !formData.orden}
              className="px-6 py-2.5 bg-fgn-blue hover:bg-black text-white font-bold rounded text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <span>Guardando...</span>
              ) : (
                <>
                  <Save size={15} className="text-fgn-gold" />
                  <span>Guardar Cambios</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
