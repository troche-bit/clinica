# CLAUDE.md — Frontend
_Clínica Lichi · Versión 4.0 · Abril 2026_

Ver también: `../CLAUDE.md` (convenciones globales)

---

## Estructura de Carpetas

```
frontend/src/
├── api/
│   └── client.js              ← cliente ACTIVO — usar siempre este
│                                 axiosConfig.js está huérfano — eliminar
├── context/
│   └── AuthContext.jsx        ← decodifica JWT, expone rol/nombre/iniciales
├── utils/
│   ├── calcularDV.js          ← dígito verificador RUC Paraguay
│   └── errores.js             ← extraerMensajeError — normaliza errores DRF 400
│
├── hooks/
│   ├── useToast.js
│   ├── useAtajosTeclado.js    ← atajos de teclado globales — ver convención abajo
│   ├── core/
│   ├── administracion/
│   │   ├── usePersona.js
│   │   ├── useUsuarios.js
│   │   ├── usePersonaRRHH.js
│   │   └── useAuditoria.js    ← pendiente de crear
│   ├── mantenimiento/
│   │   ├── useUbicacion.js
│   │   ├── useDiasemana.js    ← pendiente de crear
│   │   ├── useTipoDocDig.js
│   │   ├── useEventosClinicos.js
│   │   ├── useFormasPago.js
│   │   ├── useDocumentos.js
│   │   └── useRecordatorios.js
│   ├── clinica/
│   │   ├── usePatients.js
│   │   ├── useResponsable.js
│   │   ├── useConsultorios.js
│   │   ├── useEspecialidades.js
│   │   ├── useHorarioPrestador.js
│   │   ├── useAgenda.js
│   │   └── useConsultas.js
│   ├── facturacion/
│   │   ├── useFacturacion.js
│   │   └── useTimbrado.js
│   ├── stock/
│   │   ├── useGrupos.js
│   │   └── useProductos.js
│   └── finanzas/
│       ├── useCuentasMcb.js
│       ├── useMovimientos.js
│       ├── useCobranzas.js
│       └── usePagoPrestador.js
│
├── components/
│   ├── ui/
│   │   ├── Modal.jsx
│   │   ├── PanelSimple.jsx
│   │   ├── Toast.jsx
│   │   └── ConfirmDialog.jsx  ← diálogo de confirmación — reemplaza window.confirm()
│   ├── layout/
│   │   ├── Layout.jsx         ← define clases globales reutilizables
│   │   ├── Sidebar.jsx        ← filtra menú según rol (PERMISOS por id de grupo)
│   │   └── Navbar.jsx         ← breadcrumbs automáticos · fecha actual · dropdown recordatorios con badge
│                             BREADCRUMBS: claves deben coincidir con pathname EXACTO del router
│                             (ej: '/paciente' singular ≠ '/pacientes' — verificar App.jsx al agregar rutas)
│   ├── persona/
│   │   ├── BuscadorPersona.jsx
│   │   └── FormPersona.jsx
│   ├── paciente/
│   │   ├── PacienteForm.jsx   ← orquestador
│   │   └── FormPaciente.jsx   ← sub-formulario
│   ├── responsable/
│   │   ├── ResponsableForm.jsx ← orquestador
│   │   └── FormResponsable.jsx ← sub-formulario
│   └── rrhh/
│       └── FormRRHH.jsx        ← orquestador
│
└── pages/
    ├── Login.jsx
    ├── Dashboard.jsx           ← existe pero NO está en el router — pendiente
    ├── administracion/
    │   ├── UsuariosPage.jsx
    │   ├── PersonaRRHHPage.jsx
    │   └── AuditoriaPage.jsx   ← pendiente — solo rol admin
    ├── mantenimiento/
    │   ├── UbicacionesPage.jsx
    │   ├── EventoClinicoPage.jsx
    │   ├── TipoDocDigPage.jsx
    │   └── DocumentosPage.jsx
    ├── clinica/
    │   ├── configuracion/
    │   │   ├── ConsultorioPage.jsx
    │   │   ├── EspecialidadPage.jsx
    │   │   └── HorarioPrestadorPage.jsx
    │   ├── PacientePage.jsx
    │   ├── InformesPacientePage.jsx
    │   ├── DashboardPacientesPage.jsx
    │   ├── PacienteResponsablePage.jsx
    │   ├── AgendaPage.jsx
    │   ├── ConsultasPage.jsx
    │   └── RecordatoriosPage.jsx
    ├── facturacion/
    │   ├── FacturacionPage.jsx
    │   └── TimbradoPage.jsx
    ├── stock/
    │   └── GruposPage.jsx
    └── finanzas/
        ├── CuentasMcbPage.jsx
        ├── CobranzasPage.jsx
        └── PagoPrestadorPage.jsx
```

---

## Convenciones Críticas

### Sidebar — PERMISOS por rol
El Sidebar filtra los grupos del menú mediante la constante `PERMISOS` (en `Sidebar.jsx`).
Cada grupo tiene un `id`; solo los grupos incluidos en el array del rol se muestran.

| Rol | Grupos visibles |
|---|---|
| `admin` | pacientes, agenda, consultas, facturacion, finanzas, rrhh, informes, usuarios, mantenimiento |
| `recepcionista` | pacientes, agenda, consultas, facturacion, finanzas, mantenimiento, informes |
| `medico` | pacientes, agenda, consultas, informes |
| `secretaria_medico` | pacientes, agenda, consultas, informes |

Grupos relevantes para catálogos de configuración:
- `mantenimiento` → Ubicaciones, **Consultorios**, **Especialidades**, Tipo doc. digitalizado
- `consultas` → Consulta médica, **Evento clínico**
- `rrhh` → Persona RRHH (solo admin)

Al crear un nuevo módulo que deba ser visible para recepcionista, asignarlo al grupo `mantenimiento` o `consultas` según corresponda — **no** crear grupos nuevos salvo que sea estrictamente necesario.

### Cliente HTTP
- Usar siempre `client.js` — es el único cliente activo
- Claves de localStorage: `access_token` / `refresh_token`
- `axiosConfig.js` está huérfano — eliminar

### Formularios
- Los formularios **NUNCA** guardan datos por sí solos — notifican al padre via `onChange`
- El padre (orquestador) llama a la API y maneja el estado de guardado
- `onSuccess()` notifica a la página que la operación terminó
- El guardado es secuencial: primero `Persona`, luego la entidad específica

### Estado y datos
- **React Query** para estado del servidor — no duplicar en `useState`
- **useState** solo para estado local de UI (panel abierto, modo edición, campos)
- **Context API** solo para estado global real (usuario autenticado, rol)
- Todos los hooks de mutación usan `invalidateQueries` al completar

### Distinción orquestador vs sub-formulario
| Nombre | Rol |
|---|---|
| `PacienteForm` | Orquestador — une BuscadorPersona + FormPersona + FormPaciente + guardado |
| `FormPaciente` | Sub-formulario — solo campos propios del Paciente |
| `ResponsableForm` | Orquestador |
| `FormResponsable` | Sub-formulario |
| `FormRRHH` | Orquestador |

---

## Patrones de UI

### Regla de elección
- Formulario con múltiples componentes o pasos → **Modal** (soporta modo `ver`/`editar`/`crear`)
- Formulario simple de 1-4 campos → **Master-Detail (PanelSimple)**

### Patrón Modal con modos
_Usado en: Paciente, PacienteResponsable_

El estado `modo` (`'crear'` | `'ver'` | `'editar'` | `null`) reemplaza el booleano `modalOpen`:
- `isOpen={modo !== null}` — el modal se abre cuando hay un modo activo
- Click en fila → `modo = 'ver'` → Modal muestra componente de detalle read-only
- Botón Editar en tabla → `modo = 'editar'` → Modal muestra orquestador de formulario
- Botón Editar dentro del detalle → `setModo('editar')` → cambia contenido sin cerrar el modal
- Botón Nuevo → `modo = 'crear'`, `pacienteEdit = null`

```
fila click      → modo='ver'    → <DetallePaciente onEditar={() => setModo('editar')} />
btn editar fila → modo='editar' → <PacienteForm ... />
btn nuevo       → modo='crear'  → <PacienteForm ... />
```

El componente de detalle (ej. `PacienteDetalle`) se define **inline en la página** usando helpers:
- `Seccion` — card con título uppercase, borde `#e8edf2` y fondo `#fafbfc`
- `Campo` — label (uppercase gris) + valor en grilla de 3 columnas
- `CampoDestacado` — campo con fondo de color para datos críticos:
  - `variante="amarillo"` — alergias conocidas (fondo `#fefce8`, borde-left ámbar)
  - `variante="rojo"` — enfermedades crónicas (fondo `#fff5f5`, borde-left rojo suave)
  - Muestra `'Sin registro'` en lugar de `'—'` para que el recuadro siempre sea visible

Las filas de la tabla tienen `cursor: pointer` y un `.pac-hint` debajo de los datos principales para indicar que son clickeables. La celda de acciones usa `e.stopPropagation()` para que Editar/Eliminar no abran el detalle.

### Patrón Master-Detail con PanelSimple
_Usado en: Consultorio, Especialidad, EventoClinico_

```jsx
<PanelSimple
  titulos={{ nuevo: 'Nuevo X', editar: 'Editar X', ver: 'Detalle' }}
  icono={<IconoX size={22} color="#1a3a5c" />}
  campos={[
    { name: 'campo1', label: 'Campo 1', placeholder: '...', requerido: true },
    { name: 'campo2', label: 'Campo 2', soloLectura: true },
  ]}
  item={seleccionado}
  modo={modo}
  onCancelar={cerrarPanel}
  onGuardar={handleGuardar}
  onEditar={() => setModo('editar')}
  onEliminar={handleEliminar}
  guardando={guardando}
/>
```

**Comportamiento responsivo del PanelSimple:**
- **Desktop** (`≥ 768px`): panel lateral de 340px con `box-shadow: 0 4px 24px rgba(0,0,0,0.08)`. Botón X cierra en el header.
- **Mobile** (`< 768px`): overlay pantalla completa (`position: fixed; inset: 0; z-index: 100`) con animación `slideInMobile` desde la derecha. El botón X se oculta y aparece un botón `← Volver` en la parte superior. El footer (Eliminar/Editar/Guardar) es `position: sticky; bottom: 0` con sombra superior.

**Ícono del panel (modo 'ver'):** contenedor `.panel-avatar` con `background: #e8f0fe`, `border-radius: 12px`, `padding: 12px`, `color: #1a3a5c`. El ícono pasado como prop `icono` usa `currentColor` para heredar el color.

**Protección contra pérdida de cambios — `NavigationGuardContext`:**
La protección está centralizada en `src/hooks/useNavigationGuard.js` y cubre tres casos:
1. **Cierre del panel** (X, Volver, Cancelar): `PanelSimple` llama `guardAction(onCancelar)`. Si hay cambios, muestra el ConfirmDialog global.
2. **Cambio de registro** (click en otra fila, botón editar, botón Nuevo): cada página envuelve esas acciones con `guardAction(() => ...)`.
3. **Navegación de módulo** (links del sidebar): Sidebar intercepta NavLink clicks y llama `guardAction(() => navigate(to))`.

`PanelSimple` sincroniza `isDirty` con el contexto vía `useEffect`. Al desmontarse, llama `markClean()` para limpiar el estado global.

El `ConfirmDialog` global está renderizado al final del JSX de `Layout.jsx` (se monta después del contenido, por lo que queda encima en el DOM). Acepta `confirmText="Continuar sin guardar"` / `cancelText="Seguir editando"`.

```js
// En cada página con PanelSimple:
const { guardAction } = useNavigationGuard()
// Row click:
onClick={() => guardAction(() => { setSeleccionado(c); setModo('ver') })}
// Botón Nuevo:
onClick={() => guardAction(() => { setSeleccionado(null); setModo('crear') })}
```

`ConfirmDialog` acepta `confirmText` y `cancelText` props (defaults: `'Eliminar'` / `'Cancelar'`) para ser reutilizado en distintos contextos.

**NavigationGuard en páginas jerárquicas (UbicacionesPage):**
Las páginas con edición inline (sin PanelSimple) sincronizan el estado global así:
```js
const { markDirty, markClean } = useNavigationGuard()
const anyEdit = editandoPais !== null || editandoDepto !== null || editandoCiud !== null ||
                agregandoPais || agregandoDepto || agregandoCiud
useEffect(() => { anyEdit ? markDirty() : markClean() }, [anyEdit, markDirty, markClean])
useEffect(() => () => markClean(), [markClean])  // cleanup al desmontar
```
Esto protege la navegación por el sidebar (escenario 3). Para la protección dentro de la misma columna (cambio de ítem editado sin guardar), cada instancia de `TablaUbicacion` usa un ConfirmDialog **local** con su propio estado `confirmDescartar`:
```js
const [confirmDescartar, setConfirmDescartar] = useState(null)
// Al iniciar edición de otro ítem:
const handleIniciarEdicion = (itemId) => {
  if (editandoId !== null && editandoId !== itemId)
    setConfirmDescartar({ fn: () => setEditandoId(itemId) })
  else setEditandoId(itemId)
}
```
Esto evita que múltiples instancias llamen a `markDirty/markClean` de forma conflictiva.

**NavigationGuard en páginas con Modal (PacientePage, PacienteResponsablePage, PersonaRRHHPage):**
Las páginas que usan Modal (no PanelSimple) aplican el guard en dos niveles:
- **La página** importa `guardAction` y envuelve todas las acciones que abren/cambian el modal: Ver detalle, Editar, Nuevo, Cerrar, Cancelar, e Insert.
- **El orquestador de formulario** (`PacienteForm`, `ResponsableForm`, `PersonaRRHHForm`) llama `markDirty()` cuando el usuario elige un registro y `markClean()` al guardar exitosamente o al desmontar.
- El diálogo "Descartar cambios" solo aparece cuando `isDirty = true` (el usuario realmente empezó a completar datos).
- **Nunca usar** `confirmDescartar` local + `ConfirmDialog` manual en estas páginas — delegar todo al guard global.

```js
// En la página:
const { guardAction } = useNavigationGuard()
const handleNuevo      = () => guardAction(() => { setSel(null); setModo('crear') })
const handleClose      = () => guardAction(() => cerrarModal())
// En el orquestador de formulario:
const { markDirty, markClean } = useNavigationGuard()
useEffect(() => { if (resultado) markDirty() }, [resultado])
useEffect(() => () => markClean(), [markClean])  // cleanup + revocar previews
// Antes de onSuccess():
markClean()
onSuccess()
```

**Visibilidad del botón Eliminar según rol:**
`PanelSimple` acepta la prop `ocultarEliminar={bool}`. Cuando es `true`, el botón "Eliminar" del footer del panel no se renderiza. La página también oculta el ícono de papelera en la fila de la tabla. Usar `useAuth()` para obtener `user.rol` y calcular `puedeEliminar`:
```jsx
const { user } = useAuth()
const puedeEliminar = user?.rol === 'admin'
// En tabla: {puedeEliminar && <button ...><Trash2 /></button>}
// En PanelSimple: ocultarEliminar={!puedeEliminar}
```
Aplicado en: `ConsultorioPage`, `EspecialidadPage`, `EventoClinicoPage`, `TipoDocDigPage` (destroy = solo admin).

**Atajos de teclado en el patrón Master-Detail:**
- `F10` — registrado **dentro de PanelSimple**: guarda cuando el modo es 'editar' o 'crear', el formulario es válido y no está guardando. `soloFueraDeInputs: false` (funciona desde cualquier campo).
- `Insert` — registrado **en cada página**: abre el panel en modo 'crear' solo cuando no hay panel abierto (`modo === null`). `soloFueraDeInputs: true` (default).

**Páginas jerárquicas excluidas de atajos de teclado:**
Las páginas con navegación en cascada (ej. `UbicacionesPage`) **no usan Insert ni F10**. La estructura jerárquica en sí define el flujo de interacción (seleccionar País → Departamento → Ciudad) y la edición es inline por fila. Registrar atajos en ese contexto crearía ambigüedad sobre en cuál de las tres columnas actuarían.

**Búsqueda con debounce:**
Las páginas con PanelSimple usan debounce de 300ms automático — sin botón "Buscar" ni estado `searchInput`. Patrón:
```js
const debounceRef = useRef(null)
const handleSearchChange = (e) => {
  const val = e.target.value
  clearTimeout(debounceRef.current)
  debounceRef.current = setTimeout(() => setSearch(val), 300)
}
// Input: onChange={handleSearchChange} — sin value (uncontrolled)
```

**Toolbar unificada:**
Header y barra de búsqueda se fusionan en una sola fila `.xxx-toolbar` con flex layout:
- `order: 1` — título + subtítulo (flex: 1, crece para llenar espacio)
- `order: 2` — input de búsqueda (flex: 1 1 200px, max 360px)
- `order: 3` — botón "Nuevo" (flex-shrink: 0)
- Mobile `< 600px`: búsqueda pasa a `order: 4` y ocupa 100% en segunda fila
- Usar `align-items: flex-start` — **nunca** `center`. Si la columna de acciones tiene hint text debajo del botón, su bloque es más alto que el input; `center` desalinearía el input hacia abajo.
- En mobile `≤ 600px`: ocultar el bloque de títulos con `display: none` si se superpone con la toolbar (ej: `.pac-titles`).

### Patrón Jerárquico en Cascada
_Usado en: UbicacionesPage (Países → Departamentos → Ciudades)_

Tres columnas sincronizadas donde seleccionar un ítem en la columna N filtra los datos de la columna N+1. Cada columna es un componente `TablaUbicacion` reutilizable.

**Estructura general de la página:**
```jsx
<div className="ub-columns">
  <TablaUbicacion titulo="Países" datos={paises} itemActivoId={paisActivo?.id}
    onSelect={setPaisActivo} onAgregar={...} onEditar={...} onEliminar={...}
    resetKey={0}  // nunca cambia — no tiene padre
  />
  <TablaUbicacion titulo="Departamentos" datos={departamentos} itemActivoId={deptoActivo?.id}
    onSelect={setDeptoActivo} ... resetKey={paisActivo?.id}
  />
  <TablaUbicacion titulo="Ciudades" datos={ciudades} itemActivoId={null}
    onSelect={() => {}} ... resetKey={deptoActivo?.id}
  />
</div>
```

**TablaUbicacion — comportamiento interno:**
- Edición inline por fila: `editandoId` determina qué fila muestra `FilaEditable` (input + botones Guardar/Cancelar)
- Al agregar: `agregando=true` muestra `FilaEditable` al final de la lista (sin id)
- Botones de acción (editar/eliminar) solo visibles en hover: CSS `.ub-item:hover .ub-item-actions { opacity: 1 }`
- Ítem activo: borde izquierdo brand (`border-left: 3px solid #1a3a5c`), fondo `#f0f5fb`
- Header de columna activa: `border-bottom: 2px solid #1a3a5c`
- Contador de ítems: badge-info en el header de cada columna

**Búsqueda local por columna:**
Se muestra solo cuando la columna tiene más de 5 ítems. Se limpia cuando cambia el padre (`resetKey`):
```js
const [busqueda, setBusqueda] = useState('')
useEffect(() => { setBusqueda('') }, [resetKey])
const datosFiltrados = busqueda
  ? datos.filter(d => d.nombre.toLowerCase().includes(busqueda.toLowerCase()))
  : datos
```

**Navegación mobile:**
`mobileLevel` (0/1/2) controla qué columna se muestra con la clase `.ub-col-visible`.
Un breadcrumb en la parte superior permite volver al nivel anterior. Seleccionar un ítem avanza al siguiente nivel.

**Sin atajos de teclado:** ver nota en la sección de atajos del patrón Master-Detail.

### Patrón Descarga PDF Autenticada
Cuando el endpoint de PDF usa `permission_classes=[IsAuthenticated]`, no se puede abrir con `window.open` directamente (el navegador no envía el header JWT). Usar `apiClient` con `responseType: 'blob'` y crear un object URL:

```js
const handleVerListado = async () => {
  setLoadingListado(true)
  try {
    const res = await apiClient.get('/paciente/reporte-lista/', { responseType: 'blob' })
    const url = URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }))
    window.open(url, '_blank')
  } catch {
    showToast('No se pudo generar el listado.', 'error')
  } finally {
    setLoadingListado(false)
  }
}
```

- El botón muestra "Generando..." y se deshabilita mientras espera (`disabled={loadingListado}`)
- Se ubica al final de la fila de búsqueda con `margin-left: auto` para alinearlo a la derecha

**Páginas con botones PDF + Excel en toolbar** (solo visibles para roles no restringidos):

| Página | Endpoint PDF | Endpoint Excel |
|---|---|---|
| `PersonaRRHHPage` | `/api/personarrhh/reporte-lista/` | `/api/personarrhh/reporte-lista-excel/` |
| `HorarioPrestadorPage` | `/api/horario-prestador/reporte-horarios/` | `/api/horario-prestador/reporte-horarios-excel/` |
| `InformesPacientePage` | `/api/paciente/reporte-lista/` | `/api/paciente/reporte-lista-excel/` |

### Patrón Descarga Excel Autenticada
Igual que el PDF pero con `responseType: 'blob'` y descarga forzada vía elemento `<a>`:

```js
const res = await apiClient.get(url, { responseType: 'blob' })
const obj = URL.createObjectURL(new Blob([res.data], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
const link = document.createElement('a')
link.href     = obj
link.download = `nombre_archivo_${fecha}.xlsx`
link.click()
URL.revokeObjectURL(obj)
```

### Patrón Visualización de documento autenticado (Eye + overlay)
Para visualizar documentos protegidos por JWT, usar `fetch` nativo (no Axios) para obtener correctamente el `content-type` del blob, luego decidir según la extensión del archivo:
- **Imagen** (jpg, jpeg, png, gif, webp, bmp): mostrar overlay pantalla completa (z-index 9999, fondo oscuro). Click en el fondo o en ✕ cierra el overlay.
- **PDF y otros**: `window.open(url, '_blank')`.

```js
const EXTENSIONES_IMAGEN = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp']

async function fetchDocumentoBlob(docId) {
  const token = localStorage.getItem('access_token')
  const res = await fetch(`/api/documentos/${docId}/descargar/`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) throw new Error('No se pudo obtener el documento.')
  const contentType = res.headers.get('content-type') || 'application/octet-stream'
  const buffer = await res.arrayBuffer()
  return new Blob([buffer], { type: contentType })
}

// En el componente:
const [abriendoDoc,   setAbriendoDoc]   = useState(null)
const [imagenPreview, setImagenPreview] = useState(null)

const handleVerDoc = async (doc) => {
  setAbriendoDoc(doc.id)
  try {
    const blob = await fetchDocumentoBlob(doc.id)
    const url  = URL.createObjectURL(blob)
    const ext  = (doc.filename || '').split('.').pop().toLowerCase()
    if (EXTENSIONES_IMAGEN.includes(ext)) setImagenPreview({ url, filename: doc.filename })
    else window.open(url, '_blank')
  } catch { /* silencioso */ }
  finally { setAbriendoDoc(null) }
}
```

- Icono del botón: `<Eye size={14} />` (Lucide) — **nunca** `Download` para visualización
- `abriendoDoc` deshabilita el botón mientras carga y muestra `'…'` en su lugar
- Endpoint pacientes: `/api/documentos/{id}/descargar/`; prestadores: `/api/documentos-prestador/{id}/descargar/`
- Aplicado en: `PacientePage` (tab Documentos + timeline consultas), `PersonaRRHHPage` (tab Documentos del detalle), `PersonaRRHHForm` (sección Documentos en formulario de edición)

### Patrón Documentos staged (archivosNuevos + idsAEliminar)
Los orquestadores de formulario que incluyen sección de documentos no ejecutan las operaciones de archivo inmediatamente — el estado staged se resuelve al hacer "Guardar":

- `archivosNuevos` (array `{ uid, file, tipoDocDig, preview? }`) — archivos pendientes de subir
- `idsAEliminar` (Set) — IDs de documentos existentes a eliminar
- `errorSub` (string) — error de validación de tipo de archivo
- En `handleGuardar`: primero guardar la entidad principal, luego eliminar los IDs marcados, luego subir los nuevos
- Validación pre-save: si algún archivo nuevo no tiene `tipoDocDig` asignado → setear `errorSub` y hacer `return`
- Imágenes nuevas: `preview = URL.createObjectURL(file)` para mostrar thumbnail; liberar con `URL.revokeObjectURL` al quitar o en el cleanup del `useEffect` de desmontaje
- Docs existentes marcados: tachado + badge "Se eliminará al guardar" + botón ↩ para deshacer (toggle del Set)
- Docs nuevos: badge "Se subirá al guardar"

**Vista detalle (read-only) vs formulario de edición:**
La pestaña "Documentos" en la vista de detalle del prestador (`SeccionDocumentos` en `PersonaRRHHPage`) es **solo lectura**: muestra Eye + nombre + tipo. Upload y delete se gestionan exclusivamente desde el formulario de edición (`PersonaRRHHForm`). Esto evita tener dos vías de mutación concurrentes.

Aplicado en: `PacienteForm` (pacientes), `PersonaRRHHForm` (prestadores — solo modo `'editar'`).

### Patrón Selector con creación inline (SelectorEspecialidades)
Cuando el usuario tipea en el buscador de especialidades, si el texto no tiene coincidencia (o aunque la tenga), aparece al final del dropdown la opción `+ Crear "[texto]"`. Al seleccionarla:
1. Se llama `crear.mutateAsync({ descripcion: texto })` del hook `useEspecialidadMutations`
2. La nueva especialidad queda auto-seleccionada como tag
3. React Query invalida el caché `['especialidades']`

Reglas clave:
- La opción Crear solo aparece cuando `busqueda.trim().length > 0`
- La navegación por teclado (↑/↓) extiende `focusIdx` hasta `opciones.length` para alcanzar el ítem Crear
- CSS clase `.se-dropdown-crear` — borde separador superior, fondo `#eff6ff` en hover/focus
- El hint debajo del selector indica: _"Escribí para buscar · si no existe, aparece la opción de crear"_
- Aplicado en: `FormRRHH.jsx` — campo Especialidades del sub-formulario de prestador

### Patrón Dashboard — página completa con carga automática
Los dashboards son **páginas independientes** (no modales). La card en Informes navega directamente con `useNavigate`:

```js
onClick={() => navigate('/informes/dashboard/pacientes')}
```

La página de dashboard carga sus datos en `useEffect` con dependencias vacías (carga al montar):

```js
useEffect(() => {
  async function cargar() {
    setLoading(true)
    try {
      const res = await apiClient.get('/paciente/dashboard-mensual/')
      setData(res.data)
    } catch {
      showToast('No se pudieron cargar las estadísticas.', 'error')
    } finally {
      setLoading(false)
    }
  }
  cargar()
}, [])
```

- Incluye un botón "Volver" con `useNavigate` hacia la página de Informes
- El estado de carga muestra un texto centrado "Cargando estadísticas…"
- Ventaja: puede configurarse como pantalla de inicio del sistema (ruta propia)

### Patrón Confirm-Delete Inline (dentro de Modal)
Cuando la eliminación ocurre dentro de un formulario ya montado en un `Modal`, usar `ConfirmDialog` puede causar problemas de z-index. Usar estado local inline:
- `confirmDelete` (state) — ID del item pendiente; `null` = sin confirmación activa
- `eliminando` (state) — ID del item en proceso de borrado (para deshabilitar el botón Sí)
- En el render: si `confirmDelete === item.id`, sustituir las acciones normales por una fila "¿Eliminar? Sí / No"

```jsx
{confirmDelete === doc.id ? (
  <div className="pf-doc-confirm">
    <span className="pf-doc-confirm-txt">¿Eliminar?</span>
    <button className="pf-doc-confirm-si" onClick={() => handleEliminar(doc.id)}
      disabled={eliminando === doc.id}>
      {eliminando === doc.id ? '...' : 'Sí'}
    </button>
    <button className="pf-doc-confirm-no" onClick={() => setConfirmDelete(null)}>No</button>
  </div>
) : (
  <button onClick={() => setConfirmDelete(doc.id)}>Eliminar</button>
)}
```

Aplicado en: `PacienteForm` — sección de documentos digitalizados.

### Patrón Validación de campos obligatorios antes de acción crítica
Para formularios donde ciertos campos deben completarse antes de una acción destructiva o irreversible (ej: finalizar consulta):

- Constante de módulo `CAMPOS_REQ_X = [{ key, label }, ...]` definida fuera del componente
- Estado `intentoAccion` (bool) — se setea `true` al primer intento fallido; se resetea al cambiar el registro (en `useEffect([item.id])`)
- Al intentar la acción: `setIntentoAccion(true)`, filtrar faltantes, mostrar toast, retornar si hay faltantes
- Pasar `invalido={intentoAccion && !form.campo?.trim()}` a cada campo requerido
- CSS: `.cs-input-invalido { border-color: #dc2626 !important; background: #fff5f5; }` y `.cs-label-req::after { content: ' *'; color: #dc2626; font-weight: 700; }`
- `ConfirmDialog` para acción crítica debe incluir `confirmText` explícito (nunca depender del default "Eliminar")

Aplicado en: `ConsultasPage` — `handleClickFinalizar` con `CAMPOS_REQ_CONSULTA` (motivo, diagnóstico, tratamiento, indicaciones). Opcionales: `proxima_cita` y carga de documentos.

### Patrón Gráficos CSS/SVG (sin librería externa)
Usados en `InformesPacientePage`:

| Componente | Técnica |
|---|---|
| Barras horizontales | `div` con `width: X%` y `transition: width .5s ease` |
| Barras verticales (calendario) | `flexbox` column, `height: X%` sobre track con `display: flex; align-items: flex-end` |
| Donut por sexo | `conic-gradient` CSS calculado desde porcentajes acumulados |
| Curva de tendencia | SVG `<path>` con bezier cúbico (`C`) + área rellena + `<text>` para valores |

El toggle Día/Semana/Mes del calendario es estado local del componente (`useState`) — no sube al padre.

### Patrón Secciones en página de Informes
`InformesPacientePage` usa dos secciones visuales separadas bajo el mismo header:
- **Listados** — cards que generan documentos (PDF, Excel) con filtros
- **Dashboards** — cards que abren vistas analíticas sin filtros del usuario

Cada sección tiene un `inf-pac-section-label` (texto uppercase gris con borde inferior) como separador visual.

### Patrón Modal de Contraseña — Indicador de fuerza + confirmación
Todos los modales que permiten ingresar una contraseña nueva deben incluir:
1. **Campo contraseña** con botón ojo (show/hide) + indicador de fuerza debajo
2. **Campo confirmar contraseña** con botón ojo independiente + advertencia de no coincidencia en tiempo real
3. Validación en `submit`: si no coinciden, setear error y hacer `return` sin llamar a la API

Funciones de apoyo (definir en el componente o su archivo):
```js
function calcularFuerza(pwd) {
  if (!pwd) return null
  if (pwd.length < 8) return { label: 'Débil', color: '#dc2626', pct: 25 }
  const tipos = [/[a-z]/, /[A-Z]/, /[0-9]/, /[^a-zA-Z0-9]/].filter(r => r.test(pwd)).length
  if (tipos >= 3 && pwd.length >= 10) return { label: 'Fuerte', color: '#16a34a', pct: 100 }
  if (tipos >= 2) return { label: 'Media', color: '#d97706', pct: 60 }
  return { label: 'Débil', color: '#dc2626', pct: 30 }
}
```

Aplicado en: `UsuariosPage` (crear + resetear password), `Sidebar` (cambiar propia contraseña).

### Patrón Cambiar Contraseña desde Sidebar
`ModalCambiarPassword` vive en `Sidebar.jsx` (no en `UsuariosPage`). Es el único lugar
donde cualquier rol autenticado puede cambiar su propia contraseña. El modal se abre
desde el dropdown del perfil (click en el nombre de usuario en el sidebar). El hook
`useCambiarPassword` (de `useUsuarios.js`) es el que realiza el POST.

### Patrón Buscador — Flujo por documento
| Modo | Condición |
|---|---|
| `crear_todo` | La persona no existe — se crea Persona + entidad |
| `agregar_paciente` | La persona existe pero no tiene la entidad |
| `editar` | Ya existe como entidad — se editan ambos registros |

### Patrón Cascada — Selects dependientes
- Al cambiar País → resetea departamento y ciudad
- Al cambiar Departamento → resetea ciudad
- `useDepartamentos(paisId)` y `useCiudades(departamentoId)` solo hacen fetch con ID válido

---

## Estilos Visuales

### Tokens de color
| Token | Valor | Uso |
|---|---|---|
| Brand primario | `#1a3a5c` | Sidebar, botones primarios, títulos |
| Brand hover | `#15304d` | Hover botones primarios |
| Fondo app | `#f0f4f8` | Background general |
| Thead / surface | `#f8fafc` | Header de tablas |
| Card border | `#e8edf2` | Borde de tarjetas y modales |
| Input border | `#e5e7eb` | Borde de inputs |
| Texto principal | `#111827` | Nombres, valores importantes |
| Texto secundario | `#374151` | Celdas de tabla |
| Texto muted | `#6b7280` | Subtítulos, íconos |
| Rojo error | `#dc2626` | Errores, hover eliminar |
| Verde conectado | `#22c55e` | Dot "Conectado" en navbar |

### Tipografía
| Fuente | Uso |
|---|---|
| `DM Sans` (300, 400, 500, 600) | Texto general, formularios, botones, tablas |
| `DM Serif Display` | Título login, logo del Sidebar |
| `Courier New` | Valores técnicos, storage_key, rutas |

### Clases globales (Layout.jsx)
Disponibles en todas las páginas sin redefinir:

`.btn` `.btn-primary` `.btn-secondary` `.btn-danger`
`.badge` `.badge-success` `.badge-warning` `.badge-danger` `.badge-info` `.badge-gray`
`.card` `.card-sm` `.input` `.form-label` `.form-group`
`.page-header` `.page-title` `.page-subtitle`
`.table-wrapper` `.stats-grid` `.stat-card` `.stat-label` `.stat-value`

### Prefijos CSS por componente
Cada componente define su CSS con `<style>` inline. Prefijos únicos para evitar colisiones.

| Prefijo | Componente |
|---|---|
| `.modal-` | `components/ui/Modal.jsx` |
| `.panel-` | `components/ui/PanelSimple.jsx` |
| `.toast-` | `components/ui/Toast.jsx` |
| `.cd-` | `components/ui/ConfirmDialog.jsx` |
| `.bp-` | `components/persona/BuscadorPersona.jsx` |
| `.fp-` | `components/persona/FormPersona.jsx` |
| `.pf-` | `components/paciente/PacienteForm.jsx` |
| `.fpa-` | `components/paciente/FormPaciente.jsx` |
| `.rf-` | `components/responsable/ResponsableForm.jsx` |
| `.fr-` | `components/responsable/FormResponsable.jsx` |
| `.prf-` | `components/rrhh/PersonaRRHHForm.jsx` (orquestador) — incluye `.prf-doc-*` (staged documents), `.prf-img-*` (overlay imagen), `.prf-dropzone*` |
| `.frrhh-` | `components/rrhh/FormRRHH.jsx` (sub-formulario) — incluye `.se-*` (SelectorEspecialidades con creación inline) |
| `.sb-` | `components/layout/Sidebar.jsx` |
| `.nb-` | `components/layout/Navbar.jsx` — incluye `.nb-drop-*` (dropdown de recordatorios) |
| `.login-` | `pages/Login.jsx` |
| `.usu-` | `pages/administracion/UsuariosPage.jsx` |
| `.rrhh-` | `pages/administracion/PersonaRRHHPage.jsx` |
| `.aud-` | `pages/administracion/AuditoriaPage.jsx` |
| `.ub-` | `pages/mantenimiento/UbicacionesPage.jsx` |
| `.ec-` | `pages/mantenimiento/EventoClinicoPage.jsx` |
| `.tdd-` | `pages/mantenimiento/TipoDocDigPage.jsx` |
| `.dd-` | `pages/mantenimiento/DocumentosPage.jsx` |
| `.con-` | `pages/clinica/configuracion/ConsultorioPage.jsx` |
| `.esp-` | `pages/clinica/configuracion/EspecialidadPage.jsx` |
| `.hp-`      | `pages/clinica/configuracion/HorarioPrestadorPage.jsx` |
| `.pac-` | `pages/clinica/PacientePage.jsx` |
| `.inf-pac-` | `pages/clinica/InformesPacientePage.jsx` |
| `.dash-pac-` | `pages/clinica/DashboardPacientesPage.jsx` |
| `.pr-` | `pages/clinica/PacienteResponsablePage.jsx` |
| `.ag-` | `pages/clinica/AgendaPage.jsx` — incluye `.ag-cal-dots/.ag-cal-dot` (puntos médico en calendario), `.ag-cal-conteo-ocup/.ag-cal-conteo-libre` (conteo naranja/verde por celda en vista global), `.ag-turno-glob*` (filas de vista global del panel sin médico seleccionado), `.ag-reagendar-*` (reagendado inline), modales Generar y Gestionar con búsqueda typeahead. **Dos paletas de color:** `COLORES_MEDICO` (10 pasteles, bg/text/borde) para avatares — `colorMedico(id)`; `COLORES_DOT` (6 vívidos) para identidad visual: dots del calendario, borde de avatar en lista, barra lateral en `.ag-turno-glob` — `colorDot(id)`. `colorEstado('realizado')` usa paleta violeta (`#7c3aed`) igual al contador de stats. `useAgendaDiaGlobal` se activa cuando no hay médico seleccionado (sin importar el modo de filtro). **Modal Gestionar:** filtro opcional de hora (`gestHoraDesde`/`gestHoraHasta`); preview filtra client-side con `.slice(0,5)` para normalizar `"HH:MM:SS"` → `"HH:MM"`; resultado muestra `cancelados` + lista `no_cancelados` (ocupados/realizados). **Búsqueda de paciente:** `.ag-pac-item-focus` marca el ítem activo; navegación ↑/↓/Enter/Escape via `onKeyDown` + `pacResultsRef` para `scrollIntoView`; `pacFocusIdx` se resetea a `-1` al escribir. **Inputs de fecha:** todos con `max="2099-12-31"`. |
| `.cs-` | `pages/clinica/ConsultasPage.jsx` — `esRestringido = esMedico \|\| esSecretaria`: roles no-admin van directo a su vista sin tabs; `listaVisible` filtra `turno.estado !== 'realizado' && consulta?.estado !== 'finalizada'` para `esRestringido`; `SelectorFecha` y tabs solo visibles para admin; `formPayload()` convierte `proxima_cita: ""` → `null`; `ModalHistoriaClinica` filtra por `medicoNombre` + `especialidadFiltro`; validación con `CAMPOS_REQ_CONSULTA` + estado `intentoFinalizar`; mobile fullscreen activo con clase `cs-detalle-activa` (`position: fixed; inset:0; z-index:40`) |
| `.rec-` | `pages/clinica/RecordatoriosPage.jsx` |
| `.fac-` | `pages/facturacion/FacturacionPage.jsx` |
| `.tim-` | `pages/facturacion/TimbradoPage.jsx` |
| `.grp-` | `pages/stock/GruposPage.jsx` |
| `.cta-` | `pages/finanzas/CuentasMcbPage.jsx` |
| `.cob-` | `pages/finanzas/CobranzasPage.jsx` |
| `.pp-` | `pages/finanzas/PagoPrestadorPage.jsx` |

> **Al crear módulos nuevos:** asignar prefijo propio y registrarlo en esta tabla.

---

## Hooks — Referencia Completa

### Hooks raíz (`hooks/`)
| Hook | Responsabilidad |
|---|---|
| `useToast` | Estado de notificación — retorna `{ toast, showToast }` |
| `useAtajosTeclado` | Registra atajos de teclado mientras el componente está montado |

### Convención — `useAtajosTeclado`
Registrar en cada página o formulario que necesite atajos. El hook se desmonta con el componente, por lo que los atajos solo están activos cuando el componente está montado.

```js
import { useAtajosTeclado } from '../../hooks/useAtajosTeclado'

useAtajosTeclado({
  'Insert': { fn: () => { if (modo === null) handleNuevo() } },  // soloFueraDeInputs: true (default)
  'F10':    { fn: () => { if (resultado && !guardando) handleGuardar() }, soloFueraDeInputs: false },
})
```

**Parámetros por atajo:**
| Parámetro | Default | Descripción |
|---|---|---|
| `fn` | — | Función a ejecutar |
| `soloFueraDeInputs` | `true` | Si `true`, no dispara cuando el foco está en INPUT / TEXTAREA / SELECT |

**Atajos estándar:**
- `Insert` → abrir modal "Nuevo" (solo cuando no hay modal abierto) — `soloFueraDeInputs: true`
- `F10` → guardar formulario activo — `soloFueraDeInputs: false` (funciona desde cualquier campo)

Aplicado en: `PacientePage` (Insert), `PacienteForm` (F10), `PacienteResponsablePage` (Insert), `ResponsableForm` (F10), `PersonaRRHHPage` (Insert), `PersonaRRHHForm` (F10), `HorarioPrestadorPage` (F10 — guarda cuando el panel está en modo editar/crear), `AgendaPage` (F2 — abre modal de generar turnos cuando no hay modal abierto y el rol puede modificar), `ConsultorioPage` (Insert), `EspecialidadPage` (Insert), `EventoClinicoPage` (Insert), `TipoDocDigPage` (Insert), `PanelSimple` (F10 — guarda cuando el modo es editar/crear y el formulario es válido).

**F10 en orquestadores de formulario:** `PacienteForm`, `ResponsableForm`, `PersonaRRHHForm` registran F10 internamente porque son componentes montados dentro de un Modal — cuando el modal está abierto, el atajo de la página queda tapado y el del formulario toma el control.

**No aplica en:** `UbicacionesPage` — la navegación jerárquica en cascada no usa Insert ni F10. Ver sección "Patrón Jerárquico en Cascada".

### administracion/
| Hook | Responsabilidad |
|---|---|
| `useTipoDocumento` | GET tipos de documento (staleTime 30 min) |
| `useCreatePersona` | POST `/api/persona/` |
| `useUpdatePersona` | PATCH `/api/persona/{id}/` |
| `useUsuarios` | GET lista con filtros `search`, `rol`, `activo` |
| `useCreateUsuario` | POST `/api/usuarios/` |
| `useUpdateUsuario` | PATCH `/api/usuarios/{id}/` |
| `useCambiarEstadoUsuario` | POST `/api/usuarios/{id}/cambiar-estado/` |
| `useResetearPassword` | POST `/api/usuarios/{id}/resetear-password/` |
| `useCambiarPassword` | POST `/api/usuarios/cambiar-password/` — importado también por `Sidebar.jsx` |
| `usePersonasRRHH` | Lista paginada con búsqueda |
| `useCreatePersonaRRHH` | POST `/api/personarrhh/` |
| `useUpdatePersonaRRHH` | PATCH `/api/personarrhh/{id}/` |
| `usePersonaRRHHMutations(showToast)` | DELETE `/api/personarrhh/{id}/` — maneja toast internamente |
| `useAuditoria` | ❌ pendiente de crear |

### mantenimiento/
| Hook | Responsabilidad |
|---|---|
| `usePaises` | GET lista de países (staleTime 30 min) |
| `useDepartamentos(paisId)` | GET departamentos por país |
| `useCiudades(departamentoId)` | GET ciudades por departamento |
| `useUbicacionMutations(showToast)` | POST / PATCH / DELETE para País, Departamento y Ciudad |
| `useTiposDocDig` | GET lista con búsqueda |
| `useTipoDocDigMutations(showToast)` | POST / PATCH / DELETE `/api/tipo-doc-dig/` |
| `useEventosClinicos` | GET lista con búsqueda |
| `useEventoClinicoMutations` | POST / PATCH / DELETE `/api/eventoclinico/` |
| `useDocumentosPorConsulta` | GET `/api/documentos/?consulta=id` — llamar siempre (regla de hooks), pero renderizar solo si `expandido && docs.length > 0` (ej: `TimelineItem` en PacientePage) |
| `useDocumentosPorPaciente` | GET `/api/documentos/?paciente=id` — filtrar con `d => !d.consulta` para mostrar solo docs subidos directamente a la ficha, excluyendo los vinculados a consultas |
| `usePacientesConDocumentos` | GET `/api/documentos/pacientes/?search=` |
| `useSubirDocumento` | POST multipart/form-data a `/api/documentos/` — usa `fetch` nativo (no Axios) |
| `useDeleteDocumento` | DELETE `/api/documentos/{id}/` |
| `useDocumentosPorPrestador` | GET `/api/documentos-prestador/?persona_rrhh=id` — usado en `PersonaRRHHPage` (detalle read-only) y `PersonaRRHHForm` (staged edit) |
| `useSubirDocumentoPrestador` | POST multipart/form-data a `/api/documentos-prestador/` — usa `fetch` nativo (no Axios); usado en `PersonaRRHHForm.handleGuardar` |
| `useDeleteDocumentoPrestador` | DELETE `/api/documentos-prestador/{id}/` — usado en `PersonaRRHHForm.handleGuardar` |
| `useProximasCitas` | GET `/api/recordatorios/proximas-citas/` |
| `useStatsRecordatorios` | GET `/api/recordatorios/stats/` |
| `useNotificar` | POST `/api/recordatorios/notificar/` |
| `useHistorialNotificaciones` | GET `/api/notificaciones/?paciente=id` |

### clinica/
| Hook | Responsabilidad |
|---|---|
| `usePatients` | Lista paginada con búsqueda |
| `useCreatePatient` | POST `/api/paciente/` |
| `useUpdatePatient` | PATCH `/api/paciente/{id}/` |
| `usePacienteMutations(showToast)` | DELETE `/api/paciente/{id}/` — maneja toast internamente |
| `useResponsables` | Lista paginada con búsqueda |
| `useCreateResponsable` | POST `/api/pacienteresponsable/` |
| `useUpdateResponsable` | PATCH `/api/pacienteresponsable/{id}/` |
| `useResponsableMutations(showToast)` | DELETE `/api/pacienteresponsable/{id}/` — maneja toast internamente |
| `useConsultorios` | GET lista con búsqueda |
| `useConsultorioMutations` | POST / PATCH / DELETE `/api/consultorio/` |
| `useEspecialidades` | GET lista (page_size=200, staleTime 5 min) |
| `useEspecialidadMutations` | POST / PATCH / DELETE `/api/especialidad/` |
| `useHorariosPrestador` | GET filtrado por persona_rrhh y/o estado — en `hooks/clinica/useHorarioPrestador.js` |
| `useCreateHorario` | POST `/api/horario-prestador/` |
| `useUpdateHorario` | PATCH `/api/horario-prestador/{id}/` |
| `useDeleteHorario` | DELETE `/api/horario-prestador/{id}/` |
| `useGenerarTurnos` | POST `/api/horario-prestador/{id}/generar/` |
| `useResumenMes` | GET `/api/agenda/resumen-mes/` |
| `useAgendaDia` | GET `/api/agenda/` filtrado por persona_rrhh + fecha |
| `useAgendaMes` | GET `/api/agenda/` filtrado por rango del mes |
| `useAgendaDiaGlobal` | GET `/api/agenda/` filtrado solo por fecha — se llama con `!medicoSel ? fechaSel : null` (activo en cualquier modo cuando no hay médico seleccionado) |
| `useAgendaRango` | GET `/api/agenda/` filtrado por persona_rrhh + fecha_desde + fecha_hasta (page_size 500) |
| `useStatsHoy` | GET `/api/agenda/stats-hoy/` (staleTime 1 min) |
| `useAsignarTurno` | PATCH `/api/agenda/{id}/asignar/` |
| `useCambiarEstado` | PATCH `/api/agenda/{id}/estado/` |
| `useReagendar` | PATCH `/api/agenda/{id}/reagendar/` — mueve paciente a otro turno disponible del mismo prestador |
| `useCancelarRango` | POST `/api/agenda/cancelar-rango/` — cancela disponibles en rango; acepta `hora_desde?` y `hora_hasta?` opcionales; retorna `{cancelados, no_cancelados[]}` |
| `usePacienteSearch(q)` | GET `/api/paciente/?search=q` con debounce 300ms — búsqueda rápida para asignar turno |
| `useConsultasDelDia` | GET `/api/consultas/?persona_rrhh=&fecha=` |
| `useConsultasPaciente` | GET `/api/consultas/?paciente=id` |
| `useConsultaDetalle` | GET `/api/consultas/{id}/` |
| `useIniciarConsulta` | POST `/api/consultas/{id}/iniciar/` |
| `useFinalizarConsulta` | POST `/api/consultas/{id}/finalizar/` |
| `useUpdateConsulta` | PATCH `/api/consultas/{id}/` |
| `useCrearConsulta` | POST `/api/consultas/` |
| `useStatsConsultasHoy` | GET `/api/consultas/stats-hoy/` |
| `useConsultasHoy(fecha?)` | GET consultas del día para vista recepcionista — `fecha` opcional (default: hoy); `refetchInterval: 60s` |

### facturacion/
| Hook | Responsabilidad |
|---|---|
| `useFacturas` | GET lista con filtros |
| `useFacturaDetalle` | GET `/api/facturacion/{id}/` |
| `useCreateFactura` | POST — transacción atómica |
| `useUpdateFactura` | PATCH — solo fecha, persona, observacion |
| `useDeleteFactura` | DELETE — borrado lógico + cascada |
| `useValidarTimbrado` | POST `/api/facturacion/validar-timbrado/` |
| `useSiguienteNumero` | GET `/api/facturacion/siguiente-numero/` |
| `useFormaPago` | GET `/api/forma-pago/` (staleTime 30 min) |
| `useBuscarPersonas` | GET búsqueda con ≥ 2 chars (page_size=8) |
| `useBuscarProductos` | GET búsqueda con ≥ 2 chars (page_size=10) |
| `useTimbrados` | GET con filtros `search` y `vigente` |
| `useCreateTimbrado` | POST `/api/timbrado/` |
| `useUpdateTimbrado` | PATCH `/api/timbrado/{id}/` |
| `useDeleteTimbrado` | DELETE `/api/timbrado/{id}/` |

### stock/
| Hook | Responsabilidad |
|---|---|
| `useGrupos` | GET lista con filtros `search` y `activo` |
| `useCreateGrupo` | POST `/api/grupos/` |
| `useUpdateGrupo` | PATCH `/api/grupos/{id}/` |
| `useDeleteGrupo` | DELETE `/api/grupos/{id}/` |
| `useProductos` | GET `/api/productos/?grupo=id` |
| `useCreateProducto` | POST `/api/productos/` |
| `useUpdateProducto` | PATCH `/api/productos/{id}/` |
| `useDeleteProducto` | DELETE `/api/productos/{id}/` |

### finanzas/
| Hook | Responsabilidad |
|---|---|
| `useCuentasMcb` | GET lista con filtro `search` |
| `useCreateCuenta` | POST `/api/cuentas-mcb/` |
| `useUpdateCuenta` | PATCH `/api/cuentas-mcb/{id}/` |
| `useDeleteCuenta` | DELETE `/api/cuentas-mcb/{id}/` |
| `useMovimientos` | GET con filtros tipo, fecha, search |
| `useCreateMovimiento` | POST `/api/movimientos-caja/` |
| `useUpdateMovimiento` | PATCH `/api/movimientos-caja/{id}/` |
| `useDeleteMovimiento` | DELETE `/api/movimientos-caja/{id}/` |
| `useCobranzas` | GET lista con filtros |
| `useCobranzaDetalle` | GET `/api/cobranzas/{id}/` |
| `useCreateCobranza` | POST — transacción atómica |
| `useDeleteCobranza` | DELETE — borrado lógico |
| `useSiguienteNumeroCob` | GET `/api/cobranzas/siguiente-numero/` (staleTime 0) |
| `useCuotasPendientes` | GET `/api/cobranzas/cuotas-pendientes/?persona=id` |
| `usePagosPrestador` | GET lista con filtros |
| `usePagoPrestadorDetalle` | GET `/api/pago-prestador/{id}/` |
| `useCreatePagoPrestador` | POST — transacción atómica |
| `useDeletePagoPrestador` | DELETE — revierte `pagado_prestador` en Agenda |
| `useSiguienteNumeroPago` | GET `/api/pago-prestador/siguiente-numero/` |
| `useBloquesPendientes` | GET `/api/pago-prestador/bloques-pendientes/` |

---

## Checklist de Auditoría — Por Página

> **Importante:** la auditoría de frontend es parte del mismo paso que la del backend.
> Al auditar un módulo backend, aplicar este checklist a su página correspondiente en el mismo momento — no dejarlo para después.

Al auditar cada página aplicar **todos** estos puntos sin excepción:

### Eliminación
- [ ] `window.confirm` reemplazado por `ConfirmDialog`
- [ ] `ConfirmDialog` recibe `loading={eliminar.isPending}` para bloquear el botón mientras se procesa
- [ ] El mensaje `description` del `ConfirmDialog` menciona restricciones del backend si las hay (ej: "Si tiene registros vinculados no se podrá eliminar")
- [ ] `onSuccess` del `eliminar.mutate` llama a `cerrarPanel()` además del `showToast`

### Manejo de errores
- [ ] `extraerMensajeError` importada desde `../utils/errores` — **nunca** definida inline en la página
- [ ] Todos los `catch` y `onError` usan `extraerMensajeError(err)`

### Botones de acción en tabla (Editar / Eliminar)
- [ ] Usan clases CSS (`.xxx-action-btn.edit` y `.xxx-action-btn.trash`) — **nunca** `onMouseEnter/Leave` inline
- [ ] El CSS de hover está en el bloque `<style>` del componente con las clases correspondientes

### Comentarios
- [ ] Sin comentarios que describen el qué (`// Barra de búsqueda`, `// Encabezado de la página`, etc.)
- [ ] Solo comentarios que explican el por qué cuando no es obvio

### Imports y estructura
- [ ] Imports ordenados: React → componentes UI → hooks → utils
- [ ] Constantes (`CAMPOS_X`, `TITULOS_PANEL`) definidas fuera del componente
- [ ] Estado de confirmación (`confirmId`) presente cuando hay eliminación

### Páginas con Modal (modo ver/editar/crear)
- [ ] `modo` state en lugar de booleano `modalOpen` — `isOpen={modo !== null}`
- [ ] Click en fila llama `handleVerDetalle(item)` — `e.stopPropagation()` en celda de acciones
- [ ] `.xxx-hint` debajo de los datos de cada fila para indicar que son clickeables
- [ ] Componente de detalle inline con helpers `Seccion`, `Campo`, `CampoDestacado`
- [ ] `CampoDestacado variante="amarillo"` para alergias, `variante="rojo"` para enfermedades crónicas

---

## Deuda Técnica Pendiente

| # | Archivo | Descripción |
|---|---|---|
| 1 | `api/axiosConfig.js` | Cliente huérfano — eliminar |
| 2 | `pages/Dashboard.jsx` | Existe pero sin ruta en App.jsx |
| 3 | Interceptor Axios | Para 401/403/500 en `client.js` |
| 4 | Navbar breadcrumb | Al agregar ruta nueva, registrar su clave en BREADCRUMBS con el pathname EXACTO del router (verificar App.jsx) |
| 5 | `pages/administracion/AuditoriaPage.jsx` | Pendiente — solo rol admin |
| 6 | `pages/stock/GruposPage.jsx` | Falta click en tarjeta de grupo para abrir modal en modo `'ver'` (patrón igual que PacientePage) |
| 7 | `hooks/mantenimiento/useDiasemana.js` | Listado en estructura pero archivo no creado — pendiente |

---

## Instrucción al Finalizar Cada Módulo

Al completar un módulo nuevo o auditado, actualizar este archivo:
- Nuevos prefijos CSS y el componente al que pertenecen
- Nuevos hooks con su responsabilidad
- Deuda técnica nueva detectada
- Cualquier patrón nuevo que difiera de los documentados aquí
