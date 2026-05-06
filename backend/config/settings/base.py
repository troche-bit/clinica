from decouple import config
from datetime import timedelta
from pathlib import Path
 
BASE_DIR = Path(__file__).resolve().parent.parent.parent
SECRET_KEY = config('SECRET_KEY')
DEBUG = config('DEBUG', default=False, cast=bool)
ALLOWED_HOSTS = config('ALLOWED_HOSTS', default='').split(',')
 
INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',
    # Terceros
    'rest_framework',
    'rest_framework_simplejwt',
    'corsheaders',
    'drf_spectacular',
    'rest_framework_simplejwt.token_blacklist',
    # Propias
    'apps.administracion.users',
    'apps.mantenimiento.ubicacion',
    'apps.administracion.persona',
    # paciente_responsable antes que paciente por la dependencia FK
    'apps.clinica.paciente_responsable',
    'apps.clinica.paciente',
    'apps.mantenimiento.diasemana',
    'apps.forma_pago',
    # Módulos de administración agrupados bajo apps.administracion/
    'apps.administracion.auditoria',
    
    # Módulos principales
    'apps.administracion.persona_rrhh',
    'apps.clinica.configuracion.horario_prestador',
    'apps.clinica.agenda',
    # Módulos clínicos
    'apps.clinica.configuracion.consultorio',
    'apps.clinica.configuracion.especialidad',
    'apps.clinica.configuracion.eventoclinico',
    'apps.clinica.consultas',
    'apps.clinica.configuracion.documentos',
    'apps.mantenimiento.notificaciones',
    # Módulos de mantenimiento del sistema
    'apps.finanzas.caja_banco',
    'apps.facturacion.ventas',
    'apps.finanzas.estadocuenta',
    'apps.finanzas.cobranzas',
    'apps.finanzas.pago_prestador',
    # Módulos de mantenimiento del sistema
    'apps.mantenimiento.tipo_doc_dig',
    'apps.facturacion.configuracion.timbrado',
    'apps.stock.productos',
]
 
MIDDLEWARE = [
    'corsheaders.middleware.CorsMiddleware',  # PRIMERO
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]
 
ROOT_URLCONF = 'config.urls'
 
DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.postgresql',
        'NAME': config('POSTGRES_DB'),
        'USER': config('POSTGRES_USER'),
        'PASSWORD': config('POSTGRES_PASSWORD'),
        'HOST': config('POSTGRES_HOST'),
        'PORT': config('POSTGRES_PORT', cast=int),
    }
}
 
# ─── DRF ──────────────────────────────────────────────────
REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': [
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ],
    'DEFAULT_PERMISSION_CLASSES': [
        'rest_framework.permissions.IsAuthenticated',
    ],
    'DEFAULT_SCHEMA_CLASS': 'drf_spectacular.openapi.AutoSchema',
    # Paginación global
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 20,
}
 
# ─── JWT ──────────────────────────────────────────────────
SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(
        minutes=config('JWT_ACCESS_TOKEN_LIFETIME_MINUTES', cast=int, default=60)
    ),
    'REFRESH_TOKEN_LIFETIME': timedelta(
        days=config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', cast=int, default=7)
    ),
    'ROTATE_REFRESH_TOKENS': True,
    'BLACKLIST_AFTER_ROTATION': True,
}
 
# ─── CORS ─────────────────────────────────────────────────
CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='').split(',')
 
# ─── SWAGGER / OpenAPI ────────────────────────────────────
SPECTACULAR_SETTINGS = {
    'TITLE': 'Clínica API',
    'DESCRIPTION': 'Sistema de gestión clínica médiana',
    'VERSION': '1.0.0',
    'SERVE_INCLUDE_SCHEMA': False,
}
 
# ─── ARCHIVOS MEDIA ───────────────────────────────────────
MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'
 
DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'
LANGUAGE_CODE = 'es-py'
TIME_ZONE = 'America/Asuncion'
USE_I18N = True
USE_TZ = True
