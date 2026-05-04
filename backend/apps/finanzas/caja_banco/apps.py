from django.apps import AppConfig


class CajaBancoConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.finanzas.caja_banco'
    label = 'caja_banco'
    verbose_name = 'Cuentas y Movimientos de Caja/Banco'
