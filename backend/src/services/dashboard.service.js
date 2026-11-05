const repo = require('../repositories/dashboard.repository');
const catalogosRepo = require('../repositories/catalogos.repository');
const { alcancePorRol } = require('../domain/politicas');
const { porcentajeCumplimiento } = require('../domain/sla');
const { ROLES } = require('../domain/roles');

function fechaISO(d) {
  return d.toISOString().slice(0, 10);
}

/**
 * Indicadores del dashboard. El alcance depende del rol:
 *  - ADMIN / COORDINADOR: toda la operación (pueden filtrar por cliente o técnico).
 *  - TECNICO: solo sus solicitudes. CLIENTE: solo las de su empresa.
 */
async function indicadores(usuario, filtros) {
  const hoy = new Date();
  const hace30 = new Date(hoy.getTime() - 29 * 24 * 3600 * 1000);
  const f = {
    desde: filtros.desde || fechaISO(hace30),
    hasta: filtros.hasta || fechaISO(hoy),
    categoria_id: filtros.categoria_id,
    prioridad_id: filtros.prioridad_id,
    clienteId: filtros.cliente_id,
    tecnicoId: filtros.tecnico_id,
    ...alcancePorRol(usuario),
  };
  const umbral = Number(await catalogosRepo.obtenerParametro('UMBRAL_POR_VENCER_PCT', '75'));

  const [resumen, porEstado, porPrioridad, carga, tiempos, cumpl, venc, evolucion] = await Promise.all([
    repo.resumen(f),
    repo.porEstado(f),
    repo.porPrioridad(f),
    usuario.rol === ROLES.CLIENTE ? Promise.resolve([]) : repo.cargaPorTecnico(f),
    repo.tiemposResolucion(f),
    repo.cumplimiento(f),
    repo.vencimientos(f, umbral),
    repo.evolucion(f),
  ]);

  return {
    filtros: { desde: f.desde, hasta: f.hasta, umbralPorVencerPct: umbral },
    resumen,
    porEstado,
    porPrioridad,
    cargaPorTecnico: carga,
    tiempoResolucion: tiempos,
    cumplimiento: {
      aTiempo: cumpl.a_tiempo,
      fueraDePlazo: cumpl.fuera_de_plazo,
      porcentaje: porcentajeCumplimiento(cumpl.a_tiempo, cumpl.fuera_de_plazo),
    },
    vencimientos: venc,
    evolucion,
  };
}

module.exports = { indicadores };
