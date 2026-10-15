// Cómo resuelve la expensa modelo cada hallazgo de la auditoría y dónde se ve aplicado.
// "criterio" = se corrige en el cálculo (se puede apagar); "control" = bloquea la publicación si no cierra;
// "seccion" = se muestra en una pantalla; "pedido" = falta un documento y se marca N/D o REVISAR.

export interface Resolucion {
  id: string;
  titulo: string;
  regla: string;
  como: ('criterio' | 'control' | 'seccion' | 'pedido')[];
  donde: { pagina: string; texto: string };
}

export const RESOLUCIONES: Resolucion[] = [
  { id: 'H01', titulo: 'Se repartió más de lo gastado', regla: 'Se reparte el gasto real. Una previsión, si se aprueba, va aparte con su % y su regla de devolución.', como: ['criterio', 'control'], donde: { pagina: 'modelo', texto: 'Actual contra modelo · control "Se reparte exactamente lo gastado"' } },
  { id: 'LH-10', titulo: 'La Huella 10/2026: repartido mayor que el gasto', regla: 'La misma regla que H01. El control lo marca en cuanto se carga el modelo de La Huella.', como: ['control'], donde: { pagina: 'historial', texto: 'Historial (columna Repartido) y controles' } },
  { id: 'H02', titulo: 'El Fideicomiso cobra casi la mitad a barrios que son el 14% del predio', regla: 'Tabla de porcentajes por barrio con su fuente; lo no asignado queda a la vista.', como: ['seccion', 'pedido'], donde: { pagina: 'reparto', texto: 'Reparto del Fideicomiso' } },
  { id: 'H03', titulo: 'El 92% del mantenimiento es personal', regla: 'La base del mantenimiento se muestra concepto por concepto, sin nombres.', como: ['seccion'], donde: { pagina: 'reparto', texto: 'Reparto · base del mantenimiento' } },
  { id: 'H04', titulo: 'Luz industrial dentro del mantenimiento', regla: 'Sale de la base (09/2026) o se descuenta su parte (10/2026, H28).', como: ['criterio'], donde: { pagina: 'modelo', texto: 'Criterios H04 y H28' } },
  { id: 'H05', titulo: 'Honorarios de liquidación de sueldos', regla: 'Salen de la base del mantenimiento.', como: ['criterio'], donde: { pagina: 'modelo', texto: 'Criterio H05 (09/2026)' } },
  { id: 'H06', titulo: 'Se excluye el sueldo de una empleada pero no sus cargas', regla: 'Se excluye el costo completo. ESTIMADO hasta tener el F.931 por CUIL.', como: ['criterio', 'pedido'], donde: { pagina: 'modelo', texto: 'Criterio H06 (09/2026)' } },
  { id: 'H07', titulo: 'Posibles adelantos sumados dos veces', regla: 'Criterio apagado hasta confirmar con los recibos; en 10/2026, sueldos contra planilla (H27).', como: ['criterio', 'pedido'], donde: { pagina: 'modelo', texto: 'Criterios H07 y H27' } },
  { id: 'H08', titulo: 'Seguridad compartida mitad y mitad', regla: 'Por lotes (18 de 39) solo en los meses con factura compartida.', como: ['criterio'], donde: { pagina: 'modelo', texto: 'Criterio H08 (09/2026)' } },
  { id: 'H09', titulo: 'Telered caro y entero a Senderos II', regla: 'Se liquida el abono informado por escrito hasta tener la factura.', como: ['criterio', 'pedido'], donde: { pagina: 'modelo', texto: 'Criterio H26' } },
  { id: 'H10', titulo: 'Luz con importes provisorios', regla: 'Control "Lo liquidado es lo facturado": marca el 2.º vencimiento con recargo y los importes que no coinciden.', como: ['control'], donde: { pagina: 'cuentas', texto: 'Controles del mes' } },
  { id: 'H11', titulo: 'Deuda con proveedores de cámaras fuera de las cuentas', regla: 'Va en la lista de deudas; sin importe informado figura N/D y se avisa.', como: ['seccion', 'pedido'], donde: { pagina: 'obras', texto: 'Obras · lo que falta saber' } },
  { id: 'H12', titulo: 'Cables de cámaras expuestos', regla: 'Solucionado. Queda en el historial de hallazgos.', como: ['seccion'], donde: { pagina: 'novedades', texto: 'Novedades' } },
  { id: 'H13', titulo: 'Cuotas de ARBA cobradas dos veces', regla: 'Se quitan las cuotas repetidas y se reclama el importe.', como: ['criterio', 'control'], donde: { pagina: 'modelo', texto: 'Criterio H13 (09/2026) y control de factura única' } },
  { id: 'H14', titulo: 'Ajuste sin explicación', regla: 'Ningún egreso sin gasto: el control bloquea la publicación.', como: ['control'], donde: { pagina: 'cuentas', texto: 'Control "No hay salidas de plata sin gasto"' } },
  { id: 'H15', titulo: 'Caja chica sin detalle', regla: 'Solo comprobantes fiscales, uno por uno, con su %.', como: ['criterio'], donde: { pagina: 'modelo', texto: 'Criterio H31' } },
  { id: 'H16', titulo: 'Textos de otro barrio en la liquidación', regla: 'Cada pantalla nombra solo al barrio elegido.', como: ['seccion'], donde: { pagina: 'expensa', texto: 'Todas las pantallas' } },
  { id: 'H17', titulo: 'Factura de seguridad cobrada dos veces', regla: 'Descartado. El control de factura única lo vigila igual.', como: ['control'], donde: { pagina: 'cuentas', texto: 'Control de factura única' } },
  { id: 'H18', titulo: 'Cuenta a nombre del administrador', regla: 'Se muestra el titular actual y el que corresponde.', como: ['seccion'], donde: { pagina: 'cuentas', texto: 'La cuenta del barrio' } },
  { id: 'H19', titulo: 'Transferencias al administrador sin gasto', regla: 'Ningún egreso sin gasto ni comprobante.', como: ['control'], donde: { pagina: 'cuentas', texto: 'Controles de egresos' } },
  { id: 'H20', titulo: 'Deuda con la seguridad fuera del patrimonio', regla: 'El patrimonio es la suma de sus partes y la deuda va en su línea.', como: ['control', 'seccion'], donde: { pagina: 'cuentas', texto: 'Patrimonio y plata libre' } },
  { id: 'H21', titulo: 'Extracto de julio filtrado', regla: 'El saldo inicial se compara con el banco; si falta el extracto, N/D y no se publica.', como: ['control'], donde: { pagina: 'cuentas', texto: 'Control "El saldo inicial es el del banco"' } },
  { id: 'H22', titulo: 'Pagos a terceros y desde una cuenta personal', regla: 'Cada pago al emisor de la factura, desde la cuenta del barrio; se pide el comprobante.', como: ['seccion', 'pedido'], donde: { pagina: 'cuentas', texto: 'La cuenta del barrio' } },
  { id: 'H23', titulo: 'Seguridad de octubre por encima de la factura', regla: 'Se liquida el importe de la factura.', como: ['criterio'], donde: { pagina: 'modelo', texto: 'Criterio H23' } },
  { id: 'H24', titulo: 'Equipo de monitoreo con un presupuesto', regla: 'Sin factura no se cobra: figura a recuperar.', como: ['seccion'], donde: { pagina: 'cuentas', texto: 'A favor de los lotes' } },
  { id: 'H25', titulo: 'La misma factura cobrada dos veces', regla: 'Cada factura una sola vez: sale de la base y el control bloquea.', como: ['criterio', 'control'], donde: { pagina: 'modelo', texto: 'Criterio H25 y control de factura única' } },
  { id: 'H26', titulo: 'Telered: el triple de lo prometido y un débito doble', regla: 'Abono informado y el débito doble como crédito a reclamar.', como: ['criterio', 'seccion'], donde: { pagina: 'modelo', texto: 'Criterio H26 · A favor de los lotes' } },
  { id: 'H27', titulo: 'Sueldos por encima de la planilla', regla: 'Se liquida contra la planilla.', como: ['criterio'], donde: { pagina: 'modelo', texto: 'Criterio H27' } },
  { id: 'H28', titulo: 'Cargo nuevo: luz de sectores comunes', regla: 'Sin la parte industrial; el cargo nuevo se anuncia en Novedades.', como: ['criterio', 'seccion'], donde: { pagina: 'novedades', texto: 'Criterio H28 y Novedades' } },
  { id: 'H29', titulo: 'Personal de administración en el mantenimiento', regla: 'Sale de la base, como la persona ya excluida.', como: ['criterio'], donde: { pagina: 'modelo', texto: 'Criterio H29' } },
  { id: 'H30', titulo: 'Obra de cámaras como gasto ordinario', regla: 'La paga el fondo extraordinario.', como: ['criterio', 'seccion'], donde: { pagina: 'obras', texto: 'Obras y extraordinarios' } },
  { id: 'H31', titulo: 'Comprobantes que no son comprobantes', regla: 'La caja chica acepta solo comprobantes fiscales.', como: ['criterio'], donde: { pagina: 'modelo', texto: 'Criterio H31' } },
  { id: 'H32', titulo: 'Coeficiente de propios distinto del publicado', regla: 'Se usa el publicado (13,73%) aunque suba la expensa.', como: ['criterio'], donde: { pagina: 'reparto', texto: 'Criterio H32 · Reparto' } },
  { id: 'RESERVA', titulo: 'No hay fondo de reserva', regla: 'Supuesto del 5%, en línea aparte, apagado hasta que lo apruebe la asamblea.', como: ['criterio'], donde: { pagina: 'modelo', texto: 'Fondo de reserva' } },
  { id: 'PLATA_LIBRE', titulo: 'La caja no alcanzaba para lo pendiente', regla: 'Se publica la plata libre después de pagar lo pendiente, todos los meses.', como: ['seccion'], donde: { pagina: 'cuentas', texto: 'Plata libre' } },
];
