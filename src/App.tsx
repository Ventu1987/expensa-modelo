import { useState } from 'react';
import { BARRIOS, useEstado, type Tema } from './estado';
import { Icono } from './ui/comun';
import { mesLargo } from './lib/fecha';
import { TuExpensa } from './pantallas/TuExpensa';
import { CadaPeso } from './pantallas/CadaPeso';
import { Reparto } from './pantallas/Reparto';
import { CuentasPantalla } from './pantallas/Cuentas';
import { Morosidad } from './pantallas/Morosidad';
import { Obras } from './pantallas/Obras';
import { Modelo } from './pantallas/Modelo';
import { Historial } from './pantallas/Historial';
import { Novedades } from './pantallas/Novedades';
import { Resumen } from './pantallas/Resumen';
import { Admin } from './pantallas/Admin';
import { Comprobantes } from './pantallas/Comprobantes';

const PAGINAS = [
  { id: 'expensa', titulo: 'Tu expensa', corto: 'Expensa', C: TuExpensa },
  { id: 'peso', titulo: 'De dónde sale cada peso', corto: 'Cada peso', C: CadaPeso },
  { id: 'cuentas', titulo: 'Estado de cuentas', corto: 'Cuentas', C: CuentasPantalla },
  { id: 'modelo', titulo: 'Actual contra modelo', corto: 'Modelo', C: Modelo },
  { id: 'reparto', titulo: 'Reparto del Fideicomiso', corto: 'Reparto', C: Reparto },
  { id: 'morosidad', titulo: 'Morosidad', corto: 'Morosidad', C: Morosidad },
  { id: 'obras', titulo: 'Obras y extraordinarios', corto: 'Obras', C: Obras },
  { id: 'historial', titulo: 'Historial', corto: 'Historial', C: Historial },
  { id: 'novedades', titulo: 'Novedades', corto: 'Novedades', C: Novedades },
  { id: 'resumen', titulo: 'Resumen para WhatsApp', corto: 'Resumen', C: Resumen },
  { id: 'admin', titulo: 'Modo administrador', corto: 'Admin', C: Admin },
];
const INFERIOR = ['expensa', 'peso', 'cuentas', 'modelo'];

function Selectores() {
  const e = useEstado();
  return (
    <>
      <select aria-label="Barrio" value={e.barrio} onChange={(ev) => e.setBarrio(ev.target.value)}>
        {BARRIOS.map((b) => (
          <option key={b.id} value={b.id}>
            {b.nombre}
          </option>
        ))}
      </select>
      <select aria-label="Mes" value={e.idPeriodo} onChange={(ev) => e.setPeriodo(ev.target.value)} disabled={!e.periodos.length}>
        {!e.periodos.length && <option value="">Sin datos</option>}
        {[...e.periodos].reverse().map((p) => (
          <option key={p.id} value={p.id}>
            {mesLargo(p.mes)}
            {e.cfg?.periodos[p.id] ? '' : ' · oficial'}
          </option>
        ))}
      </select>
    </>
  );
}

function SelectorTema() {
  const { tema, setTema } = useEstado();
  const op: [Tema, string][] = [
    ['claro', 'Claro'],
    ['oscuro', 'Oscuro'],
    ['sistema', 'Auto'],
  ];
  return (
    <div className="tema" role="group" aria-label="Tema">
      {op.map(([t, l]) => (
        <button key={t} className={tema === t ? 'activo' : ''} onClick={() => setTema(t)} aria-pressed={tema === t}>
          {l}
        </button>
      ))}
    </div>
  );
}

export function App() {
  const e = useEstado();
  const [mas, setMas] = useState(false);
  const pag = PAGINAS.find((p) => p.id === e.ruta.pagina) ?? PAGINAS[0];
  const q = e.idPeriodo ? `?p=${e.idPeriodo}` : '';
  const Pagina = pag.C;

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <span>Fideicomiso Bella Vista</span>
          <b>Expensa modelo</b>
        </div>
        <div className="stack-s">
          <Selectores />
        </div>
        <nav aria-label="Secciones">
          {PAGINAS.map((p) => (
            <a key={p.id} href={`#/${p.id}${q}`} className={p.id === pag.id ? 'activo' : ''} aria-current={p.id === pag.id ? 'page' : undefined}>
              <Icono n={p.id} />
              {p.titulo}
            </a>
          ))}
        </nav>
        <div style={{ marginTop: 'auto' }} className="stack-s">
          <SelectorTema />
          <span className="xs muted">{e.carga ? (e.carga.origen === 'api' ? 'Datos en vivo de la auditoría' : 'Copia de los datos de la auditoría') : 'Cargando datos…'}</span>
        </div>
      </aside>

      <header className="top">
        <div className="marca">
          <span>Bella Vista</span>
          <b>Expensa modelo</b>
        </div>
        <div className="selects">
          <Selectores />
        </div>
      </header>

      <main className="contenido">
        {!e.carga ? (
          <p className="muted">Cargando los datos de la auditoría…</p>
        ) : !e.idPeriodo ? (
          <div className="aviso">
            {BARRIOS.find((b) => b.id === e.barrio)?.nombre}: N/D. La auditoría todavía no cargó liquidaciones de este barrio.
          </div>
        ) : (
          <Pagina />
        )}
        <footer className="xs muted no-print stack-s" style={{ paddingTop: 8 }}>
          <span>
            Las observaciones son indicadores para revisar, no acusaciones. Fuente: liquidaciones oficiales y documentos cargados en la auditoría. {e.carga?.detalle}
          </span>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>N/D = dato que falta · REVISAR = dato dudoso</span>
            <span className="top-tema">
              <SelectorTema />
            </span>
          </div>
        </footer>
      </main>

      <nav className="nav-inferior" aria-label="Secciones principales">
        {INFERIOR.map((id) => {
          const p = PAGINAS.find((x) => x.id === id)!;
          return (
            <a key={id} href={`#/${id}${q}`} className={pag.id === id ? 'activo' : ''}>
              <Icono n={id} />
              {p.corto}
            </a>
          );
        })}
        <button className={!INFERIOR.includes(pag.id) ? 'activo' : ''} onClick={() => setMas(true)}>
          <Icono n="mas" />
          Más
        </button>
      </nav>
      {mas && (
        <div className="hoja-mas" onClick={() => setMas(false)}>
          <div onClick={(ev) => ev.stopPropagation()}>
            {PAGINAS.filter((p) => !INFERIOR.includes(p.id)).map((p) => (
              <a key={p.id} href={`#/${p.id}${q}`} onClick={() => setMas(false)}>
                {p.titulo}
              </a>
            ))}
          </div>
        </div>
      )}
      {e.comprobantesDe && <Comprobantes />}
    </div>
  );
}
