# CLAUDE.md — Clínica Lichi
_Versión 4.0 · Abril 2026_

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
| Zona horaria | `America/Asuncion` — Idioma `es-py` |
| Paginación global | `PageNumberPagination` — 20 ítems por página por defecto |
| Documentación API | `drf-spectacular` — Swagger `/api/docs/` · ReDoc `/api/redoc/` · uso principal: documentación de tesis · pendiente: evaluar Bruno para pruebas de desarrollo |

### Frontend
| Tecnología | Versión |
|---|---|
| React | 18.3 |
| Build tool | Vite 6.2 |
| Router | React Router Dom 7 |
| Server state | TanStack Query 5 |
| HTTP client | Axios 1.x |
| Íconos | Lucide React |
| Estilos | Tailwind CSS 3 + `<style>` tags inline por componente |

### Infraestructura
- Docker Compose — 3 containers: `clinica_frontend` (5173), `clinica_backend` (8000), `clinica_db` (5432)
- Vite proxy redirige `/api` → `localhost:8000`
- Versionado: GitHub

---

## Estructura del Proyecto

```
clinica/
├── CLAUDE.md                  ← convenciones globales (este archivo)
├── backend/
│   ├── CLAUDE.md              ← convenciones backend
│   └── apps/
│       ├── core/              ← BaseModel abstracto + utilidades base
│       ├── administracion/
│       │   ├── persona/       ← tabla raíz del sistema
│       │   ├── users/         ← autenticación y perfiles
│       │   ├── persona_rrhh/  ← prestadores
│       │   └── auditoria/     ← registro de cambios (solo admin)
│       ├── mantenimiento/
│       │   ├── diasemana/     ← dato de referencia fijo
│       │   ├── tipo_doc_dig/
│       │   ├── ubicacion/
│       │   ├── forma_pago/
│       │   └── notificaciones/
│       ├── clinica/
│       │   ├── configuracion/
│       │   │   ├── consultorio/
│       │   │   ├── especialidad/
│       │   │   ├── eventoclinico/
│       │   │   ├── documentos/
│       │   │   └── horario_prestador/
│       │   ├── paciente/
│       │   ├── paciente_responsable/
│       │   ├── agenda/
│       │   └── consultas/
│       ├── facturacion/
│       │   ├── configuracion/
│       │   │   └── timbrado/
│       │   └── ventas/
│       ├── stock/
│       │   ├── configuracion/ ← futuro: categorías, unidades de medida
│       │   └── productos/
│       └── finanzas/
│           ├── caja_banco/
│           ├── cobranzas/
│           └── pago_prestador/
└── frontend/
    ├── CLAUDE.md              ← convenciones frontend
    └── src/
        ← ver frontend/CLAUDE.md
```

---

## Convenciones Compartidas Backend + Frontend

### Borrado lógico — NUNCA eliminar físicamente
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
- `Persona` no puede eliminarse — `PersonaViewSet.perform_destroy` lanza `MethodNotAllowed`.

### PATCH, nunca PUT
Siempre usar `PATCH` para actualizaciones parciales. Aplica a hooks del frontend y cualquier cliente externo.

### Checklist de Auditoría — Aplicar en cada módulo

Ver checklist detallado en `backend/CLAUDE.md` (backend) y `frontend/CLAUDE.md` (frontend).

Resumen de los puntos más críticos que se repiten en cada módulo:

| Punto | Backend | Frontend |
|---|---|---|
| Ubicación correcta según estructura objetivo | `apps.py name` + directorio | ruta en `src/pages/` |
| Sin comentarios descriptivos | `models`, `views`, `urls` | página |
| Doble serializer + `get_serializer_class` | `serializers.py` + `views.py` | — |
| `AuditoriaMixin` aplicado | `views.py` | — |
| `db_table` explícito | `models.py` | — |
| `ConfirmDialog` en eliminación | — | todas las páginas con delete |
| `extraerMensajeError` importado, no inline | — | todas las páginas |
| Botones acción con CSS, no `onMouseEnter/Leave` | — | todas las páginas |

---

### Excepción — Módulos sin BaseModel
`PerfilUsuario` (users) y `DiaSemana` no heredan `BaseModel`, por lo que `AuditoriaMixin`
**no aplica**. `PerfilUsuario` usa un helper manual `_log()` en su `views.py` que escribe
directamente en `RegistroAuditoria`. Ver patrón completo en `backend/CLAUDE.md`.

### Auditoría — AuditoriaMixin en TODOS los viewsets
Todos los ViewSets con BaseModel deben heredar de `AuditoriaMixin` **antes** del ViewSet base:

```python
class MiViewSet(AuditoriaMixin, viewsets.ModelViewSet):
    ...
```

`AuditoriaMixin` maneja automáticamente:
- `serializer.save(id_usu_creator=...)` y `id_usu_modificator=...`
- Borrado lógico (`is_deleted=True`, `fecha_eliminacion`, `id_usu_modificator`)
- Registro en `RegistroAuditoria` (CREAR / EDITAR / ELIMINAR)

**Modelos con campos M2M:** `_serializar` convierte automáticamente listas de instancias a listas de PKs para garantizar serialización JSON. Fix aplicado en `auditoria/mixins.py` al detectar el bug con `PersonaRRHH.especialidades`.

**Los ViewSets NO deben redefinir `perform_create`, `perform_update` ni `perform_destroy`.**
Si un ViewSet necesita validar dependencias antes de borrar, sobrescribir `perform_destroy`
llamando a `super()` después de la validación:
```python
def perform_destroy(self, instance):
    if instance.hijos.filter(is_deleted=False).exists():
        raise ValidationError('Tiene registros vinculados activos.')
    super().perform_destroy(instance)  # delega borrado lógico + auditoría al mixin
```

### Permisos de rol — clases compartidas en `apps/core/permissions.py`
Importar siempre desde ahí — no redefinir inline.

| Clase | Roles permitidos | Usado por |
|---|---|---|
| `IsAdminRole` | `admin` | `PerfilUsuarioViewSet`, `ConsultorioViewSet`, `EspecialidadViewSet`, `EventoClinicoViewSet`, `PaisViewSet`, `DepartamentoViewSet`, `CiudadViewSet`, `TipoDocDigitalViewSet`, `TipoDocumentoViewSet` (CUD), `PersonaViewSet` (destroy), `PacienteViewSet` (destroy, eliminados), `PacienteResponsableViewSet` (destroy, eliminados), `PersonaRRHHViewSet` (todo CUD y eliminados), `HorarioPrestadorViewSet` (destroy, eliminados), `AgendaViewSet` (destroy, eliminados), `TimbradoViewSet` (todo CUD y eliminados), `GrupoViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy/eliminados), `ProductoServicioViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy/eliminados), `VentaFactCabViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy), `CuentaMcbViewSet` (todo CUD y eliminados), `MovimientoCajaBancoViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy/eliminados), `CobranzaViewSet` (IsAdminOrRecepcionista para create; IsAdminRole para destroy), `PagoPrestadorViewSet` (todo CUD y eliminados) |
| `IsAdminOrRecepcionista` | `admin`, `recepcionista` | `ConsultorioViewSet`, `EspecialidadViewSet`, `EventoClinicoViewSet`, `PaisViewSet`, `DepartamentoViewSet`, `CiudadViewSet`, `TipoDocDigitalViewSet`, `PersonaViewSet` (create/update), `PacienteViewSet` (create/update), `PacienteResponsableViewSet` (create/update), `HorarioPrestadorViewSet` (create/update), `AgendaViewSet` (create/update/cancelar_rango), `GrupoViewSet` (create/update), `ProductoServicioViewSet` (create/update), `VentaFactCabViewSet` (create/update), `MovimientoCajaBancoViewSet` (create/update), `CobranzaViewSet` (create) |
| `IsAdminOrRecepcionistaOrSecretaria` | `admin`, `recepcionista`, `secretaria_medico` | `HorarioPrestadorViewSet` (generar), `AgendaViewSet` (create/update/cancelar_rango — secretaria puede gestionar agenda de su médico asignado) |

**Patrón de tres niveles** (lectura abierta, escritura restringida, borrado solo admin):
```python
def get_permissions(self):
    if self.action in ('list', 'retrieve'):
        return [IsAuthenticated()]
    if self.action in ('destroy', 'eliminados'):
        return [IsAuthenticated(), IsAdminRole()]
    return [IsAuthenticated(), IsAdminOrRecepcionista()]
```

### TipoDocumento
Campo clave: `.descripcion` — NUNCA usar `.nombre`. Es fijo en base de datos, sin ABM.

---

## Estado de Módulos

| Módulo | Backend | Frontend |
|---|---|---|
| Autenticación JWT | ✅ | ✅ |
| Ubicaciones | ✅ | ✅ |
| Pacientes | ✅ | ✅ |
| Responsables | ✅ | ✅ |
| Consultorios | ✅ | ✅ |
| Especialidades | ✅ | ✅ |
| Evento Clínico | ✅ | ✅ |
| Tipo Doc. Digitalizado | ✅ | ✅ |
| Días de semana | ✅ migrado a `apps/mantenimiento/diasemana/` | — dato de referencia |
| Formas de pago | ✅ | — dato de referencia |
| PersonaRRHH | ✅ | ✅ |
| Horario Prestador | ✅ migrado a `apps/clinica/configuracion/horario_prestador/` | ✅ migrado a `pages/clinica/configuracion/` |
| Agenda | ✅ migrado a `apps/clinica/agenda/` | ✅ migrado a `pages/clinica/` |
| Consultas | ✅ migrado a `apps/clinica/consultas/` | ✅ migrado a `pages/clinica/` |
| Documentos digitalizados (pacientes) | ✅ migrado a `apps/clinica/configuracion/documentos/` | ✅ migrado a `pages/mantenimiento/` |
| Documentos digitalizados (prestadores) | ✅ modelo `DocumentoDigPrestador` · endpoint `/api/documentos-prestador/` | ✅ tab "Documentos" en `PersonaRRHHPage` |
| Recordatorios | ✅ migrado a `apps/mantenimiento/notificaciones/` | ✅ migrado a `pages/clinica/` |
| Timbrado | ✅ migrado a `apps/facturacion/configuracion/timbrado/` | ✅ migrado a `pages/facturacion/` |
| Grupos y Productos | ✅ migrado a `apps/stock/productos/` | ✅ migrado a `pages/stock/` |
| Cuentas Caja/Banco | ✅ migrado a `apps/finanzas/caja_banco/` | ✅ migrado a `pages/finanzas/` |
| Cobranzas | ✅ migrado a `apps/finanzas/cobranzas/` | ✅ migrado a `pages/finanzas/` |
| Pago a Prestadores | ✅ migrado a `apps/finanzas/pago_prestador/` | ✅ migrado a `pages/finanzas/` |
| Facturación / Ventas | ✅ migrado a `apps/facturacion/ventas/` · `CtaCobrar` → `apps/finanzas/estadocuenta/` | ✅ migrado a `pages/facturacion/` |
| Usuarios y Roles | ✅ | ✅ |
| Auditoría | ✅ | ❌ pendiente |
| Dashboard | ⚠️ sin ruta | ⚠️ sin ruta |
| Informes pacientes | ⚠️ parcial | ✅ ruta `/informes` |
| Dashboard pacientes | ⚠️ parcial | ✅ ruta `/informes/dashboard/pacientes` |

---

## Orden de Trabajo — Fase Actual

1. **Reorganizar estructura** de carpetas backend y frontend — ✅ completado
2. **Implementar módulo Auditoría** — backend ✅ · frontend ❌ pendiente (`AuditoriaPage`)
3. **Auditar módulo por módulo** — en este orden:
   - consultorio ✅ → especialidad ✅ → eventoclinico ✅
   - ubicacion ✅ → tipo_doc_dig ✅
   - persona ✅ → paciente ✅ → paciente_responsable ✅
   - persona_rrhh ✅ → horario_prestador ✅ → agenda ✅ → consultas ✅
   - documentos ✅ → recordatorios ✅
   - facturacion ✅ → caja_banco ✅ → cobranzas ✅ → pago_prestador ✅
4. **Agregar tests** al finalizar cada módulo auditado
5. **Conectar Dashboard** al router
6. **Módulo Informes** — `InformesPacientePage` ✅ (listado PDF/Excel + dashboard mensual). Pendiente: replicar patrón en otros módulos (agenda, facturación, etc.)

---

## Pendientes Globales

| Pendiente | Alcance | Prioridad |
|---|---|---|
| Modal detalle al hacer click en grupo (GruposPage) | Frontend | 🟡 Media |
| AuditoriaPage frontend | Frontend | 🔴 Alta |
| Aplicar AuditoriaMixin al resto de viewsets | Backend | 🔴 Alta |
| Borrado lógico con validación de dependencias | Todos los viewsets | 🔴 Alta |
| Interceptor Axios para 401 / 403 / 500 | `src/api/client.js` | 🔴 Alta |
| Crear `.env.example` | Raíz del proyecto | 🟡 Media |
| select_related / prefetch_related en listados | Viewsets con datos anidados | 🟡 Media |
| Conectar Dashboard al router | Frontend | 🟡 Media |
| Tests por módulo | Al finalizar auditoría de cada uno | 🟢 Progresivo |
| Módulo Informes — otros módulos (agenda, facturación) | Backend + Frontend | 🟢 Post-auditoría |
| Informe de horario por prestador — PDF/Excel con todos los horarios de un prestador (activos e inactivos), día, franja horaria, intervalo y especialidades | Backend + Frontend | 🟡 Media |

---

## Validación de Dependencias — Borrado Lógico

Regla: **nunca permitir borrar un registro si tiene hijos activos (`is_deleted=False`).**
El check va en `perform_destroy` antes de llamar `super()`. El mixin maneja el borrado lógico.

```python
def perform_destroy(self, instance):
    if instance.hijos.filter(is_deleted=False).exists():
        raise ValidationError('No se puede eliminar: tiene registros vinculados activos.')
    super().perform_destroy(instance)
```

| Modelo | Relación a verificar | Estado |
|---|---|---|
| `Pais` | departamentos activos + personas activas | ✅ |
| `Departamento` | ciudades activas + personas activas | ✅ |
| `Ciudad` | personas activas | ✅ |
| `PacienteResponsable` | pacientes activos | ✅ |
| `Especialidad` | prestadores activos (`persona_rrhh`) | ✅ |
| `EventoClinico` | consultas activas | ✅ |
| `Consultorio` | horarios activos en `HorarioPrestador` | ✅ |
| `TipoDocDigital` | documentos activos en `DocumentoDigPaciente` (`documentos`) + `DocumentoDigPrestador` (`documentos_prestador`) | ⚠️ verificar que el perform_destroy cubra ambas relaciones |
| `Paciente` | citas activas en `Agenda` (disponible/ocupado/realizado) | ✅ |
| `Agenda` | consultas activas (`Consulta.agenda`) | ✅ |
| `AgendaViewSet` (secretaria_medico) | filtrado por `medicos_asignados` del JWT (`__in`) — ve/gestiona solo la agenda de sus médicos asignados | ✅ |
| `Persona` | no eliminable — `MethodNotAllowed` en `perform_destroy` | ✅ |
| `Timbrado` | facturas activas en `VentaFactCab` | ✅ |
| `Grupo` | productos activos vinculados | ✅ |
| `ProductoServicio` | facturas activas en `VentaFactDet` | ✅ |
| `VentaFactCab` | movimientos de caja vinculados a su cobranza (`MovimientoCajaBanco.vfdc_id`) | ✅ |
| `CuentaMcb` | movimientos activos en `MovimientoCajaBanco` | ✅ |
