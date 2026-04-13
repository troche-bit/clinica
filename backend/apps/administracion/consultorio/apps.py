from django.apps import AppConfig


class ConsultorioConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    # Ruta actualizada luego de mover el módulo a administracion/
    name = 'apps.administracion.consultorio'
    # El app_label se mantiene como 'consultorio' para no romper las migraciones existentes
    label = 'consultorio'
    verbose_name = 'Consultorio'
