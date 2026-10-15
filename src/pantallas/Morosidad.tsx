import { useEstado } from '../estado';
import { Barra, Cabecera, Card, M, Tec } from '../ui/comun';
import { num } from '../lib/money';
import { mesCorto, mesNombre } from '../lib/fecha';
import { enMeses } from '../modelo/cuentas';
import { historial } from '../modelo/historial';

export function Morosidad() {
  const e = useEstado();
  const c = e.cuentas!;
  const mo = c.morosidad;
  const p = e.oficial!.periodo;
  const gastoMes = (e.modelo ?? e.oficial!).totalModelo;
  const h = historial(e.datos!, e.cfg, e.barrio);

  return (
    <>
      <Cabecera
        eyebrow={`${e.cfgVista?.nombre} · ${mesNombre(p.Mes)}`}
        titulo="Morosidad"
        bajada="Cuántos lotes deben y cuánto, en total. Nunca se publica qué lotes son ni cuánto debe cada uno."
      />
      <div className="cols">
        <Card titulo="Lotes con deuda">
          <span className="grande">
            {mo.lotesConDeuda} de {mo.lotes}
          </span>
          <Barra valor={mo.lotesConDeuda} max={mo.lotes} />
          <p>
            Entre todos deben <b><M c={mo.deuda} /></b> de expensas, más <M c={mo.intereses} /> de intereses. Equivale a{' '}
            <b className="num">{num(enMeses(mo.deuda, gastoMes))}</b> meses de gasto{e.modelo ? ' del modelo' : ''}.
          </p>
          <Tec>
            <span>Fuente: liquidación oficial, estado patrimonial (deudas e intereses a cobrar) y cantidad de unidades con deuda.</span>
            <span>Meses = deuda de expensas ÷ gasto mensual{e.modelo ? ' del modelo' : ' oficial'}.</span>
          </Tec>
        </Card>
        <Card titulo="Cobros sin identificar">
          <span className="mediano">
            <M c={mo.cobrosSinIdentificar} />
          </span>
          <p className="small">
            {mo.cobrosSinIdentificarCant} pago{mo.cobrosSinIdentificarCant === 1 ? '' : 's'} que entraron a la cuenta y todavía no se sabe de qué lote son. Mientras no se identifiquen,
            un lote puede figurar como deudor habiendo pagado.
          </p>
          <span className="small">Si pagaste y no te figura, mandá el comprobante a la administración.</span>
        </Card>
        <Card titulo="Mes a mes" className="span-2">
          <div className="tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Mes</th>
                  <th className="num">Lotes con deuda</th>
                </tr>
              </thead>
              <tbody>
                {h.map((x) => (
                  <tr key={x.idPeriodo}>
                    <td>{mesCorto(x.mes)}</td>
                    <td className="num">
                      {x.lotesConDeuda} de {x.lotes}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card titulo="Previsión por morosidad" className="span-2">
          <p className="small">
            El modelo reparte solo el gasto real. Si la asamblea quiere cubrir la morosidad, va como una línea aparte, con su porcentaje y con la regla para devolverla cuando los lotes con
            deuda paguen (H01).
          </p>
        </Card>
      </div>
    </>
  );
}
