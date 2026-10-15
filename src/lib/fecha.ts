const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** "2026-10-19" → "19/10/2026". Lo que no es fecha queda como N/D. */
export function fecha(iso: string | null | undefined): string {
  if (!iso) return 'N/D';
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso));
  return m ? `${m[3]}/${m[2]}/${m[1]}` : String(iso) === 'N/D' ? 'N/D' : String(iso);
}

/** "2026-10" → "Octubre 2026" */
export function mesLargo(mes: string): string {
  const [a, m] = mes.split('-');
  const n = MESES[Number(m) - 1];
  return n ? `${n[0].toUpperCase()}${n.slice(1)} ${a}` : mes;
}

/** "2026-10" → "octubre" */
export function mesNombre(mes: string): string {
  return MESES[Number(mes.split('-')[1]) - 1] ?? mes;
}

/** "2026-10" → "10/2026" */
export function mesCorto(mes: string): string {
  const [a, m] = mes.split('-');
  return `${m}/${a}`;
}

export function mesAnterior(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}

export function ultimoDia(mes: string): string {
  const [a, m] = mes.split('-').map(Number);
  const d = new Date(Date.UTC(a, m, 0));
  return `${mes}-${String(d.getUTCDate()).padStart(2, '0')}`;
}
