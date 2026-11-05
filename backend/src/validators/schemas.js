/**
 * Esquemas de validación de entrada (Zod). Mensajes en español.
 */
const { z } = require('zod');
const { ESTADOS } = require('../domain/estados');
const { ROLES } = require('../domain/roles');

const id = z.coerce.number({ invalid_type_error: 'Debe ser un número' }).int().positive('Debe ser un ID válido');
const idOpcional = id.optional();
const texto = (min, max) =>
  z.string({ required_error: 'Campo obligatorio' }).trim().min(min, `Mínimo ${min} caracteres`).max(max, `Máximo ${max} caracteres`);
const email = z.string({ required_error: 'Campo obligatorio' }).trim().toLowerCase().email('Correo inválido').max(120);
const password = z
  .string({ required_error: 'Campo obligatorio' })
  .min(8, 'La contraseña debe tener al menos 8 caracteres')
  .max(72, 'Máximo 72 caracteres')
  .regex(/[A-Za-z]/, 'Debe contener al menos una letra')
  .regex(/[0-9]/, 'Debe contener al menos un número');
const fecha = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha AAAA-MM-DD');
const booleanQuery = z.enum(['true', 'false']).transform((v) => v === 'true');
const listaCsv = (valores) =>
  z
    .string()
    .transform((v) => v.split(',').map((s) => s.trim().toUpperCase()).filter(Boolean))
    .pipe(z.array(z.enum(valores)));
const telefono = z.string().trim().regex(/^[0-9+\-\s()]{7,20}$/, 'Teléfono inválido').optional();

/** Valida cédula ecuatoriana (algoritmo módulo 10). */
function cedulaValida(c) {
  if (!/^\d{10}$/.test(c)) return false;
  const provincia = Number(c.slice(0, 2));
  if (provincia < 1 || (provincia > 24 && provincia !== 30)) return false;
  const coef = [2, 1, 2, 1, 2, 1, 2, 1, 2];
  const suma = coef.reduce((acc, k, i) => {
    let v = Number(c[i]) * k;
    if (v > 9) v -= 9;
    return acc + v;
  }, 0);
  return (10 - (suma % 10)) % 10 === Number(c[9]);
}
const cedula = z.string().trim().refine(cedulaValida, 'Cédula ecuatoriana inválida');
const identificacion = z
  .string()
  .trim()
  .refine((v) => cedulaValida(v) || (/^\d{13}$/.test(v) && v.endsWith('001')), 'Cédula o RUC inválido');

const paginacion = {
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
};

// ---------- Auth ----------
const login = z.object({ email, password: z.string().min(1, 'Ingrese su contraseña') });
const olvidePassword = z.object({ email });
const restablecerPassword = z.object({ token: z.string().length(64, 'Token inválido'), password });
const cambiarPassword = z.object({ actual: z.string().min(1, 'Ingrese su contraseña actual'), nueva: password });

// ---------- Solicitudes ----------
const crearSolicitud = z.object({
  cliente_id: idOpcional,
  sede_id: id,
  categoria_id: id,
  prioridad_id: id,
  titulo: texto(5, 150),
  descripcion: texto(10, 4000),
  equipo_afectado: texto(2, 150),
});

const listarSolicitudes = z.object({
  ...paginacion,
  estado: listaCsv(Object.values(ESTADOS)).optional(),
  prioridad: listaCsv(['BAJA', 'MEDIA', 'ALTA', 'CRITICA']).optional(),
  categoria_id: idOpcional,
  sede_id: idOpcional,
  cliente_id: idOpcional,
  tecnico_id: idOpcional,
  desde: fecha.optional(),
  hasta: fecha.optional(),
  q: z.string().trim().max(100).optional(),
  vencimiento: z.enum(['vencida', 'por_vencer']).optional(),
  orden: z.enum(['recientes', 'antiguas', 'vencimiento', 'prioridad']).optional(),
});

const cambiarEstado = z.object({
  estado: z.enum(Object.values(ESTADOS), { errorMap: () => ({ message: 'Estado inválido' }) }),
  comentario: z.string().trim().max(2000).optional(),
  resolucion: z.string().trim().max(4000).optional(),
  prioridad_id: idOpcional,
  version: z.number().int().positive().optional(),
});

const asignar = z.object({
  tecnico_id: id,
  motivo: z.string().trim().max(500).optional(),
});

const reabrir = z.object({ motivo: texto(10, 500) });
const comentario = z.object({ comentario: texto(2, 2000) });

// ---------- Catálogos ----------
const especialidad = z.object({
  nombre: texto(3, 80),
  descripcion: z.string().trim().max(255).optional(),
  activo: z.boolean().optional(),
});

const categoria = z.object({
  nombre: texto(3, 80),
  descripcion: z.string().trim().max(255).optional(),
  especialidad_id: id,
  activo: z.boolean().optional(),
});

const prioridad = z.object({
  nombre: texto(3, 40).optional(),
  horas_plazo: z.number().int().min(1).max(720).optional(),
});

const parametro = z.object({ valor: z.union([z.string().trim().min(1).max(255), z.number()]) });

// ---------- Clientes ----------
const sede = z.object({ nombre: texto(2, 100), direccion: texto(5, 255), activo: z.boolean().optional() });

const cliente = z.object({
  identificacion,
  razon_social: texto(3, 150),
  email,
  telefono,
  direccion: z.string().trim().max(255).optional(),
  activo: z.boolean().optional(),
  sedes: z.array(sede.omit({ activo: true })).max(20).optional(),
  cuenta: z.object({ email, password }).optional(),
});

const clienteUpdate = cliente.omit({ sedes: true, cuenta: true }).partial();

// ---------- Técnicos ----------
const tecnico = z.object({
  nombre: texto(3, 120),
  email,
  password,
  cedula,
  telefono,
  max_solicitudes_activas: z.number().int().min(1).max(50).optional(),
  especialidades: z.array(id).min(1, 'Seleccione al menos una especialidad'),
});

const tecnicoUpdate = tecnico
  .omit({ password: true })
  .extend({ disponible: z.boolean(), activo: z.boolean() })
  .partial();

const disponibilidad = z.object({ disponible: z.boolean() });

// ---------- Usuarios ----------
const usuario = z.object({
  nombre: texto(3, 120),
  email,
  password,
  rol: z.enum([ROLES.ADMIN, ROLES.COORDINADOR]),
});
const usuarioUpdate = z.object({ nombre: texto(3, 120), email, activo: z.boolean() }).partial();
const resetAdmin = z.object({ password });

// ---------- Dashboard / listados ----------
const dashboard = z.object({
  desde: fecha.optional(),
  hasta: fecha.optional(),
  categoria_id: idOpcional,
  prioridad_id: idOpcional,
  cliente_id: idOpcional,
  tecnico_id: idOpcional,
});

const listadoGenerico = z.object({
  ...paginacion,
  q: z.string().trim().max(100).optional(),
  activo: booleanQuery.optional(),
  disponible: booleanQuery.optional(),
  especialidad_id: idOpcional,
  rol: z.enum(Object.values(ROLES)).optional(),
  entidad: z.string().max(50).optional(),
  usuario_id: idOpcional,
});

const paramsId = z.object({ id });

module.exports = {
  cedulaValida,
  login,
  olvidePassword,
  restablecerPassword,
  cambiarPassword,
  crearSolicitud,
  listarSolicitudes,
  cambiarEstado,
  asignar,
  reabrir,
  comentario,
  especialidad,
  especialidadUpdate: especialidad.partial(),
  categoria,
  categoriaUpdate: categoria.partial(),
  prioridad,
  parametro,
  cliente,
  clienteUpdate,
  sede,
  sedeUpdate: sede.partial(),
  tecnico,
  tecnicoUpdate,
  disponibilidad,
  usuario,
  usuarioUpdate,
  resetAdmin,
  dashboard,
  listadoGenerico,
  paramsId,
};
