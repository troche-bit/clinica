# Especificaciones de Casos de Uso — Módulo Agenda
**Sistema:** Clínica Lichi  
**Módulo:** Clínica → Agenda  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: ver, gestionar, reagendar, cancelar y eliminar turnos. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear, editar, asignar pacientes, cambiar estados, reagendar y cancelar turnos. |
| **Secretaria médico** | Usuario con rol `secretaria_medico`. Puede gestionar la agenda de los médicos que tiene asignados. |
| **Médico** | Usuario con rol `medico`. Puede consultar la agenda de sus propios turnos (solo lectura). |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-AGE-001 | Visualizar agenda en calendario mensual | Usuario autenticado |
| CUS-AGE-002 | Visualizar agenda del día por médico | Usuario autenticado |
| CUS-AGE-003 | Asignar paciente a turno disponible | Administrador / Recepcionista / Secretaria médico |
| CUS-AGE-004 | Cambiar estado de turno | Administrador / Recepcionista / Secretaria médico |
| CUS-AGE-005 | Reagendar paciente | Administrador / Recepcionista / Secretaria médico |
| CUS-AGE-006 | Cancelar rango de turnos | Administrador / Recepcionista / Secretaria médico |
| CUS-AGE-007 | Eliminar turno (borrado lógico) | Administrador |
| CUS-AGE-008 | Ver estadísticas del día | Usuario autenticado |

---

## CUS-AGE-001 — Visualizar agenda en calendario mensual

| Campo | Detalle |
|---|---|
| **ID** | CUS-AGE-001 |
| **Módulo** | Agenda |
| **Nombre** | Visualizar agenda en calendario mensual |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario visualiza un calendario mensual que muestra la cantidad de turnos por día (disponibles y ocupados) con indicadores de color por médico. Puede seleccionar una fecha para ver el detalle del día. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El usuario navega a Agenda. <br>2. Si el usuario es médico, la vista se filtra automáticamente a su propio médico. <br>3. Si el usuario es secretaria_medico, la vista se filtra a los médicos asignados según el JWT. <br>4. El sistema consulta `GET /api/agenda/resumen-mes/` para obtener el conteo de turnos por fecha. <br>5. El calendario muestra el mes actual con dots de colores por médico en cada día con turnos. <br>6. El usuario hace clic en una fecha para ver los turnos del día en el panel lateral. |
| **Flujo alterno** | **A1 – Sin médico seleccionado:** Se activa `useAgendaDiaGlobal` que muestra todos los turnos del día sin filtrar por médico. |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Los colores de dots y avatares se asignan por ID de médico con paletas fijas (`COLORES_DOT`, `COLORES_MEDICO`). <br>RN-02: La secretaria solo puede ver y gestionar los turnos de sus médicos asignados (`medicos_asignados` del JWT). |
| **Post-condición** | El calendario del mes actual está visible con conteos de disponibles y ocupados por día. |

---

## CUS-AGE-002 — Visualizar agenda del día por médico

| Campo | Detalle |
|---|---|
| **ID** | CUS-AGE-002 |
| **Módulo** | Agenda |
| **Nombre** | Visualizar agenda del día por médico |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario ve la lista de turnos de un día específico para un médico seleccionado, con el estado de cada turno (disponible, ocupado, realizado, cancelado) y el nombre del paciente asignado si corresponde. |
| **Pre-condición** | El usuario está autenticado. Hay un médico y una fecha seleccionados. |
| **Flujo básico** | 1. El usuario selecciona una fecha en el calendario y un médico en el selector. <br>2. El sistema consulta `GET /api/agenda/?persona_rrhh={id}&fecha={YYYY-MM-DD}`. <br>3. El panel muestra los turnos del día: hora, estado, paciente (si ocupa), avatar del médico. <br>4. Cada turno tiene acciones disponibles según el estado y el rol. |
| **Flujo alterno** | **A1 – Sin turnos en la fecha:** Mensaje "No hay turnos para este día." |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-03: El color de estado `realizado` usa paleta violeta (#7c3aed). |
| **Post-condición** | Lista de turnos del día visible con sus estados. |

---

## CUS-AGE-003 — Asignar paciente a turno disponible

| Campo | Detalle |
|---|---|
| **ID** | CUS-AGE-003 |
| **Módulo** | Agenda |
| **Nombre** | Asignar paciente a turno disponible |
| **Actor** | Administrador / Recepcionista / Secretaria médico |
| **Descripción** | El actor asigna un paciente a un turno que está en estado `disponible`, cambiando el estado a `ocupado`. |
| **Pre-condición** | El usuario está autenticado con rol permitido. El turno existe con estado `disponible`. |
| **Flujo básico** | 1. El actor hace clic en un turno con estado `disponible`. <br>2. Se muestra un buscador de paciente con debounce de 300 ms y navegación por teclado (↑/↓/Enter/Escape). <br>3. El actor busca y selecciona el paciente. <br>4. El sistema envía `PATCH /api/agenda/{id}/asignar/` con `{ paciente_id }`. <br>5. El turno cambia a estado `ocupado` mostrando el nombre del paciente. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Turno ya ocupado:** HTTP 400. <br>**E2 – Paciente no encontrado:** El buscador no muestra resultados. |
| **Reglas de negocio** | RN-04: Solo se pueden asignar pacientes a turnos en estado `disponible`. <br>RN-05: La secretaria solo puede asignar en los turnos de sus médicos asignados. |
| **Post-condición** | El turno queda en estado `ocupado` con el paciente asignado. |

---

## CUS-AGE-004 — Cambiar estado de turno

| Campo | Detalle |
|---|---|
| **ID** | CUS-AGE-004 |
| **Módulo** | Agenda |
| **Nombre** | Cambiar estado de turno |
| **Actor** | Administrador / Recepcionista / Secretaria médico |
| **Descripción** | El actor cambia el estado de un turno entre los valores permitidos: `disponible`, `inactivo`, `cancelado`. |
| **Pre-condición** | El usuario está autenticado con rol permitido. El turno existe y no está realizado. |
| **Flujo básico** | 1. El actor hace clic en el selector de estado de un turno. <br>2. El sistema muestra los estados disponibles para la transición actual. <br>3. El actor selecciona el nuevo estado. <br>4. El sistema envía `PATCH /api/agenda/{id}/estado/` con `{ estado }`. <br>5. El turno muestra el nuevo estado. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Transición no permitida:** HTTP 400 indicando el motivo. |
| **Reglas de negocio** | RN-06: Los turnos `realizado` no pueden cambiar de estado desde este endpoint. <br>RN-07: Los turnos `ocupado` no se pueden poner en `disponible` directamente sin quitar al paciente primero. |
| **Post-condición** | El estado del turno queda actualizado en la agenda. |

---

## CUS-AGE-005 — Reagendar paciente

| Campo | Detalle |
|---|---|
| **ID** | CUS-AGE-005 |
| **Módulo** | Agenda |
| **Nombre** | Reagendar paciente |
| **Actor** | Administrador / Recepcionista / Secretaria médico |
| **Descripción** | El actor mueve a un paciente de un turno ocupado a otro turno disponible del mismo prestador de forma atómica. |
| **Pre-condición** | El turno origen está en estado `ocupado`. El turno destino está en estado `disponible` y pertenece al mismo prestador. |
| **Flujo básico** | 1. El actor hace clic en "Reagendar" sobre un turno ocupado. <br>2. El sistema muestra el selector de turno destino (turnos disponibles del mismo médico). <br>3. El actor selecciona el nuevo turno. <br>4. El sistema envía `PATCH /api/agenda/{id}/reagendar/` con `{ nuevo_turno_id }`. <br>5. El servidor ejecuta la operación atómica: asigna el paciente al turno nuevo y libera el origen. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Turno destino ya ocupado:** HTTP 400. <br>**E2 – Turno destino de otro prestador:** HTTP 400. |
| **Reglas de negocio** | RN-08: La operación es atómica (transacción DB); si falla el destino, el origen no se modifica. <br>RN-09: El nuevo turno debe ser del mismo prestador que el origen. |
| **Post-condición** | El paciente está asignado al nuevo turno (`ocupado`) y el turno origen vuelve a `disponible`. |

---

## CUS-AGE-006 — Cancelar rango de turnos

| Campo | Detalle |
|---|---|
| **ID** | CUS-AGE-006 |
| **Módulo** | Agenda |
| **Nombre** | Cancelar rango de turnos |
| **Actor** | Administrador / Recepcionista / Secretaria médico |
| **Descripción** | El actor cancela todos los turnos disponibles de un prestador dentro de un rango de fechas (y opcionalmente de horas). Los turnos ocupados o realizados no se cancelan. |
| **Pre-condición** | El usuario está autenticado con rol permitido. Se especifica al menos un prestador y un rango de fechas. |
| **Flujo básico** | 1. El actor abre el modal de gestión "Cancelar rango". <br>2. Selecciona prestador, fecha_desde, fecha_hasta y opcionalmente hora_desde y hora_hasta. <br>3. El actor confirma. <br>4. El sistema envía `POST /api/agenda/cancelar-rango/` con los parámetros. <br>5. El servidor cancela todos los turnos `disponible` en el rango y retorna `{ cancelados: N, no_cancelados: [...] }`. <br>6. El modal muestra el resultado: N turnos cancelados y la lista de turnos que no pudieron cancelarse (ocupados/realizados). |
| **Flujo alterno** | **A1 – Franja horaria opcional:** Si se especifican `hora_desde` y `hora_hasta`, solo se cancelan los turnos dentro de esa franja. |
| **Flujo de excepción** | **E1 – Sin turnos disponibles en el rango:** El servidor retorna `{ cancelados: 0, no_cancelados: [...] }`. |
| **Reglas de negocio** | RN-10: Solo se cancelan turnos con estado `disponible`; los `ocupado` y `realizado` se listan en `no_cancelados`. <br>RN-11: La secretaria solo puede cancelar turnos de sus médicos asignados. |
| **Post-condición** | Los turnos `disponible` del rango quedan en estado `cancelado`. Los turnos ocupados/realizados no se modifican. |

---

## CUS-AGE-007 — Eliminar turno (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-AGE-007 |
| **Módulo** | Agenda |
| **Nombre** | Eliminar turno (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un turno que no tenga consultas activas vinculadas. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El turno no tiene consultas activas (`Consulta.agenda`). |
| **Flujo básico** | 1. El administrador hace clic en eliminar sobre el turno. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/agenda/{id}/`. <br>4. El servidor verifica que no haya consultas activas y marca `is_deleted = True`. <br>5. El turno desaparece de la agenda. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Turno con consultas activas:** HTTP 400. |
| **Reglas de negocio** | RN-12: Solo `admin` puede eliminar turnos. RN-13: Borrado lógico. |
| **Post-condición** | Turno marcado `is_deleted = True`. No aparece en la agenda. Registrado en auditoría. |

---

## CUS-AGE-008 — Ver estadísticas del día

| Campo | Detalle |
|---|---|
| **ID** | CUS-AGE-008 |
| **Módulo** | Agenda |
| **Nombre** | Ver estadísticas del día |
| **Actor** | Usuario autenticado |
| **Descripción** | El sistema expone un resumen de los turnos del día actual para ser mostrado en la página de informes y en el dashboard. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El sistema consulta `GET /api/agenda/stats-hoy/` (staleTime 1 min). <br>2. El endpoint retorna: total, confirmadas, pendientes, realizadas, inactivos, cancelados. <br>3. Los datos se muestran como stat cards en la pantalla de Informes o en el Dashboard. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-14: La fecha "hoy" se calcula con `timezone.localtime().date()` (timezone-aware, America/Asuncion). |
| **Post-condición** | Estadísticas del día disponibles para visualización. |
