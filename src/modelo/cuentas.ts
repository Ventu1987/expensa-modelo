// Estado de cuentas, fondos y morosidad de un período, con los datos oficiales.
// Solo se publican totales: nunca qué lotes deben ni cuánto debe cada uno.

import type { Datos, Fila } from '../data/types';
import { cents, ratioOf, type Cents, type Ratio } from '../lib/money';
import type { ConfigPeriodo } from './tipos';
import { gastosDe, periodoDe } from './modelo';

export interface Cuentas {
  saldoInicial: Cents;
  ingresos: { concepto: string; fondo: string; importe: Cents }[];
  ingresosTotal: Cents;
  egresos: { concepto: string; tipo: string; importe: Cents }[];
  egresosTotal: Cents; // negativo
  saldoFinal: Cents;
  fondos: { fondo: string; inicial: Cents; final: Cents }[];
  pendientesInformado: Cents;
  pendientesDetalle: Cents;
  pendientesLineas: { idGasto: string; concepto: string; importe: Cents }[];
  deudas: { concepto: string; importe: Cents | null; nota: string; tipo: string; hallazgo?: string }[];
  creditos: { concepto: string; importe: Cents | null; nota: string; tipo: string; hallazgo?: string }[];
  totalQueSeDebe: Cents; // pendientes del mes + deudas documentadas
  plataLibre: Cents;
  patrimonioInformado: Cents;
  patrimonioComponentes: { concepto: string; importe: Cents }[];
  patrimonioCalculado: Cents;
  morosidad: {
    lotesConDeuda: number;
    lotes: number;
    deuda: Cents;
    intereses: Cents;
    cobrosSinIdentificar: Cents;
    cobrosSinIdentificarCant: number;
  };
}

const n = (f: Fila, k: string) => cents(f[k] as number | string | null);

export function calcularCuentas(datos: Datos, idPeriodo: string, pc?: ConfigPeriodo): Cuentas | null {
  const p = periodoDe(datos, idPeriodo);
  if (!p) return null;
  const s = datos.sheets;
  const delPeriodo = <T extends Fila>(filas: T[]) => filas.filter((f) => f.ID_Periodo === idPeriodo);

  const ingresos = delPeriodo(s.INGRESOS).map((f) => ({ concepto: String(f.Origen || f.Concepto), fondo: String(f.Fondo), importe: n(f, 'Importe') }));
  const egresos = delPeriodo(s.EGRESOS_CAJA).map((f) => ({ concepto: String(f.Concepto), tipo: String(f.Tipo_Egreso), importe: n(f, 'Importe') }));
  const fondos = delPeriodo(s.FONDOS)
    .filter((f) => f.Fondo !== 'TOTAL')
    .map((f) => ({ fondo: String(f.Fondo), inicial: n(f, 'Saldo_Inicial'), final: n(f, 'Saldo_Final_Documento') }));

  const pendientesLineas = gastosDe(datos, idPeriodo)
    .filter((g) => g.Estado_Pago === 'PENDIENTE')
    .map((g) => ({ idGasto: g.ID_Gasto, concepto: g.Concepto_Normalizado, importe: cents(g.Importe) }));
  const pendientesDetalle = pendientesLineas.reduce((a, b) => a + b.importe, 0);

  const conv = (i: { concepto: string; importe: string | null; nota: string; tipo: string; hallazgo?: string }) => ({
    ...i,
    importe: i.importe === null ? null : cents(i.importe),
  });
  const deudas = (pc?.deudas ?? []).map(conv);
  const creditos = (pc?.creditos ?? []).map(conv);
  const deudasConImporte = deudas.reduce((a, d) => a + (d.importe ?? 0), 0);

  const saldos = delPeriodo(s.SALDOS_PATRIMONIO);
  const ep = saldos.filter((f) => f.Bloque === 'ESTADO_PATRIMONIAL');
  const patrimonioFila = ep.find((f) => /^Patrimonio neto/i.test(String(f.Concepto)));
  const patrimonioComponentes = ep.filter((f) => f !== patrimonioFila).map((f) => ({ concepto: String(f.Concepto), importe: n(f, 'Importe') }));
  const buscar = (re: RegExp) => n(ep.find((f) => re.test(String(f.Concepto))) ?? {}, 'Importe');
  const cobros = saldos.filter((f) => f.Bloque === 'COBROS_NO_IDENTIFICADOS');

  const saldoFinal = cents(p.Saldo_Final);
  const totalQueSeDebe = pendientesDetalle + deudasConImporte;
  return {
    saldoInicial: cents(p.Saldo_Inicial),
    ingresos,
    ingresosTotal: cents(p.Ingresos),
    egresos,
    egresosTotal: cents(p.Egresos_Caja),
    saldoFinal,
    fondos,
    pendientesInformado: cents(p.Gastos_Pendientes_Pago),
    pendientesDetalle,
    pendientesLineas,
    deudas,
    creditos,
    totalQueSeDebe,
    plataLibre: saldoFinal - totalQueSeDebe,
    patrimonioInformado: cents(p.Patrimonio_Neto),
    patrimonioComponentes,
    patrimonioCalculado: patrimonioComponentes.reduce((a, c) => a + c.importe, 0),
    morosidad: {
      lotesConDeuda: Number(p.Unidades_Con_Deuda) || 0,
      lotes: Number(p.Cantidad_Unidades) || 0,
      deuda: buscar(/^Deudas a cobrar/i),
      intereses: buscar(/^Intereses a cobrar/i),
      cobrosSinIdentificar: cobros.reduce((a, f) => a + n(f, 'Importe'), 0),
      cobrosSinIdentificarCant: cobros.length,
    },
  };
}

/** Cuántos meses de gasto representa un importe. */
export function enMeses(importe: Cents, gastoMensual: Cents): Ratio {
  return ratioOf(importe, gastoMensual || 1);
}
