import type { ReactNode } from 'react';
import { money, pct, type Cents, type Ratio } from '../lib/money';
import type { EstadoControl } from '../modelo/controles';

export function M({ c, signo, className = '' }: { c: Cents | null | undefined; signo?: boolean; className?: string }) {
  if (c === null || c === undefined) return <span className={`num ${className}`}>N/D</span>;
  return <span className={`num ${className}`}>{money(c, { signo })}</span>;
}

export function P({ r, d = 2, signo }: { r: Ratio | null | undefined; d?: number; signo?: boolean }) {
  if (!r) return <span className="num">N/D</span>;
  return <span className="num">{pct(r, d, { signo })}</span>;
}

/** Diferencia coloreada: baja = verde, sube = atención. */
export function Dif({ c, invertir }: { c: Cents | null; invertir?: boolean }) {
  if (c === null) return <span className="num muted">N/D</span>;
  const clase = c === 0 ? 'muted' : (c < 0) !== !!invertir ? 'ok' : 'warn';
  return <span className={`num ${clase}`}>{money(c, { signo: true })}</span>;
}

export function Chip({ children, tono }: { children: ReactNode; tono?: 'ok' | 'warn' | 'bad' | 'accent' }) {
  return <span className={`chip ${tono ?? ''}`}>{children}</span>;
}

const TONO: Record<EstadoControl, 'ok' | 'warn' | 'bad' | undefined> = { OK: 'ok', REVISAR: 'warn', PROBLEMA: 'bad', 'N/D': undefined };
const TEXTO: Record<EstadoControl, string> = { OK: 'Cierra', REVISAR: 'REVISAR', PROBLEMA: 'No cierra', 'N/D': 'N/D' };
export function EstadoChip({ e }: { e: EstadoControl }) {
  return <Chip tono={TONO[e]}>{TEXTO[e]}</Chip>;
}

/** Frase simple arriba; el detalle técnico, desplegable. */
export function Tec({ titulo = 'Ver detalle técnico', children }: { titulo?: string; children: ReactNode }) {
  return (
    <details className="tec">
      <summary>{titulo}</summary>
      <div className="cuerpo">{children}</div>
    </details>
  );
}

export function Card({ titulo, bajada, children, className = '', id }: { titulo?: ReactNode; bajada?: ReactNode; children: ReactNode; className?: string; id?: string }) {
  return (
    <section className={`card ${className}`} id={id}>
      {(titulo || bajada) && (
        <header>
          {titulo && <h2>{titulo}</h2>}
          {bajada && <span className="small muted">{bajada}</span>}
        </header>
      )}
      {children}
    </section>
  );
}

export function Cabecera({ eyebrow, titulo, bajada }: { eyebrow: ReactNode; titulo: ReactNode; bajada?: ReactNode }) {
  return (
    <div className="cabecera">
      <span className="eyebrow">{eyebrow}</span>
      <h1>{titulo}</h1>
      {bajada && <p className="muted">{bajada}</p>}
    </div>
  );
}

export function Barra({ valor, max }: { valor: number; max: number }) {
  const w = max > 0 ? Math.max(0, Math.min(100, (valor / max) * 100)) : 0;
  return (
    <div className="barra" aria-hidden="true">
      <i style={{ width: `${w}%` }} />
    </div>
  );
}

export function BarraDoble({ oficial, modelo, max }: { oficial: number; modelo: number; max: number }) {
  const w = (v: number) => (max > 0 ? Math.max(0, Math.min(100, (v / max) * 100)) : 0);
  return (
    <div className="barra doble" aria-hidden="true">
      <i className="of" style={{ width: `${w(oficial)}%` }} />
      <i className="mo" style={{ width: `${w(modelo)}%` }} />
    </div>
  );
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="switch" title={label}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export function Hallazgos({ ids }: { ids: string[] }) {
  if (!ids.length) return null;
  return (
    <span className="row">
      {ids.map((h) => (
        <span key={h} className="chip accent">
          {h}
        </span>
      ))}
    </span>
  );
}

const PATHS: Record<string, string> = {
  expensa: 'M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z',
  peso: 'M12 3v18M17 7.5C17 5.6 14.8 4.5 12 4.5S7 5.6 7 7.6c0 4.9 10 2.6 10 7.6 0 2-2.2 3.3-5 3.3s-5-1.2-5-3.2',
  reparto: 'M12 3a9 9 0 1 0 9 9h-9zM14 3.2V10h6.8A9 9 0 0 0 14 3.2z',
  cuentas: 'M4 5h16v14H4zM4 9h16M8 14h3',
  morosidad: 'M12 8v5M12 16.5v.5M10.3 4l-8 14a2 2 0 0 0 1.7 3h16a2 2 0 0 0 1.7-3l-8-14a2 2 0 0 0-3.4 0z',
  obras: 'M3 21h18M5 21V10l7-5 7 5v11M10 21v-6h4v6',
  modelo: 'M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0M14 4v4M8 10v4M16 16v4',
  historial: 'M3 3v18h18M7 15l4-4 3 3 5-6',
  novedades: 'M6 8a6 6 0 0 1 12 0c0 7 3 8 3 8H3s3-1 3-8M10 20a2 2 0 0 0 4 0',
  resumen: 'M6 3h9l4 4v14H6zM14 3v5h5M9 13h7M9 17h5',
  admin: 'M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6zM9 12l2 2 4-4',
  mas: 'M5 12h.01M12 12h.01M19 12h.01',
};
export function Icono({ n }: { n: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[n] ?? PATHS.mas} />
    </svg>
  );
}
