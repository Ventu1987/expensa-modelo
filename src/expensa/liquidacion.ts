// La liquidación de expensas tal como la emitiría la administración: ordenada para leer, no para auditar.
// Toma el resultado del motor (gastos corregidos, cada uno con su documento) y arma cada sección.
// Todo en centavos enteros; ningún número se inventa: lo que falta queda en null (N/D).

import type { Datos, Gasto } from '../data/types';
import { cents, ratioOf, type Cents, type Ratio } from '../lib/money';
import type { ConfigBarrio, ConfigPeriodo } from '../modelo/tipos';
import { calcularModelo, periodosDe, type LineaModelo, type OpcionesModelo, type ResultadoModelo } from '../modelo/modelo';
import { calcularCuentas, type Cuentas } from '../modelo/cuentas';
import { calcularControles, type Control } from '../modelo/controles';
import { RESOLUCIONES } from '../modelo/resoluciones';

export type Respaldo = 'FISCAL' | 'PARCIAL' | 'SIN';

export interface FilaGasto {
  clave: string; // Concepto_Normalizado
  etiqueta: string;
  rubro: string;
  proveedor: string;
  periodoServicio: string;
  comprobante: string; // texto corto: "Factura B 0002-00003731", "4 tiques", "Sin comprobante"
  respaldo: Respaldo;
  idsGasto: string[];
  lineas: LineaModelo[]; // detalle (dos líneas si hay una nota de crédito, por ejemplo)
  anterior: Cents | null;
  actual: Cents;
  oficial: Cents; // lo que liquidó la administración anterior, para el anexo
  variacion: Ratio | null;
  nuevo: boolean;
  porque: string;
  porqueOrigen: 'administracion' | 'documento' | 'automatico' | 'falta';
  estado: 'Pagado' | 'Pendiente' | 'Parcial';
  supuesto: 'SUPUESTO' | 'ESTIMADO' | null;
}

export interface Rubro {
  nombre: string;
  filas: FilaGasto[];
  anterior: Cents | null;
  actual: Cents;
  variacion: Ratio | null;
  participacion: Ratio;
}

export interface PasoFlujo {
  texto: string;
  importe: Cents;
  tipo: 'saldo' | 'entra' | 'sale' | 'diferencia';
  detalle?: { texto: string; importe: Cents }[];
  nota?: string;
}

export interface Regularizacion {
  id: string;
  titulo: string;
  quePaso: string;
  queHacemos: string;
  estado: 'Corregido en esta liquidación' | 'A recuperar' | 'En gestión' | 'Pendiente' | 'Solucionado' | 'Descartado' | 'Se controla cada mes';
  efectoLote: Cents | null; // este mes, en el lote elegido
  importe: Cents | null; // importe que informa la auditoría para el barrio
  falta: string; // qué documento hace falta
  gravedad: string;
  nota: string; // comentario editable
  pagina: string;
}

export interface Liquidacion {
  idPeriodo: string;
  mes: string;
  previo: string | null; // ID del mes anterior con datos
  modelo: ResultadoModelo;
  esModelo: boolean; // false: no hay criterios cargados, se muestran los datos oficiales
  rubros: Rubro[];
  total: Cents;
  totalAnterior: Cents | null;
  extraordinarios: { concepto: string; importe: Cents; fondo: string; porque: string }[];
  cuotas: { tipo: string; cantidad: number; coef: Ratio; cuota: Cents; anterior: Cents | null; subtotal: Cents; reserva: Cents }[];
  redondeo: Cents;
  particulares: { total: Cents; serie: { mes: string; importe: Cents }[]; lotes: number | null; concepto: string; fondo: string; nota: string; estado: 'OK' | 'REVISAR' };
  flujo: PasoFlujo[];
  saldoInicial: Cents;
  saldoFinal: Cents;
  compromisos: { texto: string; importe: Cents | null; nota: string }[];
  plataLibre: Cents;
  fondos: { fondo: string; inicial: Cents; ingresos: Cents; usos: Cents; final: Cents; nota: string }[];
  patrimonio: { activo: { texto: string; importe: Cents; nota?: string }[]; pasivo: { texto: string; importe: Cents | null; nota?: string }[]; neto: Cents };
  cuentas: Cuentas;
  controles: Control[];
  regularizaciones: Regularizacion[];
  respaldo: { fiscal: Cents; parcial: Cents; sin: Cents };
  notas: Record<string, string>;
  sinPorque: FilaGasto[]; // variaciones de 5% o más sin explicación
}

const PAGADO = 'PAGADO EN PERÍODO';

function previoDe(datos: Datos, barrio: string, idPeriodo: string): string | null {
  const ps = periodosDe(datos, barrio);
  const i = ps.findIndex((p) => p.ID_Periodo === idPeriodo);
  return i > 0 ? ps[i - 1].ID_Periodo : null;
}

function modeloOficial(datos: Datos, cfg: ConfigBarrio, id: string) {
  return calcularModelo(datos, cfg, id, { apagados: new Set((cfg.periodos[id]?.criterios ?? []).map((c) => c.id)) });
}

/** Texto corto del comprobante de un gasto y qué tan respaldado está. */
function comprobanteDe(datos: Datos, gastos: Gasto[]): { texto: string; respaldo: Respaldo } {
  const ids = new Set(gastos.map((g) => g.ID_Gasto));
  const cs = datos.sheets.COMPROBANTES.filter((c) => ids.has(c.ID_Gasto));
  const fact = [...new Map(cs.filter((c) => c.Tipo === 'FACTURA' && c.Numero).map((c) => [c.Numero, c])).values()];
  const fiscales = cs.filter((c) => c.Es_Fiscal === 'SI');
  const noFiscales = cs.filter((c) => c.Es_Fiscal === 'NO' && c.Tipo === 'IMAGEN');
  const propio = gastos.map((g) => g.Comprobante).find((x) => x && x !== 'N/D' && !/comprobantes/.test(x));
  if (fact.length === 1) {
    return { texto: `Factura ${fact[0].Numero}`, respaldo: 'FISCAL' };
  }
  if (fact.length > 1) return { texto: `${fact.length} facturas`, respaldo: 'FISCAL' };
  if (fiscales.length && noFiscales.length) return { texto: `${fiscales.length} de ${fiscales.length + noFiscales.length} comprobantes fiscales`, respaldo: 'PARCIAL' };
  if (fiscales.length) return { texto: `${fiscales.length} comprobante${fiscales.length === 1 ? '' : 's'} fiscal${fiscales.length === 1 ? '' : 'es'}`, respaldo: 'FISCAL' };
  if (propio) return { texto: cs.length ? propio : `${propio} (sin cargar)`, respaldo: cs.length ? 'PARCIAL' : 'SIN' };
  if (cs.length) return { texto: `${cs.length} documento${cs.length === 1 ? '' : 's'} sin factura`, respaldo: 'PARCIAL' };
  return { texto: 'Sin comprobante', respaldo: 'SIN' };
}

function primeraFrase(t: string): string {
  const m = /^(.+?[.:])(\s|$)/.exec(t.trim());
  return (m ? m[1] : t).replace(/:$/, '.');
}

export interface Ediciones {
  porque: Record<string, string>; // Concepto_Normalizado → texto
  notas: Record<string, string>; // sección o hallazgo → texto
}

export function armarLiquidacion(
  datos: Datos,
  cfg: ConfigBarrio | null,
  cfgOficial: ConfigBarrio,
  barrio: string,
  idPeriodo: string,
  op: OpcionesModelo = {},
  ed: Ediciones = { porque: {}, notas: {} },
): Liquidacion | null {
  const esModelo = !!cfg?.periodos[idPeriodo];
  const base = esModelo ? cfg! : cfgOficial;
  const m = esModelo ? calcularModelo(datos, base, idPeriodo, op) : modeloOficial(datos, base, idPeriodo);
  if (!m) return null;
  const pc: ConfigPeriodo = base.periodos[idPeriodo] ?? { criterios: [], deudas: [], creditos: [], novedades: [], comentarios: {} };
  const previo = previoDe(datos, barrio, idPeriodo);
  const mPrev = previo ? (cfg?.periodos[previo] ? calcularModelo(datos, cfg, previo) : modeloOficial(datos, cfgOficial, previo)) : null;

  const valor = (l: LineaModelo) => (esModelo ? l.modelo : l.oficial);
  const prevPor = new Map<string, Cents>();
  for (const l of mPrev?.lineas ?? []) prevPor.set(l.concepto, (prevPor.get(l.concepto) ?? 0) + (cfg?.periodos[previo!] ? l.modelo : l.oficial));
  const vistos = new Set<string>();
  const ps = periodosDe(datos, barrio);
  for (const p of ps.slice(0, Math.max(0, ps.findIndex((x) => x.ID_Periodo === idPeriodo))))
    datos.sheets.GASTOS.filter((g) => g.ID_Periodo === p.ID_Periodo).forEach((g) => vistos.add(g.Concepto_Normalizado));

  const obrasIds = new Set(m.obras.map((o) => o.idGasto));
  const gastos = datos.sheets.GASTOS.filter((g) => g.ID_Periodo === idPeriodo);
  const porConcepto = new Map<string, LineaModelo[]>();
  for (const l of m.lineas) if (!obrasIds.has(l.idGasto)) porConcepto.set(l.concepto, [...(porConcepto.get(l.concepto) ?? []), l]);
  const nombreCriterio = new Map(m.efectos.map((e) => [e.criterio.id, e.criterio]));

  const filas: FilaGasto[] = [...porConcepto.entries()].map(([clave, ls]) => {
    const gs = gastos.filter((g) => ls.some((l) => l.idGasto === g.ID_Gasto));
    const actual = ls.reduce((s, l) => s + valor(l), 0);
    const anterior = prevPor.has(clave) ? prevPor.get(clave)! : null;
    const nuevo = !!previo && !vistos.has(clave);
    const comp = comprobanteDe(datos, gs);
    const variacion = anterior ? ratioOf(actual - anterior, Math.abs(anterior)) : null;
    const criterios = [...new Set(ls.flatMap((l) => l.criterios))].map((id) => nombreCriterio.get(id)).filter(Boolean);
    let porque = ed.porque[clave] ?? pc.comentarios[clave] ?? '';
    let porqueOrigen: FilaGasto['porqueOrigen'] = porque ? 'administracion' : 'automatico';
    if (!porque && criterios.length) {
      porque = criterios.map((c) => primeraFrase(c!.texto)).join(' ');
      porqueOrigen = 'documento';
    }
    const pctAbs = variacion ? Math.abs(Number((variacion.num * 10000n) / variacion.den)) / 100 : null;
    if (!porque) {
      if (nuevo) porque = 'Gasto nuevo este mes.';
      else if (anterior === null) porque = 'No figuraba el mes anterior.';
      else if (actual === anterior) porque = 'Igual al mes anterior.';
      else if (pctAbs !== null && pctAbs < 5) porque = 'Variación menor al 5%.';
      else porqueOrigen = 'falta';
    }
    const estados = new Set(ls.map((l) => l.estadoPago));
    const estado: FilaGasto['estado'] = estados.size > 1 ? 'Parcial' : estados.has(PAGADO) ? 'Pagado' : 'Pendiente';
    const periodoServicio = gs.map((g) => g.Periodo_Servicio).find((x) => x && x !== 'N/D') ?? '';
    return {
      clave,
      etiqueta: ls[0].etiqueta,
      rubro: ls[0].rubro,
      proveedor: [...new Set(ls.map((l) => l.proveedor).filter((x) => x && x !== 'N/D'))].join(' · '),
      periodoServicio,
      comprobante: comp.texto,
      respaldo: comp.respaldo,
      idsGasto: ls.map((l) => l.idGasto),
      lineas: ls,
      anterior,
      actual,
      oficial: ls.reduce((s, l) => s + l.oficial, 0),
      variacion,
      nuevo,
      porque,
      porqueOrigen,
      estado,
      supuesto: criterios.some((c) => c!.tipo === 'IMPORTE_SUPUESTO' || c!.estimado) ? 'SUPUESTO' : ls.some((l) => l.estimado) ? 'ESTIMADO' : null,
    };
  });

  const total = filas.reduce((s, f) => s + f.actual, 0);
  const totalAnterior = mPrev ? (cfg?.periodos[previo!] ? mPrev.totalModelo : mPrev.gastoOficial) : null;
  const nombres = [...new Set(filas.map((f) => f.rubro))];
  const rubros: Rubro[] = nombres
    .map((nombre) => {
      const fs = filas.filter((f) => f.rubro === nombre).sort((a, b) => b.actual - a.actual);
      const actual = fs.reduce((s, f) => s + f.actual, 0);
      const ant = fs.every((f) => f.anterior === null) ? null : fs.reduce((s, f) => s + (f.anterior ?? 0), 0);
      // lo que estaba el mes anterior en este rubro y ya no está
      const antRubro = (mPrev?.lineas ?? []).filter((l) => l.rubro === nombre).reduce((s, l) => s + (cfg?.periodos[previo!] ? l.modelo : l.oficial), 0);
      const anterior = mPrev ? antRubro : ant;
      return { nombre, filas: fs, anterior, actual, variacion: anterior ? ratioOf(actual - anterior, Math.abs(anterior)) : null, participacion: ratioOf(actual, total || 1) };
    })
    .sort((a, b) => b.actual - a.actual);

  const extraordinarios = m.obras.map((o) => ({
    concepto: o.concepto,
    importe: o.importe,
    fondo: o.fondo,
    porque: ed.porque[m.lineas.find((l) => l.idGasto === o.idGasto)?.concepto ?? ''] ?? pc.comentarios[m.lineas.find((l) => l.idGasto === o.idGasto)?.concepto ?? ''] ?? primeraFrase(nombreCriterio.get(o.criterio)?.texto ?? ''),
  }));

  const cuotas = m.lotes.map((l, i) => {
    const prevL = mPrev?.lotes[i];
    return {
      tipo: base.tiposLote[i]?.tipo ?? l.tipo,
      cantidad: l.cantidad,
      coef: l.coef,
      cuota: esModelo ? l.modelo : l.oficial,
      anterior: prevL ? (cfg?.periodos[previo!] ? prevL.modelo : prevL.oficial) : null,
      subtotal: l.cantidad * (esModelo ? l.modelo : l.oficial),
      reserva: m.reserva.porLote[i] ?? 0,
    };
  });
  const repartido = cuotas.reduce((s, c) => s + c.subtotal, 0);
  const redondeo = total - repartido;

  // Cargos particulares (canon de obra y otros): no se reparten, los paga cada lote que corresponde.
  const partCfg = pc.particulares;
  const particulares = {
    total: cents(m.periodo.Gastos_Particulares),
    serie: ps.map((p) => ({ mes: p.Mes, importe: cents(p.Gastos_Particulares) })),
    lotes: partCfg?.lotes ?? null,
    concepto: partCfg?.concepto ?? 'Cargos particulares',
    fondo: partCfg?.fondo ?? 'N/D',
    nota: partCfg?.nota ?? 'Falta el detalle por concepto y la cantidad de lotes.',
    estado: partCfg?.estado ?? 'REVISAR',
  };

  // Flujo de fondos: movimientos reales de la cuenta.
  const cuentas = calcularCuentas(datos, idPeriodo, pc)!;
  const controles = calcularControles(datos, idPeriodo, cuentas, esModelo ? m : null);
  const ingresosAgr = new Map<string, Cents>();
  for (const i of cuentas.ingresos) ingresosAgr.set(i.concepto, (ingresosAgr.get(i.concepto) ?? 0) + i.importe);
  const pagadosMes = gastos.filter((g) => g.Estado_Pago === PAGADO);
  const pagosAnt = datos.sheets.PAGOS_PER_ANTERIORES.filter((f) => f.ID_Periodo === idPeriodo);
  const egresoPagos = cuentas.egresos.filter((e) => e.tipo === 'PAGO DE GASTOS LIQUIDADOS').reduce((s, e) => s - e.importe, 0);
  const detMes = pagadosMes.map((g) => ({ texto: g.Concepto_Normalizado, importe: cents(g.Importe) }));
  const detAnt = pagosAnt.map((f) => ({ texto: `${String(f.Concepto_Normalizado)} (${String(f.Periodo_Origen_Gasto).slice(-2)}/${String(f.Periodo_Origen_Gasto).slice(3, 7)})`, importe: cents(f.Importe as number) }));
  const sumMes = detMes.reduce((s, x) => s + x.importe, 0);
  const sumAnt = detAnt.reduce((s, x) => s + x.importe, 0);
  const otros = cuentas.egresos.filter((e) => e.tipo !== 'PAGO DE GASTOS LIQUIDADOS');
  const flujo: PasoFlujo[] = [
    { texto: 'Plata en la cuenta al empezar el mes', importe: cuentas.saldoInicial, tipo: 'saldo' },
    ...[...ingresosAgr.entries()].map(([texto, importe]) => ({ texto: `Cobros: ${texto.toLowerCase()}`, importe, tipo: 'entra' as const })),
    { texto: 'Pagos de gastos de este mes', importe: -sumMes, tipo: 'sale', detalle: detMes },
    { texto: 'Pagos de gastos de meses anteriores', importe: -sumAnt, tipo: 'sale', detalle: detAnt },
    ...otros.map((o) => ({ texto: o.tipo === 'AJUSTE' ? 'Ajuste sin comprobante' : 'Salida sin gasto asociado', importe: o.importe, tipo: 'sale' as const })),
  ];
  const difEgresos = egresoPagos - sumMes - sumAnt;
  if (difEgresos !== 0)
    flujo.push({ texto: 'Diferencia entre lo pagado y lo detallado', importe: -difEgresos, tipo: 'diferencia', nota: 'Se regulariza con el detalle de pagos.' });
  flujo.push({ texto: 'Plata en la cuenta al cierre', importe: cuentas.saldoFinal, tipo: 'saldo' });

  // Compromisos según esta liquidación.
  const pendMes = m.lineas.filter((l) => l.estadoPago === 'PENDIENTE' && !obrasIds.has(l.idGasto)).reduce((s, l) => s + valor(l), 0);
  const compromisos = [
    { texto: 'Gastos de este mes que faltan pagar', importe: pendMes, nota: 'Se pagan con las expensas de este mes.' },
    ...cuentas.deudas.map((d) => ({ texto: d.concepto, importe: d.importe, nota: d.nota })),
  ];
  const plataLibre = cuentas.saldoFinal - compromisos.reduce((s, c) => s + (c.importe ?? 0), 0);

  // Fondos: la obra se imputa al fondo extraordinario.
  const usoObras = m.obras.reduce((s, o) => s + o.importe, 0);
  const ingFondo = (f: string) => cuentas.ingresos.filter((i) => i.fondo === f).reduce((s, i) => s + i.importe, 0);
  const fondos = cuentas.fondos.map((f) => {
    const ext = f.fondo === 'EXTRAORDINARIO';
    const final = f.final + (esModelo ? (ext ? -usoObras : usoObras) : 0);
    const ingresos = ingFondo(f.fondo);
    return {
      fondo: f.fondo,
      inicial: f.inicial,
      ingresos,
      usos: f.inicial + ingresos - final,
      final,
      nota: ext && esModelo && usoObras ? `Pagó ${m.obras.map((o) => o.concepto.toLowerCase()).join(', ')}.` : '',
    };
  });
  if (m.reserva.activa) fondos.push({ fondo: 'RESERVA', inicial: 0, ingresos: m.reserva.aporte, usos: 0, final: m.reserva.aporte, nota: 'Aporte de este mes, a cobrar con las expensas.' });

  // Estado patrimonial con esta liquidación.
  const aCobrarMes = repartido + particulares.total + (m.reserva.activa ? cuotas.reduce((s, c) => s + c.cantidad * c.reserva, 0) : 0);
  const pagadoDeMas = m.lineas
    .filter((l) => l.estadoPago === PAGADO && !obrasIds.has(l.idGasto) && l.oficial > valor(l))
    .map((l) => ({ texto: `Pagado de más: ${l.etiqueta.toLowerCase()}`, importe: l.oficial - valor(l), nota: 'A recuperar o imputar al mes siguiente.' }));
  const activo = [
    { texto: 'Plata en la cuenta', importe: cuentas.saldoFinal },
    { texto: 'Expensas de este mes a cobrar', importe: aCobrarMes, nota: 'Cuotas de esta liquidación más los cargos particulares.' },
    { texto: 'Expensas atrasadas a cobrar', importe: cuentas.morosidad.deuda },
    { texto: 'Intereses a cobrar', importe: cuentas.morosidad.intereses },
    ...pagadoDeMas,
  ];
  const pasivo = compromisos.map((c) => ({ texto: c.texto, importe: c.importe, nota: c.importe === null ? 'N/D: no se suma hasta tener el importe.' : undefined }));
  const neto = activo.reduce((s, a) => s + a.importe, 0) - pasivo.reduce((s, p) => s + (p.importe ?? 0), 0);

  // Regularizaciones: cada hallazgo de la auditoría, contado como lo cuenta la administración.
  const hallazgos = datos.sheets.HALLAZGOS.filter((h) => String(h.Barrios).split(',').map((x) => x.trim()).includes(barrio));
  const loteSel = Math.min(op.lote ?? 0, m.lotes.length - 1);
  const efectoDe = (id: string) => {
    const efs = m.efectos.filter((e) => e.aplicado && e.criterio.hallazgos.includes(id));
    return efs.length ? efs.reduce((s, e) => s + e.porLote[loteSel], 0) : null;
  };
  const extras = [
    ...(barrio === 'S2'
      ? [{ ID_Hallazgo: 'H32', Titulo: 'Coeficiente de propios distinto del publicado', Conclusion_Simple: 'En octubre se aplicó 12,76% al mantenimiento de espacios propios, cuando el publicado para Senderos II es 13,73%.', Estado: 'ABIERTO', Gravedad: 'IMPORTANTE', Impacto_S2: '', Que_Pedir: 'Tabla oficial de coeficientes del Fideicomiso.' }]
      : []),
    ...(barrio === 'LH'
      ? [{ ID_Hallazgo: 'LH-10', Titulo: 'Se repartió más que el gasto en octubre', Conclusion_Simple: 'En 10/2026 se repartieron $ 956.782,24 más que el gasto del mes (9,5%).', Estado: 'ABIERTO', Gravedad: 'CRÍTICO', Impacto_S2: '', Que_Pedir: 'Regla de devolución.' }]
      : []),
  ];
  const regularizaciones: Regularizacion[] = [...hallazgos, ...extras].map((h) => {
    const id = String(h.ID_Hallazgo);
    const r = RESOLUCIONES.find((x) => x.id === id);
    const ef = id === 'H01' ? m.lotes[loteSel].baseH01 : efectoDe(id);
    const est = String(h.Estado);
    const aRecuperar = cuentas.creditos.some((c) => c.hallazgo === id);
    const estado: Regularizacion['estado'] =
      ef !== null && esModelo
        ? 'Corregido en esta liquidación'
        : est === 'SOLUCIONADO'
          ? 'Solucionado'
          : est === 'DESCARTADO'
            ? 'Descartado'
            : aRecuperar
              ? 'A recuperar'
            : r?.como.includes('control') && !r.como.includes('criterio')
              ? 'Se controla cada mes'
              : est === 'EN GESTIÓN'
                ? 'En gestión'
                : 'Pendiente';
    const imp = (h as Record<string, unknown>)[`Impacto_${barrio}`];
    return {
      id,
      titulo: String(h.Titulo),
      quePaso: String(h.Conclusion_Simple ?? ''),
      queHacemos: r?.regla ?? '',
      estado,
      efectoLote: esModelo ? ef : null,
      importe: imp === '' || imp === null || imp === undefined || Number(imp) === 0 ? null : cents(imp as number),
      falta: String((h as Record<string, unknown>).Que_Pedir ?? ''),
      gravedad: String(h.Gravedad),
      nota: ed.notas[id] ?? pc.notas?.[id] ?? '',
      pagina: r?.donde.pagina ?? '',
    };
  });

  const resp = { fiscal: 0, parcial: 0, sin: 0 };
  for (const f of filas) resp[f.respaldo === 'FISCAL' ? 'fiscal' : f.respaldo === 'PARCIAL' ? 'parcial' : 'sin'] += f.actual;

  return {
    idPeriodo,
    mes: m.periodo.Mes,
    previo,
    modelo: m,
    esModelo,
    rubros,
    total,
    totalAnterior,
    extraordinarios,
    cuotas,
    redondeo,
    particulares,
    flujo,
    saldoInicial: cuentas.saldoInicial,
    saldoFinal: cuentas.saldoFinal,
    compromisos,
    plataLibre,
    fondos,
    patrimonio: { activo, pasivo, neto },
    cuentas,
    controles,
    regularizaciones,
    respaldo: resp,
    notas: { ...(pc.notas ?? {}), ...ed.notas },
    sinPorque: filas.filter((f) => f.porqueOrigen === 'falta'),
  };
}

