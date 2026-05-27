from django.db import models
from django.db.models import Q
from django.core.exceptions import ValidationError
from django.utils import timezone
from apps.core.models import BaseModel


class Timbrado(BaseModel):

    class Meta:
        db_table            = 'timbrado'
        verbose_name        = 'Timbrado'
        verbose_name_plural = 'Timbrados'
        ordering            = ['-inicio_vigencia']
        constraints         = [
            models.UniqueConstraint(
                fields=[
                    'nro_timbrado', 'inicio_vigencia', 'fin_vigencia',
                    'punto_sucursal', 'punto_expedicion', 'nro_desde', 'nro_hasta',
                ],
                name='unique_timbrado_combinado',
                condition=Q(is_deleted=False),
            )
        ]

    nro_timbrado = models.CharField(
        max_length=8,
        help_text='Número de timbrado (hasta 8 dígitos numéricos)',
    )
    inicio_vigencia = models.DateField(
        help_text='Fecha de inicio de vigencia del timbrado',
    )
    fin_vigencia = models.DateField(
        help_text='Fecha de fin de vigencia del timbrado',
    )
    punto_sucursal = models.CharField(
        max_length=3,
        help_text='Punto de sucursal (exactamente 3 dígitos, ej: 001)',
    )
    punto_expedicion = models.CharField(
        max_length=3,
        help_text='Punto de expedición (exactamente 3 dígitos, ej: 001)',
    )
    nro_desde = models.PositiveIntegerField(
        help_text='Número de comprobante inicial',
    )
    nro_hasta = models.PositiveIntegerField(
        help_text='Número de comprobante final',
    )
    autoimpresor = models.BooleanField(
        default=False,
        help_text='True si es autoimpresor (impresora fiscal), False si es talonario',
    )
    nro_habilitacion = models.CharField(
        max_length=50,
        blank=True,
        help_text='Número de habilitación SET (requerido para autoimpresor)',
    )

    @property
    def vigente(self):
        hoy = timezone.localtime().date()
        return self.inicio_vigencia <= hoy <= self.fin_vigencia

    @property
    def tipo(self):
        return 'Autoimpresor' if self.autoimpresor else 'Talonario'

    def clean(self):
        errors = {}

        if self.nro_timbrado and not self.nro_timbrado.isdigit():
            errors['nro_timbrado'] = 'El número de timbrado debe contener solo dígitos.'

        if self.punto_sucursal and (not self.punto_sucursal.isdigit() or len(self.punto_sucursal) != 3):
            errors['punto_sucursal'] = 'Debe ser exactamente 3 dígitos numéricos (ej: 001).'

        if self.punto_expedicion and (not self.punto_expedicion.isdigit() or len(self.punto_expedicion) != 3):
            errors['punto_expedicion'] = 'Debe ser exactamente 3 dígitos numéricos (ej: 001).'

        if self.autoimpresor and not self.nro_habilitacion:
            errors['nro_habilitacion'] = 'Requerido para timbrado autoimpresor.'

        if self.inicio_vigencia and self.fin_vigencia:
            if self.fin_vigencia <= self.inicio_vigencia:
                errors['fin_vigencia'] = 'La fecha de fin debe ser posterior a la de inicio.'

        if self.nro_desde is not None and self.nro_hasta is not None:
            if self.nro_hasta <= self.nro_desde:
                errors['nro_hasta'] = 'El número hasta debe ser mayor al número desde.'

        if errors:
            raise ValidationError(errors)

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    def __str__(self):
        return f'Timbrado {self.nro_timbrado} ({self.tipo})'
