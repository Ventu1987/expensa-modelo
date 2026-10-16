// Controles que deciden si la expensa modelo se puede publicar.
// Un control que no cierra bloquea la publicación hasta que se corrija
// o hasta que la administración lo aclare por escrito (hoja ESTADO_PUBLICACION).
// Son indicadores, no acusaciones.

import type { Datos } from '../data/types';
import { cents, type Cents } from '../lib/money';
import { mesAnterior, ultimoDia } from '../lib/fecha';
import type { Cuentas } from './cuentas';
import { gastosDe, periodoDe, type ResultadoModelo } from './modelo';

export type EstadoControl = 'OK' | 'REVISAR' | 'PROBLEMA' | 'N/D';

export interface Control {
  id: string;
  titulo: string;
  simple: string; // frase para cualquiera
  detalle: string; // cálculo para el auditor
  estado: EstadoControl;
  bloquea: boolean; // si no cierra, no se publica
  esperado: Cents | null;
  obtenido: Cents | null;
  diferencia: Cents | null;
  explicadoPor?: string; // cuando una deuda o crédito documentado explica la diferencia
  hallazgos: string[];
  filas?: { texto: string; importe: Cents | null; estado: EstadoControl }[];
}

function ctl(c: Omit<Control, 'diferencia'> & { diferencia?: Cents | null }): Control {
  const diferencia = c.diferencia !== undefined ? c.diferencia : c.esperado !== null && c.obtenido !== null ? c.obtenido - c.esperado : null;
  return { ...c, diferencia };
}

/** Último saldo de cada banco al cierre del mes anterior. N/D si ese banco no tuvo movimientos ese mes. */
export function saldosBancoAlInicio(datos: Datos, barrio: string, mes: string) {
  const prev = mesAnterior(mes);
  const cierre = ultimoDia(prev);
  const movs = datos.sheets.MOVIMIENTOS_BANCO.filter((m) => m.Barrio === barrio);
  const bancos = [...new Set(movs.map((m) => m.Banco))];
  return bancos.map((banco) => {
    const delMes = movs
      .map((m, i) => ({ m, i }))
      .filter(({ m }) => m.Banco === banco && m.Fecha.slice(0, 7) === prev && m.Fecha <= cierre && m.Saldo !== '' && m.Saldo !== null);
    if (!delMes.length) return { banco, saldo: null as Cents | null, fecha: null as string | null };
    delMes.sort((a, b) => (a.m.Fecha === b.m.Fecha ? a.i - b.i : a.m.Fecha.localeCompare(b.m.Fecha)));
    const u = delMes[delMes.length - 1].m;
    return { banco, saldo: cents(u.Saldo), fecha: u.Fecha };
  });
}

export function calcularControles(datos: Datos, idPeriodo: string, cuentas: Cuentas, modelo: ResultadoModelo | null): Control[] {
  const p = periodoDe(datos, idPeriodo)!;
  const out: Control[] = [];
  const gastos = gastosDe(datos, idPeriodo);

  // 1. Lo repartido es igual al gasto.
  if (modelo) {
    const repartido = modelo.lotes.reduce((s, l) => s + l.cantidad * l.modelo, 0) + modelo.redondeo;
    const lotesTot = modelo.lotes.reduce((s, l) => s + l.cantidad, 0);
    const ok = repartido === modelo.totalModelo && Math.abs(modelo.redondeo) <= lotesTot;
    out.push(
      ctl({
        id: 'REPARTO',
        titulo: 'Se reparte exactamente lo gastado',
        simple: ok ? 'Entre todos los lotes se paga lo que se gastó, ni un peso más.' : 'Lo repartido no coincide con lo gastado.',
        detalle: `Σ (lotes × expensa) + redondeo = ${repartido / 100} contra gasto modelo ${modelo.totalModelo / 100}. Redondeo ${modelo.redondeo / 100}. En la liquidación oficial: gasto ${modelo.gastoOficial / 100}, repartido ${modelo.repartidoOficial / 100} (H01).`,
        estado: ok ? 'OK' : 'PROBLEMA',
        bloquea: true,
        esperado: modelo.totalModelo,
        obtenido: repartido,
        hallazgos: ['H01'],
      }),
    );
  }

  // 2. Aritmética de la caja.
  const calc = cuentas.saldoInicial + cuentas.ingresosTotal + cuentas.egresosTotal;
  out.push(
    ctl({
      id: 'CAJA',
      titulo: 'La caja cierra',
      simple: calc === cuentas.saldoFinal ? 'Lo que había, más lo que entró, menos lo que salió, da lo que hay.' : 'La cuenta de la caja no da.',
      detalle: 'Saldo inicial + ingresos − egresos = saldo final.',
      estado: calc === cuentas.saldoFinal ? 'OK' : 'PROBLEMA',
      bloquea: true,
      esperado: cuentas.saldoFinal,
      obtenido: calc,
      hallazgos: [],
    }),
  );

  // 3. Saldo inicial contra el banco.
  const bancos = saldosBancoAlInicio(datos, p.Barrio, p.Mes);
  const faltan = bancos.filter((b) => b.saldo === null);
  const sumaBancos = bancos.reduce((s, b) => s + (b.saldo ?? 0), 0);
  const estadoBanco: EstadoControl = !bancos.length || faltan.length ? 'N/D' : sumaBancos === cuentas.saldoInicial ? 'OK' : 'PROBLEMA';
  out.push(
    ctl({
      id: 'BANCO',
      titulo: 'El saldo inicial es el del banco',
      simple:
        estadoBanco === 'OK'
          ? 'La plata con la que arranca el mes es la que mostraba el banco.'
          : estadoBanco === 'N/D'
            ? 'Faltan extractos para comparar con el banco.'
            : 'La plata con la que arranca el mes no es la que mostraba el banco.',
      detalle: `Último saldo de cada cuenta al ${ultimoDia(mesAnterior(p.Mes))}: ${bancos
        .map((b) => `${b.banco} ${b.saldo === null ? 'N/D' : b.saldo / 100}`)
        .join(' + ')}. Saldo inicial informado ${cuentas.saldoInicial / 100}.`,
      estado: estadoBanco,
      bloquea: true,
      esperado: estadoBanco === 'N/D' ? null : sumaBancos,
      obtenido: cuentas.saldoInicial,
      diferencia: estadoBanco === 'N/D' ? null : cuentas.saldoInicial - sumaBancos,
      hallazgos: ['H21', 'H18'],
      filas: bancos.map((b) => ({ texto: `${b.banco}${b.fecha ? ` al ${b.fecha}` : ''}`, importe: b.saldo, estado: b.saldo === null ? 'N/D' : 'OK' })),
    }),
  );

  // 4. Pendientes de pago: lo informado es la suma del detalle (más deudas documentadas).
  const difPend = cuentas.pendientesInformado - cuentas.pendientesDetalle;
  const deudaDoc = cuentas.deudas.reduce((s, d) => s + (d.importe ?? 0), 0);
  const explicaPend = difPend !== 0 && difPend === deudaDoc;
  const deudaSinImporte = cuentas.deudas.filter((d) => d.importe === null);
  out.push(
    ctl({
      id: 'PENDIENTES',
      titulo: 'Lo que se debe está detallado',
      simple:
        difPend === 0
          ? 'Cada peso que se debe tiene su gasto.'
          : explicaPend
            ? 'Lo que se debe tiene detalle: la diferencia es una deuda anterior que se muestra en su propia línea.'
            : 'Hay plata que se debe sin detalle.',
      detalle: `Pendientes informados ${cuentas.pendientesInformado / 100}; gastos PENDIENTE del mes ${cuentas.pendientesDetalle / 100}; diferencia ${difPend / 100}.${
        deudaSinImporte.length ? ` Además hay ${deudaSinImporte.length} deuda(s) sin importe informado (N/D).` : ''
      }`,
      estado: difPend === 0 || explicaPend ? (deudaSinImporte.length ? 'REVISAR' : 'OK') : 'PROBLEMA',
      bloquea: difPend !== 0 && !explicaPend,
      esperado: cuentas.pendientesDetalle,
      obtenido: cuentas.pendientesInformado,
      explicadoPor: explicaPend ? cuentas.deudas.map((d) => `${d.concepto}${d.hallazgo ? ` (${d.hallazgo})` : ''}`).join('; ') : undefined,
      hallazgos: ['H20', 'H11'],
    }),
  );

  // 5. Patrimonio = suma de sus partes.
  const difPat = cuentas.patrimonioInformado - cuentas.patrimonioCalculado;
  out.push(
    ctl({
      id: 'PATRIMONIO',
      titulo: 'El patrimonio es la suma de sus partes',
      simple: difPat === 0 ? 'Lo que tiene el barrio suma bien.' : 'El total de lo que tiene el barrio no es la suma de sus partes. Esta liquidación publica la suma.',
      detalle: `Informado ${cuentas.patrimonioInformado / 100}; suma de componentes ${cuentas.patrimonioCalculado / 100}.`,
      estado: difPat === 0 ? 'OK' : 'PROBLEMA',
      bloquea: true,
      esperado: cuentas.patrimonioCalculado,
      obtenido: cuentas.patrimonioInformado,
      hallazgos: ['H20'],
    }),
  );

  // 6. Egresos por gastos = pagos de meses anteriores + gastos pagados en el mes.
  const egresoPagos = cuentas.egresos.filter((e) => e.tipo === 'PAGO DE GASTOS LIQUIDADOS').reduce((s, e) => s - e.importe, 0);
  const pagosAnt = datos.sheets.PAGOS_PER_ANTERIORES.filter((f) => f.ID_Periodo === idPeriodo).reduce((s, f) => s + cents(f.Importe as number), 0);
  const pagadosMes = gastos.filter((g) => g.Estado_Pago === 'PAGADO EN PERÍODO');
  const pagadosMesTot = pagadosMes.reduce((s, g) => s + cents(g.Importe), 0);
  const negativos = pagadosMes.filter((g) => cents(g.Importe) < 0);
  out.push(
    ctl({
      id: 'EGRESOS',
      titulo: 'Lo que salió de la caja son gastos detallados',
      simple: egresoPagos === pagosAnt + pagadosMesTot ? 'Cada peso que salió corresponde a un gasto.' : 'Lo que salió de la caja no coincide con los gastos pagados.',
      detalle: `Egresos "pago de gastos liquidados" ${egresoPagos / 100}; pagos de meses anteriores ${pagosAnt / 100} + gastos pagados en el mes ${pagadosMesTot / 100}.${
        negativos.length ? ` Hay ${negativos.length} gasto(s) negativo(s) marcados como pagados (${negativos.map((g) => g.ID_Gasto).join(', ')}).` : ''
      }`,
      estado: egresoPagos === pagosAnt + pagadosMesTot ? 'OK' : 'PROBLEMA',
      bloquea: true,
      esperado: pagosAnt + pagadosMesTot,
      obtenido: egresoPagos,
      hallazgos: [],
    }),
  );

  // 7. Egresos sin gasto.
  const sinGasto = cuentas.egresos.filter((e) => e.tipo !== 'PAGO DE GASTOS LIQUIDADOS');
  const creditosDoc = new Set(cuentas.creditos.map((c) => c.importe));
  out.push(
    ctl({
      id: 'SIN_GASTO',
      titulo: 'No hay salidas de plata sin gasto',
      simple: sinGasto.length ? `Salieron ${sinGasto.length === 1 ? 'un importe' : `${sinGasto.length} importes`} sin gasto ni comprobante.` : 'Toda la plata que salió tiene su gasto.',
      detalle: 'Egresos de caja que no son "pago de gastos liquidados".',
      estado: sinGasto.length ? 'PROBLEMA' : 'OK',
      bloquea: sinGasto.length > 0,
      esperado: 0,
      obtenido: sinGasto.reduce((s, e) => s - e.importe, 0),
      hallazgos: ['H14'],
      filas: sinGasto.map((e) => ({
        texto: `${conceptoPublicable(e.concepto)} · ${e.tipo.toLowerCase()}${creditosDoc.has(-e.importe) ? ' · se reclama' : ''}`,
        importe: -e.importe,
        estado: 'PROBLEMA' as EstadoControl,
      })),
    }),
  );

  // 8. Cada factura se cobra una sola vez.
  const idsDelMes = new Set(gastos.map((g) => g.ID_Gasto));
  const facturas = datos.sheets.COMPROBANTES.filter((c) => (c.Tipo === 'FACTURA' || c.Revision === 'FACTURA') && c.Numero);
  const porNumero = new Map<string, typeof facturas>();
  for (const c of facturas) porNumero.set(c.Numero, [...(porNumero.get(c.Numero) ?? []), c]);
  const repetidas = [...porNumero.entries()].filter(([, cs]) => new Set(cs.map((c) => c.ID_Gasto)).size > 1 && cs.some((c) => idsDelMes.has(c.ID_Gasto)));
  out.push(
    ctl({
      id: 'FACTURA_UNICA',
      titulo: 'Cada factura se cobra una sola vez',
      simple: repetidas.length ? `${repetidas.length === 1 ? 'Una factura aparece' : `${repetidas.length} facturas aparecen`} en más de un gasto.` : 'Ninguna factura se usa dos veces.',
      detalle: 'Mismo número de factura asociado a gastos distintos.',
      estado: repetidas.length ? 'PROBLEMA' : 'OK',
      bloquea: repetidas.length > 0,
      esperado: null,
      obtenido: null,
      hallazgos: ['H25', 'H13'],
      filas: repetidas.map(([num, cs]) => ({ texto: `Factura ${num}: gastos ${[...new Set(cs.map((c) => c.ID_Gasto))].join(', ')}`, importe: cents(cs[0].Importe), estado: 'PROBLEMA' })),
    }),
  );

  // 9. Liquidado contra factura (informativo: una factura puede ser compartida).
  const filasFact: Control['filas'] = [];
  for (const g of gastos) {
    if (g.Tipo_Gasto === 'PRORRATEO FIDEICOMISO') continue;
    const cs = facturas.filter((c) => c.ID_Gasto === g.ID_Gasto && c.Importe !== '');
    if (!cs.length) continue;
    const unicas = [...new Map(cs.map((c) => [c.Numero, c])).values()];
    const fact = unicas.reduce((s, c) => s + cents(c.Importe), 0);
    const lm = modelo?.lineas.find((l) => l.idGasto === g.ID_Gasto);
    const liq = lm ? (lm.modelo === 0 && modelo?.obras.some((o) => o.idGasto === g.ID_Gasto) ? lm.oficial : lm.modelo) : cents(g.Importe);
    let segundo: number | null = null;
    try {
      const j = JSON.parse(unicas[0].Detalle_JSON || '{}');
      segundo = typeof j.segundoVto === 'number' ? cents(j.segundoVto) : null;
    } catch {
      segundo = null;
    }
    const estado: EstadoControl = liq === fact ? 'OK' : 'REVISAR';
    const nota = liq === fact ? 'igual a la factura' : segundo !== null && liq === segundo ? '2.º vencimiento con recargo' : 'distinto de la factura (puede ser una factura compartida)';
    filasFact.push({ texto: `${g.Concepto_Normalizado}: liquidado ${liq / 100}, factura ${fact / 100} · ${nota}`, importe: liq - fact, estado });
  }
  const revisar = filasFact.filter((f) => f.estado !== 'OK').length;
  out.push(
    ctl({
      id: 'FACTURAS',
      titulo: 'Lo liquidado es lo facturado',
      simple: revisar ? `${revisar} gasto(s) no coinciden con su factura. Hay que mirarlos.` : 'Cada gasto con factura liquida lo que dice la factura.',
      detalle: 'Compara cada gasto con la factura asociada. Si coincide con el segundo vencimiento, se pagó con recargo.',
      estado: revisar ? 'REVISAR' : 'OK',
      bloquea: false,
      esperado: null,
      obtenido: null,
      hallazgos: ['H23', 'H26'],
      filas: filasFact,
    }),
  );

  return out;
}

/** Evita publicar nombres de personas en conceptos de egresos sin detalle. */
export function conceptoPublicable(concepto: string): string {
  const t = concepto.trim();
  if (/\d|FC|COOP|EDENOR|FIDEICOMISO|ADMINISTRACI|COBROS|AJUSTE|DIFERENCIA|CAÑER|OCTAVO|EGRESOS|HONORARIOS/i.test(t)) return t;
  return 'Destinatario sin identificar';
}

export interface EstadoPublicacion {
  puede: boolean;
  bloqueos: Control[];
  aclarados: Control[];
  revisar: Control[];
}

/** Se publica solo si cada control bloqueante cierra o tiene una aclaración escrita. */
export function estadoPublicacion(controles: Control[], aclaraciones: Record<string, string> = {}): EstadoPublicacion {
  const fallan = controles.filter((c) => c.bloquea && c.estado !== 'OK');
  const aclarados = fallan.filter((c) => (aclaraciones[c.id] ?? '').trim().length >= 20);
  const bloqueos = fallan.filter((c) => !aclarados.includes(c));
  return { puede: bloqueos.length === 0, bloqueos, aclarados, revisar: controles.filter((c) => !c.bloquea && c.estado !== 'OK') };
}
