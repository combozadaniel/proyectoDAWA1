import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, ProgressBar, Row, Spinner, Table } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { erroresPorCampo } from '../../api/client';
import Confirmar from '../../components/Confirmar';
import { Encabezado, EstadoPeticion, Paginacion } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi, useDebounce, useMutacion } from '../../hooks/useApi';
import { reglasPassword } from '../RecuperarPassword';

function ModalTecnico({ tecnico, onCerrar, onHecho }) {
  const editar = !!tecnico;
  const { data: especialidades } = useApi('/especialidades', { activas: 'true' });
  const { ejecutar, enviando, error } = useMutacion();
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm({
    defaultValues: editar
      ? {
          nombre: tecnico.nombre,
          email: tecnico.email,
          cedula: tecnico.cedula,
          telefono: tecnico.telefono || '',
          max_solicitudes_activas: tecnico.max_solicitudes_activas,
          especialidades: tecnico.especialidades.map((e) => String(e.id)),
        }
      : { especialidades: [] },
  });

  const onSubmit = async (v) => {
    const body = {
      nombre: v.nombre.trim(),
      email: v.email.trim(),
      cedula: v.cedula.trim(),
      telefono: v.telefono?.trim() || undefined,
      especialidades: (v.especialidades || []).map(Number),
    };
    if (v.max_solicitudes_activas) body.max_solicitudes_activas = Number(v.max_solicitudes_activas);
    if (!editar) body.password = v.password;
    try {
      await ejecutar((a) => (editar ? a.put(`/tecnicos/${tecnico.id}`, body) : a.post('/tecnicos', body)));
      onHecho();
    } catch (e) {
      Object.entries(erroresPorCampo(e)).forEach(([c, message]) => setError(c, { message }));
    }
  };

  return (
    <Modal show onHide={onCerrar} size="lg" centered>
      <Form noValidate onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header closeButton>
          <Modal.Title className="h5">{editar ? 'Editar técnico' : 'Nuevo técnico'}</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <Row className="g-3">
            <Col md={6}>
              <Form.Group controlId="nombre">
                <Form.Label>Nombre completo *</Form.Label>
                <Form.Control isInvalid={!!errors.nombre} {...register('nombre', { required: 'Campo obligatorio', minLength: { value: 3, message: 'Mínimo 3 caracteres' } })} />
                <Form.Control.Feedback type="invalid">{errors.nombre?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="cedula">
                <Form.Label>Cédula *</Form.Label>
                <Form.Control inputMode="numeric" maxLength={10} isInvalid={!!errors.cedula} {...register('cedula', { required: 'Campo obligatorio', pattern: { value: /^\d{10}$/, message: '10 dígitos' } })} />
                <Form.Control.Feedback type="invalid">{errors.cedula?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="email-tec">
                <Form.Label>Correo (usuario de acceso) *</Form.Label>
                <Form.Control type="email" isInvalid={!!errors.email} {...register('email', { required: 'Campo obligatorio' })} />
                <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            {!editar && (
              <Col md={6}>
                <Form.Group controlId="password-tec">
                  <Form.Label>Contraseña inicial *</Form.Label>
                  <Form.Control type="password" autoComplete="new-password" isInvalid={!!errors.password} {...register('password', reglasPassword)} />
                  <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
            )}
            <Col md={6}>
              <Form.Group controlId="telefono-tec">
                <Form.Label>Teléfono</Form.Label>
                <Form.Control {...register('telefono')} />
              </Form.Group>
            </Col>
            <Col md={6}>
              <Form.Group controlId="max">
                <Form.Label>Máximo de solicitudes activas</Form.Label>
                <Form.Control type="number" min={1} max={50} placeholder="Valor por defecto del sistema" isInvalid={!!errors.max_solicitudes_activas} {...register('max_solicitudes_activas', { min: { value: 1, message: 'Mínimo 1' }, max: { value: 50, message: 'Máximo 50' } })} />
                <Form.Control.Feedback type="invalid">{errors.max_solicitudes_activas?.message}</Form.Control.Feedback>
              </Form.Group>
            </Col>
            <Col xs={12}>
              <fieldset>
                <legend className="form-label fs-6">Especialidades *</legend>
                <div className="d-flex flex-wrap gap-3">
                  {especialidades?.map((e) => (
                    <Form.Check key={e.id} id={`esp-${e.id}`} type="checkbox" label={e.nombre} value={String(e.id)} {...register('especialidades', { validate: (v) => v?.length > 0 || 'Seleccione al menos una' })} />
                  ))}
                </div>
                {errors.especialidades && <div className="text-danger small mt-1">{errors.especialidades.message}</div>}
              </fieldset>
            </Col>
          </Row>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" disabled={enviando}>{enviando ? <Spinner size="sm" animation="border" /> : 'Guardar'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default function Tecnicos() {
  const { tieneRol } = useAuth();
  const esAdmin = tieneRol('ADMIN');
  const [page, setPage] = useState(1);
  const [busqueda, setBusqueda] = useState('');
  const [especialidad, setEspecialidad] = useState('');
  const q = useDebounce(busqueda);
  const { data, error, cargando, recargar } = useApi('/tecnicos', { page, limit: 10, q: q || undefined, especialidad_id: especialidad || undefined });
  const { data: especialidades } = useApi('/especialidades');
  const [modal, setModal] = useState(null);
  const mut = useMutacion();

  const cerrar = (r) => {
    setModal(null);
    mut.setError('');
    if (r) recargar({ silencioso: true });
  };

  const actualizar = (t, cambios) => mut.ejecutar((a) => a.put(`/tecnicos/${t.id}`, cambios)).then(() => recargar({ silencioso: true })).catch(() => {});

  return (
    <>
      <Encabezado titulo="Técnicos" subtitulo="Especialidades, disponibilidad y carga de trabajo">
        {esAdmin && <Button onClick={() => setModal({ tipo: 'form' })}><i className="bi bi-plus-lg me-1" />Nuevo técnico</Button>}
      </Encabezado>
      <Card>
        <Card.Body>
          {mut.error && !modal && <Alert variant="danger" dismissible onClose={() => mut.setError('')}>{mut.error}</Alert>}
          <Row className="g-2 mb-3">
            <Col md={8}>
              <Form.Control type="search" placeholder="Buscar por nombre o cédula" aria-label="Buscar técnicos" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1); }} />
            </Col>
            <Col md={4}>
              <Form.Select aria-label="Filtrar por especialidad" value={especialidad} onChange={(e) => { setEspecialidad(e.target.value); setPage(1); }}>
                <option value="">Todas las especialidades</option>
                {especialidades?.map((e) => <option key={e.id} value={e.id}>{e.nombre}</option>)}
              </Form.Select>
            </Col>
          </Row>
          <EstadoPeticion cargando={cargando && !data} error={error} onReintentar={recargar} vacio={data?.data.length === 0}>
            {data && (
              <>
                <Table hover className="tabla-responsiva">
                  <thead>
                    <tr><th>Técnico</th><th>Especialidades</th><th style={{ minWidth: 140 }}>Carga</th><th>Disponibilidad</th><th>Estado</th><th /></tr>
                  </thead>
                  <tbody>
                    {data.data.map((t) => {
                      const pct = Math.round((t.carga_actual / t.max_solicitudes_activas) * 100);
                      return (
                        <tr key={t.id}>
                          <td data-label="Técnico"><span className="fw-semibold">{t.nombre}</span><div className="small text-body-secondary">{t.email} · {t.cedula}</div></td>
                          <td data-label="Especialidades" className="small">{t.especialidades.map((e) => e.nombre).join(', ')}</td>
                          <td data-label="Carga">
                            <div className="small">{t.carga_actual}/{t.max_solicitudes_activas}</div>
                            <ProgressBar now={pct} variant={pct >= 100 ? 'danger' : pct >= 75 ? 'warning' : 'primary'} style={{ height: 6 }} aria-label={`Carga ${pct}%`} />
                          </td>
                          <td data-label="Disponibilidad">
                            <Form.Check type="switch" id={`disp-${t.id}`} checked={t.disponible} label={t.disponible ? 'Disponible' : 'No disponible'} onChange={(e) => actualizar(t, { disponible: e.target.checked })} />
                          </td>
                          <td data-label="Estado">{t.activo ? <Badge bg="success">Activo</Badge> : <Badge bg="secondary">Inactivo</Badge>}</td>
                          <td className="text-end text-nowrap">
                            <Button size="sm" variant="outline-primary" className="me-1" onClick={() => setModal({ tipo: 'form', tecnico: t })} aria-label={`Editar ${t.nombre}`}><i className="bi bi-pencil" /></Button>
                            <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => actualizar(t, { activo: !t.activo })}>{t.activo ? 'Desactivar' : 'Activar'}</Button>
                            {esAdmin && <Button size="sm" variant="outline-danger" onClick={() => setModal({ tipo: 'borrar', tecnico: t })} aria-label={`Eliminar ${t.nombre}`}><i className="bi bi-trash" /></Button>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
                <Paginacion meta={data.meta} onCambiar={setPage} />
              </>
            )}
          </EstadoPeticion>
        </Card.Body>
      </Card>
      {modal?.tipo === 'form' && <ModalTecnico tecnico={modal.tecnico} onCerrar={() => cerrar(false)} onHecho={() => cerrar(true)} />}
      <Confirmar
        show={modal?.tipo === 'borrar'}
        titulo="Eliminar técnico"
        mensaje={<p>¿Eliminar a <strong>{modal?.tecnico?.nombre}</strong>? Solo es posible si nunca tuvo asignaciones; en caso contrario, desactívelo.</p>}
        error={mut.error}
        enviando={mut.enviando}
        onCerrar={() => cerrar(false)}
        onConfirmar={() => mut.ejecutar((a) => a.delete(`/tecnicos/${modal.tecnico.id}`)).then(() => cerrar(true)).catch(() => {})}
      />
    </>
  );
}
