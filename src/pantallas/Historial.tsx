import { useEstado } from '../estado';
import { Cabecera, Card, M, P } from '../ui/comun';
import { money, ratioOf } from '../lib/money';
import { mesCorto } from '../lib/fecha';
import { historial } from '../modelo/historial';

export function Grafico({ puntos, etiquetas = ['Liquidada', 'Modelo'] }: { puntos: { mes: string; a: number; b: number | null }[]; etiquetas?: [string, string] }) {
  const W = 640;
  const H = 240;
  const pad = { l: 8, r: 8, t: 16, b: 28 };
  const vals = puntos.flatMap((p) => [p.a, p.b ?? p.a]);
  const max = Math.max(...vals) * 1.08;
  const min = Math.min(...vals) * 0.85;
  const x = (i: number) => pad.l + (puntos.length === 1 ? (W - pad.l - pad.r) / 2 : (i * (W - pad.l - pad.r)) / (puntos.length - 1));
  const y = (v: number) => pad.t + (1 - (v - min) / (max - min || 1)) * (H - pad.t - pad.b);
  const linea = (k: 'a' | 'b') =>
    puntos
      .map((p, i) => (p[k] === null ? null : `${x(i)},${y(p[k] as number)}`))
      .filter(Boolean)
      .join(' ');
  return (
    <div className="grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Expensa del lote mes a mes">
        <polyline points={linea('a')} fill="none" stroke="var(--muted)" strokeWidth="2.5" />
        <polyline points={linea('b')} fill="none" stroke="var(--accent)" strokeWidth="3" />
        {puntos.map((p, i) => (
          <g key={p.mes}>
            <circle cx={x(i)} cy={y(p.a)} r="4" fill="var(--muted)" />
            {p.b !== null && <circle cx={x(i)} cy={y(p.b)} r="5" fill="var(--accent)" />}
            <text x={x(i)} y={H - 8} textAnchor={i === 0 ? 'start' : i === puntos.length - 1 ? 'end' : 'middle'} fontSize="12" fill="var(--muted)">
              {mesCorto(p.mes)}
            </text>
          </g>
        ))}
      </svg>
      <div className="leyenda">
        <span>
          <i style={{ background: 'var(--muted)' }} />
          {etiquetas[0]}
        </span>
        <span>
          <i style={{ background: 'var(--accent)' }} />
          {etiquetas[1]}
        </span>
      </div>
    </div>
  );
}

export function Historial() {
  const e = useEstado();
  const h = historial(e.datos!, e.cfg, e.barrio);
  return (
    <>
      <Cabecera eyebrow={e.cfgVista?.nombre ?? ''} titulo="Historial" bajada="La expensa del lote tipo, mes a mes, desde que hay liquidaciones cargadas." />
      <div className="cols">
        <Card titulo="Expensa del lote común" className="span-2">
          <Grafico puntos={h.map((p) => ({ mes: p.mes, a: p.loteOficial, b: p.loteModelo }))} />
          <span className="xs muted">
            {h.map((p) => `${mesCorto(p.mes)}: ${money(p.loteOficial)}${p.loteModelo !== null ? ` (modelo ${money(p.loteModelo)})` : ''}`).join(' · ')}
          </span>
        </Card>
        <Card titulo="Mes a mes" className="span-2">
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Gasto real</th>
                  <th className="num">Repartido</th>
                  <th className="num">Lote liquidado</th>
                  <th className="num">Cambio</th>
                  <th className="num">Lote modelo</th>
                  <th className="num">IPC del mes</th>
                </tr>
              </thead>
              <tbody>
                {h.map((p, i) => (
                  <tr key={p.idPeriodo}>
                    <td>{mesCorto(p.mes)}</td>
                    <td className="num">
                      <M c={p.gasto} />
                    </td>
                    <td className={`num ${p.repartido !== p.gasto ? 'warn' : ''}`}>
                      <M c={p.repartido} />
                    </td>
                    <td className="num">
                      <M c={p.loteOficial} />
                    </td>
                    <td className="num">{i > 0 ? <P r={ratioOf(p.loteOficial - h[i - 1].loteOficial, h[i - 1].loteOficial)} d={1} signo /> : '—'}</td>
                    <td className="num">{p.loteModelo === null ? <span className="muted">pendiente</span> : <M c={p.loteModelo} />}</td>
                    <td className="num muted">{p.ipc ? <P r={p.ipc} d={1} /> : 'N/D'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="xs muted">
            Repartido en color de atención: la administración repartió un importe distinto del gasto real (H01). El IPC mensual del INDEC va solo como dato de referencia: la expensa no se
            compara contra la inflación, porque depende de contratos y servicios concretos.
          </p>
        </Card>
      </div>
    </>
  );
}
