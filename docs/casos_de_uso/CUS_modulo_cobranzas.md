# Especificaciones de Casos de Uso — Módulo Cobranzas
**Sistema:** Clínica Lichi  
**Módulo:** Finanzas → Cobranzas  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: registrar cobranzas y anularlas. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede registrar cobranzas, pero no anularlas. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-COB-001 | Listar y filtrar cobranzas | Administrador / Recepcionista |
| CUS-COB-002 | Ver detalle de cobranza / recibo | Administrador / Recepcionista |
| CUS-COB-003 | Registrar cobranza de cuotas | Administrador / Recepcionista |
| CUS-COB-004 | Anular cobranza | Administrador |
| CUS-COB-005 | Consultar cuotas pendientes de un cliente | Administrador / Recepcionista |

---

## CUS-COB-001 — Listar y filtrar cobranzas

| Campo | Detalle |
|---|---|
| **ID** | CUS-COB-001 |
| **Módulo** | Cobranzas |
| **Nombre** | Listar y filtrar cobranzas |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor visualiza el listado paginado de recibos emitidos, con filtros por cliente y rango de fechas. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor navega a Finanzas → Cobranzas. <br>2. El sistema consulta `GET /api/cobranzas/` y muestra: N° recibo, fecha, cliente, monto total, forma de pago, estado. <br>3. El actor puede filtrar por cliente (buscador) y rango de fechas. |
| **Flujo alterno** | **A1 – Sin cobranzas:** Mensaje "Sin recibos que coincidan." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo registros con `is_deleted = False`. |
| **Post-condición** | Listado de cobranzas visible. |

---

## CUS-COB-002 — Ver detalle de cobranza / recibo

| Campo | Detalle |
|---|---|
| **ID** | CUS-COB-002 |
| **Módulo** | Cobranzas |
| **Nombre** | Ver detalle de cobranza / recibo |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor selecciona un recibo para ver las cuotas cobradas, los montos aplicados y la forma de pago utilizada. |
| **Pre-condición** | El usuario está autenticado. Existe al menos una cobranza. |
| **Flujo básico** | 1. El actor hace clic en una fila. <br>2. El sistema consulta `GET /api/cobranzas/{id}/` y muestra: N° recibo, fecha, cliente, cuotas cobradas (con N° factura, vencimiento, monto parcial o total), forma de pago, cuenta de destino, total cobrado. <br>3. Hay acciones disponibles: "Ver PDF del recibo" y "Anular" (solo admin). |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-02: El botón "Anular" solo se muestra para `admin`. |
| **Post-condición** | Detalle completo de la cobranza visible. |

---

## CUS-COB-003 — Registrar cobranza de cuotas

| Campo | Detalle |
|---|---|
| **ID** | CUS-COB-003 |
| **Módulo** | Cobranzas |
| **Nombre** | Registrar cobranza de cuotas |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor registra el cobro de una o más cuotas pendientes de un cliente. El sistema genera el recibo, actualiza el saldo de cada cuota y registra el movimiento de caja/banco correspondiente. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El cliente tiene al menos una cuota pendiente (`CtaCobrar` con saldo > 0). |
| **Flujo básico** | 1. El actor hace clic en "Nueva cobranza". <br>2. El actor busca y selecciona el cliente. <br>3. El sistema consulta `GET /api/cobranzas/cuotas-pendientes/?persona={id}` y muestra las cuotas pendientes con saldo. <br>4. El actor selecciona las cuotas a cobrar (total o parcial por cuota). <br>5. El actor obtiene el siguiente número de recibo (`GET /api/cobranzas/siguiente-numero/`). <br>6. El actor selecciona: forma de pago, cuenta de destino, fecha. <br>7. El actor confirma. <br>8. El sistema envía `POST /api/cobranzas/` en transacción atómica: crea `Cobranza` + `VentaFactDetCobranza[]` (detalle de cuotas cobradas) + actualiza el `saldo` de cada `CtaCobrar` + crea `MovimientoCajaBanco` (ingreso). <br>9. Toast de confirmación. Opción de imprimir recibo. |
| **Flujo alterno** | **A1 – Pago parcial de cuota:** El actor ingresa un monto menor al saldo de la cuota; el `CtaCobrar` queda con saldo reducido (no en cero). |
| **Flujo de excepción** | **E1 – Sin cuotas seleccionadas:** Validación frontend bloquea el envío. <br>**E2 – Error en transacción:** HTTP 500; ningún registro se crea. |
| **Reglas de negocio** | RN-03: La cobranza es atómica: si falla cualquier parte, no se crea ningún registro. <br>RN-04: Al cobrar una cuota completamente (`saldo = 0`), el `CtaCobrar` queda con `saldo = 0` pero no se elimina (queda como historial). <br>RN-05: El movimiento de caja se crea automáticamente como ingreso. |
| **Post-condición** | Recibo emitido con N° asignado. Saldos de `CtaCobrar` actualizados. Movimiento de caja registrado. |

---

## CUS-COB-004 — Anular cobranza

| Campo | Detalle |
|---|---|
| **ID** | CUS-COB-004 |
| **Módulo** | Cobranzas |
| **Nombre** | Anular cobranza |
| **Actor** | Administrador |
| **Descripción** | El administrador anula un recibo de cobranza. El sistema revierte los efectos: restaura el saldo de las cuotas cobradas y elimina el movimiento de caja asociado. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. La cobranza existe y no está anulada. |
| **Flujo básico** | 1. El administrador hace clic en "Anular" en el detalle de la cobranza. <br>2. El `ConfirmDialog` muestra la advertencia de que la acción revierte los efectos. <br>3. El administrador confirma. <br>4. El sistema envía `DELETE /api/cobranzas/{id}/`. <br>5. El servidor en transacción atómica: restaura el `saldo` de cada `CtaCobrar` afectado, elimina `VentaFactDetCobranza`, elimina `MovimientoCajaBanco`, marca `Cobranza.is_deleted = True`. <br>6. La cobranza desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Cobranza ya anulada:** HTTP 400. |
| **Reglas de negocio** | RN-06: Solo `admin` puede anular cobranzas. <br>RN-07: La anulación es atómica; si falla la reversión de alguna cuota, ningún cambio se aplica. <br>RN-08: El número de recibo queda inutilizable tras la anulación (histórico). |
| **Post-condición** | Cobranza anulada. Saldos de cuotas restaurados. Movimiento de caja revertido. |

---

## CUS-COB-005 — Consultar cuotas pendientes de un cliente

| Campo | Detalle |
|---|---|
| **ID** | CUS-COB-005 |
| **Módulo** | Cobranzas |
| **Nombre** | Consultar cuotas pendientes de un cliente |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | Antes de registrar una cobranza, el actor consulta las cuotas pendientes de un cliente para seleccionar cuáles cobrar. |
| **Pre-condición** | El usuario está autenticado. El cliente tiene facturas crédito con cuotas pendientes. |
| **Flujo básico** | 1. En el formulario de nueva cobranza, el actor busca y selecciona el cliente. <br>2. El sistema consulta `GET /api/cobranzas/cuotas-pendientes/?persona={id}`. <br>3. El endpoint retorna las `CtaCobrar` con `saldo > 0` agrupadas por factura: N° factura, fecha de vencimiento, monto original, monto pagado, saldo pendiente. <br>4. El actor selecciona las cuotas a cobrar en esta operación. |
| **Flujo alterno** | **A1 – Sin cuotas pendientes:** El sistema muestra "Este cliente no tiene cuotas pendientes." |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-09: Solo se muestran cuotas con `saldo > 0`. Las cuotas completamente canceladas no aparecen. |
| **Post-condición** | El actor tiene visibilidad de todas las cuotas pendientes del cliente para seleccionar cuáles cobrar. |
