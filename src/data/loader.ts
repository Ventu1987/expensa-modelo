import snapshot from './snapshot.json';
import type { Datos, Fila } from './types';
import { nombresDesdeParametros, sanitizar } from './privacidad';

// API pública de la auditoría (solo lectura). Se puede cambiar con VITE_AUDITORIA_API.
export const AUDITORIA_API =
  (import.meta.env?.VITE_AUDITORIA_API as string | undefined) ??
  'https://script.google.com/macros/s/AKfycbxkYAGwgYNEQuyZAYl6Aft6ZDMhQnTZGnTHpWHg2zNdj8JOBIRXIRWwuUbx7fOB93cl/exec';

export interface Carga {
  datos: Datos;
  origen: 'api' | 'copia';
  detalle: string;
}

async function conTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([p, new Promise<T>((_, rej) => setTimeout(() => rej(new Error('Tiempo de espera agotado')), ms))]);
}

/** Lee los datos de un barrio. Si la API no responde, usa la copia incluida en la app. */
export async function cargarDatos(barrio: string): Promise<Carga> {
  try {
    const r = await conTimeout(fetch(`${AUDITORIA_API}?action=data&barrio=${barrio}`), 9000);
    if (!r.ok) throw new Error(`La API respondió ${r.status}`);
    const json = (await r.json()) as Datos & { sheets: { PARAMETROS?: Fila[] } };
    if (!json?.sheets?.PERIODOS) throw new Error('La API no trajo la hoja PERIODOS');
    const nombres = nombresDesdeParametros(json.sheets.PARAMETROS);
    return { datos: sanitizar({ ...json, fuente: 'API pública de la auditoría' }, nombres), origen: 'api', detalle: `Actualizado ${json.updated ?? 'N/D'}` };
  } catch (e) {
    return {
      datos: sanitizar(snapshot as unknown as Datos),
      origen: 'copia',
      detalle: `Copia del ${(snapshot as { updated?: string }).updated ?? 'N/D'}. La API no respondió: ${(e as Error).message}`,
    };
  }
}

/** Datos sin red, para las pruebas. */
export function datosDeCopia(): Datos {
  return sanitizar(snapshot as unknown as Datos);
}
