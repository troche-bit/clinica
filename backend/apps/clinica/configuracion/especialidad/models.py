from django.db import models
from django.db.models import UniqueConstraint, Q, Index
from django.db.models.functions import Lower
from apps.core.models import BaseModel


class Especialidad(BaseModel):

    id = models.AutoField(primary_key=True)

    descripcion = models.CharField(
        max_length=150,
        blank=False,
        null=False,
        help_text='Descripción de la especialidad'
    )

    class Meta:
        db_table = 'especialidad'
        verbose_name = 'Especialidad'
        verbose_name_plural = 'Especialidades'
        ordering = ['descripcion']
        indexes = [
            Index(fields=['descripcion', 'is_deleted'], name='idx_esp_desc_is_deleted')
        ]
        constraints = [
            UniqueConstraint(
                Lower('descripcion'),
                name='unique_especialidad_descripcion',
                condition=Q(is_deleted=False)
            )
        ]

    def __str__(self):
        return f'{self.id} - {self.descripcion}'
