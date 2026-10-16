import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Datos } from './data/types';
import { cargarDatos, type Carga } from './data/loader';
import type { ConfigBarrio, ConfigPeriodo } from './modelo/tipos';
import { calcularModelo, periodosDe, type OpcionesModelo, type ResultadoModelo } from './modelo/modelo';
import { calcularCuentas, type Cuentas } from './modelo/cuentas';
import { calcularControles, type Control } from './modelo/controles';
import S2 from './modelo/config/S2.json';
import { armarLiquidacion, type Ediciones, type Liquidacion } from './expensa/liquidacion';

export const BARRIOS = [
  { id: 'S2', nombre: 'Senderos II' },
  { id: 'LH', nombre: 'La Huella' },
  { id: 'S1', nombre: 'Senderos I' },
] as const;

const CONFIGS: Record<string, ConfigBarrio> = { S2: S2 as unknown as ConfigBarrio };

// Planilla del modelo (Apps Script propio). Si no está configurada o no responde, se usa la copia del repo.
export const MODELO_API = import.meta.env?.VITE_MODELO_API as string | undefined;

async function cargarConfig(barrio: string): Promise<ConfigBarrio | null> {
  if (MODELO_API) {
    try {
      const r = await fetch(`${MODELO_API}?barrio=${barrio}`);
      if (r.ok) {
        const j = (await r.json()) as ConfigBarrio;
        if (j?.periodos) return j;
      }
    } catch {
      /* se usa la copia */
    }
  }
  return CONFIGS[barrio] ?? null;
}

/** Para barrios sin modelo: solo los datos oficiales, sin criterios. */
export function configOficial(datos: Datos, barrio: string): ConfigBarrio {
  const ps = periodosDe(datos, barrio);
  const ult = ps[ps.length - 1];
  const b = datos.sheets.BARRIOS.find((x) => x.ID_Barrio === barrio);
  const vacio: ConfigPeriodo = { criterios: [], deudas: [], creditos: [], novedades: [], comentarios: {} };
  return {
    barrio,
    nombre: String(b?.Nombre ?? barrio),
    tiposLote: [{ tipo: 'Lote tipo', cantidad: Number(ult?.Cantidad_Unidades) || 1, coef: ult ? `${ult.Expensa_Ord_Lote_Tipo}/${ult.Base_Prorrateo_Ord}` : '0' }],
    coefFuente: 'Liquidación oficial',
    coefEstado: 'REVISAR',
    coefFideicomiso: CONFIGS.S2.coefFideicomiso,
    coefFideicomisoFuente: CONFIGS.S2.coefFideicomisoFuente,
    reserva: { pct: '0.05', activa: false, nota: '' },
    cuenta: { titularActual: 'N/D', titularCorrecto: 'N/D', nota: '' },
    periodos: Object.fromEntries(ps.map((p) => [p.ID_Periodo, vacio])),
  };
}

export interface Ruta {
  pagina: string;
  params: URLSearchParams;
}

function leerRuta(): Ruta {
  const h = window.location.hash.replace(/^#\/?/, '');
  const [pagina, q = ''] = h.split('?');
  return { pagina: pagina || 'expensa', params: new URLSearchParams(q) };
}

export function ir(pagina: string, params: Record<string, string> = {}) {
  const q = new URLSearchParams(params).toString();
  window.location.hash = `#/${pagina}${q ? `?${q}` : ''}`;
}

export type Tema = 'sistema' | 'claro' | 'oscuro';

function leerTema(): Tema {
  try {
    const t = localStorage.getItem('expensa-modelo:tema');
    return t === 'claro' || t === 'oscuro' ? t : 'sistema';
  } catch {
    return 'sistema';
  }
}

export interface Estado {
  carga: Carga | null;
  datos: Datos | null;
  barrio: string;
  setBarrio: (b: string) => void;
  idPeriodo: string;
  setPeriodo: (p: string) => void;
  periodos: { id: string; mes: string }[];
  cfg: ConfigBarrio | null; // configuración real del modelo (null si no hay)
  cfgVista: ConfigBarrio | null; // la real o la oficial
  modelo: ResultadoModelo | null; // null: modelo pendiente para este mes
  oficial: ResultadoModelo | null; // datos oficiales, siempre que haya período
  cuentas: Cuentas | null;
  controles: Control[];
  opciones: OpcionesModelo;
  alternar: (id: string, activo: boolean, porDefecto: boolean) => void;
  setReserva: (v: boolean) => void;
  restablecer: () => void;
  tipoLote: number;
  setTipoLote: (i: number) => void;
  tema: Tema;
  setTema: (t: Tema) => void;
  ruta: Ruta;
  comprobantesDe: string | null;
  verComprobantes: (idGasto: string | null) => void;
  liquidacion: Liquidacion | null;
  editando: boolean;
  setEditando: (v: boolean) => void;
  ediciones: Ediciones;
  editar: (tipo: 'porque' | 'notas', clave: string, texto: string) => void;
  descartarEdiciones: () => void;
  cambios: number;
}

const vacias = (): Ediciones => ({ porque: {}, notas: {} });
function leerEdiciones(id: string): Ediciones {
  try {
    const t = localStorage.getItem(`expensa-modelo:ediciones:${id}`);
    return t ? { ...vacias(), ...JSON.parse(t) } : vacias();
  } catch {
    return vacias();
  }
}

const Ctx = createContext<Estado | null>(null);
export const useEstado = () => useContext(Ctx)!;

export function Proveedor({ children }: { children: ReactNode }) {
  const [carga, setCarga] = useState<Carga | null>(null);
  const [barrio, setBarrioS] = useState('S2');
  const [idPeriodo, setPeriodo] = useState('');
  const [cfg, setCfg] = useState<ConfigBarrio | null>(null);
  const [apagados, setApagados] = useState<Set<string>>(new Set());
  const [encendidos, setEncendidos] = useState<Set<string>>(new Set());
  const [reserva, setReservaS] = useState<boolean | undefined>(undefined);
  const [tipoLote, setTipoLote] = useState(0);
  const [tema, setTemaS] = useState<Tema>(leerTema);
  const [ruta, setRuta] = useState<Ruta>(leerRuta);
  const [comprobantesDe, verComprobantes] = useState<string | null>(null);
  const [editando, setEditando] = useState(false);
  const [ediciones, setEdiciones] = useState<Ediciones>(vacias);

  useEffect(() => {
    const f = () => setRuta(leerRuta());
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);

  useEffect(() => {
    // La API de la auditoría trae los datos de todos los barrios auditados.
    cargarDatos('S2').then(setCarga);
  }, []);

  useEffect(() => {
    let vivo = true;
    cargarConfig(barrio).then((c) => vivo && setCfg(c));
    return () => {
      vivo = false;
    };
  }, [barrio]);

  useEffect(() => {
    const el = document.documentElement;
    if (tema === 'sistema') el.removeAttribute('data-theme');
    else el.setAttribute('data-theme', tema === 'oscuro' ? 'dark' : 'light');
    try {
      if (tema === 'sistema') localStorage.removeItem('expensa-modelo:tema');
      else localStorage.setItem('expensa-modelo:tema', tema);
    } catch {
      /* sin almacenamiento: el tema vale solo para esta visita */
    }
  }, [tema]);

  const datos = carga?.datos ?? null;
  const periodos = useMemo(() => (datos ? periodosDe(datos, barrio).map((p) => ({ id: p.ID_Periodo, mes: p.Mes })) : []), [datos, barrio]);

  // Mes por defecto: el último con modelo; si no hay, el último publicado. El enlace puede pedir otro (?p=).
  useEffect(() => {
    if (!periodos.length) {
      setPeriodo('');
      return;
    }
    const pedido = ruta.params.get('p');
    if (pedido && periodos.some((p) => p.id === pedido)) {
      setPeriodo(pedido);
      return;
    }
    if (periodos.some((p) => p.id === idPeriodo)) return;
    const conModelo = [...periodos].reverse().find((p) => cfg?.periodos[p.id]);
    setPeriodo((conModelo ?? periodos[periodos.length - 1]).id);
  }, [periodos, cfg]); // eslint-disable-line react-hooks/exhaustive-deps

  const cfgVista = useMemo(() => (datos ? (cfg ?? configOficial(datos, barrio)) : null), [datos, cfg, barrio]);
  const opciones: OpcionesModelo = useMemo(() => ({ apagados, encendidos, reserva }), [apagados, encendidos, reserva]);

  const modelo = useMemo(
    () => (datos && cfg && idPeriodo && cfg.periodos[idPeriodo] ? calcularModelo(datos, cfg, idPeriodo, opciones) : null),
    [datos, cfg, idPeriodo, opciones],
  );
  const oficial = useMemo(() => {
    if (!datos || !idPeriodo) return null;
    const base = cfg?.periodos[idPeriodo] ? cfg : configOficial(datos, barrio);
    return calcularModelo(datos, base, idPeriodo, { apagados: new Set((base.periodos[idPeriodo]?.criterios ?? []).map((c) => c.id)) });
  }, [datos, cfg, idPeriodo, barrio]);
  const cuentas = useMemo(() => (datos && idPeriodo ? calcularCuentas(datos, idPeriodo, cfg?.periodos[idPeriodo]) : null), [datos, idPeriodo, cfg]);
  const controles = useMemo(() => (datos && cuentas && idPeriodo ? calcularControles(datos, idPeriodo, cuentas, modelo) : []), [datos, cuentas, idPeriodo, modelo]);

  useEffect(() => {
    if (idPeriodo) setEdiciones(leerEdiciones(idPeriodo));
  }, [idPeriodo]);
  const guardarBorrador = (ed: Ediciones) => {
    setEdiciones(ed);
    try {
      localStorage.setItem(`expensa-modelo:ediciones:${idPeriodo}`, JSON.stringify(ed));
    } catch {
      /* el borrador vale solo mientras la página está abierta */
    }
  };
  const oficialCfg = useMemo(() => (datos ? configOficial(datos, barrio) : null), [datos, barrio]);
  const liquidacion = useMemo(
    () => (datos && oficialCfg && idPeriodo ? armarLiquidacion(datos, cfg, oficialCfg, barrio, idPeriodo, { ...opciones, lote: tipoLote }, ediciones) : null),
    [datos, cfg, oficialCfg, barrio, idPeriodo, opciones, tipoLote, ediciones],
  );

  const e: Estado = {
    carga,
    datos,
    barrio,
    setBarrio: (b) => {
      setBarrioS(b);
      setCfg(null);
      setPeriodo('');
      setTipoLote(0);
      setApagados(new Set());
      setEncendidos(new Set());
    },
    idPeriodo,
    setPeriodo,
    periodos,
    cfg,
    cfgVista,
    modelo,
    oficial,
    cuentas,
    controles,
    opciones,
    alternar: (id, activo, porDefecto) => {
      const a = new Set(apagados);
      const en = new Set(encendidos);
      a.delete(id);
      en.delete(id);
      if (activo && !porDefecto) en.add(id);
      if (!activo && porDefecto) a.add(id);
      setApagados(a);
      setEncendidos(en);
    },
    setReserva: (v) => setReservaS(v),
    restablecer: () => {
      setApagados(new Set());
      setEncendidos(new Set());
      setReservaS(undefined);
    },
    tipoLote,
    setTipoLote,
    tema,
    setTema: setTemaS,
    ruta,
    comprobantesDe,
    verComprobantes,
    liquidacion,
    editando,
    setEditando,
    ediciones,
    editar: (tipo, clave, texto) => guardarBorrador({ ...ediciones, [tipo]: { ...ediciones[tipo], [clave]: texto } }),
    descartarEdiciones: () => guardarBorrador(vacias()),
    cambios: Object.keys(ediciones.porque).length + Object.keys(ediciones.notas).length,
  };
  return <Ctx.Provider value={e}>{children}</Ctx.Provider>;
}
