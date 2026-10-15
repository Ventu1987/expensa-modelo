import { useEstado } from '../estado';
import { Cabecera, Card, Chip, M } from '../ui/comun';
import { cents } from '../lib/money';
import { mesCorto, mesNombre } from '../lib/fecha';
import { periodosDe } from '../modelo/modelo';

const ES_OBRA = /obra|cctv|equipamiento|cañer/i;

export function Obras() {
  const e = useEstado();
  const p = e.oficial!.periodo;
  const m = e.modelo;
  const c = e.cuentas!;
  const ext = c.fondos.find((f) => f.fondo === 'EXTRAORDINARIO');
  const usado = (m?.obras ?? []).reduce((s, o) => s + o.importe, 0);
  const ids = new Set(periodosDe(e.datos!, e.barrio).map((x) => x.ID_Periodo));
  const todas = e.datos!.sheets.GASTOS.filter((g) => ids.has(g.ID_Periodo) && (g.Tipo_Gasto === 'OBRA' || ES_OBRA.test(g.Concepto_Normalizado))).sort((a, b) =>
    a.Mes.localeCompare(b.Mes),
  );
  const nov = (m?.config.novedades ?? []).filter((n) => n.tipo === 'OBRA');
  const pend = [...c.deudas, ...c.creditos].filter((d) => /cámara|monitoreo/i.test(d.concepto));

  return (
    <>
      <Cabecera
        eyebrow={`${e.cfgVista?.nombre} · ${mesNombre(p.Mes)}`}
        titulo="Obras y extraordinarios"
        bajada="Una obra no es un gasto del mes: se aprueba con su presupuesto total y se paga con el fondo extraordinario."
      />
      <div className="cols">
        <Card titulo="Fondo extraordinario">
          {ext ? (
            <div className="lista small">
              <div className="between">
                <span>Saldo al cierre (oficial)</span>
                <M c={ext.final} />
              </div>
              {m?.obras.map((o) => (
                <div key={o.idGasto} className="between">
                  <span>Menos {o.concepto.toLowerCase()}</span>
                  <M c={-o.importe} />
                </div>
              ))}
              <div className="between">
                <b>Queda en el modelo</b>
                <b>
                  <M c={ext.final - usado} className={ext.final - usado < 0 ? 'bad' : ''} />
                </b>
              </div>
            </div>
          ) : (
            <span className="muted">N/D</span>
          )}
          {nov.map((n) => (
            <div key={n.titulo} className="aviso info small">
              <b>{n.titulo}.</b> {n.texto}
            </div>
          ))}
        </Card>

        <Card titulo="Lo que falta saber">
          <div className="lista">
            <div className="stack-s">
              <b>Presupuesto total de la obra</b>
              <span className="small muted">N/D. Sin el total aprobado no se puede saber cuánto falta pagar.</span>
            </div>
            {pend.map((d) => (
              <div key={d.concepto} className="stack-s">
                <div className="between">
                  <b>{d.concepto}</b>
                  {d.importe === null ? <span className="num warn">N/D</span> : <M c={d.importe} />}
                </div>
                <span className="small muted">{d.nota}</span>
                {d.hallazgo && <Chip tono="accent">{d.hallazgo}</Chip>}
              </div>
            ))}
          </div>
        </Card>

        <Card titulo="Obras y equipos de seguridad, mes a mes" className="span-2" bajada="Cómo los cobró la administración.">
          {todas.length ? (
            <div className="tabla-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Mes</th>
                    <th>Concepto</th>
                    <th className="num">Importe</th>
                    <th>Se cobró como</th>
                  </tr>
                </thead>
                <tbody>
                  {todas.map((g) => (
                    <tr key={g.ID_Gasto}>
                      <td>{mesCorto(g.Mes)}</td>
                      <td>{g.Concepto_Normalizado}</td>
                      <td className="num">
                        <M c={cents(g.Importe)} />
                      </td>
                      <td>
                        <Chip tono={g.Ordinario_Extraordinario === 'ORDINARIO' ? 'warn' : 'ok'}>{g.Ordinario_Extraordinario.toLowerCase()}</Chip>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <span className="muted">No hay obras cargadas para este barrio.</span>
          )}
        </Card>
      </div>
    </>
  );
}
