import type { Datos, Fila } from './types';

// Sección 6 del contexto: lo que nunca se publica.
// - padrón, nombres de propietarios y deuda por lote (la app no lee el prorrateo por lote);
// - nombres de empleados (se reemplazan por "persona excluida");
// - CUIT de personas físicas, enmascarados salvo el del administrador;
// - nombres de archivo de cupones y respaldos;
// - el Excel del Banco Roela con otros consorcios (solo se leen movimientos del barrio).

const CUIT_ADMINISTRADOR = '20-25787636-6';
const COLUMNAS_FUERA = new Set(['Archivo', 'URL_Publica']);

/** 20257876366 → 20-25787636-6 */
function formatoCuit(d: string): string {
  return `${d.slice(0, 2)}-${d.slice(2, 10)}-${d.slice(10)}`;
}

/** Enmascara CUIT/CUIL de personas físicas (prefijos 20, 23, 24, 27). */
export function enmascararCuits(texto: string): string {
  return texto.replace(/\b(2[0347])-?(\d{4})(\d{4})-?(\d)\b/g, (m, p, a, _b, v) => {
    const plano = m.replace(/-/g, '');
    if (formatoCuit(plano) === CUIT_ADMINISTRADOR) return CUIT_ADMINISTRADOR;
    return `${p}-${a}****-${v}`;
  });
}

/**
 * Limpia los datos antes de mostrarlos.
 * `nombresPrivados` sale de la planilla (PARAMETROS → "Nombres que nunca se publican")
 * para que ningún nombre quede escrito en el código.
 */
export function sanitizar(datos: Datos, nombresPrivados: string[] = []): Datos {
  const nombres = nombresPrivados.map((n) => n.trim()).filter(Boolean);
  // Proveedores que son personas físicas (CUIT enmascarado): se publica el rubro, no el nombre.
  const fisicas = (datos.sheets.PROVEEDORES ?? [])
    .flatMap((p) => {
      const cuit = enmascararCuits(String(p.CUIT ?? ''));
      return [p.Proveedor, p.Nombre_Original].map((n) => ({ nombre: String(n ?? '').trim(), cuit }));
    })
    .filter((p) => p.nombre && !/persona física/i.test(p.nombre) && /^2[0347]-\d{4}\*{4}-\d$/.test(p.cuit));
  const palabras = [...new Set(fisicas.flatMap((p) => p.nombre.split(/\s+/)).filter((w) => w.length >= 4))];
  const reglas: [RegExp, string][] = [
    ...nombres.map((n) => [patronNombre(n), '(persona excluida)'] as [RegExp, string]),
    ...fisicas.map((p) => [new RegExp(`${patronNombre(p.nombre).source}(?:\\s*\\(2[0347]-\\d{4}\\*{4}-\\d\\))?`, 'gi'), `Proveedor persona física (${p.cuit})`] as [RegExp, string]),
    // Cualquier nombre seguido de un CUIT de persona física.
    [/[A-ZÁÉÍÓÚÑ][A-ZÁÉÍÓÚÑ .]*?\s*\((2[0347]-\d{4}\*{4}-\d)\)/g, 'Proveedor persona física ($1)'],
    // Restos sueltos (un apellido solo, otro orden): se reemplaza cada palabra del nombre.
    ...palabras.map((w) => [new RegExp(`(?<![\\p{L}])${patronNombre(w).source}(?![\\p{L}])`, 'giu'), '\u0000'] as [RegExp, string]),
    [/\u0000(?:\s+\u0000)*/g, 'persona física'],
  ];
  const limpiarTexto = (v: string) => {
    let t = enmascararCuits(v);
    for (const [re, r] of reglas) t = t.replace(re, r);
    return t;
  };
  const limpiarFila = (f: Fila): Fila => {
    const out: Fila = {};
    for (const [k, v] of Object.entries(f)) {
      if (COLUMNAS_FUERA.has(k)) continue;
      out[k] = typeof v === 'string' ? limpiarTexto(v) : v;
    }
    return out;
  };
  const sheets = Object.fromEntries(
    Object.entries(datos.sheets).map(([hoja, filas]) => [hoja, (filas as Fila[]).map(limpiarFila)]),
  ) as unknown as Datos['sheets'];
  // DETALLE_COMPONENTES: la deducción de sueldo nombra a una persona; se reescribe el concepto.
  sheets.DETALLE_COMPONENTES = sheets.DETALLE_COMPONENTES.map((f) =>
    Number(f.Importe) < 0 && f.Grupo === 'FBV_OP' ? { ...f, Concepto: 'Menos sueldo de la persona excluida del reparto' } : f,
  );
  // Por si el nombre está escrito distinto: todo lo que tenga CUIT de persona física se rotula por CUIT.
  const fisicaId = new Map(
    (sheets.PROVEEDORES ?? []).filter((p) => /^2[0347]-\d{4}\*{4}-\d$/.test(String(p.CUIT))).map((p) => [String(p.ID_Proveedor), String(p.CUIT)]),
  );
  for (const p of sheets.PROVEEDORES ?? []) if (fisicaId.has(String(p.ID_Proveedor))) p.Proveedor = `Proveedor persona física (${p.CUIT})`;
  for (const g of sheets.GASTOS) if (fisicaId.has(g.ID_Proveedor)) g.Proveedor = `Proveedor persona física (${fisicaId.get(g.ID_Proveedor)})`;
  for (const c of sheets.COMPROBANTES) {
    if (/^2[0347]-\d{4}\*{4}-\d$/.test(c.CUIT_Emisor)) c.Emisor = 'Persona física';
    if (/^2[0347]-\d{4}\*{4}-\d$/.test(c.CUIT_Destinatario)) c.Destinatario = 'Persona física';
    if (/^2[0347]-\d{4}\*{4}-\d$/.test(c.CUIT_Ordenante)) c.Ordenante = 'Persona física';
  }
  return { ...datos, sheets };
}

const VARIANTES: Record<string, string> = { a: 'aáàä', e: 'eéèë', i: 'iíìï', o: 'oóòö', u: 'uúùü', n: 'nñ' };

/** Regex que encuentra un nombre con o sin tildes, en mayúsculas o minúsculas. */
export function patronNombre(nombre: string): RegExp {
  const base = nombre.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  // Cada letra acepta tildes; las letras dobles aceptan una o dos ("Rollandi" encuentra "Rolandi").
  const runs = base.match(/(.)\1*/g) ?? [];
  const cuerpo = runs
    .map((run) => {
      const ch = run[0];
      const clase = VARIANTES[ch] ? `[${VARIANTES[ch]}]` : /\s/.test(ch) ? '\\s' : ch.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      return /\s/.test(ch) ? '\\s+' : run.length > 1 ? `${clase}{1,${run.length}}` : clase;
    })
    .join('');
  return new RegExp(cuerpo, 'gi');
}

/** Nombres configurados en la hoja PARAMETROS de la auditoría. */
export function nombresDesdeParametros(parametros: Fila[] | undefined): string[] {
  const fila = (parametros ?? []).find((p) => String(p.Descripcion ?? '').startsWith('Nombres'));
  return String(fila?.Valor ?? '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}
