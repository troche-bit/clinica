# Especificaciones de Casos de Uso — Módulo Horario Prestador
**Sistema:** Clínica Lichi  
**Módulo:** Clínica → Configuración → Horario Prestador  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: crear, editar, eliminar y generar turnos. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear, editar y generar turnos, pero no eliminar. |
| **Secretaria médico** | Usuario con rol `secretaria_medico`. Puede generar turnos para los médicos que tiene asignados. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-HOR-001 | Listar y filtrar horarios de prestador | Administrador / Recepcionista |
| CUS-HOR-002 | Ver detalle de horario | Administrador / Recepcionista |
| CUS-HOR-003 | Crear horario de prestador | Administrador / Recepcionista |
| CUS-HOR-004 | Editar horario de prestador | Administrador / Recepcionista |
| CUS-HOR-005 | Eliminar horario (borrado lógico) | Administrador |
| CUS-HOR-006 | Generar turnos de agenda | Administrador / Recepcionista / Secretaria médico |
| CUS-HOR-007 | Generar PDF de horarios | Administrador / Recepcionista |
| CUS-HOR-008 | Exportar horarios a Excel | Administrador / Recepcionista |

---

## CUS-HOR-001 — Listar y filtrar horarios de prestador

| Campo | Detalle |
|---|---|
| **ID** | CUS-HOR-001 |
| **Módulo** | Horario Prestador |
| **Nombre** | Listar y filtrar horarios de prestador |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor visualiza los horarios configurados filtrando por prestador y/o estado. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor navega a Configuración → Horario Prestador. <br>2. El sistema consulta `GET /api/horario-prestador/` y muestra: prestador, día/fecha, hora desde, hora hasta, intervalo (minutos), especialidades y estado. <br>3. El actor puede filtrar por prestador (BuscadorFiltrable) y/o estado (activo/inactivo/todos). |
| **Flujo alterno** | **A1 – Sin horarios:** Mensaje "Sin horarios para los filtros seleccionados." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo registros con `is_deleted = False`. |
| **Post-condición** | Listado de horarios visible con filtros aplicados. |

---

## CUS-HOR-002 — Ver detalle de horario

| Campo | Detalle |
|---|---|
| **ID** | CUS-HOR-002 |
| **Módulo** | Horario Prestador |
| **Nombre** | Ver detalle de horario |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor selecciona un horario para ver sus datos completos en el panel lateral: prestador, día, franjas horarias, intervalos, especialidades y consultorio. |
| **Pre-condición** | El usuario está autenticado. Existe al menos un horario. |
| **Flujo básico** | 1. El actor hace clic en una fila. <br>2. El panel muestra los datos del horario en modo lectura. <br>3. El actor puede pasar a modo edición si tiene permiso. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-02: El botón Eliminar solo se muestra para `admin`. |
| **Post-condición** | Datos del horario visibles en el panel. |

---

## CUS-HOR-003 — Crear horario de prestador

| Campo | Detalle |
|---|---|
| **ID** | CUS-HOR-003 |
| **Módulo** | Horario Prestador |
| **Nombre** | Crear horario de prestador |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor configura un nuevo bloque horario para un prestador: define el día de semana (o fecha específica si es excepción), la franja horaria, el intervalo entre turnos, el consultorio y las especialidades disponibles en ese horario. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. Existe al menos un prestador, un consultorio y una especialidad configurados. |
| **Flujo básico** | 1. El actor hace clic en "Nuevo" (o presiona F10 cuando el panel está cerrado). <br>2. El panel muestra el formulario con campos: prestador*, día de semana* (o fecha exacta si `excepcion=True`), hora desde*, hora hasta*, intervalo de turnos (minutos)*, consultorio, especialidades. <br>3. El actor completa los campos y guarda. <br>4. El sistema envía `POST /api/horario-prestador/`. <br>5. El nuevo horario aparece en la lista. Toast de confirmación. |
| **Flujo alterno** | **A1 – Horario de excepción:** El actor marca `excepcion=True` y selecciona una fecha específica en lugar del día de la semana. En este caso no aplica la validación de unicidad por día. |
| **Flujo de excepción** | **E1 – Combinación prestador+día+hora duplicada:** HTTP 400 con "Ya existe un horario para este prestador con el mismo día y hora de inicio." <br>**E2 – Campos requeridos vacíos:** HTTP 400. |
| **Reglas de negocio** | RN-03: La combinación (prestador, dia_semana, hora_desde) debe ser única entre horarios no excepcionales activos. <br>RN-04: Los horarios de excepción (`excepcion=True`) eximen de la validación de unicidad por día. <br>RN-05: El intervalo define la cantidad de turnos que se generarán (ej: 60 min / 15 min = 4 turnos). |
| **Post-condición** | Nuevo horario configurado. Disponible para generar turnos de agenda. Registrado en auditoría. |

---

## CUS-HOR-004 — Editar horario de prestador

| Campo | Detalle |
|---|---|
| **ID** | CUS-HOR-004 |
| **Módulo** | Horario Prestador |
| **Nombre** | Editar horario de prestador |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica la configuración de un horario existente. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El horario existe y no está eliminado. |
| **Flujo básico** | 1. El actor selecciona el horario y hace clic en editar. <br>2. El panel muestra el formulario con los datos precargados. <br>3. El actor modifica y guarda (F10 o clic). <br>4. El sistema envía `PATCH /api/horario-prestador/{id}/`. <br>5. El panel vuelve al modo lectura. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Duplicado al editar:** HTTP 400. |
| **Reglas de negocio** | RN-03: La validación de unicidad excluye el registro actual al editar. |
| **Post-condición** | Horario actualizado. Registrado en auditoría. |

---

## CUS-HOR-005 — Eliminar horario (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-HOR-005 |
| **Módulo** | Horario Prestador |
| **Nombre** | Eliminar horario (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un horario que no tenga turnos activos generados. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador selecciona el horario y hace clic en eliminar. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/horario-prestador/{id}/`. <br>4. El servidor marca `is_deleted = True`. <br>5. El horario desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-06: Solo `admin` puede eliminar. RN-07: Borrado lógico. |
| **Post-condición** | Horario marcado `is_deleted = True`. No puede usarse para generar nuevos turnos. Registrado en auditoría. |

---

## CUS-HOR-006 — Generar turnos de agenda

| Campo | Detalle |
|---|---|
| **ID** | CUS-HOR-006 |
| **Módulo** | Horario Prestador |
| **Nombre** | Generar turnos de agenda |
| **Actor** | Administrador / Recepcionista / Secretaria médico |
| **Descripción** | El actor genera automáticamente los turnos de agenda para un horario configurado, especificando un rango de fechas. El sistema crea un turno disponible por cada intervalo dentro de la franja horaria para cada día del rango que coincida con el día de semana del horario. |
| **Pre-condición** | El usuario está autenticado con rol `admin`, `recepcionista` o `secretaria_medico` (solo para médicos asignados). El horario seleccionado está activo. |
| **Flujo básico** | 1. El actor selecciona el horario y hace clic en "Generar turnos". <br>2. El sistema muestra el modal de generación con campos: fecha desde*, fecha hasta*. <br>3. El actor ingresa el rango de fechas y confirma. <br>4. El sistema envía `POST /api/horario-prestador/{id}/generar/` con `{ fecha_desde, fecha_hasta }`. <br>5. El servidor itera el rango: para cada fecha cuyo día de semana coincida con el horario, crea turnos en la franja `hora_desde` → `hora_hasta` con el intervalo configurado. <br>6. Se muestra un toast con la cantidad de turnos generados. |
| **Flujo alterno** | **A1 – Turno ya existente en una fecha:** El servidor saltea el turno duplicado (no genera un segundo turno para la misma fecha/hora). |
| **Flujo de excepción** | **E1 – Rango vacío (ninguna fecha del rango coincide con el día del horario):** Se informa que no se generaron turnos. |
| **Reglas de negocio** | RN-08: La secretaria_medico solo puede generar turnos para los médicos que tiene asignados (validado con `medicos_asignados` del JWT). <br>RN-09: Los turnos se crean con estado `disponible`. <br>RN-10: No se genera un turno si ya existe uno para el mismo horario, prestador, fecha y hora. |
| **Post-condición** | Los turnos quedan creados en `Agenda` con estado `disponible`. Disponibles para asignación de pacientes. |

---

## CUS-HOR-007 — Generar PDF de horarios

| Campo | Detalle |
|---|---|
| **ID** | CUS-HOR-007 |
| **Módulo** | Horario Prestador |
| **Nombre** | Generar PDF de horarios |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera un PDF con el listado de horarios activos, opcionalmente filtrado por prestador y/o día de semana. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en "Ver PDF" en la toolbar. <br>2. El sistema envía `GET /api/horario-prestador/reporte-horarios/` con `responseType: 'blob'`. <br>3. El backend genera el PDF con WeasyPrint. <br>4. El PDF se abre en una nueva pestaña. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-11: El botón muestra "Generando..." y se deshabilita durante la generación. |
| **Post-condición** | PDF del listado de horarios abierto en nueva pestaña. |

---

## CUS-HOR-008 — Exportar horarios a Excel

| Campo | Detalle |
|---|---|
| **ID** | CUS-HOR-008 |
| **Módulo** | Horario Prestador |
| **Nombre** | Exportar horarios a Excel |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor descarga el listado de horarios activos en formato Excel (.xlsx). |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en "Descargar Excel". <br>2. El sistema envía `GET /api/horario-prestador/reporte-horarios-excel/` con `responseType: 'blob'`. <br>3. El backend genera el archivo con openpyxl. <br>4. El archivo se descarga automáticamente. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-12: La descarga usa `link.download` para forzar la descarga en lugar de abrir en el navegador. |
| **Post-condición** | Archivo `horarios.xlsx` descargado. |
