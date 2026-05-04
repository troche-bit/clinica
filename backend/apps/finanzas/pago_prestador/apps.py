from django.apps import AppConfig


class PagoPrestadorConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.finanzas.pago_prestador'
    label = 'pago_prestador'
    verbose_name = 'Pago a Prestadores'
