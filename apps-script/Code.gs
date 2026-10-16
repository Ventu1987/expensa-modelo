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
  NOTAS: ['ID_Periodo', 'Clave', 'Texto'],
  REGLAS: ['Barrio', 'Orden', 'ID', 'Hallazgos', 'Titulo', 'Texto', 'Activo', 'Tipo', 'Concepto', 'Importe', 'Fuente', 'Fondo'],
  PARTICULARES: ['ID_Periodo', 'Concepto', 'Lotes', 'Valor', 'Fondo', 'Nota', 'Estado'],
  ADMINISTRACION: ['Barrio', 'Nombre', 'Matricula', 'CUIT', 'Contacto', 'Horario', 'Banco', 'CBU', 'Alias', 'Titular', 'Superficie_m2', 'Superficie_Estado', 'Superficie_Fuente'],
  CONTRATOS: ['Barrio', 'Proveedor', 'Objeto', 'Vence', 'Actualizacion', 'Nota'],
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
  porPeriodo('NOTAS').forEach(function (r) {
    var p = asegurar(r.ID_Periodo);
    p.notas = p.notas || {};
    p.notas[r.Clave] = r.Texto;
  });
  porPeriodo('PARTICULARES').forEach(function (r) {
    asegurar(r.ID_Periodo).particulares = {
      concepto: r.Concepto, lotes: r.Lotes === '' || /^n\/d$/i.test(r.Lotes) ? null : Number(r.Lotes),
      valor: texto_(r.Valor), fondo: r.Fondo || 'N/D', nota: r.Nota, estado: r.Estado === 'OK' ? 'OK' : 'REVISAR',
    };
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

  var adm = filas_('ADMINISTRACION').filter(function (r) { return r.Barrio === barrio; })[0];
  var contratos = filas_('CONTRATOS').filter(function (r) { return r.Barrio === barrio; }).map(function (r) {
    return { proveedor: r.Proveedor, objeto: r.Objeto, vence: r.Vence || null, actualizacion: r.Actualizacion || 'N/D', nota: r.Nota };
  });

  return {
    administracion: adm ? { nombre: adm.Nombre, matricula: adm.Matricula || 'N/D', cuit: adm.CUIT || 'N/D', contacto: adm.Contacto || 'N/D', horario: adm.Horario || 'N/D', banco: adm.Banco || 'N/D', cbu: adm.CBU || 'N/D', alias: adm.Alias || 'N/D', titular: adm.Titular || 'N/D' } : undefined,
    superficieM2: adm && adm.Superficie_m2 ? { valor: Number(adm.Superficie_m2), estado: adm.Superficie_Estado === 'OK' ? 'OK' : 'REVISAR', fuente: adm.Superficie_Fuente } : undefined,
    contratos: contratos,
    reglas: filas_('REGLAS')
      .filter(function (r) { return r.Barrio === barrio; })
      .sort(function (a, c) { return Number(a.Orden) - Number(c.Orden); })
      .map(function (r) {
        var x = { id: r.ID, hallazgos: lista_(r.Hallazgos), titulo: r.Titulo, texto: r.Texto, activo: siNo_(r.Activo), tipo: r.Tipo, concepto: r.Concepto };
        if (texto_(r.Importe)) x.importe = texto_(r.Importe);
        if (r.Fuente) x.fuente = r.Fuente;
        if (r.Fondo) x.fondo = r.Fondo;
        return x;
      }),
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
 * POST desde la app: guarda los comentarios editados (hojas COMENTARIOS y NOTAS).
 * Pide una clave: Configuración del proyecto → Propiedades del script → CLAVE_EDICION.
 * Cuerpo: {accion:'comentarios', clave, idPeriodo, porque:{concepto:texto}, notas:{clave:texto}}
 */
function doPost(e) {
  var salida = function (o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); };
  try {
    var b = JSON.parse(e.postData.contents);
    var clave = PropertiesService.getScriptProperties().getProperty('CLAVE_EDICION');
    if (!clave || b.clave !== clave) return salida({ ok: false, error: 'Clave incorrecta' });
    if (b.accion !== 'comentarios' || !/^[A-Z0-9]{2}-\d{4}-\d{2}$/.test(b.idPeriodo)) return salida({ ok: false, error: 'Pedido inválido' });
    prepararPlanilla();
    var n = 0;
    n += guardar_('COMENTARIOS', b.idPeriodo, b.porque || {});
    n += guardar_('NOTAS', b.idPeriodo, b.notas || {});
    return salida({ ok: true, guardados: n });
  } catch (err) {
    return salida({ ok: false, error: String(err) });
  }
}

/** Reemplaza o agrega filas (ID_Periodo, clave, texto) en COMENTARIOS o NOTAS. */
function guardar_(hoja, idPeriodo, mapa) {
  var h = SpreadsheetApp.getActive().getSheetByName(hoja);
  var datos = h.getDataRange().getDisplayValues();
  var n = 0;
  Object.keys(mapa).forEach(function (k) {
    var texto = String(mapa[k]).slice(0, 2000);
    var fila = -1;
    for (var i = 1; i < datos.length; i++) if (datos[i][0] === idPeriodo && datos[i][1] === k) fila = i + 1;
    if (fila > 0) h.getRange(fila, 3).setValue(texto);
    else {
      h.appendRow([idPeriodo, k, texto]);
      datos.push([idPeriodo, k, texto]);
    }
    n++;
  });
  return n;
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
    agregar('NOTAS', Object.keys(p.notas || {}).map(function (k) { return [id, k, p.notas[k]]; }));
    if (p.particulares) agregar('PARTICULARES', [[id, p.particulares.concepto, p.particulares.lotes === null ? 'N/D' : String(p.particulares.lotes), p.particulares.valor || '', p.particulares.fondo, p.particulares.nota, p.particulares.estado]]);
  });
  var a = cfg.administracion || {};
  var sup = cfg.superficieM2 || {};
  agregar('ADMINISTRACION', [[B, a.nombre || '', a.matricula || '', a.cuit || '', a.contacto || '', a.horario || '', a.banco || '', a.cbu || '', a.alias || '', a.titular || '', sup.valor ? String(sup.valor) : '', sup.estado || '', sup.fuente || '']]);
  agregar('REGLAS', (cfg.reglas || []).map(function (r, i) { return [B, String(i + 1), r.id, (r.hallazgos || []).join(', '), r.titulo, r.texto, r.activo ? 'SI' : 'NO', r.tipo, r.concepto, r.importe || '', r.fuente || '', r.fondo || '']; }));
  agregar('CONTRATOS', (cfg.contratos || []).map(function (c) { return [B, c.proveedor, c.objeto, c.vence || '', c.actualizacion || '', c.nota || '']; }));
}
