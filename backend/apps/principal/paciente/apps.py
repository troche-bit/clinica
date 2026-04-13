from django.apps import AppConfig


class PacienteConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    # name actualizado tras mover a apps/principal/
    name = "apps.principal.paciente"
    # label preservado para no romper las migraciones existentes
    label = "paciente"
    verbose_name = "Paciente"
