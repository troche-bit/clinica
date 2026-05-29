# Especificaciones de Casos de Uso — Módulo Consultorios
**Sistema:** Clínica Lichi  
**Módulo:** Mantenimiento → Consultorios  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: crear, editar, eliminar y restaurar. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear y editar, pero no eliminar ni restaurar. |
| **Usuario autenticado** | Cualquier rol con sesión activa. Puede consultar el listado y el detalle. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-CON-001 | Listar y buscar consultorios | Usuario autenticado |
| CUS-CON-002 | Ver detalle de consultorio | Usuario autenticado |
| CUS-CON-003 | Crear consultorio | Administrador / Recepcionista |
| CUS-CON-004 | Editar consultorio | Administrador / Recepcionista |
| CUS-CON-005 | Eliminar consultorio (borrado lógico) | Administrador |
| CUS-CON-006 | Listar consultorios eliminados | Administrador |

---

## CUS-CON-001 — Listar y buscar consultorios

| Campo | Detalle |
|---|---|
| **ID** | CUS-CON-001 |
| **Módulo** | Consultorios |
| **Nombre** | Listar y buscar consultorios |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario visualiza el listado de consultorios activos y puede filtrarlo mediante un campo de búsqueda con debounce de 300 ms. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El usuario navega a Mantenimiento → Consultorios. <br>2. El sistema consulta `GET /api/consultorio/` y muestra todos los consultorios activos en una tabla. <br>3. El usuario puede escribir en el campo de búsqueda; tras 300 ms el sistema filtra los resultados por nombre. <br>4. El usuario puede hacer clic en una fila para ver el detalle en el panel lateral. |
| **Flujo alterno** | **A1 – Sin resultados:** Se muestra el mensaje "Sin consultorios que coincidan." |
| **Flujo de excepción** | **E1 – Error de red:** Se muestra un toast de error. |
| **Reglas de negocio** | RN-01: Solo se muestran registros con `is_deleted = False`. |
| **Post-condición** | El usuario visualiza el listado filtrado de consultorios. |

---

## CUS-CON-002 — Ver detalle de consultorio

| Campo | Detalle |
|---|---|
| **ID** | CUS-CON-002 |
| **Módulo** | Consultorios |
| **Nombre** | Ver detalle de consultorio |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario selecciona un consultorio de la lista para ver sus datos completos en el panel lateral derecho en modo de solo lectura. |
| **Pre-condición** | El usuario está autenticado. Existe al menos un consultorio activo. |
| **Flujo básico** | 1. El usuario hace clic en una fila de la tabla. <br>2. El panel lateral muestra los datos del consultorio: nombre y descripción. <br>3. El actor puede hacer clic en "Editar" para pasar al modo edición (si tiene permiso). |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-02: El botón Eliminar solo se muestra para el rol `admin`. |
| **Post-condición** | El panel lateral muestra los datos del consultorio en modo lectura. |

---

## CUS-CON-003 — Crear consultorio

| Campo | Detalle |
|---|---|
| **ID** | CUS-CON-003 |
| **Módulo** | Consultorios |
| **Nombre** | Crear consultorio |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor registra un nuevo consultorio con su nombre y descripción opcional. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en "Nuevo" (o presiona Insert). <br>2. El panel lateral muestra el formulario en modo creación con campos: nombre* y descripción. <br>3. El actor completa los campos y hace clic en "Guardar" (o presiona F10). <br>4. El sistema envía `POST /api/consultorio/` con los datos. <br>5. El panel se cierra; el nuevo consultorio aparece en la lista. Se muestra un toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado:** El sistema retorna HTTP 400 con el mensaje "Ya existe un consultorio con ese nombre." <br>**E2 – Campo nombre vacío:** El sistema retorna HTTP 400. |
| **Reglas de negocio** | RN-03: El nombre es único (case-insensitive) entre registros activos. <br>RN-04: La descripción es opcional. |
| **Post-condición** | El nuevo consultorio existe en la base de datos. El cambio queda registrado en auditoría. |

---

## CUS-CON-004 — Editar consultorio

| Campo | Detalle |
|---|---|
| **ID** | CUS-CON-004 |
| **Módulo** | Consultorios |
| **Nombre** | Editar consultorio |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica los datos de un consultorio existente desde el panel lateral en modo edición. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El consultorio existe y no está eliminado. |
| **Flujo básico** | 1. El actor selecciona un consultorio y hace clic en el ícono de edición (o en "Editar" dentro del panel de detalle). <br>2. El panel lateral muestra el formulario en modo edición con los datos actuales precargados. <br>3. El actor modifica los campos deseados y hace clic en "Guardar" (o presiona F10). <br>4. El sistema envía `PATCH /api/consultorio/{id}/` con los datos modificados. <br>5. El panel se actualiza y vuelve al modo lectura. Se muestra un toast de confirmación. |
| **Flujo alterno** | **A1 – Cambio de ítem sin guardar:** El sistema muestra el diálogo "¿Descartar cambios?" antes de navegar. |
| **Flujo de excepción** | **E1 – Nombre duplicado:** El sistema retorna HTTP 400. |
| **Reglas de negocio** | RN-03: El nombre es único entre registros activos (excluye el registro actual). |
| **Post-condición** | Los datos del consultorio quedan actualizados. El cambio queda registrado en auditoría. |

---

## CUS-CON-005 — Eliminar consultorio (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-CON-005 |
| **Módulo** | Consultorios |
| **Nombre** | Eliminar consultorio (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un consultorio que no tenga horarios de prestador activos vinculados. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El consultorio no tiene horarios activos en `HorarioPrestador`. |
| **Flujo básico** | 1. El administrador selecciona el consultorio y hace clic en el ícono de papelera (o en "Eliminar" en el panel). <br>2. El sistema muestra el `ConfirmDialog`. <br>3. El administrador confirma. <br>4. El sistema envía `DELETE /api/consultorio/{id}/`. <br>5. El servidor marca `is_deleted = True` y registra `fecha_eliminacion`. <br>6. El consultorio desaparece de la lista. Se muestra un toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Consultorio con horarios activos:** El sistema retorna HTTP 400 con el mensaje "No se puede eliminar: tiene horarios de prestador activos vinculados." |
| **Reglas de negocio** | RN-05: Solo el rol `admin` puede eliminar consultorios. <br>RN-06: El borrado es lógico; el registro permanece con `is_deleted = True`. <br>RN-07: No se puede eliminar si tiene horarios activos en `HorarioPrestador`. |
| **Post-condición** | El consultorio queda marcado con `is_deleted = True`. No aparece en listas activas ni en selectores de otros módulos. El cambio queda registrado en auditoría. |

---

## CUS-CON-006 — Listar consultorios eliminados

| Campo | Detalle |
|---|---|
| **ID** | CUS-CON-006 |
| **Módulo** | Consultorios |
| **Nombre** | Listar consultorios eliminados |
| **Actor** | Administrador |
| **Descripción** | El administrador accede a la lista de consultorios con borrado lógico para consulta histórica. No se implementa restauración en este módulo. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador accede al endpoint `GET /api/consultorio/eliminados/`. <br>2. El sistema devuelve los registros con `is_deleted = True` ordenados por `fecha_eliminacion` descendente. |
| **Flujo alterno** | **A1 – Sin eliminados:** El sistema devuelve lista vacía. |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-05: Solo accesible para el rol `admin`. |
| **Post-condición** | Se muestra la lista de consultorios eliminados lógicamente. |
