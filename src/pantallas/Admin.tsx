import { useState } from 'react';
import { useEstado } from '../estado';
import { Cabecera, Card, Chip, EstadoChip, M } from '../ui/comun';
import { mesLargo } from '../lib/fecha';
import { estadoPublicacion } from '../modelo/controles';
import { AUDITORIA_API } from '../data/loader';
import { TarjetaControl } from './Cuentas';

export function Admin() {
  const e = useEstado();
  const p = e.oficial!.periodo;
  const [acl, setAcl] = useState<Record<string, string>>(e.modelo?.config.aclaraciones ?? {});
  const [msg, setMsg] = useState('');
  const est = estadoPublicacion(e.controles, acl);
  const fallan = e.controles.filter((c) => c.bloquea && c.estado !== 'OK');
  const m = e.modelo;

  const supuestos = [
    ...(e.cfgVista?.coefEstado !== 'OK' ? [{ t: 'Coeficientes de los lotes', d: e.cfgVista?.coefFuente ?? '', e: 'REVISAR' }] : []),
    ...(m?.efectos
      .filter((x) => x.criterio.estimado || x.criterio.tipo === 'IMPORTE_SUPUESTO' || /SUPUESTO|A CONFIRMAR/.test(x.criterio.texto))
      .map((x) => ({ t: `${x.criterio.id} · ${x.criterio.titulo}`, d: x.criterio.texto, e: x.activo ? 'SUPUESTO activo' : 'Apagado' })) ?? []),
    ...(e.cuentas?.deudas.filter((d) => d.importe === null).map((d) => ({ t: d.concepto, d: d.nota, e: 'N/D' })) ?? []),
    ...(m?.efectos.filter((x) => x.activo && !x.aplicado).map((x) => ({ t: x.criterio.titulo, d: x.motivo, e: 'N/D' })) ?? []),
  ];
  const revisarComp = e.datos!.sheets.COMPROBANTES.filter((c) => c.ID_Periodo === p.ID_Periodo && c.Es_Fiscal === 'REVISAR').length;

  return (
    <>
      <Cabecera
        eyebrow={`Modo administrador · ${e.cfgVista?.nombre} · ${mesLargo(p.Mes)}`}
        titulo="¿Se puede publicar?"
        bajada="La expensa modelo se publica solo si todo cierra o si cada diferencia tiene una aclaración escrita."
      />
      <div className={`aviso ${est.puede ? 'ok' : 'bad'}`}>
        {!m ? (
          <b>No hay modelo cargado para este mes: se publican solo los datos oficiales.</b>
        ) : est.puede ? (
          <b>Se puede publicar. {est.aclarados.length ? `${est.aclarados.length} control(es) con aclaración escrita.` : 'Todos los controles cierran.'}</b>
        ) : (
          <b>
            No se puede publicar: {est.bloqueos.length} control{est.bloqueos.length === 1 ? '' : 'es'} no cierra{est.bloqueos.length === 1 ? '' : 'n'} y no tiene
            {est.bloqueos.length === 1 ? '' : 'n'} aclaración.
          </b>
        )}
      </div>
      <div className="cols">
        <Card titulo="Controles que bloquean" bajada="Escribí la aclaración con el documento que la respalda (mínimo 20 caracteres). Se guarda en la hoja ESTADO_PUBLICACION." className="span-2">
          {fallan.length === 0 && <span className="muted">Ninguno.</span>}
          <div className="lista">
            {fallan.map((c) => (
              <div key={c.id} className="stack-s">
                <TarjetaControl c={c} />
                <textarea
                  className="campo"
                  placeholder="Aclaración de la administración y documento que la respalda"
                  value={acl[c.id] ?? ''}
                  onChange={(ev) => setAcl({ ...acl, [c.id]: ev.target.value })}
                  aria-label={`Aclaración: ${c.titulo}`}
                />
              </div>
            ))}
          </div>
          <div className="row">
            <button
              className="boton primario"
              disabled={!est.puede || !m}
              onClick={() => setMsg('Vista previa: en la app publicada, esto marca el mes como PUBLICADO en la hoja ESTADO_PUBLICACION, con la fecha y las aclaraciones.')}
            >
              Publicar {mesLargo(p.Mes).toLowerCase()}
            </button>
            {msg && <span className="small muted">{msg}</span>}
          </div>
        </Card>

        <Card titulo="Para revisar (no bloquean)">
          <div className="lista">
            {est.revisar.map((c) => (
              <TarjetaControl key={c.id} c={c} />
            ))}
            {revisarComp > 0 && (
              <div className="between small">
                <span>Comprobantes con validez fiscal sin confirmar</span>
                <span className="num">{revisarComp}</span>
              </div>
            )}
            {!est.revisar.length && !revisarComp && <span className="muted small">Nada.</span>}
          </div>
        </Card>

        <Card titulo="Supuestos y datos que faltan" bajada="Cada uno se ve marcado en la expensa.">
          <div className="lista">
            {supuestos.map((s, k) => (
              <div key={k} className="stack-s">
                <div className="between">
                  <b className="small">{s.t}</b>
                  <Chip tono={s.e === 'N/D' || s.e === 'REVISAR' ? 'warn' : s.e === 'Apagado' ? undefined : 'accent'}>{s.e}</Chip>
                </div>
                <span className="xs muted">{s.d}</span>
              </div>
            ))}
            {!supuestos.length && <span className="small muted">Ninguno.</span>}
          </div>
        </Card>

        <Card titulo="Resumen de controles">
          <div className="lista small">
            {e.controles.map((c) => (
              <div key={c.id} className="between">
                <span>
                  {c.titulo} {c.bloquea ? '' : <span className="xs muted">(informativo)</span>}
                </span>
                <span className="row" style={{ flexWrap: 'nowrap' }}>
                  {c.diferencia ? <M c={c.diferencia} signo /> : null}
                  <EstadoChip e={c.estado} />
                </span>
              </div>
            ))}
          </div>
        </Card>

        <Card titulo="De dónde salen los datos">
          <div className="lista small">
            <div className="stack-s">
              <b>Datos de la auditoría</b>
              <span>{e.carga?.origen === 'api' ? 'En vivo, de la API pública de la auditoría.' : 'Copia incluida en la app (la API no respondió).'}</span>
              <span className="xs muted" style={{ overflowWrap: 'anywhere' }}>
                {AUDITORIA_API}
              </span>
              <span className="xs muted">{e.carga?.detalle}</span>
            </div>
            <div className="stack-s">
              <b>Criterios del modelo</b>
              <span>{e.cfg ? 'Planilla del modelo (o su copia en el repositorio).' : 'Sin configuración para este barrio.'}</span>
            </div>
            <div className="stack-s">
              <b>Privacidad</b>
              <span className="xs">
                No se publican el padrón, los nombres de propietarios ni la deuda por lote; tampoco nombres de empleados ni nombres de archivo de los cupones. Los CUIT de personas
                físicas van enmascarados, salvo el del administrador.
              </span>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
}
