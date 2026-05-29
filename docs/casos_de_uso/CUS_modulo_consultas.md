# Especificaciones de Casos de Uso — Módulo Consultas
**Sistema:** Clínica Lichi  
**Módulo:** Clínica → Consultas  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Vista con selector de médico y fecha; puede eliminar consultas. |
| **Recepcionista** | Usuario con rol `recepcionista`. Vista con selector de médico y fecha; puede ver el estado de consultas. |
| **Médico** | Usuario con rol `medico`. Ve directamente las consultas de su propio médico del día actual; puede completar y finalizar consultas. |
| **Secretaria médico** | Usuario con rol `secretaria_medico`. Ve las consultas de los médicos asignados; mismas capacidades que médico. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-CLS-001 | Ver consultas del día | Usuario autenticado |
| CUS-CLS-002 | Iniciar consulta | Médico / Secretaria médico |
| CUS-CLS-003 | Completar datos de la consulta | Médico / Secretaria médico |
| CUS-CLS-004 | Finalizar consulta | Médico / Secretaria médico |
| CUS-CLS-005 | Ver historia clínica del paciente (en pantalla) | Usuario autenticado |
| CUS-CLS-006 | Eliminar consulta (borrado lógico) | Administrador |
| CUS-CLS-007 | Ver estadísticas de consultas del día | Usuario autenticado |

---

## CUS-CLS-001 — Ver consultas del día

| Campo | Detalle |
|---|---|
| **ID** | CUS-CLS-001 |
| **Módulo** | Consultas |
| **Nombre** | Ver consultas del día |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario visualiza los turnos ocupados del día con su estado de consulta (en espera, en consulta, finalizada). Los roles con acceso restringido (`medico`, `secretaria_medico`) ven solo los turnos de su médico sin selector de médico ni de fecha. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El usuario navega a Consultas. <br>2. **Para admin/recepcionista:** el sistema muestra un selector de médico y selector de fecha; el usuario selecciona los filtros. <br>   **Para médico/secretaria:** el sistema carga directamente los turnos del médico propio del día actual. <br>3. El sistema consulta `GET /api/consultas/?persona_rrhh={id}&fecha={hoy}` con `refetchInterval: 60s`. <br>4. Se muestran los turnos en lista con: hora, nombre del paciente, estado de la consulta (badge), tiempo en espera. <br>5. El usuario selecciona un turno para ver el detalle de la consulta en el panel lateral. |
| **Flujo alterno** | **A1 – Sin turnos para el día:** Mensaje "No hay turnos para este día." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Para `medico` y `secretaria_medico`, la lista filtra `turno.estado !== 'realizado' && consulta?.estado !== 'finalizada'` (esconde los finalizados). <br>RN-02: El `refetchInterval` de 60s mantiene la lista actualizada automáticamente. <br>RN-03: En mobile se usa un overlay fullscreen (`cs-detalle-activa`) para el panel de detalle. |
| **Post-condición** | Lista de turnos del día visible con estados de consulta actualizados. |

---

## CUS-CLS-002 — Iniciar consulta

| Campo | Detalle |
|---|---|
| **ID** | CUS-CLS-002 |
| **Módulo** | Consultas |
| **Nombre** | Iniciar consulta |
| **Actor** | Médico / Secretaria médico |
| **Descripción** | El médico inicia oficialmente la atención de un paciente que está en espera, cambiando el estado de la consulta de `en_espera` a `en_consulta` y registrando la hora de inicio. |
| **Pre-condición** | El usuario está autenticado con rol `medico` o `secretaria_medico`. La consulta existe con estado `en_espera`. |
| **Flujo básico** | 1. El actor selecciona el turno del paciente en espera. <br>2. Hace clic en "Iniciar consulta". <br>3. El sistema envía `POST /api/consultas/{id}/iniciar/`. <br>4. El servidor cambia el estado a `en_consulta` y registra `hora_desde = now()`. <br>5. El badge del turno cambia a "En consulta". Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Consulta no está en espera:** HTTP 400. |
| **Reglas de negocio** | RN-04: Solo se puede iniciar una consulta que esté en estado `en_espera`. |
| **Post-condición** | La consulta está en estado `en_consulta` con `hora_desde` registrado. |

---

## CUS-CLS-003 — Completar datos de la consulta

| Campo | Detalle |
|---|---|
| **ID** | CUS-CLS-003 |
| **Módulo** | Consultas |
| **Nombre** | Completar datos de la consulta |
| **Actor** | Médico / Secretaria médico |
| **Descripción** | El médico registra los datos clínicos de la consulta en curso: motivo de consulta, diagnóstico, tratamiento, indicaciones, próxima cita y documentos adjuntos. |
| **Pre-condición** | La consulta está en estado `en_consulta`. El actor tiene el panel de detalle abierto. |
| **Flujo básico** | 1. El actor ve el formulario de consulta con los campos: motivo*, diagnóstico*, tratamiento*, indicaciones*, próxima cita (opcional), evento clínico y sección de documentos. <br>2. El actor completa los campos y puede adjuntar archivos digitalizados de la consulta. <br>3. El actor hace clic en "Guardar" (sin finalizar). <br>4. El sistema envía `PATCH /api/consultas/{id}/` con los datos. <br>5. Los datos quedan guardados; el estado de la consulta no cambia. |
| **Flujo alterno** | **A1 – Subir documento:** El actor selecciona archivos; se suben via `POST /api/documentos/` vinculados a la consulta. |
| **Flujo de excepción** | **E1 – Error de validación:** HTTP 400 con errores de campo. |
| **Reglas de negocio** | RN-05: Los campos motivo, diagnóstico, tratamiento e indicaciones son requeridos para poder finalizar (no para guardar parcialmente). <br>RN-06: `proxima_cita: ""` se convierte a `null` antes de enviar (función `formPayload()`). |
| **Post-condición** | Los datos de la consulta quedan guardados en la base de datos con el estado actual. |

---

## CUS-CLS-004 — Finalizar consulta

| Campo | Detalle |
|---|---|
| **ID** | CUS-CLS-004 |
| **Módulo** | Consultas |
| **Nombre** | Finalizar consulta |
| **Actor** | Médico / Secretaria médico |
| **Descripción** | El médico cierra oficialmente la atención del paciente. El sistema valida que todos los campos obligatorios estén completos antes de permitir la finalización. |
| **Pre-condición** | La consulta está en estado `en_consulta`. Los campos motivo, diagnóstico, tratamiento e indicaciones están completos. |
| **Flujo básico** | 1. El actor hace clic en "Finalizar". <br>2. El sistema valida los campos requeridos (`CAMPOS_REQ_CONSULTA`). Si hay faltantes, marca `intentoFinalizar = true` y resalta los campos con error. <br>3. El sistema muestra un `ConfirmDialog` con `confirmText="Finalizar consulta"`. <br>4. El actor confirma. <br>5. El sistema envía `POST /api/consultas/{id}/finalizar/`. <br>6. El servidor cambia el estado a `finalizada` y registra `hora_hasta = now()`. <br>7. El turno vinculado en `Agenda` cambia a estado `realizado`. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Campos requeridos faltantes:** El sistema muestra errores en tiempo real; el actor debe completar los campos antes de poder finalizar. <br>**E2 – Consulta no está en consulta:** HTTP 400. |
| **Reglas de negocio** | RN-07: Los 4 campos requeridos (motivo, diagnóstico, tratamiento, indicaciones) deben estar completos para finalizar. <br>RN-08: Al finalizar la consulta, el turno de agenda asociado cambia automáticamente a estado `realizado`. <br>RN-09: El `ConfirmDialog` usa `confirmText` explícito para evitar confusión con la acción "Eliminar". |
| **Post-condición** | La consulta está en estado `finalizada` con `hora_desde` y `hora_hasta` registrados. El turno de agenda está en estado `realizado`. El historial del paciente se actualiza. |

---

## CUS-CLS-005 — Ver historia clínica del paciente (en pantalla)

| Campo | Detalle |
|---|---|
| **ID** | CUS-CLS-005 |
| **Módulo** | Consultas |
| **Nombre** | Ver historia clínica del paciente (en pantalla) |
| **Actor** | Usuario autenticado |
| **Descripción** | Desde el panel de detalle de una consulta, el usuario accede al historial completo de consultas previas del paciente con filtros por médico y especialidad. |
| **Pre-condición** | El usuario está autenticado. Hay una consulta seleccionada con paciente asignado. |
| **Flujo básico** | 1. El actor hace clic en "Historia clínica" en el panel de detalle de la consulta. <br>2. El sistema abre el `ModalHistoriaClinica` con todas las consultas del paciente. <br>3. El modal permite filtrar por nombre del médico y especialidad. <br>4. Cada consulta muestra: fecha, médico, especialidad, estado, datos clínicos y documentos adjuntos. |
| **Flujo alterno** | **A1 – Sin consultas previas:** Mensaje "Sin consultas anteriores registradas." |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-10: Los filtros `medicoNombre` y `especialidadFiltro` se aplican client-side sobre los datos ya cargados. |
| **Post-condición** | El actor puede revisar el historial médico completo del paciente. |

---

## CUS-CLS-006 — Eliminar consulta (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-CLS-006 |
| **Módulo** | Consultas |
| **Nombre** | Eliminar consulta (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente una consulta errónea o duplicada. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador selecciona la consulta y hace clic en eliminar. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/consultas/{id}/`. <br>4. El servidor marca `is_deleted = True`. <br>5. La consulta desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-11: Solo `admin` puede eliminar consultas. RN-12: Borrado lógico. |
| **Post-condición** | Consulta marcada `is_deleted = True`. No aparece en la lista ni en el historial del paciente. Registrada en auditoría. |

---

## CUS-CLS-007 — Ver estadísticas de consultas del día

| Campo | Detalle |
|---|---|
| **ID** | CUS-CLS-007 |
| **Módulo** | Consultas |
| **Nombre** | Ver estadísticas de consultas del día |
| **Actor** | Usuario autenticado |
| **Descripción** | El sistema expone un resumen de las consultas del día actual para mostrar en stat cards en la pantalla de informes. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El sistema consulta `GET /api/consultas/stats-hoy/`. <br>2. El endpoint retorna: `{ total, en_espera, en_consulta, finalizadas }`. <br>3. Los datos se muestran en la pantalla de informes como stat cards. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-13: La fecha "hoy" es timezone-aware (America/Asuncion). |
| **Post-condición** | Estadísticas del día disponibles en la pantalla de informes. |
