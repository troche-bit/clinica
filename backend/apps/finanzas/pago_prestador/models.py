from django.db import models
from django.db.models import Q
from apps.core.models import BaseModel


class PagoPrestador(BaseModel):
    ESTADO_CHOICES = [
        ('pendiente', 'Pendiente'),
        ('parcial',   'Parcial'),
        ('pagado',    'Pagado'),
    ]

    persona_rrhh    = models.ForeignKey(
        'persona_rrhh.PersonaRRHH',
        on_delete=models.PROTECT,
        related_name='pagos',
    )
    nro_comprobante = models.PositiveIntegerField(null=True, blank=True)
    fecha_pago      = models.DateField()
    monto_hora      = models.DecimalField(max_digits=18, decimal_places=2)
    total_hora      = models.DecimalField(max_digits=18, decimal_places=2)
    monto_total     = models.DecimalField(max_digits=18, decimal_places=2)
    saldo           = models.DecimalField(max_digits=18, decimal_places=2)
    estado          = models.CharField(max_length=50, choices=ESTADO_CHOICES, default='pendiente')

    class Meta:
        db_table            = 'pago_prestador'
        verbose_name        = 'Pago a prestador'
        verbose_name_plural = 'Pagos a prestadores'
        ordering            = ['-fecha_pago', '-fecha_creacion']
        constraints         = [
            models.UniqueConstraint(
                fields=['nro_comprobante'],
                condition=Q(is_deleted=False) & Q(nro_comprobante__isnull=False),
                name='unique_pago_prestador_nro_activo',
            ),
        ]

    def __str__(self):
        return f'Pago #{self.id} — {self.persona_rrhh} — {self.fecha_pago}'


class PagoPrestadorDetCobranza(BaseModel):
    pago_prestador = models.ForeignKey(
        PagoPrestador, on_delete=models.CASCADE, related_name='detalle_cobranza',
    )
    forma_pago = models.ForeignKey(
        'forma_pago.FormaPago', on_delete=models.PROTECT, related_name='pago_prestador_det',
    )
    cta = models.ForeignKey(
        'caja_banco.CuentaMcb', on_delete=models.PROTECT, related_name='pago_prestador_det',
    )
    monto   = models.DecimalField(max_digits=18, decimal_places=2)
    voucher = models.CharField(max_length=100, blank=True, default='')

    class Meta:
        db_table            = 'pago_prestador_det_cobranza'
        verbose_name        = 'Detalle cobranza pago prestador'
        verbose_name_plural = 'Detalles cobranza pagos prestadores'
        ordering            = ['id']
