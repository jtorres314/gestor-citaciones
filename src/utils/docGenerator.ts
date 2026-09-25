import { 
  Document, 
  Packer, 
  Paragraph, 
  TextRun, 
  ImageRun,
  Table, 
  TableRow, 
  TableCell, 
  WidthType, 
  AlignmentType, 
  BorderStyle,
  ShadingType,
  VerticalAlign
} from 'docx';
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';

export interface CitationData {
  id?: string;
  nunc?: string; // 21 dígitos
  orden?: string;
  departamento?: string;
  municipio?: string;
  fechaExpedicion?: string;
  horaExpedicion?: string;
  
  // Citado
  nombre: string;
  identificacion?: string;
  genero?: string;
  direccion?: string;
  correo?: string;
  ciudad?: string;
  telefono?: string;

  // Cita / Comparecencia
  fecha: string;
  hora: string;
  instalaciones?: string;
  direccionInstalaciones?: string;
  motivo?: string;
  requiereAbogado?: 'SI' | 'NO' | string;
  observaciones?: string;

  // Fiscalía / Causa
  fiscal?: string;
  delito?: string;
  unidad?: string;

  // Investigador / Cita
  investigador?: string;
  entidadInvestigador?: string;
  grupoInvestigador?: string;
  correoInvestigador?: string;
  telefonoInvestigador?: string;
  firmaInvestigador?: string; // Base64 o Data URL de la imagen de la firma
}

function formatDateFull(dateStr?: string): string {
  if (!dateStr) return '____________________';
  try {
    const [year, month, day] = dateStr.split('-');
    if (!year || !month || !day) return dateStr;
    const dateObj = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
    return dateObj.toLocaleDateString('es-CO', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  } catch (e) {
    return dateStr;
  }
}

function formatTime12H(timeStr?: string): string {
  if (!timeStr) return '________';
  const str = timeStr.trim();
  if (!str) return '________';
  try {
    const matchWithAmPm = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/i);
    if (matchWithAmPm) {
      let hours = parseInt(matchWithAmPm[1], 10);
      const minutes = matchWithAmPm[2];
      const ampm = matchWithAmPm[3].toUpperCase();
      if (hours === 0) hours = 12;
      return `${hours}:${minutes} ${ampm}`;
    }

    const matchSimple = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (matchSimple) {
      let hours = parseInt(matchSimple[1], 10);
      const minutes = matchSimple[2];
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${minutes} ${ampm}`;
    }

    if (str.includes(':')) {
      const parts = str.split(':');
      let hours = parseInt(parts[0], 10);
      const rest = parts[1].trim();
      const numMin = rest.replace(/[^0-9]/g, '').slice(0, 2) || '00';
      const hasPM = /pm/i.test(str);
      const hasAM = /am/i.test(str);
      const ampm = hasPM ? 'PM' : hasAM ? 'AM' : (hours >= 12 ? 'PM' : 'AM');
      hours = hours % 12;
      hours = hours ? hours : 12;
      return `${hours}:${numMin} ${ampm}`;
    }

    return str;
  } catch (e) {
    return str;
  }
}

export function cleanDiligenciaMotivo(motivo?: string): string {
  if (!motivo) return 'Entrevista';
  const trimmed = motivo.trim();
  if (trimmed.includes(' - ')) {
    return trimmed.split(' - ')[0].trim() || 'Entrevista';
  }
  return trimmed;
}

export function parseSignatureImage(raw?: string): { bytes: Uint8Array; extension: 'png' | 'jpeg'; mimeType: string } | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    let base64 = trimmed;
    let extension: 'png' | 'jpeg' = 'png';
    let mimeType = 'image/png';

    const match = trimmed.match(/^data:([^;]+);base64,(.+)$/);
    if (match) {
      mimeType = match[1].toLowerCase();
      base64 = match[2];
      if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
        extension = 'jpeg';
        mimeType = 'image/jpeg';
      } else {
        extension = 'png';
        mimeType = 'image/png';
      }
    }

    const binaryStr = atob(base64);
    const len = binaryStr.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    return { bytes, extension, mimeType };
  } catch (e) {
    console.error("Error al procesar la imagen de la firma:", e);
    return null;
  }
}

export function getImageDimensions(bytes: Uint8Array, mimeType: string): { width: number; height: number } {
  try {
    if (mimeType.includes('png') && bytes.length >= 24) {
      if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4E && bytes[3] === 0x47) {
        const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
        const width = view.getUint32(16, false);
        const height = view.getUint32(20, false);
        if (width > 0 && height > 0) return { width, height };
      }
    }
    if (mimeType.includes('jpeg') || mimeType.includes('jpg')) {
      let offset = 2;
      const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
      while (offset < bytes.length - 8) {
        if (bytes[offset] !== 0xFF) break;
        const marker = bytes[offset + 1];
        if (marker === 0xC0 || marker === 0xC2) {
          const height = view.getUint16(offset + 5, false);
          const width = view.getUint16(offset + 7, false);
          if (width > 0 && height > 0) return { width, height };
          break;
        }
        const length = view.getUint16(offset + 2, false);
        offset += 2 + length;
      }
    }
  } catch (e) {
    console.warn("Could not parse image dimensions, using fallback:", e);
  }
  return { width: 400, height: 120 };
}

export function calculateConstrainedDimensions(
  naturalWidth: number,
  naturalHeight: number,
  maxWidthPx = 125,
  maxHeightPx = 36
): { widthPx: number; heightPx: number; cxEmu: number; cyEmu: number } {
  const w = naturalWidth > 0 ? naturalWidth : 400;
  const h = naturalHeight > 0 ? naturalHeight : 120;
  
  const scale = Math.min(maxWidthPx / w, maxHeightPx / h, 1);
  const widthPx = Math.max(20, Math.round(w * scale));
  const heightPx = Math.max(10, Math.round(h * scale));
  
  // 1 px = 9525 EMUs
  const cxEmu = widthPx * 9525;
  const cyEmu = heightPx * 9525;
  
  return { widthPx, heightPx, cxEmu, cyEmu };
}

function cleanWordXmlTags(xml: string): string {
  // 1. Eliminar etiquetas de corrección ortográfica de Word que parten las etiquetas
  xml = xml.replace(/<w:proofErr[^>]*\/>/g, '');

  // 2. Unificar etiquetas { ... } partidas entre diferentes elementos <w:t>
  xml = xml.replace(/<w:t[^>]*>\{<\/w:t>([\s\S]*?)<w:t[^>]*>\}<\/w:t>/g, (_match, middle) => {
    const tagName = middle.replace(/<[^>]+>/g, '').trim();
    return '<w:t>{' + tagName + '}</w:t>';
  });

  xml = xml.replace(/\{([^{}<>]+)<\/w:t>[\s\S]*?<w:t[^>]*>([^{}<>]+)\}/g, (_match, p1, p2) => {
    return '<w:t>{' + (p1 + p2).trim() + '}</w:t>';
  });

  return xml;
}

function escapeXml(str?: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function makeNormalRun(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function makeBoldUnderlineRun(text: string): string {
  return `<w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:bCs/><w:u w:val="single"/><w:sz w:val="22"/><w:szCs w:val="16"/></w:rPr><w:t xml:space="preserve">${escapeXml(text)}</w:t></w:r>`;
}

function replacePlaceholderWithRuns(xml: string, placeholder: string, replacementXml: string): string {
  let idx = xml.indexOf(placeholder);
  while (idx !== -1) {
    let pos = idx;
    let startRun = -1;
    while (pos >= 0) {
      const candidate = xml.lastIndexOf('<w:r', pos);
      if (candidate === -1) break;
      const charAfter = xml.charAt(candidate + 4);
      if (charAfter === ' ' || charAfter === '>') {
        startRun = candidate;
        break;
      }
      pos = candidate - 1;
    }
    const endRun = xml.indexOf('</w:r>', idx);
    if (startRun !== -1 && endRun !== -1) {
      xml = xml.substring(0, startRun) + replacementXml + xml.substring(endRun + 6);
      idx = xml.indexOf(placeholder);
    } else {
      break;
    }
  }
  return xml;
}

export async function generateFPJ35WordDocument(citation: CitationData): Promise<Blob> {
  const nunc = (citation.nunc || citation.orden || '000000000000000000000').padStart(21, '0').slice(0, 21);
  const nuncDigits = nunc.split('');

  const blackBorder = { style: BorderStyle.SINGLE, size: 4, color: "000000" };
  const doubleBorder = { style: BorderStyle.SINGLE, size: 8, color: "000000" };
  const thinBorder = { style: BorderStyle.SINGLE, size: 2, color: "CCCCCC" };

  // NUNC Table Header (21 digits box)
  const nuncCells = nuncDigits.map((digit) => 
    new TableCell({
      width: { size: 100 / 21, type: WidthType.PERCENTAGE },
      borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          children: [new TextRun({ text: digit, size: 16, bold: true, font: "Calibri" })]
        })
      ]
    })
  );

  const nuncTable = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: nuncCells
      })
    ]
  });

  // Main Document Table
  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: { top: 720, bottom: 720, left: 720, right: 720 } // 0.5 in margins
          }
        },
        children: [
          // NUNC Label
          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "Número Único de Noticia Criminal", bold: true, size: 18, font: "Calibri" })
            ]
          }),

          nuncTable,

          new Paragraph({ text: "", spacing: { after: 100 } }),

          // Header FPJ - 35 Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 100, type: WidthType.PERCENTAGE },
                    shading: { fill: "F2F2F2", type: ShadingType.CLEAR },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "CITACIÓN – FPJ - 35\n", bold: true, size: 22, font: "Calibri" }),
                          new TextRun({ text: "Este formato será utilizado por Policía Judicial", size: 16, italics: true, font: "Calibri" })
                        ]
                      })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({ text: "Departamento: ", bold: true, size: 16, font: "Calibri" }),
                          new TextRun({ text: `${citation.departamento || 'Bolívar'}   `, size: 16, font: "Calibri" }),
                          new TextRun({ text: "Municipio: ", bold: true, size: 16, font: "Calibri" }),
                          new TextRun({ text: `${citation.municipio || 'Cartagena'}   `, size: 16, font: "Calibri" }),
                          new TextRun({ text: "Fecha: ", bold: true, size: 16, font: "Calibri" }),
                          new TextRun({ text: `${citation.fechaExpedicion || citation.fecha || new Date().toISOString().split('T')[0]}   `, size: 16, font: "Calibri" }),
                          new TextRun({ text: "Hora: ", bold: true, size: 16, font: "Calibri" }),
                          new TextRun({ text: `${citation.horaExpedicion || citation.hora || new Date().toTimeString().slice(0, 5)}`, size: 16, font: "Calibri" })
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 100 } }),

          // Datos del Citado Table
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "Señor (a)", bold: true, size: 18, font: "Calibri" })] })]
                  }),
                  new TableCell({
                    width: { size: 75, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ 
                        children: [
                          new TextRun({ 
                            text: (citation.identificacion && citation.identificacion.trim())
                              ? `${citation.nombre.toUpperCase()} con CC ${citation.identificacion.trim()}`
                              : citation.nombre.toUpperCase(), 
                            bold: true, 
                            size: 18, 
                            font: "Calibri" 
                          })
                        ] 
                      })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "Dirección", bold: true, size: 18, font: "Calibri" })] })]
                  }),
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: citation.direccion || 'No registrada', size: 18, font: "Calibri" })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "Correo", bold: true, size: 18, font: "Calibri" })] })]
                  }),
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: citation.correo || 'No registrado', size: 18, font: "Calibri" })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "Ciudad", bold: true, size: 18, font: "Calibri" })] })]
                  }),
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: citation.ciudad || citation.municipio || 'Cartagena', size: 18, font: "Calibri" })] })]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 100 } }),

          // Body of Citation Box
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({
                        spacing: { before: 100, after: 100 },
                        children: [
                          new TextRun({ text: "Se solicita comparecer el próximo ", size: 18, font: "Calibri" }),
                          new TextRun({ text: formatDateFull(citation.fecha), bold: true, underline: {}, size: 18, font: "Calibri" }),
                          new TextRun({ text: " a las ", size: 18, font: "Calibri" }),
                          new TextRun({ text: formatTime12H(citation.hora), bold: true, underline: {}, size: 18, font: "Calibri" }),
                          new TextRun({ text: ",\nen las instalaciones de ", size: 18, font: "Calibri" }),
                          new TextRun({ text: `${citation.instalaciones || 'Fiscalía General de la Nación - ' + (citation.unidad || 'Unidad de Patrimonio Económico')}`, bold: true, underline: {}, size: 18, font: "Calibri" }),
                          new TextRun({ text: ",\nubicadas en la ", size: 18, font: "Calibri" }),
                          new TextRun({ text: `${citation.direccionInstalaciones || 'Sede Fiscalía - Canapote / Crespo'}`, bold: true, underline: {}, size: 18, font: "Calibri" }),
                          new TextRun({ text: " para ", size: 18, font: "Calibri" }),
                          new TextRun({ text: `${cleanDiligenciaMotivo(citation.motivo)}`, bold: true, underline: {}, size: 18, font: "Calibri" }),
                          new TextRun({ text: ",\ndentro del proceso de la referencia.", size: 18, font: "Calibri" }),
                          ...(citation.delito && citation.delito.trim() ? [
                            new TextRun({ text: " (", size: 18, font: "Calibri" }),
                            new TextRun({ text: `${citation.delito.trim()}`, bold: true, underline: {}, size: 18, font: "Calibri" }),
                            new TextRun({ text: ")", size: 18, font: "Calibri" }),
                          ] : []),
                          ...(citation.fiscal && citation.fiscal.trim() ? [
                            new TextRun({ text: " (Fiscalía: ", size: 18, font: "Calibri" }),
                            new TextRun({ text: `${citation.fiscal.trim()}`, bold: true, underline: {}, size: 18, font: "Calibri" }),
                            new TextRun({ text: ").", size: 18, font: "Calibri" })
                          ] : [])
                        ]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 100 } }),

          // Requires Lawyer Box
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 40, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "Debe asistir con abogado", bold: true, size: 18, font: "Calibri" })] })]
                  }),
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    shading: citation.requiereAbogado === 'SI' ? { fill: "D9EAD3", type: ShadingType.CLEAR } : undefined,
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: citation.requiereAbogado === 'SI' ? "[ X ]  SI" : "[   ]  SI", bold: citation.requiereAbogado === 'SI', size: 18, font: "Calibri" })] })]
                  }),
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    shading: citation.requiereAbogado !== 'SI' ? { fill: "FCE5CD", type: ShadingType.CLEAR } : undefined,
                    children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: citation.requiereAbogado !== 'SI' ? "[ X ]  NO" : "[   ]  NO", bold: citation.requiereAbogado !== 'SI', size: 18, font: "Calibri" })] })]
                  })
                ]
              })
            ]
          }),

          new Paragraph({
            spacing: { before: 100, after: 100 },
            alignment: AlignmentType.CENTER,
            children: [
              new TextRun({ text: "Su comparecencia está enmarcada en la Constitución y la ley procesal penal.", italics: true, bold: true, size: 18, font: "Calibri" })
            ]
          }),

          // Section 1: Observaciones
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    shading: { fill: "E6E6E6", type: ShadingType.CLEAR },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "1. OBSERVACIONES", bold: true, size: 18, font: "Calibri" })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({
                        spacing: { before: 100, after: 100 },
                        children: [new TextRun({ text: citation.observaciones || "Presentar documento de identidad original. Si cuenta con elementos materiales probatorios o evidencia física relacionados con los hechos, se solicita aportarlos durante la diligencia.", size: 17, font: "Calibri" })]
                      })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 100 } }),

          // Section 2: Persona que realiza la citación
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 3,
                    shading: { fill: "E6E6E6", type: ShadingType.CLEAR },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "2. PERSONA QUE REALIZA LA CITACIÓN", bold: true, size: 18, font: "Calibri" })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Nombres y Apellidos:\n", bold: true, size: 16, font: "Calibri" }), new TextRun({ text: citation.investigador || 'Investigador Judicial', size: 17, font: "Calibri" })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Entidad:\n", bold: true, size: 16, font: "Calibri" }), new TextRun({ text: citation.entidadInvestigador || 'CTI / Fiscalía', size: 17, font: "Calibri" })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 25, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Grupo:\n", bold: true, size: 16, font: "Calibri" }), new TextRun({ text: citation.grupoInvestigador || citation.unidad || 'Patrimonio Económico', size: 17, font: "Calibri" })] })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Correo Electrónico / Teléfono:\n", bold: true, size: 16, font: "Calibri" }), new TextRun({ text: `${citation.correoInvestigador || 'contacto@fiscalia.gov.co'} - Cel: ${citation.telefonoInvestigador || '3000000000'}`, size: 17, font: "Calibri" })] })
                    ]
                  }),
                  new TableCell({
                    columnSpan: 2,
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      (() => {
                        const sigInfo = parseSignatureImage(citation.firmaInvestigador);
                        if (sigInfo) {
                          const { width: natW, height: natH } = getImageDimensions(sigInfo.bytes, sigInfo.mimeType);
                          const dims = calculateConstrainedDimensions(natW, natH, 120, 35);
                          return new Paragraph({
                            alignment: AlignmentType.CENTER,
                            spacing: { before: 0, after: 0 },
                            children: [
                              new ImageRun({
                                data: sigInfo.bytes,
                                type: sigInfo.extension === 'jpeg' ? 'jpg' : 'png',
                                transformation: {
                                  width: dims.widthPx,
                                  height: dims.heightPx,
                                },
                              }),
                              new TextRun({ text: "\nFirma Funcionario Responsable", size: 13, font: "Calibri" })
                            ]
                          });
                        }
                        return new Paragraph({ 
                          spacing: { before: 40, after: 40 },
                          children: [new TextRun({ text: "Firma:\n\n\n__________________________________", bold: true, size: 16, font: "Calibri" })] 
                        });
                      })()
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 100 } }),

          // Section 3: Persona que recibe la citación
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  new TableCell({
                    columnSpan: 3,
                    shading: { fill: "E6E6E6", type: ShadingType.CLEAR },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [new Paragraph({ children: [new TextRun({ text: "3. PERSONA QUE RECIBE LA CITACIÓN", bold: true, size: 18, font: "Calibri" })] })]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    width: { size: 50, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Nombres y Apellidos:\n", bold: true, size: 16, font: "Calibri" }), new TextRun({ text: "____________________________________", size: 16, font: "Calibri" })] })
                    ]
                  }),
                  new TableCell({
                    width: { size: 30, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Identificación:\n", bold: true, size: 16, font: "Calibri" }), new TextRun({ text: citation.identificacion || "________________________", size: 16, font: "Calibri" })] })
                    ]
                  }),
                  new TableCell({
                    rowSpan: 3,
                    width: { size: 20, type: WidthType.PERCENTAGE },
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                          new TextRun({ text: "\n\n\n\n\nHuella índice derecho", size: 14, italics: true, font: "Calibri" })
                        ]
                      })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Dirección: ", bold: true, size: 16, font: "Calibri" }), new TextRun({ text: citation.direccion || "________________________", size: 16, font: "Calibri" }), new TextRun({ text: "\nTeléfono: ", bold: true, size: 16, font: "Calibri" }), new TextRun({ text: citation.telefono || "________________________", size: 16, font: "Calibri" })] })
                    ]
                  }),
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Firma:\n\n______________________", bold: true, size: 16, font: "Calibri" })] })
                    ]
                  })
                ]
              }),
              new TableRow({
                children: [
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Fecha que recibe la citación:\n", bold: true, size: 16, font: "Calibri" }), new TextRun({ text: "_____ / _____ / ________", size: 16, font: "Calibri" })] })
                    ]
                  }),
                  new TableCell({
                    borders: { top: blackBorder, bottom: blackBorder, left: blackBorder, right: blackBorder },
                    children: [
                      new Paragraph({ children: [new TextRun({ text: "Hora que recibe la citación:\n", bold: true, size: 16, font: "Calibri" }), new TextRun({ text: "____ : ____ AM/PM", size: 16, font: "Calibri" })] })
                    ]
                  })
                ]
              })
            ]
          }),

          new Paragraph({ text: "", spacing: { after: 150 } }),

          // Footer Legal Disclaimer
          new Paragraph({
            spacing: { before: 100, after: 100 },
            children: [
              new TextRun({ text: "El servidor de policía judicial, está obligado en todo tiempo a garantizar la reserva de la información, esto conforme a las disposiciones establecidas en la Constitución y la Ley.", size: 15, italics: true, font: "Calibri" })
            ]
          }),

          new Paragraph({
            alignment: AlignmentType.RIGHT,
            children: [
              new TextRun({ text: "Versión: 01 | Aprobación: 2018-09-06 CPJ | Publicación: 2018-12-27 | Página 1 de 1", size: 14, color: "666666", font: "Calibri" })
            ]
          })
        ]
      }
    ]
  });

  return await Packer.toBlob(doc);
}

function prepareRawOfficialTemplate(zip: PizZip): PizZip {
  try {
    const docFile = zip.file('word/document.xml');
    if (!docFile) return zip;
    let xml = docFile.asText();

    // Only transform if it has not already been tagged with {NOMBRE}
    if (!xml.includes('{NOMBRE}') && !xml.includes('{nombre}')) {
      // 1. Table 0 (NUNC digits)
      const t0Match = xml.match(/<w:tbl[\s\S]*?<\/w:tbl>/);
      if (t0Match) {
        let t0 = t0Match[0];
        const rows = t0.match(/<w:tr[\s\S]*?<\/w:tr>/g);
        if (rows && rows.length >= 2) {
          let r1 = rows[1];
          const cells = r1.match(/<w:tc[\s\S]*?<\/w:tc>/g);
          if (cells && cells.length === 35) {
            let newR1 = r1;
            for (let i = 14; i <= 34; i++) {
              const digitIndex = i - 14;
              const oldCell = cells[i];
              const newCell = oldCell.replace(
                /<\/w:pPr>[\s\S]*?<\/w:p>/,
                `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{NUNC_${digitIndex}}</w:t></w:r></w:p>`
              );
              newR1 = newR1.replace(oldCell, newCell);
            }
            t0 = t0.replace(r1, newR1);
            xml = xml.replace(t0Match[0], t0);
          }
        }
      }

      // 2. Table 1 (Encabezado FPJ-35)
      const allTables = xml.split('</w:tbl>');
      if (allTables.length > 1) {
        let t1 = allTables[1];
        const rows = t1.match(/<w:tr[\s\S]*?<\/w:tr>/g);
        if (rows && rows.length >= 2) {
          let r1 = rows[1];
          const cells = r1.match(/<w:tc[\s\S]*?<\/w:tc>/g);
          if (cells && cells.length === 13) {
            let c1 = cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{DEPARTAMENTO}</w:t></w:r></w:p>`);
            let c3 = cells[3].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{MUNICIPIO}</w:t></w:r></w:p>`);
            let c5 = cells[5].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{FECHA_EXP_ANO}</w:t></w:r></w:p>`);
            let c6 = cells[6].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{FECHA_EXP_MES}</w:t></w:r></w:p>`);
            let c7 = cells[7].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{FECHA_EXP_DIA}</w:t></w:r></w:p>`);
            let c9 = cells[9].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{HORA_EXP_H1}</w:t></w:r></w:p>`);
            let c10 = cells[10].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{HORA_EXP_H2}</w:t></w:r></w:p>`);
            let c11 = cells[11].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{HORA_EXP_M1}</w:t></w:r></w:p>`);
            let c12 = cells[12].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="16"/><w:szCs w:val="14"/></w:rPr><w:t>{HORA_EXP_M2}</w:t></w:r></w:p>`);

            let newR1 = r1.replace(cells[1], c1)
                          .replace(cells[3], c3)
                          .replace(cells[5], c5)
                          .replace(cells[6], c6)
                          .replace(cells[7], c7)
                          .replace(cells[9], c9)
                          .replace(cells[10], c10)
                          .replace(cells[11], c11)
                          .replace(cells[12], c12);
            xml = xml.replace(r1, newR1);
          }
        }
      }

      // 3. Table 2 (Destinatario)
      const table2Match = xml.match(/<w:tr[\s\S]*?Señor \(a\)[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?Dirección[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?Correo electrónico[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?Ciudad[\s\S]*?<\/w:tr>/);
      if (table2Match) {
        let t2 = table2Match[0];
        const rows = t2.match(/<w:tr[\s\S]*?<\/w:tr>/g);
        if (rows && rows.length >= 4) {
          let r0 = rows[0];
          const r0cells = r0.match(/<w:tc[\s\S]*?<\/w:tc>/g);
          if (r0cells && r0cells.length >= 2) {
            let newCell = r0cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="20"/><w:szCs w:val="18"/></w:rPr><w:t>{NOMBRE}</w:t></w:r></w:p>`);
            t2 = t2.replace(r0, r0.replace(r0cells[1], newCell));
          }

          let r1 = rows[1];
          const r1cells = r1.match(/<w:tc[\s\S]*?<\/w:tc>/g);
          if (r1cells && r1cells.length >= 2) {
            let newCell = r1cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{DIRECCION}</w:t></w:r></w:p>`);
            t2 = t2.replace(r1, r1.replace(r1cells[1], newCell));
          }

          let r2 = rows[2];
          const r2cells = r2.match(/<w:tc[\s\S]*?<\/w:tc>/g);
          if (r2cells && r2cells.length >= 2) {
            let newCell = r2cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{CORREO}</w:t></w:r></w:p>`);
            t2 = t2.replace(r2, r2.replace(r2cells[1], newCell));
          }

          let r3 = rows[3];
          const r3cells = r3.match(/<w:tc[\s\S]*?<\/w:tc>/g);
          if (r3cells && r3cells.length >= 2) {
            let newCell = r3cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{CIUDAD_Y_TELEFONO}</w:t></w:r></w:p>`);
            t2 = t2.replace(r3, r3.replace(r3cells[1], newCell));
          }

          xml = xml.replace(table2Match[0], t2);
        }
      }

      // 4. Table 3 (Paragraph comparecencia - unificado en {MOTIVO_CITACION})
      const pCompareceMatch = xml.match(/<w:p [^>]*>[^<]*<w:pPr>[\s\S]*?Se solicita comparece[\s\S]*?<\/w:p>/);
      if (pCompareceMatch) {
        const oldP = pCompareceMatch[0];
        const pPrMatch = oldP.match(/<w:pPr>[\s\S]*?<\/w:pPr>/);
        const pPr = pPrMatch ? pPrMatch[0] : '<w:pPr><w:ind w:left="328"/></w:pPr>';
        const newP = `<w:p w:rsidR="005378B2" w:rsidRDefault="005378B2">${pPr}<w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="22"/><w:szCs w:val="16"/></w:rPr><w:t>{MOTIVO_CITACION}</w:t></w:r></w:p>`;
        xml = xml.replace(oldP, newP);
      }

      // 5. Table 4 (Debe asistir con abogado SI / NO)
      const t4Match = xml.match(/<w:tr[\s\S]*?Debe asistir con abogado[\s\S]*?<\/w:tr>/);
      if (t4Match) {
        let r = t4Match[0];
        const cells = r.match(/<w:tc[\s\S]*?<\/w:tc>/g);
        if (cells && cells.length >= 5) {
          let c2 = cells[2].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="22"/><w:szCs w:val="16"/></w:rPr><w:t>{REQUIERE_SI}</w:t></w:r></w:p>`);
          let c4 = cells[4].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="22"/><w:szCs w:val="16"/></w:rPr><w:t>{REQUIERE_NO}</w:t></w:r></w:p>`);
          let newR = r.replace(cells[2], c2).replace(cells[4], c4);
          xml = xml.replace(r, newR);
        }
      }

      // 6. Table 6 (OBSERVACIONES)
      const t6Match = xml.match(/<w:tr[\s\S]*?OBSERVACIONES[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?<\/w:tr>/);
      if (t6Match) {
        let t6 = t6Match[0];
        const rows = t6.match(/<w:tr[\s\S]*?<\/w:tr>/g);
        if (rows && rows.length >= 2) {
          let r1 = rows[1];
          const cells = r1.match(/<w:tc[\s\S]*?<\/w:tc>/g);
          if (cells && cells.length >= 1) {
            let newCell = cells[0].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{OBSERVACIONES}</w:t></w:r></w:p>`);
            t6 = t6.replace(r1, r1.replace(cells[0], newCell));
            xml = xml.replace(t6Match[0], t6);
          }
        }
      }

      // 7. Table 7 (PERSONA QUE REALIZA LA CITACIÓN)
      const t7Match = xml.match(/<w:tr[\s\S]*?PERSONA QUE REALIZA LA CITACI Ó N[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?Nombres y Apellidos[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?Correo Electrónico[\s\S]*?<\/w:tr>[\s\S]*?<w:tr[\s\S]*?<\/w:tr>/);
      if (t7Match) {
        let t7 = t7Match[0];
        const rows = t7.match(/<w:tr[\s\S]*?<\/w:tr>/g);
        if (rows && rows.length >= 5) {
          let r2 = rows[2];
          const r2cells = r2.match(/<w:tc[\s\S]*?<\/w:tc>/g);
          if (r2cells && r2cells.length >= 3) {
            let c0 = r2cells[0].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:b/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{INVESTIGADOR}</w:t></w:r></w:p>`);
            let c1 = r2cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{ENTIDAD_INVESTIGADOR}</w:t></w:r></w:p>`);
            let c2 = r2cells[2].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{UNIDAD}</w:t></w:r></w:p>`);
            t7 = t7.replace(r2, r2.replace(r2cells[0], c0).replace(r2cells[1], c1).replace(r2cells[2], c2));
          }

          let r4 = rows[4];
          const r4cells = r4.match(/<w:tc[\s\S]*?<\/w:tc>/g);
          if (r4cells && r4cells.length >= 1) {
            let c0 = r4cells[0].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{CORREO_INVESTIGADOR}</w:t></w:r></w:p>`);
            if (r4cells.length >= 2 && !r4cells[1].includes('{FIRMA}') && !r4cells[1].includes('{firma}')) {
              let c1 = r4cells[1].replace(/<\/w:pPr>[\s\S]*?<\/w:p>/, `</w:pPr><w:r><w:rPr><w:rFonts w:eastAsia="Tahoma" w:cs="Arial"/><w:sz w:val="18"/><w:szCs w:val="16"/></w:rPr><w:t>{FIRMA}</w:t></w:r></w:p>`);
              t7 = t7.replace(r4, r4.replace(r4cells[0], c0).replace(r4cells[1], c1));
            } else {
              t7 = t7.replace(r4, r4.replace(r4cells[0], c0));
            }
          }

          xml = xml.replace(t7Match[0], t7);
        }
      }

      zip.file('word/document.xml', xml);
    }
  } catch (err) {
    console.warn("Could not pre-process raw FPJ-35 template, continuing with raw zip:", err);
  }
  return zip;
}

export async function generateCitationFromTemplate(
  citation: CitationData,
  customTemplateBuffer?: ArrayBuffer
): Promise<Blob> {
  try {
    let content: ArrayBuffer;
    if (customTemplateBuffer) {
      content = customTemplateBuffer;
    } else {
      const response = await fetch('/PLANTILLA CITACION.docx');
      if (!response.ok) {
        throw new Error(`No se pudo cargar la plantilla base (${response.statusText})`);
      }
      content = await response.arrayBuffer();
    }

    let zip = new PizZip(content);
    zip = prepareRawOfficialTemplate(zip);

    // Limpiar etiquetas de Word partidas o afectadas por revisión ortográfica
    let docXml = zip.file('word/document.xml')?.asText() || '';
    docXml = cleanWordXmlTags(docXml);
    zip.file('word/document.xml', docXml);

    // Procesar firma del investigador si está presente
    const sigInfo = parseSignatureImage(citation.firmaInvestigador);
    const signaturePlaceholder = '___FIRMA_INVESTIGADOR_IMG___';

    if (sigInfo) {
      // 1. Guardar la imagen en word/media/
      zip.file(`word/media/firma_investigador.${sigInfo.extension}`, sigInfo.bytes);

      // 2. Registrar relación en word/_rels/document.xml.rels si no existe
      let rels = zip.file('word/_rels/document.xml.rels')?.asText() || '';
      if (!rels.includes('firma_investigador')) {
        rels = rels.replace('</Relationships>', `<Relationship Id="rIdSig" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="media/firma_investigador.${sigInfo.extension}"/></Relationships>`);
        zip.file('word/_rels/document.xml.rels', rels);
      }

      // 3. Registrar extensión en [Content_Types].xml si no existe
      let contentTypes = zip.file('[Content_Types].xml')?.asText() || '';
      if (!contentTypes.includes(`Extension="${sigInfo.extension}"`)) {
        contentTypes = contentTypes.replace('</Types>', `<Default Extension="${sigInfo.extension}" ContentType="${sigInfo.mimeType}"/></Types>`);
        zip.file('[Content_Types].xml', contentTypes);
      }
    }

    const doc = new Docxtemplater(zip, {
      paragraphLoop: true,
      linebreaks: true,
      delimiters: { start: '{', end: '}' }
    });

    const nunc = (citation.nunc || citation.orden || '000000000000000000000').padStart(21, '0').slice(0, 21);
    const nuncDigits = nunc.split('');

    const hasCC = Boolean(citation.identificacion && citation.identificacion.trim());
    const rawNombre = (citation.nombre || '').toUpperCase();
    const nombreFormatted = hasCC ? `${rawNombre} con CC ${citation.identificacion!.trim()}` : rawNombre;

    const expDate = citation.fechaExpedicion || citation.fecha || new Date().toISOString().split('T')[0];
    const expParts = expDate.split('-');
    const expAno = expParts[0] || '2026';
    const expMes = expParts[1] || '01';
    const expDia = expParts[2] || '01';

    const expTime = (citation.horaExpedicion || citation.hora || new Date().toTimeString().slice(0, 5)).replace(/[^0-9]/g, '').padEnd(4, '0');
    const h1 = expTime[0] || '0';
    const h2 = expTime[1] || '0';
    const m1 = expTime[2] || '0';
    const m2 = expTime[3] || '0';

    const reqAbogadoUpper = (citation.requiereAbogado || 'NO').toUpperCase();
    const requiereSi = reqAbogadoUpper === 'SI' ? 'X' : '';
    const requiereNo = reqAbogadoUpper === 'NO' ? 'X' : '';

    const ciudad = citation.ciudad || citation.municipio || 'Cartagena';
    const telefono = citation.telefono || '';
    const ciudadYTelefono = telefono ? `${ciudad} - Tel: ${telefono}` : ciudad;

    const fechaComparecenciaTexto = formatDateFull(citation.fecha);
    const horaComparecenciaTexto = formatTime12H(citation.hora);
    const instalacionesTexto = citation.instalaciones || 'las instalaciones de la Fiscalía General de la Nación';
    const direccionInstalacionesTexto = citation.direccionInstalaciones?.trim();
    const motivoTexto = cleanDiligenciaMotivo(citation.motivo);
    const delitoTexto = citation.delito?.trim();

    // Generar el párrafo unificado oficial que engloba fecha, hora, lugar, dirección, motivo y delito
    const motivoCitacionParrafo = direccionInstalacionesTexto
      ? `Se solicita comparecer el próximo ${fechaComparecenciaTexto} a las ${horaComparecenciaTexto}, en las instalaciones de ${instalacionesTexto}, ubicadas en la ${direccionInstalacionesTexto} para ${motivoTexto}, dentro del proceso de la referencia.${delitoTexto ? ` (${delitoTexto})` : ''}`
      : `Se solicita comparecer el próximo ${fechaComparecenciaTexto} a las ${horaComparecenciaTexto}, en las instalaciones de ${instalacionesTexto} para ${motivoTexto}, dentro del proceso de la referencia.${delitoTexto ? ` (${delitoTexto})` : ''}`;

    const motivoPlaceholder = '___MOTIVO_CITACION_RUNS___';

    // Generar los TextRuns OpenXML con los datos obtenidos de campos en negrita y subrayados
    const formattedMotivoRuns = [
      makeNormalRun('Se solicita comparecer el próximo '),
      makeBoldUnderlineRun(fechaComparecenciaTexto),
      makeNormalRun(' a las '),
      makeBoldUnderlineRun(horaComparecenciaTexto),
      makeNormalRun(', en las instalaciones de '),
      makeBoldUnderlineRun(instalacionesTexto),
      ...(direccionInstalacionesTexto ? [
        makeNormalRun(', ubicadas en la '),
        makeBoldUnderlineRun(direccionInstalacionesTexto)
      ] : []),
      makeNormalRun(' para '),
      makeBoldUnderlineRun(motivoTexto),
      makeNormalRun(', dentro del proceso de la referencia.'),
      ...(delitoTexto ? [
        makeNormalRun(' ('),
        makeBoldUnderlineRun(delitoTexto),
        makeNormalRun(')')
      ] : [])
    ].join('');

    const templateData: Record<string, string> = {
      NUNC: nunc,
      nunc: nunc,
      ORDEN: citation.orden || '',
      orden: citation.orden || '',
      DEPARTAMENTO: citation.departamento || 'Bolívar',
      departamento: citation.departamento || 'Bolívar',
      MUNICIPIO: citation.municipio || 'Cartagena',
      municipio: citation.municipio || 'Cartagena',
      FECHA_EXPEDICION: expDate,
      fechaExpedicion: expDate,
      FECHA_EXP_ANO: expAno,
      FECHA_EXP_MES: expMes,
      FECHA_EXP_DIA: expDia,
      HORA_EXPEDICION: citation.horaExpedicion || citation.hora || new Date().toTimeString().slice(0, 5),
      horaExpedicion: citation.horaExpedicion || citation.hora || new Date().toTimeString().slice(0, 5),
      HORA_EXP_H1: h1,
      HORA_EXP_H2: h2,
      HORA_EXP_M1: m1,
      HORA_EXP_M2: m2,
      NOMBRE: nombreFormatted,
      nombre: nombreFormatted,
      IDENTIFICACION: citation.identificacion?.trim() || '',
      identificacion: citation.identificacion?.trim() || '',
      DIRECCION: citation.direccion || 'No registrada',
      direccion: citation.direccion || 'No registrada',
      CORREO: citation.correo || 'No registrado',
      correo: citation.correo || 'No registrado',
      TELEFONO: telefono || 'No registrado',
      telefono: telefono || 'No registrado',
      CIUDAD: ciudad,
      ciudad: ciudad,
      CIUDAD_Y_TELEFONO: ciudadYTelefono,
      ciudad_y_telefono: ciudadYTelefono,
      FECHA: citation.fecha || '',
      fecha: citation.fecha || '',
      HORA: citation.hora || '',
      hora: citation.hora || '',
      // Clave unificada solicitada para englobar todos los campos de este párrafo (con campos en negrita y subrayados)
      MOTIVO_CITACION: motivoPlaceholder,
      motivo_citacion: motivoPlaceholder,
      PARRAFO_CITACION: motivoPlaceholder,
      parrafo_citacion: motivoPlaceholder,
      TEXTO_CITACION: motivoPlaceholder,
      texto_citacion: motivoPlaceholder,
      COMPARECENCIA: motivoPlaceholder,
      comparecencia: motivoPlaceholder,
      MOTIVO_CITACION_PLANO: motivoCitacionParrafo,
      motivo_citacion_plano: motivoCitacionParrafo,
      // Campos individuales preservados
      FECHA_COMPARECENCIA: fechaComparecenciaTexto,
      fechaComparecencia: fechaComparecenciaTexto,
      HORA_COMPARECENCIA: horaComparecenciaTexto,
      horaComparecencia: horaComparecenciaTexto,
      INSTALACIONES: instalacionesTexto,
      instalaciones: instalacionesTexto,
      DIRECCION_INSTALACIONES: citation.direccionInstalaciones || '',
      direccionInstalaciones: citation.direccionInstalaciones || '',
      MOTIVO: motivoTexto,
      motivo: motivoTexto,
      REQUIERE_ABOGADO: citation.requiereAbogado || 'NO',
      requiereAbogado: citation.requiereAbogado || 'NO',
      REQUIERE_SI: requiereSi,
      requiere_si: requiereSi,
      REQUIERE_NO: requiereNo,
      requiere_no: requiereNo,
      OBSERVACIONES: citation.observaciones || 'Presentar documento de identidad original.',
      observaciones: citation.observaciones || 'Presentar documento de identidad original.',
      FISCAL: citation.fiscal || '17 Local',
      fiscal: citation.fiscal || '17 Local',
      DELITO: citation.delito || '',
      delito: citation.delito || '',
      UNIDAD: citation.unidad || 'Unidad de Administración Pública',
      unidad: citation.unidad || 'Unidad de Administración Pública',
      INVESTIGADOR: citation.investigador || 'Servidor de Policía Judicial',
      investigador: citation.investigador || 'Servidor de Policía Judicial',
      CARGO: 'Investigador de Policía Judicial',
      cargo: 'Investigador de Policía Judicial',
      ENTIDAD_INVESTIGADOR: citation.entidadInvestigador || 'CTI - Fiscalía General de la Nación',
      entidadInvestigador: citation.entidadInvestigador || 'CTI - Fiscalía General de la Nación',
      GRUPO_INVESTIGADOR: citation.grupoInvestigador || 'Grupo de Delitos Contra la Administración Pública',
      grupoInvestigador: citation.grupoInvestigador || 'Grupo de Delitos Contra la Administración Pública',
      CORREO_INVESTIGADOR: citation.correoInvestigador || '',
      correoInvestigador: citation.correoInvestigador || '',
      TELEFONO_INVESTIGADOR: citation.telefonoInvestigador || '',
      telefonoInvestigador: citation.telefonoInvestigador || '',
      // Clave para la firma del investigador en la plantilla
      FIRMA: sigInfo ? signaturePlaceholder : '',
      firma: sigInfo ? signaturePlaceholder : '',
      FIRMA_INVESTIGADOR: sigInfo ? signaturePlaceholder : '',
      firma_investigador: sigInfo ? signaturePlaceholder : ''
    };

    // Add individual NUNC digits for templates with box grids (0 to 20 and 1 to 21)
    for (let i = 0; i < 21; i++) {
      templateData[`NUNC_${i}`] = nuncDigits[i] || '';
      templateData[`nunc_${i}`] = nuncDigits[i] || '';
      templateData[`NUNC_${i + 1}`] = nuncDigits[i] || '';
      templateData[`nunc_${i + 1}`] = nuncDigits[i] || '';
    }

    doc.render(templateData);

    let renderedXml = doc.getZip().file('word/document.xml')?.asText() || '';

    // Reemplazar marcador de motivo de citación por los TextRuns con los campos en negrita y subrayados
    renderedXml = replacePlaceholderWithRuns(renderedXml, motivoPlaceholder, formattedMotivoRuns);

    // Si hay firma, reemplazar el marcador de posición por el elemento Drawing XML de OpenXML
    if (sigInfo) {
      const { width: natW, height: natH } = getImageDimensions(sigInfo.bytes, sigInfo.mimeType);
      const dims = calculateConstrainedDimensions(natW, natH, 120, 35);
      const drawingXml = `<w:r><w:rPr><w:noProof/></w:rPr><w:drawing><wp:inline distT="0" distB="0" distL="0" distR="0"><wp:extent cx="${dims.cxEmu}" cy="${dims.cyEmu}"/><wp:effectExtent l="0" t="0" r="0" b="0"/><wp:docPr id="9999" name="Firma Investigador"/><wp:cNvGraphicFramePr><a:graphicFrameLocks xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" noChangeAspect="1"/></wp:cNvGraphicFramePr><a:graphic xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:pic xmlns:pic="http://schemas.openxmlformats.org/drawingml/2006/picture"><pic:nvPicPr><pic:cNvPr id="0" name="firma.${sigInfo.extension}"/><pic:cNvPicPr/></pic:nvPicPr><pic:blipFill><a:blip r:embed="rIdSig" cstate="print"/><a:stretch><a:fillRect/></a:stretch></pic:blipFill><pic:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="${dims.cxEmu}" cy="${dims.cyEmu}"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></pic:spPr></pic:pic></a:graphicData></a:graphic></wp:inline></w:drawing></w:r>`;

      renderedXml = replacePlaceholderWithRuns(renderedXml, signaturePlaceholder, drawingXml);
    }

    doc.getZip().file('word/document.xml', renderedXml);

    const out = doc.getZip().generate({
      type: 'blob',
      mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });

    return out;
  } catch (error) {
    console.error("Error al procesar plantilla DOCX con docxtemplater:", error);
    // Intentar fallback sólo si la plantilla falla catastróficamente
    return await generateFPJ35WordDocument(citation);
  }
}

export function downloadWordDocument(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
