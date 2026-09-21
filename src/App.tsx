/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Copy, User, Calendar, ClipboardList, FileText, FileCheck, FileX, Building2, 
  Trash2, Plus, Sparkles, FileDown, Download, Phone, Mail, MapPin, Briefcase,
  Wand2, BrainCircuit, Loader2, FileUp, X, Check,
  History, Search, ArrowLeft, LogOut, Eye, ArrowUpDown,
  UserCheck, UserX, CheckCircle, RefreshCw, FileCode, PenTool,
  FileSpreadsheet, Clock, Pencil, MessageCircle, CalendarRange, AlertTriangle,
  ShieldCheck, ArrowRight, ChevronRight, CheckCircle2, FolderArchive, Layers,
  Zap, ShieldAlert, ArrowUpRight, BadgeCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

import { Citacion, CitacionFilters, PageSizeOption, ExcelInsumoRow, InvestigatorConfig } from './types';
import { CitationFilterBar } from './components/CitationFilterBar';
import { PaginationControls } from './components/PaginationControls';
import { filterCitations, paginateList, getUniqueFiscales } from './utils/filterUtils';
import { ExcelMatrixView, SAMPLE_EXCEL_ROWS, parseExcelDate, parseExcelTime } from './components/ExcelMatrixView';
import { EditCitationModal } from './components/EditCitationModal';
import { CitationModal } from './components/CitationModal';
import { SignatureModal } from './components/SignatureModal';
import { CitationForm } from './components/CitationForm';
import { CitationTable } from './components/CitationTable';
import { JudicialCalendar } from './components/JudicialCalendar';

import { 
  auth, 
  db, 
  appId, 
  DEFAULT_CONFIG, 
  DEFAULT_OBSERVACIONES,
  CitationService,
  formatDateES,
  formatTimeAMPM,
  generateWhatsAppMessage,
  getOutlook365Url,
  detectScheduleConflicts,
  analyzeCitationUrgency,
  getTodayDateStr
} from './services/citationService';
import { downloadCitationDocx } from './services/docxGenerator';

import { 
  signInAnonymously, 
  onAuthStateChanged, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  getDocFromServer, 
  doc 
} from 'firebase/firestore';

// Gemini AI SDK
import { GoogleGenAI, Type } from "@google/genai";

// SweetAlert helper notifications
const showRedAuthErrorAlert = (title: string, message: string, code?: string) => {
  return Swal.fire({
    icon: 'error',
    iconColor: '#dc2626',
    title: `<span style="color: #dc2626; font-weight: 800; font-size: 1.25rem;">${title}</span>`,
    html: `
      <div style="text-align: center; margin-top: 6px;">
        <div style="background-color: #fef2f2; border: 1.5px solid #f87171; border-radius: 8px; padding: 12px 14px; margin-bottom: 12px; text-align: left;">
          <p style="color: #991b1b; font-weight: 600; font-size: 13px; margin: 0; line-height: 1.45;">
            ${message}
          </p>
          ${code ? `<p style="color: #b91c1c; font-size: 11px; margin-top: 6px; margin-bottom: 0; font-family: monospace; font-weight: 600;">Detalle: ${code}</p>` : ''}
        </div>
        <p style="color: #475569; font-size: 12px; line-height: 1.4; margin: 0;">
          Puede hacer clic en <b>Ingresar como Invitado</b> para trabajar de forma inmediata.
        </p>
      </div>
    `,
    confirmButtonColor: '#dc2626',
    confirmButtonText: 'Entendido',
    background: '#ffffff',
    customClass: {
      popup: 'rounded-xl shadow-2xl border border-red-200',
      confirmButton: 'px-5 py-2.5 rounded font-bold text-xs uppercase tracking-wider shadow-sm'
    }
  });
};

const showRedErrorAlert = (title: string, message: string) => {
  return Swal.fire({
    icon: 'error',
    iconColor: '#dc2626',
    title: `<span style="color: #dc2626; font-weight: 700; font-size: 1.15rem;">${title}</span>`,
    text: message,
    confirmButtonColor: '#dc2626',
    confirmButtonText: 'Aceptar',
    customClass: {
      popup: 'rounded-xl shadow-xl border border-red-100'
    }
  });
};

const showSuccessToast = (title: string) => {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    iconColor: '#16a34a',
    title: `<span style="font-size: 13px; font-weight: 600; color: #1e293b;">${title}</span>`,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
  });
};

const showInfoToast = (title: string) => {
  return Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'info',
    iconColor: '#0284c7',
    title: `<span style="font-size: 13px; font-weight: 600; color: #1e293b;">${title}</span>`,
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true
  });
};

const App: React.FC = () => {
  // Auth State
  const [user, setUser] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Core Data
  const [historial, setHistorial] = useState<Citacion[]>([]);
  const [config, setConfig] = useState<InvestigatorConfig>(DEFAULT_CONFIG);
  const [excelRows, setExcelRows] = useState<ExcelInsumoRow[]>(() => {
    const saved = localStorage.getItem('fgn_insumo_excel_rows');
    return saved ? JSON.parse(saved) : SAMPLE_EXCEL_ROWS;
  });

  // UI Modes & Navigation
  const [activeMode, setActiveMode] = useState<'pendientes' | 'citados' | 'historial' | 'excel' | 'calendar' | null>(null);
  const [isSignatureModalOpen, setIsSignatureModalOpen] = useState(false);
  const [isManualFormOpen, setIsManualFormOpen] = useState(false);
  const [customTemplateBuffer, setCustomTemplateBuffer] = useState<ArrayBuffer | undefined>(undefined);
  const [customTemplateName, setCustomTemplateName] = useState<string | null>(null);

  // Modals & Selection
  const [selectedCitation, setSelectedCitation] = useState<Citacion | null>(null);
  const [isCitationModalOpen, setIsCitationModalOpen] = useState(false);
  const [editingCitation, setEditingCitation] = useState<Citacion | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [copiadoIdx, setCopiadoIdx] = useState<string | null>(null);

  // Sorting (Por defecto: del más reciente al más antiguo)
  const [sortConfig, setSortConfig] = useState<{ key: 'fecha' | 'nombre'; direction: 'asc' | 'desc' }>({ key: 'fecha', direction: 'desc' });

  // Filtering & Pagination for Pendientes
  const [filtersPendientes, setFiltersPendientes] = useState<CitacionFilters>({
    searchTerm: '',
    fiscal: 'todos',
    fechaFiltro: 'todas',
    fechaDesde: '',
    fechaHasta: '',
    estado: 'todos',
    informe: 'todos',
    asistencia: 'todas'
  });
  const [pagePendientes, setPagePendientes] = useState(1);
  const [pageSizePendientes, setPageSizePendientes] = useState<PageSizeOption>(20);

  // Filtering & Pagination for Citados
  const [filtersCitados, setFiltersCitados] = useState<CitacionFilters>({
    searchTerm: '',
    fiscal: 'todos',
    fechaFiltro: 'todas',
    fechaDesde: '',
    fechaHasta: '',
    estado: 'todos',
    informe: 'todos',
    asistencia: 'todas'
  });
  const [pageCitados, setPageCitados] = useState(1);
  const [pageSizeCitados, setPageSizeCitados] = useState<PageSizeOption>(20);

  // Filtering & Pagination for Historial (Archivo)
  const [filtersHistorial, setFiltersHistorial] = useState<CitacionFilters>({
    searchTerm: '',
    fiscal: 'todos',
    fechaFiltro: 'todas',
    fechaDesde: '',
    fechaHasta: '',
    estado: 'todos',
    informe: 'todos',
    asistencia: 'todas'
  });
  const [pageHistorial, setPageHistorial] = useState(1);
  const [pageSizeHistorial, setPageSizeHistorial] = useState<PageSizeOption>(20);

  // AI Extraction State
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [loadingExtract, setLoadingExtract] = useState(false);
  const [pendingExtraction, setPendingExtraction] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ==========================================
  // AUTHENTICATION & LISTENERS
  // ==========================================

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        // Load user config from local storage or Firestore
        const savedConfig = localStorage.getItem(`fgn_google_config_${currentUser.uid}`);
        if (savedConfig) {
          try { setConfig(JSON.parse(savedConfig)); } catch (e) { console.error(e); }
        }
      } else {
        const guestActive = localStorage.getItem('fgn_guest_session');
        if (guestActive) {
          const guestUser = { uid: 'guest_user', email: 'invitado@fiscalia.gov.co', isLocalGuest: true };
          setUser(guestUser);
          const guestConfig = localStorage.getItem('fgn_guest_config');
          if (guestConfig) {
            try { setConfig(JSON.parse(guestConfig)); } catch (e) { console.error(e); }
          }
        } else {
          setUser(null);
        }
      }
      setAuthLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // Sync Historial with Firestore / LocalStorage
  useEffect(() => {
    if (!user) {
      setHistorial([]);
      return;
    }

    if (user.isLocalGuest) {
      const stored = localStorage.getItem('fgn_guest_historial');
      if (stored) {
        try { setHistorial(JSON.parse(stored)); } catch (e) { console.error(e); }
      }
      return;
    }

    // Google Auth -> Firestore real-time listener
    const historialRef = collection(db, 'artifacts', appId, 'users', user.uid, 'historial');
    const q = query(historialRef);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const items: Citacion[] = [];
      snapshot.forEach((doc) => {
        items.push({ ...doc.data(), id: doc.id } as Citacion);
      });
      setHistorial(items);
    }, (error) => {
      console.error("Error al escuchar historial de Firestore:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // Auth Handlers
  const handleGoogleLogin = async () => {
    setIsLoggingIn(true);
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });
      await signInWithPopup(auth, provider);
      localStorage.removeItem('fgn_guest_session');
      showSuccessToast('Sesión iniciada con Google');
    } catch (err: any) {
      console.error("Error Google Auth:", err);
      showRedAuthErrorAlert("No se pudo iniciar sesión con Google", "Ocurrió un inconveniente con el proveedor de autenticación de Google.", err.code);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleGuestLogin = () => {
    localStorage.setItem('fgn_guest_session', 'true');
    setUser({ uid: 'guest_user', email: 'invitado@fiscalia.gov.co', isLocalGuest: true });
    showInfoToast('Modo Invitado Local Activado');
  };

  const handleLogout = async () => {
    localStorage.removeItem('fgn_guest_session');
    if (user && !user.isLocalGuest) {
      await signOut(auth);
    }
    setUser(null);
    setActiveMode(null);
    showInfoToast('Sesión cerrada');
  };

  // Save Config Profile
  const handleSaveConfig = async (newConfig: InvestigatorConfig) => {
    setConfig(newConfig);
    await CitationService.saveProfileConfig(user, newConfig);
    showSuccessToast('Perfil de Policía Judicial guardado');
  };

  // Handle Custom Template Upload
  const handleUploadCustomTemplate = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      setCustomTemplateBuffer(arrayBuffer);
      setCustomTemplateName(file.name);
      showSuccessToast(`Plantilla "${file.name}" cargada`);
    } catch (e) {
      console.error(e);
      showRedErrorAlert("Error al cargar plantilla", "No se pudo leer el archivo Word .docx seleccionado.");
    }
  };

  const handleResetTemplate = () => {
    setCustomTemplateBuffer(undefined);
    setCustomTemplateName(null);
    showInfoToast('Plantilla restaurada al formato estándar FPJ-35');
  };

  // ==========================================
  // CITATION PARTITIONS & COMPUTED LISTS
  // ==========================================

  const personas = useMemo(() => {
    return historial.filter(h => h.estado === 'pendiente' || !h.estado);
  }, [historial]);

  const citados = useMemo(() => {
    return historial.filter(h => h.estado === 'citado');
  }, [historial]);

  const conflictMap = useMemo(() => {
    return detectScheduleConflicts(historial);
  }, [historial]);

  const fiscalOptions = useMemo(() => {
    return getUniqueFiscales(historial);
  }, [historial]);

  // Sort function (Por defecto del más reciente al más antiguo)
  const sortCitations = (list: Citacion[]) => {
    return [...list].sort((a, b) => {
      if (sortConfig.key === 'fecha') {
        const dateA = `${a.fecha || ''} ${a.hora || ''}`;
        const dateB = `${b.fecha || ''} ${b.hora || ''}`;
        const dateCmp = sortConfig.direction === 'asc' ? dateA.localeCompare(dateB) : dateB.localeCompare(dateA);
        if (dateCmp !== 0) return dateCmp;

        // Desempate por timestamp de creación
        const timeA = a.creadoTimestamp || 0;
        const timeB = b.creadoTimestamp || 0;
        return sortConfig.direction === 'asc' ? timeA - timeB : timeB - timeA;
      }
      const nameA = a.nombre || '';
      const nameB = b.nombre || '';
      return sortConfig.direction === 'asc' ? nameA.localeCompare(nameB) : nameB.localeCompare(nameA);
    });
  };

  // Filtered & Paginated Lists
  const filteredPendientes = useMemo(() => {
    return sortCitations(filterCitations(personas, filtersPendientes));
  }, [personas, filtersPendientes, sortConfig]);

  const paginatedPendientes = useMemo(() => {
    return paginateList(filteredPendientes, pagePendientes, pageSizePendientes);
  }, [filteredPendientes, pagePendientes, pageSizePendientes]);

  const filteredCitados = useMemo(() => {
    return sortCitations(filterCitations(citados, filtersCitados));
  }, [citados, filtersCitados, sortConfig]);

  const paginatedCitados = useMemo(() => {
    return paginateList(filteredCitados, pageCitados, pageSizeCitados);
  }, [filteredCitados, pageCitados, pageSizeCitados]);

  const filteredHistorial = useMemo(() => {
    return sortCitations(filterCitations(historial, filtersHistorial));
  }, [historial, filtersHistorial, sortConfig]);

  const paginatedHistorial = useMemo(() => {
    return paginateList(filteredHistorial, pageHistorial, pageSizeHistorial);
  }, [filteredHistorial, pageHistorial, pageSizeHistorial]);

  const conflictCount = useMemo(() => {
    let count = 0;
    conflictMap.forEach((conflicts) => {
      if (conflicts.length > 0) count++;
    });
    return count;
  }, [conflictMap]);

  const upcomingCitations = useMemo(() => {
    const today = getTodayDateStr();
    return [...historial]
      .filter(c => c.fecha && c.fecha >= today)
      .sort((a, b) => {
        const cmp = (a.fecha || '').localeCompare(b.fecha || '');
        if (cmp !== 0) return cmp;
        return (a.hora || '').localeCompare(b.hora || '');
      })
      .slice(0, 4);
  }, [historial]);

  const recentCitations = useMemo(() => {
    return [...historial].sort((a, b) => {
      const dateA = `${a.fecha || ''} ${a.hora || ''}`;
      const dateB = `${b.fecha || ''} ${b.hora || ''}`;
      const cmp = dateB.localeCompare(dateA);
      if (cmp !== 0) return cmp;
      return (b.creadoTimestamp || 0) - (a.creadoTimestamp || 0);
    }).slice(0, 5);
  }, [historial]);

  const investigatorInitials = useMemo(() => {
    const name = config.investigador || user?.displayName || user?.email || 'PJ';
    const clean = name.replace(/@.*/, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return 'PJ';
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  }, [config.investigador, user]);

  // ==========================================
  // CITATION ACTIONS & CRUD
  // ==========================================

  const handleRegisterManualCitation = async (data: Partial<Citacion>) => {
    try {
      await CitationService.createCitation(user, data, config);
      setIsManualFormOpen(false);
      showSuccessToast('Citación registrada exitosamente');
    } catch (e: any) {
      console.error(e);
      showRedErrorAlert("Error al registrar", "No se pudo guardar la citación.");
    }
  };

  const handleSaveEditedCitation = async (updated: Citacion) => {
    try {
      await CitationService.updateCitation(user, updated);
      setIsEditModalOpen(false);
      setEditingCitation(null);
      if (selectedCitation?.id === updated.id) {
        setSelectedCitation(updated);
      }
      showSuccessToast('Citación actualizada correctamente');
    } catch (e) {
      console.error(e);
      showRedErrorAlert("Error al actualizar", "No se pudieron guardar los cambios.");
    }
  };

  const handleDeleteCitation = async (id: string, name: string) => {
    const result = await Swal.fire({
      title: `<span style="color: #dc2626; font-size: 1.15rem; font-weight: 700;">¿Eliminar Citación?</span>`,
      text: `Se eliminará el registro de "${name}". Esta acción no se puede deshacer.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar'
    });

    if (result.isConfirmed) {
      try {
        await CitationService.deleteCitation(user, id);
        setSelectedIds(prev => prev.filter(item => item !== id));
        showSuccessToast('Citación eliminada');
      } catch (e) {
        console.error(e);
        showRedErrorAlert("Error", "No se pudo eliminar la citación.");
      }
    }
  };

  const handleMoveToCitado = async (c: Citacion) => {
    try {
      await CitationService.updateStatus(user, c.id, 'citado');
      showSuccessToast(`"${c.nombre}" movido a Citados`);
    } catch (e) {
      console.error(e);
      showRedErrorAlert("Error", "No se pudo cambiar el estado a citado.");
    }
  };

  const handleBulkMoveToCitado = async () => {
    if (selectedIds.length === 0) return;
    try {
      await CitationService.bulkUpdateStatus(user, selectedIds, 'citado');
      showSuccessToast(`${selectedIds.length} citaciones movidas a Citados`);
      setSelectedIds([]);
    } catch (e) {
      console.error(e);
      showRedErrorAlert("Error", "No se pudieron mover las citaciones.");
    }
  };

  const handleMarkAttendance = async (id: string, status: 'asistio' | 'no_asistio' | null) => {
    try {
      await CitationService.updateAttendance(user, id, status);
      showSuccessToast(status === 'asistio' ? 'Asistencia registrada' : status === 'no_asistio' ? 'Marcado como No Asistió' : 'Estado de asistencia restablecido');
    } catch (e) {
      console.error(e);
    }
  };

  const handleMarkReport = async (id: string, status: 'si' | 'no' | null) => {
    try {
      await CitationService.updateReport(user, id, status);
      showSuccessToast(status === 'si' ? 'Informe registrado' : status === 'no' ? 'Marcado sin informe' : 'Estado de informe restablecido');
    } catch (e) {
      console.error(e);
    }
  };

  const handleDownloadDocx = async (c: Citacion) => {
    try {
      await downloadCitationDocx(c, config, customTemplateBuffer);
      showSuccessToast('Documento Word (.docx) descargado');
    } catch (e) {
      console.error(e);
      showRedErrorAlert("Error de descarga", "No se pudo generar el archivo Word.");
    }
  };

  const handleCopyText = async (text: string, c: Citacion) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiadoIdx(c.id);
      setTimeout(() => setCopiadoIdx(null), 2000);
      showSuccessToast('Texto WhatsApp copiado');
    } catch (e) {
      console.error(e);
    }
  };

  const toggleSort = () => {
    setSortConfig(prev => ({
      key: 'fecha',
      direction: prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // ==========================================
  // AI EXTRACTION (PDF / GEMINI)
  // ==========================================

  const handleExtractFromPdf = async () => {
    if (!pdfFile) return;
    setLoadingExtract(true);

    try {
      const apiKey = process.env.GEMINI_API_KEY || import.meta.env.VITE_GEMINI_API_KEY;
      if (!apiKey) {
        throw new Error("No se detectó la clave de API de Gemini.");
      }

      const ai = new GoogleGenAI({ apiKey });
      const reader = new FileReader();

      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          const prompt = `Analiza este documento judicial de la Fiscalía General de la Nación de Colombia y extrae los siguientes datos en formato JSON estricto:
          - orden (Orden a Policía Judicial OPJ o número de orden)
          - nunc (Número Único de Noticia Criminal de 21 dígitos si está disponible)
          - fiscal (Nombre o despacho del Fiscal, ej. 17 Local)
          - nombre (Nombre completo de la persona a citar / indiciado / testigo / víctima)
          - identificacion (Número de documento o cédula si aparece)
          - delito (Delito o motivo de investigación)
          - fecha (Fecha sugerida en formato YYYY-MM-DD o vacía si no hay)
          - hora (Hora sugerida en formato HH:MM o vacía si no hay)
          - ciudad (Municipio o ciudad)`;

          const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
              {
                role: 'user',
                parts: [
                  { text: prompt },
                  { inlineData: { mimeType: pdfFile.type || 'application/pdf', data: base64Data } }
                ]
              }
            ],
            config: {
              responseMimeType: 'application/json'
            }
          });

          const parsed = JSON.parse(response.text || '{}');
          setPendingExtraction({
            orden: parsed.orden || 'Sin Orden',
            nunc: parsed.nunc || '',
            fiscal: parsed.fiscal || '17 Local',
            nombre: parsed.nombre || 'PERSONA EXTRAÍDA',
            identificacion: parsed.identificacion || '',
            delito: parsed.delito || '',
            ciudad: parsed.ciudad || config.municipio || 'Cartagena',
            fecha: parsed.fecha || getTodayDateStr(),
            hora: parsed.hora || '08:00'
          });
          showSuccessToast('Datos extraídos con Inteligencia Artificial');
        } catch (e: any) {
          console.error("Error al procesar con Gemini:", e);
          showRedErrorAlert("Error de extracción", "No se pudo interpretar el archivo PDF con IA.");
        } finally {
          setLoadingExtract(false);
        }
      };

      reader.readAsDataURL(pdfFile);
    } catch (err: any) {
      console.error(err);
      setLoadingExtract(false);
      showRedErrorAlert("Configuración de IA", err.message || "Error al inicializar IA.");
    }
  };

  // ==========================================
  // RENDER APP
  // ==========================================

  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white space-y-4">
        <Loader2 size={40} className="animate-spin text-fgn-gold" />
        <p className="font-bold text-xs uppercase tracking-widest text-slate-300">
          Iniciando Sistema Integrado de Citaciones Judiciales...
        </p>
      </div>
    );
  }

  // LOGIN SCREEN
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-700"
        >
          {/* HEADER */}
          <div className="bg-fgn-blue p-6 text-white text-center border-b-4 border-fgn-gold">
            <div className="w-16 h-16 bg-white/10 rounded-2xl flex items-center justify-center mx-auto mb-3 border border-fgn-gold/30">
              <Building2 size={32} className="text-fgn-gold" />
            </div>
            <h1 className="text-lg font-black tracking-tight uppercase">
              Fiscalía General de la Nación
            </h1>
            <p className="text-xs text-blue-200 uppercase font-semibold mt-1">
              Policía Judicial • SICIJ
            </p>
          </div>

          <div className="p-6 space-y-5">
            <div className="text-center space-y-1">
              <h2 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
                Sistema Integrado de Citaciones Judiciales
              </h2>
              <p className="text-[11px] text-slate-500">
                Gestión automatizada de formatos FPJ-35, agenda judicial y extracción con IA
              </p>
            </div>

            <div className="space-y-3 pt-2">
              <button
                onClick={handleGoogleLogin}
                disabled={isLoggingIn}
                className="w-full py-3.5 px-4 bg-fgn-blue hover:bg-black text-white font-bold rounded-xl text-xs uppercase tracking-widest transition-all shadow-md flex items-center justify-center gap-3 cursor-pointer"
              >
                {isLoggingIn ? (
                  <Loader2 size={16} className="animate-spin" />
                ) : (
                  <User size={16} />
                )}
                <span>Ingresar con Cuenta Google</span>
              </button>

              <button
                onClick={handleGuestLogin}
                className="w-full py-3 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs uppercase tracking-wider transition-colors flex items-center justify-center gap-2 cursor-pointer border border-slate-200"
              >
                <span>Ingresar como Invitado (Modo Local)</span>
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-gray text-text-main flex flex-col">
      {/* MODALS */}
      <CitationModal
        isOpen={isCitationModalOpen}
        citation={selectedCitation}
        config={config}
        customTemplateBuffer={customTemplateBuffer}
        onClose={() => {
          setIsCitationModalOpen(false);
          setSelectedCitation(null);
        }}
        onEdit={(cit) => {
          setIsCitationModalOpen(false);
          setEditingCitation(cit);
          setIsEditModalOpen(true);
        }}
        onDownloadDocx={handleDownloadDocx}
        conflictNames={selectedCitation ? conflictMap.get(selectedCitation.id) : []}
      />

      <SignatureModal
        isOpen={isSignatureModalOpen}
        config={config}
        customTemplateName={customTemplateName}
        onClose={() => setIsSignatureModalOpen(false)}
        onSaveConfig={handleSaveConfig}
        onUploadCustomTemplate={handleUploadCustomTemplate}
        onResetTemplate={handleResetTemplate}
      />

      <EditCitationModal
        isOpen={isEditModalOpen}
        citation={editingCitation}
        config={config}
        onClose={() => {
          setIsEditModalOpen(false);
          setEditingCitation(null);
        }}
        onSave={handleSaveEditedCitation}
      />

      {/* INSTITUTIONAL HEADER */}
      <header className="bg-fgn-blue text-white border-b-4 border-fgn-gold sticky top-0 z-40 shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div 
              onClick={() => setActiveMode(null)}
              className="bg-white/10 p-2 rounded-lg border border-fgn-gold/30 cursor-pointer hover:bg-white/20 transition-all"
              title="Volver al Inicio"
            >
              <Building2 size={20} className="text-fgn-gold" />
            </div>
            <div>
              <h1 
                onClick={() => setActiveMode(null)}
                className="text-xs sm:text-sm font-black uppercase tracking-wider cursor-pointer hover:text-fgn-gold transition-colors"
              >
                Fiscalía General de la Nación
              </h1>
              <p className="text-[9px] sm:text-[10px] text-blue-200 uppercase font-medium flex items-center gap-1.5">
                <span>Policía Judicial</span>
                <span>•</span>
                <span>SICIJ (FPJ-35)</span>
              </p>
            </div>
          </div>

          {/* TOP ACTIONS */}
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => setActiveMode(activeMode === 'calendar' ? null : 'calendar')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${activeMode === 'calendar' ? 'bg-fgn-gold text-slate-900 shadow-sm' : 'bg-white/10 hover:bg-white/20 text-white'}`}
              title="Ver Agenda y Calendario Judicial"
            >
              <CalendarRange size={14} />
              <span className="hidden sm:inline">Agenda Judicial</span>
            </button>

            <div className="h-6 w-px bg-white/20 mx-0.5 hidden sm:block" />

            {/* INVESTIGATOR AVATAR & NAME */}
            <div 
              onClick={() => setIsSignatureModalOpen(true)}
              className="flex items-center gap-2.5 bg-white/10 hover:bg-white/15 px-2.5 py-1 rounded-xl border border-white/15 cursor-pointer transition-all group"
              title="Configurar perfil institucional y firma digital"
            >
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fgn-gold to-amber-500 text-slate-950 font-black text-xs flex items-center justify-center shadow-xs border border-amber-300 font-mono tracking-wider shrink-0">
                {investigatorInitials}
              </div>
              <div className="text-left hidden sm:block">
                <span className="text-xs font-bold text-white block uppercase leading-tight truncate max-w-[170px] group-hover:text-fgn-gold transition-colors">
                  {config.investigador || 'Servidor Judicial'}
                </span>
                <span className="text-[9px] text-blue-200 block uppercase font-mono leading-none mt-0.5">
                  Policía Judicial
                </span>
              </div>
            </div>

            <button
              onClick={handleLogout}
              className="p-2 hover:bg-red-600/80 rounded-xl text-white/90 hover:text-white transition-colors cursor-pointer"
              title="Cerrar Sesión"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6 flex-1 w-full space-y-6">
        
        {/* DASHBOARD HOME VIEW */}
        {activeMode === null && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            {isManualFormOpen ? (
              <div className="bg-white border border-slate-200/90 rounded-2xl shadow-sm overflow-hidden">
                <div className="bg-gradient-to-r from-fgn-blue to-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 border-b-2 border-fgn-gold">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setIsManualFormOpen(false)}
                      className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors cursor-pointer"
                      title="Volver al Panel Principal"
                    >
                      <ArrowLeft size={18} />
                    </button>
                    <div>
                      <h2 className="text-sm sm:text-base font-black uppercase tracking-tight text-white flex items-center gap-2">
                        <FileText size={18} className="text-fgn-gold" /> Nueva Citación Judicial (Formato FPJ-35)
                      </h2>
                      <p className="text-[11px] text-blue-200">
                        Diligencie la información requerida para expedir el documento oficial
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setIsManualFormOpen(false)}
                    className="px-3.5 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded-lg text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer border border-white/20"
                  >
                    Cancelar y Volver
                  </button>
                </div>

                <div className="p-6">
                  <CitationForm
                    config={config}
                    onSubmit={handleRegisterManualCitation}
                    onCancel={() => setIsManualFormOpen(false)}
                  />
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                {/* EXECUTIVE OPERATIONAL STATUS BANNER */}
                <div className="bg-gradient-to-r from-[#002855] via-[#083366] to-[#0f4c81] text-white rounded-2xl p-6 shadow-md border border-fgn-gold/30">
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[9px] font-black uppercase tracking-widest bg-fgn-gold text-slate-950 px-2.5 py-0.5 rounded-md shadow-2xs">
                          SICIJ • POLICÍA JUDICIAL
                        </span>
                        <span className="text-[10px] text-blue-200 font-mono flex items-center gap-1">
                          <ShieldCheck size={12} className="text-emerald-400" /> Sistema Operativo
                        </span>
                      </div>
                      <h2 className="text-lg sm:text-xl font-black uppercase tracking-tight text-white">
                        Centro de Control y Gestión de Citaciones
                      </h2>
                      <p className="text-xs text-blue-200 flex items-center gap-2 flex-wrap">
                        <span>Servidor: <strong className="text-white font-bold">{config.investigador}</strong></span>
                        {config.placa && config.placa.trim() && config.placa !== 'No asignada' && config.placa !== 'N/A' && (
                          <>
                            <span>•</span>
                            <span>Placa: <strong className="text-white font-mono">{config.placa}</strong></span>
                          </>
                        )}
                        <span>•</span>
                        <span>Sede: <strong className="text-white">{config.instalaciones}</strong></span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2.5 flex-wrap">
                      <button
                        onClick={() => setIsManualFormOpen(true)}
                        className="px-4 py-2.5 bg-fgn-gold hover:bg-amber-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider transition-all shadow-md flex items-center gap-2 cursor-pointer"
                      >
                        <Plus size={16} />
                        <span>Generar Citación FPJ-35</span>
                      </button>
                      <button
                        onClick={() => setActiveMode('excel')}
                        className="px-3.5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all border border-white/20 flex items-center gap-1.5 cursor-pointer"
                      >
                        <FileSpreadsheet size={15} className="text-emerald-400" />
                        <span>Matriz Excel</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* 4 KPI METRIC CARDS */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  {/* PENDIENTES */}
                  <div
                    onClick={() => setActiveMode('pendientes')}
                    className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-2xs hover:shadow-md hover:border-red-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-red-600 uppercase tracking-wider bg-red-50 px-2 py-0.5 rounded border border-red-100">
                          Por Notificar
                        </span>
                        <div className="p-2 bg-red-50 text-red-600 rounded-xl group-hover:scale-110 transition-transform">
                          <ClipboardList size={18} />
                        </div>
                      </div>
                      <p className="text-3xl font-black text-slate-900 mt-3 font-mono">{personas.length}</p>
                      <p className="text-xs font-bold text-slate-700 mt-1">Citaciones Pendientes</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-red-600 font-bold">
                      <span>Revisar bandeja</span>
                      <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* CITADOS */}
                  <div
                    onClick={() => setActiveMode('citados')}
                    className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-2xs hover:shadow-md hover:border-emerald-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                          Diligenciadas
                        </span>
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl group-hover:scale-110 transition-transform">
                          <CheckCircle2 size={18} />
                        </div>
                      </div>
                      <p className="text-3xl font-black text-slate-900 mt-3 font-mono">{citados.length}</p>
                      <p className="text-xs font-bold text-slate-700 mt-1">Notificaciones Enviadas</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-emerald-700 font-bold">
                      <span>Ver registros citados</span>
                      <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* AGENDA */}
                  <div
                    onClick={() => setActiveMode('calendar')}
                    className="bg-white border border-slate-200/80 p-5 rounded-2xl shadow-2xs hover:shadow-md hover:border-blue-400 transition-all cursor-pointer group flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-black text-fgn-blue uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                          Programación
                        </span>
                        <div className="p-2 bg-blue-50 text-fgn-blue rounded-xl group-hover:scale-110 transition-transform">
                          <CalendarRange size={18} />
                        </div>
                      </div>
                      <p className="text-3xl font-black text-slate-900 mt-3 font-mono">{historial.length}</p>
                      <p className="text-xs font-bold text-slate-700 mt-1">Diligencias en Agenda</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-[11px] text-fgn-blue font-bold">
                      <span>Abrir calendario</span>
                      <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>

                  {/* CONFLICTOS DE HORARIO */}
                  <div
                    onClick={() => setActiveMode('calendar')}
                    className={`border p-5 rounded-2xl shadow-2xs hover:shadow-md transition-all cursor-pointer group flex flex-col justify-between ${conflictCount > 0 ? 'bg-red-50/70 border-red-300 hover:border-red-500' : 'bg-white border-slate-200/80 hover:border-fgn-blue'}`}
                  >
                    <div>
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded border ${conflictCount > 0 ? 'bg-red-600 text-white border-red-600 animate-pulse' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                          {conflictCount > 0 ? '¡Atención!' : 'Horarios'}
                        </span>
                        <div className={`p-2 rounded-xl group-hover:scale-110 transition-transform ${conflictCount > 0 ? 'bg-red-200 text-red-700' : 'bg-slate-100 text-slate-600'}`}>
                          {conflictCount > 0 ? <AlertTriangle size={18} /> : <Clock size={18} />}
                        </div>
                      </div>
                      <p className={`text-3xl font-black mt-3 font-mono ${conflictCount > 0 ? 'text-red-700' : 'text-slate-900'}`}>
                        {conflictCount > 0 ? `${conflictCount} Cruces` : '0 Cruces'}
                      </p>
                      <p className={`text-xs font-bold mt-1 ${conflictCount > 0 ? 'text-red-900' : 'text-slate-700'}`}>
                        {conflictCount > 0 ? 'Conflictos por resolver' : 'Agenda sin colisiones'}
                      </p>
                    </div>
                    <div className={`mt-4 pt-3 border-t flex items-center justify-between text-[11px] font-bold ${conflictCount > 0 ? 'border-red-200 text-red-700' : 'border-slate-100 text-slate-600'}`}>
                      <span>{conflictCount > 0 ? 'Resolver en Agenda' : 'Ver horarios libres'}</span>
                      <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
                    </div>
                  </div>
                </div>

                {/* WORKSTATION 3-COLUMN SECTIONS */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  
                  {/* COL 1: CENTRO DE GENERACIÓN FPJ-35 (5 COLS) */}
                  <div className="lg:col-span-5 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-5 flex flex-col justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-blue-50 text-fgn-blue rounded-xl border border-blue-100">
                          <FileText size={22} className="text-fgn-blue" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                            Emisión de Citaciones Judiciales
                          </h3>
                          <p className="text-xs text-slate-500">
                            Formato oficial FPJ-35 según directrices de Policía Judicial
                          </p>
                        </div>
                      </div>

                      <div className="space-y-2.5 pt-1">
                        <button
                          onClick={() => setIsManualFormOpen(true)}
                          className="w-full py-3.5 px-4 bg-fgn-blue hover:bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all shadow-sm flex items-center justify-between cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5">
                            <Plus size={16} className="text-fgn-gold" />
                            <span>Generar Citación Individual</span>
                          </div>
                          <ArrowRight size={15} className="text-blue-200 group-hover:translate-x-1 transition-transform" />
                        </button>

                        <button
                          onClick={() => setActiveMode('excel')}
                          className="w-full py-3 px-4 bg-indigo-50/80 hover:bg-indigo-100 text-indigo-950 border border-indigo-200/80 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-between cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5">
                            <FileSpreadsheet size={16} className="text-indigo-600" />
                            <span>Cargar Matriz Masiva (Excel)</span>
                          </div>
                          <span className="text-[10px] font-mono font-bold bg-indigo-200/80 text-indigo-900 px-2 py-0.5 rounded">
                            {excelRows.length} filas
                          </span>
                        </button>
                      </div>

                      {/* INSTITUTIONAL FEATURES */}
                      <div className="bg-slate-50 rounded-xl p-4 border border-slate-200/60 space-y-2 text-xs">
                        <p className="text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                          Garantías del Sistema
                        </p>
                        <div className="space-y-1.5 text-slate-600 text-[11px]">
                          <div className="flex items-center gap-2">
                            <Check size={13} className="text-emerald-600 shrink-0" />
                            <span>Estructura oficial FPJ-35 con pie de firma automático</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check size={13} className="text-emerald-600 shrink-0" />
                            <span>Exportación instantánea a documento Word (.docx)</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check size={13} className="text-emerald-600 shrink-0" />
                            <span>Mensaje estandarizado con enlace directo para WhatsApp</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Check size={13} className="text-emerald-600 shrink-0" />
                            <span>Verificación y alerta inteligente de cruces de horario</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                      <span className="font-mono text-[11px]">Total acumulado: <strong>{historial.length}</strong></span>
                      <button
                        onClick={() => setActiveMode('historial')}
                        className="text-fgn-blue hover:text-black font-bold uppercase text-[10px] tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ver archivo histórico</span>
                        <ChevronRight size={13} />
                      </button>
                    </div>
                  </div>

                  {/* COL 2: PRÓXIMAS DILIGENCIAS & AGENDA (4 COLS) */}
                  <div className="lg:col-span-4 bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="p-2 bg-amber-50 text-amber-700 rounded-xl border border-amber-200/60">
                            <CalendarRange size={18} className="text-fgn-gold" />
                          </div>
                          <div>
                            <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">
                              Próximas Diligencias
                            </h3>
                            <p className="text-[10px] text-slate-500">Agenda judicial programada</p>
                          </div>
                        </div>

                        <button
                          onClick={() => setActiveMode('calendar')}
                          className="p-1.5 text-slate-500 hover:text-fgn-blue hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                          title="Abrir Calendario"
                        >
                          <ArrowUpRight size={16} />
                        </button>
                      </div>

                      {/* UPCOMING LIST */}
                      {upcomingCitations.length > 0 ? (
                        <div className="space-y-2">
                          {upcomingCitations.map(cit => {
                            const hasConf = conflictMap.has(cit.id) && (conflictMap.get(cit.id)?.length || 0) > 0;
                            return (
                              <div
                                key={cit.id}
                                onClick={() => {
                                  setSelectedCitation(cit);
                                  setIsCitationModalOpen(true);
                                }}
                                className={`p-3 rounded-xl border transition-all cursor-pointer hover:shadow-2xs ${hasConf ? 'bg-red-50/60 border-red-200 hover:border-red-400' : 'bg-slate-50/80 border-slate-200/70 hover:border-slate-300'}`}
                              >
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-bold text-slate-800 uppercase truncate max-w-[170px]">
                                    {cit.nombre}
                                  </span>
                                  <span className="font-mono text-[10px] font-bold bg-white px-2 py-0.5 rounded border border-slate-200 text-fgn-blue">
                                    {cit.hora ? formatTimeAMPM(cit.hora) : 'Sin hora'}
                                  </span>
                                </div>
                                <div className="flex items-center justify-between text-[10px] text-slate-500 mt-1">
                                  <span>{formatDateES(cit.fecha || '')}</span>
                                  <span className="truncate max-w-[130px] font-medium">{cit.fiscal}</span>
                                </div>
                                {hasConf && (
                                  <span className="inline-flex items-center gap-1 text-[9px] font-black text-red-700 mt-1 uppercase">
                                    <AlertTriangle size={10} /> Conflicto de horario
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-6 text-center bg-slate-50 rounded-xl border border-slate-200/60 space-y-1">
                          <Calendar size={24} className="mx-auto text-slate-300" />
                          <p className="text-xs font-bold text-slate-600">Sin diligencias próximas</p>
                          <p className="text-[10px] text-slate-400">Genere nuevas citaciones para programar la agenda.</p>
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setActiveMode('calendar')}
                      className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200/80"
                    >
                      <CalendarRange size={14} className="text-fgn-blue" />
                      <span>Abrir Agenda Completa</span>
                    </button>
                  </div>

                  {/* COL 3: FICHA DE POLICÍA JUDICIAL & CONFIGURACIÓN (3 COLS) */}
                  <div className="lg:col-span-3 space-y-4">
                    {/* INVESTIGATOR OFFICIAL CARD */}
                    <div className="bg-gradient-to-b from-fgn-blue to-slate-900 text-white p-5 rounded-2xl border border-fgn-gold/40 shadow-md space-y-3.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[9px] font-black text-fgn-gold uppercase tracking-widest bg-white/10 px-2 py-0.5 rounded border border-fgn-gold/30">
                          Servidor Judicial
                        </span>
                      </div>

                      <div>
                        <h4 className="text-xs sm:text-sm font-black uppercase text-white tracking-tight">
                          {config.investigador}
                        </h4>
                        <p className="text-[11px] text-blue-200 font-medium">{config.grupoInvestigador}</p>
                        {config.placa && config.placa.trim() && config.placa !== 'No asignada' && (
                          <p className="text-[10px] text-blue-300 font-mono mt-0.5">
                            Placa: {config.placa}
                          </p>
                        )}
                      </div>

                      <div className="pt-2 border-t border-white/10 space-y-1.5 text-[10px] text-blue-200">
                        <p className="flex items-center gap-1.5 truncate">
                          <Phone size={12} className="text-fgn-gold shrink-0" />
                          <span>{config.telefono}</span>
                        </p>
                        <p className="flex items-center gap-1.5 truncate">
                          <MapPin size={12} className="text-fgn-gold shrink-0" />
                          <span>{config.instalaciones}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => setIsSignatureModalOpen(true)}
                        className="w-full py-2.5 bg-white/10 hover:bg-white/20 border border-fgn-gold/40 text-fgn-gold rounded-xl text-[11px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
                      >
                        <PenTool size={13} />
                        <span>Perfil y Firma Digital</span>
                      </button>
                    </div>

                    {/* HISTORICAL ARCHIVE SHORTCUT */}
                    <div className="bg-white border border-slate-200/80 p-4 rounded-2xl shadow-2xs space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-700 uppercase tracking-wider">
                          Archivo Consolidado
                        </span>
                        <span className="text-xs font-mono font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                          {historial.length}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-500 leading-tight">
                        Historial completo de citaciones expedidas y control de asistencia.
                      </p>
                      <button
                        onClick={() => setActiveMode('historial')}
                        className="w-full py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl text-[11px] font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-slate-200/60"
                      >
                        <History size={13} />
                        <span>Ver Archivo</span>
                      </button>
                    </div>
                  </div>

                </div>

                {/* RECENT ACTIVITY TABLE */}
                {recentCitations.length > 0 && (
                  <div className="bg-white border border-slate-200/80 rounded-2xl p-6 shadow-2xs space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                      <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                          <History size={16} className="text-fgn-blue" />
                          <span>Últimas Citaciones Tramitadas</span>
                        </h3>
                        <p className="text-xs text-slate-500">
                          Registro cronológico reciente en la plataforma SICIJ
                        </p>
                      </div>

                      <button
                        onClick={() => setActiveMode('historial')}
                        className="text-xs font-bold text-fgn-blue hover:text-black uppercase tracking-wider flex items-center gap-1 cursor-pointer"
                      >
                        <span>Ver todo el archivo ({historial.length})</span>
                        <ArrowRight size={13} />
                      </button>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider bg-slate-50/70">
                            <th className="py-2.5 px-3">Fecha & Hora</th>
                            <th className="py-2.5 px-3">Ciudadano Citado</th>
                            <th className="py-2.5 px-3">Orden OPJ</th>
                            <th className="py-2.5 px-3">Fiscal / Despacho</th>
                            <th className="py-2.5 px-3">Estado</th>
                            <th className="py-2.5 px-3 text-right">Acciones</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs">
                          {recentCitations.map(cit => {
                            const hasConf = conflictMap.has(cit.id) && (conflictMap.get(cit.id)?.length || 0) > 0;
                            const isNotified = cit.estado === 'citado';

                            return (
                              <tr key={cit.id} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <span className="font-bold text-slate-800 block text-[11px]">
                                    {formatDateES(cit.fecha || '')}
                                  </span>
                                  <span className="font-mono text-[10px] text-slate-500 font-bold">
                                    {cit.hora ? formatTimeAMPM(cit.hora) : 'Sin hora'}
                                  </span>
                                </td>
                                <td className="py-2.5 px-3">
                                  <span className="font-bold text-slate-800 uppercase block">{cit.nombre}</span>
                                  <span className="text-[10px] text-slate-500">{cit.motivo || cit.delito || 'Sin motivo especificado'}</span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600 font-bold">
                                  {cit.orden || '-'}
                                </td>
                                <td className="py-2.5 px-3 text-[11px] text-slate-700 font-medium">
                                  {cit.fiscal || '-'}
                                </td>
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="flex flex-col gap-1 items-start">
                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${isNotified ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
                                      {isNotified ? 'Citado' : 'Pendiente'}
                                    </span>
                                    {hasConf && (
                                      <span className="text-[8px] font-black text-red-600 uppercase bg-red-100 px-1.5 py-0.2 rounded">
                                        Cruce
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right whitespace-nowrap">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => {
                                        setSelectedCitation(cit);
                                        setIsCitationModalOpen(true);
                                      }}
                                      className="p-1.5 text-fgn-blue hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                      title="Ver Documento FPJ-35"
                                    >
                                      <Eye size={15} />
                                    </button>
                                    <button
                                      onClick={() => handleDownloadDocx(cit)}
                                      className="p-1.5 text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                                      title="Descargar Word .docx"
                                    >
                                      <FileDown size={15} />
                                    </button>
                                    <button
                                      onClick={() => {
                                        setEditingCitation(cit);
                                        setIsEditModalOpen(true);
                                      }}
                                      className="p-1.5 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                                      title="Editar Citación"
                                    >
                                      <Pencil size={15} />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* CALENDAR & AGENDA VIEW */}
        {activeMode === 'calendar' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveMode(null)}
                className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded-lg border border-fgn-border shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeft size={14} /> Volver al Inicio
              </button>
              <h2 className="text-lg font-bold text-fgn-blue uppercase flex items-center gap-2">
                <CalendarRange size={22} className="text-fgn-gold" /> Agenda Judicial y Detección de Conflictos
              </h2>
            </div>

            <JudicialCalendar
              citations={historial}
              config={config}
              onViewCitation={(c) => {
                setSelectedCitation(c);
                setIsCitationModalOpen(true);
              }}
              onEditCitation={(c) => {
                setEditingCitation(c);
                setIsEditModalOpen(true);
              }}
              onDownloadDocx={handleDownloadDocx}
              onMarkAttendance={handleMarkAttendance}
              onDeleteCitation={handleDeleteCitation}
              onUpdateCitation={handleSaveEditedCitation}
            />
          </motion.div>
        )}

        {/* PENDIENTES VIEW */}
        {activeMode === 'pendientes' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => {
                    setActiveMode(null);
                    setSelectedIds([]);
                  }}
                  className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded-lg border border-fgn-border shadow-sm transition-all cursor-pointer"
                >
                  <ArrowLeft size={14} /> Volver al Inicio
                </button>

                {selectedIds.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    onClick={handleBulkMoveToCitado}
                    className="flex items-center gap-2 bg-blue-600 text-white font-bold uppercase text-[10px] tracking-widest px-4 py-2 rounded-lg shadow-md hover:bg-blue-700 transition-all cursor-pointer"
                  >
                    <CheckCircle size={14} /> Mover Seleccionados ({selectedIds.length})
                  </motion.button>
                )}
              </div>

              <h2 className="text-xl font-bold text-red-600 uppercase tracking-tight flex items-center gap-3">
                <ClipboardList size={24} /> Listado de Citaciones Generadas
              </h2>
            </div>

            {/* Filter Bar */}
            <CitationFilterBar
              filters={filtersPendientes}
              onFilterChange={(newF) => {
                setFiltersPendientes(newF);
                setPagePendientes(1);
              }}
              fiscalOptions={fiscalOptions}
              showEstadoFilter={false}
              showInformeFilter={false}
              showAsistenciaFilter={false}
              totalCount={personas.length}
              filteredCount={filteredPendientes.length}
              placeholderSearch="BUSCAR EN GENERADAS (NOMBRE, CÉDULA, ORDEN OPJ)..."
            />

            {/* Table Container */}
            <div className="bg-white rounded-xl border border-fgn-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                {/* DESKTOP HEADER */}
                <div className="hidden md:grid bg-bg-gray px-6 py-3 border-b border-fgn-border grid-cols-12 gap-3 text-[9px] font-bold text-text-muted uppercase tracking-widest min-w-[960px]">
                  <div className="col-span-1 flex items-center justify-center">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-fgn-border text-fgn-blue focus:ring-fgn-blue cursor-pointer"
                      checked={paginatedPendientes.length > 0 && paginatedPendientes.every(p => selectedIds.includes(p.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(prev => Array.from(new Set([...prev, ...paginatedPendientes.map(p => p.id)])));
                        } else {
                          setSelectedIds(prev => prev.filter(id => !paginatedPendientes.some(p => p.id === id)));
                        }
                      }}
                    />
                  </div>
                  <div className="col-span-3">PARTICIPANTE</div>
                  <div className="col-span-1">ORDEN OPJ</div>
                  <div 
                    className="col-span-3 flex items-center gap-1.5 cursor-pointer hover:text-fgn-blue transition-colors group select-none"
                    onClick={toggleSort}
                    title={sortConfig.direction === 'desc' ? 'Orden: Más recientes primero (Clic para más antiguos)' : 'Orden: Más antiguos primero (Clic para más recientes)'}
                  >
                    <span>FECHA Y HORA</span>
                    <ArrowUpDown size={12} className={sortConfig.direction === 'desc' ? 'text-fgn-blue' : 'text-slate-400'} />
                    <span className="text-[8px] font-normal text-slate-400 normal-case hidden lg:inline">
                      ({sortConfig.direction === 'desc' ? 'recientes' : 'antiguos'})
                    </span>
                  </div>
                  <div className="col-span-4 text-right">ACCIONES</div>
                </div>

                {/* MOBILE CONTROLS BAR */}
                <div className="flex md:hidden bg-slate-100/90 px-3.5 py-2.5 border-b border-fgn-border items-center justify-between text-[11px] font-bold text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-fgn-border text-fgn-blue focus:ring-fgn-blue cursor-pointer"
                      checked={paginatedPendientes.length > 0 && paginatedPendientes.every(p => selectedIds.includes(p.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedIds(prev => Array.from(new Set([...prev, ...paginatedPendientes.map(p => p.id)])));
                        } else {
                          setSelectedIds(prev => prev.filter(id => !paginatedPendientes.some(p => p.id === id)));
                        }
                      }}
                    />
                    <span className="text-[10px] uppercase tracking-wider text-slate-600">Seleccionar todo</span>
                  </label>

                  <button 
                    onClick={toggleSort}
                    className="flex items-center gap-1 text-[10px] uppercase font-bold text-fgn-blue hover:text-blue-900 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs cursor-pointer"
                  >
                    <span>Fecha</span>
                    <ArrowUpDown size={11} className={sortConfig.direction === 'asc' ? 'text-fgn-blue' : 'text-slate-400'} />
                  </button>
                </div>

                {paginatedPendientes.length === 0 ? (
                  <div className="py-20 text-center">
                    <Check size={40} className="mx-auto text-green-300 mb-2" />
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      No hay citaciones pendientes con los filtros seleccionados
                    </p>
                  </div>
                ) : (
                  <CitationTable
                    citations={paginatedPendientes}
                    mode="pendientes"
                    config={config}
                    selectedIds={selectedIds}
                    onToggleSelect={(id) => {
                      setSelectedIds(prev => prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]);
                    }}
                    onView={(c) => {
                      setSelectedCitation(c);
                      setIsCitationModalOpen(true);
                    }}
                    onEdit={(c) => {
                      setEditingCitation(c);
                      setIsEditModalOpen(true);
                    }}
                    onDownloadDocx={handleDownloadDocx}
                    onMoveToCitado={handleMoveToCitado}
                    onDelete={handleDeleteCitation}
                    copiedId={copiadoIdx}
                    onCopyText={handleCopyText}
                    conflictMap={conflictMap}
                  />
                )}
              </div>

              {/* Pagination Controls */}
              <PaginationControls
                totalItems={filteredPendientes.length}
                currentPage={pagePendientes}
                pageSize={pageSizePendientes}
                onPageChange={setPagePendientes}
                onPageSizeChange={setPageSizePendientes}
                itemLabel="citaciones generadas"
              />
            </div>
          </motion.div>
        )}

        {/* CITADOS VIEW */}
        {activeMode === 'citados' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button
                onClick={() => setActiveMode(null)}
                className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded-lg border border-fgn-border shadow-sm transition-all cursor-pointer w-fit"
              >
                <ArrowLeft size={14} /> Volver al Inicio
              </button>

              <h2 className="text-xl font-bold text-green-600 uppercase tracking-tight flex items-center gap-3">
                <Check size={24} /> Listado de Citados (Enviados)
              </h2>
            </div>

            {/* Filter Bar */}
            <CitationFilterBar
              filters={filtersCitados}
              onFilterChange={(newF) => {
                setFiltersCitados(newF);
                setPageCitados(1);
              }}
              fiscalOptions={fiscalOptions}
              showEstadoFilter={false}
              showInformeFilter={true}
              showAsistenciaFilter={true}
              totalCount={citados.length}
              filteredCount={filteredCitados.length}
              placeholderSearch="BUSCAR EN CITADOS (NOMBRE, CÉDULA, ORDEN, FISCAL)..."
            />

            {/* Table Container */}
            <div className="bg-white rounded-xl border border-fgn-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                {/* DESKTOP HEADER */}
                <div className="hidden md:grid bg-bg-gray px-6 py-3 border-b border-fgn-border grid-cols-12 gap-3 text-[9px] font-bold text-text-muted uppercase tracking-widest min-w-[960px]">
                  <div className="col-span-3">PARTICIPANTE</div>
                  <div className="col-span-1">ORDEN OPJ</div>
                  <div 
                    className="col-span-2 flex items-center gap-1.5 cursor-pointer hover:text-fgn-blue transition-colors group select-none"
                    onClick={toggleSort}
                    title={sortConfig.direction === 'desc' ? 'Orden: Más recientes primero (Clic para más antiguos)' : 'Orden: Más antiguos primero (Clic para más recientes)'}
                  >
                    <span>FECHA Y HORA</span>
                    <ArrowUpDown size={12} className={sortConfig.direction === 'desc' ? 'text-fgn-blue' : 'text-slate-400'} />
                    <span className="text-[8px] font-normal text-slate-400 normal-case hidden lg:inline">
                      ({sortConfig.direction === 'desc' ? 'recientes' : 'antiguos'})
                    </span>
                  </div>
                  <div className="col-span-1 text-center">INFORME</div>
                  <div className="col-span-2 text-center">ASISTENCIA</div>
                  <div className="col-span-3 text-right">ACCIONES</div>
                </div>

                {/* MOBILE CONTROLS BAR */}
                <div className="flex md:hidden bg-slate-100/90 px-3.5 py-2.5 border-b border-fgn-border items-center justify-between text-[11px] font-bold text-slate-700">
                  <span className="text-[10px] uppercase tracking-wider text-slate-600 font-bold">
                    Mostrando {filteredCitados.length} citados
                  </span>
                  <button 
                    onClick={toggleSort}
                    className="flex items-center gap-1 text-[10px] uppercase font-bold text-fgn-blue hover:text-blue-900 bg-white px-2.5 py-1 rounded border border-slate-200 shadow-2xs cursor-pointer"
                  >
                    <span>Fecha</span>
                    <ArrowUpDown size={11} className={sortConfig.direction === 'asc' ? 'text-fgn-blue' : 'text-slate-400'} />
                  </button>
                </div>

                {paginatedCitados.length === 0 ? (
                  <div className="py-20 text-center">
                    <Search size={40} className="mx-auto text-slate-200 mb-2" />
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      No hay personas citadas con los filtros aplicados
                    </p>
                  </div>
                ) : (
                  <CitationTable
                    citations={paginatedCitados}
                    mode="citados"
                    config={config}
                    onView={(c) => {
                      setSelectedCitation(c);
                      setIsCitationModalOpen(true);
                    }}
                    onEdit={(c) => {
                      setEditingCitation(c);
                      setIsEditModalOpen(true);
                    }}
                    onDownloadDocx={handleDownloadDocx}
                    onDelete={handleDeleteCitation}
                    onMarkAttendance={handleMarkAttendance}
                    onMarkReport={handleMarkReport}
                    copiedId={copiadoIdx}
                    onCopyText={handleCopyText}
                    conflictMap={conflictMap}
                  />
                )}
              </div>

              {/* Pagination Controls */}
              <PaginationControls
                totalItems={filteredCitados.length}
                currentPage={pageCitados}
                pageSize={pageSizeCitados}
                onPageChange={setPageCitados}
                onPageSizeChange={setPageSizeCitados}
                itemLabel="personas citadas"
              />
            </div>
          </motion.div>
        )}

        {/* HISTORIAL / ARCHIVO VIEW */}
        {activeMode === 'historial' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button
                onClick={() => setActiveMode(null)}
                className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded-lg border border-fgn-border shadow-sm transition-all cursor-pointer w-fit"
              >
                <ArrowLeft size={14} /> Volver al Inicio
              </button>

              <h2 className="text-xl font-bold text-fgn-blue uppercase tracking-tight flex items-center gap-3">
                <History size={24} /> Archivo Histórico Consolidado
              </h2>
            </div>

            {/* Filter Bar */}
            <CitationFilterBar
              filters={filtersHistorial}
              onFilterChange={(newF) => {
                setFiltersHistorial(newF);
                setPageHistorial(1);
              }}
              fiscalOptions={fiscalOptions}
              showEstadoFilter={true}
              showInformeFilter={true}
              showAsistenciaFilter={true}
              totalCount={historial.length}
              filteredCount={filteredHistorial.length}
              placeholderSearch="BUSCAR EN ARCHIVO (NOMBRE, CÉDULA, ORDEN, FISCAL)..."
            />

            {/* Table Container */}
            <div className="bg-white rounded-xl border border-fgn-border overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                {/* DESKTOP HEADER */}
                <div className="hidden md:grid bg-bg-gray px-6 py-3 border-b border-fgn-border grid-cols-12 gap-3 text-[9px] font-bold text-text-muted uppercase tracking-widest min-w-[960px]">
                  <div className="col-span-3">PARTICIPANTE</div>
                  <div className="col-span-1">ORDEN OPJ</div>
                  <div 
                    className="col-span-2 flex items-center gap-1.5 cursor-pointer hover:text-fgn-blue transition-colors group select-none"
                    onClick={toggleSort}
                    title={sortConfig.direction === 'desc' ? 'Orden: Más recientes primero (Clic para más antiguos)' : 'Orden: Más antiguos primero (Clic para más recientes)'}
                  >
                    <span>FECHA Y HORA</span>
                    <ArrowUpDown size={12} className={sortConfig.direction === 'desc' ? 'text-fgn-blue' : 'text-slate-400'} />
                    <span className="text-[8px] font-normal text-slate-400 normal-case hidden lg:inline">
                      ({sortConfig.direction === 'desc' ? 'recientes' : 'antiguos'})
                    </span>
                  </div>
                  <div className="col-span-1 text-center">INFORME</div>
                  <div className="col-span-2 text-center">ASISTENCIA</div>
                  <div className="col-span-3 text-right">ACCIONES</div>
                </div>

                {paginatedHistorial.length === 0 ? (
                  <div className="py-20 text-center">
                    <History size={40} className="mx-auto text-slate-300 mb-2" />
                    <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">
                      No hay registros históricos con los filtros aplicados
                    </p>
                  </div>
                ) : (
                  <CitationTable
                    citations={paginatedHistorial}
                    mode="citados"
                    config={config}
                    onView={(c) => {
                      setSelectedCitation(c);
                      setIsCitationModalOpen(true);
                    }}
                    onEdit={(c) => {
                      setEditingCitation(c);
                      setIsEditModalOpen(true);
                    }}
                    onDownloadDocx={handleDownloadDocx}
                    onDelete={handleDeleteCitation}
                    onMarkAttendance={handleMarkAttendance}
                    onMarkReport={handleMarkReport}
                    copiedId={copiadoIdx}
                    onCopyText={handleCopyText}
                    conflictMap={conflictMap}
                  />
                )}
              </div>

              {/* Pagination Controls */}
              <PaginationControls
                totalItems={filteredHistorial.length}
                currentPage={pageHistorial}
                pageSize={pageSizeHistorial}
                onPageChange={setPageHistorial}
                onPageSizeChange={setPageSizeHistorial}
                itemLabel="registros en archivo"
              />
            </div>
          </motion.div>
        )}

        {/* EXCEL MATRIX VIEW */}
        {activeMode === 'excel' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6"
          >
            <div className="flex items-center justify-between">
              <button
                onClick={() => setActiveMode(null)}
                className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded-lg border border-fgn-border shadow-sm transition-all cursor-pointer"
              >
                <ArrowLeft size={14} /> Volver al Inicio
              </button>
              <h2 className="text-lg font-bold text-fgn-blue uppercase flex items-center gap-2">
                <FileSpreadsheet size={22} className="text-emerald-600" /> Matriz de Insumo Masivo (Excel)
              </h2>
            </div>

            <ExcelMatrixView
              rows={excelRows}
              onRowsChange={(newRows) => {
                setExcelRows(newRows);
                localStorage.setItem('fgn_insumo_excel_rows', JSON.stringify(newRows));
              }}
              onGenerateCitation={(row) => {
                const parsedDate = parseExcelDate(row.fechaDiligencia);
                const parsedTime = parseExcelTime(row.horaDiligencia);

                const newCit: Partial<Citacion> = {
                  nombre: row.nombreCompleto || 'CITADO INSUMO',
                  identificacion: row.cedula || '',
                  genero: row.genero || 'Femenino',
                  orden: row.ordenOpj || 'Sin Orden',
                  nunc: row.nunc || '',
                  fiscal: row.fiscal || '17 Local',
                  delito: row.delito || '',
                  fecha: parsedDate || getTodayDateStr(),
                  hora: parsedTime || '08:00',
                  telefono: row.telefono || '',
                  correo: row.correo || '',
                  ciudad: row.municipio || config.municipio || 'Cartagena',
                  direccion: row.direccion || '',
                  motivo: row.motivo || 'Entrevista',
                  requiereAbogado: row.requiereAbogado || 'NO',
                  observaciones: row.observaciones || DEFAULT_OBSERVACIONES
                };

                handleRegisterManualCitation(newCit);
              }}
            />
          </motion.div>
        )}

      </main>

      {/* FOOTER */}
      <footer className="w-full max-w-7xl mx-auto px-4 sm:px-6 mt-12 pb-8">
        <div className="border-t border-fgn-border/60 pt-6 flex flex-col md:flex-row justify-between items-center gap-3.5 text-center md:text-left">
          <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-[11px] text-text-muted font-medium">
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full text-emerald-800 font-bold text-[10px]">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>{user.isLocalGuest ? 'Almacenamiento Local (Invitado)' : 'Conectado a Firestore'}</span>
            </div>
            <span className="hidden sm:inline text-slate-300">•</span>
            <span className="text-slate-500 text-[10px] sm:text-[11px] font-semibold">
              Sistema Integrado de Citaciones Judiciales (SICIJ)
            </span>
          </div>
          <p className="text-[10px] sm:text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            © 2026 Fiscalía General de la Nación • República de Colombia
          </p>
        </div>
      </footer>
    </div>
  );
};

export default App;
