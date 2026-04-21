from django.db import models
from apps.core.models import BaseModel
from apps.principal.paciente.models import Paciente
from apps.principal.consultas.models import Consulta
from apps.principal.agenda.models import Agenda


class Notificacion(BaseModel):

    class Tipo(models.TextChoices):
        RECORDATORIO_CITA    = 'recordatorio_cita',    'Recordatorio de cita'
        CONFIRMACION_RESERVA = 'confirmacion_reserva', 'Confirmación de reserva'
        INDICACIONES         = 'indicaciones',         'Indicaciones'
        OTRO                 = 'otro',                 'Otro'

    class Canal(models.TextChoices):
        EMAIL    = 'email',    'Email'
        WHATSAPP = 'whatsapp', 'WhatsApp'
        MANUAL   = 'manual',   'Manual'

    class Estado(models.TextChoices):
        ENVIADO   = 'enviado',   'Enviado'
        FALLIDO   = 'fallido',   'Fallido'
        PENDIENTE = 'pendiente', 'Pendiente'

    paciente     = models.ForeignKey(
        Paciente,
        on_delete=models.PROTECT,
        related_name='notificaciones',
        help_text='Paciente destinatario de la notificación',
    )
    consulta     = models.ForeignKey(
        Consulta,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notificaciones',
        help_text='Consulta relacionada (opcional)',
    )
    agenda       = models.ForeignKey(
        Agenda,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='notificaciones',
        help_text='Turno de agenda relacionado (opcional)',
    )
    tipo         = models.CharField(max_length=25, choices=Tipo.choices)
    canal        = models.CharField(max_length=10, choices=Canal.choices)
    estado       = models.CharField(
        max_length=10, choices=Estado.choices, default=Estado.PENDIENTE,
    )
    mensaje      = models.TextField(help_text='Texto enviado al paciente')
    destinatario = models.CharField(
        max_length=254,
        help_text='Email o teléfono al momento del envío',
    )
    fecha_envio  = models.DateTimeField(
        null=True, blank=True,
        help_text='Fecha y hora efectiva del envío',
    )

    class Meta:
        db_table            = 'notificacion'
        verbose_name        = 'Notificación'
        verbose_name_plural = 'Notificaciones'
        ordering            = ['-fecha_creacion']

    def __str__(self):
        return f'{self.get_tipo_display()} → {self.paciente} ({self.estado})'
