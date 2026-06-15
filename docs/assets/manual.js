/* ============================================================
   Manual de Usuario — Clínica Lichi
   Comportamiento compartido por todos los manuales (docs/assets/)
   ============================================================ */

var MANUALES = [
  { archivo: 'manual_paciente.html',             nombre: 'Pacientes' },
  { archivo: 'manual_paciente-responsable.html', nombre: 'Responsables' },
  { archivo: 'manual_agenda.html',               nombre: 'Agenda / Citas y Turnos' },
  { archivo: 'manual_consultas.html',            nombre: 'Consulta Médica' },
  { archivo: 'manual_recordatorios.html',        nombre: 'Recordatorios' },
  { archivo: 'manual_facturacion.html',          nombre: 'Facturación' },
  { archivo: 'manual_timbrado.html',             nombre: 'Timbrado' },
  { archivo: 'manual_cobranzas.html',            nombre: 'Cobranzas' },
  { archivo: 'manual_cuentas-mcb.html',          nombre: 'Cuentas Caja/Banco' },
  { archivo: 'manual_pago_prestador.html',       nombre: 'Pago a Prestadores' },
  { archivo: 'manual_grupos_productos.html',     nombre: 'Grupos y Productos' },
  { archivo: 'manual_prestador.html',            nombre: 'Prestadores (RRHH)' },
  { archivo: 'manual_horario-prestador.html',    nombre: 'Horario del Prestador' },
  { archivo: 'manual_usuarios.html',             nombre: 'Usuarios del Sistema' },
  { archivo: 'manual_consultorios.html',         nombre: 'Consultorios' },
  { archivo: 'manual_especialidades.html',       nombre: 'Especialidades' },
  { archivo: 'manual_eventoclinico.html',        nombre: 'Eventos Clínicos' },
  { archivo: 'manual_tipo-doc-dig.html',         nombre: 'Tipos de Doc. Digitalizado' },
  { archivo: 'manual_ubicaciones.html',          nombre: 'Ubicaciones' },
]

document.addEventListener('DOMContentLoaded', function () {
  initTopbar()
  initTocLateral()
  initLightbox()
  initCamposUI()
  initFooterNav()
  initVolverArriba()
})

/* ---------- 2 + 5. Barra superior: marca, selector de manual, imprimir, progreso ---------- */
function initTopbar() {
  var bar = document.createElement('header')
  bar.className = 'manual-topbar'

  var brand = document.createElement('a')
  brand.className = 'manual-topbar-brand'
  brand.href = 'index.html'
  brand.title = 'Ver índice de manuales'
  brand.innerHTML =
    '<span class="manual-topbar-logo">Clínica <em>Lichi</em></span>' +
    '<span class="manual-topbar-tag">Manuales</span>'
  bar.appendChild(brand)

  var sep = document.createElement('span')
  sep.className = 'manual-topbar-sep'
  bar.appendChild(sep)

  var actual = window.location.pathname.split('/').pop()
  var select = document.createElement('select')
  select.className = 'manual-topbar-select'
  select.setAttribute('aria-label', 'Ver otro manual')
  var esManual = MANUALES.some(function (m) { return m.archivo === actual })
  if (!esManual) {
    var ph = document.createElement('option')
    ph.value = ''
    ph.textContent = 'Ir a un manual…'
    ph.selected = true
    ph.disabled = true
    select.appendChild(ph)
  }
  MANUALES.forEach(function (m) {
    var opt = document.createElement('option')
    opt.value = m.archivo
    opt.textContent = m.nombre
    if (m.archivo === actual) opt.selected = true
    select.appendChild(opt)
  })
  select.addEventListener('change', function () {
    if (select.value && select.value !== actual) window.location.href = select.value
  })
  bar.appendChild(select)

  var btnPrint = document.createElement('button')
  btnPrint.className = 'manual-topbar-print'
  btnPrint.type = 'button'
  btnPrint.innerHTML = '&#128424; Imprimir / PDF'
  btnPrint.addEventListener('click', function () { window.print() })
  bar.appendChild(btnPrint)

  var progreso = document.createElement('div')
  progreso.className = 'manual-progress'
  bar.appendChild(progreso)

  document.body.insertBefore(bar, document.body.firstChild)

  function actualizarProgreso() {
    var total = document.documentElement.scrollHeight - window.innerHeight
    var pct = total > 0 ? Math.min(100, (window.scrollY / total) * 100) : 0
    progreso.style.width = pct + '%'
  }
  window.addEventListener('scroll', actualizarProgreso, { passive: true })
  actualizarProgreso()
}

/* ---------- Navegación al pie: manual anterior / índice / siguiente ---------- */
function initFooterNav() {
  var actual = window.location.pathname.split('/').pop()
  var idx = MANUALES.findIndex(function (m) { return m.archivo === actual })
  if (idx === -1) return

  var wrap = document.querySelector('.page-wrap') || document.body
  var nav = document.createElement('nav')
  nav.className = 'manual-footer-nav'
  nav.setAttribute('aria-label', 'Navegación entre manuales')

  var previo = MANUALES[idx - 1]
  var siguiente = MANUALES[idx + 1]

  nav.appendChild(previo
    ? linkFooter(previo.archivo, 'Anterior', '← ' + previo.nombre, 'anterior')
    : vacioFooter())

  var indice = document.createElement('a')
  indice.className = 'manual-footer-link indice'
  indice.href = 'index.html'
  indice.textContent = 'Índice de manuales'
  nav.appendChild(indice)

  nav.appendChild(siguiente
    ? linkFooter(siguiente.archivo, 'Siguiente', siguiente.nombre + ' →', 'siguiente')
    : vacioFooter())

  wrap.appendChild(nav)

  function linkFooter(href, rotulo, nombre, clase) {
    var a = document.createElement('a')
    a.className = 'manual-footer-link ' + clase
    a.href = href
    a.innerHTML = '<span class="manual-footer-rotulo">' + rotulo + '</span>' +
                  '<span class="manual-footer-nombre"></span>'
    a.querySelector('.manual-footer-nombre').textContent = nombre
    return a
  }
  function vacioFooter() {
    var d = document.createElement('div')
    d.className = 'manual-footer-link manual-footer-vacio'
    return d
  }
}

/* ---------- Botón volver arriba ---------- */
function initVolverArriba() {
  var btn = document.createElement('button')
  btn.className = 'manual-top-btn'
  btn.type = 'button'
  btn.setAttribute('aria-label', 'Volver arriba')
  btn.innerHTML = '&uarr;'
  btn.addEventListener('click', function () { window.scrollTo({ top: 0, behavior: 'smooth' }) })
  document.body.appendChild(btn)

  function alternar() {
    btn.classList.toggle('visible', window.scrollY > 600)
  }
  window.addEventListener('scroll', alternar, { passive: true })
  alternar()
}

/* ---------- 4. Lightbox: ampliar capturas al hacer clic ---------- */
function initLightbox() {
  var imagenes = document.querySelectorAll('.screenshot img')
  if (!imagenes.length) return

  function abrir(img) {
    var overlay = document.createElement('div')
    overlay.className = 'lightbox-overlay'

    var grande = document.createElement('img')
    grande.src = img.src
    grande.alt = img.alt || ''
    overlay.appendChild(grande)

    var capEl = img.closest('.screenshot')
    var capTexto = capEl ? capEl.querySelector('.screenshot-caption') : null
    if (capTexto) {
      var cap = document.createElement('div')
      cap.className = 'lightbox-caption'
      cap.textContent = capTexto.textContent
      overlay.appendChild(cap)
    }

    var cerrar = document.createElement('button')
    cerrar.className = 'lightbox-cerrar'
    cerrar.setAttribute('aria-label', 'Cerrar imagen ampliada')
    cerrar.innerHTML = '&times;'
    overlay.appendChild(cerrar)

    var hint = document.createElement('div')
    hint.className = 'lightbox-hint'
    hint.textContent = 'Clic o Escape para cerrar'
    overlay.appendChild(hint)

    function quitar() {
      overlay.remove()
      document.removeEventListener('keydown', onTecla)
    }
    function onTecla(e) { if (e.key === 'Escape') quitar() }

    overlay.addEventListener('click', quitar)
    document.addEventListener('keydown', onTecla)
    document.body.appendChild(overlay)
  }

  imagenes.forEach(function (img) {
    img.addEventListener('click', function () { abrir(img) })
  })
}

/* ---------- 6. Chips de campos de formulario ---------- */
function initCamposUI() {
  // a) Tablas de campos: primera columna de toda tabla cuyo primer encabezado sea "Campo"
  document.querySelectorAll('table').forEach(function (tabla) {
    var th = tabla.querySelector('thead th')
    if (!th || th.textContent.trim() !== 'Campo') return
    tabla.querySelectorAll('tbody tr').forEach(function (fila) {
      var celda = fila.querySelector('td')
      if (!celda) return
      var strong = celda.querySelector('strong')
      if (strong) {
        strong.classList.add('campo-ui')
      } else if (celda.textContent.trim()) {
        var span = document.createElement('span')
        span.className = 'campo-ui'
        span.textContent = celda.textContent.trim()
        celda.textContent = ''
        celda.appendChild(span)
      }
    })
  })

  // b) Menciones inline: <strong> precedido por la palabra "campo(s)" en el texto.
  //    Stoplist: adjetivos que siguen a "campo" pero no son nombres de campo.
  var noEsCampo = /^(obligatorios?|requeridos?|opcionales?|vac[íi]os?)$/i
  document.querySelectorAll('.content strong').forEach(function (strong) {
    var previo = strong.previousSibling
    if (previo && previo.nodeType === Node.TEXT_NODE && /campos?\s*$/i.test(previo.textContent)
        && !noEsCampo.test(strong.textContent.trim())) {
      strong.classList.add('campo-ui')
    }
  })
}

/* ---------- 1. Índice lateral fijo con sección activa ---------- */
function initTocLateral() {
  var tocOriginal = document.querySelector('.toc ol')
  if (!tocOriginal) return

  var nav = document.createElement('nav')
  nav.className = 'toc-side'
  nav.setAttribute('aria-label', 'Índice del manual')

  var archivoActual = window.location.pathname.split('/').pop()
  var moduloActual = MANUALES.find(function (m) { return m.archivo === archivoActual })

  var cabecera = document.createElement('div')
  cabecera.className = 'toc-side-cabecera'
  var icono = document.createElement('div')
  icono.className = 'toc-side-logo-icon'
  icono.textContent = '?'
  cabecera.appendChild(icono)
  var cabTexto = document.createElement('div')
  var modulo = document.createElement('div')
  modulo.className = 'toc-side-modulo'
  modulo.textContent = moduloActual ? moduloActual.nombre : document.title.split('—')[0].trim()
  cabTexto.appendChild(modulo)
  var sub = document.createElement('div')
  sub.className = 'toc-side-sub'
  sub.textContent = 'Manual de usuario'
  cabTexto.appendChild(sub)
  cabecera.appendChild(cabTexto)
  nav.appendChild(cabecera)

  var navBody = document.createElement('div')
  navBody.className = 'toc-side-nav'
  var titulo = document.createElement('div')
  titulo.className = 'toc-side-titulo'
  titulo.textContent = 'Contenido'
  navBody.appendChild(titulo)
  var lista = tocOriginal.cloneNode(true)
  navBody.appendChild(lista)
  nav.appendChild(navBody)

  var progreso = document.createElement('div')
  progreso.className = 'toc-side-progreso'
  progreso.innerHTML = '<span class="toc-side-progreso-txt"></span>' +
    '<div class="toc-side-progreso-track"><div class="toc-side-progreso-fill"></div></div>'
  nav.appendChild(progreso)
  var progresoTxt  = progreso.querySelector('.toc-side-progreso-txt')
  var progresoFill = progreso.querySelector('.toc-side-progreso-fill')

  document.body.appendChild(nav)

  var links = Array.prototype.slice.call(lista.querySelectorAll('a[href^="#"]'))
  var secciones = links
    .map(function (a) {
      var sec = document.querySelector(a.getAttribute('href'))
      return sec ? { link: a, sec: sec } : null
    })
    .filter(Boolean)

  if (!secciones.length) return

  var activo = null
  function actualizarActivo() {
    var corte = window.scrollY + window.innerHeight * 0.25
    var actual = secciones[0]
    for (var i = 0; i < secciones.length; i++) {
      if (secciones[i].sec.offsetTop <= corte) actual = secciones[i]
    }
    if (actual !== activo) {
      if (activo) activo.link.classList.remove('toc-side-activo')
      actual.link.classList.add('toc-side-activo')
      activo = actual

      var pos = secciones.indexOf(actual) + 1
      progresoTxt.textContent = 'Sección ' + pos + ' de ' + secciones.length
      progresoFill.style.width = (pos / secciones.length) * 100 + '%'
    }
  }

  var pendiente = false
  window.addEventListener('scroll', function () {
    if (pendiente) return
    pendiente = true
    requestAnimationFrame(function () {
      actualizarActivo()
      pendiente = false
    })
  }, { passive: true })

  actualizarActivo()
}
