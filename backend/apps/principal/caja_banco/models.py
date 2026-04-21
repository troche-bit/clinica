from datetime import date as date_type
from django.db import models
from apps.core.models import BaseModel


class CuentaMcb(BaseModel):
    """Cuenta de caja o banco."""

    descripcion = models.CharField(
        max_length=150,
        help_text='Nombre de la cuenta (caja, banco, etc.)',
    )

    class Meta:
        db_table            = 'cuenta_mcb'
        verbose_name        = 'Cuenta Caja/Banco'
        verbose_name_plural = 'Cuentas Caja/Banco'
        ordering            = ['descripcion']
        constraints         = [
            models.UniqueConstraint(
                fields=['descripcion'],
                condition=models.Q(is_deleted=False),
                name='unique_cuenta_mcb_descripcion',
            )
        ]

    def __str__(self):
        return self.descripcion


class MovimientoCajaBanco(BaseModel):
    """Movimiento de ingreso o egreso de una cuenta."""

    cta = models.ForeignKey(
        CuentaMcb,
        on_delete=models.PROTECT,
        related_name='movimientos',
        verbose_name='Cuenta',
    )

    # FKs pendientes — se convertirán a FK real cuando se implementen los módulos
    vfdc_id  = models.IntegerField(null=True, blank=True, help_text='TODO: FK → VentaFactCab')
    vrc_id   = models.IntegerField(null=True, blank=True, help_text='TODO: FK → ValorRecibidoCob')
    ppdc_id  = models.IntegerField(null=True, blank=True, help_text='TODO: FK → PagoPrestadorDetCobranza')

    fecha = models.DateField(
        default=date_type.today,
        help_text='Fecha del movimiento',
    )
    voucher = models.CharField(
        max_length=50,
        null=True, blank=True,
        help_text='Número de voucher o referencia',
    )
    monto_ingreso = models.DecimalField(
        max_digits=18, decimal_places=2, default=0,
        help_text='Monto de ingreso',
    )
    monto_egreso = models.DecimalField(
        max_digits=18, decimal_places=2, default=0,
        help_text='Monto de egreso',
    )
    vuelto = models.DecimalField(
        max_digits=18, decimal_places=2, default=0,
        help_text='Vuelto entregado',
    )

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
