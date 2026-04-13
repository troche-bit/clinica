from django.db import models
from django.db.models import Q
from apps.core.models import BaseModel
from apps.principal.horario_prestador.models import HorarioPrestador
from apps.principal.paciente.models import Paciente


class Agenda(BaseModel):

    class Estado(models.TextChoices):
        DISPONIBLE = 'disponible', 'Disponible'
        OCUPADO    = 'ocupado',    'Ocupado'
        INACTIVO   = 'inactivo',   'Inactivo'
        CANCELADO  = 'cancelado',  'Cancelado'
        REALIZADO  = 'realizado',  'Realizado'

    horario_prestador = models.ForeignKey(
        HorarioPrestador,
        on_delete=models.PROTECT,
        related_name='turnos',
        help_text='Horario del prestador al que pertenece este turno',
    )
    paciente = models.ForeignKey(
        Paciente,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='turnos',
        help_text='Paciente asignado (null si el turno está disponible)',
    )
    fecha      = models.DateField(help_text='Fecha del turno')
    hora_desde = models.TimeField(help_text='Hora de inicio del turno')
    hora_hasta = models.TimeField(help_text='Hora de fin del turno')
    estado     = models.CharField(
        max_length=12,
        choices=Estado.choices,
        default=Estado.DISPONIBLE,
        help_text='Estado actual del turno',
    )
    observacion = models.TextField(
        null=True, blank=True,
        help_text='Observaciones del turno',
    )

    class Meta:
        db_table            = 'agenda'
        verbose_name        = 'Agenda'
        verbose_name_plural = 'Agenda'
        ordering            = ['fecha', 'hora_desde']
        constraints         = [
            models.UniqueConstraint(
                fields=['horario_prestador', 'fecha', 'hora_desde'],
                name='unique_agenda_turno',
                condition=Q(is_deleted=False),
            )
        ]

    def __str__(self):
        return f'{self.fecha} {self.hora_desde} — {self.horario_prestador.persona_rrhh}'
