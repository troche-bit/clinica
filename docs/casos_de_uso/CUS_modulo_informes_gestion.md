# Especificaciones de Casos de Uso — Módulo Informes Gestión
**Sistema:** Clínica Lichi  
**Módulo:** Informes → Informes Gestión (Stock, Facturación y Finanzas)  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total a todos los listados y dashboards de gestión. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede acceder a los mismos informes que el administrador. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-IGE-001 | Ver página de informes de gestión | Administrador / Recepcionista |
| CUS-IGE-002 | Generar listado de productos por grupo (PDF / Excel) | Administrador / Recepcionista |
| CUS-IGE-003 | Generar listado de facturas (PDF / Excel) | Administrador / Recepcionista |
| CUS-IGE-004 | Generar informe de control de comprobantes (PDF / Excel) | Administrador / Recepcionista |
| CUS-IGE-005 | Generar estado de cuenta por cliente (PDF / Excel) | Administrador / Recepcionista |
| CUS-IGE-006 | Generar extracto de cuenta por cliente (PDF / Excel) | Administrador / Recepcionista |
| CUS-IGE-007 | Generar listado de cobranzas / recibos (PDF / Excel) | Administrador / Recepcionista |
| CUS-IGE-008 | Generar listado de movimientos de caja/banco (PDF / Excel) | Administrador / Recepcionista |
| CUS-IGE-009 | Generar listado de pagos a prestadores (PDF / Excel) | Administrador / Recepcionista |
| CUS-IGE-010 | Ver dashboard de facturación | Administrador / Recepcionista |
| CUS-IGE-011 | Ver dashboard de finanzas | Administrador / Recepcionista |
| CUS-IGE-012 | Ver dashboard de cobranzas | Administrador / Recepcionista |

---

## CUS-IGE-001 — Ver página de informes de gestión

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-001 |
| **Módulo** | Informes Gestión |
| **Nombre** | Ver página de informes de gestión |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor accede a la página que agrupa los informes de stock, facturación y finanzas. La página no hace peticiones al montar; los datos se cargan al abrir cada modal específico. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor navega a Informes → Gestión (`/informes/stock`). <br>2. La página muestra dos secciones: "Listados exportables" (8 cards) y "Dashboards analíticos" (3 cards). <br>3. Sin peticiones HTTP al montar: los datos se cargan de forma diferida al abrir cada modal. |
| **Flujo alterno** | — |
| **Flujo de excepción** | — |
| **Reglas de negocio** | RN-01: La carga de grupos (modal Productos) y cuentas (modal Movimientos) es diferida y ocurre solo la primera vez que se abre el modal correspondiente. |
| **Post-condición** | Página de informes de gestión visible con 8 + 3 opciones disponibles. |

---

## CUS-IGE-002 — Generar listado de productos por grupo (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-002 |
| **Módulo** | Informes Gestión |
| **Nombre** | Generar listado de productos por grupo (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera un listado de productos/servicios del catálogo, con opción de filtrar por grupo específico. El informe agrupa los productos por grupo con subtotales. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Productos por grupo". <br>2. El modal carga los grupos activos (`GET /api/grupos/` — solo la primera vez). <br>3. El actor selecciona un grupo o deja "Todos". <br>4. El actor hace clic en "Ver PDF" o "Descargar Excel". <br>5. El sistema envía `GET /api/productos/reporte-productos/` o `/reporte-productos-excel/` con el filtro. <br>6. PDF: nueva pestaña. Excel: descarga `productos_YYYYMMDD.xlsx`. |
| **Flujo alterno** | **A1 – Sin filtro:** Se exportan todos los grupos. |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-02: El PDF agrupa por grupo con separador de sección. El Excel usa colores alternados por grupo. |
| **Post-condición** | Listado de productos generado con agrupamiento por grupo. |

---

## CUS-IGE-003 — Generar listado de facturas (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-003 |
| **Módulo** | Informes Gestión |
| **Nombre** | Generar listado de facturas (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera el listado de facturas emitidas con filtros por cliente, rango de fechas, condición de venta y opción de agrupar por cliente. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Listado de facturas". <br>2. El modal muestra: Cliente (buscador debounce), Fecha desde/hasta (default: hoy), Condición de venta (Todas/Contado/Crédito), checkbox "Agrupar por cliente". <br>3. El actor aplica filtros y genera el informe. <br>4. El sistema envía `GET /api/facturacion/reporte-pdf/` o `/reporte-excel/` con los parámetros. |
| **Flujo alterno** | **A1 – Con agrupamiento:** El informe muestra un subtotal de facturas y monto por cliente. |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-03: El parámetro `agrupar_cliente=true` solo se envía si el checkbox está marcado y `persona` si se seleccionó un cliente. |
| **Post-condición** | Listado de facturas generado con los filtros y agrupamiento seleccionados. |

---

## CUS-IGE-004 — Generar informe de control de comprobantes (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-004 |
| **Módulo** | Informes Gestión |
| **Nombre** | Generar informe de control de comprobantes (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera el informe de integridad fiscal: muestra las facturas anuladas en el rango de fechas seleccionado y los números de comprobante no emitidos (salteados) en todos los timbrados con comprobantes activos. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Control de comprobantes". <br>2. El modal muestra: Fecha desde/hasta (para las anuladas). <br>3. El actor selecciona el rango y genera. <br>4. El sistema envía `GET /api/facturacion/reporte-control-pdf/` o `/reporte-control-excel/`. <br>5. El informe tiene dos secciones: "Facturas Anuladas" y "Números no emitidos (salteados)". |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-04: Los números salteados se calculan para todos los timbrados con comprobantes activos, sin restricción de fechas. |
| **Post-condición** | Informe de control de comprobantes generado con las dos secciones. |

---

## CUS-IGE-005 — Generar estado de cuenta por cliente (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-005 |
| **Módulo** | Informes Gestión |
| **Nombre** | Generar estado de cuenta por cliente (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera el informe de cuotas a cobrar agrupadas por cliente, en modo detallado (una fila por cuota) o resumido (una fila por cliente), con opción de rango de fechas y filtro de cliente. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Estado de cuenta". <br>2. El modal muestra: Toggle Detallado/Resumido, checkbox "Rango de fecha" (habilita campo Desde), campo Hasta, Cliente (buscador), checkbox "Incluir saldo cero". <br>3. El actor configura y genera. <br>4. El sistema construye la query string y envía `GET /api/facturacion/estado-cuenta-pdf/` o `/estado-cuenta-excel/`. |
| **Flujo alterno** | **A1 – Sin rango:** Se incluye todo hasta la fecha Hasta, sin límite inferior. <br>**A2 – Sin cliente:** Se muestran todos los clientes con cuotas. |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-05: Por defecto `incluir_saldo_cero = False`; solo se muestran cuotas con saldo > 0. <br>RN-06: Modo resumido: una fila por cliente con total cuotas y saldo acumulado. |
| **Post-condición** | Estado de cuenta generado con el modo y filtros seleccionados. |

---

## CUS-IGE-006 — Generar extracto de cuenta por cliente (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-006 |
| **Módulo** | Informes Gestión |
| **Nombre** | Generar extracto de cuenta por cliente (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera el extracto de movimientos (facturas y recibos) de un cliente o de todos los clientes, en modo cronológico o agrupado por factura. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Extracto de cuenta". <br>2. El modal muestra: Toggle Cronológico/Por factura, checkbox "Rango de fecha", campos Desde/Hasta, Cliente (buscador), checkbox "Incluir saldo cero". <br>3. El actor configura y genera. <br>4. El sistema envía `GET /api/facturacion/extracto-cuenta-pdf/` o `/extracto-cuenta-excel/`. |
| **Flujo alterno** | **A1 – Modo por factura:** El informe agrupa: cliente → factura → recibos aplicados a esa factura. <br>**A2 – Modo cronológico:** El informe lista facturas y recibos mezclados por fecha. |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-07: El parámetro `agrupar_por_factura` determina el modo de agrupación. |
| **Post-condición** | Extracto de cuenta generado en el modo y formato seleccionados. |

---

## CUS-IGE-007 — Generar listado de cobranzas / recibos (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-007 |
| **Módulo** | Informes Gestión |
| **Nombre** | Generar listado de cobranzas / recibos (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera el listado de recibos emitidos en un rango de fechas, con opción de filtrar por cliente. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Cobranzas / Recibos". <br>2. El modal muestra: Fecha desde/hasta, Cliente (buscador opcional). <br>3. El actor aplica filtros y genera. <br>4. El sistema envía `GET /api/cobranzas/reporte-pdf/` o `/reporte-excel/`. |
| **Flujo alterno** | **A1 – Sin cliente:** Se exportan todos los recibos del período. |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-08: El filtro de cliente usa `search` (nombre) ya que no se puede filtrar por ID directo en este endpoint. |
| **Post-condición** | Listado de recibos generado con los filtros aplicados. |

---

## CUS-IGE-008 — Generar listado de movimientos de caja/banco (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-008 |
| **Módulo** | Informes Gestión |
| **Nombre** | Generar listado de movimientos de caja/banco (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera el listado de movimientos de una cuenta (o todas), filtrado por tipo y rango de fechas, con saldo acumulado. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Movimientos Caja/Banco". <br>2. El modal carga las cuentas activas (`GET /api/cuentas-mcb/` — solo la primera vez). Muestra: Cuenta (select), Tipo (Todos/Ingresos/Egresos), Fecha desde/hasta. <br>3. El actor aplica filtros y genera. <br>4. El sistema envía `GET /api/movimientos-caja/reporte-pdf/` o `/reporte-excel/`. |
| **Flujo alterno** | **A1 – Sin cuenta seleccionada:** Se incluyen movimientos de todas las cuentas. |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-09: El PDF muestra el saldo acumulado por movimiento. El Excel tiene una hoja por cuenta si se exportan todas. |
| **Post-condición** | Listado de movimientos generado con los filtros aplicados. |

---

## CUS-IGE-009 — Generar listado de pagos a prestadores (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-009 |
| **Módulo** | Informes Gestión |
| **Nombre** | Generar listado de pagos a prestadores (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera el listado de pagos emitidos a prestadores con filtros por prestador, estado y rango de fechas. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Pagos a Prestadores". <br>2. El modal muestra: Fecha desde/hasta, Estado (Todos/Pagado/Pendiente/Parcial), Prestador (buscador de `personarrhh`). <br>3. El actor aplica filtros y genera. <br>4. El sistema envía `GET /api/pago-prestador/reporte-pdf/` o `/reporte-excel/`. |
| **Flujo alterno** | **A1 – Sin prestador:** Se exportan pagos de todos los prestadores. |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-10: El buscador de prestador usa `GET /api/personarrhh/` y el nombre del prestador se obtiene con `m.nombre` (campo plano del `PersonaRRHHListSerializer`). |
| **Post-condición** | Listado de pagos a prestadores generado con los filtros aplicados. |

---

## CUS-IGE-010 — Ver dashboard de facturación

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-010 |
| **Módulo** | Informes Gestión |
| **Nombre** | Ver dashboard de facturación |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor accede al dashboard analítico de facturación con gráficos de evolución diaria (contado vs crédito), resumen del mes, donut de condición y top clientes. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Dashboard Facturación" o navega a `/informes/dashboard/facturacion`. <br>2. La página carga `GET /api/facturacion/dashboard-mensual/` al montar. <br>3. Se renderizan: 4 stat cards (emitidas hoy, monto hoy, anuladas hoy, ticket promedio), gráfico de barras con toggle Día/Semana/Mes (azul=contado, ámbar=crédito), resumen del mes con totales, donut de condición (contado vs crédito), BarraH top 8 clientes. <br>4. El actor puede cambiar el toggle sin nuevas peticiones. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al cargar:** Toast de error. |
| **Reglas de negocio** | RN-11: El toggle Día/Semana/Mes opera sobre los datos ya cargados (por_dia, por_semana, por_mes). <br>RN-12: El color ámbar (#d97706) representa crédito en todos los gráficos. |
| **Post-condición** | Dashboard de facturación visible con datos del mes actual. |

---

## CUS-IGE-011 — Ver dashboard de finanzas

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-011 |
| **Módulo** | Informes Gestión |
| **Nombre** | Ver dashboard de finanzas |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor accede al dashboard de finanzas con el saldo actual por cuenta, resumen de ingresos vs egresos del mes y el flujo diario con barras duales. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor navega a `/informes/dashboard/finanzas`. <br>2. La página carga `GET /api/cuentas-mcb/dashboard-mensual/`. <br>3. Se renderizan: 3 stat cards (ingresos mes, egresos mes, saldo neto), barras horizontales de saldo por cuenta, barras duales diarias (verde=ingresos, rojo=egresos). |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al cargar:** Toast de error. |
| **Reglas de negocio** | RN-13: El saldo neto se colorea en verde si positivo, rojo si negativo. |
| **Post-condición** | Dashboard de finanzas visible con saldos y flujo del mes actual. |

---

## CUS-IGE-012 — Ver dashboard de cobranzas

| Campo | Detalle |
|---|---|
| **ID** | CUS-IGE-012 |
| **Módulo** | Informes Gestión |
| **Nombre** | Ver dashboard de cobranzas |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor accede al dashboard de cobranzas con el monto cobrado del mes, la deuda pendiente total, el porcentaje de cobro y el top de deudores. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor navega a `/informes/dashboard/cobranzas`. <br>2. La página carga `GET /api/cobranzas/dashboard-mensual/`. <br>3. Se renderizan: 4 stat cards (cobrado del mes, deuda pendiente, % de cobro, cantidad de recibos), barras diarias de cobranza, BarraH top 10 deudores (barras rojas). |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al cargar:** Toast de error. |
| **Reglas de negocio** | RN-14: La deuda pendiente y los deudores se muestran en color rojo para destacar el riesgo. <br>RN-15: El % de cobro se calcula como `total_cobrado_mes / total_facturado * 100`. |
| **Post-condición** | Dashboard de cobranzas visible con métricas del mes actual y top deudores. |
