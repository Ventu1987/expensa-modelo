# Expensa modelo · Fideicomiso Bella Vista

Cómo publicaría las expensas una administración correcta, con los gastos reales de Senderos I, Senderos II y La Huella.
Sirve para controlar y como vidriera: cada número se puede rastrear hasta su documento o hasta un supuesto escrito.

## Qué muestra

| Pantalla | Qué tiene |
|---|---|
| Tu expensa | El lote en el modelo contra lo liquidado, las 5 diferencias que más pesan, en qué se va y si cierran las cuentas. |
| De dónde sale cada peso | Cada gasto: oficial, modelo, criterio aplicado, variación contra el mes anterior y comprobantes. |
| Estado de cuentas | Caja, fondos, qué se debe, plata libre, patrimonio corregido, créditos y los 9 controles. |
| Actual contra modelo | Cada criterio con nombre, se puede apagar y muestra su efecto por lote. Fondo de reserva opcional. |
| Reparto del Fideicomiso | % de cada barrio en propios (80%) y comunes (20%), la base del mantenimiento y los otros gastos compartidos. |
| Morosidad | Cuántos lotes deben y cuánto en total. Nunca cuáles. |
| Obras y extraordinarios | Obras pagadas con el fondo extraordinario y lo que falta saber. |
| Historial | La expensa mes a mes. El IPC del INDEC va solo como referencia. |
| Novedades | Cargos nuevos, cambios y cómo resuelve el modelo cada hallazgo (H01–H32 y LH-10). |
| Resumen para WhatsApp | Hoja para imprimir o guardar en PDF y texto para copiar. |
| Modo administrador | No deja publicar si un control no cierra, salvo aclaración escrita. |

Se ve en celular (barra inferior) y en la PC (menú lateral y dos columnas).

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
src/pantallas/            las pantallas
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
Las pruebas (`src/modelo/modelo.test.ts`) fallan si cambia un solo centavo.
