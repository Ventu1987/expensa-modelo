// Motor de la expensa modelo.
// Parte de lo liquidado (GASTOS del período) y aplica, en orden, cada criterio activo.
// El efecto de un criterio es la diferencia del total contra el paso anterior,
// así la suma de efectos explica exactamente el cambio. Todo en centavos enteros.

import type { Datos, Gasto, Periodo } from '../data/types';
import { cents, mulRound, ratio, ratioOf, sumRatios, subRatio, type Cents, type Ratio } from '../lib/money';
import type { ConfigBarrio, ConfigPeriodo, Criterio } from './tipos';

export interface LineaModelo {
  idGasto: string;
  concepto: string; // Concepto_Normalizado
  etiqueta: string; // nombre corto para Doña Rosa
  rubro: string;
  proveedor: string;
  oficial: Cents;
  modelo: Cents;
  criterios: string[]; // ids de criterio que tocaron la línea
  estadoPago: string;
  comprobante: string;
  estimado: boolean;
  comentario: string;
  fuente: string;
}

export interface Obra {
  concepto: string;
  importe: Cents;
  fondo: string;
  criterio: string;
  idGasto: string;
}

export interface EfectoCriterio {
  criterio: Criterio;
  activo: boolean;
  aplicado: boolean; // activo y con datos para aplicarse
  motivo: string; // por qué no se aplicó, o detalle del cálculo
  barrio: Cents; // efecto en el total del barrio
  porLote: Cents[]; // efecto por tipo de lote, redondeado: round(Δ × coef)
}

export interface LoteResultado {
  tipo: string;
  cantidad: number;
  coef: Ratio;
  oficial: Cents;
  modelo: Cents;
  diferencia: Cents;
  baseH01: Cents; // efecto de repartir el gasto real en vez de lo "repartido"
  ajusteRedondeo: Cents; // lo que queda por redondeos de cada efecto
}

export interface DetalleFbv {
  base: { concepto: string; importe: Cents }[];
  baseTotal: Cents;
  exclusiones: { criterio: string; titulo: string; importe: Cents; estimado: boolean }[];
  baseModelo: Cents;
  partePropios: Ratio;
  parteComunes: Ratio;
  coefPropios: Ratio;
  coefComunes: Ratio;
  coefPublicadoUsado: boolean;
  propios: { oficial: Cents; modelo: Cents; idGasto: string };
  comunes: { oficial: Cents; modelo: Cents; idGasto: string };
}

export interface RubroResultado {
  rubro: string;
  importe: Cents;
  participacion: Ratio;
}

export interface ResultadoModelo {
  periodo: Periodo;
  config: ConfigPeriodo;
  lineas: LineaModelo[];
  obras: Obra[];
  gastoOficial: Cents; // Total_Gastos_Periodo
  repartidoOficial: Cents; // Base_Prorrateo_Ord
  totalModelo: Cents;
  lotes: LoteResultado[];
  redondeo: Cents; // total modelo − Σ (cantidad × lote)
  efectos: EfectoCriterio[];
  rubros: RubroResultado[];
  fbv: DetalleFbv | null;
  reserva: { activa: boolean; pct: Ratio; aporte: Cents; porLote: Cents[]; nota: string };
}

export function periodoDe(datos: Datos, idPeriodo: string): Periodo | undefined {
  return datos.sheets.PERIODOS.find((p) => p.ID_Periodo === idPeriodo);
}

/** Períodos de un barrio con liquidación real (descarta filas de prueba). */
export function periodosDe(datos: Datos, barrio: string): Periodo[] {
  return datos.sheets.PERIODOS.filter((p) => p.Barrio === barrio && Number(p.Expensa_Ord_Lote_Tipo) > 0).sort((a, b) =>
    a.Mes.localeCompare(b.Mes),
  );
}

export function gastosDe(datos: Datos, idPeriodo: string): Gasto[] {
  return datos.sheets.GASTOS.filter((g) => g.ID_Periodo === idPeriodo);
}

function conceptoInfo(datos: Datos, concepto: string): { etiqueta: string; rubro: string } {
  const c = datos.sheets.CONCEPTOS.find((x) => x.Concepto_Normalizado === concepto);
  const rubro = String(c?.Rubro_Modelo ?? '') || 'Otros';
  return { etiqueta: String(c?.Etiqueta ?? '') || concepto, rubro: rubro.replace(/\s*\(.*\)\s*$/, '') };
}

/** Importe de un comprobante en centavos (null si no tiene). */
export function importeComprobante(datos: Datos, id: string): Cents | null {
  const c = datos.sheets.COMPROBANTES.find((x) => x.ID_Comprobante === id);
  if (!c || c.Importe === '' || c.Importe === null || c.Importe === undefined) return null;
  return cents(c.Importe);
}

export interface OpcionesModelo {
  apagados?: Set<string>; // criterios que el usuario apagó
  encendidos?: Set<string>; // criterios apagados por defecto que el usuario prendió
  reserva?: boolean; // forzar el fondo de reserva
}

export function criterioActivo(c: Criterio, op: OpcionesModelo): boolean {
  if (op.apagados?.has(c.id)) return false;
  if (op.encendidos?.has(c.id)) return true;
  return c.activo;
}

/** Calcula la expensa modelo de un período. Devuelve null si el período no tiene configuración. */
export function calcularModelo(datos: Datos, cfg: ConfigBarrio, idPeriodo: string, op: OpcionesModelo = {}): ResultadoModelo | null {
  const periodo = periodoDe(datos, idPeriodo);
  const pc = cfg.periodos[idPeriodo];
  if (!periodo || !pc) return null;

  const gastos = gastosDe(datos, idPeriodo);
  const lineas: LineaModelo[] = gastos.map((g) => {
    const info = conceptoInfo(datos, g.Concepto_Normalizado);
    return {
      idGasto: g.ID_Gasto,
      concepto: g.Concepto_Normalizado,
      etiqueta: info.etiqueta,
      rubro: info.rubro,
      proveedor: g.Proveedor,
      oficial: cents(g.Importe),
      modelo: cents(g.Importe),
      criterios: [],
      estadoPago: g.Estado_Pago,
      comprobante: g.Comprobante,
      estimado: g.Es_Estimado === 'SI',
      comentario: pc.comentarios[g.Concepto_Normalizado] ?? '',
      fuente: `${g.Fuente_PDF}${g.Pagina ? `, pág. ${g.Pagina}` : ''}`,
    };
  });
  const linea = (id?: string) => lineas.find((l) => l.idGasto === id);
  const total = () => lineas.reduce((s, l) => s + l.modelo, 0);

  const coefs = cfg.tiposLote.map((t) => ratio(t.coef));
  const obras: Obra[] = [];

  // Estado del mantenimiento del Fideicomiso.
  const f = pc.fbv;
  const fbvBase = f ? f.base.map((b) => ({ concepto: b.concepto, importe: cents(b.importe) })) : [];
  const fbvBaseTotal = fbvBase.reduce((s, b) => s + b.importe, 0);
  const exclusiones: DetalleFbv['exclusiones'] = [];
  let coefPublicado = false;
  let fbvRecalculado = false;
  const coefPub = cfg.coefFideicomiso[cfg.barrio];
  const recalcularFbv = () => {
    if (!f) return;
    const lp = linea(f.gastoPropios);
    const lc = linea(f.gastoComunes);
    if (!lp || !lc) return;
    const base = fbvBaseTotal - exclusiones.reduce((s, e) => s + e.importe, 0);
    const cp = coefPublicado ? ratio(coefPub.propios) : ratio(f.coefAplicadoPropios);
    const cc = coefPublicado ? ratio(coefPub.comunes) : ratio(f.coefAplicadoComunes);
    lp.modelo = mulRound(base, ratio(f.partePropios), cp);
    lc.modelo = mulRound(base, ratio(f.parteComunes), cc);
    fbvRecalculado = true;
  };

  const efectos: EfectoCriterio[] = [];
  for (const c of pc.criterios) {
    const activo = criterioActivo(c, op);
    const ef: EfectoCriterio = { criterio: c, activo, aplicado: false, motivo: '', barrio: 0, porLote: coefs.map(() => 0) };
    efectos.push(ef);
    if (!activo) {
      ef.motivo = 'Apagado';
      continue;
    }
    const antes = total();
    const l = linea(c.gasto);
    const marcar = (x?: LineaModelo) => x && !x.criterios.includes(c.id) && x.criterios.push(c.id);
    switch (c.tipo) {
      case 'FACTURA': {
        const imp = c.comprobante ? importeComprobante(datos, c.comprobante) : null;
        if (!l || imp === null) {
          ef.motivo = 'N/D: falta el gasto o la factura';
          break;
        }
        l.modelo = imp;
        marcar(l);
        ef.aplicado = true;
        break;
      }
      case 'IMPORTE_SUPUESTO': {
        if (!l || !c.importe) {
          ef.motivo = 'N/D: falta el gasto o el importe';
          break;
        }
        l.modelo = cents(c.importe);
        l.estimado = true;
        marcar(l);
        ef.aplicado = true;
        break;
      }
      case 'A_EXTRAORDINARIO': {
        if (!l) {
          ef.motivo = 'N/D: falta el gasto';
          break;
        }
        obras.push({ concepto: l.etiqueta, importe: l.modelo, fondo: c.fondo ?? 'EXTRAORDINARIO', criterio: c.id, idGasto: l.idGasto });
        l.modelo = 0;
        marcar(l);
        ef.aplicado = true;
        break;
      }
      case 'CAJA_CHICA_FISCAL': {
        const g = gastos.find((x) => x.ID_Gasto === c.gasto);
        const porc = g && g.Porc_Participacion_Doc !== '' ? ratio(String(g.Porc_Participacion_Doc)) : null;
        const fiscales = datos.sheets.COMPROBANTES.filter((x) => x.ID_Gasto === c.gasto && x.Es_Fiscal === 'SI');
        if (!l || !porc || !fiscales.length) {
          ef.motivo = 'N/D: falta el % de participación o los comprobantes';
          break;
        }
        const suma = fiscales.reduce((s, x) => s + cents(x.Importe), 0);
        l.modelo = mulRound(suma, porc);
        marcar(l);
        ef.aplicado = true;
        ef.motivo = `${fiscales.length} comprobantes fiscales`;
        break;
      }
      case 'PROPORCION': {
        const q = (c.quitar ?? []).map((id) => importeComprobante(datos, id));
        const t = (c.total ?? []).map((id) => importeComprobante(datos, id));
        if (!l || q.some((x) => x === null) || t.some((x) => x === null)) {
          ef.motivo = 'N/D: faltan facturas';
          break;
        }
        const tot = (t as Cents[]).reduce((s, x) => s + x, 0);
        const qui = (q as Cents[]).reduce((s, x) => s + x, 0);
        l.modelo = mulRound(l.modelo, ratioOf(tot - qui, tot));
        marcar(l);
        ef.aplicado = true;
        break;
      }
      case 'POR_LOTES': {
        const imp = c.comprobante ? importeComprobante(datos, c.comprobante) : null;
        if (!l || imp === null || !c.lotes || !c.lotesTotal) {
          ef.motivo = 'N/D: falta la factura o la cantidad de lotes';
          break;
        }
        l.modelo = mulRound(imp, { num: BigInt(c.lotes), den: BigInt(c.lotesTotal) });
        marcar(l);
        ef.aplicado = true;
        break;
      }
      case 'QUITAR': {
        const ls = (c.gastos ?? []).map((id) => linea(id)).filter(Boolean) as LineaModelo[];
        if (!ls.length) {
          ef.motivo = 'N/D: faltan los gastos';
          break;
        }
        ls.forEach((x) => {
          x.modelo = 0;
          marcar(x);
        });
        ef.aplicado = true;
        break;
      }
      case 'FBV_EXCLUIR': {
        if (!f || !c.importe) {
          ef.motivo = 'N/D: falta la base del Fideicomiso';
          break;
        }
        exclusiones.push({ criterio: c.id, titulo: c.titulo, importe: cents(c.importe), estimado: !!c.estimado });
        recalcularFbv();
        marcar(linea(f.gastoPropios));
        marcar(linea(f.gastoComunes));
        ef.aplicado = true;
        break;
      }
      case 'FBV_COEF_PUBLICADO': {
        if (!f || !coefPub) {
          ef.motivo = 'N/D: falta el coeficiente publicado';
          break;
        }
        coefPublicado = true;
        recalcularFbv();
        marcar(linea(f.gastoPropios));
        marcar(linea(f.gastoComunes));
        ef.aplicado = true;
        break;
      }
    }
    ef.barrio = total() - antes;
    ef.porLote = coefs.map((k) => mulRound(ef.barrio, k));
  }

  const gastoOficial = cents(periodo.Total_Gastos_Periodo);
  const repartidoOficial = cents(periodo.Base_Prorrateo_Ord);
  const totalModelo = total();

  const lotes: LoteResultado[] = cfg.tiposLote.map((t, i) => {
    const coef = coefs[i];
    const oficial = i === 0 ? cents(periodo.Expensa_Ord_Lote_Tipo) : mulRound(repartidoOficial, coef);
    const modelo = mulRound(totalModelo, coef);
    const baseH01 = mulRound(gastoOficial - repartidoOficial, coef);
    const sumaEf = efectos.reduce((s, e) => s + e.porLote[i], 0);
    return {
      tipo: t.tipo,
      cantidad: t.cantidad,
      coef,
      oficial,
      modelo,
      diferencia: modelo - oficial,
      baseH01,
      ajusteRedondeo: modelo - oficial - baseH01 - sumaEf,
    };
  });
  const redondeo = totalModelo - lotes.reduce((s, l) => s + l.cantidad * l.modelo, 0);

  // Rubros del modelo.
  const porRubro = new Map<string, Cents>();
  for (const l of lineas) porRubro.set(l.rubro, (porRubro.get(l.rubro) ?? 0) + l.modelo);
  const rubros = [...porRubro.entries()]
    .filter(([, v]) => v !== 0)
    .map(([rubro, importe]) => ({ rubro, importe, participacion: ratioOf(importe, totalModelo || 1) }))
    .sort((a, b) => b.importe - a.importe);

  const pctRes = ratio(cfg.reserva.pct);
  const resActiva = op.reserva ?? cfg.reserva.activa;

  let fbv: DetalleFbv | null = null;
  if (f) {
    const lp = linea(f.gastoPropios);
    const lc = linea(f.gastoComunes);
    fbv = {
      base: fbvBase,
      baseTotal: fbvBaseTotal,
      exclusiones,
      baseModelo: fbvBaseTotal - exclusiones.reduce((s, e) => s + e.importe, 0),
      partePropios: ratio(f.partePropios),
      parteComunes: ratio(f.parteComunes),
      coefPropios: coefPublicado ? ratio(coefPub.propios) : ratio(f.coefAplicadoPropios),
      coefComunes: coefPublicado ? ratio(coefPub.comunes) : ratio(f.coefAplicadoComunes),
      coefPublicadoUsado: coefPublicado,
      propios: { oficial: lp?.oficial ?? 0, modelo: lp?.modelo ?? 0, idGasto: f.gastoPropios },
      comunes: { oficial: lc?.oficial ?? 0, modelo: lc?.modelo ?? 0, idGasto: f.gastoComunes },
    };
    void fbvRecalculado;
  }

  return {
    periodo,
    config: pc,
    lineas,
    obras,
    gastoOficial,
    repartidoOficial,
    totalModelo,
    lotes,
    redondeo,
    efectos,
    rubros,
    fbv,
    reserva: {
      activa: resActiva,
      pct: pctRes,
      aporte: resActiva ? mulRound(totalModelo, pctRes) : 0,
      porLote: lotes.map((l) => (resActiva ? mulRound(l.modelo, pctRes) : 0)),
      nota: cfg.reserva.nota,
    },
  };
}

/** Porcentajes del Fideicomiso por barrio: propios (80%) y comunes (20%), y su efecto combinado. */
export function tablaFideicomiso(cfg: ConfigBarrio, partePropios = '0.8', parteComunes = '0.2') {
  const pp = ratio(partePropios);
  const pcm = ratio(parteComunes);
  const filas = Object.entries(cfg.coefFideicomiso).map(([barrio, c]) => {
    const p = ratio(c.propios);
    const cm = ratio(c.comunes);
    const combinado = sumRatios([
      { num: pp.num * p.num, den: pp.den * p.den },
      { num: pcm.num * cm.num, den: pcm.den * cm.den },
    ]);
    return { barrio, propios: p, comunes: cm, combinado };
  });
  const suma = (k: 'propios' | 'comunes' | 'combinado') => sumRatios(filas.map((x) => x[k]));
  const uno: Ratio = { num: 1n, den: 1n };
  return {
    filas,
    total: { propios: suma('propios'), comunes: suma('comunes'), combinado: suma('combinado') },
    resto: { propios: subRatio(uno, suma('propios')), comunes: subRatio(uno, suma('comunes')), combinado: subRatio(uno, suma('combinado')) },
  };
}
