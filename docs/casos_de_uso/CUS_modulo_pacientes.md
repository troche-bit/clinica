# Especificaciones de Casos de Uso — Módulo Pacientes
**Sistema:** Clínica Lichi  
**Módulo:** Clínica → Pacientes  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: crear, editar, eliminar, restaurar y ver eliminados. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear y editar pacientes, pero no eliminar. |
| **Médico** | Usuario con rol `medico`. Solo puede consultar datos de pacientes. |
| **Secretaria médico** | Usuario con rol `secretaria_medico`. Solo puede consultar datos de pacientes. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-PAC-001 | Listar y buscar pacientes | Usuario autenticado |
| CUS-PAC-002 | Ver detalle de paciente | Usuario autenticado |
| CUS-PAC-003 | Crear paciente | Administrador / Recepcionista |
| CUS-PAC-004 | Editar paciente | Administrador / Recepcionista |
| CUS-PAC-005 | Eliminar paciente (borrado lógico) | Administrador |
| CUS-PAC-006 | Ver historial de documentos del paciente | Usuario autenticado |
| CUS-PAC-007 | Subir documento digitalizado al paciente | Administrador / Recepcionista |
| CUS-PAC-008 | Ver historial de consultas del paciente | Usuario autenticado |

---

## CUS-PAC-001 — Listar y buscar pacientes

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAC-001 |
| **Módulo** | Pacientes |
| **Nombre** | Listar y buscar pacientes |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario visualiza el listado paginado de pacientes activos y puede filtrarlo mediante búsqueda libre (nombre, apellido, documento) con debounce de 300 ms. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El usuario navega a Pacientes. <br>2. El sistema consulta `GET /api/paciente/` (20 por página) y muestra la lista con nombre, documento, fecha de nacimiento, teléfono y responsable. <br>3. Cada fila incluye un hint "Clic para ver detalle" y botones de editar/eliminar (según rol). <br>4. El usuario puede buscar; los resultados se filtran tras 300 ms de inactividad. <br>5. Puede navegar entre páginas. |
| **Flujo alterno** | **A1 – Sin resultados:** Mensaje "Sin pacientes que coincidan." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo registros con `is_deleted = False`. <br>RN-02: El botón Eliminar solo se muestra para `admin`. |
| **Post-condición** | Listado paginado y filtrado de pacientes activos visible. |

---

## CUS-PAC-002 — Ver detalle de paciente

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAC-002 |
| **Módulo** | Pacientes |
| **Nombre** | Ver detalle de paciente |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario selecciona un paciente para ver su ficha completa en un modal de detalle con secciones organizadas: datos personales, datos de paciente, documentos digitalizados e historial de consultas. |
| **Pre-condición** | El usuario está autenticado. El paciente existe y está activo. |
| **Flujo básico** | 1. El usuario hace clic en una fila de la tabla de pacientes. <br>2. El sistema abre el modal en modo `'ver'` con: <br>   — Sección "Datos personales": nombre, documento, sexo, fecha nacimiento, teléfono, dirección, ciudad. <br>   — Sección "Datos de paciente": grupo sanguíneo, alergias (CampoDestacado amarillo), enfermedades crónicas (CampoDestacado rojo), observaciones, responsable vinculado. <br>   — Tab "Documentos": listado de documentos digitalizados con botón Eye para visualizar. <br>   — Tab "Historial": consultas ordenadas por fecha descendente. <br>3. El actor puede hacer clic en "Editar" para pasar al modo edición. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-03: Las alergias se muestran con fondo amarillo y las enfermedades crónicas con fondo rojo para destacar datos críticos. <br>RN-04: Si el campo está vacío se muestra "Sin registro" en los campos destacados. |
| **Post-condición** | El modal muestra la ficha completa del paciente en modo solo lectura. |

---

## CUS-PAC-003 — Crear paciente

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAC-003 |
| **Módulo** | Pacientes |
| **Nombre** | Crear paciente |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor registra un nuevo paciente buscando primero su persona por documento. Si la persona no existe se crea junto con el paciente; si ya existe se vincula. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en "Nuevo paciente" (o presiona Insert). <br>2. El sistema abre el modal en modo `'crear'`. <br>3. El actor ingresa el número de documento en el `BuscadorPersona`. <br>4. El sistema consulta `GET /api/persona/buscar/?nro_documento=X` y retorna el estado: <br>   — `crear_todo`: la persona no existe → el actor completa todos los campos de Persona + Paciente. <br>   — `agregar_paciente`: la persona existe pero no es paciente → el actor solo completa los campos de Paciente. <br>   — `editar`: la persona ya es paciente → el modal cambia a modo edición. <br>5. El actor completa los datos requeridos y guarda (clic en "Guardar" o F10). <br>6. El sistema envía `POST /api/paciente/` (y `POST /api/persona/` si aplica). <br>7. El modal se cierra; el paciente aparece en la lista. Toast de confirmación. |
| **Flujo alterno** | **A1 – Responsable vinculado:** El formulario incluye un selector de responsable que busca por documento con `BuscadorPersona` en modo responsable. |
| **Flujo de excepción** | **E1 – Documento duplicado:** HTTP 400 con "Ya existe una persona con ese número de documento." <br>**E2 – Campos requeridos vacíos:** HTTP 400 con errores de validación. |
| **Reglas de negocio** | RN-05: El número de documento de la persona es único en el sistema. <br>RN-06: El guardado es secuencial: primero se crea/actualiza `Persona`, luego se crea `Paciente`. <br>RN-07: Todos los nuevos pacientes quedan activos (`is_deleted = False`). |
| **Post-condición** | El paciente existe en la base de datos vinculado a su `Persona`. Registrado en auditoría. Puede ser asignado a turnos de agenda. |

---

## CUS-PAC-004 — Editar paciente

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAC-004 |
| **Módulo** | Pacientes |
| **Nombre** | Editar paciente |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica los datos personales y/o clínicos de un paciente existente. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El paciente existe y no está eliminado. |
| **Flujo básico** | 1. El actor selecciona el paciente y hace clic en editar (desde la tabla o desde el modal de detalle). <br>2. El modal abre en modo `'editar'` con todos los datos precargados. <br>3. El actor modifica los campos deseados y guarda. <br>4. El sistema envía `PATCH /api/paciente/{id}/` (y `PATCH /api/persona/{id}/` si aplica). <br>5. El modal vuelve al modo lectura con los datos actualizados. Toast de confirmación. |
| **Flujo alterno** | **A1 – Cierre sin guardar:** El guard de navegación muestra "¿Descartar cambios?" si el actor comenzó a editar. |
| **Flujo de excepción** | **E1 – Error de validación:** HTTP 400 con mensajes de campo. |
| **Reglas de negocio** | RN-08: El número de documento de `Persona` no puede cambiarse si ya tiene otros registros dependientes. |
| **Post-condición** | Datos del paciente actualizados. Registrado en auditoría. |

---

## CUS-PAC-005 — Eliminar paciente (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAC-005 |
| **Módulo** | Pacientes |
| **Nombre** | Eliminar paciente (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un paciente que no tenga citas activas en la agenda. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El paciente no tiene citas con estado `disponible`, `ocupado` o `realizado` en `Agenda`. |
| **Flujo básico** | 1. El administrador hace clic en el ícono de papelera del paciente. <br>2. El sistema muestra el `ConfirmDialog`. <br>3. El administrador confirma. <br>4. El sistema envía `DELETE /api/paciente/{id}/`. <br>5. El servidor verifica citas activas y marca `is_deleted = True`. <br>6. El paciente desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Paciente con citas activas:** HTTP 400 con "No se puede eliminar: tiene citas activas en la agenda." |
| **Reglas de negocio** | RN-09: Solo `admin` puede eliminar pacientes. <br>RN-10: Borrado lógico (`is_deleted = True`). <br>RN-11: No se puede eliminar con citas activas en cualquiera de los estados no cancelados. |
| **Post-condición** | Paciente marcado `is_deleted = True`. No aparece en listas activas ni en el buscador de asignación de turnos. Registrado en auditoría. |

---

## CUS-PAC-006 — Ver historial de documentos del paciente

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAC-006 |
| **Módulo** | Pacientes |
| **Nombre** | Ver historial de documentos del paciente |
| **Actor** | Usuario autenticado |
| **Descripción** | El actor accede a la pestaña "Documentos" dentro del modal de detalle del paciente para ver todos sus documentos digitalizados con la posibilidad de visualizarlos. |
| **Pre-condición** | El usuario está autenticado. El paciente tiene al menos un documento subido. |
| **Flujo básico** | 1. El actor abre el modal de detalle del paciente. <br>2. Hace clic en la pestaña "Documentos". <br>3. El sistema consulta `GET /api/documentos/?paciente={id}` y muestra los documentos: nombre, tipo y fecha. <br>4. El actor hace clic en el ícono Eye de un documento. <br>5. El sistema descarga el archivo con `fetch` nativo (con token JWT) y lo muestra: imágenes en overlay de pantalla completa, otros archivos en nueva pestaña. |
| **Flujo alterno** | **A1 – Sin documentos:** Se muestra "Sin documentos registrados." |
| **Flujo de excepción** | **E1 – Error al descargar:** El botón Eye vuelve a su estado normal silenciosamente. |
| **Reglas de negocio** | RN-12: El ícono de visualización es Eye (no Download). <br>RN-13: Imágenes (jpg, jpeg, png, gif, webp, bmp) se muestran en overlay; otros en nueva pestaña. |
| **Post-condición** | El actor puede ver el contenido del documento seleccionado. |

---

## CUS-PAC-007 — Subir documento digitalizado al paciente

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAC-007 |
| **Módulo** | Pacientes |
| **Nombre** | Subir documento digitalizado al paciente |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor sube uno o más archivos digitalizados para un paciente, seleccionando el tipo de documento para cada uno. Los cambios son staged y se confirman al guardar el formulario. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El modal está en modo edición. |
| **Flujo básico** | 1. El actor está en el formulario de edición del paciente. <br>2. En la sección "Documentos" el actor arrastra o selecciona uno o más archivos. <br>3. Cada archivo aparece con un selector de "Tipo de documento" y una miniatura (si es imagen) con badge "Se subirá al guardar". <br>4. El actor asigna el tipo a cada archivo nuevo. <br>5. El actor hace clic en "Guardar". <br>6. El sistema primero guarda los datos del paciente, luego sube los archivos vía `POST /api/documentos/` (multipart/form-data, con `fetch` nativo). <br>7. Los archivos quedan asociados al paciente con el tipo seleccionado. |
| **Flujo alterno** | **A1 – Archivo sin tipo asignado:** El sistema muestra un error de validación y bloquea el guardado hasta que se asigne un tipo a todos los archivos nuevos. |
| **Flujo de excepción** | **E1 – Error de upload:** El sistema muestra el error del archivo que falló. |
| **Reglas de negocio** | RN-14: La subida usa `fetch` nativo (no Axios) para compatibilidad con multipart/form-data. <br>RN-15: Se usa el patrón staged: los archivos no se suben hasta confirmar el guardado del formulario completo. <br>RN-16: Las previsualizaciones de imagen se generan con `URL.createObjectURL` y se liberan al desmontar el componente. |
| **Post-condición** | Los archivos quedan almacenados en `MEDIA_ROOT/documentos/{storage_key}/{año}/` y vinculados al paciente. |

---

## CUS-PAC-008 — Ver historial de consultas del paciente

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAC-008 |
| **Módulo** | Pacientes |
| **Nombre** | Ver historial de consultas del paciente |
| **Actor** | Usuario autenticado |
| **Descripción** | El actor accede a la pestaña "Historial" del modal de detalle del paciente para ver todas sus consultas médicas ordenadas cronológicamente. |
| **Pre-condición** | El usuario está autenticado. El paciente tiene al menos una consulta registrada. |
| **Flujo básico** | 1. El actor abre el modal de detalle del paciente. <br>2. Hace clic en la pestaña "Historial". <br>3. El sistema consulta `GET /api/consultas/?paciente={id}` y muestra las consultas con fecha, prestador, especialidad, evento clínico y estado. <br>4. Cada consulta puede expandirse para ver documentos adjuntos de esa consulta. |
| **Flujo alterno** | **A1 – Sin consultas:** Se muestra "Sin consultas registradas." |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-17: Los documentos de cada consulta se cargan con `useDocumentosPorConsulta` solo si la consulta está expandida y tiene documentos. |
| **Post-condición** | El actor puede revisar todo el historial médico del paciente. |
