// Porcentajes con los que se reparten los gastos compartidos del predio entre los barrios.
// Se calculan con lo liquidado ÷ la base documentada (factura o base informada).

import type { Datos } from '../data/types';
import { cents, ratio, type Cents, type Ratio } from '../lib/money';

export interface Reparto {
  barrio: string;
  concepto: string;
  liquidado: Cents;
  base: Cents | null;
  fuenteBase: string;
  pct: Ratio | null;
  pctDocumento: Ratio | null; // el % que figura en la liquidación, si figura
}

const COMPARTIDOS = /Fideicomiso|predio/i;

export function otrosRepartos(datos: Datos, mes: string): Reparto[] {
  const gs = datos.sheets.GASTOS.filter((g) => g.Mes === mes && COMPARTIDOS.test(g.Concepto_Normalizado) && !/propios 80%/.test(g.Concepto_Normalizado));
  const facturasDe = (concepto: string) => {
    const ids = new Set(gs.filter((g) => g.Concepto_Normalizado === concepto).map((g) => g.ID_Gasto));
    const fs = datos.sheets.COMPROBANTES.filter((c) => ids.has(c.ID_Gasto) && (c.Tipo === 'FACTURA' || c.Revision === 'FACTURA') && c.Importe !== '');
    const unicas = [...new Map(fs.map((c) => [c.Numero || c.ID_Comprobante, c])).values()];
    return unicas.reduce((s, c) => s + cents(c.Importe), 0);
  };
  return gs.map((g) => {
    const propia = g.Base_Prorrateo_Doc !== '' && g.Base_Prorrateo_Doc !== null ? cents(g.Base_Prorrateo_Doc) : null;
    const otra = gs.find((x) => x.Concepto_Normalizado === g.Concepto_Normalizado && x.Base_Prorrateo_Doc !== '' && x.Base_Prorrateo_Doc !== null);
    const fact = facturasDe(g.Concepto_Normalizado);
    let base: Cents | null = null;
    let baseExacta: Ratio | null = null;
    let fuenteBase = 'N/D';
    if (propia) {
      base = propia;
      baseExacta = ratio(String(g.Base_Prorrateo_Doc));
      fuenteBase = 'Base informada en la liquidación';
    } else if (otra) {
      base = cents(otra.Base_Prorrateo_Doc);
      baseExacta = ratio(String(otra.Base_Prorrateo_Doc));
      fuenteBase = `Base informada en la liquidación de ${otra.Barrio}`;
    } else if (fact) {
      base = fact;
      baseExacta = { num: BigInt(fact), den: 100n };
      fuenteBase = 'Suma de las facturas';
    }
    const liquidado = cents(g.Importe);
    return {
      barrio: g.Barrio,
      concepto: g.Concepto_Normalizado,
      liquidado,
      base,
      fuenteBase,
      pct: baseExacta && baseExacta.num !== 0n ? { num: BigInt(liquidado) * baseExacta.den, den: 100n * baseExacta.num } : null,
      pctDocumento: g.Porc_Participacion_Doc !== '' && g.Porc_Participacion_Doc !== null ? ratio(String(g.Porc_Participacion_Doc)) : null,
    };
  });
}
