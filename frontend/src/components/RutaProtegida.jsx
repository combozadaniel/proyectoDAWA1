import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Cargando } from './ui';

/**
 * Protege rutas por autenticación y, opcionalmente, por rol.
 * Es una ayuda de UX: la autorización real la verifica el backend en cada petición.
 */
export default function RutaProtegida({ roles }) {
  const { usuario, cargando } = useAuth();
  const location = useLocation();

  if (cargando) return <Cargando texto="Verificando sesión…" />;
  if (!usuario) return <Navigate to="/login" replace state={{ desde: location.pathname }} />;
  if (roles && !roles.includes(usuario.rol)) return <Navigate to="/sin-permiso" replace />;
  return <Outlet />;
}
