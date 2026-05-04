from django.db import models
from django.db.models import UniqueConstraint, Q, Index
from django.db.models.functions import Lower
from apps.core.models import BaseModel


class Consultorio(BaseModel):

    id = models.AutoField(primary_key=True)

    nro_consultorio = models.CharField(
        max_length=50,
        blank=False,
        null=False,
        help_text='Nro del consultorio',
    )

    descripcion = models.CharField(
        max_length=150,
        blank=True,
        null=True,
        help_text='Descripción del consultorio',
    )

    class Meta:
        db_table            = 'consultorio'
        verbose_name        = 'Consultorio'
        verbose_name_plural = 'Consultorios'
        ordering            = ['nro_consultorio']
        indexes             = [
            Index(fields=['nro_consultorio', 'is_deleted'], name='idx_consultorio_nro_is_deleted')
        ]
        constraints = [
            UniqueConstraint(
                Lower('nro_consultorio'),
                name='unique_nro_consultorio',
                condition=Q(is_deleted=False),
            )
        ]

    def __str__(self):
        return self.nro_consultorio
