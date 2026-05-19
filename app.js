/* ============================================================
   SURTIDO HH — app.js
   Lógica completa de la aplicación de Surtido de Mercancía
   Tecnología: Vanilla JS (ES6+), sin dependencias externas
   ============================================================ */

'use strict';

/* ============================================================
   DATOS DE DEMOSTRACIÓN
   En producción estos datos vendrían del servidor/API
   ============================================================ */
const PEDIDO_DEMO = {
  id: '123456',
  empleado: { id: '9029', nombre: 'JUAN ANTONIO GUERRERO MEDINA' },
  tarea: { id: '9029', nombre: 'JUAN ANTONIO GUERRERO MEDINA' },
  actividad: 'SURTIR PEDIDO CLIENTE',
  fecha: '31/08/2023',
  hora: '11:30 a.m.',
  documento: 'SURTIR PEDIDO CLIENTE',
  articulos: [
    {
      codigo: '1964000',
      nombre: 'FOCO HALOGENO H4 / 9003 TRANSPARENTE 12 VOLTIOS 100/90 1 P43',
      ubicacion: 'Planta Baja',
      pasillo: '6',
      torre: '1',
      nivel: '2',
      existencia: 25,
      solicitado: 2,
      surtido: 0,
      estado: 'pendiente',
      motivo_negacion: null,
      imagen: 'ASSET/1964000.jpg',
      esMiscelaneo: false,
      requiereRevision: true
    },
    {
      codigo: '2655000',
      nombre: 'LIMPIADOR CARBURADOR 10 Y CUERPO DE ACELERACION EN AEROSOL T',
      ubicacion: 'Planta Baja',
      pasillo: '10',
      torre: '3',
      nivel: '1',
      existencia: 45,
      solicitado: 1,
      surtido: 0,
      estado: 'pendiente',
      motivo_negacion: null,
      imagen: 'ASSET/2655000.jpg',
      esMiscelaneo: true,
      requiereRevision: true
    },
    {
      codigo: '4105000',
      nombre: 'TERMINAL INSTALACION REDONDA ZINC ROJO 5/32 IMPORTADO R-5/32',
      ubicacion: 'Planta Baja',
      pasillo: '15',
      torre: '2',
      nivel: '3',
      existencia: 60,
      solicitado: 2,
      surtido: 0,
      estado: 'pendiente',
      motivo_negacion: null,
      imagen: 'ASSET/4105000.jpg',
      esMiscelaneo: true,
      requiereRevision: true
    },
    {
      codigo: '1394000',
      nombre: 'CINTA AISLANTE NEGRO 60 PLASTICA VERZE 20 U/L',
      ubicacion: 'Planta Baja',
      pasillo: '3',
      torre: '1',
      nivel: '1',
      existencia: 80,
      solicitado: 10,
      surtido: 0,
      estado: 'pendiente',
      motivo_negacion: null,
      imagen: 'ASSET/1394000.jpg',
      esMiscelaneo: false,
      requiereRevision: true
    },
    {
      codigo: '2546000',
      nombre: 'INTERRUPTOR LLAVE 11 TIPO UNIVERSAL CAMIONES 60-79 POLLAK 31',
      ubicacion: 'Planta Baja',
      pasillo: '8',
      torre: '4',
      nivel: '2',
      existencia: 30,
      solicitado: 5,
      surtido: 0,
      estado: 'pendiente',
      motivo_negacion: null,
      imagen: 'ASSET/2546000.jpg',
      esMiscelaneo: false,
      requiereRevision: true
    },
    {
      codigo: '3658201',
      nombre: 'SOLENOIDE MARCHA DELCO 29MT 12V (10515838) BRASIL',
      ubicacion: 'Planta Baja',
      pasillo: '12',
      torre: '2',
      nivel: '3',
      existencia: 15,
      solicitado: 2,
      surtido: 0,
      estado: 'pendiente',
      motivo_negacion: null,
      imagen: 'ASSET/3658201.jpg',
      esMiscelaneo: false,
      requiereRevision: true
    }
  ]
};

/* ============================================================
   ESTADO GLOBAL DE LA APLICACIÓN
   ============================================================ */
let state = {
  pedido: null,              // Pedido activo cargado
  articuloActivo: null,      // Índice del artículo en detalle
  bsCantidadCodigo: null,    // Código pendiente en bottom sheet cantidad
  bsCantidadEsCodigo7: false,// Si el BS fue disparado por código de 7 dígitos
  negacionCodigo: null,      // Código en proceso de negación
  negacionMotivo: null,      // Motivo seleccionado en negación
  scanDebounceTimer: null,   // Timer para debounce del scanner
  revisionCodigo: null,      // Código del artículo en revisión activa
  revisionConteo: 0,         // Piezas escaneadas en la revisión actual
  revisionesHechas: new Set(),// Códigos que ya pasaron por revisión (evita repetir)
};

/* ============================================================
   SISTEMA DE AUDIO — Web Audio API
   BufferSource: cada play crea un nodo nuevo → sin límite de rapidez,
   sin bloqueos por escaneo continuo.
   ============================================================ */
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
const audioBuffers = {};

// Desbloquear AudioContext en el primer gesto real del usuario (toque o tecla)
// Necesario en Android/Zebra: el contexto nace suspendido hasta interacción humana
function unlockAudio() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
}
document.addEventListener('touchstart', unlockAudio, { once: true });
document.addEventListener('touchend',   unlockAudio, { once: true });
document.addEventListener('keydown',    unlockAudio, { once: true });

async function loadSound(key, url) {
  try {
    const res = await fetch(url);
    const arr = await res.arrayBuffer();
    audioBuffers[key] = await audioCtx.decodeAudioData(arr);
  } catch (e) {
    console.warn(`Audio [${key}] no cargó:`, e);
  }
}

function playSound(key) {
  const buf = audioBuffers[key];
  if (!buf) return;
  const play = () => {
    const src = audioCtx.createBufferSource();
    src.buffer = buf;
    src.connect(audioCtx.destination);
    src.start(0);
  };
  if (audioCtx.state === 'suspended') {
    audioCtx.resume().then(play);
  } else {
    play();
  }
}

loadSound('ok',    'beep-ok.mp3');
loadSound('error', 'beep-error.mp3');

// Desbloquear AudioContext en primer toque (política autoplay de browsers)
document.addEventListener('click', () => {
  if (audioCtx.state === 'suspended') audioCtx.resume();
}, { once: true });

/* ============================================================
   REFERENCIAS A ELEMENTOS DEL DOM
   ============================================================ */
const screens = {
  menu:       document.getElementById('screen-menu'),
  asignacion: document.getElementById('screen-asignacion'),
  surtido:    document.getElementById('screen-surtido'),
  detalle:    document.getElementById('screen-detalle'),
  resumen:    document.getElementById('screen-resumen'),
};

const overlays = {
  bsCantidad:    document.getElementById('bs-cantidad-overlay'),
  optionsSheet:  document.getElementById('options-sheet-overlay'),
  bsNegacion:    document.getElementById('bs-negacion-overlay'),
  modalNoFin:    document.getElementById('modal-no-finalizar-overlay'),
  modalParciales:document.getElementById('modal-parciales-overlay'),
  revModal:      document.getElementById('rev-modal-overlay'),
  revCancel:     document.getElementById('rev-cancel-overlay'),
};

/* ============================================================
   NAVEGACIÓN ENTRE PANTALLAS
   ============================================================ */
function showScreen(name) {
  Object.values(screens).forEach(s => s.classList.remove('active'));
  if (screens[name]) screens[name].classList.add('active');
  // Cerrar todos los overlays al cambiar pantalla
  closeAllOverlays();
}

function closeAllOverlays() {
  Object.values(overlays).forEach(o => o.classList.add('hidden'));
}

/* ============================================================
   TOASTS
   ============================================================ */
function showToast(type, title, msg, duration = 800) {
  if (type === 'success') playSound('ok');
  else if (type === 'error' || type === 'warning') playSound('error');

  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;

  const iconSvg = {
    success: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>`,
    warning: `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>`,
    error:   `<svg width="14" height="14" viewBox="0 0 24 24" fill="white"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  };

  toast.innerHTML = `
    <div class="toast-icon">${iconSvg[type] || iconSvg.error}</div>
    <div class="toast-body">
      <span class="toast-title">${title}</span>
      <span class="toast-msg">${msg}</span>
    </div>
    <button class="toast-close" onclick="this.closest('.toast').remove()">×</button>
  `;

  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

/* ============================================================
   PANTALLA: MENÚ
   ============================================================ */
document.getElementById('btn-tareas').addEventListener('click', () => {
  cargarAsignacion();
  showScreen('asignacion');
});

/* ============================================================
   PANTALLA: ASIGNACIÓN DE TAREAS
   ============================================================ */
function cargarAsignacion() {
  const p = PEDIDO_DEMO;
  document.getElementById('asig-emp-id').textContent    = p.empleado.id;
  document.getElementById('asig-emp-nombre').textContent = p.empleado.nombre;
  document.getElementById('asig-tarea-id').textContent   = p.tarea.id;
  document.getElementById('asig-tarea-nombre').textContent = p.tarea.nombre;
  document.getElementById('asig-actividad').textContent  = p.actividad;
  document.getElementById('asig-fecha').textContent      = p.fecha;
  document.getElementById('asig-hora').textContent       = p.hora;
  document.getElementById('asig-documento').textContent  = p.documento;
}

document.getElementById('btn-back-asignacion').addEventListener('click', () => showScreen('menu'));
document.getElementById('btn-asig-cancel').addEventListener('click', () => showScreen('menu'));
document.getElementById('btn-asig-confirm').addEventListener('click', () => {
  state.pedido = JSON.parse(JSON.stringify(PEDIDO_DEMO)); // copia profunda
  state.revisionesHechas = new Set();
  cargarSurtido();
  showScreen('surtido');
});

/* ============================================================
   PANTALLA: SURTIDO DE ÓRDENES
   ============================================================ */
function cargarSurtido() {
  const p = state.pedido;
  document.getElementById('avance-pedido-id').textContent = `Pedido ${p.id}`;
  renderArticulosList();
  actualizarContadores();
  // Enfocar el scanner automáticamente
  setTimeout(() => {
    const inp = document.getElementById('scanner-input-surtido');
    if (inp) inp.focus();
  }, 300);
}

function ordenEstado(art) {
  if (state.revisionesHechas.has(art.codigo))                       return 4;
  if (art.estado === 'parcial')                                      return 0;
  if (art.estado === 'pendiente')                                    return 1;
  if (art.estado === 'negado' || art.estado === 'parcial-negado')    return 2;
  if (art.estado === 'completo')                                     return 3;
  return 1;
}

function renderArticulosList() {
  const list = document.getElementById('articulos-list');
  list.innerHTML = '';

  const sorted = state.pedido.articulos
    .map((art, idx) => ({ art, idx }))
    .sort((a, b) => ordenEstado(a.art) - ordenEstado(b.art));

  sorted.forEach(({ art, idx }) => {
    const item = document.createElement('div');
    item.className = 'articulo-item';
    item.dataset.idx = idx;

    // Badge de progreso
    let badgeClass = 'badge-progreso';
    let badgeText  = `${art.surtido} de ${art.solicitado}`;

    if (art.estado === 'completo') {
      badgeClass += ' completo';
    } else if (art.estado === 'parcial') {
      badgeClass += ' parcial';
    } else if (art.estado === 'negado') {
      badgeClass = 'badge-negado';
      badgeText  = 'Negado';
    } else if (art.estado === 'parcial-negado') {
      badgeClass = 'badge-negado';
      badgeText  = `${art.surtido}/${art.solicitado} Neg.`;
    }

    // Palomita de verificación para productos revisados
    const revisado = state.revisionesHechas.has(art.codigo);
    const checkColor = art.estado === 'completo' ? 'verde' : 'rojo';
    const checkIcon = revisado ? `
      <div class="articulo-rev-icon ${checkColor}">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="white"><path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>
      </div>` : '';

    item.innerHTML = `
      <div class="articulo-info">
        <span class="articulo-codigo">${art.codigo}</span>
        <span class="articulo-ubicacion">${art.ubicacion} | Pasillo ${art.pasillo} | Torre ${art.torre} | Nivel ${art.nivel}</span>
      </div>
      <div class="articulo-badge">
        <span class="${badgeClass}">${badgeText}</span>
      </div>
      ${checkIcon}
    `;

    item.addEventListener('click', () => abrirDetalle(idx));
    list.appendChild(item);
  });
}

/* Resalta brevemente la fila del artículo escaneado (400 ms) */
function highlightArticulo(codigo) {
  const items = document.querySelectorAll('#articulos-list .articulo-item');
  for (const item of items) {
    const art = state.pedido.articulos[parseInt(item.dataset.idx, 10)];
    if (art && art.codigo === codigo) {
      item.classList.add('articulo-highlight');
      setTimeout(() => item.classList.remove('articulo-highlight'), 400);
      break;
    }
  }
}

function actualizarContadores() {
  const arts = state.pedido.articulos;
  let completado = 0, negado = 0, parcial = 0, pendiente = 0;

  arts.forEach(a => {
    if (a.estado === 'completo')       completado++;
    else if (a.estado === 'negado')    negado++;
    else if (a.estado === 'parcial' || a.estado === 'parcial-negado') parcial++;
    else                               pendiente++;
  });

  document.getElementById('cnt-completado').textContent = completado;
  document.getElementById('cnt-negado').textContent     = negado;
  document.getElementById('cnt-parcial').textContent    = parcial;
  document.getElementById('cnt-pendiente').textContent  = pendiente;
}

/* Botón regresar al menú desde surtido */
document.getElementById('btn-back-surtido').addEventListener('click', () => showScreen('menu'));

/* Botón 3 puntos — menú de opciones */
document.getElementById('btn-menu-opciones').addEventListener('click', () => {
  overlays.optionsSheet.classList.remove('hidden');
});
document.getElementById('opt-cerrar-menu').addEventListener('click', () => {
  overlays.optionsSheet.classList.add('hidden');
});
document.getElementById('opt-repetir-audio').addEventListener('click', () => {
  overlays.optionsSheet.classList.add('hidden');
  showToast('success', 'Audio', 'Reproduciendo instrucciones de audio...');
});
document.getElementById('opt-finalizar-surtido').addEventListener('click', () => {
  overlays.optionsSheet.classList.add('hidden');
  intentarFinalizar();
});

/* ============================================================
   LÓGICA DE ESCANEO
   Formato de etiqueta de 18 dígitos: [producto 7][cantidad 6][peso 5]
   Código de 7 dígitos: producto misceláneo → abre bottom sheet cantidad
   ============================================================ */
const scannerInput = document.getElementById('scanner-input-surtido');
const btnScanSend  = document.getElementById('btn-scan-send-surtido');
const btnKeyboard  = document.getElementById('btn-keyboard-surtido');

// Flag para evitar doble disparo (debounce + Enter)
let scanProcessed = false;

// Helper: devuelve true si la pantalla surtido está activa y no hay overlay abierto
function surtidoActivo() {
  return screens.surtido.classList.contains('active') &&
    Object.values(overlays).every(o => o.classList.contains('hidden'));
}

// Auto-refoco: si el scanner pierde foco sin razón (DOM rebuild, toque accidental)
// lo recupera automáticamente mientras estemos en la pantalla de surtido
scannerInput.addEventListener('blur', () => {
  if (surtidoActivo()) {
    setTimeout(() => scannerInput.focus(), 30);
  }
});

// Debounce para lectores de código de barras (disparan rápido, 18 dígitos)
scannerInput.addEventListener('input', () => {
  clearTimeout(state.scanDebounceTimer);
  const val = scannerInput.value.trim();
  if (val.length === 18) {
    state.scanDebounceTimer = setTimeout(() => {
      if (!scanProcessed) {
        procesarEscaneo(val);
        scannerInput.value = '';
        scannerInput.focus();
      }
      scanProcessed = false;
    }, 80);
  }
});

// Enviar con Enter
scannerInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    clearTimeout(state.scanDebounceTimer);
    scanProcessed = true;
    const val = scannerInput.value.trim();
    if (val) {
      procesarEscaneo(val);
      scannerInput.value = '';
      scannerInput.focus();
    }
    setTimeout(() => { scanProcessed = false; }, 200);
  }
});

// Botón enviar manual
btnScanSend.addEventListener('click', () => {
  clearTimeout(state.scanDebounceTimer);
  scanProcessed = true;
  const val = scannerInput.value.trim();
  if (val) {
    procesarEscaneo(val);
    scannerInput.value = '';
    scannerInput.focus();
  }
  setTimeout(() => { scanProcessed = false; }, 200);
});

// Botón teclado — alterna entre modo scanner (inputmode=none) y modo teclado (inputmode=text)
btnKeyboard.addEventListener('click', () => {
  const esKeyboard = scannerInput.inputMode === 'none';
  scannerInput.inputMode = esKeyboard ? 'text' : 'none';
  btnKeyboard.style.background = esKeyboard ? '#ffffff30' : '';
  scannerInput.focus();
  if (esKeyboard) scannerInput.select();
});

/**
 * Procesa un código escaneado o ingresado manualmente.
 * Reglas:
 *   - 18 dígitos → etiqueta completa [producto7][cantidad6][peso5]
 *   - 7 dígitos  → código de producto misceláneo → abrir BS cantidad
 *   - otro       → código inválido
 */
function procesarEscaneo(codigo) {
  if (!codigo) return;
  if (!state.pedido) return;

  const soloDigitos = /^\d+$/.test(codigo);

  if (codigo.length === 18 && soloDigitos) {
    // Etiqueta completa: siempre procesar directo con la cantidad embebida
    // (misceláneo y no-misceláneo se tratan igual aquí)
    const codigoProducto = codigo.substring(0, 7);
    const cantidad       = parseInt(codigo.substring(7, 13), 10);
    procesarCodigoProducto(codigoProducto, cantidad, false);

  } else if (codigo.length === 7 && soloDigitos) {
    // Código corto: abrir BS para ingresar cantidad manualmente
    const art = buscarArticulo(codigo);
    if (!art) {
      showToast('error', 'Código no encontrado', `El código ${codigo} no pertenece a este pedido.`);
      return;
    }
    if (art.estado === 'negado' || art.estado === 'parcial-negado') {
      showToast('error', 'Producto negado', 'El código escaneado fue negado y no es posible agregar unidades.');
      return;
    }
    abrirBsCantidad(codigo, true);

  } else {
    showToast('error', 'Código inválido', 'El código de barras capturado no es válido.');
  }
}

/**
 * Busca un artículo en el pedido por código.
 * Retorna el objeto artículo o null.
 */
const IMG_PLACEHOLDER = `<svg width="48" height="48" viewBox="0 0 24 24" fill="#c5cae9"><path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/></svg>`;

function setProductImage(elementId, imagen, size = 48) {
  const box = document.getElementById(elementId);
  if (!box) return;
  if (imagen) {
    box.innerHTML = `<img src="${imagen}" style="width:100%;height:100%;object-fit:contain;border-radius:8px;" alt="Producto" onerror="this.parentElement.innerHTML='${IMG_PLACEHOLDER.replace(/'/g, "\\'")}'" />`;
  } else {
    box.innerHTML = IMG_PLACEHOLDER;
  }
}

function buscarArticulo(codigo) {
  return state.pedido.articulos.find(a => a.codigo === codigo) || null;
}

/**
 * Procesa la adición de cantidad a un artículo.
 * @param {string} codigo        - Código de 7 dígitos del producto
 * @param {number} cantidad      - Cantidad a agregar
 * @param {boolean} esMiscelaneo - Si fue ingresado manualmente (BS)
 */
function procesarCodigoProducto(codigo, cantidad, esMiscelaneo) {
  const art = buscarArticulo(codigo);

  // Producto ajeno al pedido
  if (!art) {
    showToast('warning', 'Producto ajeno', `El código ${codigo} no pertenece a este pedido.`);
    return;
  }

  // Producto ya negado
  if (art.estado === 'negado') {
    showToast('error', 'Producto negado', 'El código escaneado fue negado y no es posible agregar unidades.');
    return;
  }

  // Validar cantidad cero
  if (cantidad <= 0) {
    showToast('error', 'Cantidad inválida', 'No es posible surtir un producto con cantidad cero. Por favor, ingresa una cantidad mayor.');
    return;
  }

  // Validar que no exceda lo solicitado (primero)
  if (art.surtido + cantidad > art.solicitado) {
    showToast('error', 'Cantidad inválida', 'La cantidad que intentas ingresar es mayor a la solicitada. Por favor, ingresa una cantidad igual o menor.');
    return;
  }

  // Validar que no exceda la existencia
  if (art.surtido + cantidad > art.existencia) {
    showToast('error', 'Cantidad inválida', 'La cantidad que intentas ingresar es mayor a la existencia actual. Por favor, ingresa una cantidad igual o menor.');
    return;
  }

  // Agregar cantidad
  art.surtido += cantidad;

  // Actualizar estado
  art.estado = art.surtido >= art.solicitado ? 'completo' : 'parcial';

  renderArticulosList();
  actualizarContadores();
  highlightArticulo(art.codigo);

  if (art.estado === 'completo') {
    verificarRevision(state.pedido.articulos.indexOf(art));
  }
}

/* ============================================================
   BOTTOM SHEET: CANTIDAD (código 7 dígitos / misceláneo)
   ============================================================ */
function abrirBsCantidad(codigo, esCodigo7) {
  state.bsCantidadCodigo   = codigo;
  state.bsCantidadEsCodigo7 = esCodigo7;
  document.getElementById('bs-codigo-val').textContent = codigo;
  document.getElementById('bs-cantidad-input').value   = '';
  overlays.bsCantidad.classList.remove('hidden');
  setTimeout(() => document.getElementById('bs-cantidad-input').focus(), 200);
}

document.getElementById('bs-cancel').addEventListener('click', () => {
  overlays.bsCantidad.classList.add('hidden');
  state.bsCantidadCodigo = null;
});

document.getElementById('bs-confirm').addEventListener('click', () => {
  const val = parseInt(document.getElementById('bs-cantidad-input').value, 10);
  if (!val || val <= 0) {
    showToast('error', 'Cantidad inválida', 'No es posible surtir un producto con cantidad cero. Por favor, ingresa una cantidad mayor.');
    return;
  }
  overlays.bsCantidad.classList.add('hidden');
  procesarCodigoProducto(state.bsCantidadCodigo, val, state.bsCantidadEsCodigo7);
  state.bsCantidadCodigo = null;
});

// Confirmar con Enter en el input del BS
document.getElementById('bs-cantidad-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('bs-confirm').click();
});

/* ============================================================
   PANTALLA: DETALLE DEL PRODUCTO
   ============================================================ */
function abrirDetalle(idx) {
  state.articuloActivo = idx;
  const art = state.pedido.articulos[idx];

  setProductImage('det-img-box', art.imagen);
  document.getElementById('det-codigo').textContent     = art.codigo;
  document.getElementById('det-nombre').textContent     = art.nombre;
  document.getElementById('det-ubicacion').textContent  = art.ubicacion;
  document.getElementById('det-pasillo').textContent    = art.pasillo;
  document.getElementById('det-torre').textContent      = art.torre;
  document.getElementById('det-nivel').textContent      = art.nivel;
  document.getElementById('det-existencia').textContent = art.existencia;
  document.getElementById('det-solicitado').textContent = art.solicitado;
  document.getElementById('det-cantidad-input').value   = art.surtido;

  // Bloquear stepper y botón negar cuando ya fue negado (total o parcial)
  const yaEstaNegado = (art.estado === 'negado' || art.estado === 'parcial-negado');
  document.getElementById('btn-stepper-minus').disabled = yaEstaNegado;
  document.getElementById('btn-stepper-plus').disabled  = yaEstaNegado;
  document.getElementById('det-cantidad-input').disabled = yaEstaNegado;
  document.getElementById('btn-detalle-negar').disabled  = yaEstaNegado;
  document.getElementById('btn-detalle-negar').style.opacity = yaEstaNegado ? '0.5' : '1';

  // Botón Revisar: nunca para misceláneo; solo si hay piezas surtidas, requiere revisión y no se revisó
  const necesitaRevision = !art.esMiscelaneo
    && art.requiereRevision
    && art.surtido > 0
    && ['completo', 'parcial-negado'].includes(art.estado)
    && !state.revisionesHechas.has(art.codigo);
  const btnRevisar = document.getElementById('btn-detalle-revisar');
  btnRevisar.classList.toggle('hidden', !necesitaRevision);

  showScreen('detalle');
}

/* Stepper − */
document.getElementById('btn-stepper-minus').addEventListener('click', () => {
  const inp = document.getElementById('det-cantidad-input');
  let val = parseInt(inp.value, 10) || 0;
  if (val > 0) { val--; inp.value = val; }
  guardarCantidadDetalle(val);
});

/* Stepper + */
document.getElementById('btn-stepper-plus').addEventListener('click', () => {
  const inp = document.getElementById('det-cantidad-input');
  const art = state.pedido.articulos[state.articuloActivo];
  let val = parseInt(inp.value, 10) || 0;

  if (val >= art.solicitado) {
    showToast('error', 'Cantidad inválida', 'La cantidad que intentas ingresar es mayor a la solicitada. Por favor, ingresa una cantidad igual o menor.');
    return;
  }
  if (val >= art.existencia) {
    showToast('error', 'Cantidad inválida', 'La cantidad que intentas ingresar es mayor a la existencia actual. Por favor, ingresa una cantidad igual o menor.');
    return;
  }
  val++;
  inp.value = val;
  guardarCantidadDetalle(val);
});

/* Edición directa del input */
document.getElementById('det-cantidad-input').addEventListener('change', () => {
  const inp = document.getElementById('det-cantidad-input');
  const art = state.pedido.articulos[state.articuloActivo];
  let val = parseInt(inp.value, 10);

  if (isNaN(val) || val < 0) { val = 0; inp.value = 0; }

  if (val > art.solicitado) {
    showToast('error', 'Cantidad inválida', 'La cantidad que intentas ingresar es mayor a la solicitada. Por favor, ingresa una cantidad igual o menor.');
    val = art.solicitado;
    inp.value = val;
  }
  if (val > art.existencia) {
    showToast('error', 'Cantidad inválida', 'La cantidad que intentas ingresar es mayor a la existencia actual. Por favor, ingresa una cantidad igual o menor.');
    val = art.existencia;
    inp.value = val;
  }
  guardarCantidadDetalle(val);
});

function guardarCantidadDetalle(val) {
  const art = state.pedido.articulos[state.articuloActivo];
  art.surtido = val;

  if (art.estado === 'negado' || art.estado === 'parcial-negado') return; // no cambiar si ya fue negado

  if (val <= 0)               art.estado = 'pendiente';
  else if (val >= art.solicitado) art.estado = 'completo';
  else                        art.estado = 'parcial';
}

/* Botón Regresar en detalle (flecha header y botón footer — misma lógica) */
function regresarDeDetalle() {
  guardarCantidadDetalle(parseInt(document.getElementById('det-cantidad-input').value, 10) || 0);
  renderArticulosList();
  actualizarContadores();
  if (verificarRevision(state.articuloActivo)) return;
  showScreen('surtido');
  setTimeout(() => {
    const inp = document.getElementById('scanner-input-surtido');
    if (inp) inp.focus();
  }, 300);
}

document.getElementById('btn-back-detalle').addEventListener('click', regresarDeDetalle);
document.getElementById('btn-detalle-regresar').addEventListener('click', regresarDeDetalle);

/* Botón Revisar producto */
document.getElementById('btn-detalle-revisar').addEventListener('click', () => {
  abrirRevision(state.articuloActivo);
});

/* Botón Negar producto */
document.getElementById('btn-detalle-negar').addEventListener('click', () => {
  const art = state.pedido.articulos[state.articuloActivo];
  if (art.estado === 'negado' || art.estado === 'parcial-negado') return;
  abrirBsNegacion(art.codigo, art.nombre);
});

/* ============================================================
   BOTTOM SHEET: SELECCIÓN DE MOTIVO DE NEGACIÓN
   ============================================================ */
function abrirBsNegacion(codigo, nombre) {
  state.negacionCodigo = codigo;
  state.negacionMotivo = null;
  const art = buscarArticulo(codigo);
  // Completo → se devuelven las piezas surtidas; si no → las piezas faltantes
  const piezasNegar = art
    ? (art.estado === 'completo' ? art.surtido : art.solicitado - art.surtido)
    : 0;
  document.getElementById('neg-codigo-val').textContent   = codigo;
  document.getElementById('neg-nombre-val').textContent   = nombre;
  document.getElementById('neg-cantidad-val').textContent = piezasNegar;
  document.getElementById('neg-motivo-texto').textContent = 'Seleccionar una opción';
  document.getElementById('neg-confirm').disabled = true;
  document.getElementById('neg-confirm').style.background = '#9e9e9e';
  document.getElementById('neg-dropdown-list').classList.add('hidden');
  overlays.bsNegacion.classList.remove('hidden');
}

/* Toggle dropdown de motivos */
document.getElementById('neg-dropdown-trigger').addEventListener('click', () => {
  const list = document.getElementById('neg-dropdown-list');
  list.classList.toggle('hidden');
});

/* Selección de opción en dropdown */
document.querySelectorAll('.neg-option').forEach(opt => {
  opt.addEventListener('click', () => {
    state.negacionMotivo = opt.dataset.value;
    document.getElementById('neg-motivo-texto').textContent = opt.dataset.value;
    document.getElementById('neg-dropdown-list').classList.add('hidden');
    // Habilitar botón confirmar
    document.getElementById('neg-confirm').disabled = false;
    document.getElementById('neg-confirm').style.background = '#2e7d32';
  });
});

document.getElementById('neg-cancel').addEventListener('click', () => {
  overlays.bsNegacion.classList.add('hidden');
  state.negacionCodigo = null;
  state.negacionMotivo = null;
});

document.getElementById('neg-confirm').addEventListener('click', () => {
  if (!state.negacionMotivo) return;

  const art = buscarArticulo(state.negacionCodigo);
  if (!art) return;

  // Si ya tenía algo surtido → parcial-negado, si no → negado
  art.estado          = art.surtido > 0 ? 'parcial-negado' : 'negado';
  art.motivo_negacion = state.negacionMotivo;

  overlays.bsNegacion.classList.add('hidden');
  showToast('warning', 'Producto negado', `${art.codigo} negado por: ${state.negacionMotivo}`);

  const codigoNegado = state.negacionCodigo;
  state.negacionCodigo = null;
  state.negacionMotivo = null;

  renderArticulosList();
  actualizarContadores();

  const idxNegado = state.pedido.articulos.findIndex(a => a.codigo === codigoNegado);
  if (idxNegado >= 0 && verificarRevision(idxNegado)) return;

  showScreen('surtido');
  setTimeout(() => {
    const inp = document.getElementById('scanner-input-surtido');
    if (inp) inp.focus();
  }, 300);
});

/* ============================================================
   FINALIZAR SURTIDO — VALIDACIONES
   ============================================================ */
function intentarFinalizar() {
  const arts = state.pedido.articulos;

  // 1. ¿Hay artículos pendientes (sin surtir ni negar)?
  const hayPendientes = arts.some(a => a.estado === 'pendiente');
  if (hayPendientes) {
    overlays.modalNoFin.classList.remove('hidden');
    return;
  }

  // 2. ¿Hay artículos parciales (surtidos pero no completos ni negados)?
  const parciales = arts.filter(a => a.estado === 'parcial');
  if (parciales.length > 0) {
    renderParcialesList(parciales);
    overlays.modalParciales.classList.remove('hidden');
    return;
  }

  // 3. Todo OK → finalizar
  finalizarSurtido();
}

/* Modal no finalizar — cerrar */
document.getElementById('modal-no-fin-close').addEventListener('click', () => {
  overlays.modalNoFin.classList.add('hidden');
});

/* Modal parciales — cancelar */
document.getElementById('parciales-cancel').addEventListener('click', () => {
  overlays.modalParciales.classList.add('hidden');
});

/* Modal parciales — confirmar y finalizar */
document.getElementById('parciales-confirm').addEventListener('click', () => {
  overlays.modalParciales.classList.add('hidden');
  finalizarSurtido();
});

function renderParcialesList(parciales) {
  const list = document.getElementById('parciales-list');
  list.innerHTML = '';
  parciales.forEach(art => {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;align-items:center;justify-content:space-between;padding:6px 0;border-bottom:1px solid #f0f0f0;';
    row.innerHTML = `
      <span style="font-size:14px;font-weight:700;color:#1a1a2e;">${art.codigo}</span>
      <span class="badge-progreso" style="background:#dde3f0;color:#1B3892;border-color:#1B3892;">${art.surtido} de ${art.solicitado}</span>
      <span style="font-size:12px;color:#777;">Existencia: ${art.existencia}</span>
    `;
    list.appendChild(row);
  });
}

function finalizarSurtido() {
  const arts = state.pedido.articulos;
  let completado = 0, negado = 0, parcial = 0;
  arts.forEach(a => {
    if (a.estado === 'completo')       completado++;
    else if (a.estado === 'negado')    negado++;
    else if (a.estado === 'parcial' || a.estado === 'parcial-negado') parcial++;
  });

  document.getElementById('res-completado').textContent = completado;
  document.getElementById('res-negado').textContent     = negado;
  document.getElementById('res-parcial').textContent    = parcial;

  const total = arts.length;
  document.getElementById('resumen-sub-text').textContent =
    `Pedido ${state.pedido.id} — ${total} artículo${total !== 1 ? 's' : ''} procesados.`;

  showScreen('resumen');
}

/* Botón volver al menú desde resumen */
document.getElementById('btn-resumen-menu').addEventListener('click', () => {
  state.pedido = null;
  state.articuloActivo = null;
  showScreen('menu');
});

/* ============================================================
   REVISIÓN DE MERCANCÍA — pantalla completa
   Se activa al completar/negar un artículo con requiereRevision=true.
   Muestra foto del producto, tabla de avance y barra de progreso.
   ============================================================ */

/* Abre revisión si el artículo en ese índice la requiere. Devuelve true si la abrió. */
function verificarRevision(idx) {
  const art = state.pedido.articulos[idx];
  // Sin piezas surtidas → nada que revisar
  if (art.surtido === 0) return false;
  // Misceláneo → no requiere revisión en ningún caso
  if (art.esMiscelaneo) return false;
  const estadoFinal = ['completo', 'parcial-negado'].includes(art.estado);
  if (estadoFinal && art.requiereRevision && !state.revisionesHechas.has(art.codigo)) {
    abrirRevision(idx);
    return true;
  }
  return false;
}

function abrirRevision(idx) {
  const art = state.pedido.articulos[idx];
  state.revisionCodigo  = art.codigo;
  state.revisionConteo  = 0;

  // Sección visible según tipo de producto
  const esMisc = art.esMiscelaneo;
  document.getElementById('rev-footer-scanner').classList.toggle('hidden', esMisc);
  document.getElementById('rev-misc-confirm-zone').classList.toggle('hidden', !esMisc);

  renderRevisionScreen();
  overlays.revModal.classList.remove('hidden');

  if (!esMisc) {
    const inp = document.getElementById('rev-scan-input');
    inp.value     = '';
    inp.inputMode = 'none';
    setTimeout(() => inp.focus(), 300);
  }
}

function renderRevisionScreen() {
  const art = state.pedido.articulos.find(a => a.codigo === state.revisionCodigo);
  if (!art) return;

  const total  = art.surtido;
  const actual = state.revisionConteo;
  const pct    = total > 0 ? Math.round((actual / total) * 100) : 0;

  document.getElementById('rev-pieza-actual').textContent  = actual;
  document.getElementById('rev-pieza-total').textContent   = total;
  document.getElementById('rev-progress-fill').style.width = `${pct}%`;
  document.getElementById('rev-current-codigo').textContent = art.codigo;
  document.getElementById('rev-current-nombre').textContent = art.nombre;
  setProductImage('rev-img-box', art.imagen, 40);
}

function procesarRevisionScan(raw) {
  if (!raw || !state.revisionCodigo) return;
  let codigoProducto;

  if (raw.length === 18 && /^\d+$/.test(raw)) {
    codigoProducto = raw.substring(0, 7);
  } else if (raw.length === 7 && /^\d+$/.test(raw)) {
    codigoProducto = raw;
  } else {
    showToast('error', 'Código inválido', 'Escanea la etiqueta de 18 dígitos o ingresa el código de 7 dígitos.');
    return;
  }

  if (codigoProducto !== state.revisionCodigo) {
    showToast('error', 'Código incorrecto', `Se esperaba ${state.revisionCodigo}, se recibió ${codigoProducto}.`);
    return;
  }

  const art = state.pedido.articulos.find(a => a.codigo === state.revisionCodigo);
  state.revisionConteo++;

  if (state.revisionConteo < art.surtido) {
    // Todavía faltan piezas
    renderRevisionScreen();
    showToast('success', 'Pieza confirmada', `${state.revisionConteo} de ${art.surtido} piezas escaneadas.`);
    return;
  }

  // Todas las piezas escaneadas → revisión completa
  state.revisionesHechas.add(state.revisionCodigo);
  showToast('success', 'Revisión completa', `${art.surtido} de ${art.surtido} piezas verificadas.`);
  state.revisionCodigo = null;
  state.revisionConteo = 0;

  overlays.revModal.classList.add('hidden');
  setTimeout(() => {
    const inp = document.getElementById('scanner-input-surtido');
    if (inp) inp.focus();
  }, 300);
}

/* Cancelar revisión — muestra confirmación antes de restablecer */
document.getElementById('btn-back-revision').addEventListener('click', () => {
  const codigo = state.revisionCodigo;
  document.getElementById('rev-cancel-msg').textContent =
    `La mercancía del producto ${codigo} tendrá que ser surtida o negada nuevamente.`;
  overlays.revCancel.classList.remove('hidden');
});

/* Confirmación cancelar — NO, volver a la revisión */
document.getElementById('rev-cancel-no').addEventListener('click', () => {
  overlays.revCancel.classList.add('hidden');
});

/* Confirmación cancelar — SÍ, restablecer solo ese producto */
document.getElementById('rev-cancel-yes').addEventListener('click', () => {
  const art = state.pedido.articulos.find(a => a.codigo === state.revisionCodigo);
  if (art) {
    art.estado          = 'pendiente';
    art.surtido         = 0;
    art.motivo_negacion = null;
    state.revisionesHechas.delete(art.codigo);
    renderArticulosList();
    actualizarContadores();
  }
  const codigo = state.revisionCodigo;
  state.revisionCodigo = null;
  state.revisionConteo = 0;
  overlays.revCancel.classList.add('hidden');
  overlays.revModal.classList.add('hidden');
  showToast('warning', 'Mercancía restablecida', `El producto ${codigo} fue restablecido y deberá surtirse nuevamente.`);
  setTimeout(() => {
    const inp = document.getElementById('scanner-input-surtido');
    if (inp) inp.focus();
  }, 300);
});

/* Scanner de la pantalla de revisión — debounce idéntico al scanner principal */
const revScanInput = document.getElementById('rev-scan-input');
let revScanProcessed = false;
let revScanDebounce  = null;

// Auto-refoco en el scanner de revisión mientras el modal esté visible
revScanInput.addEventListener('blur', () => {
  if (!overlays.revModal.classList.contains('hidden')) {
    setTimeout(() => revScanInput.focus(), 30);
  }
});

revScanInput.addEventListener('input', () => {
  clearTimeout(revScanDebounce);
  const val = revScanInput.value.trim();
  if (val.length === 18) {
    revScanDebounce = setTimeout(() => {
      if (!revScanProcessed) {
        procesarRevisionScan(val);
        revScanInput.value = '';
        revScanInput.focus();
      }
      revScanProcessed = false;
    }, 80);
  }
});

revScanInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    clearTimeout(revScanDebounce);
    revScanProcessed = true;
    const val = revScanInput.value.trim();
    if (val) { procesarRevisionScan(val); revScanInput.value = ''; revScanInput.focus(); }
    setTimeout(() => { revScanProcessed = false; }, 200);
  }
});

document.getElementById('rev-btn-send').addEventListener('click', () => {
  clearTimeout(revScanDebounce);
  revScanProcessed = true;
  const val = revScanInput.value.trim();
  if (val) { procesarRevisionScan(val); revScanInput.value = ''; revScanInput.focus(); }
  setTimeout(() => { revScanProcessed = false; }, 200);
});

/* Confirmar revisión — solo misceláneo (no requiere escaneo) */
document.getElementById('rev-btn-confirmar-misc').addEventListener('click', () => {
  const art = state.pedido.articulos.find(a => a.codigo === state.revisionCodigo);
  if (!art) return;
  state.revisionesHechas.add(state.revisionCodigo);
  renderArticulosList();
  actualizarContadores();
  showToast('success', 'Revisión confirmada', `Revisión del producto ${art.codigo} completada.`);
  state.revisionCodigo = null;
  state.revisionConteo = 0;
  overlays.revModal.classList.add('hidden');
  setTimeout(() => {
    const inp = document.getElementById('scanner-input-surtido');
    if (inp) inp.focus();
  }, 300);
});


/* ============================================================
   CERRAR OVERLAYS AL TOCAR EL FONDO
   ============================================================ */
[
  overlays.bsCantidad,
  overlays.optionsSheet,
  overlays.bsNegacion,
  overlays.modalNoFin,
  overlays.modalParciales,
].forEach(overlay => {
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      overlay.classList.add('hidden');
    }
  });
});

/* ============================================================
   INICIALIZACIÓN
   ============================================================ */
(function init() {
  showScreen('menu');
})();
