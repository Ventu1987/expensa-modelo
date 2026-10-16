# Instalación paso a paso

Todo es gratis: una cuenta de GitHub y una de Google alcanzan. Tiempo estimado: 30 minutos.

## 1. Subir el código a GitHub

1. Entrá a github.com y creá un repositorio nuevo, por ejemplo `expensa-modelo` (público, así GitHub Pages es gratis).
2. Subí todos los archivos de esta carpeta (botón **Add file → Upload files**, o con `git push`). La carpeta `node_modules` no hace falta.

## 2. Publicar con GitHub Pages

1. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. Andá a **Actions** y esperá que termine "Publicar en GitHub Pages" (corre solo con cada cambio y una vez por día).
3. La dirección queda así: `https://TU-USUARIO.github.io/expensa-modelo/`.

Si las pruebas fallan, la app **no** se publica: es a propósito. Las pruebas verifican las cifras al centavo.

## 3. Planilla del modelo (opcional, para editar sin tocar código)

Sin este paso la app usa `src/modelo/config/S2.json`. Con este paso, los criterios se editan en una planilla.

1. Creá una planilla nueva de Google Sheets: "Expensa modelo · criterios". Es aparte de la de la auditoría.
2. **Extensiones → Apps Script**. Borrá lo que haya, pegá el contenido de `apps-script/Code.gs` y guardá.
3. Elegí la función `prepararPlanilla` y tocá **Ejecutar**. Aceptá los permisos. Se crean las hojas:
   BARRIOS_MODELO, COEFICIENTES_LOTE, COEF_FBV, FBV_PERIODO, FBV_BASE, CRITERIOS, DEUDAS, CREDITOS, NOVEDADES, COMENTARIOS, NOTAS, REGLAS, PARTICULARES, ADMINISTRACION, CONTRATOS, ACTAS y ESTADO_PUBLICACION.
4. Para arrancar con los datos de Senderos II: en `cargarEjemploDesdeRepo` cambiá `USUARIO/REPO` por los tuyos y ejecutala.
5. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: tu cuenta. Acceso: cualquier persona. Copiá la URL.
6. En GitHub: **Settings → Secrets and variables → Actions → Variables → New repository variable**.
   Nombre `VITE_MODELO_API`, valor: la URL del paso anterior. Volvé a correr el workflow en **Actions**.

### Comentarios editables desde la app

1. En el Apps Script: **Configuración del proyecto (⚙) → Propiedades del script → Agregar propiedad**. Nombre `CLAVE_EDICION`, valor: una clave que elijas.
2. **Implementar → Administrar implementaciones → ✏ → Versión: nueva → Implementar** (cada vez que cambies el código).
3. En la app: **Administración → Editar comentarios**. En la expensa cada "por qué", nota de sección y comentario de regularización aparece como un campo para escribir.
4. Volvé a **Administración**, escribí la clave y tocá **Guardar en la planilla**. Sin la planilla conectada, **Copiar para la planilla** y pegalo en las hojas COMENTARIOS o NOTAS.

### Cómo se carga un mes nuevo

1. Cargá el PDF de la liquidación en el portal de la auditoría, como siempre.
2. En la app: **Administración → Actualizar datos**. El mes nuevo aparece como **preliminar**: se armó solo con las reglas de la hoja **REGLAS** (factura de seguridad, abono de Telered, caja chica con comprobantes fiscales) y las automáticas (una obra va al fondo extraordinario). Arriba de la expensa figura la lista de lo que falta revisar.
3. Agregá los comentarios (**✎ Agregar comentarios**) y, si hace falta, criterios propios del mes en las hojas de abajo. Cuando el mes tiene filas en CRITERIOS, deja de ser preliminar.

Para que el botón "Abrir el portal" vaya a la página de carga de la auditoría, agregá en GitHub la variable `VITE_PORTAL_URL` con su dirección.

Hojas:

- **CRITERIOS**: una fila por corrección, con `Orden` (el orden importa: cada efecto se mide contra el paso anterior), `Tipo` y el documento.
  Tipos: FACTURA, IMPORTE_SUPUESTO, A_EXTRAORDINARIO, CAJA_CHICA_FISCAL, PROPORCION, POR_LOTES, QUITAR, FBV_EXCLUIR, FBV_COEF_PUBLICADO.
- **FBV_PERIODO** y **FBV_BASE**: la base del mantenimiento del Fideicomiso (órdenes de pago), sin nombres de personas.
- **DEUDAS** y **CREDITOS**: si falta el importe, escribí `N/D`.
- **ESTADO_PUBLICACION**: si un control no cierra, la aclaración escrita de la administración (columna `Control` con el código: BANCO, EGRESOS, FACTURA_UNICA, PATRIMONIO…). Cuando se publica, una fila con `Control = PUBLICADO` y la fecha.
- **COMENTARIOS**: el "por qué" de cada gasto (columna `Concepto_Normalizado`, igual que en la auditoría).
- **NOTAS**: notas por sección (`RESUMEN`, `GASTOS`, `FLUJO`, `FONDOS`, `MOROSIDAD`, `PARTICULARES`, `OBRAS`…) o por regularización (`H01`…`H32`).
- **PARTICULARES**: canon de obra y otros cargos particulares: cuántos lotes, valor, a qué fondo va.
- **ADMINISTRACION** y **CONTRATOS**: datos de la administración, cuenta para pagar y vencimiento de cada contrato.
- Los importes van como texto con punto decimal: `1200000`, `71878.25`. Nunca con separador de miles.

## 4. Datos de la auditoría

La app lee la API pública de la auditoría. Si no responde, usa la copia `src/data/snapshot.json`, que el workflow refresca todos los días.
Antes de guardarla se quitan los nombres de archivo y los nombres de la hoja PARAMETROS ("Nombres que nunca se publican").

**Importante:** la API de la auditoría hoy publica el nombre de una empleada en DETALLE_COMPONENTES y nombres de archivo de comprobantes.
La app los filtra, pero conviene corregirlo en la planilla de la auditoría.

## 5. Probar en la computadora (opcional)

Con Node 20: `npm install`, `npm test` y `npm run dev`.

## Problemas comunes

| Pasa | Qué hacer |
|---|---|
| La página dice "Copia de los datos de la auditoría" | La API no respondió. Revisá que la aplicación web de la auditoría siga publicada para "cualquier persona". |
| Un mes aparece como "oficial" | Ese mes no tiene criterios cargados en la planilla del modelo. |
| "No se puede publicar" | Mirá Modo administrador: cada control que no cierra necesita corrección o aclaración escrita. |
| El workflow falla en "Pruebas" | Cambió un dato y las cifras ya no coinciden. Revisá el cambio antes de publicar. |
