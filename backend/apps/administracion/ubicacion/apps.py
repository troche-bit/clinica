from django.apps import AppConfig


class UbicacionConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    # Ruta actualizada luego de mover el módulo a administracion/
    name = "apps.administracion.ubicacion"
    # El app_label se mantiene como ubicacion para no romper las migraciones existentes
    label = "ubicacion"
    verbose_name = "Ubicación"
