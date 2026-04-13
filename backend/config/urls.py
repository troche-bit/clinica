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
    TokenObtainPairView,
    TokenRefreshView,
    TokenVerifyView,
)
 
# Configuración de URLs del proyecto
urlpatterns = [
    path('admin/', admin.site.urls),
 
    # Autenticación JWT
    path('api/auth/token/', TokenObtainPairView.as_view()),
    path('api/auth/token/refresh/', TokenRefreshView.as_view()),
    path('api/auth/token/verify/', TokenVerifyView.as_view()),
 
    # Módulos de la aplicación
    path('api/', include('apps.appointments.urls')),
    path('api/', include('apps.administracion.ubicacion.urls')),
    path('api/', include('apps.persona.urls')),
    path('api/', include('apps.principal.paciente_responsable.urls')),
    path('api/', include('apps.principal.paciente.urls')),
    # Módulos de administración (movidos a apps/administracion/)
    path('api/', include('apps.administracion.consultorio.urls')),
    path('api/', include('apps.administracion.especialidad.urls')),
    # Módulos principales
    path('api/', include('apps.principal.eventoclinico.urls')),
    path('api/', include('apps.principal.persona_rrhh.urls')),
    path('api/', include('apps.principal.horario_prestador.urls')),
    path('api/', include('apps.principal.agenda.urls')),
    # Módulos de mantenimiento del sistema
    path('api/', include('apps.mantenimiento.tipo_doc_dig.urls')),

    # OpenAPI / Swagger
    path('api/schema/', SpectacularAPIView.as_view(), name='schema'),
    path('api/docs/', SpectacularSwaggerView.as_view(url_name='schema')),
    path('api/redoc/', SpectacularRedocView.as_view(url_name='schema')),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
