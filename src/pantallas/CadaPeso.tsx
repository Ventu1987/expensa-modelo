import { useEstado } from '../estado';
import { BarraDoble, Cabecera, Card, Chip, Dif, M, P, Tec } from '../ui/comun';
import { pct } from '../lib/money';
import { mesNombre } from '../lib/fecha';
import { variaciones } from '../modelo/historial';
import { AvisoPendiente } from './TuExpensa';
import type { LineaModelo } from '../modelo/modelo';

function Variacion({ concepto }: { concepto: string }) {
  const e = useEstado();
  const v = variaciones(e.datos!, e.barrio, e.idPeriodo).find((x) => x.concepto === concepto);
  if (!v) return null;
  if (v.nuevo) return <Chip tono="warn">Nuevo este mes</Chip>;
  if (v.anterior === null) return <span className="xs muted">No estaba el mes anterior</span>;
  return (
    <span className="xs muted">
      Oficial contra el mes anterior: <span className="num">{v.variacion ? pct(v.variacion, 1, { signo: true }) : '0,0%'}</span> (<M c={v.anterior} />)
    </span>
  );
}

function BotonComprobantes({ l }: { l: LineaModelo }) {
  const e = useEstado();
  const n = e.datos!.sheets.COMPROBANTES.filter((c) => c.ID_Gasto === l.idGasto).length;
  return (
    <button className="link small" onClick={() => e.verComprobantes(l.idGasto)}>
      {n ? `${n} comprobante${n === 1 ? '' : 's'}` : 'Sin comprobante cargado'}
    </button>
  );
}

export function CadaPeso() {
  const e = useEstado();
  const m = e.modelo;
  const v = m ?? e.oficial!;
  const p = v.periodo;
  const max = Math.max(...v.lineas.map((l) => Math.max(l.oficial, l.modelo)), 1);
  const lineas = [...v.lineas].sort((a, b) => b.oficial - a.oficial);
  const nombre = (id: string) => m?.efectos.find((x) => x.criterio.id === id)?.criterio.titulo ?? id;

  return (
    <>
      <Cabecera
        eyebrow={`${e.cfgVista?.nombre} · ${mesNombre(p.Mes)}`}
        titulo="De dónde sale cada peso"
        bajada="Cada gasto del mes, lo que liquidó la administración y lo que corresponde en el modelo, con su comprobante."
      />
      <AvisoPendiente />
      <div className="cols">
        <Card titulo="Por rubro">
          <div className="lista">
            {v.rubros.map((r) => (
              <div key={r.rubro} className="between">
                <span>{r.rubro}</span>
                <span className="row" style={{ flexWrap: 'nowrap' }}>
                  <M c={r.importe} />
                  <span className="xs muted num">{pct(r.participacion)}</span>
                </span>
              </div>
            ))}
            <div className="between">
              <b>Total {m ? 'del modelo' : 'oficial'}</b>
              <b>
                <M c={v.totalModelo} />
              </b>
            </div>
          </div>
        </Card>
        <Card titulo="Cómo leer esta página">
          <p className="small">
            La barra gris es lo que liquidó la administración; la azul, lo que corresponde en el modelo. Si una línea cambia, se dice por qué y con qué documento. Los importes ESTIMADO
            o SUPUESTO están marcados y se pueden apagar en <a href={`#/modelo?p=${p.ID_Periodo}`}>Actual contra modelo</a>.
          </p>
          <div className="leyenda">
            <span>
              <i style={{ background: 'var(--line)' }} />
              Oficial
            </span>
            <span>
              <i style={{ background: 'var(--accent)' }} />
              Modelo
            </span>
          </div>
          {m && m.obras.length > 0 && (
            <div className="aviso info small">
              {m.obras.map((o) => (
                <span key={o.idGasto}>
                  {o.concepto} (<M c={o.importe} />) no está en el gasto del mes: la paga el fondo {o.fondo.toLowerCase()}.{' '}
                </span>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card titulo={`Los ${lineas.length} gastos de ${mesNombre(p.Mes)}`}>
        <div className="lista">
          {lineas.map((l) => (
            <div key={l.idGasto} className="linea">
              <div className="between">
                <div className="grow">
                  <b>{l.etiqueta}</b>
                  <div className="xs muted">
                    {l.proveedor && l.proveedor !== 'N/D' ? `${l.proveedor} · ` : ''}
                    {l.estadoPago === 'PENDIENTE' ? 'Pendiente de pago' : 'Pagado en el mes'}
                  </div>
                </div>
                <span className="mediano" style={{ fontSize: 17 }}>
                  <M c={m ? l.modelo : l.oficial} />
                </span>
              </div>
              {m && <BarraDoble oficial={l.oficial} modelo={l.modelo} max={max} />}
              {m && l.modelo !== l.oficial && (
                <div className="grilla-montos">
                  <div>
                    <span>Oficial</span>
                    <M c={l.oficial} />
                  </div>
                  <div>
                    <span>Modelo</span>
                    <M c={l.modelo} />
                  </div>
                  <div>
                    <span>Diferencia</span>
                    <Dif c={l.modelo - l.oficial} />
                  </div>
                </div>
              )}
              {l.criterios.length > 0 && (
                <div className="criterios">
                  {l.criterios.map((c) => (
                    <Chip key={c} tono="accent">
                      {nombre(c)}
                    </Chip>
                  ))}
                  {l.estimado && <Chip tono="warn">SUPUESTO</Chip>}
                </div>
              )}
              {l.comentario && <span className="small">{l.comentario}</span>}
              <div className="row" style={{ justifyContent: 'space-between' }}>
                <Variacion concepto={l.concepto} />
                <BotonComprobantes l={l} />
              </div>
            </div>
          ))}
        </div>
        <Tec>
          <span>
            Fuente de cada línea: hoja GASTOS de la auditoría ({p.Fuente_PDF}). Gasto oficial <M c={v.gastoOficial} />; repartido <M c={v.repartidoOficial} />.
          </span>
          {m && (
            <span>
              Coeficiente del lote común: <P r={m.lotes[0].coef} d={6} />.
            </span>
          )}
        </Tec>
      </Card>
    </>
  );
}
