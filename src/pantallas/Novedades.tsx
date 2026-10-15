import { useEffect } from 'react';
import { useEstado } from '../estado';
import { Cabecera, Card, Chip, M } from '../ui/comun';
import { pct } from '../lib/money';
import { fecha, mesNombre } from '../lib/fecha';
import { novedadesAutomaticas, variaciones } from '../modelo/historial';
import { RESOLUCIONES } from '../modelo/resoluciones';

const TIPO_NOV: Record<string, { t: string; tono?: 'ok' | 'warn' | 'bad' | 'accent' }> = {
  CARGO_NUEVO: { t: 'Cargo nuevo', tono: 'warn' },
  CAMBIO_CRITERIO: { t: 'Cambio de criterio', tono: 'accent' },
  OBRA: { t: 'Obra', tono: 'accent' },
  AUMENTO: { t: 'Aumento', tono: 'warn' },
  AVISO: { t: 'Aviso' },
};
const COMO: Record<string, string> = { criterio: 'Se corrige', control: 'Se controla', seccion: 'Se muestra', pedido: 'Falta documento' };
const ESTADO_TONO: Record<string, 'ok' | 'warn' | 'bad' | undefined> = { SOLUCIONADO: 'ok', DESCARTADO: 'ok', 'EN GESTIÓN': 'warn', ABIERTO: 'bad' };

export function Novedades() {
  const e = useEstado();
  const p = e.oficial!.periodo;
  const nov = e.modelo?.config.novedades ?? [];
  const auto = novedadesAutomaticas(e.datos!, e.barrio, e.idPeriodo);
  const grandes = variaciones(e.datos!, e.barrio, e.idPeriodo).filter(
    (v) => v.variacion && !v.nuevo && Math.abs(Number(v.variacion.num * 1000n / v.variacion.den)) >= 200,
  );
  const hallazgos = e.datos!.sheets.HALLAZGOS.filter((h) => h.Publicable === 'SI' && String(h.Barrios).split(',').includes(e.barrio));
  const marcado = e.ruta.params.get('h');
  const respuestas = e.datos!.sheets.RESPUESTAS_ADMIN.filter((r) => r.Publicable === 'SI' && r.Barrio === e.barrio);

  useEffect(() => {
    if (marcado) document.getElementById(`res-${marcado}`)?.scrollIntoView({ block: 'center' });
  }, [marcado]);

  return (
    <>
      <Cabecera eyebrow={`${e.cfgVista?.nombre} · ${mesNombre(p.Mes)}`} titulo="Novedades" bajada="Qué cambia este mes, antes de que llegue a tu expensa." />
      <div className="cols">
        <Card titulo="Del mes">
          {nov.length === 0 && auto.nuevos.length === 0 && grandes.length === 0 && <span className="muted">Sin novedades cargadas.</span>}
          <div className="lista">
            {nov.map((n) => (
              <div key={n.titulo} className="stack-s">
                <span className="row">
                  <Chip tono={TIPO_NOV[n.tipo]?.tono}>{TIPO_NOV[n.tipo]?.t ?? n.tipo}</Chip>
                </span>
                <b>{n.titulo}</b>
                <span className="small">{n.texto}</span>
              </div>
            ))}
          </div>
        </Card>
        <Card titulo="Lo que detecta la app sola" bajada="Comparando con los meses anteriores de la liquidación oficial.">
          <div className="lista">
            {auto.nuevos.map((v) => (
              <div key={v.concepto} className="between">
                <span>
                  <Chip tono="warn">Concepto nuevo</Chip> {v.concepto}
                </span>
                <M c={v.actual} />
              </div>
            ))}
            {auto.dejaron.map((c) => (
              <div key={c} className="small">
                <Chip>Ya no aparece</Chip> {c}
              </div>
            ))}
            {grandes.map((v) => (
              <div key={v.concepto} className="between">
                <span className="small">
                  {v.concepto}: <span className="num">{pct(v.variacion!, 1, { signo: true })}</span> contra el mes anterior
                </span>
                <M c={v.diferencia} signo />
              </div>
            ))}
            {!auto.nuevos.length && !auto.dejaron.length && !grandes.length && <span className="small muted">Nada fuera de lo común.</span>}
          </div>
        </Card>

        <Card titulo="Cómo resuelve el modelo cada hallazgo" bajada="Son indicadores para revisar con la administración, no acusaciones." className="span-2">
          <div className="lista">
            {RESOLUCIONES.map((r) => {
              const h = hallazgos.find((x) => x.ID_Hallazgo === r.id);
              return (
                <div
                  key={r.id}
                  id={`res-${r.id}`}
                  className="stack-s"
                  style={marcado === r.id ? { background: 'var(--accent-bg)', borderRadius: 10, padding: 10 } : undefined}
                >
                  <div className="between">
                    <b>
                      <span className="mono">{r.id.length < 6 ? r.id : ''}</span> {r.titulo}
                    </b>
                    {h && <Chip tono={ESTADO_TONO[h.Estado]}>{h.Estado.toLowerCase()}</Chip>}
                  </div>
                  {h?.Conclusion_Simple && <span className="small muted">{h.Conclusion_Simple}</span>}
                  <span className="small">
                    <b>En el modelo:</b> {r.regla}
                  </span>
                  <span className="row">
                    {r.como.map((c) => (
                      <Chip key={c} tono={c === 'pedido' ? 'warn' : 'accent'}>
                        {COMO[c]}
                      </Chip>
                    ))}
                    <a className="small" href={`#/${r.donde.pagina}?p=${e.idPeriodo}`}>
                      {r.donde.texto}
                    </a>
                  </span>
                </div>
              );
            })}
          </div>
        </Card>

        {respuestas.length > 0 && (
          <Card titulo="Lo que respondió la administración" className="span-2">
            <div className="lista">
              {respuestas.map((r) => (
                <div key={String(r.ID_Respuesta)} className="stack-s">
                  <div className="between">
                    <span className="small muted">{fecha(String(r.Fecha))}</span>
                    <Chip tono={r.Estado === 'CUMPLIDO' ? 'ok' : r.Estado === 'NO APLICA' ? undefined : 'warn'}>{String(r.Estado).toLowerCase()}</Chip>
                  </div>
                  <span className="small">
                    <b>Dijo:</b> {String(r.Dijo)}
                  </span>
                  <span className="small">
                    <b>Los documentos muestran:</b> {String(r.Documentos_Muestran)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </>
  );
}
