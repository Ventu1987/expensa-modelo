import { useEffect, useState, type ReactNode } from 'react';
import { useEstado } from '../estado';
import { money, pct, type Cents, type Ratio } from '../lib/money';

/** Variación contra el mes anterior: sube = atención, baja = ok. */
export function Var({ r, nuevo, anterior }: { r: Ratio | null; nuevo?: boolean; anterior?: Cents | null }) {
  if (nuevo) return <span className="chip warn">Nuevo</span>;
  if (anterior === null || anterior === 0 || !r) return <span className="muted num">—</span>;
  const v = Number((r.num * 10000n) / r.den);
  const tono = v === 0 ? '' : v > 0 ? 'warn' : 'ok';
  return <span className={`num var ${tono}`}>{v === 0 ? '0,0%' : pct(r, 1, { signo: true })}</span>;
}

/** Texto que la administración puede editar. Fuera del modo edición se lee como texto común. */
export function Editable({
  tipo,
  clave,
  valor,
  falta,
  placeholder = 'Escribí el comentario',
  className = '',
}: {
  tipo: 'porque' | 'notas';
  clave: string;
  valor: string;
  falta?: boolean;
  placeholder?: string;
  className?: string;
}) {
  const e = useEstado();
  const [t, setT] = useState(valor);
  useEffect(() => setT(valor), [valor]);
  const editado = clave in e.ediciones[tipo];
  if (!e.editando) {
    if (falta) return <span className={`falta ${className}`}>Falta explicar la variación</span>;
    if (!valor) return null;
    return <span className={className}>{valor}</span>;
  }
  return (
    <span className={`editable ${className}`}>
      <textarea
        className="campo"
        value={t}
        placeholder={placeholder}
        onChange={(ev) => setT(ev.target.value)}
        onBlur={() => t !== valor && e.editar(tipo, clave, t)}
        aria-label={`Comentario: ${clave}`}
        rows={2}
      />
      {editado && <span className="xs accent-t">Cambio sin guardar en la planilla</span>}
    </span>
  );
}

export function Seccion({ id, n, titulo, bajada, children, nota }: { id: string; n: number; titulo: string; bajada?: ReactNode; children: ReactNode; nota?: string }) {
  const e = useEstado();
  const valor = e.liquidacion?.notas[nota ?? ''] ?? '';
  return (
    <section className="seccion" id={id}>
      <header className="seccion-cab">
        <span className="seccion-n num">{String(n).padStart(2, '0')}</span>
        <div>
          <h2>{titulo}</h2>
          {bajada && <p className="small muted">{bajada}</p>}
        </div>
      </header>
      {nota && (valor || e.editando) && (
        <div className="nota-adm">
          <span className="xs muted">Nota de la administración</span>
          <Editable tipo="notas" clave={nota} valor={valor} placeholder="Nota para esta sección (opcional)" />
        </div>
      )}
      {children}
    </section>
  );
}

/** Una fila de montos alineada: texto a la izquierda, importe a la derecha. */
export function Linea({ texto, importe, fuerte, sub, tono, nd }: { texto: ReactNode; importe: Cents | null; fuerte?: boolean; sub?: ReactNode; tono?: string; nd?: string }) {
  return (
    <div className={`linea-m ${fuerte ? 'fuerte' : ''}`}>
      <div className="grow">
        <span>{texto}</span>
        {sub && <div className="xs muted">{sub}</div>}
      </div>
      <span className={`num ${tono ?? ''}`}>{importe === null ? <span className={!nd || nd === 'N/D' ? 'warn' : ''}>{nd ?? 'N/D'}</span> : money(importe)}</span>
    </div>
  );
}

export const SECCIONES = [
  ['resumen', 'Tu expensa'],
  ['gastos', 'Gastos del mes'],
  ['prorrateo', 'Cómo se reparte'],
  ['flujo', 'Movimientos de la cuenta'],
  ['fondos', 'Fondos'],
  ['patrimonio', 'Estado patrimonial'],
  ['morosidad', 'Morosidad'],
  ['particulares', 'Cargos particulares'],
  ['obras', 'Obras'],
  ['fideicomiso', 'Mantenimiento del Fideicomiso'],
  ['proveedores', 'Proveedores y contratos'],
  ['novedades', 'Novedades y avisos'],
  ['regularizaciones', 'Regularizaciones'],
  ['indicadores', 'Indicadores'],
  ['documentacion', 'Documentación y contacto'],
] as const;

export function irA(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
