import { describe, expect, it } from 'vitest';
import { datosDeCopia } from '../data/loader';
import { money } from '../lib/money';
import { configOficial } from '../estado';
import { armarLiquidacion } from './liquidacion';
import type { ConfigBarrio } from '../modelo/tipos';
import cfgJson from '../modelo/config/S2.json';

const datos = datosDeCopia();
const cfg = cfgJson as unknown as ConfigBarrio;
const L = armarLiquidacion(datos, cfg, configOficial(datos, 'S2'), 'S2', 'S2-2026-10')!;

describe('Liquidación de Senderos II · octubre 2026', () => {
  it('gastos y comparación con septiembre', () => {
    expect(money(L.total)).toBe('$ 9.384.741,82');
    expect(money(L.totalAnterior!)).toBe('$ 8.882.027,83');
    expect(L.rubros.reduce((s, r) => s + r.actual, 0)).toBe(L.total);
    const seg = L.rubros.flatMap((r) => r.filas).find((f) => f.clave === 'Servicio de seguridad / vigilancia')!;
    expect(money(seg.anterior!)).toBe('$ 5.462.919,17');
    expect(seg.comprobante).toBe('Factura 0002-00003731');
    const luz = L.rubros.flatMap((r) => r.filas).find((f) => f.clave === 'Electricidad - EDENOR')!;
    expect(money(luz.actual)).toBe('$ 488.123,79'); // factura más el ajuste negativo
    expect(L.extraordinarios.map((x) => money(x.importe))).toEqual(['$ 1.344.000,00']);
  });
  it('variaciones sin explicar quedan marcadas', () => {
    expect(L.sinPorque.map((f) => f.etiqueta).sort()).toEqual(['Gastos bancarios Galicia', 'Gastos bancarios Roela', 'Sistema AdminProp']);
  });
  it('prorrateo exacto', () => {
    expect(L.cuotas.map((c) => money(c.cuota))).toEqual(['$ 531.713,44', '$ 345.613,20']);
    expect(money(L.cuotas[0].anterior!)).toBe('$ 503.231,06');
    expect(money(L.redondeo)).toBe('$ 0,14');
    expect(L.cuotas.reduce((s, c) => s + c.subtotal, 0) + L.redondeo).toBe(L.total);
  });
  it('flujo de fondos cierra con el banco del cierre', () => {
    const mov = L.flujo.filter((p) => p.tipo !== 'saldo').reduce((s, p) => s + p.importe, 0);
    expect(L.saldoInicial + mov).toBe(L.saldoFinal);
    expect(money(L.saldoFinal)).toBe('$ 12.981.090,20');
    expect(money(-L.flujo.find((p) => p.tipo === 'diferencia')!.importe)).toBe('$ 27.714,23');
  });
  it('plata libre, fondos y patrimonio', () => {
    expect(money(L.plataLibre)).toBe('$ 1.230.962,82');
    const f = Object.fromEntries(L.fondos.map((x) => [x.fondo, money(x.final)]));
    expect(f).toEqual({ ORDINARIO: '$ 12.665.784,38', EXTRAORDINARIO: '$ 315.305,82' });
    expect(L.fondos.reduce((s, x) => s + x.final, 0)).toBe(L.saldoFinal);
    expect(money(L.patrimonio.neto)).toBe('$ 20.486.006,16');
    expect(L.patrimonio.activo.some((a) => /telered/i.test(a.texto) && a.importe === 46760000)).toBe(true);
  });
  it('cargos particulares y regularizaciones', () => {
    expect(money(L.particulares.total)).toBe('$ 2.943.167,00');
    expect(L.particulares.lotes).toBeNull();
    expect(L.regularizaciones).toHaveLength(32); // H01 a H31 y H32; LH-10 aparece en La Huella
    expect(L.regularizaciones.find((r) => r.id === 'H30')!.estado).toBe('Corregido en esta liquidación');
    expect(money(L.regularizaciones.find((r) => r.id === 'H01')!.efectoLote!)).toBe('$ 2,63');
  });
  it('La Huella sin revisar muestra lo oficial y LH-10', () => {
    const LH = armarLiquidacion(datos, null, configOficial(datos, 'LH'), 'LH', 'LH-2026-10')!;
    expect(LH.esModelo).toBe(false);
    expect(money(LH.cuotas[0].cuota)).toBe('$ 526.354,00');
    expect(LH.regularizaciones.some((r) => r.id === 'LH-10')).toBe(true);
  });
  it('los comentarios editados reemplazan a los de la planilla', () => {
    const E = armarLiquidacion(datos, cfg, configOficial(datos, 'S2'), 'S2', 'S2-2026-10', {}, { porque: { 'Gastos bancarios - Roela': 'Comisiones nuevas' }, notas: { H01: 'Nota' } })!;
    expect(E.rubros.flatMap((r) => r.filas).find((f) => f.clave === 'Gastos bancarios - Roela')!.porque).toBe('Comisiones nuevas');
    expect(E.regularizaciones.find((r) => r.id === 'H01')!.nota).toBe('Nota');
    expect(E.sinPorque).toHaveLength(2);
  });
});

import { conAutomaticos } from '../modelo/automatico';
describe('Mes nuevo armado automáticamente', () => {
  // Simula que octubre recién llegó: sin criterios cargados, solo las reglas del barrio.
  const sinOct = structuredClone(cfg);
  delete sinOct.periodos['S2-2026-10'];
  const auto = conAutomaticos(datos, sinOct);
  const A = armarLiquidacion(datos, auto, configOficial(datos, 'S2'), 'S2', 'S2-2026-10')!;
  const fila = (c: string) => A.rubros.flatMap((r) => r.filas).find((f) => f.clave === c)!;
  it('aplica las reglas de cada mes', () => {
    expect(auto.periodos['S2-2026-10'].automatico).toBe(true);
    expect(money(fila('Servicio de seguridad / vigilancia').actual)).toBe('$ 5.738.468,08');
    expect(money(fila('Telered').actual)).toBe('$ 100.000,00');
    expect(money(fila('Caja chica Fideicomiso').actual)).toBe('$ 25.530,01');
    expect(A.extraordinarios.map((x) => money(x.importe))).toEqual(['$ 1.344.000,00']);
    // el Fideicomiso queda como lo liquidaron, a revisar
    expect(money(fila('Mantenimiento Fideicomiso - espacios propios 80%').actual)).toBe('$ 945.532,36');
  });
  it('lista lo que falta revisar', () => {
    const p = auto.periodos['S2-2026-10'].pendientes!;
    expect(p.some((x) => x.startsWith('Mantenimiento del Fideicomiso'))).toBe(true);
    expect(p.some((x) => x.includes('Electricidad sectores comunes'))).toBe(true);
  });
  it('no toca los meses ya revisados', () => {
    expect(conAutomaticos(datos, cfg)).toBe(cfg);
  });
});
