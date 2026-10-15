import { useEstado } from '../estado';
import { Barra, Cabecera, Card, Chip, Dif, EstadoChip, M, P, Tec } from '../ui/comun';
import { mulRound, money, pct, ratio, ratioOf } from '../lib/money';
import { fecha, mesLargo, mesNombre } from '../lib/fecha';

export function SelectorLote() {
  const e = useEstado();
  const tipos = e.cfgVista?.tiposLote ?? [];
  if (tipos.length < 2) return null;
  return (
    <div className="tema" role="group" aria-label="Tipo de lote">
      {tipos.map((t, i) => (
        <button key={t.tipo} className={e.tipoLote === i ? 'activo' : ''} onClick={() => e.setTipoLote(i)} aria-pressed={e.tipoLote === i}>
          {t.tipo} ({t.cantidad})
        </button>
      ))}
    </div>
  );
}

export function AvisoPendiente() {
  const e = useEstado();
  if (e.modelo) return null;
  return (
    <div className="aviso info">
      <b>Modelo pendiente.</b> Para {e.cfgVista?.nombre} en {mesLargo(e.oficial?.periodo.Mes ?? '')} todavía no se cargaron los criterios del modelo. Se muestran los datos oficiales, sin correcciones.
    </div>
  );
}

export function TuExpensa() {
  const e = useEstado();
  const m = e.modelo;
  const o = e.oficial!;
  const p = o.periodo;
  const i = Math.min(e.tipoLote, o.lotes.length - 1);
  const lo = o.lotes[i];
  const lm = m?.lotes[i];
  const nombreLote = e.cfgVista?.tiposLote[i]?.tipo ?? 'Lote';
  const coefEstado = e.cfgVista?.coefEstado ?? 'REVISAR';

  const difs = m
    ? m.efectos
        .filter((x) => x.aplicado && x.porLote[i] !== 0)
        .sort((a, b) => Math.abs(b.porLote[i]) - Math.abs(a.porLote[i]))
    : [];
  const ctrOk = e.controles.filter((c) => c.estado === 'OK').length;
  const ctrMal = e.controles.filter((c) => c.estado !== 'OK');
  const rubros = (m ?? o).rubros;
  const maxR = Math.max(...rubros.map((r) => r.importe), 1);
  const coef = (m ?? o).lotes[i].coef;
  const recargo = p.Recargo_Vencimiento !== '' && p.Recargo_Vencimiento !== null ? ratio(String(p.Recargo_Vencimiento)) : null;

  return (
    <>
      <Cabecera eyebrow={`${e.cfgVista?.nombre} · ${nombreLote}`} titulo={`Tu expensa de ${mesNombre(p.Mes)}`} bajada={m ? 'Liquidación modelo: cada número sale de un documento o de un supuesto escrito.' : undefined} />
      <SelectorLote />
      <AvisoPendiente />

      <div className="cols">
        <Card>
          <span className="small muted">{m ? `Tu expensa de ${mesNombre(p.Mes)} en el modelo` : `Expensa liquidada de ${mesNombre(p.Mes)}`}</span>
          <span className="grande">{money(lm ? lm.modelo : lo.oficial)}</span>
          {lm && (
            <p>
              Es{' '}
              <strong className={lm.diferencia <= 0 ? 'ok' : 'warn'}>
                {money(Math.abs(lm.diferencia))} {lm.diferencia <= 0 ? 'menos' : 'más'} ({pct(ratioOf(lm.diferencia, lm.oficial), 2, { signo: true })})
              </strong>{' '}
              que los {money(lm.oficial)} que liquidó la administración.
              {lm.diferencia < 0 && ' Baja porque cada gasto se liquida contra su factura y salen del reparto gastos que no corresponden al barrio.'}
            </p>
          )}
          <div className="row">
            <span className="pill">Vence {fecha(p.Fecha_Vencimiento)}</span>
            {recargo && <span className="pill">Después, recargo del {pct(recargo)}</span>}
            <Chip tono={coefEstado === 'OK' ? 'ok' : 'warn'}>Coeficiente: {coefEstado}</Chip>
          </div>
          {m?.reserva.activa && (
            <div className="aviso info small">
              Aparte: aporte al fondo de reserva de <M c={m.reserva.porLote[i]} /> ({pct(m.reserva.pct)}). Es un supuesto para la asamblea.
            </div>
          )}
          <Tec>
            <span>
              Gasto real del mes (oficial): <M c={o.gastoOficial} />. Repartido por la administración: <M c={o.repartidoOficial} />.
            </span>
            {m && (
              <>
                <span>
                  Gasto del modelo: <M c={m.totalModelo} /> × coeficiente del lote <P r={coef} d={6} /> = <M c={m.lotes[i].modelo} />, redondeado al centavo (mitad hacia arriba).
                </span>
                <span>
                  Redondeo del barrio: <M c={m.redondeo} /> (gasto del modelo menos lo que suman todos los lotes).
                </span>
              </>
            )}
            <span>Coeficiente: {e.cfgVista?.coefFuente}</span>
          </Tec>
        </Card>

        {m ? (
          <Card titulo={`Las ${Math.min(5, difs.length)} diferencias que más pesan`} bajada="Contra la liquidación de la administración, en tu lote.">
            <div className="lista">
              {difs.slice(0, 5).map((d) => (
                <div key={d.criterio.id} className="stack-s">
                  <div className="between">
                    <b>{d.criterio.titulo}</b>
                    <Dif c={d.porLote[i]} />
                  </div>
                  <span className="small muted">{d.criterio.texto}</span>
                  {d.criterio.estimado && <Chip tono="warn">ESTIMADO</Chip>}
                </div>
              ))}
            </div>
            <a href={`#/modelo?p=${p.ID_Periodo}`}>Ver los {m.efectos.length} criterios y apagarlos uno por uno</a>
          </Card>
        ) : (
          <Card titulo="Qué falta para el modelo">
            <p className="small">
              Cargar en la planilla del modelo los criterios de este mes (qué se corrige, con qué documento) y el coeficiente oficial de cada lote. Hasta entonces se publican solo los datos oficiales.
            </p>
          </Card>
        )}

        <Card titulo="En qué se va tu expensa" bajada={m ? 'Por rubro, en el modelo.' : 'Por rubro, liquidación oficial.'}>
          <div className="lista">
            {rubros.map((r) => (
              <div key={r.rubro} className="stack-s">
                <div className="between">
                  <span>{r.rubro}</span>
                  <span className="row" style={{ flexWrap: 'nowrap' }}>
                    <M c={mulRound(r.importe, coef)} />
                    <span className="xs muted num">{pct(r.participacion)}</span>
                  </span>
                </div>
                <Barra valor={r.importe} max={maxR} />
              </div>
            ))}
          </div>
          <span className="xs muted">Cada rubro por tu coeficiente; por redondeo, la suma puede diferir en centavos de tu expensa.</span>
          <a href={`#/peso?p=${p.ID_Periodo}`}>Ver cada gasto con su comprobante</a>
        </Card>

        <Card titulo="¿Cierran las cuentas?">
          <p>
            {ctrOk} de {e.controles.length} controles cierran.{' '}
            {ctrMal.length ? `${ctrMal.length} ${ctrMal.length === 1 ? 'necesita' : 'necesitan'} una explicación de la administración.` : 'Se puede publicar.'}
          </p>
          <div className="lista">
            {ctrMal.map((c) => (
              <div key={c.id} className="between">
                <span className="small">{c.titulo}</span>
                <EstadoChip e={c.estado} />
              </div>
            ))}
          </div>
          <a href={`#/cuentas?p=${p.ID_Periodo}`}>Ver el estado de cuentas</a>
        </Card>
      </div>
    </>
  );
}
