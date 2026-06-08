from django.contrib.auth.models import User
from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Crea un superusuario con rol admin en PerfilUsuario'

    def add_arguments(self, parser):
        parser.add_argument('--username', required=True)
        parser.add_argument('--password', required=True)
        parser.add_argument('--nombre', default='Administrador')

    def handle(self, *args, **options):
        from apps.administracion.users.models import PerfilUsuario

        username = options['username']
        password = options['password']
        nombre   = options['nombre']

        if User.objects.filter(username=username).exists():
            self.stdout.write(self.style.WARNING(f'El usuario "{username}" ya existe.'))
            return

        with transaction.atomic():
            user = User.objects.create_superuser(username=username, password=password)
            user.first_name = nombre.split()[0]
            user.last_name  = ' '.join(nombre.split()[1:]) if len(nombre.split()) > 1 else ''
            user.save()
            PerfilUsuario.objects.create(user=user, rol='admin', activo=True)

        self.stdout.write(self.style.SUCCESS(f'Admin "{username}" creado correctamente.'))
