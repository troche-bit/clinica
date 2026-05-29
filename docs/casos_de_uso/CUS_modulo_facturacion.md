# Especificaciones de Casos de Uso — Módulo Facturación
**Sistema:** Clínica Lichi  
**Módulo:** Facturación → Ventas  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: emitir, anular y ver el listado completo de facturas. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede emitir facturas y actualizar datos menores, pero no anular. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-FAC-001 | Listar y filtrar facturas | Administrador / Recepcionista |
| CUS-FAC-002 | Ver detalle de factura | Administrador / Recepcionista |
| CUS-FAC-003 | Emitir factura contado | Administrador / Recepcionista |
| CUS-FAC-004 | Emitir factura crédito (cuotas) | Administrador / Recepcionista |
| CUS-FAC-005 | Imprimir / ver PDF de factura | Administrador / Recepcionista |
| CUS-FAC-006 | Anular factura | Administrador |
| CUS-FAC-007 | Validar timbrado y obtener siguiente número | Administrador / Recepcionista |

---

## CUS-FAC-001 — Listar y filtrar facturas

| Campo | Detalle |
|---|---|
| **ID** | CUS-FAC-001 |
| **Módulo** | Facturación |
| **Nombre** | Listar y filtrar facturas |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor visualiza el listado paginado de facturas con filtros por cliente, fecha y condición de venta. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor navega a Facturación. <br>2. El sistema consulta `GET /api/facturacion/` y muestra: N° comprobante, fecha, cliente, condición (contado/crédito), monto total, estado (activa/anulada). <br>3. El actor puede filtrar por cliente (buscador con debounce), rango de fechas y condición de venta. |
| **Flujo alterno** | **A1 – Sin facturas:** Mensaje "Sin facturas que coincidan." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo registros con `is_deleted = False`. <br>RN-02: Las facturas anuladas aparecen con badge rojo "Anulada". |
| **Post-condición** | Listado paginado de facturas visible. |

---

## CUS-FAC-002 — Ver detalle de factura

| Campo | Detalle |
|---|---|
| **ID** | CUS-FAC-002 |
| **Módulo** | Facturación |
| **Nombre** | Ver detalle de factura |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor selecciona una factura para ver sus datos completos: cabecera, ítems detallados, condición de pago y estado de cobranza. |
| **Pre-condición** | El usuario está autenticado. Existe al menos una factura. |
| **Flujo básico** | 1. El actor hace clic en una fila. <br>2. El sistema consulta `GET /api/facturacion/{id}/` y muestra el detalle: cliente, fecha, N° comprobante, ítems (descripción, cantidad, precio, subtotal), total, condición, forma de pago, cuotas (si crédito). <br>3. Hay acciones disponibles: "Ver PDF", "Anular" (solo admin), "Editar datos". |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-03: El botón "Anular" solo se muestra para `admin`. |
| **Post-condición** | Detalle completo de la factura visible. |

---

## CUS-FAC-003 — Emitir factura contado

| Campo | Detalle |
|---|---|
| **ID** | CUS-FAC-003 |
| **Módulo** | Facturación |
| **Nombre** | Emitir factura contado |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor emite una factura de contado: el pago se registra completo en el momento de la emisión, generando automáticamente el movimiento de caja/banco correspondiente. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. Existe al menos un timbrado vigente. |
| **Flujo básico** | 1. El actor hace clic en "Nueva factura". <br>2. El sistema obtiene el siguiente número de comprobante (`GET /api/facturacion/siguiente-numero/`) y lo muestra precargado. <br>3. El actor busca y selecciona el cliente (buscador por nombre/documento). <br>4. El actor agrega ítems: busca productos/servicios (buscador con debounce), ingresa cantidad; el precio unitario se precarga del producto. <br>5. El actor selecciona condición "Contado" y forma de pago (efectivo, tarjeta, transferencia). <br>6. El actor selecciona la cuenta de caja/banco destino. <br>7. El actor confirma la emisión. <br>8. El sistema envía `POST /api/facturacion/` en transacción atómica: crea `VentaFactCab` + `VentaFactDet[]` + `MovimientoCajaBanco` (ingreso por el monto total). <br>9. Se muestra un toast de confirmación y la opción de imprimir el PDF. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Timbrado sin rango disponible:** HTTP 400 con "No hay timbrado vigente con números disponibles." <br>**E2 – Ítem sin cantidad o precio:** Validación frontend bloquea el envío. <br>**E3 – Error en la transacción:** HTTP 500; ningún registro se crea parcialmente. |
| **Reglas de negocio** | RN-04: La emisión es atómica: si falla cualquier parte, no se crea ningún registro. <br>RN-05: El número de comprobante se toma del próximo disponible del timbrado vigente. <br>RN-06: El movimiento de caja se crea automáticamente con tipo `ingreso` en la cuenta seleccionada. |
| **Post-condición** | Factura emitida con N° de comprobante asignado. Movimiento de caja registrado. No se genera `CtaCobrar` para facturas contado. |

---

## CUS-FAC-004 — Emitir factura crédito (cuotas)

| Campo | Detalle |
|---|---|
| **ID** | CUS-FAC-004 |
| **Módulo** | Facturación |
| **Nombre** | Emitir factura crédito (cuotas) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor emite una factura a crédito. El monto total se divide en cuotas que quedan como cuentas a cobrar (`CtaCobrar`) para ser cobradas posteriormente mediante el módulo de Cobranzas. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. Existe al menos un timbrado vigente. |
| **Flujo básico** | 1. El actor completa los datos de la factura (igual que contado) pero selecciona condición "Crédito". <br>2. El actor indica la cantidad de cuotas y el vencimiento de la primera. <br>3. El actor confirma la emisión. <br>4. El sistema envía `POST /api/facturacion/` en transacción atómica: crea `VentaFactCab` + `VentaFactDet[]` + N registros `CtaCobrar` (una por cuota, con monto y fecha de vencimiento). <br>5. **No** se crea `MovimientoCajaBanco` en la emisión; el ingreso se registrará al cobrar cada cuota. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Cuotas sin fecha de vencimiento:** Validación bloquea el envío. <br>**E2 – Error en transacción:** HTTP 500; ningún registro se crea. |
| **Reglas de negocio** | RN-07: Para facturas crédito se generan N registros `CtaCobrar` (uno por cuota) con saldo pendiente. <br>RN-08: No se genera movimiento de caja al emitir; el ingreso se registra al cobrar desde el módulo Cobranzas. |
| **Post-condición** | Factura emitida. N cuotas en `CtaCobrar` con saldo pendiente. Visibles en el estado de cuenta del cliente. |

---

## CUS-FAC-005 — Imprimir / ver PDF de factura

| Campo | Detalle |
|---|---|
| **ID** | CUS-FAC-005 |
| **Módulo** | Facturación |
| **Nombre** | Imprimir / ver PDF de factura |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera el PDF oficial de una factura emitida para impresión o envío al cliente. |
| **Pre-condición** | La factura existe en el sistema. |
| **Flujo básico** | 1. El actor hace clic en "Ver PDF" desde el detalle de la factura. <br>2. El sistema abre `GET /api/facturacion/{id}/pdf/` en una nueva pestaña. <br>3. El endpoint genera el PDF con WeasyPrint usando la plantilla `factura_print.html`. <br>4. El PDF muestra: logo, datos de la clínica, datos del cliente, ítems, total, condición, forma de pago, número de timbrado y comprobante. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al generar:** El navegador muestra un error. |
| **Reglas de negocio** | RN-09: El endpoint PDF usa `permission_classes = [AllowAny]` para permitir abrirlo directamente con `window.open` sin enviar token en la URL. <br>RN-10: Los montos se formatean con el templatetag `|gs` (Guaraníes con separador de miles). |
| **Post-condición** | PDF de la factura abierto en nueva pestaña. |

---

## CUS-FAC-006 — Anular factura

| Campo | Detalle |
|---|---|
| **ID** | CUS-FAC-006 |
| **Módulo** | Facturación |
| **Nombre** | Anular factura |
| **Actor** | Administrador |
| **Descripción** | El administrador anula una factura emitida. La anulación marca la factura como inválida y revierte los efectos financieros: elimina los movimientos de caja, los ítems de detalle, las cuotas a cobrar y registra el retroceso. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. La factura existe y no está anulada. |
| **Flujo básico** | 1. El administrador hace clic en "Anular" en el detalle de la factura. <br>2. El `ConfirmDialog` muestra "¿Confirmar anulación? Esta acción no puede revertirse." <br>3. El administrador confirma. <br>4. El sistema envía `DELETE /api/facturacion/{id}/`. <br>5. El servidor ejecuta en cascada: elimina `MovimientoCajaBanco` vinculados, `VentaFactDet`, `VentaFactDetCobranza` y `CtaCobrar`. Marca `VentaFactCab.is_anulado = True`. <br>6. La factura queda en la lista con badge "Anulada". Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Factura ya anulada:** HTTP 400. |
| **Reglas de negocio** | RN-11: Solo `admin` puede anular facturas. <br>RN-12: La anulación es en cascada (no borrado lógico de VentaFactCab, sino `is_anulado=True`): elimina todos los registros dependientes. <br>RN-13: La anulación no bloquea el número de comprobante; queda como "número usado y anulado" visible en el informe de Control de Comprobantes. |
| **Post-condición** | Factura marcada como anulada. Los movimientos financieros revertidos. El número aparece como anulado en el informe de control. |

---

## CUS-FAC-007 — Validar timbrado y obtener siguiente número

| Campo | Detalle |
|---|---|
| **ID** | CUS-FAC-007 |
| **Módulo** | Facturación |
| **Nombre** | Validar timbrado y obtener siguiente número |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | Al abrir el formulario de nueva factura, el sistema verifica automáticamente si hay un timbrado vigente y obtiene el próximo número disponible. |
| **Pre-condición** | El usuario está en el formulario de nueva factura. |
| **Flujo básico** | 1. Al abrir el formulario, el sistema consulta `GET /api/facturacion/siguiente-numero/`. <br>2. El endpoint busca el timbrado vigente (fecha actual entre `vigente_desde` y `vigente_hasta`) y calcula el siguiente número (`MAX(nro_comprobante) + 1`). <br>3. El número se precarga en el campo de comprobante (solo lectura para el usuario). <br>4. Si el actor necesita validar un número específico, puede usar `POST /api/facturacion/validar-timbrado/` con `{ nro_comprobante }`. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Sin timbrado vigente:** HTTP 400 con "No hay timbrado vigente configurado." <br>**E2 – Rango de comprobantes agotado:** HTTP 400 indicando que se debe configurar un nuevo timbrado. |
| **Reglas de negocio** | RN-14: El número de comprobante es asignado por el sistema basándose en el timbrado vigente; el usuario no puede editarlo libremente. |
| **Post-condición** | El formulario de nueva factura muestra el N° de comprobante siguiente disponible. |
