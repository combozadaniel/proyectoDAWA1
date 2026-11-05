import { useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import api, { mensajeError } from '../api/client';
import { Encabezado } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { ROLES } from '../utils/format';
import { reglasPassword } from './RecuperarPassword';

function Disponibilidad() {
  const { usuario } = useAuth();
  const [disponible, setDisponible] = useState(usuario.tecnicoDisponible);
  const [error, setError] = useState('');
  const cambiar = async (valor) => {
    setError('');
    try {
      const { data } = await api.patch('/tecnicos/me/disponibilidad', { disponible: valor });
      setDisponible(data.disponible);
    } catch (e) {
      setError(mensajeError(e));
    }
  };
  return (
    <Card className="mb-3">
      <Card.Body>
        <Card.Title className="card-titulo">Disponibilidad</Card.Title>
        <p className="small text-body-secondary">Si no está disponible, no se le asignarán nuevas solicitudes.</p>
        {error && <Alert variant="danger">{error}</Alert>}
        <div className="d-flex gap-2">
          <Button variant={disponible === true ? 'success' : 'outline-success'} onClick={() => cambiar(true)}>
            Disponible
          </Button>
          <Button variant={disponible === false ? 'secondary' : 'outline-secondary'} onClick={() => cambiar(false)}>
            No disponible
          </Button>
        </div>
      </Card.Body>
    </Card>
  );
}

export default function Perfil() {
  const { usuario } = useAuth();
  const [mensaje, setMensaje] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async ({ actual, nueva }) => {
    setMensaje(null);
    try {
      await api.patch('/auth/me/password', { actual, nueva });
      setMensaje({ tipo: 'success', texto: 'Contraseña actualizada correctamente.' });
      reset();
    } catch (e) {
      setMensaje({ tipo: 'danger', texto: mensajeError(e) });
    }
  };

  return (
    <>
      <Encabezado titulo="Mi perfil" />
      <Row className="g-3">
        <Col md={5}>
          <Card className="mb-3">
            <Card.Body>
              <dl className="mb-0">
                <dt>Nombre</dt>
                <dd>{usuario.nombre}</dd>
                <dt>Correo</dt>
                <dd>{usuario.email}</dd>
                <dt>Rol</dt>
                <dd className="mb-0">{ROLES[usuario.rol]}</dd>
              </dl>
            </Card.Body>
          </Card>
          {usuario.rol === 'TECNICO' && <Disponibilidad />}
        </Col>
        <Col md={7}>
          <Card>
            <Card.Body>
              <Card.Title className="card-titulo">Cambiar contraseña</Card.Title>
              {mensaje && <Alert variant={mensaje.tipo}>{mensaje.texto}</Alert>}
              <Form noValidate onSubmit={handleSubmit(onSubmit)}>
                <Form.Group className="mb-3" controlId="actual">
                  <Form.Label>Contraseña actual</Form.Label>
                  <Form.Control type="password" autoComplete="current-password" isInvalid={!!errors.actual} {...register('actual', { required: 'Campo obligatorio' })} />
                  <Form.Control.Feedback type="invalid">{errors.actual?.message}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3" controlId="nueva">
                  <Form.Label>Nueva contraseña</Form.Label>
                  <Form.Control type="password" autoComplete="new-password" isInvalid={!!errors.nueva} {...register('nueva', reglasPassword)} />
                  <Form.Control.Feedback type="invalid">{errors.nueva?.message}</Form.Control.Feedback>
                </Form.Group>
                <Form.Group className="mb-3" controlId="confirmar">
                  <Form.Label>Confirmar nueva contraseña</Form.Label>
                  <Form.Control
                    type="password"
                    autoComplete="new-password"
                    isInvalid={!!errors.confirmar}
                    {...register('confirmar', { validate: (v) => v === watch('nueva') || 'Las contraseñas no coinciden' })}
                  />
                  <Form.Control.Feedback type="invalid">{errors.confirmar?.message}</Form.Control.Feedback>
                </Form.Group>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Spinner size="sm" animation="border" /> : 'Actualizar contraseña'}
                </Button>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </>
  );
}
