import React, { useState, useRef, useMemo } from 'react';
import { 
  FileSpreadsheet, 
  Plus, 
  Trash2, 
  Upload, 
  Download, 
  Sparkles, 
  ChevronDown, 
  ArrowLeft,
  ClipboardPaste,
  AlertCircle,
  CheckCircle2,
  Clock,
  RotateCcw,
  CheckCheck,
  Edit3,
  Eye,
  X,
  LayoutList,
  Table as TableIcon
} from 'lucide-react';
import * as XLSX from 'xlsx';
import Swal from 'sweetalert2';
import { ExcelInsumoRow } from '../types';

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

export const parseExcelDate = (val: any): string => {
  if (val === null || val === undefined) {
    return '';
  }
  const str = String(val).trim();
  if (!str) {
    return '';
  }

  // ISO date YYYY-MM-DD
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2].padStart(2, '0')}-${isoMatch[3].padStart(2, '0')}`;
  }

  // DD/MM/YYYY or DD-MM-YYYY or DD.MM.YYYY
  const dmyMatch = str.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/);
  if (dmyMatch) {
    let day = dmyMatch[1].padStart(2, '0');
    let month = dmyMatch[2].padStart(2, '0');
    let year = dmyMatch[3];
    if (year.length === 2) {
      year = '20' + year;
    }
    // Swap if month > 12 and day <= 12
    if (parseInt(month, 10) > 12 && parseInt(day, 10) <= 12) {
      const temp = day;
      day = month;
      month = temp;
    }
    return `${year}-${month}-${day}`;
  }

  // DD de [Mes] de YYYY or DD-[Mes]-YYYY or DD/[Mes]/YYYY
  const textMatch = str.match(/^(\d{1,2})\s*(?:de|\-|\/)\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)\s*(?:de|\-|\/)?\s*(\d{2,4})/i);
  if (textMatch) {
    let day = textMatch[1].padStart(2, '0');
    let monthName = textMatch[2].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    let year = textMatch[3];
    if (year.length === 2) year = '20' + year;
    const month = SPANISH_MONTHS[monthName.slice(0, 3)] || SPANISH_MONTHS[monthName];
    if (month) {
      return `${year}-${month}-${day}`;
    }
  }

  // YYYY/MM/DD or YYYY.MM.DD
  const ymdMatch = str.match(/^(\d{4})[\/\.](\d{1,2})[\/\.](\d{1,2})/);
  if (ymdMatch) {
    const year = ymdMatch[1];
    const month = ymdMatch[2].padStart(2, '0');
    const day = ymdMatch[3].padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Excel serial number (numeric, e.g. 45397)
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

  return str;
};

export const parseExcelTime = (val: any): string => {
  if (val === null || val === undefined) return '';
  const str = String(val).trim();
  if (!str) return '';

  // Format 08:30 AM or 8:30 PM
  const ampmMatch = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM|am|pm)$/i);
  if (ampmMatch) {
    const hh = ampmMatch[1].padStart(2, '0');
    const mm = ampmMatch[2];
    const ampm = ampmMatch[3].toUpperCase();
    return `${hh}:${mm} ${ampm}`;
  }

  // 24-hour time 14:30 or 14:30:00 or 8:30
  const time24Match = str.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (time24Match) {
    let hour = parseInt(time24Match[1], 10);
    const minute = time24Match[2];
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${String(hour).padStart(2, '0')}:${minute} ${ampm}`;
  }

  // Decimal Excel time fraction
  if (/^0\.\d+$/.test(str)) {
    const totalSeconds = Math.round(parseFloat(str) * 24 * 3600);
    let hour = Math.floor(totalSeconds / 3600);
    const minute = Math.floor((totalSeconds % 3600) / 60);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12;
    if (hour === 0) hour = 12;
    return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')} ${ampm}`;
  }

  return str;
};

// Funciones inteligentes de detección de encabezados y mapeo de columnas
export const isHeaderCell = (cellVal: any): string | null => {
  if (cellVal === null || cellVal === undefined) return null;
  const str = String(cellVal).trim();
  if (!str) return null;
  
  // Normalizar acentos y mayúsculas
  const norm = str.toUpperCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();

  // Descartar inmediatamente si parece un dato evidente (número de 8+ dígitos, correo, fecha, hora)
  if (norm.includes('@') && norm.includes('.')) return null;
  if (/^\d{8,25}$/.test(norm)) return null;
  if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(norm)) return null;
  if (/^\d{1,2}:\d{2}/.test(norm)) return null;

  if (/^(OT|ORDEN\s*(DE)?\s*TRABAJO|O\.T\.)$/i.test(norm)) return 'ot';
  if (/^(OPJ|POLICIA(\s*JUDICIAL)?|O\.P\.J\.|ORDEN\s*POLICIA)$/i.test(norm)) return 'opj';
  if (/^(NUNC|NOTICIA(\s*CRIMINAL)?|SPOA|RADICADO(\s*INTERNO)?|NOTICIA)$/i.test(norm)) return 'nunc';
  if (/^(FISCAL|DESPACHO|UNIDAD(\s*RECEPTORA)?|FISCALIA)$/i.test(norm)) return 'fiscal';
  if (/^(DELITO|CONDUCTA|PUNITIVA|TIPO\s*PENAL|HECHO|DELITOS)$/i.test(norm)) return 'delito';
  if (/^(NOMBRE(S)?|CITADO|PERSONA|NOMBRE\s*COMPLETO|PARTICIPANTE|DATOS\s*CITADO)$/i.test(norm)) return 'nombre';
  if (/^(CEDULA|IDENTIFICACION|DOCUMENTO|C\.?C\.?|NRO\s*IDENTIFICACION|NUMERO\s*DOCUMENTO)$/i.test(norm)) return 'cedula';
  if (/^(DIRECCION|DOMICILIO|RESIDENCIA|UBICACION|DIRECCION\s*RESIDENCIA)$/i.test(norm)) return 'direccion';
  if (/^(TELEFONO|CELULAR|WHATSAPP|TEL|MOVIL|NUMERO\s*TELEFONICO|CONTACTO)$/i.test(norm)) return 'telefono';
  if (/^(CORREO|EMAIL|E-MAIL|MAIL|CORREO\s*ELECTRONICO)$/i.test(norm)) return 'correo';
  if (/^(FECHA|DIA|FECHA\s*(DE)?\s*(CITACION|AUDIENCIA|ENTREVISTA))$/i.test(norm)) return 'fecha';
  if (/^(HORA|HORARIO|TIEMPO|HORA\s*(DE)?\s*(CITACION|AUDIENCIA))$/i.test(norm)) return 'hora';

  return null;
};

export const detectIfHeaderRow = (rowCells: any[]): { isHeader: boolean; colMap: Record<string, number> } => {
  const defaultColMap: Record<string, number> = {
    ot: 0,
    opj: 1,
    nunc: 2,
    fiscal: 3,
    delito: 4,
    nombre: 5,
    cedula: 6,
    direccion: 7,
    telefono: 8,
    correo: 9,
    fecha: 10,
    hora: 11
  };

  if (!Array.isArray(rowCells) || rowCells.length === 0) {
    return { isHeader: false, colMap: defaultColMap };
  }

  const detectedColMap: Record<string, number> = { ...defaultColMap };
  let headerMatchCount = 0;

  // Comprobar si hay indicadores inequívocos de datos en la fila
  const hasStrongDataIndicator = rowCells.some(cell => {
    if (cell === null || cell === undefined) return false;
    const s = String(cell).trim();
    if (s.includes('@') && s.includes('.')) return true;
    if (/^\d{8,25}$/.test(s)) return true; // Cédula o NUNC numérico
    if (/^\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/.test(s)) return true; // Fecha
    if (/^\d{1,2}:\d{2}/.test(s)) return true; // Hora
    return false;
  });

  if (hasStrongDataIndicator) {
    return { isHeader: false, colMap: defaultColMap };
  }

  rowCells.forEach((cell, idx) => {
    const matchedType = isHeaderCell(cell);
    if (matchedType) {
      detectedColMap[matchedType] = idx;
      headerMatchCount++;
    }
  });

  // Solo consideramos que es encabezado si coinciden al menos 2 nombres de columna y no hay datos numéricos o fechas
  if (headerMatchCount >= 2) {
    return { isHeader: true, colMap: detectedColMap };
  }

  return { isHeader: false, colMap: defaultColMap };
};

interface ExcelMatrixViewProps {
  rows: ExcelInsumoRow[];
  onRowsChange: (rows: ExcelInsumoRow[]) => void;
  onGenerateCitations: () => void;
  onBack: () => void;
}

export const createEmptyRow = (): ExcelInsumoRow => ({
  id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  ot: '',
  opj: '',
  nunc: '',
  fiscal: '',
  delito: '',
  nombre: '',
  cedula: '',
  direccion: '',
  telefono: '',
  correo: '',
  fecha: '',
  hora: '',
  generada: false
});

export const SAMPLE_EXCEL_ROWS: ExcelInsumoRow[] = [];

export const ExcelMatrixView: React.FC<ExcelMatrixViewProps> = ({
  rows,
  onRowsChange,
  onGenerateCitations,
  onBack
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPasteModalOpen, setIsPasteModalOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [filterTab, setFilterTab] = useState<'todas' | 'pendientes' | 'generadas'>('todas');
  const [mobileViewMode, setMobileViewMode] = useState<'cards' | 'table'>('cards');
  const [editingRowMobile, setEditingRowMobile] = useState<ExcelInsumoRow | null>(null);

  const pendingRows = useMemo(() => rows.filter(r => !r.generada), [rows]);
  const generatedRows = useMemo(() => rows.filter(r => r.generada), [rows]);

  const visibleRows = useMemo(() => {
    if (filterTab === 'pendientes') return pendingRows;
    if (filterTab === 'generadas') return generatedRows;
    return rows;
  }, [rows, filterTab, pendingRows, generatedRows]);

  const updateCell = (id: string, field: keyof ExcelInsumoRow, value: any) => {
    onRowsChange(rows.map(row => row.id === id ? { ...row, [field]: value } : row));
  };

  const toggleGenerada = (id: string) => {
    onRowsChange(rows.map(row => {
      if (row.id === id) {
        const nextState = !row.generada;
        return {
          ...row,
          generada: nextState,
          fechaGeneracion: nextState ? new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : undefined
        };
      }
      return row;
    }));
  };

  const addRow = () => {
    onRowsChange([...rows, createEmptyRow()]);
  };

  const removeRow = async (id: string, nombre?: string) => {
    const result = await Swal.fire({
      position: 'center',
      title: '¿Eliminar fila?',
      text: nombre ? `¿Desea eliminar la fila de "${nombre}"?` : '¿Desea eliminar esta fila de la hoja de cálculo?',
      icon: 'warning',
      iconColor: '#dc2626',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      onRowsChange(rows.filter(r => r.id !== id));
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        iconColor: '#16a34a',
        title: 'Fila eliminada de la tabla',
        showConfirmButton: false,
        timer: 2000,
        timerProgressBar: true
      });
    }
  };

  const clearAllRows = async () => {
    if (rows.length === 0) return;
    const result = await Swal.fire({
      position: 'center',
      title: '¿Limpiar toda la tabla?',
      text: 'Se eliminarán todas las filas cargadas en la hoja de cálculo.',
      icon: 'warning',
      iconColor: '#dc2626',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, limpiar tabla',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      onRowsChange([]);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        iconColor: '#16a34a',
        title: 'Tabla vaciada correctamente',
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true
      });
    }
  };

  const clearGeneratedOnly = async () => {
    if (generatedRows.length === 0) return;
    const result = await Swal.fire({
      position: 'center',
      title: '¿Eliminar filas ya generadas?',
      text: `Se eliminarán las ${generatedRows.length} filas marcadas como generadas, conservando las pendientes.`,
      icon: 'question',
      iconColor: '#dc2626',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar generadas',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });

    if (result.isConfirmed) {
      onRowsChange(pendingRows);
      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        iconColor: '#16a34a',
        title: `${generatedRows.length} filas generadas eliminadas`,
        showConfirmButton: false,
        timer: 2500,
        timerProgressBar: true
      });
    }
  };

  const markAllAsPending = async () => {
    if (rows.length === 0) return;
    onRowsChange(rows.map(r => ({ ...r, generada: false, fechaGeneracion: undefined })));
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      iconColor: '#16a34a',
      title: 'Todas las filas marcadas como Pendientes',
      showConfirmButton: false,
      timer: 2500,
      timerProgressBar: true
    });
  };

  // Validaciones estrictas para pegar datos del portapapeles
  const REQUIRED_COLUMNS_COUNT = 12;
  const EXPECTED_COLUMNS_NAMES = [
    '1. OT (Orden de Trabajo)',
    '2. OPJ (Orden de Policía Judicial)',
    '3. NUNC (Noticia Criminal - 21 dígitos)',
    '4. FISCAL (Despacho / Fiscalía)',
    '5. DELITO (Delito del Caso)',
    '6. NOMBRE (Nombre completo del citado)',
    '7. CEDULA (Documento de identidad)',
    '8. DIRECCION (Dirección de residencia / citación)',
    '9. TELEFONO (Teléfono o WhatsApp)',
    '10. CORREO (Correo electrónico)',
    '11. FECHA (Fecha de citación YYYY-MM-DD)',
    '12. HORA (Hora de citación)'
  ];

  const validateAndProcessPastedText = (rawString: string): boolean => {
    if (!rawString || !rawString.trim()) {
      Swal.fire({
        position: 'center',
        icon: 'error',
        iconColor: '#dc2626',
        title: '<span style="color: #dc2626; font-weight: 800; font-size: 1.25rem;">Portapapeles Vacío</span>',
        html: '<p style="color: #334155; font-size: 13px; margin: 0;">No se detectó contenido de texto en el portapapeles. Copie las celdas de su archivo Excel antes de pegar.</p>',
        confirmButtonColor: '#003366',
        confirmButtonText: 'Entendido'
      });
      return false;
    }

    const rawLines = rawString.trim().split(/\r?\n/).filter(line => line.trim().length > 0);
    if (rawLines.length === 0) {
      Swal.fire({
        position: 'center',
        icon: 'error',
        iconColor: '#dc2626',
        title: '<span style="color: #dc2626; font-weight: 800; font-size: 1.25rem;">Sin Contenido de Filas</span>',
        html: '<p style="color: #334155; font-size: 13px; margin: 0;">El texto del portapapeles no contiene líneas con información procesable.</p>',
        confirmButtonColor: '#003366',
        confirmButtonText: 'Entendido'
      });
      return false;
    }

    // Determinar delimitador (tabulador \t, punto y coma ;, o coma ,)
    const firstLine = rawLines[0];
    let delimiter = '\t';
    if (firstLine.includes('\t')) {
      delimiter = '\t';
    } else if (firstLine.includes(';')) {
      delimiter = ';';
    } else if (firstLine.includes(',')) {
      delimiter = ',';
    }

    // Dividir celdas de la primera fila y verificar si es encabezado o fila de datos
    let firstLineCols = firstLine.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
    const { isHeader, colMap } = detectIfHeaderRow(firstLineCols);
    const startIndex = isHeader ? 1 : 0;

    if (isHeader && startIndex >= rawLines.length) {
      Swal.fire({
        position: 'center',
        icon: 'error',
        iconColor: '#dc2626',
        title: '<span style="color: #dc2626; font-weight: 800; font-size: 1.25rem;">Solo Encabezados Detectados</span>',
        html: '<p style="color: #334155; font-size: 13px; margin: 0;">El contenido copiado incluye únicamente los nombres de columna. Seleccione y copie las filas con los datos de las personas a citar.</p>',
        confirmButtonColor: '#003366',
        confirmButtonText: 'Entendido'
      });
      return false;
    }

    const newRows: ExcelInsumoRow[] = [];
    let structuralError: string | null = null;

    for (let i = startIndex; i < rawLines.length; i++) {
      const line = rawLines[i];
      const rowDisplayNum = i + 1;

      let cols = line.split(delimiter).map(c => c.replace(/^["']|["']$/g, '').trim());
      if (cols.length === 1 && line.includes('\t')) cols = line.split('\t').map(c => c.replace(/^["']|["']$/g, '').trim());
      else if (cols.length === 1 && line.includes(';')) cols = line.split(';').map(c => c.replace(/^["']|["']$/g, '').trim());

      // Si la fila está totalmente vacía, se ignora
      if (cols.every(c => !c)) {
        continue;
      }

      // Si tiene menos de 5 columnas, no es una fila estructurada válida
      if (cols.length < 5) {
        structuralError = `La fila ${rowDisplayNum} contiene solo ${cols.length} columna(s). Se requieren las columnas de la tabla judicial.`;
        break;
      }

      const getCol = (idx: number) => (cols[idx] !== undefined && cols[idx] !== null ? String(cols[idx]).trim() : '');

      const ot = getCol(colMap.ot);
      const opj = getCol(colMap.opj);
      const nunc = getCol(colMap.nunc);
      const fiscal = getCol(colMap.fiscal);
      const delito = getCol(colMap.delito);
      const nombre = getCol(colMap.nombre);
      const cedula = getCol(colMap.cedula);
      const direccion = getCol(colMap.direccion);
      const telefono = getCol(colMap.telefono);
      const correo = getCol(colMap.correo);
      const rawFecha = getCol(colMap.fecha);
      const rawHora = getCol(colMap.hora);

      // Verificar que no sea una fila fantasma o sin ningún identificador
      if (!nombre && !opj && !ot && !nunc && !cedula && !direccion && !telefono && !correo && !delito) {
        structuralError = `La fila ${rowDisplayNum} no contiene datos de citación.`;
        break;
      }

      // Parsear fecha y hora respetando los datos exactos del usuario
      const fecha = rawFecha ? parseExcelDate(rawFecha) : '';
      
      let hora = rawHora ? parseExcelTime(rawHora) : '';
      if (!hora && rawFecha && /\d{1,2}:\d{2}/.test(rawFecha)) {
        const timeExtract = rawFecha.match(/\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?/);
        if (timeExtract) {
          hora = parseExcelTime(timeExtract[0]);
        }
      }

      newRows.push({
        id: `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${i}`,
        ot,
        opj,
        nunc,
        fiscal,
        delito,
        nombre,
        cedula,
        direccion,
        telefono,
        correo,
        fecha,
        hora,
        generada: false // Toda nueva fila pegada ingresa estrictamente como PENDIENTE
      });
    }

    // Si hubo falla en la estructura o no se extrajeron filas válidas
    if (structuralError || newRows.length === 0) {
      Swal.fire({
        position: 'center',
        icon: 'error',
        iconColor: '#dc2626',
        title: '<span style="color: #dc2626; font-weight: 800; font-size: 1.25rem;">Estructura de Portapapeles Inválida</span>',
        html: `
          <div style="text-align: left; font-size: 12.5px; color: #334155; line-height: 1.5;">
            <p style="margin-bottom: 10px;">
              La información que se intentó pegar <b>no coincide con la estructura requerida</b> de la tabla judicial y por seguridad <b>no fue pegada</b>.
            </p>
            <div style="background-color: #fef2f2; border: 1.5px solid #f87171; border-radius: 8px; padding: 10px 14px; margin-bottom: 12px;">
              <p style="margin: 0; color: #991b1b; font-weight: 700; font-size: 12px;">
                ✕ ${structuralError || 'No se detectó el formato de columnas continuo.'}
              </p>
            </div>
            <p style="font-weight: 700; color: #003366; margin: 8px 0 4px 0; font-size: 12px;">
              Estructura obligatoria requerida (12 columnas):
            </p>
            <div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 8px 12px; font-family: monospace; font-size: 11px; color: #1e293b; max-height: 130px; overflow-y: auto;">
              <ol style="margin: 0 0 0 16px; padding: 0; line-height: 1.45;">
                ${EXPECTED_COLUMNS_NAMES.map(col => `<li>${col}</li>`).join('')}
              </ol>
            </div>
            <p style="margin: 10px 0 0 0; color: #64748b; font-size: 11.5px;">
              💡 <b>Instrucción para copiar:</b> En Excel o Google Sheets, seleccione desde la primera columna (<b>OT</b>) hasta la columna (<b>HORA</b>), presione <b>Ctrl+C</b> y vuelva a pegar aquí.
            </p>
          </div>
        `,
        confirmButtonColor: '#003366',
        confirmButtonText: 'Entendido'
      });
      return false;
    }

    // Éxito: aplicar las nuevas filas a la tabla
    onRowsChange([...rows, ...newRows]);
    setIsPasteModalOpen(false);
    setPasteText('');

    // Mensaje de éxito tipo Toast
    Swal.fire({
      toast: true,
      position: 'top-end',
      icon: 'success',
      iconColor: '#16a34a',
      title: `¡${newRows.length} fila(s) importada(s) desde el portapapeles!`,
      showConfirmButton: false,
      timer: 3000,
      timerProgressBar: true
    });
    return true;
  };

  // Función para pegar directamente desde el portapapeles con lectura de API o modal si es bloqueado
  const handleClipboardPasteButtonClick = async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text && text.trim()) {
          const success = validateAndProcessPastedText(text);
          if (success) return;
          return;
        }
      }
    } catch (err) {
      console.warn("Lectura directa de portapapeles restringida por el navegador, abriendo modal de pegado:", err);
    }
    // Si la lectura directa no está permitida en el iframe, abrir el modal de pegado con textarea
    setIsPasteModalOpen(true);
  };

  // Importar desde archivo Excel físico (.xlsx / .csv)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const bstr = evt.target?.result;
        const workbook = XLSX.read(bstr, { type: 'binary', cellDates: true });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson: any[] = XLSX.utils.sheet_to_json(worksheet, { header: 1, raw: false });

        if (rawJson.length === 0) {
          Swal.fire({
            position: 'center',
            icon: 'error',
            iconColor: '#dc2626',
            title: 'Archivo Vacío',
            text: 'El archivo Excel seleccionado no contiene filas para procesar.',
            confirmButtonColor: '#003366',
            confirmButtonText: 'Entendido'
          });
          return;
        }

        const headerRow = rawJson[0] || [];
        const { isHeader, colMap } = detectIfHeaderRow(headerRow);
        const startIndex = isHeader ? 1 : 0;

        const dataRows = rawJson.slice(startIndex);
        if (dataRows.length === 0) {
          Swal.fire({
            position: 'center',
            icon: 'error',
            iconColor: '#dc2626',
            title: 'Solo Encabezados Detectados',
            text: 'El archivo Excel contiene únicamente la fila de encabezados sin registros de datos.',
            confirmButtonColor: '#003366',
            confirmButtonText: 'Entendido'
          });
          return;
        }

        const newRows: ExcelInsumoRow[] = dataRows.map((cols: any[], index: number) => {
          const getCol = (idx: number) => (cols[idx] !== undefined && cols[idx] !== null ? String(cols[idx]).trim() : '');
          const rawFecha = getCol(colMap.fecha);
          const rawHora = getCol(colMap.hora);

          let hora = rawHora ? parseExcelTime(rawHora) : '';
          if (!rawHora && rawFecha && /\d{1,2}:\d{2}/.test(rawFecha)) {
            const timeExtract = rawFecha.match(/\d{1,2}:\d{2}(?::\d{2})?(?:\s*(?:AM|PM|am|pm))?/);
            if (timeExtract) {
              hora = parseExcelTime(timeExtract[0]);
            }
          }

          return {
            id: `row_${Date.now()}_${index}_${Math.random().toString(36).slice(2, 6)}`,
            ot: getCol(colMap.ot),
            opj: getCol(colMap.opj),
            nunc: getCol(colMap.nunc),
            fiscal: getCol(colMap.fiscal),
            delito: getCol(colMap.delito),
            nombre: getCol(colMap.nombre),
            cedula: getCol(colMap.cedula),
            direccion: getCol(colMap.direccion),
            telefono: getCol(colMap.telefono),
            correo: getCol(colMap.correo),
            fecha: rawFecha ? parseExcelDate(rawFecha) : '',
            hora: hora,
            generada: false // Nuevas filas se marcan como pendientes
          };
        }).filter(r => r.nombre || r.opj || r.ot || r.nunc || r.cedula || r.direccion || r.telefono || r.correo || r.delito);

        if (newRows.length > 0) {
          onRowsChange([...rows, ...newRows]);
          Swal.fire({
            toast: true,
            position: 'top-end',
            icon: 'success',
            iconColor: '#16a34a',
            title: `¡${newRows.length} filas importadas desde Excel!`,
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true
          });
        }
      } catch (err: any) {
        console.error('Error reading Excel file:', err);
        Swal.fire({
          position: 'center',
          icon: 'error',
          iconColor: '#dc2626',
          title: 'Error al Leer Archivo',
          text: 'No se pudo procesar el archivo Excel. Asegúrese de que sea un formato válido .xlsx o .csv',
          confirmButtonColor: '#003366',
          confirmButtonText: 'Aceptar'
        });
      }
    };
    reader.readAsBinaryString(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Export current rows as .xlsx including GENERADA status
  const handleExportExcel = () => {
    if (rows.length === 0) return;
    const worksheetData = [
      ['OT', 'OPJ', 'NUNC', 'FISCAL', 'DELITO', 'NOMBRE', 'CEDULA', 'DIRECCION', 'TELEFONO', 'CORREO', 'FECHA', 'HORA', 'GENERADA', 'FECHA_GENERACION'],
      ...rows.map(r => [
        r.ot,
        r.opj,
        r.nunc,
        r.fiscal,
        r.delito || '',
        r.nombre,
        r.cedula,
        r.direccion,
        r.telefono,
        r.correo,
        r.fecha,
        r.hora,
        r.generada ? 'SÍ' : 'NO',
        r.fechaGeneracion || ''
      ])
    ];
    const ws = XLSX.utils.aoa_to_sheet(worksheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'InsumoCitaciones');
    XLSX.writeFile(wb, `Insumo_Citaciones_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  const hasPending = pendingRows.length > 0;
  const hasData = rows.length > 0;

  return (
    <div 
      className="space-y-6 outline-none"
      tabIndex={0}
      onPaste={(e) => {
        const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
        if (targetTag === 'input' || targetTag === 'textarea') {
          return; // Permitir edición normal dentro de campos de texto
        }
        const pastedData = e.clipboardData?.getData('text');
        if (pastedData) {
          e.preventDefault();
          validateAndProcessPastedText(pastedData);
        }
      }}
    >
      {/* Barra Superior con Navegación y Acciones Principales */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 sm:gap-4 bg-white p-3.5 sm:p-5 rounded-xl border border-fgn-border shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
          <button 
            onClick={onBack}
            className="flex items-center justify-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-slate-50 hover:bg-slate-100 px-3.5 sm:px-4 py-2 sm:py-2.5 rounded border border-fgn-border shadow-sm transition-all cursor-pointer w-full sm:w-auto"
          >
            <ArrowLeft size={14} strokeWidth={2.5} /> Volver al Inicio
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 bg-emerald-100 text-emerald-800 rounded shrink-0">
                <FileSpreadsheet size={18} className="sm:w-5 sm:h-5" />
              </span>
              <h2 className="text-base sm:text-lg font-black text-fgn-blue uppercase tracking-tight">
                Hoja de Cálculo - Insumo
              </h2>
            </div>
            <p className="text-slate-500 text-[10px] sm:text-[11px] font-semibold mt-0.5">
              Matriz con control de pendientes ({pendingRows.length} de {rows.length} totales).
            </p>
          </div>
        </div>

        {/* Botón Principal Generar Citaciones */}
        <div className="flex flex-wrap items-center gap-2.5 w-full lg:w-auto">
          <button
            onClick={onGenerateCitations}
            disabled={!hasPending}
            className={`w-full lg:w-auto flex items-center justify-center gap-2 px-5 sm:px-6 py-2.5 sm:py-3 rounded-lg font-black text-xs uppercase tracking-widest transition-all shadow-md ${
              hasPending 
                ? 'bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer hover:shadow-lg hover:scale-102' 
                : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300 shadow-none'
            }`}
            title={hasPending ? `Generar ${pendingRows.length} citaciones pendientes` : 'No hay citaciones pendientes por generar (el botón se habilitará al ingresar nueva información)'}
          >
            <Sparkles size={16} className={hasPending ? 'text-emerald-200 animate-pulse' : 'text-slate-400'} />
            {hasPending ? `Generar Citaciones (${pendingRows.length} pendientes)` : 'Citaciones al Día (0 pendientes)'}
          </button>
        </div>
      </div>

      {/* Barra de Herramientas Estilo Excel */}
      <div className="bg-slate-100 p-2.5 sm:p-3.5 rounded-lg border border-slate-300 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 text-xs">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-1.5 sm:gap-2">
          <button
            onClick={addRow}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded border border-slate-300 shadow-sm transition-colors text-[10px] sm:text-[11px] uppercase tracking-wider cursor-pointer"
          >
            <Plus size={14} className="text-emerald-600" /> Fila
          </button>

          <button
            onClick={handleClipboardPasteButtonClick}
            className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-900 font-black rounded border border-emerald-300 shadow-xs transition-colors text-[10px] sm:text-[11px] uppercase tracking-wider cursor-pointer"
            title="Pegar datos del portapapeles con validación estricta de estructura (12 columnas)"
          >
            <ClipboardPaste size={14} className="text-emerald-700" /> Pegar (Ctrl+V)
          </button>

          <label className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded border border-slate-300 shadow-sm transition-colors text-[10px] sm:text-[11px] uppercase tracking-wider cursor-pointer">
            <Upload size={14} className="text-blue-600" /> Importar .xlsx
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx, .xls, .csv"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>

          {hasData && (
            <button
              onClick={handleExportExcel}
              className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 font-bold rounded border border-slate-300 shadow-sm transition-colors text-[10px] sm:text-[11px] uppercase tracking-wider cursor-pointer"
              title="Descargar tabla actual como archivo Excel con estado GENERADA"
            >
              <Download size={14} className="text-slate-600" /> Exportar .xlsx
            </button>
          )}
        </div>

        {/* Acciones para marcar/limpiar */}
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 justify-end">
          {generatedRows.length > 0 && (
            <button
              onClick={clearGeneratedOnly}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 font-bold rounded border border-slate-300 text-[10px] uppercase tracking-wider cursor-pointer transition-colors"
              title="Borrar únicamente las filas que ya fueron generadas"
            >
              <Trash2 size={12} className="text-slate-400" /> Limpiar Generadas ({generatedRows.length})
            </button>
          )}

          {generatedRows.length > 0 && (
            <button
              onClick={markAllAsPending}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-900 font-bold rounded border border-slate-300 text-[10px] uppercase tracking-wider cursor-pointer transition-colors"
              title="Restablecer todas las filas a estado Pendiente"
            >
              <RotateCcw size={12} className="text-amber-600" /> Re-marcar
            </button>
          )}

          {hasData && (
            <button
              onClick={clearAllRows}
              className="flex items-center gap-1 px-2.5 py-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 font-bold rounded transition-colors text-[10px] uppercase tracking-wider cursor-pointer"
            >
              <Trash2 size={12} /> Limpiar Todo
            </button>
          )}
        </div>
      </div>

      {/* Pestañas de Filtro Rápido y Notificación de Estado */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border border-slate-200">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-bold">
          <span className="text-slate-400 text-[10px] uppercase tracking-wider mr-1">Ver:</span>
          <button
            onClick={() => setFilterTab('todas')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer ${
              filterTab === 'todas' 
                ? 'bg-fgn-blue text-white shadow-xs font-black' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Todas ({rows.length})
          </button>
          <button
            onClick={() => setFilterTab('pendientes')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'pendientes' 
                ? 'bg-amber-600 text-white shadow-xs font-black' 
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
            }`}
          >
            <Clock size={12} /> Pendientes ({pendingRows.length})
          </button>
          <button
            onClick={() => setFilterTab('generadas')}
            className={`px-3 py-1 rounded text-xs transition-colors cursor-pointer flex items-center gap-1.5 ${
              filterTab === 'generadas' 
                ? 'bg-emerald-700 text-white shadow-xs font-black' 
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
            }`}
          >
            <CheckCircle2 size={12} /> Generadas ({generatedRows.length})
          </button>
        </div>

        {/* Switcher de Vista en Móvil (Tarjetas vs Tabla) */}
        <div className="flex sm:hidden items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Modo Móvil:</span>
          <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border border-slate-200">
            <button
              onClick={() => setMobileViewMode('cards')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                mobileViewMode === 'cards' 
                  ? 'bg-white text-fgn-blue shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LayoutList size={12} /> Tarjetas
            </button>
            <button
              onClick={() => setMobileViewMode('table')}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                mobileViewMode === 'table' 
                  ? 'bg-white text-fgn-blue shadow-2xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon size={12} /> Tabla
            </button>
          </div>
        </div>

        <div className="hidden sm:flex text-[11px] text-slate-600 items-center gap-2">
          <AlertCircle size={14} className="text-fgn-blue shrink-0" />
          <span>
            Cada nueva fila ingresa como <b>Pendiente</b>. Al presionar <b>Generar</b>, se procesan y marcan como <b>Generadas</b>.
          </span>
        </div>
      </div>

      {/* VISTA MÓVIL EN MODO TARJETAS (sm:hidden cuando mobileViewMode === 'cards') */}
      {mobileViewMode === 'cards' && (
        <div className="block sm:hidden space-y-3">
          {visibleRows.length === 0 ? (
            <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
              <FileSpreadsheet size={36} className="mx-auto text-slate-300 mb-2" />
              <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                {rows.length === 0 ? 'No hay filas en la hoja' : 'No hay filas en esta pestaña'}
              </p>
            </div>
          ) : (
            visibleRows.map((row, idx) => {
              const rowDisplayNum = rows.findIndex(r => r.id === row.id) + 1;
              const isGenerada = !!row.generada;
              return (
                <div 
                  key={row.id}
                  className={`bg-white rounded-xl border p-3.5 space-y-2.5 shadow-2xs transition-all ${
                    isGenerada ? 'border-amber-300 bg-amber-50/25' : 'border-slate-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                        #{rowDisplayNum}
                      </span>
                      <p className="text-xs font-bold text-fgn-blue uppercase leading-snug break-words">
                        {row.nombre || <span className="text-slate-400 italic">Sin nombre</span>}
                      </p>
                    </div>
                    <button
                      onClick={() => toggleGenerada(row.id)}
                      className={`text-[9px] font-bold uppercase px-2 py-0.5 rounded border shrink-0 cursor-pointer transition-colors ${
                        isGenerada 
                          ? 'bg-amber-100 text-amber-900 border-amber-300' 
                          : 'bg-emerald-50 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      {isGenerada ? 'Generada' : 'Pendiente'}
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200 font-mono">
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase block">Cédula:</span>
                      <span className="text-slate-800 font-semibold">{row.cedula || '---'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase block">OPJ / Caso:</span>
                      <span className="text-slate-800 font-semibold">{row.opj || row.nunc || '---'}</span>
                    </div>
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase block">Fiscalía:</span>
                      <span className="text-slate-800 font-semibold">{row.fiscal || '---'}</span>
                    </div>
                    {row.delito && (
                      <div>
                        <span className="text-[9px] text-slate-500 font-bold uppercase block">Delito:</span>
                        <span className="text-slate-800 font-semibold">{row.delito}</span>
                      </div>
                    )}
                    <div>
                      <span className="text-[9px] text-slate-500 font-bold uppercase block">Fecha y Hora:</span>
                      <span className="text-fgn-blue font-bold">
                        {row.fecha || '---'} {row.hora ? `• ${row.hora}` : ''}
                      </span>
                    </div>
                  </div>

                  {/* Acciones de Tarjeta Móvil */}
                  <div className="flex items-center gap-2 pt-1 border-t border-slate-100">
                    <button
                      onClick={() => setEditingRowMobile(row)}
                      className="flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 bg-fgn-blue/5 hover:bg-fgn-blue/10 text-fgn-blue font-bold text-xs rounded-lg border border-fgn-blue/30 cursor-pointer transition-colors"
                    >
                      <Edit3 size={13} /> <span>Editar Fila</span>
                    </button>
                    <button
                      onClick={() => removeRow(row.id, row.nombre)}
                      className="p-1.5 text-red-600 hover:bg-red-50 rounded-lg border border-red-200 cursor-pointer transition-colors"
                      title="Eliminar fila"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })
          )}

          {/* Botón rápido en móvil */}
          <button
            onClick={addRow}
            className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl border border-slate-300 flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
          >
            <Plus size={14} /> Agregar Nueva Fila
          </button>
        </div>
      )}

      {/* Contenedor de la Tabla Simulación Excel con Columna GENERADA (Visible siempre en sm+, o en móvil cuando mobileViewMode === 'table') */}
      <div className={`${mobileViewMode === 'cards' ? 'hidden sm:block' : 'block'} bg-white rounded-xl border border-slate-300 shadow-sm overflow-hidden`}>
        {/* Banner informativo de desplazamiento táctil para móviles */}
        <div className="sm:hidden px-3 py-1.5 bg-amber-50/80 border-b border-amber-200 text-amber-900 text-[10px] font-semibold flex items-center justify-between">
          <span>↔ Desliza para ver las 12 columnas o toca ✎ para editar</span>
          <span className="font-bold">{rows.length} filas</span>
        </div>

        <div className="overflow-x-auto max-h-[620px]">
          <table className="w-full border-collapse text-left select-text">
            {/* Encabezado fiel a la imagen de Excel con columnas 1 y 2 fijas horizontalmente */}
            <thead className="sticky top-0 z-20 shadow-sm">
              <tr className="bg-[#737373] text-white text-[11px] font-bold uppercase tracking-wider border-b border-[#525252]">
                {/* Columna de numeración de fila - Sticky */}
                <th className="w-10 min-w-[40px] px-2 py-2 text-center bg-[#5c5c5c] text-white border-r border-[#4a4a4a] text-[10px] font-mono select-none sticky left-0 z-30">
                  #
                </th>

                {/* Columna de Estado: GENERADA - Sticky */}
                <th className="w-32 min-w-[125px] px-3 py-2.5 font-bold border-r border-[#5f5f5f] bg-[#4f555c] text-white select-none sticky left-10 z-30 shadow-[2px_0_5px_rgba(0,0,0,0.15)]">
                  <div className="flex items-center justify-between gap-1.5">
                    <span>GENERADA</span>
                    <span className="bg-[#42474e] border border-[#2e3238] rounded px-1 py-0.5 text-white/90 text-[8px] flex items-center shadow-xs cursor-default">
                      <ChevronDown size={10} strokeWidth={3} />
                    </span>
                  </div>
                </th>
                
                {/* Columnas según el insumo judicial */}
                {[
                  { key: 'ot', label: 'OT', width: 'w-24 min-w-[90px]' },
                  { key: 'opj', label: 'OPJ', width: 'w-28 min-w-[110px]' },
                  { key: 'nunc', label: 'NUNC', width: 'w-48 min-w-[190px]' },
                  { key: 'fiscal', label: 'FISCAL', width: 'w-32 min-w-[130px]' },
                  { key: 'delito', label: 'DELITO', width: 'w-48 min-w-[180px]' },
                  { key: 'nombre', label: 'NOMBRE', width: 'w-64 min-w-[240px]' },
                  { key: 'cedula', label: 'CEDULA', width: 'w-32 min-w-[130px]' },
                  { key: 'direccion', label: 'DIRECCION', width: 'w-60 min-w-[220px]' },
                  { key: 'telefono', label: 'TELEFONO', width: 'w-32 min-w-[130px]' },
                  { key: 'correo', label: 'CORREO', width: 'w-48 min-w-[190px]' },
                  { key: 'fecha', label: 'FECHA', width: 'w-32 min-w-[130px]' },
                  { key: 'hora', label: 'HORA', width: 'w-28 min-w-[110px]' },
                ].map((col) => (
                  <th 
                    key={col.key}
                    className={`px-3 py-2.5 font-bold border-r border-[#5f5f5f] ${col.width} select-none`}
                  >
                    <div className="flex items-center justify-between gap-1.5">
                      <span>{col.label}</span>
                      <span className="bg-[#595959] hover:bg-[#4a4a4a] border border-[#3e3e3e] rounded px-1 py-0.5 text-white/90 text-[8px] flex items-center shadow-xs cursor-default">
                        <ChevronDown size={10} strokeWidth={3} />
                      </span>
                    </div>
                  </th>
                ))}
                
                {/* Columna de Acciones de fila */}
                <th className="w-14 px-2 py-2 text-center bg-[#5c5c5c] text-white text-[10px] select-none">
                  Acción
                </th>
              </tr>
            </thead>

            {/* Cuerpo de la tabla con alternancia de filas (Zebra) */}
            <tbody className="divide-y divide-slate-200 text-xs text-slate-800">
              {visibleRows.length === 0 ? (
                <tr>
                  <td colSpan={14} className="py-16 text-center text-slate-400 bg-slate-50/50">
                    <FileSpreadsheet size={44} className="mx-auto mb-3 text-slate-300" />
                    <p className="font-bold text-sm text-slate-600 uppercase tracking-wider">
                      {rows.length === 0 ? 'La hoja de cálculo está vacía' : `No hay filas en estado "${filterTab}"`}
                    </p>
                    <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                      {rows.length === 0 
                        ? 'Agregue filas manualmente, pegue desde Excel con Ctrl+V o cargue un archivo .xlsx para iniciar.'
                        : 'Cambie a la pestaña "Todas" para revisar el listado completo.'}
                    </p>
                    <div className="mt-4 flex justify-center gap-3">
                      <button
                        onClick={addRow}
                        className="px-4 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded text-[11px] uppercase tracking-wider transition-all cursor-pointer"
                      >
                        + Agregar Fila
                      </button>
                      {filterTab !== 'todas' && (
                        <button
                          onClick={() => setFilterTab('todas')}
                          className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded text-[11px] uppercase tracking-wider transition-all cursor-pointer"
                        >
                          Ver Todas las Filas
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                visibleRows.map((row, index) => {
                  const isEven = index % 2 === 0;
                  const isGenerada = !!row.generada;
                  return (
                    <tr 
                      key={row.id}
                      style={{
                        backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined
                      }}
                      className={`transition-colors ${
                        isGenerada 
                          ? 'border-b border-amber-300/80 hover:brightness-95' 
                          : (isEven ? 'bg-white' : 'bg-[#f4f6f8]') + ' hover:bg-blue-50/40'
                      }`}
                    >
                      {/* Número de fila estilo Excel - Sticky */}
                      <td 
                        style={{
                          backgroundColor: isGenerada ? 'rgb(245, 228, 175)' : undefined
                        }}
                        className={`px-2 py-1.5 text-center font-mono text-[11px] border-r border-slate-300 select-none font-bold sticky left-0 z-10 ${
                          isGenerada ? 'text-amber-950 font-black bg-[#f5e4af]' : 'text-slate-500 bg-slate-100'
                        }`}
                      >
                        {index + 1}
                      </td>

                      {/* Columna GENERADA con Toggle interactivo - Sticky */}
                      <td 
                        style={{
                          backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined
                        }}
                        className={`px-2 py-1.5 border-r border-slate-200 text-center select-none sticky left-10 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.08)] ${
                          isGenerada ? 'bg-[#ffebb9]' : (isEven ? 'bg-white' : 'bg-[#f4f6f8]')
                        }`}
                      >
                        <button
                          onClick={() => toggleGenerada(row.id)}
                          title={isGenerada ? "Citación generada. Clic para cambiar a pendiente." : "Citación pendiente. Clic para marcar como generada."}
                          className={`w-full flex items-center justify-center gap-1 px-2 py-1 rounded text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer border ${
                            isGenerada
                              ? 'bg-amber-100 hover:bg-amber-200 text-amber-950 border-amber-400 shadow-2xs'
                              : 'bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-emerald-300 shadow-2xs animate-pulse'
                          }`}
                        >
                          {isGenerada ? (
                            <>
                              <CheckCircle2 size={12} className="text-amber-800 shrink-0" />
                              <span>SÍ</span>
                            </>
                          ) : (
                            <>
                              <Clock size={12} className="text-emerald-700 shrink-0" />
                              <span>NO (Pend.)</span>
                            </>
                          )}
                        </button>
                      </td>

                      {/* Celda OT */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="text"
                          value={row.ot}
                          onChange={(e) => updateCell(row.id, 'ot', e.target.value)}
                          placeholder="Ej: OT-01"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs font-mono font-medium outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Celda OPJ */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="text"
                          value={row.opj}
                          onChange={(e) => updateCell(row.id, 'opj', e.target.value)}
                          placeholder="Ej: 045-2026"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs font-mono font-bold text-fgn-blue outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Celda NUNC */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="text"
                          value={row.nunc}
                          onChange={(e) => updateCell(row.id, 'nunc', e.target.value)}
                          placeholder="21 dígitos"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs font-mono outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Celda FISCAL */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="text"
                          value={row.fiscal}
                          onChange={(e) => updateCell(row.id, 'fiscal', e.target.value)}
                          placeholder="Ej: 17 Local"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Celda DELITO */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="text"
                          value={row.delito || ''}
                          onChange={(e) => updateCell(row.id, 'delito', e.target.value)}
                          placeholder="Ej: Hurto Agravado"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue font-medium"
                        />
                      </td>

                      {/* Celda NOMBRE */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="text"
                          value={row.nombre}
                          onChange={(e) => updateCell(row.id, 'nombre', e.target.value)}
                          placeholder="Nombre Completo *"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs font-bold text-slate-900 uppercase outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Celda CEDULA */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="text"
                          value={row.cedula}
                          onChange={(e) => updateCell(row.id, 'cedula', e.target.value)}
                          placeholder="Cédula"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs font-mono outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Celda DIRECCION */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="text"
                          value={row.direccion}
                          onChange={(e) => updateCell(row.id, 'direccion', e.target.value)}
                          placeholder="Dirección residencia / citación"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Celda TELEFONO */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="text"
                          value={row.telefono}
                          onChange={(e) => updateCell(row.id, 'telefono', e.target.value)}
                          placeholder="Teléfono / WhatsApp"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs font-mono outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Celda CORREO */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="email"
                          value={row.correo}
                          onChange={(e) => updateCell(row.id, 'correo', e.target.value)}
                          placeholder="correo@ejemplo.com"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Celda FECHA */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="date"
                          value={row.fecha}
                          onChange={(e) => updateCell(row.id, 'fecha', e.target.value)}
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs font-mono outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Celda HORA */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="p-0 border-r border-slate-200"
                      >
                        <input
                          type="text"
                          value={row.hora}
                          onChange={(e) => updateCell(row.id, 'hora', e.target.value)}
                          placeholder="09:00 AM"
                          className="w-full h-full px-2.5 py-2 bg-transparent text-xs font-mono font-medium outline-none focus:bg-amber-50 focus:ring-1 focus:ring-fgn-blue"
                        />
                      </td>

                      {/* Botón Acciones de Fila (Editar / Eliminar) */}
                      <td 
                        style={{ backgroundColor: isGenerada ? 'rgb(255, 238, 185)' : undefined }}
                        className="px-2 py-1 text-center whitespace-nowrap"
                      >
                        <div className="flex items-center justify-center gap-0.5">
                          <button
                            onClick={() => setEditingRowMobile(row)}
                            className="p-1.5 text-slate-500 hover:text-fgn-blue hover:bg-blue-50 rounded transition-colors cursor-pointer"
                            title="Ver y editar campos de esta fila en formulario"
                          >
                            <Edit3 size={13} />
                          </button>
                          <button
                            onClick={() => removeRow(row.id, row.nombre)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                            title="Eliminar esta fila"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pie de tabla con resumen y botón rápido */}
        <div className="bg-slate-50 border-t border-slate-300 p-3 px-4 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[11px] sm:text-xs">
            <span>
              Total filas: <b>{rows.length}</b>
            </span>
            <span>•</span>
            <span className="text-amber-800 font-bold">
              Pendientes: <b>{pendingRows.length}</b>
            </span>
            <span>•</span>
            <span className="text-emerald-800 font-bold">
              Generadas: <b>{generatedRows.length}</b>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={addRow}
              className="text-[11px] font-bold text-fgn-blue hover:underline flex items-center gap-1 cursor-pointer"
            >
              <Plus size={13} /> Agregar fila
            </button>
          </div>
        </div>
      </div>

      {/* Modal Móvil de Edición Rápida de Fila */}
      {editingRowMobile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-lg w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b px-4 py-3 bg-slate-50 shrink-0">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-fgn-blue text-white rounded">
                  <Edit3 size={15} />
                </span>
                <h3 className="text-xs sm:text-sm font-black text-fgn-blue uppercase tracking-wider">
                  Detalle y Edición de Fila
                </h3>
              </div>
              <button
                onClick={() => setEditingRowMobile(null)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-lg hover:bg-slate-200 cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 overflow-y-auto space-y-3.5 text-xs">
              {/* Estado GENERADA Toggle */}
              <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 block">Estado de Citación:</span>
                  <span className={`text-xs font-black ${editingRowMobile.generada ? 'text-amber-800' : 'text-emerald-800'}`}>
                    {editingRowMobile.generada ? 'SÍ (Ya Generada)' : 'NO (Pendiente de Generar)'}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    toggleGenerada(editingRowMobile.id);
                    setEditingRowMobile({
                      ...editingRowMobile,
                      generada: !editingRowMobile.generada
                    });
                  }}
                  className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase cursor-pointer border transition-all ${
                    editingRowMobile.generada 
                      ? 'bg-amber-100 border-amber-300 text-amber-900' 
                      : 'bg-emerald-100 border-emerald-300 text-emerald-900'
                  }`}
                >
                  Cambiar Estado
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">OT</label>
                  <input
                    type="text"
                    value={editingRowMobile.ot}
                    onChange={(e) => {
                      updateCell(editingRowMobile.id, 'ot', e.target.value);
                      setEditingRowMobile({ ...editingRowMobile, ot: e.target.value });
                    }}
                    placeholder="Ej: OT-01"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold outline-none focus:border-fgn-blue"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">OPJ</label>
                  <input
                    type="text"
                    value={editingRowMobile.opj}
                    onChange={(e) => {
                      updateCell(editingRowMobile.id, 'opj', e.target.value);
                      setEditingRowMobile({ ...editingRowMobile, opj: e.target.value });
                    }}
                    placeholder="Ej: 045-2026"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs font-mono font-bold outline-none focus:border-fgn-blue"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">NUNC (Noticia Criminal)</label>
                <input
                  type="text"
                  value={editingRowMobile.nunc}
                  onChange={(e) => {
                    updateCell(editingRowMobile.id, 'nunc', e.target.value);
                    setEditingRowMobile({ ...editingRowMobile, nunc: e.target.value });
                  }}
                  placeholder="21 dígitos..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs font-mono outline-none focus:border-fgn-blue"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Fiscal / Despacho</label>
                  <input
                    type="text"
                    value={editingRowMobile.fiscal}
                    onChange={(e) => {
                      updateCell(editingRowMobile.id, 'fiscal', e.target.value);
                      setEditingRowMobile({ ...editingRowMobile, fiscal: e.target.value });
                    }}
                    placeholder="Ej: 17 Local"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs outline-none focus:border-fgn-blue"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Delito del Caso</label>
                  <input
                    type="text"
                    value={editingRowMobile.delito || ''}
                    onChange={(e) => {
                      updateCell(editingRowMobile.id, 'delito', e.target.value);
                      setEditingRowMobile({ ...editingRowMobile, delito: e.target.value });
                    }}
                    placeholder="Ej: Hurto Agravado"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs outline-none focus:border-fgn-blue font-medium"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Cédula</label>
                <input
                  type="text"
                  value={editingRowMobile.cedula}
                  onChange={(e) => {
                    updateCell(editingRowMobile.id, 'cedula', e.target.value);
                    setEditingRowMobile({ ...editingRowMobile, cedula: e.target.value });
                  }}
                  placeholder="Documento..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs font-mono outline-none focus:border-fgn-blue"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Nombre Completo</label>
                <input
                  type="text"
                  value={editingRowMobile.nombre}
                  onChange={(e) => {
                    updateCell(editingRowMobile.id, 'nombre', e.target.value);
                    setEditingRowMobile({ ...editingRowMobile, nombre: e.target.value });
                  }}
                  placeholder="Nombre de la persona citada..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs font-bold text-fgn-blue outline-none focus:border-fgn-blue uppercase"
                />
              </div>

              <div>
                <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Dirección</label>
                <input
                  type="text"
                  value={editingRowMobile.direccion}
                  onChange={(e) => {
                    updateCell(editingRowMobile.id, 'direccion', e.target.value);
                    setEditingRowMobile({ ...editingRowMobile, direccion: e.target.value });
                  }}
                  placeholder="Dirección de residencia o despacho..."
                  className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs outline-none focus:border-fgn-blue"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Teléfono / Móvil</label>
                  <input
                    type="text"
                    value={editingRowMobile.telefono}
                    onChange={(e) => {
                      updateCell(editingRowMobile.id, 'telefono', e.target.value);
                      setEditingRowMobile({ ...editingRowMobile, telefono: e.target.value });
                    }}
                    placeholder="Teléfono..."
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs outline-none focus:border-fgn-blue"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Correo Electrónico</label>
                  <input
                    type="email"
                    value={editingRowMobile.correo}
                    onChange={(e) => {
                      updateCell(editingRowMobile.id, 'correo', e.target.value);
                      setEditingRowMobile({ ...editingRowMobile, correo: e.target.value });
                    }}
                    placeholder="correo@ejemplo.com"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs outline-none focus:border-fgn-blue"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Fecha de Citación</label>
                  <input
                    type="date"
                    value={editingRowMobile.fecha}
                    onChange={(e) => {
                      updateCell(editingRowMobile.id, 'fecha', e.target.value);
                      setEditingRowMobile({ ...editingRowMobile, fecha: e.target.value });
                    }}
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs font-mono outline-none focus:border-fgn-blue"
                  />
                </div>
                <div>
                  <label className="text-[9px] font-bold text-slate-500 uppercase tracking-wider block mb-1">Hora</label>
                  <input
                    type="text"
                    value={editingRowMobile.hora}
                    onChange={(e) => {
                      updateCell(editingRowMobile.id, 'hora', e.target.value);
                      setEditingRowMobile({ ...editingRowMobile, hora: e.target.value });
                    }}
                    placeholder="08:30 AM"
                    className="w-full p-2 bg-slate-50 border border-slate-300 rounded text-xs font-mono outline-none focus:border-fgn-blue"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center gap-2 p-3 sm:px-4 bg-slate-50 border-t shrink-0">
              <button
                type="button"
                onClick={() => {
                  const id = editingRowMobile.id;
                  const nombre = editingRowMobile.nombre;
                  setEditingRowMobile(null);
                  removeRow(id, nombre);
                }}
                className="px-3 py-2 text-red-600 hover:bg-red-50 font-bold rounded text-xs uppercase cursor-pointer"
              >
                Eliminar Fila
              </button>
              <button
                type="button"
                onClick={() => setEditingRowMobile(null)}
                className="px-5 py-2 bg-fgn-blue hover:bg-fgn-blue/90 text-white font-bold rounded text-xs uppercase tracking-wider shadow cursor-pointer"
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal para Pegar Texto de Excel (Ctrl+V) */}
      {isPasteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl border border-slate-300 max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b px-4 sm:px-6 py-3.5 bg-slate-50 shrink-0">
              <h3 className="text-xs sm:text-sm font-black text-fgn-blue uppercase tracking-wider flex items-center gap-2">
                <ClipboardPaste size={18} className="text-emerald-600" />
                Pegar Filas del Portapapeles
              </h3>
              <button
                onClick={() => setIsPasteModalOpen(false)}
                className="text-slate-400 hover:text-slate-700 text-sm font-bold cursor-pointer p-1"
              >
                ✕
              </button>
            </div>

            <div className="p-4 sm:p-6 overflow-y-auto space-y-3 text-xs text-slate-600">
              <p>
                Seleccione y copie (<b>Ctrl+C</b>) las filas en su archivo Excel e inserte el texto copiado (<b>Ctrl+V</b>) en el recuadro a continuación.
              </p>
              <div className="bg-amber-50 border border-amber-200 rounded p-2.5 text-amber-900 text-[11px]">
                <b>Validación Estricta:</b> La información debe contener exactamente las <b>12 columnas</b> reglamentarias en este orden:
                <br />
                <span className="font-mono text-[10px] text-slate-700 bg-white/80 p-1 rounded mt-1 inline-block border border-amber-300/50 break-all">
                  OT | OPJ | NUNC | FISCAL | DELITO | NOMBRE | CEDULA | DIRECCION | TELEFONO | CORREO | FECHA | HORA
                </span>
              </div>

              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder="Pegue aquí el contenido de su archivo Excel (filas con 12 columnas separadas por tabulaciones)..."
                className="w-full p-3 bg-slate-50 border border-slate-300 rounded font-mono text-xs text-slate-800 outline-none focus:border-fgn-blue focus:ring-1 focus:ring-fgn-blue resize-none"
              />
            </div>

            <div className="flex justify-end gap-2.5 p-3 sm:px-6 sm:py-3.5 bg-slate-50 border-t shrink-0">
              <button
                onClick={() => {
                  setIsPasteModalOpen(false);
                  setPasteText('');
                }}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded text-xs uppercase cursor-pointer"
              >
                Cancelar
              </button>
              <button
                onClick={() => validateAndProcessPastedText(pasteText)}
                disabled={!pasteText.trim()}
                className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 disabled:bg-slate-300 text-white font-bold rounded text-xs uppercase tracking-wider shadow cursor-pointer"
              >
                Validar e Importar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
