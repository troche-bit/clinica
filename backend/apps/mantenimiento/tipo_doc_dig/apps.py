from django.apps import AppConfig


class TipoDocDigConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    # Preserva el app_label para las migraciones
    name = "apps.mantenimiento.tipo_doc_dig"
    label = "tipo_doc_dig"
    verbose_name = "Tipo de Documento Digitalizado"
