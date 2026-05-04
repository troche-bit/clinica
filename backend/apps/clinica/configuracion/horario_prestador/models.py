from django.db import models
from django.db.models import Q
from apps.core.models import BaseModel
from apps.administracion.persona_rrhh.models import PersonaRRHH
from apps.mantenimiento.diasemana.models import DiaSemana
from apps.clinica.configuracion.especialidad.models import Especialidad

INTERVALOS = [(15, '15 min'), (20, '20 min'), (30, '30 min'), (45, '45 min'), (60, '60 min')]


class HorarioPrestador(BaseModel):

    class Estado(models.TextChoices):
        ACTIVO   = 'activo',   'Activo'
        INACTIVO = 'inactivo', 'Inactivo'

    persona_rrhh = models.ForeignKey(
        PersonaRRHH,
        on_delete=models.PROTECT,
        related_name='horarios',
        help_text='Prestador al que pertenece el horario',
    )
    consultorio = models.ForeignKey(
        'consultorio.Consultorio',
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='horarios',
        help_text='Consultorio donde se atiende',
    )
    dia_semana = models.ForeignKey(
        DiaSemana,
        on_delete=models.PROTECT,
        related_name='horarios',
        help_text='Día de la semana (se auto-asigna si es excepción)',
    )
    hora_desde = models.TimeField(help_text='Hora de inicio de atención')
    hora_hasta = models.TimeField(help_text='Hora de fin de atención')
    intervalo  = models.PositiveIntegerField(
        choices=INTERVALOS,
        default=30,
        help_text='Duración de cada turno en minutos',
    )
    especialidades = models.ManyToManyField(
        Especialidad,
        related_name='horarios',
        blank=True,
        help_text='Especialidades que se atienden en este horario',
    )
    estado = models.CharField(
        max_length=10,
        choices=Estado.choices,
        default=Estado.ACTIVO,
    )
    excepcion = models.BooleanField(
        default=False,
        help_text='Si True, el horario aplica solo en la fecha puntual indicada',
    )
    fecha_excepcion = models.DateField(
        blank=True,
        null=True,
        help_text='Fecha puntual (obligatoria si excepcion=True)',
    )

    class Meta:
        db_table            = 'horario_prestador'
        verbose_name        = 'Horario Prestador'
        verbose_name_plural = 'Horarios Prestador'
        ordering            = ['persona_rrhh', 'dia_semana__id', 'hora_desde']
        constraints         = [
            models.UniqueConstraint(
                fields=['persona_rrhh', 'dia_semana', 'hora_desde'],
                name='unique_horario_prestador',
                condition=Q(is_deleted=False, excepcion=False),
            )
        ]

    def __str__(self):
        return f'{self.persona_rrhh} — {self.dia_semana} {self.hora_desde}-{self.hora_hasta}'
