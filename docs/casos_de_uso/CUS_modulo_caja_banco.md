# Especificaciones de Casos de Uso — Módulo Cuentas Caja/Banco y Movimientos
**Sistema:** Clínica Lichi  
**Módulo:** Finanzas → Cuentas Caja/Banco  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: crear, editar y eliminar cuentas y movimientos. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear y editar movimientos manuales, pero no eliminar cuentas. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-CAJ-001 | Listar cuentas con saldo | Administrador |
| CUS-CAJ-002 | Crear cuenta Caja/Banco | Administrador |
| CUS-CAJ-003 | Editar cuenta Caja/Banco | Administrador |
| CUS-CAJ-004 | Eliminar cuenta (borrado lógico) | Administrador |
| CUS-CAJ-005 | Ver movimientos de una cuenta | Administrador / Recepcionista |
| CUS-CAJ-006 | Registrar movimiento manual | Administrador / Recepcionista |
| CUS-CAJ-007 | Editar movimiento | Administrador / Recepcionista |
| CUS-CAJ-008 | Eliminar movimiento (borrado lógico) | Administrador |

---

## CUS-CAJ-001 — Listar cuentas con saldo

| Campo | Detalle |
|---|---|
| **ID** | CUS-CAJ-001 |
| **Módulo** | Cuentas Caja/Banco |
| **Nombre** | Listar cuentas con saldo |
| **Actor** | Administrador |
| **Descripción** | El administrador visualiza todas las cuentas de caja y banco configuradas, cada una con su saldo calculado (suma de ingresos menos egresos). |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador navega a Finanzas → Cuentas Caja/Banco. <br>2. El sistema consulta `GET /api/cuentas-mcb/` con el campo `saldo` anotado. <br>3. Se muestra una tabla con: descripción, tipo (caja/banco), saldo actual, estado. <br>4. El administrador puede seleccionar una cuenta para ver sus movimientos en el panel. |
| **Flujo alterno** | **A1 – Sin cuentas:** Mensaje "Sin cuentas registradas." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo `admin` puede gestionar cuentas. <br>RN-02: El saldo es un campo anotado (`Sum(ingresos) - Sum(egresos)`), no almacenado en la tabla. |
| **Post-condición** | Lista de cuentas con saldo actualizado visible. |

---

## CUS-CAJ-002 — Crear cuenta Caja/Banco

| Campo | Detalle |
|---|---|
| **ID** | CUS-CAJ-002 |
| **Módulo** | Cuentas Caja/Banco |
| **Nombre** | Crear cuenta Caja/Banco |
| **Actor** | Administrador |
| **Descripción** | El administrador registra una nueva cuenta (caja física o cuenta bancaria) que será usada para registrar movimientos financieros. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador hace clic en "Nueva cuenta". <br>2. El formulario muestra: descripción*, tipo (caja/banco)*, número de cuenta (si banco), banco (si banco), observaciones. <br>3. El administrador completa y guarda. <br>4. El sistema envía `POST /api/cuentas-mcb/`. <br>5. La nueva cuenta aparece con saldo ₲ 0. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Descripción duplicada:** HTTP 400. |
| **Reglas de negocio** | RN-03: La descripción de la cuenta es única. <br>RN-04: Solo `admin` puede crear cuentas. |
| **Post-condición** | Nueva cuenta disponible para registrar movimientos desde facturación, cobranzas y pagos a prestadores. Registrada en auditoría. |

---

## CUS-CAJ-003 — Editar cuenta Caja/Banco

| Campo | Detalle |
|---|---|
| **ID** | CUS-CAJ-003 |
| **Módulo** | Cuentas Caja/Banco |
| **Nombre** | Editar cuenta Caja/Banco |
| **Actor** | Administrador |
| **Descripción** | El administrador modifica los datos descriptivos de una cuenta existente. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. La cuenta existe y no está eliminada. |
| **Flujo básico** | 1. El administrador selecciona la cuenta y hace clic en editar. <br>2. El formulario muestra los datos precargados. <br>3. El administrador modifica y guarda. <br>4. El sistema envía `PATCH /api/cuentas-mcb/{id}/`. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Descripción duplicada:** HTTP 400. |
| **Reglas de negocio** | RN-03: Unicidad de descripción excluyendo el registro actual. |
| **Post-condición** | Cuenta actualizada. Registrada en auditoría. |

---

## CUS-CAJ-004 — Eliminar cuenta (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-CAJ-004 |
| **Módulo** | Cuentas Caja/Banco |
| **Nombre** | Eliminar cuenta (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente una cuenta que no tenga movimientos activos vinculados. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. La cuenta no tiene movimientos activos en `MovimientoCajaBanco`. |
| **Flujo básico** | 1. El administrador hace clic en eliminar. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/cuentas-mcb/{id}/`. <br>4. El servidor verifica movimientos activos y marca `is_deleted = True`. <br>5. La cuenta desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Cuenta con movimientos activos:** HTTP 400. |
| **Reglas de negocio** | RN-05: Sin movimientos activos. RN-06: Borrado lógico. |
| **Post-condición** | Cuenta marcada `is_deleted = True`. No aparece en selectores de facturación ni cobranzas. |

---

## CUS-CAJ-005 — Ver movimientos de una cuenta

| Campo | Detalle |
|---|---|
| **ID** | CUS-CAJ-005 |
| **Módulo** | Cuentas Caja/Banco |
| **Nombre** | Ver movimientos de una cuenta |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor selecciona una cuenta para ver el listado de sus movimientos con filtros por tipo y fecha, con el saldo acumulado por movimiento. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. Hay una cuenta seleccionada. |
| **Flujo básico** | 1. El actor selecciona la cuenta en el panel o usa el selector. <br>2. El sistema consulta `GET /api/movimientos-caja/?cta={id}` con filtros opcionales de tipo y fecha. <br>3. Se muestra el listado: fecha, descripción, tipo (ingreso/egreso), monto, origen (manual / generado por facturación / cobranza). |
| **Flujo alterno** | **A1 – Sin movimientos:** Mensaje "Sin movimientos para esta cuenta." |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-07: Los movimientos generados automáticamente (facturación, cobranzas, pagos) no pueden editarse desde este módulo; solo los manuales. |
| **Post-condición** | Listado de movimientos de la cuenta con filtros visible. |

---

## CUS-CAJ-006 — Registrar movimiento manual

| Campo | Detalle |
|---|---|
| **ID** | CUS-CAJ-006 |
| **Módulo** | Cuentas Caja/Banco |
| **Nombre** | Registrar movimiento manual |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor registra un movimiento de caja/banco que no proviene de facturación ni cobranzas (ej: pago de servicios, retiro de efectivo, depósito). |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. Existe al menos una cuenta activa. |
| **Flujo básico** | 1. El actor hace clic en "Nuevo movimiento". <br>2. El formulario muestra: cuenta*, tipo (ingreso/egreso)*, fecha*, monto*, descripción*, forma de pago. <br>3. El actor completa y guarda. <br>4. El sistema envía `POST /api/movimientos-caja/`. <br>5. El nuevo movimiento aparece en la lista. El saldo de la cuenta se actualiza. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Monto negativo o cero:** HTTP 400. |
| **Reglas de negocio** | RN-08: El monto siempre es positivo; el tipo (ingreso/egreso) define el signo del efecto en el saldo. |
| **Post-condición** | Movimiento registrado. Saldo de la cuenta actualizado. Registrado en auditoría. |

---

## CUS-CAJ-007 — Editar movimiento

| Campo | Detalle |
|---|---|
| **ID** | CUS-CAJ-007 |
| **Módulo** | Cuentas Caja/Banco |
| **Nombre** | Editar movimiento |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica los datos de un movimiento manual existente. No se pueden editar movimientos generados automáticamente por facturación o cobranzas. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El movimiento es de tipo manual. |
| **Flujo básico** | 1. El actor selecciona el movimiento y hace clic en editar. <br>2. El formulario muestra los datos precargados. <br>3. El actor modifica y guarda. <br>4. El sistema envía `PATCH /api/movimientos-caja/{id}/`. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Movimiento automático:** El botón editar no se muestra. |
| **Reglas de negocio** | RN-07: Solo movimientos manuales pueden editarse. |
| **Post-condición** | Movimiento actualizado. Registrado en auditoría. |

---

## CUS-CAJ-008 — Eliminar movimiento (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-CAJ-008 |
| **Módulo** | Cuentas Caja/Banco |
| **Nombre** | Eliminar movimiento (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un movimiento de caja (manual o vinculado a una factura anulada). |
| **Pre-condición** | El usuario está autenticado con rol `admin`. |
| **Flujo básico** | 1. El administrador hace clic en eliminar sobre el movimiento. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/movimientos-caja/{id}/`. <br>4. El servidor marca `is_deleted = True`. <br>5. El movimiento desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-09: Solo `admin` puede eliminar movimientos. RN-10: Borrado lógico. |
| **Post-condición** | Movimiento marcado `is_deleted = True`. El saldo de la cuenta se recalcula automáticamente. |
