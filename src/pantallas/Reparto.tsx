import { useEstado, BARRIOS } from '../estado';
import { Cabecera, Card, Chip, Dif, M, P, Tec } from '../ui/comun';
import { mesNombre, mesLargo } from '../lib/fecha';
import { tablaFideicomiso } from '../modelo/modelo';
import { otrosRepartos } from '../modelo/repartos';

const nombreBarrio = (id: string) => BARRIOS.find((b) => b.id === id)?.nombre ?? id;

export function Reparto() {
  const e = useEstado();
  const cfg = e.cfgVista!;
  const t = tablaFideicomiso(cfg);
  const f = e.modelo?.fbv ?? null;
  const p = e.oficial!.periodo;
  const otros = otrosRepartos(e.datos!, p.Mes);

  return (
    <>
      <Cabecera
        eyebrow="Fideicomiso Bella Vista"
        titulo="Cómo se reparte el mantenimiento del predio"
        bajada="El Fideicomiso cobra a cada barrio un porcentaje de sus costos: 80% de mantenimiento de espacios propios y 20% de espacios comunes."
      />
      <div className="cols">
        <Card titulo="Porcentaje de cada barrio" bajada={cfg.coefFideicomisoFuente} className="span-2">
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Barrio</th>
                  <th className="num">Propios (80%)</th>
                  <th className="num">Comunes (20%)</th>
                  <th className="num">Sobre el total</th>
                </tr>
              </thead>
              <tbody>
                {t.filas.map((r) => (
                  <tr key={r.barrio} style={r.barrio === e.barrio ? { background: 'var(--accent-bg)' } : undefined}>
                    <td>{nombreBarrio(r.barrio)}</td>
                    <td className="num">
                      <P r={r.propios} d={3} />
                    </td>
                    <td className="num">
                      <P r={r.comunes} d={3} />
                    </td>
                    <td className="num">
                      <P r={r.combinado} d={3} />
                    </td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Los tres barrios</td>
                  <td className="num">
                    <P r={t.total.propios} d={3} />
                  </td>
                  <td className="num">
                    <P r={t.total.comunes} d={3} />
                  </td>
                  <td className="num">
                    <P r={t.total.combinado} d={3} />
                  </td>
                </tr>
                <tr>
                  <td className="muted">Resto (no asignado a estos barrios)</td>
                  <td className="num muted">
                    <P r={t.resto.propios} d={3} />
                  </td>
                  <td className="num muted">
                    <P r={t.resto.comunes} d={3} />
                  </td>
                  <td className="num muted">
                    <P r={t.resto.combinado} d={3} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p className="small">
            Entre los tres barrios pagan menos de la mitad del mantenimiento. Falta la tabla oficial del Fideicomiso que diga quién paga el resto: N/D.
          </p>
          <Tec>
            <span>Sobre el total = 80% × propios + 20% × comunes.</span>
            <span>Los porcentajes salen de las liquidaciones de 09/2026 de cada barrio. Se corrigen en la planilla del modelo, hoja COEF_FBV, cuando llegue la tabla oficial.</span>
          </Tec>
        </Card>

        {f ? (
          <Card titulo={`Lo que paga ${cfg.nombre} en ${mesNombre(p.Mes)}`} bajada="Base del mantenimiento, qué se saca y por qué.">
            <div className="lista">
              {f.base.map((b) => (
                <div key={b.concepto} className="between small">
                  <span>{b.concepto}</span>
                  <M c={b.importe} />
                </div>
              ))}
              <div className="between">
                <b>Base informada</b>
                <b>
                  <M c={f.baseTotal} />
                </b>
              </div>
              {f.exclusiones.map((x) => (
                <div key={x.criterio} className="between small">
                  <span>
                    Menos: {x.titulo} {x.estimado && <Chip tono="warn">ESTIMADO</Chip>}
                  </span>
                  <M c={-x.importe} />
                </div>
              ))}
              <div className="between">
                <b>Base del modelo</b>
                <b>
                  <M c={f.baseModelo} />
                </b>
              </div>
            </div>
          </Card>
        ) : (
          <Card titulo={`${cfg.nombre} en ${mesNombre(p.Mes)}`}>
            <div className="aviso info small">Modelo pendiente: falta cargar la base del mantenimiento del Fideicomiso para este mes.</div>
          </Card>
        )}

        {f && (
          <Card titulo="Propios y comunes: oficial contra modelo">
            <div className="lista">
              {[
                { n: 'Espacios propios', parte: f.partePropios, coef: f.coefPropios, d: f.propios },
                { n: 'Espacios comunes', parte: f.parteComunes, coef: f.coefComunes, d: f.comunes },
              ].map((r) => (
                <div key={r.n} className="stack-s">
                  <b>{r.n}</b>
                  <span className="small muted">
                    <M c={f.baseModelo} /> × <P r={r.parte} d={0} /> × <P r={r.coef} /> = <M c={r.d.modelo} />
                  </span>
                  <div className="grilla-montos">
                    <div>
                      <span>Oficial</span>
                      <M c={r.d.oficial} />
                    </div>
                    <div>
                      <span>Modelo</span>
                      <M c={r.d.modelo} />
                    </div>
                    <div>
                      <span>Diferencia</span>
                      <Dif c={r.d.modelo - r.d.oficial} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            {f.coefPublicadoUsado ? (
              <div className="aviso small">
                Se usa el coeficiente publicado de propios (<P r={f.coefPropios} />) aunque te cobre más: es el que corresponde.
              </div>
            ) : null}
          </Card>
        )}

        <Card titulo={`Otros gastos compartidos · ${mesLargo(p.Mes)}`} bajada="Qué porcentaje se le cobró a cada barrio. Si no hay base documentada, N/D." className="span-2">
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Barrio</th>
                  <th>Concepto</th>
                  <th className="num">Liquidado</th>
                  <th className="num">Base</th>
                  <th className="num">% aplicado</th>
                  <th className="num">% en la liquidación</th>
                </tr>
              </thead>
              <tbody>
                {otros.map((o) => (
                  <tr key={`${o.barrio}-${o.concepto}`}>
                    <td>{nombreBarrio(o.barrio)}</td>
                    <td>{o.concepto}</td>
                    <td className="num">
                      <M c={o.liquidado} />
                    </td>
                    <td className="num" title={o.fuenteBase}>
                      <M c={o.base} />
                    </td>
                    <td className="num">
                      <P r={o.pct} d={4} />
                    </td>
                    <td className="num">{o.pctDocumento ? <P r={o.pctDocumento} d={4} /> : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Tec>
            <span>% aplicado = liquidado ÷ base. La base es la informada en la liquidación o, si no figura, la suma de las facturas del Fideicomiso cargadas en la auditoría.</span>
            <span>Si un mismo concepto da porcentajes distintos entre meses o contra el % publicado, se marca para revisar con la administración.</span>
          </Tec>
        </Card>
      </div>
    </>
  );
}
