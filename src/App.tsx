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
  UserCheck, UserX, UserMinus, CheckCircle, RefreshCw, FileCode, PenTool,
  FileSpreadsheet
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateFPJ35WordDocument, generateCitationFromTemplate, downloadWordDocument } from './utils/docGenerator';
import { Citacion, CitacionFilters, PageSizeOption, ExcelInsumoRow } from './types';
import { CitationFilterBar } from './components/CitationFilterBar';
import { PaginationControls } from './components/PaginationControls';
import { filterCitations, paginateList, getUniqueFiscales } from './utils/filterUtils';
import { ExcelMatrixView, SAMPLE_EXCEL_ROWS, parseExcelDate, parseExcelTime } from './components/ExcelMatrixView';

// Firebase Imports
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInAnonymously, 
  onAuthStateChanged, 
  signOut,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { getFirestore, collection, doc, addDoc, deleteDoc, onSnapshot, query, getDocFromServer, setDoc, updateDoc } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

// Gemini AI SDK
import { GoogleGenAI, Type } from "@google/genai";
import Swal from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

// Institutional SweetAlert Helpers
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
          ${code ? `<p style="color: #b91c1c; font-size: 11px; margin-top: 6px; margin-bottom: 0; font-family: monospace; font-weight: 600;">Detalle de error: ${code}</p>` : ''}
        </div>
        <p style="color: #475569; font-size: 12px; line-height: 1.4; margin: 0;">
          Para trabajar de forma inmediata sin depender de la cuenta Google, puede hacer clic en <b>Ingresar como Invitado</b>.
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
    iconColor: '#003366',
    title: `<span style="font-size: 13px; font-weight: 600; color: #1e293b;">${title}</span>`,
    showConfirmButton: false,
    timer: 2500,
    timerProgressBar: true
  });
};

// Initialize Firebase with fallback to environment variables for Vercel deployment
const finalFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId
};

const app = initializeApp(finalFirebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app, finalFirebaseConfig.firestoreDatabaseId || undefined);
const appId = 'citaciones-judiciales-app';

// Initialize Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const DEFAULT_CONFIG = {
  investigador: "Investigador Judicial",
  entidadInvestigador: "CTI / Fiscalía General de la Nación",
  grupoInvestigador: "Unidad de Patrimonio Económico",
  correoInvestigador: "contacto.investigacion@fiscalia.gov.co",
  telefono: "3000000000",
  oficina: "Fiscalía General de la Nación - Unidad de Patrimonio Económico",
  departamento: "Bolívar",
  municipio: "Cartagena",
  instalaciones: "Fiscalía General de la Nación - Sede Canapote",
  direccionInstalaciones: "Cra. 17 # 32-10, Barrio Canapote",
  firmaInvestigador: ""
};

const App = () => {
  // Navigation & Auth States
  const [user, setUser] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [isLoggingInGoogle, setIsLoggingInGoogle] = useState(false);
  const isLoggingInRef = useRef(false);

  // Configuration States (Investigator Profile - Section 2 FPJ-35)
  // Kept completely independent between Guest (localStorage) and Google User (Firestore)
  const [config, setConfig] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_CONFIG;
    const isGuest = localStorage.getItem('fgn_guest_session') === 'true';
    const storageKey = isGuest ? 'fgn_guest_config' : 'fgn_investigator_config';
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return { ...DEFAULT_CONFIG, ...parsed };
      } catch (e) {
        console.error("Error cargando configuración guardada:", e);
      }
    }
    return DEFAULT_CONFIG;
  });

  // Data States
  const [personas, setPersonas] = useState<any[]>([]); // PENDIENTES
  const [citados, setCitados] = useState<any[]>([]); // CITADOS
  const [historial, setHistorial] = useState<any[]>([]); // ARCHIVO HISTÓRICO
  const [hasInitializedPendientes, setHasInitializedPendientes] = useState(false);
  const DEFAULT_OBSERVACIONES = "Presentar documento de identidad original y documentos que demuestren el detrimento patrimonial ocacionado en los hechos denunciados.";

  const getTodayDateStr = () => new Date().toISOString().split('T')[0];
  const getCurrentTimeStr = () => {
    const now = new Date();
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  };

  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'fecha', direction: 'asc' });
  const [nuevoDato, setNuevoDato] = useState({ 
    nombre: '', 
    identificacion: '',
    genero: 'Femenino', 
    direccion: '',
    correo: '',
    telefono: '',
    nunc: '',
    orden: '', 
    fecha: getTodayDateStr(), 
    hora: getCurrentTimeStr(), 
    fiscal: '17 Local', 
    motivo: 'Entrevista',
    requiereAbogado: 'NO',
    observaciones: DEFAULT_OBSERVACIONES
  });

  // UI Modal Tab
  const [modalTab, setModalTab] = useState<'fpj35' | 'whatsapp'>('fpj35');

  // AI & File States
  const [rawText, setRawText] = useState("");
  const [loadingIA, setLoadingIA] = useState(false);
  const [loadingText, setLoadingText] = useState("Procesando...");
  const [pendingExtraction, setPendingExtraction] = useState<any>(null); 
  const [copiadoIdx, setCopiadoIdx] = useState<string | number | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [customTemplateBuffer, setCustomTemplateBuffer] = useState<ArrayBuffer | undefined>(undefined);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Insumo Hoja de Cálculo (Excel)
  const [excelRows, setExcelRows] = useState<ExcelInsumoRow[]>(() => {
    try {
      const saved = localStorage.getItem('sicij_excel_matrix');
      if (saved !== null) {
        const parsed: ExcelInsumoRow[] = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          return parsed.map(r => ({
            ...r,
            fecha: parseExcelDate(r.fecha),
            hora: parseExcelTime(r.hora)
          }));
        }
      }
      return SAMPLE_EXCEL_ROWS;
    } catch (e) {
      return SAMPLE_EXCEL_ROWS;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('sicij_excel_matrix', JSON.stringify(excelRows));
    } catch (e) {
      console.error("Error al guardar filas de Excel en localStorage:", e);
    }
  }, [excelRows]);

  // Independent Filter & Pagination States for each view
  const [filtersPendientes, setFiltersPendientes] = useState<CitacionFilters>({
    searchTerm: '',
    fiscal: 'todos',
    fechaFiltro: 'todas',
  });
  const [pagePendientes, setPagePendientes] = useState<number>(1);
  const [pageSizePendientes, setPageSizePendientes] = useState<PageSizeOption>(10);

  const [filtersCitados, setFiltersCitados] = useState<CitacionFilters>({
    searchTerm: '',
    fiscal: 'todos',
    fechaFiltro: 'todas',
    asistencia: 'todas',
    informe: 'todos',
  });
  const [pageCitados, setPageCitados] = useState<number>(1);
  const [pageSizeCitados, setPageSizeCitados] = useState<PageSizeOption>(10);

  const [filtersHistorial, setFiltersHistorial] = useState<CitacionFilters>({
    searchTerm: '',
    fiscal: 'todos',
    fechaFiltro: 'todas',
    estado: 'todos',
    asistencia: 'todas',
    informe: 'todos',
  });
  const [pageHistorial, setPageHistorial] = useState<number>(1);
  const [pageSizeHistorial, setPageSizeHistorial] = useState<PageSizeOption>(10);

  // Unique Fiscal options across all data
  const fiscalOptions = useMemo(() => {
    const combined = [...historial, ...personas, ...citados];
    return getUniqueFiscales(combined);
  }, [historial, personas, citados]);

  const getSortedList = (list: any[]) => {
    return [...list].sort((a, b) => {
      const dateA = a.fecha || '1970-01-01';
      const timeA = a.hora || '00:00';
      const dateB = b.fecha || '1970-01-01';
      const timeB = b.hora || '00:00';
      
      // Compare dates first
      if (dateA !== dateB) {
        return sortConfig.direction === 'asc' 
          ? dateA.localeCompare(dateB) 
          : dateB.localeCompare(dateA);
      }
      
      // If dates are equal, compare times
      return sortConfig.direction === 'asc' 
        ? timeA.localeCompare(timeB) 
        : timeB.localeCompare(timeA);
    });
  };

  const toggleSort = () => {
    setSortConfig(prev => ({
      key: 'fecha',
      direction: prev.direction === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Pipeline for Pendientes (Citaciones Generadas)
  const filteredPendientes = useMemo(() => {
    return filterCitations(personas, filtersPendientes);
  }, [personas, filtersPendientes]);

  const sortedPendientes = useMemo(() => {
    return getSortedList(filteredPendientes);
  }, [filteredPendientes, sortConfig]);

  const paginatedPendientes = useMemo(() => {
    return paginateList(sortedPendientes, pagePendientes, pageSizePendientes);
  }, [sortedPendientes, pagePendientes, pageSizePendientes]);

  // Pipeline for Citados
  const filteredCitados = useMemo(() => {
    return filterCitations(citados, filtersCitados);
  }, [citados, filtersCitados]);

  const sortedCitados = useMemo(() => {
    return getSortedList(filteredCitados);
  }, [filteredCitados, sortConfig]);

  const paginatedCitados = useMemo(() => {
    return paginateList(sortedCitados, pageCitados, pageSizeCitados);
  }, [sortedCitados, pageCitados, pageSizeCitados]);

  // Pipeline for Historial (Archivo General)
  const filteredHistorial = useMemo(() => {
    return filterCitations(historial, filtersHistorial);
  }, [historial, filtersHistorial]);

  const sortedHistorial = useMemo(() => {
    return getSortedList(filteredHistorial);
  }, [filteredHistorial, sortConfig]);

  const paginatedHistorial = useMemo(() => {
    return paginateList(sortedHistorial, pageHistorial, pageSizeHistorial);
  }, [sortedHistorial, pageHistorial, pageSizeHistorial]);

  // Handler helpers that also reset the page to 1
  const handleFilterChangePendientes = (newFilters: CitacionFilters) => {
    setFiltersPendientes(newFilters);
    setPagePendientes(1);
  };

  const handleFilterChangeCitados = (newFilters: CitacionFilters) => {
    setFiltersCitados(newFilters);
    setPageCitados(1);
  };

  const handleFilterChangeHistorial = (newFilters: CitacionFilters) => {
    setFiltersHistorial(newFilters);
    setPageHistorial(1);
  };

  // (1) Authentication & Connection Check
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        // Authenticated Google User
        setUser(u);
        localStorage.removeItem('fgn_guest_session');
        
        // Note: Strict independence - NO migration of guest data!
        // Guest data remains stored exclusively in browser localStorage ('fgn_guest_historial')
        // and is never mixed into the Google user's Firestore database.

        // Load Profile for this Google user from Firestore
        try {
          const userDoc = await getDocFromServer(doc(db, 'users', u.uid));
          if (userDoc.exists() && userDoc.data().config) {
            const remoteConfig = userDoc.data().config;
            setConfig({ ...DEFAULT_CONFIG, ...remoteConfig });
            try {
              localStorage.setItem(`fgn_google_config_${u.uid}`, JSON.stringify(remoteConfig));
            } catch (err) {}
          } else {
            // Initial save of config to Firestore for this Google account
            await setDoc(doc(db, 'users', u.uid), {
              lastSeen: new Date().toISOString(),
              email: u.email || 'investigador',
              config: DEFAULT_CONFIG
            }, { merge: true });
            setConfig(DEFAULT_CONFIG);
          }
        } catch (e) {
          console.warn("User data loading/sync skipped", e);
        }
      } else {
        // Restore guest session if previously active
        const isGuestSession = localStorage.getItem('fgn_guest_session') === 'true';
        if (isGuestSession) {
          const guestUid = localStorage.getItem('fgn_guest_uid') || `guest_${Date.now()}`;
          localStorage.setItem('fgn_guest_uid', guestUid);

          // Load independent guest profile from localStorage
          try {
            const guestConfig = localStorage.getItem('fgn_guest_config');
            if (guestConfig) {
              setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(guestConfig) });
            } else {
              setConfig(DEFAULT_CONFIG);
            }
          } catch (e) {
            setConfig(DEFAULT_CONFIG);
          }

          setUser({
            uid: guestUid,
            isAnonymous: true,
            isLocalGuest: true,
            displayName: 'Funcionario Invitado',
            email: null
          });
        } else {
          setUser(null);
        }
      }
    });

    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error: any) {
        if (error.message && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
        }
      }
    };
    testConnection();

    return () => unsubscribeAuth();
  }, []);

  const handleGoogleLogin = async () => {
    if (isLoggingInRef.current) return;
    isLoggingInRef.current = true;
    setIsLoggingInGoogle(true);

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({
      prompt: 'select_account'
    });

    try {
      // Clear in-memory lists before switching to Google account to ensure clean separation
      setPersonas([]);
      setCitados([]);
      setHistorial([]);
      await signInWithPopup(auth, provider);
      showSuccessToast('Sesión iniciada con Google');
    } catch (error: any) {
      console.error("Error signing in with Google:", error);

      if (error?.code === 'auth/popup-blocked') {
        showRedAuthErrorAlert(
          "Ventana Emergente Bloqueada",
          "El navegador bloqueó la ventana emergente de inicio de sesión de Google. Habilite las ventanas emergentes (pop-ups) en la barra de direcciones o abra la aplicación en una pestaña nueva.",
          error?.code
        );
      } else if (
        error?.code === 'auth/cancelled-popup-request' || 
        error?.code === 'auth/popup-closed-by-user'
      ) {
        showRedAuthErrorAlert(
          "Inicio de Sesión Interrumpido",
          "La ventana emergente de Google fue cerrada o cancelada antes de finalizar la autenticación.",
          error?.code
        );
      } else if (error?.code === 'auth/unauthorized-domain') {
        showRedAuthErrorAlert(
          "Dominio no Autorizado en Firebase",
          "El dominio actual no está habilitado en Firebase Authentication > Settings > Dominios autorizados.",
          error?.code
        );
      } else {
        showRedAuthErrorAlert(
          "Error al Iniciar Sesión",
          error?.message || "Ocurrió un error inesperado al intentar autenticar con la cuenta de Google.",
          error?.code
        );
      }
    } finally {
      isLoggingInRef.current = false;
      setIsLoggingInGoogle(false);
    }
  };

  const handleGuestLogin = async () => {
    // If currently signed into Firebase with Google, sign out first to ensure complete data isolation
    if (auth.currentUser) {
      try {
        await signOut(auth);
      } catch (e) {}
    }

    const guestUid = localStorage.getItem('fgn_guest_uid') || `guest_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    localStorage.setItem('fgn_guest_uid', guestUid);
    localStorage.setItem('fgn_guest_session', 'true');

    // Load independent guest profile from localStorage
    try {
      const guestConfig = localStorage.getItem('fgn_guest_config');
      if (guestConfig) {
        setConfig({ ...DEFAULT_CONFIG, ...JSON.parse(guestConfig) });
      } else {
        setConfig(DEFAULT_CONFIG);
      }
    } catch (e) {
      setConfig(DEFAULT_CONFIG);
    }

    // Load independent guest history strictly from localStorage
    try {
      const stored = localStorage.getItem('fgn_guest_historial');
      const docs = stored ? JSON.parse(stored) : [];
      const sorted = docs.sort((a: any, b: any) => (b.creadoTimestamp || 0) - (a.creadoTimestamp || 0));
      setHistorial(sorted);
      setPersonas(sorted.filter((d: any) => !d.estado || d.estado === 'pendiente'));
      setCitados(sorted.filter((d: any) => d.estado === 'citado'));
      setHasInitializedPendientes(true);
    } catch (e) {
      console.error("Error reading local guest history:", e);
    }

    setUser({
      uid: guestUid,
      isAnonymous: true,
      isLocalGuest: true,
      displayName: 'Funcionario Invitado',
      email: null
    });
    showSuccessToast('Ingreso en Modo Invitado local');
  };

  const handleLogout = async () => {
    const result = await Swal.fire({
      title: '¿Cerrar Sesión?',
      text: user?.isLocalGuest 
        ? 'Saldrá del Modo Invitado. Sus datos locales permanecerán guardados en este navegador.' 
        : 'Se cerrará su sesión de Google.',
      icon: 'question',
      iconColor: '#003366',
      showCancelButton: true,
      confirmButtonColor: '#003366',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, cerrar sesión',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });
    if (!result.isConfirmed) return;

    localStorage.removeItem('fgn_guest_session');
    if (auth.currentUser) {
      try {
        await signOut(auth);
      } catch (err) {}
    }
    setUser(null);
    setPersonas([]);
    setCitados([]);
    setHistorial([]);
    setConfig(DEFAULT_CONFIG);
    showInfoToast('Sesión finalizada');
  };

  // Persist Profile Changes independently (Guest in localStorage, Google in Firestore)
  useEffect(() => {
    if (!user) return;

    if (user.isLocalGuest) {
      try {
        localStorage.setItem('fgn_guest_config', JSON.stringify(config));
      } catch (e) {
        console.error("Error saving guest profile to localStorage:", e);
      }
      return;
    }

    // Google authenticated user: save to Firestore & cached localStorage
    try {
      localStorage.setItem(`fgn_google_config_${user.uid}`, JSON.stringify(config));
    } catch (e) {}

    const saveConfig = async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), { config }, { merge: true });
      } catch (e) {
        console.error("Error saving profile to Firestore:", e);
      }
    };

    const timeout = setTimeout(saveConfig, 500);
    return () => clearTimeout(timeout);
  }, [config, user]);

  // (2) Listen to History from Firestore or load from localStorage for local guest
  useEffect(() => {
    if (!user) return;

    if (user.isLocalGuest) {
      try {
        const stored = localStorage.getItem('fgn_guest_historial');
        const docs = stored ? JSON.parse(stored) : [];
        const sorted = docs.sort((a: any, b: any) => (b.creadoTimestamp || 0) - (a.creadoTimestamp || 0));
        setHistorial(sorted);
        setPersonas(sorted.filter((d: any) => !d.estado || d.estado === 'pendiente'));
        setCitados(sorted.filter((d: any) => d.estado === 'citado'));
        setHasInitializedPendientes(true);
      } catch (e) {
        console.error("Error reading local guest history:", e);
      }
      return;
    }

    const historialRef = collection(db, 'artifacts', appId, 'users', user.uid, 'historial');
    const q = query(historialRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as any[];
      
      // Sort by creation timestamp descending
      const sorted = docs.sort((a, b) => b.creadoTimestamp - a.creadoTimestamp);
      setHistorial(sorted);

      // Separate based on stored status
      const pendingOnDB = sorted.filter(d => !d.estado || d.estado === 'pendiente');
      const citedOnDB = sorted.filter(d => d.estado === 'citado');

      // Update local states reactively from DB
      setPersonas(pendingOnDB);
      setCitados(citedOnDB);
      
      setHasInitializedPendientes(true);
    }, (error) => {
      console.error("Error fetching history:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // (3) Reset tray when returning to main menu
  useEffect(() => {
    if (activeMode === null) {
      setPendingExtraction(null);
      setRawText("");
    }
  }, [activeMode]);

  // Helpers
  const formatDateES = (dateStr: string) => {
    if (!dateStr || !dateStr.includes('-')) return dateStr;
    const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
    const [year, month, day] = dateStr.split('-');
    return `${parseInt(day)} de ${months[parseInt(month) - 1]} del ${year}`;
  };

  const formatTimeAMPM = (timeStr: string) => {
    if (!timeStr || !timeStr.includes(':')) return timeStr;
    let [hoursStr, minutes] = timeStr.split(':');
    let hours = parseInt(hoursStr);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    return `${hours}:${minutes} ${ampm}`;
  };

  const registrarCitacion = async (data: any) => {
    if (!user) return;
    
    try {
      const todayDate = data.fecha || getTodayDateStr();
      const todayTime = data.hora || getCurrentTimeStr();

      const item = { 
        ...data, 
        fecha: todayDate,
        hora: todayTime,
        fechaExpedicion: data.fechaExpedicion || todayDate,
        horaExpedicion: data.horaExpedicion || todayTime,
        estado: 'pendiente', // Default status
        // Capture full Section 2 profile at creation time
        investigador_creador: config.investigador,
        entidadInvestigador: config.entidadInvestigador,
        grupoInvestigador: config.grupoInvestigador,
        correoInvestigador: config.correoInvestigador,
        telefono_creador: config.telefono,
        oficina_creador: config.oficina,
        departamento: config.departamento,
        municipio: config.municipio,
        instalaciones: data.instalaciones || config.instalaciones,
        direccionInstalaciones: data.direccionInstalaciones || config.direccionInstalaciones,
        creadoEl: new Date().toLocaleString('es-CO'),
        creadoTimestamp: Date.now()
      };
      
      if (user.isLocalGuest) {
        const newItem = { 
          ...item, 
          id: `cit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}` 
        };
        setHistorial(prev => {
          const next = [newItem, ...prev];
          try {
            localStorage.setItem('fgn_guest_historial', JSON.stringify(next));
          } catch (e) {}
          return next;
        });
        setPersonas(prev => [newItem, ...prev]);
        return;
      }

      // Firestore history
      const historialRef = collection(db, 'artifacts', appId, 'users', user.uid, 'historial');
      await addDoc(historialRef, item);
      
      // No need to set personas directly, the onSnapshot listener handles it
    } catch (err) {
      console.error("Error registering citation:", err);
    }
  };

  const generarCitacionesDesdeExcel = async () => {
    if (!user) {
      setIsModalOpen(true);
      return;
    }

    const pendingRows = excelRows.filter(r => !r.generada);

    if (excelRows.length === 0) {
      showRedErrorAlert(
        "Hoja de Cálculo Vacía",
        "No hay datos almacenados en la hoja de cálculo. Ingrese a la Hoja de Cálculo para cargar las filas de insumo."
      );
      return;
    }

    if (pendingRows.length === 0) {
      showRedErrorAlert(
        "Sin Citaciones Pendientes",
        "Todas las filas en la hoja de cálculo ya han sido generadas previamente. Ingrese o pegue nueva información en la tabla para generar citaciones adicionales."
      );
      return;
    }

    const count = pendingRows.length;
    const confirmResult = await Swal.fire({
      title: `<span style="color: #003366; font-weight: 800;">¿Generar ${count} Citaciones?</span>`,
      html: `
        <div style="text-align: left; font-size: 13px; color: #334155; line-height: 1.6;">
          <p style="margin: 0 0 10px 0;">Se tomarán las <b>${count} filas pendientes</b> detectadas en la hoja de cálculo y se creará una citación judicial oficial para cada una.</p>
          <div style="padding: 10px 14px; background-color: #f1f5f9; border-left: 4px solid #003366; border-radius: 6px;">
            <p style="margin: 0; font-weight: 600; color: #003366;">⚡ Control de Generación:</p>
            <p style="margin: 4px 0 0 0; color: #475569; font-size: 12px;">Una vez generadas, estas filas quedarán marcadas en la tabla con la columna <b>GENERADA: SÍ</b>. Al agregar o pegar nuevas filas en el futuro, el sistema reconocerá automáticamente solo las pendientes.</p>
          </div>
        </div>
      `,
      icon: 'question',
      iconColor: '#003366',
      showCancelButton: true,
      confirmButtonColor: '#003366',
      cancelButtonColor: '#64748b',
      confirmButtonText: `Sí, generar ${count} citaciones`,
      cancelButtonText: 'Cancelar'
    });

    if (!confirmResult.isConfirmed) return;

    setLoadingText(`Generando ${count} citaciones desde Hoja de Cálculo...`);
    setLoadingIA(true);

    try {
      for (const row of pendingRows) {
        const citacionData = {
          ot: row.ot?.trim() || '',
          orden: row.opj?.trim() || row.ot?.trim() || 'Sin Orden',
          nunc: row.nunc?.trim() || '',
          fiscal: row.fiscal?.trim() || '17 Local',
          nombre: row.nombre?.trim() || 'CIUDADANO POR CITAR',
          identificacion: row.cedula?.trim() || '',
          direccion: row.direccion?.trim() || '',
          telefono: row.telefono?.trim() || '',
          correo: row.correo?.trim() || '',
          fecha: row.fecha?.trim() || getTodayDateStr(),
          hora: row.hora?.trim() || getCurrentTimeStr(),
          genero: 'Femenino',
          ciudad: config.municipio || 'Cartagena',
          unidad: config.grupoInvestigador || 'Unidad de Patrimonio Económico',
          instalaciones: config.instalaciones || 'Fiscalía General de la Nación - Sede Canapote',
          direccionInstalaciones: config.direccionInstalaciones || '',
          motivo: 'Entrevista',
          requiereAbogado: 'NO',
          observaciones: DEFAULT_OBSERVACIONES
        };
        await registrarCitacion(citacionData);
      }

      // Marcar las filas procesadas como generadas en la hoja de cálculo
      const nowStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const updatedRows = excelRows.map(row => {
        if (!row.generada) {
          return {
            ...row,
            generada: true,
            fechaGeneracion: nowStr
          };
        }
        return row;
      });

      setExcelRows(updatedRows);
      try {
        localStorage.setItem('sicij_excel_matrix', JSON.stringify(updatedRows));
      } catch (e) {}

      setLoadingIA(false);

      Swal.fire({
        toast: true,
        position: 'top-end',
        icon: 'success',
        iconColor: '#16a34a',
        title: `¡${count} citación(es) generada(s) exitosamente!`,
        text: 'Las filas fueron marcadas como GENERADAS (fondo amarillo) en la hoja de cálculo.',
        showConfirmButton: false,
        timer: 3500,
        timerProgressBar: true
      });

      setActiveMode('pendientes');
    } catch (err: any) {
      console.error("Error al generar citaciones desde Excel:", err);
      setLoadingIA(false);
      showRedErrorAlert(
        "Error al Generar Citaciones",
        "Ocurrió un error inesperado al procesar las filas de la hoja de cálculo."
      );
    }
  };

  const processFile = async (file: File) => {
    if (!file) return;
    setLoadingText("Analizando Orden Judicial (PDF)...");
    setLoadingIA(true);
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64 = (reader.result as string).split(',')[1];
        
        const response = await ai.models.generateContent({
          model: "gemini-3-flash-preview",
          contents: {
            parts: [
              { text: "Analiza esta Orden a la Policía Judicial en PDF. Extrae los siguientes datos en formato JSON puro (sin bloques de código markdown): { nunc (Noticia Criminal de 21 dígitos si la encuentras), orden (número de orden OPJ/OT/Caso), nombre (nombre completo del citado/victima/testigo/imputado), identificacion (número de cedula/documento si está), genero (Femenino o Masculino), direccion (residencia/notificacion), correo, telefono, ciudad, fiscal (ej: '17 Local'), unidad (ej: 'Patrimonio Económico' o 'Hurtos'), instalaciones (lugar de comparecencia si se indica), motivo, requiereAbogado ('SI' o 'NO'), observaciones }." },
              { inlineData: { mimeType: "application/pdf", data: base64 } }
            ]
          },
          config: {
            responseMimeType: "application/json"
          }
        });

        const parsed = JSON.parse(response.text);
        setPendingExtraction({ 
          nunc: parsed.nunc || '',
          orden: parsed.orden || '',
          nombre: parsed.nombre || '',
          identificacion: parsed.identificacion || '',
          genero: parsed.genero || 'Femenino',
          direccion: parsed.direccion || '',
          correo: parsed.correo || '',
          telefono: parsed.telefono || '',
          ciudad: config.municipio,
          fiscal: parsed.fiscal || '17 Local',
          unidad: config.grupoInvestigador,
          instalaciones: config.instalaciones,
          direccionInstalaciones: config.direccionInstalaciones,
          motivo: parsed.motivo === 'Interrogatorio' ? 'Interrogatorio' : 'Entrevista',
          requiereAbogado: parsed.requiereAbogado || 'NO',
          observaciones: DEFAULT_OBSERVACIONES,
          fecha: parsed.fecha || getTodayDateStr(), 
          hora: parsed.hora || getCurrentTimeStr() 
        });
      } catch (err) {
        console.error("Error analyzing PDF:", err);
      } finally {
        setLoadingIA(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSmartExtract = async () => {
    if (!rawText.trim()) {
      Swal.fire({
        icon: 'warning',
        iconColor: '#003366',
        title: 'Texto requerido',
        text: 'Por favor pegue el texto de la orden judicial o actuaciones antes de procesar con Inteligencia Artificial.',
        confirmButtonColor: '#003366',
        confirmButtonText: 'Entendido'
      });
      return;
    }
    setLoadingText("Extrayendo citaciones del texto...");
    setLoadingIA(true);
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analiza el siguiente texto que contiene datos de citaciones judiciales. El texto puede venir en formato de tabla (TABS) o párrafos informales.
        
        ESTRUCTURA DE REFERENCIA PARA TABS:
        OT | NUMERO_OPJ | NUMERO_CASO | FISCALIA | NOMBRE | TELEFONO | CORREO | FECHA | HORA
        
        RESTRICCIONES CRÍTICAS: 
        1. Solo extrae: NUMERO_OPJ (orden), FISCALIA (fiscal), NOMBRE (nombre), FECHA (fecha) y HORA (hora).
        2. La unidad debe ser obligatoriamente 'Patrimonio Económico'.
        3. Normaliza la FECHA estrictamente a formato 'YYYY-MM-DD'. Si el año no está presente, usa 2026.
        4. Identifica el género basado en el nombre del citado.
        5. Devuelve la lista completa de personas encontradas.
        
        TEXTO A PROCESAR:
        ${rawText}`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              personas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    nombre: { type: Type.STRING },
                    genero: { type: Type.STRING, enum: ["Masculino", "Femenino"] },
                    orden: { type: Type.STRING },
                    fiscal: { type: Type.STRING },
                    unidad: { type: Type.STRING },
                    fecha: { type: Type.STRING },
                    hora: { type: Type.STRING }
                  },
                  required: ["nombre", "genero", "orden", "fecha", "hora"]
                }
              }
            },
            required: ["personas"]
          }
        }
      });

      const textResponse = response.text;
      if (!textResponse) {
        throw new Error("La IA no pudo procesar el contenido.");
      }
      
      const parsed = JSON.parse(textResponse);
      
      if (parsed.personas && Array.isArray(parsed.personas) && parsed.personas.length > 0) {
        for (const p of parsed.personas) {
          try {
            await registrarCitacion({
              nombre: p.nombre || "",
              genero: p.genero || "Femenino",
              orden: p.orden || "SIN ORDEN",
              fiscal: p.fiscal || '17 Local',
              unidad: p.unidad || 'Patrimonio Económico',
              fecha: p.fecha || "",
              hora: p.hora || ""
            });
          } catch (regErr) {
            console.error("Error registrando citación individual:", regErr);
          }
        }
        setRawText("");
        Swal.fire({
          icon: 'success',
          iconColor: '#16a34a',
          title: '<span style="color: #003366; font-weight: 800;">¡Extracción Exitosa!</span>',
          html: `<p style="color: #334155; font-size: 14px; margin: 0;">Se procesaron y estructuraron <b>${parsed.personas.length}</b> citaciones correctamente.</p>`,
          confirmButtonColor: '#003366',
          confirmButtonText: 'Ver Citaciones',
          timer: 3500,
          timerProgressBar: true
        });
      } else {
        Swal.fire({
          icon: 'warning',
          iconColor: '#eab308',
          title: 'Sin datos válidos',
          html: '<p style="color: #475569; font-size: 13.5px;">No se encontraron datos de citación válidos en el texto. Verifique que incluya nombre, orden, fecha y hora.</p>',
          confirmButtonColor: '#003366',
          confirmButtonText: 'Entendido'
        });
      }
    } catch (err: any) { 
      console.error("Error in AI extraction:", err);
      showRedErrorAlert("Error en Extracción IA", err.message || "No se pudo extraer la información del texto.");
    } finally { 
      setLoadingIA(false); 
    }
  };

  const handleDownloadWord = async (item: any) => {
    try {
      const docData = {
        nunc: item.nunc || item.orden || '',
        orden: item.orden || '',
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
        firmaInvestigador: config.firmaInvestigador || ""
      };

      const blob = await generateCitationFromTemplate(docData, customTemplateBuffer);
      const cleanName = (item.nombre || 'CITADO').toString().trim().replace(/[\s\\/:*?"<>|]+/g, '_').replace(/_+/g, '_');
      const rawCedula = (item.identificacion || item.cedula || '').toString().trim();
      const cleanCedula = rawCedula.replace(/[\s\\/:*?"<>|]+/g, '_').replace(/_+/g, '_');
      const filename = cleanCedula 
        ? `CITACION_${cleanName}_CC_${cleanCedula}.docx` 
        : `CITACION_${cleanName}.docx`;
      downloadWordDocument(blob, filename);
      showSuccessToast(`Documento descargado: ${item.nombre || cleanName}`);
    } catch (err) {
      console.error("Error al generar el documento de Word:", err);
      showRedErrorAlert("Error al Generar Word", "Ocurrió un problema al generar el archivo Word FPJ-35. Verifique que los campos requeridos estén completos.");
    }
  };

  const handleSignatureUpload = (file: File) => {
    if (!file.type.startsWith('image/')) {
      showRedErrorAlert("Formato Inválido", "Por favor seleccione un archivo de imagen válido (PNG, JPG o WEBP).");
      return;
    }
    const reader = new FileReader();
    reader.onload = (evt) => {
      const rawDataUrl = evt.target?.result as string;
      if (!rawDataUrl) return;

      const img = new Image();
      img.onload = () => {
        const maxWidth = 600;
        const maxHeight = 300;
        let width = img.width;
        let height = img.height;

        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          const optimizedUrl = canvas.toDataURL('image/png');
          setConfig((prev: any) => ({ ...prev, firmaInvestigador: optimizedUrl }));
        } else {
          setConfig((prev: any) => ({ ...prev, firmaInvestigador: rawDataUrl }));
        }
        showSuccessToast('Firma digital cargada exitosamente');
      };
      img.onerror = () => {
        setConfig((prev: any) => ({ ...prev, firmaInvestigador: rawDataUrl }));
        showSuccessToast('Firma digital cargada');
      };
      img.src = rawDataUrl;
    };
    reader.readAsDataURL(file);
  };

  const agregarPersonaManual = () => {
    if (!nuevoDato.nombre?.trim() || !nuevoDato.orden?.trim()) {
      Swal.fire({
        icon: 'warning',
        iconColor: '#003366',
        title: 'Campos Incompletos',
        text: 'Por favor complete al menos el Nombre del citado y el Número de Orden a Policía Judicial.',
        confirmButtonColor: '#003366',
        confirmButtonText: 'Entendido'
      });
      return;
    }

    registrarCitacion({
      ...nuevoDato,
      fecha: nuevoDato.fecha || getTodayDateStr(),
      hora: nuevoDato.hora || getCurrentTimeStr(),
      ciudad: config.municipio,
      unidad: config.grupoInvestigador,
      instalaciones: config.instalaciones,
      direccionInstalaciones: config.direccionInstalaciones,
    });
    setNuevoDato({ 
      nombre: '', 
      identificacion: '',
      genero: 'Femenino', 
      direccion: '',
      correo: '',
      telefono: '',
      nunc: '',
      orden: '', 
      fecha: getTodayDateStr(), 
      hora: getCurrentTimeStr(),
      fiscal: '17 Local',
      motivo: 'Entrevista',
      requiereAbogado: 'NO',
      observaciones: DEFAULT_OBSERVACIONES
    });
    showSuccessToast('Citación registrada exitosamente');
  };

  const eliminarDeBandeja = (id: any) => eliminarDeHistorial(id);
  
  const marcarComoCitado = async (item: any) => {
    if (!user || !item.id) return;
    try {
      // Optimistic UI updates to move from Pendientes to Citados
      setPersonas(prev => prev.filter(p => p.id !== item.id));
      setCitados(prev => {
        if (prev.some(c => c.id === item.id)) return prev;
        return [...prev, { ...item, estado: 'citado' }];
      });
      setHistorial(prev => {
        const next = prev.map(h => h.id === item.id ? { ...h, estado: 'citado' } : h);
        if (user.isLocalGuest) {
          try {
            localStorage.setItem('fgn_guest_historial', JSON.stringify(next));
          } catch (e) {}
        }
        return next;
      });

      if (!user.isLocalGuest) {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', item.id);
        await updateDoc(docRef, { estado: 'citado' });
      }
      showSuccessToast(`Citación movida a Citados: ${item.nombre || ''}`);
    } catch (err) {
      console.error("Error al marcar como citado:", err);
      showRedErrorAlert("Error al Actualizar", "No fue posible actualizar el estado de la citación.");
    }
  };

  const marcarComoCitadoBulk = async () => {
    if (!user || selectedIds.length === 0) return;
    
    const itemsToMove = personas.filter(p => selectedIds.includes(p.id));
    
    try {
      // Optimistic update
      setPersonas(prev => prev.filter(p => !selectedIds.includes(p.id)));
      setCitados(prev => [
        ...prev, 
        ...itemsToMove.map(item => ({ ...item, estado: 'citado' }))
      ]);
      setHistorial(prev => {
        const next = prev.map(h => selectedIds.includes(h.id) ? { ...h, estado: 'citado' } : h);
        if (user.isLocalGuest) {
          try {
            localStorage.setItem('fgn_guest_historial', JSON.stringify(next));
          } catch (e) {}
        }
        return next;
      });
      setSelectedIds([]);

      if (!user.isLocalGuest) {
        // Firestore updates
        const batchPromises = itemsToMove.map(item => {
          const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', item.id);
          return updateDoc(docRef, { estado: 'citado' });
        });
        await Promise.all(batchPromises);
      }
      showSuccessToast(`${itemsToMove.length} citaciones marcadas como citadas`);
    } catch (err) {
      console.error("Error en movimiento masivo:", err);
      showRedErrorAlert("Error Masivo", "Ocurrió un error al mover las citaciones seleccionadas.");
    }
  };

  const toggleSelection = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const marcarAsistencia = async (id: string, valor: 'asistio' | 'no_asistio' | null) => {
    if (!user) return;
    try {
      // Optimistic update for Citados, Historial and Personas
      setCitados(prev => prev.map(c => c.id === id ? { ...c, asistencia: valor } : c));
      setHistorial(prev => {
        const next = prev.map(h => h.id === id ? { ...h, asistencia: valor } : h);
        if (user.isLocalGuest) {
          try {
            localStorage.setItem('fgn_guest_historial', JSON.stringify(next));
          } catch (e) {}
        }
        return next;
      });
      setPersonas(prev => prev.map(p => p.id === id ? { ...p, asistencia: valor } : p));

      if (!user.isLocalGuest) {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id);
        await updateDoc(docRef, { asistencia: valor });
      }
      const label = valor === 'asistio' ? 'Asistencia registrada' : valor === 'no_asistio' ? 'Marcado como No Asistió' : 'Asistencia restablecida';
      showSuccessToast(label);
    } catch (err) {
      console.error("Error al marcar asistencia:", err);
      showRedErrorAlert("Error al Registrar", "No se pudo actualizar la asistencia.");
    }
  };

  const marcarInforme = async (id: string, valor: 'si' | 'no' | null) => {
    if (!user) return;
    try {
      // Optimistic update in all lists
      setHistorial(prev => {
        const next = prev.map(h => h.id === id ? { ...h, informe: valor } : h);
        if (user.isLocalGuest) {
          try {
            localStorage.setItem('fgn_guest_historial', JSON.stringify(next));
          } catch (e) {}
        }
        return next;
      });
      setCitados(prev => prev.map(c => c.id === id ? { ...c, informe: valor } : c));
      setPersonas(prev => prev.map(p => p.id === id ? { ...p, informe: valor } : p));

      if (!user.isLocalGuest) {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id);
        await updateDoc(docRef, { informe: valor });
      }
      const label = valor === 'si' ? 'Con Informe marcado' : valor === 'no' ? 'Sin Informe marcado' : 'Informe restablecido';
      showSuccessToast(label);
    } catch (err) {
      console.error("Error al marcar informe:", err);
      showRedErrorAlert("Error al Registrar", "No se pudo actualizar el estado de informe.");
    }
  };

  const eliminarDeHistorial = async (id: string, nombreCitado?: string) => {
    if (!user) return;

    const result = await Swal.fire({
      title: '¿Eliminar citación?',
      html: `<p style="font-size: 13.5px; color: #475569; margin: 0;">¿Desea eliminar la citación ${nombreCitado ? `de <b>${nombreCitado}</b>` : ''}? Esta acción no se puede deshacer.</p>`,
      icon: 'warning',
      iconColor: '#dc2626',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      cancelButtonColor: '#64748b',
      confirmButtonText: 'Sí, eliminar',
      cancelButtonText: 'Cancelar',
      reverseButtons: true
    });
    if (!result.isConfirmed) return;

    try {
      // Remove immediately from all local state
      setPersonas(prev => prev.filter(p => p.id !== id));
      setCitados(prev => prev.filter(c => c.id !== id));
      setHistorial(prev => {
        const next = prev.filter(h => h.id !== id);
        if (user.isLocalGuest) {
          try {
            localStorage.setItem('fgn_guest_historial', JSON.stringify(next));
          } catch (e) {}
        }
        return next;
      });
      setSelectedIds(prev => prev.filter(i => i !== id));

      if (!user.isLocalGuest) {
        // Remove from Firestore
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id);
        await deleteDoc(docRef);
      }
      showSuccessToast('Citación eliminada correctamente');
    } catch (err) {
      console.error("Error deleting from history:", err);
      showRedErrorAlert("Error al Eliminar", "No fue posible eliminar la citación.");
    }
  };

  const generarMensaje = (p: any) => {
    const trato = p.genero === "Femenino" ? "Señora" : p.genero === "Masculino" ? "Señor" : "Señor(a)";
    const fechaFormateada = formatDateES(p.fecha);
    const horaFormateada = formatTimeAMPM(p.hora);
    
    // Prefer data captured at creation for consistency
    const oficina = p.oficina_creador || config.oficina;
    const telefono = p.telefono_creador || config.telefono;
    const investigador = p.investigador_creador || config.investigador;

    const nombreFormateado = p.identificacion && p.identificacion.trim()
      ? `${p.nombre.toUpperCase()} con CC ${p.identificacion.trim()}`
      : p.nombre.toUpperCase();

    return `Buenas ${trato} ${nombreFormateado}, este mensaje es con el fin de realizarle citación para el día ${fechaFormateada} a las ${horaFormateada} en la ${oficina}, a diligencia de entrevista ordenada por el Fiscal ${p.fiscal} de la Unidad de ${p.unidad} dentro de la Orden a Policía judicial No. ${p.orden}.

Esta diligencia se requiere para que usted amplié las circunstancias de tiempo, modo y lugar, en la que ocurrieron los hechos en los que usted resulto como victima, y se requiere que por favor traiga los documentos que acrediten la cuantía de las totalidad del dinero hurtado.

Por favor comunicarse lo antes posible a el numero ${telefono} (Llamada o WhatsApp) y preguntar por el Investigador ${investigador}.`;
  };

  const copiarAlPortapapeles = async (texto: string, item: any) => {
    try {
      await navigator.clipboard.writeText(texto);
      const id = item.id;
      if (id) {
        setCopiadoIdx(id);
        setTimeout(() => setCopiadoIdx(null), 2000);
      }
      showSuccessToast('Mensaje de WhatsApp copiado');
    } catch (err) {
      showRedErrorAlert("Error al Copiar", "No se pudo copiar el texto al portapapeles.");
    }
  };

  const LoadingOverlay = () => (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      {(!user && !loadingIA) ? (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-8 sm:p-10 rounded-xl shadow-2xl flex flex-col items-center space-y-6 max-w-sm w-full border border-fgn-border"
        >
          <div className="text-center">
            <div className="bg-fgn-gold w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4 shadow-sm">
               <Building2 size={32} className="text-fgn-blue" />
            </div>
            <h2 className="text-2xl font-black text-fgn-blue uppercase tracking-tight">SICIJ</h2>
            <p className="text-fgn-blue text-xs font-bold uppercase tracking-wider mt-1">
              Sistema Integrado de Citaciones Judiciales
            </p>
            <p className="text-text-muted text-[10px] font-semibold leading-relaxed mt-1 uppercase tracking-widest text-slate-500">
              Fiscalía General de la Nación • Unidad de Patrimonio Económico
            </p>
          </div>
          
          <div className="w-full space-y-3">
            <button 
              onClick={handleGuestLogin}
              className="w-full py-3.5 bg-fgn-blue text-white font-bold text-xs uppercase tracking-widest rounded hover:bg-slate-900 transition-all shadow-md flex items-center justify-center gap-2.5 cursor-pointer"
            >
              <UserCheck size={18} className="text-fgn-gold" />
              Ingresar como Invitado
            </button>
            
            <button 
              onClick={handleGoogleLogin}
              disabled={isLoggingInGoogle}
              className="w-full flex items-center justify-center gap-3 bg-white border border-fgn-border py-3 rounded font-bold text-xs uppercase tracking-widest text-fgn-blue hover:bg-slate-50 transition-all shadow-xs cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isLoggingInGoogle ? (
                <>
                  <Loader2 size={16} className="animate-spin text-fgn-blue" />
                  <span>Conectando con Google...</span>
                </>
              ) : (
                <>
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-4 h-4" referrerPolicy="no-referrer" />
                  <span>Ingresar con Google</span>
                </>
              )}
            </button>
          </div>

          <p className="text-[9.5px] text-slate-400 text-center leading-relaxed">
            Si la ventana de Google no abre o se cierra inmediatamente, verifique que su navegador permita ventanas emergentes (pop-ups) o trabaje con <strong>Modo Invitado</strong>.
          </p>

          <div className="bg-slate-50 border border-slate-200 rounded p-3 text-left space-y-1.5">
            <div className="flex items-start gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-amber-500 mt-1 shrink-0" />
              <p className="text-[10px] text-slate-700 leading-snug">
                <strong className="text-slate-900 font-bold uppercase">Modo Invitado:</strong> Los datos se guardan estrictamente en este navegador.
              </p>
            </div>
            <div className="flex items-start gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-500 mt-1 shrink-0" />
              <p className="text-[10px] text-slate-700 leading-snug">
                <strong className="text-slate-900 font-bold uppercase">Cuenta Google:</strong> Datos en la nube Firestore. Son 100% independientes y no se mezclan.
              </p>
            </div>
          </div>
        </motion.div>
      ) : (
        <div className="bg-white p-10 rounded-xl shadow-2xl flex flex-col items-center space-y-4 max-w-sm w-full mx-4 border border-fgn-border">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
          >
            <Loader2 size={48} className="text-fgn-blue stroke-[2px]" />
          </motion.div>
          <div className="text-center">
            <p className="text-sm font-bold text-fgn-blue uppercase tracking-widest">{loadingText}</p>
            <div className="mt-2 flex items-center justify-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-fgn-gold animate-bounce" />
              <div className="w-1.5 h-1.5 rounded-full bg-fgn-gold animate-bounce delay-100" />
              <div className="w-1.5 h-1.5 rounded-full bg-fgn-gold animate-bounce delay-200" />
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-bg-gray font-sans text-text-main pb-20 selection:bg-blue-100">
      <AnimatePresence>
        {(loadingIA || !user) && <LoadingOverlay />}
        {isModalOpen && selectedCitation && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2 sm:p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-3xl w-full border border-fgn-border overflow-hidden flex flex-col max-h-[92vh]"
            >
              <div className="bg-fgn-blue text-white px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center border-b-4 border-fgn-gold shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <FileText size={18} className="text-fgn-gold sm:w-5 sm:h-5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest line-clamp-1">
                      Detalle de Citación • {selectedCitation.nombre}
                    </h3>
                    <p className="text-[9px] text-slate-300 font-mono">
                      Orden OPJ: {selectedCitation.orden || 'Sin Orden'} | NUNC: {selectedCitation.nunc || '---'}
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-white cursor-pointer shrink-0">
                  <X size={18} />
                </button>
              </div>

              {/* TABS SELECTOR */}
              <div className="bg-bg-gray px-3 sm:px-6 pt-2.5 pb-0 border-b border-fgn-border flex gap-2 shrink-0 overflow-x-auto">
                <button 
                  onClick={() => setModalTab('fpj35')}
                  className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-t font-bold text-[10px] tracking-wider uppercase flex items-center gap-1.5 border-t border-x transition-all shrink-0 cursor-pointer ${modalTab === 'fpj35' ? 'bg-white text-fgn-blue border-fgn-border border-b-white -mb-px shadow-sm' : 'text-text-muted hover:text-fgn-blue border-transparent'}`}
                >
                  <FileCode size={13} /> Formato Oficial FPJ-35
                </button>
                <button 
                  onClick={() => setModalTab('whatsapp')}
                  className={`px-3 sm:px-4 py-2 sm:py-2.5 rounded-t font-bold text-[10px] tracking-wider uppercase flex items-center gap-1.5 border-t border-x transition-all shrink-0 cursor-pointer ${modalTab === 'whatsapp' ? 'bg-white text-fgn-blue border-fgn-border border-b-white -mb-px shadow-sm' : 'text-text-muted hover:text-fgn-blue border-transparent'}`}
                >
                  <Copy size={13} /> Mensaje Texto / WhatsApp
                </button>
              </div>

              <div className="p-6 overflow-y-auto flex-1">
                {modalTab === 'fpj35' ? (
                  <div className="bg-white border border-fgn-border p-6 rounded-lg space-y-6 text-xs text-text-main shadow-inner font-sans">
                    {/* ENCABEZADO SIMULADO FPJ-35 */}
                    <div className="border border-slate-300 rounded overflow-hidden">
                      <div className="bg-fgn-blue text-white p-3 text-center border-b border-slate-300">
                        <p className="font-bold text-[11px] uppercase tracking-widest">FISCALÍA GENERAL DE LA NACIÓN</p>
                        <p className="text-[9px] text-fgn-gold uppercase font-semibold">POLICÍA JUDICIAL • FORMATO CITACIÓN (FPJ-35)</p>
                      </div>

                      {/* TABLA NUNC */}
                      <div className="p-3 bg-slate-50 border-b border-slate-200 grid grid-cols-12 gap-2 text-[10px]">
                        <div className="col-span-12 md:col-span-8">
                          <span className="font-bold text-slate-500 uppercase block">NUNC (21 dígitos):</span>
                          <span className="font-mono font-bold text-fgn-blue text-xs">{selectedCitation.nunc || selectedCitation.orden || '---------------------'}</span>
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <span className="font-bold text-slate-500 uppercase block">Dpto / Mpio:</span>
                          <span className="font-bold">{selectedCitation.ciudad || config.municipio || 'Cartagena'}</span>
                        </div>
                        <div className="col-span-6 md:col-span-2">
                          <span className="font-bold text-slate-500 uppercase block">Fecha / Hora:</span>
                          <span className="font-mono font-bold text-slate-700">{selectedCitation.fecha || '---'} {selectedCitation.hora ? formatTimeAMPM(selectedCitation.hora) : ''}</span>
                        </div>
                      </div>

                      {/* DATOS DESTINATARIO */}
                      <div className="p-4 space-y-3">
                        <p className="font-bold text-fgn-blue text-[10px] uppercase border-b pb-1">1. DATOS DEL DESTINATARIO (CITADO)</p>
                        <div className="grid grid-cols-12 gap-3 text-[11px]">
                          <div className="col-span-12">
                            <span className="text-slate-500 font-medium">Señor(a):</span> <strong className="uppercase text-fgn-blue">{selectedCitation.nombre}{selectedCitation.identificacion && selectedCitation.identificacion.trim() ? ` con CC ${selectedCitation.identificacion.trim()}` : ''}</strong>
                          </div>
                          <div className="col-span-8">
                            <span className="text-slate-500 font-medium">Dirección:</span> <span>{selectedCitation.direccion || 'Dirección de residencia no especificada'}</span>
                          </div>
                          <div className="col-span-4">
                            <span className="text-slate-500 font-medium">Teléfono:</span> <span>{selectedCitation.telefono || '---'}</span>
                          </div>
                        </div>
                      </div>

                      {/* REQUERIMIENTO & CITACION */}
                      <div className="p-4 bg-slate-50/70 border-t border-slate-200 space-y-3">
                        <div className="flex items-center justify-between border-b pb-1">
                          <p className="font-bold text-fgn-blue text-[10px] uppercase">2. MOTIVO Y LUGAR DE COMPARECENCIA (FPJ-35)</p>
                          <span className="text-[9px] bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded border border-amber-200">Campos en negrita y subrayados</span>
                        </div>
                        <div className="bg-white p-3.5 rounded-lg border border-slate-300 text-[11.5px] leading-relaxed text-slate-800 shadow-2xs">
                          Se solicita comparecer el próximo <strong className="font-bold underline text-slate-950">{formatDateES(selectedCitation.fecha)}</strong> a las <strong className="font-bold underline text-slate-950">{formatTimeAMPM(selectedCitation.hora)}</strong>, en las instalaciones de <strong className="font-bold underline text-slate-950">{selectedCitation.instalaciones || selectedCitation.oficina_creador || config.instalaciones}</strong>{selectedCitation.direccionInstalaciones || config.direccionInstalaciones ? <>, ubicadas en la <strong className="font-bold underline text-slate-950">{selectedCitation.direccionInstalaciones || config.direccionInstalaciones}</strong></> : null} para <strong className="font-bold underline text-slate-950">{selectedCitation.motivo || 'rendir entrevista dentro de las diligencias investigativas relacionadas en el proceso'}</strong>, dentro del proceso de la referencia.
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                          <p className="bg-slate-100/70 p-2 rounded border border-slate-200">
                            <span className="text-slate-500 font-medium block text-[9px] uppercase">Motivo:</span> 
                            <strong className="font-bold underline text-slate-900">{selectedCitation.motivo || 'Rendir entrevista dentro de las diligencias investigativas del proceso.'}</strong>
                          </p>
                          <p className="bg-slate-100/70 p-2 rounded border border-slate-200">
                            <span className="text-slate-500 font-medium block text-[9px] uppercase">Lugar / Sede:</span> 
                            <strong className="font-bold underline text-slate-900">{selectedCitation.instalaciones || selectedCitation.oficina_creador || config.oficina}</strong>
                          </p>
                          <p className="bg-slate-100/70 p-2 rounded border border-slate-200">
                            <span className="text-slate-500 font-medium block text-[9px] uppercase">Dirección Sede:</span> 
                            <strong className="font-bold underline text-slate-900">{selectedCitation.direccionInstalaciones || config.direccionInstalaciones || 'Sede Principal Canapote / Crespo'}</strong>
                          </p>
                          <p className="bg-slate-100/70 p-2 rounded border border-slate-200">
                            <span className="text-slate-500 font-medium block text-[9px] uppercase">Despacho Fiscal:</span> 
                            <strong className="font-bold underline text-slate-900">Fiscalía {selectedCitation.fiscal || '17 Local'} - Unidad {selectedCitation.unidad || 'Patrimonio Económico'}</strong>
                          </p>
                        </div>
                      </div>

                      {/* ASISTENCIA ABOGADO Y OBSERVACIONES */}
                      <div className="p-4 border-t border-slate-200 grid grid-cols-12 gap-4 text-[11px]">
                        <div className="col-span-12 md:col-span-4 bg-blue-50 p-3 rounded border border-blue-200">
                          <span className="font-bold text-[10px] uppercase text-fgn-blue block">¿Requiere Abogado Defensor?</span>
                          <span className="font-bold text-sm text-fgn-blue">{selectedCitation.requiereAbogado || 'NO'}</span>
                        </div>
                        <div className="col-span-12 md:col-span-8 bg-slate-50 p-3 rounded border border-slate-200">
                          <span className="font-bold text-[10px] uppercase text-slate-500 block">Observaciones:</span>
                          <p className="text-[10px] text-slate-700">{selectedCitation.observaciones || 'Presentarse con documento de identidad original.'}</p>
                        </div>
                      </div>

                      {/* SERVIDOR PUBLICO */}
                      <div className="p-4 bg-slate-100 border-t border-slate-200 text-[10px] flex justify-between items-center">
                        <div>
                          <p className="font-bold text-fgn-blue uppercase">{selectedCitation.investigador_creador || config.investigador}</p>
                          <p className="text-slate-500">{selectedCitation.oficina_creador || config.oficina}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-slate-700">Tel: {selectedCitation.telefono_creador || config.telefono}</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-bg-gray p-6 rounded border border-fgn-border shadow-inner">
                    <pre className="whitespace-pre-wrap font-sans text-xs leading-relaxed text-text-main">
                      {generarMensaje(selectedCitation)}
                    </pre>
                  </div>
                )}
              </div>

              {/* FOOTER ACTIONS */}
              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-fgn-border flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0">
                <button 
                  onClick={() => handleDownloadWord(selectedCitation)}
                  className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 bg-blue-700 hover:bg-blue-900 text-white font-bold rounded text-[10px] tracking-widest uppercase transition-all shadow flex items-center justify-center gap-2 cursor-pointer"
                >
                  <FileDown size={15} /> Descargar FPJ-35 (.docx)
                </button>

                <div className="flex items-center gap-2 w-full sm:w-auto">
                  <button 
                    onClick={() => copiarAlPortapapeles(generarMensaje(selectedCitation), selectedCitation)}
                    className={`flex-1 sm:flex-initial px-4 sm:px-6 py-2.5 sm:py-3 rounded text-[10px] font-bold tracking-widest uppercase transition-all flex items-center justify-center gap-2 cursor-pointer ${copiadoIdx === (selectedCitation.id || 'modal') ? 'bg-green-600 text-white' : 'bg-fgn-blue text-white hover:bg-black'}`}
                  >
                    {copiadoIdx === (selectedCitation.id || 'modal') ? <Check size={14} /> : <Copy size={14} />}
                    {copiadoIdx === (selectedCitation.id || 'modal') ? 'COPIADO' : 'COPIAR TEXTO'}
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 sm:px-6 py-2.5 sm:py-3 bg-white border border-fgn-border text-text-muted font-bold rounded text-[10px] tracking-widest uppercase hover:bg-slate-100 transition-all cursor-pointer"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}

        {isProfileModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-2 sm:p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-fgn-border overflow-hidden flex flex-col max-h-[92vh]"
            >
              <div className="bg-fgn-blue text-white px-4 sm:px-6 py-3 sm:py-4 flex justify-between items-center border-b-4 border-fgn-gold shrink-0">
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <Building2 size={18} className="text-fgn-gold sm:w-5 sm:h-5 shrink-0" />
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-widest">
                      Perfil del Investigador • Configuración Oficial
                    </h3>
                    <p className="text-[9px] text-slate-300 font-mono">
                      Sección 2 FPJ-35 (Persona que Realiza la Citación)
                    </p>
                  </div>
                </div>
                <button onClick={() => setIsProfileModalOpen(false)} className="hover:bg-white/10 p-1.5 rounded-full transition-colors text-white cursor-pointer shrink-0">
                  <X size={18} />
                </button>
              </div>

              <div className="p-4 sm:p-6 overflow-y-auto flex-1 space-y-5 sm:space-y-6">
                <div className="space-y-4">
                  <p className="text-xs font-bold text-fgn-blue uppercase tracking-wider flex items-center gap-2 border-l-4 border-fgn-gold pl-2">
                    <User size={14} /> 2. Persona que Realiza la Citación
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Funcionario (Nombres y Apellidos) *</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="Ej: Pedro Pérez"
                        value={config.investigador} 
                        onChange={(e) => setConfig({...config, investigador: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Entidad Institucional *</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="Ej: CTI / Fiscalía General de la Nación"
                        value={config.entidadInvestigador} 
                        onChange={(e) => setConfig({...config, entidadInvestigador: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Grupo / Unidad Investigativa *</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="Ej: Unidad de Patrimonio Económico"
                        value={config.grupoInvestigador} 
                        onChange={(e) => setConfig({...config, grupoInvestigador: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Correo Electrónico Institucional *</label>
                      <input 
                        type="email"
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="contacto@fiscalia.gov.co"
                        value={config.correoInvestigador} 
                        onChange={(e) => setConfig({...config, correoInvestigador: e.target.value})} 
                      />
                    </div>

                    <div className="md:col-span-2">
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Teléfono Móvil / WhatsApp de Contacto *</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue font-mono" 
                        placeholder="Ej: 3000000000"
                        value={config.telefono} 
                        onChange={(e) => setConfig({...config, telefono: e.target.value})} 
                      />
                    </div>
                  </div>

                  <p className="text-xs font-bold text-fgn-blue uppercase tracking-wider flex items-center gap-2 border-l-4 border-fgn-gold pl-2 pt-4">
                    <MapPin size={14} /> Sede de Comparecencia y Ubicación
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Despacho / Unidad de Adscripción</label>
                      <textarea 
                        rows={2} 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue resize-none" 
                        placeholder="Fiscalía General de la Nación - Unidad de Patrimonio Económico"
                        value={config.oficina} 
                        onChange={(e) => setConfig({...config, oficina: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Lugar / Sede de Comparecencia</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="Fiscalía General de la Nación - Sede Canapote"
                        value={config.instalaciones} 
                        onChange={(e) => setConfig({...config, instalaciones: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Dirección de las Instalaciones</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="Cra. 17 # 32-10, Barrio Canapote"
                        value={config.direccionInstalaciones} 
                        onChange={(e) => setConfig({...config, direccionInstalaciones: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Departamento</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                        placeholder="Bolívar"
                        value={config.departamento} 
                        onChange={(e) => setConfig({...config, departamento: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Municipio / Ciudad</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                        placeholder="Cartagena"
                        value={config.municipio} 
                        onChange={(e) => setConfig({...config, municipio: e.target.value})} 
                      />
                    </div>

                    {/* Firma Gráfica del Investigador */}
                    <div className="bg-slate-50 border border-fgn-border rounded-lg p-3.5 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <label className="text-[10px] font-bold text-fgn-blue uppercase tracking-wider flex items-center gap-1.5">
                            <PenTool size={13} className="text-fgn-gold" /> Firma Digitalizada del Investigador
                          </label>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            Clave para la plantilla Word: <span className="font-mono font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded">&#123;FIRMA&#125;</span>
                          </p>
                        </div>
                        {config.firmaInvestigador && (
                          <button
                            type="button"
                            onClick={() => setConfig((prev: any) => ({ ...prev, firmaInvestigador: "" }))}
                            className="text-[10px] text-red-600 hover:text-red-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                          >
                            <Trash2 size={12} /> Eliminar firma
                          </button>
                        )}
                      </div>

                      {config.firmaInvestigador ? (
                        <div className="flex flex-col sm:flex-row items-center gap-3 bg-white p-3 rounded-lg border border-slate-200">
                          <div className="h-16 w-44 bg-slate-50 border border-dashed border-slate-300 rounded flex items-center justify-center p-1.5 overflow-hidden">
                            <img 
                              src={config.firmaInvestigador} 
                              alt="Firma del Investigador" 
                              className="max-h-full max-w-full object-contain" 
                            />
                          </div>
                          <div className="text-[10px] text-slate-600 space-y-1">
                            <p className="font-semibold text-emerald-700 flex items-center gap-1">
                              <CheckCircle size={13} /> Firma cargada y lista
                            </p>
                            <p className="text-slate-500">
                              Se estampará en la clave <span className="font-mono font-bold text-slate-700">&#123;FIRMA&#125;</span> de la plantilla y en el FPJ-35.
                            </p>
                            <label className="inline-flex items-center gap-1 text-[10px] font-bold text-fgn-blue hover:underline cursor-pointer pt-0.5">
                              <FileUp size={11} /> Cambiar imagen
                              <input
                                type="file"
                                accept="image/png, image/jpeg, image/jpg, image/webp"
                                className="hidden"
                                onChange={(e) => {
                                  if (e.target.files?.[0]) handleSignatureUpload(e.target.files[0]);
                                }}
                              />
                            </label>
                          </div>
                        </div>
                      ) : (
                        <label className="border-2 border-dashed border-slate-300 hover:border-fgn-blue bg-white rounded-lg p-3.5 flex flex-col items-center justify-center gap-1.5 cursor-pointer transition-colors group">
                          <div className="w-8 h-8 rounded-full bg-blue-50 text-fgn-blue flex items-center justify-center group-hover:scale-105 transition-transform">
                            <FileUp size={15} />
                          </div>
                          <div className="text-center">
                            <span className="text-xs font-bold text-fgn-blue block">Subir imagen de la firma</span>
                            <span className="text-[9px] text-slate-500 block">PNG con fondo transparente recomendado (o JPG)</span>
                          </div>
                          <input
                            type="file"
                            accept="image/png, image/jpeg, image/jpg, image/webp"
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files?.[0]) handleSignatureUpload(e.target.files[0]);
                            }}
                          />
                        </label>
                      )}
                    </div>
                  </div>

                  <p className="text-xs font-bold text-fgn-blue uppercase tracking-wider flex items-center gap-2 border-l-4 border-fgn-gold pl-2 pt-4">
                    <FileCode size={14} /> Plantilla Oficial Word (PLANTILLA CITACION.docx)
                  </p>

                  <div className="bg-slate-50 border border-fgn-border p-4 rounded-lg space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs font-bold text-slate-800">Estado de la Plantilla:</p>
                        <p className="text-[10px] text-slate-600 font-mono">
                          {customTemplateBuffer ? "✓ Usando Plantilla Personalizada cargada por el usuario" : "✓ Usando Plantilla Oficial predeterminada (PLANTILLA CITACION.docx)"}
                        </p>
                      </div>
                      {customTemplateBuffer && (
                        <button 
                          onClick={() => {
                            setCustomTemplateBuffer(undefined);
                            showInfoToast('Plantilla oficial restablecida');
                          }}
                          className="text-[10px] text-red-600 font-bold hover:underline"
                        >
                          Restablecer a Original
                        </button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3 pt-1">
                      <a 
                        href="/PLANTILLA CITACION.docx" 
                        download="PLANTILLA CITACION.docx"
                        className="px-3 py-2 bg-white border border-fgn-border text-fgn-blue font-bold rounded text-[10px] uppercase tracking-wider hover:bg-fgn-blue hover:text-white transition-all flex items-center gap-1.5 shadow-sm"
                      >
                        <Download size={13} /> Descargar Plantilla Base (PLANTILLA CITACION.docx)
                      </a>

                      <label className="px-3 py-2 bg-fgn-blue text-white font-bold rounded text-[10px] uppercase tracking-wider hover:bg-black transition-all cursor-pointer flex items-center gap-1.5 shadow-sm">
                        <FileUp size={13} /> Cargar Nueva Plantilla (.docx)
                        <input 
                          type="file" 
                          accept=".docx" 
                          className="hidden" 
                          onChange={(e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                              const reader = new FileReader();
                              reader.onload = (evt) => {
                                if (evt.target?.result instanceof ArrayBuffer) {
                                  setCustomTemplateBuffer(evt.target.result);
                                  Swal.fire({
                                    icon: 'success',
                                    iconColor: '#16a34a',
                                    title: '<span style="color: #003366; font-weight: 800;">¡Plantilla Cargada!</span>',
                                    html: '<p style="color: #334155; font-size: 13.5px; margin: 0;">Nueva plantilla <b>PLANTILLA CITACION.docx</b> cargada exitosamente.</p>',
                                    confirmButtonColor: '#003366',
                                    confirmButtonText: 'Aceptar'
                                  });
                                }
                              };
                              reader.onerror = () => {
                                showRedErrorAlert("Error al Cargar Plantilla", "No fue posible leer el archivo de plantilla seleccionado.");
                              };
                              reader.readAsArrayBuffer(file);
                            }
                          }}
                        />
                      </label>
                    </div>

                    <div className="mt-2 p-3 bg-blue-50/60 border border-blue-200/60 rounded text-[11px] text-slate-700 space-y-1.5">
                      <p className="font-bold text-fgn-blue flex items-center gap-1.5">
                        <Check size={12} className="text-fgn-gold" /> Claves unificadas para tu documento Word:
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 font-mono text-[10px]">
                        <div className="bg-white p-2 rounded border border-blue-100 shadow-2xs">
                          <strong className="text-fgn-blue font-bold">&#123;NOMBRE&#125;</strong>
                          <p className="text-slate-600 mt-0.5 font-sans">Engloba el nombre y añade automáticamente <span className="font-semibold">"con CC ..."</span> si existe número de cédula.</p>
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-100 shadow-2xs">
                          <strong className="text-fgn-blue font-bold">&#123;MOTIVO_CITACION&#125;</strong>
                          <p className="text-slate-600 mt-0.5 font-sans">Engloba todo el párrafo de comparecencia, insertando fecha, hora, sede, dirección y motivo en <span className="font-semibold text-slate-900 underline">negrita y subrayados</span>.</p>
                        </div>
                        <div className="bg-white p-2 rounded border border-blue-100 shadow-2xs">
                          <strong className="text-fgn-blue font-bold">&#123;FIRMA&#125;</strong>
                          <p className="text-slate-600 mt-0.5 font-sans">Inserta automáticamente la imagen de la firma del funcionario en la celda o párrafo correspondiente.</p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="px-4 sm:px-6 py-3 sm:py-4 bg-slate-50 border-t border-fgn-border flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-2.5 sm:gap-4 shrink-0">
                <span className="text-[10px] text-slate-500 font-medium flex items-center justify-center sm:justify-start gap-1">
                  <Check size={14} className="text-green-600" /> {user?.isLocalGuest ? 'Guardado en navegador local' : 'Sincronizado con la nube'}
                </span>
                <button 
                  onClick={() => {
                    setIsProfileModalOpen(false);
                    showSuccessToast('Perfil de Investigador guardado');
                  }}
                  className="w-full sm:w-auto px-6 py-2.5 bg-fgn-blue hover:bg-black text-white font-bold rounded text-[10px] tracking-widest uppercase transition-all shadow cursor-pointer text-center"
                >
                  Guardar y Cerrar
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER INSTITUCIONAL */}
      <header className="bg-fgn-blue text-white shadow-lg sticky top-0 z-50 border-b-4 border-fgn-gold">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-4 flex flex-col md:flex-row md:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="bg-fgn-gold w-9 h-9 sm:w-10 sm:h-10 rounded flex items-center justify-center shadow-inner shrink-0">
                 <FileText size={18} className="text-fgn-blue sm:w-5 sm:h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-baseline gap-x-2">
                  <h1 className="text-lg sm:text-xl font-black tracking-wider uppercase text-white">
                    SICIJ
                  </h1>
                  <span className="hidden sm:inline text-blue-200/50 text-sm">|</span>
                  <span className="text-[11px] sm:text-sm font-bold text-blue-100 tracking-wide uppercase">
                    Citaciones Judiciales
                  </span>
                </div>
                <p className="text-blue-100/75 text-[9px] sm:text-[10px] font-bold tracking-[0.08em] sm:tracking-[0.1em] uppercase mt-0.5">
                  Fiscalía General de la Nación • Patrimonio Económico
                </p>
              </div>
            </div>

            {/* Mobile quick profile trigger */}
            {user && (
              <div className="flex items-center gap-1.5 md:hidden">
                <button 
                  onClick={() => setIsProfileModalOpen(true)}
                  className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-lg border border-white/20 transition-all cursor-pointer"
                  title="Perfil Investigador"
                >
                  <Building2 size={16} className="text-fgn-gold" />
                </button>
                <button 
                  onClick={handleLogout}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors cursor-pointer text-white"
                  title="Cerrar Sesión"
                >
                  <LogOut size={16} />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-4">
            {user && (
              <div className="hidden md:flex items-center gap-3 mr-2">
                 <div className="text-right hidden sm:block">
                   <div className="flex items-center justify-end gap-1.5">
                     <p className="text-[9px] font-bold uppercase text-blue-200 tracking-widest leading-none">
                       {user.isAnonymous || user.isLocalGuest ? 'Modo' : 'Cuenta'}
                     </p>
                     {(user.isAnonymous || user.isLocalGuest) ? (
                       <span className="bg-amber-400 text-slate-900 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider" title="Datos almacenados exclusivamente en este navegador">
                         Invitado · Local
                       </span>
                     ) : (
                       <span className="bg-blue-400 text-slate-900 text-[8px] font-extrabold px-1.5 py-0.5 rounded uppercase tracking-wider" title="Datos sincronizados en la nube Firestore">
                         Google · Nube
                       </span>
                     )}
                   </div>
                   <p className="text-xs font-bold text-white leading-tight truncate max-w-[150px]">
                     {user.displayName || user.email || 'Funcionario Invitado'}
                   </p>
                 </div>
                 <button 
                   onClick={() => setIsProfileModalOpen(true)}
                   className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white rounded text-[10px] font-bold uppercase tracking-wider border border-white/20 transition-all shadow-sm cursor-pointer"
                   title="Editar Perfil del Investigador (Sección 2 FPJ-35)"
                 >
                   <Building2 size={14} className="text-fgn-gold" />
                   <span className="hidden md:inline">Perfil</span>
                 </button>
                 {(user.isAnonymous || user.isLocalGuest) && (
                   <button 
                     onClick={handleGoogleLogin}
                     disabled={isLoggingInGoogle}
                     className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 bg-white text-fgn-blue hover:bg-slate-100 rounded text-[10px] font-bold uppercase tracking-wider transition-all shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                     title="Cambiar a cuenta de Google en la nube (base de datos independiente)"
                   >
                     {isLoggingInGoogle ? (
                       <Loader2 size={12} className="animate-spin text-fgn-blue" />
                     ) : (
                       <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-3.5 h-3.5" referrerPolicy="no-referrer" />
                     )}
                     <span>{isLoggingInGoogle ? 'Abriendo...' : 'Google'}</span>
                   </button>
                 )}
                 <button 
                  onClick={handleLogout}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors cursor-pointer"
                  title="Cerrar Sesión"
                 >
                   <LogOut size={16} className="text-white" />
                 </button>
              </div>
            )}
            <div className="bg-fgn-blue/50 border border-white/20 px-3 sm:px-6 py-2 rounded flex items-center justify-between sm:justify-center gap-3 sm:gap-6 backdrop-blur-sm overflow-x-auto">
              <button 
                onClick={() => setActiveMode('excel')}
                className={`text-center transition-all group shrink-0 ${activeMode === 'excel' ? 'scale-105 sm:scale-110' : 'hover:scale-105'} cursor-pointer`}
                title="Hoja de Cálculo - Insumo de Citaciones Judiciales"
              >
                <p className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider sm:tracking-widest mb-0.5 group-hover:text-white transition-colors ${activeMode === 'excel' ? 'text-white font-black' : 'text-emerald-300'}`}>Insumo Excel</p>
                <div className="flex items-center justify-center gap-1 sm:gap-1.5">
                  <FileSpreadsheet size={13} className={`transition-colors sm:w-4 sm:h-4 ${activeMode === 'excel' ? 'text-white' : 'text-emerald-300 group-hover:text-white'}`} />
                  <span className="text-base sm:text-lg font-mono font-bold text-white leading-none">{excelRows.length}</span>
                </div>
              </button>
              <div className="h-6 sm:h-8 w-[1px] bg-white/10 shrink-0"></div>
              <button 
                onClick={() => setActiveMode('pendientes')}
                className={`text-center transition-all group shrink-0 ${activeMode === 'pendientes' ? 'scale-105 sm:scale-110' : 'hover:scale-105'} cursor-pointer`}
              >
                <p className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider sm:tracking-widest mb-0.5 group-hover:text-white transition-colors ${activeMode === 'pendientes' ? 'text-white' : 'text-blue-200'}`}>Generadas</p>
                <p className="text-base sm:text-lg font-mono font-bold text-white leading-none">{personas.length}</p>
              </button>
              <div className="h-6 sm:h-8 w-[1px] bg-white/10 shrink-0"></div>
              <button 
                onClick={() => setActiveMode('citados')}
                className={`text-center transition-all group shrink-0 ${activeMode === 'citados' ? 'scale-105 sm:scale-110' : 'hover:scale-105'} cursor-pointer`}
              >
                <p className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider sm:tracking-widest mb-0.5 group-hover:text-white transition-colors ${activeMode === 'citados' ? 'text-white' : 'text-blue-200'}`}>Citados</p>
                <p className="text-base sm:text-lg font-mono font-bold text-white leading-none">{citados.length}</p>
              </button>
              <div className="h-6 sm:h-8 w-[1px] bg-white/10 shrink-0"></div>
              <button 
                onClick={() => setActiveMode('historial')}
                className={`flex flex-col items-center group transition-all shrink-0 ${activeMode === 'historial' ? 'scale-105 sm:scale-110' : 'hover:scale-105'} cursor-pointer`}
              >
                <p className={`text-[8px] sm:text-[9px] font-bold uppercase tracking-wider sm:tracking-widest mb-0.5 group-hover:text-white transition-colors ${activeMode === 'historial' ? 'text-white' : 'text-blue-200'}`}>Archivo</p>
                <div className="flex items-center gap-1 sm:gap-2">
                   <History size={14} className={`transition-colors sm:w-4 sm:h-4 ${activeMode === 'historial' ? 'text-white' : 'text-blue-200 group-hover:text-white'}`} />
                   <span className="text-base sm:text-lg font-mono font-bold text-white leading-none">{historial.length}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full max-w-7xl mx-auto px-3 sm:px-6 mt-4 sm:mt-8 pb-12">
        
        {/* PANEL DE BIENVENIDA / MENÚ */}
        {!activeMode && !pendingExtraction && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-10 max-w-5xl mx-auto"
          >
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-fgn-blue uppercase tracking-normal">Centro de Gestión Judicial</h2>
              <div className="w-16 h-1 bg-fgn-gold mx-auto mt-2" />
              <p className="text-text-muted font-bold uppercase text-[10px] tracking-widest pt-4">Seleccione una modalidad de trabajo para iniciar el procesamiento</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              {/* Tarjeta 1: Registro Manual */}
              <button 
                onClick={() => setActiveMode('manual')} 
                className="group bg-white p-8 sm:p-10 rounded-2xl border border-fgn-border shadow-xs hover:border-fgn-blue hover:shadow-lg transition-all flex flex-col items-center text-center space-y-4 cursor-pointer"
              >
                <div className="w-20 h-20 rounded-2xl bg-bg-gray flex items-center justify-center text-fgn-blue group-hover:scale-110 group-hover:bg-blue-50 transition-all">
                  <Plus size={38} />
                </div>
                <div>
                  <h3 className="text-base font-bold text-fgn-blue uppercase tracking-tight">Registro Manual</h3>
                  <p className="text-text-muted text-xs font-medium leading-relaxed mt-2 max-w-sm">
                    Formulario estructurado para creación individual de citaciones judiciales con validación y vista previa en tiempo real.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-fgn-blue uppercase tracking-wider group-hover:underline pt-2">
                  Iniciar Registro Manual &rarr;
                </span>
              </button>

              {/* Tarjeta 2: Hoja de Cálculo (Insumo) - ÚNICA ENTRADA */}
              <button 
                onClick={() => setActiveMode('excel')} 
                className="group bg-white p-8 sm:p-10 rounded-2xl border border-fgn-border shadow-xs hover:border-emerald-600 hover:shadow-lg transition-all flex flex-col items-center text-center space-y-4 cursor-pointer relative"
              >
                <div className="w-20 h-20 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-700 group-hover:scale-110 group-hover:bg-emerald-100 transition-all">
                  <FileSpreadsheet size={38} />
                </div>
                <div>
                  <div className="flex items-center justify-center gap-2">
                    <h3 className="text-base font-bold text-fgn-blue uppercase tracking-tight">Hoja de Cálculo (Insumo)</h3>
                    {excelRows.length > 0 && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {excelRows.length} fila{excelRows.length === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <p className="text-text-muted text-xs font-medium leading-relaxed mt-2 max-w-sm">
                    Matriz interactiva para ingresar datos, pegar directamente del portapapeles con validación de estructura y generar citaciones en bloque.
                  </p>
                </div>
                <span className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider group-hover:underline pt-2">
                  Abrir Hoja de Cálculo &rarr;
                </span>
              </button>
            </div>
          </motion.div>
        )}


        {/* VISTA ARCHIVO HISTÓRICO */}
        {activeMode === 'historial' && (
          <motion.div 
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-6"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <button 
                onClick={() => {
                  setActiveMode(null);
                  setSearchTerm("");
                }} 
                className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded border border-fgn-border shadow-sm transition-all w-fit"
              >
                <ArrowLeft size={14} strokeWidth={2} /> Volver al Inicio
              </button>
              <h2 className="text-xl font-bold text-fgn-blue uppercase tracking-tight flex items-center gap-3">
                <History size={24} className="text-fgn-blue"/> Archivo Histórico de Citaciones
              </h2>
            </div>

            {/* Filter Bar */}
            <CitationFilterBar
              filters={filtersHistorial}
              onFilterChange={handleFilterChangeHistorial}
              fiscalOptions={fiscalOptions}
              showEstadoFilter={true}
              showInformeFilter={true}
              showAsistenciaFilter={true}
              totalCount={historial.length}
              filteredCount={filteredHistorial.length}
              placeholderSearch="BUSCAR EN ARCHIVO HISTÓRICO (NOMBRE, CÉDULA, ORDEN, FISCAL)..."
            />

            <div className="bg-white rounded-xl border border-fgn-border overflow-hidden shadow-sm">
              <div className="hidden md:grid bg-bg-gray px-6 py-3 border-b border-fgn-border grid-cols-12 gap-4 text-[9px] font-bold text-text-muted uppercase tracking-widest">
                <div className="col-span-3">PARTICIPANTE</div>
                <div className="col-span-2">ORDEN OPJ</div>
                <div 
                  className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-fgn-blue transition-colors group"
                  onClick={toggleSort}
                >
                  FECHA Y HORA 
                  <ArrowUpDown size={12} className={sortConfig.direction === 'asc' ? 'text-fgn-blue' : 'text-slate-300'} />
                </div>
                <div className="col-span-2 text-center">INFORME</div>
                <div className="col-span-2 text-center">ASISTENCIA</div>
                <div className="col-span-1 text-right">ACC.</div>
              </div>

              {historial.length === 0 ? (
                <div className="text-center py-24">
                  <Search size={48} className="mx-auto text-slate-200 mb-4" />
                  <p className="text-text-muted font-bold uppercase tracking-widest text-[10px]">Sin registros en base de datos</p>
                </div>
              ) : filteredHistorial.length === 0 ? (
                <div className="text-center py-20 bg-slate-50">
                  <Search size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-text-muted font-bold uppercase tracking-widest text-xs">
                    No se encontraron citaciones con los filtros aplicados
                  </p>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Pruebe modificando los términos de búsqueda o limpiando los filtros.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-fgn-border/30">
                  {paginatedHistorial.map((p) => (
                    <motion.div 
                      layout
                      key={p.id} 
                      className="transition-colors hover:bg-slate-50/70"
                    >
                      {/* DESKTOP ROW */}
                      <div className="hidden md:grid px-6 py-4 grid-cols-12 gap-4 items-center">
                        <div className="col-span-3">
                          <p className="text-xs font-bold text-fgn-blue uppercase">
                            {p.nombre}{p.identificacion && p.identificacion.trim() ? ` con CC ${p.identificacion.trim()}` : ''}
                          </p>
                          {p.fiscal && (
                            <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                              Fiscalía {p.fiscal}
                            </p>
                          )}
                        </div>
                        <div className="col-span-2 font-mono text-[11px] text-text-muted uppercase">
                          {p.orden}
                        </div>
                        <div className="col-span-2 font-mono text-[11px] text-fgn-blue flex flex-col">
                          <span>{p.fecha ? formatDateES(p.fecha).toUpperCase() : '---'}</span>
                          {p.hora && <span className="text-[10px] text-fgn-gold font-bold">{formatTimeAMPM(p.hora)}</span>}
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-2">
                          <button 
                            onClick={() => marcarInforme(p.id, p.informe === 'si' ? null : 'si')}
                            className={`p-1.5 rounded transition-all border ${p.informe === 'si' ? 'bg-fgn-blue text-white border-fgn-blue shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-fgn-blue hover:border-fgn-blue cursor-pointer'}`}
                            title={p.informe === 'si' ? 'Informe Realizado (Clic para desmarcar)' : 'Marcar con Informe'}
                          >
                            <FileCheck size={14} />
                          </button>
                          <button 
                            onClick={() => marcarInforme(p.id, p.informe === 'no' ? null : 'no')}
                            className={`p-1.5 rounded transition-all border ${p.informe === 'no' ? 'bg-slate-500 text-white border-slate-500 shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-slate-500 hover:border-slate-500 cursor-pointer'}`}
                            title={p.informe === 'no' ? 'Marcado Sin Informe (Clic para desmarcar)' : 'Marcar Sin Informe'}
                          >
                            <FileX size={14} />
                          </button>
                        </div>
                        <div className="col-span-2 flex items-center justify-center gap-2">
                          <button 
                            onClick={() => marcarAsistencia(p.id, p.asistencia === 'asistio' ? null : 'asistio')}
                            className={`p-1.5 rounded transition-all border ${p.asistencia === 'asistio' ? 'bg-green-600 text-white border-green-600 shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-green-500 hover:border-green-500 cursor-pointer'}`}
                            title={p.asistencia === 'asistio' ? 'Asistió (Clic para desmarcar)' : 'Marcar Asistió'}
                          >
                            <UserCheck size={14} />
                          </button>
                          <button 
                            onClick={() => marcarAsistencia(p.id, p.asistencia === 'no_asistio' ? null : 'no_asistio')}
                            className={`p-1.5 rounded transition-all border ${p.asistencia === 'no_asistio' ? 'bg-red-600 text-white border-red-600 shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-red-500 hover:border-red-500 cursor-pointer'}`}
                            title={p.asistencia === 'no_asistio' ? 'No Asistió (Clic para desmarcar)' : 'Marcar No Asistió'}
                          >
                            <UserX size={14} />
                          </button>
                        </div>
                        <div className="col-span-1 flex items-center justify-end gap-1">
                          <button 
                            onClick={() => {
                              setSelectedCitation(p);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-pink-600 hover:bg-pink-50 rounded transition-all cursor-pointer"
                            title="Ver Citación Completa"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => handleDownloadWord(p)}
                            className="p-1.5 text-blue-700 hover:bg-blue-50 rounded transition-all cursor-pointer"
                            title="Descargar Formato Word FPJ-35 (.docx)"
                          >
                            <FileDown size={16} />
                          </button>
                          <button 
                            onClick={() => eliminarDeHistorial(p.id, p.nombre)} 
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer"
                            title="Eliminar Citación"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* MOBILE CARD */}
                      <div className="block md:hidden p-3.5 space-y-2.5">
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-fgn-blue uppercase">
                              {p.nombre}{p.identificacion && p.identificacion.trim() ? ` con CC ${p.identificacion.trim()}` : ''}
                            </p>
                            {p.fiscal && (
                              <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">
                                Fiscalía {p.fiscal}
                              </p>
                            )}
                          </div>
                          <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                            {p.orden}
                          </span>
                        </div>

                        <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                          <span className="text-slate-600">
                            {p.fecha ? formatDateES(p.fecha).toUpperCase() : '---'}
                          </span>
                          {p.hora && (
                            <span className="text-fgn-blue font-bold">
                              {formatTimeAMPM(p.hora)}
                            </span>
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {/* Informe controls */}
                          <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-200 text-[10px]">
                            <span className="font-bold text-slate-600 uppercase">Informe:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => marcarInforme(p.id, p.informe === 'si' ? null : 'si')}
                                className={`p-1.5 rounded transition-all border ${p.informe === 'si' ? 'bg-fgn-blue text-white border-fgn-blue' : 'bg-white text-slate-400 border-slate-300'}`}
                                title="Con Informe"
                              >
                                <FileCheck size={13} />
                              </button>
                              <button
                                onClick={() => marcarInforme(p.id, p.informe === 'no' ? null : 'no')}
                                className={`p-1.5 rounded transition-all border ${p.informe === 'no' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-400 border-slate-300'}`}
                                title="Sin Informe"
                              >
                                <FileX size={13} />
                              </button>
                            </div>
                          </div>

                          {/* Asistencia controls */}
                          <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-200 text-[10px]">
                            <span className="font-bold text-slate-600 uppercase">Asistencia:</span>
                            <div className="flex items-center gap-1.5">
                              <button
                                onClick={() => marcarAsistencia(p.id, p.asistencia === 'asistio' ? null : 'asistio')}
                                className={`p-1.5 rounded transition-all border ${p.asistencia === 'asistio' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-400 border-slate-300'}`}
                                title="Asistió"
                              >
                                <UserCheck size={13} />
                              </button>
                              <button
                                onClick={() => marcarAsistencia(p.id, p.asistencia === 'no_asistio' ? null : 'no_asistio')}
                                className={`p-1.5 rounded transition-all border ${p.asistencia === 'no_asistio' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-400 border-slate-300'}`}
                                title="No Asistió"
                              >
                                <UserX size={13} />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2 pt-1 border-t border-slate-100">
                          <button 
                            onClick={() => {
                              setSelectedCitation(p);
                              setIsModalOpen(true);
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-pink-700 bg-pink-50 hover:bg-pink-100 rounded border border-pink-200 font-bold transition-all cursor-pointer"
                          >
                            <Eye size={13} /> <span>Ver</span>
                          </button>
                          <button 
                            onClick={() => handleDownloadWord(p)}
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 font-bold transition-all cursor-pointer"
                          >
                            <FileDown size={13} /> <span>Word</span>
                          </button>
                          <button 
                            onClick={() => eliminarDeHistorial(p.id, p.nombre)} 
                            className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-red-600 bg-red-50 hover:bg-red-100 rounded border border-red-200 font-bold transition-all cursor-pointer"
                          >
                            <Trash2 size={13} /> <span>Eliminar</span>
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}

              {/* Controles de Paginación */}
              <PaginationControls
                totalItems={filteredHistorial.length}
                currentPage={pageHistorial}
                pageSize={pageSizeHistorial}
                onPageChange={setPageHistorial}
                onPageSizeChange={setPageSizeHistorial}
                itemLabel="citaciones archivadas"
              />
            </div>
          </motion.div>
        )}

        {/* VISTA HOJA DE CÁLCULO (INSUMO EXCEL) */}
        {activeMode === 'excel' && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <ExcelMatrixView
              rows={excelRows}
              onRowsChange={setExcelRows}
              onGenerateCitations={generarCitacionesDesdeExcel}
              onBack={() => setActiveMode(null)}
            />
          </motion.div>
        )}

        {/* FLUJO DE TRABAJO ACTIVO (REGISTRO Y EXTRACCIÓN) */}
        {(['manual', 'pdf'].includes(activeMode || '') || pendingExtraction) && (
          <div className="space-y-6">
            <div className="flex items-center">
              <button 
                onClick={() => setActiveMode(null)} 
                className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded border border-fgn-border shadow-sm transition-all"
              >
                <ArrowLeft size={14} strokeWidth={2} /> Volver al Inicio
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
              
              {/* SIDEBAR: PERFIL */}
              <motion.div 
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="lg:col-span-4 space-y-6"
              >
                <div className="bg-white p-6 rounded-xl border border-fgn-border shadow-sm space-y-6">
                  <div className="border-b border-fgn-border pb-3 flex items-center justify-between">
                    <h2 className="text-xs font-bold flex items-center gap-2 text-fgn-blue uppercase tracking-widest">
                      <Building2 size={16} className="text-fgn-gold" /> Perfil Investigador
                    </h2>
                    <span className="text-[9px] font-bold text-fgn-blue bg-fgn-blue/10 px-2 py-0.5 rounded border border-fgn-blue/20 uppercase">
                      Sección 2 FPJ-35
                    </span>
                  </div>

                  <div className="space-y-4">
                    <p className="text-[9px] font-bold text-fgn-gold uppercase tracking-wider flex items-center gap-1 border-b pb-1">
                      <User size={12} /> 2. Persona que Realiza la Citación
                    </p>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Funcionario (Nombres y Apellidos)</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="Ej: Pedro Pérez"
                        value={config.investigador} 
                        onChange={(e) => setConfig({...config, investigador: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Entidad</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="Ej: CTI / Fiscalía General de la Nación"
                        value={config.entidadInvestigador} 
                        onChange={(e) => setConfig({...config, entidadInvestigador: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Grupo / Unidad Investigativa</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="Ej: Unidad de Patrimonio Económico"
                        value={config.grupoInvestigador} 
                        onChange={(e) => setConfig({...config, grupoInvestigador: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Correo Electrónico Institucional</label>
                      <input 
                        type="email"
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="contacto@fiscalia.gov.co"
                        value={config.correoInvestigador} 
                        onChange={(e) => setConfig({...config, correoInvestigador: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Teléfono / WhatsApp Móvil</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue font-mono" 
                        placeholder="Ej: 3000000000"
                        value={config.telefono} 
                        onChange={(e) => setConfig({...config, telefono: e.target.value})} 
                      />
                    </div>

                    <p className="text-[9px] font-bold text-fgn-gold uppercase tracking-wider flex items-center gap-1 border-b pb-1 pt-2">
                      <MapPin size={12} /> Despacho y Sede de Comparecencia
                    </p>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Despacho / Unidad</label>
                      <textarea 
                        rows={2} 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue resize-none" 
                        placeholder="Fiscalía General de la Nación - Unidad de Patrimonio Económico"
                        value={config.oficina} 
                        onChange={(e) => setConfig({...config, oficina: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Lugar / Sede de Comparecencia</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="Fiscalía General de la Nación - Sede Canapote"
                        value={config.instalaciones} 
                        onChange={(e) => setConfig({...config, instalaciones: e.target.value})} 
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Dirección de las Instalaciones</label>
                      <input 
                        className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        placeholder="Cra. 17 # 32-10, Barrio Canapote"
                        value={config.direccionInstalaciones} 
                        onChange={(e) => setConfig({...config, direccionInstalaciones: e.target.value})} 
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Departamento</label>
                        <input 
                          className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                          placeholder="Bolívar"
                          value={config.departamento} 
                          onChange={(e) => setConfig({...config, departamento: e.target.value})} 
                        />
                      </div>
                      <div>
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Municipio / Ciudad</label>
                        <input 
                          className="w-full p-2.5 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                          placeholder="Cartagena"
                          value={config.municipio} 
                          onChange={(e) => setConfig({...config, municipio: e.target.value})} 
                        />
                      </div>
                    </div>

                    {/* Firma Gráfica del Investigador */}
                    <div className="pt-2 border-t border-slate-200">
                      <div className="bg-slate-50 border border-fgn-border rounded-lg p-3 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <div>
                            <label className="text-[10px] font-bold text-fgn-blue uppercase tracking-wider flex items-center gap-1.5">
                              <PenTool size={13} className="text-fgn-gold" /> Firma Digitalizada
                            </label>
                            <p className="text-[9px] text-slate-500 mt-0.5">
                              Clave plantilla Word: <span className="font-mono font-bold text-blue-700 bg-blue-100 px-1 py-0.5 rounded">&#123;FIRMA&#125;</span>
                            </p>
                          </div>
                          {config.firmaInvestigador && (
                            <button
                              type="button"
                              onClick={() => setConfig((prev: any) => ({ ...prev, firmaInvestigador: "" }))}
                              className="text-[9px] text-red-600 hover:text-red-800 font-bold flex items-center gap-1 hover:underline cursor-pointer"
                            >
                              <Trash2 size={11} /> Eliminar
                            </button>
                          )}
                        </div>

                        {config.firmaInvestigador ? (
                          <div className="bg-white p-2.5 rounded-lg border border-slate-200 space-y-2">
                            <div className="h-16 w-full bg-slate-50 border border-dashed border-slate-300 rounded flex items-center justify-center p-1 overflow-hidden">
                              <img 
                                src={config.firmaInvestigador} 
                                alt="Firma del Investigador" 
                                className="max-h-full max-w-full object-contain" 
                              />
                            </div>
                            <div className="flex items-center justify-between text-[10px]">
                              <span className="font-semibold text-emerald-700 flex items-center gap-1">
                                <CheckCircle size={12} /> Firma lista
                              </span>
                              <label className="text-[10px] font-bold text-fgn-blue hover:underline cursor-pointer flex items-center gap-1">
                                <FileUp size={11} /> Cambiar
                                <input
                                  type="file"
                                  accept="image/png, image/jpeg, image/jpg, image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    if (e.target.files?.[0]) handleSignatureUpload(e.target.files[0]);
                                  }}
                                />
                              </label>
                            </div>
                          </div>
                        ) : (
                          <label className="border-2 border-dashed border-slate-300 hover:border-fgn-blue bg-white rounded-lg p-3 flex flex-col items-center justify-center gap-1 cursor-pointer transition-colors group">
                            <FileUp size={16} className="text-fgn-blue group-hover:scale-105 transition-transform" />
                            <span className="text-[11px] font-bold text-fgn-blue">Subir imagen de firma</span>
                            <span className="text-[8px] text-slate-500">PNG transparente o JPG</span>
                            <input
                              type="file"
                              accept="image/png, image/jpeg, image/jpg, image/webp"
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files?.[0]) handleSignatureUpload(e.target.files[0]);
                              }}
                            />
                          </label>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-3 rounded border border-slate-200 text-[9px] text-slate-500 font-medium">
                    ⚡ Sus datos de perfil se guardan automáticamente y se aplican a todas las citaciones generadas y formatos FPJ-35 en Word.
                  </div>
                </div>
            </motion.div>

            {/* CONTENIDO PRINCIPAL DE CADA MODO */}
            <motion.div 
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="lg:col-span-8 space-y-8"
            >
              
              {/* MODOS DE ENTRADA */}
              {activeMode === 'pdf' && !pendingExtraction && (
                <div 
                  onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }} 
                  onDragLeave={() => setIsDragging(false)} 
                  onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) processFile(e.dataTransfer.files[0]); }} 
                  className={`relative p-16 rounded-xl border-2 border-dashed flex flex-col items-center justify-center text-center cursor-pointer transition-all ${isDragging ? 'border-fgn-blue bg-blue-50' : 'border-fgn-border bg-white'}`} 
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className={`p-6 rounded-full mb-4 ${isDragging ? 'bg-fgn-blue text-white' : 'bg-bg-gray text-fgn-blue'}`}>
                    <FileUp size={48} />
                  </div>
                  <h2 className="text-lg font-bold uppercase tracking-tight text-fgn-blue">
                    Cargar Orden de Policía Judicial
                  </h2>
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest mt-2">Detección automática por Gemini AI</p>
                  <input type="file" accept="application/pdf" className="hidden" ref={fileInputRef} onChange={(e) => e.target.files?.[0] && processFile(e.target.files[0])} />
                </div>
              )}

              {activeMode === 'manual' && (
                <div className="bg-white p-8 rounded-xl border border-fgn-border shadow-sm space-y-8">
                  <div className="flex items-center justify-between border-b border-fgn-border pb-4">
                    <h2 className="text-sm font-bold text-fgn-blue uppercase tracking-widest flex items-center gap-3">
                      <Plus size={20} className="text-fgn-blue" /> Formulario Oficial de Citación (FPJ-35)
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
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Nombre Completo *</label>
                        <input 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                          placeholder="NOMBRES Y APELLIDOS"
                          value={nuevoDato.nombre} 
                          onChange={(e) => setNuevoDato({...nuevoDato, nombre: e.target.value})} 
                        />
                      </div>
                      <div className="md:col-span-4">
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Documento / C.C.</label>
                        <input 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                          placeholder="Ej: 1.047.888.999"
                          value={nuevoDato.identificacion} 
                          onChange={(e) => setNuevoDato({...nuevoDato, identificacion: e.target.value})} 
                        />
                      </div>

                      <div className="md:col-span-4">
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Dirección de Residencia</label>
                        <input 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                          placeholder="Barrio, Calle, Transversal, Casa"
                          value={nuevoDato.direccion} 
                          onChange={(e) => setNuevoDato({...nuevoDato, direccion: e.target.value})} 
                        />
                      </div>
                      <div className="md:col-span-3">
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Teléfono / Celular</label>
                        <input 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                          placeholder="300 000 0000"
                          value={nuevoDato.telefono} 
                          onChange={(e) => setNuevoDato({...nuevoDato, telefono: e.target.value})} 
                        />
                      </div>
                      <div className="md:col-span-5">
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Correo Electrónico</label>
                        <input 
                          type="email"
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                          placeholder="correo@ejemplo.com"
                          value={nuevoDato.correo} 
                          onChange={(e) => setNuevoDato({...nuevoDato, correo: e.target.value})} 
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
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">NUNC (Noticia Criminal - 21 dígitos)</label>
                        <input 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded font-mono text-xs font-bold text-fgn-blue outline-none focus:border-fgn-blue" 
                          placeholder="Ej: 130016001128202600123"
                          maxLength={21}
                          value={nuevoDato.nunc} 
                          onChange={(e) => setNuevoDato({...nuevoDato, nunc: e.target.value})} 
                        />
                      </div>
                      <div className="md:col-span-5">
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">No. Orden OPJ / Caso *</label>
                        <input 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded font-mono text-xs font-bold outline-none focus:border-fgn-blue" 
                          placeholder="Ej: OPJ-123-2026"
                          value={nuevoDato.orden} 
                          onChange={(e) => setNuevoDato({...nuevoDato, orden: e.target.value})} 
                        />
                      </div>

                      <div className="md:col-span-12">
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Fiscalía Asignada</label>
                        <input 
                          placeholder="ej: 17 Local Cartagena" 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                          value={nuevoDato.fiscal} 
                          onChange={(e) => setNuevoDato({...nuevoDato, fiscal: e.target.value})} 
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
                        <label className="text-[9px] font-bold text-fgn-blue uppercase tracking-widest mb-1 block">Fecha Comparecencia *</label>
                        <input 
                          type="date" 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                          value={nuevoDato.fecha} 
                          onChange={(e) => setNuevoDato({...nuevoDato, fecha: e.target.value})} 
                        />
                      </div>
                      <div className="md:col-span-6">
                        <label className="text-[9px] font-bold text-fgn-blue uppercase tracking-widest mb-1 block">Hora Comparecencia *</label>
                        <input 
                          type="time" 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                          value={nuevoDato.hora} 
                          onChange={(e) => setNuevoDato({...nuevoDato, hora: e.target.value})} 
                        />
                      </div>

                      <div className="md:col-span-8">
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Motivo / Objeto de la Diligencia</label>
                        <select 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                          value={nuevoDato.motivo} 
                          onChange={(e) => setNuevoDato({...nuevoDato, motivo: e.target.value})}
                        >
                          <option value="Entrevista">Entrevista</option>
                          <option value="Interrogatorio">Interrogatorio</option>
                        </select>
                      </div>
                      <div className="md:col-span-4">
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">¿Requiere Abogado?</label>
                        <select 
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                          value={nuevoDato.requiereAbogado} 
                          onChange={(e) => setNuevoDato({...nuevoDato, requiereAbogado: e.target.value})}
                        >
                          <option value="NO">NO</option>
                          <option value="SI">SI</option>
                        </select>
                      </div>

                      <div className="md:col-span-12">
                        <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Observaciones / Anexos Requeridos</label>
                        <textarea 
                          rows={2}
                          className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue resize-none" 
                          value={nuevoDato.observaciones} 
                          onChange={(e) => setNuevoDato({...nuevoDato, observaciones: e.target.value})} 
                        />
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 flex gap-4">
                    <button 
                      onClick={agregarPersonaManual} 
                      disabled={!nuevoDato.nombre || !nuevoDato.orden} 
                      className="flex-1 bg-fgn-blue hover:bg-black disabled:bg-slate-300 text-white font-bold py-4 rounded text-[10px] tracking-[0.2em] uppercase transition-all shadow-md flex items-center justify-center gap-2"
                    >
                      <Plus size={16} /> Registrar Citación en Bandeja
                    </button>
                  </div>
                </div>
              )}

              {/* CONFIRMACIÓN DE EXTRACCIÓN IA (PDF) */}
              {pendingExtraction && (
                <motion.div 
                  initial={{ scale: 0.98, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="bg-white border-2 border-fgn-gold p-10 rounded-xl shadow-xl"
                >
                  <div className="flex justify-between items-start mb-8 border-b border-fgn-border pb-4">
                    <div>
                      <h2 className="text-fgn-blue font-bold text-lg flex items-center gap-3 uppercase tracking-tight">
                        <Sparkles size={20} className="text-fgn-gold" /> Validación de IA
                      </h2>
                    </div>
                    <button onClick={() => setPendingExtraction(null)} className="text-text-muted hover:text-red-600">
                      <X size={24} />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-8 bg-bg-gray p-4 border border-fgn-border rounded">
                      <label className="text-[9px] font-bold text-text-muted uppercase block mb-1">Orden OPJ</label>
                      <p className="font-mono font-bold text-fgn-blue text-sm">{pendingExtraction.orden || "---"}</p>
                    </div>
                    <div className="md:col-span-4 bg-bg-gray p-4 border border-fgn-border rounded">
                      <label className="text-[9px] font-bold text-text-muted uppercase block mb-1">Fiscalía</label>
                      <p className="font-bold text-fgn-blue text-xs uppercase">{pendingExtraction.fiscal || "---"}</p>
                    </div>
                    <div className="md:col-span-12 bg-bg-gray p-5 border-l-4 border-fgn-gold rounded">
                      <label className="text-[9px] font-bold text-fgn-gold uppercase mb-1 block">Citado Detectado</label>
                      <p className="font-bold text-text-main text-xl uppercase tracking-tight">{pendingExtraction.nombre || "..."}</p>
                    </div>
                    <div className="md:col-span-6">
                      <label className="text-[9px] font-bold text-fgn-blue uppercase mb-1 block">Fecha</label>
                      <input 
                        type="date" 
                        className="w-full p-3 border border-fgn-border rounded text-xs font-bold bg-white focus:border-fgn-blue outline-none" 
                        value={pendingExtraction.fecha} 
                        onChange={(e) => setPendingExtraction({...pendingExtraction, fecha: e.target.value})} 
                      />
                    </div>
                    <div className="md:col-span-6">
                      <label className="text-[9px] font-bold text-fgn-blue uppercase mb-1 block">Hora</label>
                      <input 
                        type="time" 
                        className="w-full p-3 border border-fgn-border rounded text-xs font-bold bg-white focus:border-fgn-blue outline-none" 
                        value={pendingExtraction.hora} 
                        onChange={(e) => setPendingExtraction({...pendingExtraction, hora: e.target.value})} 
                      />
                    </div>
                  </div>
                  <div className="flex gap-4 mt-10">
                    <button 
                      onClick={() => {
                        if (pendingExtraction.fecha && pendingExtraction.hora) {
                          registrarCitacion(pendingExtraction);
                          setPendingExtraction(null);
                        }
                      }} 
                      disabled={!pendingExtraction.fecha || !pendingExtraction.hora} 
                      className="flex-1 bg-fgn-blue hover:bg-black disabled:bg-slate-200 text-white font-bold py-4 rounded text-[10px] tracking-widest uppercase"
                    >
                      Sincronizar Datos
                    </button>
                    <button 
                      onClick={() => setPendingExtraction(null)}
                      className="px-8 bg-bg-gray text-text-muted font-bold rounded hover:bg-slate-200 transition-colors uppercase text-[10px] tracking-widest"
                    >
                      Descartar
                    </button>
                  </div>
                </motion.div>
              )}

              {/* BANDEJAS DE TRABAJO (PENDIENTES Y CITADOS) - YA NO APARECEN AQUÍ, ESTÁN EN SUS PROPIOS MODOS */}
            </motion.div>
          </div>
        </div>
      )}

      {activeMode === 'pendientes' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 pb-20"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button 
                onClick={() => {
                  setActiveMode(null);
                  setSelectedIds([]);
                  setSearchTerm("");
                }} 
                className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded border border-fgn-border shadow-sm transition-all"
              >
                <ArrowLeft size={14} strokeWidth={2} /> Volver al Inicio
              </button>
              {selectedIds.length > 0 && (
                <motion.button
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  onClick={marcarComoCitadoBulk}
                  className="flex items-center gap-2 bg-blue-600 text-white font-bold uppercase text-[10px] tracking-widest px-4 py-2 rounded shadow-md hover:bg-blue-700 transition-all"
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
            onFilterChange={handleFilterChangePendientes}
            fiscalOptions={fiscalOptions}
            showEstadoFilter={false}
            showInformeFilter={false}
            showAsistenciaFilter={false}
            totalCount={personas.length}
            filteredCount={filteredPendientes.length}
            placeholderSearch="BUSCAR EN GENERADAS (NOMBRE, CÉDULA, ORDEN OPJ)..."
          />

          <div className="bg-white rounded-xl border border-fgn-border overflow-hidden shadow-sm">
            <div className="hidden md:grid bg-bg-gray px-6 py-3 border-b border-fgn-border grid-cols-12 gap-4 text-[9px] font-bold text-text-muted uppercase tracking-widest">
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
              <div className="col-span-2">ORDEN OPJ</div>
              <div 
                className="col-span-4 flex items-center gap-1 cursor-pointer hover:text-fgn-blue transition-colors group"
                onClick={toggleSort}
              >
                FECHA Y HORA 
                <ArrowUpDown size={12} className={sortConfig.direction === 'asc' ? 'text-fgn-blue' : 'text-slate-300'} />
              </div>
              <div className="col-span-2 text-right">ACCIONES</div>
            </div>
            
            <div className="divide-y divide-fgn-border/30">
              {personas.length === 0 ? (
                <div className="py-20 text-center">
                  <Check size={40} className="mx-auto text-green-300 mb-2" />
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">No hay citaciones pendientes</p>
                </div>
              ) : filteredPendientes.length === 0 ? (
                <div className="text-center py-20 bg-slate-50">
                  <Search size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-text-muted font-bold uppercase tracking-widest text-xs">
                    No se encontraron citaciones generadas con los filtros aplicados
                  </p>
                </div>
              ) : (
                paginatedPendientes.map((p) => (
                  <div key={p.id} className="group hover:bg-slate-50/70 transition-colors">
                    {/* DESKTOP ROW */}
                    <div className="hidden md:grid px-6 py-4 grid-cols-12 gap-4 items-center">
                      <div className="col-span-1 flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-fgn-border text-fgn-blue focus:ring-fgn-blue cursor-pointer"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleSelection(p.id)}
                        />
                      </div>
                      <div className="col-span-3">
                        <p className="text-xs font-bold text-fgn-blue uppercase">
                          {p.nombre}{p.identificacion && p.identificacion.trim() ? ` con CC ${p.identificacion.trim()}` : ''}
                        </p>
                        {p.fiscal && (
                          <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                            Fiscalía {p.fiscal}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 font-mono text-[11px] text-text-muted uppercase">
                        {p.orden}
                      </div>
                      <div className="col-span-4 font-mono text-[11px] text-fgn-blue flex flex-col">
                        <span>{p.fecha ? formatDateES(p.fecha).toUpperCase() : '---'}</span>
                        {p.hora && <span className="text-[10px] text-fgn-gold font-bold">{formatTimeAMPM(p.hora)}</span>}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button 
                          onClick={() => {
                            setSelectedCitation(p);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-pink-600 hover:bg-pink-50 rounded transition-all cursor-pointer"
                          title="Ver Citación Completa"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handleDownloadWord(p)}
                          className="p-1.5 text-blue-700 hover:bg-blue-50 rounded transition-all cursor-pointer"
                          title="Descargar Formato Word FPJ-35 (.docx)"
                        >
                          <FileDown size={16} />
                        </button>
                        <button 
                          onClick={() => marcarComoCitado(p)}
                          className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all cursor-pointer"
                          title="Marcar como Citado (Mover a Citados)"
                        >
                          <CheckCircle size={16} />
                        </button>
                        <button 
                          onClick={() => copiarAlPortapapeles(generarMensaje(p), p)} 
                          className={`p-1.5 rounded transition-all cursor-pointer ${copiadoIdx === p.id ? 'bg-green-600 text-white' : 'text-green-600 hover:bg-green-50'}`}
                          title="Copiar Texto WhatsApp"
                        >
                          {copiadoIdx === p.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                        <button 
                          onClick={() => eliminarDeHistorial(p.id, p.nombre)} 
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer" 
                          title="Eliminar Citación"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* MOBILE CARD */}
                    <div className="block md:hidden p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-start gap-2.5">
                          <input 
                            type="checkbox" 
                            className="w-4 h-4 mt-0.5 rounded border-fgn-border text-fgn-blue focus:ring-fgn-blue shrink-0 cursor-pointer"
                            checked={selectedIds.includes(p.id)}
                            onChange={() => toggleSelection(p.id)}
                          />
                          <div>
                            <p className="text-xs font-bold text-fgn-blue uppercase">
                              {p.nombre}{p.identificacion && p.identificacion.trim() ? ` con CC ${p.identificacion.trim()}` : ''}
                            </p>
                            {p.fiscal && (
                              <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">
                                Fiscalía {p.fiscal}
                              </p>
                            )}
                          </div>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                          {p.orden}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                        <span className="text-slate-600">
                          {p.fecha ? formatDateES(p.fecha).toUpperCase() : '---'}
                        </span>
                        {p.hora && (
                          <span className="text-fgn-blue font-bold">
                            {formatTimeAMPM(p.hora)}
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                        <button 
                          onClick={() => marcarComoCitado(p)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-blue-700 bg-blue-50 hover:bg-blue-100 rounded border border-blue-200 font-bold transition-all cursor-pointer"
                          title="Marcar como Citado"
                        >
                          <CheckCircle size={13} /> <span>Citado</span>
                        </button>
                        <button 
                          onClick={() => copiarAlPortapapeles(generarMensaje(p), p)} 
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border font-bold transition-all cursor-pointer ${copiadoIdx === p.id ? 'bg-green-600 text-white border-green-600' : 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200'}`}
                        >
                          {copiadoIdx === p.id ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiadoIdx === p.id ? 'Copiado' : 'WhatsApp'}</span>
                        </button>
                        <button 
                          onClick={() => handleDownloadWord(p)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 font-bold transition-all cursor-pointer"
                        >
                          <FileDown size={13} /> <span>Word</span>
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedCitation(p);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-pink-600 hover:bg-pink-50 rounded border border-pink-200 transition-all cursor-pointer"
                          title="Ver Detalle"
                        >
                          <Eye size={15} />
                        </button>
                        <button 
                          onClick={() => eliminarDeHistorial(p.id, p.nombre)} 
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-red-200 transition-all cursor-pointer" 
                          title="Eliminar Citación"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Controles de Paginación */}
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

      {/* MODO LISTADO CITADOS */}
      {activeMode === 'citados' && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6 pb-20"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button 
              onClick={() => {
                setActiveMode(null);
                setSearchTerm("");
              }} 
              className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded border border-fgn-border shadow-sm transition-all w-fit"
            >
              <ArrowLeft size={14} strokeWidth={2} /> Volver al Inicio
            </button>
            <h2 className="text-xl font-bold text-green-600 uppercase tracking-tight flex items-center gap-3">
              <Check size={24} /> Listado de Citados (Enviados)
            </h2>
          </div>

          {/* Filter Bar */}
          <CitationFilterBar
            filters={filtersCitados}
            onFilterChange={handleFilterChangeCitados}
            fiscalOptions={fiscalOptions}
            showEstadoFilter={false}
            showInformeFilter={true}
            showAsistenciaFilter={true}
            totalCount={citados.length}
            filteredCount={filteredCitados.length}
            placeholderSearch="BUSCAR EN CITADOS (NOMBRE, CÉDULA, ORDEN, FISCAL)..."
          />

          <div className="bg-white rounded-xl border border-fgn-border overflow-hidden shadow-sm">
            <div className="hidden md:grid bg-bg-gray px-6 py-3 border-b border-fgn-border grid-cols-12 gap-4 text-[9px] font-bold text-text-muted uppercase tracking-widest">
              <div className="col-span-3">PARTICIPANTE</div>
              <div className="col-span-2">ORDEN OPJ</div>
              <div 
                className="col-span-2 flex items-center gap-1 cursor-pointer hover:text-fgn-blue transition-colors group"
                onClick={toggleSort}
              >
                FECHA Y HORA 
                <ArrowUpDown size={12} className={sortConfig.direction === 'asc' ? 'text-fgn-blue' : 'text-slate-300'} />
              </div>
              <div className="col-span-2 text-center">INFORME</div>
              <div className="col-span-2 text-center">ASISTENCIA</div>
              <div className="col-span-1 text-right">ACCIONES</div>
            </div>
            
            <div className="divide-y divide-fgn-border/30">
              {citados.length === 0 ? (
                <div className="py-20 text-center">
                  <Search size={40} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">No hay citados en esta sesión</p>
                </div>
              ) : filteredCitados.length === 0 ? (
                <div className="text-center py-20 bg-slate-50">
                  <Search size={40} className="mx-auto text-slate-300 mb-2" />
                  <p className="text-text-muted font-bold uppercase tracking-widest text-xs">
                    No se encontraron personas citadas con los filtros aplicados
                  </p>
                </div>
              ) : (
                paginatedCitados.map((p) => (
                  <div key={p.id} className="group hover:bg-slate-50/70 transition-colors">
                    {/* DESKTOP ROW */}
                    <div className="hidden md:grid px-6 py-4 grid-cols-12 gap-4 items-center">
                      <div className="col-span-3">
                        <p className="text-xs font-bold text-fgn-blue uppercase">
                          {p.nombre}{p.identificacion && p.identificacion.trim() ? ` con CC ${p.identificacion.trim()}` : ''}
                        </p>
                        {p.fiscal && (
                          <p className="text-[10px] text-slate-400 font-medium uppercase mt-0.5">
                            Fiscalía {p.fiscal}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 font-mono text-[11px] text-text-muted uppercase">
                        {p.orden}
                      </div>
                      <div className="col-span-2 font-mono text-[11px] text-fgn-blue flex flex-col">
                        <span>{p.fecha ? formatDateES(p.fecha).toUpperCase() : '---'}</span>
                        {p.hora && <span className="text-[10px] text-fgn-gold font-bold">{formatTimeAMPM(p.hora)}</span>}
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-2">
                        <button 
                          onClick={() => marcarInforme(p.id, p.informe === 'si' ? null : 'si')}
                          className={`p-1.5 rounded transition-all border ${p.informe === 'si' ? 'bg-fgn-blue text-white border-fgn-blue shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-fgn-blue hover:border-fgn-blue cursor-pointer'}`}
                          title={p.informe === 'si' ? 'Informe Realizado (Clic para desmarcar)' : 'Marcar con Informe'}
                        >
                          <FileCheck size={14} />
                        </button>
                        <button 
                          onClick={() => marcarInforme(p.id, p.informe === 'no' ? null : 'no')}
                          className={`p-1.5 rounded transition-all border ${p.informe === 'no' ? 'bg-slate-500 text-white border-slate-500 shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-slate-500 hover:border-slate-500 cursor-pointer'}`}
                          title={p.informe === 'no' ? 'Marcado Sin Informe (Clic para desmarcar)' : 'Marcar Sin Informe'}
                        >
                          <FileX size={14} />
                        </button>
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-2">
                        <button 
                          onClick={() => marcarAsistencia(p.id, p.asistencia === 'asistio' ? null : 'asistio')}
                          className={`p-1.5 rounded transition-all border ${p.asistencia === 'asistio' ? 'bg-green-600 text-white border-green-600 shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-green-500 hover:border-green-500 cursor-pointer'}`}
                          title={p.asistencia === 'asistio' ? 'Asistió (Clic para desmarcar)' : 'Marcar Asistió'}
                        >
                          <UserCheck size={14} />
                        </button>
                        <button 
                          onClick={() => marcarAsistencia(p.id, p.asistencia === 'no_asistio' ? null : 'no_asistio')}
                          className={`p-1.5 rounded transition-all border ${p.asistencia === 'no_asistio' ? 'bg-red-600 text-white border-red-600 shadow-xs' : 'bg-white text-slate-300 border-slate-200 hover:text-red-500 hover:border-red-500 cursor-pointer'}`}
                          title={p.asistencia === 'no_asistio' ? 'No Asistió (Clic para desmarcar)' : 'Marcar No Asistió'}
                        >
                          <UserX size={14} />
                        </button>
                      </div>
                      <div className="col-span-1 flex items-center justify-end gap-1">
                        <button 
                          onClick={() => {
                            setSelectedCitation(p);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-pink-600 hover:bg-pink-50 rounded transition-all cursor-pointer"
                          title="Ver Citación"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => handleDownloadWord(p)}
                          className="p-1.5 text-blue-700 hover:bg-blue-50 rounded transition-all cursor-pointer"
                          title="Descargar Formato Word FPJ-35 (.docx)"
                        >
                          <FileDown size={16} />
                        </button>
                        <button 
                          onClick={() => copiarAlPortapapeles(generarMensaje(p), p)} 
                          className={`p-1.5 rounded transition-all cursor-pointer ${copiadoIdx === p.id ? 'bg-green-600 text-white' : 'text-green-600 hover:bg-green-50'}`}
                          title="Copiar Texto WhatsApp"
                        >
                          {copiadoIdx === p.id ? <Check size={16} /> : <Copy size={16} />}
                        </button>
                        <button 
                          onClick={() => eliminarDeHistorial(p.id, p.nombre)} 
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all cursor-pointer" 
                          title="Eliminar Citación"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>

                    {/* MOBILE CARD */}
                    <div className="block md:hidden p-3.5 space-y-2.5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-fgn-blue uppercase">
                            {p.nombre}{p.identificacion && p.identificacion.trim() ? ` con CC ${p.identificacion.trim()}` : ''}
                          </p>
                          {p.fiscal && (
                            <p className="text-[10px] text-slate-500 font-medium uppercase mt-0.5">
                              Fiscalía {p.fiscal}
                            </p>
                          )}
                        </div>
                        <span className="font-mono text-[10px] font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 shrink-0">
                          {p.orden}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] bg-slate-50 p-2 rounded border border-slate-100 font-mono">
                        <span className="text-slate-600">
                          {p.fecha ? formatDateES(p.fecha).toUpperCase() : '---'}
                        </span>
                        {p.hora && (
                          <span className="text-fgn-blue font-bold">
                            {formatTimeAMPM(p.hora)}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        {/* Informe controls */}
                        <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-200 text-[10px]">
                          <span className="font-bold text-slate-600 uppercase">Informe:</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => marcarInforme(p.id, p.informe === 'si' ? null : 'si')}
                              className={`p-1.5 rounded transition-all border ${p.informe === 'si' ? 'bg-fgn-blue text-white border-fgn-blue' : 'bg-white text-slate-400 border-slate-300'}`}
                              title="Con Informe"
                            >
                              <FileCheck size={13} />
                            </button>
                            <button
                              onClick={() => marcarInforme(p.id, p.informe === 'no' ? null : 'no')}
                              className={`p-1.5 rounded transition-all border ${p.informe === 'no' ? 'bg-slate-600 text-white border-slate-600' : 'bg-white text-slate-400 border-slate-300'}`}
                              title="Sin Informe"
                            >
                              <FileX size={13} />
                            </button>
                          </div>
                        </div>

                        {/* Asistencia controls */}
                        <div className="flex items-center justify-between p-1.5 bg-slate-50 rounded border border-slate-200 text-[10px]">
                          <span className="font-bold text-slate-600 uppercase">Asistencia:</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={() => marcarAsistencia(p.id, p.asistencia === 'asistio' ? null : 'asistio')}
                              className={`p-1.5 rounded transition-all border ${p.asistencia === 'asistio' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-400 border-slate-300'}`}
                              title="Asistió"
                            >
                              <UserCheck size={13} />
                            </button>
                            <button
                              onClick={() => marcarAsistencia(p.id, p.asistencia === 'no_asistio' ? null : 'no_asistio')}
                              className={`p-1.5 rounded transition-all border ${p.asistencia === 'no_asistio' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-400 border-slate-300'}`}
                              title="No Asistió"
                            >
                              <UserX size={13} />
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                        <button 
                          onClick={() => copiarAlPortapapeles(generarMensaje(p), p)} 
                          className={`flex items-center gap-1 px-2.5 py-1.5 text-xs rounded border font-bold transition-all cursor-pointer ${copiadoIdx === p.id ? 'bg-green-600 text-white border-green-600' : 'text-green-700 bg-green-50 hover:bg-green-100 border-green-200'}`}
                        >
                          {copiadoIdx === p.id ? <Check size={13} /> : <Copy size={13} />}
                          <span>{copiadoIdx === p.id ? 'Copiado' : 'WhatsApp'}</span>
                        </button>
                        <button 
                          onClick={() => handleDownloadWord(p)}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-xs text-indigo-700 bg-indigo-50 hover:bg-indigo-100 rounded border border-indigo-200 font-bold transition-all cursor-pointer"
                        >
                          <FileDown size={13} /> <span>Word</span>
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedCitation(p);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-pink-600 hover:bg-pink-50 rounded border border-pink-200 transition-all cursor-pointer"
                          title="Ver Citación"
                        >
                          <Eye size={15} />
                        </button>
                        <button 
                          onClick={() => eliminarDeHistorial(p.id, p.nombre)} 
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded border border-red-200 transition-all cursor-pointer" 
                          title="Eliminar Citación"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Controles de Paginación */}
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

      </main>

      <footer className="max-w-7xl mx-auto px-6 mt-16 pb-8">
        <div className="border-t border-fgn-border pt-8 flex flex-col md:flex-row justify-between items-center gap-4 font-bold text-[10px] text-text-muted uppercase tracking-wider">
           <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span>Conectado a Firebase Firestore • Gemini AI v2.5</span>
           </div>
           <p>© 2026 Fiscalía General de la Nación - República de Colombia</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
