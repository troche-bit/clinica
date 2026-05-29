# Especificaciones de Casos de Uso — Módulo Ubicaciones
**Sistema:** Clínica Lichi  
**Módulo:** Mantenimiento → Ubicaciones  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: crear, editar y eliminar en los tres niveles. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear y editar, pero no eliminar. |
| **Usuario autenticado** | Cualquier rol con sesión activa. Solo puede consultar el listado (usado internamente por otros módulos). |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-UBI-001 | Listar países, departamentos y ciudades | Usuario autenticado |
| CUS-UBI-002 | Crear país | Administrador / Recepcionista |
| CUS-UBI-003 | Editar país | Administrador / Recepcionista |
| CUS-UBI-004 | Eliminar país (borrado lógico) | Administrador |
| CUS-UBI-005 | Crear departamento | Administrador / Recepcionista |
| CUS-UBI-006 | Editar departamento | Administrador / Recepcionista |
| CUS-UBI-007 | Eliminar departamento (borrado lógico) | Administrador |
| CUS-UBI-008 | Crear ciudad | Administrador / Recepcionista |
| CUS-UBI-009 | Editar ciudad | Administrador / Recepcionista |
| CUS-UBI-010 | Eliminar ciudad (borrado lógico) | Administrador |

---

## CUS-UBI-001 — Listar países, departamentos y ciudades

| Campo | Detalle |
|---|---|
| **ID** | CUS-UBI-001 |
| **Módulo** | Ubicaciones |
| **Nombre** | Listar países, departamentos y ciudades |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario visualiza la estructura jerárquica de ubicaciones en tres columnas en cascada: al seleccionar un país se cargan sus departamentos, y al seleccionar un departamento se cargan sus ciudades. Cada columna permite búsqueda local. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El usuario navega a Mantenimiento → Ubicaciones. <br>2. El sistema consulta `GET /api/pais/` y muestra todos los países activos en la columna izquierda. <br>3. El usuario selecciona un país; el sistema consulta `GET /api/departamento/?pais={id}` y muestra los departamentos en la columna central. <br>4. El usuario selecciona un departamento; el sistema consulta `GET /api/ciudad/?departamento={id}` y muestra las ciudades en la columna derecha. <br>5. Cada columna admite búsqueda local (filtrado client-side) visible solo cuando hay más de 5 ítems. |
| **Flujo alterno** | **A1 – Columna sin ítems:** Se muestra el mensaje "Sin [países/departamentos/ciudades] registrados." con botón para agregar el primero. |
| **Flujo de excepción** | **E1 – Error de red:** Se muestra un toast de error genérico. |
| **Reglas de negocio** | RN-01: Solo se muestran registros con `is_deleted = False`. <br>RN-02: Al cambiar el país seleccionado, el departamento y la ciudad activos se resetean automáticamente. <br>RN-03: La búsqueda local se limpia al cambiar el ítem padre. |
| **Post-condición** | El usuario visualiza la jerarquía de ubicaciones hasta el nivel ciudad. |

---

## CUS-UBI-002 — Crear país

| Campo | Detalle |
|---|---|
| **ID** | CUS-UBI-002 |
| **Módulo** | Ubicaciones |
| **Nombre** | Crear país |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor agrega un nuevo país a la lista de ubicaciones disponibles. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en el botón "+" de la columna Países. <br>2. Aparece una fila editable al final de la lista con un campo de texto. <br>3. El actor ingresa el nombre del país y presiona Enter o hace clic en el ícono de guardar. <br>4. El sistema envía `POST /api/pais/` con el nombre ingresado. <br>5. El nuevo país aparece en la lista con su ítem activo. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado:** El sistema retorna HTTP 400 con el mensaje "Ya existe un país con ese nombre." <br>**E2 – Campo vacío:** El sistema retorna HTTP 400 con mensaje de campo requerido. |
| **Reglas de negocio** | RN-04: El nombre del país es único (case-insensitive, solo entre registros activos). <br>RN-05: Presionar Escape cancela la creación sin guardar. |
| **Post-condición** | El nuevo país existe en la base de datos con `is_deleted = False`. El cambio queda registrado en auditoría. |

---

## CUS-UBI-003 — Editar país

| Campo | Detalle |
|---|---|
| **ID** | CUS-UBI-003 |
| **Módulo** | Ubicaciones |
| **Nombre** | Editar país |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica el nombre de un país existente mediante edición inline en la fila correspondiente. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El país existe y no está eliminado. |
| **Flujo básico** | 1. El actor hace clic en el ícono de edición de la fila del país. <br>2. La fila cambia a modo editable con el nombre actual precargado. <br>3. El actor modifica el nombre y presiona Enter o el ícono de guardar. <br>4. El sistema envía `PATCH /api/pais/{id}/` con el nombre actualizado. <br>5. La fila vuelve al modo lectura mostrando el nombre actualizado. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado:** El sistema retorna HTTP 400 con el mensaje "Ya existe un país con ese nombre." <br>**E2 – Edición de otro ítem sin guardar:** El sistema muestra un diálogo de confirmación "¿Descartar cambios?" antes de pasar al nuevo ítem. |
| **Reglas de negocio** | RN-04: La unicidad de nombre se valida solo entre registros activos. <br>RN-05: Presionar Escape cancela la edición y restaura el valor anterior. |
| **Post-condición** | El nombre del país queda actualizado. El cambio queda registrado en auditoría. |

---

## CUS-UBI-004 — Eliminar país (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-UBI-004 |
| **Módulo** | Ubicaciones |
| **Nombre** | Eliminar país (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un país, quitándolo de las listas activas sin borrarlo físicamente de la base de datos. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El país no tiene departamentos activos ni personas activas vinculadas. |
| **Flujo básico** | 1. El administrador hace clic en el ícono de eliminar de la fila del país. <br>2. El sistema muestra un diálogo de confirmación `ConfirmDialog`. <br>3. El administrador confirma la eliminación. <br>4. El sistema envía `DELETE /api/pais/{id}/`. <br>5. El servidor marca el registro con `is_deleted = True` y registra `fecha_eliminacion`. <br>6. El país desaparece de la lista. Se muestra un toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – País con departamentos activos:** El sistema retorna HTTP 400 con el mensaje "No se puede eliminar: tiene departamentos activos." <br>**E2 – País con personas activas vinculadas:** El sistema retorna HTTP 400 con mensaje de dependencia. |
| **Reglas de negocio** | RN-06: Solo el rol `admin` puede eliminar países. <br>RN-07: El borrado es lógico; el registro permanece en la base de datos con `is_deleted = True`. <br>RN-08: No se puede eliminar un país que tenga departamentos o personas activas vinculadas. |
| **Post-condición** | El país queda marcado con `is_deleted = True`. No aparece en listas activas. El cambio queda registrado en auditoría. |

---

## CUS-UBI-005 — Crear departamento

| Campo | Detalle |
|---|---|
| **ID** | CUS-UBI-005 |
| **Módulo** | Ubicaciones |
| **Nombre** | Crear departamento |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor agrega un nuevo departamento dentro del país seleccionado. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. Hay un país seleccionado en la columna izquierda. |
| **Flujo básico** | 1. El actor hace clic en "+" en la columna Departamentos. <br>2. El actor ingresa el nombre del departamento en la fila editable. <br>3. El sistema envía `POST /api/departamento/` con `{ nombre, pais: id_pais_activo }`. <br>4. El nuevo departamento aparece en la lista de la columna central. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado dentro del mismo país:** El sistema retorna HTTP 400 con el mensaje "Ya existe un departamento con ese nombre en este país." |
| **Reglas de negocio** | RN-09: La unicidad del nombre es por país (dos países distintos pueden tener departamentos con el mismo nombre). |
| **Post-condición** | El nuevo departamento existe y está vinculado al país seleccionado. El cambio queda registrado en auditoría. |

---

## CUS-UBI-006 — Editar departamento

| Campo | Detalle |
|---|---|
| **ID** | CUS-UBI-006 |
| **Módulo** | Ubicaciones |
| **Nombre** | Editar departamento |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica el nombre de un departamento existente mediante edición inline. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. Hay un departamento visible en la columna central. |
| **Flujo básico** | 1. El actor hace clic en el ícono de edición de la fila del departamento. <br>2. Modifica el nombre y confirma. <br>3. El sistema envía `PATCH /api/departamento/{id}/`. <br>4. La fila vuelve al modo lectura con el nombre actualizado. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado en el mismo país:** El sistema retorna HTTP 400. |
| **Reglas de negocio** | RN-09: La unicidad es por país. |
| **Post-condición** | Nombre actualizado. El cambio queda registrado en auditoría. |

---

## CUS-UBI-007 — Eliminar departamento (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-UBI-007 |
| **Módulo** | Ubicaciones |
| **Nombre** | Eliminar departamento (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un departamento que no tenga ciudades activas ni personas vinculadas. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El departamento no tiene ciudades activas ni personas activas vinculadas. |
| **Flujo básico** | 1. El administrador hace clic en eliminar. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/departamento/{id}/`. <br>4. El servidor marca `is_deleted = True`. El departamento desaparece de la lista. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Departamento con ciudades activas:** El sistema retorna HTTP 400. <br>**E2 – Departamento con personas activas:** El sistema retorna HTTP 400. |
| **Reglas de negocio** | RN-06: Solo `admin` puede eliminar. RN-07: Borrado lógico. RN-08: Sin dependencias activas. |
| **Post-condición** | Departamento marcado con `is_deleted = True`. Registrado en auditoría. |

---

## CUS-UBI-008 — Crear ciudad

| Campo | Detalle |
|---|---|
| **ID** | CUS-UBI-008 |
| **Módulo** | Ubicaciones |
| **Nombre** | Crear ciudad |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor agrega una nueva ciudad dentro del departamento seleccionado. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. Hay un departamento seleccionado en la columna central. |
| **Flujo básico** | 1. El actor hace clic en "+" en la columna Ciudades. <br>2. El actor ingresa el nombre de la ciudad en la fila editable. <br>3. El sistema envía `POST /api/ciudad/` con `{ nombre, departamento: id_departamento_activo }`. <br>4. La nueva ciudad aparece en la columna derecha. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado dentro del mismo departamento:** El sistema retorna HTTP 400. |
| **Reglas de negocio** | RN-10: La unicidad del nombre es por departamento. |
| **Post-condición** | Nueva ciudad vinculada al departamento. Registrada en auditoría. |

---

## CUS-UBI-009 — Editar ciudad

| Campo | Detalle |
|---|---|
| **ID** | CUS-UBI-009 |
| **Módulo** | Ubicaciones |
| **Nombre** | Editar ciudad |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica el nombre de una ciudad existente mediante edición inline. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. La ciudad es visible en la columna derecha. |
| **Flujo básico** | 1. El actor hace clic en el ícono de edición de la fila de la ciudad. <br>2. Modifica el nombre y confirma. <br>3. El sistema envía `PATCH /api/ciudad/{id}/`. <br>4. La fila vuelve al modo lectura con el nombre actualizado. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Nombre duplicado en el mismo departamento:** El sistema retorna HTTP 400. |
| **Reglas de negocio** | RN-10: La unicidad es por departamento. |
| **Post-condición** | Nombre actualizado. Registrado en auditoría. |

---

## CUS-UBI-010 — Eliminar ciudad (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-UBI-010 |
| **Módulo** | Ubicaciones |
| **Nombre** | Eliminar ciudad (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente una ciudad que no tenga personas activas vinculadas. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. La ciudad no tiene personas activas vinculadas. |
| **Flujo básico** | 1. El administrador hace clic en eliminar sobre la fila de la ciudad. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/ciudad/{id}/`. <br>4. El servidor marca `is_deleted = True`. La ciudad desaparece de la lista. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Ciudad con personas activas:** El sistema retorna HTTP 400 con el mensaje "No se puede eliminar: tiene personas activas vinculadas." |
| **Reglas de negocio** | RN-06: Solo `admin` puede eliminar. RN-07: Borrado lógico. RN-08: Sin personas activas. |
| **Post-condición** | Ciudad marcada con `is_deleted = True`. Registrada en auditoría. |
