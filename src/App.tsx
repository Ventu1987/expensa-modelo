import { useEffect, useState } from 'react';
import { BARRIOS, useEstado, type Tema } from './estado';
import { Icono } from './ui/comun';
import { mesLargo } from './lib/fecha';
import { Expensa } from './expensa/Expensa';
import { SECCIONES, irA } from './expensa/piezas';
import { Modelo } from './pantallas/Modelo';
import { Resumen } from './pantallas/Resumen';
import { Admin } from './pantallas/Admin';
import { Comprobantes } from './pantallas/Comprobantes';

const PAGINAS = [
  { id: 'expensa', titulo: 'Liquidación del mes', corto: 'Expensa', icono: 'resumen', C: Expensa },
  { id: 'whatsapp', titulo: 'Resumen para WhatsApp', corto: 'WhatsApp', icono: 'novedades', C: Resumen },
  { id: 'anexo', titulo: 'Anexo: diferencias con la liquidación anterior', corto: 'Anexo', icono: 'modelo', C: Modelo },
  { id: 'admin', titulo: 'Administración', corto: 'Admin', icono: 'admin', C: Admin },
];

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
            {e.cfg?.periodos[p.id] ? (e.cfg.periodos[p.id].automatico ? ' · preliminar' : '') : ' · sin revisar'}
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

function imprimir() {
  try {
    window.print();
  } catch {
    alert('Este visor no deja imprimir. Abrí la app publicada y probá de nuevo.');
  }
}

/** Sección visible, para marcarla en el índice. */
function useSeccionActiva(activo: boolean) {
  const [sec, setSec] = useState('resumen');
  useEffect(() => {
    if (!activo || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver(
      (ents) => {
        const v = ents.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (v) setSec(v.target.id);
      },
      { rootMargin: '-20% 0px -70% 0px' },
    );
    SECCIONES.forEach(([id]) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  });
  return sec;
}

export function App() {
  const e = useEstado();
  const [indice, setIndice] = useState(false);
  const pag = PAGINAS.find((p) => p.id === e.ruta.pagina) ?? PAGINAS[0];
  const q = e.idPeriodo ? `?p=${e.idPeriodo}` : '';
  const Pagina = pag.C;
  const enExpensa = pag.id === 'expensa';
  const sec = useSeccionActiva(enExpensa && !!e.liquidacion);
  const ir = (id: string) => {
    setIndice(false);
    if (!enExpensa) {
      window.location.hash = `#/expensa${q}`;
      setTimeout(() => irA(id), 120);
    } else irA(id);
  };

  return (
    <div className="app">
      <aside className="lateral">
        <div className="marca">
          <span>Fideicomiso Bella Vista</span>
          <b>Expensas</b>
        </div>
        <div className="stack-s">
          <Selectores />
        </div>
        <nav aria-label="Páginas">
          {PAGINAS.map((p) => (
            <a key={p.id} href={`#/${p.id}${q}`} className={p.id === pag.id ? 'activo' : ''} aria-current={p.id === pag.id ? 'page' : undefined}>
              <Icono n={p.icono} />
              {p.titulo}
            </a>
          ))}
        </nav>
        {enExpensa && (
          <nav aria-label="Índice" className="indice">
            <span className="xs muted">Índice</span>
            {SECCIONES.map(([id, t], k) => (
              <button key={id} className={sec === id ? 'activo' : ''} onClick={() => ir(id)}>
                <span className="num xs muted">{String(k + 1).padStart(2, '0')}</span> {t}
              </button>
            ))}
          </nav>
        )}
        <div style={{ marginTop: 'auto' }} className="stack-s">
          <button className="boton" onClick={imprimir}>
            Descargar PDF
          </button>
          <SelectorTema />
          <span className="xs muted">{e.carga ? (e.carga.origen === 'api' ? 'Datos en vivo de la auditoría' : 'Copia de los datos de la auditoría') : 'Cargando datos…'}</span>
        </div>
      </aside>

      <header className="top">
        <div className="marca">
          <span>Bella Vista</span>
          <b>Expensas</b>
        </div>
        <div className="selects">
          <Selectores />
        </div>
      </header>

      <main className="contenido">
        {e.editando && (
          <div className="aviso info small no-print barra-edicion">
            <span>
              <b>Modo edición.</b> {e.cambios} cambio{e.cambios === 1 ? '' : 's'} sin guardar.
            </span>
            <a href={`#/admin${q}`}>Guardar o terminar</a>
          </div>
        )}
        {!e.carga ? (
          <p className="muted">Cargando los datos…</p>
        ) : !e.idPeriodo ? (
          <div className="aviso">{BARRIOS.find((b) => b.id === e.barrio)?.nombre}: N/D. Todavía no hay liquidaciones cargadas de este barrio.</div>
        ) : (
          <Pagina />
        )}
        <footer className="xs muted no-print stack-s" style={{ paddingTop: 8 }}>
          <span>{e.carga?.detalle}</span>
          <div className="row" style={{ justifyContent: 'space-between' }}>
            <span>N/D = dato que falta · REVISAR = dato a confirmar</span>
            <span className="top-tema">
              <SelectorTema />
            </span>
          </div>
        </footer>
      </main>

      <nav className="nav-inferior no-print" aria-label="Navegación">
        <a href={`#/expensa${q}`} className={enExpensa ? 'activo' : ''}>
          <Icono n="resumen" />
          Expensa
        </a>
        <button onClick={() => setIndice(true)}>
          <Icono n="historial" />
          Índice
        </button>
        <button onClick={imprimir}>
          <Icono n="obras" />
          PDF
        </button>
        <a href={`#/whatsapp${q}`} className={pag.id === 'whatsapp' ? 'activo' : ''}>
          <Icono n="novedades" />
          WhatsApp
        </a>
        <a href={`#/admin${q}`} className={pag.id === 'admin' || pag.id === 'anexo' ? 'activo' : ''}>
          <Icono n="admin" />
          Admin
        </a>
      </nav>
      {indice && (
        <div className="hoja-mas" onClick={() => setIndice(false)}>
          <div onClick={(ev) => ev.stopPropagation()} className="hoja-indice">
            {SECCIONES.map(([id, t], k) => (
              <button key={id} onClick={() => ir(id)}>
                <span className="num xs muted">{String(k + 1).padStart(2, '0')}</span> {t}
              </button>
            ))}
            <a href={`#/anexo${q}`} onClick={() => setIndice(false)}>
              Anexo: diferencias con la liquidación anterior
            </a>
          </div>
        </div>
      )}
      {e.comprobantesDe && <Comprobantes />}
    </div>
  );
}
