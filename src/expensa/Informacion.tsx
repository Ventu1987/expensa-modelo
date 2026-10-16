import { useState } from 'react';
import { useEstado, BARRIOS } from '../estado';
import { Chip, M, P } from '../ui/comun';
import { money, pct, ratioOf, ratio } from '../lib/money';
import { mesCorto, mesNombre } from '../lib/fecha';
import { tablaFideicomiso } from '../modelo/modelo';
import { historial, novedadesAutomaticas } from '../modelo/historial';
import { Grafico } from '../pantallas/Historial';
import { Editable, Linea, Seccion } from './piezas';
import type { Liquidacion, Regularizacion } from './liquidacion';

const TONO_REG: Record<Regularizacion['estado'], 'ok' | 'warn' | 'bad' | 'accent' | undefined> = {
  'Corregido en esta liquidación': 'ok',
  'A recuperar': 'accent',
  'En gestión': 'warn',
  Pendiente: 'bad',
  Solucionado: 'ok',
  Descartado: undefined,
  'Se controla cada mes': 'accent',
};
const nombreBarrio = (id: string) => BARRIOS.find((b) => b.id === id)?.nombre ?? id;

function Regularizaciones({ L }: { L: Liquidacion }) {
  const [filtro, setFiltro] = useState<string>('Todas');
  const estados = ['Todas', ...new Set(L.regularizaciones.map((r) => r.estado))];
  const lista = L.regularizaciones.filter((r) => filtro === 'Todas' || r.estado === filtro);
  const e = useEstado();
  const lote = L.modelo.lotes[Math.min(e.tipoLote, L.modelo.lotes.length - 1)];
  const corregido = lote.diferencia;
  return (
    <Seccion
      id="regularizaciones"
      n={13}
      titulo="Regularizaciones"
      bajada="Lo que se detectó en las liquidaciones anteriores, qué hace esta liquidación con cada punto y qué falta. Son puntos a revisar, no acusaciones."
      nota="REGULARIZACIONES"
    >
      <div className="row no-print">
        {estados.map((x) => (
          <button key={x} className={`chip-btn ${filtro === x ? 'activo' : ''}`} onClick={() => setFiltro(x)}>
            {x} <span className="num">{x === 'Todas' ? L.regularizaciones.length : L.regularizaciones.filter((r) => r.estado === x).length}</span>
          </button>
        ))}
      </div>
      {L.esModelo && (
        <p className="small">
          Con estas correcciones tu cuota es <b className={corregido < 0 ? 'ok' : 'warn'}>{money(corregido, { signo: true })}</b> distinta de la que liquidó la administración anterior ({money(lote.oficial)}). Algunos puntos comparten una misma corrección, por eso sus efectos no se suman.
        </p>
      )}
      <div className="regs">
        {lista.map((r) => (
          <div key={r.id} className="card reg" id={`reg-${r.id}`}>
            <div className="between">
              <span className="row">
                <span className="mono xs muted">{r.id}</span>
                <b>{r.titulo}</b>
              </span>
              <Chip tono={TONO_REG[r.estado]}>{r.estado}</Chip>
            </div>
            {r.quePaso && (
              <span className="small">
                <span className="muted">Qué pasó: </span>
                {r.quePaso}
              </span>
            )}
            {r.queHacemos && (
              <span className="small">
                <span className="muted">Qué hacemos: </span>
                {r.queHacemos}
              </span>
            )}
            <div className="row xs">
              {r.efectoLote !== null && r.efectoLote !== 0 && (
                <span>
                  Efecto en tu cuota este mes: <M c={r.efectoLote} signo />
                </span>
              )}
              {r.importe !== null && (
                <span className="muted">
                  Importe detectado para el barrio: <M c={r.importe} />
                </span>
              )}
            </div>
            {r.falta && r.estado !== 'Solucionado' && r.estado !== 'Descartado' && (
              <span className="xs muted">
                <b>Falta:</b> {r.falta}
              </span>
            )}
            <Editable tipo="notas" clave={r.id} valor={r.nota} placeholder="Comentario de la administración sobre este punto" className="xs nota-reg" />
          </div>
        ))}
      </div>
    </Seccion>
  );
}

export function Informacion({ L }: { L: Liquidacion }) {
  const e = useEstado();
  const cfg = e.cfgVista!;
  const t = tablaFideicomiso(cfg);
  const f = L.modelo.fbv;
  const nov = L.modelo.config.novedades;
  const auto = novedadesAutomaticas(e.datos!, e.barrio, L.idPeriodo);
  const h = historial(e.datos!, e.cfg, e.barrio);
  const lotes = L.cuotas.reduce((s, c) => s + c.cantidad, 0);
  const sup = e.cfg?.superficieM2;
  const ind = e.datos!.sheets.INDICES.find((x) => x.Mes === L.mes);
  const comps = e.datos!.sheets.COMPROBANTES.filter((x) => x.ID_Periodo === L.idPeriodo);
  const adm = e.cfg?.administracion;
  const cuentaCfg = e.cfg?.cuenta;
  const proveedores = new Map<string, { conceptos: string[]; actual: number; anterior: number | null }>();
  for (const r of L.rubros)
    for (const x of r.filas) {
      const k = x.proveedor || 'N/D';
      const p = proveedores.get(k) ?? { conceptos: [], actual: 0, anterior: null };
      p.conceptos.push(x.etiqueta);
      p.actual += x.actual;
      if (x.anterior !== null) p.anterior = (p.anterior ?? 0) + x.anterior;
      proveedores.set(k, p);
    }

  return (
    <>
      <Seccion id="fideicomiso" n={10} titulo="Mantenimiento del Fideicomiso" bajada="El Fideicomiso Bella Vista cobra a cada barrio una parte de sus costos: 80% por espacios propios y 20% por espacios comunes." nota="FIDEICOMISO">
        <div className="cols">
          <div className="card tabla-wrap">
            <table>
              <thead>
                <tr>
                  <th>Barrio</th>
                  <th className="num">Propios</th>
                  <th className="num">Comunes</th>
                  <th className="num">Total</th>
                </tr>
              </thead>
              <tbody>
                {t.filas.map((r) => (
                  <tr key={r.barrio} style={r.barrio === e.barrio ? { background: 'var(--accent-bg)' } : undefined}>
                    <td>{nombreBarrio(r.barrio)}</td>
                    <td className="num"><P r={r.propios} d={3} /></td>
                    <td className="num"><P r={r.comunes} d={3} /></td>
                    <td className="num"><P r={r.combinado} d={3} /></td>
                  </tr>
                ))}
                <tr className="total">
                  <td>Los tres barrios</td>
                  <td className="num"><P r={t.total.propios} d={3} /></td>
                  <td className="num"><P r={t.total.comunes} d={3} /></td>
                  <td className="num"><P r={t.total.combinado} d={3} /></td>
                </tr>
              </tbody>
            </table>
            <span className="xs muted">{cfg.coefFideicomisoFuente}</span>
          </div>
          {f ? (
            <div className="card">
              <b>Lo que paga {cfg.nombre} este mes</b>
              <Linea texto="Base de costos del Fideicomiso" importe={f.baseModelo} sub={f.exclusiones.length ? `Sin ${f.exclusiones.map((x) => x.titulo.replace(/^Sin (el |la |los |las )?/i, '').toLowerCase()).join(', ')}.` : undefined} />
              <Linea texto={<>Espacios propios: 80% × <P r={f.coefPropios} /></>} importe={f.propios.modelo} />
              <Linea texto={<>Espacios comunes: 20% × <P r={f.coefComunes} /></>} importe={f.comunes.modelo} />
              <Linea texto="Total del mes" importe={f.propios.modelo + f.comunes.modelo} fuerte />
            </div>
          ) : (
            <div className="card small muted">Base del mantenimiento del Fideicomiso: N/D para este mes.</div>
          )}
        </div>
      </Seccion>

      <Seccion id="proveedores" n={11} titulo="Proveedores y contratos" bajada="Quién presta cada servicio, cuánto cobra y cuándo vence o se actualiza el contrato." nota="PROVEEDORES">
        <div className="card tabla-wrap">
          <table className="apilable">
            <thead>
              <tr>
                <th>Proveedor</th>
                <th>Servicio</th>
                <th className="num">Mes anterior</th>
                <th className="num">Este mes</th>
              </tr>
            </thead>
            <tbody>
              {[...proveedores.entries()].sort((a, b) => b[1].actual - a[1].actual).map(([k, p]) => (
                <tr key={k}>
                  <td>{k}</td>
                  <td className="small" data-l="">{p.conceptos.join(', ')}</td>
                  <td className="num" data-l="Mes anterior">{p.anterior === null ? '—' : money(p.anterior)}</td>
                  <td className="num" data-l="Este mes">{money(p.actual)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {e.cfg?.contratos?.length ? (
          <div className="card">
            <b>Contratos</b>
            {e.cfg.contratos.map((c) => (
              <div key={c.proveedor} className="stack-s linea-m">
                <div className="grow">
                  <span>{c.proveedor}</span> <span className="xs muted">· {c.objeto}</span>
                  <div className="xs muted">
                    Actualización: {c.actualizacion}
                    {c.nota ? ` · ${c.nota}` : ''}
                  </div>
                </div>
                <span className="small">{c.vence ? `Vence ${c.vence}` : <span className="warn">Vencimiento N/D</span>}</span>
              </div>
            ))}
          </div>
        ) : null}
      </Seccion>

      <Seccion id="novedades" n={12} titulo="Novedades y avisos" bajada="Lo que cambia, anunciado antes de cobrarlo." nota="NOVEDADES">
        <div className="cols">
          {nov.map((n) => (
            <div key={n.titulo} className="card">
              <span className="row">
                <Chip tono={n.tipo === 'CARGO_NUEVO' || n.tipo === 'AUMENTO' ? 'warn' : 'accent'}>
                  {{ CARGO_NUEVO: 'Cargo nuevo', CAMBIO_CRITERIO: 'Cambio de criterio', OBRA: 'Obra', AUMENTO: 'Aumento', AVISO: 'Aviso' }[n.tipo]}
                </Chip>
              </span>
              <b>{n.titulo}</b>
              <span className="small">{n.texto}</span>
            </div>
          ))}
          {(auto.nuevos.length > 0 || auto.dejaron.length > 0) && (
            <div className="card">
              <b>Conceptos nuevos o que dejan de estar</b>
              {auto.nuevos.map((v) => (
                <Linea key={v.concepto} texto={`Nuevo: ${v.concepto}`} importe={v.actual} />
              ))}
              {auto.dejaron.map((c) => (
                <span key={c} className="small muted">
                  Ya no figura: {c}
                </span>
              ))}
            </div>
          )}
          {!nov.length && !auto.nuevos.length && <div className="card small muted">Sin novedades este mes.</div>}
        </div>
      </Seccion>

      <Regularizaciones L={L} />

      <Seccion id="indicadores" n={14} titulo="Indicadores" bajada="Para comparar mes a mes de un vistazo." nota="INDICADORES">
        <div className="indicadores">
          <div className="card">
            <span className="xs muted">Gasto por lote</span>
            <span className="mediano">{money(Math.round(L.total / lotes))}</span>
            <span className="xs muted">Gasto del mes ÷ {lotes} lotes (redondeado al centavo).</span>
          </div>
          <div className="card">
            <span className="xs muted">Gasto por m²</span>
            <span className="mediano">{sup ? money(Math.round(L.total / sup.valor)) : 'N/D'}</span>
            <span className="xs muted">
              {sup ? `${sup.valor.toLocaleString('es-AR')} m²` : ''} {sup?.estado === 'REVISAR' && <Chip tono="warn">REVISAR</Chip>}
            </span>
          </div>
          <div className="card">
            <span className="xs muted">Gasto con factura</span>
            <span className="mediano">{pct(ratioOf(L.respaldo.fiscal, L.total || 1), 1)}</span>
            <span className="xs muted">
              Parcial {pct(ratioOf(L.respaldo.parcial, L.total || 1), 1)} · sin factura {pct(ratioOf(L.respaldo.sin, L.total || 1), 1)}
            </span>
          </div>
          <div className="card">
            <span className="xs muted">Lotes con deuda</span>
            <span className="mediano">{pct(ratioOf(L.cuentas.morosidad.lotesConDeuda, L.cuentas.morosidad.lotes || 1), 0)}</span>
            <span className="xs muted">
              {L.cuentas.morosidad.lotesConDeuda} de {L.cuentas.morosidad.lotes}
            </span>
          </div>
          <div className="card">
            <span className="xs muted">IPC del mes (INDEC, referencia)</span>
            <span className="mediano">{ind && ind.IPC_Var_Mensual !== '' ? pct(ratio(String(ind.IPC_Var_Mensual)), 1) : 'N/D'}</span>
            <span className="xs muted">Solo como dato. La expensa depende de contratos concretos.</span>
          </div>
        </div>
        <div className="card">
          <b>Cuota del lote común, mes a mes</b>
          <Grafico puntos={h.map((x) => ({ mes: x.mes, a: x.loteOficial, b: x.loteModelo }))} etiquetas={['Administración anterior', 'Esta liquidación']} />
          <span className="xs muted">
            Gris: liquidado por la administración anterior. Azul: esta liquidación (desde {h.find((x) => x.loteModelo !== null) ? mesCorto(h.find((x) => x.loteModelo !== null)!.mes) : 'N/D'}).
          </span>
        </div>
      </Seccion>

      <Seccion id="documentacion" n={15} titulo="Documentación y contacto" nota="DOCUMENTACION">
        <div className="cols">
          <div className="card">
            <b>Cómo pagar</b>
            <Linea texto="Banco" importe={null} nd={adm?.banco ?? 'N/D'} />
            <Linea texto="CBU" importe={null} nd={adm?.cbu ?? 'N/D'} />
            <Linea texto="Alias" importe={null} nd={adm?.alias ?? 'N/D'} />
            <span className="small">Titular: {adm?.titular ?? 'N/D'}</span>
            {cuentaCfg && <span className="xs muted">{cuentaCfg.nota}</span>}
          </div>
          <div className="card">
            <b>Documentación de {mesNombre(L.mes)}</b>
            <Linea texto="Comprobantes cargados" importe={null} nd={String(comps.length)} />
            <Linea texto="De ellos, con validez fiscal" importe={null} nd={String(comps.filter((c) => c.Es_Fiscal === 'SI').length)} />
            <Linea texto="Extracto bancario completo" importe={null} nd="Pedido" />
            <Linea texto="Actas de asamblea" importe={null} nd="N/D" />
            <span className="xs muted">Los comprobantes se ven tocando cada gasto. Los cupones de pago no se publican porque tienen datos de los propietarios.</span>
          </div>
          <div className="card">
            <b>Administración</b>
            <span>{adm?.nombre ?? 'N/D'}</span>
            <span className="small muted">
              Matrícula {adm?.matricula ?? 'N/D'} · CUIT {adm?.cuit ?? 'N/D'}
            </span>
            <span className="small">Contacto: {adm?.contacto ?? 'N/D'}</span>
            <span className="small">Atención: {adm?.horario ?? 'N/D'}</span>
          </div>
        </div>
      </Seccion>
    </>
  );
}
