# Especificaciones de Casos de Uso — Módulo Auditoría
**Sistema:** Clínica Lichi  
**Módulo:** Administración → Auditoría  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Único actor con acceso al módulo. Puede consultar y filtrar el registro completo de cambios del sistema. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-AUD-001 | Listar y filtrar registros de auditoría | Administrador |
| CUS-AUD-002 | Ver detalle de un registro de auditoría | Administrador |
| CUS-AUD-003 | Filtrar por tabla | Administrador |
| CUS-AUD-004 | Filtrar por acción | Administrador |
| CUS-AUD-005 | Filtrar por usuario y rango de fechas | Administrador |

---

## CUS-AUD-001 — Listar y filtrar registros de auditoría

| Campo | Detalle |
|---|---|
| **ID** | CUS-AUD-001 |
| **Módulo** | Auditoría |
| **Nombre** | Listar y filtrar registros de auditoría |
| **Actor** | Administrador |
| **Descripción** | El administrador visualiza el historial completo de cambios del sistema: creaciones, ediciones y eliminaciones de todos los módulos, con paginación y múltiples filtros combinables. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador navega a Administración → Auditoría. <br>2. El sistema consulta `GET /api/auditoria/` (paginado a 20 ítems) y muestra los registros más recientes. <br>3. Cada fila muestra: fecha/hora, tabla afectada, ID de registro, acción (CREAR / EDITAR / ELIMINAR), usuario que realizó el cambio e IP de origen. <br>4. El administrador puede aplicar filtros combinando: tabla, acción, usuario, fecha_desde y fecha_hasta. <br>5. Los resultados se actualizan al cambiar cualquier filtro. |
| **Flujo alterno** | **A1 – Sin resultados con filtros aplicados:** Se muestra el mensaje "Sin registros que coincidan con los filtros." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo el rol `admin` puede acceder al módulo de auditoría. <br>RN-02: Los registros de auditoría nunca se eliminan; son inmutables una vez creados. <br>RN-03: La tabla `auditoria_registro` no hereda `BaseModel`; no tiene `is_deleted`. |
| **Post-condición** | El administrador visualiza el historial de cambios filtrado. |

---

## CUS-AUD-002 — Ver detalle de un registro de auditoría

| Campo | Detalle |
|---|---|
| **ID** | CUS-AUD-002 |
| **Módulo** | Auditoría |
| **Nombre** | Ver detalle de un registro de auditoría |
| **Actor** | Administrador |
| **Descripción** | El administrador selecciona un registro de auditoría para ver los datos antes y después del cambio en formato JSON expandido. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. Existe al menos un registro de auditoría. |
| **Flujo básico** | 1. El administrador hace clic en una fila del historial. <br>2. El sistema muestra un panel o modal con el detalle completo del registro: <br>   — Tabla, ID del registro afectado, acción, usuario, IP, fecha/hora. <br>   — `datos_antes`: snapshot del objeto antes del cambio (JSON). <br>   — `datos_despues`: snapshot del objeto después del cambio (JSON). <br>3. Para acciones CREAR, `datos_antes` es `null`. Para acciones ELIMINAR, `datos_despues` es `null`. |
| **Flujo alterno** | **A1 – Acción CREAR:** Solo `datos_despues` tiene contenido. <br>**A2 – Acción ELIMINAR:** Solo `datos_antes` tiene contenido. |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-04: Las contraseñas siempre aparecen como `'***'` en los snapshots; nunca en texto claro. <br>RN-05: Los campos M2M (ej: `especialidades`) se serializan como listas de PKs. |
| **Post-condición** | El administrador puede comparar el estado antes y después del cambio registrado. |

---

## CUS-AUD-003 — Filtrar por tabla

| Campo | Detalle |
|---|---|
| **ID** | CUS-AUD-003 |
| **Módulo** | Auditoría |
| **Nombre** | Filtrar por tabla |
| **Actor** | Administrador |
| **Descripción** | El administrador restringe el historial a los cambios de un módulo o modelo específico (ej: solo ver los cambios en `Paciente` o en `VentaFactCab`). |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador selecciona una tabla del selector de filtros. <br>2. El sistema envía `GET /api/auditoria/?tabla=Paciente` y filtra los resultados. <br>3. Solo se muestran registros cuyo campo `tabla` coincida con el valor seleccionado. |
| **Flujo alterno** | **A1 – Selector en blanco:** Se muestran registros de todas las tablas. |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-06: El parámetro `tabla` es exacto (no partial match). El selector muestra todas las tablas auditadas. |
| **Post-condición** | El historial está filtrado por la tabla seleccionada. |

---

## CUS-AUD-004 — Filtrar por acción

| Campo | Detalle |
|---|---|
| **ID** | CUS-AUD-004 |
| **Módulo** | Auditoría |
| **Nombre** | Filtrar por acción |
| **Actor** | Administrador |
| **Descripción** | El administrador restringe el historial a un tipo de acción específico: CREAR, EDITAR o ELIMINAR. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador selecciona una acción del selector (CREAR / EDITAR / ELIMINAR). <br>2. El sistema envía `GET /api/auditoria/?accion=ELIMINAR` y filtra. <br>3. Solo se muestran los registros de ese tipo de acción. |
| **Flujo alterno** | **A1 – Sin selección:** Se muestran todos los tipos de acción. |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-07: Los tres valores de `accion` son fijos: `CREAR`, `EDITAR`, `ELIMINAR`. |
| **Post-condición** | El historial está filtrado por la acción seleccionada. |

---

## CUS-AUD-005 — Filtrar por usuario y rango de fechas

| Campo | Detalle |
|---|---|
| **ID** | CUS-AUD-005 |
| **Módulo** | Auditoría |
| **Nombre** | Filtrar por usuario y rango de fechas |
| **Actor** | Administrador |
| **Descripción** | El administrador acota el historial a los cambios realizados por un usuario específico y/o dentro de un rango de fechas determinado. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador selecciona un usuario del selector y/o ingresa `fecha_desde` y `fecha_hasta`. <br>2. El sistema envía `GET /api/auditoria/?usuario={id}&fecha_desde=YYYY-MM-DD&fecha_hasta=YYYY-MM-DD`. <br>3. Los registros se filtran combinando todos los parámetros activos. |
| **Flujo alterno** | **A1 – Solo fecha_desde:** Filtra desde esa fecha hasta hoy. <br>**A2 – Solo fecha_hasta:** Filtra desde el inicio hasta esa fecha. <br>**A3 – Solo usuario:** Muestra todos los cambios de ese usuario sin límite de fecha. |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-08: Los filtros son aditivos (AND). Se pueden combinar tabla + acción + usuario + rango. |
| **Post-condición** | El historial está filtrado por los criterios combinados seleccionados. |
