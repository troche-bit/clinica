# CLAUDE.md — Clínica Lichi
_Versión 4.1 · Mayo 2026_

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
│           ├── estadocuenta/  ← modelo CtaCobrar (sin views/urls propios aún)
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
| Auditoría | ✅ | ✅ ruta `/administracion/auditoria` (solo admin) |
| Estado de Cuenta (`CtaCobrar`) | ⚠️ modelo en `finanzas/estadocuenta/` — sin views/urls propios | ✅ `EstadoCuentaPage` — sin ruta en App.jsx aún |
| Informes pacientes | ✅ | ✅ ruta `/informes` |
| Informes stock | — | ✅ ruta `/informes/stock` |
| Dashboard pacientes | ✅ | ✅ ruta `/informes/dashboard/pacientes` |
| Dashboard consultas | ✅ | ✅ ruta `/informes/dashboard/consultas` |
| Dashboard agenda | ✅ | ✅ ruta `/informes/dashboard/agenda` |
| Dashboard prestadores | ✅ | ✅ ruta `/informes/dashboard/prestadores` (ruta inicial admin) |
| Dashboard ocupación | ✅ | ✅ ruta `/informes/dashboard/ocupacion` |
| Dashboard facturación | ✅ | ✅ ruta `/informes/dashboard/facturacion` |
| Dashboard cobranzas | ✅ | ✅ ruta `/informes/dashboard/cobranzas` |
| Dashboard finanzas | ✅ | ✅ ruta `/informes/dashboard/finanzas` |

---

## Orden de Trabajo — Fase Actual

1. **Reorganizar estructura** de carpetas backend y frontend — ✅ completado
2. **Implementar módulo Auditoría** — backend ✅ · frontend ✅ (`AuditoriaPage` con ruta `/administracion/auditoria`)
3. **Auditar módulo por módulo** — ✅ completado:
   - consultorio ✅ → especialidad ✅ → eventoclinico ✅
   - ubicacion ✅ → tipo_doc_dig ✅
   - persona ✅ → paciente ✅ → paciente_responsable ✅
   - persona_rrhh ✅ → horario_prestador ✅ → agenda ✅ → consultas ✅
   - documentos ✅ → recordatorios ✅
   - facturacion ✅ → caja_banco ✅ → cobranzas ✅ → pago_prestador ✅
4. **Agregar tests + documentación por módulo** — en curso. Ver tabla de estado más abajo.
5. **Dashboard conectado al router** — ✅ `HomeRedirect` activo: admin → `/informes/dashboard/prestadores`, médico/secretaria → `/consultas`
6. **Módulo Informes** — ✅ `InformesPacientePage` + 8 dashboards implementados. Pendiente: informes de agenda y horario por prestador.

---

## Checklist por Módulo — Tests + Documentación

Al trabajar en un módulo, completar los 4 pasos en orden. **Actualizar la tabla de estado al terminar cada paso.**

### Paso 1 — Tests backend `backend/apps/{ruta}/tests.py`

Cuatro clases obligatorias:

| Clase | Qué cubre |
|---|---|
| `BaseX` | `setUp` con admin/recep/medico + instancia de prueba; helper `auth(user)` |
| `PermisosTest` | anónimo→401, médico lee/no escribe, recep lee+crea+edita/no elimina, admin todo incluyendo `eliminados` |
| `XCrudTest` | list (solo activos, búsqueda, campos serializados), retrieve, create (válido, trim, duplicado exacto/case/mayúsculas, vacío, reutilizable tras borrado), patch (campo, mismo valor no falla, duplicado de otro→400), destroy (is_deleted+fecha, no aparece en list, ya borrado→404), eliminados (solo borrados, no paginado) |
| `XConstraintTest` | dependencia activa bloquea el borrado; error menciona el recurso bloqueante; solo borrado lógico no bloquea; sin dependencias → permite borrar |
| `XAuditoriaTest` | crear/editar/eliminar registran en `RegistroAuditoria`; tabla y acción correctas; usuario correcto; snapshots `datos_antes`/`datos_despues` no nulos |

Ejecutar: `docker compose exec backend python manage.py test apps.{ruta_con_puntos} --verbosity=2`

### Paso 2 — Tests E2E frontend `frontend/e2e/{modulo}.spec.js`

- Registrar el proyecto en `playwright.config.js` (con `dependencies: ['setup']` y `storageState`)
- Grupos de tests obligatorios:

| Grupo | Tests clave |
|---|---|
| Estructura inicial | carga con tabla + buscador + botón Nuevo; sin panel al entrar; encabezados correctos |
| Crear | panel en modo crear; Guardar deshabilitado con campo vacío; crear válido aparece en tabla; toast de confirmación; duplicado muestra error sin cerrar; cancelar con NavigationGuard no guarda; F10 guarda |
| Ver detalle | clic en fila abre panel en modo Detalle; muestra datos correctos; botones Editar y Eliminar para admin; hint visible; fila activa resaltada; X cierra el panel |
| Editar | lápiz abre modo editar; datos precargados; editar guarda cambio; botón Editar del panel de detalle cambia modo; duplicado de otro→error; cancelar con guard no guarda |
| Eliminar | papelera muestra ConfirmDialog; cancelar mantiene registro; confirmar quita de tabla + toast; botón Eliminar del panel dispara ConfirmDialog |
| Búsqueda | filtra tabla; sin resultados muestra estado vacío; limpiar restaura lista |
| Permisos recepcionista | no ve papelera; puede abrir panel crear; no ve botón Eliminar en detalle |

Ejecutar: `npx playwright test --project={modulo}`

> **Campos `soloLectura: true` en PanelSimple:** en modo editar, estos campos se renderizan como `div.panel-value-readonly` con badge "No editable" — **no** como `<input disabled>`. Para verificarlos en E2E usar `expect(page.locator('.panel-value-readonly')).toBeVisible()` y `expect(page.locator('input[name="campo"]')).not.toBeVisible()`. Nunca usar `toBeDisabled()` — causará timeout de 5s y arrastrará los tests siguientes.

### Paso 3 — Capturas de pantalla `frontend/e2e/screenshots-{modulo}.spec.js`

8 capturas estándar en `docs/imagenes/{modulo}/`:

```
01_listado.png         02_busqueda.png          03_panel_detalle.png
04_panel_crear.png     05_panel_crear_completo.png  06_panel_editar.png
07_confirm_eliminar.png  08_navigation_guard.png
```

Ejecutar: `npx playwright test --project=screenshots-manual e2e/screenshots-{modulo}.spec.js`

### Paso 4 — Manual de usuario `docs/manual_{modulo}.html`

10 secciones obligatorias:

| # | Sección |
|---|---|
| 01 | Descripción del módulo + tabla de permisos por rol (admin/recep/médico/secretaria) |
| 02 | Acceder al módulo (ruta en el menú lateral) |
| 03 | Pantalla principal — listado (columnas, comportamiento de acciones) |
| 04 | Buscar (filtros disponibles, sin resultados, limpiar) |
| 05 | Ver detalle (clic en fila, contenido del panel, cerrar) |
| 06 | Crear (pasos, campo requerido, unicidad, F10 / Insert) |
| 07 | Editar (desde lápiz y desde detalle, validación excluye propio registro) |
| 08 | Eliminar (solo admin, restricción de dependencias activas, borrado lógico) |
| 09 | Protección de cambios sin guardar (NavigationGuard — cuándo aparece, opciones) |
| 10 | Mensajes de error frecuentes + comportamientos esperados que no son errores |

Al terminar el manual, integrarlo al sistema:
1. Registrarlo en `MANUALES` de `Navbar.jsx` (pathname exacto del router → archivo) — habilita el botón de ayuda contextual.
2. Agregarlo a `MANUALES` de `docs/assets/manual.js` (selector de la barra superior de los manuales).
3. Agregar su tarjeta en `docs/index.html` (índice general).
4. Correr `npm run sync:manuales` desde `frontend/` para actualizar la copia servida en `public/manuales/`.

---

## Estado de Tests y Documentación por Módulo

**Actualizar esta tabla al completar cada paso de un módulo.**

| Módulo | Tests backend | E2E frontend | Manual |
|---|---|---|---|
| `core` (BaseModel) | ✅ | — | — |
| `users` | ✅ | ✅ | ✅ |
| `ubicacion` | ✅ | ✅ | ✅ |
| `consultorio` | ✅ | ✅ | ✅ |
| `especialidad` | ✅ | ✅ | ✅ |
| `eventoclinico` | ✅ | ✅ | ✅ |
| `tipo_doc_dig` | ✅ | ✅ | ✅ |
| `persona` | ✅ | — | — |
| `paciente` | ✅ | ✅ | ✅ |
| `paciente_responsable` | ✅ | ✅ | ✅ |
| `persona_rrhh` | ✅ | ✅ | ✅ |
| `horario_prestador` | ✅ | ✅ | ✅ |
| `agenda` | ✅ | ✅ | ✅ |
| `consultas` | ✅ | ✅ | ✅ |
| `documentos` | — | — | — |
| `notificaciones` | ✅ | ✅ | ✅ |
| `timbrado` | ✅ | ✅ | ✅ |
| `stock/productos` | ✅ | ✅ | ✅ |
| `finanzas/caja_banco` | ❌ | ❌ | ❌ |
| `finanzas/cobranzas` | ❌ | ❌ | ❌ |
| `finanzas/pago_prestador` | ❌ | ❌ | ❌ |
| `facturacion/ventas` | ✅ | ✅ | ✅ |

> **Convención:** ✅ completo · ❌ pendiente · ⚠️ parcial · — no aplica (sin UI propia o dato de referencia)

---

## Pendientes Globales

| Pendiente | Alcance | Prioridad |
|---|---|---|
| **Tests + documentación** — completar módulo por módulo según checklist (ver tabla de estado arriba) | Backend + Frontend | 🔴 Alta |
| **Interceptor Axios para 401 / 403 / 500** | `src/api/client.js` | 🔴 Alta |
| **Crear `.env.example`** | Raíz del proyecto | 🔴 Alta (requerido para deploy) |
| **Config producción** — Nginx + Gunicorn + SSL (Let's Encrypt) | Infraestructura | 🔴 Alta (requerido para deploy) |
| **EstadoCuentaPage — agregar ruta en App.jsx** | Frontend | 🟡 Media |
| **`estadocuenta` — agregar views/urls propios** | Backend | 🟡 Media |
| Modal detalle al hacer click en grupo (GruposPage) | Frontend | 🟡 Media |
| `TipoDocDigital` — verificar que `perform_destroy` cubra ambas relaciones (`documentos` + `documentos_prestador`) | Backend | 🟡 Media |
| select_related / prefetch_related en listados | Viewsets con datos anidados | 🟡 Media |
| Informe de horario por prestador — PDF/Excel con todos los horarios (activos e inactivos), día, franja, intervalo y especialidades | Backend + Frontend | 🟡 Media |
| Informes de agenda | Backend + Frontend | 🟢 Post-tests |

---

## Despliegue — Producción

### Arquitectura objetivo

```
Internet (HTTPS 443)
        │
        ▼
     NGINX               ← reverse proxy, termina SSL, sirve /static y /media
      ├── /api      →  Gunicorn (Django, DEBUG=False, 3 workers)
      ├── /static   →  STATIC_ROOT  (generado por collectstatic)
      ├── /media    →  MEDIA_ROOT   (archivos subidos por usuarios)
      └── /*        →  React SPA (dist/index.html)

  PostgreSQL 16          ← puerto 5432 cerrado, solo accesible internamente
```

### Diferencia clave vs. desarrollo

| | Desarrollo | Producción |
|---|---|---|
| Backend | `runserver` | **Gunicorn** |
| Frontend | `npm run dev` (Vite, proceso vivo) | `npm run build` → estáticos servidos por Nginx |
| Entrada | puertos 5173 y 8000 expuestos | un solo Nginx en 80/443 |
| Código | montado por volumen (hot reload) | copiado dentro de la imagen |
| DB puerto | 5432 expuesto al host | cerrado al exterior |

### Variables de entorno en producción

Copiar `.env.example` como `.env.production` y completar:

| Variable | Valor de desarrollo | Valor de producción |
|---|---|---|
| `DEBUG` | `True` | `False` |
| `DJANGO_SETTINGS_MODULE` | `config.settings.development` | `config.settings.production` |
| `SECRET_KEY` | clave débil de prueba | `openssl rand -hex 50` |
| `ALLOWED_HOSTS` | `localhost,127.0.0.1,backend` | `tu-dominio.duckdns.org` |
| `CORS_ALLOWED_ORIGINS` | `http://localhost:5173` | `https://tu-dominio.duckdns.org` |
| `CSRF_TRUSTED_ORIGINS` | — | `https://tu-dominio.duckdns.org` |
| `SITE_URL` | `http://localhost:8000` | `https://tu-dominio.duckdns.org` |

Generar `SECRET_KEY` segura:
```bash
openssl rand -hex 50
```

### Archivos de producción ✅ implementados

| Archivo | Propósito |
|---|---|
| `docker-compose.prod.yml` | Stack de producción: nginx + gunicorn + db + certbot (sin volúmenes de código) |
| `backend/Dockerfile.prod` | Imagen backend: copia código, corre `collectstatic` + `gunicorn` al iniciar |
| `backend/entrypoint.prod.sh` | Script de inicio: `collectstatic --noinput` → `exec gunicorn` |
| `backend/config/wsgi.py` | Entry point WSGI requerido por Gunicorn |
| `frontend/Dockerfile.prod` | Multi-stage: `npm ci` + `npm run build` → `nginx:alpine` sirve `dist/` |
| `nginx/default.conf` | Reverse proxy: `/api` y `/admin` → gunicorn, `/static` y `/media` → dirs, `/*` → SPA |
| `nginx/certbot/conf/` | Directorio para certificados Let's Encrypt (contenido ignorado por git) |
| `nginx/certbot/www/` | Directorio para challenges ACME (contenido ignorado por git) |

### Deploy en Oracle Cloud Free

#### Preparación única (primer deploy)

```bash
# 1. En la VM: instalar Docker
sudo apt update && sudo apt install -y docker.io docker-compose-plugin
sudo usermod -aG docker $USER  # cerrar sesión y volver a entrar

# 2. Clonar repo y preparar entorno
git clone https://github.com/tu-usuario/clinica.git && cd clinica
cp .env.example .env.production
nano .env.production   # completar todos los valores reales (SECRET_KEY, dominio, etc.)

# 3. Reemplazar "tu-dominio.duckdns.org" en nginx/default.conf con el dominio real

# 4. Abrir puertos — PASO CRÍTICO (hay que hacerlo en dos lugares):
#    a) Oracle Cloud → Security List de la subred → Ingress Rules: TCP 80 y TCP 443
#    b) Dentro de la VM:
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT

# 5. Primer deploy SIN HTTPS (necesario para obtener el certificado SSL)
#    En nginx/default.conf comentar el bloque "server { listen 443 ssl; ... }"
docker compose -f docker-compose.prod.yml up -d --build nginx db backend

# 6. Obtener certificado SSL con Certbot
docker compose -f docker-compose.prod.yml run --rm certbot certonly \
    --webroot --webroot-path=/var/www/certbot \
    -d tu-dominio.duckdns.org \
    --email tu@email.com --agree-tos --no-eff-email

# 7. Descomentar el bloque HTTPS en nginx/default.conf y relanzar
docker compose -f docker-compose.prod.yml up -d --build nginx

# 8. Migraciones y usuario administrador inicial
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
docker compose -f docker-compose.prod.yml exec backend python manage.py createadmin --username master --password CAMBIAR --nombre "Nombre Apellido"
```

#### Nota — build secuencial obligatorio (bug de Docker BuildKit con bake paralelo)

```bash
# Buildear de a una imagen para evitar el error "image already exists":
COMPOSE_BAKE=false docker compose -f docker-compose.prod.yml build nginx
COMPOSE_BAKE=false docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d db backend nginx certbot
```

#### Actualizaciones posteriores

```bash
git pull
COMPOSE_BAKE=false docker compose -f docker-compose.prod.yml build backend
docker compose -f docker-compose.prod.yml up -d --no-build backend
# Solo si hay migraciones nuevas:
docker compose -f docker-compose.prod.yml exec backend python manage.py migrate
```

#### Prueba local del stack de producción (sin Oracle, sin SSL)

`docker-compose.prod.local.yml` es un compose **autónomo** (no hereda del prod): la config de nginx está horneada en la imagen para evitar conflictos de volúmenes.

```bash
# Build (secuencial)
COMPOSE_BAKE=false docker compose -p clinica_prod -f docker-compose.prod.local.yml build backend
COMPOSE_BAKE=false docker compose -p clinica_prod -f docker-compose.prod.local.yml build nginx

# Levantar
docker compose -p clinica_prod -f docker-compose.prod.local.yml up -d db backend nginx

# Migraciones (primera vez o cuando hay nuevas)
docker exec clinica_backend_prod python manage.py migrate

# Acceder: http://localhost

# Bajar
docker compose -p clinica_prod -f docker-compose.prod.local.yml down
```

#### Comandos útiles de operación

```bash
# Ver logs en tiempo real
docker compose -f docker-compose.prod.yml logs -f backend
docker compose -f docker-compose.prod.yml logs -f nginx

# Reiniciar un servicio sin reconstruir
docker compose -f docker-compose.prod.yml restart backend

# Ver estado de los contenedores
docker compose -f docker-compose.prod.yml ps
```

**Dominio y SSL gratuitos:**
- [DuckDNS](https://www.duckdns.org) → subdominio gratuito apuntando a la IP pública de Oracle
- Certbot en `docker-compose.prod.yml` renueva los certificados automáticamente cada 12 horas

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
| `VentaFactCab` | cascade: elimina `MovimientoCajaBanco` vinculados, `VentaFactDet`, `VentaFactDetCobranza` y `CtaCobrar` — sin bloqueo | ✅ |
| `CuentaMcb` | movimientos activos en `MovimientoCajaBanco` | ✅ |
