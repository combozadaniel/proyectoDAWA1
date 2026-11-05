import { useState } from 'react';
import { Alert, Badge, Button, Card, Col, Form, Modal, Row, Spinner, Table } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { Encabezado, EstadoPeticion, Paginacion } from '../../components/ui';
import { useAuth } from '../../context/AuthContext';
import { useApi, useDebounce, useMutacion } from '../../hooks/useApi';
import { ROLES, fechaHora } from '../../utils/format';
import { reglasPassword } from '../RecuperarPassword';

function ModalUsuario({ onCerrar, onHecho }) {
  const { ejecutar, enviando, error } = useMutacion();
  const { register, handleSubmit, formState: { errors } } = useForm({ defaultValues: { rol: 'COORDINADOR' } });
  const onSubmit = async (v) => {
    try {
      await ejecutar((a) => a.post('/usuarios', v));
      onHecho();
    } catch { /* visible */ }
  };
  return (
    <Modal show onHide={onCerrar} centered>
      <Form noValidate onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header closeButton><Modal.Title className="h5">Nuevo usuario</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          <p className="small text-body-secondary">Los técnicos y clientes se crean desde sus módulos, porque requieren datos adicionales.</p>
          <Form.Group className="mb-3" controlId="u-nombre">
            <Form.Label>Nombre *</Form.Label>
            <Form.Control isInvalid={!!errors.nombre} {...register('nombre', { required: 'Campo obligatorio', minLength: { value: 3, message: 'Mínimo 3 caracteres' } })} />
            <Form.Control.Feedback type="invalid">{errors.nombre?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="u-email">
            <Form.Label>Correo *</Form.Label>
            <Form.Control type="email" isInvalid={!!errors.email} {...register('email', { required: 'Campo obligatorio' })} />
            <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="u-password">
            <Form.Label>Contraseña inicial *</Form.Label>
            <Form.Control type="password" autoComplete="new-password" isInvalid={!!errors.password} {...register('password', reglasPassword)} />
            <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group controlId="u-rol">
            <Form.Label>Rol *</Form.Label>
            <Form.Select {...register('rol')}>
              <option value="COORDINADOR">Coordinador</option>
              <option value="ADMIN">Administrador</option>
            </Form.Select>
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onCerrar}>Cancelar</Button>
          <Button type="submit" disabled={enviando}>{enviando ? <Spinner size="sm" animation="border" /> : 'Crear'}</Button>
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

function ModalReset({ usuario, onCerrar }) {
  const { ejecutar, enviando, error } = useMutacion();
  const [ok, setOk] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm();
  const onSubmit = async ({ password }) => {
    try {
      await ejecutar((a) => a.post(`/usuarios/${usuario.id}/reset-password`, { password }));
      setOk(true);
    } catch { /* visible */ }
  };
  return (
    <Modal show onHide={onCerrar} centered>
      <Form noValidate onSubmit={handleSubmit(onSubmit)}>
        <Modal.Header closeButton><Modal.Title className="h5">Restablecer contraseña</Modal.Title></Modal.Header>
        <Modal.Body>
          {error && <Alert variant="danger">{error}</Alert>}
          {ok ? (
            <Alert variant="success">Contraseña temporal asignada a {usuario.email}. Comuníquela por un canal seguro.</Alert>
          ) : (
            <Form.Group controlId="reset-pass">
              <Form.Label>Contraseña temporal para {usuario.nombre}</Form.Label>
              <Form.Control type="password" autoComplete="new-password" isInvalid={!!errors.password} {...register('password', reglasPassword)} />
              <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
            </Form.Group>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="outline-secondary" onClick={onCerrar}>Cerrar</Button>
          {!ok && <Button type="submit" disabled={enviando}>Restablecer</Button>}
        </Modal.Footer>
      </Form>
    </Modal>
  );
}

export default function Usuarios() {
  const { usuario: yo } = useAuth();
  const [page, setPage] = useState(1);
  const [rol, setRol] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const q = useDebounce(busqueda);
  const { data, error, cargando, recargar } = useApi('/usuarios', { page, limit: 15, rol: rol || undefined, q: q || undefined });
  const [modal, setModal] = useState(null);
  const mut = useMutacion();

  return (
    <>
      <Encabezado titulo="Usuarios" subtitulo="Cuentas de acceso y roles">
        <Button onClick={() => setModal({ tipo: 'nuevo' })}><i className="bi bi-plus-lg me-1" />Nuevo usuario</Button>
      </Encabezado>
      <Card>
        <Card.Body>
          {mut.error && <Alert variant="danger" dismissible onClose={() => mut.setError('')}>{mut.error}</Alert>}
          <Row className="g-2 mb-3">
            <Col md={8}><Form.Control type="search" placeholder="Buscar por nombre o correo" aria-label="Buscar usuarios" value={busqueda} onChange={(e) => { setBusqueda(e.target.value); setPage(1); }} /></Col>
            <Col md={4}>
              <Form.Select aria-label="Filtrar por rol" value={rol} onChange={(e) => { setRol(e.target.value); setPage(1); }}>
                <option value="">Todos los roles</option>
                {Object.entries(ROLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </Form.Select>
            </Col>
          </Row>
          <EstadoPeticion cargando={cargando && !data} error={error} onReintentar={recargar} vacio={data?.data.length === 0}>
            {data && (
              <>
                <Table hover className="tabla-responsiva">
                  <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th /></tr></thead>
                  <tbody>
                    {data.data.map((u) => (
                      <tr key={u.id}>
                        <td data-label="Nombre" className="fw-semibold">{u.nombre}</td>
                        <td data-label="Correo">{u.email}</td>
                        <td data-label="Rol"><Badge bg="light" text="dark">{ROLES[u.rol]}</Badge></td>
                        <td data-label="Último acceso" className="small">{fechaHora(u.ultimo_acceso)}</td>
                        <td data-label="Estado">{u.activo ? <Badge bg="success">Activo</Badge> : <Badge bg="secondary">Inactivo</Badge>}</td>
                        <td className="text-end text-nowrap">
                          <Button size="sm" variant="outline-secondary" className="me-1" onClick={() => setModal({ tipo: 'reset', usuario: u })}>
                            <i className="bi bi-key me-1" />Contraseña
                          </Button>
                          <Button
                            size="sm"
                            variant={u.activo ? 'outline-danger' : 'outline-success'}
                            disabled={u.id === yo.id}
                            onClick={() => mut.ejecutar((a) => a.put(`/usuarios/${u.id}`, { activo: !u.activo })).then(() => recargar({ silencioso: true })).catch(() => {})}
                          >
                            {u.activo ? 'Desactivar' : 'Activar'}
                          </Button>
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
      {modal?.tipo === 'nuevo' && <ModalUsuario onCerrar={() => setModal(null)} onHecho={() => { setModal(null); recargar({ silencioso: true }); }} />}
      {modal?.tipo === 'reset' && <ModalReset usuario={modal.usuario} onCerrar={() => setModal(null)} />}
    </>
  );
}
