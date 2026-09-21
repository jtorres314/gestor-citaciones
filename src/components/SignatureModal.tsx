import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  X, 
  UserCheck, 
  Upload, 
  Check, 
  Trash2, 
  Save, 
  FileText, 
  RotateCcw,
  Sparkles
} from 'lucide-react';
import { InvestigatorConfig } from '../types';

interface SignatureModalProps {
  isOpen: boolean;
  config: InvestigatorConfig;
  customTemplateName?: string | null;
  onClose: () => void;
  onSaveConfig: (updatedConfig: InvestigatorConfig) => void;
  onUploadCustomTemplate?: (file: File) => void;
  onResetTemplate?: () => void;
}

export const SignatureModal: React.FC<SignatureModalProps> = ({
  isOpen,
  config,
  customTemplateName,
  onClose,
  onSaveConfig,
  onUploadCustomTemplate,
  onResetTemplate
}) => {
  const [formData, setFormData] = useState<InvestigatorConfig>({ ...config });
  const [templateUploadMessage, setTemplateUploadMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 400;
        const scaleSize = MAX_WIDTH / img.width;
        canvas.width = MAX_WIDTH;
        canvas.height = img.height * scaleSize;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const compressedDataUrl = canvas.toDataURL('image/png', 0.8);
          setFormData(prev => ({ ...prev, firmaImg: compressedDataUrl }));
        }
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleTemplateFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onUploadCustomTemplate) {
      onUploadCustomTemplate(file);
      setTemplateUploadMessage(`Plantilla "${file.name}" cargada correctamente`);
      setTimeout(() => setTemplateUploadMessage(null), 4000);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSaveConfig(formData);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-3 sm:p-4">
      <motion.div 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.95, opacity: 0 }}
        className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-fgn-border overflow-hidden flex flex-col max-h-[90vh]"
      >
        {/* HEADER */}
        <div className="bg-fgn-blue text-white px-6 py-4 flex justify-between items-center border-b-4 border-fgn-gold shrink-0">
          <div className="flex items-center gap-3">
            <div className="bg-fgn-gold/20 p-2 rounded-lg border border-fgn-gold/30">
              <UserCheck size={20} className="text-fgn-gold" />
            </div>
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider">
                Perfil de Policía Judicial y Firma Digital
              </h3>
              <p className="text-[10px] text-blue-200">
                Configuración de datos institucionales para formato FPJ-35
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* FORM CONTENT */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto flex-1 space-y-5">
          {/* DATOS PERSONALES DEL INVESTIGADOR */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-fgn-blue uppercase tracking-widest border-b pb-1">
              1. Identificación del Servidor de Policía Judicial
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                  Nombre Completo del Investigador *
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold uppercase focus:border-fgn-blue outline-none" 
                  value={formData.investigador} 
                  onChange={(e) => setFormData({ ...formData, investigador: e.target.value })} 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                  Teléfono / Celular de Contacto *
                </label>
                <input 
                  type="text" 
                  required
                  className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold focus:border-fgn-blue outline-none" 
                  value={formData.telefono} 
                  onChange={(e) => setFormData({ ...formData, telefono: e.target.value })} 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                  Correo Electrónico Institucional
                </label>
                <input 
                  type="email" 
                  className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs focus:border-fgn-blue outline-none" 
                  value={formData.correoInvestigador} 
                  onChange={(e) => setFormData({ ...formData, correoInvestigador: e.target.value })} 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                  Entidad de Policía Judicial
                </label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs focus:border-fgn-blue outline-none" 
                  value={formData.entidadInvestigador} 
                  onChange={(e) => setFormData({ ...formData, entidadInvestigador: e.target.value })} 
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                  Grupo / Unidad de Investigación
                </label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs focus:border-fgn-blue outline-none" 
                  value={formData.grupoInvestigador} 
                  onChange={(e) => setFormData({ ...formData, grupoInvestigador: e.target.value })} 
                />
              </div>
            </div>
          </div>

          {/* INSTALACIONES Y DESPACHO */}
          <div className="space-y-4">
            <h4 className="text-xs font-bold text-fgn-blue uppercase tracking-widest border-b pb-1">
              2. Sede e Instalaciones de Comparecencia
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                  Departamento
                </label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold focus:border-fgn-blue outline-none" 
                  value={formData.departamento} 
                  onChange={(e) => setFormData({ ...formData, departamento: e.target.value })} 
                />
              </div>

              <div>
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                  Municipio / Ciudad
                </label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold focus:border-fgn-blue outline-none" 
                  value={formData.municipio} 
                  onChange={(e) => setFormData({ ...formData, municipio: e.target.value })} 
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                  Nombre de la Sede / Instalaciones
                </label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold focus:border-fgn-blue outline-none" 
                  value={formData.instalaciones} 
                  onChange={(e) => setFormData({ ...formData, instalaciones: e.target.value })} 
                />
              </div>

              <div className="md:col-span-2">
                <label className="text-[10px] font-bold text-text-muted uppercase block mb-1">
                  Dirección Exacta de las Instalaciones
                </label>
                <input 
                  type="text" 
                  className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold focus:border-fgn-blue outline-none" 
                  value={formData.direccionInstalaciones} 
                  onChange={(e) => setFormData({ ...formData, direccionInstalaciones: e.target.value })} 
                />
              </div>
            </div>
          </div>

          {/* FIRMA DIGITAL */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-fgn-blue uppercase tracking-widest border-b pb-1">
              3. Firma Digitalizada para Word FPJ-35
            </h4>

            <div className="bg-slate-50 border border-slate-200 p-4 rounded-lg flex flex-col sm:flex-row items-center gap-4">
              <div className="w-40 h-20 bg-white border border-dashed border-slate-300 rounded flex items-center justify-center overflow-hidden shrink-0">
                {formData.firmaImg ? (
                  <img 
                    src={formData.firmaImg} 
                    alt="Firma del Investigador" 
                    className="max-h-full max-w-full object-contain" 
                  />
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold uppercase text-center px-2">
                    Sin Firma Cargada
                  </span>
                )}
              </div>

              <div className="flex-1 space-y-2 text-center sm:text-left">
                <p className="text-[11px] text-slate-600">
                  Cargue una imagen nítida (PNG/JPG) de su firma manuscrita para que se inserte automáticamente en el formato oficial.
                </p>
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <label className="px-3 py-1.5 bg-fgn-blue hover:bg-black text-white text-xs font-bold rounded cursor-pointer transition-all flex items-center gap-1.5">
                    <Upload size={14} /> Cargar Firma
                    <input 
                      type="file" 
                      accept="image/*" 
                      className="hidden" 
                      onChange={handleSignatureUpload} 
                    />
                  </label>
                  {formData.firmaImg && (
                    <button 
                      type="button" 
                      onClick={() => setFormData({ ...formData, firmaImg: '' })}
                      className="px-3 py-1.5 bg-red-50 text-red-600 hover:bg-red-100 rounded text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={14} /> Quitar
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* PLANTILLA BASE WORD (.DOCX) */}
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-fgn-blue uppercase tracking-widest border-b pb-1 flex items-center justify-between">
              <span>4. Plantilla Base Oficial de Word</span>
              <span className="text-[9px] text-slate-400 normal-case font-normal">(Opcional)</span>
            </h4>

            <div className="bg-blue-50/50 border border-blue-100 p-4 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileText size={16} className="text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">
                    {customTemplateName || "Plantilla Integrada por Defecto (FPJ-35)"}
                  </span>
                </div>
                {customTemplateName && onResetTemplate && (
                  <button 
                    type="button"
                    onClick={onResetTemplate}
                    className="text-[10px] text-slate-500 hover:text-red-600 flex items-center gap-1 font-bold cursor-pointer"
                  >
                    <RotateCcw size={12} /> Restaurar Defecto
                  </button>
                )}
              </div>

              {templateUploadMessage && (
                <p className="text-[11px] text-emerald-700 font-bold bg-emerald-50 p-2 rounded border border-emerald-200">
                  {templateUploadMessage}
                </p>
              )}

              <div className="flex items-center gap-3">
                <label className="px-3 py-1.5 bg-white border border-blue-300 hover:bg-blue-50 text-blue-900 text-xs font-bold rounded cursor-pointer transition-all flex items-center gap-1.5 shadow-2xs">
                  <Upload size={14} /> Cargar Plantilla .docx
                  <input 
                    type="file" 
                    accept=".docx" 
                    className="hidden" 
                    onChange={handleTemplateFileChange} 
                  />
                </label>
                <span className="text-[10px] text-slate-500">
                  Admite variables: <code className="bg-slate-200 px-1 rounded text-[9px]">{`{NOMBRE}`}</code>, <code className="bg-slate-200 px-1 rounded text-[9px]">{`{FIRMA}`}</code>
                </span>
              </div>
            </div>
          </div>

          {/* SUBMIT BUTTON */}
          <div className="pt-3 border-t flex justify-end gap-3">
            <button 
              type="button" 
              onClick={onClose}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs uppercase tracking-wider transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button 
              type="submit"
              className="px-6 py-2 bg-fgn-blue hover:bg-black text-white font-bold rounded text-xs uppercase tracking-widest transition-all shadow-md flex items-center gap-2 cursor-pointer"
            >
              <Save size={16} /> Guardar Configuración
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
