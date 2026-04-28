from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
    SpectacularRedocView,
)
from rest_framework_simplejwt.views import (
    TokenRefreshView,
    TokenVerifyView,
)
from apps.users.views import CustomTokenObtainPairView

# Configuración de URLs del proyecto
urlpatterns = [
    path('admin/', admin.site.urls),

    # Autenticación JWT
    path('api/auth/token/', CustomTokenObtainPairView.as_view()),
    path('api/auth/token/refresh/', TokenRefreshView.as_view()),
    path('api/auth/token/verify/', TokenVerifyView.as_view()),
 
    # Módulos de la aplicación
    path('api/', include('apps.users.urls')),
    path('api/', include('apps.appointments.urls')),
    path('api/', include('apps.mantenimiento.ubicacion.urls')),
    path('api/', include('apps.administracion.persona.urls')),
    path('api/', include('apps.clinica.paciente_responsable.urls')),
    path('api/', include('apps.clinica.paciente.urls')),
    # Módulos de administración
    path('api/', include('apps.administracion.auditoria.urls')),
    # Módulos principales
    path('api/', include('apps.clinica.configuracion.eventoclinico.urls')),
    path('api/', include('apps.administracion.persona_rrhh.urls')),
    path('api/', include('apps.clinica.configuracion.horario_prestador.urls')),
    path('api/', include('apps.principal.agenda.urls')),
    # Módulos clínicos
    path('api/', include('apps.clinica.configuracion.consultorio.urls')),
    path('api/', include('apps.clinica.configuracion.especialidad.urls')),
    path('api/', include('apps.principal.consultas.urls')),
    path('api/', include('apps.principal.documentos.urls')),
    # Módulos de notificaciones
    path('api/', include('apps.notificaciones.urls')),
    # Módulos de mantenimiento del sistema
    path('api/', include('apps.forma_pago.urls')),
    path('api/', include('apps.principal.caja_banco.urls')),
    path('api/', include('apps.principal.facturacion.urls')),
    path('api/', include('apps.principal.cobranzas.urls')),
    path('api/', include('apps.principal.pago_prestador.urls')),
    # Módulos de mantenimiento del sistema
    path('api/', include('apps.mantenimiento.tipo_doc_dig.urls')),
    path('api/', include('apps.mantenimiento.timbrado.urls')),
    path('api/', include('apps.mantenimiento.productos.urls')),

    # OpenAPI / Swagger
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema')),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
