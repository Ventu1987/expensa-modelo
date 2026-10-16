# Expensa modelo · Fideicomiso Bella Vista

Cómo publicaría las expensas una administración correcta, con los gastos reales de Senderos I, Senderos II y La Huella.
Sirve para controlar y como vidriera: cada número se puede rastrear hasta su documento o hasta un supuesto escrito.

## Qué es

La liquidación de expensas que mandaría una administración ordenada: los mismos gastos y movimientos del mes, presentados para que cualquiera los entienda sin preguntar. Se lee en el celular o en la PC y se descarga en PDF.

| # | Sección | Qué tiene |
|---|---|---|
| 1 | Tu expensa | Cuota por tipo de lote, vencimiento y recargo, qué cambió y de cada $ 100 adónde va. |
| 2 | Gastos del mes | Por rubro: concepto, proveedor, comprobante, mes anterior, este mes, % de variación, **por qué** (editable) y estado de pago. |
| 3 | Cómo se reparte | Coeficientes, cuota y subtotal por tipo de lote, redondeo. |
| 4 | Movimientos de la cuenta | Cascada: plata al empezar, cobros, pagos (con detalle), plata al cierre; lo que se debe y la plata libre. |
| 5 | Fondos | Ordinario, extraordinario y reserva: al empezar, entró, se usó, al cierre. |
| 6 | Estado patrimonial | Lo que el barrio tiene y lo que debe, con los importes de esta liquidación. |
| 7 | Morosidad | Cuántos lotes deben, cuánto en total, antigüedad y cobros sin identificar. Nunca cuáles. |
| 8 | Cargos particulares | Canon de obra y otros cargos que paga solo el lote que corresponde, mes a mes. |
| 9 | Obras | Qué se pagó, con qué fondo, presupuesto y deuda con proveedores. |
| 10 | Mantenimiento del Fideicomiso | % de cada barrio (propios 80% y comunes 20%) y la base del mes. |
| 11 | Proveedores y contratos | Quién cobra qué, mes contra mes, y vencimiento de cada contrato. |
| 12 | Novedades y avisos | Cargos nuevos, aumentos y obras, anunciados antes. |
| 13 | Regularizaciones | Los 33 puntos de la auditoría (H01–H32 y LH-10): qué pasó, qué hace esta liquidación, efecto en tu cuota, qué falta y comentario editable. |
| 14 | Indicadores | Gasto por lote y por m², % con factura, morosidad, IPC de referencia, cuota mes a mes. |
| 15 | Documentación y contacto | Cómo pagar, documentación del mes y datos de la administración. |

Además: **Resumen para WhatsApp**, **Anexo** con la diferencia contra la liquidación anterior (cada corrección se puede apagar) y **Administración** (controles que no dejan publicar si algo no cierra, y edición de comentarios).

## Reglas

- Exactitud: importes en centavos enteros y coeficientes como fracciones exactas. Cada línea se redondea al centavo, la mitad hacia arriba. El redondeo del barrio va en su propia línea.
- Dato dudoso: REVISAR. Dato que falta: N/D. Supuestos marcados.
- Privacidad: sin padrón, sin nombres de propietarios ni de empleados, sin deuda por lote, sin nombres de archivo de cupones. CUIT de personas físicas enmascarados (salvo el del administrador).
- Las observaciones son indicadores, no acusaciones.
- Costo $ 0: Google Sheets + Apps Script + GitHub Pages.

## Estructura

```
src/lib/money.ts          centavos, fracciones exactas, formato $ 1.234,56
src/data/                 lectura de la API de la auditoría, copia de respaldo y privacidad
src/modelo/modelo.ts      motor: aplica los criterios en orden y mide el efecto de cada uno
src/modelo/controles.ts   los controles que bloquean la publicación
src/modelo/config/S2.json criterios del modelo para Senderos II (copia de la planilla del modelo)
src/expensa/              la liquidación (cálculo de cada sección y pantallas)
src/pantallas/            resumen para WhatsApp, anexo y administración
apps-script/Code.gs       planilla del modelo (criterios, coeficientes, deudas, actas, publicación)
```

## Comandos

```
npm install
npm run dev               app en http://localhost:5173
npm test                  pruebas con las cifras reales de 09 y 10/2026
npm run build             versión para GitHub Pages (carpeta dist)
npm run actualizar-copia  refresca la copia de respaldo desde la API
```

La instalación paso a paso está en [INSTALACION.md](INSTALACION.md).

## Cifras verificadas (Senderos II, 10/2026)

Lote común: liquidado $ 655.859,49 · modelo $ 531.713,44 (−$ 124.146,05, −18,93%). Gasto del modelo $ 9.384.741,82, redondeo $ 0,14.
Plata libre al cierre $ 1.230.962,82; fondo extraordinario después de la obra $ 315.305,82. Las pruebas (`src/modelo/modelo.test.ts` y `src/expensa/liquidacion.test.ts`) fallan si cambia un solo centavo.
