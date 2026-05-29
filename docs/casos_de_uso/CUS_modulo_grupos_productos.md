# Especificaciones de Casos de Uso — Módulo Grupos y Productos
**Sistema:** Clínica Lichi  
**Módulo:** Stock → Grupos y Productos  
**Versión:** 1.0 · Mayo 2026

---

## Actores

| Actor | Descripción |
|---|---|
| **Administrador** | Usuario con rol `admin`. Acceso total: crear, editar, eliminar y restaurar grupos y productos. |
| **Recepcionista** | Usuario con rol `recepcionista`. Puede crear y editar grupos y productos, pero no eliminar. |
| **Usuario autenticado** | Cualquier rol. Puede consultar el catálogo (usado en el formulario de facturación). |

---

## Índice de Casos de Uso

| ID | Nombre | Actor principal |
|---|---|---|
| CUS-GRP-001 | Listar grupos y sus productos | Usuario autenticado |
| CUS-GRP-002 | Crear grupo | Administrador / Recepcionista |
| CUS-GRP-003 | Editar grupo | Administrador / Recepcionista |
| CUS-GRP-004 | Eliminar grupo (borrado lógico) | Administrador |
| CUS-GRP-005 | Agregar producto a un grupo | Administrador / Recepcionista |
| CUS-GRP-006 | Editar producto | Administrador / Recepcionista |
| CUS-GRP-007 | Eliminar producto (borrado lógico) | Administrador |

---

## CUS-GRP-001 — Listar grupos y sus productos

| Campo | Detalle |
|---|---|
| **ID** | CUS-GRP-001 |
| **Módulo** | Grupos y Productos |
| **Nombre** | Listar grupos y sus productos |
| **Actor** | Usuario autenticado |
| **Descripción** | El usuario visualiza el listado de grupos activos con el conteo de productos de cada uno. Al seleccionar un grupo se muestran sus productos en un panel o listado expandido. |
| **Pre-condición** | El usuario está autenticado. |
| **Flujo básico** | 1. El usuario navega a Stock → Grupos y Productos. <br>2. El sistema consulta `GET /api/grupos/` con el conteo `total_productos` anotado. <br>3. Se muestran las tarjetas de grupo con nombre, descripción, estado y cantidad de productos. <br>4. El usuario puede filtrar grupos por búsqueda y/o por activo/inactivo. <br>5. El usuario selecciona un grupo; el sistema consulta `GET /api/productos/?grupo={id}` y muestra los productos. |
| **Flujo alterno** | **A1 – Grupo sin productos:** Se muestra "Este grupo no tiene productos." |
| **Flujo de excepción** | **E1 – Error de red:** Toast de error. |
| **Reglas de negocio** | RN-01: Solo registros con `is_deleted = False`. <br>RN-02: `total_productos` es un conteo anotado en el queryset, no un campo del modelo. |
| **Post-condición** | Listado de grupos visible con sus productos al seleccionar uno. |

---

## CUS-GRP-002 — Crear grupo

| Campo | Detalle |
|---|---|
| **ID** | CUS-GRP-002 |
| **Módulo** | Grupos y Productos |
| **Nombre** | Crear grupo |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor registra un nuevo grupo de productos (ej: Consultas, Laboratorio, Medicamentos). |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. |
| **Flujo básico** | 1. El actor hace clic en "Nuevo grupo". <br>2. El sistema muestra el formulario con campos: descripción* y observaciones. <br>3. El actor completa y guarda. <br>4. El sistema envía `POST /api/grupos/`. <br>5. El nuevo grupo aparece en el listado. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Descripción duplicada:** HTTP 400. <br>**E2 – Campo vacío:** HTTP 400. |
| **Reglas de negocio** | RN-03: La descripción del grupo es única (case-insensitive) entre registros activos. |
| **Post-condición** | Nuevo grupo disponible para agregar productos. Registrado en auditoría. |

---

## CUS-GRP-003 — Editar grupo

| Campo | Detalle |
|---|---|
| **ID** | CUS-GRP-003 |
| **Módulo** | Grupos y Productos |
| **Nombre** | Editar grupo |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica la descripción u observaciones de un grupo existente. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El grupo existe y no está eliminado. |
| **Flujo básico** | 1. El actor selecciona el grupo y hace clic en editar. <br>2. El formulario se muestra con los datos precargados. <br>3. El actor modifica y guarda. <br>4. El sistema envía `PATCH /api/grupos/{id}/`. <br>5. El grupo se actualiza en el listado. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Descripción duplicada:** HTTP 400. |
| **Reglas de negocio** | RN-03: Unicidad de descripción entre registros activos, excluyendo el actual. |
| **Post-condición** | Grupo actualizado. Registrado en auditoría. |

---

## CUS-GRP-004 — Eliminar grupo (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-GRP-004 |
| **Módulo** | Grupos y Productos |
| **Nombre** | Eliminar grupo (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un grupo que no tenga productos activos vinculados. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El grupo no tiene productos activos. |
| **Flujo básico** | 1. El administrador hace clic en eliminar sobre el grupo. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/grupos/{id}/`. <br>4. El servidor verifica productos activos y marca `is_deleted = True`. <br>5. El grupo desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Grupo con productos activos:** HTTP 400 con "No se puede eliminar: tiene productos activos vinculados." |
| **Reglas de negocio** | RN-04: Solo `admin` puede eliminar. RN-05: Borrado lógico. RN-06: Sin productos activos. |
| **Post-condición** | Grupo marcado `is_deleted = True`. No aparece en selectores. Registrado en auditoría. |

---

## CUS-GRP-005 — Agregar producto a un grupo

| Campo | Detalle |
|---|---|
| **ID** | CUS-GRP-005 |
| **Módulo** | Grupos y Productos |
| **Nombre** | Agregar producto a un grupo |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor agrega un nuevo producto o servicio dentro de un grupo seleccionado, con descripción, precio y estado. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. Hay un grupo seleccionado. |
| **Flujo básico** | 1. El actor selecciona el grupo y hace clic en "Agregar producto". <br>2. El formulario muestra: descripción*, precio unitario*, observaciones, estado (activo/inactivo). <br>3. El actor completa y guarda. <br>4. El sistema envía `POST /api/productos/` con `{ grupo, descripcion, precio_unitario, ... }`. <br>5. El nuevo producto aparece en la lista del grupo. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Descripción duplicada en el grupo:** HTTP 400. <br>**E2 – Precio negativo:** HTTP 400. |
| **Reglas de negocio** | RN-07: La descripción del producto es única dentro del grupo (case-insensitive). <br>RN-08: El precio unitario debe ser mayor o igual a cero. |
| **Post-condición** | Producto creado y disponible en el formulario de facturación para el grupo correspondiente. Registrado en auditoría. |

---

## CUS-GRP-006 — Editar producto

| Campo | Detalle |
|---|---|
| **ID** | CUS-GRP-006 |
| **Módulo** | Grupos y Productos |
| **Nombre** | Editar producto |
| **Actor** | Administrador / Recepcionista |
| **Descripción** | El actor modifica la descripción, precio u observaciones de un producto existente. |
| **Pre-condición** | El usuario está autenticado con rol `admin` o `recepcionista`. El producto existe y no está eliminado. |
| **Flujo básico** | 1. El actor selecciona el producto y hace clic en editar. <br>2. El formulario muestra los datos precargados. <br>3. El actor modifica y guarda. <br>4. El sistema envía `PATCH /api/productos/{id}/`. <br>5. El producto se actualiza en la lista. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Descripción duplicada en el mismo grupo:** HTTP 400. |
| **Reglas de negocio** | RN-07: Unicidad de descripción dentro del grupo, excluyendo el actual. |
| **Post-condición** | Producto actualizado. Registrado en auditoría. |

---

## CUS-GRP-007 — Eliminar producto (borrado lógico)

| Campo | Detalle |
|---|---|
| **ID** | CUS-GRP-007 |
| **Módulo** | Grupos y Productos |
| **Nombre** | Eliminar producto (borrado lógico) |
| **Actor** | Administrador |
| **Descripción** | El administrador elimina lógicamente un producto que no tenga facturas activas en `VentaFactDet`. |
| **Pre-condición** | El usuario está autenticado con rol `admin`. El producto no tiene facturas activas vinculadas. |
| **Flujo básico** | 1. El administrador hace clic en eliminar sobre el producto. <br>2. Confirma en el `ConfirmDialog`. <br>3. El sistema envía `DELETE /api/productos/{id}/`. <br>4. El servidor verifica facturas activas y marca `is_deleted = True`. <br>5. El producto desaparece de la lista. Toast de confirmación. |
| **Flujo alterno** | — |
| **Flujo de excepción** | **E1 – Producto con facturas activas:** HTTP 400 con "No se puede eliminar: tiene facturas activas vinculadas." |
| **Reglas de negocio** | RN-09: Solo `admin` puede eliminar. RN-10: Borrado lógico. RN-11: Sin facturas activas en `VentaFactDet`. |
| **Post-condición** | Producto marcado `is_deleted = True`. No aparece en el buscador de facturación. Registrado en auditoría. |
