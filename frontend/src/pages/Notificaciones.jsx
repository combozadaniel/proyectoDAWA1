import { useEffect, useState } from 'react';
import { Badge, Button, ButtonGroup, Card, ListGroup } from 'react-bootstrap';
import { Link } from 'react-router-dom';
import api from '../api/client';
import { Encabezado, EstadoPeticion, Paginacion } from '../components/ui';
import { useSocket } from '../context/SocketContext';
import { useApi } from '../hooks/useApi';
import { fechaHora, tiempoRelativo } from '../utils/format';

const ICONOS = {
  REGISTRO: 'bi-inbox',
  ASIGNACION: 'bi-person-check',
  CAMBIO_ESTADO: 'bi-arrow-repeat',
  SOLICITUD_INFO: 'bi-question-circle',
  CIERRE: 'bi-lock',
  COMENTARIO: 'bi-chat-left-text',
  REAPERTURA: 'bi-unlock',
};

export default function Notificaciones() {
  const [page, setPage] = useState(1);
  const [soloNoLeidas, setSoloNoLeidas] = useState(false);
  const { data, error, cargando, recargar } = useApi('/notificaciones', { page, limit: 15, no_leidas: soloNoLeidas ? 'true' : undefined });
  const { setNoLeidas, ultimaNotificacion } = useSocket();

  // Las nuevas notificaciones aparecen sin recargar la página.
  useEffect(() => {
    if (ultimaNotificacion) recargar({ silencioso: true });
  }, [ultimaNotificacion]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (data) setNoLeidas(data.noLeidas);
  }, [data, setNoLeidas]);

  const marcar = async (n) => {
    if (!n.leida) {
      await api.patch(`/notificaciones/${n.id}/leida`);
      recargar({ silencioso: true });
    }
  };

  const marcarTodas = async () => {
    await api.patch('/notificaciones/leer-todas');
    recargar({ silencioso: true });
  };

  return (
    <>
      <Encabezado titulo="Notificaciones" subtitulo={data ? `${data.noLeidas} sin leer` : undefined}>
        <ButtonGroup size="sm">
          <Button variant={!soloNoLeidas ? 'primary' : 'outline-primary'} onClick={() => { setSoloNoLeidas(false); setPage(1); }}>Todas</Button>
          <Button variant={soloNoLeidas ? 'primary' : 'outline-primary'} onClick={() => { setSoloNoLeidas(true); setPage(1); }}>Sin leer</Button>
        </ButtonGroup>
        <Button size="sm" variant="outline-secondary" onClick={marcarTodas} disabled={!data?.noLeidas}>
          Marcar todas como leídas
        </Button>
      </Encabezado>
      <Card>
        <Card.Body>
          <EstadoPeticion
            cargando={cargando && !data}
            error={error}
            onReintentar={recargar}
            vacio={data?.data.length === 0}
            vacioProps={{ titulo: 'No hay notificaciones', icono: 'bi-bell-slash' }}
          >
            {data && (
              <>
                <ListGroup variant="flush" className="mb-3">
                  {data.data.map((n) => (
                    <ListGroup.Item key={n.id} className={`d-flex gap-3 px-0 ${n.leida ? '' : 'bg-primary-subtle rounded px-2'}`}>
                      <i className={`bi ${ICONOS[n.tipo] || 'bi-bell'} fs-5 text-primary`} aria-hidden="true" />
                      <div className="flex-grow-1 min-w-0">
                        <div className="d-flex justify-content-between gap-2">
                          <strong>{n.titulo}</strong>
                          <span className="small text-body-secondary text-nowrap" title={fechaHora(n.created_at)}>{tiempoRelativo(n.created_at)}</span>
                        </div>
                        <div className="small">{n.mensaje}</div>
                        <div className="d-flex gap-3 mt-1 small">
                          {n.solicitud_id && (
                            <Link to={`/solicitudes/${n.solicitud_id}`} onClick={() => marcar(n)}>
                              Ver {n.solicitud_codigo}
                            </Link>
                          )}
                          {!n.leida && (
                            <Button variant="link" size="sm" className="p-0" onClick={() => marcar(n)}>
                              Marcar como leída
                            </Button>
                          )}
                        </div>
                      </div>
                      {!n.leida && <Badge bg="primary" className="align-self-start">Nueva</Badge>}
                    </ListGroup.Item>
                  ))}
                </ListGroup>
                <Paginacion meta={data.meta} onCambiar={setPage} />
              </>
            )}
          </EstadoPeticion>
        </Card.Body>
      </Card>
    </>
  );
}
