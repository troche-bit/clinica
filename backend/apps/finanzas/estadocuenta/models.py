from django.db import models
from apps.core.models import BaseModel


class CtaCobrar(BaseModel):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('pagado',    'Pagado'),
        ('vencido',   'Vencido'),
    ]

    vfc = models.ForeignKey(
        'facturacion.VentaFactCab',
        on_delete=models.CASCADE,
        related_name='cuotas',
    )
    nro_cuota         = models.PositiveIntegerField()
    cant_cuota        = models.PositiveIntegerField()
    monto_total       = models.DecimalField(max_digits=18, decimal_places=2)
    monto_cuota       = models.DecimalField(max_digits=18, decimal_places=2)
    saldo             = models.DecimalField(max_digits=18, decimal_places=2)
    fecha_vencimiento = models.DateField()
    estado            = models.CharField(max_length=20, choices=ESTADO_CHOICES, default='pendiente')

    class Meta:
        db_table            = 'cta_cobrar'
        verbose_name        = 'Cuota a cobrar'
        verbose_name_plural = 'Cuotas a cobrar'
        ordering            = ['vfc', 'nro_cuota']

    def __str__(self):
        return f'Factura {self.vfc_id} — Cuota {self.nro_cuota}/{self.cant_cuota}'
