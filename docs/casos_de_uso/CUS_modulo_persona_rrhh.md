# Especificaciones de Casos de Uso — Módulo Persona RRHH (Prestadores)
**Sistema:** Clínica Lichi  
**Módulo:** Administración → Persona RRHH  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Único rol con acceso completo: crear, editar, eliminar, restaurar y generar informes. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-RRH-001 | Listar y buscar prestadores | Administrador |
| CUS-RRH-002 | Ver detalle de prestador | Administrador |
| CUS-RRH-003 | Crear prestador | Administrador |
| CUS-RRH-004 | Editar prestador | Administrador |
| CUS-RRH-005 | Eliminar prestador (borrado lógico) | Administrador |
| CUS-RRH-006 | Gestionar documentos del prestador | Administrador |
| CUS-RRH-007 | Generar PDF de prestadores | Administrador |
| CUS-RRH-008 | Exportar prestadores a Excel | Administrador |

---

## CUS-RRH-001 — Listar y buscar prestadores

| Campo | Detalle |
|---|---|
| **ID** | CUS-RRH-001 |
| **Módulo** | Persona RRHH |
| **Nombre** | Listar y buscar prestadores |
| **Actor** | Administrador |
| **Descripción** | El administrador visualiza el listado paginado de prestadores activos con búsqueda por nombre, documento o matrícula. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador navega a Administración → Persona RRHH. <br>2. El sistema consulta `GET /api/personarrhh/` y muestra la lista con nombre, documento, cargo, especialidades, matrícula y estado. <br>3. El administrador puede buscar por texto con debounce de 300 ms. <br>4. Puede hacer clic en una fila para ver el detalle. |
| **Flujo alterno** | **A1 – Sin resultados:** Mensaje "Sin prestadores que coincidan." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo `admin` puede acceder a este módulo. <br>RN-02: Solo registros con `is_deleted = False`. |
| **Post-condición** | Listado de prestadores activos visible. |

---

## CUS-RRH-002 — Ver detalle de prestador

| Campo | Detalle |
|---|---|
| **ID** | CUS-RRH-002 |
| **Módulo** | Persona RRHH |
| **Nombre** | Ver detalle de prestador |
| **Actor** | Administrador |
| **Descripción** | El administrador selecciona un prestador para ver su ficha con datos personales, profesionales y documentos digitalizados adjuntos. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El prestador existe y está activo. |
| **Flujo básico** | 1. El administrador hace clic en una fila. <br>2. El modal abre en modo `'ver'` con: <br>   — Datos personales: nombre, documento, teléfono, dirección. <br>   — Datos profesionales: cargo, especialidades, matrícula, CUIT. <br>   — Tab "Documentos": lista de documentos del prestador (solo lectura — Eye para visualizar). <br>3. El administrador puede hacer clic en "Editar" para pasar al modo edición. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-03: El tab Documentos en modo detalle es solo lectura; el upload se hace solo desde el formulario de edición. |
| **Post-condición** | Ficha completa del prestador visible. |

---

## CUS-RRH-003 — Crear prestador

| Campo | Detalle |
|---|---|
| **ID** | CUS-RRH-003 |
| **Módulo** | Persona RRHH |
| **Nombre** | Crear prestador |
| **Actor** | Administrador |
| **Descripción** | El administrador registra un nuevo prestador (médico, especialista u otro personal) buscando primero su persona por documento. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador hace clic en "Nuevo" (o presiona Insert). <br>2. El modal abre en modo `'crear'`. <br>3. El administrador busca la persona por documento. El sistema determina el modo: `crear_todo`, `agregar_prestador` o `editar`. <br>4. El administrador completa: cargo, especialidades (con selector inline con creación), matrícula, CUIT. <br>5. El administrador guarda (clic en "Guardar" o F10). <br>6. El sistema envía `POST /api/personarrhh/` (y `POST /api/persona/` si aplica). <br>7. El modal se cierra; el prestador aparece en la lista. Toast de confirmación. |
| **Flujo alterno** | **A1 – Especialidad no existe:** El actor puede crearla inline con "+ Crear [texto]" desde el `SelectorEspecialidades`. |
| **Flujo de excepción** | **E1 – Documento duplicado:** HTTP 400. <br>**E2 – Matrícula duplicada:** HTTP 400 con "Ya existe un prestador con esa matrícula." |
| **Reglas de negocio** | RN-04: Solo `admin` puede crear prestadores. <br>RN-05: Las especialidades son M2M; se asignan como lista de IDs al guardar. |
| **Post-condición** | Nuevo prestador creado. Disponible en los selectores de horarios y agenda. Registrado en auditoría. |

---

## CUS-RRH-004 — Editar prestador

| Campo | Detalle |
|---|---|
| **ID** | CUS-RRH-004 |
| **Módulo** | Persona RRHH |
| **Nombre** | Editar prestador |
| **Actor** | Administrador |
| **Descripción** | El administrador modifica los datos personales y/o profesionales de un prestador, incluida la gestión de sus documentos digitalizados. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El prestador existe y no está eliminado. |
| **Flujo básico** | 1. El administrador selecciona el prestador y hace clic en editar. <br>2. El modal abre en modo `'editar'` con datos precargados. <br>3. El administrador puede modificar datos de persona, datos profesionales, especialidades y documentos (staged). <br>4. El administrador guarda (F10 o clic). <br>5. El sistema envía secuencialmente: `PATCH /api/persona/{id}/`, `PATCH /api/personarrhh/{id}/`, eliminaciones de documentos marcados y uploads de documentos nuevos. <br>6. El modal vuelve al modo lectura. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error en algún paso de la secuencia:** Se muestra el error específico del paso que falló. |
| **Reglas de negocio** | RN-06: La gestión de documentos usa el patrón staged: no se ejecuta hasta confirmar el guardado. <br>RN-07: Los archivos nuevos sin tipo asignado bloquean el guardado. |
| **Post-condición** | Datos del prestador actualizados. Registrado en auditoría. |

---

## CUS-RRH-005 — Eliminar prestador (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-RRH-005 |
| **Módulo** | Persona RRHH |
| **Nombre** | Eliminar prestador (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un prestador sin horarios ni citas activas. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El prestador no tiene horarios activos ni citas en la agenda. |
| **Flujo básico** | 1. El administrador hace clic en el ícono de papelera. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/personarrhh/{id}/`. <br>4. El servidor verifica dependencias y marca `is_deleted = True`. <br>5. El prestador desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Prestador con horarios activos:** HTTP 400. <br>**E2 – Prestador con citas activas:** HTTP 400. |
| **Reglas de negocio** | RN-08: Solo `admin` puede eliminar. RN-09: Borrado lógico. |
| **Post-condición** | Prestador marcado `is_deleted = True`. No aparece en selectores de horarios ni agenda. Registrado en auditoría. |

---

## CUS-RRH-006 — Gestionar documentos del prestador

| Campo | Detalle |
|---|---|
| **ID** | CUS-RRH-006 |
| **Módulo** | Persona RRHH |
| **Nombre** | Gestionar documentos del prestador |
| **Actor** | Administrador |
| **Descripción** | El administrador sube, visualiza y elimina documentos digitalizados (ej: título universitario, matrícula) asociados a un prestador. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El prestador está en modo edición en el modal. |
| **Flujo básico** | 1. En el formulario de edición, la sección "Documentos" muestra los documentos actuales. <br>2. El administrador puede: <br>   — Subir archivos nuevos (con asignación de tipo). <br>   — Marcar documentos existentes para eliminar (badge "Se eliminará al guardar" + botón ↩ para deshacer). <br>3. Al confirmar el guardado, el sistema ejecuta las operaciones: primero elimina los marcados (borrado físico + lógico), luego sube los nuevos. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Archivo nuevo sin tipo:** Bloquea el guardado con error de validación. |
| **Reglas de negocio** | RN-10: El borrado de documentos es físico (elimina el archivo en disco) + lógico (marca `is_deleted = True` en DB). RN-11: Patrón staged. |
| **Post-condición** | Los documentos del prestador quedan actualizados en disco y en la base de datos. |

---

## CUS-RRH-007 — Generar PDF de prestadores

| Campo | Detalle |
|---|---|
| **ID** | CUS-RRH-007 |
| **Módulo** | Persona RRHH |
| **Nombre** | Generar PDF de prestadores |
| **Actor** | Administrador |
| **Descripción** | El administrador genera un PDF del listado completo de prestadores activos usando WeasyPrint. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador hace clic en "Ver PDF" en la toolbar de la pantalla. <br>2. El sistema envía `GET /api/personarrhh/reporte-lista/` con `responseType: 'blob'`. <br>3. El backend consulta los prestadores activos y genera el PDF con WeasyPrint. <br>4. El PDF se abre en una nueva pestaña del navegador. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-12: El botón está deshabilitado mientras el PDF se genera (muestra "Generando..."). |
| **Post-condición** | PDF con el listado de prestadores abierto en nueva pestaña. |

---

## CUS-RRH-008 — Exportar prestadores a Excel

| Campo | Detalle |
|---|---|
| **ID** | CUS-RRH-008 |
| **Módulo** | Persona RRHH |
| **Nombre** | Exportar prestadores a Excel |
| **Actor** | Administrador |
| **Descripción** | El administrador descarga el listado de prestadores activos en formato Excel (.xlsx). |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador hace clic en "Descargar Excel" en la toolbar. <br>2. El sistema envía `GET /api/personarrhh/reporte-lista-excel/` con `responseType: 'blob'`. <br>3. El backend genera el archivo Excel con openpyxl. <br>4. El archivo se descarga automáticamente con el nombre `prestadores.xlsx`. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-13: La descarga usa un elemento `<a>` con `link.download` en lugar de `window.open`. |
| **Post-condición** | Archivo `prestadores.xlsx` descargado en el equipo del usuario. |
