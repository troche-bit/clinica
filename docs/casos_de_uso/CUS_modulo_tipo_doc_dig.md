# Especificaciones de Casos de Uso — Módulo Tipo Documento Digitalizado
**Sistema:** Clínica Lichi  
**Módulo:** Mantenimiento → Tipo Documento Digitalizado  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: crear, editar, eliminar y restaurar. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear y editar, pero no eliminar. |
| **Usuario autenticado** | Cualquier rol con sesión activa. Puede consultar el listado (usado en upload de documentos de pacientes y prestadores). |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-TDD-001 | Listar y buscar tipos de documento | Usuario autenticado |
| CUS-TDD-002 | Ver detalle de tipo de documento | Usuario autenticado |
| CUS-TDD-003 | Crear tipo de documento | Administrador / Recepcionista |
| CUS-TDD-004 | Editar tipo de documento | Administrador / Recepcionista |
| CUS-TDD-005 | Eliminar tipo de documento (borrado lógico) | Administrador |

---

## CUS-TDD-001 — Listar y buscar tipos de documento

| Campo | Detalle |
|---|---|
| **ID** | CUS-TDD-001 |
| **Módulo** | Tipo Documento Digitalizado |
| **Nombre** | Listar y buscar tipos de documento |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario visualiza el catálogo de tipos de documentos digitalizados disponibles (ej: Historia Clínica, Análisis de Sangre, RX) y puede filtrarlo con búsqueda. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El usuario navega a Mantenimiento → Tipo Documento Digitalizado. <br>2. El sistema consulta `GET /api/tipo-doc-dig/` y muestra los tipos activos con nombre y `storage_key`. <br>3. El usuario puede buscar por nombre. <br>4. El usuario puede seleccionar uno para ver el detalle. |
| **Flujo alterno** | **A1 – Sin resultados:** Mensaje "Sin tipos que coincidan." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo se muestran registros con `is_deleted = False`. |
| **Post-condición** | Listado de tipos activos visible. |

---

## CUS-TDD-002 — Ver detalle de tipo de documento

| Campo | Detalle |
|---|---|
| **ID** | CUS-TDD-002 |
| **Módulo** | Tipo Documento Digitalizado |
| **Nombre** | Ver detalle de tipo de documento |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario selecciona un tipo para ver nombre, descripción y `storage_key` en el panel lateral. |
| **Pre-condición** | El usuario está autenticado. Existe al menos un tipo activo. |
| **Flujo básico** | 1. El usuario hace clic en una fila. <br>2. El panel muestra nombre, descripción y `storage_key` (en fuente monoespaciada). |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-02: El `storage_key` es inmutable tras la creación (desacopla el nombre visible de la ruta física en disco). |
| **Post-condición** | Datos del tipo visibles en el panel. |

---

## CUS-TDD-003 — Crear tipo de documento

| Campo | Detalle |
|---|---|
| **ID** | CUS-TDD-003 |
| **Módulo** | Tipo Documento Digitalizado |
| **Nombre** | Crear tipo de documento |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor registra un nuevo tipo de documento digitalizado con su nombre visible y un identificador de ruta (`storage_key`) automáticamente derivado del nombre. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en "Nuevo" (o presiona Insert). <br>2. El panel muestra el formulario con campos: nombre*, descripción y storage_key* (SlugField). <br>3. El actor completa el nombre; el `storage_key` puede derivarse automáticamente del nombre en slug. <br>4. El actor guarda (clic en "Guardar" o F10). <br>5. El sistema envía `POST /api/tipo-doc-dig/`. <br>6. El nuevo tipo aparece en la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado:** HTTP 400. <br>**E2 – storage_key duplicado:** HTTP 400 con "Este storage_key ya está en uso." <br>**E3 – storage_key con caracteres inválidos:** HTTP 400 (solo letras, números y guiones). |
| **Reglas de negocio** | RN-03: El nombre es único (case-insensitive) entre registros activos. <br>RN-04: El `storage_key` es un slug único que determina la ruta física de los archivos subidos. <br>RN-05: Una vez creado, el `storage_key` no debe cambiarse para no romper rutas existentes. |
| **Post-condición** | Nuevo tipo disponible en el selector de documentos de pacientes y prestadores. Registrado en auditoría. |

---

## CUS-TDD-004 — Editar tipo de documento

| Campo | Detalle |
|---|---|
| **ID** | CUS-TDD-004 |
| **Módulo** | Tipo Documento Digitalizado |
| **Nombre** | Editar tipo de documento |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica el nombre o la descripción de un tipo existente. El `storage_key` no debe modificarse. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El tipo existe y no está eliminado. |
| **Flujo básico** | 1. El actor selecciona el tipo y hace clic en editar. <br>2. El panel muestra el formulario con datos precargados. El campo `storage_key` está deshabilitado o se muestra en modo solo lectura para desalentar su cambio. <br>3. El actor modifica nombre o descripción y guarda. <br>4. El sistema envía `PATCH /api/tipo-doc-dig/{id}/`. <br>5. El panel vuelve al modo lectura. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado:** HTTP 400. |
| **Reglas de negocio** | RN-03: Unicidad de nombre. RN-05: No cambiar el `storage_key` para evitar rutas rotas. |
| **Post-condición** | Nombre y/o descripción actualizados. Registrado en auditoría. |

---

## CUS-TDD-005 — Eliminar tipo de documento (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-TDD-005 |
| **Módulo** | Tipo Documento Digitalizado |
| **Nombre** | Eliminar tipo de documento (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un tipo de documento que no tenga documentos activos de pacientes ni de prestadores vinculados. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El tipo no tiene documentos activos en `DocumentoDigPaciente` ni en `DocumentoDigPrestador`. |
| **Flujo básico** | 1. El administrador selecciona el tipo y hace clic en eliminar. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/tipo-doc-dig/{id}/`. <br>4. El servidor verifica ambas relaciones y marca `is_deleted = True`. <br>5. El tipo desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Tipo con documentos activos de pacientes:** HTTP 400 con "No se puede eliminar: tiene documentos activos vinculados." <br>**E2 – Tipo con documentos activos de prestadores:** HTTP 400 con el mismo mensaje. |
| **Reglas de negocio** | RN-06: Solo `admin` puede eliminar. <br>RN-07: Borrado lógico. <br>RN-08: Se deben verificar AMBAS relaciones: `documentos` (paciente) y `documentos_prestador` (prestador). |
| **Post-condición** | Tipo marcado `is_deleted = True`. No aparece en selectores de upload. Registrado en auditoría. |
