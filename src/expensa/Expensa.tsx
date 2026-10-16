import { useEstado } from '../estado';
import { Chip, M, P } from '../ui/comun';
import { money, mulRound, pct, ratio, ratioOf } from '../lib/money';
import { fecha, mesLargo, mesNombre, ultimoDia } from '../lib/fecha';
import { Editable, Linea, Seccion, Var } from './piezas';
import { Cuenta } from './Cuenta';
import { Informacion } from './Informacion';
import type { FilaGasto, Liquidacion } from './liquidacion';

const RESPALDO: Record<string, { t: string; c: string }> = {
  FISCAL: { t: 'Con factura', c: 'ok' },
  PARCIAL: { t: 'Respaldo parcial', c: 'warn' },
  SIN: { t: 'Sin factura cargada', c: 'bad' },
};

function Comprobante({ f }: { f: FilaGasto }) {
  const e = useEstado();
  return (
    <button className="link-comp" onClick={() => e.verComprobantes(f.idsGasto[0])} title="Ver comprobantes">
      <span className={`punto ${RESPALDO[f.respaldo].c}`} aria-hidden="true" />
      <span>{f.comprobante}</span>
    </button>
  );
}

function Porque({ f }: { f: FilaGasto }) {
  return (
    <span className="porque">
      <Editable tipo="porque" clave={f.clave} valor={f.porqueOrigen === 'falta' ? '' : f.porque} falta={f.porqueOrigen === 'falta'} placeholder="Por qué cambió este gasto" />
      {f.supuesto && <Chip tono="warn">{f.supuesto}</Chip>}
    </span>
  );
}

function Encabezado({ L }: { L: Liquidacion }) {
  const e = useEstado();
  const p = L.modelo.periodo;
  const adm = e.cfg?.administracion;
  const recargo = p.Recargo_Vencimiento !== '' && p.Recargo_Vencimiento !== null ? ratio(String(p.Recargo_Vencimiento)) : null;
  return (
    <header className="doc-cab">
      <div className="doc-cab-izq">
        <span className="eyebrow">Liquidación de expensas</span>
        <h1>{e.cfgVista?.nombre}</h1>
        <span className="small muted">
          {p.Consorcio} · CUIT {p.CUIT_Consorcio || 'N/D'}
        </span>
      </div>
      <div className="doc-cab-der">
        <div>
          <span className="xs muted">Período</span>
          <b>{mesLargo(L.mes)}</b>
        </div>
        <div>
          <span className="xs muted">Vencimiento</span>
          <b>{fecha(p.Fecha_Vencimiento)}</b>
        </div>
        <div>
          <span className="xs muted">Después del vencimiento</span>
          <b>{recargo ? `+${pct(recargo)}` : 'N/D'}</b>
        </div>
        <div>
          <span className="xs muted">Administración</span>
          <b>{adm?.nombre ?? 'N/D'}</b>
          <span className="xs muted">Matrícula {adm?.matricula ?? 'N/D'}</span>
        </div>
      </div>
      {!L.esModelo && (
        <div className="aviso info small" style={{ gridColumn: '1 / -1' }}>
          Este mes todavía no tiene la liquidación revisada: se muestran los importes que liquidó la administración anterior, sin correcciones.
        </div>
      )}
    </header>
  );
}

function Resumen({ L }: { L: Liquidacion }) {
  const e = useEstado();
  const i = Math.min(e.tipoLote, L.cuotas.length - 1);
  const c = L.cuotas[i];
  const p = L.modelo.periodo;
  const recargo = p.Recargo_Vencimiento !== '' && p.Recargo_Vencimiento !== null ? ratio(String(p.Recargo_Vencimiento)) : null;
  const filas = L.rubros.flatMap((r) => r.filas);
  const claves = filas
    .filter((f) => f.anterior !== null || f.nuevo)
    .map((f) => ({ f, d: f.actual - (f.anterior ?? 0) }))
    .filter((x) => x.d !== 0)
    .sort((a, b) => Math.abs(b.d) - Math.abs(a.d))
    .slice(0, 3);
  const difTotal = L.totalAnterior !== null ? L.total - L.totalAnterior : null;
  return (
    <Seccion id="resumen" n={1} titulo={`Tu expensa de ${mesNombre(L.mes)}`} nota="RESUMEN">
      {L.cuotas.length > 1 && (
        <div className="tema" role="group" aria-label="Tipo de lote">
          {L.cuotas.map((q, k) => (
            <button key={q.tipo} className={i === k ? 'activo' : ''} onClick={() => e.setTipoLote(k)} aria-pressed={i === k}>
              {q.tipo}
            </button>
          ))}
        </div>
      )}
      <div className="cols">
        <div className="card destacado">
          <span className="small muted">Cuota de {c.tipo.toLowerCase()}</span>
          <span className="grande">{money(c.cuota + c.reserva)}</span>
          <div className="row">
            <span className="pill">Vence {fecha(p.Fecha_Vencimiento)}</span>
            {recargo && <span className="pill">Después: {money(mulRound(c.cuota + c.reserva, { num: recargo.den + recargo.num, den: recargo.den }))}</span>}
          </div>
          {c.anterior !== null && (
            <p className="small">
              El mes pasado fue <M c={c.anterior} />:{' '}
              <b className={c.cuota > c.anterior ? 'warn' : 'ok'}>
                {c.cuota > c.anterior ? 'sube' : 'baja'} {money(Math.abs(c.cuota - c.anterior))} ({pct(ratioOf(c.cuota - c.anterior, c.anterior), 1, { signo: true })})
              </b>
              .
            </p>
          )}
          {c.reserva > 0 && (
            <span className="small">
              Incluye <M c={c.reserva} /> de aporte al fondo de reserva.
            </span>
          )}
          <span className="xs muted">Tu cupón suma, si corresponden, saldo anterior, intereses y cargos particulares de tu lote.</span>
        </div>
        <div className="card">
          <b>Qué cambió este mes</b>
          <p className="small">
            El barrio gastó <M c={L.total} />
            {difTotal !== null && (
              <>
                , {difTotal >= 0 ? 'más' : 'menos'} que el mes pasado (<M c={L.totalAnterior} />, {pct(ratioOf(difTotal, L.totalAnterior || 1), 1, { signo: true })})
              </>
            )}
            .
          </p>
          <div className="lista">
            {claves.map(({ f, d }) => (
              <div key={f.clave} className="stack-s">
                <div className="between">
                  <span>{f.etiqueta}</span>
                  <span className={`num ${d > 0 ? 'warn' : 'ok'}`}>{money(d, { signo: true })}</span>
                </div>
                <span className="xs muted">{f.porqueOrigen === 'falta' ? 'Falta explicar la variación.' : f.porque}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="card">
        <b>De cada $ 100 de expensa</b>
        <div className="cien" role="img" aria-label="Reparto por rubro">
          {L.rubros.map((r, k) => (
            <i key={r.nombre} style={{ flexGrow: Number((r.participacion.num * 10000n) / r.participacion.den), background: `var(--serie-${(k % 7) + 1})` }} title={r.nombre} />
          ))}
        </div>
        <div className="leyenda">
          {L.rubros.map((r, k) => (
            <span key={r.nombre}>
              <i style={{ background: `var(--serie-${(k % 7) + 1})` }} />
              {r.nombre} <b className="num">$ {pct(r.participacion, 2).replace('%', '')}</b>
            </span>
          ))}
        </div>
      </div>
    </Seccion>
  );
}

function Gastos({ L }: { L: Liquidacion }) {
  return (
    <Seccion
      id="gastos"
      n={2}
      titulo="Gastos del mes"
      bajada={`Cada gasto con su comprobante, comparado con ${L.previo ? 'el mes anterior' : 'el mes anterior (N/D)'}. Tocá el comprobante para verlo.`}
      nota="GASTOS"
    >
      <div className="card tabla-gastos">
        <div className="solo-pc tabla-wrap">
          <table>
            <thead>
              <tr>
                <th>Concepto</th>
                <th>Comprobante</th>
                <th className="num">Mes anterior</th>
                <th className="num">Este mes</th>
                <th className="num">Var.</th>
                <th>Por qué</th>
                <th>Estado</th>
              </tr>
            </thead>
            {L.rubros.map((r) => (
              <tbody key={r.nombre}>
                <tr className="rubro">
                  <td colSpan={2}>
                    {r.nombre} <span className="xs muted num">{pct(r.participacion)}</span>
                  </td>
                  <td className="num">{r.anterior === null || r.anterior === 0 ? '—' : money(r.anterior)}</td>
                  <td className="num">{money(r.actual)}</td>
                  <td className="num">
                    <Var r={r.variacion} anterior={r.anterior} />
                  </td>
                  <td colSpan={2} />
                </tr>
                {r.filas.map((f) => (
                  <tr key={f.clave}>
                    <td>
                      {f.etiqueta}
                      <div className="xs muted">
                        {f.proveedor}
                        {f.periodoServicio ? ` · servicio ${f.periodoServicio.slice(5)}/${f.periodoServicio.slice(0, 4)}` : ''}
                      </div>
                      {f.lineas.length > 1 && (
                        <div className="xs muted">
                          {f.lineas.map((l) => money(L.esModelo ? l.modelo : l.oficial)).join(' + ')}
                        </div>
                      )}
                    </td>
                    <td>
                      <Comprobante f={f} />
                    </td>
                    <td className="num">{f.anterior === null ? '—' : money(f.anterior)}</td>
                    <td className="num">
                      <b>{money(f.actual)}</b>
                    </td>
                    <td className="num">
                      <Var r={f.variacion} nuevo={f.nuevo} anterior={f.anterior} />
                    </td>
                    <td className="col-porque">
                      <Porque f={f} />
                    </td>
                    <td>
                      <span className={`xs estado-${f.estado.toLowerCase()}`}>{f.estado}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            ))}
            <tbody>
              <tr className="total">
                <td colSpan={2}>Total de gastos del mes</td>
                <td className="num">{L.totalAnterior === null ? '—' : money(L.totalAnterior)}</td>
                <td className="num">{money(L.total)}</td>
                <td className="num">
                  <Var r={L.totalAnterior ? ratioOf(L.total - L.totalAnterior, L.totalAnterior) : null} anterior={L.totalAnterior} />
                </td>
                <td colSpan={2} />
              </tr>
            </tbody>
          </table>
        </div>

        <div className="solo-cel stack">
          {L.rubros.map((r) => (
            <div key={r.nombre} className="stack-s">
              <div className="rubro-cel between">
                <b>{r.nombre}</b>
                <span className="row" style={{ flexWrap: 'nowrap' }}>
                  <b className="num">{money(r.actual)}</b>
                  <Var r={r.variacion} anterior={r.anterior} />
                </span>
              </div>
              {r.filas.map((f) => (
                <div key={f.clave} className="gasto-cel">
                  <div className="between">
                    <span className="grow">{f.etiqueta}</span>
                    <b className="num">{money(f.actual)}</b>
                  </div>
                  <div className="between xs muted">
                    <span>
                      Mes anterior {f.anterior === null ? '—' : money(f.anterior)} · {f.estado.toLowerCase()}
                    </span>
                    <Var r={f.variacion} nuevo={f.nuevo} anterior={f.anterior} />
                  </div>
                  <div className="small">
                    <Porque f={f} />
                  </div>
                  <Comprobante f={f} />
                </div>
              ))}
            </div>
          ))}
          <div className="between rubro-cel">
            <b>Total de gastos del mes</b>
            <b className="num">{money(L.total)}</b>
          </div>
        </div>
        <div className="leyenda">
          <span>
            <i className="punto ok" /> Con factura
          </span>
          <span>
            <i className="punto warn" /> Respaldo parcial
          </span>
          <span>
            <i className="punto bad" /> Sin factura cargada
          </span>
        </div>
      </div>

      {L.extraordinarios.length > 0 && (
        <div className="card">
          <b>Pagados con el fondo extraordinario</b>
          <span className="small muted">No forman parte de la expensa del mes.</span>
          {L.extraordinarios.map((x) => (
            <Linea key={x.concepto} texto={x.concepto} importe={x.importe} sub={x.porque} />
          ))}
        </div>
      )}
    </Seccion>
  );
}

function Prorrateo({ L }: { L: Liquidacion }) {
  const e = useEstado();
  const res = L.cuotas.some((c) => c.reserva > 0);
  return (
    <Seccion id="prorrateo" n={3} titulo="Cómo se reparte" bajada="El gasto del mes se reparte entre todos los lotes según su coeficiente. Se reparte exactamente lo gastado." nota="PRORRATEO">
      <div className="card">
        <div className="tabla-wrap">
          <table className="apilable">
            <thead>
              <tr>
                <th>Tipo de lote</th>
                <th className="num">Lotes</th>
                <th className="num">Coeficiente</th>
                <th className="num">Cuota</th>
                <th className="num">Mes anterior</th>
                {res && <th className="num">Reserva</th>}
                <th className="num">Subtotal</th>
              </tr>
            </thead>
            <tbody>
              {L.cuotas.map((c) => (
                <tr key={c.tipo}>
                  <td>{c.tipo}</td>
                  <td className="num" data-l="Lotes">{c.cantidad}</td>
                  <td className="num" data-l="Coeficiente">
                    <P r={c.coef} d={4} />
                  </td>
                  <td className="num" data-l="Cuota">
                    <b>{money(c.cuota)}</b>
                  </td>
                  <td className="num" data-l="Mes anterior">{c.anterior === null ? '—' : money(c.anterior)}</td>
                  {res && <td className="num" data-l="Reserva">{money(c.reserva)}</td>}
                  <td className="num" data-l="Subtotal">{money(c.subtotal)}</td>
                </tr>
              ))}
              <tr>
                <td colSpan={res ? 6 : 5}>Redondeo (centavos que no entran en ninguna cuota)</td>
                <td className="num" data-l="">{money(L.redondeo)}</td>
              </tr>
              <tr className="total">
                <td colSpan={res ? 6 : 5}>Total repartido = gasto del mes</td>
                <td className="num" data-l="">{money(L.total)}</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="row">
          <Chip tono={e.cfgVista?.coefEstado === 'OK' ? 'ok' : 'warn'}>Coeficientes: {e.cfgVista?.coefEstado}</Chip>
          <span className="xs muted">{e.cfgVista?.coefFuente}</span>
        </div>
        <span className="small">
          Aparte de la cuota, {L.particulares.total ? <M c={L.particulares.total} /> : 'N/D'} de cargos particulares que pagan solo los lotes que corresponden (sección 8).
        </span>
      </div>
    </Seccion>
  );
}

export function Expensa() {
  const e = useEstado();
  const L = e.liquidacion;
  if (!L) return null;
  return (
    <article className="documento">
      <Encabezado L={L} />
      <Resumen L={L} />
      <Gastos L={L} />
      <Prorrateo L={L} />
      <Cuenta L={L} />
      <Informacion L={L} />
      <footer className="xs muted doc-pie">
        Liquidación de {mesLargo(L.mes)} · cierre {fecha(ultimoDia(L.mes))}. Cada importe sale de un comprobante o de un supuesto escrito. N/D: dato que falta. REVISAR: dato a confirmar.
      </footer>
    </article>
  );
}
