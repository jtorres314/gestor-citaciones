import { generateCitationFromTemplate, downloadWordDocument, generateFPJ35WordDocument, CitationData } from '../utils/docGenerator';
import { Citacion, InvestigatorConfig } from '../types';
import { DEFAULT_OBSERVACIONES } from './citationService';

export { generateCitationFromTemplate, downloadWordDocument, generateFPJ35WordDocument };
export type { CitationData };

/**
 * Builds the complete CitationData payload from a Citacion model and investigator profile
 */
export const buildDocxDataFromCitation = (
  item: Partial<Citacion>, 
  config: InvestigatorConfig
): CitationData => {
  return {
    id: item.id,
    nunc: item.nunc || item.orden || '',
    orden: item.orden || '',
    delito: item.delito || '',
    departamento: item.departamento || config.departamento || "Bolívar",
    municipio: item.municipio || config.municipio || "Cartagena",
    fechaExpedicion: item.fechaExpedicion || new Date().toISOString().split('T')[0],
    horaExpedicion: item.horaExpedicion || "08:00",
    
    nombre: item.nombre || "CIUDADANO CITADO",
    identificacion: item.identificacion || item.cedula || "",
    genero: item.genero || "Femenino",
    direccion: item.direccion || "",
    correo: item.correo || "",
    ciudad: item.ciudad || item.municipio || config.municipio || "Cartagena",
    telefono: item.telefono || "",

    fecha: item.fecha || "",
    hora: item.hora || "",
    instalaciones: config.instalaciones || item.instalaciones || item.oficina_creador || config.oficina || "Fiscalía General de la Nación",
    direccionInstalaciones: config.direccionInstalaciones || item.direccionInstalaciones || "Sede Canapote",
    motivo: item.motivo || "Entrevista",
    requiereAbogado: item.requiereAbogado || "NO",
    observaciones: item.observaciones || DEFAULT_OBSERVACIONES,

    fiscal: item.fiscal || "17 Local",
    unidad: item.grupoInvestigador || item.unidad || config.grupoInvestigador || "Unidad de Patrimonio Económico",

    investigador: item.investigador_creador || config.investigador || "Investigador Judicial",
    entidadInvestigador: item.entidadInvestigador || config.entidadInvestigador || "CTI / Fiscalía General de la Nación",
    grupoInvestigador: item.grupoInvestigador || item.unidad || config.grupoInvestigador || "Unidad de Patrimonio Económico",
    correoInvestigador: item.correoInvestigador || config.correoInvestigador || "contacto@fiscalia.gov.co",
    telefonoInvestigador: item.telefono_creador || config.telefono || "3000000000",
    firmaInvestigador: config.firmaImg || ""
  };
};

/**
 * Downloads the FPJ-35 document formatted for a given citation
 */
export const downloadCitationDocx = async (
  item: Partial<Citacion>,
  config: InvestigatorConfig,
  customTemplateBuffer?: ArrayBuffer
): Promise<string> => {
  const docData = buildDocxDataFromCitation(item, config);
  const blob = await generateCitationFromTemplate(docData, customTemplateBuffer);
  
  const cleanName = (item.nombre || 'CITADO').toString().trim().replace(/[\s\\/:*?"<>|]+/g, '_').replace(/_+/g, '_');
  const rawCedula = (item.identificacion || item.cedula || '').toString().trim();
  const cleanCedula = rawCedula.replace(/[\s\\/:*?"<>|]+/g, '_').replace(/_+/g, '_');
  const filename = cleanCedula 
    ? `CITACION_${cleanName}_CC_${cleanCedula}.docx` 
    : `CITACION_${cleanName}.docx`;
  
  downloadWordDocument(blob, filename);
  return filename;
};
