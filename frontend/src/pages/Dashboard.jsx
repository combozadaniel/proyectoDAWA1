import { useState } from 'react';
import { Button, ButtonGroup, Card, Col, Form, ProgressBar, Row, Table } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Encabezado, EstadoPeticion } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSolicitudesEnVivo } from '../context/SocketContext';
import { useApi } from '../hooks/useApi';
import { diaCorto, haceDiasISO, hoyISO } from '../utils/format';

// Paleta categórica validada (orden fijo): azul, naranja.
const SERIE_1 = '#2a78d6';
const SERIE_2 = '#eb6834';
const EJE = '#52514e';
const GRID = '#e3e2dc';

function Kpi({ titulo, valor, detalle, icono, enlace }) {
  const contenido = (
    <Card className="h-100 kpi">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <span className="small text-body-secondary">{titulo}</span>
          <i className={`bi ${icono} text-body-secondary`} aria-hidden="true" />
        </div>
        <div className="valor mt-1">{valor ?? '—'}</div>
        {detalle && <div className="small text-body-secondary">{detalle}</div>}
      </Card.Body>
    </Card>
  );
  return enlace ? (
    <Link to={enlace} className="text-decoration-none text-reset">
      {contenido}
    </Link>
  ) : (
    contenido
  );
}

/** Tarjeta de gráfico con alternancia gráfico/tabla (accesibilidad). */
function Grafico({ titulo, tabla, children, alto = 260 }) {
  const [verTabla, setVerTabla] = useState(false);
  return (
    <Card className="h-100">
      <Card.Body>
        <div className="d-flex justify-content-between align-items-center mb-2">
          <h2 className="card-titulo mb-0">{titulo}</h2>
          <Button size="sm" variant="link" className="p-0" onClick={() => setVerTabla((v) => !v)}>
            {verTabla ? 'Ver gráfico' : 'Ver tabla'}
          </Button>
        </div>
        {verTabla ? (
          <div style={{ maxHeight: alto, overflowY: 'auto' }}>{tabla}</div>
        ) : (
          <div style={{ width: '100%', height: alto }}>{children}</div>
        )}
      </Card.Body>
    </Card>
  );
}

const ejeProps = { tick: { fill: EJE, fontSize: 12 }, axisLine: false, tickLine: false };

export default function Dashboard() {
  const { usuario, tieneRol } = useAuth();
  const [filtros, setFiltros] = useState({ desde: haceDiasISO(29), hasta: hoyISO(), prioridad_id: '', categoria_id: '', tecnico_id: '' });
  const params = Object.fromEntries(Object.entries(filtros).filter(([, v]) => v));
  const { data, error, cargando, recargar } = useApi('/dashboard/indicadores', params);
  const { data: prioridades } = useApi('/prioridades');
  const { data: categorias } = useApi('/categorias');
  const gestion = tieneRol('ADMIN', 'COORDINADOR');
  const { data: tecnicos } = useApi(gestion ? '/tecnicos' : null, { limit: 100 });

  // Actualización sin recarga manual: al cambiar cualquier solicitud se recalculan los indicadores.
  useSolicitudesEnVivo(() => recargar({ silencioso: true }));

  const rango = (dias) => setFiltros((f) => ({ ...f, desde: haceDiasISO(dias - 1), hasta: hoyISO() }));
  const set = (campo) => (e) => setFiltros((f) => ({ ...f, [campo]: e.target.value }));

  const alcance = {
    CLIENTE: 'Indicadores de las solicitudes de su empresa',
    TECNICO: 'Indicadores de sus solicitudes asignadas',
  }[usuario.rol] || 'Indicadores de toda la operación';

  return (
    <>
      <Encabezado titulo="Dashboard" subtitulo={alcance} />

      <Card className="mb-3">
        <Card.Body className="py-2">
          <Form className="row g-2 align-items-end">
            <Col xs="auto">
              <ButtonGroup size="sm" aria-label="Rango rápido">
                {[7, 30, 90].map((d) => (
                  <Button key={d} variant="outline-primary" onClick={() => rango(d)}>
                    {d} días
                  </Button>
                ))}
              </ButtonGroup>
            </Col>
            <Col xs={6} md="auto">
              <Form.Label className="small mb-0" htmlFor="f-desde">Desde</Form.Label>
              <Form.Control id="f-desde" size="sm" type="date" value={filtros.desde} max={filtros.hasta} onChange={set('desde')} />
            </Col>
            <Col xs={6} md="auto">
              <Form.Label className="small mb-0" htmlFor="f-hasta">Hasta</Form.Label>
              <Form.Control id="f-hasta" size="sm" type="date" value={filtros.hasta} min={filtros.desde} onChange={set('hasta')} />
            </Col>
            <Col xs={6} md>
              <Form.Label className="small mb-0" htmlFor="f-prioridad">Prioridad</Form.Label>
              <Form.Select id="f-prioridad" size="sm" value={filtros.prioridad_id} onChange={set('prioridad_id')}>
                <option value="">Todas</option>
                {prioridades?.map((p) => (
                  <option key={p.id} value={p.id}>{p.nombre}</option>
                ))}
              </Form.Select>
            </Col>
            <Col xs={6} md>
              <Form.Label className="small mb-0" htmlFor="f-categoria">Categoría</Form.Label>
              <Form.Select id="f-categoria" size="sm" value={filtros.categoria_id} onChange={set('categoria_id')}>
                <option value="">Todas</option>
                {categorias?.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </Form.Select>
            </Col>
            {gestion && (
              <Col xs={12} md>
                <Form.Label className="small mb-0" htmlFor="f-tecnico">Técnico</Form.Label>
                <Form.Select id="f-tecnico" size="sm" value={filtros.tecnico_id} onChange={set('tecnico_id')}>
                  <option value="">Todos</option>
                  {tecnicos?.data.map((t) => (
                    <option key={t.id} value={t.id}>{t.nombre}</option>
                  ))}
                </Form.Select>
              </Col>
            )}
          </Form>
        </Card.Body>
      </Card>

      <EstadoPeticion cargando={cargando && !data} error={error} onReintentar={recargar}>
        {data && (
          <>
            <Row className="g-3 mb-3" xs={2} md={3} xl={6}>
              <Col><Kpi titulo="Registradas" valor={data.resumen.total} detalle="en el periodo" icono="bi-inbox" /></Col>
              <Col><Kpi titulo="Abiertas" valor={data.resumen.abiertas} detalle="en el periodo" icono="bi-hourglass" /></Col>
              <Col><Kpi titulo="Vencidas" valor={data.vencimientos.vencidas} detalle={`de ${data.vencimientos.abiertas} abiertas`} icono="bi-exclamation-triangle" enlace="/solicitudes?vencimiento=vencida" /></Col>
              <Col><Kpi titulo="Por vencer" valor={data.vencimientos.por_vencer} detalle={`≥ ${data.filtros.umbralPorVencerPct}% del plazo`} icono="bi-alarm" enlace="/solicitudes?vencimiento=por_vencer" /></Col>
              <Col>
                <Kpi
                  titulo="Cumplimiento"
                  valor={data.cumplimiento.porcentaje != null ? `${data.cumplimiento.porcentaje}%` : '—'}
                  detalle={`${data.cumplimiento.aTiempo} a tiempo · ${data.cumplimiento.fueraDePlazo} fuera`}
                  icono="bi-bullseye"
                />
              </Col>
              <Col>
                <Kpi
                  titulo="Tiempo prom. resolución"
                  valor={data.tiempoResolucion.global != null ? `${data.tiempoResolucion.global} h` : '—'}
                  detalle="desde el registro"
                  icono="bi-stopwatch"
                />
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col lg={8}>
                <Grafico
                  titulo="Evolución diaria: registradas vs. resueltas"
                  tabla={
                    <Table size="sm" striped>
                      <thead><tr><th>Fecha</th><th className="text-end">Registradas</th><th className="text-end">Resueltas</th></tr></thead>
                      <tbody>
                        {data.evolucion.map((d) => (
                          <tr key={d.fecha}><td>{d.fecha}</td><td className="text-end">{d.creadas}</td><td className="text-end">{d.resueltas}</td></tr>
                        ))}
                      </tbody>
                    </Table>
                  }
                >
                  <ResponsiveContainer>
                    <LineChart data={data.evolucion} margin={{ top: 8, right: 12, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="fecha" tickFormatter={diaCorto} minTickGap={24} {...ejeProps} />
                      <YAxis allowDecimals={false} {...ejeProps} />
                      <Tooltip labelFormatter={diaCorto} />
                      <Legend iconType="plainline" />
                      <Line type="monotone" dataKey="creadas" name="Registradas" stroke={SERIE_1} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                      <Line type="monotone" dataKey="resueltas" name="Resueltas" stroke={SERIE_2} strokeWidth={2} dot={false} activeDot={{ r: 5 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </Grafico>
              </Col>
              <Col lg={4}>
                <Grafico
                  titulo="Solicitudes por prioridad"
                  tabla={
                    <Table size="sm" striped>
                      <tbody>{data.porPrioridad.map((p) => <tr key={p.codigo}><td>{p.nombre}</td><td className="text-end">{p.total}</td></tr>)}</tbody>
                    </Table>
                  }
                >
                  <ResponsiveContainer>
                    <BarChart data={data.porPrioridad} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} vertical={false} />
                      <XAxis dataKey="nombre" {...ejeProps} />
                      <YAxis allowDecimals={false} {...ejeProps} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Bar dataKey="total" name="Solicitudes" fill={SERIE_1} radius={[4, 4, 0, 0]} maxBarSize={36} />
                    </BarChart>
                  </ResponsiveContainer>
                </Grafico>
              </Col>
            </Row>

            <Row className="g-3 mb-3">
              <Col lg={6}>
                <Grafico
                  titulo="Solicitudes por estado"
                  alto={300}
                  tabla={
                    <Table size="sm" striped>
                      <tbody>{data.porEstado.map((e) => <tr key={e.codigo}><td>{e.nombre}</td><td className="text-end">{e.total}</td></tr>)}</tbody>
                    </Table>
                  }
                >
                  <ResponsiveContainer>
                    <BarChart data={data.porEstado} layout="vertical" margin={{ top: 0, right: 16, left: 8, bottom: 0 }}>
                      <CartesianGrid stroke={GRID} horizontal={false} />
                      <XAxis type="number" allowDecimals={false} {...ejeProps} />
                      <YAxis type="category" dataKey="nombre" width={120} {...ejeProps} />
                      <Tooltip cursor={{ fill: 'rgba(0,0,0,0.04)' }} />
                      <Bar dataKey="total" name="Solicitudes" fill={SERIE_1} radius={[0, 4, 4, 0]} maxBarSize={22} />
                    </BarChart>
                  </ResponsiveContainer>
                </Grafico>
              </Col>
              <Col lg={6}>
                <Card className="h-100">
                  <Card.Body>
                    <h2 className="card-titulo">Tiempo de resolución vs. plazo por prioridad</h2>
                    <Table size="sm" responsive className="mb-0">
                      <thead>
                        <tr><th>Prioridad</th><th className="text-end">Plazo</th><th className="text-end">Promedio</th><th className="text-end">Resueltas</th></tr>
                      </thead>
                      <tbody>
                        {data.tiempoResolucion.porPrioridad.map((p) => {
                          const excede = p.promedio_horas != null && p.promedio_horas > p.horas_plazo;
                          return (
                            <tr key={p.codigo}>
                              <td>{p.nombre}</td>
                              <td className="text-end">{p.horas_plazo} h</td>
                              <td className={`text-end ${excede ? 'text-danger fw-semibold' : ''}`}>
                                {p.promedio_horas != null ? `${p.promedio_horas} h` : '—'}
                                {excede && <i className="bi bi-exclamation-triangle ms-1" title="Supera el plazo" aria-label="Supera el plazo" />}
                              </td>
                              <td className="text-end">{p.resueltas}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </Table>
                  </Card.Body>
                </Card>
              </Col>
            </Row>

            {data.cargaPorTecnico.length > 0 && (
              <Card className="mb-3">
                <Card.Body>
                  <h2 className="card-titulo">Carga actual por técnico</h2>
                  <Row xs={1} md={2} className="g-3">
                    {data.cargaPorTecnico.map((t) => {
                      const pct = Math.round((t.activas / t.maximo) * 100);
                      return (
                        <Col key={t.id}>
                          <div className="d-flex justify-content-between small">
                            <span>
                              {t.nombre}
                              {!t.disponible && <span className="text-body-secondary"> · no disponible</span>}
                            </span>
                            <span className="text-body-secondary">
                              {t.activas}/{t.maximo} activas · {t.resueltas} resueltas
                            </span>
                          </div>
                          <ProgressBar
                            now={pct}
                            variant={pct >= 100 ? 'danger' : pct >= 75 ? 'warning' : 'primary'}
                            style={{ height: 8 }}
                            aria-label={`Carga de ${t.nombre}: ${pct}%`}
                          />
                        </Col>
                      );
                    })}
                  </Row>
                </Card.Body>
              </Card>
            )}
          </>
        )}
      </EstadoPeticion>
    </>
  );
}
