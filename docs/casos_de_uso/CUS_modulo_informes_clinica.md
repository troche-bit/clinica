# Especificaciones de Casos de Uso — Módulo Informes Clínicos
**Sistema:** Clínica Lichi  
**Módulo:** Informes → Informes Pacientes  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total a todos los listados, dashboards e historia clínica. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede acceder a los mismos informes que el administrador. |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-INC-001 | Ver página de informes clínicos con estadísticas del día | Administrador / Recepcionista |
| CUS-INC-002 | Generar listado de pacientes (PDF / Excel) | Administrador / Recepcionista |
| CUS-INC-003 | Generar listado de consultas (PDF / Excel) | Administrador / Recepcionista |
| CUS-INC-004 | Generar historia clínica de un paciente (PDF) | Administrador / Recepcionista |
| CUS-INC-005 | Generar listado de agenda (PDF) | Administrador / Recepcionista |
| CUS-INC-006 | Generar listado de horarios de prestadores (PDF / Excel) | Administrador / Recepcionista |
| CUS-INC-007 | Ver dashboard de pacientes | Administrador / Recepcionista |
| CUS-INC-008 | Ver dashboards de agenda, consultas y prestadores | Administrador / Recepcionista |

---

## CUS-INC-001 — Ver página de informes clínicos con estadísticas del día

| Campo | Detalle |
|---|---|
| **ID** | CUS-INC-001 |
| **Módulo** | Informes Clínicos |
| **Nombre** | Ver página de informes clínicos con estadísticas del día |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | Al acceder a la página de informes, el sistema muestra automáticamente tres stat cards con el total de pacientes, consultas del día y turnos pendientes, junto con las cards de listados y dashboards disponibles. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor navega a Informes (`/informes`). <br>2. El sistema lanza en paralelo tres consultas: `GET /api/paciente/count/`, `GET /api/consultas/stats-hoy/`, `GET /api/agenda/stats-hoy/`. <br>3. Se muestran las stat cards: "Pacientes totales", "Consultas hoy", "Pendientes hoy". <br>4. Debajo se muestran dos secciones: "Listados exportables" (5 cards) y "Estadísticas" (5 cards de dashboard). |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error en alguna stat:** La card afectada muestra "—". |
| **Reglas de negocio** | RN-01: Las tres consultas de stats se hacen al montar la página. |
| **Post-condición** | La página de informes está visible con estadísticas del día actualizadas. |

---

## CUS-INC-002 — Generar listado de pacientes (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-INC-002 |
| **Módulo** | Informes Clínicos |
| **Nombre** | Generar listado de pacientes (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor abre el modal de filtros de pacientes y genera un listado en PDF o Excel con los filtros aplicados. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en la card "Pacientes" en la sección de listados. <br>2. El modal muestra filtros en cascada: País → Departamento → Ciudad, Sexo, Grupo sanguíneo, Fecha registro desde/hasta. <br>3. El actor aplica los filtros deseados y hace clic en "Ver PDF" o "Descargar Excel". <br>4. El sistema construye la query string con los filtros no vacíos y envía `GET /api/paciente/reporte-lista/` o `GET /api/paciente/reporte-lista-excel/` con `responseType: 'blob'`. <br>5. PDF: se abre en nueva pestaña. Excel: se descarga como `pacientes.xlsx`. |
| **Flujo alterno** | **A1 – Sin filtros:** Se exportan todos los pacientes activos. |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-02: Los filtros de departamento dependen del país seleccionado (cascada). Los de ciudad dependen del departamento. <br>RN-03: Los botones se deshabilitan mientras se genera el archivo. |
| **Post-condición** | PDF abierto en nueva pestaña o archivo Excel descargado con los pacientes filtrados. |

---

## CUS-INC-003 — Generar listado de consultas (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-INC-003 |
| **Módulo** | Informes Clínicos |
| **Nombre** | Generar listado de consultas (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor abre el modal de filtros de consultas y genera un listado agrupado por especialidad en PDF o Excel. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Consultas". <br>2. El modal muestra filtros: Prestador (BuscadorFiltrable), Especialidad (BuscadorFiltrable), Evento clínico, Paciente (debounce), Fecha desde/hasta. <br>3. El actor aplica filtros y genera el PDF o Excel. <br>4. El sistema envía `GET /api/consultas/reporte-consultas/` o `GET /api/consultas/reporte-consultas-excel/`. <br>5. El PDF muestra grupos por especialidad. El Excel usa colores de fila alternados por grupo. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-04: Las consultas se agrupan internamente por especialidad en el backend (`_consultas_agrupadas`). |
| **Post-condición** | Listado de consultas generado con el agrupamiento por especialidad. |

---

## CUS-INC-004 — Generar historia clínica de un paciente (PDF)

| Campo | Detalle |
|---|---|
| **ID** | CUS-INC-004 |
| **Módulo** | Informes Clínicos |
| **Nombre** | Generar historia clínica de un paciente (PDF) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor busca un paciente por nombre y genera el PDF de su historia clínica completa: todas las consultas con datos clínicos y documentos adjuntos, ordenadas por fecha descendente. |
| **Pre-condición** | El usuario está autenticado. El paciente tiene al menos una consulta registrada. |
| **Flujo básico** | 1. El actor hace clic en la card "Historia clínica". <br>2. Aparece un buscador de paciente con debounce de 300 ms y navegación por teclado (↑/↓/Enter/Escape). <br>3. El actor escribe y selecciona el paciente. <br>4. El sistema envía `GET /api/consultas/historia-clinica/?paciente={id}` con `responseType: 'blob'`. <br>5. El backend recupera todas las consultas del paciente y un mapa de documentos por consulta. <br>6. El PDF se abre en nueva pestaña con el nombre del paciente en el título. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Sin consultas:** El PDF se genera con mensaje "Sin consultas registradas." |
| **Reglas de negocio** | RN-05: El PDF incluye los documentos adjuntos de cada consulta (referencias, no el archivo en sí). |
| **Post-condición** | PDF de la historia clínica completa del paciente abierto en nueva pestaña. |

---

## CUS-INC-005 — Generar listado de agenda (PDF)

| Campo | Detalle |
|---|---|
| **ID** | CUS-INC-005 |
| **Módulo** | Informes Clínicos |
| **Nombre** | Generar listado de agenda (PDF) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera un PDF de los turnos de agenda filtrados por rango de fechas, prestador, especialidad y estado, agrupados por médico. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Agenda del día/semana". <br>2. El modal muestra: fecha desde, fecha hasta (max 2099-12-31), Prestador, Especialidad, Estado. <br>3. El actor aplica filtros y hace clic en "Ver PDF". <br>4. El sistema envía `GET /api/agenda/reporte-agenda/` con `responseType: 'blob'`. <br>5. El PDF muestra los turnos agrupados por médico con hora, estado y paciente. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-06: Solo formato PDF (sin Excel para este informe). |
| **Post-condición** | PDF de agenda abierto en nueva pestaña. |

---

## CUS-INC-006 — Generar listado de horarios de prestadores (PDF / Excel)

| Campo | Detalle |
|---|---|
| **ID** | CUS-INC-006 |
| **Módulo** | Informes Clínicos |
| **Nombre** | Generar listado de horarios de prestadores (PDF / Excel) |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor genera el listado de horarios configurados para los prestadores, con opciones de filtrar por prestador y día de semana. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card "Horarios prestadores". <br>2. El modal muestra: Prestador (BuscadorFiltrable), Día semana. <br>3. El actor aplica filtros y genera PDF o Excel. <br>4. El sistema envía `GET /api/horario-prestador/reporte-horarios/` o `/reporte-horarios-excel/`. <br>5. PDF: nueva pestaña. Excel: descarga automática. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al generar:** Toast de error. |
| **Reglas de negocio** | RN-07: Disponible PDF y Excel. |
| **Post-condición** | Listado de horarios generado en el formato seleccionado. |

---

## CUS-INC-007 — Ver dashboard de pacientes

| Campo | Detalle |
|---|---|
| **ID** | CUS-INC-007 |
| **Módulo** | Informes Clínicos |
| **Nombre** | Ver dashboard de pacientes |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor accede al dashboard analítico de pacientes que muestra gráficos de distribución por sexo, registros por día/semana/mes, top departamentos y tendencia de 6 meses. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card estadística "Pacientes" (o navega a `/informes/dashboard/pacientes`). <br>2. La página carga `GET /api/paciente/dashboard-mensual/` al montar. <br>3. Se renderizan los gráficos CSS/SVG: Donut de sexo, CalendarioBars con toggle Día/Semana/Mes, BarraH departamentos, TendenciaCurva SVG. <br>4. El actor puede cambiar el toggle Día/Semana/Mes sin nuevas peticiones al servidor. |
| **Flujo alterno** | **A1 – Sin datos del mes:** Las gráficas muestran estado vacío. |
| **Flujo de excepción** | **E1 – Error al cargar:** Toast de error. El dashboard muestra mensaje de error. |
| **Reglas de negocio** | RN-08: El toggle Día/Semana/Mes opera sobre datos ya cargados (sin refetch). <br>RN-09: Los gráficos son CSS/SVG puros, sin librerías de charting externas. |
| **Post-condición** | Dashboard de pacientes visible con gráficos interactivos del mes actual. |

---

## CUS-INC-008 — Ver dashboards de agenda, consultas y prestadores

| Campo | Detalle |
|---|---|
| **ID** | CUS-INC-008 |
| **Módulo** | Informes Clínicos |
| **Nombre** | Ver dashboards de agenda, consultas y prestadores |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor accede a los dashboards especializados de agenda, consultas, prestadores y ocupación, cada uno con sus propias métricas y gráficos analíticos. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El actor hace clic en la card del dashboard deseado. <br>2. La página navega a la ruta correspondiente y carga los datos del endpoint específico. <br>3. Se renderizan los gráficos: <br>   — **Agenda**: DonutEstado + BarraH top prestadores + curva con dos líneas (realizados vs cancelados). <br>   — **Consultas**: BarraH top prestadores + BarraH por especialidad + curva comparativa 6 meses. <br>   — **Prestadores**: BarraH ocupación por médico + días demandados + horarios pico. <br>   — **Ocupación**: mapa de calor día × hora (divs con opacidad CSS). |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Error al cargar:** Toast de error con mensaje descriptivo. |
| **Reglas de negocio** | RN-10: El dashboard de prestadores es la ruta inicial del sistema para el rol `admin` (home redirect). <br>RN-11: El mapa de calor de ocupación usa opacidad CSS proporcional al máximo (`opacity = total/maxTotal`). |
| **Post-condición** | El dashboard seleccionado está visible con datos analíticos actualizados. |
