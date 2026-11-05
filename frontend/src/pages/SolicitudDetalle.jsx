import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, ListGroup, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { Link, useLocation, useParams } from 'react-router-dom';
import api, { mensajeError } from '../api/client';
import { EstadoBadge, EstadoPeticion, PlazoBadge, PrioridadBadge } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useSolicitudesEnVivo } from '../context/SocketContext';
import { useApi, useMutacion } from '../hooks/useApi';
import { ESTADOS, ROLES, fechaHora, tamanoArchivo } from '../utils/format';

const ACCIONES_ESTADO = {
  APROBADA: { texto: 'Aprobar', variante: 'success', icono: 'bi-check2' },
  EN_PROCESO: { texto: 'Iniciar / retomar atención', variante: 'warning', icono: 'bi-play-fill' },
  PENDIENTE_INFO: { texto: 'Solicitar información', variante: 'outline-secondary', icono: 'bi-question-circle' },
  RESUELTA: { texto: 'Marcar como resuelta', variante: 'success', icono: 'bi-check2-circle' },
  CERRADA: { texto: 'Cerrar solicitud', variante: 'dark', icono: 'bi-lock' },
  CANCELADA: { texto: 'Cancelar solicitud', variante: 'outline-danger', icono: 'bi-x-circle' },
};

const ACCION_HISTORIAL = {
  CREACION: 'registró la solicitud',
  CAMBIO_ESTADO: 'cambió el estado',
  ASIGNACION: 'asignó un técnico',
  REASIGNACION: 'reasignó la solicitud',
  COMENTARIO: 'comentó',
  REAPERTURA: 'reabrió la solicitud',
  ADJUNTO: 'adjuntó archivos',
};

/** Modal para cambiar de estado: pide los datos que exige cada transición. */
function ModalEstado({ solicitud, destino, onCerrar, onHecho }) {
  const { ejecutar, enviando, error } = useMutacion();
  const [comentario, setComentario] = useState('');
  const [resolucion, setResolucion] = useState('');
  const [prioridadId, setPrioridadId] = useState(String(solicitud.prioridad_id));
  const { data: prioridades } = useApi(destino === 'APROBADA' ? '/prioridades' : null);
  const esRechazo = solicitud.estado === 'RESUELTA' && destino === 'EN_PROCESO';
  const pideComentario = ['PENDIENTE_INFO', 'CANCELADA'].includes(destino) || esRechazo;
  const pideResolucion = destino === 'RESUELTA';
  const valido = (!pideComentario || comentario.trim().length >= 5) && (!pideResolucion || resolucion.trim().length >= 20);

  const enviar = async (e) => {
    e.preventDefault();
    const body = { estado: destino, version: solicitud.version };
    if (comentario.trim()) body.comentario = comentario.trim();
    if (pideResolucion) body.resolucion = resolucion.trim();
    if (destino === 'APROBADA') body.prioridad_id = Number(prioridadId);
    try {
      await ejecutar((a) => a.patch(`/solicitudes/${solicitud.id}/estado`, body));
      onHecho();
    } catch {
      /* el error se muestra en el modal */
    }
  };

  return (
    <Modal show onHide={onCerrar} centered>
      <Form onSubmit={enviar} noValidate>
        <Modal.Header closeButton>
          <Modal.Title className="h5">
            {esRechazo ? 'Rechazar resolución' : ACCIONES_ESTADO[destino]?.texto} — {solicitud.codigo}
          </Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="small">
            Estado: <EstadoBadge estado={solicitud.estado} /> → <EstadoBadge estado={destino} />
          </p>
          {destino === 'APROBADA' && (
            <Form.Group className="mb-3" controlId="prioridad-aprob">
              <Form.Label>Prioridad asignada</Form.Label>
              <Form.Select value={prioridadId} onChange={(e) => setPrioridadId(e.target.value)}>
                {prioridades?.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.horas_plazo} h)</option>)}
              </Form.Select>
              <Form.Text>Si cambia la prioridad, el plazo se recalcula desde la fecha de registro.</Form.Text>
            </Form.Group>
          )}
          {pideResolucion && (
            <Form.Group className="mb-3" controlId="resolucion">
              <Form.Label>Resolución documentada *</Form.Label>
              <Form.Control as="textarea" rows={4} value={resolucion} onChange={(e) => setResolucion(e.target.value)} isInvalid={resolucion.length > 0 && resolucion.trim().length < 20} />
              <Form.Control.Feedback type="invalid">Mínimo 20 caracteres.</Form.Control.Feedback>
              <Form.Text>Describa el trabajo realizado. Es obligatoria para resolver y cerrar.</Form.Text>
            </Form.Group>
          )}
          {(pideComentario || !pideResolucion) && (
            <Form.Group controlId="comentario">
              <Form.Label>
                {destino === 'PENDIENTE_INFO' ? 'Información requerida al cliente *' : pideComentario ? 'Motivo *' : 'Comentario (opcional)'}
              </Form.Label>
              <Form.Control as="textarea" rows={3} value={comentario} onChange={(e) => setComentario(e.target.value)} isInvalid={pideComentario && comentario.length > 0 && comentario.trim().length < 5} />
              <Form.Control.Feedback type="invalid">Mínimo 5 caracteres.</Form.Control.Feedback>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onCerrar}>Volver</Button>
          <Button type="submit" disabled={!valido || enviando}>
            {enviando ? <Spinner size="sm" animation="border" /> : 'Confirmar'}
          </Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

/** Modal de asignación: muestra técnicos con la especialidad, su carga y si son elegibles. */
function ModalAsignar({ solicitud, onCerrar, onHecho }) {
  const { data, error: errorCarga, cargando } = useApi(`/solicitudes/${solicitud.id}/tecnicos-sugeridos`);
  const { ejecutar, enviando, error } = useMutacion();
  const [tecnicoId, setTecnicoId] = useState(null);
  const [motivo, setMotivo] = useState('');
  const esReasignacion = !!solicitud.tecnico_id;

  const enviar = async () => {
    try {
      await ejecutar((a) => a.post(`/solicitudes/${solicitud.id}/asignaciones`, { tecnico_id: tecnicoId, motivo: motivo.trim() || undefined }));
      onHecho();
    } catch {
      /* error visible */
    }
  };

  return (
    <Modal show onHide={onCerrar} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="h5">{esReasignacion ? 'Reasignar técnico' : 'Asignar técnico'} — {solicitud.codigo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <p className="small text-body-secondary">
          Se muestran los técnicos con la especialidad requerida por la categoría <strong>{solicitud.categoria_nombre}</strong>, ordenados por carga.
        </p>
        {error && <Alert variant="danger">{error}</Alert>}
        <EstadoPeticion cargando={cargando} error={errorCarga} vacio={data?.length === 0} vacioProps={{ titulo: 'No hay técnicos con esa especialidad' }}>
          <ListGroup className="mb-3">
            {data?.map((t) => (
              <ListGroup.Item
                key={t.id}
                action={t.elegible}
                active={tecnicoId === t.id}
                disabled={!t.elegible}
                onClick={() => t.elegible && setTecnicoId(t.id)}
                className="d-flex justify-content-between align-items-start gap-2"
              >
                <div>
                  <div className="fw-semibold">
                    {t.nombre} {t.es_actual && <Badge bg="secondary">Actual</Badge>}
                  </div>
                  <div className="small">{t.especialidades.map((e) => e.nombre).join(', ')}</div>
                  {t.motivos.length > 0 && <div className="small text-danger">{t.motivos.join(' · ')}</div>}
                </div>
                <span className="small text-nowrap">
                  Carga {t.carga_actual}/{t.max_solicitudes_activas}
                </span>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </EstadoPeticion>
        {esReasignacion && (
          <Form.Group controlId="motivo">
            <Form.Label>Motivo de la reasignación *</Form.Label>
            <Form.Control as="textarea" rows={2} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
            <Form.Text>Mínimo 10 caracteres. Quedará registrado en el historial.</Form.Text>
          </Form.Group>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCerrar}>Volver</Button>
        <Button disabled={!tecnicoId || enviando || (esReasignacion && motivo.trim().length < 10)} onClick={enviar}>
          {enviando ? <Spinner size="sm" animation="border" /> : 'Asignar'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function ModalReabrir({ solicitud, onCerrar, onHecho }) {
  const { ejecutar, enviando, error } = useMutacion();
  const [motivo, setMotivo] = useState('');
  const enviar = async () => {
    try {
      await ejecutar((a) => a.post(`/solicitudes/${solicitud.id}/reapertura`, { motivo: motivo.trim() }));
      onHecho();
    } catch {
      /* error visible */
    }
  };
  return (
    <Modal show onHide={onCerrar} centered>
      <Modal.Header closeButton>
        <Modal.Title className="h5">Reabrir {solicitud.codigo}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {error && <Alert variant="danger">{error}</Alert>}
        <Alert variant="warning" className="small">La reapertura queda auditada con su usuario, fecha y motivo.</Alert>
        <Form.Group controlId="motivo-reapertura">
          <Form.Label>Motivo *</Form.Label>
          <Form.Control as="textarea" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} />
          <Form.Text>Mínimo 10 caracteres.</Form.Text>
        </Form.Group>
      </Modal.Body>
      <Modal.Footer>
        <Button variant="outline-secondary" onClick={onCerrar}>Volver</Button>
        <Button variant="warning" disabled={motivo.trim().length < 10 || enviando} onClick={enviar}>
          {enviando ? <Spinner size="sm" animation="border" /> : 'Reabrir'}
        </Button>
      </Modal.Footer>
    </Modal>
  );
}

function Historial({ id, version }) {
  const { data, error, cargando, recargar } = useApi(`/solicitudes/${id}/historial`, { v: version });
  return (
    <EstadoPeticion cargando={cargando && !data} error={error} onReintentar={recargar} vacio={data?.length === 0}>
      <ol className="timeline mb-0">
        {data?.map((h) => (
          <li key={h.id}>
            <div className="small">
              <strong>{h.usuario_nombre}</strong> <span className="text-body-secondary">({ROLES[h.usuario_rol]})</span> {ACCION_HISTORIAL[h.accion] || h.accion}
              {h.estado_nuevo && h.accion !== 'COMENTARIO' && (
                <>
                  {' '}
                  {h.estado_anterior && <><EstadoBadge estado={h.estado_anterior} /> → </>}
                  <EstadoBadge estado={h.estado_nuevo} />
                </>
              )}
            </div>
            {h.detalle?.tecnico?.nombre && <div className="small">Técnico: {h.detalle.tecnico.nombre}{h.detalle.tecnico_anterior && ` (antes: ${h.detalle.tecnico_anterior.nombre})`}</div>}
            {h.detalle?.prioridad && <div className="small">Prioridad: {h.detalle.prioridad.anterior} → {h.detalle.prioridad.nueva}</div>}
            {h.detalle?.archivos && <div className="small">Archivos: {h.detalle.archivos.join(', ')}</div>}
            {h.comentario && <blockquote className="small bg-body-secondary rounded p-2 my-1 mb-0">{h.comentario}</blockquote>}
            <div className="small text-body-secondary">{fechaHora(h.fecha)}</div>
          </li>
        ))}
      </ol>
    </EstadoPeticion>
  );
}

function Comentar({ id, onHecho }) {
  const { ejecutar, enviando, error } = useMutacion();
  const [texto, setTexto] = useState('');
  const enviar = async (e) => {
    e.preventDefault();
    try {
      await ejecutar((a) => a.post(`/solicitudes/${id}/comentarios`, { comentario: texto.trim() }));
      setTexto('');
      onHecho();
    } catch {
      /* error visible */
    }
  };
  return (
    <Form onSubmit={enviar} className="mb-3">
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      <Form.Label htmlFor="nuevo-comentario" className="visually-hidden">Agregar comentario</Form.Label>
      <div className="d-flex gap-2">
        <Form.Control id="nuevo-comentario" placeholder="Escriba un comentario o la información solicitada…" value={texto} onChange={(e) => setTexto(e.target.value)} maxLength={2000} />
        <Button type="submit" disabled={texto.trim().length < 2 || enviando}>
          {enviando ? <Spinner size="sm" animation="border" /> : 'Enviar'}
        </Button>
      </div>
    </Form>
  );
}

function Adjuntos({ solicitud, puedeAdjuntar, onHecho }) {
  const { ejecutar, enviando, error } = useMutacion();
  const descargar = async (a) => {
    const r = await api.get(`/solicitudes/${solicitud.id}/adjuntos/${a.id}`, { responseType: 'blob' });
    const url = URL.createObjectURL(r.data);
    const link = document.createElement('a');
    link.href = url;
    link.download = a.nombre_original;
    link.click();
    URL.revokeObjectURL(url);
  };
  const subir = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    const fd = new FormData();
    files.forEach((f) => fd.append('adjuntos', f));
    try {
      await ejecutar((a) => a.post(`/solicitudes/${solicitud.id}/adjuntos`, fd));
      onHecho();
    } catch {
      /* error visible */
    }
    e.target.value = '';
  };
  return (
    <>
      {error && <Alert variant="danger" className="py-2">{error}</Alert>}
      {solicitud.adjuntos.length === 0 ? (
        <p className="small text-body-secondary">Sin adjuntos.</p>
      ) : (
        <ListGroup variant="flush" className="mb-2">
          {solicitud.adjuntos.map((a) => (
            <ListGroup.Item key={a.id} className="px-0 d-flex justify-content-between align-items-center">
              <Button variant="link" className="p-0 text-start" onClick={() => descargar(a)}>
                <i className="bi bi-paperclip me-1" aria-hidden="true" />
                {a.nombre_original}
              </Button>
              <span className="small text-body-secondary">{tamanoArchivo(a.tamano_bytes)}</span>
            </ListGroup.Item>
          ))}
        </ListGroup>
      )}
      {puedeAdjuntar && (
        <Form.Group controlId="subir-adjunto">
          <Form.Label className="small mb-1">Agregar archivos (JPG, PNG, PDF, TXT · máx. 5 MB)</Form.Label>
          <Form.Control type="file" size="sm" multiple accept=".jpg,.jpeg,.png,.pdf,.txt" onChange={subir} disabled={enviando} />
        </Form.Group>
      )}
    </>
  );
}

export default function SolicitudDetalle() {
  const { id } = useParams();
  const location = useLocation();
  const { usuario } = useAuth();
  const { data: s, error, cargando, recargar } = useApi(`/solicitudes/${id}`);
  const [modal, setModal] = useState(null);
  const [aviso, setAviso] = useState(location.state?.creada ? 'Solicitud registrada correctamente.' : '');

  // Si otro usuario modifica esta solicitud, se actualiza sin recargar la página.
  useSolicitudesEnVivo((p) => {
    if (String(p.id) === String(id)) recargar({ silencioso: true });
  });

  const hecho = (msg) => {
    setModal(null);
    setAviso(msg);
    recargar({ silencioso: true });
  };

  return (
    <EstadoPeticion cargando={cargando && !s} error={error} onReintentar={recargar}>
      {s && (
        <>
          <div className="mb-2">
            <Link to="/solicitudes" className="small">
              <i className="bi bi-arrow-left me-1" />
              Volver al listado
            </Link>
          </div>
          <div className="d-flex flex-wrap align-items-center gap-2 mb-1">
            <h1 className="h4 mb-0">{s.codigo}</h1>
            <EstadoBadge estado={s.estado} />
            <PrioridadBadge prioridad={s.prioridad} />
          </div>
          <p className="lead mb-3">{s.titulo}</p>
          {aviso && <Alert variant="success" dismissible onClose={() => setAviso('')}>{aviso}</Alert>}

          {(s.acciones.transiciones.length > 0 || s.acciones.puedeAsignar || s.acciones.puedeReabrir) && (
            <Card className="mb-3">
              <Card.Body className="d-flex flex-wrap gap-2">
                {s.acciones.puedeAsignar && (
                  <Button onClick={() => setModal({ tipo: 'asignar' })}>
                    <i className="bi bi-person-plus me-1" />
                    {s.tecnico_id ? 'Reasignar técnico' : 'Asignar técnico'}
                  </Button>
                )}
                {s.acciones.transiciones.map((d) => {
                  const a = ACCIONES_ESTADO[d];
                  const rechazo = s.estado === 'RESUELTA' && d === 'EN_PROCESO';
                  return (
                    <Button key={d} variant={rechazo ? 'outline-warning' : a.variante} onClick={() => setModal({ tipo: 'estado', destino: d })}>
                      <i className={`bi ${rechazo ? 'bi-arrow-counterclockwise' : a.icono} me-1`} />
                      {rechazo ? 'Rechazar resolución' : a.texto}
                    </Button>
                  );
                })}
                {s.acciones.puedeReabrir && (
                  <Button variant="warning" onClick={() => setModal({ tipo: 'reabrir' })}>
                    <i className="bi bi-unlock me-1" />
                    Reabrir
                  </Button>
                )}
              </Card.Body>
            </Card>
          )}
          {s.estado === 'PENDIENTE_INFO' && usuario.rol === 'CLIENTE' && (
            <Alert variant="info">El técnico necesita información adicional. Respóndale en la sección de seguimiento.</Alert>
          )}

          <Row className="g-3">
            <Col lg={7}>
              <Card className="mb-3">
                <Card.Body>
                  <h2 className="card-titulo">Detalle</h2>
                  <p style={{ whiteSpace: 'pre-wrap' }}>{s.descripcion}</p>
                  <Table size="sm" borderless className="mb-0 small">
                    <tbody>
                      <tr><th className="w-25">Cliente</th><td>{s.cliente_nombre}</td></tr>
                      <tr><th>Sede</th><td>{s.sede_nombre} — {s.sede_direccion}</td></tr>
                      <tr><th>Categoría</th><td>{s.categoria_nombre}</td></tr>
                      <tr><th>Equipo afectado</th><td>{s.equipo_afectado}</td></tr>
                      <tr>
                        <th>Prioridad</th>
                        <td>
                          <PrioridadBadge prioridad={s.prioridad} />
                          {s.prioridad_solicitada !== s.prioridad && <span className="text-body-secondary"> (solicitada: {s.prioridad_solicitada})</span>}
                        </td>
                      </tr>
                      <tr><th>Técnico</th><td>{s.tecnico_nombre || 'Sin asignar'}</td></tr>
                      <tr><th>Registrada por</th><td>{s.creado_por_nombre} · {fechaHora(s.created_at)}</td></tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
              {s.resolucion && (
                <Card className="mb-3 border-success">
                  <Card.Body>
                    <h2 className="card-titulo text-success">Resolución</h2>
                    <p className="mb-1" style={{ whiteSpace: 'pre-wrap' }}>{s.resolucion}</p>
                    {s.fecha_resolucion && <div className="small text-body-secondary">Resuelta el {fechaHora(s.fecha_resolucion)}</div>}
                  </Card.Body>
                </Card>
              )}
              <Card className="mb-3">
                <Card.Body>
                  <h2 className="card-titulo">Seguimiento e historial</h2>
                  {s.acciones.puedeComentar && <Comentar id={s.id} onHecho={() => recargar({ silencioso: true })} />}
                  <Historial id={s.id} version={`${s.version}-${s.updated_at}`} />
                </Card.Body>
              </Card>
            </Col>
            <Col lg={5}>
              <Card className="mb-3">
                <Card.Body>
                  <h2 className="card-titulo">Plazo de atención</h2>
                  <PlazoBadge estado={s.estado_plazo} horas={s.horas_restantes} />
                  <Table size="sm" borderless className="mb-0 mt-2 small">
                    <tbody>
                      <tr><th>Plazo</th><td>{s.horas_plazo} h ({s.prioridad_nombre})</td></tr>
                      <tr><th>Fecha límite</th><td>{fechaHora(s.fecha_limite)}</td></tr>
                      <tr><th>Resolución</th><td>{fechaHora(s.fecha_resolucion)}</td></tr>
                      <tr><th>Cierre</th><td>{fechaHora(s.fecha_cierre)}</td></tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
              <Card className="mb-3">
                <Card.Body>
                  <h2 className="card-titulo">Adjuntos</h2>
                  <Adjuntos solicitud={s} puedeAdjuntar={s.acciones.puedeAdjuntar} onHecho={() => recargar({ silencioso: true })} />
                </Card.Body>
              </Card>
              {s.asignaciones.length > 0 && (
                <Card className="mb-3">
                  <Card.Body>
                    <h2 className="card-titulo">Asignaciones</h2>
                    <ListGroup variant="flush">
                      {s.asignaciones.map((a) => (
                        <ListGroup.Item key={a.id} className="px-0 small">
                          <div className="d-flex justify-content-between">
                            <strong>{a.tecnico_nombre}</strong>
                            {a.activa ? <Badge bg="success">Activa</Badge> : <Badge bg="secondary">Finalizada</Badge>}
                          </div>
                          <div className="text-body-secondary">Por {a.asignado_por_nombre} · {fechaHora(a.fecha_asignacion)}</div>
                          {a.motivo && <div>Motivo: {a.motivo}</div>}
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  </Card.Body>
                </Card>
              )}
            </Col>
          </Row>

          {modal?.tipo === 'estado' && (
            <ModalEstado solicitud={s} destino={modal.destino} onCerrar={() => setModal(null)} onHecho={() => hecho(`Estado actualizado a ${ESTADOS[modal.destino].nombre}.`)} />
          )}
          {modal?.tipo === 'asignar' && <ModalAsignar solicitud={s} onCerrar={() => setModal(null)} onHecho={() => hecho('Técnico asignado correctamente.')} />}
          {modal?.tipo === 'reabrir' && <ModalReabrir solicitud={s} onCerrar={() => setModal(null)} onHecho={() => hecho('Solicitud reabierta.')} />}
        </>
      )}
    </EstadoPeticion>
  );
}
