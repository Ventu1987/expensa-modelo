import { useState } from 'react';
import { useEstado, MODELO_API } from '../estado';
import { Card, Chip } from '../ui/comun';

/** Comentarios de la administración: se editan en la expensa y se guardan en la planilla del modelo. */
export function EdicionComentarios() {
  const e = useEstado();
  const L = e.liquidacion;
  const [clave, setClave] = useState('');
  const [msg, setMsg] = useState('');
  const [enviando, setEnviando] = useState(false);
  if (!L) return null;

  const filas = [
    ...Object.entries(e.ediciones.porque).map(([k, v]) => ['COMENTARIOS', L.idPeriodo, k, v]),
    ...Object.entries(e.ediciones.notas).map(([k, v]) => ['NOTAS', L.idPeriodo, k, v]),
  ];
  const tsv = filas.map((f) => f.map((x) => x.replace(/\t|\n/g, ' ')).join('\t')).join('\n');

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(tsv);
      setMsg('Copiado. Pegalo en la hoja que indica la primera columna (COMENTARIOS o NOTAS), sin esa columna.');
    } catch {
      setMsg('No se pudo copiar. Seleccioná el texto de abajo y copialo a mano.');
    }
  };
  const guardar = async () => {
    if (!MODELO_API) return;
    setEnviando(true);
    setMsg('');
    try {
      const r = await fetch(MODELO_API, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ accion: 'comentarios', clave, idPeriodo: L.idPeriodo, porque: e.ediciones.porque, notas: e.ediciones.notas }),
      });
      const j = await r.json();
      if (!j.ok) throw new Error(j.error || 'La planilla no aceptó los cambios');
      setMsg(`Guardado en la planilla (${j.guardados} cambios). Se ven publicados al recargar.`);
      e.descartarEdiciones();
    } catch (err) {
      setMsg(`No se guardó: ${(err as Error).message}`);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <Card titulo="Comentarios de la expensa" bajada="El “por qué” de cada gasto, las notas de cada sección y los comentarios de las regularizaciones.">
      <div className="between">
        <span>Modo edición</span>
        <button className={`boton ${e.editando ? 'primario' : ''}`} onClick={() => e.setEditando(!e.editando)}>
          {e.editando ? 'Terminar de editar' : 'Editar comentarios'}
        </button>
      </div>
      {e.editando && (
        <span className="small">
          Andá a <a href={`#/expensa?p=${L.idPeriodo}`}>la expensa</a>: cada comentario aparece como un campo para escribir. Los cambios quedan como borrador en este dispositivo hasta que los guardes.
        </span>
      )}
      {L.sinPorque.length > 0 && (
        <div className="aviso small">
          <b>Faltan explicar {L.sinPorque.length} variaciones de 5% o más:</b> {L.sinPorque.map((f) => f.etiqueta).join(', ')}.
        </div>
      )}
      <div className="between">
        <span>Cambios sin guardar</span>
        <Chip tono={e.cambios ? 'warn' : 'ok'}>{e.cambios}</Chip>
      </div>
      {e.cambios > 0 && (
        <>
          {MODELO_API ? (
            <div className="row">
              <input className="campo" type="password" placeholder="Clave de edición" value={clave} onChange={(ev) => setClave(ev.target.value)} aria-label="Clave de edición" />
              <button className="boton primario" onClick={guardar} disabled={!clave || enviando}>
                {enviando ? 'Guardando…' : 'Guardar en la planilla'}
              </button>
            </div>
          ) : (
            <span className="xs muted">La planilla del modelo no está conectada (VITE_MODELO_API). Copiá los cambios y pegalos en la planilla.</span>
          )}
          <div className="row">
            <button className="boton" onClick={copiar}>
              Copiar para la planilla
            </button>
            <button className="boton" onClick={() => confirm('¿Descartar los cambios sin guardar?') && e.descartarEdiciones()}>
              Descartar
            </button>
          </div>
          <pre className="xs" style={{ whiteSpace: 'pre-wrap', margin: 0, background: 'var(--field)', padding: 8, borderRadius: 8 }}>
            {tsv}
          </pre>
        </>
      )}
      {msg && <span className="small">{msg}</span>}
    </Card>
  );
}
