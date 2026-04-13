# CLAUDE.md — Clínica Lichi
_Versión 2.9 · Abril 2026 — Módulo Agenda implementado_

---

## Idioma
Responder siempre en español. Todos los comentarios de código, mensajes de commit,
explicaciones y documentación generada deben estar en español.

---

## Stack Tecnológico

### Backend
| Tecnología | Detalle |
|---|---|
| Python / Django | Django REST Framework |
| Base de datos | PostgreSQL 16 (Alpine) |
| Autenticación | JWT — `djangorestframework-simplejwt` con blacklist activada |
| CORS | `django-cors-headers` |
| Documentación API | `drf-spectacular` (Swagger en `/api/docs/`, ReDoc en `/api/redoc/`) |
| Configuración | `python-decouple` (variables de entorno) |
| Zona horaria | `America/Asuncion` — Idioma `es-py` |
| Paginación global | `PageNumberPagination` — 20 ítems por página por defecto |

### Frontend
| Tecnología | Versión |
|---|---|
| React | 18.3 |
| Build tool | Vite 6.2 |
| Router | React Router Dom 7 |
| Server state | TanStack Query 5 |
| HTTP client | Axios 1.x |
| Íconos | Lucide React |
| Estilos | Tailwind CSS 3 (config mínima) + `<style>` tags inline por componente |

### Infraestructura
- Docker Compose — 3 containers: `clinica_frontend` (5173), `clinica_backend` (8000), `clinica_db` (5432)
- Vite proxy redirige `/api` → `localhost:8000`
- Versionado: GitHub

---

## Estructura de Carpetas

```
clinica/
├── backend/
│   ├── apps/
│   │   ├── core/               ← BaseModel abstracto (soft delete + auditoría)
│   │   ├── persona/            ← TipoDocumento, Persona
│   │   ├── paciente/           ← Paciente, PacienteResponsable
│   │   ├── ubicacion/          ← Pais, Departamento, Ciudad
│   │   ├── diasemana/          ← DiaSemana (solo lectura, sin BaseModel)
│   │   ├── administracion/
│   │   │   ├── consultorio/    ← Consultorio (movido desde apps/consultorio/)
│   │   │   ├── especialidad/   ← Especialidad
│   │   │   └── ubicacion/      ← Pais, Departamento, Ciudad (movido desde apps/ubicacion/)
│   │   ├── principal/
│   │   │   ├── eventoclinico/        ← EventoClinico
│   │   │   ├── paciente_responsable/ ← PacienteResponsable (módulo independiente)
│   │   │   ├── paciente/             ← Paciente (movido desde apps/paciente/)
│   │   │   ├── persona_rrhh/         ← PersonaRRHH (prestadores con M2M especialidades)
│   │   │   ├── horario_prestador/    ← HorarioPrestador (horarios semanales + excepciones)
│   │   │   └── agenda/               ← Agenda (turnos: disponible/ocupado/inactivo/cancelado)
│   │   ├── mantenimiento/
│   │   │   └── tipo_doc_dig/   ← TipoDocDigital
│   │   ├── appointments/       ← PENDIENTE (solo urls.py vacío)
│   │   └── users/              ← PENDIENTE (en INSTALLED_APPS, sin implementación)
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   └── production.py
│   │   ├── urls.py
│   │   ├── pagination.py       ← StandardPagination, SmallPagination
│   │   └── wsgi.py
│   ├── manage.py
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── api/
        │   ├── client.js         ← cliente ACTIVO (usa access_token/refresh_token)
        │   └── axiosConfig.js    ← HUÉRFANO — eliminar (usa claves distintas, nadie lo importa)
        ├── context/
        │   └── AuthContext.jsx   ← proveedor JWT, usa client.js
        ├── hooks/
        │   ├── usePatients.js
        │   ├── usePersona.js
        │   ├── useResponsable.js
        │   ├── useUbicacion.js
        │   ├── useConsultorios.js      ← hooks de consultorios (extraídos de ConsultorioPage)
        │   ├── useToast.js             ← estado de notificación Toast
        │   ├── usePersonaRRHH.js       ← hooks de PersonaRRHH
        │   ├── useEspecialidades.js    ← hooks de Especialidad (page_size=200)
        │   └── useHorarioPrestador.js  ← hooks de HorarioPrestador + generar turnos
        ├── components/
        │   ├── PrivateRoute.jsx
        │   ├── layout/
        │   │   ├── Layout.jsx    ← define clases globales reutilizables
        │   │   ├── Sidebar.jsx   ← menú colapsable con roles
        │   │   └── Navbar.jsx    ← breadcrumbs
        │   ├── ui/
        │   │   ├── Modal.jsx       ← modal genérico (sm/md/lg/xl/full)
        │   │   ├── PanelSimple.jsx ← panel lateral genérico Master-Detail
        │   │   └── Toast.jsx       ← notificación flotante (success/error/warning)
        │   ├── persona/
        │   │   ├── BuscadorPersona.jsx
        │   │   └── FormPersona.jsx
        │   ├── paciente/
        │   │   ├── PacienteForm.jsx    ← orquestador
        │   │   └── FormPaciente.jsx    ← sub-formulario
        │   ├── responsable/
        │   │   ├── ResponsableForm.jsx ← orquestador
        │   │   └── FormResponsable.jsx ← sub-formulario
        │   └── rrhh/
        │       └── FormRRHH.jsx        ← orquestador (PersonaRRHH con selector especialidades)
        ├── pages/
        │   ├── Login.jsx
        │   ├── Dashboard.jsx              ← existe pero NO está en el router
        │   ├── Paciente.jsx
        │   ├── PacienteResponsablePage.jsx
        │   ├── ConsultorioPage.jsx
        │   ├── EspecialidadPage.jsx
        │   ├── EventoClinicoPage.jsx
        │   ├── UbicacionesPage.jsx
        │   ├── PersonaRRHHPage.jsx        ← gestión de prestadores
        │   ├── HorarioPrestadorPage.jsx   ← horarios semanales master-detail
        │   └── AgendaPage.jsx             ← agenda y citas (3 columnas: médicos, calendario, panel día)
        └── utils/
            └── calcularDV.js             ← dígito verificador RUC Paraguay
```

---

## Convenciones Críticas — Backend

### Borrado lógico (NUNCA eliminar físicamente)
Todos los modelos heredan de `BaseModel` (excepto `DiaSemana`).

```python
def perform_destroy(self, instance):
    # Validar dependencias ANTES de borrar
    if instance.hijos.filter(is_deleted=False).exists():
        raise ValidationError('Tiene registros vinculados activos.')
    instance.is_deleted = True
    instance.fecha_eliminacion = timezone.now()
    instance.id_usu_modificator = self.request.user
    instance.save()
```

- Los queries de listado filtran siempre `is_deleted=False`.
- Las `UniqueConstraint` usan `condition=Q(is_deleted=False)` para permitir reusar valores borrados.
- Todos los viewsets activos filtran `is_deleted=False` en el queryset. ✅
- `Persona` no puede eliminarse (ni lógica ni físicamente) — `PersonaViewSet.perform_destroy` lanza `MethodNotAllowed`. Solo se puede eliminar el `Paciente` o `PacienteResponsable` vinculado.

**Tablas que requieren validación de dependencias antes de borrar:**
- `Pais` → verificar departamentos activos Y personas activas con ese país ✅ implementado
- `Departamento` → verificar ciudades activas Y personas activas con ese departamento ✅ implementado
- `Ciudad` → verificar personas activas con esa ciudad ✅ implementado
- `Consultorio` → verificar citas activas (pendiente cuando se implemente `appointments`)
- `TipoDocDigital` → verificar documentos digitalizados activos (pendiente cuando se implemente ese módulo)
- `Paciente` → verificar citas activas (pendiente cuando se implemente `appointments`)
- `PacienteResponsable` → verificar pacientes activos ✅ implementado
- `Persona` → verificar paciente y responsable activos

### Auditoría (verificar en TODOS los viewsets)
```python
def perform_create(self, serializer):
    serializer.save(id_usu_creator=self.request.user)

def perform_update(self, serializer):
    serializer.save(id_usu_modificator=self.request.user)
```

### PATCH, nunca PUT
Siempre usar `PATCH` para actualizaciones parciales. Nunca `PUT`. Aplica a hooks del frontend y cualquier cliente externo.

### Doble serializer (list vs write)
- `XListSerializer` — incluye campos anidados expandidos (para `list` y `retrieve`).
- `XSerializer` — solo IDs para escritura (para `create` y `update`).
- El ViewSet usa `get_serializer_class()` para elegir según la acción.
- El orden de definición en el archivo importa — definir primero los referenciados.

### TipoDocumento
- Campo clave: `.descripcion` — NUNCA usar `.nombre`.
- Es fijo en base de datos, sin ABM para el usuario.
- Para verificar si es RUC siempre usar `.descripcion`.

### Unicidad case-insensitive
- Se usa `Lower('campo')` en las `UniqueConstraint`.
- Se crean índices con `Lower('campo')` para rendimiento.

### Endpoints personalizados existentes
- `GET /api/persona/buscar/?nro_documento=X` → `{persona, paciente, es_paciente}`
- `GET /api/pacienteresponsable/buscar/?nro_documento=X` → `{persona, pacienteresponsable, es_responsable}`
- `GET /api/paciente/eliminados/` → lista con `is_deleted=True`
- `GET /api/pacienteresponsable/eliminados/` → ídem
- `GET /api/consultorio/eliminados/` → ídem
- `GET /api/pais/eliminados/` → ídem
- `GET /api/departamento/eliminados/` → ídem
- `GET /api/ciudad/eliminados/` → ídem
- `GET /api/especialidad/eliminados/` → ídem
- `GET /api/eventoclinico/eliminados/` → ídem
- `GET /api/tipo-doc-dig/eliminados/` → ídem
- `GET /api/personarrhh/eliminados/` → ídem
- `GET /api/personarrhh/buscar/?nro_documento=X` → `{persona, personarrhh, es_prestador}`
- `GET /api/horario-prestador/eliminados/` → ídem
- `POST /api/horario-prestador/{id}/generar/` → genera y persiste turnos `Agenda` para un rango de fechas; omite duplicados
- `PATCH /api/agenda/{id}/asignar/` → asigna paciente a un turno disponible (estado → ocupado)
- `PATCH /api/agenda/{id}/estado/` → cambia estado a disponible/inactivo/cancelado
- `GET /api/agenda/resumen-mes/` → conteo por fecha de disponibles/ocupados/inactivos/total
- `GET /api/agenda/stats-hoy/` → estadísticas del día actual
- `GET /api/departamento/?pais=ID` → filtrado por país
- `GET /api/ciudad/?departamento=ID` → filtrado por departamento

### Construcción de rutas de archivos
```python
def build_storage_path(instance, filename):
    ext    = filename.rsplit('.', 1)[-1].lower()
    unique = uuid.uuid4().hex[:8]
    year   = datetime.now().year
    key    = instance.tip_doc_dig.storage_key
    pac_id = instance.pac_id
    return f'documentos/{key}/{year}/{pac_id}_{unique}.{ext}'
```

---

## Convenciones Críticas — Frontend

### Formularios
- Los formularios **NUNCA** guardan datos por sí solos — notifican al padre via `onChange`.
- El padre (orquestador) llama a la API y maneja el estado de guardado.
- `onSuccess()` notifica a la página que la operación terminó (cerrar modal, refrescar lista).
- El guardado es secuencial: primero `Persona`, luego la entidad específica.

### Distinción orquestador vs sub-formulario
| Nombre | Rol |
|---|---|
| `PacienteForm` | **Orquestador** — une BuscadorPersona + FormPersona + FormPaciente + guardado |
| `FormPaciente` | **Sub-formulario** — solo campos propios del Paciente |
| `ResponsableForm` | **Orquestador** — une BuscadorPersona + FormPersona + FormResponsable + guardado |
| `FormResponsable` | **Sub-formulario** — solo campos propios del Responsable |

### Estado y datos
- **React Query** para estado del servidor — no duplicar en `useState`.
- **useState** solo para estado local de UI (panel abierto, modo edición, campos del formulario).
- **Context API** solo para estado global real (usuario autenticado, rol).
- Todos los hooks de mutación usan `invalidateQueries` al completar.

### Cliente HTTP
- Usar siempre `client.js` — es el único cliente activo.
- `axiosConfig.js` está huérfano y debe eliminarse.
- Claves de localStorage del cliente activo: `access_token` / `refresh_token`.

---

## Patrones de UI

### Regla de elección
- Formulario con múltiples componentes o pasos → **Modal**
- Formulario simple de 1-4 campos → **Master-Detail (panel lateral)**

### Patrón Modal — Formularios complejos
_Usado en: Paciente, PacienteResponsable_
```
Página → botón 'Nuevo' / 'Editar'
  → Modal (isOpen, onClose, title, subtitle, size)
    → Orquestador (PacienteForm / ResponsableForm)
      → BuscadorPersona  (determina modo)
      → FormPersona      (datos personales)
      → FormPaciente / FormResponsable (datos específicos)
      → handleGuardar → onSuccess() → cierra modal
```

### Patrón Master-Detail — Panel lateral
_Usado en: Consultorio, Especialidad, EventoClinico_
```
Página → lista de registros (izquierda)
  → click en fila → <PanelSimple> (derecha)
    modo 'ver'    → datos + botones Editar / Eliminar
    modo 'editar' → inputs habilitados + Guardar / Cancelar
    modo 'crear'  → inputs vacíos + Guardar / Cancelar
  → botón 'Nuevo' → Panel en modo 'crear'
```

**Uso de `<PanelSimple>`:**
```jsx
<PanelSimple
  titulos={{ nuevo: 'Nuevo X', editar: 'Editar X', ver: 'Detalle' }}
  icono={<IconoX size={22} color="#1a3a5c" />}
  campos={[
    { name: 'campo1', label: 'Campo 1', placeholder: '...', requerido: true },
    { name: 'campo2', label: 'Campo 2', placeholder: '...', requerido: false },
    // soloLectura: true → editable en 'crear', bloqueado con badge "No editable" en 'editar'
    { name: 'campo3', label: 'Campo 3', placeholder: '...', requerido: true, soloLectura: true },
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

### Patrón Cascada — Selects dependientes
_Usado en: Ubicaciones, FormPersona_
- Al cambiar País → resetea departamento y ciudad
- Al cambiar Departamento → resetea ciudad
- `useDepartamentos(paisId)` y `useCiudades(departamentoId)` solo hacen fetch cuando el ID padre es válido

### Patrón Buscador — Flujo por documento
_Usado en: BuscadorPersona, buscador de responsable en FormPaciente_

| Modo | Condición |
|---|---|
| `crear_todo` | La persona no existe — se crea Persona + entidad |
| `agregar_paciente` | La persona existe pero no tiene la entidad — se crea solo la entidad |
| `editar` | Ya existe como entidad — se editan ambos registros |

El buscador muestra un badge de contexto coloreado según el modo detectado.

### Patrón Columnas jerárquicas
_Usado en: UbicacionesPage_
- Grid de 3 columnas: País → Departamento → Ciudad
- Seleccionar padre habilita la columna siguiente
- Edición inline con `FilaEditable`

---

## Estilos Visuales

### Tokens de color
| Token | Valor | Uso |
|---|---|---|
| Brand primario | `#1a3a5c` | Sidebar, botones primarios, títulos, bordes focus |
| Brand hover | `#15304d` | Hover de botones primarios |
| Brand tooltip | `#0f2540` | Fondo de tooltips del sidebar |
| Azul claro | `#dbeafe` | Avatar bg, badge info |
| Azul borde hover | `#bfdbfe` | Borde hover botón editar |
| Azul row activo | `#eff6ff` | Fila seleccionada en tabla |
| Fondo app | `#f0f4f8` | Background general |
| Thead / surface | `#f8fafc` | Header de tablas |
| Card border | `#e8edf2` | Borde de tarjetas y modales |
| Input border | `#e5e7eb` | Borde de inputs |
| Row separator | `#f3f4f6` | Separador de filas |
| Texto principal | `#111827` | Nombres, valores importantes |
| Texto secundario | `#374151` | Celdas de tabla, texto general |
| Texto muted | `#6b7280` | Subtítulos, íconos, labels |
| Labels / hints | `#9ca3af` | Etiquetas de campos |
| Rojo error | `#dc2626` | Errores, hover eliminar |
| Rojo borde | `#fecaca` | Borde hover botón eliminar |
| Rojo fondo | `#fef2f2` | Fondo hover botón eliminar |
| Verde conectado | `#22c55e` | Dot "Conectado" en navbar |

### Tipografía
| Fuente | Uso |
|---|---|
| `DM Sans` (300, 400, 500, 600) | Texto general, formularios, botones, tablas |
| `DM Serif Display` | Título login (`Clínica Lichi`), logo del Sidebar |
| `Courier New` | Valores técnicos, storage_key, rutas |

### Estilos por componente
Cada componente define su CSS con `<style>` inline. Prefijos únicos para evitar colisiones.

| Prefijo | Componente |
|---|---|
| `.modal-` | `components/ui/Modal.jsx` |
| `.panel-` | `components/ui/PanelSimple.jsx` ← componente compartido extraído |
| `.toast-` | `components/ui/Toast.jsx` |
| `.bp-` | `components/persona/BuscadorPersona.jsx` |
| `.fp-` | `components/persona/FormPersona.jsx` |
| `.pf-` | `components/paciente/PacienteForm.jsx` |
| `.fpa-` | `components/paciente/FormPaciente.jsx` |
| `.rf-` | `components/responsable/ResponsableForm.jsx` |
| `.fr-` | `components/responsable/FormResponsable.jsx` |
| `.sb-` | `components/layout/Sidebar.jsx` |
| `.nb-` | `components/layout/Navbar.jsx` |
| `.pac-` | `pages/Paciente.jsx` |
| `.pr-` | `pages/PacienteResponsablePage.jsx` |
| `.con-` | `pages/ConsultorioPage.jsx` |
| `.esp-` | `pages/EspecialidadPage.jsx` |
| `.ec-`  | `pages/EventoClinicoPage.jsx` |
| `.tdd-` | `pages/TipoDocDigPage.jsx` |
| `.ub-` | `pages/UbicacionesPage.jsx` |
| `.rrhh-` | `pages/PersonaRRHHPage.jsx` |
| `.frrhh-` | `components/rrhh/FormRRHH.jsx` |
| `.hp-` | `pages/HorarioPrestadorPage.jsx` |
| `.ag-` | `pages/AgendaPage.jsx` |
| `.login-` | `pages/Login.jsx` |

> **Al crear módulos nuevos:** asignar prefijo propio y registrarlo en esta tabla.

### Clases globales (Layout.jsx)
Disponibles en todas las páginas sin redefinir:

`.btn` `.btn-primary` `.btn-secondary` `.btn-danger`
`.badge` `.badge-success` `.badge-warning` `.badge-danger` `.badge-info` `.badge-gray`
`.card` `.card-sm` `.input` `.form-label` `.form-group`
`.page-header` `.page-title` `.page-subtitle`
`.table-wrapper` `.stats-grid` `.stat-card` `.stat-label` `.stat-value`

---

## Hooks Existentes

| Hook | Archivo | Responsabilidad |
|---|---|---|
| `usePatients` | `hooks/usePatients.js` | Lista paginada de pacientes con búsqueda |
| `useCreatePatient` | `hooks/usePatients.js` | POST `/api/paciente/` |
| `useUpdatePatient` | `hooks/usePatients.js` | PATCH `/api/paciente/{id}/` |
| `useDeletePatient` | `hooks/usePatients.js` | DELETE `/api/paciente/{id}/` |
| `useTipoDocumento` | `hooks/usePersona.js` | GET tipos de documento (staleTime 30 min) |
| `useCreatePersona` | `hooks/usePersona.js` | POST `/api/persona/` |
| `useUpdatePersona` | `hooks/usePersona.js` | PATCH `/api/persona/{id}/` |
| `useResponsables` | `hooks/useResponsable.js` | Lista paginada de responsables con búsqueda |
| `useCreateResponsable` | `hooks/useResponsable.js` | POST `/api/pacienteresponsable/` |
| `useUpdateResponsable` | `hooks/useResponsable.js` | PATCH `/api/pacienteresponsable/{id}/` |
| `useDeleteResponsable` | `hooks/useResponsable.js` | DELETE `/api/pacienteresponsable/{id}/` |
| `usePaises` | `hooks/useUbicacion.js` | GET lista de países (staleTime 30 min) |
| `useDepartamentos` | `hooks/useUbicacion.js` | GET departamentos por `paisId` |
| `useCiudades` | `hooks/useUbicacion.js` | GET ciudades por `departamentoId` |
| `useConsultorios` | `hooks/useConsultorios.js` | GET lista de consultorios con búsqueda |
| `useConsultorioMutations` | `hooks/useConsultorios.js` | POST / PATCH / DELETE `/api/consultorio/` |
| `useEspecialidades` | `hooks/useEspecialidades.js` | GET lista de especialidades con búsqueda |
| `useEspecialidadMutations` | `hooks/useEspecialidades.js` | POST / PATCH / DELETE `/api/especialidad/` |
| `useEventosClinicos` | `hooks/useEventosClinicos.js` | GET lista de eventos clínicos con búsqueda |
| `useEventoClinicoMutations` | `hooks/useEventosClinicos.js` | POST / PATCH / DELETE `/api/eventoclinico/` |
| `useTipoDocDig` | `hooks/useTipoDocDig.js` | GET lista de tipos de documento digitalizado con búsqueda |
| `useTipoDocDigMutations` | `hooks/useTipoDocDig.js` | POST / PATCH / DELETE `/api/tipo-doc-dig/` |
| `useToast` | `hooks/useToast.js` | Estado de notificación Toast — retorna `{ toast, showToast }` |
| `usePersonasRRHH` | `hooks/usePersonaRRHH.js` | Lista paginada de prestadores con búsqueda |
| `useCreatePersonaRRHH` | `hooks/usePersonaRRHH.js` | POST `/api/personarrhh/` |
| `useUpdatePersonaRRHH` | `hooks/usePersonaRRHH.js` | PATCH `/api/personarrhh/{id}/` |
| `useDeletePersonaRRHH` | `hooks/usePersonaRRHH.js` | DELETE `/api/personarrhh/{id}/` |
| `useEspecialidades` | `hooks/useEspecialidades.js` | GET lista de especialidades (page_size=200, staleTime 5 min) |
| `useEspecialidadMutations` | `hooks/useEspecialidades.js` | POST / PATCH / DELETE `/api/especialidad/` |
| `useHorariosPrestador` | `hooks/useHorarioPrestador.js` | GET horarios filtrados por persona_rrhh y/o estado |
| `useCreateHorario` | `hooks/useHorarioPrestador.js` | POST `/api/horario-prestador/` |
| `useUpdateHorario` | `hooks/useHorarioPrestador.js` | PATCH `/api/horario-prestador/{id}/` |
| `useDeleteHorario` | `hooks/useHorarioPrestador.js` | DELETE `/api/horario-prestador/{id}/` |
| `useGenerarTurnos` | `hooks/useHorarioPrestador.js` | POST `/api/horario-prestador/{id}/generar/` |
| `useResumenMes` | `hooks/useAgenda.js` | GET `/api/agenda/resumen-mes/` — stats por fecha del mes |
| `useAgendaDia` | `hooks/useAgenda.js` | GET `/api/agenda/` filtrado por persona_rrhh + fecha |
| `useAgendaMes` | `hooks/useAgenda.js` | GET `/api/agenda/` filtrado por rango del mes (pills calendario) |
| `useAgendaDiaGlobal` | `hooks/useAgenda.js` | GET `/api/agenda/` filtrado solo por fecha (todos los médicos) |
| `useStatsHoy` | `hooks/useAgenda.js` | GET `/api/agenda/stats-hoy/` (staleTime 1 min) |
| `useAsignarTurno` | `hooks/useAgenda.js` | PATCH `/api/agenda/{id}/asignar/` — asignar paciente |
| `useCambiarEstado` | `hooks/useAgenda.js` | PATCH `/api/agenda/{id}/estado/` — cambiar estado |

---

## Estado de Módulos

### Completado ✅
| Módulo | Frontend | Backend |
|---|---|---|
| Autenticación JWT | Login.jsx, AuthContext, PrivateRoute | TokenObtainPair, Refresh, Verify |
| Pacientes | Paciente.jsx + PacienteForm | PacienteViewSet |
| Responsables | PacienteResponsablePage + ResponsableForm | PacienteResponsableViewSet |
| Ubicaciones | UbicacionesPage | Pais, Departamento, CiudadViewSet |
| Consultorios | ConsultorioPage | ConsultorioViewSet |
| Especialidades | EspecialidadPage (migrado a PanelSimple ✅) | EspecialidadViewSet |
| Evento Clínico | EventoClinicoPage (migrado a PanelSimple ✅) | EventoClinicoViewSet |
| Tipo doc. digitalizado | TipoDocDigPage | TipoDocDigitalViewSet |
| Días de semana | — (dato de referencia, sin página) | DiaSemanaViewSet (ReadOnly) |
| PersonaRRHH | PersonaRRHHPage + FormRRHH (selector especialidades con teclado) | PersonaRRHHViewSet (M2M especialidades, /buscar/, /eliminados/) |
| HorarioPrestador | HorarioPrestadorPage (master-detail, preview turnos) | HorarioPrestadorViewSet (/generar/, /eliminados/) |
| Agenda | AgendaPage (layout 3 columnas: médicos, calendario, panel día) | AgendaViewSet (/asignar/, /cambiar_estado/, /resumen-mes/, /stats-hoy/) |

### En progreso ⚠️
| Módulo | Estado |
|---|---|
| Dashboard | `Dashboard.jsx` existe pero no está conectado al router |

### Pendiente ❌
| Módulo | Notas |
|---|---|
| Agenda / Recordatorios | Solo en sidebar, sin ruta ni página |
| Agenda / Recordatorios | Solo en sidebar (`/agenda/recordatorios`), sin ruta ni página |
| Consulta médica | Solo en sidebar, sin ruta ni página |
| Documentos digitalizados | Solo en sidebar, sin ruta ni página |
| Tipo doc. digitalizado | Solo en sidebar, sin ruta ni página |
| Facturación / Ventas | Solo en sidebar, sin ruta ni página |
| Facturación / Timbrado | Solo en sidebar, sin ruta ni página |
| Facturación / Caja | Solo en sidebar, sin ruta ni página |
| Facturación / Cobranzas | Solo en sidebar, sin ruta ni página |
| Gestión de usuarios | `apps/users/` en INSTALLED_APPS sin implementación |
| Informes | Solo en sidebar, sin ruta ni página |
| Roles y permisos reales | `user?.rol` siempre retorna `'admin'` — AuthContext no guarda el rol |
| Pagos | Ruta `/pagos` con placeholder |

---

## Orden de Implementación

### Paso 0 — Limpiar deuda técnica (antes de cualquier módulo nuevo)
1. Corregir los 4 bugs confirmados (ver sección siguiente)
2. Eliminar `axiosConfig.js`
3. Agregar `is_deleted=False` en querysets de Consultorio, Especialidad, EventoClinico
4. Limpiar `console.log` de debug en `useUbicacion.js` y `FormPaciente.jsx`
5. Extraer componente `<PanelSimple>` compartido para Consultorio, Especialidad, EventoClinico
6. Extraer `<Toast />`, `useToast()` y `<ConfirmDialog />` — reemplazar `window.confirm()`

### Paso 1 — Gestión de usuarios y roles
`apps/users/` — necesario para roles reales en RRHH y permisos por módulo.

### Paso 2 — Dashboard
Conectar `Dashboard.jsx` al router. Estadísticas básicas: pacientes activos, citas del día, etc.

### Paso 3 — RRHH / Personas prestadoras
Extiende `Persona` con datos de prestador. Patrón: Master-Detail + FormPersona reutilizado.

### Paso 4 — Agenda / Horarios y Citas
Núcleo del sistema. Requiere RRHH completo. FK a Paciente, Prestador, Consultorio, DiaSemana.

### Paso 5 — Consulta médica / Historia clínica
Depende de Agenda.

### Paso 6 — Documentos digitalizados
Panel en perfil del paciente. Depende de Consulta y TipoDocDigital.

### Paso 7 — Facturación
Cabecera + detalle (master-detail doble). Depende de Consulta médica.

### Paso 8 — Finanzas / Cobranzas
Depende de Facturación.

### Paso 9 — Informes
Depende de todos los módulos anteriores.

---

## Bugs Confirmados — Corregir en Paso 0

| # | Archivo | Descripción |
|---|---|---|
| 1 | `components/paciente/FormPaciente.jsx:61` | `paciente.responsable_` — typo con guión bajo. ✅ corregido |
| 2 | `pages/PacienteResponsablePage.jsx` | La columna "Parentesco" leía `responsable.parentesco` (campo de Paciente). ✅ columna eliminada |
| 3 | `components/layout/Navbar.jsx` | Breadcrumb usa `/pacientes` (con s) pero la ruta real en App.jsx es `/paciente` (sin s). Nunca matchea. |
| 4 | `apps/administracion/especialidad/views.py:12` | `ordering_fields = ['especialidad']` — el campo no existe. ✅ corregido |

---

## Deuda Técnica — Corregir en Paso 0

| # | Archivo | Descripción |
|---|---|---|
| 5 | `api/axiosConfig.js` | Cliente duplicado huérfano. Usa `authToken`/`refreshToken` en lugar de `access_token`/`refresh_token`. Nadie lo importa. Eliminar. |
| 6 | `hooks/useUbicacion.js:9` | `console.log('Paises: ', data)` — debug sin limpiar. ✅ limpiado |
| 7 | `components/paciente/FormPaciente.jsx:72` | `console.log('form.responsable:', form.responsable)` — debug sin limpiar. ✅ eliminado |
| 8 | — | CSS `.con-*` y `.panel-*` duplicado corregido. `ConsultorioPage`, `EspecialidadPage` y `EventoClinicoPage` migrados a `<PanelSimple>` ✅ |
| 9 | — | Todos los viewsets filtran `is_deleted=False` ✅ |
| 10 | `Sidebar.jsx` | `user?.rol \|\| 'admin'` — AuthContext solo guarda el token, no el rol. Siempre retorna `'admin'`. |
| 11 | `pages/Dashboard.jsx` | Existe pero sin ruta en `App.jsx`. Inaccesible. |
| 12 | `apps/appointments/urls.py` | Router vacío. Sin modelos, serializers ni views. |

---

## Componentes Pendientes de Extraer

| Componente | Destino | Estado |
|---|---|---|
| `<PanelSimple>` | `components/ui/PanelSimple.jsx` | ✅ Creado — en uso en ConsultorioPage |
| `<Toast />` | `components/ui/Toast.jsx` | ✅ Creado — en uso en ConsultorioPage |
| `useToast()` | `hooks/useToast.js` | ✅ Creado — en uso en ConsultorioPage |
| `<ConfirmDialog />` | `components/ui/ConfirmDialog.jsx` | ❌ Pendiente — reemplaza `window.confirm()` |

---

## Pendientes Globales

| Pendiente | Alcance | Prioridad |
|---|---|---|
| Bugs confirmados (#1 al #4) | Archivos específicos | 🔴 Alta |
| Deuda técnica (#5 al #12) | Varios archivos | 🔴 Alta |
| Borrado lógico con validación de dependencias | Todos los viewsets | 🔴 Alta |
| Interceptor Axios para 401 / 403 / 500 | `src/api/client.js` | 🔴 Alta |
| Roles reales en AuthContext | Backend + frontend | 🟡 Media |
| select_related / prefetch_related | Viewsets con datos anidados | 🟡 Media |
| Paginación del servidor en tablas | Pacientes y Responsables | 🟡 Media |
| Debounce en campos de búsqueda | Tablas con buscador | 🟡 Media |
| JSDoc en componentes compartidos | Modal, BuscadorPersona, FormPersona | 🟡 Media |
| Tests de integración backend | Viewsets críticos | 🟢 Al finalizar esqueleto |
| Tests frontend con Vitest + RTL | Hooks y componentes | 🟢 Al finalizar esqueleto |

---

## Instrucción al Finalizar Cada Módulo

Al completar un módulo nuevo, actualizar este archivo reflejando:
- Nuevo estado en la tabla de módulos (✅ / ⚠️ / ❌)
- Nuevos prefijos CSS creados y el componente al que pertenecen
- Nuevos hooks agregados con su responsabilidad
- Bugs o deuda técnica nueva detectada
- Cualquier patrón nuevo que difiera de los documentados aquí

_Clínica Lichi — CLAUDE.md · Versión 2.8 · Abril 2026_
