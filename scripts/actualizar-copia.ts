// Actualiza src/data/snapshot.json (la copia de respaldo) desde la API de la auditoría.
// Uso: npm run actualizar-copia
// Aplica las mismas reglas de privacidad que la app y deja solo las hojas que la app usa.
import { writeFileSync } from 'node:fs';
import { AUDITORIA_API } from '../src/data/loader';
import { nombresDesdeParametros, sanitizar } from '../src/data/privacidad';
import type { Datos } from '../src/data/types';

const HOJAS = ['BARRIOS', 'PERIODOS', 'GASTOS', 'DETALLE_COMPONENTES', 'PAGOS_PER_ANTERIORES', 'INGRESOS', 'EGRESOS_CAJA', 'FONDOS', 'SALDOS_PATRIMONIO', 'COMPROBANTES', 'MOVIMIENTOS_BANCO', 'PROVEEDORES', 'CONCEPTOS', 'HALLAZGOS', 'INDICES', 'FBV_ORDENES_PAGO', 'RESPUESTAS_ADMIN'];

const r = await fetch(`${AUDITORIA_API}?action=data&barrio=S2`);
if (!r.ok) throw new Error(`La API respondió ${r.status}`);
const j = await r.json();
const nombres = nombresDesdeParametros(j.sheets.PARAMETROS);
const sheets = Object.fromEntries(HOJAS.map((h) => [h, j.sheets[h] ?? []]));
const limpio = sanitizar({ version: j.version ?? null, updated: j.updated ?? null, fuente: 'Copia sanitizada de la API pública de la auditoría', sheets } as unknown as Datos, nombres);
const txt = JSON.stringify(limpio);
for (const n of nombres) if (txt.toLowerCase().includes(n.toLowerCase())) throw new Error('Quedó un nombre privado en la copia. No se guarda.');
writeFileSync(new URL('../src/data/snapshot.json', import.meta.url), txt);
console.log(`Copia actualizada: ${txt.length} bytes, ${limpio.sheets.PERIODOS.length} períodos.`);
