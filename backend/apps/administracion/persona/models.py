from django.db import models
from django.db.models import UniqueConstraint, Q, Index
from django.db.models.functions import Lower
from apps.mantenimiento.ubicacion.models import Pais, Departamento, Ciudad
from apps.core.models import BaseModel


class TipoDocumento(BaseModel):
    descripcion = models.CharField(max_length=200, blank=False, null=False)

    class Meta:
        db_table = 'tipo_documento'
        verbose_name = 'Tipo de Documento'
        verbose_name_plural = 'Tipos de Documentos'
        ordering = ['descripcion']
        constraints = [
            UniqueConstraint(
                Lower('descripcion'),
                name='unique_tipo_documento_descripcion',
                condition=Q(is_deleted=False)
            )
        ]
        indexes = [
            Index(Lower('descripcion'), name='idx_tipo_doc_descripcion')
        ]

    def __str__(self):
        return self.descripcion


class Persona(BaseModel):
    tipo_documento = models.ForeignKey(
        TipoDocumento,
        on_delete=models.PROTECT,
        related_name='personas',
        blank=False,
        null=False,
    )
    nro_documento = models.CharField(max_length=50, blank=False, null=False)
    ruc_dv = models.IntegerField(blank=True, null=True)
    razon_social = models.CharField(max_length=400, blank=False, null=False)
    fecha_nacimiento = models.DateField(blank=True, null=True)
    telefono = models.CharField(max_length=20, blank=True, null=True)
    correo_electronico = models.EmailField(max_length=254, blank=True, null=True)
    pais = models.ForeignKey(
        Pais,
        on_delete=models.PROTECT,
        related_name='personas',
        blank=True,
        null=True,
    )
    departamento = models.ForeignKey(
        Departamento,
        on_delete=models.PROTECT,
        related_name='personas',
        blank=True,
        null=True,
    )
    ciudad = models.ForeignKey(
        Ciudad,
        on_delete=models.PROTECT,
        related_name='personas',
        blank=True,
        null=True,
    )
    direccion = models.CharField(max_length=200, blank=True, null=True)

    class Meta:
        db_table = 'persona'
        verbose_name = 'Persona'
        verbose_name_plural = 'Personas'
        ordering = ['nro_documento']
        constraints = [
            UniqueConstraint(
                Lower('nro_documento'),
                name='unique_persona_nro_documento',
                condition=Q(is_deleted=False)
            )
        ]
        indexes = [
            Index(Lower('nro_documento'), 'razon_social', name='idx_per_nro_doc_tip_doc')
        ]

    def __str__(self):
        return f'{self.razon_social} — {self.nro_documento}'
