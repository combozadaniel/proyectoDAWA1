import { useEffect, useState } from 'react';
import { Container, Nav, Navbar, NavDropdown, Offcanvas, Toast, ToastContainer } from 'react-bootstrap';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import { ROLES } from '../utils/format';

const MENU = [
  { to: '/', icono: 'bi-speedometer2', texto: 'Dashboard', roles: ['ADMIN', 'COORDINADOR', 'TECNICO', 'CLIENTE'], end: true },
  { to: '/solicitudes', icono: 'bi-card-checklist', texto: 'Solicitudes', roles: ['ADMIN', 'COORDINADOR', 'TECNICO', 'CLIENTE'] },
  { to: '/solicitudes/nueva', icono: 'bi-plus-circle', texto: 'Nueva solicitud', roles: ['ADMIN', 'COORDINADOR', 'CLIENTE'] },
  { to: '/clientes', icono: 'bi-buildings', texto: 'Clientes', roles: ['ADMIN', 'COORDINADOR'] },
  { to: '/tecnicos', icono: 'bi-person-gear', texto: 'Técnicos', roles: ['ADMIN', 'COORDINADOR'] },
  { to: '/catalogos', icono: 'bi-tags', texto: 'Catálogos', roles: ['ADMIN', 'COORDINADOR'] },
  { to: '/usuarios', icono: 'bi-people', texto: 'Usuarios', roles: ['ADMIN'] },
  { to: '/auditoria', icono: 'bi-shield-check', texto: 'Auditoría', roles: ['ADMIN'] },
];

function Menu({ rol, onNavegar }) {
  return (
    <Nav className="flex-column gap-1">
      {MENU.filter((m) => m.roles.includes(rol)).map((m) => (
        <Nav.Link as={NavLink} key={m.to} to={m.to} end={m.end ?? m.to === '/solicitudes'} onClick={onNavegar} className="sidebar-link">
          <i className={`bi ${m.icono} me-2`} aria-hidden="true" />
          {m.texto}
        </Nav.Link>
      ))}
    </Nav>
  );
}

export default function Layout() {
  const { usuario, logout } = useAuth();
  const { noLeidas, conectado, ultimaNotificacion } = useSocket();
  const navigate = useNavigate();
  const [menuMovil, setMenuMovil] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    if (ultimaNotificacion) setToast(ultimaNotificacion);
  }, [ultimaNotificacion]);

  const salir = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="app-shell">
      <a href="#contenido" className="visually-hidden-focusable skip-link">
        Saltar al contenido
      </a>
      <Navbar bg="primary" variant="dark" className="px-2 px-md-3 sticky-top shadow-sm" as="header">
        <button type="button" className="btn btn-link text-white d-lg-none me-1 p-1" onClick={() => setMenuMovil(true)} aria-label="Abrir menú">
          <i className="bi bi-list fs-4" />
        </button>
        <Navbar.Brand as={Link} to="/" className="fw-semibold">
          <i className="bi bi-tools me-2" aria-hidden="true" />
          ServiGest
        </Navbar.Brand>
        <div className="ms-auto d-flex align-items-center gap-2">
          <span
            className={`d-none d-sm-inline small ${conectado ? 'text-white' : 'text-white-50'}`}
            title={conectado ? 'Actualizaciones en tiempo real activas' : 'Sin conexión en tiempo real'}
          >
            <i className={`bi ${conectado ? 'bi-broadcast' : 'bi-wifi-off'}`} aria-hidden="true" />
            <span className="visually-hidden">{conectado ? 'Conectado en tiempo real' : 'Desconectado'}</span>
          </span>
          <Link to="/notificaciones" className="btn btn-link text-white position-relative p-1" aria-label={`Notificaciones: ${noLeidas} sin leer`}>
            <i className="bi bi-bell fs-5" />
            {noLeidas > 0 && (
              <span className="position-absolute top-0 start-100 translate-middle badge rounded-pill bg-danger">
                {noLeidas > 99 ? '99+' : noLeidas}
              </span>
            )}
          </Link>
          <NavDropdown
            align="end"
            title={
              <span className="text-white">
                <i className="bi bi-person-circle me-1" aria-hidden="true" />
                <span className="d-none d-md-inline">{usuario.nombre}</span>
              </span>
            }
            id="menu-usuario"
          >
            <NavDropdown.Header>
              {usuario.email}
              <br />
              <small>{ROLES[usuario.rol]}</small>
            </NavDropdown.Header>
            <NavDropdown.Item as={Link} to="/perfil">
              <i className="bi bi-key me-2" />
              Mi perfil
            </NavDropdown.Item>
            <NavDropdown.Divider />
            <NavDropdown.Item onClick={salir}>
              <i className="bi bi-box-arrow-right me-2" />
              Cerrar sesión
            </NavDropdown.Item>
          </NavDropdown>
        </div>
      </Navbar>

      <div className="d-flex">
        <aside className="sidebar d-none d-lg-block border-end bg-body p-3" aria-label="Navegación principal">
          <Menu rol={usuario.rol} />
        </aside>
        <Offcanvas show={menuMovil} onHide={() => setMenuMovil(false)} aria-labelledby="titulo-menu">
          <Offcanvas.Header closeButton>
            <Offcanvas.Title id="titulo-menu">ServiGest</Offcanvas.Title>
          </Offcanvas.Header>
          <Offcanvas.Body>
            <Menu rol={usuario.rol} onNavegar={() => setMenuMovil(false)} />
          </Offcanvas.Body>
        </Offcanvas>

        <main id="contenido" className="flex-grow-1 p-3 p-md-4 min-w-0">
          <Container fluid="xl" className="px-0">
            <Outlet />
          </Container>
        </main>
      </div>

      <ToastContainer position="bottom-end" className="p-3 position-fixed" role="status" aria-live="polite">
        {toast && (
          <Toast onClose={() => setToast(null)} delay={6000} autohide bg="light">
            <Toast.Header>
              <i className="bi bi-bell-fill text-primary me-2" aria-hidden="true" />
              <strong className="me-auto">{toast.titulo}</strong>
            </Toast.Header>
            <Toast.Body>
              {toast.mensaje}
              {toast.solicitud_id && (
                <div className="mt-2">
                  <Link to={`/solicitudes/${toast.solicitud_id}`} onClick={() => setToast(null)}>
                    Ver solicitud
                  </Link>
                </div>
              )}
            </Toast.Body>
          </Toast>
        )}
      </ToastContainer>
    </div>
  );
}
