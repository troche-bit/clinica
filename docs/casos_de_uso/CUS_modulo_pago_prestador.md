# Especificaciones de Casos de Uso — Módulo Pago a Prestadores
**Sistema:** Clínica Lichi  
**Módulo:** Finanzas → Pago a Prestadores  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Único actor con acceso completo: registrar y anular pagos a prestadores. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-PAG-001 | Listar y filtrar pagos a prestadores | Administrador |
| CUS-PAG-002 | Ver detalle de pago | Administrador |
| CUS-PAG-003 | Consultar bloques de turnos pendientes | Administrador |
| CUS-PAG-004 | Registrar pago a prestador | Administrador |
| CUS-PAG-005 | Anular pago a prestador | Administrador |

---

## CUS-PAG-001 — Listar y filtrar pagos a prestadores

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAG-001 |
| **Módulo** | Pago a Prestadores |
| **Nombre** | Listar y filtrar pagos a prestadores |
| **Actor** | Administrador |
| **Descripción** | El administrador visualiza el historial de pagos emitidos a los prestadores del sistema, con filtros por prestador, estado y rango de fechas. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador navega a Finanzas → Pago a Prestadores. <br>2. El sistema consulta `GET /api/pago-prestador/` y muestra: N° pago, fecha, prestador, cantidad de turnos, monto total, estado (pagado/pendiente/parcial). <br>3. El administrador puede filtrar por prestador (BuscadorFiltrable), estado y rango de fechas. |
| **Flujo alterno** | **A1 – Sin pagos:** Mensaje "Sin pagos registrados." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo `admin` puede acceder. Solo registros con `is_deleted = False`. |
| **Post-condición** | Historial de pagos a prestadores visible con filtros. |

---

## CUS-PAG-002 — Ver detalle de pago

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAG-002 |
| **Módulo** | Pago a Prestadores |
| **Nombre** | Ver detalle de pago |
| **Actor** | Administrador |
| **Descripción** | El administrador selecciona un pago para ver el detalle de los turnos liquidados, el monto por turno y el total. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. Existe al menos un pago. |
| **Flujo básico** | 1. El administrador hace clic en una fila. <br>2. El sistema consulta `GET /api/pago-prestador/{id}/` y muestra: prestador, fecha, N° de pago, cuenta de origen, turnos incluidos (fecha, hora, paciente, monto por turno), total, estado. <br>3. Hay acciones: "Anular". |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | — |
| **Post-condición** | Detalle completo del pago visible. |

---

## CUS-PAG-003 — Consultar bloques de turnos pendientes

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAG-003 |
| **Módulo** | Pago a Prestadores |
| **Nombre** | Consultar bloques de turnos pendientes |
| **Actor** | Administrador |
| **Descripción** | Al registrar un nuevo pago, el administrador consulta los turnos realizados (`realizado`) de un prestador que aún no han sido pagados (`pagado_prestador = False`), agrupados por horario y fecha. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El prestador tiene turnos con estado `realizado` y `pagado_prestador = False`. |
| **Flujo básico** | 1. En el formulario de nuevo pago, el administrador busca y selecciona el prestador. <br>2. El sistema consulta `GET /api/pago-prestador/bloques-pendientes/?persona_rrhh={id}`. <br>3. El endpoint agrupa los turnos por horario y fecha: muestra el bloque con fecha, cantidad de turnos, monto total del bloque. <br>4. El administrador selecciona los bloques a incluir en este pago. |
| **Flujo alterno** | **A1 – Sin bloques pendientes:** Mensaje "Este prestador no tiene turnos pendientes de pago." |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-02: Solo se muestran turnos con `estado = 'realizado'` y `pagado_prestador = False`. <br>RN-03: Los turnos se agrupan por horario (template) y fecha para presentar bloques coherentes de liquidación. |
| **Post-condición** | El administrador puede ver los turnos pendientes de liquidación agrupados. |

---

## CUS-PAG-004 — Registrar pago a prestador

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAG-004 |
| **Módulo** | Pago a Prestadores |
| **Nombre** | Registrar pago a prestador |
| **Actor** | Administrador |
| **Descripción** | El administrador registra el pago de honorarios a un prestador, seleccionando los bloques de turnos realizados a liquidar. El sistema genera el comprobante de pago, actualiza el estado de los turnos y registra el egreso en la cuenta de caja/banco correspondiente. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El prestador tiene turnos pendientes de pago. Existe al menos una cuenta de caja/banco activa. |
| **Flujo básico** | 1. El administrador hace clic en "Nuevo pago". <br>2. Busca y selecciona el prestador. <br>3. El sistema carga los bloques pendientes (ver CUS-PAG-003). <br>4. El administrador selecciona los bloques o turnos individuales a incluir. <br>5. El administrador completa: cuenta de origen (egreso)*, fecha*, N° de pago (precargado desde `useSiguienteNumeroPago`), observaciones. <br>6. El administrador confirma. <br>7. El sistema envía `POST /api/pago-prestador/` en transacción atómica: crea `PagoPrestador` + marca `pagado_prestador = True` en cada `Agenda` incluida + crea `MovimientoCajaBanco` (egreso por el monto total). <br>8. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Sin bloques seleccionados:** Validación bloquea el envío. <br>**E2 – Error en transacción:** HTTP 500; ningún registro se crea. |
| **Reglas de negocio** | RN-04: La operación es atómica. <br>RN-05: Al registrar el pago, cada turno incluido cambia `pagado_prestador = True`. <br>RN-06: El movimiento de caja se crea automáticamente como egreso en la cuenta seleccionada. |
| **Post-condición** | Pago registrado. Turnos marcados como pagados (`pagado_prestador = True`). Egreso de caja registrado. Los turnos ya no aparecen en los bloques pendientes del prestador. |

---

## CUS-PAG-005 — Anular pago a prestador

| Campo | Detalle |
|---|---|
| **ID** | CUS-PAG-005 |
| **Módulo** | Pago a Prestadores |
| **Nombre** | Anular pago a prestador |
| **Actor** | Administrador |
| **Descripción** | El administrador anula un pago emitido, revirtiendo el estado de los turnos y el egreso de caja. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El pago existe y no está anulado. |
| **Flujo básico** | 1. El administrador hace clic en "Anular" en el detalle del pago. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/pago-prestador/{id}/`. <br>4. El servidor en transacción atómica: revierte `pagado_prestador = False` en cada turno incluido, elimina `MovimientoCajaBanco`, marca `PagoPrestador.is_deleted = True`. <br>5. El pago desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Pago ya anulado:** HTTP 400. |
| **Reglas de negocio** | RN-07: Solo `admin` puede anular pagos. <br>RN-08: La anulación es atómica. <br>RN-09: Al anular, los turnos vuelven a aparecer como pendientes de pago para el prestador. |
| **Post-condición** | Pago marcado `is_deleted = True`. Turnos regresan a `pagado_prestador = False`. Egreso de caja revertido. |
