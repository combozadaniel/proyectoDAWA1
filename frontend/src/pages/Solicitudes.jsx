import { useEffect, useState } from 'react';
import { Button, Card, Col, Form, Row, Table } from 'react-bootstrap';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Encabezado, EstadoBadge, EstadoPeticion, Paginacion, PlazoBadge, PrioridadBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSolicitudesEnVivo } from '../context/SocketContext';
import { useApi, useDebounce } from '../hooks/useApi';
import { ESTADOS, PRIORIDADES, fechaHora } from '../utils/format';

const FILTROS = ['estado', 'prioridad', 'categoria_id', 'vencimiento', 'q', 'desde', 'hasta', 'orden', 'page'];

export default function Solicitudes() {
  const { usuario, tieneRol } = useAuth();
  const navigate = useNavigate();
  const [sp, setSp] = useSearchParams();
  const [busqueda, setBusqueda] = useState(sp.get('q') || '');
  const [verFiltros, setVerFiltros] = useState(false);
  const q = useDebounce(busqueda);

  // Los filtros viven en la URL: se pueden compartir y sobreviven a la recarga.
  const filtros = Object.fromEntries(FILTROS.map((k) => [k, sp.get(k) || '']));
  const params = { ...Object.fromEntries(Object.entries(filtros).filter(([, v]) => v)), limit: 10 };
  const { data, error, cargando, recargar } = useApi('/solicitudes', params);
  const { data: categorias } = useApi('/categorias');

  const setFiltro = (k, v) => {
    const n = new URLSearchParams(sp);
    if (v) n.set(k, v);
    else n.delete(k);
    if (k !== 'page') n.delete('page');
    setSp(n, { replace: true });
  };

  useEffect(() => {
    if (q !== (sp.get('q') || '')) setFiltro('q', q);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  // Actualización en tiempo real del listado (WebSocket).
  useSolicitudesEnVivo(() => recargar({ silencioso: true }));

  const hayFiltros = FILTROS.some((k) => k !== 'page' && sp.get(k));

  return (
    <>
      <Encabezado
        titulo="Solicitudes"
        subtitulo={usuario.rol === 'CLIENTE' ? 'Solicitudes de su empresa' : usuario.rol === 'TECNICO' ? 'Solicitudes asignadas a usted' : 'Todas las solicitudes'}
      >
        {tieneRol('ADMIN', 'COORDINADOR', 'CLIENTE') && (
          <Button as={Link} to="/solicitudes/nueva">
            <i className="bi bi-plus-lg me-1" />
            Nueva solicitud
          </Button>
        )}
      </Encabezado>

      <Button
        variant="outline-secondary"
        size="sm"
        className="d-md-none mb-2 w-100"
        aria-expanded={verFiltros}
        aria-controls="panel-filtros"
        onClick={() => setVerFiltros((v) => !v)}
      >
        <i className="bi bi-funnel me-1" />
        {verFiltros ? 'Ocultar filtros' : `Filtros${hayFiltros ? ' (activos)' : ''}`}
      </Button>
      <Card className={`mb-3 ${verFiltros ? '' : 'd-none d-md-block'}`} id="panel-filtros">
        <Card.Body className="py-2">
          <Row className="g-2 align-items-end">
            <Col xs={12} md={4}>
              <Form.Label className="small mb-0" htmlFor="buscar">Buscar</Form.Label>
              <Form.Control id="buscar" size="sm" type="search" placeholder="Código o título" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} />
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-0" htmlFor="estado">Estado</Form.Label>
              <Form.Select id="estado" size="sm" value={filtros.estado} onChange={(e) => setFiltro('estado', e.target.value)}>
                <option value="">Todos</option>
                <option value="REGISTRADA,APROBADA,ASIGNADA,EN_PROCESO,PENDIENTE_INFO">Abiertas</option>
                {Object.entries(ESTADOS).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
              </Form.Select>
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-0" htmlFor="prioridad">Prioridad</Form.Label>
              <Form.Select id="prioridad" size="sm" value={filtros.prioridad} onChange={(e) => setFiltro('prioridad', e.target.value)}>
                <option value="">Todas</option>
                {Object.entries(PRIORIDADES).map(([k, v]) => <option key={k} value={k}>{v.nombre}</option>)}
              </Form.Select>
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-0" htmlFor="categoria">Categoría</Form.Label>
              <Form.Select id="categoria" size="sm" value={filtros.categoria_id} onChange={(e) => setFiltro('categoria_id', e.target.value)}>
                <option value="">Todas</option>
                {categorias?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </Form.Select>
            </Col>
            <Col xs={6} md={2}>
              <Form.Label className="small mb-0" htmlFor="plazo">Plazo</Form.Label>
              <Form.Select id="plazo" size="sm" value={filtros.vencimiento} onChange={(e) => setFiltro('vencimiento', e.target.value)}>
                <option value="">Todos</option>
                <option value="por_vencer">Por vencer</option>
                <option value="vencida">Vencidas</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={3}>
              <Form.Label className="small mb-0" htmlFor="desde">Registradas desde</Form.Label>
              <Form.Control id="desde" size="sm" type="date" value={filtros.desde} onChange={(e) => setFiltro('desde', e.target.value)} />
            </Col>
            <Col xs={6} md={3}>
              <Form.Label className="small mb-0" htmlFor="hasta">Hasta</Form.Label>
              <Form.Control id="hasta" size="sm" type="date" value={filtros.hasta} onChange={(e) => setFiltro('hasta', e.target.value)} />
            </Col>
            <Col xs={6} md={3}>
              <Form.Label className="small mb-0" htmlFor="orden">Ordenar por</Form.Label>
              <Form.Select id="orden" size="sm" value={filtros.orden} onChange={(e) => setFiltro('orden', e.target.value)}>
                <option value="">Más recientes</option>
                <option value="antiguas">Más antiguas</option>
                <option value="vencimiento">Fecha límite</option>
                <option value="prioridad">Prioridad</option>
              </Form.Select>
            </Col>
            <Col xs={6} md={3}>
              {hayFiltros && (
                <Button
                  size="sm"
                  variant="outline-secondary"
                  className="w-100"
                  onClick={() => {
                    setBusqueda('');
                    setSp({}, { replace: true });
                  }}
                >
                  Limpiar filtros
                </Button>
              )}
            </Col>
          </Row>
        </Card.Body>
      </Card>

      <Card>
        <Card.Body>
          <EstadoPeticion
            cargando={cargando && !data}
            error={error}
            onReintentar={recargar}
            vacio={data?.data.length === 0}
            vacioProps={{ titulo: 'No hay solicitudes', texto: hayFiltros ? 'Pruebe con otros filtros.' : 'Aún no se han registrado solicitudes.' }}
          >
            {data && (
              <>
                <Table hover className="tabla-solicitudes tabla-responsiva mb-3">
                  <thead>
                    <tr>
                      <th>Código</th>
                      <th>Título</th>
                      {usuario.rol !== 'CLIENTE' && <th>Cliente</th>}
                      <th>Prioridad</th>
                      <th>Estado</th>
                      <th>Técnico</th>
                      <th>Plazo</th>
                      <th>Registrada</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((s) => (
                      <tr key={s.id} className="fila-click" onClick={() => navigate(`/solicitudes/${s.id}`)}>
                        <td data-label="Código">
                          <Link to={`/solicitudes/${s.id}`} onClick={(e) => e.stopPropagation()} className="fw-semibold text-nowrap">
                            {s.codigo}
                          </Link>
                        </td>
                        <td data-label="Título">
                          {s.titulo}
                          <div className="small text-body-secondary d-none d-md-block">{s.categoria_nombre}</div>
                        </td>
                        {usuario.rol !== 'CLIENTE' && (
                          <td data-label="Cliente">
                            {s.cliente_nombre}
                            <div className="small text-body-secondary d-none d-md-block">{s.sede_nombre}</div>
                          </td>
                        )}
                        <td data-label="Prioridad"><PrioridadBadge prioridad={s.prioridad} /></td>
                        <td data-label="Estado"><EstadoBadge estado={s.estado} /></td>
                        <td data-label="Técnico">{s.tecnico_nombre || <span className="text-body-secondary">Sin asignar</span>}</td>
                        <td data-label="Plazo"><PlazoBadge estado={s.estado_plazo} horas={s.horas_restantes} /></td>
                        <td data-label="Registrada" className="small text-nowrap">{fechaHora(s.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Paginacion meta={data.meta} onCambiar={(p) => setFiltro('page', String(p))} />
              </>
            )}
          </EstadoPeticion>
        </Card.Body>
      </Card>
    </>
  );
}
