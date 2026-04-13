from django.apps import AppConfig


class PacienteResponsableConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.principal.paciente_responsable"
    # label único para este app en el registro de Django
    label = "paciente_responsable"
    verbose_name = "Paciente Responsable"
