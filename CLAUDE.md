# CLAUDE.md — Clínica Lichi
_Versión 3.7 · Abril 2026 — Módulo Usuarios y Roles implementado_

---

## Idioma
Responder siempre en español. Todos los comentarios de código, mensajes de commit,
explicaciones y documentación generada deben estar en español.

---

## Stack Tecnológico

### Backend
| Tecnología | Detalle |
|---|---|
| Python / Django | Django REST Framework |
| Base de datos | PostgreSQL 16 (Alpine) |
| Autenticación | JWT — `djangorestframework-simplejwt` con blacklist activada |
| CORS | `django-cors-headers` |
| Documentación API | `drf-spectacular` (Swagger en `/api/docs/`, ReDoc en `/api/redoc/`) |
| Configuración | `python-decouple` (variables de entorno) |
| Zona horaria | `America/Asuncion` — Idioma `es-py` |
| Paginación global | `PageNumberPagination` — 20 ítems por página por defecto |

### Frontend
| Tecnología | Versión |
|---|---|
| React | 18.3 |
| Build tool | Vite 6.2 |
| Router | React Router Dom 7 |
| Server state | TanStack Query 5 |
| HTTP client | Axios 1.x |
| Íconos | Lucide React |
| Estilos | Tailwind CSS 3 (config mínima) + `<style>` tags inline por componente |

### Infraestructura
- Docker Compose — 3 containers: `clinica_frontend` (5173), `clinica_backend` (8000), `clinica_db` (5432)
- Vite proxy redirige `/api` → `localhost:8000`
- Versionado: GitHub

---

## Estructura de Carpetas

```
clinica/
├── backend/
│   ├── apps/
│   │   ├── core/               ← BaseModel abstracto (soft delete + auditoría)
│   │   ├── persona/            ← TipoDocumento, Persona
│   │   ├── paciente/           ← Paciente, PacienteResponsable
│   │   ├── ubicacion/          ← Pais, Departamento, Ciudad
│   │   ├── diasemana/          ← DiaSemana (solo lectura, sin BaseModel)
│   │   ├── administracion/
│   │   │   ├── consultorio/    ← Consultorio (movido desde apps/consultorio/)
│   │   │   ├── especialidad/   ← Especialidad
│   │   │   └── ubicacion/      ← Pais, Departamento, Ciudad (movido desde apps/ubicacion/)
│   │   ├── principal/
│   │   │   ├── eventoclinico/        ← EventoClinico
│   │   │   ├── paciente_responsable/ ← PacienteResponsable (módulo independiente)
│   │   │   ├── paciente/             ← Paciente (movido desde apps/paciente/)
│   │   │   ├── persona_rrhh/         ← PersonaRRHH (prestadores con M2M especialidades)
│   │   │   ├── horario_prestador/    ← HorarioPrestador (horarios semanales + excepciones)
│   │   │   └── agenda/               ← Agenda (turnos: disponible/ocupado/inactivo/cancelado)
│   │   ├── mantenimiento/
│   │   │   └── tipo_doc_dig/   ← TipoDocDigital
│   │   ├── appointments/       ← PENDIENTE (solo urls.py vacío)
│   │   └── users/              ← PENDIENTE (en INSTALLED_APPS, sin implementación)
│   ├── config/
│   │   ├── settings/
│   │   │   ├── base.py
│   │   │   ├── development.py
│   │   │   └── production.py
│   │   ├── urls.py
│   │   ├── pagination.py       ← StandardPagination, SmallPagination
│   │   └── wsgi.py
│   ├── manage.py
│   └── requirements.txt
│
└── frontend/
    └── src/
        ├── api/
        │   ├── client.js         ← cliente ACTIVO (usa access_token/refresh_token)
        │   └── axiosConfig.js    ← HUÉRFANO — eliminar (usa claves distintas, nadie lo importa)
        ├── context/
        │   └── AuthContext.jsx   ← proveedor JWT, usa client.js
        ├── hooks/
        │   ├── usePatients.js
        │   ├── usePersona.js
        │   ├── useResponsable.js
        │   ├── useUbicacion.js
        │   ├── useConsultorios.js      ← hooks de consultorios (extraídos de ConsultorioPage)
        │   ├── useToast.js             ← estado de notificación Toast
        │   ├── usePersonaRRHH.js       ← hooks de PersonaRRHH
        │   ├── useEspecialidades.js    ← hooks de Especialidad (page_size=200)
        │   └── useHorarioPrestador.js  ← hooks de HorarioPrestador + generar turnos
        ├── components/
        │   ├── PrivateRoute.jsx
        │   ├── layout/
        │   │   ├── Layout.jsx    ← define clases globales reutilizables
        │   │   ├── Sidebar.jsx   ← menú colapsable con roles
        │   │   └── Navbar.jsx    ← breadcrumbs
        │   ├── ui/
        │   │   ├── Modal.jsx       ← modal genérico (sm/md/lg/xl/full)
        │   │   ├── PanelSimple.jsx ← panel lateral genérico Master-Detail
        │   │   └── Toast.jsx       ← notificación flotante (success/error/warning)
        │   ├── persona/
        │   │   ├── BuscadorPersona.jsx
        │   │   └── FormPersona.jsx
        │   ├── paciente/
        │   │   ├── PacienteForm.jsx    ← orquestador
        │   │   └── FormPaciente.jsx    ← sub-formulario
        │   ├── responsable/
        │   │   ├── ResponsableForm.jsx ← orquestador
        │   │   └── FormResponsable.jsx ← sub-formulario
        │   └── rrhh/
        │       └── FormRRHH.jsx        ← orquestador (PersonaRRHH con selector especialidades)
        ├── pages/
        │   ├── Login.jsx
        │   ├── Dashboard.jsx              ← existe pero NO está en el router
        │   ├── Paciente.jsx
        │   ├── PacienteResponsablePage.jsx
        │   ├── ConsultorioPage.jsx
        │   ├── EspecialidadPage.jsx
        │   ├── EventoClinicoPage.jsx
        │   ├── UbicacionesPage.jsx
        │   ├── PersonaRRHHPage.jsx        ← gestión de prestadores
        │   ├── HorarioPrestadorPage.jsx   ← horarios semanales master-detail
        │   └── AgendaPage.jsx             ← agenda y citas (3 columnas: médicos, calendario, panel día)
        └── utils/
            └── calcularDV.js             ← dígito verificador RUC Paraguay
```

---

## Convenciones Críticas — Backend

### Borrado lógico (NUNCA eliminar físicamente)
Todos los modelos heredan de `BaseModel` (excepto `DiaSemana`).

```python
def perform_destroy(self, instance):
    # Validar dependencias ANTES de borrar
    if instance.hijos.filter(is_deleted=False).exists():
        raise ValidationError('Tiene registros vinculados activos.')
    instance.is_deleted = True
    instance.fecha_eliminacion = timezone.now()
    instance.id_usu_modificator = self.request.user
    instance.save()
```

- Los queries de listado filtran siempre `is_deleted=False`.
- Las `UniqueConstraint` usan `condition=Q(is_deleted=False)` para permitir reusar valores borrados.
- Todos los viewsets activos filtran `is_deleted=False` en el queryset. ✅
- `Persona` no puede eliminarse (ni lógica ni físicamente) — `PersonaViewSet.perform_destroy` lanza `MethodNotAllowed`. Solo se puede eliminar el `Paciente` o `PacienteResponsable` vinculado.

**Tablas que requieren validación de dependencias antes de borrar:**
- `Pais` → verificar departamentos activos Y personas activas con ese país ✅ implementado
- `Departamento` → verificar ciudades activas Y personas activas con ese departamento ✅ implementado
- `Ciudad` → verificar personas activas con esa ciudad ✅ implementado
- `Consultorio` → verificar citas activas (pendiente cuando se implemente `appointments`)
- `TipoDocDigital` → verificar documentos digitalizados activos (pendiente cuando se implemente ese módulo)
- `Paciente` → verificar citas activas (pendiente cuando se implemente `appointments`)
- `PacienteResponsable` → verificar pacientes activos ✅ implementado
- `Persona` → verificar paciente y responsable activos

### Auditoría (verificar en TODOS los viewsets)
```python
def perform_create(self, serializer):
    serializer.save(id_usu_creator=self.request.user)

def perform_update(self, serializer):
    serializer.save(id_usu_modificator=self.request.user)
```

### PATCH, nunca PUT
Siempre usar `PATCH` para actualizaciones parciales. Nunca `PUT`. Aplica a hooks del frontend y cualquier cliente externo.

### Doble serializer (list vs write)
- `XListSerializer` — incluye campos anidados expandidos (para `list` y `retrieve`).
- `XSerializer` — solo IDs para escritura (para `create` y `update`).
- El ViewSet usa `get_serializer_class()` para elegir según la acción.
- El orden de definición en el archivo importa — definir primero los referenciados.

### TipoDocumento
- Campo clave: `.descripcion` — NUNCA usar `.nombre`.
- Es fijo en base de datos, sin ABM para el usuario.
- Para verificar si es RUC siempre usar `.descripcion`.

### Unicidad case-insensitive
- Se usa `Lower('campo')` en las `UniqueConstraint`.
- Se crean índices con `Lower('campo')` para rendimiento.

### Endpoints personalizados existentes
- `GET /api/persona/buscar/?nro_documento=X` → `{persona, paciente, es_paciente}`
- `GET /api/pacienteresponsable/buscar/?nro_documento=X` → `{persona, pacienteresponsable, es_responsable}`
- `GET /api/paciente/eliminados/` → lista con `is_deleted=True`
- `GET /api/pacienteresponsable/eliminados/` → ídem
- `GET /api/consultorio/eliminados/` → ídem
- `GET /api/pais/eliminados/` → ídem
- `GET /api/departamento/eliminados/` → ídem
- `GET /api/ciudad/eliminados/` → ídem
- `GET /api/especialidad/eliminados/` → ídem
- `GET /api/eventoclinico/eliminados/` → ídem
- `GET /api/tipo-doc-dig/eliminados/` → ídem
- `GET /api/personarrhh/eliminados/` → ídem
- `GET /api/personarrhh/buscar/?nro_documento=X` → `{persona, personarrhh, es_prestador}`
- `GET /api/horario-prestador/eliminados/` → ídem
- `POST /api/horario-prestador/{id}/generar/` → genera y persiste turnos `Agenda` para un rango de fechas; omite duplicados
- `PATCH /api/agenda/{id}/asignar/` → asigna paciente a un turno disponible (estado → ocupado)
- `PATCH /api/agenda/{id}/estado/` → cambia estado a disponible/inactivo/cancelado
- `GET /api/agenda/resumen-mes/` → conteo por fecha de disponibles/ocupados/inactivos/total
- `GET /api/agenda/stats-hoy/` → estadísticas del día actual
- `GET /api/departamento/?pais=ID` → filtrado por país
- `GET /api/ciudad/?departamento=ID` → filtrado por departamento
- `POST /api/consultas/{id}/iniciar/` → estado en_espera→en_consulta, registra hora_desde
- `POST /api/consultas/{id}/finalizar/` → estado en_consulta→finalizada, registra hora_hasta, agenda→realizado
- `GET /api/consultas/stats-hoy/` → {total, en_espera, en_consulta, finalizadas} para hoy
- `GET /api/consultas/?persona_rrhh=id&fecha=YYYY-MM-DD` → turnos del día de un médico
- `GET /api/documentos/?consulta=id` → documentos de una consulta
- `GET /api/recordatorios/proximas-citas/?periodo=vencidas|todos&dias=N&medico=id&estado=pendiente|agendado` → consultas con proxima_cita, anotadas con urgencia y estado agenda
- `GET /api/recordatorios/stats/` → { vencidas, proximos_7_dias, proximos_30_dias, agendadas }
- `POST /api/recordatorios/notificar/` → registra Notificacion con estado pendiente; stub listo para envío real
- `GET /api/notificaciones/?paciente=id&consulta=id` → historial de notificaciones (solo lectura)
- `GET /api/timbrado/?vigente=true|false&search=` → lista de timbrados con filtro de vigencia y búsqueda
- `GET /api/timbrado/eliminados/` → timbrados con `is_deleted=True`
- `GET /api/grupos/?activo=true|false&search=` → lista de grupos con conteo `total_productos` (anotado)
- `GET /api/grupos/eliminados/` → grupos eliminados
- `GET /api/productos/?grupo=id&activo=true|false&search=` → productos de un grupo; `grupo` filtra obligatoriamente por el drill-down
- `GET /api/productos/eliminados/` → productos eliminados
- `GET /api/cuentas-mcb/?search=` → cuentas con `saldo` anotado (Sum ingreso - Sum egreso) y `total_movimientos`
- `GET /api/cuentas-mcb/eliminados/` → cuentas eliminadas
- `GET /api/movimientos-caja/?cta=id&tipo=ingreso|egreso&fecha_desde=&fecha_hasta=&search=` → movimientos filtrados; `cta` es el filtro principal de drill-down
- `GET /api/movimientos-caja/eliminados/` → movimientos eliminados
- `GET /api/forma-pago/` → lista de formas de pago (solo lectura, seed: Efectivo/Tarjeta/Transferencia)
- `POST /api/facturacion/validar-timbrado/` → `{establecimiento, expedicion, numero}` → valida que el número esté dentro del rango activo del timbrado vigente
- `GET /api/facturacion/siguiente-numero/?establecimiento=&expedicion=` → retorna el próximo número disponible (MAX(nro_comprobante)+1 ó nro_desde si no hay comprobantes)
- `POST /api/facturacion/` → crea VentaFactCab + VentaFactDet[] + (VentaFactDetCobranza[] + MovimientoCajaBanco[] si contado) ó (CtaCobrar[] si crédito) en `@transaction.atomic`
- `PATCH /api/facturacion/{id}/` → edición post-emisión; solo permite cambiar `fecha`, `persona`, `observacion` (`VentaFactCabUpdateSerializer`); responde con `VentaFactCabDetalleSerializer` completo
- `GET /api/facturacion/{id}/pdf/` → genera PDF con WeasyPrint desde `templates/informes/factura_print.html`; `permission_classes=[AllowAny]` (se abre en `_blank` sin token); devuelve `application/pdf` con `Content-Disposition: inline`
- `DELETE /api/facturacion/{id}/` → borrado lógico; cascada manual a detalle, cobranza y cuotas; valida que no haya MovimientoCajaBanco vinculados
- `GET /api/pago-prestador/siguiente-numero/` → MAX(id)+1 sobre pagos activos
- `GET /api/pago-prestador/bloques-pendientes/?persona_rrhh=id&fecha_hasta=YYYY-MM-DD` → agrupa Agenda por (horario_prestador_id, fecha) donde pagado_prestador=False; devuelve horas (hora_hasta-hora_desde), especialidad, agenda_ids
- `POST /api/pago-prestador/` → crea PagoPrestador + PagoPrestadorDetCobranza[] + MovimientoCajaBanco[]; marca Agenda.pagado_prestador=True + pago_prestador=FK; estado: pagado/parcial/pendiente según total pagado
- `DELETE /api/pago-prestador/{id}/` → borrado lógico; revierte Agenda.pagado_prestador=False; valida que no haya MovimientoCajaBanco vinculados
- `GET /api/usuarios/` → lista de perfiles (con filtros `search`, `rol`, `activo`)
- `POST /api/usuarios/` → crea User + PerfilUsuario; `{username, password, first_name, last_name, email, rol, persona_rrhh}`
- `PATCH /api/usuarios/{id}/` → actualiza perfil (sin cambiar username/password)
- `POST /api/usuarios/{id}/cambiar-estado/` → toggle `activo` del perfil
- `POST /api/usuarios/{id}/resetear-password/` → `{nueva_password}` — setea nueva contraseña
- `GET /api/cobranzas/siguiente-numero/` → MAX(comprobante_nro)+1 sobre cobranzas activas
- `GET /api/cobranzas/cuotas-pendientes/?persona=id` → CtaCobrar con saldo > 0 de facturas activas de esa persona; incluye datos de factura origen (nro formateado, fecha)
- `POST /api/cobranzas/` → crea Cobranza + CobranzaDet[] + ValorRecibidoCob[] + MovimientoCajaBanco[] en `@transaction.atomic`; actualiza saldo de CtaCobrar; si saldo ≤ 0 → estado = pagado; valida monto_pagado ≤ saldo con `select_for_update`
- `DELETE /api/cobranzas/{id}/` → borrado lógico; valida que no haya MovimientoCajaBanco vinculados
- `GET /api/documentos/?paciente=id` → documentos de un paciente
- `GET /api/documentos/pacientes/?search=` → pacientes con al menos un documento digitalizado activo
- `GET /api/documentos/{id}/descargar/` → FileResponse del archivo desde /media/

### Plantillas de informes (WeasyPrint)

Las plantillas de impresión viven en `backend/templates/informes/`. WeasyPrint está instalado en el contenedor.

| Archivo | Estado | Descripción |
|---|---|---|
| `base_informe.html` | ✅ | Estilos base (@page A4, reset, tipografía pt, media print) |
| `factura_print.html` | ✅ | Factura paraguaya SET — header timbrado, condición, datos cliente, detalle, liquidación IVA, totales, firma |
| `cobranza_print.html` | ❌ pendiente | Recibo de cobranza de cuotas |
| `recibo_print.html` | ❌ pendiente | Recibo de pago general |
| `estado_cuenta_print.html` | ❌ pendiente | Estado de cuenta por persona |
| `informe_caja.html` | ❌ pendiente | Informe de caja diario |

Templatetag custom: `apps/principal/facturacion/templatetags/factura_tags.py`
- `|gs` — formatea valor como Guaraníes: entero con separador de miles con punto (ej: `1.234.567`)
- `|minus` — resta decimal segura para templates

### Construcción de rutas de archivos
```python
def build_storage_path(tipo_doc_dig, paciente_id, filename):
    ext       = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    year      = datetime.now().year
    return f'documentos/{tipo_doc_dig.storage_key}/{year}/{timestamp}_{tipo_doc_dig.storage_key}.{ext}'
```
Ejemplo de ruta generada: `documentos/historia_clinica/2026/20260414143022_historia_clinica.pdf`

### Borrado de documentos digitalizados
`perform_destroy` en `DocumentoDigPacienteViewSet` realiza dos operaciones en orden:
1. **Borrado físico**: elimina el archivo del disco (`os.remove`). Si el directorio queda vacío, lo elimina también (`os.rmdir`).
2. **Borrado lógico**: marca `is_deleted=True` en la base de datos (patrón estándar `BaseModel`).

---

## Convenciones Críticas — Frontend

### Formularios
- Los formularios **NUNCA** guardan datos por sí solos — notifican al padre via `onChange`.
- El padre (orquestador) llama a la API y maneja el estado de guardado.
- `onSuccess()` notifica a la página que la operación terminó (cerrar modal, refrescar lista).
- El guardado es secuencial: primero `Persona`, luego la entidad específica.

### Distinción orquestador vs sub-formulario
| Nombre | Rol |
|---|---|
| `PacienteForm` | **Orquestador** — une BuscadorPersona + FormPersona + FormPaciente + guardado |
| `FormPaciente` | **Sub-formulario** — solo campos propios del Paciente |
| `ResponsableForm` | **Orquestador** — une BuscadorPersona + FormPersona + FormResponsable + guardado |
| `FormResponsable` | **Sub-formulario** — solo campos propios del Responsable |

### Estado y datos
- **React Query** para estado del servidor — no duplicar en `useState`.
- **useState** solo para estado local de UI (panel abierto, modo edición, campos del formulario).
- **Context API** solo para estado global real (usuario autenticado, rol).
- Todos los hooks de mutación usan `invalidateQueries` al completar.

### Cliente HTTP
- Usar siempre `client.js` — es el único cliente activo.
- `axiosConfig.js` está huérfano y debe eliminarse.
- Claves de localStorage del cliente activo: `access_token` / `refresh_token`.

---

## Patrones de UI

### Regla de elección
- Formulario con múltiples componentes o pasos → **Modal**
- Formulario simple de 1-4 campos → **Master-Detail (panel lateral)**

### Patrón Modal — Formularios complejos
_Usado en: Paciente, PacienteResponsable_
```
Página → botón 'Nuevo' / 'Editar'
  → Modal (isOpen, onClose, title, subtitle, size)
    → Orquestador (PacienteForm / ResponsableForm)
      → BuscadorPersona  (determina modo)
      → FormPersona      (datos personales)
      → FormPaciente / FormResponsable (datos específicos)
      → handleGuardar → onSuccess() → cierra modal
```

### Patrón Master-Detail — Panel lateral
_Usado en: Consultorio, Especialidad, EventoClinico_
```
Página → lista de registros (izquierda)
  → click en fila → <PanelSimple> (derecha)
    modo 'ver'    → datos + botones Editar / Eliminar
    modo 'editar' → inputs habilitados + Guardar / Cancelar
    modo 'crear'  → inputs vacíos + Guardar / Cancelar
  → botón 'Nuevo' → Panel en modo 'crear'
```

**Uso de `<PanelSimple>`:**
```jsx
<PanelSimple
  titulos={{ nuevo: 'Nuevo X', editar: 'Editar X', ver: 'Detalle' }}
  icono={<IconoX size={22} color="#1a3a5c" />}
  campos={[
    { name: 'campo1', label: 'Campo 1', placeholder: '...', requerido: true },
    { name: 'campo2', label: 'Campo 2', placeholder: '...', requerido: false },
    // soloLectura: true → editable en 'crear', bloqueado con badge "No editable" en 'editar'
    { name: 'campo3', label: 'Campo 3', placeholder: '...', requerido: true, soloLectura: true },
  ]}
  item={seleccionado}
  modo={modo}
  onCancelar={cerrarPanel}
  onGuardar={handleGuardar}
  onEditar={() => setModo('editar')}
  onEliminar={handleEliminar}
  guardando={guardando}
/>
```

### Patrón Cascada — Selects dependientes
_Usado en: Ubicaciones, FormPersona_
- Al cambiar País → resetea departamento y ciudad
- Al cambiar Departamento → resetea ciudad
- `useDepartamentos(paisId)` y `useCiudades(departamentoId)` solo hacen fetch cuando el ID padre es válido

### Patrón Buscador — Flujo por documento
_Usado en: BuscadorPersona, buscador de responsable en FormPaciente_

| Modo | Condición |
|---|---|
| `crear_todo` | La persona no existe — se crea Persona + entidad |
| `agregar_paciente` | La persona existe pero no tiene la entidad — se crea solo la entidad |
| `editar` | Ya existe como entidad — se editan ambos registros |

El buscador muestra un badge de contexto coloreado según el modo detectado.

### Patrón Columnas jerárquicas
_Usado en: UbicacionesPage_
- Grid de 3 columnas: País → Departamento → Ciudad
- Seleccionar padre habilita la columna siguiente
- Edición inline con `FilaEditable`

---

## Estilos Visuales

### Tokens de color
| Token | Valor | Uso |
|---|---|---|
| Brand primario | `#1a3a5c` | Sidebar, botones primarios, títulos, bordes focus |
| Brand hover | `#15304d` | Hover de botones primarios |
| Brand tooltip | `#0f2540` | Fondo de tooltips del sidebar |
| Azul claro | `#dbeafe` | Avatar bg, badge info |
| Azul borde hover | `#bfdbfe` | Borde hover botón editar |
| Azul row activo | `#eff6ff` | Fila seleccionada en tabla |
| Fondo app | `#f0f4f8` | Background general |
| Thead / surface | `#f8fafc` | Header de tablas |
| Card border | `#e8edf2` | Borde de tarjetas y modales |
| Input border | `#e5e7eb` | Borde de inputs |
| Row separator | `#f3f4f6` | Separador de filas |
| Texto principal | `#111827` | Nombres, valores importantes |
| Texto secundario | `#374151` | Celdas de tabla, texto general |
| Texto muted | `#6b7280` | Subtítulos, íconos, labels |
| Labels / hints | `#9ca3af` | Etiquetas de campos |
| Rojo error | `#dc2626` | Errores, hover eliminar |
| Rojo borde | `#fecaca` | Borde hover botón eliminar |
| Rojo fondo | `#fef2f2` | Fondo hover botón eliminar |
| Verde conectado | `#22c55e` | Dot "Conectado" en navbar |

### Tipografía
| Fuente | Uso |
|---|---|
| `DM Sans` (300, 400, 500, 600) | Texto general, formularios, botones, tablas |
| `DM Serif Display` | Título login (`Clínica Lichi`), logo del Sidebar |
| `Courier New` | Valores técnicos, storage_key, rutas |

### Estilos por componente
Cada componente define su CSS con `<style>` inline. Prefijos únicos para evitar colisiones.

| Prefijo | Componente |
|---|---|
| `.modal-` | `components/ui/Modal.jsx` |
| `.panel-` | `components/ui/PanelSimple.jsx` ← componente compartido extraído |
| `.toast-` | `components/ui/Toast.jsx` |
| `.bp-` | `components/persona/BuscadorPersona.jsx` |
| `.fp-` | `components/persona/FormPersona.jsx` |
| `.pf-` | `components/paciente/PacienteForm.jsx` |
| `.fpa-` | `components/paciente/FormPaciente.jsx` |
| `.rf-` | `components/responsable/ResponsableForm.jsx` |
| `.fr-` | `components/responsable/FormResponsable.jsx` |
| `.sb-` | `components/layout/Sidebar.jsx` |
| `.nb-` | `components/layout/Navbar.jsx` |
| `.pac-` | `pages/Paciente.jsx` |
| `.pr-` | `pages/PacienteResponsablePage.jsx` |
| `.con-` | `pages/ConsultorioPage.jsx` |
| `.esp-` | `pages/EspecialidadPage.jsx` |
| `.ec-`  | `pages/EventoClinicoPage.jsx` |
| `.tdd-` | `pages/TipoDocDigPage.jsx` |
| `.ub-` | `pages/UbicacionesPage.jsx` |
| `.rrhh-` | `pages/PersonaRRHHPage.jsx` |
| `.frrhh-` | `components/rrhh/FormRRHH.jsx` |
| `.hp-` | `pages/HorarioPrestadorPage.jsx` |
| `.ag-` | `pages/AgendaPage.jsx` |
| `.cs-` | `pages/ConsultasPage.jsx` |
| `.dd-` | `pages/DocumentosPage.jsx` |
| `.rec-` | `pages/RecordatoriosPage.jsx` |
| `.tim-` | `pages/TimbradoPage.jsx` |
| `.grp-` | `pages/GruposPage.jsx` |
| `.cta-` | `pages/CuentasMcbPage.jsx` |
| `.fac-` | `pages/FacturacionPage.jsx` |
| `.cob-` | `pages/CobranzasPage.jsx` |
| `.pp-`  | `pages/PagoPrestadorPage.jsx` |
| `.usu-` | `pages/UsuariosPage.jsx` |
| `.login-` | `pages/Login.jsx` |

> **Al crear módulos nuevos:** asignar prefijo propio y registrarlo en esta tabla.

### Clases globales (Layout.jsx)
Disponibles en todas las páginas sin redefinir:

`.btn` `.btn-primary` `.btn-secondary` `.btn-danger`
`.badge` `.badge-success` `.badge-warning` `.badge-danger` `.badge-info` `.badge-gray`
`.card` `.card-sm` `.input` `.form-label` `.form-group`
`.page-header` `.page-title` `.page-subtitle`
`.table-wrapper` `.stats-grid` `.stat-card` `.stat-label` `.stat-value`

---

## Hooks Existentes

| Hook | Archivo | Responsabilidad |
|---|---|---|
| `usePatients` | `hooks/usePatients.js` | Lista paginada de pacientes con búsqueda |
| `useCreatePatient` | `hooks/usePatients.js` | POST `/api/paciente/` |
| `useUpdatePatient` | `hooks/usePatients.js` | PATCH `/api/paciente/{id}/` |
| `useDeletePatient` | `hooks/usePatients.js` | DELETE `/api/paciente/{id}/` |
| `useTipoDocumento` | `hooks/usePersona.js` | GET tipos de documento (staleTime 30 min) |
| `useCreatePersona` | `hooks/usePersona.js` | POST `/api/persona/` |
| `useUpdatePersona` | `hooks/usePersona.js` | PATCH `/api/persona/{id}/` |
| `useResponsables` | `hooks/useResponsable.js` | Lista paginada de responsables con búsqueda |
| `useCreateResponsable` | `hooks/useResponsable.js` | POST `/api/pacienteresponsable/` |
| `useUpdateResponsable` | `hooks/useResponsable.js` | PATCH `/api/pacienteresponsable/{id}/` |
| `useDeleteResponsable` | `hooks/useResponsable.js` | DELETE `/api/pacienteresponsable/{id}/` |
| `usePaises` | `hooks/useUbicacion.js` | GET lista de países (staleTime 30 min) |
| `useDepartamentos` | `hooks/useUbicacion.js` | GET departamentos por `paisId` |
| `useCiudades` | `hooks/useUbicacion.js` | GET ciudades por `departamentoId` |
| `useConsultorios` | `hooks/useConsultorios.js` | GET lista de consultorios con búsqueda |
| `useConsultorioMutations` | `hooks/useConsultorios.js` | POST / PATCH / DELETE `/api/consultorio/` |
| `useEspecialidades` | `hooks/useEspecialidades.js` | GET lista de especialidades con búsqueda |
| `useEspecialidadMutations` | `hooks/useEspecialidades.js` | POST / PATCH / DELETE `/api/especialidad/` |
| `useEventosClinicos` | `hooks/useEventosClinicos.js` | GET lista de eventos clínicos con búsqueda |
| `useEventoClinicoMutations` | `hooks/useEventosClinicos.js` | POST / PATCH / DELETE `/api/eventoclinico/` |
| `useTipoDocDig` | `hooks/useTipoDocDig.js` | GET lista de tipos de documento digitalizado con búsqueda |
| `useTipoDocDigMutations` | `hooks/useTipoDocDig.js` | POST / PATCH / DELETE `/api/tipo-doc-dig/` |
| `useToast` | `hooks/useToast.js` | Estado de notificación Toast — retorna `{ toast, showToast }` |
| `usePersonasRRHH` | `hooks/usePersonaRRHH.js` | Lista paginada de prestadores con búsqueda |
| `useCreatePersonaRRHH` | `hooks/usePersonaRRHH.js` | POST `/api/personarrhh/` |
| `useUpdatePersonaRRHH` | `hooks/usePersonaRRHH.js` | PATCH `/api/personarrhh/{id}/` |
| `useDeletePersonaRRHH` | `hooks/usePersonaRRHH.js` | DELETE `/api/personarrhh/{id}/` |
| `useEspecialidades` | `hooks/useEspecialidades.js` | GET lista de especialidades (page_size=200, staleTime 5 min) |
| `useEspecialidadMutations` | `hooks/useEspecialidades.js` | POST / PATCH / DELETE `/api/especialidad/` |
| `useHorariosPrestador` | `hooks/useHorarioPrestador.js` | GET horarios filtrados por persona_rrhh y/o estado |
| `useCreateHorario` | `hooks/useHorarioPrestador.js` | POST `/api/horario-prestador/` |
| `useUpdateHorario` | `hooks/useHorarioPrestador.js` | PATCH `/api/horario-prestador/{id}/` |
| `useDeleteHorario` | `hooks/useHorarioPrestador.js` | DELETE `/api/horario-prestador/{id}/` |
| `useGenerarTurnos` | `hooks/useHorarioPrestador.js` | POST `/api/horario-prestador/{id}/generar/` |
| `useResumenMes` | `hooks/useAgenda.js` | GET `/api/agenda/resumen-mes/` — stats por fecha del mes |
| `useAgendaDia` | `hooks/useAgenda.js` | GET `/api/agenda/` filtrado por persona_rrhh + fecha |
| `useAgendaMes` | `hooks/useAgenda.js` | GET `/api/agenda/` filtrado por rango del mes (pills calendario) |
| `useAgendaDiaGlobal` | `hooks/useAgenda.js` | GET `/api/agenda/` filtrado solo por fecha (todos los médicos) |
| `useStatsHoy` | `hooks/useAgenda.js` | GET `/api/agenda/stats-hoy/` (staleTime 1 min) |
| `useAsignarTurno` | `hooks/useAgenda.js` | PATCH `/api/agenda/{id}/asignar/` — asignar paciente |
| `useCambiarEstado` | `hooks/useAgenda.js` | PATCH `/api/agenda/{id}/estado/` — cambiar estado |
| `useConsultasDelDia` | `hooks/useConsultas.js` | GET `/api/consultas/?persona_rrhh=&fecha=` |
| `useConsultasPaciente` | `hooks/useConsultas.js` | GET `/api/consultas/?paciente=id` — historial |
| `useConsultaDetalle` | `hooks/useConsultas.js` | GET `/api/consultas/{id}/` |
| `useIniciarConsulta` | `hooks/useConsultas.js` | POST `/api/consultas/{id}/iniciar/` |
| `useFinalizarConsulta` | `hooks/useConsultas.js` | POST `/api/consultas/{id}/finalizar/` |
| `useUpdateConsulta` | `hooks/useConsultas.js` | PATCH `/api/consultas/{id}/` |
| `useCrearConsulta` | `hooks/useConsultas.js` | POST `/api/consultas/` |
| `useStatsConsultasHoy` | `hooks/useConsultas.js` | GET `/api/consultas/stats-hoy/` |
| `useConsultasHoy` | `hooks/useConsultas.js` | GET `/api/consultas/?fecha=hoy` (todas) |
| `useProximasCitas` | `hooks/useRecordatorios.js` | GET `/api/recordatorios/proximas-citas/` — consultas con proxima_cita |
| `useStatsRecordatorios` | `hooks/useRecordatorios.js` | GET `/api/recordatorios/stats/` — conteos por urgencia |
| `useNotificar` | `hooks/useRecordatorios.js` | POST `/api/recordatorios/notificar/` — registra notificación |
| `useHistorialNotificaciones` | `hooks/useRecordatorios.js` | GET `/api/notificaciones/?paciente=id` |
| `useMedicosLista` | `hooks/useRecordatorios.js` | GET `/api/personarrhh/?cargo=medico` para filtro |
| `useTimbrados` | `hooks/useTimbrado.js` | GET `/api/timbrado/` con filtros `search` y `vigente` |
| `useCreateTimbrado` | `hooks/useTimbrado.js` | POST `/api/timbrado/` |
| `useUpdateTimbrado` | `hooks/useTimbrado.js` | PATCH `/api/timbrado/{id}/` |
| `useDeleteTimbrado` | `hooks/useTimbrado.js` | DELETE `/api/timbrado/{id}/` |
| `useGrupos` | `hooks/useGrupos.js` | GET `/api/grupos/` con filtros `search` y `activo` |
| `useCreateGrupo` | `hooks/useGrupos.js` | POST `/api/grupos/` |
| `useUpdateGrupo` | `hooks/useGrupos.js` | PATCH `/api/grupos/{id}/` |
| `useDeleteGrupo` | `hooks/useGrupos.js` | DELETE `/api/grupos/{id}/` |
| `useProductos` | `hooks/useProductos.js` | GET `/api/productos/?grupo=id` con filtros `search` y `activo` |
| `useCreateProducto` | `hooks/useProductos.js` | POST `/api/productos/` |
| `useUpdateProducto` | `hooks/useProductos.js` | PATCH `/api/productos/{id}/` |
| `useDeleteProducto` | `hooks/useProductos.js` | DELETE `/api/productos/{id}/` |
| `useCuentasMcb` | `hooks/useCuentasMcb.js` | GET `/api/cuentas-mcb/` con filtro `search` |
| `useCreateCuenta` | `hooks/useCuentasMcb.js` | POST `/api/cuentas-mcb/` |
| `useUpdateCuenta` | `hooks/useCuentasMcb.js` | PATCH `/api/cuentas-mcb/{id}/` |
| `useDeleteCuenta` | `hooks/useCuentasMcb.js` | DELETE `/api/cuentas-mcb/{id}/` |
| `useMovimientos` | `hooks/useMovimientos.js` | GET `/api/movimientos-caja/?cta=id` con filtros tipo, fecha_desde, fecha_hasta, search |
| `useCreateMovimiento` | `hooks/useMovimientos.js` | POST `/api/movimientos-caja/` |
| `useUpdateMovimiento` | `hooks/useMovimientos.js` | PATCH `/api/movimientos-caja/{id}/` |
| `useDeleteMovimiento` | `hooks/useMovimientos.js` | DELETE `/api/movimientos-caja/{id}/` |
| `useFacturas` | `hooks/useFacturacion.js` | GET `/api/facturacion/` con filtros `search`, `condicion_vta`, `fecha_desde`, `fecha_hasta` |
| `useFacturaDetalle` | `hooks/useFacturacion.js` | GET `/api/facturacion/{id}/` |
| `useCreateFactura` | `hooks/useFacturacion.js` | POST `/api/facturacion/` — crea cabecera + detalle + cobranza/cuotas en transacción atómica |
| `useUpdateFactura` | `hooks/useFacturacion.js` | PATCH `/api/facturacion/{id}/` — actualiza `fecha`, `persona`, `observacion`; invalida lista + detalle |
| `useDeleteFactura` | `hooks/useFacturacion.js` | DELETE `/api/facturacion/{id}/` — borrado lógico + cascada |
| `useValidarTimbrado` | `hooks/useFacturacion.js` | POST `/api/facturacion/validar-timbrado/` — valida `{establecimiento, expedicion, numero}` |
| `useSiguienteNumero` | `hooks/useFacturacion.js` | GET `/api/facturacion/siguiente-numero/?establecimiento=&expedicion=` — habilitado cuando ambos tienen 3 dígitos |
| `useFormaPago` | `hooks/useFacturacion.js` | GET `/api/forma-pago/` (staleTime 30 min) |
| `useBuscarPersonas` | `hooks/useFacturacion.js` | GET `/api/persona/?search=` (page_size=8, habilitado con ≥ 2 chars) — para autocomplete factura |
| `useBuscarProductos` | `hooks/useFacturacion.js` | GET `/api/productos/?search=&activo=true` (page_size=10, habilitado con ≥ 2 chars) — para autocomplete factura |
| `usePagosPrestador` | `hooks/usePagoPrestador.js` | GET `/api/pago-prestador/` con filtros `persona_rrhh`, `estado`, `fecha_desde`, `fecha_hasta`, `search` |
| `usePagoPrestadorDetalle` | `hooks/usePagoPrestador.js` | GET `/api/pago-prestador/{id}/` |
| `useCreatePagoPrestador` | `hooks/usePagoPrestador.js` | POST `/api/pago-prestador/` — transacción atómica; invalida pagos, movimientos y cuentas-mcb |
| `useDeletePagoPrestador` | `hooks/usePagoPrestador.js` | DELETE `/api/pago-prestador/{id}/` — borrado lógico; revierte `pagado_prestador` en Agenda |
| `useSiguienteNumeroPago` | `hooks/usePagoPrestador.js` | GET `/api/pago-prestador/siguiente-numero/` — MAX(id)+1 |
| `useBloquesPendientes` | `hooks/usePagoPrestador.js` | GET `/api/pago-prestador/bloques-pendientes/?persona_rrhh=id&fecha_hasta=` — bloques agrupados por (horario_prestador_id, fecha) con horas y agenda_ids |
| `useCobranzas` | `hooks/useCobranzas.js` | GET `/api/cobranzas/` con filtros `search`, `fecha_desde`, `fecha_hasta` |
| `useCobranzaDetalle` | `hooks/useCobranzas.js` | GET `/api/cobranzas/{id}/` — detalle con cuotas cobradas y valores recibidos |
| `useCreateCobranza` | `hooks/useCobranzas.js` | POST `/api/cobranzas/` — transacción atómica; invalida cobranzas, movimientos, cuentas-mcb y facturas |
| `useDeleteCobranza` | `hooks/useCobranzas.js` | DELETE `/api/cobranzas/{id}/` — borrado lógico |
| `useSiguienteNumeroCob` | `hooks/useCobranzas.js` | GET `/api/cobranzas/siguiente-numero/` — autoincremental propio de cobranzas (staleTime 0) |
| `useCuotasPendientes` | `hooks/useCobranzas.js` | GET `/api/cobranzas/cuotas-pendientes/?persona=id` — CtaCobrar con saldo > 0 de facturas activas de esa persona |
| `useUsuarios` | `hooks/useUsuarios.js` | GET `/api/usuarios/` con filtros `search`, `rol`, `activo` |
| `useCreateUsuario` | `hooks/useUsuarios.js` | POST `/api/usuarios/` — crea User + PerfilUsuario |
| `useUpdateUsuario` | `hooks/useUsuarios.js` | PATCH `/api/usuarios/{id}/` — actualiza perfil |
| `useCambiarEstadoUsuario` | `hooks/useUsuarios.js` | POST `/api/usuarios/{id}/cambiar-estado/` — toggle activo |
| `useResetearPassword` | `hooks/useUsuarios.js` | POST `/api/usuarios/{id}/resetear-password/` |
| `useDocumentosPorConsulta` | `hooks/useDocumentos.js` | GET `/api/documentos/?consulta=id` |
| `useDocumentosPorPaciente` | `hooks/useDocumentos.js` | GET `/api/documentos/?paciente=id` — historial completo |
| `usePacientesConDocumentos` | `hooks/useDocumentos.js` | GET `/api/documentos/pacientes/?search=` — pacientes con al menos un doc |
| `useSubirDocumento` | `hooks/useDocumentos.js` | POST `/api/documentos/` multipart/form-data |
| `useDeleteDocumento` | `hooks/useDocumentos.js` | DELETE `/api/documentos/{id}/` — borrado lógico |

---

## Estado de Módulos

### Completado ✅
| Módulo | Frontend | Backend |
|---|---|---|
| Autenticación JWT | Login.jsx, AuthContext, PrivateRoute | TokenObtainPair, Refresh, Verify |
| Pacientes | Paciente.jsx + PacienteForm | PacienteViewSet |
| Responsables | PacienteResponsablePage + ResponsableForm | PacienteResponsableViewSet |
| Ubicaciones | UbicacionesPage | Pais, Departamento, CiudadViewSet |
| Consultorios | ConsultorioPage | ConsultorioViewSet |
| Especialidades | EspecialidadPage (migrado a PanelSimple ✅) | EspecialidadViewSet |
| Evento Clínico | EventoClinicoPage (migrado a PanelSimple ✅) | EventoClinicoViewSet |
| Tipo doc. digitalizado | TipoDocDigPage | TipoDocDigitalViewSet |
| Días de semana | — (dato de referencia, sin página) | DiaSemanaViewSet (ReadOnly) |
| Formas de pago | — (dato de referencia, sin página) | FormaPagoViewSet (ReadOnly) — seed: 1=Efectivo, 2=Tarjeta, 3=Transferencia |
| PersonaRRHH | PersonaRRHHPage + FormRRHH (selector especialidades con teclado) | PersonaRRHHViewSet (M2M especialidades, /buscar/, /eliminados/) |
| HorarioPrestador | HorarioPrestadorPage (master-detail, preview turnos) | HorarioPrestadorViewSet (/generar/, /eliminados/) |
| Agenda | AgendaPage (layout 3 columnas: médicos, calendario, panel día) | AgendaViewSet (/asignar/, /cambiar_estado/, /resumen-mes/, /stats-hoy/) |
| Consultas | ConsultasPage (pestañas: Vista médico + Vista recepcionista) | ConsultaViewSet (/iniciar/, /finalizar/, /stats-hoy/) |
| Documentos digitalizados (consulta) | integrado en ConsultasPage (drag-and-drop, descarga) | DocumentoDigPacienteViewSet (/descargar/) |
| Documentos digitalizados (módulo) | DocumentosPage — lista de pacientes + tabla de docs + visualizar | DocumentoDigPacienteViewSet (/pacientes/, /descargar/) |
| Recordatorios | RecordatoriosPage — stats + tabla urgencia + panel notificación | RecordatorioViewSet (/proximas-citas/, /stats/, /notificar/) + NotificacionViewSet |
| Timbrado | TimbradoPage — tabla con barra de progreso + PanelVer + PanelForm (toggle Talonario/Autoimpresor) | TimbradoViewSet (/eliminados/) |
| Grupos y Productos | GruposPage — grilla de cards (Vista 1) con drill-down a lista de productos (Vista 2) + panel lateral | GrupoViewSet + ProductoServicioViewSet (/eliminados/) |
| Cuentas Caja/Banco | CuentasMcbPage — grilla de cards con saldo (Vista 1) + drill-down a movimientos con filtros (Vista 2) | CuentaMcbViewSet + MovimientoCajaBancoViewSet (/eliminados/) |
| Pago a prestadores | PagoPrestadorPage — tabla con filtros médico/estado/fecha; modal 2 pestañas (bloques con selección masiva + forma de pago); buscador médico con debounce; cálculo en tiempo real (horas × monto_hora); indicador de cobertura | PagoPrestadorViewSet (/bloques-pendientes/, /siguiente-numero/); campos `pagado_prestador` y `pago_prestador` FK en Agenda (migración 0003); `PagoPrestadorDetCobranza.id` → `MovimientoCajaBanco.ppdc_id` |
| Cobranzas | CobranzasPage — tabla con filtros fecha/cliente; modal emisión 2 pestañas (Cabecera+cuotas / Valores recibidos); autocomplete persona; cuotas vencidas resaltadas; vuelto en tiempo real; modal ver detalle + eliminar | CobranzaViewSet (/siguiente-numero/, /cuotas-pendientes/) — actualiza saldo CtaCobrar, genera MovimientoCajaBanco |
| Facturación / Ventas | FacturacionPage — modal emisión 3 pestañas (Cabecera+Detalle / Cobranza / Cuotas), autocomplete persona/producto con teclado, cálculo IVA en tiempo real, validación timbrado; tabla con botones Editar/Imprimir/Eliminar por fila; `ModalVerFactura` para ver/editar/eliminar con modo edición inline (fecha, persona, observación) | VentaFactCabViewSet (/validar-timbrado/, /siguiente-numero/) + services.py con cálculo Decimal SET Paraguay; `VentaFactCab` guarda `establecimiento` y `expedicion` (migración 0002) para número formateado independiente del timbrado |
| Usuarios y Roles | UsuariosPage — tabla con filtros rol/activo/search; modal crear (username+password+rol+prestador+médico asignado) y editar; modal resetear contraseña; toggle activar/desactivar; campo médico asignado visible solo cuando rol=secretaria_medico | `PerfilUsuario` OneToOne → User; `medico_asignado` FK → PersonaRRHH (secretaria asignada a un médico); signal post_save crea perfil; JWT incluye `rol`, `nombre`, `iniciales`, `activo`, `persona_rrhh_id`, `medico_asignado_id`; `AuthContext` decodifica claims del token |

### En progreso ⚠️
| Módulo | Estado |
|---|---|
| Dashboard | `Dashboard.jsx` existe pero no está conectado al router |
| ConsultasPage | Funcional pero con mejoras pendientes (ver sección abajo) |

### Pendiente ❌
| Módulo | Notas |
|---|---|
| Agenda / Recordatorios | ✅ Implementado — `/agenda/recordatorios` |
| Consulta médica | ✅ Implementado — `/consultas` |
| Documentos digitalizados | ✅ Implementado — integrado en ConsultasPage + módulo propio `/pacientes/documentos` |
| Tipo doc. digitalizado | Solo en sidebar, sin ruta ni página |
| Facturación / Ventas | ✅ Implementado — `/facturacion/ventas` |
| Facturación / Timbrado | ✅ Implementado — `/facturacion/timbrado` |
| Facturación / Grupos y Productos | ✅ Implementado — `/facturacion/grupos` |
| Finanzas / Cuentas Caja/Banco | ✅ Implementado — `/finanzas/cuentas` |
| Facturación / Caja | Solo en sidebar, sin ruta ni página |
| Facturación / Cobranzas | Solo en sidebar, sin ruta ni página |
| Anulación de facturas | Endpoint + UI para anular VentaFactCab (reverso de movimientos, estado=anulado) |
| Impresión / PDF de facturas | ✅ Implementado — `GET /api/facturacion/{id}/pdf/` — WeasyPrint, plantilla SET Paraguay |
| Módulo de cobranzas | ✅ Implementado — `/finanzas/cobranzas` |
| Módulo de pagos a prestadores | ✅ Implementado — `/finanzas/pago-prestador` |
| Informes | Solo en sidebar, sin ruta ni página |
| Pagos | Ruta `/pagos` con placeholder |

---

## Orden de Implementación

### Paso 0 — Limpiar deuda técnica (antes de cualquier módulo nuevo)
1. Corregir los 4 bugs confirmados (ver sección siguiente)
2. Eliminar `axiosConfig.js`
3. Agregar `is_deleted=False` en querysets de Consultorio, Especialidad, EventoClinico
4. Limpiar `console.log` de debug en `useUbicacion.js` y `FormPaciente.jsx`
5. Extraer componente `<PanelSimple>` compartido para Consultorio, Especialidad, EventoClinico
6. Extraer `<Toast />`, `useToast()` y `<ConfirmDialog />` — reemplazar `window.confirm()`

### Paso 1 — Gestión de usuarios y roles
`apps/users/` — necesario para roles reales en RRHH y permisos por módulo.

### Paso 2 — Dashboard
Conectar `Dashboard.jsx` al router. Estadísticas básicas: pacientes activos, citas del día, etc.

### Paso 3 — RRHH / Personas prestadoras
Extiende `Persona` con datos de prestador. Patrón: Master-Detail + FormPersona reutilizado.

### Paso 4 — Agenda / Horarios y Citas
Núcleo del sistema. Requiere RRHH completo. FK a Paciente, Prestador, Consultorio, DiaSemana.

### Paso 5 — Consulta médica / Historia clínica
Depende de Agenda.

### Integración real de notificaciones (pendiente)
El endpoint `POST /api/recordatorios/notificar/` ya existe y registra en DB con `estado=pendiente`.
Para activar envío real, agregar la lógica en `apps/notificaciones/views.py` antes del `return Response(...)`.
El frontend **no cambia** — el modal y los hooks ya están implementados.

#### Email — Resend
- Servicio: **Resend** (https://resend.com) — opción gratuita disponible, SDK Python simple.
- Instalar: `pip install resend`
- Variables a agregar en `.env`: `RESEND_API_KEY=re_xxxxx`, `EMAIL_FROM=noreply@clinicalichi.com`
- Lógica a agregar en `notificar()`:
  ```python
  import resend
  resend.api_key = settings.RESEND_API_KEY
  try:
      resend.Emails.send({ "from": settings.EMAIL_FROM, "to": destinatario, "subject": "Recordatorio - Clínica Lichi", "text": mensaje })
      notif.estado = 'enviado'
  except Exception:
      notif.estado = 'fallido'
  notif.fecha_envio = timezone.now()
  notif.save()
  ```

#### WhatsApp — Twilio
- Servicio: **Twilio** (https://twilio.com/whatsapp) — opción de paga, sandbox gratuito para pruebas.
- Instalar: `pip install twilio`
- Variables a agregar en `.env`: `TWILIO_ACCOUNT_SID=`, `TWILIO_AUTH_TOKEN=`, `TWILIO_WHATSAPP_FROM=whatsapp:+14155238886`
- Lógica a agregar en `notificar()`:
  ```python
  from twilio.rest import Client
  client = Client(settings.TWILIO_ACCOUNT_SID, settings.TWILIO_AUTH_TOKEN)
  try:
      client.messages.create(body=mensaje, from_=settings.TWILIO_WHATSAPP_FROM, to=f'whatsapp:{destinatario}')
      notif.estado = 'enviado'
  except Exception:
      notif.estado = 'fallido'
  notif.fecha_envio = timezone.now()
  notif.save()
  ```

### Paso 6 — Documentos digitalizados
Panel en perfil del paciente. Depende de Consulta y TipoDocDigital.

### Paso 7 — Facturación
Cabecera + detalle (master-detail doble). Depende de Consulta médica.

### Paso 8 — Finanzas / Cobranzas
Depende de Facturación.

### Paso 9 — Informes
Depende de todos los módulos anteriores.

---

## Bugs Confirmados — Corregir en Paso 0

| # | Archivo | Descripción |
|---|---|---|
| 1 | `components/paciente/FormPaciente.jsx:61` | `paciente.responsable_` — typo con guión bajo. ✅ corregido |
| 2 | `pages/PacienteResponsablePage.jsx` | La columna "Parentesco" leía `responsable.parentesco` (campo de Paciente). ✅ columna eliminada |
| 3 | `components/layout/Navbar.jsx` | Breadcrumb usa `/pacientes` (con s) pero la ruta real en App.jsx es `/paciente` (sin s). Nunca matchea. |
| 4 | `apps/administracion/especialidad/views.py:12` | `ordering_fields = ['especialidad']` — el campo no existe. ✅ corregido |

---

## Deuda Técnica — Corregir en Paso 0

| # | Archivo | Descripción |
|---|---|---|
| 5 | `api/axiosConfig.js` | Cliente duplicado huérfano. Usa `authToken`/`refreshToken` en lugar de `access_token`/`refresh_token`. Nadie lo importa. Eliminar. |
| 6 | `hooks/useUbicacion.js:9` | `console.log('Paises: ', data)` — debug sin limpiar. ✅ limpiado |
| 7 | `components/paciente/FormPaciente.jsx:72` | `console.log('form.responsable:', form.responsable)` — debug sin limpiar. ✅ eliminado |
| 8 | — | CSS `.con-*` y `.panel-*` duplicado corregido. `ConsultorioPage`, `EspecialidadPage` y `EventoClinicoPage` migrados a `<PanelSimple>` ✅ |
| 9 | — | Todos los viewsets filtran `is_deleted=False` ✅ |
| 10 | `Sidebar.jsx` | `user?.rol \|\| 'admin'` — AuthContext solo guarda el token, no el rol. ✅ Corregido — `AuthContext` ahora decodifica JWT y expone `rol`, `nombre`, `iniciales`, `persona_rrhh_id`. |
| 11 | `pages/Dashboard.jsx` | Existe pero sin ruta en `App.jsx`. Inaccesible. |
| 12 | `apps/appointments/urls.py` | Router vacío. Sin modelos, serializers ni views. |

---

## Componentes Pendientes de Extraer

| Componente | Destino | Estado |
|---|---|---|
| `<PanelSimple>` | `components/ui/PanelSimple.jsx` | ✅ Creado — en uso en ConsultorioPage |
| `<Toast />` | `components/ui/Toast.jsx` | ✅ Creado — en uso en ConsultorioPage |
| `useToast()` | `hooks/useToast.js` | ✅ Creado — en uso en ConsultorioPage |
| `<ConfirmDialog />` | `components/ui/ConfirmDialog.jsx` | ❌ Pendiente — reemplaza `window.confirm()` |

---

## Mejoras Pendientes — ConsultasPage (próxima sesión)

Estas mejoras fueron acordadas con el usuario y deben implementarse juntas en la siguiente sesión dedicada a ConsultasPage. No modificar el resto del sistema al implementarlas.

### 1 — Subida de documentos ✅ corregido
- **Causa raíz**: `apiClient` tiene `Content-Type: application/json` por defecto. Axios detecta FormData + application/json y convierte el archivo a JSON (`{}`), que el servidor rechaza.
- **Fix**: `useSubirDocumento` ahora usa `fetch` nativo (sin Content-Type → browser pone `multipart/form-data; boundary=...` automáticamente).
- **Archivo**: `hooks/useDocumentos.js`

### 2 — Próxima cita → módulo de Recordatorios
- El campo `proxima_cita` (fecha) ya existe en el modelo `Consulta` y se guarda desde `PanelConsultaActiva`.
- En el futuro módulo de Recordatorios, se debe usar `proxima_cita` para generar recordatorios automáticos.
- Las "últimas consultas" del historial también alimentarán ese módulo.
- **No hacer nada en este punto ahora** — solo tenerlo en cuenta al diseñar Recordatorios.

### 3 — Datos clínicos del paciente visibles durante la consulta ✅ implementado
- **Backend**: `ConsultaPacienteSerializer` ampliado con `grupo_sanguineo`, `alergias_conocidas`, `enfermedades_cronicas`, `responsable_nombre`, `responsable_telefono`.
- `ConsultaViewSet.get_queryset` agrega `select_related('agenda__paciente__responsable__persona')`.
- **Frontend**: sección "Datos clínicos" en columna izquierda de `PanelConsultaActiva`. Alergias en amarillo/naranja de advertencia. Tipo de sangre como badge rojo. Responsable con link `tel:` al teléfono. Campos vacíos muestran "No registrados" en gris.

### 5 — Finalizar consulta de días anteriores (PENDIENTE)
- **Problema**: `VistaMedico` y `VistaRecepcionista` solo muestran turnos del día actual (`fechaLocal()`). Si una consulta quedó `en_consulta` sin finalizar el día anterior, no aparece en ninguna vista y no puede finalizarse.
- **Solución propuesta**: agregar un filtro de fecha a `VistaMedico` (no solo "hoy") o una vista separada "Consultas pendientes" que liste consultas con `estado=en_consulta` sin filtro de fecha. El endpoint ya soporta filtrado por `estado` sin `fecha`.
- **Prioridad**: media — no bloquea el flujo normal del día.

### 4 — Botón Historia Clínica en la consulta activa
- Agregar un botón "Historia Clínica" en `PanelConsultaActiva`.
- Al hacer clic, abrir un `<Modal size="xl">` que liste las consultas previas del paciente (`useConsultasPaciente(pacienteId)`).
- Al hacer clic sobre una consulta de la lista, mostrar el detalle completo **en modo solo lectura** (sin posibilidad de editar).
- Las "Últimas consultas" en la vista actual del panel pueden mantenerse como resumen rápido; el modal es la vista completa.
- Componente sugerido: `ModalHistoriaClinica` dentro de `ConsultasPage.jsx` (función interna) usando `<Modal>` de `components/ui/Modal.jsx`.

---

## Pendientes Globales

| Pendiente | Alcance | Prioridad |
|---|---|---|
| Bugs confirmados (#1 al #4) | Archivos específicos | 🔴 Alta |
| Deuda técnica (#5 al #12) | Varios archivos | 🔴 Alta |
| Borrado lógico con validación de dependencias | Todos los viewsets | 🔴 Alta |
| Interceptor Axios para 401 / 403 / 500 | `src/api/client.js` | 🔴 Alta |
| Roles reales en AuthContext | Backend + frontend | 🟡 Media |
| select_related / prefetch_related | Viewsets con datos anidados | 🟡 Media |
| Paginación del servidor en tablas | Pacientes y Responsables | 🟡 Media |
| Debounce en campos de búsqueda | Tablas con buscador | 🟡 Media |
| JSDoc en componentes compartidos | Modal, BuscadorPersona, FormPersona | 🟡 Media |
| Tests de integración backend | Viewsets críticos | 🟢 Al finalizar esqueleto |
| Tests frontend con Vitest + RTL | Hooks y componentes | 🟢 Al finalizar esqueleto |

---

## Instrucción al Finalizar Cada Módulo

Al completar un módulo nuevo, actualizar este archivo reflejando:
- Nuevo estado en la tabla de módulos (✅ / ⚠️ / ❌)
- Nuevos prefijos CSS creados y el componente al que pertenecen
- Nuevos hooks agregados con su responsabilidad
- Bugs o deuda técnica nueva detectada
- Cualquier patrón nuevo que difiera de los documentados aquí

## Arquitectura JWT — Claims del token

El token JWT incluye los siguientes campos custom (además de los estándar de simplejwt):

| Campo | Tipo | Fuente |
|---|---|---|
| `rol` | string | `PerfilUsuario.rol` |
| `nombre` | string | `PerfilUsuario.nombre_completo` (first+last name, o username si vacío) |
| `iniciales` | string | `PerfilUsuario.iniciales` (primeras 2 letras del nombre completo) |
| `activo` | bool | `PerfilUsuario.activo` |
| `persona_rrhh_id` | int\|null | `PerfilUsuario.persona_rrhh_id` |

`AuthContext.jsx` decodifica el payload del JWT (sin librería externa — base64 manual) y expone todos estos campos en `user`. El Sidebar lee `user.rol` para filtrar el menú según el rol.

Roles disponibles: `admin`, `medico`, `recepcionista`, `secretaria_medico`.

## Notas sobre BuscadorMedico (PagoPrestadorPage)

`PersonaRRHHListSerializer` retorna campos planos `nombre` (→ `persona.razon_social`) y `documento` (→ `persona.nro_documento`). El BuscadorMedico usa `m.nombre` y `m.documento` directamente — **no** `m.persona?.razon_social` ni `m.persona?.nro_documento`.

_Clínica Lichi — CLAUDE.md · Versión 3.8 · Abril 2026_
