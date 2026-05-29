# Especificaciones de Casos de Uso — Módulo Evento Clínico
**Sistema:** Clínica Lichi  
**Módulo:** Mantenimiento → Evento Clínico  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: crear, editar, eliminar y restaurar. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear y editar, pero no eliminar. |
| **Usuario autenticado** | Cualquier rol con sesión activa. Puede consultar el listado (usado en formularios de consulta médica). |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-EVE-001 | Listar y buscar eventos clínicos | Usuario autenticado |
| CUS-EVE-002 | Ver detalle de evento clínico | Usuario autenticado |
| CUS-EVE-003 | Crear evento clínico | Administrador / Recepcionista |
| CUS-EVE-004 | Editar evento clínico | Administrador / Recepcionista |
| CUS-EVE-005 | Eliminar evento clínico (borrado lógico) | Administrador |

---

## CUS-EVE-001 — Listar y buscar eventos clínicos

| Campo | Detalle |
|---|---|
| **ID** | CUS-EVE-001 |
| **Módulo** | Evento Clínico |
| **Nombre** | Listar y buscar eventos clínicos |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario visualiza el catálogo de eventos clínicos disponibles (ej: Consulta general, Pediatría, Urgencias) y puede buscarlo con debounce de 300 ms. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El usuario navega a Mantenimiento → Evento Clínico. <br>2. El sistema consulta `GET /api/eventoclinico/` y muestra los eventos activos. <br>3. El usuario puede filtrar por nombre. <br>4. El usuario puede seleccionar uno para ver el detalle en el panel lateral. |
| **Flujo alterno** | **A1 – Sin resultados:** Mensaje "Sin eventos clínicos que coincidan." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo registros con `is_deleted = False`. |
| **Post-condición** | Listado de eventos clínicos activos visible. |

---

## CUS-EVE-002 — Ver detalle de evento clínico

| Campo | Detalle |
|---|---|
| **ID** | CUS-EVE-002 |
| **Módulo** | Evento Clínico |
| **Nombre** | Ver detalle de evento clínico |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario selecciona un evento clínico para ver su nombre y descripción en el panel lateral. |
| **Pre-condición** | El usuario está autenticado. Existe al menos un evento clínico activo. |
| **Flujo básico** | 1. El usuario hace clic en una fila. <br>2. El panel lateral muestra nombre y descripción. <br>3. El actor puede hacer clic en "Editar" si tiene permiso. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-02: El botón Eliminar solo se muestra para `admin`. |
| **Post-condición** | Datos del evento clínico visibles en el panel. |

---

## CUS-EVE-003 — Crear evento clínico

| Campo | Detalle |
|---|---|
| **ID** | CUS-EVE-003 |
| **Módulo** | Evento Clínico |
| **Nombre** | Crear evento clínico |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor registra un nuevo tipo de evento clínico que estará disponible al registrar consultas médicas. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en "Nuevo" (o presiona Insert). <br>2. El panel muestra el formulario con campos: nombre* y descripción. <br>3. El actor completa y guarda (clic en "Guardar" o F10). <br>4. El sistema envía `POST /api/eventoclinico/`. <br>5. El nuevo evento aparece en la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado:** HTTP 400 con "Ya existe un evento clínico con ese nombre." <br>**E2 – Nombre vacío:** HTTP 400. |
| **Reglas de negocio** | RN-03: El nombre es único (case-insensitive) entre registros activos. |
| **Post-condición** | Nuevo evento clínico disponible en el selector de la pantalla de consultas. Registrado en auditoría. |

---

## CUS-EVE-004 — Editar evento clínico

| Campo | Detalle |
|---|---|
| **ID** | CUS-EVE-004 |
| **Módulo** | Evento Clínico |
| **Nombre** | Editar evento clínico |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica el nombre o la descripción de un evento clínico existente. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El evento existe y no está eliminado. |
| **Flujo básico** | 1. El actor selecciona el evento y hace clic en editar. <br>2. El panel muestra el formulario con datos precargados. <br>3. El actor modifica y guarda. <br>4. El sistema envía `PATCH /api/eventoclinico/{id}/`. <br>5. El panel vuelve al modo lectura. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado:** HTTP 400. |
| **Reglas de negocio** | RN-03: Unicidad entre registros activos, excluyendo el actual. |
| **Post-condición** | Datos actualizados. Registrado en auditoría. |

---

## CUS-EVE-005 — Eliminar evento clínico (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-EVE-005 |
| **Módulo** | Evento Clínico |
| **Nombre** | Eliminar evento clínico (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un evento clínico que no tenga consultas activas vinculadas. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El evento no tiene consultas activas en `Consulta`. |
| **Flujo básico** | 1. El administrador selecciona el evento y hace clic en eliminar. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/eventoclinico/{id}/`. <br>4. El servidor verifica que no haya consultas activas con ese evento y marca `is_deleted = True`. <br>5. El evento desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Evento con consultas activas:** HTTP 400 con "No se puede eliminar: tiene consultas activas vinculadas." |
| **Reglas de negocio** | RN-04: Solo `admin` puede eliminar. <br>RN-05: Borrado lógico. <br>RN-06: No se puede eliminar con consultas activas (`is_deleted = False` en `Consulta`). |
| **Post-condición** | Evento clínico marcado `is_deleted = True`. No aparece en selectores. Registrado en auditoría. |
