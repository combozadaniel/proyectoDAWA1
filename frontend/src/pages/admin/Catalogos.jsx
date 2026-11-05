import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Tab, Table, Tabs } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import Confirmar from '../../components/Confirmar';
import { Encabezado, EstadoPeticion } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi, useMutacion } from '../../hooks/useApi';

/** Formulario de especialidad o categoría (comparten nombre/descripción/activo). */
function ModalItem({ tipo, item, onCerrar, onHecho }) {
  const esCategoria = tipo === 'categorias';
  const { data: especialidades } = useApi(esCategoria ? '/especialidades' : null, { activas: 'true' });
  const { ejecutar, enviando, error } = useMutacion();
  const { register, handleSubmit, formState: { errors } } = useForm({
    defaultValues: item
      ? { nombre: item.nombre, descripcion: item.descripcion || '', especialidad_id: item.especialidad_id ? String(item.especialidad_id) : '' }
      : {},
  });
  const onSubmit = async (v) => {
    const body = { nombre: v.nombre.trim(), descripcion: v.descripcion?.trim() || undefined };
    if (esCategoria) body.especialidad_id = Number(v.especialidad_id);
    try {
      await ejecutar((a) => (item ? a.put(`/${tipo}/${item.id}`, body) : a.post(`/${tipo}`, body)));
      onHecho();
    } catch { /* error visible */ }
  };
  return (
    <Modal show onHide={onCerrar} centered>
      <Form noValidate onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header closeButton>
          <Modal.Title className="h5">{item ? 'Editar' : 'Nueva'} {esCategoria ? 'categoría' : 'especialidad'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Form.Group className="mb-3" controlId="nombre-cat">
            <Form.Label>Nombre *</Form.Label>
            <Form.Control isInvalid={!!errors.nombre} {...register('nombre', { required: 'Campo obligatorio', minLength: { value: 3, message: 'Mínimo 3 caracteres' } })} />
            <Form.Control.Feedback type="invalid">{errors.nombre?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="descripcion-cat">
            <Form.Label>Descripción</Form.Label>
            <Form.Control {...register('descripcion')} />
          </Form.Group>
          {esCategoria && (
            <Form.Group controlId="especialidad-cat">
              <Form.Label>Especialidad requerida *</Form.Label>
              <Form.Select isInvalid={!!errors.especialidad_id} {...register('especialidad_id', { required: 'Seleccione la especialidad' })}>
                <option value="">Seleccione…</option>
                {especialidades?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </Form.Select>
              <Form.Control.Feedback type="invalid">{errors.especialidad_id?.message}</Form.Control.Feedback>
              <Form.Text>Solo los técnicos con esta especialidad podrán atender la categoría.</Form.Text>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" disabled={enviando}>{enviando ? <Spinner size="sm" animation="border" /> : 'Guardar'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function ListaCatalogo({ tipo, esAdmin }) {
  const { data, error, cargando, recargar } = useApi(`/${tipo}`);
  const [modal, setModal] = useState(null);
  const mut = useMutacion();
  const cerrar = (r) => {
    setModal(null);
    mut.setError('');
    if (r) recargar({ silencioso: true });
  };
  const esCategoria = tipo === 'categorias';
  return (
    <>
      {esAdmin && (
        <div className="text-end mb-2">
          <Button size="sm" onClick={() => setModal({ tipo: 'form' })}><i className="bi bi-plus-lg me-1" />Agregar</Button>
        </div>
      )}
      {mut.error && !modal && <Alert variant="danger" dismissible onClose={() => mut.setError('')}>{mut.error}</Alert>}
      <EstadoPeticion cargando={cargando} error={error} onReintentar={recargar} vacio={data?.length === 0}>
        <Table hover className="tabla-responsiva">
          <thead>
            <tr><th>Nombre</th><th>Descripción</th>{esCategoria ? <th>Especialidad</th> : <th>Técnicos</th>}<th>Estado</th>{esAdmin && <th />}</tr>
          </thead>
          <tbody>
            {data?.map((i) => (
              <tr key={i.id}>
                <td data-label="Nombre" className="fw-semibold">{i.nombre}</td>
                <td data-label="Descripción" className="small">{i.descripcion}</td>
                <td data-label={esCategoria ? 'Especialidad' : 'Técnicos'}>{esCategoria ? i.especialidad_nombre : i.total_tecnicos}</td>
                <td data-label="Estado">{i.activo ? <Badge bg="success">Activo</Badge> : <Badge bg="secondary">Inactivo</Badge>}</td>
                {esAdmin && (
                  <td className="text-end text-nowrap">
                    <Button size="sm" variant="outline-primary" className="me-1" onClick={() => setModal({ tipo: 'form', item: i })} aria-label={`Editar ${i.nombre}`}><i className="bi bi-pencil" /></Button>
                    <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => mut.ejecutar((a) => a.put(`/${tipo}/${i.id}`, { activo: !i.activo })).then(() => recargar({ silencioso: true })).catch(() => {})}>
                      {i.activo ? 'Desactivar' : 'Activar'}
                    </Button>
                    <Button size="sm" variant="outline-danger" onClick={() => setModal({ tipo: 'borrar', item: i })} aria-label={`Eliminar ${i.nombre}`}><i className="bi bi-trash" /></Button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </Table>
      </EstadoPeticion>
      {modal?.tipo === 'form' && <ModalItem tipo={tipo} item={modal.item} onCerrar={() => cerrar(false)} onHecho={() => cerrar(true)} />}
      <Confirmar
        show={modal?.tipo === 'borrar'}
        titulo="Eliminar registro"
        mensaje={<p>¿Eliminar <strong>{modal?.item?.nombre}</strong>? No es posible si tiene registros relacionados; en ese caso, desactívelo.</p>}
        error={mut.error}
        enviando={mut.enviando}
        onCerrar={() => cerrar(false)}
        onConfirmar={() => mut.ejecutar((a) => a.delete(`/${tipo}/${modal.item.id}`)).then(() => cerrar(true)).catch(() => {})}
      />
    </>
  );
}

function Prioridades({ esAdmin }) {
  const { data, error, cargando, recargar } = useApi('/prioridades');
  const mut = useMutacion();
  const [edicion, setEdicion] = useState({});
  const guardar = (p) =>
    mut
      .ejecutar((a) => a.put(`/prioridades/${p.id}`, { horas_plazo: Number(edicion[p.id]) }))
      .then(() => {
        setEdicion((e) => ({ ...e, [p.id]: undefined }));
        recargar({ silencioso: true });
      })
      .catch(() => {});
  return (
    <EstadoPeticion cargando={cargando} error={error} onReintentar={recargar}>
      {mut.error && <Alert variant="danger">{mut.error}</Alert>}
      <p className="small text-body-secondary">El plazo se cuenta desde el registro de la solicitud. Los cambios aplican a solicitudes nuevas o aprobadas con cambio de prioridad.</p>
      <Table className="tabla-responsiva">
        <thead><tr><th>Prioridad</th><th>Plazo de atención (horas)</th>{esAdmin && <th />}</tr></thead>
        <tbody>
          {data?.map((p) => (
            <tr key={p.id}>
              <td data-label="Prioridad" className="fw-semibold">{p.nombre}</td>
              <td data-label="Plazo">
                {esAdmin ? (
                  <Form.Control type="number" min={1} max={720} size="sm" style={{ maxWidth: 120 }} aria-label={`Plazo ${p.nombre}`} value={edicion[p.id] ?? p.horas_plazo} onChange={(e) => setEdicion((x) => ({ ...x, [p.id]: e.target.value }))} />
                ) : (
                  `${p.horas_plazo} h`
                )}
              </td>
              {esAdmin && (
                <td className="text-end">
                  <Button size="sm" disabled={edicion[p.id] === undefined || Number(edicion[p.id]) === p.horas_plazo || mut.enviando} onClick={() => guardar(p)}>Guardar</Button>
                </td>
              )}
            </tr>
          ))}
        </tbody>
      </Table>
    </EstadoPeticion>
  );
}

function Parametros({ esAdmin }) {
  const { data, error, cargando, recargar } = useApi('/parametros');
  const mut = useMutacion();
  const [edicion, setEdicion] = useState({});
  const [ok, setOk] = useState('');
  const guardar = (p) =>
    mut
      .ejecutar((a) => a.put(`/parametros/${p.clave}`, { valor: edicion[p.clave] }))
      .then(() => {
        setOk(`Parámetro ${p.clave} actualizado.`);
        setEdicion((e) => ({ ...e, [p.clave]: undefined }));
        recargar({ silencioso: true });
      })
      .catch(() => {});
  return (
    <EstadoPeticion cargando={cargando} error={error} onReintentar={recargar}>
      {mut.error && <Alert variant="danger">{mut.error}</Alert>}
      {ok && <Alert variant="success" dismissible onClose={() => setOk('')}>{ok}</Alert>}
      {data?.map((p) => (
        <Row key={p.clave} className="g-2 align-items-center border-bottom py-2">
          <Col md={7}>
            <code>{p.clave}</code>
            <div className="small text-body-secondary">{p.descripcion}</div>
          </Col>
          <Col xs={8} md={3}>
            <Form.Control size="sm" aria-label={p.clave} disabled={!esAdmin} value={edicion[p.clave] ?? p.valor} onChange={(e) => setEdicion((x) => ({ ...x, [p.clave]: e.target.value }))} />
          </Col>
          <Col xs={4} md={2}>
            {esAdmin && (
              <Button size="sm" className="w-100" disabled={edicion[p.clave] === undefined || edicion[p.clave] === p.valor || mut.enviando} onClick={() => guardar(p)}>Guardar</Button>
            )}
          </Col>
        </Row>
      ))}
    </EstadoPeticion>
  );
}

export default function Catalogos() {
  const { tieneRol } = useAuth();
  const esAdmin = tieneRol('ADMIN');
  return (
    <>
      <Encabezado titulo="Catálogos y parámetros" subtitulo={esAdmin ? 'Configuración operativa del sistema' : 'Solo lectura: la edición corresponde al administrador'} />
      <Card>
        <Card.Body>
          <Tabs defaultActiveKey="especialidades" className="mb-3" mountOnEnter>
            <Tab eventKey="especialidades" title="Especialidades"><ListaCatalogo tipo="especialidades" esAdmin={esAdmin} /></Tab>
            <Tab eventKey="categorias" title="Categorías"><ListaCatalogo tipo="categorias" esAdmin={esAdmin} /></Tab>
            <Tab eventKey="prioridades" title="Prioridades y plazos"><Prioridades esAdmin={esAdmin} /></Tab>
            <Tab eventKey="parametros" title="Parámetros"><Parametros esAdmin={esAdmin} /></Tab>
          </Tabs>
        </Card.Body>
      </Card>
    </>
  );
}
