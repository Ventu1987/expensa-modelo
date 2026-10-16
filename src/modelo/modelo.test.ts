import { describe, expect, it } from 'vitest';
import { datosDeCopia } from '../data/loader';
import { money, pct } from '../lib/money';
import { calcularModelo, tablaFideicomiso } from './modelo';
import { calcularCuentas, enMeses } from './cuentas';
import { calcularControles, estadoPublicacion } from './controles';
import { historial, novedadesAutomaticas } from './historial';
import type { ConfigBarrio } from './tipos';
import cfgJson from './config/S2.json';

const datos = datosDeCopia();
const cfg = cfgJson as unknown as ConfigBarrio;
const OCT = 'S2-2026-10';
const SEP = 'S2-2026-09';

describe('Senderos II · octubre 2026', () => {
  const m = calcularModelo(datos, cfg, OCT)!;

  it('datos oficiales', () => {
    expect(money(m.gastoOficial)).toBe('$ 11.575.965,79');
    expect(money(m.repartidoOficial)).toBe('$ 11.575.919,42');
    expect(money(m.lotes[0].oficial)).toBe('$ 655.859,49');
    expect(money(m.lotes[1].oficial)).toBe('$ 426.308,00');
  });

  it('total y lotes del modelo', () => {
    expect(money(m.totalModelo)).toBe('$ 9.384.741,82');
    expect(money(m.lotes[0].modelo)).toBe('$ 531.713,44');
    expect(money(m.lotes[0].diferencia)).toBe('−$ 124.146,05');
    expect(pct({ num: BigInt(m.lotes[0].diferencia), den: BigInt(m.lotes[0].oficial) })).toBe('−18,93%');
    expect(money(m.lotes[1].modelo)).toBe('$ 345.613,20');
    expect(money(m.redondeo)).toBe('$ 0,14');
  });

  it('efecto de cada criterio en el barrio', () => {
    const e = Object.fromEntries(m.efectos.map((x) => [x.criterio.id, money(x.barrio)]));
    expect(e).toEqual({
      H30: '−$ 1.344.000,00',
      H26: '−$ 467.600,00',
      H32: '$ 71.878,25',
      H29: '−$ 162.432,00',
      H23: '−$ 142.276,07',
      H31: '−$ 70.398,97',
      H28: '−$ 49.323,18',
      H27: '−$ 27.072,00',
    });
    const suma = m.efectos.reduce((s, x) => s + x.barrio, 0);
    expect(m.gastoOficial + suma).toBe(m.totalModelo);
  });

  it('efecto por lote común y cierre exacto', () => {
    expect(m.efectos.map((x) => money(x.porLote[0]))).toEqual([
      '−$ 76.147,31',
      '−$ 26.492,92',
      '$ 4.072,42',
      '−$ 9.202,95',
      '−$ 8.060,97',
      '−$ 3.988,61',
      '−$ 2.794,51',
      '−$ 1.533,82',
    ]);
    expect(money(m.lotes[0].baseH01)).toBe('$ 2,63');
    expect(money(m.lotes[0].ajusteRedondeo)).toBe('−$ 0,01');
  });

  it('líneas recalculadas', () => {
    const l = (id: string) => m.lineas.find((x) => x.idGasto === id)!;
    expect(money(l('S2-2026-10-G010').modelo)).toBe('$ 25.530,01');
    expect(money(l('S2-2026-10-G003').modelo)).toBe('$ 448.880,82');
    expect(money(l('S2-2026-10-G015').modelo)).toBe('$ 5.738.468,08');
    expect(l('S2-2026-10-G017').modelo).toBe(0);
    expect(m.obras.map((o) => money(o.importe))).toEqual(['$ 1.344.000,00']);
  });

  it('mantenimiento del Fideicomiso', () => {
    const f = m.fbv!;
    expect(money(f.baseModelo)).toBe('$ 7.862.660,33');
    expect(money(f.propios.modelo)).toBe('$ 863.634,61');
    expect(money(f.comunes.modelo)).toBe('$ 200.655,09');
    expect(money(f.propios.oficial + f.comunes.oficial)).toBe('$ 1.181.915,45');
    expect(f.coefPublicadoUsado).toBe(true);
  });

  it('rubros', () => {
    const r = Object.fromEntries(m.rubros.map((x) => [x.rubro, [money(x.importe), pct(x.participacion)]]));
    expect(r['Seguridad']).toEqual(['$ 5.790.310,94', '61,70%']);
    expect(r['Mantenimiento']).toEqual(['$ 1.199.819,71', '12,78%']);
    expect(r['Administración y bancos']).toEqual(['$ 1.300.667,04', '13,86%']);
    expect(r['Luz']).toEqual(['$ 937.004,61', '9,98%']);
    expect(r['Internet de las cámaras']).toEqual(['$ 100.000,00', '1,07%']);
    expect(r['Seguro']).toEqual(['$ 41.804,00', '0,45%']);
    expect(r['Impuestos']).toEqual(['$ 15.135,52', '0,16%']);
    expect(m.rubros.reduce((s, x) => s + x.importe, 0)).toBe(m.totalModelo);
  });

  it('cada criterio se puede apagar', () => {
    const sinObra = calcularModelo(datos, cfg, OCT, { apagados: new Set(['H30']) })!;
    expect(money(sinObra.lotes[0].modelo)).toBe('$ 607.860,76');
    const todoApagado = calcularModelo(datos, cfg, OCT, { apagados: new Set(m.efectos.map((e) => e.criterio.id)) })!;
    expect(todoApagado.totalModelo).toBe(m.gastoOficial);
  });

  it('el orden importa: H29 antes de H32 cambia su efecto', () => {
    const c2 = structuredClone(cfg);
    const cr = c2.periodos[OCT].criterios;
    const orden = ['H30', 'H26', 'H29', 'H27', 'H32', 'H23', 'H31', 'H28'];
    c2.periodos[OCT].criterios = orden.map((id) => cr.find((c) => c.id === id)!);
    const m2 = calcularModelo(datos, c2, OCT)!;
    expect(money(m2.efectos.find((e) => e.criterio.id === 'H29')!.barrio)).toBe('−$ 153.119,99');
    expect(m2.totalModelo).toBe(m.totalModelo);
  });

  it('fondo de reserva (apagado por defecto)', () => {
    expect(m.reserva.aporte).toBe(0);
    const r = calcularModelo(datos, cfg, OCT, { reserva: true })!;
    expect(money(r.reserva.aporte)).toBe('$ 469.237,09');
    expect(money(r.reserva.porLote[0])).toBe('$ 26.585,67');
  });
});

describe('Senderos II · cuentas y controles de octubre', () => {
  const m = calcularModelo(datos, cfg, OCT)!;
  const c = calcularCuentas(datos, OCT, cfg.periodos[OCT])!;
  const ctr = calcularControles(datos, OCT, c, m);
  const por = (id: string) => ctr.find((x) => x.id === id)!;

  it('cuentas', () => {
    expect(money(c.saldoFinal)).toBe('$ 12.981.090,20');
    expect(money(c.plataLibre)).toBe('$ 851.338,85');
    expect(pct(enMeses(c.plataLibre, m.totalModelo), 0).replace('%', '')).toBe('9');
    expect(money(c.pendientesDetalle)).toBe('$ 8.475.574,96');
    expect(money(c.patrimonioCalculado)).toBe('$ 21.829.954,56');
    expect(c.morosidad.lotesConDeuda).toBe(4);
    expect(money(c.morosidad.deuda)).toBe('$ 5.828.997,89');
    expect(money(c.morosidad.intereses)).toBe('$ 630.536,77');
    expect(money(c.morosidad.cobrosSinIdentificar)).toBe('$ 902.350,00');
    const ext = c.fondos.find((f) => f.fondo === 'EXTRAORDINARIO')!;
    expect(money(ext.final - m.obras.reduce((s, o) => s + o.importe, 0))).toBe('$ 315.305,82');
  });

  it('controles', () => {
    expect(por('REPARTO').estado).toBe('OK');
    expect(por('CAJA').estado).toBe('OK');
    expect(por('BANCO').estado).toBe('PROBLEMA');
    expect(money(por('BANCO').esperado!)).toBe('$ 8.596.500,30');
    expect(money(por('BANCO').diferencia!)).toBe('−$ 4.964.585,84');
    expect(money(por('PENDIENTES').diferencia!)).toBe('$ 3.654.176,39');
    expect(por('PENDIENTES').explicadoPor).toBeTruthy();
    expect(por('PATRIMONIO').estado).toBe('PROBLEMA');
    expect(money(por('PATRIMONIO').diferencia!)).toBe('$ 3.654.176,39');
    expect(money(por('EGRESOS').diferencia!)).toBe('$ 27.714,23');
    expect(por('SIN_GASTO').estado).toBe('OK');
    const fact = por('FACTURAS').filas!.map((f) => f.texto).join('\n');
    expect(fact).toContain('2.º vencimiento con recargo');
  });

  it('no se publica si algo no cierra, salvo aclaración escrita', () => {
    const e = estadoPublicacion(ctr);
    expect(e.puede).toBe(false);
    const acl = Object.fromEntries(e.bloqueos.map((b) => [b.id, 'Aclaración escrita de la administración, con su documento.']));
    expect(estadoPublicacion(ctr, acl).puede).toBe(true);
  });
});

describe('Senderos II · septiembre 2026', () => {
  const m = calcularModelo(datos, cfg, SEP)!;
  it('H08 y caja chica', () => {
    const l = (id: string) => m.lineas.find((x) => x.idGasto === id)!;
    expect(money(l('S2-2026-09-G015').modelo)).toBe('$ 5.462.919,17');
    expect(money(m.efectos.find((e) => e.criterio.id === 'H08')!.barrio)).toBe('−$ 455.243,26');
    expect(money(l('S2-2026-09-G009').modelo)).toBe('$ 75.704,53');
    expect(money(m.fbv!.baseModelo)).toBe('$ 9.092.436,86');
    expect(m.efectos.find((e) => e.criterio.id === 'H07')!.aplicado).toBe(false);
  });
  it('egreso sin gasto (H14)', () => {
    const c = calcularCuentas(datos, SEP, cfg.periodos[SEP])!;
    const ctr = calcularControles(datos, SEP, c, m);
    const sg = ctr.find((x) => x.id === 'SIN_GASTO')!;
    expect(sg.estado).toBe('PROBLEMA');
    expect(sg.filas!.some((f) => f.texto.includes('se reclama'))).toBe(true);
  });
});

describe('Reparto del Fideicomiso', () => {
  it('porcentajes de los tres barrios', () => {
    const t = tablaFideicomiso(cfg);
    expect(pct(t.total.propios, 3)).toBe('44,418%');
    expect(pct(t.total.comunes, 3)).toBe('41,303%');
    const comb = Object.fromEntries(t.filas.map((f) => [f.barrio, pct(f.combinado, 3)]));
    expect(comb).toEqual({ S1: '15,106%', S2: '13,536%', LH: '15,153%' });
    expect(pct(t.total.combinado, 3)).toBe('43,795%');
  });
});

describe('Historial y novedades', () => {
  it('S2 desde junio y LH desde agosto', () => {
    expect(historial(datos, cfg, 'S2')[0].mes).toBe('2026-06');
    expect(historial(datos, null, 'LH')[0].mes).toBe('2026-08');
  });
  it('conceptos nuevos de octubre', () => {
    const n = novedadesAutomaticas(datos, 'S2', OCT).nuevos.map((v) => v.concepto);
    expect(n).toContain('Obra de cámaras (obra civil)');
    expect(n).toContain('Electricidad sectores comunes - Fideicomiso');
  });
});

import { otrosRepartos } from './repartos';
describe('Otros gastos compartidos', () => {
  it('porcentajes exactos', () => {
    const r = Object.fromEntries(otrosRepartos(datos, '2026-10').map((x) => [`${x.barrio} ${x.concepto}`, pct(x.pct!, 4)]));
    expect(r['S2 Caja chica Fideicomiso']).toBe('12,7650%');
    expect(r['S2 Electricidad sectores comunes - Fideicomiso']).toBe('8,5947%');
    expect(r['LH Electricidad sectores comunes - Fideicomiso']).toBe('9,6235%');
    expect(r['S2 Impuesto inmobiliario ARBA (cuota anual del predio)']).toBe('7,8420%');
    expect(r['LH Impuesto inmobiliario ARBA (cuota anual del predio)']).toBe('8,7807%');
    expect(r['LH Mantenimiento Fideicomiso - espacios comunes 20%']).toBe('14,2970%');
  });
});

describe('Privacidad', () => {
  it('los datos publicados no tienen nombres de archivo ni la columna Archivo', () => {
    const txt = JSON.stringify(datos);
    expect(txt).not.toMatch(/"Archivo"|"URL_Publica"|\.jpg|\.pdf"/);
  });
  it('CUIT de personas físicas enmascarados, salvo el del administrador', () => {
    const txt = JSON.stringify(datos);
    const cuits = txt.match(/\b2[0347]-\d{8}-\d\b/g) ?? [];
    expect(cuits.every((c) => c === '20-25787636-6')).toBe(true);
  });
});

describe('Privacidad de proveedores personas físicas', () => {
  it('se rotulan por CUIT enmascarado, sin nombre', () => {
    const ids = new Set(datos.sheets.PROVEEDORES.filter((p) => String(p.CUIT).includes('****')).map((p) => String(p.ID_Proveedor)));
    expect(ids.size).toBeGreaterThan(0);
    for (const p of datos.sheets.PROVEEDORES) if (ids.has(String(p.ID_Proveedor))) expect(String(p.Proveedor)).toMatch(/^Proveedor persona física/);
    for (const g of datos.sheets.GASTOS) if (ids.has(g.ID_Proveedor)) expect(g.Proveedor).toMatch(/^Proveedor persona física/);
  });
});
