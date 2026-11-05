import { useEffect, useState } from 'react';
import { Alert, Button, Card, Col, Form, Row, Spinner } from 'react-bootstrap';
import { useForm } from 'react-hook-form';
import { useNavigate } from 'react-router-dom';
import api, { erroresPorCampo, mensajeError } from '../api/client';
import { Encabezado } from '../components/ui';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../hooks/useApi';
import { tamanoArchivo } from '../utils/format';

const TIPOS = ['image/jpeg', 'image/png', 'application/pdf', 'text/plain'];
const MAX_MB = 5;

export default function SolicitudNueva() {
  const { usuario } = useAuth();
  const navigate = useNavigate();
  const esCliente = usuario.rol === 'CLIENTE';
  const [errorGeneral, setErrorGeneral] = useState('');
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({ defaultValues: { cliente_id: esCliente ? String(usuario.clienteId) : '', sede_id: '', categoria_id: '', prioridad_id: '' } });

  const clienteId = watch('cliente_id');
  const archivos = watch('adjuntos');
  const { data: clientes } = useApi(esCliente ? null : '/clientes', { limit: 100, activo: 'true' });
  const { data: sedes, cargando: cargandoSedes } = useApi(clienteId ? `/clientes/${clienteId}/sedes` : null);
  const { data: categorias } = useApi('/categorias', { activas: 'true' });
  const { data: prioridades } = useApi('/prioridades');

  useEffect(() => {
    setValue('sede_id', '');
  }, [clienteId, setValue]);

  const onSubmit = async (valores) => {
    setErrorGeneral('');
    const fd = new FormData();
    for (const k of ['sede_id', 'categoria_id', 'prioridad_id', 'titulo', 'descripcion', 'equipo_afectado']) fd.append(k, valores[k]);
    if (!esCliente) fd.append('cliente_id', valores.cliente_id);
    for (const f of valores.adjuntos || []) fd.append('adjuntos', f);
    try {
      const { data } = await api.post('/solicitudes', fd);
      navigate(`/solicitudes/${data.id}`, { state: { creada: true } });
    } catch (e) {
      const porCampo = erroresPorCampo(e);
      Object.entries(porCampo).forEach(([campo, message]) => setError(campo, { message }));
      setErrorGeneral(mensajeError(e));
    }
  };

  const validarArchivos = (lista) => {
    const arr = Array.from(lista || []);
    if (arr.length > 5) return 'Máximo 5 archivos';
    if (arr.some((f) => !TIPOS.includes(f.type))) return 'Solo se permiten JPG, PNG, PDF o TXT';
    if (arr.some((f) => f.size > MAX_MB * 1024 * 1024)) return `Cada archivo debe pesar menos de ${MAX_MB} MB`;
    return true;
  };

  const prioridadSel = prioridades?.find((p) => String(p.id) === watch('prioridad_id'));

  return (
    <>
      <Encabezado titulo="Nueva solicitud" subtitulo="Registre el servicio técnico requerido" />
      <Card>
        <Card.Body>
          {errorGeneral && <Alert variant="danger">{errorGeneral}</Alert>}
          <Form noValidate onSubmit={handleSubmit(onSubmit)}>
            <Row className="g-3">
              {!esCliente && (
                <Col md={6}>
                  <Form.Group controlId="cliente_id">
                    <Form.Label>Cliente *</Form.Label>
                    <Form.Select isInvalid={!!errors.cliente_id} {...register('cliente_id', { required: 'Seleccione el cliente' })}>
                      <option value="">Seleccione…</option>
                      {clientes?.data.map((c) => <option key={c.id} value={c.id}>{c.razon_social}</option>)}
                    </Form.Select>
                    <Form.Control.Feedback type="invalid">{errors.cliente_id?.message}</Form.Control.Feedback>
                  </Form.Group>
                </Col>
              )}
              <Col md={6}>
                <Form.Group controlId="sede_id">
                  <Form.Label>Sede *</Form.Label>
                  <Form.Select disabled={!clienteId || cargandoSedes} isInvalid={!!errors.sede_id} {...register('sede_id', { required: 'Seleccione la sede' })}>
                    <option value="">{clienteId ? 'Seleccione…' : 'Primero elija el cliente'}</option>
                    {sedes?.filter((s) => s.activo).map((s) => <option key={s.id} value={s.id}>{s.nombre} — {s.direccion}</option>)}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.sede_id?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="categoria_id">
                  <Form.Label>Categoría de servicio *</Form.Label>
                  <Form.Select isInvalid={!!errors.categoria_id} {...register('categoria_id', { required: 'Seleccione la categoría' })}>
                    <option value="">Seleccione…</option>
                    {categorias?.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.categoria_id?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="prioridad_id">
                  <Form.Label>Prioridad solicitada *</Form.Label>
                  <Form.Select isInvalid={!!errors.prioridad_id} {...register('prioridad_id', { required: 'Seleccione la prioridad' })}>
                    <option value="">Seleccione…</option>
                    {prioridades?.map((p) => <option key={p.id} value={p.id}>{p.nombre} (atención en {p.horas_plazo} h)</option>)}
                  </Form.Select>
                  <Form.Control.Feedback type="invalid">{errors.prioridad_id?.message}</Form.Control.Feedback>
                  {prioridadSel && <Form.Text>El coordinador puede ajustar la prioridad al aprobar la solicitud.</Form.Text>}
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="titulo">
                  <Form.Label>Título *</Form.Label>
                  <Form.Control maxLength={150} isInvalid={!!errors.titulo} {...register('titulo', { required: 'Ingrese un título', minLength: { value: 5, message: 'Mínimo 5 caracteres' } })} />
                  <Form.Control.Feedback type="invalid">{errors.titulo?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col md={6}>
                <Form.Group controlId="equipo_afectado">
                  <Form.Label>Equipo o recurso afectado *</Form.Label>
                  <Form.Control placeholder="Ej. Impresora HP LaserJet piso 2" maxLength={150} isInvalid={!!errors.equipo_afectado} {...register('equipo_afectado', { required: 'Indique el equipo afectado', minLength: { value: 2, message: 'Mínimo 2 caracteres' } })} />
                  <Form.Control.Feedback type="invalid">{errors.equipo_afectado?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group controlId="descripcion">
                  <Form.Label>Descripción del problema *</Form.Label>
                  <Form.Control as="textarea" rows={4} maxLength={4000} isInvalid={!!errors.descripcion} {...register('descripcion', { required: 'Describa el problema', minLength: { value: 10, message: 'Mínimo 10 caracteres' } })} />
                  <Form.Control.Feedback type="invalid">{errors.descripcion?.message}</Form.Control.Feedback>
                </Form.Group>
              </Col>
              <Col xs={12}>
                <Form.Group controlId="adjuntos">
                  <Form.Label>Adjuntos (opcional)</Form.Label>
                  <Form.Control type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.txt" isInvalid={!!errors.adjuntos} {...register('adjuntos', { validate: validarArchivos })} />
                  <Form.Control.Feedback type="invalid">{errors.adjuntos?.message}</Form.Control.Feedback>
                  <Form.Text>Hasta 5 archivos JPG, PNG, PDF o TXT de máximo {MAX_MB} MB.</Form.Text>
                  {archivos?.length > 0 && (
                    <ul className="small mt-2 mb-0">
                      {Array.from(archivos).map((f) => <li key={f.name}>{f.name} ({tamanoArchivo(f.size)})</li>)}
                    </ul>
                  )}
                </Form.Group>
              </Col>
            </Row>
            <div className="d-flex gap-2 justify-content-end mt-4">
              <Button variant="outline-secondary" onClick={() => navigate(-1)}>Cancelar</Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? <Spinner size="sm" animation="border" /> : 'Registrar solicitud'}
              </Button>
            </div>
          </Form>
        </Card.Body>
      </Card>
    </>
  );
}
