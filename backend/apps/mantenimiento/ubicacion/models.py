from django.db import models
from django.db.models import UniqueConstraint, Q, Index
from django.db.models.functions import Lower
from apps.core.models import BaseModel


class Pais(BaseModel):

    id = models.AutoField(primary_key=True)

    descripcion = models.CharField(
        max_length=200,
        blank=False,
        null=False,
        help_text='Descripción del país'
    )

    class Meta:
        db_table = 'pais'
        verbose_name = 'País'
        verbose_name_plural = 'Países'
        ordering = ['descripcion']
        indexes = [
            Index(fields=['descripcion', 'is_deleted'], name='idx_pais_desc_is_deleted')
        ]
        constraints = [
            UniqueConstraint(
                Lower('descripcion'),
                name='unique_pais_descripcion',
                condition=Q(is_deleted=False)
            )
        ]

    def __str__(self):
        return f'{self.id} - {self.descripcion}'


class Departamento(BaseModel):

    id = models.AutoField(primary_key=True)
    pais = models.ForeignKey(
        Pais,
        on_delete=models.PROTECT,
        related_name='departamentos'
    )
    descripcion = models.CharField(
        max_length=200,
        blank=False,
        null=False,
        help_text='Descripción del departamento'
    )

    class Meta:
        db_table = 'departamento'
        verbose_name = 'Departamento'
        verbose_name_plural = 'Departamentos'
        ordering = ['descripcion']
        indexes = [
            Index(fields=['descripcion', 'is_deleted'], name='idx_dep_desc_is_deleted')
        ]
        constraints = [
            UniqueConstraint(
                Lower('descripcion'),
                'pais',
                name='unique_departamento_descripcion_pais',
                condition=Q(is_deleted=False)
            )
        ]

    def __str__(self):
        return f'{self.descripcion} — {self.pais}'


class Ciudad(BaseModel):

    id = models.AutoField(primary_key=True)
    departamento = models.ForeignKey(
        Departamento,
        on_delete=models.PROTECT,
        related_name='ciudades'
    )
    descripcion = models.CharField(
        max_length=200,
        blank=False,
        null=False,
        help_text='Descripción de la ciudad'
    )

    class Meta:
        db_table = 'ciudad'
        verbose_name = 'Ciudad'
        verbose_name_plural = 'Ciudades'
        ordering = ['descripcion']
        indexes = [
            Index(fields=['descripcion', 'is_deleted'], name='idx_ciu_desc_is_deleted')
        ]
        constraints = [
            UniqueConstraint(
                Lower('descripcion'),
                'departamento',
                name='unique_ciudad_descripcion_departamento',
                condition=Q(is_deleted=False)
            )
        ]

    def __str__(self):
        return f'{self.descripcion} — {self.departamento} - {self.departamento.pais}'
