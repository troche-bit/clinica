# Especificaciones de Casos de Uso — Módulo Especialidades
**Sistema:** Clínica Lichi  
**Módulo:** Mantenimiento → Especialidades  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: crear, editar, eliminar y restaurar. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear y editar, pero no eliminar ni restaurar. |
| **Usuario autenticado** | Cualquier rol con sesión activa. Puede consultar el listado. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-ESP-001 | Listar y buscar especialidades | Usuario autenticado |
| CUS-ESP-002 | Ver detalle de especialidad | Usuario autenticado |
| CUS-ESP-003 | Crear especialidad | Administrador / Recepcionista |
| CUS-ESP-004 | Editar especialidad | Administrador / Recepcionista |
| CUS-ESP-005 | Eliminar especialidad (borrado lógico) | Administrador |
| CUS-ESP-006 | Crear especialidad inline desde formulario de prestador | Administrador / Recepcionista |

---

## CUS-ESP-001 — Listar y buscar especialidades

| Campo | Detalle |
|---|---|
| **ID** | CUS-ESP-001 |
| **Módulo** | Especialidades |
| **Nombre** | Listar y buscar especialidades |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario visualiza el listado de especialidades activas y puede buscarlo mediante un campo con debounce de 300 ms. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El usuario navega a Mantenimiento → Especialidades. <br>2. El sistema consulta `GET /api/especialidad/` (page_size=200) y muestra todas las especialidades activas. <br>3. El usuario puede filtrar por nombre con búsqueda. <br>4. El usuario puede seleccionar una para ver el detalle en el panel lateral. |
| **Flujo alterno** | **A1 – Sin resultados:** Se muestra el mensaje "Sin especialidades que coincidan." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo se muestran registros con `is_deleted = False`. |
| **Post-condición** | El listado de especialidades activas es visible. |

---

## CUS-ESP-002 — Ver detalle de especialidad

| Campo | Detalle |
|---|---|
| **ID** | CUS-ESP-002 |
| **Módulo** | Especialidades |
| **Nombre** | Ver detalle de especialidad |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario selecciona una especialidad para ver su nombre y descripción en el panel lateral en modo lectura. |
| **Pre-condición** | El usuario está autenticado. Existe al menos una especialidad activa. |
| **Flujo básico** | 1. El usuario hace clic en una fila de la tabla. <br>2. El panel lateral muestra nombre y descripción de la especialidad. <br>3. El actor puede hacer clic en "Editar" si tiene permiso. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-02: El botón Eliminar solo se muestra para `admin`. |
| **Post-condición** | Los datos de la especialidad son visibles en el panel lateral. |

---

## CUS-ESP-003 — Crear especialidad

| Campo | Detalle |
|---|---|
| **ID** | CUS-ESP-003 |
| **Módulo** | Especialidades |
| **Nombre** | Crear especialidad |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor registra una nueva especialidad médica en el sistema. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en "Nuevo" (o presiona Insert). <br>2. El panel muestra el formulario con campos: nombre* y descripción. <br>3. El actor completa y guarda (clic en "Guardar" o F10). <br>4. El sistema envía `POST /api/especialidad/`. <br>5. La nueva especialidad aparece en la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado:** HTTP 400 con "Ya existe una especialidad con ese nombre." <br>**E2 – Nombre vacío:** HTTP 400. |
| **Reglas de negocio** | RN-03: El nombre es único (case-insensitive) entre registros activos. |
| **Post-condición** | Nueva especialidad creada. Queda disponible en el selector de prestadores. Registrada en auditoría. |

---

## CUS-ESP-004 — Editar especialidad

| Campo | Detalle |
|---|---|
| **ID** | CUS-ESP-004 |
| **Módulo** | Especialidades |
| **Nombre** | Editar especialidad |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica el nombre o la descripción de una especialidad existente. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. La especialidad existe y no está eliminada. |
| **Flujo básico** | 1. El actor selecciona la especialidad y hace clic en editar. <br>2. El panel muestra el formulario con los datos precargados. <br>3. El actor modifica los campos y guarda. <br>4. El sistema envía `PATCH /api/especialidad/{id}/`. <br>5. El panel vuelve al modo lectura con los datos actualizados. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado:** HTTP 400. |
| **Reglas de negocio** | RN-03: Unicidad de nombre entre registros activos, excluyendo el registro actual. |
| **Post-condición** | Datos de la especialidad actualizados. Registrado en auditoría. |

---

## CUS-ESP-005 — Eliminar especialidad (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-ESP-005 |
| **Módulo** | Especialidades |
| **Nombre** | Eliminar especialidad (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente una especialidad que no tenga prestadores activos vinculados. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. La especialidad no tiene prestadores activos en `PersonaRRHH.especialidades`. |
| **Flujo básico** | 1. El administrador selecciona la especialidad y hace clic en eliminar. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/especialidad/{id}/`. <br>4. El servidor verifica dependencias y marca `is_deleted = True`. <br>5. La especialidad desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Especialidad con prestadores activos:** HTTP 400 con "No se puede eliminar: tiene prestadores activos vinculados." |
| **Reglas de negocio** | RN-04: Solo `admin` puede eliminar. <br>RN-05: Borrado lógico. <br>RN-06: No se puede eliminar si tiene prestadores activos como M2M. |
| **Post-condición** | Especialidad marcada `is_deleted = True`. No aparece en selectores ni listas activas. Registrada en auditoría. |

---

## CUS-ESP-006 — Crear especialidad inline desde formulario de prestador

| Campo | Detalle |
|---|---|
| **ID** | CUS-ESP-006 |
| **Módulo** | Especialidades |
| **Nombre** | Crear especialidad inline desde formulario de prestador |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | Mientras se registra o edita un prestador, el actor puede crear una especialidad nueva directamente desde el selector de especialidades sin abandonar el formulario. |
| **Pre-condición** | El actor está en el formulario de creación o edición de `PersonaRRHH`. El texto buscado en el selector no coincide con ninguna especialidad existente. |
| **Flujo básico** | 1. El actor escribe en el `SelectorEspecialidades` un nombre que no existe. <br>2. El selector muestra al final del dropdown la opción `+ Crear "[texto]"`. <br>3. El actor selecciona esa opción. <br>4. El sistema envía `POST /api/especialidad/` con el texto como nombre. <br>5. La nueva especialidad queda automáticamente seleccionada como tag en el selector. <br>6. El caché de especialidades se invalida (`React Query`). |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado:** HTTP 400. El selector muestra el error sin cerrar el formulario principal. |
| **Reglas de negocio** | RN-07: La opción "+ Crear" solo aparece si `busqueda.trim().length > 0`. <br>RN-08: La navegación por teclado (↑/↓) llega hasta el ítem "+ Crear". |
| **Post-condición** | Nueva especialidad creada y vinculada al prestador en el formulario. El listado global de especialidades se actualiza automáticamente. |
