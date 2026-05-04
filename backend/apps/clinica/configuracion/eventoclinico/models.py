from django.db import models
from django.db.models import UniqueConstraint, Q, Index
from django.db.models.functions import Lower
from apps.core.models import BaseModel


class EventoClinico(BaseModel):

    id = models.AutoField(primary_key=True)

    tipo_evento = models.CharField(
        max_length=50,
        blank=False,
        null=False,
        help_text='Tipo de evento clínico (por ejemplo, consulta, cirugía, etc.)'
    )

    class Meta:
        db_table = 'evento_clinico'
        verbose_name = 'Evento Clínico'
        verbose_name_plural = 'Eventos Clínicos'
        ordering = ['tipo_evento']
        indexes = [
            Index(fields=['tipo_evento', 'is_deleted'], name='idx_evento_clinico_is_deleted')
        ]
        constraints = [
            UniqueConstraint(
                Lower('tipo_evento'),
                name='unique_tipo_evento',
                condition=Q(is_deleted=False)
            )
        ]

    def __str__(self):
        return self.tipo_evento
