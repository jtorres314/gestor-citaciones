import { 
  getFirestore, 
  collection, 
  doc, 
  addDoc, 
  deleteDoc, 
  onSnapshot, 
  query, 
  getDocFromServer, 
  setDoc, 
  updateDoc 
} from 'firebase/firestore';
import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';
import { Citacion, InvestigatorConfig } from '../types';

// Initialize Firebase configuration
export const finalFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID || firebaseConfig.firestoreDatabaseId
};

export const app = initializeApp(finalFirebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, finalFirebaseConfig.firestoreDatabaseId || undefined);
export const appId = 'citaciones-judiciales-app';

export const DEFAULT_CONFIG: InvestigatorConfig = {
  investigador: "Investigador Judicial",
  cargo: "Investigador Judicial",
  entidadInvestigador: "CTI / Fiscalía General de la Nación",
  grupoInvestigador: "Unidad de Patrimonio Económico",
  correoInvestigador: "contacto.investigacion@fiscalia.gov.co",
  telefono: "3000000000",
  oficina: "Fiscalía General de la Nación - Unidad de Patrimonio Económico",
  departamento: "Bolívar",
  municipio: "Cartagena",
  sede: "Sede Canapote",
  instalaciones: "Fiscalía General de la Nación - Sede Canapote",
  direccionInstalaciones: "Cra. 17 # 32-10, Barrio Canapote",
  firmaImg: ""
};

export const DEFAULT_OBSERVACIONES = "Presentar documento de identidad original y documentos que demuestren el detrimento patrimonial ocasionado en los hechos denunciados.";

export const getTodayDateStr = () => new Date().toISOString().split('T')[0];

export const getCurrentTimeStr = () => {
  const now = new Date();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
};

// Date & Time formatting helpers
export const formatDateES = (dateStr?: string): string => {
  if (!dateStr || !dateStr.includes('-')) return dateStr || '';
  const months = ["Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio", "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre"];
  const [year, month, day] = dateStr.split('-');
  return `${parseInt(day, 10)} de ${months[parseInt(month, 10) - 1]} del ${year}`;
};

export const formatTimeAMPM = (timeStr?: string): string => {
  if (!timeStr) return '';
  const str = timeStr.trim();
  if (!str) return '';

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
};

// WhatsApp Text Generator
export const generateWhatsAppMessage = (p: Partial<Citacion>, config?: Partial<InvestigatorConfig>): string => {
  const trato = p.genero === "Femenino" ? "Señora" : p.genero === "Masculino" ? "Señor" : "Señor(a)";
  const nombre = (p.nombre || 'CIUDADANO').toUpperCase().trim();
  const fechaFormateada = formatDateES(p.fecha);
  const horaFormateada = formatTimeAMPM(p.hora);
  
  const baseInstalaciones = (p.instalaciones || p.oficina_creador || config?.instalaciones || config?.oficina || 'Fiscalía General de la Nación - Unidad de Patrimonio Económico').trim();
  const dirInstalaciones = (p.direccionInstalaciones || config?.direccionInstalaciones || '').trim();
  const lugarCompleto = dirInstalaciones && !baseInstalaciones.toLowerCase().includes(dirInstalaciones.toLowerCase())
    ? `${baseInstalaciones} - ${dirInstalaciones}`
    : baseInstalaciones;

  const rawFiscal = (p.fiscal || '17 Local').trim();
  const fiscalLimpio = rawFiscal.replace(/^Fiscal\s+/i, '').trim();

  const ciudad = (p.ciudad || p.municipio || config?.municipio || 'Cartagena').trim();
  const orden = (p.orden || '13427245').trim();
  const casoTexto = p.nunc ? ` - Caso ${p.nunc.trim()}` : '';

  const telefono = (p.telefono_creador || config?.telefono || '3176491486').trim();
  const investigador = (p.investigador_creador || config?.investigador || 'Investigador Judicial').trim();

  return `Buenas ${trato} ${nombre}, este mensaje es con el fin de realizarle citación para el día ${fechaFormateada} a las ${horaFormateada} en la ${lugarCompleto}, a diligencia de entrevista ordenada por el Fiscal ${fiscalLimpio} de ${ciudad} dentro de la Orden a Policía judicial No. ${orden}${casoTexto}.

Esta diligencia se requiere para que usted amplié las circunstancias de tiempo, modo y lugar, en la que ocurrieron los hechos en los que usted resulto como víctima, y se requiere que por favor traiga los documentos que acrediten la cuantía del detrimento patrimonial ocasionado.

Por favor comunicarse lo antes posible a el numero ${telefono} (WhatsApp) y preguntar por el Investigador ${investigador}.`;
};

// Outlook 365 URL Generator
export const getOutlook365Url = (p: Partial<Citacion>, config?: Partial<InvestigatorConfig>) => {
  const to = (p.correo || '').trim();
  const nombre = (p.nombre || '').toUpperCase().trim();
  const numeroCaso = (p.nunc || p.orden || '').trim();
  const subject = numeroCaso 
    ? `CITACION JUDICIAL ${nombre} - CASO ${numeroCaso}`
    : `CITACION JUDICIAL ${nombre}`;
  const body = generateWhatsAppMessage(p, config);
  
  return `https://outlook.cloud.microsoft/mail/deeplink/compose?to=${encodeURIComponent(to)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
};

// Urgency and Expiration Status Analysis
export type UrgencyStatus = 'past_due_unattended' | 'today' | 'upcoming_urgent' | 'future' | 'attended';

export interface UrgencyInfo {
  status: UrgencyStatus;
  badgeLabel: string;
  badgeColorClass: string;
  badgeBgClass: string;
  isUrgent: boolean;
  isConflict?: boolean;
}

export const analyzeCitationUrgency = (c: Citacion): UrgencyInfo => {
  if (c.asistencia === 'asistio') {
    return {
      status: 'attended',
      badgeLabel: 'Asistió',
      badgeColorClass: 'text-emerald-800 border-emerald-300',
      badgeBgClass: 'bg-emerald-50',
      isUrgent: false
    };
  }

  if (!c.fecha) {
    return {
      status: 'future',
      badgeLabel: 'Programada',
      badgeColorClass: 'text-slate-700 border-slate-300',
      badgeBgClass: 'bg-slate-50',
      isUrgent: false
    };
  }

  const todayStr = getTodayDateStr();
  
  if (c.fecha < todayStr) {
    return {
      status: 'past_due_unattended',
      badgeLabel: 'Vencida / Sin Asistencia',
      badgeColorClass: 'text-red-700 border-red-300',
      badgeBgClass: 'bg-red-50',
      isUrgent: true
    };
  }

  if (c.fecha === todayStr) {
    return {
      status: 'today',
      badgeLabel: '¡Diligencia de Hoy!',
      badgeColorClass: 'text-amber-800 border-amber-400',
      badgeBgClass: 'bg-amber-100/90 font-black animate-pulse',
      isUrgent: true
    };
  }

  // Check if upcoming in less than 24-48 hours
  const now = new Date();
  const citationDate = new Date(`${c.fecha}T${c.hora || '08:00'}:00`);
  const diffHours = (citationDate.getTime() - now.getTime()) / (1000 * 60 * 60);

  if (diffHours > 0 && diffHours <= 36) {
    return {
      status: 'upcoming_urgent',
      badgeLabel: 'Próxima (<24-36h)',
      badgeColorClass: 'text-amber-700 border-amber-300',
      badgeBgClass: 'bg-amber-50',
      isUrgent: true
    };
  }

  return {
    status: 'future',
    badgeLabel: 'Programada',
    badgeColorClass: 'text-blue-700 border-blue-200',
    badgeBgClass: 'bg-blue-50/70',
    isUrgent: false
  };
};

// Conflict Detection: finds citations that overlap in the same date and hour
export const detectScheduleConflicts = (citations: Citacion[]): Map<string, string[]> => {
  const conflictMap = new Map<string, string[]>();
  const groupMap = new Map<string, Citacion[]>();

  for (const c of citations) {
    if (!c.fecha || !c.hora) continue;
    // Normalize time to HH:MM
    const normalizedTime = c.hora.slice(0, 5);
    const key = `${c.fecha}_${normalizedTime}`;
    if (!groupMap.has(key)) {
      groupMap.set(key, []);
    }
    groupMap.get(key)!.push(c);
  }

  for (const [, list] of groupMap.entries()) {
    if (list.length > 1) {
      for (const item of list) {
        const otherNames = list.filter(o => o.id !== item.id).map(o => o.nombre || 'Otro citado');
        conflictMap.set(item.id, otherNames);
      }
    }
  }

  return conflictMap;
};

// ==========================================
// CITATION CRUD SERVICE (Firestore & LocalStorage)
// ==========================================

export class CitationService {
  /**
   * Register a new citation
   */
  static async createCitation(
    user: any, 
    data: Partial<Citacion>, 
    config: InvestigatorConfig
  ): Promise<Citacion> {
    const todayDate = data.fecha || getTodayDateStr();
    const todayTime = data.hora || getCurrentTimeStr();

    const item: Citacion = {
      id: `cit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      nombre: data.nombre || 'CIUDADANO POR CITAR',
      genero: data.genero || 'Femenino',
      orden: data.orden || 'Sin Orden',
      nunc: data.nunc || '',
      fiscal: data.fiscal || '17 Local',
      delito: data.delito || '',
      unidad: data.unidad || config.grupoInvestigador || 'Unidad de Patrimonio Económico',
      fecha: todayDate,
      hora: todayTime,
      telefono: data.telefono || '',
      correo: data.correo || '',
      identificacion: data.identificacion || data.cedula || '',
      cedula: data.identificacion || data.cedula || '',
      ciudad: data.ciudad || config.municipio || 'Cartagena',
      motivo: data.motivo || 'Entrevista',
      direccion: data.direccion || '',
      instalaciones: data.instalaciones || config.instalaciones || 'Fiscalía General de la Nación - Sede Canapote',
      direccionInstalaciones: data.direccionInstalaciones || config.direccionInstalaciones || 'Cra. 17 # 32-10',
      observaciones: data.observaciones || DEFAULT_OBSERVACIONES,
      requiereAbogado: data.requiereAbogado || 'NO',
      fechaExpedicion: data.fechaExpedicion || todayDate,
      horaExpedicion: data.horaExpedicion || todayTime,
      estado: 'pendiente',
      asistencia: null,
      informe: null,
      investigador_creador: config.investigador,
      entidadInvestigador: config.entidadInvestigador,
      grupoInvestigador: config.grupoInvestigador,
      correoInvestigador: config.correoInvestigador,
      telefono_creador: config.telefono,
      oficina_creador: config.oficina,
      departamento: config.departamento,
      municipio: config.municipio,
      creadoEl: new Date().toLocaleString('es-CO'),
      creadoTimestamp: Date.now()
    };

    if (!user || user.isLocalGuest) {
      // LocalStorage for Guest
      const stored = localStorage.getItem('fgn_guest_historial');
      const list: Citacion[] = stored ? JSON.parse(stored) : [];
      const updated = [item, ...list];
      localStorage.setItem('fgn_guest_historial', JSON.stringify(updated));
      return item;
    }

    // Firestore for Google User
    const historialRef = collection(db, 'artifacts', appId, 'users', user.uid, 'historial');
    const docRef = await addDoc(historialRef, item);
    return { ...item, id: docRef.id };
  }

  /**
   * Update an existing citation
   */
  static async updateCitation(user: any, updatedData: Citacion): Promise<void> {
    if (!user) return;

    if (user.isLocalGuest) {
      const stored = localStorage.getItem('fgn_guest_historial');
      const list: Citacion[] = stored ? JSON.parse(stored) : [];
      const updated = list.map(item => item.id === updatedData.id ? { ...item, ...updatedData } : item);
      localStorage.setItem('fgn_guest_historial', JSON.stringify(updated));
      return;
    }

    const { id, ...cleanData } = updatedData;
    const sanitized: Record<string, any> = {};
    Object.entries(cleanData).forEach(([key, val]) => {
      if (val !== undefined) {
        sanitized[key] = val;
      }
    });

    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id || updatedData.id);
    await setDoc(docRef, sanitized, { merge: true });
  }

  /**
   * Delete a citation
   */
  static async deleteCitation(user: any, id: string): Promise<void> {
    if (!user) return;

    if (user.isLocalGuest) {
      const stored = localStorage.getItem('fgn_guest_historial');
      const list: Citacion[] = stored ? JSON.parse(stored) : [];
      const updated = list.filter(item => item.id !== id);
      localStorage.setItem('fgn_guest_historial', JSON.stringify(updated));
      return;
    }

    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id);
    await deleteDoc(docRef);
  }

  /**
   * Update citation status (e.g. 'pendiente' | 'citado')
   */
  static async updateStatus(user: any, id: string, estado: 'pendiente' | 'citado'): Promise<void> {
    if (!user) return;

    if (user.isLocalGuest) {
      const stored = localStorage.getItem('fgn_guest_historial');
      const list: Citacion[] = stored ? JSON.parse(stored) : [];
      const updated = list.map(item => item.id === id ? { ...item, estado } : item);
      localStorage.setItem('fgn_guest_historial', JSON.stringify(updated));
      return;
    }

    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id);
    await updateDoc(docRef, { estado });
  }

  /**
   * Update attendance status
   */
  static async updateAttendance(user: any, id: string, asistencia: 'asistio' | 'no_asistio' | null): Promise<void> {
    if (!user) return;

    if (user.isLocalGuest) {
      const stored = localStorage.getItem('fgn_guest_historial');
      const list: Citacion[] = stored ? JSON.parse(stored) : [];
      const updated = list.map(item => item.id === id ? { ...item, asistencia } : item);
      localStorage.setItem('fgn_guest_historial', JSON.stringify(updated));
      return;
    }

    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id);
    await updateDoc(docRef, { asistencia });
  }

  /**
   * Update report status
   */
  static async updateReport(user: any, id: string, informe: 'si' | 'no' | null): Promise<void> {
    if (!user) return;

    if (user.isLocalGuest) {
      const stored = localStorage.getItem('fgn_guest_historial');
      const list: Citacion[] = stored ? JSON.parse(stored) : [];
      const updated = list.map(item => item.id === id ? { ...item, informe } : item);
      localStorage.setItem('fgn_guest_historial', JSON.stringify(updated));
      return;
    }

    const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id);
    await updateDoc(docRef, { informe });
  }

  /**
   * Bulk update status (e.g. mark selected as 'citado')
   */
  static async bulkUpdateStatus(user: any, ids: string[], estado: 'pendiente' | 'citado'): Promise<void> {
    if (!user || ids.length === 0) return;

    if (user.isLocalGuest) {
      const stored = localStorage.getItem('fgn_guest_historial');
      const list: Citacion[] = stored ? JSON.parse(stored) : [];
      const updated = list.map(item => ids.includes(item.id) ? { ...item, estado } : item);
      localStorage.setItem('fgn_guest_historial', JSON.stringify(updated));
      return;
    }

    const promises = ids.map(id => {
      const docRef = doc(db, 'artifacts', appId, 'users', user.uid, 'historial', id);
      return updateDoc(docRef, { estado });
    });
    await Promise.all(promises);
  }

  /**
   * Save investigator profile configuration
   */
  static async saveProfileConfig(user: any, config: InvestigatorConfig): Promise<void> {
    if (!user) return;

    if (user.isLocalGuest) {
      localStorage.setItem('fgn_guest_config', JSON.stringify(config));
      return;
    }

    localStorage.setItem(`fgn_google_config_${user.uid}`, JSON.stringify(config));
    try {
      await setDoc(doc(db, 'users', user.uid), { config }, { merge: true });
    } catch (e) {
      console.error("Error saving profile to Firestore:", e);
    }
  }
}
