from datetime import date
from django.db import models
from django.db.models import Q
from django.core.exceptions import ValidationError
from apps.core.models import BaseModel


class Timbrado(BaseModel):

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
        help_text='Punto de sucursal (ej: 001)',
    )
    punto_expedicion = models.CharField(
        max_length=3,
        help_text='Punto de expedición (ej: 001)',
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
        help_text='Número de habilitación SET (solo talonario)',
    )

    # ── Propiedades calculadas ────────────────────────────────────────────────

    @property
    def vigente(self):
        return self.inicio_vigencia <= date.today() <= self.fin_vigencia

    @property
    def tipo(self):
        return 'Autoimpresor' if self.autoimpresor else 'Talonario'

    # ── Validaciones ──────────────────────────────────────────────────────────

    def clean(self):
        errors = {}

        if self.nro_timbrado and not self.nro_timbrado.isdigit():
            errors['nro_timbrado'] = 'El número de timbrado debe contener solo dígitos.'

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

    class Meta:
        db_table            = 'timbrado'
        verbose_name        = 'Timbrado'
        verbose_name_plural = 'Timbrados'
        ordering            = ['-inicio_vigencia']
        constraints         = [
            models.UniqueConstraint(
                fields=['nro_timbrado'],
                name='unique_timbrado_nro',
                condition=Q(is_deleted=False),
            )
        ]

    def __str__(self):
        return f'Timbrado {self.nro_timbrado} ({self.tipo})'
