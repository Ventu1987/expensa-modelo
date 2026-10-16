import { useEstado } from '../estado';
import { AUDITORIA_API } from '../data/loader';
import { Card, Chip } from '../ui/comun';
import { mesLargo } from '../lib/fecha';

const PORTAL = (import.meta.env?.VITE_PORTAL_URL as string | undefined) ?? AUDITORIA_API;

/** Cómo entra una liquidación nueva: se carga el PDF en la auditoría y acá se arma sola. */
export function CargaLiquidacion() {
  const e = useEstado();
  const ultimo = e.periodos[e.periodos.length - 1];
  const cfgUlt = ultimo ? e.cfg?.periodos[ultimo.id] : undefined;
  return (
    <Card titulo="Liquidación nueva" bajada="Cuando llega la expensa del mes, se carga una sola vez y la página se actualiza sola.">
      <ol className="pasos small">
        <li>
          Cargá el PDF de la liquidación en el portal de la auditoría, como hasta ahora.{' '}
          <a href={PORTAL} target="_blank" rel="noreferrer">
            Abrir el portal
          </a>
        </li>
        <li>
          Tocá <b>Actualizar datos</b>. El mes nuevo aparece arriba, en el selector de mes.
        </li>
        <li>Se arma solo con las reglas de cada mes (factura de seguridad, abono de Telered, caja chica con comprobantes fiscales, obras al fondo extraordinario) y queda como preliminar.</li>
        <li>Agregá los comentarios y completá lo que falta. Cuando todos los controles cierran o tienen aclaración, se publica.</li>
      </ol>
      <div className="row">
        <button className="boton primario" onClick={e.actualizar} disabled={e.actualizando}>
          {e.actualizando ? 'Actualizando…' : 'Actualizar datos'}
        </button>
        <span className="xs muted">{e.carga?.detalle}</span>
      </div>
      {ultimo && (
        <div className="between small">
          <span>Último mes cargado: {mesLargo(ultimo.mes)}</span>
          <Chip tono={!cfgUlt ? 'warn' : cfgUlt.automatico ? 'warn' : 'ok'}>{!cfgUlt ? 'Sin revisar' : cfgUlt.automatico ? 'Preliminar' : 'Revisado'}</Chip>
        </div>
      )}
    </Card>
  );
}
