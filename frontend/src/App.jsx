import { Link, Route, Routes } from 'react-router-dom';
import Layout from './components/Layout';
import RutaProtegida from './components/RutaProtegida';
import { Vacio } from './components/ui';
import Login from './pages/Login';
import { OlvidePassword, RestablecerPassword } from './pages/RecuperarPassword';
import Dashboard from './pages/Dashboard';
import Solicitudes from './pages/Solicitudes';
import SolicitudNueva from './pages/SolicitudNueva';
import SolicitudDetalle from './pages/SolicitudDetalle';
import Notificaciones from './pages/Notificaciones';
import Perfil from './pages/Perfil';
import Clientes from './pages/admin/Clientes';
import Tecnicos from './pages/admin/Tecnicos';
import Catalogos from './pages/admin/Catalogos';
import Usuarios from './pages/admin/Usuarios';
import Auditoria from './pages/admin/Auditoria';

const GESTION = ['ADMIN', 'COORDINADOR'];

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/olvide-password" element={<OlvidePassword />} />
      <Route path="/restablecer" element={<RestablecerPassword />} />

      <Route element={<RutaProtegida />}>
        <Route element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="solicitudes" element={<Solicitudes />} />
          <Route path="solicitudes/:id" element={<SolicitudDetalle />} />
          <Route path="notificaciones" element={<Notificaciones />} />
          <Route path="perfil" element={<Perfil />} />

          <Route element={<RutaProtegida roles={['ADMIN', 'COORDINADOR', 'CLIENTE']} />}>
            <Route path="solicitudes/nueva" element={<SolicitudNueva />} />
          </Route>
          <Route element={<RutaProtegida roles={GESTION} />}>
            <Route path="clientes" element={<Clientes />} />
            <Route path="tecnicos" element={<Tecnicos />} />
            <Route path="catalogos" element={<Catalogos />} />
          </Route>
          <Route element={<RutaProtegida roles={['ADMIN']} />}>
            <Route path="usuarios" element={<Usuarios />} />
            <Route path="auditoria" element={<Auditoria />} />
          </Route>

          <Route
            path="sin-permiso"
            element={
              <Vacio icono="bi-shield-lock" titulo="Acceso denegado" texto="Su rol no tiene permiso para ver esta sección.">
                <Link to="/">Volver al inicio</Link>
              </Vacio>
            }
          />
          <Route
            path="*"
            element={
              <Vacio icono="bi-signpost-split" titulo="Página no encontrada">
                <Link to="/">Volver al inicio</Link>
              </Vacio>
            }
          />
        </Route>
      </Route>
    </Routes>
  );
}
