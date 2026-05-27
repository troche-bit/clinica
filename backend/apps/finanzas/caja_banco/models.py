from datetime import date as date_type
from django.db import models
from django.db.models.functions import Lower
from apps.core.models import BaseModel


class CuentaMcb(BaseModel):
    descripcion = models.CharField(max_length=150)

    class Meta:
        db_table            = 'cuenta_mcb'
        verbose_name        = 'Cuenta Caja/Banco'
        verbose_name_plural = 'Cuentas Caja/Banco'
        ordering            = ['descripcion']
        constraints         = [
            models.UniqueConstraint(
                Lower('descripcion'),
                condition=models.Q(is_deleted=False),
                name='unique_cuenta_mcb_descripcion_lower',
            )
        ]

    def __str__(self):
        return self.descripcion


class MovimientoCajaBanco(BaseModel):
    cta = models.ForeignKey(
        CuentaMcb,
        on_delete=models.PROTECT,
        related_name='movimientos',
        verbose_name='Cuenta',
    )

    vfdc_id  = models.IntegerField(null=True, blank=True)
    vrc_id   = models.IntegerField(null=True, blank=True)
    ppdc_id  = models.IntegerField(null=True, blank=True)

    fecha           = models.DateField(default=date_type.today)
    nro_comprobante = models.CharField(max_length=50, null=True, blank=True)
    monto_ingreso = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    monto_egreso  = models.DecimalField(max_digits=18, decimal_places=2, default=0)
    vuelto        = models.DecimalField(max_digits=18, decimal_places=2, default=0)

    @property
    def tipo(self):
        if self.monto_ingreso > 0:
            return 'ingreso'
        if self.monto_egreso > 0:
            return 'egreso'
        return 'sin_movimiento'

    class Meta:
        db_table            = 'movimiento_caja_banco'
        verbose_name        = 'Movimiento Caja/Banco'
        verbose_name_plural = 'Movimientos Caja/Banco'
        ordering            = ['-fecha', '-fecha_creacion']

    def __str__(self):
        return f'{self.cta.descripcion} | {self.fecha} | {self.tipo}'
