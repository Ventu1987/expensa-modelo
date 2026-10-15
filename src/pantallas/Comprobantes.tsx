import { useEffect } from 'react';
import { useEstado } from '../estado';
import { Chip, M } from '../ui/comun';
import { cents } from '../lib/money';
import { fecha } from '../lib/fecha';

const TIPOS: Record<string, string> = {
  FACTURA: 'Factura',
  IMAGEN: 'Comprobante de caja chica',
  ORDEN_PAGO: 'Orden de pago',
  PAGO_SERVICIO: 'Pago del servicio',
  TRANSFERENCIA: 'Transferencia',
  ACREDITACION: 'Acreditación',
  EXTRACTO: 'Extracto',
  F931: 'Formulario 931',
  SINDICATO: 'Pago al sindicato',
  PLANILLA_SUELDOS: 'Planilla de sueldos',
  PANTALLA_SALDO: 'Captura de saldo',
  PRESUPUESTO: 'Presupuesto',
  REFERENCIA: 'Referencia',
  OTRO: 'Otro',
};
const REVISION: Record<string, string> = {
  TICKET_FISCAL: 'Tique fiscal',
  FACTURA: 'Factura',
  NO_FISCAL: 'Sin validez fiscal',
  PRESUPUESTO: 'Presupuesto',
  IGNORAR: 'No corresponde',
};

/** Detalle de los comprobantes de un gasto. No muestra nombres de archivo (pueden tener datos de propietarios). */
export function Comprobantes() {
  const e = useEstado();
  const id = e.comprobantesDe!;
  const g = e.datos!.sheets.GASTOS.find((x) => x.ID_Gasto === id);
  const cs = e.datos!.sheets.COMPROBANTES.filter((c) => c.ID_Gasto === id);
  useEffect(() => {
    const f = (ev: KeyboardEvent) => ev.key === 'Escape' && e.verComprobantes(null);
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [e]);

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Comprobantes" onClick={() => e.verComprobantes(null)}>
      <div onClick={(ev) => ev.stopPropagation()}>
        <div className="between">
          <h2>Comprobantes</h2>
          <button className="boton" onClick={() => e.verComprobantes(null)}>
            Cerrar
          </button>
        </div>
        {g && (
          <p className="small muted">
            {g.Concepto_Normalizado} · liquidado <M c={cents(g.Importe)} /> · {g.Fuente_PDF}
            {g.Pagina ? `, pág. ${g.Pagina}` : ''}
          </p>
        )}
        {!cs.length && <div className="aviso">N/D: no hay comprobantes cargados para este gasto. Hay que pedirlos a la administración.</div>}
        <div className="lista">
          {cs.map((c) => {
            let segundo: number | null = null;
            try {
              const j = JSON.parse(c.Detalle_JSON || '{}');
              if (typeof j.segundoVto === 'number') segundo = cents(j.segundoVto);
            } catch {
              /* sin detalle */
            }
            return (
              <div key={c.ID_Comprobante} className="stack-s">
                <div className="between">
                  <b>
                    {REVISION[c.Revision] ?? TIPOS[c.Tipo] ?? c.Tipo} {c.Numero}
                  </b>
                  {c.Importe === '' ? <span className="num muted">N/D</span> : <M c={cents(c.Importe)} />}
                </div>
                <div className="row xs muted">
                  <span>{c.ID_Comprobante}</span>
                  {c.Emisor && <span>· {c.Emisor}</span>}
                  {c.CUIT_Emisor && <span className="num">· CUIT {c.CUIT_Emisor}</span>}
                  {c.Fecha && <span>· {fecha(c.Fecha)}</span>}
                </div>
                <div className="row">
                  <Chip tono={c.Es_Fiscal === 'SI' ? 'ok' : c.Es_Fiscal === 'NO' ? 'warn' : undefined}>
                    {c.Es_Fiscal === 'SI' ? 'Fiscal' : c.Es_Fiscal === 'NO' ? 'Sin validez fiscal' : 'REVISAR'}
                  </Chip>
                  {segundo !== null && (
                    <span className="xs muted">
                      2.º vencimiento: <M c={segundo} />
                    </span>
                  )}
                </div>
                {c.Nota && <span className="xs">{c.Nota}</span>}
              </div>
            );
          })}
        </div>
        <span className="xs muted">Los archivos originales se piden a la administración. No se publican porque algunos cupones tienen datos de los propietarios.</span>
      </div>
    </div>
  );
}
