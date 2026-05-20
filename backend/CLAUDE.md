# CLAUDE.md — Backend
_Clínica Lichi · Versión 4.0 · Abril 2026_

Ver también: `../CLAUDE.md` (convenciones globales)

---

## Estructura de Apps

```
backend/apps/
├── core/                          ← BaseModel abstracto + utilidades base
│
├── administracion/
│   ├── persona/                   ← tabla raíz del sistema
│   ├── users/                     ← autenticación y perfiles
│   ├── persona_rrhh/              ← prestadores
│   └── auditoria/                 ← registro de cambios (solo admin)
│
├── mantenimiento/
│   ├── diasemana/                 ← dato de referencia fijo, sin BaseModel
│   ├── tipo_doc_dig/
│   ├── ubicacion/
│   ├── forma_pago/
│   └── notificaciones/
│
├── clinica/
│   ├── configuracion/
│   │   ├── consultorio/
│   │   ├── especialidad/
│   │   ├── eventoclinico/
│   │   ├── documentos/
│   │   └── horario_prestador/
│   ├── paciente/
│   ├── paciente_responsable/
│   ├── agenda/
│   └── consultas/
│
├── facturacion/
│   ├── configuracion/
│   │   └── timbrado/
│   └── ventas/
│
├── stock/
│   ├── configuracion/             ← futuro: categorías, unidades de medida
│   └── productos/
│
└── finanzas/
    ├── caja_banco/
    ├── cobranzas/
    └── pago_prestador/
```

---

## Orden de construcción por app
`modelo → migraciones → admin → serializers → viewsets → urls`

---

## Checklist de Auditoría — Por App

Al auditar cada app aplicar **todos** estos puntos sin excepción:

### models.py
- [ ] `db_table` explícito en `Meta` — nombre corto sin prefijo de app (ej: `'consultorio'`, `'especialidad'`)
- [ ] `label` explícito en `apps.py` para proteger migraciones externas al mover el módulo
- [ ] Sin comentarios descriptivos — solo los que explican el por qué
- [ ] `__str__` sin campos duplicados

### serializers.py
- [ ] Doble serializer: `XListSerializer` (lectura) + `XSerializer` (escritura)
- [ ] `get_serializer_class()` en el ViewSet elige según `self.action`
- [ ] Validaciones case-insensitive con `Lower()` para campos de texto únicos
- [ ] Sin docstrings ni comentarios del qué
- [ ] Si el modelo tiene `UniqueConstraint`: agregar `validators = []` en Meta + validación manual en `validate()` con mensaje amigable (ver convención más abajo)

### views.py
- [ ] Hereda de `AuditoriaMixin` **antes** del ViewSet base
- [ ] Sin `perform_create`, `perform_update`, `perform_destroy` propios salvo para validar dependencias
- [ ] Si valida dependencias en `perform_destroy`, llama `super().perform_destroy(instance)` al final
- [ ] Sin imports no usados (`status`, `timezone` si ya lo maneja el mixin, etc.)
- [ ] Sin comentarios de sección (`# ── Auditoría ──`, `# ── Borrado lógico ──`, etc.)
- [ ] `search_fields` incluye todos los campos por los que tiene sentido buscar

### urls.py
- [ ] Sin comentarios descriptivos
- [ ] Prefijo de URL en snake_case corto (ej: `r'consultorio'`, `r'especialidad'`)

### Ubicación
- [ ] App en la ruta objetivo según estructura del CLAUDE.md raíz
- [ ] `name` en `apps.py` refleja la ruta actual

### Frontend — aplicar en el mismo paso
- [ ] `window.confirm` reemplazado por `ConfirmDialog` en la página correspondiente
- [ ] `extraerMensajeError` importado desde `utils/errores`, no definido inline
- [ ] Botones Editar/Eliminar usan clases CSS, no `onMouseEnter/Leave` inline
- [ ] Comentarios descriptivos eliminados de la página
- [ ] Ver checklist completo en `../frontend/CLAUDE.md`

---

## Convenciones Críticas

### Borrado lógico
Ver `../CLAUDE.md` — aplica a todas las apps.

**Tablas que requieren validación de dependencias antes de borrar:**
- `Pais` → verificar departamentos activos y personas activas ✅
- `Departamento` → verificar ciudades activas y personas activas ✅
- `Ciudad` → verificar personas activas ✅
- `PacienteResponsable` → verificar pacientes activos ✅
- `Especialidad` → verificar prestadores activos en `PersonaRRHH.especialidades` ✅
- `EventoClinico` → verificar `consultas.filter(is_deleted=False)` ✅
- `Consultorio` → verificar horarios activos en `HorarioPrestador` ✅
- `TipoDocDigital` → verificar documentos activos ✅
- `Paciente` → verificar citas activas en `Agenda` (disponible/ocupado/realizado) ✅
- `Timbrado` → verificar facturas activas en `VentaFactCab` ✅
- `ProductoServicio` → verificar facturas activas en `VentaFactDet` ✅
- `VentaFactCab` → verificar `MovimientoCajaBanco` con `vfdc_id` en su cobranza ✅
- `CuentaMcb` → verificar movimientos activos en `MovimientoCajaBanco` ✅
- `Persona` → no eliminable — `MethodNotAllowed` en `perform_destroy` ✅

### Permisos de rol — clases compartidas en `apps/core/permissions.py`
Importar siempre desde ahí — **no** redefinir inline.

| Clase | Roles permitidos |
|---|---|
| `IsAdminRole` | `admin` |
| `IsAdminOrRecepcionista` | `admin`, `recepcionista` |

**Patrón de tres niveles** (catálogos con escritura restringida):
```python
from apps.core.permissions import IsAdminRole, IsAdminOrRecepcionista

def get_permissions(self):
    if self.action in ('list', 'retrieve'):
        return [IsAuthenticated()]
    if self.action in ('destroy', 'eliminados'):
        return [IsAuthenticated(), IsAdminRole()]
    return [IsAuthenticated(), IsAdminOrRecepcionista()]
```

Actualmente aplicado en: `ConsultorioViewSet`, `EspecialidadViewSet`, `EventoClinicoViewSet`, `PaisViewSet`, `DepartamentoViewSet`, `CiudadViewSet`, `TipoDocDigitalViewSet`, `PersonaViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy), `TipoDocumentoViewSet` (IsAdminRole para todo CUD), `PacienteViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy/eliminados), `PacienteResponsableViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy/eliminados), `PersonaRRHHViewSet` (IsAdminRole para todo CUD y eliminados), `HorarioPrestadorViewSet` (IsAdminOrRecepcionista para create/update; IsAdminOrRecepcionistaOrSecretaria para generar; IsAdminRole para destroy/eliminados), `AgendaViewSet` (IsAuthenticated para list/retrieve/custom actions lectura/asignar/cambiar_estado/reagendar; IsAdminOrRecepcionistaOrSecretaria para create/update/cancelar_rango; IsAdminRole para destroy/eliminados), `TimbradoViewSet` (IsAdminRole para todo CUD y eliminados), `GrupoViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy/eliminados), `ProductoServicioViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy/eliminados), `VentaFactCabViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy), `CuentaMcbViewSet` (IsAdminRole para todo CUD y eliminados), `MovimientoCajaBancoViewSet` (IsAdminOrRecepcionista para create/update; IsAdminRole para destroy/eliminados), `CobranzaViewSet` (IsAdminOrRecepcionista para create; IsAdminRole para destroy), `PagoPrestadorViewSet` (IsAdminRole para todo CUD y eliminados).

**Rol `secretaria_medico`:** JWT claim `medicos_asignados` (lista de IDs, M2M). Los viewsets que soportan este rol filtran `get_queryset()` con `__in` — ve y gestiona solo la agenda de sus médicos asignados. Puede: reagendar, asignar pacientes, cambiar estados, generar turnos (HorarioPrestador). No puede: crear/editar horarios template, eliminar turnos.
En el frontend, `AuthContext.buildUser` expone `medico_asignado_id = medicos_asignados[0] || null` como campo computado de conveniencia para auto-selección de un único médico en la UI.
`PerfilUsuarioViewSet` usa `IsAdminRole` directamente (lógica propia por ser gestión de usuarios).

### Módulos sin BaseModel — auditoría manual con _log()
`PerfilUsuario` y `DiaSemana` no heredan `BaseModel`, por lo que `AuditoriaMixin` no aplica.
Para `PerfilUsuario` se usa un helper `_log()` local en `views.py`:

```python
def _log(request, registro_id, accion, datos_antes=None, datos_despues=None):
    try:
        x_fwd = request.META.get('HTTP_X_FORWARDED_FOR')
        ip = x_fwd.split(',')[0].strip() if x_fwd else request.META.get('REMOTE_ADDR')
        RegistroAuditoria.objects.create(
            tabla='PerfilUsuario', registro_id=registro_id, accion=accion,
            datos_antes=datos_antes, datos_despues=datos_despues,
            usuario=request.user, ip=ip,
        )
    except Exception:
        pass
```

Las contraseñas se registran siempre como `'***'` — nunca en claro. El campo `datos_despues`
agrega contexto: `'*** (modificada por el propio usuario)'` o `'*** (reseteada por administrador: X)'`.

### Protecciones del usuario master y auto-protección
Reglas implementadas en `PerfilUsuarioViewSet`:
- `cambiar_estado`: no se puede desactivar a `is_superuser`, ni a uno mismo
- `partial_update`: no se puede cambiar el `rol` de `is_superuser`
- `cambiar_password` y `resetear_password`: la nueva contraseña no puede ser igual a la actual
  (`user.check_password(nueva)` antes de `set_password`)

### Doble serializer (list vs write)
- `XListSerializer` — campos anidados expandidos (para `list` y `retrieve`)
- `XSerializer` — solo IDs para escritura (para `create` y `update`)
- El ViewSet usa `get_serializer_class()` para elegir según la acción
- El orden de definición en el archivo importa — definir primero los referenciados

### Unicidad case-insensitive
- Usar `Lower('campo')` en las `UniqueConstraint`
- Crear índices con `Lower('campo')` para rendimiento

### UniqueConstraint — mensajes de error amigables
DRF genera automáticamente validadores a partir de `UniqueConstraint` del modelo y los mensajes resultantes exponen nombres de campo internos (ej: `"Los campos persona_rrhh, dia_semana, hora_desde deben formar un conjunto único."`). Para evitarlo:

1. Agregar `validators = []` en el `Meta` del serializer de escritura para suprimir el validador automático.
2. Agregar validación manual en `validate()` con mensaje en lenguaje natural para el usuario.
3. La validación manual debe:
   - Filtrar por `is_deleted=False` para respetar el borrado lógico.
   - Excluir la instancia actual (`self.instance`) para que PATCH no falle al guardar sin cambios.
   - Aplicar solo cuando corresponda (ej: solo cuando `excepcion=False` si el constraint es condicional).

```python
# Ejemplo — HorarioPrestador
class Meta:
    ...
    validators = []

def validate(self, data):
    ...
    if not excepcion:
        qs = HorarioPrestador.objects.filter(
            persona_rrhh=data.get('persona_rrhh'),
            dia_semana=data.get('dia_semana'),
            hora_desde=data.get('hora_desde'),
            is_deleted=False,
            excepcion=False,
        )
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError(
                'Ya existe un horario para este prestador con el mismo día y hora de inicio.'
            )
    return data
```

Aplicado en: `HorarioPrestadorSerializer`, `AgendaSerializer`.

### Construcción de rutas de archivos
```python
def build_storage_path(tipo_doc_dig, paciente_id, filename):
    ext       = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    year      = datetime.now().year
    return f'documentos/{tipo_doc_dig.storage_key}/{year}/{timestamp}_{tipo_doc_dig.storage_key}.{ext}'

def build_storage_path_prestador(tipo_doc_dig, persona_rrhh_id, filename):
    ext       = filename.rsplit('.', 1)[-1].lower() if '.' in filename else ''
    timestamp = datetime.now().strftime('%Y%m%d%H%M%S')
    year      = datetime.now().year
    return f'documentos-prestador/{tipo_doc_dig.storage_key}/{year}/{timestamp}_{tipo_doc_dig.storage_key}.{ext}'
```
Ejemplos:
- Paciente:   `documentos/historia_clinica/2026/20260414143022_historia_clinica.pdf`
- Prestador:  `documentos-prestador/titulo_universitario/2026/20260414143022_titulo_universitario.pdf`

### Borrado de documentos digitalizados
`perform_destroy` en `DocumentoDigPacienteViewSet` y `DocumentoDigPrestadorViewSet`:
1. Borrado físico del archivo en disco (`os.remove`). Si directorio vacío, eliminarlo (`os.rmdir`).
2. Borrado lógico — marca `is_deleted=True` (patrón estándar `BaseModel`).

### Almacenamiento
```python
MEDIA_ROOT = '/app/media'
MEDIA_URL  = '/media/'
```
Volumen Docker: `./media:/app/media` — persiste entre reinicios.
Listo para migrar a S3 con `django-storages` sin cambiar modelos ni lógica.

---

## Módulo Auditoría ✅

Ubicación: `apps/administracion/auditoria/`

### Modelo
`RegistroAuditoria` — tabla `auditoria_registro`. Campos: `tabla`, `registro_id`, `accion`
(CREAR/EDITAR/ELIMINAR), `datos_antes`, `datos_despues`, `usuario` FK, `fecha`, `ip`.
Sin BaseModel — nunca se borra, todo queda trazado.

### AuditoriaMixin — `mixins.py`
Absorbe `perform_create`, `perform_update` y `perform_destroy`. Maneja en cada uno:
- `id_usu_creator` / `id_usu_modificator` en el `serializer.save()`
- Borrado lógico completo (`is_deleted`, `fecha_eliminacion`, `id_usu_modificator`)
- Registro en `RegistroAuditoria` dentro de `try/except` — nunca bloquea la operación principal

Ver `../CLAUDE.md` para la convención de uso en ViewSets.

### ViewSet
`RegistroAuditoriaViewSet` — solo lectura. Acceso restringido a `rol == 'admin'`.
Filtros: `tabla`, `accion`, `usuario`, `fecha_desde`, `fecha_hasta`.

### Pendiente
- `AuditoriaPage` frontend (`pages/administracion/AuditoriaPage.jsx`) — solo rol admin

---

## Arquitectura JWT

Claims custom del token (además de los estándar de simplejwt):

| Campo | Tipo | Fuente |
|---|---|---|
| `rol` | string | `PerfilUsuario.rol` |
| `nombre` | string | `PerfilUsuario.nombre_completo` |
| `iniciales` | string | Primeras 2 letras del nombre completo |
| `activo` | bool | `PerfilUsuario.activo` |
| `persona_rrhh_id` | int\|null | `PerfilUsuario.persona_rrhh_id` |
| `medicos_asignados` | int[] | Lista de IDs de `PerfilUsuario.medicos_asignados` (M2M) — solo rol `secretaria_medico` |

Roles disponibles: `admin`, `medico`, `recepcionista`, `secretaria_medico`

---

## Endpoints Personalizados

### Administración
| Endpoint | Descripción |
|---|---|
| `GET /api/persona/buscar/?nro_documento=X` | `{persona, paciente, es_paciente}` |
| `GET /api/pacienteresponsable/buscar/?nro_documento=X` | `{persona, pacienteresponsable, es_responsable}` |
| `GET /api/personarrhh/buscar/?nro_documento=X` | `{persona, personarrhh, es_prestador}` |
| `GET /api/usuarios/` | Lista con filtros `search`, `rol`, `activo` — solo admin |
| `POST /api/usuarios/` | Crea User + PerfilUsuario — solo admin |
| `GET /api/usuarios/{id}/` | Detalle de un perfil — solo admin |
| `PATCH /api/usuarios/{id}/` | Actualiza perfil — solo admin; no cambia rol del master |
| `GET /api/usuarios/me/` | Perfil del usuario autenticado — cualquier rol |
| `POST /api/usuarios/cambiar-password/` | `{current_password, nueva_password}` — cualquier rol; valida que no coincidan |
| `POST /api/usuarios/{id}/cambiar-estado/` | Toggle `activo` — solo admin; bloquea master y auto-desactivación |
| `POST /api/usuarios/{id}/resetear-password/` | `{nueva_password}` — solo admin; valida que no coincida con la actual |

### Eliminados (todos los módulos con borrado lógico)
`GET /api/{modulo}/eliminados/` — disponible en: paciente, pacienteresponsable, consultorio, pais, departamento, ciudad, especialidad, eventoclinico, tipo-doc-dig, personarrhh, horario-prestador, timbrado, grupos, productos, cuentas-mcb, movimientos-caja, cobranzas

### Clínica
| Endpoint | Descripción |
|---|---|
| `GET /api/departamento/?pais=ID` | Filtrado por país |
| `GET /api/ciudad/?departamento=ID` | Filtrado por departamento |
| `POST /api/horario-prestador/{id}/generar/` | Genera turnos Agenda para un rango de fechas |
| `PATCH /api/agenda/{id}/asignar/` | Asigna paciente a turno disponible |
| `PATCH /api/agenda/{id}/estado/` | Cambia estado disponible/inactivo/cancelado/realizado |
| `PATCH /api/agenda/{id}/reagendar/` | Mueve paciente de turno ocupado a otro disponible del mismo prestador (atómico) — body: `{nuevo_turno_id}` |
| `POST /api/agenda/cancelar-rango/` | Cancela todos los turnos DISPONIBLES de un prestador en un rango — body: `{persona_rrhh, fecha_desde, fecha_hasta, hora_desde?, hora_hasta?}` — `hora_*` opcionales filtran por franja horaria — retorna `{cancelados: N, no_cancelados: [{fecha, hora_desde, estado, paciente}]}` con los turnos ocupados/realizados no cancelados |
| `GET /api/agenda/resumen-mes/` | Conteo por fecha de disponibles/ocupados/inactivos/total |
| `GET /api/agenda/stats-hoy/` | Estadísticas del día actual (timezone-aware, usa `timezone.localtime().date()`) |
| `POST /api/consultas/{id}/iniciar/` | Estado en_espera→en_consulta, registra hora_desde |
| `POST /api/consultas/{id}/finalizar/` | Estado en_consulta→finalizada, registra hora_hasta |
| `GET /api/consultas/stats-hoy/` | `{total, en_espera, en_consulta, finalizadas}` |
| `GET /api/consultas/?persona_rrhh=id&fecha=YYYY-MM-DD` | Turnos del día de un médico |
| `GET /api/documentos/?consulta=id` | Documentos de una consulta |
| `GET /api/documentos/?paciente=id` | Historial completo de documentos de un paciente |
| `GET /api/documentos/pacientes/?search=` | Pacientes con al menos un documento |
| `GET /api/documentos/{id}/descargar/` | FileResponse del archivo (paciente) |
| `GET /api/documentos-prestador/?persona_rrhh=id` | Documentos de un prestador |
| `GET /api/documentos-prestador/{id}/descargar/` | FileResponse del archivo (prestador) |
| `GET /api/paciente/reporte-lista/` | PDF WeasyPrint — listado con nombre, documento, edad, sexo, teléfono, responsable. Filtros: `sexo`, `grupo_sanguineo`, `pais`, `departamento`, `ciudad`, `fecha_desde`, `fecha_hasta` |
| `GET /api/paciente/reporte-lista-excel/` | Excel openpyxl — mismos campos y filtros. Descarga `.xlsx` |
| `GET /api/personarrhh/reporte-lista/` | PDF WeasyPrint — listado de prestadores: nombre, documento, cargo, especialidades, matrícula, estado |
| `GET /api/personarrhh/reporte-lista-excel/` | Excel openpyxl — mismos campos. Descarga `.xlsx` |
| `GET /api/horario-prestador/reporte-horarios/` | PDF WeasyPrint — listado de horarios: prestador, día/fecha, desde, hasta, intervalo, especialidades, estado |
| `GET /api/horario-prestador/reporte-horarios-excel/` | Excel openpyxl — mismos campos. Descarga `.xlsx` |
| `GET /api/paciente/dashboard-mensual/` | Estadísticas del mes en curso sin filtros: `total_mes`, `por_dia` (todos los días con `es_futuro`), `por_semana`, `por_sexo`, `por_grupo_etario` (6 rangos + sin fecha), `por_departamento` (top 5 + otros con total restante, indica país), `tendencia_6meses` |

### Recordatorios
| Endpoint | Descripción |
|---|---|
| `GET /api/recordatorios/proximas-citas/` | Consultas con proxima_cita, anotadas con urgencia |
| `GET /api/recordatorios/stats/` | `{vencidas, proximos_7_dias, proximos_30_dias, agendadas}` |
| `POST /api/recordatorios/notificar/` | Registra Notificacion con estado pendiente |
| `GET /api/notificaciones/?paciente=id` | Historial de notificaciones |

### Facturación y Finanzas
| Endpoint | Descripción |
|---|---|
| `POST /api/facturacion/validar-timbrado/` | Valida número dentro del rango activo |
| `GET /api/facturacion/siguiente-numero/` | Próximo número disponible |
| `POST /api/facturacion/` | Crea VentaFactCab + VentaFactDet[] en `@transaction.atomic` |
| `PATCH /api/facturacion/{id}/` | Solo permite cambiar fecha, persona, observacion |
| `GET /api/facturacion/{id}/pdf/` | PDF con WeasyPrint — `permission_classes=[AllowAny]` |
| `GET /api/timbrado/?vigente=true\|false` | Lista con filtro de vigencia |
| `GET /api/grupos/?activo=true\|false` | Lista con conteo `total_productos` |
| `GET /api/productos/?grupo=id` | Productos de un grupo |
| `GET /api/cuentas-mcb/` | Cuentas con `saldo` anotado |
| `GET /api/movimientos-caja/?cta=id` | Movimientos filtrados por cuenta |
| `GET /api/forma-pago/` | Lista de formas de pago (solo lectura) |
| `GET /api/cobranzas/cuotas-pendientes/?persona=id` | CtaCobrar con saldo > 0 |
| `POST /api/cobranzas/` | Crea Cobranza + movimientos en `@transaction.atomic` |
| `GET /api/pago-prestador/bloques-pendientes/?persona_rrhh=id` | Bloques agrupados por horario+fecha |
| `POST /api/pago-prestador/` | Crea PagoPrestador + movimientos en `@transaction.atomic` |

---

## Plantillas de Informes (WeasyPrint)

Ubicación: `backend/templates/informes/`

| Archivo | Estado |
|---|---|
| `base_informe.html` | ✅ |
| `factura_print.html` | ✅ |
| `paciente_lista.html` | ✅ |
| `prestador_lista.html` | ✅ |
| `responsable_lista.html` | ✅ |
| `horario_prestador_lista.html` | ✅ |
| `cobranza_print.html` | ❌ pendiente |
| `recibo_print.html` | ❌ pendiente |
| `estado_cuenta_print.html` | ❌ pendiente |
| `informe_caja.html` | ❌ pendiente |

**Regla crítica para acciones de reporte:** las acciones que generan PDF o Excel hacen queries directas (sin pasar por `get_queryset()`). Deben incluir siempre `is_deleted=False` explícitamente, y además `fk__is_deleted=False` para relaciones FK relevantes:

```python
# ✅ Correcto
HorarioPrestador.objects.filter(is_deleted=False, persona_rrhh__is_deleted=False)
PersonaRRHH.objects.filter(is_deleted=False)

# ❌ Incorrecto — expone registros eliminados
HorarioPrestador.objects.all()
HorarioPrestador.objects.filter(is_deleted=False)  # falta el filtro de RRHH eliminados
```

Templatetags custom: `apps/principal/facturacion/templatetags/factura_tags.py`
- `|gs` — formatea valor como Guaraníes (entero con separador de miles con punto)
- `|minus` — resta decimal segura para templates

---

## Notas Especiales

### BuscadorMedico (PagoPrestadorPage)
`PersonaRRHHListSerializer` retorna campos planos `nombre` y `documento`.
Usar `m.nombre` y `m.documento` directamente — **no** `m.persona?.razon_social`.

### storage_key en TipoDocDigital
SlugField único que desacopla el nombre visible de la ruta física.
Permite renombrar el tipo sin romper rutas existentes.

### DiaSemana
- No hereda `BaseModel`
- IDs fijos: 1=Lunes ... 7=Domingo
- Solo lectura — `ReadOnlyModelViewSet`
- Requiere migración de datos con IDs fijos
