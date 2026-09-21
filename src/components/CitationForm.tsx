import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Plus, 
  UserCheck, 
  Calendar, 
  Clock, 
  FileText, 
  Building2, 
  MapPin, 
  AlertCircle,
  Sparkles,
  Phone,
  Mail,
  Scale
} from 'lucide-react';
import { Citacion, InvestigatorConfig } from '../types';
import { 
  getTodayDateStr, 
  getCurrentTimeStr, 
  DEFAULT_OBSERVACIONES,
  formatTimeAMPM,
  formatDateES
} from '../services/citationService';

interface CitationFormProps {
  config: InvestigatorConfig;
  onSubmit: (data: Partial<Citacion>) => void;
  onCancel?: () => void;
  initialData?: Partial<Citacion> | null;
  isEditing?: boolean;
}

export const CitationForm: React.FC<CitationFormProps> = ({
  config,
  onSubmit,
  onCancel,
  initialData,
  isEditing = false
}) => {
  const [formData, setFormData] = useState<Partial<Citacion>>({
    nombre: initialData?.nombre || '',
    identificacion: initialData?.identificacion || initialData?.cedula || '',
    genero: initialData?.genero || 'Femenino',
    orden: initialData?.orden || '',
    nunc: initialData?.nunc || '',
    fiscal: initialData?.fiscal || '17 Local',
    delito: initialData?.delito || '',
    unidad: initialData?.unidad || config.grupoInvestigador || 'Unidad de Patrimonio Económico',
    fecha: initialData?.fecha || getTodayDateStr(),
    hora: initialData?.hora || '08:00',
    telefono: initialData?.telefono || '',
    correo: initialData?.correo || '',
    direccion: initialData?.direccion || '',
    ciudad: initialData?.ciudad || config.municipio || 'Cartagena',
    motivo: initialData?.motivo || 'Entrevista',
    instalaciones: initialData?.instalaciones || config.instalaciones || 'Fiscalía General de la Nación - Sede Canapote',
    direccionInstalaciones: initialData?.direccionInstalaciones || config.direccionInstalaciones || 'Cra. 17 # 32-10',
    requiereAbogado: initialData?.requiereAbogado || 'NO',
    observaciones: initialData?.observaciones || DEFAULT_OBSERVACIONES
  });

  const handleChange = (field: keyof Citacion, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.nombre?.trim() || !formData.orden?.trim()) return;
    onSubmit(formData);
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white border-2 border-fgn-blue/20 p-5 sm:p-8 rounded-xl shadow-lg space-y-6"
    >
      <div className="flex justify-between items-center border-b border-fgn-border pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-fgn-blue/10 rounded-lg text-fgn-blue">
            <FileText size={20} />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-fgn-blue uppercase tracking-tight">
              {isEditing ? 'Editar Citación Judicial (FPJ-35)' : 'Registro Manual de Citación (FPJ-35)'}
            </h3>
            <p className="text-[10px] text-slate-500 font-medium">
              Diligencie los campos requeridos para expedir la citación formal
            </p>
          </div>
        </div>
        {onCancel && (
          <button 
            type="button" 
            onClick={onCancel}
            className="text-xs text-slate-500 hover:text-slate-800 font-bold uppercase tracking-wider px-3 py-1 rounded hover:bg-slate-100 transition-colors"
          >
            Cerrar
          </button>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* BLOQUE 1: DATOS PROCESALES */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-fgn-blue uppercase tracking-wider block bg-blue-50/70 px-3 py-1.5 rounded border border-blue-100">
            1. Datos del Proceso Penal y Orden a Policía Judicial
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3.5">
            <div className="md:col-span-4">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Orden a Policía Judicial (OPJ) *
              </label>
              <input 
                type="text" 
                required
                placeholder="Ej: 13427245" 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-mono font-bold focus:border-fgn-blue outline-none" 
                value={formData.orden} 
                onChange={(e) => handleChange('orden', e.target.value)} 
              />
            </div>

            <div className="md:col-span-4">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                NUNC / SPOA (21 Dígitos)
              </label>
              <input 
                type="text" 
                placeholder="1300160011282024..." 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-mono focus:border-fgn-blue outline-none" 
                value={formData.nunc} 
                onChange={(e) => handleChange('nunc', e.target.value)} 
              />
            </div>

            <div className="md:col-span-4">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Fiscalía de Conocimiento
              </label>
              <input 
                type="text" 
                placeholder="Ej: 17 Local" 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold uppercase focus:border-fgn-blue outline-none" 
                value={formData.fiscal} 
                onChange={(e) => handleChange('fiscal', e.target.value)} 
              />
            </div>

            <div className="md:col-span-6">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Delito / Conducta Investigada
              </label>
              <input 
                type="text" 
                placeholder="Ej: Estafa, Hurto Calificado..." 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs focus:border-fgn-blue outline-none" 
                value={formData.delito} 
                onChange={(e) => handleChange('delito', e.target.value)} 
              />
            </div>

            <div className="md:col-span-6">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Unidad / Grupo Investigador
              </label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs focus:border-fgn-blue outline-none" 
                value={formData.unidad} 
                onChange={(e) => handleChange('unidad', e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* BLOQUE 2: DATOS DEL CITADO */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-fgn-blue uppercase tracking-wider block bg-blue-50/70 px-3 py-1.5 rounded border border-blue-100">
            2. Datos del Ciudadano Destinatario (Citado)
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3.5">
            <div className="md:col-span-7">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Nombre Completo del Citado *
              </label>
              <input 
                type="text" 
                required
                placeholder="Ej: JUAN PEREZ MARTINEZ" 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold uppercase focus:border-fgn-blue outline-none" 
                value={formData.nombre} 
                onChange={(e) => handleChange('nombre', e.target.value)} 
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Cédula / Documento Identidad
              </label>
              <input 
                type="text" 
                placeholder="Ej: 1047458992" 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-mono font-bold focus:border-fgn-blue outline-none" 
                value={formData.identificacion} 
                onChange={(e) => handleChange('identificacion', e.target.value)} 
              />
            </div>

            <div className="md:col-span-2">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Tratamiento / Género
              </label>
              <select 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                value={formData.genero} 
                onChange={(e) => handleChange('genero', e.target.value)}
              >
                <option value="Femenino">Femenino (Sra.)</option>
                <option value="Masculino">Masculino (Sr.)</option>
              </select>
            </div>

            <div className="md:col-span-4">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Teléfono / Celular (WhatsApp)
              </label>
              <input 
                type="text" 
                placeholder="Ej: 3001234567" 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs focus:border-fgn-blue outline-none font-mono" 
                value={formData.telefono} 
                onChange={(e) => handleChange('telefono', e.target.value)} 
              />
            </div>

            <div className="md:col-span-4">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Correo Electrónico
              </label>
              <input 
                type="email" 
                placeholder="ejemplo@correo.com" 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs focus:border-fgn-blue outline-none" 
                value={formData.correo} 
                onChange={(e) => handleChange('correo', e.target.value)} 
              />
            </div>

            <div className="md:col-span-4">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Ciudad / Municipio Residencia
              </label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs focus:border-fgn-blue outline-none" 
                value={formData.ciudad} 
                onChange={(e) => handleChange('ciudad', e.target.value)} 
              />
            </div>

            <div className="md:col-span-12">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Dirección Residencial o Laboral del Citado
              </label>
              <input 
                type="text" 
                placeholder="Barrio, Calle, Carrera, Manzana, Lote..." 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs focus:border-fgn-blue outline-none" 
                value={formData.direccion} 
                onChange={(e) => handleChange('direccion', e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* BLOQUE 3: DILIGENCIA Y COMPARECENCIA */}
        <div className="space-y-3">
          <span className="text-[10px] font-bold text-fgn-blue uppercase tracking-wider block bg-blue-50/70 px-3 py-1.5 rounded border border-blue-100">
            3. Programación de la Diligencia y Requisitos
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-12 gap-3.5">
            <div className="md:col-span-3">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Fecha Programada *
              </label>
              <input 
                type="date" 
                required
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold font-mono focus:border-fgn-blue outline-none" 
                value={formData.fecha} 
                onChange={(e) => handleChange('fecha', e.target.value)} 
              />
            </div>

            <div className="md:col-span-3">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Hora de la Diligencia *
              </label>
              <input 
                type="time" 
                required
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold font-mono focus:border-fgn-blue outline-none" 
                value={formData.hora} 
                onChange={(e) => handleChange('hora', e.target.value)} 
              />
            </div>

            <div className="md:col-span-4">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Motivo / Objeto de la Diligencia
              </label>
              <select 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                value={formData.motivo} 
                onChange={(e) => handleChange('motivo', e.target.value)}
              >
                <option value="Entrevista">Entrevista</option>
                <option value="Interrogatorio">Interrogatorio</option>
                <option value="Declaración Jurada">Declaración Jurada</option>
                <option value="Ampliación de Denuncia">Ampliación de Denuncia</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                ¿Requiere Abogado?
              </label>
              <select 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                value={formData.requiereAbogado} 
                onChange={(e) => handleChange('requiereAbogado', e.target.value)}
              >
                <option value="NO">NO</option>
                <option value="SI">SI</option>
              </select>
            </div>

            <div className="md:col-span-6">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Sede / Instalaciones
              </label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold focus:border-fgn-blue outline-none" 
                value={formData.instalaciones} 
                onChange={(e) => handleChange('instalaciones', e.target.value)} 
              />
            </div>

            <div className="md:col-span-6">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Dirección de las Instalaciones
              </label>
              <input 
                type="text" 
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold focus:border-fgn-blue outline-none" 
                value={formData.direccionInstalaciones} 
                onChange={(e) => handleChange('direccionInstalaciones', e.target.value)} 
              />
            </div>

            <div className="md:col-span-12">
              <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">
                Observaciones / Anexos Requeridos
              </label>
              <textarea 
                rows={2}
                className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs focus:border-fgn-blue outline-none resize-none" 
                value={formData.observaciones} 
                onChange={(e) => handleChange('observaciones', e.target.value)} 
              />
            </div>
          </div>
        </div>

        {/* SUBMIT BUTTONS */}
        <div className="pt-2 flex flex-col sm:flex-row gap-3">
          {onCancel && (
            <button 
              type="button" 
              onClick={onCancel}
              className="px-6 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancelar
            </button>
          )}
          <button 
            type="submit" 
            disabled={!formData.nombre || !formData.orden} 
            className="flex-1 bg-fgn-blue hover:bg-black disabled:bg-slate-300 text-white font-bold py-3.5 rounded text-xs tracking-[0.15em] uppercase transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Plus size={16} /> {isEditing ? 'Guardar Cambios de la Citación' : 'Registrar Citación en Bandeja'}
          </button>
        </div>
      </form>
    </motion.div>
  );
};
