// Historial, variaciones por concepto y novedades automáticas.

import type { Datos } from '../data/types';
import { cents, ratioOf, ratio, type Cents, type Ratio } from '../lib/money';
import type { ConfigBarrio } from './tipos';
import { calcularModelo, gastosDe, periodosDe } from './modelo';

export interface PuntoHistorial {
  idPeriodo: string;
  mes: string;
  gasto: Cents;
  repartido: Cents;
  loteOficial: Cents;
  loteModelo: Cents | null;
  ipc: Ratio | null; // variación mensual del IPC (INDEC), solo como referencia
  lotesConDeuda: number;
  lotes: number;
}

export function historial(datos: Datos, cfg: ConfigBarrio | null, barrio: string): PuntoHistorial[] {
  return periodosDe(datos, barrio).map((p) => {
    const m = cfg ? calcularModelo(datos, cfg, p.ID_Periodo) : null;
    const ind = datos.sheets.INDICES.find((i) => i.Mes === p.Mes);
    const v = ind?.IPC_Var_Mensual;
    return {
      idPeriodo: p.ID_Periodo,
      mes: p.Mes,
      gasto: cents(p.Total_Gastos_Periodo),
      repartido: cents(p.Base_Prorrateo_Ord),
      loteOficial: cents(p.Expensa_Ord_Lote_Tipo),
      loteModelo: m ? m.lotes[0].modelo : null,
      ipc: v === '' || v === null || v === undefined ? null : ratio(String(v)),
      lotesConDeuda: Number(p.Unidades_Con_Deuda) || 0,
      lotes: Number(p.Cantidad_Unidades) || 0,
    };
  });
}

export interface Variacion {
  concepto: string;
  actual: Cents;
  anterior: Cents | null; // null: no estaba el mes anterior
  diferencia: Cents | null;
  variacion: Ratio | null;
  nuevo: boolean; // nunca apareció antes en este barrio
}

/** Compara cada concepto (oficial) con el mes anterior del mismo barrio. */
export function variaciones(datos: Datos, barrio: string, idPeriodo: string): Variacion[] {
  const ps = periodosDe(datos, barrio);
  const i = ps.findIndex((p) => p.ID_Periodo === idPeriodo);
  if (i < 0) return [];
  const suma = (id: string) => {
    const m = new Map<string, Cents>();
    for (const g of gastosDe(datos, id)) m.set(g.Concepto_Normalizado, (m.get(g.Concepto_Normalizado) ?? 0) + cents(g.Importe));
    return m;
  };
  const act = suma(idPeriodo);
  const ant = i > 0 ? suma(ps[i - 1].ID_Periodo) : new Map<string, Cents>();
  const vistos = new Set<string>();
  for (const p of ps.slice(0, i)) gastosDe(datos, p.ID_Periodo).forEach((g) => vistos.add(g.Concepto_Normalizado));
  return [...act.entries()].map(([concepto, actual]) => {
    const anterior = ant.has(concepto) ? ant.get(concepto)! : null;
    return {
      concepto,
      actual,
      anterior,
      diferencia: anterior === null ? null : actual - anterior,
      variacion: anterior ? ratioOf(actual - anterior, anterior) : null,
      nuevo: i > 0 && !vistos.has(concepto),
    };
  });
}

/** Conceptos que aparecen por primera vez y conceptos que dejaron de aparecer. */
export function novedadesAutomaticas(datos: Datos, barrio: string, idPeriodo: string) {
  const vs = variaciones(datos, barrio, idPeriodo);
  const ps = periodosDe(datos, barrio);
  const i = ps.findIndex((p) => p.ID_Periodo === idPeriodo);
  const antes = i > 0 ? new Set(gastosDe(datos, ps[i - 1].ID_Periodo).map((g) => g.Concepto_Normalizado)) : new Set<string>();
  const ahora = new Set(vs.map((v) => v.concepto));
  return {
    nuevos: vs.filter((v) => v.nuevo),
    dejaron: i > 0 ? [...antes].filter((c) => !ahora.has(c)) : [],
  };
}
