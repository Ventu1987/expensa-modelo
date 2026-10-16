import { useState } from 'react';
import { useEstado } from '../estado';
import { Cabecera, Card, Dif, M } from '../ui/comun';
import { money, mulRound, pct, ratioOf } from '../lib/money';
import { fecha, mesLargo } from '../lib/fecha';

export function Resumen() {
  const e = useEstado();
  const o = e.oficial!;
  const m = e.modelo;
  const v = m ?? o;
  const p = o.periodo;
  const c = e.cuentas!;
  const i = Math.min(e.tipoLote, v.lotes.length - 1);
  const lote = e.cfgVista?.tiposLote[i]?.tipo ?? 'Lote';
  const difs = m ? m.efectos.filter((x) => x.aplicado && x.porLote[i] !== 0).sort((a, b) => Math.abs(b.porLote[i]) - Math.abs(a.porLote[i])).slice(0, 5) : [];
  const malos = e.controles.filter((x) => x.estado !== 'OK');
  const [copiado, setCopiado] = useState('');
  const enlace = typeof window !== 'undefined' && /^https?:/.test(window.location.href) ? window.location.href.split('#')[0] + `#/expensa?p=${p.ID_Periodo}` : '';

  const texto = [
    `*${e.cfgVista?.nombre} · Expensa de ${mesLargo(p.Mes).toLowerCase()}*`,
    m
      ? `${lote}: ${money(v.lotes[i].modelo)}. La administración anterior había liquidado ${money(v.lotes[i].oficial)} (${money(v.lotes[i].diferencia, { signo: true })}, ${pct(ratioOf(v.lotes[i].diferencia, v.lotes[i].oficial), 2, { signo: true })}).`
      : `${lote}: ${money(o.lotes[i].oficial)} (liquidación sin revisar).`,
    `Vence el ${fecha(p.Fecha_Vencimiento)}.`,
    ...(difs.length ? ['', '*Lo que más cambia en tu lote:*', ...difs.map((d) => `• ${d.criterio.titulo}: ${money(d.porLote[i], { signo: true })}`)] : []),
    '',
    `*Cuentas:* plata libre después de pagar lo pendiente ${money(c.plataLibre)}. ${c.morosidad.lotesConDeuda} de ${c.morosidad.lotes} lotes con deuda.`,
    `*Controles:* ${e.controles.length - malos.length} de ${e.controles.length} cierran${malos.length ? `; para aclarar: ${malos.map((x) => x.titulo.toLowerCase()).join('; ')}` : ''}.`,
    '',
    'Son indicadores para revisar, no acusaciones.',
    enlace,
  ]
    .filter((x) => x !== undefined)
    .join('\n')
    .trim();

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setCopiado('Copiado. Pegalo en WhatsApp.');
    } catch {
      setCopiado('No se pudo copiar: seleccioná el texto y copialo a mano.');
    }
  };
  const imprimir = () => {
    try {
      window.print();
    } catch {
      setCopiado('Este visor no deja imprimir. Abrí la app publicada y probá de nuevo.');
    }
  };

  return (
    <>
      <div className="no-print">
        <Cabecera eyebrow="Para compartir" titulo="Resumen para WhatsApp" bajada="Una hoja con lo importante. Guardala como PDF o copiá el texto." />
      </div>
      <div className="row no-print">
        <button className="boton primario" onClick={imprimir}>
          Imprimir o guardar PDF
        </button>
        <button className="boton" onClick={copiar}>
          Copiar texto
        </button>
        <a className="boton" href={`https://wa.me/?text=${encodeURIComponent(texto)}`} target="_blank" rel="noreferrer">
          Abrir WhatsApp
        </a>
        {copiado && <span className="small muted">{copiado}</span>}
      </div>

      <div className="resumen stack">
        <Card>
          <span className="xs muted">
            {e.cfgVista?.nombre} · {lote} · {mesLargo(p.Mes)}
          </span>
          <div className="grilla-montos">
            <div>
              <span>Liquidación anterior</span>
              <M c={v.lotes[i].oficial} />
            </div>
            <div>
              <span>Esta liquidación</span>
              {m ? <b><M c={v.lotes[i].modelo} /></b> : <span className="muted">pendiente</span>}
            </div>
            <div>
              <span>Diferencia</span>
              {m ? <Dif c={v.lotes[i].diferencia} /> : <span className="muted">—</span>}
            </div>
          </div>
          <span className="small">Vence el {fecha(p.Fecha_Vencimiento)}.</span>
        </Card>
        {difs.length > 0 && (
          <Card titulo="Lo que más cambia en tu lote">
            <div className="lista small">
              {difs.map((d) => (
                <div key={d.criterio.id} className="between">
                  <span>{d.criterio.titulo}</span>
                  <Dif c={d.porLote[i]} />
                </div>
              ))}
            </div>
          </Card>
        )}
        <Card titulo="En qué se va">
          <div className="lista small">
            {v.rubros.map((r) => (
              <div key={r.rubro} className="between">
                <span>{r.rubro}</span>
                <span>
                  <M c={mulRound(r.importe, v.lotes[i].coef)} /> <span className="muted num">({pct(r.participacion)})</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
        <Card titulo="Cuentas">
          <div className="lista small">
            <div className="between">
              <span>Plata libre después de pagar lo pendiente</span>
              <M c={c.plataLibre} />
            </div>
            <div className="between">
              <span>Lotes con deuda</span>
              <span className="num">
                {c.morosidad.lotesConDeuda} de {c.morosidad.lotes}
              </span>
            </div>
            <div className="between">
              <span>Controles que cierran</span>
              <span className="num">
                {e.controles.length - malos.length} de {e.controles.length}
              </span>
            </div>
          </div>
        </Card>
        <details className="tec no-print">
          <summary>Ver el texto para WhatsApp</summary>
          <pre className="small" style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--sans)' }}>
            {texto}
          </pre>
        </details>
        <span className="xs muted">Son indicadores para revisar, no acusaciones. Cada número se puede rastrear en la app hasta su documento.</span>
      </div>
    </>
  );
}
