// Forma de los datos públicos de la auditoría: {version, updated, sheets:{HOJA:[filas]}}.
// Los nombres de columna son los de la planilla.

export type Fila = Record<string, string | number | null>;

export interface Periodo {
  ID_Periodo: string;
  Barrio: string;
  Mes: string;
  Periodo: string;
  Fecha_Vencimiento: string;
  Recargo_Vencimiento: number | string;
  Fecha_Cierre: string;
  Total_Gastos_Periodo: number;
  Base_Prorrateo_Ord: number;
  Gastos_Particulares: number;
  Total_Expensas: number;
  Ingresos: number;
  Egresos_Caja: number;
  Saldo_Inicial: number;
  Saldo_Final: number;
  Patrimonio_Neto: number;
  Gastos_Pendientes_Pago: number;
  Pagos_Periodos_Anteriores: number;
  Expensa_Ord_Lote_Tipo: number;
  Cantidad_Unidades: number;
  Unidades_Con_Deuda: number;
  Fuente_PDF: string;
  Consorcio: string;
  CUIT_Consorcio: string;
}

export interface Gasto {
  ID_Gasto: string;
  ID_Periodo: string;
  Barrio: string;
  Mes: string;
  Rubro_Original: string;
  Item: string;
  Categoria: string;
  Subcategoria: string;
  Concepto_Original: string;
  Concepto_Normalizado: string;
  ID_Proveedor: string;
  Proveedor: string;
  Detalle: string;
  Tipo_Gasto: string;
  Importe: number;
  Ordinario_Extraordinario: string;
  Periodo_Servicio: string;
  Estado_Pago: string;
  Es_Estimado: string;
  Es_Provisorio: string;
  Base_Prorrateo_Doc: number | string;
  Porc_Participacion_Doc: number | string;
  Comprobante: string;
  Observacion: string;
  Fuente_PDF: string;
  Pagina: string;
  Estado_Validacion: string;
}

export interface Comprobante {
  ID_Comprobante: string;
  ID_Periodo: string;
  Tipo: string;
  Subtipo: string;
  Es_Fiscal: string;
  Revision: string;
  Emisor: string;
  CUIT_Emisor: string;
  Receptor: string;
  CUIT_Receptor: string;
  Numero: string;
  Fecha: string;
  Importe: number | string;
  Periodo_Servicio: string;
  Ordenante: string;
  CUIT_Ordenante: string;
  Cuenta_Debito: string;
  Destinatario: string;
  CUIT_Destinatario: string;
  Concepto_Pago: string;
  ID_Gasto: string;
  ID_Pago_Ant: string;
  Nota: string;
  Detalle_JSON: string;
}

export interface MovimientoBanco {
  ID_Mov: string;
  Barrio: string;
  Banco: string;
  Cuenta: string;
  Fecha: string;
  Tipo: string;
  Descripcion: string;
  Debito: number;
  Credito: number;
  Saldo: number | string;
  Mismo_Titular: string;
  CUIT_Contraparte: string;
  Contraparte: string;
}

export interface Hallazgo {
  ID_Hallazgo: string;
  Gravedad: string;
  Titulo: string;
  Conclusion_Simple: string;
  Barrios: string;
  Estado: string;
  Publicable: string;
  Monto_Total?: number | string;
  Impacto_S1?: number | string;
  Impacto_S2?: number | string;
  Impacto_LH?: number | string;
  Que_Pedir?: string;
}

export interface Datos {
  version: number | string | null;
  updated: string | null;
  fuente: string;
  sheets: {
    BARRIOS: Fila[];
    PERIODOS: Periodo[];
    GASTOS: Gasto[];
    DETALLE_COMPONENTES: Fila[];
    PAGOS_PER_ANTERIORES: Fila[];
    INGRESOS: Fila[];
    EGRESOS_CAJA: Fila[];
    FONDOS: Fila[];
    SALDOS_PATRIMONIO: Fila[];
    COMPROBANTES: Comprobante[];
    MOVIMIENTOS_BANCO: MovimientoBanco[];
    PROVEEDORES: Fila[];
    CONCEPTOS: Fila[];
    HALLAZGOS: Hallazgo[];
    INDICES: Fila[];
    FBV_ORDENES_PAGO: Fila[];
    RESPUESTAS_ADMIN: Fila[];
  };
}

export type BarrioId = 'S1' | 'S2' | 'LH';
