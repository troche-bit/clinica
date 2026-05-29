# Especificaciones de Casos de Uso — Módulo Responsables de Pacientes
**Sistema:** Clínica Lichi  
**Módulo:** Clínica → Responsables  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: crear, editar, eliminar y ver eliminados. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear y editar, pero no eliminar. |
| **Usuario autenticado** | Cualquier rol con sesión activa. Puede consultar el listado. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-RES-001 | Listar y buscar responsables | Usuario autenticado |
| CUS-RES-002 | Ver detalle de responsable | Usuario autenticado |
| CUS-RES-003 | Crear responsable | Administrador / Recepcionista |
| CUS-RES-004 | Editar responsable | Administrador / Recepcionista |
| CUS-RES-005 | Eliminar responsable (borrado lógico) | Administrador |

---

## CUS-RES-001 — Listar y buscar responsables

| Campo | Detalle |
|---|---|
| **ID** | CUS-RES-001 |
| **Módulo** | Responsables |
| **Nombre** | Listar y buscar responsables |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario visualiza el listado paginado de responsables activos y puede filtrarlo mediante búsqueda libre (nombre, documento). |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El usuario navega a Responsables. <br>2. El sistema consulta `GET /api/pacienteresponsable/` y muestra la lista con nombre, documento, teléfono y relación con pacientes. <br>3. El usuario puede buscar con debounce de 300 ms. <br>4. El usuario puede hacer clic en una fila para ver el detalle. |
| **Flujo alterno** | **A1 – Sin resultados:** Mensaje "Sin responsables que coincidan." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo registros con `is_deleted = False`. <br>RN-02: El botón Eliminar solo se muestra para `admin`. |
| **Post-condición** | Listado paginado de responsables activos visible. |

---

## CUS-RES-002 — Ver detalle de responsable

| Campo | Detalle |
|---|---|
| **ID** | CUS-RES-002 |
| **Módulo** | Responsables |
| **Nombre** | Ver detalle de responsable |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario selecciona un responsable para ver su ficha completa en un modal con datos personales, parentesco y pacientes vinculados. |
| **Pre-condición** | El usuario está autenticado. El responsable existe y está activo. |
| **Flujo básico** | 1. El usuario hace clic en una fila. <br>2. El modal abre en modo `'ver'` con: datos personales de la persona (nombre, documento, teléfono, dirección), datos de responsable (parentesco) y lista de pacientes vinculados. <br>3. El actor puede hacer clic en "Editar" si tiene permiso. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | — |
| **Post-condición** | Ficha del responsable visible en modo solo lectura. |

---

## CUS-RES-003 — Crear responsable

| Campo | Detalle |
|---|---|
| **ID** | CUS-RES-003 |
| **Módulo** | Responsables |
| **Nombre** | Crear responsable |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor registra un nuevo responsable buscando su persona por documento. Si la persona no existe se crea junto con el responsable. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en "Nuevo responsable" (o presiona Insert). <br>2. El modal abre en modo `'crear'`. <br>3. El actor busca la persona por documento en el `BuscadorPersona`. <br>4. El sistema determina el modo: `crear_todo`, `agregar_paciente` (aquí: agregar_responsable) o `editar`. <br>5. El actor completa los datos de persona (si aplica) y el campo "Parentesco / Vínculo". <br>6. El sistema envía `POST /api/pacienteresponsable/` (y `POST /api/persona/` si aplica). <br>7. El modal se cierra y el responsable aparece en la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Documento duplicado:** HTTP 400. <br>**E2 – Campos requeridos vacíos:** HTTP 400. |
| **Reglas de negocio** | RN-03: El número de documento de `Persona` es único. <br>RN-04: El guardado es secuencial: primero `Persona`, luego `PacienteResponsable`. |
| **Post-condición** | Responsable creado y disponible para vincular a pacientes. Registrado en auditoría. |

---

## CUS-RES-004 — Editar responsable

| Campo | Detalle |
|---|---|
| **ID** | CUS-RES-004 |
| **Módulo** | Responsables |
| **Nombre** | Editar responsable |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica los datos personales o el vínculo de un responsable existente. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El responsable existe y no está eliminado. |
| **Flujo básico** | 1. El actor selecciona el responsable y hace clic en editar. <br>2. El modal abre en modo `'editar'` con los datos precargados. <br>3. El actor modifica y guarda. <br>4. El sistema envía `PATCH /api/pacienteresponsable/{id}/` (y `PATCH /api/persona/{id}/` si aplica). <br>5. El modal vuelve al modo lectura. |
| **Flujo alterno** | **A1 – Cierre sin guardar:** El guard de navegación muestra "¿Descartar cambios?". |
| **Flujo de excepción** | **E1 – Error de validación:** HTTP 400. |
| **Reglas de negocio** | — |
| **Post-condición** | Datos del responsable actualizados. Registrado en auditoría. |

---

## CUS-RES-005 — Eliminar responsable (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-RES-005 |
| **Módulo** | Responsables |
| **Nombre** | Eliminar responsable (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un responsable que no tenga pacientes activos vinculados. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El responsable no tiene pacientes activos vinculados. |
| **Flujo básico** | 1. El administrador hace clic en el ícono de papelera. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/pacienteresponsable/{id}/`. <br>4. El servidor verifica pacientes activos vinculados y marca `is_deleted = True`. <br>5. El responsable desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Responsable con pacientes activos:** HTTP 400 con "No se puede eliminar: tiene pacientes activos vinculados." |
| **Reglas de negocio** | RN-05: Solo `admin` puede eliminar. <br>RN-06: Borrado lógico. <br>RN-07: No se puede eliminar si tiene pacientes activos. |
| **Post-condición** | Responsable marcado `is_deleted = True`. Registrado en auditoría. |
