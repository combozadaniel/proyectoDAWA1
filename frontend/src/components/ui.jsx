/**
 * Componentes de interfaz reutilizables: badges, estados de carga/error/vacío y paginación.
 */
import { Alert, Badge, Button, Pagination, Spinner } from 'react-bootstrap';
import { ESTADOS, PLAZOS, PRIORIDADES, horasTexto } from '../utils/format';

export function EstadoBadge({ estado }) {
  const e = ESTADOS[estado] || { nombre: estado, color: 'secondary', icono: 'bi-circle' };
  return (
    <Badge bg={e.color === 'pending' ? undefined : e.color} className={`estado-badge ${e.color === 'pending' ? 'bg-pending' : ''}`}>
      <i className={`bi ${e.icono} me-1`} aria-hidden="true" />
      {e.nombre}
    </Badge>
  );
}

export function PrioridadBadge({ prioridad }) {
  const p = PRIORIDADES[prioridad] || { nombre: prioridad, color: 'secondary' };
  return (
    <Badge bg={p.color} text={p.color === 'warning' || p.color === 'info' ? 'dark' : undefined}>
      {p.nombre}
    </Badge>
  );
}

export function PlazoBadge({ estado, horas }) {
  const p = PLAZOS[estado] || PLAZOS.NO_APLICA;
  if (estado === 'NO_APLICA') return <span className="text-body-secondary">—</span>;
  const abierta = ['A_TIEMPO', 'POR_VENCER', 'VENCIDA'].includes(estado);
  return (
    <span className={`text-${p.color === 'warning' ? 'warning-emphasis' : p.color} small fw-semibold text-nowrap`} title={abierta ? horasTexto(horas) : p.nombre}>
      <i className={`bi ${p.icono} me-1`} aria-hidden="true" />
      {p.nombre}
      {abierta && <span className="d-block fw-normal text-body-secondary">{horasTexto(horas)}</span>}
    </span>
  );
}

export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div className="d-flex align-items-center justify-content-center gap-2 py-5 text-body-secondary" role="status">
      <Spinner animation="border" size="sm" />
      <span>{texto}</span>
    </div>
  );
}

export function ErrorMensaje({ mensaje, onReintentar }) {
  if (!mensaje) return null;
  return (
    <Alert variant="danger" className="d-flex align-items-center justify-content-between gap-2">
      <span>
        <i className="bi bi-exclamation-octagon me-2" aria-hidden="true" />
        {mensaje}
      </span>
      {onReintentar && (
        <Button size="sm" variant="outline-danger" onClick={() => onReintentar()}>
          Reintentar
        </Button>
      )}
    </Alert>
  );
}

export function Vacio({ titulo = 'Sin resultados', texto, icono = 'bi-inbox', children }) {
  return (
    <div className="text-center py-5 text-body-secondary">
      <i className={`bi ${icono} display-6 d-block mb-2`} aria-hidden="true" />
      <p className="fw-semibold mb-1">{titulo}</p>
      {texto && <p className="small mb-3">{texto}</p>}
      {children}
    </div>
  );
}

/** Envuelve el contenido según el estado de la petición. */
export function EstadoPeticion({ cargando, error, vacio, onReintentar, vacioProps, children }) {
  if (cargando) return <Cargando />;
  if (error) return <ErrorMensaje mensaje={error} onReintentar={onReintentar} />;
  if (vacio) return <Vacio {...vacioProps} />;
  return children;
}

export function Paginacion({ meta, onCambiar }) {
  if (!meta || meta.totalPages <= 1) {
    return meta ? <p className="small text-body-secondary mb-0">{meta.total} registro(s)</p> : null;
  }
  const { page, totalPages, total } = meta;
  const desde = Math.max(1, Math.min(page - 2, totalPages - 4));
  const paginas = Array.from({ length: Math.min(5, totalPages) }, (_, i) => desde + i);
  return (
    <div className="d-flex flex-wrap align-items-center justify-content-between gap-2">
      <span className="small text-body-secondary">
        Página {page} de {totalPages} · {total} registros
      </span>
      <Pagination size="sm" className="mb-0">
        <Pagination.Prev disabled={page === 1} onClick={() => onCambiar(page - 1)} aria-label="Anterior" />
        {paginas.map((p) => (
          <Pagination.Item key={p} active={p === page} onClick={() => onCambiar(p)}>
            {p}
          </Pagination.Item>
        ))}
        <Pagination.Next disabled={page === totalPages} onClick={() => onCambiar(page + 1)} aria-label="Siguiente" />
      </Pagination>
    </div>
  );
}

export function Encabezado({ titulo, subtitulo, children }) {
  return (
    <div className="d-flex flex-wrap align-items-start justify-content-between gap-2 mb-3">
      <div>
        <h1 className="h4 mb-0">{titulo}</h1>
        {subtitulo && <p className="text-body-secondary small mb-0">{subtitulo}</p>}
      </div>
      {children && <div className="d-flex flex-wrap gap-2">{children}</div>}
    </div>
  );
}
