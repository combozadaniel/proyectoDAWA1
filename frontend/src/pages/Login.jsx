import { useState } from 'react';
import { Alert, Button, Card, Form, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { mensajeError } from '../api/client';
import { useAuth } from '../context/AuthContext';

const DEMO = [
  ['Administrador', 'admin@servigest.ec'],
  ['Coordinador', 'coordinador@servigest.ec'],
  ['Técnico', 'tecnico@servigest.ec'],
  ['Cliente', 'cliente@servigest.ec'],
];

export function AuthCard({ titulo, children }) {
  return (
    <div className="login-bg d-flex align-items-center justify-content-center p-3">
      <Card className="shadow-lg w-100" style={{ maxWidth: 420 }}>
        <Card.Body className="p-4">
          <div className="text-center mb-4">
            <i className="bi bi-tools text-primary display-6" aria-hidden="true" />
            <h1 className="h4 mt-2 mb-0">ServiGest Ecuador</h1>
            <p className="text-body-secondary small">{titulo}</p>
          </div>
          {children}
        </Card.Body>
      </Card>
    </div>
  );
}

export default function Login() {
  const { login, usuario } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { email: '', password: '' } });

  if (usuario) return <Navigate to="/" replace />;

  const onSubmit = async ({ email, password }) => {
    setError('');
    try {
      await login(email.trim().toLowerCase(), password);
      navigate(location.state?.desde || '/', { replace: true });
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <AuthCard titulo="Gestión de solicitudes de servicios técnicos">
      {error && <Alert variant="danger">{error}</Alert>}
      <Form noValidate onSubmit={handleSubmit(onSubmit)}>
        <Form.Group className="mb-3" controlId="email">
          <Form.Label>Correo electrónico</Form.Label>
          <Form.Control
            type="email"
            autoComplete="username"
            isInvalid={!!errors.email}
            {...register('email', {
              required: 'Ingrese su correo',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Correo inválido' },
            })}
          />
          <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
        </Form.Group>
        <Form.Group className="mb-3" controlId="password">
          <Form.Label>Contraseña</Form.Label>
          <Form.Control
            type="password"
            autoComplete="current-password"
            isInvalid={!!errors.password}
            {...register('password', { required: 'Ingrese su contraseña' })}
          />
          <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
        </Form.Group>
        <Button type="submit" className="w-100" disabled={isSubmitting}>
          {isSubmitting ? <Spinner size="sm" animation="border" /> : 'Iniciar sesión'}
        </Button>
        <div className="text-center mt-3">
          <Link to="/olvide-password" className="small">
            ¿Olvidó su contraseña?
          </Link>
        </div>
      </Form>

      <hr />
      <p className="small text-body-secondary mb-2">
        Usuarios de demostración (contraseña <code>Servigest2026</code>):
      </p>
      <div className="d-flex flex-wrap gap-1">
        {DEMO.map(([rol, email]) => (
          <Button
            key={email}
            size="sm"
            variant="outline-secondary"
            onClick={() => {
              setValue('email', email);
              setValue('password', 'Servigest2026');
            }}
          >
            {rol}
          </Button>
        ))}
      </div>
    </AuthCard>
  );
}
