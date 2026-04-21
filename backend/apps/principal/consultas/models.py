from django.db import models
from apps.core.models import BaseModel
from apps.principal.agenda.models import Agenda
from apps.principal.eventoclinico.models import EventoClinico


class Consulta(BaseModel):

    class Estado(models.TextChoices):
        EN_ESPERA   = 'en_espera',   'En espera'
        EN_CONSULTA = 'en_consulta', 'En consulta'
        FINALIZADA  = 'finalizada',  'Finalizada'

    agenda = models.ForeignKey(
        Agenda,
        on_delete=models.PROTECT,
        related_name='consultas',
        help_text='Turno de agenda asociado a esta consulta',
    )
    hora_desde = models.TimeField(
        null=True, blank=True,
        help_text='Hora de inicio efectivo de la consulta',
    )
    hora_hasta = models.TimeField(
        null=True, blank=True,
        help_text='Hora de fin efectivo de la consulta',
    )
    estado = models.CharField(
        max_length=12,
        choices=Estado.choices,
        default=Estado.EN_ESPERA,
        help_text='Estado actual de la consulta',
    )
    evento_clinico = models.ForeignKey(
        EventoClinico,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='consultas',
        help_text='Tipo de evento clínico de esta consulta',
    )
    motivo_consulta = models.TextField(
        null=True, blank=True,
        help_text='Motivo de consulta referido por el paciente',
    )
    diagnostico = models.TextField(
        null=True, blank=True,
        help_text='Diagnóstico del médico',
    )
    tratamiento = models.TextField(
        null=True, blank=True,
        help_text='Tratamiento indicado',
    )
    indicaciones = models.TextField(
        null=True, blank=True,
        help_text='Indicaciones y recomendaciones',
    )
    proxima_cita = models.DateField(
        null=True, blank=True,
        help_text='Fecha sugerida para la próxima cita',
    )

    class Meta:
        db_table = 'consulta'
        verbose_name = 'Consulta'
        verbose_name_plural = 'Consultas'
        ordering = ['-agenda__fecha', 'hora_desde']

    def __str__(self):
        return f'Consulta {self.id} — {self.agenda} [{self.estado}]'
