from django.apps import AppConfig


class EstadoCuentaConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.finanzas.estadocuenta'
    label = 'estadocuenta'
    verbose_name = 'Estado de Cuenta'
