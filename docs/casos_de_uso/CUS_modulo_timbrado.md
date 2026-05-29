# Especificaciones de Casos de Uso — Módulo Timbrado
**Sistema:** Clínica Lichi  
**Módulo:** Facturación → Configuración → Timbrado  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Único actor con acceso completo: crear, editar, eliminar y restaurar timbrados. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-TIM-001 | Listar y filtrar timbrados | Administrador |
| CUS-TIM-002 | Ver detalle de timbrado | Administrador |
| CUS-TIM-003 | Crear timbrado | Administrador |
| CUS-TIM-004 | Editar timbrado | Administrador |
| CUS-TIM-005 | Eliminar timbrado (borrado lógico) | Administrador |

---

## CUS-TIM-001 — Listar y filtrar timbrados

| Campo | Detalle |
|---|---|
| **ID** | CUS-TIM-001 |
| **Módulo** | Timbrado |
| **Nombre** | Listar y filtrar timbrados |
| **Actor** | Administrador |
| **Descripción** | El administrador visualiza el listado de timbrados del sistema (vigentes e históricos) con opción de filtrar por vigencia. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador navega a Facturación → Timbrado. <br>2. El sistema consulta `GET /api/timbrado/` y muestra: número de timbrado, establecimiento, punto de expedición, rango de comprobantes, vigencia desde/hasta, estado. <br>3. El administrador puede filtrar por vigencia (`?vigente=true|false`) y buscar por texto. |
| **Flujo alterno** | **A1 – Sin timbrados:** Mensaje "Sin timbrados registrados." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo `admin` puede acceder. RN-02: Solo registros con `is_deleted = False`. |
| **Post-condición** | Listado de timbrados visible con filtros de vigencia aplicados. |

---

## CUS-TIM-002 — Ver detalle de timbrado

| Campo | Detalle |
|---|---|
| **ID** | CUS-TIM-002 |
| **Módulo** | Timbrado |
| **Nombre** | Ver detalle de timbrado |
| **Actor** | Administrador |
| **Descripción** | El administrador selecciona un timbrado para ver su configuración completa en el panel lateral. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. Existe al menos un timbrado. |
| **Flujo básico** | 1. El administrador hace clic en una fila. <br>2. El panel muestra: número de timbrado, establecimiento, punto de expedición, número de inicio, número de fin, vigencia desde/hasta, descripción. <br>3. Muestra el próximo número disponible si está vigente. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-03: Un timbrado está vigente si la fecha actual está entre `vigente_desde` y `vigente_hasta`. |
| **Post-condición** | Detalle del timbrado visible en el panel. |

---

## CUS-TIM-003 — Crear timbrado

| Campo | Detalle |
|---|---|
| **ID** | CUS-TIM-003 |
| **Módulo** | Timbrado |
| **Nombre** | Crear timbrado |
| **Actor** | Administrador |
| **Descripción** | El administrador registra un nuevo timbrado emitido por la SET (Subsecretaría de Estado de Tributación) con su configuración de comprobantes. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador hace clic en "Nuevo" (o presiona Insert). <br>2. El panel muestra el formulario con campos: número de timbrado*, establecimiento*, punto de expedición*, número de inicio*, número de fin*, vigente desde*, vigente hasta*, descripción. <br>3. El administrador completa los campos y guarda (F10 o clic en "Guardar"). <br>4. El sistema envía `POST /api/timbrado/`. <br>5. El nuevo timbrado aparece en la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Número de timbrado duplicado:** HTTP 400. <br>**E2 – Rango de comprobantes inválido (inicio ≥ fin):** HTTP 400. <br>**E3 – Vigencia inválida (desde ≥ hasta):** HTTP 400. |
| **Reglas de negocio** | RN-04: El número de timbrado debe ser único entre registros activos. <br>RN-05: `nro_inicio` debe ser menor que `nro_fin`. <br>RN-06: Solo puede haber un timbrado vigente simultáneamente para el mismo punto de expedición. |
| **Post-condición** | Timbrado creado. Disponible para emitir facturas si está vigente. Registrado en auditoría. |

---

## CUS-TIM-004 — Editar timbrado

| Campo | Detalle |
|---|---|
| **ID** | CUS-TIM-004 |
| **Módulo** | Timbrado |
| **Nombre** | Editar timbrado |
| **Actor** | Administrador |
| **Descripción** | El administrador modifica los datos de un timbrado existente. Solo se recomienda editar timbrados sin facturas emitidas. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El timbrado existe y no está eliminado. |
| **Flujo básico** | 1. El administrador selecciona el timbrado y hace clic en editar. <br>2. El panel muestra el formulario con los datos precargados. <br>3. El administrador modifica y guarda. <br>4. El sistema envía `PATCH /api/timbrado/{id}/`. <br>5. El panel vuelve al modo lectura. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Validaciones de rango o vigencia:** HTTP 400. |
| **Reglas de negocio** | RN-04: Unicidad de número de timbrado excluyendo el registro actual. |
| **Post-condición** | Timbrado actualizado. Registrado en auditoría. |

---

## CUS-TIM-005 — Eliminar timbrado (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-TIM-005 |
| **Módulo** | Timbrado |
| **Nombre** | Eliminar timbrado (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un timbrado que no tenga facturas activas emitidas. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El timbrado no tiene facturas activas en `VentaFactCab`. |
| **Flujo básico** | 1. El administrador hace clic en eliminar. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/timbrado/{id}/`. <br>4. El servidor verifica que no haya facturas activas y marca `is_deleted = True`. <br>5. El timbrado desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Timbrado con facturas activas:** HTTP 400 con "No se puede eliminar: tiene facturas activas vinculadas." |
| **Reglas de negocio** | RN-07: Solo `admin` puede eliminar. RN-08: Borrado lógico. RN-09: Sin facturas activas. |
| **Post-condición** | Timbrado marcado `is_deleted = True`. No puede usarse para emitir nuevas facturas. Registrado en auditoría. |
