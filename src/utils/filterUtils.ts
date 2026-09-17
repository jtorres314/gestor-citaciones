import { Citacion, CitacionFilters, PageSizeOption } from '../types';

export const getTodayDateStr = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const filterCitations = (
  list: Citacion[],
  filters: CitacionFilters
): Citacion[] => {
  const today = getTodayDateStr();
  const term = filters.searchTerm.trim().toLowerCase();

  return list.filter((item) => {
    // 1. Text search
    if (term) {
      const matchName = (item.nombre || '').toLowerCase().includes(term);
      const matchId = (item.identificacion || '').toLowerCase().includes(term);
      const matchOrden = (item.orden || '').toLowerCase().includes(term);
      const matchFiscal = (item.fiscal || '').toLowerCase().includes(term);
      const matchUnidad = (item.unidad || '').toLowerCase().includes(term);
      const matchMotivo = (item.motivo || '').toLowerCase().includes(term);

      if (!matchName && !matchId && !matchOrden && !matchFiscal && !matchUnidad && !matchMotivo) {
        return false;
      }
    }

    // 2. Fiscal
    if (filters.fiscal && filters.fiscal !== 'todos') {
      if (item.fiscal !== filters.fiscal) {
        return false;
      }
    }

    // 3. Date filter
    if (filters.fechaFiltro && filters.fechaFiltro !== 'todas') {
      const itemDate = item.fecha || '';
      if (!itemDate) return false;

      if (filters.fechaFiltro === 'hoy') {
        if (itemDate !== today) return false;
      } else if (filters.fechaFiltro === 'semana') {
        // Next 7 days from today
        const now = new Date();
        const nextWeek = new Date();
        nextWeek.setDate(now.getDate() + 7);
        const itemD = new Date(`${itemDate}T00:00:00`);
        const todayD = new Date(`${today}T00:00:00`);
        if (itemD < todayD || itemD > nextWeek) return false;
      } else if (filters.fechaFiltro === 'mes') {
        // Current month
        const [todayY, todayM] = today.split('-');
        if (!itemDate.startsWith(`${todayY}-${todayM}`)) return false;
      } else if (filters.fechaFiltro === 'rango') {
        if (filters.fechaDesde && itemDate < filters.fechaDesde) return false;
        if (filters.fechaHasta && itemDate > filters.fechaHasta) return false;
      }
    }

    // 4. Estado
    if (filters.estado && filters.estado !== 'todos') {
      const itemEstado = item.estado || 'pendiente';
      if (itemEstado !== filters.estado) return false;
    }

    // 5. Informe
    if (filters.informe && filters.informe !== 'todos') {
      if (filters.informe === 'si' && item.informe !== 'si') return false;
      if (filters.informe === 'no' && item.informe !== 'no') return false;
      if (filters.informe === 'sin_marcar' && (item.informe === 'si' || item.informe === 'no')) return false;
    }

    // 6. Asistencia
    if (filters.asistencia && filters.asistencia !== 'todas') {
      if (filters.asistencia === 'asistio' && item.asistencia !== 'asistio') return false;
      if (filters.asistencia === 'no_asistio' && item.asistencia !== 'no_asistio') return false;
      if (filters.asistencia === 'sin_marcar' && (item.asistencia === 'asistio' || item.asistencia === 'no_asistio')) return false;
    }

    return true;
  });
};

export const paginateList = <T>(
  list: T[],
  currentPage: number,
  pageSize: PageSizeOption
): T[] => {
  if (pageSize === 'todos') return list;
  const start = (currentPage - 1) * pageSize;
  return list.slice(start, start + pageSize);
};

export const getUniqueFiscales = (list: Citacion[]): string[] => {
  const set = new Set<string>();
  list.forEach((item) => {
    if (item.fiscal && item.fiscal.trim()) {
      set.add(item.fiscal.trim());
    }
  });
  return Array.from(set).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
};
