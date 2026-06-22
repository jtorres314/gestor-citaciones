/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { 
  Copy, User, Calendar, ClipboardList, FileText, Building2, 
  Trash2, Plus, Sparkles, 
  Wand2, BrainCircuit, Loader2, FileUp, X, Check,
  History, Search, ArrowLeft, LogOut, Eye, ArrowUpDown,
  UserCheck, UserX, UserMinus, CheckCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

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

const App = () => {
  // Navigation & Auth States
  const [user, setUser] = useState<any>(null);
  const [activeMode, setActiveMode] = useState<string | null>(null);

  // Configuration States (Investigator Profile)
  const [config, setConfig] = useState({
    investigador: "Investigador Judicial",
    telefono: "3000000000",
    oficina: "Fiscalía General de la Nación - Unidad de Patrimonio Económico"
  });

  // Data States
  const [personas, setPersonas] = useState<any[]>([]); // PENDIENTES
  const [citados, setCitados] = useState<any[]>([]); // CITADOS
  const [historial, setHistorial] = useState<any[]>([]); // ARCHIVO HISTÓRICO
  const [hasInitializedPendientes, setHasInitializedPendientes] = useState(false);
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' }>({ key: 'fecha', direction: 'asc' });
  const [nuevoDato, setNuevoDato] = useState({ 
    nombre: '', genero: 'Femenino', fecha: '', hora: '', orden: '', fiscal: '17 Local', unidad: 'Hurtos de la Ciudad de Cartagena' 
  });

  // AI & File States
  const [rawText, setRawText] = useState("");
  const [loadingIA, setLoadingIA] = useState(false);
  const [loadingText, setLoadingText] = useState("Procesando...");
  const [pendingExtraction, setPendingExtraction] = useState<any>(null); 
  const [copiadoIdx, setCopiadoIdx] = useState<string | number | null>(null);
  const [selectedCitation, setSelectedCitation] = useState<any>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const applyFilters = (list: any[]) => {
    if (!searchTerm) return list;
    const term = searchTerm.toLowerCase();
    return list.filter(p => 
      (p.nombre || "").toLowerCase().includes(term) || 
      (p.orden || "").toLowerCase().includes(term)
    );
  };

  // (1) Authentication & Connection Check
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        
        // Load Profile from Firestore
        try {
          const userDoc = await getDocFromServer(doc(db, 'users', u.uid));
          if (userDoc.exists() && userDoc.data().config) {
            setConfig(userDoc.data().config);
          } else {
            // Initial save of default config
            await setDoc(doc(db, 'users', u.uid), {
              lastSeen: new Date().toISOString(),
              email: u.email || 'anonymous',
              config: config
            }, { merge: true });
          }
        } catch (e) {
          console.warn("User data loading/sync skipped", e);
        }
      } else {
        setUser(null);
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
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      console.error("Error signing in with Google:", error);
      alert("Error al iniciar sesión con Google. Por favor, intente de nuevo.");
    }
  };

  const handleAnonymousLogin = async () => {
    try {
      await signInAnonymously(auth);
    } catch (error: any) {
      console.error("Error signing in anonymously:", error);
      if (error.code === 'auth/admin-restricted-operation') {
        alert("El inicio de sesión anónimo está deshabilitado en la consola de Firebase. Por favor use Google o habilítelo en Authentication > Sign-in method.");
      } else {
        alert("Error al iniciar sesión de forma anónima.");
      }
    }
  };

  // Persist Profile Changes
  useEffect(() => {
    if (!user) return;
    const saveConfig = async () => {
      try {
        await setDoc(doc(db, 'users', user.uid), { config }, { merge: true });
      } catch (e) {
        console.error("Error saving profile:", e);
      }
    };

    const timeout = setTimeout(saveConfig, 1000);
    return () => clearTimeout(timeout);
  }, [config, user]);

  // (2) Listen to History from Firestore
  useEffect(() => {
    if (!user) return;

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
      const item = { 
        ...data, 
        estado: 'pendiente', // Default status
        // Capture profile at creation time
        investigador_creador: config.investigador,
        telefono_creador: config.telefono,
        oficina_creador: config.oficina,
        creadoEl: new Date().toLocaleString('es-CO'),
        creadoTimestamp: Date.now()
      };
      
      // Firestore history
      const historialRef = collection(db, 'artifacts', appId, 'users', user.uid, 'historial');
      await addDoc(historialRef, item);
      
      // No need to set personas directly, the onSnapshot listener handles it
    } catch (err) {
      console.error("Error registering citation:", err);
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
              { text: "Analiza esta Orden a la Policía Judicial en PDF. Extrae los siguientes datos en formato JSON puro (sin bloques de código markdown): { nombre, genero (Femenino o Masculino), orden (número de orden), fiscal (solo el número y la palabra 'Local', ej: '17 Local'), unidad (limpia el nombre comercial o técnico, ej: 'Hurtos de la Ciudad de Cartagena') }." },
              { inlineData: { mimeType: "application/pdf", data: base64 } }
            ]
          },
          config: {
            responseMimeType: "application/json"
          }
        });

        const parsed = JSON.parse(response.text);
        setPendingExtraction({ ...parsed, fecha: '', hora: '' });
      } catch (err) {
        console.error("Error analyzing PDF:", err);
      } finally {
        setLoadingIA(false);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSmartExtract = async () => {
    if (!rawText.trim()) return;
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
        alert(`Éxito: Se procesaron ${parsed.personas.length} citaciones.`);
      } else {
        alert("No se encontraron datos de citación válidos en el texto. Verifique que incluya nombre, orden, fecha y hora.");
      }
    } catch (err: any) { 
      console.error("Error in AI extraction:", err);
      alert("Error: " + (err.message || "No se pudo extraer la información del texto."));
    } finally { 
      setLoadingIA(false); 
    }
  };

  const agregarPersonaManual = () => {
    if (nuevoDato.nombre && nuevoDato.orden && nuevoDato.fecha && nuevoDato.hora) {
      registrarCitacion(nuevoDato);
      setNuevoDato({ ...nuevoDato, nombre: '', orden: '', fecha: '', hora: '' });
    }
  };

  const eliminarDeBandeja = (id: any) => setPersonas(personas.filter(p => p.id !== id));
  
  const marcarComoCitado = async (item: any) => {
    if (!user || !item.id) return;
    try {
      // Optimistic UI updates to move from Pendientes to Citados
      setPersonas(prev => prev.filter(p => p.id !== item.id));
      setCitados(prev => {
        if (prev.some(c => c.id === item.id)) return prev;
        return [...prev, { ...item, estado: 'citado' }];
      });

      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', item.id);
      await updateDoc(docRef, { estado: 'citado' });
    } catch (err) {
      console.error("Error al marcar como citado:", err);
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
      setSelectedIds([]);

      // Firestore updates
      const batchPromises = itemsToMove.map(item => {
        const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', item.id);
        return updateDoc(docRef, { estado: 'citado' });
      });
      await Promise.all(batchPromises);
    } catch (err) {
      console.error("Error en movimiento masivo:", err);
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
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id);
      await updateDoc(docRef, { asistencia: valor });
      
      // Optimistic update for Citados
      setCitados(prev => prev.map(c => c.id === id ? { ...c, asistencia: valor } : c));
    } catch (err) {
      console.error("Error al marcar asistencia:", err);
    }
  };

  const eliminarDeHistorial = async (id: string) => {
    if (!user) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id));
      // También lo quitamos de las listas locales si está
      setPersonas(prev => prev.filter(p => p.id !== id));
      setCitados(prev => prev.filter(c => c.id !== id));
    } catch (err) {
      console.error("Error deleting from history:", err);
    }
  };

  const generarMensaje = (p: any) => {
    const trato = p.genero === "Femenino" ? "Señora" : "Señor";
    const fechaFormateada = formatDateES(p.fecha);
    const horaFormateada = formatTimeAMPM(p.hora);
    
    // Prefer data captured at creation for consistency
    const oficina = p.oficina_creador || config.oficina;
    const telefono = p.telefono_creador || config.telefono;
    const investigador = p.investigador_creador || config.investigador;

    return `Buenas ${trato} ${p.nombre.toUpperCase()}, este mensaje es con el fin de realizarle citación para el día ${fechaFormateada} a las ${horaFormateada} en la ${oficina}, a diligencia de entrevista ordenada por el Fiscal ${p.fiscal} de la Unidad de ${p.unidad} dentro de la Orden a Policía judicial No. ${p.orden}.

Esta diligencia se requiere para que usted amplié las circunstancias de tiempo, modo y lugar, en la que ocurrieron los hechos en los que usted resulto como victima, y se requiere que por favor traiga los documentos que acrediten la cuantía de las totalidad del dinero hurtado.

Por favor comunicarse lo antes posible a el numero ${telefono} (Llamada o WhatsApp) y preguntar por el Investigador ${investigador}.`;
  };

  const copiarAlPortapapeles = async (texto: string, item: any) => {
    navigator.clipboard.writeText(texto);
    const id = item.id;
    if (!id) return;

    setCopiadoIdx(id);
    setTimeout(() => setCopiadoIdx(null), 2000);
  };

  const LoadingOverlay = () => (
    <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      {(!user && !loadingIA) ? (
        <motion.div 
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          className="bg-white p-10 rounded-xl shadow-2xl flex flex-col items-center space-y-6 max-w-sm w-full border border-fgn-border"
        >
          <div className="text-center">
            <div className="bg-fgn-gold w-16 h-16 rounded-full mx-auto flex items-center justify-center mb-4">
               <Building2 size={32} className="text-fgn-blue" />
            </div>
            <h2 className="text-xl font-bold text-fgn-blue uppercase tracking-tight">Acceso Requerido</h2>
            <p className="text-text-muted text-[11px] font-medium leading-relaxed mt-2 uppercase tracking-widest">
              Para gestionar citaciones de forma segura, inicie sesión con su cuenta institucional o personal.
            </p>
          </div>
          
          <div className="w-full space-y-3">
            <button 
              onClick={handleGoogleLogin}
              className="w-full flex items-center justify-center gap-3 bg-white border border-fgn-border py-3 rounded font-bold text-xs uppercase tracking-widest text-fgn-blue hover:bg-slate-50 transition-all shadow-sm"
            >
              <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" className="w-5 h-5" referrerPolicy="no-referrer" />
              Ingresar con Google
            </button>
            
            <button 
              onClick={handleAnonymousLogin}
              className="w-full py-3 bg-bg-gray text-text-muted font-bold text-[10px] uppercase tracking-widest rounded hover:bg-slate-200 transition-all"
            >
              Acceso Rápido (Invitado)
            </button>
          </div>

          <p className="text-[9px] text-text-muted text-center leading-relaxed">
            Nota: El acceso rápido requiere que "Anonymous Auth" esté habilitado en la consola de Firebase.
          </p>
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
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4">
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-xl shadow-2xl max-w-2xl w-full border border-fgn-border overflow-hidden"
            >
              <div className="bg-fgn-blue text-white px-6 py-4 flex justify-between items-center border-b-4 border-fgn-gold">
                <h3 className="text-sm font-bold uppercase tracking-widest flex items-center gap-2">
                  <FileText size={18} /> Vista Previa de Citación
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-full transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8">
                <div className="bg-bg-gray p-6 rounded border border-fgn-border shadow-inner max-h-[60vh] overflow-y-auto">
                   <pre className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-text-main">
                      {generarMensaje(selectedCitation)}
                   </pre>
                </div>
                <div className="mt-8 flex justify-end gap-3">
                  <button 
                    onClick={() => copiarAlPortapapeles(generarMensaje(selectedCitation), selectedCitation)}
                    className={`px-8 py-3 rounded text-[10px] font-bold tracking-widest uppercase transition-all flex items-center gap-2 ${copiadoIdx === (selectedCitation.id || 'modal') ? 'bg-green-600 text-white' : 'bg-fgn-blue text-white hover:bg-black'}`}
                  >
                    {copiadoIdx === (selectedCitation.id || 'modal') ? <Check size={14} /> : <Copy size={14} />}
                    {copiadoIdx === (selectedCitation.id || 'modal') ? 'COPIADO' : 'COPIAR CONTENIDO'}
                  </button>
                  <button 
                    onClick={() => setIsModalOpen(false)}
                    className="px-8 py-3 bg-white border border-fgn-border text-text-muted font-bold rounded text-[10px] tracking-widest uppercase hover:bg-slate-50 transition-all"
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* HEADER INSTITUCIONAL */}
      <header className="bg-fgn-blue text-white shadow-lg sticky top-0 z-50 border-b-4 border-fgn-gold">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="bg-fgn-gold w-10 h-10 rounded flex items-center justify-center shadow-inner">
               <FileText size={20} className="text-fgn-blue" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-wider uppercase">
                Fiscalía General de la Nación
              </h1>
              <p className="text-blue-100/70 text-[10px] font-bold tracking-[0.1em] uppercase">Unidad de Patrimonio Económico • Ecosistema Digital de Citaciones</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3 mr-2">
                 <div className="text-right hidden sm:block">
                   <p className="text-[9px] font-bold uppercase text-blue-200 tracking-widest leading-none">Investigador</p>
                   <p className="text-xs font-bold text-white leading-tight truncate max-w-[150px]">{user.displayName || user.email || 'Agente'}</p>
                 </div>
                 <button 
                  onClick={() => signOut(auth)}
                  className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors"
                  title="Cerrar Sesión"
                 >
                   <LogOut size={16} className="text-white" />
                 </button>
              </div>
            )}
            <div className="bg-fgn-blue/50 border border-white/20 px-6 py-2 rounded flex items-center gap-6 backdrop-blur-sm">
              <button 
                onClick={() => setActiveMode('pendientes')}
                className={`text-center transition-all group ${activeMode === 'pendientes' ? 'scale-110' : 'hover:scale-105'}`}
              >
                <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 group-hover:text-white transition-colors ${activeMode === 'pendientes' ? 'text-white' : 'text-blue-200'}`}>Generadas</p>
                <p className="text-lg font-mono font-bold text-white leading-none">{personas.length}</p>
              </button>
              <div className="h-8 w-[1px] bg-white/10"></div>
              <button 
                onClick={() => setActiveMode('citados')}
                className={`text-center transition-all group ${activeMode === 'citados' ? 'scale-110' : 'hover:scale-105'}`}
              >
                <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 group-hover:text-white transition-colors ${activeMode === 'citados' ? 'text-white' : 'text-blue-200'}`}>Citados</p>
                <p className="text-lg font-mono font-bold text-white leading-none">{citados.length}</p>
              </button>
              <div className="h-8 w-[1px] bg-white/10"></div>
              <button 
                onClick={() => setActiveMode('historial')}
                className={`flex flex-col items-center group transition-all ${activeMode === 'historial' ? 'scale-110' : 'hover:scale-105'}`}
              >
                <p className={`text-[9px] font-bold uppercase tracking-widest mb-0.5 group-hover:text-white transition-colors ${activeMode === 'historial' ? 'text-white' : 'text-blue-200'}`}>Archivo</p>
                <div className="flex items-center gap-2">
                   <History size={16} className={`transition-colors ${activeMode === 'historial' ? 'text-white' : 'text-blue-200 group-hover:text-white'}`} />
                   <span className="text-lg font-mono font-bold text-white leading-none">{historial.length}</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-12">
        
        {/* PANEL DE BIENVENIDA / MENÚ */}
        {!activeMode && !pendingExtraction && (
          <motion.div 
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="py-12"
          >
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold text-fgn-blue uppercase tracking-normal">Centro de Gestión Judicial</h2>
              <div className="w-16 h-1 bg-fgn-gold mx-auto mt-2" />
              <p className="text-text-muted font-bold uppercase text-[10px] tracking-widest pt-4">Seleccione una modalidad de trabajo para iniciar el procesamiento</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                { 
                  id: 'manual', 
                  title: 'Registro Manual', 
                  icon: <Plus size={40} />, 
                  color: 'fgn-blue', 
                  desc: 'Formulario estándar para creación de citaciones con validación inmediata.' 
                },
                { 
                  id: 'pdf', 
                  title: 'Análisis PDF (IA)', 
                  icon: <FileUp size={40} />, 
                  color: 'fgn-blue', 
                  desc: 'Extraiga datos desde órdenes judiciales PDF usando inteligencia artificial.' 
                },
                { 
                  id: 'texto', 
                  title: 'Texto Libre (IA)', 
                  icon: <BrainCircuit size={40} />, 
                  color: 'fgn-blue', 
                  desc: 'Pegue informes desordenados para normalización automática de datos.' 
                }
              ].map(mode => (
                <button 
                  key={mode.id}
                  onClick={() => setActiveMode(mode.id)} 
                  className="group bg-white p-10 rounded-xl border border-fgn-border shadow-sm hover:border-fgn-blue hover:shadow-md transition-all flex flex-col items-center text-center space-y-4"
                >
                  <div className="w-20 h-20 rounded-full bg-bg-gray flex items-center justify-center text-fgn-blue group-hover:scale-110 transition-transform">
                    {mode.icon}
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-fgn-blue uppercase tracking-tight">{mode.title}</h3>
                    <p className="text-text-muted text-[11px] font-medium leading-relaxed mt-2">{mode.desc}</p>
                  </div>
                </button>
              ))}
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
            <div className="flex items-center justify-between">
               <button 
                onClick={() => {
                  setActiveMode(null);
                  setSearchTerm("");
                }} 
                className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded border border-fgn-border shadow-sm transition-all"
               >
                 <ArrowLeft size={14} strokeWidth={2} /> Volver al Inicio
               </button>
               <div className="flex-1 max-w-md mx-6">
                 <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                     type="text"
                     placeholder="BUSCAR POR NOMBRE O No. ORDEN..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full bg-white border border-fgn-border rounded-lg py-2.5 pl-10 pr-4 text-xs font-bold text-fgn-blue placeholder:text-slate-300 outline-none focus:border-fgn-blue focus:ring-1 focus:ring-fgn-blue shadow-sm transition-all uppercase"
                   />
                 </div>
               </div>
               <h2 className="text-xl font-bold text-fgn-blue uppercase tracking-tight flex items-center gap-3">
                 <History size={24} className="text-fgn-blue"/> Archivo Histórico de Citaciones
               </h2>
            </div>

            <div className="bg-white rounded-xl border border-fgn-border overflow-hidden shadow-sm">
              <div className="bg-bg-gray px-6 py-3 border-b border-fgn-border grid grid-cols-12 gap-4 text-[9px] font-bold text-text-muted uppercase tracking-widest">
                <div className="col-span-3">PARTICIPANTE</div>
                <div className="col-span-2">ORDEN OPJ</div>
                <div 
                  className="col-span-5 flex items-center gap-1 cursor-pointer hover:text-fgn-blue transition-colors group"
                  onClick={toggleSort}
                >
                  FECHA Y HORA 
                  <ArrowUpDown size={12} className={sortConfig.direction === 'asc' ? 'text-fgn-blue' : 'text-slate-300'} />
                </div>
                <div className="col-span-2 text-right">ACCIONES</div>
              </div>

              {historial.length === 0 ? (
                <div className="text-center py-24">
                   <Search size={48} className="mx-auto text-slate-200 mb-4" />
                   <p className="text-text-muted font-bold uppercase tracking-widest text-[10px]">Sin registros en base de datos</p>
                </div>
              ) : (
                <div className="divide-y divide-fgn-border/30">
                  {getSortedList(applyFilters(historial)).map((p) => (
                    <motion.div 
                      layout
                      key={p.id} 
                      className="px-6 py-4 grid grid-cols-12 gap-4 items-center hover:bg-slate-50 transition-colors"
                    >
                      <div className="col-span-3">
                        <p className="text-xs font-bold text-fgn-blue uppercase">{p.nombre}</p>
                      </div>
                      <div className="col-span-2 font-mono text-[11px] text-text-muted uppercase">
                        {p.orden}
                      </div>
                      <div className="col-span-5 font-mono text-[11px] text-fgn-blue flex flex-col">
                        <span>{p.fecha ? formatDateES(p.fecha).toUpperCase() : '---'}</span>
                        {p.hora && <span className="text-[10px] text-fgn-gold font-bold">{formatTimeAMPM(p.hora)}</span>}
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                        <button 
                          onClick={() => {
                            setSelectedCitation(p);
                            setIsModalOpen(true);
                          }}
                          className="p-1.5 text-pink-600 hover:bg-pink-50 rounded transition-all"
                          title="Ver Citación Completa"
                        >
                          <Eye size={16} />
                        </button>
                        <button 
                          onClick={() => eliminarDeHistorial(p.id)} 
                          className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all"
                          title="Eliminar"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* FLUJO DE TRABAJO ACTIVO (REGISTRO Y EXTRACCIÓN) */}
        {(['manual', 'pdf', 'texto'].includes(activeMode || '') || pendingExtraction) && (
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
                <div className="bg-white p-6 rounded-xl border border-fgn-border shadow-sm h-full">
                <h2 className="text-xs font-bold mb-6 flex items-center gap-2 border-b border-fgn-border pb-3 text-fgn-blue uppercase tracking-widest">
                  <Building2 size={16} /> Perfil Investigador
                </h2>
                <div className="space-y-5">
                  <div>
                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Funcionario</label>
                    <input 
                      className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                      value={config.investigador} 
                      onChange={(e) => setConfig({...config, investigador: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">WhatsApp / Móvil</label>
                    <input 
                      className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                      value={config.telefono} 
                      onChange={(e) => setConfig({...config, telefono: e.target.value})} 
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Despacho</label>
                    <textarea 
                      rows={2} 
                      className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue resize-none" 
                      value={config.oficina} 
                      onChange={(e) => setConfig({...config, oficina: e.target.value})} 
                    />
                  </div>
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

              {activeMode === 'texto' && (
                <div className="bg-white p-8 rounded-xl border border-fgn-border shadow-sm">
                  <h2 className="text-sm font-bold mb-6 flex items-center gap-2 text-fgn-blue uppercase tracking-widest">
                    <BrainCircuit size={20} /> Normalización de Texto Judicial
                  </h2>
                  <textarea 
                    rows={6} 
                    className="w-full p-4 font-mono bg-bg-gray border border-fgn-border rounded text-xs font-medium text-text-main resize-none outline-none focus:border-fgn-blue shadow-inner" 
                    placeholder="Pegue informes o párrafos desordenados aquí..." 
                    value={rawText} 
                    onChange={(e) => setRawText(e.target.value)} 
                  />
                  <button 
                    onClick={handleSmartExtract} 
                    disabled={loadingIA || !rawText} 
                    className="w-full mt-6 bg-fgn-blue hover:bg-black disabled:bg-slate-300 text-white font-bold py-4 rounded text-[10px] tracking-[0.2em] uppercase transition-all"
                  >
                    GENERAR CITACION
                  </button>
                </div>
              )}

              {activeMode === 'manual' && (
                <div className="bg-white p-8 rounded-xl border border-fgn-border shadow-sm">
                  <h2 className="text-sm font-bold mb-8 text-fgn-blue uppercase tracking-widest flex items-center gap-3">
                    <Plus size={20} className="text-fgn-blue" /> Registro de Citación Manual
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-8">
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Nombre Ciudadano</label>
                      <input 
                        className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold text-text-main outline-none focus:border-fgn-blue" 
                        value={nuevoDato.nombre} 
                        onChange={(e) => setNuevoDato({...nuevoDato, nombre: e.target.value})} 
                      />
                    </div>
                    <div className="md:col-span-4">
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Género</label>
                      <select 
                        className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                        value={nuevoDato.genero} 
                        onChange={(e) => setNuevoDato({...nuevoDato, genero: e.target.value})}
                      >
                        <option value="Femenino">Femenino</option>
                        <option value="Masculino">Masculino</option>
                      </select>
                    </div>
                    <div className="md:col-span-6">
                      <label className="text-[9px] font-bold text-fgn-blue uppercase tracking-widest mb-1 block">Fecha Entrevista</label>
                      <input 
                        type="date" 
                        className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                        value={nuevoDato.fecha} 
                        onChange={(e) => setNuevoDato({...nuevoDato, fecha: e.target.value})} 
                      />
                    </div>
                    <div className="md:col-span-6">
                      <label className="text-[9px] font-bold text-fgn-blue uppercase tracking-widest mb-1 block">Hora Entrevista</label>
                      <input 
                        type="time" 
                        className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                        value={nuevoDato.hora} 
                        onChange={(e) => setNuevoDato({...nuevoDato, hora: e.target.value})} 
                      />
                    </div>
                    <div className="md:col-span-5">
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">Fiscalía</label>
                      <input 
                        placeholder="ej: 17 Local" 
                        className="w-full p-3 bg-bg-gray border border-fgn-border rounded text-xs font-bold outline-none focus:border-fgn-blue" 
                        value={nuevoDato.fiscal} 
                        onChange={(e) => setNuevoDato({...nuevoDato, fiscal: e.target.value})} 
                      />
                    </div>
                    <div className="md:col-span-7">
                      <label className="text-[9px] font-bold text-text-muted uppercase tracking-widest mb-1 block">No. Orden OPJ</label>
                      <input 
                        className="w-full p-3 bg-bg-gray border border-fgn-border rounded font-mono text-xs font-bold outline-none focus:border-fgn-blue" 
                        value={nuevoDato.orden} 
                        onChange={(e) => setNuevoDato({...nuevoDato, orden: e.target.value})} 
                      />
                    </div>
                    <button 
                      onClick={agregarPersonaManual} 
                      disabled={!nuevoDato.nombre || !nuevoDato.orden || !nuevoDato.fecha || !nuevoDato.hora} 
                      className="md:col-span-12 bg-fgn-blue hover:bg-black disabled:bg-slate-300 text-white font-bold py-4 rounded text-[10px] tracking-[0.2em] uppercase transition-all mt-4"
                    >
                      Registrar en Bandeja
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
          <div className="flex items-center justify-between">
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
              <div className="flex-1 max-w-md mx-6">
                 <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                     type="text"
                     placeholder="BUSCAR EN GENERADAS..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full bg-white border border-fgn-border rounded-lg py-2.5 pl-10 pr-4 text-xs font-bold text-red-600 placeholder:text-slate-300 outline-none focus:border-fgn-blue focus:ring-1 focus:ring-fgn-blue shadow-sm transition-all uppercase"
                   />
                 </div>
               </div>
              <h2 className="text-xl font-bold text-red-600 uppercase tracking-tight flex items-center gap-3">
                <ClipboardList size={24} /> Listado de Citaciones Generadas
              </h2>
          </div>

          <div className="bg-white rounded-xl border border-fgn-border overflow-hidden shadow-sm">
            <div className="bg-bg-gray px-6 py-3 border-b border-fgn-border grid grid-cols-12 gap-4 text-[9px] font-bold text-text-muted uppercase tracking-widest">
              <div className="col-span-1 flex items-center justify-center">
                <input 
                  type="checkbox" 
                  className="w-4 h-4 rounded border-fgn-border text-fgn-blue focus:ring-fgn-blue"
                  checked={personas.length > 0 && selectedIds.length === personas.length}
                  onChange={(e) => {
                    if (e.target.checked) setSelectedIds(personas.map(p => p.id));
                    else setSelectedIds([]);
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
              ) : (
                getSortedList(applyFilters(personas)).map((p) => (
                  <div key={p.id} className="group">
                    <div className="px-6 py-4 grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-1 flex items-center justify-center">
                        <input 
                          type="checkbox" 
                          className="w-4 h-4 rounded border-fgn-border text-fgn-blue focus:ring-fgn-blue"
                          checked={selectedIds.includes(p.id)}
                          onChange={() => toggleSelection(p.id)}
                        />
                      </div>
                      <div className="col-span-3">
                        <p className="text-xs font-bold text-fgn-blue uppercase">{p.nombre}</p>
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
                            className="p-1.5 text-pink-600 hover:bg-pink-50 rounded transition-all"
                            title="Ver Citación Completa"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => marcarComoCitado(p)}
                            className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-all"
                            title="Marcar como Citado (Mover a Citados)"
                          >
                            <CheckCircle size={16} />
                          </button>
                          <button 
                           onClick={() => copiarAlPortapapeles(generarMensaje(p), p)} 
                           className={`p-1.5 rounded transition-all ${copiadoIdx === p.id ? 'bg-green-600 text-white' : 'text-green-600 hover:bg-green-50'}`}
                           title="Copiar Texto"
                          >
                           {copiadoIdx === p.id ? <Check size={16} /> : <Copy size={16} />}
                          </button>
                          <button onClick={() => eliminarDeBandeja(p.id)} className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all" title="Eliminar">
                           <Trash2 size={16} />
                          </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
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
          <div className="flex items-center justify-between">
              <button 
               onClick={() => {
                 setActiveMode(null);
                 setSearchTerm("");
               }} 
               className="flex items-center gap-2 text-text-muted hover:text-fgn-blue font-bold uppercase text-[10px] tracking-widest bg-white px-4 py-2 rounded border border-fgn-border shadow-sm transition-all"
              >
                <ArrowLeft size={14} strokeWidth={2} /> Volver al Inicio
              </button>
              <div className="flex-1 max-w-sm ml-6">
                 <div className="relative">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                   <input 
                     type="text"
                     placeholder="BUSCAR EN CITADOS..."
                     value={searchTerm}
                     onChange={(e) => setSearchTerm(e.target.value)}
                     className="w-full bg-white border border-fgn-border rounded-lg py-2.5 pl-10 pr-4 text-xs font-bold text-green-600 placeholder:text-slate-300 outline-none focus:border-fgn-blue focus:ring-1 focus:ring-fgn-blue shadow-sm transition-all uppercase"
                   />
                 </div>
               </div>
              <h2 className="text-xl font-bold text-green-600 uppercase tracking-tight flex items-center gap-3">
                <Check size={24} /> Listado de Citados (Enviados)
              </h2>
          </div>

          <div className="bg-white rounded-xl border border-fgn-border overflow-hidden shadow-sm">
            <div className="bg-bg-gray px-6 py-3 border-b border-fgn-border grid grid-cols-12 gap-4 text-[9px] font-bold text-text-muted uppercase tracking-widest">
              <div className="col-span-3">PARTICIPANTE</div>
              <div className="col-span-2">ORDEN OPJ</div>
              <div 
                className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-fgn-blue transition-colors group"
                onClick={toggleSort}
              >
                FECHA Y HORA 
                <ArrowUpDown size={12} className={sortConfig.direction === 'asc' ? 'text-fgn-blue' : 'text-slate-300'} />
              </div>
              <div className="col-span-2 text-center">ASISTENCIA</div>
              <div className="col-span-2 text-right">ACCIONES</div>
            </div>
            
            <div className="divide-y divide-fgn-border/30">
              {citados.length === 0 ? (
                <div className="py-20 text-center">
                  <Search size={40} className="mx-auto text-slate-200 mb-2" />
                  <p className="text-[10px] font-bold text-text-muted uppercase tracking-widest">No hay citados en esta sesión</p>
                </div>
              ) : (
                getSortedList(applyFilters(citados)).map((p) => (
                  <div key={p.id} className="group">
                    <div className="px-6 py-4 grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-3">
                        <p className="text-xs font-bold text-fgn-blue uppercase">{p.nombre}</p>
                      </div>
                      <div className="col-span-2 font-mono text-[11px] text-text-muted uppercase">
                        {p.orden}
                      </div>
                      <div className="col-span-3 font-mono text-[11px] text-fgn-blue flex flex-col">
                        <span>{p.fecha ? formatDateES(p.fecha).toUpperCase() : '---'}</span>
                        {p.hora && <span className="text-[10px] text-fgn-gold font-bold">{formatTimeAMPM(p.hora)}</span>}
                      </div>
                      <div className="col-span-2 flex items-center justify-center gap-2">
                          <button 
                            onClick={() => marcarAsistencia(p.id, p.asistencia === 'asistio' ? null : 'asistio')}
                            className={`p-1.5 rounded transition-all border ${p.asistencia === 'asistio' ? 'bg-green-600 text-white border-green-600' : 'bg-white text-slate-300 border-slate-200 hover:text-green-500 hover:border-green-500'}`}
                            title="Marcó Asistencia"
                          >
                            <UserCheck size={14} />
                          </button>
                          <button 
                            onClick={() => marcarAsistencia(p.id, p.asistencia === 'no_asistio' ? null : 'no_asistio')}
                            className={`p-1.5 rounded transition-all border ${p.asistencia === 'no_asistio' ? 'bg-red-600 text-white border-red-600' : 'bg-white text-slate-300 border-slate-200 hover:text-red-500 hover:border-red-500'}`}
                            title="No Asistió"
                          >
                            <UserX size={14} />
                          </button>
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-1">
                          <button 
                            onClick={() => {
                              setSelectedCitation(p);
                              setIsModalOpen(true);
                            }}
                            className="p-1.5 text-pink-600 hover:bg-pink-50 rounded transition-all"
                            title="Ver Citación"
                          >
                            <Eye size={16} />
                          </button>
                          <button 
                            onClick={() => setCitados(prev => prev.filter(c => c.id !== p.id))} 
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded transition-all" 
                            title="Limpiar"
                          >
                           <Trash2 size={16} />
                          </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
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
