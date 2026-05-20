from django.db import models
from django.db.models import Q
from apps.core.models import BaseModel
from apps.clinica.paciente.models import Paciente
from apps.clinica.consultas.models import Consulta
from apps.clinica.agenda.models import Agenda


class ConfiguracionNotificacion(models.Model):
    email_remitente      = models.EmailField(default='noreply@clinicalichi.com')
    nombre_remitente     = models.CharField(max_length=100, default='Clínica Lichi')
    habilitado           = models.BooleanField(default=False)
    auto_recordatorio    = models.BooleanField(default=False)
    horas_anticipacion   = models.PositiveIntegerField(default=24)
    horas_anticipacion_2 = models.PositiveIntegerField(null=True, blank=True)
    auto_confirmacion    = models.BooleanField(default=True)
    auto_cancelacion     = models.BooleanField(default=False)

    class Meta:
        db_table = 'notificacion_configuracion'

    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj

    def __str__(self):
        return 'Configuración de notificaciones'


class PlantillaNotificacion(BaseModel):
    class Tipo(models.TextChoices):
        RECORDATORIO  = 'recordatorio',  'Recordatorio de cita'
        CONFIRMACION  = 'confirmacion',  'Confirmación de reserva'
        CANCELACION   = 'cancelacion',   'Cancelación'
        POST_CONSULTA = 'post_consulta', 'Post consulta'

    tipo   = models.CharField(max_length=15, choices=Tipo.choices)
    asunto = models.CharField(max_length=200)
    cuerpo = models.TextField(
        help_text='Variables disponibles: {nombre}, {fecha}, {hora}, {medico}, {especialidad}, {indicaciones}'
    )
    activa = models.BooleanField(default=True)

    class Meta:
        db_table            = 'notificacion_plantilla'
        verbose_name        = 'Plantilla de notificación'
        verbose_name_plural = 'Plantillas de notificación'
        constraints = [
            models.UniqueConstraint(
                fields=['tipo'],
                condition=Q(is_deleted=False),
                name='unique_plantilla_tipo_activa',
            )
        ]

    def __str__(self):
        return self.get_tipo_display()


class Notificacion(BaseModel):

    class Tipo(models.TextChoices):
        RECORDATORIO_CITA    = 'recordatorio_cita',    'Recordatorio de cita'
        CONFIRMACION_RESERVA = 'confirmacion_reserva', 'Confirmación de reserva'
        CANCELACION          = 'cancelacion',          'Cancelación'
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
