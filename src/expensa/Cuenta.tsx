import { useEstado } from '../estado';
import { Barra, Chip, EstadoChip, M } from '../ui/comun';
import { cents, money, num, pct, ratioOf } from '../lib/money';
import { fecha, mesCorto, mesNombre, ultimoDia, mesAnterior } from '../lib/fecha';
import { enMeses } from '../modelo/cuentas';
import { periodosDe } from '../modelo/modelo';
import { Linea, Seccion } from './piezas';
import type { Liquidacion } from './liquidacion';

/** Cascada: cada paso como una barra que arranca donde terminó el anterior. */
function Cascada({ L }: { L: Liquidacion }) {
  let corriente = 0;
  const pasos = L.flujo.map((p) => {
    const desde = p.tipo === 'saldo' ? 0 : corriente;
    const hasta = p.tipo === 'saldo' ? p.importe : corriente + p.importe;
    corriente = hasta;
    return { ...p, desde, hasta };
  });
  const max = Math.max(...pasos.map((p) => Math.max(p.desde, p.hasta)), 1);
  return (
    <div className="cascada">
      {pasos.map((p, k) => {
        const izq = (Math.min(p.desde, p.hasta) / max) * 100;
        const ancho = Math.max((Math.abs(p.hasta - p.desde) / max) * 100, 0.6);
        return (
          <details key={k} className={`paso ${p.tipo}`} open={false}>
            <summary>
              <span className="paso-texto">{p.texto}</span>
              <span className="paso-barra" aria-hidden="true">
                <i style={{ left: `${izq}%`, width: `${ancho}%` }} />
              </span>
              <span className={`num paso-imp ${p.tipo === 'entra' ? 'ok' : p.tipo === 'sale' ? '' : p.tipo === 'diferencia' ? 'bad' : ''}`}>
                {p.tipo === 'entra' ? '+' : ''}
                {money(p.importe)}
              </span>
            </summary>
            {(p.detalle?.length || p.nota) && (
              <div className="paso-det">
                {p.detalle?.map((d, j) => <Linea key={j} texto={d.texto} importe={d.importe} />)}
                {p.nota && <span className="xs muted">{p.nota}</span>}
              </div>
            )}
          </details>
        );
      })}
    </div>
  );
}

export function Cuenta({ L }: { L: Liquidacion }) {
  const e = useEstado();
  const c = L.cuentas;
  const banco = L.controles.find((x) => x.id === 'BANCO');
  const caja = L.controles.find((x) => x.id === 'CAJA');
  const mo = c.morosidad;
  const hist = periodosDe(e.datos!, e.barrio);
  const usados = new Set(hist.map((p) => p.ID_Periodo));
  const obras = e.datos!.sheets.GASTOS.filter((g) => usados.has(g.ID_Periodo) && (g.Tipo_Gasto === 'OBRA' || /obra|cctv|equipamiento/i.test(g.Concepto_Normalizado))).sort((a, b) =>
    a.Mes.localeCompare(b.Mes),
  );
  const h11 = e.datos!.sheets.HALLAZGOS.find((h) => h.ID_Hallazgo === 'H11');
  const maxPart = Math.max(...L.particulares.serie.map((s) => s.importe), 1);

  return (
    <>
      <Seccion
        id="flujo"
        n={4}
        titulo="Movimientos de la cuenta"
        bajada={`Toda la plata que entró y salió de la cuenta del barrio entre el 01/${L.mes.slice(5)}/${L.mes.slice(0, 4)} y el ${fecha(ultimoDia(L.mes))}. Tocá cada paso para ver el detalle.`}
        nota="FLUJO"
      >
        <div className="card">
          <Cascada L={L} />
          <div className="row">
            {caja && (
              <span className="row small">
                <EstadoChip e={caja.estado} /> {caja.titulo}
              </span>
            )}
            {banco && (
              <span className="row small">
                <EstadoChip e={banco.estado} /> Saldo inicial contra el banco al {fecha(ultimoDia(mesAnterior(L.mes)))}
                {banco.diferencia ? (
                  <>
                    : diferencia <M c={banco.diferencia} signo />
                  </>
                ) : null}
              </span>
            )}
          </div>
        </div>
        <div className="cols">
          <div className="card">
            <b>Lo que se debe al cierre</b>
            {L.compromisos.map((x) => (
              <Linea key={x.texto} texto={x.texto} importe={x.importe} sub={x.nota} />
            ))}
            <Linea texto="Total que se debe" importe={L.compromisos.reduce((s, x) => s + (x.importe ?? 0), 0)} fuerte />
          </div>
          <div className="card destacado">
            <span className="small muted">Plata libre después de pagar lo que se debe</span>
            <span className="grande" style={{ fontSize: 34 }}>
              <span className={L.plataLibre < 0 ? 'bad' : ''}>{money(L.plataLibre)}</span>
            </span>
            <p className="small">
              <M c={L.saldoFinal} /> en la cuenta menos lo que se debe. Alcanza para <b className="num">{num(enMeses(L.plataLibre, L.total))}</b> meses de gasto.
            </p>
            {L.compromisos.some((x) => x.importe === null) && <span className="xs warn">Hay deudas sin importe informado (N/D): la plata libre real puede ser menor.</span>}
          </div>
        </div>
      </Seccion>

      <Seccion id="fondos" n={5} titulo="Fondos" bajada="La plata de la cuenta está separada por destino. Cada uso tiene que tener su gasto o su acta." nota="FONDOS">
        <div className="card tabla-wrap">
          <table className="apilable">
            <thead>
              <tr>
                <th>Fondo</th>
                <th className="num">Al empezar</th>
                <th className="num">Entró</th>
                <th className="num">Se usó</th>
                <th className="num">Al cierre</th>
              </tr>
            </thead>
            <tbody>
              {L.fondos.map((f) => (
                <tr key={f.fondo}>
                  <td>
                    {f.fondo === 'ORDINARIO' ? 'Ordinario (gastos del mes)' : f.fondo === 'EXTRAORDINARIO' ? 'Extraordinario (obras)' : 'Reserva'}
                    {f.nota && <div className="xs muted">{f.nota}</div>}
                  </td>
                  <td className="num" data-l="Al empezar">{money(f.inicial)}</td>
                  <td className="num" data-l="Entró">{money(f.ingresos)}</td>
                  <td className="num" data-l="Se usó">{money(f.usos)}</td>
                  <td className="num" data-l="Al cierre">
                    <b>{money(f.final)}</b>
                  </td>
                </tr>
              ))}
              {!L.fondos.some((f) => f.fondo === 'RESERVA') && (
                <tr>
                  <td>
                    Reserva
                    <div className="xs muted">No existe todavía. Propuesta para la asamblea: 5% del gasto por mes.</div>
                  </td>
                  <td className="num muted" colSpan={4} data-l="">
                    —
                  </td>
                </tr>
              )}
              <tr className="total">
                <td>Total = plata en la cuenta</td>
                <td className="num" data-l="Al empezar">{money(L.fondos.reduce((s, f) => s + f.inicial, 0))}</td>
                <td className="num" data-l="Entró">{money(L.fondos.reduce((s, f) => s + f.ingresos, 0))}</td>
                <td className="num" data-l="Se usó">{money(L.fondos.reduce((s, f) => s + f.usos, 0))}</td>
                <td className="num" data-l="Al cierre">{money(L.fondos.filter((f) => f.fondo !== 'RESERVA').reduce((s, f) => s + f.final, 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion id="patrimonio" n={6} titulo="Estado patrimonial" bajada={`Lo que el barrio tiene y lo que debe al ${fecha(ultimoDia(L.mes))}, con los importes de esta liquidación.`} nota="PATRIMONIO">
        <div className="cols">
          <div className="card">
            <b>Lo que tiene</b>
            {L.patrimonio.activo.map((a) => (
              <Linea key={a.texto} texto={a.texto} importe={a.importe} sub={a.nota} />
            ))}
            <Linea texto="Total" importe={L.patrimonio.activo.reduce((s, a) => s + a.importe, 0)} fuerte />
          </div>
          <div className="card">
            <b>Lo que debe</b>
            {L.patrimonio.pasivo.map((a) => (
              <Linea key={a.texto} texto={a.texto} importe={a.importe} sub={a.nota} />
            ))}
            <Linea texto="Total" importe={L.patrimonio.pasivo.reduce((s, a) => s + (a.importe ?? 0), 0)} fuerte />
          </div>
        </div>
        <div className="card destacado between">
          <b>Patrimonio neto</b>
          <span className="mediano">{money(L.patrimonio.neto)}</span>
        </div>
      </Seccion>

      <Seccion id="morosidad" n={7} titulo="Morosidad" bajada="Cuántos lotes deben y cuánto en total. Nunca se publica qué lotes son." nota="MOROSIDAD">
        <div className="cols-3">
          <div className="card">
            <span className="small muted">Lotes con deuda</span>
            <span className="mediano">
              {mo.lotesConDeuda} de {mo.lotes}
            </span>
            <Barra valor={mo.lotesConDeuda} max={mo.lotes} />
          </div>
          <div className="card">
            <span className="small muted">Deuda de expensas</span>
            <span className="mediano">{money(mo.deuda)}</span>
            <span className="xs muted">
              Más <M c={mo.intereses} /> de intereses. Equivale a {num(enMeses(mo.deuda, L.total))} meses de gasto.
            </span>
          </div>
          <div className="card">
            <span className="small muted">Cobros sin identificar</span>
            <span className="mediano">{money(mo.cobrosSinIdentificar)}</span>
            <span className="xs muted">{mo.cobrosSinIdentificarCant} pagos que entraron sin saber de qué lote son.</span>
          </div>
        </div>
        <div className="card tabla-wrap">
          <table className="apilable">
            <thead>
              <tr>
                <th>Antigüedad de la deuda</th>
                <th className="num">Lotes</th>
                <th className="num">Importe</th>
              </tr>
            </thead>
            <tbody>
              {['Hasta 30 días', 'De 31 a 90 días', 'Más de 90 días', 'En gestión judicial'].map((t) => (
                <tr key={t}>
                  <td>{t}</td>
                  <td className="num warn" data-l="Lotes">N/D</td>
                  <td className="num warn" data-l="Importe">N/D</td>
                </tr>
              ))}
            </tbody>
          </table>
          <span className="xs muted">La antigüedad sale del estado de cuenta por lote. Se carga cuando la administración lo informe.</span>
        </div>
      </Seccion>

      <Seccion id="particulares" n={8} titulo="Cargos particulares" bajada="Canon de obra y otros cargos que paga solo el lote que corresponde. No se reparten entre todos." nota="PARTICULARES">
        <div className="cols">
          <div className="card">
            <span className="small muted">{L.particulares.concepto} · {mesNombre(L.mes)}</span>
            <span className="mediano">{money(L.particulares.total)}</span>
            <div className="lista small">
              <Linea texto="Lotes que lo pagan" importe={null} nd={L.particulares.lotes === null ? 'N/D' : String(L.particulares.lotes)} />
              <Linea texto="Fondo al que va" importe={null} nd={L.particulares.fondo} />
            </div>
            <span className="xs">{L.particulares.nota}</span>
            {L.particulares.estado === 'REVISAR' && <Chip tono="warn">REVISAR</Chip>}
          </div>
          <div className="card">
            <b>Mes a mes</b>
            <div className="lista small">
              {L.particulares.serie.map((s, k) => {
                const ant = k > 0 ? L.particulares.serie[k - 1].importe : null;
                return (
                  <div key={s.mes} className="stack-s">
                    <div className="between">
                      <span>{mesCorto(s.mes)}</span>
                      <span className="row" style={{ flexWrap: 'nowrap' }}>
                        <span className="num">{money(s.importe)}</span>
                        {ant ? <span className={`xs num ${s.importe > ant ? 'warn' : 'ok'}`}>{pct(ratioOf(s.importe - ant, ant), 0, { signo: true })}</span> : null}
                      </span>
                    </div>
                    <Barra valor={s.importe} max={maxPart} />
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Seccion>

      <Seccion id="obras" n={9} titulo="Obras" bajada="Cada obra con su presupuesto aprobado, lo pagado y lo que falta. Se pagan con el fondo extraordinario." nota="OBRAS">
        <div className="card tabla-wrap">
          <table className="apilable">
            <thead>
              <tr>
                <th>Mes</th>
                <th>Concepto</th>
                <th className="num">Importe</th>
                <th>Se pagó con</th>
              </tr>
            </thead>
            <tbody>
              {obras.map((g) => {
                const enExtra = L.modelo.obras.some((o) => o.idGasto === g.ID_Gasto);
                return (
                  <tr key={g.ID_Gasto}>
                    <td>{mesCorto(g.Mes)}</td>
                    <td data-l="">{g.Concepto_Normalizado}</td>
                    <td className="num" data-l="Importe">{money(cents(g.Importe))}</td>
                    <td data-l="Se pagó con">{enExtra ? <Chip tono="ok">Fondo extraordinario</Chip> : <Chip tono="warn">Expensa ordinaria</Chip>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="cols">
          <div className="card">
            <b>Sistema de cámaras</b>
            <Linea texto="Presupuesto total aprobado" importe={null} />
            <Linea texto="Pagado hasta hoy" importe={null} sub="Se completa con el estado de cuenta de los proveedores." />
            <Linea texto="Avance de obra" importe={null} />
          </div>
          <div className="card">
            <b>Deuda con proveedores de cámaras</b>
            <span className="mediano warn">{h11 ? money(cents(h11.Monto_Total ?? null)) : 'N/D'}</span>
            <span className="xs muted">Importe que surge de la auditoría (junio a agosto). REVISAR hasta tener el estado de cuenta conciliado con los proveedores.</span>
          </div>
        </div>
      </Seccion>
    </>
  );
}
