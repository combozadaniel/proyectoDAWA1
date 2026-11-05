/**
 * Lógica de negocio del ciclo de vida de solicitudes.
 * Toda operación que modifica datos se ejecuta en una transacción con bloqueo de fila
 * (regla 8) y deja rastro en el historial inalterable (regla 7).
 */
const fs = require('fs');
const { withTransaction } = require('../config/db');
const AppError = require('../utils/AppError');
const { paginacion, respuestaPaginada } = require('../utils/http');
const repo = require('../repositories/solicitudes.repository');
const catalogosRepo = require('../repositories/catalogos.repository');
const clientesRepo = require('../repositories/clientes.repository');
const tecnicosRepo = require('../repositories/tecnicos.repository');
const auditoriaRepo = require('../repositories/auditoria.repository');
const notif = require('./notificaciones.service');
const { ROLES, GESTION } = require('../domain/roles');
const {
  ESTADOS,
  ESTADOS_FINALES,
  validarTransicion,
  validarCierre,
  validarReapertura,
  transicionesDisponibles,
} = require('../domain/estados');
const { calcularFechaLimite, estadoPlazo, horasRestantes } = require('../domain/sla');
const { validarAsignacion, motivosNoElegible, ordenarCandidatos } = require('../domain/asignacion');
const { puedeVerSolicitud, puedeModificarSolicitud, alcancePorRol } = require('../domain/politicas');
const { rutaAdjunto } = require('../middlewares/upload');

async function umbralPorVencer() {
  return Number(await catalogosRepo.obtenerParametro('UMBRAL_POR_VENCER_PCT', '75'));
}

function conPlazo(s, umbral) {
  return { ...s, estado_plazo: estadoPlazo(s, umbral), horas_restantes: horasRestantes(s.fecha_limite) };
}

/** Carga la solicitud o lanza 404; si el usuario no puede verla también responde 404 (no revela existencia). */
async function cargarVisible(usuario, id, client) {
  const s = client ? await repo.obtenerParaActualizar(id, client) : await repo.obtener(id);
  if (!s || !puedeVerSolicitud(usuario, s)) throw AppError.notFound('Solicitud');
  return s;
}

/** Usuario (id de usuarios) del cliente y del técnico de una solicitud. */
async function involucrados(s, client) {
  const cliente = await clientesRepo.obtener(s.cliente_id, client);
  const tecnico = s.tecnico_id ? await tecnicosRepo.obtener(s.tecnico_id, client) : null;
  return { clienteUsuarioId: cliente?.usuario_id ?? null, tecnicoUsuarioId: tecnico?.usuario_id ?? null };
}

// ---------------------------------------------------------------------
// Consultas
// ---------------------------------------------------------------------
async function listar(usuario, filtros) {
  const pag = paginacion(filtros);
  const umbral = await umbralPorVencer();
  const { rows, total } = await repo.listar({ ...filtros, ...alcancePorRol(usuario) }, pag, umbral);
  return respuestaPaginada(
    rows.map((s) => conPlazo(s, umbral)),
    total,
    pag,
  );
}

async function obtenerDetalle(usuario, id) {
  const s = await cargarVisible(usuario, id);
  const umbral = await umbralPorVencer();
  const [adjuntos, asignaciones] = await Promise.all([repo.listarAdjuntos(id), repo.listarAsignaciones(id)]);
  const puedeModificar = puedeModificarSolicitud(usuario, s);
  return {
    ...conPlazo(s, umbral),
    adjuntos,
    asignaciones,
    acciones: {
      transiciones: puedeModificar ? transicionesDisponibles(s.estado, usuario.rol) : [],
      puedeAsignar:
        GESTION.includes(usuario.rol) &&
        [ESTADOS.APROBADA, ESTADOS.ASIGNADA, ESTADOS.EN_PROCESO, ESTADOS.PENDIENTE_INFO].includes(s.estado),
      puedeReabrir: GESTION.includes(usuario.rol) && s.estado === ESTADOS.CERRADA,
      puedeComentar: !ESTADOS_FINALES.includes(s.estado),
      puedeAdjuntar: puedeModificar && !ESTADOS_FINALES.includes(s.estado),
    },
  };
}

async function historial(usuario, id) {
  await cargarVisible(usuario, id);
  return repo.listarHistorial(id);
}

// ---------------------------------------------------------------------
// Registro
// ---------------------------------------------------------------------
async function crear(usuario, datos, archivos = []) {
  let clienteId;
  if (usuario.rol === ROLES.CLIENTE) {
    if (!usuario.clienteId) throw AppError.forbidden('Su usuario no está vinculado a un cliente');
    clienteId = usuario.clienteId;
  } else if (GESTION.includes(usuario.rol)) {
    if (!datos.cliente_id) throw AppError.validation([{ campo: 'cliente_id', mensaje: 'El cliente es obligatorio' }]);
    clienteId = datos.cliente_id;
  } else {
    throw AppError.forbidden('Los técnicos no registran solicitudes');
  }

  let emitir;
  const creada = await withTransaction(async (client) => {
    const cliente = await clientesRepo.obtener(clienteId, client);
    if (!cliente || !cliente.activo) throw AppError.businessRule('El cliente no existe o está inactivo');

    const sede = await clientesRepo.obtenerSede(datos.sede_id, client);
    if (!sede || sede.cliente_id !== clienteId || !sede.activo) {
      throw AppError.businessRule('La sede no pertenece al cliente o está inactiva');
    }
    const categoria = await catalogosRepo.obtenerCategoria(datos.categoria_id, client);
    if (!categoria || !categoria.activo) throw AppError.businessRule('La categoría no existe o está inactiva');

    const prioridad = await catalogosRepo.obtenerPrioridad(datos.prioridad_id, client);
    if (!prioridad) throw AppError.businessRule('La prioridad no existe');

    const estado = await catalogosRepo.obtenerEstadoPorCodigo(ESTADOS.REGISTRADA, client);
    const ahora = new Date();
    const id = await repo.crear(
      {
        codigo: await repo.siguienteCodigo(client),
        cliente_id: clienteId,
        sede_id: sede.id,
        categoria_id: categoria.id,
        prioridad_id: prioridad.id,
        estado_id: estado.id,
        titulo: datos.titulo,
        descripcion: datos.descripcion,
        equipo_afectado: datos.equipo_afectado,
        fecha_limite: calcularFechaLimite(ahora, prioridad.horas_plazo),
        creado_por: usuario.id,
        created_at: ahora,
      },
      client,
    );

    await repo.registrarHistorial(
      {
        solicitudId: id,
        usuarioId: usuario.id,
        accion: 'CREACION',
        estadoNuevoId: estado.id,
        detalle: { prioridad_solicitada: prioridad.codigo, categoria: categoria.nombre },
      },
      client,
    );

    for (const archivo of archivos) {
      await repo.crearAdjunto(
        {
          solicitudId: id,
          nombreOriginal: archivo.originalname,
          nombreArchivo: archivo.filename,
          mimeType: archivo.mimetype,
          tamano: archivo.size,
          subidoPor: usuario.id,
        },
        client,
      );
    }

    const s = await repo.obtener(id, client);
    emitir = await notif.notificar(
      [...(await notif.gestores(client)), cliente.usuario_id],
      {
        tipo: notif.TIPOS.REGISTRO,
        titulo: `Nueva solicitud ${s.codigo}`,
        mensaje: `${cliente.razon_social} registró "${s.titulo}" (prioridad ${prioridad.nombre}).`,
        solicitudId: id,
      },
      client,
      usuario.id,
    );
    return s;
  }).catch((err) => {
    eliminarArchivos(archivos);
    throw err;
  });

  emitir();
  notif.emitirCambioSolicitud(creada, 'CREACION');
  return conPlazo(creada, await umbralPorVencer());
}

function eliminarArchivos(archivos) {
  for (const a of archivos) fs.rm(a.path, { force: true }, () => {});
}

// ---------------------------------------------------------------------
// Cambio de estado
// ---------------------------------------------------------------------
async function cambiarEstado(usuario, id, { estado: destino, comentario, resolucion, prioridad_id, version }) {
  let emitir;
  let interesados;
  const actualizada = await withTransaction(async (client) => {
    const s = await cargarVisible(usuario, id, client);
    if (!puedeModificarSolicitud(usuario, s)) {
      throw AppError.forbidden('Solo puede modificar solicitudes asignadas a su cargo');
    }
    if (version != null && version !== s.version) {
      throw AppError.conflict('La solicitud fue modificada por otro usuario. Recargue e intente de nuevo.', {
        versionActual: s.version,
      });
    }
    validarTransicion({ origen: s.estado, destino, rol: usuario.rol, resolucion, comentario });

    const estadoNuevo = await catalogosRepo.obtenerEstadoPorCodigo(destino, client);
    const estadoAnterior = await catalogosRepo.obtenerEstadoPorCodigo(s.estado, client);
    const campos = { estado_id: estadoNuevo.id };
    const detalle = {};

    if (destino === ESTADOS.APROBADA && prioridad_id && prioridad_id !== s.prioridad_id) {
      // El coordinador puede ajustar la prioridad al aprobar: el plazo se recalcula desde el registro.
      const prioridad = await catalogosRepo.obtenerPrioridad(prioridad_id, client);
      if (!prioridad) throw AppError.businessRule('La prioridad indicada no existe');
      campos.prioridad_id = prioridad.id;
      campos.fecha_limite = calcularFechaLimite(s.created_at, prioridad.horas_plazo);
      detalle.prioridad = { anterior: s.prioridad, nueva: prioridad.codigo };
    }
    if (destino === ESTADOS.RESUELTA) {
      campos.resolucion = resolucion.trim();
      campos.fecha_resolucion = new Date();
    }
    if (s.estado === ESTADOS.RESUELTA && destino === ESTADOS.EN_PROCESO) {
      // Resolución rechazada: el plazo vuelve a evaluarse cuando se resuelva nuevamente.
      campos.fecha_resolucion = null;
      detalle.rechazo = true;
    }
    if (destino === ESTADOS.CERRADA) {
      validarCierre(s);
      campos.fecha_cierre = new Date();
    }
    if (destino === ESTADOS.CANCELADA && s.tecnico_id) {
      await repo.cerrarAsignacionActiva(id, client);
    }

    await repo.actualizarCampos(id, campos, client);
    await repo.registrarHistorial(
      {
        solicitudId: id,
        usuarioId: usuario.id,
        accion: 'CAMBIO_ESTADO',
        estadoAnteriorId: estadoAnterior.id,
        estadoNuevoId: estadoNuevo.id,
        comentario: destino === ESTADOS.RESUELTA ? resolucion.trim() : comentario,
        detalle: Object.keys(detalle).length ? detalle : null,
      },
      client,
    );

    const nueva = await repo.obtener(id, client);
    const { clienteUsuarioId, tecnicoUsuarioId } = await involucrados(nueva, client);
    interesados = [clienteUsuarioId, tecnicoUsuarioId];
    const { tipo, destinatarios } = destinatariosCambio(destino, {
      clienteUsuarioId,
      tecnicoUsuarioId,
      gestores: await notif.gestores(client),
    });
    emitir = await notif.notificar(
      destinatarios,
      {
        tipo,
        titulo: `${nueva.codigo}: ${nueva.estado_nombre}`,
        mensaje:
          destino === ESTADOS.PENDIENTE_INFO
            ? `Se requiere información adicional: ${comentario}`
            : `La solicitud "${nueva.titulo}" cambió de ${estadoAnterior.nombre} a ${estadoNuevo.nombre}.`,
        solicitudId: id,
      },
      client,
      usuario.id,
    );
    return nueva;
  });

  emitir();
  notif.emitirCambioSolicitud(actualizada, 'CAMBIO_ESTADO', interesados);
  return conPlazo(actualizada, await umbralPorVencer());
}

function destinatariosCambio(destino, { clienteUsuarioId, tecnicoUsuarioId, gestores }) {
  switch (destino) {
    case ESTADOS.PENDIENTE_INFO:
      return { tipo: notif.TIPOS.SOLICITUD_INFO, destinatarios: [clienteUsuarioId] };
    case ESTADOS.CERRADA:
      return { tipo: notif.TIPOS.CIERRE, destinatarios: [clienteUsuarioId, tecnicoUsuarioId] };
    case ESTADOS.RESUELTA:
      return { tipo: notif.TIPOS.CAMBIO_ESTADO, destinatarios: [clienteUsuarioId, ...gestores] };
    default:
      return { tipo: notif.TIPOS.CAMBIO_ESTADO, destinatarios: [clienteUsuarioId, tecnicoUsuarioId, ...gestores] };
  }
}

// ---------------------------------------------------------------------
// Asignación / reasignación
// ---------------------------------------------------------------------
async function asignar(usuario, id, { tecnico_id: tecnicoId, motivo }) {
  let emitir;
  let interesados;
  const actualizada = await withTransaction(async (client) => {
    const s = await repo.obtenerParaActualizar(id, client);
    if (!s) throw AppError.notFound('Solicitud');
    const tecnico = await tecnicosRepo.obtenerParaAsignar(tecnicoId, client);
    if (!tecnico) throw AppError.notFound('Técnico');
    if (!tecnico.usuario_activo) throw AppError.businessRule('El usuario del técnico está inactivo');

    const { esReasignacion } = validarAsignacion({
      solicitud: s,
      tecnico,
      especialidadRequeridaId: s.especialidad_id,
      motivo,
    });

    const anterior = esReasignacion ? await repo.cerrarAsignacionActiva(id, client) : null;
    const tecnicoAnterior = anterior ? await tecnicosRepo.obtener(anterior.tecnico_id, client) : null;
    await repo.crearAsignacion({ solicitudId: id, tecnicoId, asignadoPor: usuario.id, motivo }, client);

    const estadoAsignada = await catalogosRepo.obtenerEstadoPorCodigo(ESTADOS.ASIGNADA, client);
    const estadoAnterior = await catalogosRepo.obtenerEstadoPorCodigo(s.estado, client);
    await repo.actualizarCampos(id, { tecnico_id: tecnicoId, estado_id: estadoAsignada.id }, client);
    await repo.registrarHistorial(
      {
        solicitudId: id,
        usuarioId: usuario.id,
        accion: esReasignacion ? 'REASIGNACION' : 'ASIGNACION',
        estadoAnteriorId: estadoAnterior.id,
        estadoNuevoId: estadoAsignada.id,
        comentario: motivo || null,
        detalle: {
          tecnico: { id: tecnico.id, nombre: tecnico.nombre },
          tecnico_anterior: tecnicoAnterior ? { id: tecnicoAnterior.id, nombre: tecnicoAnterior.nombre } : null,
          carga_al_asignar: `${tecnico.carga_actual + 1}/${tecnico.max_solicitudes_activas}`,
        },
      },
      client,
    );

    const nueva = await repo.obtener(id, client);
    const { clienteUsuarioId } = await involucrados(nueva, client);
    interesados = [clienteUsuarioId, tecnico.usuario_id, tecnicoAnterior?.usuario_id];

    const e1 = await notif.notificar(
      [tecnico.usuario_id],
      {
        tipo: notif.TIPOS.ASIGNACION,
        titulo: `Se le asignó ${nueva.codigo}`,
        mensaje: `"${nueva.titulo}" — prioridad ${nueva.prioridad_nombre}, vence ${new Date(nueva.fecha_limite).toLocaleString('es-EC')}.`,
        solicitudId: id,
      },
      client,
    );
    const e2 = await notif.notificar(
      [clienteUsuarioId],
      {
        tipo: notif.TIPOS.ASIGNACION,
        titulo: `${nueva.codigo}: técnico asignado`,
        mensaje: `${tecnico.nombre} atenderá su solicitud "${nueva.titulo}".`,
        solicitudId: id,
      },
      client,
    );
    const e3 = tecnicoAnterior
      ? await notif.notificar(
          [tecnicoAnterior.usuario_id],
          {
            tipo: notif.TIPOS.ASIGNACION,
            titulo: `${nueva.codigo} fue reasignada`,
            mensaje: `La solicitud se reasignó a ${tecnico.nombre}. Motivo: ${motivo}`,
            solicitudId: id,
          },
          client,
        )
      : () => {};
    emitir = () => {
      e1();
      e2();
      e3();
    };
    return nueva;
  });

  emitir();
  notif.emitirCambioSolicitud(actualizada, 'ASIGNACION', interesados);
  return conPlazo(actualizada, await umbralPorVencer());
}

/** Técnicos con la especialidad requerida, indicando elegibilidad y motivos (ordenados por carga). */
async function tecnicosSugeridos(id) {
  const s = await repo.obtener(id);
  if (!s) throw AppError.notFound('Solicitud');
  const tecnicos = await tecnicosRepo.listarPorEspecialidad(s.especialidad_id);
  return ordenarCandidatos(tecnicos).map((t) => {
    const motivos = motivosNoElegible(t, s.especialidad_id);
    return {
      id: t.id,
      nombre: t.nombre,
      disponible: t.disponible,
      carga_actual: t.carga_actual,
      max_solicitudes_activas: t.max_solicitudes_activas,
      especialidades: t.especialidades,
      es_actual: t.id === s.tecnico_id,
      elegible: motivos.length === 0 && t.id !== s.tecnico_id,
      motivos,
    };
  });
}

// ---------------------------------------------------------------------
// Reapertura (regla 4)
// ---------------------------------------------------------------------
async function reabrir(usuario, id, { motivo }, ip) {
  let emitir;
  let interesados;
  const actualizada = await withTransaction(async (client) => {
    const s = await repo.obtenerParaActualizar(id, client);
    if (!s) throw AppError.notFound('Solicitud');
    validarReapertura({ estadoActual: s.estado, rol: usuario.rol, motivo });

    const destino = s.tecnico_id ? ESTADOS.ASIGNADA : ESTADOS.APROBADA;
    const estadoNuevo = await catalogosRepo.obtenerEstadoPorCodigo(destino, client);
    const estadoAnterior = await catalogosRepo.obtenerEstadoPorCodigo(s.estado, client);

    await repo.actualizarCampos(
      id,
      { estado_id: estadoNuevo.id, fecha_cierre: null, fecha_resolucion: null },
      client,
    );
    await repo.registrarHistorial(
      {
        solicitudId: id,
        usuarioId: usuario.id,
        accion: 'REAPERTURA',
        estadoAnteriorId: estadoAnterior.id,
        estadoNuevoId: estadoNuevo.id,
        comentario: motivo,
        detalle: { resolucion_previa: s.resolucion, fecha_cierre_previa: s.fecha_cierre },
      },
      client,
    );
    await auditoriaRepo.registrar(
      {
        usuarioId: usuario.id,
        entidad: 'solicitud',
        entidadId: id,
        accion: 'REAPERTURA',
        antes: { estado: s.estado, fecha_cierre: s.fecha_cierre },
        despues: { estado: destino, motivo },
        ip,
      },
      client,
    );

    const nueva = await repo.obtener(id, client);
    const { clienteUsuarioId, tecnicoUsuarioId } = await involucrados(nueva, client);
    interesados = [clienteUsuarioId, tecnicoUsuarioId];
    emitir = await notif.notificar(
      [clienteUsuarioId, tecnicoUsuarioId],
      {
        tipo: notif.TIPOS.REAPERTURA,
        titulo: `${nueva.codigo} fue reabierta`,
        mensaje: `Motivo: ${motivo}`,
        solicitudId: id,
      },
      client,
      usuario.id,
    );
    return nueva;
  });
  emitir();
  notif.emitirCambioSolicitud(actualizada, 'REAPERTURA', interesados);
  return conPlazo(actualizada, await umbralPorVencer());
}

// ---------------------------------------------------------------------
// Comentarios y adjuntos
// ---------------------------------------------------------------------
async function comentar(usuario, id, { comentario }) {
  let emitir;
  const s = await withTransaction(async (client) => {
    const sol = await cargarVisible(usuario, id, client);
    if (ESTADOS_FINALES.includes(sol.estado)) {
      throw AppError.businessRule('No se puede comentar una solicitud cerrada o cancelada');
    }
    await repo.registrarHistorial(
      { solicitudId: id, usuarioId: usuario.id, accion: 'COMENTARIO', comentario },
      client,
    );
    const { clienteUsuarioId, tecnicoUsuarioId } = await involucrados(sol, client);
    const respuestaCliente = usuario.rol === ROLES.CLIENTE && sol.estado === ESTADOS.PENDIENTE_INFO;
    emitir = await notif.notificar(
      [clienteUsuarioId, tecnicoUsuarioId, ...(sol.tecnico_id ? [] : await notif.gestores(client))],
      {
        tipo: notif.TIPOS.COMENTARIO,
        titulo: respuestaCliente ? `${sol.codigo}: el cliente respondió` : `${sol.codigo}: nuevo comentario`,
        mensaje: `${usuario.nombre}: ${comentario.slice(0, 200)}`,
        solicitudId: id,
      },
      client,
      usuario.id,
    );
    return sol;
  });
  emitir();
  notif.emitirCambioSolicitud(s, 'COMENTARIO');
  return repo.listarHistorial(id);
}

async function agregarAdjuntos(usuario, id, archivos) {
  if (!archivos?.length) throw AppError.badRequest('Debe adjuntar al menos un archivo');
  try {
    return await withTransaction(async (client) => {
      const s = await cargarVisible(usuario, id, client);
      if (!puedeModificarSolicitud(usuario, s) || ESTADOS_FINALES.includes(s.estado)) {
        throw AppError.forbidden('No puede adjuntar archivos a esta solicitud');
      }
      const creados = [];
      for (const archivo of archivos) {
        creados.push(
          await repo.crearAdjunto(
            {
              solicitudId: id,
              nombreOriginal: archivo.originalname,
              nombreArchivo: archivo.filename,
              mimeType: archivo.mimetype,
              tamano: archivo.size,
              subidoPor: usuario.id,
            },
            client,
          ),
        );
      }
      await repo.registrarHistorial(
        {
          solicitudId: id,
          usuarioId: usuario.id,
          accion: 'ADJUNTO',
          detalle: { archivos: creados.map((c) => c.nombre_original) },
        },
        client,
      );
      return creados;
    });
  } catch (err) {
    eliminarArchivos(archivos);
    throw err;
  }
}

async function obtenerAdjunto(usuario, id, adjuntoId) {
  await cargarVisible(usuario, id);
  const adj = await repo.obtenerAdjunto(id, adjuntoId);
  if (!adj) throw AppError.notFound('Adjunto');
  return { ...adj, ruta: rutaAdjunto(adj.nombre_archivo) };
}

module.exports = {
  listar,
  obtenerDetalle,
  historial,
  crear,
  cambiarEstado,
  asignar,
  tecnicosSugeridos,
  reabrir,
  comentar,
  agregarAdjuntos,
  obtenerAdjunto,
};
