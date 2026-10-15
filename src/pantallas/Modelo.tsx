import { useEstado } from '../estado';
import { Cabecera, Card, Chip, Dif, Hallazgos, M, P, Switch, Tec } from '../ui/comun';
import { money, pct, ratioOf } from '../lib/money';
import { mesNombre } from '../lib/fecha';
import { AvisoPendiente, SelectorLote } from './TuExpensa';
import type { Criterio } from '../modelo/tipos';

const TIPO: Record<string, string> = {
  FACTURA: 'Se liquida la factura',
  IMPORTE_SUPUESTO: 'Importe informado por escrito',
  A_EXTRAORDINARIO: 'Pasa al fondo extraordinario',
  CAJA_CHICA_FISCAL: 'Solo comprobantes fiscales',
  PROPORCION: 'Proporción entre facturas',
  POR_LOTES: 'Reparto por cantidad de lotes',
  QUITAR: 'Se quita',
  FBV_EXCLUIR: 'Sale de la base del Fideicomiso',
  FBV_COEF_PUBLICADO: 'Coeficiente publicado',
};

function esSupuesto(c: Criterio) {
  return c.tipo === 'IMPORTE_SUPUESTO' || c.estimado || /SUPUESTO|A CONFIRMAR|ESTIMADO/.test(c.texto);
}

export function Modelo() {
  const e = useEstado();
  const m = e.modelo;
  const o = e.oficial!;
  const p = o.periodo;
  if (!m) {
    return (
      <>
        <Cabecera eyebrow={`${e.cfgVista?.nombre} · ${mesNombre(p.Mes)}`} titulo="Actual contra modelo" />
        <AvisoPendiente />
      </>
    );
  }
  const i = Math.min(e.tipoLote, m.lotes.length - 1);
  const l = m.lotes[i];
  const cambiado = (e.opciones.apagados?.size ?? 0) + (e.opciones.encendidos?.size ?? 0) > 0 || e.opciones.reserva !== undefined;
  const lineas = [...m.lineas].sort((a, b) => Math.abs(b.modelo - b.oficial) - Math.abs(a.modelo - a.oficial));

  return (
    <>
      <Cabecera
        eyebrow={`${e.cfgVista?.nombre} · ${mesNombre(p.Mes)}`}
        titulo="Actual contra modelo"
        bajada="Cada corrección es un criterio con nombre. Apagalo y mirá cuánto cambia tu expensa."
      />
      <SelectorLote />
      <div className="cols">
        <Card>
          <div className="grilla-montos">
            <div>
              <span>Liquidada</span>
              <M c={l.oficial} />
            </div>
            <div>
              <span>Modelo</span>
              <b>
                <M c={l.modelo} />
              </b>
            </div>
            <div>
              <span>Diferencia</span>
              <Dif c={l.diferencia} />
            </div>
          </div>
          <p className="small">
            {l.diferencia === 0
              ? 'Con estos criterios, tu expensa queda igual.'
              : `Tu expensa ${l.diferencia < 0 ? 'baja' : 'sube'} ${money(Math.abs(l.diferencia))} (${pct(ratioOf(l.diferencia, l.oficial), 2, { signo: true })}).`}{' '}
            El gasto del barrio pasa de <M c={m.gastoOficial} /> a <M c={m.totalModelo} />.
          </p>
          <div className="row">
            <button className="boton" onClick={e.restablecer} disabled={!cambiado}>
              Volver a los criterios recomendados
            </button>
          </div>
        </Card>
        <Card titulo="Fondo de reserva" bajada="Supuesto para la asamblea. No es un gasto: se junta aparte.">
          <div className="between">
            <span>
              Aporte del <P r={m.reserva.pct} d={0} /> del gasto del modelo
            </span>
            <Switch checked={m.reserva.activa} onChange={(v) => e.setReserva(v)} label="Fondo de reserva" />
          </div>
          {m.reserva.activa ? (
            <span>
              Barrio: <M c={m.reserva.aporte} /> por mes. Tu lote: <M c={m.reserva.porLote[i]} />.
            </span>
          ) : (
            <span className="small muted">{m.reserva.nota}</span>
          )}
        </Card>

        <Card titulo="De la expensa liquidada a la expensa modelo" bajada="Efecto de cada criterio en tu lote, en el orden en que se aplica." className="span-2">
          <div className="lista">
            <div className="between">
              <b>Expensa liquidada</b>
              <b>
                <M c={l.oficial} />
              </b>
            </div>
            <div className="stack-s">
              <div className="between">
                <span>
                  Se reparte el gasto real, no un importe distinto <Chip tono="accent">H01</Chip>
                </span>
                <Dif c={l.baseH01} />
              </div>
              <span className="xs muted">
                Siempre activo. Gasto <M c={m.gastoOficial} />, repartido <M c={m.repartidoOficial} />.
              </span>
            </div>
            {m.efectos.map((ef) => (
              <div key={ef.criterio.id} className="stack-s" style={{ opacity: ef.activo ? 1 : 0.65 }}>
                <div className="between">
                  <div className="row grow">
                    <Switch checked={ef.activo} onChange={(v) => e.alternar(ef.criterio.id, v, ef.criterio.activo)} label={ef.criterio.titulo} />
                    <b className="grow">{ef.criterio.titulo}</b>
                  </div>
                  {ef.activo ? <Dif c={ef.porLote[i]} /> : <span className="small muted">Apagado</span>}
                </div>
                <span className="small">{ef.criterio.texto}</span>
                <span className="row">
                  <Chip tono={esSupuesto(ef.criterio) ? 'warn' : 'ok'}>{esSupuesto(ef.criterio) ? 'SUPUESTO' : 'Con documento'}</Chip>
                  <Chip>{TIPO[ef.criterio.tipo]}</Chip>
                  <Hallazgos ids={ef.criterio.hallazgos} />
                  {!ef.criterio.activo && <Chip>Apagado por defecto</Chip>}
                </span>
                <Tec>
                  <span>
                    Efecto en el barrio: <M c={ef.barrio} signo />. En tu lote: <M c={ef.porLote[i]} signo /> (efecto del barrio × <P r={l.coef} d={6} />).
                  </span>
                  {ef.motivo && <span>{ef.motivo}</span>}
                  {ef.criterio.fuente && <span>Fuente: {ef.criterio.fuente}</span>}
                  {ef.criterio.comprobante && <span>Comprobante: {ef.criterio.comprobante}</span>}
                  <span>El efecto depende del orden: se mide contra el resultado de los criterios anteriores.</span>
                </Tec>
              </div>
            ))}
            <div className="between">
              <span>Ajuste por redondeo</span>
              <Dif c={l.ajusteRedondeo} />
            </div>
            <div className="between">
              <b>Expensa modelo</b>
              <b>
                <M c={l.modelo} />
              </b>
            </div>
          </div>
          <Tec>
            <span>
              Expensa modelo = gasto del modelo × coeficiente, redondeado al centavo. El efecto por lote de cada criterio se redondea por separado; el ajuste por redondeo junta esos
              centavos.
            </span>
            <span>
              Redondeo del barrio: <M c={m.redondeo} />.
            </span>
          </Tec>
        </Card>

        <Card titulo="Línea por línea" className="span-2">
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Gasto</th>
                  <th className="num">Liquidado</th>
                  <th className="num">Modelo</th>
                  <th className="num">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {lineas.map((x) => (
                  <tr key={x.idGasto}>
                    <td>
                      {x.etiqueta}
                      {x.criterios.length > 0 && <div className="xs muted">{x.criterios.join(', ')}</div>}
                    </td>
                    <td className="num">
                      <M c={x.oficial} />
                    </td>
                    <td className="num">
                      <M c={x.modelo} />
                    </td>
                    <td className="num">
                      <Dif c={x.modelo - x.oficial} />
                    </td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Total</td>
                  <td className="num">
                    <M c={m.gastoOficial} />
                  </td>
                  <td className="num">
                    <M c={m.totalModelo} />
                  </td>
                  <td className="num">
                    <Dif c={m.totalModelo - m.gastoOficial} />
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </>
  );
}
