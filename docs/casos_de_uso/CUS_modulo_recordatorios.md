# Especificaciones de Casos de Uso — Módulo Recordatorios
**Sistema:** Clínica Lichi  
**Módulo:** Clínica → Recordatorios  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total al módulo. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede ver próximas citas y registrar notificaciones. |
| **Usuario autenticado** | Cualquier rol con sesión activa. Puede ver el badge de recordatorios pendientes en la navbar. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-REC-001 | Ver próximas citas con alerta de urgencia | Administrador / Recepcionista |
| CUS-REC-002 | Ver estadísticas de recordatorios | Administrador / Recepcionista |
| CUS-REC-003 | Registrar notificación a paciente | Administrador / Recepcionista |
| CUS-REC-004 | Ver historial de notificaciones de un paciente | Administrador / Recepcionista |
| CUS-REC-005 | Ver badge de recordatorios en navbar | Usuario autenticado |

---

## CUS-REC-001 — Ver próximas citas con alerta de urgencia

| Campo | Detalle |
|---|---|
| **ID** | CUS-REC-001 |
| **Módulo** | Recordatorios |
| **Nombre** | Ver próximas citas con alerta de urgencia |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor visualiza el listado de consultas con próxima cita programada, ordenadas por urgencia según la proximidad de la fecha. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor navega a Recordatorios. <br>2. El sistema consulta `GET /api/recordatorios/proximas-citas/`. <br>3. El endpoint retorna las consultas con `proxima_cita` no nula, anotadas con: días restantes y nivel de urgencia (vencida, hoy, esta semana, próximo mes). <br>4. La lista muestra: paciente, próxima cita, médico, urgencia (badge de color). <br>5. El actor puede hacer clic en un paciente para ver su detalle o iniciar la notificación. |
| **Flujo alterno** | **A1 – Sin próximas citas:** Mensaje "No hay próximas citas registradas." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: "Vencida" = `proxima_cita` < hoy. "Hoy" = = hoy. "Esta semana" = próximos 7 días. "Próximo mes" = hasta 30 días. |
| **Post-condición** | Lista de próximas citas con urgencia visible para gestionar recordatorios. |

---

## CUS-REC-002 — Ver estadísticas de recordatorios

| Campo | Detalle |
|---|---|
| **ID** | CUS-REC-002 |
| **Módulo** | Recordatorios |
| **Nombre** | Ver estadísticas de recordatorios |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El sistema muestra stat cards con el resumen cuantitativo de los recordatorios pendientes clasificados por urgencia. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. Al cargar la página de recordatorios, el sistema consulta `GET /api/recordatorios/stats/`. <br>2. El endpoint retorna: `{ vencidas, proximos_7_dias, proximos_30_dias, agendadas }`. <br>3. Los valores se muestran en stat cards con colores según urgencia (rojo para vencidas, amarillo para próximas). |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-02: "Agendadas" incluye todas las consultas con `proxima_cita` no nula y no vencidas. |
| **Post-condición** | Stat cards de recordatorios visibles con los conteos por categoría de urgencia. |

---

## CUS-REC-003 — Registrar notificación a paciente

| Campo | Detalle |
|---|---|
| **ID** | CUS-REC-003 |
| **Módulo** | Recordatorios |
| **Nombre** | Registrar notificación a paciente |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor marca que se notificó al paciente sobre su próxima cita, registrando la notificación con estado "pendiente" en el historial. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. Hay una próxima cita seleccionada. |
| **Flujo básico** | 1. El actor selecciona una cita de la lista y hace clic en "Notificar". <br>2. El sistema envía `POST /api/recordatorios/notificar/` con `{ consulta_id, paciente_id }`. <br>3. Se crea un registro `Notificacion` con `estado = 'pendiente'` y la fecha actual. <br>4. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al registrar:** Toast de error. |
| **Reglas de negocio** | RN-03: La notificación registra el intento de contacto; no implica que el paciente fue efectivamente notificado. |
| **Post-condición** | Notificación registrada en el historial del paciente con estado "pendiente". |

---

## CUS-REC-004 — Ver historial de notificaciones de un paciente

| Campo | Detalle |
|---|---|
| **ID** | CUS-REC-004 |
| **Módulo** | Recordatorios |
| **Nombre** | Ver historial de notificaciones de un paciente |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor consulta el historial de notificaciones enviadas a un paciente específico. |
| **Pre-condición** | El usuario está autenticado. El paciente tiene al menos una notificación registrada. |
| **Flujo básico** | 1. El actor selecciona un paciente de la lista de próximas citas. <br>2. El sistema consulta `GET /api/notificaciones/?paciente={id}`. <br>3. Se muestra el historial: fecha, tipo de notificación, estado (pendiente/enviada/fallida), usuario que la registró. |
| **Flujo alterno** | **A1 – Sin notificaciones:** Mensaje "Sin notificaciones para este paciente." |
| **Flujo de excepción** | — |
| **Reglas de negocio** | — |
| **Post-condición** | Historial de notificaciones del paciente visible. |

---

## CUS-REC-005 — Ver badge de recordatorios en navbar

| Campo | Detalle |
|---|---|
| **ID** | CUS-REC-005 |
| **Módulo** | Recordatorios |
| **Nombre** | Ver badge de recordatorios en navbar |
| **Actor** | Usuario autenticado |
| **Descripción** | El sistema muestra un badge con el conteo de recordatorios urgentes en el dropdown de la navbar, permitiendo al usuario acceder rápidamente a los recordatorios más críticos. |
| **Pre-condición** | El usuario está autenticado con cualquier rol. |
| **Flujo básico** | 1. El sistema carga `useStatsRecordatorios` al montar la navbar. <br>2. El badge muestra el total de citas vencidas + próximas en 7 días. <br>3. El usuario hace clic en el ícono de campana y ve un dropdown con las citas más urgentes. <br>4. Puede hacer clic en "Ver todos" para navegar a la página de Recordatorios. |
| **Flujo alterno** | **A1 – Sin recordatorios urgentes:** El badge no se muestra (o muestra 0). |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-04: El badge se actualiza periódicamente con el intervalo de refetch configurado en React Query. |
| **Post-condición** | El usuario tiene visibilidad de recordatorios urgentes desde cualquier pantalla del sistema. |
