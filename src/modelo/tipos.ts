// Configuración propia de la expensa modelo. Vive en la planilla del modelo
// (ver apps-script/) y, mientras no esté configurada, en src/modelo/config/*.json.
// Los importes van como texto con punto decimal ("1200000", "71878.25") para no perder centavos.

export type TipoCriterio =
  | 'FACTURA' // liquidar el importe de la factura
  | 'IMPORTE_SUPUESTO' // un importe informado por escrito, mientras falta la factura
  | 'A_EXTRAORDINARIO' // sale del ordinario y lo paga un fondo
  | 'CAJA_CHICA_FISCAL' // solo comprobantes fiscales, por el % de participación
  | 'PROPORCION' // quitar la parte de unas facturas dentro de un reparto
  | 'POR_LOTES' // reparto por cantidad de lotes
  | 'QUITAR' // gasto duplicado o que no corresponde
  | 'FBV_EXCLUIR' // sacar un importe de la base del mantenimiento del Fideicomiso
  | 'FBV_COEF_PUBLICADO'; // usar los coeficientes publicados del barrio

export interface Criterio {
  id: string;
  hallazgos: string[];
  titulo: string;
  texto: string;
  activo: boolean;
  tipo: TipoCriterio;
  gasto?: string;
  gastos?: string[];
  comprobante?: string;
  importe?: string;
  fuente?: string;
  fondo?: string;
  quitar?: string[];
  total?: string[];
  lotes?: number;
  lotesTotal?: number;
  estimado?: boolean;
}

/** Regla que se aplica sola cada mes: se busca el gasto por concepto. */
export interface Regla {
  id: string;
  hallazgos: string[];
  titulo: string;
  texto: string;
  activo: boolean;
  tipo: 'FACTURA' | 'IMPORTE_SUPUESTO' | 'CAJA_CHICA_FISCAL' | 'A_EXTRAORDINARIO' | 'QUITAR';
  concepto: string; // Concepto_Normalizado
  importe?: string;
  fuente?: string;
  fondo?: string;
}

export interface ConfigFbv {
  gastoPropios: string;
  gastoComunes: string;
  base: { concepto: string; importe: string }[];
  partePropios: string;
  parteComunes: string;
  coefAplicadoPropios: string;
  coefAplicadoComunes: string;
}

export interface ItemCuenta {
  concepto: string;
  importe: string | null;
  nota: string;
  tipo: string;
  hallazgo?: string;
}

export interface Novedad {
  titulo: string;
  texto: string;
  tipo: 'CARGO_NUEVO' | 'CAMBIO_CRITERIO' | 'OBRA' | 'AUMENTO' | 'AVISO';
}

export interface ConfigPeriodo {
  fbv?: ConfigFbv;
  criterios: Criterio[];
  deudas: ItemCuenta[];
  creditos: ItemCuenta[];
  novedades: Novedad[];
  comentarios: Record<string, string>;
  aclaraciones?: Record<string, string>;
  notas?: Record<string, string>;
  automatico?: boolean; // armado solo con las reglas de cada mes, falta revisar
  pendientes?: string[]; // qué falta revisar en un mes armado automáticamente // notas editables: por sección (RESUMEN, FLUJO…) o por hallazgo (H01…)
  particulares?: Particulares; // hoja ESTADO_PUBLICACION: control → aclaración escrita
  publicado?: string; // fecha de publicación, si ya se publicó
}

export interface Particulares {
  concepto: string; // p. ej. "Canon de obra"
  lotes: number | null; // cuántos lotes lo pagan (null = N/D)
  valor: string | null; // valor por lote, si es fijo
  fondo: string; // a qué fondo va
  nota: string;
  estado: 'OK' | 'REVISAR';
}

export interface Administracion {
  nombre: string;
  matricula: string;
  cuit: string;
  contacto: string;
  horario: string;
  banco: string;
  cbu: string;
  alias: string;
  titular: string;
}

export interface Contrato {
  proveedor: string;
  objeto: string;
  vence: string | null;
  actualizacion: string;
  nota: string;
}

export interface TipoLote {
  tipo: string;
  cantidad: number;
  coef: string;
}

export interface ConfigBarrio {
  barrio: string;
  nombre: string;
  tiposLote: TipoLote[];
  coefFuente: string;
  coefEstado: 'OK' | 'REVISAR';
  coefFideicomiso: Record<string, { propios: string; comunes: string }>;
  coefFideicomisoFuente: string;
  reserva: { pct: string; activa: boolean; nota: string };
  cuenta: { titularActual: string; titularCorrecto: string; nota: string };
  periodos: Record<string, ConfigPeriodo>;
  administracion?: Administracion;
  reglas?: Regla[];
  contratos?: Contrato[];
  superficieM2?: { valor: number; estado: 'OK' | 'REVISAR'; fuente: string };
}
