import { useEstado } from '../estado';
import { Cabecera, Card, Chip, EstadoChip, Hallazgos, M, Tec } from '../ui/comun';
import { num } from '../lib/money';
import { fecha, mesNombre, ultimoDia } from '../lib/fecha';
import { enMeses } from '../modelo/cuentas';
import type { Control } from '../modelo/controles';

export function TarjetaControl({ c }: { c: Control }) {
  return (
    <div className="stack-s">
      <div className="between">
        <b>{c.titulo}</b>
        <EstadoChip e={c.estado} />
      </div>
      <span className="small">{c.simple}</span>
      {c.diferencia !== null && c.diferencia !== 0 && (
        <span className="small">
          Diferencia: <M c={c.diferencia} signo />
        </span>
      )}
      {c.explicadoPor && <span className="xs muted">Explicado por: {c.explicadoPor}</span>}
      <Tec>
        <span>{c.detalle}</span>
        {c.esperado !== null && (
          <span>
            Debería dar <M c={c.esperado} />; da <M c={c.obtenido} />.
          </span>
        )}
        {c.filas?.map((f, i) => (
          <span key={i} className="between">
            <span>{f.texto}</span>
            {f.importe !== null && <M c={f.importe} />}
          </span>
        ))}
        <Hallazgos ids={c.hallazgos} />
      </Tec>
    </div>
  );
}

export function CuentasPantalla() {
  const e = useEstado();
  const c = e.cuentas!;
  const p = e.oficial!.periodo;
  const gastoMes = (e.modelo ?? e.oficial!).totalModelo;
  const obras = e.modelo?.obras ?? [];
  const ctr = (id: string) => e.controles.find((x) => x.id === id);

  return (
    <>
      <Cabecera
        eyebrow={`${e.cfgVista?.nombre} · ${mesNombre(p.Mes)}`}
        titulo="Estado de cuentas que cierra"
        bajada={`Cuánta plata hay al ${fecha(ultimoDia(p.Mes))}, cuánto se debe y cuánto queda libre.`}
      />
      <div className="cols">
        <Card titulo="Plata libre">
          <span className="grande" style={{ fontSize: 34 }}>
            <M c={c.plataLibre} className={c.plataLibre < 0 ? 'bad' : ''} />
          </span>
          <p>
            Es lo que queda si se paga todo lo que se debe. Alcanza para <b className="num">{num(enMeses(c.plataLibre, gastoMes))}</b> meses de gasto
            {e.modelo ? ' del modelo' : ''}.
          </p>
          <div className="lista small">
            <div className="between">
              <span>Plata en el banco al cierre</span>
              <M c={c.saldoFinal} />
            </div>
            <div className="between">
              <span>Menos gastos del mes sin pagar</span>
              <M c={-c.pendientesDetalle} />
            </div>
            {c.deudas.map((d) => (
              <div key={d.concepto} className="between">
                <span>
                  Menos {d.concepto} {d.hallazgo && <Chip tono="accent">{d.hallazgo}</Chip>}
                </span>
                {d.importe === null ? <span className="num warn">N/D</span> : <M c={-d.importe} />}
              </div>
            ))}
            <div className="between">
              <b>Plata libre</b>
              <b>
                <M c={c.plataLibre} />
              </b>
            </div>
          </div>
          {c.deudas.some((d) => d.importe === null) && <div className="aviso small">Hay deudas sin importe informado (N/D): la plata libre real puede ser menor.</div>}
        </Card>

        <Card titulo="La caja del mes">
          <div className="lista small">
            <div className="between">
              <span>Saldo inicial</span>
              <M c={c.saldoInicial} />
            </div>
            {c.ingresos.map((i, k) => (
              <div key={k} className="between">
                <span>
                  + {i.concepto} <span className="xs muted">({i.fondo.toLowerCase()})</span>
                </span>
                <M c={i.importe} />
              </div>
            ))}
            {c.egresos.map((i, k) => (
              <div key={k} className="between">
                <span>− {i.tipo === 'PAGO DE GASTOS LIQUIDADOS' ? 'Pago de gastos' : i.tipo.toLowerCase()}</span>
                <M c={i.importe} />
              </div>
            ))}
            <div className="between">
              <b>Saldo al cierre</b>
              <b>
                <M c={c.saldoFinal} />
              </b>
            </div>
          </div>
          {ctr('CAJA') && <TarjetaControl c={ctr('CAJA')!} />}
        </Card>

        <Card titulo="Fondos">
          <div className="lista small">
            {c.fondos.map((f) => (
              <div key={f.fondo} className="stack-s">
                <div className="between">
                  <b>Fondo {f.fondo.toLowerCase()}</b>
                  <M c={f.final} />
                </div>
                <span className="xs muted">
                  Empezó el mes con <M c={f.inicial} />.
                </span>
                {f.fondo === 'EXTRAORDINARIO' && obras.length > 0 && (
                  <span>
                    Después de pagar {obras.map((o) => o.concepto.toLowerCase()).join(', ')} (<M c={obras.reduce((s, o) => s + o.importe, 0)} />) quedan{' '}
                    <b>
                      <M c={f.final - obras.reduce((s, o) => s + o.importe, 0)} />
                    </b>
                    .
                  </span>
                )}
              </div>
            ))}
          </div>
        </Card>

        <Card titulo="Patrimonio">
          <div className="lista small">
            {c.patrimonioComponentes.map((x) => (
              <div key={x.concepto} className="between">
                <span>{x.concepto}</span>
                <M c={x.importe} />
              </div>
            ))}
            <div className="between">
              <b>Suma (lo que publica el modelo)</b>
              <b>
                <M c={c.patrimonioCalculado} />
              </b>
            </div>
            <div className="between muted">
              <span>Informado por la administración</span>
              <M c={c.patrimonioInformado} />
            </div>
          </div>
          {ctr('PATRIMONIO') && <TarjetaControl c={ctr('PATRIMONIO')!} />}
        </Card>

        {c.creditos.length > 0 && (
          <Card titulo="A favor de los lotes o para reclamar" bajada="Importes que el barrio puede recuperar o que hay que aclarar.">
            <div className="lista">
              {c.creditos.map((x) => (
                <div key={x.concepto} className="stack-s">
                  <div className="between">
                    <b>{x.concepto}</b>
                    <M c={x.importe} />
                  </div>
                  <span className="small muted">{x.nota}</span>
                  <span className="row">
                    <Chip tono={/REVISAR/.test(x.tipo) ? 'warn' : undefined}>{x.tipo}</Chip>
                    {x.hallazgo && <Chip tono="accent">{x.hallazgo}</Chip>}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}

        {e.cfg && (
          <Card titulo="La cuenta del barrio">
            <div className="lista small">
              <div className="stack-s">
                <span className="muted">Hoy</span>
                <span>{e.cfg.cuenta.titularActual}</span>
              </div>
              <div className="stack-s">
                <span className="muted">Como corresponde</span>
                <span>{e.cfg.cuenta.titularCorrecto}</span>
              </div>
            </div>
            <span className="small">{e.cfg.cuenta.nota}</span>
          </Card>
        )}

        <Card titulo="Controles del mes" bajada="Si alguno no cierra, el modelo no se publica sin una aclaración escrita." className="span-2">
          <div className="lista">
            {e.controles.map((x) => (
              <TarjetaControl key={x.id} c={x} />
            ))}
          </div>
        </Card>
      </div>
    </>
  );
}
