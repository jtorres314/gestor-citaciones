export interface Citacion {
  id: string;
  nombre: string;
  genero: 'Femenino' | 'Masculino';
  orden: string;
  fiscal: string;
  unidad: string;
  fecha: string;
  hora: string;
  telefono?: string;
  identificacion?: string;
  motivo?: string;
  direccion?: string;
  instalaciones?: string;
  direccionInstalaciones?: string;
  observaciones?: string;
  requiereAbogado?: 'SI' | 'NO';
  fechaExpedicion?: string;
  horaExpedicion?: string;
  estado?: 'pendiente' | 'citado';
  asistencia?: 'asistio' | 'no_asistio' | null;
  informe?: 'si' | 'no' | null;
  investigador_creador?: string;
  entidadInvestigador?: string;
  grupoInvestigador?: string;
  correoInvestigador?: string;
  telefono_creador?: string;
  oficina_creador?: string;
  departamento?: string;
  municipio?: string;
  creadoEl?: string;
  creadoTimestamp: number;
}

export interface InvestigatorConfig {
  investigador: string;
  oficina: string;
  telefono: string;
  cargo: string;
  departamento: string;
  municipio: string;
  sede: string;
  entidadInvestigador: string;
  grupoInvestigador: string;
  correoInvestigador: string;
  instalaciones: string;
  direccionInstalaciones: string;
  firmaImg?: string | null;
}

export interface CitacionFilters {
  searchTerm: string;
  fiscal: string;
  fechaFiltro: 'todas' | 'hoy' | 'semana' | 'mes' | 'rango';
  fechaDesde?: string;
  fechaHasta?: string;
  estado?: 'todos' | 'pendiente' | 'citado';
  asistencia?: 'todas' | 'asistio' | 'no_asistio' | 'sin_marcar';
  informe?: 'todos' | 'si' | 'no' | 'sin_marcar';
}

export type PageSizeOption = 10 | 20 | 50 | 'todos';
