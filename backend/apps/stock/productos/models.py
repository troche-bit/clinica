from django.db import models
from django.db.models import Q
from apps.core.models import BaseModel


class Grupo(BaseModel):

    descripcion = models.CharField(
        max_length=150,
        help_text='Nombre del grupo de productos/servicios',
    )
    activo = models.BooleanField(
        default=True,
        help_text='Indica si el grupo está activo',
    )

    class Meta:
        db_table            = 'grupo_producto'
        verbose_name        = 'Grupo'
        verbose_name_plural = 'Grupos'
        ordering            = ['descripcion']
        constraints         = [
            models.UniqueConstraint(
                fields=['descripcion'],
                condition=Q(is_deleted=False),
                name='unique_grupo_descripcion_activo',
            )
        ]

    def __str__(self):
        return self.descripcion


class ProductoServicio(BaseModel):

    IVA_10 = '10'
    IVA_5  = '5'
    EXENTA = 'exenta'

    IMPUESTO_CHOICES = [
        (IVA_10,  'IVA 10%'),
        (IVA_5,   'IVA 5%'),
        (EXENTA,  'Exenta'),
    ]

    descripcion = models.CharField(
        max_length=200,
        help_text='Nombre o descripción del producto/servicio',
    )
    grupo = models.ForeignKey(
        Grupo,
        on_delete=models.PROTECT,
        related_name='productos',
        help_text='Grupo al que pertenece el producto/servicio',
    )
    impuesto = models.CharField(
        max_length=10,
        choices=IMPUESTO_CHOICES,
        default=IVA_10,
        help_text='Tipo de impuesto aplicable',
    )
    activo = models.BooleanField(
        default=True,
        help_text='Indica si el producto/servicio está activo',
    )

    class Meta:
        db_table            = 'producto_servicio'
        verbose_name        = 'Producto/Servicio'
        verbose_name_plural = 'Productos/Servicios'
        ordering            = ['descripcion']

    def __str__(self):
        return f'{self.descripcion} ({self.grupo.descripcion})'
