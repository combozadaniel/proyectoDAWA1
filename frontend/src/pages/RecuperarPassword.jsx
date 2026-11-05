import { useState } from 'react';
import { Alert, Button, Form, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import api, { mensajeError } from '../api/client';
import { AuthCard } from './Login';

export const reglasPassword = {
  required: 'Ingrese una contraseña',
  minLength: { value: 8, message: 'Mínimo 8 caracteres' },
  validate: {
    letra: (v) => /[A-Za-z]/.test(v) || 'Debe contener al menos una letra',
    numero: (v) => /[0-9]/.test(v) || 'Debe contener al menos un número',
  },
};

export function OlvidePassword() {
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm();

  const onSubmit = async ({ email }) => {
    setError('');
    try {
      const { data } = await api.post('/auth/olvide-password', { email });
      setResultado(data);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <AuthCard titulo="Recuperar contraseña">
      {error && <Alert variant="danger">{error}</Alert>}
      {resultado ? (
        <>
          <Alert variant="success">{resultado.message}</Alert>
          {resultado.tokenDesarrollo && (
            <Alert variant="warning" className="small">
              <strong>Modo desarrollo:</strong> no hay servidor de correo configurado.{' '}
              <Link to={`/restablecer?token=${resultado.tokenDesarrollo}`}>Abrir enlace de restablecimiento</Link>
            </Alert>
          )}
        </>
      ) : (
        <Form noValidate onSubmit={handleSubmit(onSubmit)}>
          <Form.Group className="mb-3" controlId="email">
            <Form.Label>Correo registrado</Form.Label>
            <Form.Control
              type="email"
              isInvalid={!!errors.email}
              {...register('email', { required: 'Ingrese su correo', pattern: { value: /^\S+@\S+\.\S+$/, message: 'Correo inválido' } })}
            />
            <Form.Control.Feedback type="invalid">{errors.email?.message}</Form.Control.Feedback>
          </Form.Group>
          <Button type="submit" className="w-100" disabled={isSubmitting}>
            {isSubmitting ? <Spinner size="sm" animation="border" /> : 'Enviar enlace'}
          </Button>
        </Form>
      )}
      <div className="text-center mt-3">
        <Link to="/login" className="small">
          Volver al inicio de sesión
        </Link>
      </div>
    </AuthCard>
  );
}

export function RestablecerPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [ok, setOk] = useState(false);
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm();
  const token = params.get('token') || '';

  const onSubmit = async ({ password }) => {
    setError('');
    try {
      await api.post('/auth/restablecer-password', { token, password });
      setOk(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (e) {
      setError(mensajeError(e));
    }
  };

  return (
    <AuthCard titulo="Definir nueva contraseña">
      {!token && <Alert variant="danger">Enlace inválido.</Alert>}
      {error && <Alert variant="danger">{error}</Alert>}
      {ok ? (
        <Alert variant="success">Contraseña actualizada. Redirigiendo al inicio de sesión…</Alert>
      ) : (
        <Form noValidate onSubmit={handleSubmit(onSubmit)}>
          <Form.Group className="mb-3" controlId="password">
            <Form.Label>Nueva contraseña</Form.Label>
            <Form.Control type="password" autoComplete="new-password" isInvalid={!!errors.password} {...register('password', reglasPassword)} />
            <Form.Control.Feedback type="invalid">{errors.password?.message}</Form.Control.Feedback>
          </Form.Group>
          <Form.Group className="mb-3" controlId="confirmar">
            <Form.Label>Confirmar contraseña</Form.Label>
            <Form.Control
              type="password"
              autoComplete="new-password"
              isInvalid={!!errors.confirmar}
              {...register('confirmar', { validate: (v) => v === watch('password') || 'Las contraseñas no coinciden' })}
            />
            <Form.Control.Feedback type="invalid">{errors.confirmar?.message}</Form.Control.Feedback>
          </Form.Group>
          <Button type="submit" className="w-100" disabled={isSubmitting || !token}>
            {isSubmitting ? <Spinner size="sm" animation="border" /> : 'Guardar contraseña'}
          </Button>
        </Form>
      )}
    </AuthCard>
  );
}
