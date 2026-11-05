import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, ListGroup, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { useFieldArray, useForm } from 'react-hook-form';
import { erroresPorCampo } from '../../api/client';
import Confirmar from '../../components/Confirmar';
import { Encabezado, EstadoPeticion, Paginacion } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi, useDebounce, useMutacion } from '../../hooks/useApi';
import { reglasPassword } from '../RecuperarPassword';

const reglaIdentificacion = {
  required: 'Campo obligatorio',
  pattern: { value: /^(\d{10}|\d{10}001)$/, message: 'Cédula (10 dígitos) o RUC (13 dígitos terminado en 001)' },
};

function ModalCliente({ cliente, onCerrar, onHecho }) {
  const editar = !!cliente;
  const { ejecutar, enviando, error } = useMutacion();
  const [crearCuenta, setCrearCuenta] = useState(false);
  const {
    register,
    handleSubmit,
    control,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: editar
      ? { identificacion: cliente.identificacion, razon_social: cliente.razon_social, email: cliente.email, telefono: cliente.telefono || '', direccion: cliente.direccion || '' }
      : { sedes: [{ nombre: 'Matriz', direccion: '' }] },
  });
  const { fields, append, remove } = useFieldArray({ control, name: 'sedes' });

  const onSubmit = async (v) => {
    const body = {
      identificacion: v.identificacion.trim(),
      razon_social: v.razon_social.trim(),
      email: v.email.trim(),
      telefono: v.telefono?.trim() || undefined,
      direccion: v.direccion?.trim() || undefined,
    };
    if (!editar) {
      body.sedes = v.sedes;
      if (crearCuenta) body.cuenta = { email: v.cuenta_email.trim(), password: v.cuenta_password };
    }
    try {
      await ejecutar((a) => (editar ? a.put(`/clientes/${cliente.id}`, body) : a.post('/clientes', body)));
      onHecho();
    } catch (e) {
      Object.entries(erroresPorCampo(e)).forEach(([c, message]) => setError(c, { message }));
    }
  };

  return (
    <Modal show onHide={onCerrar} size="lg" centered>
      <Form noValidate onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header closeButton>
          <Modal.Title className="h5">{editar ? 'Editar cliente' : 'Nuevo cliente'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Row className="g-3">
            <Col md={4}>
              <Form.Group controlId="identificacion">
                <Form.Label>Cédula / RUC *</Form.Label>
                <Form.Control inputMode="numeric" maxLength={13} isInvalid={!!errors.identificacion} {...register('identificacion', reglaIdentificacion)} />
                <Form.Control.Feedback type="invalid">{errors.identificacion?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={8}>
              <Form.Group controlId="razon_social">
                <Form.Label>Razón social *</Form.Label>
                <Form.Control isInvalid={!!errors.razon_social} {...register('razon_social', { required: 'Campo obligatorio', minLength: { value: 3, message: 'Mínimo 3 caracteres' } })} />
                <Form.Control.Feedback type="invalid">{errors.razon_social?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="email-cliente">
                <Form.Label>Correo de contacto *</Form.Label>
                <Form.Control type="email" isInvalid={!!errors.email} {...register('email', { required: 'Campo obligatorio', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Correo inválido' } })} />
                <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="telefono">
                <Form.Label>Teléfono</Form.Label>
                <Form.Control isInvalid={!!errors.telefono} {...register('telefono', { pattern: { value: /^[0-9+\-\s()]{7,20}$/, message: 'Teléfono inválido' } })} />
                <Form.Control.Feedback type="invalid">{errors.telefono?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <Form.Group controlId="direccion">
                <Form.Label>Dirección</Form.Label>
                <Form.Control {...register('direccion')} />
              </Form.Group>
            </Col>
          </Row>
          {!editar && (
            <>
              <hr />
              <div className="d-flex justify-content-between align-items-center mb-2">
                <strong>Sedes</strong>
                <Button size="sm" variant="outline-primary" onClick={() => append({ nombre: '', direccion: '' })}>Agregar sede</Button>
              </div>
              {fields.map((f, i) => (
                <Row key={f.id} className="g-2 mb-2">
                  <Col md={4}>
                    <Form.Control placeholder="Nombre de la sede" aria-label={`Nombre sede ${i + 1}`} isInvalid={!!errors.sedes?.[i]?.nombre} {...register(`sedes.${i}.nombre`, { required: true, minLength: 2 })} />
                  </Col>
                  <Col md={7}>
                    <Form.Control placeholder="Dirección" aria-label={`Dirección sede ${i + 1}`} isInvalid={!!errors.sedes?.[i]?.direccion} {...register(`sedes.${i}.direccion`, { required: true, minLength: 5 })} />
                  </Col>
                  <Col md={1}>
                    <Button variant="outline-danger" size="sm" onClick={() => remove(i)} aria-label="Quitar sede" disabled={fields.length === 1}>
                      <i className="bi bi-trash" />
                    </Button>
                  </Col>
                </Row>
              ))}
              <hr />
              <Form.Check id="crear-cuenta" type="switch" label="Crear cuenta de acceso para el cliente" checked={crearCuenta} onChange={(e) => setCrearCuenta(e.target.checked)} />
              {crearCuenta && (
                <Row className="g-3 mt-1">
                  <Col md={6}>
                    <Form.Group controlId="cuenta_email">
                      <Form.Label>Correo de acceso *</Form.Label>
                      <Form.Control type="email" isInvalid={!!errors.cuenta_email} {...register('cuenta_email', { required: 'Campo obligatorio' })} />
                      <Form.Control.Feedback type="invalid">{errors.cuenta_email?.message}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                  <Col md={6}>
                    <Form.Group controlId="cuenta_password">
                      <Form.Label>Contraseña inicial *</Form.Label>
                      <Form.Control type="password" autoComplete="new-password" isInvalid={!!errors.cuenta_password} {...register('cuenta_password', reglasPassword)} />
                      <Form.Control.Feedback type="invalid">{errors.cuenta_password?.message}</Form.Control.Feedback>
                    </Form.Group>
                  </Col>
                </Row>
              )}
            </>
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

function ModalSedes({ cliente, onCerrar }) {
  const { data, error, cargando, recargar } = useApi(`/clientes/${cliente.id}/sedes`);
  const { ejecutar, enviando, error: errorMut } = useMutacion();
  const { register, handleSubmit, reset, formState: { errors } } = useForm();

  const crear = async (v) => {
    try {
      await ejecutar((a) => a.post(`/clientes/${cliente.id}/sedes`, v));
      reset();
      recargar({ silencioso: true });
    } catch { /* error visible */ }
  };
  const alternar = async (s) => {
    try {
      await ejecutar((a) => a.put(`/clientes/${cliente.id}/sedes/${s.id}`, { activo: !s.activo }));
      recargar({ silencioso: true });
    } catch { /* error visible */ }
  };
  const eliminar = async (s) => {
    try {
      await ejecutar((a) => a.delete(`/clientes/${cliente.id}/sedes/${s.id}`));
      recargar({ silencioso: true });
    } catch { /* error visible */ }
  };

  return (
    <Modal show onHide={onCerrar} centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title className="h5">Sedes de {cliente.razon_social}</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {errorMut && <Alert variant="danger">{errorMut}</Alert>}
        <EstadoPeticion cargando={cargando} error={error} vacio={data?.length === 0}>
          <ListGroup className="mb-3">
            {data?.map((s) => (
              <ListGroup.Item key={s.id} className="d-flex justify-content-between align-items-center gap-2">
                <div>
                  <strong>{s.nombre}</strong> {!s.activo && <Badge bg="secondary">Inactiva</Badge>}
                  <div className="small text-body-secondary">{s.direccion}</div>
                </div>
                <div className="d-flex gap-1">
                  <Button size="sm" variant="outline-secondary" onClick={() => alternar(s)} disabled={enviando}>{s.activo ? 'Desactivar' : 'Activar'}</Button>
                  <Button size="sm" variant="outline-danger" onClick={() => eliminar(s)} disabled={enviando} aria-label={`Eliminar sede ${s.nombre}`}><i className="bi bi-trash" /></Button>
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </EstadoPeticion>
        <Form noValidate onSubmit={handleSubmit(crear)} className="row g-2">
          <Col md={4}><Form.Control placeholder="Nombre" aria-label="Nombre de la nueva sede" isInvalid={!!errors.nombre} {...register('nombre', { required: true, minLength: 2 })} /></Col>
          <Col md={6}><Form.Control placeholder="Dirección" aria-label="Dirección de la nueva sede" isInvalid={!!errors.direccion} {...register('direccion', { required: true, minLength: 5 })} /></Col>
          <Col md={2}><Button type="submit" className="w-100" disabled={enviando}>Agregar</Button></Col>
        </Form>
      </Modal.Body>
    </Modal>
  );
}

export default function Clientes() {
  const { tieneRol } = useAuth();
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda);
  const { data, error, cargando, recargar } = useApi('/clientes', { page, limit: 10, q: q || undefined });
  const [modal, setModal] = useState(null);
  const borrar = useMutacion();

  const cerrar = (recargarLista) => {
    setModal(null);
    borrar.setError('');
    if (recargarLista) recargar({ silencioso: true });
  };

  return (
    <>
      <Encabezado titulo="Clientes" subtitulo="Empresas atendidas y sus sedes">
        <Button onClick={() => setModal({ tipo: 'form' })}><i className="bi bi-plus-lg me-1" />Nuevo cliente</Button>
      </Encabezado>
      <Card>
        <Card.Body>
          <Form.Control type="search" className="mb-3" placeholder="Buscar por razón social o identificación" aria-label="Buscar clientes" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1); }} />
          <EstadoPeticion cargando={cargando && !data} error={error} onReintentar={recargar} vacio={data?.data.length === 0}>
            {data && (
              <>
                <Table hover className="tabla-responsiva">
                  <thead>
                    <tr><th>Razón social</th><th>Identificación</th><th>Contacto</th><th>Cuenta</th><th>Solicitudes</th><th>Estado</th><th /></tr>
                  </thead>
                  <tbody>
                    {data.data.map((c) => (
                      <tr key={c.id}>
                        <td data-label="Razón social" className="fw-semibold">{c.razon_social}</td>
                        <td data-label="Identificación">{c.identificacion}</td>
                        <td data-label="Contacto" className="small">{c.email}<br />{c.telefono}</td>
                        <td data-label="Cuenta" className="small">{c.usuario_email || <span className="text-body-secondary">Sin cuenta</span>}</td>
                        <td data-label="Solicitudes">{c.total_solicitudes}</td>
                        <td data-label="Estado">{c.activo ? <Badge bg="success">Activo</Badge> : <Badge bg="secondary">Inactivo</Badge>}</td>
                        <td className="text-end text-nowrap">
                          <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => setModal({ tipo: 'sedes', cliente: c })}>Sedes</Button>
                          <Button size="sm" variant="outline-primary" className="me-1" onClick={() => setModal({ tipo: 'form', cliente: c })} aria-label={`Editar ${c.razon_social}`}><i className="bi bi-pencil" /></Button>
                          <Button
                            size="sm"
                            variant="outline-secondary"
                            className="me-1"
                            onClick={async () => {
                              await borrar.ejecutar((a) => a.put(`/clientes/${c.id}`, { activo: !c.activo })).catch(() => {});
                              recargar({ silencioso: true });
                            }}
                          >
                            {c.activo ? 'Desactivar' : 'Activar'}
                          </Button>
                          {tieneRol('ADMIN') && (
                            <Button size="sm" variant="outline-danger" onClick={() => setModal({ tipo: 'borrar', cliente: c })} aria-label={`Eliminar ${c.razon_social}`}><i className="bi bi-trash" /></Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
                <Paginacion meta={data.meta} onCambiar={setPage} />
              </>
            )}
          </EstadoPeticion>
        </Card.Body>
      </Card>
      {modal?.tipo === 'form' && <ModalCliente cliente={modal.cliente} onCerrar={() => cerrar(false)} onHecho={() => cerrar(true)} />}
      {modal?.tipo === 'sedes' && <ModalSedes cliente={modal.cliente} onCerrar={() => cerrar(true)} />}
      <Confirmar
        show={modal?.tipo === 'borrar'}
        titulo="Eliminar cliente"
        mensaje={<p>¿Eliminar a <strong>{modal?.cliente?.razon_social}</strong>? Solo es posible si no tiene solicitudes registradas; en caso contrario, desactívelo.</p>}
        error={borrar.error}
        enviando={borrar.enviando}
        onCerrar={() => cerrar(false)}
        onConfirmar={() => borrar.ejecutar((a) => a.delete(`/clientes/${modal.cliente.id}`)).then(() => cerrar(true)).catch(() => {})}
      />
    </>
  );
}
