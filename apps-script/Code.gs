/**
 * Planilla de la EXPENSA MODELO · Apps Script (costo $ 0).
 *
 * Es una planilla aparte de la auditoría. Guarda solo lo propio del modelo:
 * criterios, coeficientes, deudas, créditos, novedades, actas y el estado de publicación.
 * Los datos oficiales los sigue leyendo la app desde la API de la auditoría.
 *
 * Publicar: Implementar → Nueva implementación → Aplicación web →
 *   Ejecutar como: yo · Quién tiene acceso: cualquier persona.
 * La URL que da va en la variable VITE_MODELO_API del repositorio (ver INSTALACION.md).
 *
 * Importes: siempre como TEXTO con punto decimal ("1200000", "71878.25"), para no perder centavos.
 * Formato de las columnas de importes y coeficientes: Formato → Número → Texto sin formato.
 */

var HOJAS = {
  BARRIOS_MODELO: ['Barrio', 'Nombre', 'Coef_Fuente', 'Coef_Estado', 'Reserva_Pct', 'Reserva_Activa', 'Reserva_Nota', 'Titular_Actual', 'Titular_Correcto', 'Cuenta_Nota', 'Coef_FBV_Fuente'],
  COEFICIENTES_LOTE: ['Barrio', 'Orden', 'Tipo', 'Cantidad', 'Coef'],
  COEF_FBV: ['Barrio_Pagador', 'Barrio', 'Propios', 'Comunes'],
  FBV_PERIODO: ['ID_Periodo', 'Gasto_Propios', 'Gasto_Comunes', 'Parte_Propios', 'Parte_Comunes', 'Coef_Aplicado_Propios', 'Coef_Aplicado_Comunes'],
  FBV_BASE: ['ID_Periodo', 'Orden', 'Concepto', 'Importe'],
  CRITERIOS: ['ID_Periodo', 'Orden', 'ID', 'Hallazgos', 'Titulo', 'Texto', 'Activo', 'Tipo', 'Gasto', 'Gastos', 'Comprobante', 'Importe', 'Fuente', 'Fondo', 'Quitar', 'Total', 'Lotes', 'Lotes_Total', 'Estimado'],
  DEUDAS: ['ID_Periodo', 'Concepto', 'Importe', 'Nota', 'Tipo', 'Hallazgo'],
  CREDITOS: ['ID_Periodo', 'Concepto', 'Importe', 'Nota', 'Tipo', 'Hallazgo'],
  NOVEDADES: ['ID_Periodo', 'Titulo', 'Texto', 'Tipo'],
  COMENTARIOS: ['ID_Periodo', 'Concepto_Normalizado', 'Comentario'],
  ACTAS: ['Fecha', 'Barrio', 'Asamblea', 'Tema', 'Decision', 'Enlace'],
  ESTADO_PUBLICACION: ['ID_Periodo', 'Control', 'Aclaracion', 'Responsable', 'Fecha', 'Estado'],
};

/** Crea las hojas que falten, con sus encabezados. Correr una vez. */
function prepararPlanilla() {
  var ss = SpreadsheetApp.getActive();
  Object.keys(HOJAS).forEach(function (n) {
    var h = ss.getSheetByName(n) || ss.insertSheet(n);
    if (h.getLastRow() === 0) {
      h.getRange(1, 1, 1, HOJAS[n].length).setValues([HOJAS[n]]).setFontWeight('bold');
      h.setFrozenRows(1);
      h.getRange('A:Z').setNumberFormat('@'); // texto: sin redondeos de la planilla
    }
  });
}

function filas_(nombre) {
  var h = SpreadsheetApp.getActive().getSheetByName(nombre);
  if (!h || h.getLastRow() < 2) return [];
  var v = h.getRange(1, 1, h.getLastRow(), h.getLastColumn()).getDisplayValues();
  var enc = v[0];
  return v.slice(1).filter(function (r) { return r.join('') !== ''; }).map(function (r) {
    var o = {};
    enc.forEach(function (k, i) { o[k] = r[i]; });
    return o;
  });
}

function lista_(s) {
  return String(s || '').split(',').map(function (x) { return x.trim(); }).filter(String);
}
function siNo_(s) {
  return /^(si|sí|true|verdadero|1)$/i.test(String(s).trim());
}
function texto_(s) {
  var t = String(s == null ? '' : s).trim();
  return t === '' || /^n\/d$/i.test(t) ? null : t.replace(',', '.');
}

/** Arma la configuración de un barrio con la forma que espera la app (ConfigBarrio). */
function configBarrio_(barrio) {
  var b = filas_('BARRIOS_MODELO').filter(function (r) { return r.Barrio === barrio; })[0];
  if (!b) return null;
  var porPeriodo = function (hoja) {
    return filas_(hoja).filter(function (r) { return String(r.ID_Periodo).indexOf(barrio + '-') === 0; });
  };
  var periodos = {};
  var asegurar = function (id) {
    if (!periodos[id]) periodos[id] = { criterios: [], deudas: [], creditos: [], novedades: [], comentarios: {}, aclaraciones: {} };
    return periodos[id];
  };

  porPeriodo('CRITERIOS')
    .sort(function (a, c) { return Number(a.Orden) - Number(c.Orden); })
    .forEach(function (r) {
      var c = { id: r.ID, hallazgos: lista_(r.Hallazgos), titulo: r.Titulo, texto: r.Texto, activo: siNo_(r.Activo), tipo: r.Tipo };
      if (r.Gasto) c.gasto = r.Gasto;
      if (r.Gastos) c.gastos = lista_(r.Gastos);
      if (r.Comprobante) c.comprobante = r.Comprobante;
      if (texto_(r.Importe)) c.importe = texto_(r.Importe);
      if (r.Fuente) c.fuente = r.Fuente;
      if (r.Fondo) c.fondo = r.Fondo;
      if (r.Quitar) c.quitar = lista_(r.Quitar);
      if (r.Total) c.total = lista_(r.Total);
      if (r.Lotes) c.lotes = Number(r.Lotes);
      if (r.Lotes_Total) c.lotesTotal = Number(r.Lotes_Total);
      if (siNo_(r.Estimado)) c.estimado = true;
      asegurar(r.ID_Periodo).criterios.push(c);
    });

  porPeriodo('FBV_PERIODO').forEach(function (r) {
    asegurar(r.ID_Periodo).fbv = {
      gastoPropios: r.Gasto_Propios, gastoComunes: r.Gasto_Comunes, base: [],
      partePropios: texto_(r.Parte_Propios), parteComunes: texto_(r.Parte_Comunes),
      coefAplicadoPropios: texto_(r.Coef_Aplicado_Propios), coefAplicadoComunes: texto_(r.Coef_Aplicado_Comunes),
    };
  });
  porPeriodo('FBV_BASE')
    .sort(function (a, c) { return Number(a.Orden) - Number(c.Orden); })
    .forEach(function (r) {
      var p = asegurar(r.ID_Periodo);
      if (p.fbv) p.fbv.base.push({ concepto: r.Concepto, importe: texto_(r.Importe) });
    });
  ['DEUDAS', 'CREDITOS'].forEach(function (hoja) {
    porPeriodo(hoja).forEach(function (r) {
      var it = { concepto: r.Concepto, importe: texto_(r.Importe), nota: r.Nota, tipo: r.Tipo };
      if (r.Hallazgo) it.hallazgo = r.Hallazgo;
      asegurar(r.ID_Periodo)[hoja === 'DEUDAS' ? 'deudas' : 'creditos'].push(it);
    });
  });
  porPeriodo('NOVEDADES').forEach(function (r) {
    asegurar(r.ID_Periodo).novedades.push({ titulo: r.Titulo, texto: r.Texto, tipo: r.Tipo || 'AVISO' });
  });
  porPeriodo('COMENTARIOS').forEach(function (r) {
    asegurar(r.ID_Periodo).comentarios[r.Concepto_Normalizado] = r.Comentario;
  });
  porPeriodo('ESTADO_PUBLICACION').forEach(function (r) {
    var p = asegurar(r.ID_Periodo);
    if (r.Control === 'PUBLICADO') p.publicado = r.Fecha;
    else if (r.Aclaracion) p.aclaraciones[r.Control] = r.Aclaracion;
  });

  var coefFbv = {};
  filas_('COEF_FBV').filter(function (r) { return r.Barrio_Pagador === barrio || r.Barrio_Pagador === ''; }).forEach(function (r) {
    coefFbv[r.Barrio] = { propios: texto_(r.Propios), comunes: texto_(r.Comunes) };
  });

  return {
    barrio: barrio,
    nombre: b.Nombre,
    tiposLote: filas_('COEFICIENTES_LOTE')
      .filter(function (r) { return r.Barrio === barrio; })
      .sort(function (a, c) { return Number(a.Orden) - Number(c.Orden); })
      .map(function (r) { return { tipo: r.Tipo, cantidad: Number(r.Cantidad), coef: texto_(r.Coef) }; }),
    coefFuente: b.Coef_Fuente,
    coefEstado: b.Coef_Estado === 'OK' ? 'OK' : 'REVISAR',
    coefFideicomiso: coefFbv,
    coefFideicomisoFuente: b.Coef_FBV_Fuente,
    reserva: { pct: texto_(b.Reserva_Pct) || '0.05', activa: siNo_(b.Reserva_Activa), nota: b.Reserva_Nota },
    cuenta: { titularActual: b.Titular_Actual, titularCorrecto: b.Titular_Correcto, nota: b.Cuenta_Nota },
    periodos: periodos,
  };
}

/** GET ?barrio=S2 → configuración del modelo en JSON. Solo lectura. */
function doGet(e) {
  var barrio = (e && e.parameter && e.parameter.barrio) || 'S2';
  var cfg = configBarrio_(barrio);
  var out = cfg || { error: 'Barrio sin configuración: ' + barrio };
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Carga la configuración de ejemplo (src/modelo/config/S2.json del repositorio) en las hojas.
 * Cambiá USUARIO/REPO por los tuyos. Pisa solo las filas de ese barrio.
 */
function cargarEjemploDesdeRepo() {
  var url = 'https://raw.githubusercontent.com/USUARIO/REPO/main/src/modelo/config/S2.json';
  var cfg = JSON.parse(UrlFetchApp.fetch(url).getContentText());
  prepararPlanilla();
  var ss = SpreadsheetApp.getActive();
  var agregar = function (hoja, filas) {
    if (!filas.length) return;
    var h = ss.getSheetByName(hoja);
    h.getRange(h.getLastRow() + 1, 1, filas.length, filas[0].length).setNumberFormat('@').setValues(filas);
  };
  var B = cfg.barrio;
  agregar('BARRIOS_MODELO', [[B, cfg.nombre, cfg.coefFuente, cfg.coefEstado, cfg.reserva.pct, cfg.reserva.activa ? 'SI' : 'NO', cfg.reserva.nota, cfg.cuenta.titularActual, cfg.cuenta.titularCorrecto, cfg.cuenta.nota, cfg.coefFideicomisoFuente]]);
  agregar('COEFICIENTES_LOTE', cfg.tiposLote.map(function (t, i) { return [B, String(i + 1), t.tipo, String(t.cantidad), t.coef]; }));
  agregar('COEF_FBV', Object.keys(cfg.coefFideicomiso).map(function (k) { return [B, k, cfg.coefFideicomiso[k].propios, cfg.coefFideicomiso[k].comunes]; }));
  Object.keys(cfg.periodos).forEach(function (id) {
    var p = cfg.periodos[id];
    if (p.fbv) {
      agregar('FBV_PERIODO', [[id, p.fbv.gastoPropios, p.fbv.gastoComunes, p.fbv.partePropios, p.fbv.parteComunes, p.fbv.coefAplicadoPropios, p.fbv.coefAplicadoComunes]]);
      agregar('FBV_BASE', p.fbv.base.map(function (b, i) { return [id, String(i + 1), b.concepto, b.importe]; }));
    }
    agregar('CRITERIOS', p.criterios.map(function (c, i) {
      return [id, String(i + 1), c.id, (c.hallazgos || []).join(', '), c.titulo, c.texto, c.activo ? 'SI' : 'NO', c.tipo, c.gasto || '', (c.gastos || []).join(', '), c.comprobante || '', c.importe || '', c.fuente || '', c.fondo || '', (c.quitar || []).join(', '), (c.total || []).join(', '), c.lotes ? String(c.lotes) : '', c.lotesTotal ? String(c.lotesTotal) : '', c.estimado ? 'SI' : ''];
    }));
    agregar('DEUDAS', p.deudas.map(function (d) { return [id, d.concepto, d.importe === null ? 'N/D' : d.importe, d.nota, d.tipo, d.hallazgo || '']; }));
    agregar('CREDITOS', p.creditos.map(function (d) { return [id, d.concepto, d.importe === null ? 'N/D' : d.importe, d.nota, d.tipo, d.hallazgo || '']; }));
    agregar('NOVEDADES', p.novedades.map(function (n) { return [id, n.titulo, n.texto, n.tipo]; }));
    agregar('COMENTARIOS', Object.keys(p.comentarios).map(function (k) { return [id, k, p.comentarios[k]]; }));
  });
}
