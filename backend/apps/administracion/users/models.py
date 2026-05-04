from django.db import models
from django.conf import settings


class PerfilUsuario(models.Model):
    ROLES = [
        ('admin', 'Administrador'),
        ('medico', 'Médico'),
        ('recepcionista', 'Recepcionista'),
        ('secretaria_medico', 'Secretaria de médico'),
    ]

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='perfil',
    )
    rol = models.CharField(max_length=20, choices=ROLES, default='recepcionista')
    persona_rrhh = models.ForeignKey(
        'persona_rrhh.PersonaRRHH',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='usuario',
    )
    medicos_asignados = models.ManyToManyField(
        'persona_rrhh.PersonaRRHH',
        related_name='secretarias',
        blank=True,
        help_text='Médicos que esta secretaria asiste',
    )
    activo = models.BooleanField(default=True)

    @property
    def nombre_completo(self):
        return f"{self.user.first_name} {self.user.last_name}".strip() or self.user.username

    @property
    def iniciales(self):
        partes = self.nombre_completo.split()
        result = ''.join(p[0] for p in partes[:2]).upper()
        return result or self.user.username[:2].upper()

    class Meta:
        db_table = 'users_perfilusuario'
        verbose_name = 'Perfil de usuario'
        verbose_name_plural = 'Perfiles de usuario'

    def __str__(self):
        return f"{self.user.username} ({self.get_rol_display()})"
