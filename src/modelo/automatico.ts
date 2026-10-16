// Cuando llega una liquidación nueva (la auditoría carga el PDF), el mes se arma solo:
// se aplican las reglas permanentes del barrio y las automáticas (una obra va al fondo extraordinario).
// Queda marcado como PRELIMINAR con la lista de lo que falta revisar.

import type { Datos } from '../data/types';
import type { ConfigBarrio, ConfigPeriodo, Criterio } from './tipos';
import { gastosDe, periodosDe } from './modelo';

export function configAutomatica(datos: Datos, cfg: ConfigBarrio, idPeriodo: string): ConfigPeriodo {
  const gastos = gastosDe(datos, idPeriodo);
  const criterios: Criterio[] = [];
  const pendientes: string[] = [];
  const conRegla = new Set<string>();

  for (const r of cfg.reglas ?? []) {
    const gs = gastos.filter((g) => g.Concepto_Normalizado === r.concepto);
    if (!gs.length) continue;
    conRegla.add(r.concepto);
    for (const g of gs) {
      const c: Criterio = { id: gs.length > 1 ? `${r.id}-${g.ID_Gasto.slice(-3)}` : r.id, hallazgos: r.hallazgos, titulo: r.titulo, texto: r.texto, activo: r.activo, tipo: r.tipo, gasto: g.ID_Gasto };
      if (r.tipo === 'FACTURA') {
        const fs = [...new Map(datos.sheets.COMPROBANTES.filter((x) => x.ID_Gasto === g.ID_Gasto && x.Tipo === 'FACTURA' && x.Importe !== '' && x.Numero).map((x) => [x.Numero, x])).values()];
        if (fs.length !== 1) {
          pendientes.push(`${r.concepto}: ${fs.length ? 'hay más de una factura' : 'falta la factura'}; se deja el importe liquidado.`);
          continue;
        }
        c.comprobante = fs[0].ID_Comprobante;
      }
      if (r.tipo === 'QUITAR') {
        c.gastos = [g.ID_Gasto];
        delete c.gasto;
      }
      if (r.importe) c.importe = r.importe;
      if (r.fuente) c.fuente = r.fuente;
      if (r.fondo) c.fondo = r.fondo;
      criterios.push(c);
    }
  }

  // Automáticas: una obra no es gasto ordinario.
  for (const g of gastos.filter((x) => x.Tipo_Gasto === 'OBRA' && !conRegla.has(x.Concepto_Normalizado))) {
    criterios.push({
      id: `OBRA-${g.ID_Gasto.slice(-3)}`,
      hallazgos: ['H30'],
      titulo: `${g.Concepto_Normalizado} al fondo extraordinario`,
      texto: 'Una obra no es gasto del mes: la paga el fondo extraordinario.',
      activo: true,
      tipo: 'A_EXTRAORDINARIO',
      gasto: g.ID_Gasto,
      fondo: 'EXTRAORDINARIO',
    });
  }

  if (gastos.some((g) => /^Mantenimiento Fideicomiso/.test(g.Concepto_Normalizado)))
    pendientes.push('Mantenimiento del Fideicomiso: cargar la base (órdenes de pago) para sacar lo que no corresponde y aplicar el coeficiente publicado.');
  if (gastos.some((g) => g.Concepto_Normalizado === 'Electricidad sectores comunes - Fideicomiso'))
    pendientes.push('Luz de sectores comunes del Fideicomiso: definir qué facturas entran en el reparto.');
  const previos = new Set(
    periodosDe(datos, cfg.barrio)
      .filter((p) => p.ID_Periodo < idPeriodo)
      .flatMap((p) => gastosDe(datos, p.ID_Periodo).map((g) => g.Concepto_Normalizado)),
  );
  for (const g of gastos) if (!previos.has(g.Concepto_Normalizado) && g.Tipo_Gasto !== 'OBRA') pendientes.push(`Concepto nuevo: ${g.Concepto_Normalizado}. Revisar si corresponde y escribir el por qué.`);
  pendientes.push('Deudas, créditos y comentarios del mes: cargarlos en la planilla.');

  return { criterios, deudas: [], creditos: [], novedades: [], comentarios: {}, notas: {}, automatico: true, pendientes };
}

/** Agrega los meses nuevos (posteriores al último revisado) armados automáticamente. */
export function conAutomaticos(datos: Datos, cfg: ConfigBarrio): ConfigBarrio {
  const revisados = Object.keys(cfg.periodos).sort();
  const ultimo = revisados[revisados.length - 1];
  if (!ultimo) return cfg;
  const nuevos = periodosDe(datos, cfg.barrio).filter((p) => p.ID_Periodo > ultimo && !cfg.periodos[p.ID_Periodo]);
  if (!nuevos.length) return cfg;
  return { ...cfg, periodos: { ...cfg.periodos, ...Object.fromEntries(nuevos.map((p) => [p.ID_Periodo, configAutomatica(datos, cfg, p.ID_Periodo)])) } };
}
