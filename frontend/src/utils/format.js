export const ESTADOS = {
  REGISTRADA: { nombre: 'Registrada', color: 'secondary', icono: 'bi-inbox' },
  APROBADA: { nombre: 'Aprobada', color: 'info', icono: 'bi-check2' },
  ASIGNADA: { nombre: 'Asignada', color: 'primary', icono: 'bi-person-check' },
  EN_PROCESO: { nombre: 'En proceso', color: 'warning', icono: 'bi-gear' },
  PENDIENTE_INFO: { nombre: 'Pendiente de información', color: 'pending', icono: 'bi-question-circle' },
  RESUELTA: { nombre: 'Resuelta', color: 'success', icono: 'bi-check2-circle' },
  CERRADA: { nombre: 'Cerrada', color: 'dark', icono: 'bi-lock' },
  CANCELADA: { nombre: 'Cancelada', color: 'danger', icono: 'bi-x-circle' },
};

export const PRIORIDADES = {
  BAJA: { nombre: 'Baja', color: 'secondary' },
  MEDIA: { nombre: 'Media', color: 'info' },
  ALTA: { nombre: 'Alta', color: 'warning' },
  CRITICA: { nombre: 'Crítica', color: 'danger' },
};

export const PLAZOS = {
  A_TIEMPO: { nombre: 'A tiempo', color: 'success', icono: 'bi-clock' },
  POR_VENCER: { nombre: 'Por vencer', color: 'warning', icono: 'bi-hourglass-split' },
  VENCIDA: { nombre: 'Vencida', color: 'danger', icono: 'bi-exclamation-triangle' },
  CUMPLIDA: { nombre: 'Cumplida', color: 'success', icono: 'bi-check-circle' },
  INCUMPLIDA: { nombre: 'Fuera de plazo', color: 'danger', icono: 'bi-x-octagon' },
  NO_APLICA: { nombre: '—', color: 'light', icono: 'bi-dash' },
};

export const ROLES = {
  ADMIN: 'Administrador',
  COORDINADOR: 'Coordinador',
  TECNICO: 'Técnico',
  CLIENTE: 'Cliente',
};

const fmtFecha = new Intl.DateTimeFormat('es-EC', { dateStyle: 'medium', timeStyle: 'short' });
const fmtDia = new Intl.DateTimeFormat('es-EC', { day: '2-digit', month: 'short' });

export const fechaHora = (f) => (f ? fmtFecha.format(new Date(f)) : '—');
export const diaCorto = (f) => (f ? fmtDia.format(new Date(`${f}T12:00:00`)) : '');

export function tiempoRelativo(f) {
  const seg = Math.round((Date.now() - new Date(f).getTime()) / 1000);
  if (seg < 60) return 'hace un momento';
  const min = Math.round(seg / 60);
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export function horasTexto(h) {
  if (h == null) return '—';
  const abs = Math.abs(h);
  const txt = abs >= 48 ? `${Math.round(abs / 24)} días` : `${Math.round(abs)} h`;
  return h < 0 ? `vencida hace ${txt}` : `quedan ${txt}`;
}

export const hoyISO = () => new Date().toISOString().slice(0, 10);
export const haceDiasISO = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);

export function tamanoArchivo(b) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(1)} MB`;
}
