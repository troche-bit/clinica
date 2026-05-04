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
│   ├── core/
│   │   └── useToast.js
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
│   │   └── Navbar.jsx         ← breadcrumbs automáticos
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
    { name: 'campo2', label: 'Campo 2', soloLectura: true }, // bloqueado en editar
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
| `.frrhh-` | `components/rrhh/FormRRHH.jsx` |
| `.sb-` | `components/layout/Sidebar.jsx` |
| `.nb-` | `components/layout/Navbar.jsx` |
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
| `.ag-` | `pages/clinica/AgendaPage.jsx` |
| `.cs-` | `pages/clinica/ConsultasPage.jsx` |
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

### core/
| Hook | Responsabilidad |
|---|---|
| `useToast` | Estado de notificación — retorna `{ toast, showToast }` |

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
| `useDocumentosPorConsulta` | GET `/api/documentos/?consulta=id` |
| `useDocumentosPorPaciente` | GET `/api/documentos/?paciente=id` |
| `usePacientesConDocumentos` | GET `/api/documentos/pacientes/?search=` |
| `useSubirDocumento` | POST multipart/form-data — usa `fetch` nativo (no Axios) |
| `useDeleteDocumento` | DELETE `/api/documentos/{id}/` |
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
| `useAgendaDiaGlobal` | GET `/api/agenda/` filtrado solo por fecha |
| `useStatsHoy` | GET `/api/agenda/stats-hoy/` (staleTime 1 min) |
| `useAsignarTurno` | PATCH `/api/agenda/{id}/asignar/` |
| `useCambiarEstado` | PATCH `/api/agenda/{id}/estado/` |
| `usePacienteSearch(q)` | GET `/api/paciente/?search=q` con debounce 300ms — búsqueda rápida para asignar turno |
| `useConsultasDelDia` | GET `/api/consultas/?persona_rrhh=&fecha=` |
| `useConsultasPaciente` | GET `/api/consultas/?paciente=id` |
| `useConsultaDetalle` | GET `/api/consultas/{id}/` |
| `useIniciarConsulta` | POST `/api/consultas/{id}/iniciar/` |
| `useFinalizarConsulta` | POST `/api/consultas/{id}/finalizar/` |
| `useUpdateConsulta` | PATCH `/api/consultas/{id}/` |
| `useCrearConsulta` | POST `/api/consultas/` |
| `useStatsConsultasHoy` | GET `/api/consultas/stats-hoy/` |
| `useConsultasHoy` | GET todas las consultas del día (vista recepcionista) — `refetchInterval: 60s` |

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
| 4 | Navbar breadcrumb | Verificar que rutas nuevas matcheen correctamente |
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
