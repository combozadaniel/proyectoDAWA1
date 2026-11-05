import { useState } from 'react';
import { Badge, Card, Form, Table } from 'react-bootstrap';
import { Encabezado, EstadoPeticion, Paginacion } from '../../components/ui';
import { useApi } from '../../hooks/useApi';
import { fechaHora } from '../../utils/format';

const ENTIDADES = ['sesion', 'usuario', 'cliente', 'sede', 'tecnico', 'especialidad', 'categoria', 'prioridad', 'parametro', 'solicitud'];

function Cambios({ antes, despues }) {
  if (!antes && !despues) return <span className="text-body-secondary">—</span>;
  const claves = [...new Set([...Object.keys(antes || {}), ...Object.keys(despues || {})])].filter(
    (k) => !['created_at', 'updated_at'].includes(k) && JSON.stringify(antes?.[k]) !== JSON.stringify(despues?.[k]),
  );
  if (!antes || !despues) {
    return <code className="small text-wrap">{JSON.stringify(despues || antes).slice(0, 160)}</code>;
  }
  if (!claves.length) return <span className="text-body-secondary small">Sin cambios de datos</span>;
  return (
    <ul className="small mb-0 ps-3">
      {claves.slice(0, 5).map((k) => (
        <li key={k}>
          <strong>{k}</strong>: {JSON.stringify(antes[k])} → {JSON.stringify(despues[k])}
        </li>
      ))}
    </ul>
  );
}

export default function Auditoria() {
  const [page, setPage] = useState(1);
  const [entidad, setEntidad] = useState('');
  const { data, error, cargando, recargar } = useApi('/auditoria', { page, limit: 20, entidad: entidad || undefined });
  return (
    <>
      <Encabezado titulo="Auditoría" subtitulo="Registro inalterable de operaciones sobre catálogos, usuarios y seguridad" />
      <Card>
        <Card.Body>
          <Form.Select className="mb-3" style={{ maxWidth: 280 }} aria-label="Filtrar por entidad" value={entidad} onChange={(e) => { setEntidad(e.target.value); setPage(1); }}>
            <option value="">Todas las entidades</option>
            {ENTIDADES.map((e) => <option key={e} value={e}>{e}</option>)}
          </Form.Select>
          <EstadoPeticion cargando={cargando && !data} error={error} onReintentar={recargar} vacio={data?.data.length === 0}>
            {data && (
              <>
                <Table size="sm" className="tabla-responsiva">
                  <thead><tr><th>Fecha</th><th>Usuario</th><th>Entidad</th><th>Acción</th><th>Cambios</th><th>IP</th></tr></thead>
                  <tbody>
                    {data.data.map((a) => (
                      <tr key={a.id}>
                        <td data-label="Fecha" className="small text-nowrap">{fechaHora(a.fecha)}</td>
                        <td data-label="Usuario">{a.usuario_nombre || '—'}</td>
                        <td data-label="Entidad">{a.entidad}{a.entidad_id ? ` #${a.entidad_id}` : ''}</td>
                        <td data-label="Acción"><Badge bg={a.accion.includes('FALLIDO') ? 'danger' : 'light'} text={a.accion.includes('FALLIDO') ? undefined : 'dark'}>{a.accion}</Badge></td>
                        <td data-label="Cambios"><Cambios antes={a.datos_antes} despues={a.datos_despues} /></td>
                        <td data-label="IP" className="small">{a.ip}</td>
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
    </>
  );
}
