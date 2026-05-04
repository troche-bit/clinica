from django.apps import AppConfig


class UsersConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'apps.administracion.users'
    label = 'users'
    verbose_name = 'Usuarios'

    def ready(self):
        import apps.administracion.users.signals  # noqa
